const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const adapters = require('../js/sources.js');
const sources = require('../sources.json');
const team = sources.find(s => s.id === 'teammoto-virginia');
const olivers = sources.find(s => s.id === 'olivers');
const fixture = name => JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8'));

test('browser parsers preserve the existing feed normalization', () => {
  const local = require('../lib/sources.js');
  for (const [name, source, parser] of [['olivers.json', olivers, 'parseOlivers'], ['teammoto.json', team, 'parseTeamMoto']]) {
    const input = fixture(name);
    const items = Array.isArray(input) ? input : input.items;
    assert.deepEqual(adapters[parser](items, source), local[parser](items, source));
  }
});

test('browser requests use CORS, omit credentials and reject incomplete showroom results', async t => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(options.mode, 'cors');
    assert.equal(options.credentials, 'omit');
    const request = JSON.parse(options.body);
    assert.equal(request.filters[0].values[0].value, team.dealership);
    return new Response(JSON.stringify({ items: [], meta: { total: 1, filters: request.filters } }));
  });
  await assert.rejects(adapters.fetchSource(team), /stopped before the final page/);
});

test('browser rejects an unfiltered TeamMoto response', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ items: [], meta: { total: 0, filters: [] } })));
  await assert.rejects(adapters.fetchSource(team), /did not apply the showroom filter/);
});

test('Brisbane browser restriction is explicit and does not attempt an unreadable request', async t => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('Unexpected request'));
  await assert.rejects(adapters.fetchSource(sources[0]), /does not allow direct browser requests/);
});
