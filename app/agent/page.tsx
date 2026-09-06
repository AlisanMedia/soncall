import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import AgentDashboard from '@/components/agent/AgentDashboard';
import styles from './page.module.css';

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

    // Only regular managers get redirected - admin/founder can access both dashboards
    if (profile.role === 'manager') {
        redirect('/manager');
    }

    return (
        <div className={styles.shell} data-dashboard-shell="agent">
            <AgentDashboard profile={profile} />
        </div>
    );
}
