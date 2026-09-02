import { NextResponse } from 'next/server';
import { requireManagerAccess } from '@/lib/api/auth';
import { resolveRequestedMarketId } from '@/lib/market-access';

export async function GET(request: Request) {
    try {
        const auth = await requireManagerAccess();
        if (!auth.ok) return auth.response;
        const supabase = auth.supabase;

        // Get profiles with role='agent' or 'manager' (essentially all team members)
        const baseQuery = supabase
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false });
        const requestedMarketId = new URL(request.url).searchParams.get('marketId');
        const effectiveMarketId = resolveRequestedMarketId(auth.profile, requestedMarketId);
        const query = effectiveMarketId
            ? baseQuery.eq('market_id', effectiveMarketId)
            : baseQuery;
        const { data: team, error } = await query;

        if (error) throw error;

        return NextResponse.json({ team });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to fetch team';
        console.error('Error fetching team:', error);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
