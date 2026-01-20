import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
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

        if (profile?.role !== 'manager') {
            return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
        }

        // Get all batches with stats
        const { data: batches, error: batchesError } = await supabase
            .from('upload_batches')
            .select(`
        id,
        filename,
        total_leads,
        created_at,
        uploaded_by,
        profiles!upload_batches_uploaded_by_fkey (
          full_name
        )
      `)
            .order('created_at', { ascending: false })
            .limit(10);

        if (batchesError) throw batchesError;

        // For each batch, get lead statistics
        const batchStats = await Promise.all(
            (batches || []).map(async (batch) => {
                // Total leads in batch
                const { count: total } = await supabase
                    .from('leads')
                    .select('*', { count: 'exact', head: true })
                    .eq('batch_id', batch.id);

                // Assigned leads
                const { count: assigned } = await supabase
                    .from('leads')
                    .select('*', { count: 'exact', head: true })
                    .eq('batch_id', batch.id)
                    .not('assigned_to', 'is', null);

                // Completed leads (all non-pending statuses)
                const { count: completed } = await supabase
                    .from('leads')
                    .select('*', { count: 'exact', head: true })
                    .eq('batch_id', batch.id)
                    .neq('status', 'pending');

                // Pending leads
                const { count: pending } = await supabase
                    .from('leads')
                    .select('*', { count: 'exact', head: true })
                    .eq('batch_id', batch.id)
                    .eq('status', 'pending');

                // Status breakdown
                const { data: statusData } = await supabase
                    .from('leads')
                    .select('status')
                    .eq('batch_id', batch.id);

                const statusCounts = {
                    pending: 0,
                    in_progress: 0,
                    contacted: 0,
                    appointment: 0,
                    not_interested: 0,
                    callback: 0,
                };

                statusData?.forEach((lead: any) => {
                    if (lead.status in statusCounts) {
                        statusCounts[lead.status as keyof typeof statusCounts]++;
                    }
                });

                return {
                    ...batch,
                    stats: {
                        total: total || 0,
                        assigned: assigned || 0,
                        completed: completed || 0,
                        pending: pending || 0,
                        progress_percentage: total ? Math.round((completed || 0) / total * 100) : 0,
                        status_breakdown: statusCounts,
                    },
                };
            })
        );

        return NextResponse.json({
            batches: batchStats,
        });

    } catch (error: any) {
        console.error('Manager batches error:', error);
        return NextResponse.json(
            { message: error.message || 'Failed to fetch batches' },
            { status: 500 }
        );
    }
}
