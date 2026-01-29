import { createClient } from '@supabase/supabase-js'; // Use admin client
import { createClient as createServerClient } from '@/lib/supabase/server'; // Use auth client
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        // 1. Verify Requestor is Manager/Admin
        const supabase = await createServerClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (!['manager', 'admin', 'founder'].includes(profile?.role || '')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // 2. Fetch All Agents/Admins/Founders using Service Role (Bypass RLS)
        // This ensures we see EVERYONE regardless of restrictive policies
        const adminAuthClient = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const { data: team, error } = await adminAuthClient
            .from('profiles')
            .select('id, full_name, role, email, avatar_url')
            .in('role', ['agent', 'admin', 'founder'])
            .order('full_name');

        if (error) throw error;

        return NextResponse.json({ agents: team });

    } catch (error: any) {
        console.error('Error fetching team:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
