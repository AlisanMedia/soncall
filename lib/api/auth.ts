import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

const MANAGER_ROLES = ['manager', 'admin', 'founder'];

type ProfileRole = {
    id: string;
    role: string | null;
    full_name?: string | null;
    email?: string | null;
};

type ManagerAccess =
    | {
        ok: true;
        supabase: Awaited<ReturnType<typeof createClient>>;
        user: User;
        profile: ProfileRole;
    }
    | {
        ok: false;
        response: NextResponse;
    };

export async function requireManagerAccess(): Promise<ManagerAccess> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return {
            ok: false,
            response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
        };
    }

    const { data: profile, error } = await supabase
        .from('profiles')
        .select('id, role, full_name, email')
        .eq('id', user.id)
        .maybeSingle();

    if (error) {
        return {
            ok: false,
            response: NextResponse.json({ error: 'Failed to verify access' }, { status: 500 }),
        };
    }

    if (!profile || !MANAGER_ROLES.includes(profile.role || '')) {
        return {
            ok: false,
            response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
        };
    }

    return {
        ok: true,
        supabase,
        user,
        profile,
    };
}
