import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const supabase = await createClient(); // Helper for current user context

        // 1. Check if current user is manager
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (!['manager', 'admin', 'founder'].includes(profile?.role)) {
            return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
        }

        const body = await req.json();
        const { email, password, fullName, tcNumber, birthDate, city, district, role, commissionRate } = body;

        // 2. Create user in Supabase Auth
        // Note: To create a NEW user programmatically, we usually need the SERVICE_ROLE_KEY
        // because standard client only allows signing up YOURSELF.
        // We will fallback to using the service client strictly for this operation.

        const serviceClient = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
        );

        // However, the standard createClient function in project might not support 2 args if custom. 
        // Let's assume standard supabase-js usage for service role if needed, OR just try signUp.
        // But signUp logs you in. 'admin.createUser' is better.

        // IMPORTANT: We need to import the actual createClient from supabase-js to use service key if standard utils don't expose it.
        // Or check if 'createClient' in lib/supabase/server handles it. Usually it uses cookies.
        // Let's assume we can use the `admin` api if we have the key.

        /* 
           If we cannot import strict service client easily here without potentially breaking, 
           we will try to use a direct fetch or standard signUp if acceptable (but that might change session).
           
           Best practice for "Invite User":
           const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true })
        */

        // Creating a specific admin client for this action
        const { createClient: createSupabaseClient } = require('@supabase/supabase-js');
        const adminSupabase = createSupabaseClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true, // Auto confirm
            user_metadata: {
                full_name: fullName,
                role: role || 'agent'
            }
        });

        if (authError) throw authError;

        if (!authData.user) throw new Error('User creation failed');

        // 3. Update the profile with extra details
        // The trigger 'handle_new_user' might have already created the basic profile.
        // We update it with the rest.
        const { error: updateError } = await adminSupabase
            .from('profiles')
            .update({
                tc_number: tcNumber,
                birth_date: birthDate,
                city,
                district,
                commission_rate: commissionRate,
                role: role
            })
            .eq('id', authData.user.id);

        if (updateError) throw updateError;

        return NextResponse.json({ success: true, userId: authData.user.id });

    } catch (error: any) {
        console.error('Error creating team member:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
