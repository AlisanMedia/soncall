
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function seedLeads() {
    console.log("Seeding sample leads with categories...");
    
    const sampleLeads = [
        {
            business_name: "Yıldız Turizm",
            phone_number: "905551112233",
            category: "Turizm",
            status: "pending",
            potential_level: "high",
            ai_summary: "ArtificAgent AI Voice Agent ile ilgileniyor. Tur operasyonlarını otomatize etmek istiyor."
        },
        {
            business_name: "Güneş E-Ticaret",
            phone_number: "905554445566",
            category: "E-ticaret",
            status: "contacted",
            potential_level: "medium",
            ai_summary: "Müşteri desteği için AI Receptionist düşünüyor."
        },
        {
            business_name: "Doğa Sağlık Merkezi",
            phone_number: "905557778899",
            category: "Sağlık",
            status: "appointment",
            potential_level: "high",
            ai_summary: "Randevu yönetimi için tam otomasyon arıyor."
        }
    ];

    const { data, error } = await supabase
        .from('leads')
        .insert(sampleLeads)
        .select();

    if (error) {
        console.error("Error seeding leads:", error);
    } else {
        console.log("Success! Seeded", data.length, "leads.");
    }
}

seedLeads();
