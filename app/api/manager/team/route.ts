import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const supabase = await createClient();

        // Check authorization
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get profiles with role='agent' or 'manager' (essentially all team members)
        const { data: team, error } = await supabase
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        return NextResponse.json({ team });
    } catch (error: any) {
        console.error('Error fetching team:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
