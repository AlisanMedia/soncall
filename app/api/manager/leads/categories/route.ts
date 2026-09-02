import { NextResponse } from 'next/server';
import { requireManagerAccess } from '@/lib/api/auth';
import { resolveRequestedMarketId } from '@/lib/market-access';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const auth = await requireManagerAccess();
        if (!auth.ok) return auth.response;

        const supabase = auth.supabase;

        // Fetch categories
        // Optimization: We fetch just the category column. 
        // Since Supabase JS client doesn't support .distinct() directly on simple selects easily without RPC,
        // we fetch all (or a large limit) and dedup in memory. 
        // For < 50k leads this is fine.
        const effectiveMarketId = resolveRequestedMarketId(auth.profile, new URL(request.url).searchParams.get('marketId'));
        let query = supabase
            .from('leads')
            .select('category')
            .order('created_at', { ascending: false })
            .limit(5000); // Analyze last 5000 leads
        if (effectiveMarketId) query = query.eq('market_id', effectiveMarketId);
        const { data, error } = await query;

        if (error) throw error;

        // Dedup and normalize
        const uniqueCategories = new Set<string>();
        data?.forEach(l => {
            if (l.category && l.category.trim() !== '') {
                uniqueCategories.add(l.category);
            } else {
                uniqueCategories.add('Belirsiz');
            }
        });

        const categories = Array.from(uniqueCategories).sort();

        return NextResponse.json({ categories });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Categories failed';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
