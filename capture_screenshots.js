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

    // Screenshot login page
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'ss_login.png') });
    console.log('Login page captured.');

    // Login
    console.log('Filling login form...');
    await page.fill('input[type="email"]', 'alisangul123@gmail.com');
    await page.fill('input[type="password"]', 'Alisan123!');
    await page.click('button[type="submit"]');

    console.log('Logging in and waiting for navigation...');
    // Wait for either /manager or /dashboard or just any state change
    try {
        await page.waitForURL(url => url.toString().includes('/manager') || url.toString().includes('/agent'), { timeout: 20000 });
        console.log('Navigation successful:', page.url());
    } catch (e) {
        console.log('Login redirect timed out, current URL:', page.url());
        // Take a screenshot of the state after login attempt
        await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'ss_login_after_attempt.png') });
    }

    await page.waitForLoadState('networkidle');
    console.log('Final page state loaded.');

    const tabs = [
        { id: 'monitor', label: 'monitor', ui: 'Genel Bakış' },
        { id: 'team', label: 'team', ui: 'Personel' },
        { id: 'leads', label: 'leads', ui: 'Leads' },
        { id: 'calendar', label: 'calendar', ui: 'Randevular' },
        { id: 'analytics', label: 'analytics', ui: 'Analiz' },
        { id: 'reports', label: 'reports', ui: 'Raporlar' },
        { id: 'rankings', label: 'rankings', ui: 'Sıralama' },
        { id: 'goals', label: 'goals', ui: 'Hedefler' },
        { id: 'upload', label: 'upload', ui: 'Yükle' },
        { id: 'sms-logs', label: 'sms-logs', ui: 'SMS Geçmişi' }
    ];

    for (const tab of tabs) {
        console.log(`Taking screenshot of tab: ${tab.ui}`);
        try {
            // Try different selectors for buttons with titles
            const button = page.locator(`button[title="${tab.ui}"], button:has-text("${tab.ui}")`).first();
            await button.scrollIntoViewIfNeeded();
            await button.click();

            await page.waitForTimeout(1500); // Animation wait
            await page.screenshot({ path: path.join(ARTIFACTS_DIR, `ss_manager_${tab.id}.png`), fullPage: false });
            console.log(`Captured ${tab.id}`);
        } catch (e) {
            console.error(`Failed to capture ${tab.id}:`, e.message);
        }
    }

    // Capture User Profile specifically (right side)
    try {
        await page.screenshot({
            path: path.join(ARTIFACTS_DIR, 'ss_manager_profile_area.png'),
            clip: { x: 1500, y: 0, width: 420, height: 150 }
        });
    } catch (e) { }

    // Try to open activity detail modal
    try {
        console.log('Trying to open activity detail modal...');
        // Wait for an activity item to appear in TeamMonitoring
        await page.waitForSelector('.cursor-pointer', { timeout: 5000 });
        await page.click('.cursor-pointer'); // Click the first activity
        await page.waitForTimeout(1000);
        await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'ss_manager_activity_detail.png') });
        console.log('Activity detail modal captured.');
    } catch (e) {
        console.error('Failed to capture activity detail:', e.message);
    }

    await browser.close();
    console.log('All screenshots captured.');
}

run().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
