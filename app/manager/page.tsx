import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import ManagerDashboard from '@/components/manager/ManagerDashboard';

export default async function ManagerPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect('/login');
    }

    // Get user profile to verify manager role
    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    // Access Control: Founder, Admin, and Manager can access
    if (!['founder', 'admin', 'manager'].includes(profile?.role)) {
        redirect('/agent');
    }

    return <ManagerDashboard profile={profile} />;
}
