import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import type { Lead } from '@/types';
import { normalizePhone, generatePhoneVariants } from '@/lib/utils';

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

        if (!['manager', 'admin', 'founder'].includes(profile?.role || '')) {
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
        // 1. Normalize phone numbers
        const cleanLeads = leads.map(l => ({
            ...l,
            phone_number: normalizePhone(l.phone_number || '')
        })).filter(l => l.phone_number && l.phone_number.length > 5);

        if (cleanLeads.length === 0) {
            return NextResponse.json({ message: 'No valid leads found after cleanup' }, { status: 400 });
        }

        // 2. Collect all phone variants to check against DB
        const allVariants = new Set<string>();

        // Map variants back to the original lead index to know which one to skip? 
        // Or simpler: just build a big list of ALL variants relevant to this batch, 
        // check DB, get back "existing phones", then filter the batch.

        cleanLeads.forEach(lead => {
            const variants = generatePhoneVariants(lead.phone_number);
            variants.forEach(v => allVariants.add(v));
        });

        // 3. Query DB for ANY of these variants
        // Supabase `in` filter has limits (usually around 65k parameters, but safer to chunk if huge)
        // For a typical upload (< 1000 rows) it's fine. If 10k+, we chunk.
        // Let's assume < 1000 for now or chunks of 1000.

        const existingPhonesInDb = new Set<string>();
        const variantsArray = Array.from(allVariants);
        const chunkSize = 1000;

        for (let i = 0; i < variantsArray.length; i += chunkSize) {
            const chunk = variantsArray.slice(i, i + chunkSize);
            const { data: found } = await supabase
                .from('leads')
                .select('phone_number')
                .in('phone_number', chunk);

            found?.forEach(f => existingPhonesInDb.add(f.phone_number));
        }

        // 4. Check if a lead is new. 
        // A lead is new if NONE of its phone variants are in `existingPhonesInDb`.
        const leadsToInsert = [];
        let skippedCount = 0;

        for (const lead of cleanLeads) {
            const variants = generatePhoneVariants(lead.phone_number);
            const isDuplicate = variants.some(v => existingPhonesInDb.has(v));

            if (isDuplicate) {
                skippedCount++;
            } else {
                // Not a duplicate - add to insert list
                // ALSO add to "existing" logic for this batch to prevent internal duplicates within the same file!
                const { id, ...leadWithoutId } = lead;
                leadsToInsert.push({
                    ...leadWithoutId,
                    batch_id: batch.id,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                });

                // Add this lead's variants to "known" set so subsequent rows with same number are also caught
                variants.forEach(v => existingPhonesInDb.add(v));
            }
        }

        if (leadsToInsert.length === 0) {
            return NextResponse.json({
                success: true,
                batchId: batch.id,
                totalLeads: leads.length,
                importedCount: 0,
                skippedCount: leads.length,
                message: `All ${leads.length} leads were duplicates and skipped.`,
            });
        }

        // Insert leads in database
        const { error: leadsError } = await supabase
            .from('leads')
            .insert(leadsToInsert);

        if (leadsError) throw leadsError;

        return NextResponse.json({
            success: true,
            batchId: batch.id,
            totalLeads: leads.length,
            importedCount: leadsToInsert.length,
            skippedCount: skippedCount,
            message: `${leadsToInsert.length} leads imported, ${skippedCount} duplicates skipped.`,
        });

    } catch (error: any) {
        console.error('Upload error:', error);
        return NextResponse.json(
            { success: false, message: error.message || 'Upload failed' },
            { status: 500 }
        );
    }
}
