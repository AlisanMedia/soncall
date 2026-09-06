const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function loadAnalytics() {
    const source = fs.readFileSync(path.join(__dirname, '../lib/analytics.ts'), 'utf8');
    const code = ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText;
    const context = {
        exports: {},
        require(name) {
            // Analytics must not initialize the service-role client merely to
            // read rank labels. No credentials exist in this isolated module.
            if (name === './gamification-utils') return { getRankInfo: () => ({ title: 'Test rank' }) };
            if (name === './timezone') return {
                getAppDayStart: () => new Date(0),
                formatAppDate: value => new Date(value).toISOString().slice(0, 10),
            };
            if (name === 'date-fns-tz') return {
                formatInTimeZone: (value, _zone, format) => format === 'H'
                    ? String(new Date(value).getUTCHours())
                    : new Date(value).toISOString().slice(0, 10),
            };
            throw new Error(name);
        },
    };
    vm.runInNewContext(code, context);
    return context.exports.fetchManagerAnalytics;
}

function database({ failPage = false } = {}) {
    const queries = [];
    const pages = [];
    const now = new Date().toISOString();
    const rows = Array.from({ length: 1001 }, () => ({
        created_at: now, action: 'completed', category: 'Jewelry', market_id: 'selected-market',
    })).concat([{ created_at: now, action: 'completed', category: 'Other', market_id: 'other-market' }]);
    return {
        queries, pages,
        from(table) {
            const query = {
                table, filters: [], columns: '', options: undefined,
                select(columns, options) { this.columns = columns; this.options = options; return this; },
                eq(key, value) { this.filters.push([key, value]); return this; },
                in() { return this; },
                gte() { return this; },
                lt() { return this; },
                order() { return this; },
                filteredRows() {
                    if (!['leads', 'lead_activity_log'].includes(table)) return [];
                    const market = this.filters.find(([key]) => key === 'market_id' || key === 'leads.market_id');
                    return market ? rows.filter(row => row.market_id === market[1]) : rows;
                },
                then(resolve, reject) {
                    return Promise.resolve({ data: [], count: this.filteredRows().length, error: null }).then(resolve, reject);
                },
                range(from, to) {
                    pages.push({ table, from, to });
                    if (failPage && from === 1000) return Promise.resolve({ data: null, error: new Error('Second page failed') });
                    // Emulate the PostgREST response cap, not an unlimited mock.
                    return Promise.resolve({ data: this.filteredRows().slice(from, Math.min(to + 1, from + 1000)), error: null });
                },
            };
            queries.push(query);
            return query;
        },
    };
}

test('manager analytics counts beyond 1000 rows and excludes another market', async () => {
    const db = database();
    const result = await loadAnalytics()(db, 'selected-market');
    assert.equal(result.hourly.reduce((sum, bucket) => sum + bucket.count, 0), 1001);
    assert.equal(result.daily.reduce((sum, bucket) => sum + bucket.count, 0), 1001);
    assert.equal(result.categories.length, 1);
    assert.equal(result.categories[0].category, 'Jewelry');
    assert.equal(result.categories[0].count, 1001);
    assert.equal(result.todayStats.processed, 1001);
    assert.equal(db.pages.filter(page => page.from === 1000).length, 3);
    const activityQueries = db.queries.filter(query => query.table === 'lead_activity_log');
    assert.equal(activityQueries.length, 3);
    for (const query of activityQueries) {
        assert.match(query.columns, /leads:lead_id!inner\(market_id\)/);
        assert.ok(query.filters.some(([key, value]) => key === 'leads.market_id' && value === 'selected-market'));
    }
});

test('global analytics includes every market without an implicit filter', async () => {
    const result = await loadAnalytics()(database(), null);
    assert.equal(result.hourly.reduce((sum, bucket) => sum + bucket.count, 0), 1002);
    assert.equal(result.todayStats.processed, 1002);
    assert.equal(result.categories.length, 2);
});

test('a failed later page does not return misleading partial analytics', async () => {
    await assert.rejects(loadAnalytics()(database({ failPage: true }), 'selected-market'), /Second page failed/);
});
