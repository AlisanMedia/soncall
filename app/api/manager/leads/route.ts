import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

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
            .select('role')
            .eq('id', user.id)
            .single();

        if (!['manager', 'admin', 'founder'].includes(profile?.role || '')) {
            return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const agentId = searchParams.get('agentId');
        const status = searchParams.get('status');
        const batchId = searchParams.get('batchId');

        // Build query
        let query = supabase
            .from('leads')
            .select(`
        id,
        business_name,
        phone_number,
        address,
        category,
        status,
        potential_level,
        created_at,
        processed_at,
        assigned_to,
        batch_id,
        profiles!leads_assigned_to_fkey (
          full_name
        )
      `)
            .order('created_at', { ascending: false });

        // Apply filters
        if (agentId) {
            query = query.eq('assigned_to', agentId);
        }
        if (status) {
            query = query.eq('status', status);
        }
        if (batchId) {
            query = query.eq('batch_id', batchId);
        }

        const { data: leads, error: leadsError } = await query.limit(100);

        if (leadsError) throw leadsError;

        // Get notes for these leads
        const leadIds = leads?.map(l => l.id) || [];
        const { data: notes, error: notesError } = await supabase
            .from('lead_notes')
            .select(`
        lead_id,
        note,
        action_taken,
        created_at,
        agent_id,
        profiles!lead_notes_agent_id_fkey (
          full_name
        )
      `)
            .in('lead_id', leadIds)
            .order('created_at', { ascending: false });

        if (notesError) throw notesError;

        // Get call logs for these leads
        const { data: callLogs, error: logsError } = await supabase
            .from('call_logs')
            .select('*')
            .in('lead_id', leadIds)
            .order('created_at', { ascending: false });

        if (logsError) throw logsError;

        // Group notes and logs by lead_id
        const notesByLead: Record<string, any[]> = {};
        notes?.forEach(note => {
            if (!notesByLead[note.lead_id]) {
                notesByLead[note.lead_id] = [];
            }
            notesByLead[note.lead_id].push(note);
        });

        const logsByLead: Record<string, any[]> = {};
        callLogs?.forEach(log => {
            if (!logsByLead[log.lead_id]) {
                logsByLead[log.lead_id] = [];
            }
            logsByLead[log.lead_id].push(log);
        });

        // Enrich leads with notes
        // Enrich leads with notes
        const enrichedLeads = leads?.map(lead => ({
            ...lead,
            notes: notesByLead[lead.id] || [],
            latest_note: notesByLead[lead.id]?.[0] || null,
            call_logs: logsByLead[lead.id] || [],
        }));

        return NextResponse.json({
            leads: enrichedLeads,
        });

    } catch (error: any) {
        console.error('Manager leads error:', error);
        return NextResponse.json(
            { message: error.message || 'Failed to fetch leads' },
            { status: 500 }
        );
    }
}
