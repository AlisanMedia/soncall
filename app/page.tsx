import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Get user profile to determine role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  // Redirect based on role
  if (['admin', 'founder'].includes(profile?.role || '')) {
    redirect('/select-dashboard'); // Selection screen for admin/founder
  } else if (profile?.role === 'manager') {
    redirect('/manager');
  } else {
    redirect('/agent');
  }
}
