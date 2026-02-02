
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function testSearch() {
    console.log('🧪 Testing Strict AI Search...');
    console.log('🔑 Checking Keys...');
    if (!process.env.GOOGLE_API_KEY) console.error('❌ GOOGLE_API_KEY missing');
    if (!process.env.GOOGLE_SEARCH_ENGINE_ID) console.error('❌ GOOGLE_SEARCH_ENGINE_ID missing');

    if (process.env.GOOGLE_API_KEY && process.env.GOOGLE_SEARCH_ENGINE_ID) {
        console.log('✅ Keys present.');
    } else {
        return;
    }

    const businessName = "Konak Hastanesi İzmit"; // Use the user's example
    console.log(`\n🔍 Searching for: "${businessName}"...`);

    const query = `${businessName} official website social media instagram facebook linkedin`;
    const googleUrl = `https://www.googleapis.com/customsearch/v1?key=${process.env.GOOGLE_API_KEY}&cx=${process.env.GOOGLE_SEARCH_ENGINE_ID}&q=${encodeURIComponent(query)}`;

    try {
        const res = await fetch(googleUrl);
        const data = await res.json();

        if (data.error) {
            console.error('❌ Google API Error:', data.error.message);
            return;
        }

        if (!data.items || data.items.length === 0) {
            console.log('⚠️ No results found on Google.');
            return;
        }

        console.log(`✅ Found ${data.items.length} results.`);
        console.log('--- Top Result ---');
        console.log('Title:', data.items[0].title);
        console.log('Link:', data.items[0].link);

        console.log('\n✅ SYSTEM STATUS: OPERATIONAL');
        console.log('The code and keys are working correcty for Google Search.');

    } catch (error) {
        console.error('❌ Fetch Error:', error);
    }
}

testSearch();
