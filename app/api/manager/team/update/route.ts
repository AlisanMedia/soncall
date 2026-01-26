import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function PUT(req: Request) {
    try {
        const supabase = await createClient();

        // Check authorization
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
        if (!['manager', 'admin', 'founder'].includes(profile?.role)) {
            return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
        }

        const body = await req.json();
        const { id, fullName, tcNumber, birthDate, city, district, phoneNumber, role, commissionRate } = body;

        const { error } = await supabase
            .from('profiles')
            .update({
                full_name: fullName,
                tc_number: tcNumber,
                birth_date: birthDate,
                city,
                district,
                phone_number: phoneNumber,
                commission_rate: commissionRate,
                role
            })
            .eq('id', id);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error updating member:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
