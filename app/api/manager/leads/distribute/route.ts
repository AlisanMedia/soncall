import { NextResponse } from 'next/server';
import { requireManagerAccess } from '@/lib/api/auth';
import { resolveRequestedMarketId } from '@/lib/market-access';
import { equalLeadAllocation, isUuid, REDISTRIBUTABLE_STATUSES } from '@/lib/lead-distribution';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: Request) {
    const assignmentDetails: {agentId: string; assignedCount: number}[] = [];
    const updatedIds: string[] = [];
    try {
        const auth = await requireManagerAccess();
        if (!auth.ok) return auth.response;
        const body = await request.json();
        const { leadIds, agentIds } = body;
        if (!Array.isArray(leadIds) || !leadIds.length || leadIds.length > 1000 || !leadIds.every(isUuid)
            || !Array.isArray(agentIds) || !agentIds.length || agentIds.length > 100 || !agentIds.every(isUuid)
            || new Set(leadIds).size !== leadIds.length || new Set(agentIds).size !== agentIds.length) {
            return NextResponse.json({message: 'Geçerli, benzersiz lead ve agent seçimleri gerekli (en fazla 1000 lead).'}, {status: 400});
        }
        const marketId = resolveRequestedMarketId(auth.profile, body.marketId);
        if (!marketId) return NextResponse.json({message: 'Operasyon seçimi gerekli.'}, {status: 403});
        const supabase = createAdminClient();
        const {data: agents, error: agentError} = await supabase.from('profiles').select('id').eq('market_id', marketId)
            .eq('role', 'agent').eq('sales_role', 'sdr').in('id', agentIds);
        if (agentError) throw agentError;
        if (agents?.length !== agentIds.length) return NextResponse.json({message: 'Hedefler aynı operasyondaki SDR personelleri olmalı.'}, {status: 403});
        const leads: {id: string; assigned_to: string | null; status: string; current_agent_id: string | null; appointment_date: string | null; closer_id: string | null}[] = [];
        for (let offset = 0; offset < leadIds.length; offset += 200) {
            const {data, error} = await supabase.from('leads').select('id,assigned_to,status,current_agent_id,appointment_date,closer_id')
                .eq('market_id', marketId).in('id', leadIds.slice(offset, offset + 200));
            if (error) throw error;
            leads.push(...(data || []));
        }
        if (leads.length !== leadIds.length) return NextResponse.json({message: 'Seçilen leadlerden bazıları bulunamadı veya bu operasyona ait değil.'}, {status: 403});
        if (leads.some(l => l.current_agent_id || l.appointment_date || l.closer_id || !REDISTRIBUTABLE_STATUSES.includes(l.status))) {
            return NextResponse.json({message: 'Aktif aramalar, randevu ve satış sürecindeki leadler yeniden dağıtılamaz. Seçimi yenileyin.'}, {status: 409});
        }
        const byId = new Map(leads.map(l => [l.id, l]));
        for (const allocation of equalLeadAllocation(leadIds, agentIds)) {
            const detail = {agentId: allocation.agentId, assignedCount: 0};
            assignmentDetails.push(detail);
            for (const id of allocation.leadIds) {
                const before = byId.get(id)!;
                let query = supabase.from('leads').update({assigned_to: allocation.agentId, sdr_id: allocation.agentId, status: 'pending', callback_at: null, callback_reason: null})
                    .eq('id', id).eq('market_id', marketId).eq('status', before.status)
                    .is('current_agent_id', null).is('appointment_date', null).is('closer_id', null);
                query = before.assigned_to ? query.eq('assigned_to', before.assigned_to) : query.is('assigned_to', null);
                const {data, error} = await query.select('id');
                if (error || data?.length !== 1) return NextResponse.json({success: false, assignedCount: updatedIds.length, updatedIds, assignmentDetails,
                    message: 'Dağıtım kesildi; yalnızca belirtilen kayıtlar değişti. Listeyi yenileyip kalanları seçin.'}, {status: error ? 500 : 409});
                detail.assignedCount++;
                updatedIds.push(id);
                const {error: logError} = await supabase.from('lead_activity_log').insert({lead_id: id, agent_id: auth.user.id, action: 'assigned',
                    metadata: {assigned_agent_id: allocation.agentId, previous_agent_id: before.assigned_to, previous_status: before.status, redistribution: true}});
                if (logError) console.error('Redistribution activity log failed', logError);
            }
        }
        return NextResponse.json({success: true, assignedCount: updatedIds.length, updatedIds, assignmentDetails, message: `${updatedIds.length} lead eşit dağıtıldı.`});
    } catch (error) {
        console.error('Selected distribution failed', error);
        return NextResponse.json({success: false, assignedCount: updatedIds.length, updatedIds, assignmentDetails, message: 'Dağıtım tamamlanamadı. Listeyi yenileyin.'}, {status: 500});
    }
}
