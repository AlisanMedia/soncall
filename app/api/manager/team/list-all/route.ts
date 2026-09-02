import { createClient } from '@supabase/supabase-js'; // Use admin client
import { createClient as createServerClient } from '@/lib/supabase/server'; // Use auth client
import { NextResponse } from 'next/server';
import { resolveRequestedMarketId } from '@/lib/market-access';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        // 1. Verify Requestor is Manager/Admin
        const supabase = await createServerClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { data: profile } = await supabase
            .from('profiles')
            .select('id, role, market_id')
            .eq('id', user.id)
            .single();

        if (!['manager', 'admin', 'founder'].includes(profile?.role || '')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // 2. Fetch All Agents/Admins/Founders using Service Role (Bypass RLS)
        // This ensures we see EVERYONE regardless of restrictive policies
        const adminAuthClient = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const baseQuery = adminAuthClient
            .from('profiles')
            .select('id, full_name, role, sales_role, email, avatar_url, phone_number, market_id')
            .in('role', ['agent', 'admin', 'founder'])
            .order('full_name');
        const requestedMarketId = new URL(request.url).searchParams.get('marketId');
        const effectiveMarketId = resolveRequestedMarketId(profile, requestedMarketId);
        const query = effectiveMarketId
            ? baseQuery.eq('market_id', effectiveMarketId)
            : baseQuery;
        const { data: team, error } = await query;

        if (error) throw error;

        return NextResponse.json({ agents: team });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to fetch team';
        console.error('Error fetching team:', error);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
