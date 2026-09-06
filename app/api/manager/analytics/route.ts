import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { fetchManagerAnalytics } from '@/lib/analytics';
import { resolveRequestedMarketId } from '@/lib/market-access';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();

        // Verify authentication
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        // Verify manager role
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('id, role, market_id')
            .eq('id', user.id)
            .single();

        if (profileError) throw profileError;
        const role = (profile?.role || '').toLowerCase();
        if (!['manager', 'admin', 'founder'].includes(role)) {
            return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
        }

        // Fetch analytics using shared logic
        const effectiveMarketId = resolveRequestedMarketId(profile, request.nextUrl.searchParams.get('marketId'));
        // The session client can hide nested lead rows through child-table RLS,
        // causing empty charts or a 500. Authentication/market authorization is
        // complete above; the analytics helper applies the market filter to every
        // aggregate query, so use the admin client for reliable joins.
        const analyticsData = await fetchManagerAnalytics(createAdminClient(), effectiveMarketId);

        return NextResponse.json(analyticsData);

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to fetch analytics';
        console.error('Analytics error:', error);
        return NextResponse.json(
            { message },
            { status: 500 }
        );
    }
}
