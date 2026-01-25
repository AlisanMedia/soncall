import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient(); // Auth context

        // 1. Authenticate Agent
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Use Admin Client for data fetching to bypass RLS policies that might be restricted to 'agent' role
        const adminSupabase = createAdminClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const { data: profile } = await adminSupabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (!['agent', 'manager', 'admin', 'founder'].includes(profile?.role)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // 2. Parse Query Parameters
        const searchParams = request.nextUrl.searchParams;
        const status = searchParams.get('status');
        const potentialLevel = searchParams.get('potential_level');
        const dateFrom = searchParams.get('date_from');
        const dateTo = searchParams.get('date_to');
        const search = searchParams.get('search');

        console.log(`[LeadHistory] Fetching for User: ${user.id}, Role: ${profile?.role}`);

        // 3. Get Relevant Lead IDs
        // A. Leads currently assigned to the agent
        const { data: assignedLeads } = await adminSupabase
            .from('leads')
            .select('id')
            .eq('assigned_to', user.id);

        const assignedIds = assignedLeads?.map(l => l.id) || [];
        console.log(`[LeadHistory] Assigned Leads: ${assignedIds.length}`);

        // B. Leads worked on by the agent (from history)
        const { data: workedLeads } = await adminSupabase
            .from('lead_activity_log')
            .select('lead_id')
            .eq('agent_id', user.id);

        const workedIds = workedLeads?.map(l => l.lead_id) || [];
        console.log(`[LeadHistory] Worked Leads: ${workedIds.length}`);

        // Combine and deduplicate
        const allRelevantIds = Array.from(new Set([...assignedIds, ...workedIds]));
        console.log(`[LeadHistory] Total Unique IDs: ${allRelevantIds.length}`);

        if (allRelevantIds.length === 0) {
            return NextResponse.json({
                leads: [],
                total: 0
            });
        }

        // 4. Build Main Query
        let query = adminSupabase
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
        let countQuery = adminSupabase
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
        }, {
            headers: {
                'Cache-Control': 'no-store, max-age=0'
            }
        });

    } catch (error: any) {
        console.error('Agent leads fetch error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to fetch leads' },
            { status: 500 }
        );
    }
}
