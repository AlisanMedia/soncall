const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { NextResponse } = require('next/server');

for (const route of ['daily-digest', 'motivation', 'reminders']) {
    for (const secret of [undefined, 'configured-secret']) {
        test(`${route} rejects unauthenticated requests ${secret ? 'with' : 'without'} a configured secret`, async () => {
            const exports = {};
            const source = ts.transpileModule(fs.readFileSync(`app/api/cron/${route}/route.ts`, 'utf8'), {
                compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
            }).outputText;
            const fail = () => { throw new Error('An unauthorized request reached a side effect'); };
            vm.runInNewContext(source, {
                exports, process: { env: { CRON_SECRET: secret } }, console,
                require(name) {
                    if (name === 'next/server') return { NextResponse };
                    return { createClient: fail, createAdminClient: fail, createServiceRoleClient: fail, sendSMS: fail, processReport: fail };
                }
            });
            const response = await exports.GET(new Request('https://example.test/api/cron/' + route));
            assert.equal(response.status, 401);
        });
    }
}
