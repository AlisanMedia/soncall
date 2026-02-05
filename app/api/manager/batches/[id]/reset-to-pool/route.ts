import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
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
            return NextResponse.json({ message: 'Forbidden - Manager only' }, { status: 403 });
        }

        const { id: batchId } = await context.params;
        const body = await request.json();
        const { lead_ids = [], reset_potential = false } = body;

        // Verify batch exists
        const { data: batch, error: batchError } = await supabase
            .from('upload_batches')
            .select('id, filename')
            .eq('id', batchId)
            .single();

        if (batchError || !batch) {
            return NextResponse.json({ message: 'Batch not found' }, { status: 404 });
        }

        // Build update query
        let updateQuery = supabase
            .from('leads')
            .update({
                status: 'pending',
                assigned_to: null,
                locked_until: null,
                updated_at: new Date().toISOString(),
                ...(reset_potential ? { potential_level: 'unknown' } : {})
            })
            .eq('batch_id', batchId);

        // If specific lead IDs provided, filter by them
        if (lead_ids.length > 0) {
            updateQuery = updateQuery.in('id', lead_ids);
        }

        // Execute update
        const { data: updatedLeads, error: updateError } = await updateQuery.select('id');

        if (updateError) {
            console.error('Reset to pool error:', updateError);
            throw updateError;
        }

        const resetCount = updatedLeads?.length || 0;

        // Log activity
        if (resetCount > 0) {
            await supabase
                .from('lead_activity_log')
                .insert(
                    updatedLeads.map(lead => ({
                        action: 'reset_to_pool',
                        agent_id: user.id,
                        lead_id: lead.id,
                        metadata: {
                            batch_id: batchId,
                            reset_potential,
                            by_manager: true
                        }
                    }))
                );
        }

        return NextResponse.json({
            success: true,
            reset_count: resetCount,
            message: `${resetCount} lead başarıyla havuza aktarıldı`
        });

    } catch (error: any) {
        console.error('Reset to pool error:', error);
        return NextResponse.json(
            { success: false, message: error.message || 'Reset failed' },
            { status: 500 }
        );
    }
}
