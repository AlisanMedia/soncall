import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// Helper to escape CSV fields
const escapeCsv = (field: any) => {
    if (field === null || field === undefined) return '';
    const stringField = String(field);
    if (stringField.includes(';') || stringField.includes('\n') || stringField.includes('"')) {
        return `"${stringField.replace(/"/g, '""')}"`;
    }
    return stringField;
};

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const supabase = await createClient();
        const { id } = await params;
        const { searchParams } = new URL(request.url);
        const statusFilter = searchParams.get('status'); // Optional filter for export

        // Auth Check
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
        if (!['manager', 'admin', 'founder'].includes(profile?.role || '')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Build Query - Fetch ALL for export (no pagination)
        let query = supabase
            .from('leads')
            .select(`
                business_name,
                phone_number,
                status,
                potential_level,
                appointment_date,
                created_at,
                updated_at,
                profiles_assigned:profiles!leads_assigned_to_fkey (
                    full_name
                ),
                city,
                district,
                call_count
            `)
            .eq('batch_id', id);

        if (statusFilter && statusFilter !== 'all') {
            query = query.eq('status', statusFilter);
        }

        const { data: leads, error } = await query.order('updated_at', { ascending: false });

        if (error) throw error;

        // Fetch Batch Info for Filename
        const { data: batch } = await supabase
            .from('upload_batches')
            .select('filename')
            .eq('id', id)
            .single();

        const originalName = batch?.filename?.split('.')[0] || 'batch-export';
        const timestamp = new Date().toISOString().split('T')[0];
        const filename = `${originalName}_Export_${timestamp}.csv`;

        // Generate CSV Content
        // 1. Headers (Turkish)
        const headers = [
            'İşletme Adı',
            'Telefon',
            'Durum',
            'Potansiyel',
            'Temsilci',
            'Şehir',
            'İlçe',
            'Arama Sayısı',
            'Randevu Tarihi',
            'Son İşlem'
        ];

        // 2. Rows
        const rows = leads?.map(lead => {
            // Handle profiles_assigned (Supabase can return array for relations)
            const assignedProfile = Array.isArray(lead.profiles_assigned)
                ? lead.profiles_assigned[0]
                : lead.profiles_assigned;

            return [
                lead.business_name,
                lead.phone_number,
                lead.status,
                lead.potential_level,
                assignedProfile?.full_name || 'Atanmamış',
                lead.city,
                lead.district,
                lead.call_count,
                lead.appointment_date ? new Date(lead.appointment_date).toLocaleString('tr-TR') : '',
                new Date(lead.updated_at).toLocaleString('tr-TR')
            ];
        });

        // 3. Combine with BOM for Excel UTF-8 support
        // \uFEFF is the Byte Order Mark
        const csvContent = '\uFEFF' +
            headers.join(';') + '\n' +
            rows?.map(row => row.map(escapeCsv).join(';')).join('\n');

        // Return Response
        return new NextResponse(csvContent, {
            status: 200,
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="${filename}"`
            }
        });

    } catch (error: any) {
        console.error('Batch Export API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
