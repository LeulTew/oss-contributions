import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateCatalog, validateSnapshot, selectRows, counts, isStale, chooseSnapshot, freshnessMessage } from '../site/model.mjs';
const catalog = JSON.parse(await readFile(new URL('../config/contributions.json', import.meta.url)));
const quotes = JSON.parse(await readFile(new URL('../config/quotes.json', import.meta.url)));
const now = Date.parse('2026-09-19T00:00:00Z');
function snapshot(entries = catalog) {
  return { schemaVersion: 1, manifestHash: 'test', fetchedAt: new Date(now).toISOString(),
    quotes: quotes.filter(quote => entries.some(row => row.url === quote.contributionUrl)),
    contributions: entries.map((row, i) => ({ ...row, title: row.summary, state: i === 4 || i === 10 ? 'MERGED' : 'OPEN', draft: false,
      headSha: 'a'.repeat(40), createdAt: new Date(now - i * 60000).toISOString(), updatedAt: new Date(now).toISOString(),
      checkedAt: new Date(now).toISOString(), mergedAt: i === 4 || i === 10 ? new Date(now).toISOString() : null,
      historical: i === 4 || i === 10, stale: false, error: null,
      ci: { state: i === 0 || i === 2 ? 'gated' : 'unknown', summary: 'No green claim' } })) };
}
test('public catalog identities determine the exact snapshot scope', () => {
  assert.equal(validateCatalog(catalog).length, catalog.length);
  assert.deepEqual(counts(validateSnapshot(snapshot(), catalog).contributions),
    { ALL: catalog.length, OPEN: catalog.length - 2, MERGED: 2, CLOSED: 0 });
});
test('search requires all whitespace-separated terms across indexed fields', () => {
  const rows = snapshot().contributions;
  const before = structuredClone(rows);
  for (const search of ['jsep window.Date', '  JSEP\twindow.date \n#283 ', 'EricSmekens #283 constructors']) {
    assert.deepEqual(selectRows(rows, { search, state: 'OPEN', ci: 'gated', sort: 'project' }, now).map(r => r.number), [283]);
  }
  assert.deepEqual(selectRows(rows, { search: 'fake #590 promise' }, now).map(r => r.number), [590]);
  assert.equal(selectRows(rows, { search: 'jsep impossible-term' }, now).length, 0);
  assert.equal(selectRows(rows, { search: 'jsep window.Date', state: 'MERGED' }, now).length, 0);
  assert.equal(selectRows(rows, { search: ' \t\n ' }, now).length, rows.length);
  assert.deepEqual(rows, before);
});
function syntheticCatalog(size) {
  return Array.from({ length: size }, (_, i) => ({
    ...catalog[0], owner: 'fixture-owner', repo: 'fixture-repo', number: i + 1,
    url: `https://github.com/fixture-owner/fixture-repo/pull/${i + 1}`, project: 'Synthetic test project',
  }));
}
test('catalog sizes 1 through 100 are accepted without weakening snapshot identity', () => {
  for (const size of [1, 26, 100]) {
    const entries = syntheticCatalog(size);
    assert.equal(validateCatalog(entries).length, size);
    assert.equal(validateSnapshot(snapshot(entries), entries).contributions.length, size);
    for (const mutate of [
      s => s.contributions.pop(),
      s => s.contributions.push({ ...s.contributions[0] }),
      s => { s.contributions[0].owner = 'different-owner'; },
      s => { s.contributions[0].url = 'https://github.com/fixture-owner/fixture-repo/pull/999'; },
    ]) {
      const data = snapshot(entries); mutate(data);
      assert.throws(() => validateSnapshot(data, entries));
    }
    if (size > 1) {
      const data = snapshot(entries); data.contributions[0] = data.contributions[1];
      assert.throws(() => validateSnapshot(data, entries));
    }
  }
  for (const entries of [[], syntheticCatalog(101)]) assert.throws(() => validateCatalog(entries));
});
test('PR state and merge timestamp must agree', () => {
  for (const [state, mergedAt, valid] of [
    ['MERGED', new Date(now).toISOString(), true], ['MERGED', null, false], ['MERGED', 'invalid', false],
    ['OPEN', null, true], ['OPEN', new Date(now).toISOString(), false],
    ['CLOSED', null, true], ['CLOSED', new Date(now).toISOString(), false],
  ]) {
    const data = snapshot();
    Object.assign(data.contributions[0], { state, mergedAt, historical: state !== 'OPEN' });
    if (valid) assert.doesNotThrow(() => validateSnapshot(data, catalog));
    else assert.throws(() => validateSnapshot(data, catalog));
  }
});
test('Pages publication gates collection and deployment on the complete builtin suite', async () => {
  const workflow = await readFile(new URL('../.github/workflows/pages.yml', import.meta.url), 'utf8');
  assert.match(workflow, /^\s+run: node --test\s*$/m);
  assert.ok(workflow.indexOf('run: node --test') < workflow.indexOf('name: Collect public GitHub evidence'));
  assert.match(workflow, /deploy:\s+needs: build/);
});
test('search, state, evidence filters and sort compose without mutating source', () => {
  const rows = snapshot().contributions;
  assert.equal(selectRows(rows, { search: 'DATE()', state: 'OPEN', ci: 'gated' }, now)[0].project, 'Jsep');
  assert.equal(selectRows(rows, { search: '#590' }, now)[0].project, 'Fake Timers');
  assert.equal(selectRows(rows, { search: 'not-a-match' }, now).length, 0);
  assert.equal(selectRows(rows, { state: 'MERGED' }, now).length, 2);
  assert.equal(selectRows(rows, { sort: 'project' }, now)[0].project, 'Charm Bubbles');
  assert.equal(rows[0].project, 'Jsep');
});
test('malformed, missing, duplicated, unrelated and injected URLs fail closed', () => {
  for (const mutate of [
    s => { s.contributions.pop(); }, s => { s.contributions[0] = s.contributions[1]; },
    s => { s.contributions[0].url = 'javascript:alert(1)'; }, s => { s.contributions[0].ci.state = 'green'; },
    s => { s.contributions[0].ci.state = 'constructor'; }, s => { s.contributions[0].historical = true; },
    s => { s.contributions[0].ci.counts = { success: -1 }; },
    s => { s.contributions[0].checkedAt = 'tomorrow'; }, s => { s.quotes = [{ ...quotes[0], source: 'https://evil.example/' }]; },
    s => { s.contributions[0].owner = 'unrelated'; },
  ]) { const data = snapshot(); mutate(data); assert.throws(() => validateSnapshot(data, catalog)); }
});
test('remote summary cannot replace curated scope and copy', () => {
  const data = snapshot(); data.contributions[0].summary = '<script>bad</script>';
  assert.equal(validateSnapshot(data, catalog).contributions[0].summary, catalog[0].summary);
});
test('active stale threshold and historical observations are independent', () => {
  const rows = snapshot().contributions;
  assert.equal(isStale(rows[0], now + 45 * 60000), false);
  assert.equal(isStale(rows[0], now + 46 * 60000), true);
  assert.equal(isStale(rows[4], now + 99 * 60000), false);
  rows[4].stale = true;
  assert.equal(isStale(rows[4], now), true);
});
test('last-good snapshot cannot be replaced by older data or failed validation', () => {
  const good = snapshot(); const older = snapshot(); older.fetchedAt = '2026-09-18T00:00:00Z';
  assert.throws(() => chooseSnapshot(good, older));
  assert.equal(good.fetchedAt, new Date(now).toISOString());
  assert.equal(chooseSnapshot(good, snapshot()).fetchedAt, good.fetchedAt);
});
test('freshness uses actual observation age, never a synthetic update time', () => {
  assert.match(freshnessMessage(snapshot(), now + 46 * 60000), /^Updates delayed 46 minutes ago/);
});
