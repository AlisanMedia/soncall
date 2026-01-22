import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
    try {
        const supabase = await createClient();

        // Auth check
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check if user is manager
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (profile?.role !== 'manager') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Get query params
        const { searchParams } = new URL(request.url);
        const agentFilter = searchParams.get('agent');
        const startDate = searchParams.get('startDate'); // YYYY-MM-DD
        const endDate = searchParams.get('endDate'); // YYYY-MM-DD

        // Base query builder
        const buildQuery = (table: 'leads' | 'sales') => {
            let query = supabase.from(table).select('*', { count: 'exact', head: true });

            if (agentFilter && agentFilter !== 'all') {
                query = query.eq(table === 'leads' ? 'assigned_to' : 'agent_id', agentFilter);
            }

            if (startDate) {
                query = query.gte('created_at', `${startDate}T00:00:00`);
            }
            if (endDate) {
                query = query.lte('created_at', `${endDate}T23:59:59`);
            }

            return query;
        };

        // 1. Total Leads
        const { count: totalLeads } = await buildQuery('leads');

        // 2. Contacted (Status != pending)
        let contactedQuery = buildQuery('leads');
        contactedQuery = contactedQuery.neq('status', 'pending');
        const { count: contacted } = await contactedQuery;

        // 3. Interested (Potential = high/medium OR status = appointment)
        // Note: Supabase JS library doesn't support complex OR with different columns easily in one query builder chain without .or()
        // We will fetch counts for specific conditions

        // Using raw count queries might be more efficient but for now separate count queries allow cleaner logic

        // Interested: potential_level in (high, medium)
        let interestedQuery = buildQuery('leads');
        interestedQuery = interestedQuery.in('potential_level', ['high', 'medium']);
        const { count: interestedHighMedium } = await interestedQuery;

        // Also include those with appointment status even if potential isn't set (though likely it is)
        // Just to be safe, "Interested" primarily means qualified leads.
        const interestedCount = interestedHighMedium || 0;

        // 4. Appointment (appointment_date IS NOT NULL OR status = 'appointment')
        let appointmentQuery = buildQuery('leads');
        appointmentQuery = appointmentQuery.not('appointment_date', 'is', null);
        const { count: appointments } = await appointmentQuery;

        // 5. Sales (Status = approved)
        let salesQuery = buildQuery('sales');
        salesQuery = salesQuery.eq('status', 'approved');
        const { count: sales } = await salesQuery;

        // Ensure logical consistency (e.g. can't have more sales than appointments theoretically, but data might be messy)
        // We present raw numbers.

        const funnelData = [
            {
                name: 'Toplam Lead',
                value: totalLeads || 0,
                fill: '#6366F1' // Indigo
            },
            {
                name: 'İlk Temas',
                value: contacted || 0,
                fill: '#8B5CF6' // Purple
            },
            {
                name: 'İlgilendi',
                value: interestedCount,
                fill: '#EC4899' // Pink
            },
            {
                name: 'Randevu',
                value: appointments || 0,
                fill: '#F43F5E' // Rose
            },
            {
                name: 'Satış',
                value: sales || 0,
                fill: '#10B981' // Green
            }
        ];

        // Calculate drop-off rates
        const stats = funnelData.map((stage, index) => {
            if (index === 0) return { ...stage, dropRate: 0, conversionRate: 100 };

            const prevValue = funnelData[index - 1].value;
            const dropRate = prevValue === 0 ? 0 : Math.round(((prevValue - stage.value) / prevValue) * 100);
            const conversionRate = totalLeads ? Math.round((stage.value / totalLeads) * 100) : 0;

            return {
                ...stage,
                dropRate,
                conversionRate
            };
        });

        return NextResponse.json({
            success: true,
            data: stats
        });

    } catch (error: any) {
        console.error('Funnel API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
