
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// Initialize OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
    try {
        const { businessName, location } = await request.json();

        if (!businessName) {
            return NextResponse.json({ error: 'Business name is required' }, { status: 400 });
        }

        console.log(`🔍 [Enrichment] Searching for: ${businessName}`);

        // 1. Search Logic
        let searchResults = [];
        let searchSource = 'none';

        if (process.env.GOOGLE_API_KEY && process.env.GOOGLE_SEARCH_ENGINE_ID) {
            console.log('🌐 [Enrichment] Using Google Custom Search API');
            try {
                const query = `${businessName} ${location || ''} official website social media instagram facebook linkedin`;
                const googleUrl = `https://www.googleapis.com/customsearch/v1?key=${process.env.GOOGLE_API_KEY}&cx=${process.env.GOOGLE_SEARCH_ENGINE_ID}&q=${encodeURIComponent(query)}`;

                const res = await fetch(googleUrl);
                const data = await res.json();

                if (data.items) {
                    searchResults = data.items.map((item: any) => ({
                        title: item.title,
                        link: item.link,
                        snippet: item.snippet
                    }));
                    searchSource = 'google_api';
                }
            } catch (err) {
                console.error('❌ [Enrichment] Google Search failed:', err);
            }
        } else {
            // STRICT MODE: No keys = Error
            return NextResponse.json({
                error: 'Google API Key eksik! Lütfen sistem yöneticisiyle iletişime geçin. (Strict Mode A)'
            }, { status: 500 });
        }

        // 2. AI Analysis
        const systemPrompt = `
            You are an expert Digital Footprint Analyst.
            Your goal is to find the official website and social media profiles for a business.
            
            Business Name: "${businessName}"
            Location: "${location || 'Unknown'}"
            
            I will provide you with Search Results (if available). 
            If search results are empty, rely on your internal knowledge or generate the most probable URL patterns.
            
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
                "summary": "Brief analysis of digital presence (Turkish language)"
            }
        `;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            response_format: { type: "json_object" },
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: `Search Results:\n${JSON.stringify(searchResults, null, 2)}` }
            ]
        });

        const analysis = JSON.parse(completion.choices[0].message.content || '{}');

        return NextResponse.json({
            success: true,
            data: analysis,
            meta: {
                source: searchSource,
                results_count: searchResults.length
            }
        });

    } catch (error: any) {
        console.error('❌ [Enrichment] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
