const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

// Exercise the route itself without production credentials or database writes.
const source = fs.readFileSync(path.join(__dirname, '../app/api/agent/leads/[id]/route.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

async function fetchLead({ role = 'agent', market = 'market-a', activityAgent = 'other', assigned = 'other' }) {
    const profile = { id: 'viewer', role, market_id: market };
    const database = {
        from(table) {
            const query = {
                select() { return query; },
                eq() { return query; },
                order() { return query; },
                maybeSingle() {
                    return Promise.resolve({ data: table === 'profiles'
                        ? profile
                        : { id: 'lead', market_id: 'market-a', assigned_to: assigned, lead_notes: [] } });
                },
                then(resolve) {
                    resolve({ data: table === 'lead_activity_log' ? [{ agent_id: activityAgent }] : [] });
                },
            };
            return query;
        },
    };
    const mocks = {
        'next/server': { NextResponse: { json: (data, options) => ({ data, status: options?.status || 200 }) } },
        '@/lib/supabase/server': {
            createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: 'viewer' } } }) } }),
        },
        '@/lib/supabase/admin': { createAdminClient: () => database },
        '@/lib/market-access': {
            canAccessMarket: (actor, marketId) => ['admin', 'founder'].includes(actor.role)
                || Boolean(actor.market_id && marketId && actor.market_id === marketId),
        },
    };
    const routeModule = { exports: {} };
    new Function('require', 'module', 'exports', compiled)((name) => {
        assert.ok(Object.hasOwn(mocks, name), `Unexpected dependency: ${name}`);
        return mocks[name];
    }, routeModule, routeModule.exports);
    return routeModule.exports.GET({}, { params: Promise.resolve({ id: 'lead' }) });
}

for (const [name, actor, expected] of [
    ['unrelated activity does not grant an agent lead access', {}, 403],
    ['own activity grants an agent historical lead access', { activityAgent: 'viewer' }, 200],
    ['current assignment grants an agent lead access', { assigned: 'viewer' }, 200],
    ['manager cannot read a different market', { role: 'manager', market: 'market-b' }, 403],
    ['manager can read their own market', { role: 'manager' }, 200],
    ['founder retains global market access', { role: 'founder', market: 'market-b' }, 200],
]) {
    test(name, async () => {
        const response = await fetchLead(actor);
        assert.equal(response.status, expected);
        if (expected === 403) {
            assert.equal(response.data.error, 'Forbidden');
            assert.equal(response.data.lead, undefined);
        }
    });
}
