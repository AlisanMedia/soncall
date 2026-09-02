import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { canAccessMarket } from '@/lib/market-access';

const ROLE_RANK = {
    agent: 1,
    manager: 2,
    admin: 3,
    founder: 4,
} as const;

type ManagedRole = keyof typeof ROLE_RANK;

function isManagedRole(role: string): role is ManagedRole {
    return role in ROLE_RANK;
}

export async function DELETE(req: Request) {
    try {
        const supabase = await createClient();

        // 1. Check permissions
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { data: profile } = await supabase
            .from('profiles')
            .select('id, role, market_id')
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

        const { data: targetProfile, error: targetError } = await adminSupabase
            .from('profiles')
            .select('role, market_id')
            .eq('id', userId)
            .maybeSingle();

        if (targetError) throw targetError;
        if (!targetProfile || !isManagedRole(targetProfile.role || '')) {
            return NextResponse.json({ error: 'Target user not found' }, { status: 404 });
        }

        const requesterRole = profile?.role as ManagedRole;
        const targetRole = targetProfile.role as ManagedRole;

        if (
            (requesterRole === 'manager' && targetRole !== 'agent') ||
            ROLE_RANK[targetRole] >= ROLE_RANK[requesterRole] ||
            !canAccessMarket(profile, targetProfile.market_id)
        ) {
            return NextResponse.json({ error: 'Forbidden: Cannot delete users with that role' }, { status: 403 });
        }

        const { error: deleteError } = await adminSupabase.auth.admin.deleteUser(userId);

        if (deleteError) throw deleteError;

        return NextResponse.json({ success: true });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Team member deletion failed';
        console.error('Error deleting team member:', error);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
