
import { NextResponse } from 'next/server';
import { requireManagerAccess } from '@/lib/api/auth';
import { createAdminClient } from '@/lib/supabase/admin';

function maskPhone(phone: string | null) {
    if (!phone) return null;
    const digits = phone.replace(/\D/g, '');
    if (digits.length <= 4) return digits;
    return `${'*'.repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
}

export async function GET() {
    try {
        const auth = await requireManagerAccess();
        if (!auth.ok) return auth.response;

        const supabase = createAdminClient();

        const { data, error } = await supabase
            .from('sms_logs')
            .select('id, sent_to, direction, status, trigger_type, is_read, created_at')
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) throw error;

        return NextResponse.json({
            count: data.length,
            logs: data.map(log => ({
                ...log,
                sent_to: maskPhone(log.sent_to),
            })),
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
