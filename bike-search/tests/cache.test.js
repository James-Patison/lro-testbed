const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('../js/cache.js');
const state = { sources: [{ id: 'dealer' }], snapshots: [{ bikes: [{ id: 'bike' }] }] };

test('first visit saves inventory; reopening uses storage without downloading', async () => {
  let value = null;
  const storage = { getItem: () => value, setItem: (key, next) => { value = next; } };
  assert.equal((await load(storage, async () => state)).saved, true);
  const reopened = await load(storage, () => { throw Error('Unexpected download'); });
  assert.equal(reopened.cached, true);
  assert.deepEqual(reopened.state.snapshots, state.snapshots);
});

test('damaged or invalid cache is replaced with valid inventory', async () => {
  for (const value of ['{', '{"sources":[],"snapshots":[{}]}']) {
    let replacement;
    const result = await load({ getItem: () => value, setItem: (key, next) => { replacement = next; } }, async () => state);
    assert.equal(result.cached, false);
    assert.deepEqual(JSON.parse(replacement).snapshots, state.snapshots);
  }
});

test('blocked or full storage still permits browsing', async () => {
  const blocked = { getItem() { throw Error('Blocked'); }, setItem() { throw Error('Full'); } };
  const result = await load(blocked, async () => state);
  assert.equal(result.saved, false);
  assert.deepEqual(result.state.snapshots, state.snapshots);
});

test('invalid downloaded inventory is never saved', async () => {
  await assert.rejects(load({ getItem: () => null, setItem() { assert.fail('Unexpected save'); } }, async () => ({})), /Invalid inventory/);
});
