import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const supabase = await createClient();
        const { id } = await params;
        const { searchParams } = new URL(request.url);

        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '50');
        const status = searchParams.get('status');
        const search = searchParams.get('search');
        const assignedTo = searchParams.get('assigned_to');

        // Auth Check
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (!['manager', 'admin', 'founder'].includes(profile?.role || '')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Build Query
        let query = supabase
            .from('leads')
            .select(`
                id,
                business_name,
                phone_number,
                status,
                potential_level,
                created_at,
                updated_at,
                processed_at,
                appointment_date,
                assigned_to,
                profiles_assigned:profiles!leads_assigned_to_fkey (
                    full_name
                )
            `, { count: 'exact' })
            .eq('batch_id', id);

        // Apply Filters
        if (status && status !== 'all') {
            query = query.eq('status', status);
        }

        if (assignedTo && assignedTo !== 'all') {
            query = query.eq('assigned_to', assignedTo);
        }

        if (search) {
            query = query.or(`business_name.ilike.%${search}%,phone_number.ilike.%${search}%`);
        }

        // Pagination
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        const { data, count, error } = await query
            .order('updated_at', { ascending: false })
            .range(from, to);

        if (error) throw error;

        // Fetch Batch Info for Header
        const { data: batchInfo } = await supabase
            .from('upload_batches')
            .select('filename, created_at, status')
            .eq('id', id)
            .single();

        return NextResponse.json({
            success: true,
            meta: {
                total_records: count || 0,
                current_page: page,
                total_pages: Math.ceil((count || 0) / limit),
                batch_info: batchInfo
            },
            data
        });

    } catch (error: any) {
        console.error('Batch Detail API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
