import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        // 1. Check Manager Authorization
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // Must allow admin actions
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

        const body = await req.json();
        const { agentId, newEmail } = body;

        if (!agentId || !newEmail) {
            return NextResponse.json({ error: 'Missing agentId or newEmail' }, { status: 400 });
        }

        // 2. Update Auth User (Bypass old email verification)
        const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
            agentId,
            { email: newEmail, email_confirm: true }
        );

        if (authError) {
            console.error('Auth update error:', authError);
            return NextResponse.json({ error: authError.message }, { status: 500 });
        }

        // 3. Update Profiles Table & Clear Pending
        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .update({
                email: newEmail,
                pending_email: null
            })
            .eq('id', agentId);

        if (profileError) {
            console.error('Profile update error:', profileError);
            return NextResponse.json({ error: profileError.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: 'Email updated successfully' });

    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
