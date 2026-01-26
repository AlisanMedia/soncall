
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing Supabase URL or Service Role Key in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const TARGET_EMAIL = 'agent4@artificagent.com';
const TARGET_PASSWORD = 'Password123!'; // Default password to set

async function fixAgentLogin() {
    console.log(`Checking status for ${TARGET_EMAIL}...`);

    // 1. Check if user exists in Auth
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();

    if (listError) {
        console.error('Error listing users:', listError);
        return;
    }

    const existingUser = users.find(u => u.email === TARGET_EMAIL);
    let userId = existingUser?.id;

    if (existingUser) {
        console.log('User found in Auth. Updating password...');
        const { error: updateError } = await supabase.auth.admin.updateUserById(existingUser.id, {
            password: TARGET_PASSWORD,
            user_metadata: { email_verified: true }
        });

        if (updateError) {
            console.error('Failed to update password:', updateError);
            return;
        }
        console.log('Password updated successfully.');
    } else {
        console.log('User NOT found in Auth. Creating new user...');
        const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
            email: TARGET_EMAIL,
            password: TARGET_PASSWORD,
            email_confirm: true,
            user_metadata: { full_name: 'Agent 4', role: 'agent' }
        });

        if (createError) {
            console.error('Failed to create user:', createError);
            return;
        }
        userId = newUser.user.id;
        console.log('User created successfully.');
    }

    if (!userId) {
        console.error('Could not determine User ID.');
        return;
    }

    // 2. Ensure Profile exists and is linked
    console.log('Checking Profile in public schema...');

    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

    if (profileError && profileError.code !== 'PGRST116') { // PGRST116 is 'Row not found'
        console.error('Error fetching profile:', profileError);
    }

    if (!profile) {
        console.log('Profile does not exist. Creating profile...');
        const { error: upsertError } = await supabase
            .from('profiles')
            .upsert({
                id: userId,
                email: TARGET_EMAIL,
                full_name: 'Agent 4',
                role: 'agent', // Explicitly set role
                updated_at: new Date().toISOString()
            });

        if (upsertError) {
            console.error('Failed to create profile:', upsertError);
        } else {
            console.log('Profile created successfully.');
        }
    } else {
        console.log('Profile exists. Verifying role...');
        if (profile.role !== 'agent') {
            console.log(`Role is '${profile.role}', correcting to 'agent'...`);
            const { error: roleError } = await supabase
                .from('profiles')
                .update({ role: 'agent' })
                .eq('id', userId);

            if (roleError) console.error('Failed to update role:', roleError);
            else console.log('Role updated to agent.');
        } else {
            console.log('Role is correct.');
        }
    }

    console.log('\n--- OPERATION COMPLETE ---');
    console.log(`Email: ${TARGET_EMAIL}`);
    console.log(`Password: ${TARGET_PASSWORD}`);
    console.log('You can now log in.');
}

fixAgentLogin();
