import { redirect } from 'next/navigation';

type LegacyDashboardProps = {
    searchParams?: Promise<{
        leadId?: string | string[];
    }>;
};

export default async function LegacyAgentDashboardPage({ searchParams }: LegacyDashboardProps) {
    const params = searchParams ? await searchParams : {};
    const leadId = Array.isArray(params.leadId) ? params.leadId[0] : params.leadId;

    redirect(leadId ? `/agent?leadId=${encodeURIComponent(leadId)}` : '/agent');
}
