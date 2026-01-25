
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
    try {
        // Init Admin Client
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const email = 'efebusinessonlybusiness@gmail.com';

        // 1. Get Profile
        const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('email', email)
            .single();

        if (!profile) return NextResponse.json({ error: 'Profile not found' });

        // 2. Count Logs
        const { count: logCount, data: logs } = await supabase
            .from('lead_activity_log')
            .select('*', { count: 'exact' })
            .eq('agent_id', profile.id);

        // 3. Count Assigned Leads
        const { count: leadCount } = await supabase
            .from('leads')
            .select('*', { count: 'exact' })
            .eq('assigned_to', profile.id);

        return NextResponse.json({
            profileId: profile.id,
            role: profile.role,
            logCount,
            leadCount,
            firstLog: logs && logs.length > 0 ? logs[0] : null
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
