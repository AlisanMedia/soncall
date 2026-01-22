import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    const cookieStore = await cookies();

    try {
        const body = await request.json();
        const { action, confirm } = body;

        if (!confirm) {
            return NextResponse.json({ error: 'Confirmation required' }, { status: 400 });
        }

        // 1. Verify Authentication (User Context)
        const supabaseUser = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    getAll() {
                        return cookieStore.getAll();
                    },
                    setAll(cookiesToSet) {
                        try {
                            cookiesToSet.forEach(({ name, value, options }) =>
                                cookieStore.set(name, value, options)
                            );
                        } catch {
                            // Header mismatch, ignore
                        }
                    },
                },
            }
        );

        const { data: { user } } = await supabaseUser.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data: profile } = await supabaseUser
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (!profile || !['manager', 'admin', 'founder'].includes(profile.role || '')) {
            return NextResponse.json({ error: 'Forbidden: Managers only' }, { status: 403 });
        }

        // 2. Perform Action (System Context via Service Role)
        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        let result = { message: 'Action completed' };

        switch (action) {
            case 'reset_leads':
                const { error: resetError } = await supabaseAdmin
                    .from('leads')
                    .update({
                        status: 'pending',
                        assigned_to: null,
                        current_agent_id: null,
                        locked_at: null,
                        processed_at: null
                    })
                    .neq('id', '00000000-0000-0000-0000-000000000000'); // Valid non-empty filter

                if (resetError) throw resetError;
                result.message = 'Tüm leadler sıfırlandı ve havuza döndü.';
                break;

            case 'unlock_leads':
                const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
                const { error: unlockError } = await supabaseAdmin
                    .from('leads')
                    .update({
                        locked_at: null,
                        current_agent_id: null
                    })
                    .lt('locked_at', fourHoursAgo);

                if (unlockError) throw unlockError;
                result.message = 'Kilitli kalan leadler serbest bırakıldı.';
                break;

            case 'delete_leads':
                const { error: deleteError } = await supabaseAdmin
                    .from('leads')
                    .delete()
                    .neq('id', '00000000-0000-0000-0000-000000000000');

                if (deleteError) throw deleteError;
                result.message = 'Tüm lead veritabanı silindi.';
                break;

            case 'cleanup_logs':
                const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
                const { error: logError } = await supabaseAdmin
                    .from('call_logs')
                    .delete()
                    .lt('created_at', thirtyDaysAgo);

                if (logError) throw logError;
                result.message = 'Eski çağrı kayıtları temizlendi.';
                break;

            case 'reset_stats':
                const { error: statsError } = await supabaseAdmin
                    .from('goals')
                    .update({
                        current_sales: 0,
                        current_calls: 0,
                        is_achieved: false
                    })
                    .neq('id', '00000000-0000-0000-0000-000000000000');

                if (statsError) throw statsError;
                result.message = 'Aylık istatistikler sıfırlandı.';
                break;

            default:
                return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }

        return NextResponse.json(result);

    } catch (error: any) {
        console.error('Admin System Error:', error);
        return NextResponse.json({ error: 'Operation failed: ' + error.message }, { status: 500 });
    }
}
