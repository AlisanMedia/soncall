import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import type { Lead } from '@/types';

export async function POST(request: NextRequest) {
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
            return NextResponse.json({ message: 'Forbidden - Manager only' }, { status: 403 });
        }

        // Parse form data
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const leadsDataString = formData.get('leadsData') as string;

        if (!file || !leadsDataString) {
            return NextResponse.json({ message: 'Missing file or leads data' }, { status: 400 });
        }

        const leads: Lead[] = JSON.parse(leadsDataString);

        if (leads.length === 0) {
            return NextResponse.json({ message: 'No leads to upload' }, { status: 400 });
        }

        // Create upload batch
        const { data: batch, error: batchError } = await supabase
            .from('upload_batches')
            .insert({
                uploaded_by: user.id,
                filename: file.name,
                total_leads: leads.length,
            })
            .select()
            .single();

        if (batchError) throw batchError;

        // Prepare leads for insertion (remove id field, add batch_id)
        const leadsToInsert = leads.map(({ id, ...lead }) => ({
            ...lead,
            batch_id: batch.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        }));

        // Insert leads in database
        const { error: leadsError } = await supabase
            .from('leads')
            .insert(leadsToInsert);

        if (leadsError) throw leadsError;

        return NextResponse.json({
            success: true,
            batchId: batch.id,
            totalLeads: leads.length,
            message: `${leads.length} leads successfully uploaded`,
        });

    } catch (error: any) {
        console.error('Upload error:', error);
        return NextResponse.json(
            { success: false, message: error.message || 'Upload failed' },
            { status: 500 }
        );
    }
}
