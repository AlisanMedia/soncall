
import { NextResponse } from 'next/server';
import { requireManagerAccess } from '@/lib/api/auth';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
    try {
        const auth = await requireManagerAccess();
        if (!auth.ok) return auth.response;

        const supabase = createAdminClient();

        const { count: logCount } = await supabase
            .from('lead_activity_log')
            .select('id', { count: 'exact', head: true })
            .eq('agent_id', auth.user.id);

        const { count: leadCount } = await supabase
            .from('leads')
            .select('id', { count: 'exact', head: true })
            .eq('assigned_to', auth.user.id);

        return NextResponse.json({
            role: auth.profile.role,
            logCount,
            leadCount,
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
