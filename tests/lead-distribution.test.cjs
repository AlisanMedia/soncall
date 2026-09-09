const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '../lib/lead-distribution.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const moduleUnderTest = { exports: {} };
new Function('module', 'exports', compiled)(moduleUnderTest, moduleUnderTest.exports);
const { equalLeadAllocation, REDISTRIBUTABLE_STATUSES } = moduleUnderTest.exports;

test('selected leads are distributed evenly and exactly once', () => {
    const allocations = equalLeadAllocation(['lead-5', 'lead-2', 'lead-4', 'lead-1', 'lead-3'], ['agent-b', 'agent-a']);
    assert.deepEqual(allocations, [
        { agentId: 'agent-a', leadIds: ['lead-1', 'lead-3', 'lead-5'] },
        { agentId: 'agent-b', leadIds: ['lead-2', 'lead-4'] },
    ]);
    assert.deepEqual(allocations.flatMap((item) => item.leadIds).sort(), ['lead-1', 'lead-2', 'lead-3', 'lead-4', 'lead-5']);
});

test('duplicate IDs cannot skew equal allocation', () => {
    const allocations = equalLeadAllocation(['lead-1', 'lead-1', 'lead-2'], ['agent-a', 'agent-a']);
    assert.deepEqual(allocations, [{ agentId: 'agent-a', leadIds: ['lead-1', 'lead-2'] }]);
});

test('only real redistributable database statuses are accepted', () => {
    assert.deepEqual([...REDISTRIBUTABLE_STATUSES], ['pending', 'contacted', 'callback', 'not_interested']);
    assert.equal(REDISTRIBUTABLE_STATUSES.includes('appointment'), false);
    assert.equal(REDISTRIBUTABLE_STATUSES.includes('unreachable'), false);
});

test('distribution requires at least one target agent', () => {
    assert.throws(() => equalLeadAllocation(['lead-1'], []), /At least one agent/);
});
