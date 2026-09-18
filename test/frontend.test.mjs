import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateCatalog, validateSnapshot, selectRows, counts, isStale, chooseSnapshot, freshnessMessage } from '../site/model.mjs';
const catalog = JSON.parse(await readFile(new URL('../config/contributions.json', import.meta.url)));
const quotes = JSON.parse(await readFile(new URL('../config/quotes.json', import.meta.url)));
const now = Date.parse('2026-09-19T00:00:00Z');
function snapshot() {
  return { schemaVersion: 1, manifestHash: 'test', fetchedAt: new Date(now).toISOString(), quotes,
    contributions: catalog.map((row, i) => ({ ...row, title: row.summary, state: i === 4 || i === 10 ? 'MERGED' : 'OPEN', draft: false,
      headSha: 'a'.repeat(40), createdAt: new Date(now - i * 60000).toISOString(), updatedAt: new Date(now).toISOString(),
      checkedAt: new Date(now).toISOString(), mergedAt: null, historical: i === 4 || i === 10, stale: false, error: null,
      ci: { state: i === 0 || i === 2 ? 'gated' : 'unknown', summary: 'No green claim' } })) };
}
test('scope is 25 canonical public links in 24 repositories', () => {
  assert.equal(validateCatalog(catalog).length, 25);
  assert.equal(new Set(catalog.map(r => `${r.owner}/${r.repo}`)).size, 24);
  assert.deepEqual(counts(validateSnapshot(snapshot(), catalog).contributions), { ALL: 25, OPEN: 23, MERGED: 2, CLOSED: 0 });
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
