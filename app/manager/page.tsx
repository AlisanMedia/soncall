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

    if (profile?.role !== 'manager') {
        redirect('/agent');
    }

    return <ManagerDashboard profile={profile} />;
}
