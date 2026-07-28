import { NextResponse } from 'next/server';
import { requireManagerAccess } from '@/lib/api/auth';

export async function GET() {
    try {
        const auth = await requireManagerAccess();
        if (!auth.ok) return auth.response;
        const supabase = auth.supabase;

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
