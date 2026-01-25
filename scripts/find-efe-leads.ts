
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

function loadEnv() {
    try {
        const envPaths = ['.env.local', '.env'];
        for (const envFile of envPaths) {
            const envPath = path.resolve(process.cwd(), envFile);
            if (fs.existsSync(envPath)) {
                console.log(`Loading env from ${envFile}`);
                const envConfig = fs.readFileSync(envPath, 'utf-8');
                envConfig.split('\n').forEach(line => {
                    const [key, value] = line.split('=');
                    if (key && value) {
                        const trimmedKey = key.trim();
                        const trimmedValue = value.trim().replace(/^["'](.*)["']$/, '$1');
                        process.env[trimmedKey] = trimmedValue;
                    }
                });
                return;
            }
        }
    } catch (e) {
        console.error('Error loading env', e);
    }
}

loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkEfeLeads() {
    console.log('Finding Efe...');

    // 1. Find Efe
    const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .ilike('full_name', '%Efe%');

    if (profileError) {
        console.error('Profile Error:', profileError);
        return;
    }

    if (!profiles || profiles.length === 0) {
        console.log('No profile found with name Efe');
        return;
    }

    const efe = profiles[0];
    console.log(`Found Efe: ${efe.full_name} (${efe.id}) - Role: ${efe.role}`);

    // 2. Find his appointments
    const { data: leads, error: leadError } = await supabase
        .from('leads')
        .select(`
            id, 
            business_name, 
            status, 
            appointment_date, 
            processed_at
        `)
        .eq('assigned_to', efe.id)
        .eq('status', 'appointment');

    if (leadError) {
        console.error('Lead Error:', leadError);
        return;
    }

    console.log(`Found ${leads?.length} appointments for Efe.`);

    if (leads && leads.length > 0) {
        // 3. Fetch notes for these leads
        const leadIds = leads.map(l => l.id);
        const { data: notes, error: notesError } = await supabase
            .from('lead_notes')
            .select('*')
            .in('lead_id', leadIds)
            .order('created_at', { ascending: false });

        leads.forEach(lead => {
            console.log(`\nLead: ${lead.business_name} (${lead.id})`);
            console.log(`Appointment Date (DB): ${lead.appointment_date}`);
            console.log(`Processed At: ${lead.processed_at}`);

            const relatedNotes = notes?.filter(n => n.lead_id === lead.id);
            if (relatedNotes && relatedNotes.length > 0) {
                console.log(`Found ${relatedNotes.length} notes:`);
                relatedNotes.forEach((n, i) => {
                    console.log(`  [${i}] ${n.created_at}: "${n.note.substring(0, 50)}..."`);
                    if (n.note.includes('Randevu')) {
                        console.log(`      FULL: ${n.note}`);
                    }
                });
            } else {
                console.log('Lead Notes: NONE');
            }
        });
    }
}

checkEfeLeads();
