
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    const supabase = await createClient();
    const { action, appointmentIds, payload } = await request.json();

    if (!appointmentIds || !Array.isArray(appointmentIds) || appointmentIds.length === 0) {
        return NextResponse.json({ success: false, error: 'No appointments selected' }, { status: 400 });
    }

    try {
        let result;

        switch (action) {
            case 'reassign':
                if (!payload?.agentId) {
                    return NextResponse.json({ success: false, error: 'Target agent ID required' }, { status: 400 });
                }
                const { error: reassignError } = await supabase
                    .from('leads')
                    .update({ agent_id: payload.agentId })
                    .in('id', appointmentIds);

                if (reassignError) throw reassignError;
                result = { message: `Reassigned ${appointmentIds.length} appointments` };
                break;

            case 'delete':
                const { error: deleteError } = await supabase
                    .from('leads')
                    .update({
                        appointment_date: null,
                        status: 'cancelled'
                    })
                    .in('id', appointmentIds);

                if (deleteError) throw deleteError;
                result = { message: `Cancelled ${appointmentIds.length} appointments` };
                break;

            // SMS functionality will be implemented later once provider is set up
            case 'sms':
                return NextResponse.json({ success: false, error: 'Bulk SMS not yet implemented' }, { status: 501 });

            default:
                return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
        }

        return NextResponse.json({ success: true, ...result });

    } catch (error) {
        console.error('Bulk action failed:', error);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
