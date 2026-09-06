const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { NextResponse } = require('next/server');
const source = ts.transpileModule(fs.readFileSync('app/api/stats/route.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

async function run({ market = 'tr', requestedAgent = 'self', signedIn = true, failActivity = false } = {}) {
    let adminCreated = false;
    const queries = [];
    const rows = {
        profiles: ['self', 'peer', 'foreign'].map(id => ({ id, full_name: id, role: 'agent', sales_role: 'sdr', market_id: id === 'foreign' ? 'en' : 'tr' })),
        lead_activity_log: [
            ...Array.from({ length: 1001 }, () => ({ agent_id: 'self', action: 'completed', created_at: new Date().toISOString(), metadata: {}, 'leads.market_id': 'tr' })),
            ...Array.from({ length: 5 }, () => ({ agent_id: 'peer', action: 'completed', created_at: new Date().toISOString(), metadata: { action_taken: 'appointment_scheduled' }, 'leads.market_id': 'tr' })),
            { agent_id: 'foreign', action: 'completed', created_at: new Date().toISOString(), metadata: { action_taken: 'appointment_scheduled' }, 'leads.market_id': 'en' },
        ],
        agent_progress: [], leads: [],
    };
    function from(table) {
        let filters = [], range = null;
        const query = {
            select() { return query; }, order() { return query; }, or() { return query; },
            eq(key, value) { filters.push(row => row[key] === value); return query; },
            gte(key, value) { filters.push(row => row[key] >= value); return query; },
            in(key, values) { filters.push(row => values.includes(row[key])); return query; },
            range(start, end) { range = [start, end]; return query; },
            then(resolve, reject) {
                queries.push(table);
                const data = (rows[table] || []).filter(row => filters.every(filter => filter(row)));
                return Promise.resolve({ data: range ? data.slice(range[0], range[1] + 1) : data, count: data.length,
                    error: failActivity && table === 'lead_activity_log' ? new Error('database unavailable') : null }).then(resolve, reject);
            },
        };
        return query;
    }
    const session = {
        auth: { getUser: async () => ({ data: { user: signedIn ? { id: 'self' } : null } }) },
        from: () => ({ select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: { id: 'self', role: 'agent', market_id: market } }) }),
    };
    const exports = {};
    vm.runInNewContext(source, { exports, console, Date, URL, require(name) {
        if (name === 'next/server') return { NextResponse };
        if (name === 'date-fns-tz') return require(name);
        if (name.endsWith('/server')) return { createClient: async () => session };
        if (name.endsWith('/admin')) return { createAdminClient: () => { adminCreated = true; return { from }; } };
        if (name.endsWith('/market-access')) return { isGlobalRole: role => ['founder', 'admin'].includes(role) };
        throw new Error(name);
    } });
    const response = await exports.GET(new Request(`https://example.test/api/stats?agentId=${requestedAgent}`));
    return { status: response.status, body: await response.json(), adminCreated, queries };
}

test('team appointments include peers beyond 1000 activity rows without exposing another market or raw records', async () => {
    const result = await run();
    assert.equal(result.status, 200);
    assert.equal(result.body.leaderboard.find(row => row.agent_id === 'peer').processed_count, 5);
    assert.equal(result.body.leaderboard.some(row => row.agent_id === 'foreign'), false);
    assert.equal(result.body.currentUserStats.processed_today, 0);
    assert.equal(JSON.stringify(result.body).includes('appointment_scheduled'), false);
});
test('missing market fails closed before creating a privileged client', async () => {
    const result = await run({ market: null });
    assert.equal(result.status, 403); assert.equal(result.adminCreated, false);
});
test('agent cannot request another person private stats', async () => {
    const result = await run({ requestedAgent: 'peer' });
    assert.equal(result.status, 403); assert.equal(result.adminCreated, false);
});
test('unauthenticated request cannot initialize privileged queries', async () => {
    const result = await run({ signedIn: false });
    assert.equal(result.status, 401); assert.equal(result.adminCreated, false);
});
test('database failure returns an error instead of zero appointments', async () => {
    const result = await run({ failActivity: true });
    assert.equal(result.status, 500);
});
