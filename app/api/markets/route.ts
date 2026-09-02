import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isGlobalRole } from '@/lib/market-access';

export async function GET() {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('id, role, market_id')
            .eq('id', user.id)
            .maybeSingle();

        if (profileError) throw profileError;
        if (!profile) {
            return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
        }

        let query = supabase
            .from('markets')
            .select('id, code, name, country, default_language, timezone, currency, calling_country_code')
            .eq('is_active', true)
            .order('code');

        if (!isGlobalRole(profile.role) && profile.market_id) {
            query = query.eq('id', profile.market_id);
        }

        const { data: markets, error } = await query;
        if (error) throw error;

        return NextResponse.json({
            markets: markets || [],
            currentMarketId: profile.market_id || null,
            canSwitchMarket: isGlobalRole(profile.role),
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Markets failed';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
