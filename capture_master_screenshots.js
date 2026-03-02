const { chromium } = require('playwright-chromium');
const fs = require('fs');
const path = require('path');

const ARTIFACTS_DIR = 'C:\\Users\\90505\\.gemini\\antigravity\\brain\\effc0ebc-62d3-4d52-83cc-2d6d5e957ca9';

async function run() {
    console.log('Starting ULTRA-DETAIL screenshot capture...');
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        deviceScaleFactor: 2 // High resolution
    });
    const page = await context.newPage();

    // Helper function for waiting and visual stability
    async function waitAndCapture(name, fullPage = true) {
        console.log(`Waiting for ${name} to fully load...`);
        await page.waitForLoadState('networkidle');
        await page.waitForLoadState('domcontentloaded');
        // Give time for animations and data fetching to settle
        await page.waitForTimeout(5000);

        // Ensure no loading skeletons are present
        try {
            await page.waitForSelector('.animate-pulse', { state: 'hidden', timeout: 5000 });
        } catch (e) {
            console.log('Pulse animation still present or not found, proceeding...');
        }

        console.log(`Capturing ${name}...`);
        await page.screenshot({
            path: path.join(ARTIFACTS_DIR, `ultra_ss_${name}.png`),
            fullPage: fullPage
        });
    }

    // 1. LOGIN PAGE
    await page.goto('http://localhost:3000/login');
    await waitAndCapture('login');

    // 2. MANAGER DASHBOARD - MONITOR
    console.log('Logging in as Manager...');
    await page.fill('input[type="email"]', 'alisangul123@gmail.com');
    await page.fill('input[type="password"]', 'Alisan123!');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/manager**', { timeout: 30000 });

    // Stay on Monitor, but scroll down as requested to hide "Sales Approval" if it's at the top
    // Or just capture the lower part if that's what "aşağı kaydır" implies
    console.log('Managing Monitor Page Scroll...');
    await page.waitForTimeout(5000); // Wait for dashboard data

    // Capture TOP PART (Standard)
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'ultra_ss_manager_monitor_top.png') });

    // Scroll down to focus on Activity Stream and lower cards (hiding approvals if they are at top)
    await page.evaluate(() => window.scrollTo(0, 500));
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'ultra_ss_manager_monitor_scrolled.png') });

    // 3. ACTIVITY DETAIL MODAL
    try {
        console.log('Opening Activity Detail Modal...');
        // Refresh to move back to top or just click
        await page.evaluate(() => window.scrollTo(0, 0));
        const firstActivity = page.locator('.cursor-pointer').first();
        if (await firstActivity.isVisible()) {
            await firstActivity.click();
            await page.waitForTimeout(2000); // Modal animation
            await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'ultra_ss_manager_activity_detail.png') });
            await page.keyboard.press('Escape');
            await page.waitForTimeout(500);
        }
    } catch (e) {
        console.warn('Could not click activity:', e.message);
    }

    // 4. MANAGER TABS
    const tabs = [
        { id: 'team', ui: 'Personel' },
        { id: 'leads', ui: 'Leads' },
        { id: 'calendar', ui: 'Randevular' },
        { id: 'analytics', ui: 'Analiz' },
        { id: 'reports', ui: 'Raporlar' },
        { id: 'rankings', ui: 'Sıralama' },
        { id: 'goals', ui: 'Hedefler' },
        { id: 'upload', ui: 'Yükle' },
        { id: 'sms-logs', ui: 'SMS Geçmişi' },
        { id: 'settings', ui: 'Ayarlar' }
    ];

    for (const tab of tabs) {
        console.log(`Entering Manager Tab: ${tab.ui}...`);
        try {
            const btn = page.locator(`button[title="${tab.ui}"], button:has-text("${tab.ui}")`).first();
            await btn.click();

            // Special case for leads: make it shorter (not full page)
            const isFullPage = tab.id !== 'leads';
            await waitAndCapture(`manager_${tab.id}`, isFullPage);
        } catch (e) {
            console.error(`Error on tab ${tab.id}:`, e.message);
        }
    }

    // 5. AGENT DASHBOARD
    console.log('Switching to Agent Dashboard...');
    await page.goto('http://localhost:3000/login');
    await page.fill('input[type="email"]', 'agentonur@gmail.com');
    await page.fill('input[type="password"]', 'Agent123!');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/agent**', { timeout: 30000 });

    // Agent Work Page (Ultra Wait)
    await waitAndCapture('agent_work');

    // Agent History Tab
    try {
        const historyBtn = page.locator('button:has-text("Geçmiş"), button[title="Geçmiş"]').first();
        if (await historyBtn.isVisible()) {
            await historyBtn.click();
            await waitAndCapture('agent_history');
        }
    } catch (e) { }

    await browser.close();
    console.log('All ultra-detailed screenshots captured successfully.');
}

run().catch(err => {
    console.error('Ultra capture script failed:', err);
    process.exit(1);
});
