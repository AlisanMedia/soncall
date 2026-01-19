import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import AgentDashboard from '@/components/agent/AgentDashboard';

export default async function AgentPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect('/login');
    }

    // Get user profile
    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    if (!profile) {
        redirect('/login');
    }

    // Agents can access, managers will be redirected
    if (profile.role === 'manager') {
        redirect('/manager');
    }

    return <AgentDashboard profile={profile} />;
}
