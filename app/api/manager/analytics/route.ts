import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { fetchManagerAnalytics } from '@/lib/analytics';
import { resolveRequestedMarketId } from '@/lib/market-access';

export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();

        // Verify authentication
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        // Verify manager role
        const { data: profile } = await supabase
            .from('profiles')
            .select('id, role, market_id')
            .eq('id', user.id)
            .single();

        const role = (profile?.role || '').toLowerCase();
if (!['manager', 'admin', 'founder'].includes(role)) {
            return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
        }

        // Fetch analytics using shared logic
        const effectiveMarketId = resolveRequestedMarketId(profile, request.nextUrl.searchParams.get('marketId'));
        const analyticsData = await fetchManagerAnalytics(supabase, effectiveMarketId);

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
