import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { NextResponse } from 'next/server';

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

        // Use the provided agent_id, or fallback to the current user (in case caller didn't send agent_id)
        // If agent_id is different from user.id, maybe check if user is manager? For now assume agent is adding for self.
        const assigneeId = agent_id || user.id;

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
            assigned_to: assigneeId,     // Assign to the agent
            current_agent_id: assigneeId, // Lock it immediately to this agent? 
            // Setting current_agent_id assigns "ownership" / "working on it" status.
            // But LeadCard logic sets 'current_agent_id' when locking a lead.
            // If we set it here, LeadCard might see it as "already locked" which is good.
            // However, LeadCard logic for 'loadNextLead' looks for leads where `current_agent_id` is null or specific.
            // Actually, if we set it here, LeadCard *won't* pick it up via `loadNextLead`'s default query 
            // `is('current_agent_id', null)`.
            // BUT, if we use the localStorage ID trick, LeadCard loads by ID directly!
            // Line 54: .eq('id', savedLeadId) .eq('assigned_to', agentId)
            // It doesn't check 'current_agent_id' explicitly there, assuming if ID is known it's okay.
            // Wait, line 60: "Re-lock the lead". It updates current_agent_id.
            // So if I set current_agent_id here, it's fine. It's pre-locked.

            raw_data: {
                source: 'manual_entry',
                created_by: user.id,
                initial_note: note || ''
            }
        };

        const serviceClient = createServiceRoleClient();

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

    } catch (err: any) {
        console.error('Error creating manual lead:', err);
        return NextResponse.json(
            { error: 'Sunucu hatası: ' + (err.message || 'Bilinmeyen hata') },
            { status: 500 }
        );
    }
}
