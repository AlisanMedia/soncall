import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { resolveRequestedMarketId } from '@/lib/market-access';

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
            .select('id, role, market_id')
            .eq('id', user.id)
            .single();

        if (!['manager', 'admin', 'founder'].includes(profile?.role || '')) {
            return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
        }
        const effectiveMarketId = resolveRequestedMarketId(profile, request.nextUrl.searchParams.get('marketId'));

        // Get all batches with stats
        let batchesQuery = supabase
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
        if (effectiveMarketId) batchesQuery = batchesQuery.eq('market_id', effectiveMarketId);
        const { data: batches, error: batchesError } = await batchesQuery;

        if (batchesError) throw batchesError;

        // For each batch, get lead statistics
        const batchStats = await Promise.all(
            (batches || []).map(async (batch) => {
                // Total leads in batch
                let totalQuery = supabase
                    .from('leads')
                    .select('*', { count: 'exact', head: true })
                    .eq('batch_id', batch.id);
                if (effectiveMarketId) totalQuery = totalQuery.eq('market_id', effectiveMarketId);
                const { count: total } = await totalQuery;

                // Assigned leads
                let assignedQuery = supabase
                    .from('leads')
                    .select('*', { count: 'exact', head: true })
                    .eq('batch_id', batch.id)
                    .not('assigned_to', 'is', null);
                if (effectiveMarketId) assignedQuery = assignedQuery.eq('market_id', effectiveMarketId);
                const { count: assigned } = await assignedQuery;

                // Completed leads (all non-pending statuses)
                let completedQuery = supabase
                    .from('leads')
                    .select('*', { count: 'exact', head: true })
                    .eq('batch_id', batch.id)
                    .neq('status', 'pending');
                if (effectiveMarketId) completedQuery = completedQuery.eq('market_id', effectiveMarketId);
                const { count: completed } = await completedQuery;

                // Pending leads
                let pendingQuery = supabase
                    .from('leads')
                    .select('*', { count: 'exact', head: true })
                    .eq('batch_id', batch.id)
                    .eq('status', 'pending');
                if (effectiveMarketId) pendingQuery = pendingQuery.eq('market_id', effectiveMarketId);
                const { count: pending } = await pendingQuery;

                // Status breakdown
                let statusQuery = supabase
                    .from('leads')
                    .select('status')
                    .eq('batch_id', batch.id);
                if (effectiveMarketId) statusQuery = statusQuery.eq('market_id', effectiveMarketId);
                const { data: statusData } = await statusQuery;

                const statusCounts = {
                    pending: 0,
                    in_progress: 0,
                    contacted: 0,
                    appointment: 0,
                    not_interested: 0,
                    callback: 0,
                };

                statusData?.forEach((lead: { status: string }) => {
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

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to fetch batches';
        console.error('Manager batches error:', error);
        return NextResponse.json(
            { message },
            { status: 500 }
        );
    }
}
