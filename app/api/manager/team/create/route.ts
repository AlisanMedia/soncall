import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';

const ROLE_RANK = {
    agent: 1,
    manager: 2,
    admin: 3,
    founder: 4,
} as const;

type ManagedRole = keyof typeof ROLE_RANK;
type SalesRole = 'sdr' | 'closer';

function isManagedRole(role: string): role is ManagedRole {
    return role in ROLE_RANK;
}

function isSalesRole(role: string): role is SalesRole {
    return role === 'sdr' || role === 'closer';
}

export async function POST(req: Request) {
    try {
        const supabase = await createClient(); // Helper for current user context

        // 1. Check if current user is manager
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { data: profile } = await supabase
            .from('profiles')
            .select('role, market_id')
            .eq('id', user.id)
            .single();

        if (!['manager', 'admin', 'founder'].includes(profile?.role)) {
            return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
        }

        const body = await req.json();
        const { email, password, fullName, tcNumber, birthDate, city, district, phoneNumber, role, salesRole, commissionRate, marketId } = body;
        const requestedRole = role || 'agent';
        const requestedSalesRole = salesRole || 'sdr';
        const targetMarketId = profile?.role === 'founder' || profile?.role === 'admin'
            ? (marketId || profile?.market_id)
            : profile?.market_id;

        if (!isManagedRole(requestedRole)) {
            return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
        }

        if (!isSalesRole(requestedSalesRole)) {
            return NextResponse.json({ error: 'Invalid sales role' }, { status: 400 });
        }

        const requesterRole = profile?.role as ManagedRole;

        if (
            (requesterRole === 'manager' && requestedRole !== 'agent') ||
            ROLE_RANK[requestedRole] > ROLE_RANK[requesterRole]
        ) {
            return NextResponse.json({ error: 'Forbidden: Cannot create users with that role' }, { status: 403 });
        }

        // 2. Create user in Supabase Auth
        // Note: To create a NEW user programmatically, we usually need the SERVICE_ROLE_KEY
        // because standard client only allows signing up YOURSELF.
        // We will fallback to using the service client strictly for this operation.

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
        const adminSupabase = createSupabaseAdminClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        let userId = '';

        const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true, // Auto confirm
            user_metadata: {
                full_name: fullName,
                role: requestedRole
            }
        });

        if (authError) {
            // Check if user already exists
            if (authError.message.includes('already has been registered') || authError.status === 422) {
                console.log('User already exists, attempting to find and link profile...');
                // listUsers to find the ID
                // Note: listUsers returns { data: { users: [] } } in v2
                const { data: userList, error: listError } = await adminSupabase.auth.admin.listUsers();

                if (listError) throw listError;

                // Filter manually or use search query if available in listUsers params (v2 has no direct email filter usually easily accessible without paging, but for small teams it's fine)
                // Actually listUsers usually allows pagination. We will just list and find.
                // Or better: try getUserById? No we don't have ID.
                // We have to iterate or trust we can find it. 
                // A better way is usually to just let the admin know, but we want to fix it.

                const existingUser = userList.users.find((u) => u.email === email);
                if (existingUser) {
                    userId = existingUser.id;
                    // Optional: Update user metadata if needed
                    await adminSupabase.auth.admin.updateUserById(userId, {
                        user_metadata: { full_name: fullName, role: requestedRole }
                    });
                } else {
                    throw new Error('User exists but could not be found in list.');
                }
            } else {
                throw authError; // Real error
            }
        } else {
            userId = authData.user.id;
        }

        if (!userId) throw new Error('User creation failed or User ID not found');

        // 3. Update or Create the profile with extra details
        // We use upsert to be safe, in case the trigger didn't run or verify timing issues.
        const { error: upsertError } = await adminSupabase
            .from('profiles')
            .upsert({
                id: userId,
                email: email,
                full_name: fullName,
                role: requestedRole,
                tc_number: tcNumber,
                birth_date: birthDate,
                city,
                district,
                phone_number: phoneNumber,
                commission_rate: commissionRate,
                sales_role: requestedRole === 'agent' ? requestedSalesRole : 'sdr',
                market_id: targetMarketId
            });

        if (upsertError) throw upsertError;

        return NextResponse.json({ success: true, userId });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Team member creation failed';
        console.error('Error creating team member:', error);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
