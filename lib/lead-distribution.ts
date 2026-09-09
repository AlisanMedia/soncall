export const REDISTRIBUTABLE_STATUSES = ['pending', 'contacted', 'callback', 'not_interested'];

export function equalLeadAllocation(leadIds: string[], agentIds: string[]) {
    const leads = [...new Set(leadIds)].sort();
    const agents = [...new Set(agentIds)].sort();
    if (!agents.length) throw new Error('At least one agent is required');
    return agents.map((agentId, index) => ({ agentId, leadIds: leads.filter((_, i) => i % agents.length === index) }));
}

export const isUuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
