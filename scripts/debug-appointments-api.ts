
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// --- ENV LOADING ---
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
if (!supabaseUrl || !supabaseKey) { process.exit(1); }
const supabase = createClient(supabaseUrl, supabaseKey);

// --- MAIN LOGIC COPY FROM route.ts ---
async function run() {
    console.log('Running simulated API logic...');

    // Build query
    let query = supabase
        .from('leads')
        .select(`
            id,
            business_name,
            phone_number,
            potential_level,
            appointment_date,
            appointment_notes,
            assigned_to,
            processed_at,
            profiles!leads_assigned_to_fkey(
                id,
                full_name,
                avatar_url,
                theme_color
            )
        `)
        .or('appointment_date.not.is.null,status.eq.appointment')
        .order('appointment_date', { ascending: true });

    // Assuming NO agent filter for now (fetch all)
    // if (agentFilter...)

    const { data: leads, error } = await query;

    if (error) {
        console.error('Query Error:', error);
        return;
    }

    console.log(`Query returned ${leads?.length} leads.`);

    // Fetch notes for these leads
    const leadIds = leads?.map(l => l.id) || [];
    const { data: notes } = await supabase
        .from('lead_notes')
        .select('lead_id, note, created_at')
        .in('lead_id', leadIds)
        .order('created_at', { ascending: false });

    console.log(`Fetched ${notes?.length} notes.`);

    // Find our specific lead to debug
    // Efe's lead: Alp Hotel Cappadocia (7fc127d8-d175-49...)
    const targetId = '7fc127d8-d175-4929-875f-2565691ee0a9' // guessed from previous log output clip;
    // Actually, let's filter by name "Alp Hotel"
    const targetLead = leads?.find(l => l.business_name.includes('Alp Hotel'));

    if (targetLead) {
        console.log('--- TARGET LEAD FOUND ---');
        console.log('ID:', targetLead.id);
        console.log('Business:', targetLead.business_name);
        console.log('DB Date:', targetLead.appointment_date);

        const leadNote = notes?.find(n => n.lead_id === targetLead.id);
        console.log('Note Found:', leadNote ? 'YES' : 'NO');
        if (leadNote) console.log('Note Text:', leadNote.note);

        const noteText = leadNote?.note || targetLead.appointment_notes || '';

        // Helper to parse Turkish date from note
        const parseTurkishDate = (text: string) => {
            try {
                const match = text.match(/📅 Randevu: (.*)/);
                if (!match) return null;

                const dateStr = match[1].trim();
                const parts = dateStr.split(' ');
                if (parts.length < 5) return null;

                const day = parseInt(parts[0]);
                const monthName = parts[1].toLowerCase();
                const year = parseInt(parts[2]);
                const time = parts[4];
                const [hour, minute] = time.split(':').map(Number);

                const months: Record<string, number> = {
                    'ocak': 0, 'şubat': 1, 'mart': 2, 'nisan': 3, 'mayıs': 4, 'haziran': 5,
                    'temmuz': 6, 'ağustos': 7, 'eylül': 8, 'ekim': 9, 'kasım': 10, 'aralık': 11
                };

                const month = months[monthName];
                if (month === undefined) return null;

                const date = new Date(year, month, day, hour, minute);
                return date.toISOString();
            } catch (e) {
                return null;
            }
        };

        const parsedDate = parseTurkishDate(noteText);
        console.log('Parsed Date:', parsedDate);

        const finalDate = targetLead.appointment_date || parsedDate || targetLead.processed_at;
        console.log('Final Effective Date:', finalDate);

    } else {
        console.log('Target Lead (Alp Hotel) NOT FOUND in initial query results.');
    }
}

run();
