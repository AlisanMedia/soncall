const { chromium } = require('playwright-chromium');
const fs = require('fs');
const path = require('path');

const ARTIFACTS_DIR = 'C:\\Users\\90505\\.gemini\\antigravity\\brain\\effc0ebc-62d3-4d52-83cc-2d6d5e957ca9';

async function run() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 }
    });
    const page = await context.newPage();

    console.log('Navigating to login page...');
    await page.goto('http://localhost:3000/login');
    await page.waitForLoadState('networkidle');

    // Login as Agent
    console.log('Filling agent login form...');
    await page.fill('input[type="email"]', 'agentonur@gmail.com');
    await page.fill('input[type="password"]', 'Agent123!');
    await page.click('button[type="submit"]');

    console.log('Logging in as agent...');
    await page.waitForURL('**/agent**', { timeout: 20000 });
    await page.waitForLoadState('networkidle');
    console.log('Logged in to Agent Dashboard.');

    // Screenshot main agent dashboard (Activity/Work tab)
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'ss_agent_work.png') });
    console.log('Agent work tab captured.');

    // Capture Gamification Bar detail
    try {
        const gamificationBar = page.locator('.relative.overflow-hidden.group.border.rounded-xl').first();
        await gamificationBar.screenshot({ path: path.join(ARTIFACTS_DIR, 'ss_agent_gamification.png') });
        console.log('Gamification bar captured.');
    } catch (e) {
        console.log('Gamification bar not found specifically, skipped clip.');
    }

    // Capture Agent Navigation
    const tabs = [
        { id: 'history', label: 'Geçmiş' },
        { id: 'sales', label: 'Satışlarım' },
        { id: 'appointments', label: 'Randevular' }
    ];

    for (const tab of tabs) {
        console.log(`Taking screenshot of agent tab: ${tab.label}`);
        try {
            const button = page.locator(`button[title="${tab.label}"], button:has-text("${tab.label}")`).first();
            await button.click();
            await page.waitForTimeout(1500);
            await page.screenshot({ path: path.join(ARTIFACTS_DIR, `ss_agent_${tab.id}.png`) });
            console.log(`Captured agent ${tab.id}`);
        } catch (e) {
            console.error(`Failed to capture agent ${tab.id}:`, e.message);
        }
    }

    await browser.close();
    console.log('All agent screenshots captured.');
}

run().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
