
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function checkCategories() {
    console.log('Checking categories in leads table...');

    // 1. Count total leads
    const { count, error: countError } = await supabase.from('leads').select('*', { count: 'exact', head: true });
    if (countError) console.error('Count error:', countError);
    console.log('Total leads:', count);

    // 2. Fetch sample of categories
    const { data, error } = await supabase
        .from('leads')
        .select('category')
        .order('created_at', { ascending: false })
        .limit(100);

    if (error) {
        console.error('Error fetching categories:', error);
        return;
    }

    console.log('Last 100 leads categories sample:', data.map(d => d.category));

    // 3. Check distinct stats (manual aggregate since no easy group by in JS client)
    const { data: allData, error: allError } = await supabase
        .from('leads')
        .select('category')
        .limit(5000);

    if (allError) {
        console.error('Error fetching all data:', allError);
        return;
    }

    const distribution: Record<string, number> = {};
    allData.forEach(l => {
        const cat = l.category === null ? 'NULL' : (l.category === '' ? 'EMPTY_STRING' : l.category);
        distribution[cat] = (distribution[cat] || 0) + 1;
    });

    console.log('Category Distribution (Last 5000):', distribution);
}

checkCategories();
