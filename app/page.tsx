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

  const specialEmails = ['alisangul123@gmail.com', 'efebusinessonlybusiness@gmail.com'];

  // Redirect based on role OR specific email
  // UPDATED: Privileged users go DIRECTLY to manager dashboard.
  // No intermediate selection screen.
  if (['admin', 'founder'].includes(profile?.role || '') || specialEmails.includes(user.email || '')) {
    redirect('/manager');
  } else if (profile?.role === 'manager') {
    redirect('/manager');
  } else {
    redirect('/agent');
  }
}
