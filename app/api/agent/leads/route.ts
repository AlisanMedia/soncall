import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();

        // 1. Authenticate Agent
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (profile?.role !== 'agent') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // 2. Parse Query Parameters
        const searchParams = request.nextUrl.searchParams;
        const status = searchParams.get('status');
        const potentialLevel = searchParams.get('potential_level');
        const dateFrom = searchParams.get('date_from');
        const dateTo = searchParams.get('date_to');
        const search = searchParams.get('search');

        // 3. Get Relevant Lead IDs
        // A. Leads currently assigned to the agent
        const { data: assignedLeads } = await supabase
            .from('leads')
            .select('id')
            .eq('assigned_to', user.id);

        const assignedIds = assignedLeads?.map(l => l.id) || [];

        // B. Leads worked on by the agent (from history)
        const { data: workedLeads } = await supabase
            .from('lead_activity_log')
            .select('lead_id')
            .eq('agent_id', user.id);

        const workedIds = workedLeads?.map(l => l.lead_id) || [];

        // Combine and deduplicate
        const allRelevantIds = Array.from(new Set([...assignedIds, ...workedIds]));

        if (allRelevantIds.length === 0) {
            return NextResponse.json({
                leads: [],
                total: 0
            });
        }

        // 4. Build Main Query
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
                processed_at,
                created_at,
                lead_notes (
                    note,
                    action_taken,
                    created_at
                )
            `)
            .in('id', allRelevantIds)
            .order('processed_at', { ascending: false, nullsFirst: false })
            .order('created_at', { ascending: false });

        // Apply Filters
        if (status && status !== 'all') {
            query = query.eq('status', status);
        }

        if (potentialLevel && potentialLevel !== 'all') {
            query = query.eq('potential_level', potentialLevel);
        }

        if (dateFrom) {
            query = query.gte('processed_at', dateFrom);
        }

        if (dateTo) {
            // Add one day to include the entire end date
            const endDate = new Date(dateTo);
            endDate.setDate(endDate.getDate() + 1);
            query = query.lt('processed_at', endDate.toISOString());
        }

        if (search) {
            query = query.or(`business_name.ilike.%${search}%,phone_number.ilike.%${search}%`);
        }

        const { data: leads, error } = await query;

        if (error) throw error;

        // 5. Count Total
        // We can't use simple count query easily with 'in' if the list is huge, 
        // but for <1000 items it's fine. Or we just return lead.length for now since client doesn't use pagination count yet?
        // Let's do a simple count on the same query logic (minus select fields)
        const { count } = await supabase
            .from('leads')
            .select('id', { count: 'exact', head: true })
            .in('id', allRelevantIds);
        // Note: Applying filters to count query would be ideal but skipped for brevity unless critical
        // Given the UI doesn't seem to rely heavily on 'total' for pagination, simple count or leads.length might suffice.
        // But let's try to be consistent with filtered count if possible.

        // Accurate count with filters:
        let countQuery = supabase
            .from('leads')
            .select('id', { count: 'exact', head: true })
            .in('id', allRelevantIds);

        if (status && status !== 'all') countQuery = countQuery.eq('status', status);
        if (potentialLevel && potentialLevel !== 'all') countQuery = countQuery.eq('potential_level', potentialLevel);
        if (search) countQuery = countQuery.or(`business_name.ilike.%${search}%,phone_number.ilike.%${search}%`);

        const { count: filteredCount } = await countQuery;

        return NextResponse.json({
            leads: leads || [],
            total: filteredCount || 0
        });

    } catch (error: any) {
        console.error('Agent leads fetch error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to fetch leads' },
            { status: 500 }
        );
    }
}
