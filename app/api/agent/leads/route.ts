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

        // 3. Build Query
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
            .eq('assigned_to', user.id)
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

        // 4. Count Total
        let countQuery = supabase
            .from('leads')
            .select('id', { count: 'exact', head: true })
            .eq('assigned_to', user.id);

        if (status && status !== 'all') {
            countQuery = countQuery.eq('status', status);
        }

        const { count } = await countQuery;

        return NextResponse.json({
            leads: leads || [],
            total: count || 0
        });

    } catch (error: any) {
        console.error('Agent leads fetch error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to fetch leads' },
            { status: 500 }
        );
    }
}
