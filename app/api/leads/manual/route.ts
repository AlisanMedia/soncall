import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { NextResponse } from 'next/server';
import { canAccessMarket, canManageMarket } from '@/lib/market-access';

export async function POST(req: Request) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { business_name, phone_number, note, agent_id } = body;

        // Basic validation
        if (!business_name || !phone_number) {
            return NextResponse.json(
                { error: 'İşletme Adı ve Telefon Numarası zorunludur.' },
                { status: 400 }
            );
        }

        const serviceClient = createServiceRoleClient();
        const { data: profile, error: profileError } = await serviceClient
            .from('profiles').select('id, role, market_id, sales_role')
            .eq('id', user.id).maybeSingle();
        if (profileError) throw profileError;
        if (!profile || !['agent', 'manager', 'admin', 'founder'].includes(profile.role)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const assigneeId = agent_id || user.id;
        if (assigneeId !== user.id && !canManageMarket(profile.role)) {
            return NextResponse.json({ error: 'You cannot assign leads to another user' }, { status: 403 });
        }
        const { data: assignee, error: assigneeError } = await serviceClient
            .from('profiles').select('id, role, sales_role, market_id')
            .eq('id', assigneeId).maybeSingle();
        if (assigneeError) throw assigneeError;
        if (!assignee || assignee.role !== 'agent' || assignee.sales_role !== 'sdr') {
            return NextResponse.json({ error: 'Manual leads must be assigned to an SDR' }, { status: 400 });
        }
        if (!assignee.market_id || !canAccessMarket(profile, assignee.market_id)) {
            return NextResponse.json({ error: 'Assignee market is missing or forbidden' }, { status: 403 });
        }

        const newLead = {
            business_name,
            phone_number,
            // Default fields for manually added leads
            address: 'Manuel Giriş',
            category: 'Manuel',
            website: null,
            rating: null,
            status: 'pending',
            potential_level: 'not_assessed',
            assigned_to: assigneeId,
            sdr_id: assigneeId,
            market_id: assignee.market_id,
            current_agent_id: assigneeId === user.id ? user.id : null,
            locked_at: assigneeId === user.id ? new Date().toISOString() : null,

            raw_data: {
                source: 'manual_entry',
                created_by: user.id,
                initial_note: note || ''
            }
        };

        const { data, error } = await serviceClient
            .from('leads')
            .insert(newLead)
            .select()
            .single();

        if (error) {
            console.error('Database error:', error);
            return NextResponse.json({ error: 'Veritabanı hatası: ' + error.message }, { status: 500 });
        }

        // If there's an initial note, add it to lead_notes could be nice, but raw_data is enough for now.
        // Actually, users might expect to see the note in "History".
        // Let's add a note if provided.
        if (note) {
            await serviceClient.from('lead_notes').insert({
                lead_id: data.id,
                agent_id: user.id,
                note: `[Manuel Giriş Notu]: ${note}`,
                action_taken: 'lead_created'
            });
        }

        return NextResponse.json({ success: true, lead: data });

    } catch (err: unknown) {
        console.error('Error creating manual lead:', err);
        return NextResponse.json(
            { error: 'Sunucu hatası: ' + (err instanceof Error ? err.message : 'Bilinmeyen hata') },
            { status: 500 }
        );
    }
}
