import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export async function DELETE(req: Request) {
    try {
        const supabase = await createClient();

        // 1. Check permissions
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (!['manager', 'admin', 'founder'].includes(profile?.role)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { searchParams } = new URL(req.url);
        const userId = searchParams.get('id');

        if (!userId) {
            return NextResponse.json({ error: 'User ID required' }, { status: 400 });
        }

        // Prevent self-deletion
        if (userId === user.id) {
            return NextResponse.json({ error: 'Cannot delete yourself' }, { status: 400 });
        }

        // 2. Delete user using Service Role
        const adminSupabase = createSupabaseClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const { error: deleteError } = await adminSupabase.auth.admin.deleteUser(userId);

        if (deleteError) throw deleteError;

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('Error deleting team member:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
