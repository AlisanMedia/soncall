
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { createClient as createCookieClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
    try {
        const cookieSupabase = await createCookieClient();

        // 1. Verify Authentication (using cookie client)
        const { data: { user }, error: authError } = await cookieSupabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { lead_id, action, metadata } = body;

        if (!lead_id || !action) {
            return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
        }

        // 2. Use Admin Client for Insert (Bypass RLS)
        const adminClient = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                }
            }
        );

        const { error: insertError } = await adminClient
            .from('lead_activity_log')
            .insert({
                agent_id: user.id, // Ensure we use the authenticated user's ID
                lead_id,
                action,
                metadata: metadata || {}
            });

        if (insertError) {
            console.error('Activity Insert Error:', insertError);
            return NextResponse.json({ message: 'Failed to log activity', error: insertError }, { status: 500 });
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('Activity API Error:', error);
        return NextResponse.json({ message: 'Internal Server Error', error: error.message }, { status: 500 });
    }
}
