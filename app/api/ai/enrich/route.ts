
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { requireManagerAccess } from '@/lib/api/auth';
import { logAiUsage } from '@/lib/ai-usage';

type GoogleSearchItem = {
    title: string;
    link: string;
    snippet: string;
};

type SocialLink = {
    platform: string;
    url: string;
};

// Helper to extract social links from HTML
const extractSocials = (html: string) => {
    const socials: SocialLink[] = [];
    // Regex patterns for major platforms
    const patterns = [
        { platform: 'instagram', regex: /https?:\/\/(www\.)?instagram\.com\/[a-zA-Z0-9_.-]+/gi },
        { platform: 'facebook', regex: /https?:\/\/(www\.)?facebook\.com\/[a-zA-Z0-9_.-]+/gi },
        { platform: 'linkedin', regex: /https?:\/\/(www\.)?linkedin\.com\/(company|in)\/[a-zA-Z0-9_.-]+/gi },
        { platform: 'twitter', regex: /https?:\/\/(www\.)?(twitter|x)\.com\/[a-zA-Z0-9_.-]+/gi },
        { platform: 'youtube', regex: /https?:\/\/(www\.)?youtube\.com\/(@[a-zA-Z0-9_.-]+|channel\/[a-zA-Z0-9_-]+|user\/[a-zA-Z0-9_-]+)/gi }
    ];

    for (const pat of patterns) {
        const matches = html.match(pat.regex);
        if (matches) {
            // Get the first match, clean it up
            const url = matches[0];
            // Filter out obviously wrong ones (like share links if needed, but basic regex usually ok)
            socials.push({ platform: pat.platform, url: url });
        }
    }

    return socials;
};

export async function POST(request: NextRequest) {
    try {
        const auth = await requireManagerAccess();
        if (!auth.ok) return auth.response;

        if (!process.env.OPENAI_API_KEY) {
            return NextResponse.json({ error: 'AI service is not configured' }, { status: 503 });
        }
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        const { businessName, location } = await request.json();

        if (!businessName) {
            return NextResponse.json({ error: 'Business name is required' }, { status: 400 });
        }

        console.log(`🔍 [Enrichment] Searching for: ${businessName}`);

        // 1. Search Logic
        let searchResults: GoogleSearchItem[] = [];
        let searchSource = 'none';
        let websiteUrl: string | null = null;
        let scrapedSocials: SocialLink[] = [];

        if (process.env.GOOGLE_API_KEY && process.env.GOOGLE_SEARCH_ENGINE_ID) {
            console.log('🌐 [Enrichment] Using Google Custom Search API');
            try {
                // Modified query to strictly find official site
                const query = `${businessName} ${location || ''} official website`;
                const googleUrl = `https://www.googleapis.com/customsearch/v1?key=${process.env.GOOGLE_API_KEY}&cx=${process.env.GOOGLE_SEARCH_ENGINE_ID}&q=${encodeURIComponent(query)}`;

                const res = await fetch(googleUrl);
                const data = await res.json();

                if (data.items && data.items.length > 0) {
                    searchResults = data.items.map((item: GoogleSearchItem) => ({
                        title: item.title,
                        link: item.link,
                        snippet: item.snippet
                    }));
                    searchSource = 'google_api';

                    // Try to identify the official website (skip known directories if possible, but for now take first non-social)
                    const socialDomains = ['instagram.com', 'facebook.com', 'linkedin.com', 'twitter.com', 'youtube.com', 'trendyol.com', 'getir.com', 'yemeksepeti.com'];

                    const bestResult = data.items.find((item: GoogleSearchItem) => {
                        const link = item.link.toLowerCase();
                        return !socialDomains.some(d => link.includes(d));
                    });

                    if (bestResult) {
                        websiteUrl = bestResult.link;
                        console.log(`found website: ${websiteUrl}`);
                    }
                }
            } catch (err) {
                console.error('❌ [Enrichment] Google Search failed:', err);
            }
        } else {
            console.warn('⚠️ [Enrichment] Google Search API keys missing. Proceeding with limited results.');
            searchSource = 'no_keys_fallback';
        }

        // 2. Website Scraping (If website found)
        if (websiteUrl) {
            try {
                console.log(`🕷️ [Enrichment] Scraping website: ${websiteUrl}`);
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

                const siteRes = await fetch(websiteUrl, {
                    signal: controller.signal,
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
                });
                clearTimeout(timeoutId);

                if (siteRes.ok) {
                    const html = await siteRes.text();
                    scrapedSocials = extractSocials(html);
                    searchSource = 'website_scrape';
                }
            } catch (scrapeErr) {
                console.error('❌ [Enrichment] Scraping failed:', scrapeErr);
                // Fallback to continuing with just search results
            }
        }

        // 3. AI Analysis (Final Polish / Fallback)
        // If we scraped socials, we pass them to AI to just format/validate, or we skip AI entirely?
        // Let's use AI to synthesize everything (search results + scraped data) for the best summary.

        const systemPrompt = `
            You are an expert Digital Footprint Analyst.
            Your goal is to find the official website and social media profiles for a business.
            
            Business Name: "${businessName}"
            Location: "${location || 'Unknown'}"
            
            I will provide:
            1. Search Results (Google)
            2. Scraped Website Data (If successful)
            
            Your job is to prioritized Scraped Data.
            
            Output strictly valid JSON:
            {
                "website": "url or null",
                "address": "Full physical address found in search results or null",
                "socials": [
                    { "platform": "instagram", "url": "url" },
                    { "platform": "facebook", "url": "url" },
                    { "platform": "linkedin", "url": "url" }
                ],
                "confidence_score": 0-10,
                "summary": "Brief analysis of digital presence (Turkish language). Mention if website was found and scraped."
            }
        `;

        const model = process.env.OPENAI_ENRICH_MODEL || 'gpt-4o-mini';
        const completion = await openai.chat.completions.create({
            model,
            response_format: { type: "json_object" },
            messages: [
                { role: "system", content: systemPrompt },
                {
                    role: "user", content: `
                    Search Results: ${JSON.stringify(searchResults)}
                    Website Found: ${websiteUrl}
                    Scraped Socials: ${JSON.stringify(scrapedSocials)}
                ` }
            ]
        });

        const analysis = JSON.parse(completion.choices[0].message.content || '{}');

        await logAiUsage(auth.supabase, {
            userId: auth.user.id,
            marketId: auth.profile.market_id || null,
            feature: 'lead_enrich',
            model,
            inputTokens: completion.usage?.prompt_tokens || 0,
            outputTokens: completion.usage?.completion_tokens || 0,
            totalTokens: completion.usage?.total_tokens || 0,
            metadata: {
                business_name: businessName,
                search_source: searchSource,
                results_count: searchResults.length,
            },
        });

        // Force overwrite with scraping data if available (AI sometimes hallucinates)
        if (websiteUrl) analysis.website = websiteUrl;
        if (scrapedSocials.length > 0) {
            // Merge logic: Add scraped ones if not present
            const existingPlatforms = new Set(analysis.socials?.map((s: SocialLink) => s.platform) || []);
            scrapedSocials.forEach(s => {
                if (!existingPlatforms.has(s.platform)) {
                    analysis.socials = [...(analysis.socials || []), s];
                }
            });
        }

        return NextResponse.json({
            success: true,
            data: analysis,
            meta: {
                source: searchSource,
                results_count: searchResults.length
            }
        });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Enrichment failed';
        console.error('❌ [Enrichment] Error:', error);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
