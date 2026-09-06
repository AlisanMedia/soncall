const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
const vm = require('node:vm');
const source = ts.transpileModule(fs.readFileSync('app/api/ai/transcribe/route.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
}).outputText;
const leadId = '12345678-1234-1234-1234-123456789abc';

async function run({ providerFails = false, saveFails = false, assigned = true } = {}) {
    const writes = [];
    const client = {
        auth: { getUser: async () => ({ data: { user: { id: 'agent' } } }) },
        storage: { from: () => ({ download: async () => ({ data: new Blob(['recording']) }) }) },
        from(table) {
            let update = false;
            const query = {
                select() { return query; }, eq() { return query; },
                update(value) { writes.push([table, value]); update = true; return query; },
                maybeSingle: async () => ({ data: update ? (saveFails ? null : { id: leadId }) : { assigned_to: assigned ? 'agent' : 'other', market_id: null } }),
                insert: async value => { writes.push([table, value]); return { error: saveFails ? { code: '42501' } : null }; }
            };
            return query;
        }
    };
    const mocks = {
        'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status || 200 }) } },
        '@/lib/supabase/server': { createClient: async () => client },
        '@/lib/call-analysis': {
            getRecordingPath: () => `${leadId}-123.webm`,
            getAudioMimeType: () => 'audio/webm',
            parseCallDate: value => new Date(value)
        },
        '@/lib/ai-usage': { logAiUsage: async () => {} },
        openai: class {
            audio = { transcriptions: { create: async () => 'Müşteri demo istedi.' } };
            chat = { completions: { create: async () => {
                if (providerFails) throw new Error('provider unavailable');
                return { choices: [{ message: { content: JSON.stringify({ summary: 'Demo talebi', potential_level: 'high', key_objections: [] }) } }] };
            } } };
        }
    };
    const exports = {};
    vm.runInNewContext(source, { exports, require: name => mocks[name], process: { env: { OPENAI_API_KEY: 'test-only', NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co' } }, console: { log() {}, error() {} }, Blob, File, URL, Date });
    const response = await exports.POST({ json: async () => ({ leadId, audioUrl: 'valid', durationSeconds: 10 }) });
    return { response, writes };
}

test('successful analysis persists note, call and activity', async () => {
    const { response, writes } = await run();
    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
    assert.equal(response.body.warnings.length, 0);
    assert.deepEqual(writes.map(([table]) => table), ['leads', 'lead_notes', 'call_logs', 'lead_activity_log']);
});
test('provider analysis failure is not successful or persisted as an analysis', async () => {
    const { response, writes } = await run({ providerFails: true });
    assert.equal(response.status, 502);
    assert.equal(writes.length, 0);
});
test('RLS zero-row update and failed inserts surface persistence warnings', async () => {
    const { response } = await run({ saveFails: true });
    assert.equal(response.body.warnings.length, 4);
});
test('unassigned agents cannot trigger analysis', async () => {
    const { response, writes } = await run({ assigned: false });
    assert.equal(response.status, 403);
    assert.equal(writes.length, 0);
});
