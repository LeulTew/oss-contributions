import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateCatalog, validateSnapshot, selectRows, counts, isStale, chooseSnapshot, reconcileDirect, freshnessMessage, inboxRows, activityFeed, activityDate, reviewLabel } from '../site/model.mjs';
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
test('v1 snapshots remain readable without inventing complete activity or fresh dates', () => {
  const original = snapshot();
  const migrated = validateSnapshot(original, catalog);
  assert.equal(migrated.contributions[0].activity.state, 'unavailable');
  assert.equal(migrated.contributions[0].activity.checkedAt, null);
  assert.equal(migrated.contributions[0].activity.review.state, 'unknown');
  assert.equal(migrated.contributions[0].checkedAt, original.contributions[0].checkedAt);
  assert.equal(migrated.contributions[4].mergedAt, original.contributions[4].mergedAt);
  assert.equal(original.contributions[0].activity, undefined);
});
test('v2 malformed activity is rejected rather than treated as legacy empty activity', () => {
  const data = snapshot();
  data.schemaVersion = 2;
  assert.throws(() => validateSnapshot(data, catalog));
  for (const row of data.contributions) row.activity = {
    state: 'unavailable', checkedAt: null, error: 'legacy_snapshot', events: [],
    review: { state: 'unknown', currentHead: false },
  };
  assert.doesNotThrow(() => validateSnapshot(data, catalog));
  data.contributions[0].activity.state = 'green';
  assert.throws(() => validateSnapshot(data, catalog));
});
test('explicit review requests and CI failures overlap without conflating action meanings', () => {
  const rows = validateSnapshot(snapshot(), catalog).contributions;
  rows[0].activity.review = { state: 'changes_requested', currentHead: false };
  rows[0].ci.state = 'failure';
  rows[1].activity.review = { state: 'approved', currentHead: true };
  const before = structuredClone(rows);
  assert.deepEqual(inboxRows(rows, { view: 'requests', search: 'jsep window.Date' }, now).map(row => row.number), [283]);
  assert.equal(inboxRows(rows, { view: 'failures' }, now).length, 1);
  assert.equal(inboxRows(rows, { view: 'waiting' }, now).length, 1);
  assert.match(reviewLabel(rows[0]), /earlier head/);
  assert.equal(reviewLabel(rows[1]), 'Approval recorded');
  rows[4].activity.review = { state: 'changes_requested', currentHead: true };
  assert.equal(inboxRows(rows, { view: 'requests' }, now).length, 1);
  rows[4] = before[4];
  assert.deepEqual(rows, before);
});
test('feed filters retain unclassified actors but exclude automation by default without modifying rows', () => {
  const rows = validateSnapshot(snapshot(), catalog).contributions;
  rows[0].activity.events = [
    { id: '1', kind: 'comment', actor: { classification: 'unknown' }, updatedAt: '2026-09-18T12:00:00Z', body: 'Could another reviewer inspect this?' },
    { id: '2', kind: 'review', actor: { classification: 'automation' }, updatedAt: '2026-09-18T13:00:00Z' },
    { id: '3', kind: 'head_update', actor: { classification: 'unknown' }, updatedAt: '2026-09-18T14:00:00Z' },
  ];
  const before = structuredClone(rows);
  assert.deepEqual(activityFeed(rows).map(({ event }) => event.id), ['3', '1']);
  assert.deepEqual(activityFeed(rows, { excludeAutomation: false, kind: 'reviews' }).map(({ event }) => event.id), ['2']);
  assert.equal(activityFeed(rows, { kind: 'comments' }).length, 1);
  assert.equal(inboxRows(rows, { view: 'requests' }, now).length, 0);
  assert.deepEqual(rows, before);
});
test('browser surface keeps a strict API origin and text-only remote rendering', async () => {
  const html = await readFile(new URL('../site/index.html', import.meta.url), 'utf8');
  const app = await readFile(new URL('../site/app.mjs', import.meta.url), 'utf8');
  assert.match(html, /connect-src 'self' https:\/\/api\.github\.com;/);
  assert.doesNotMatch(app, /innerHTML|outerHTML|insertAdjacentHTML|document\.write/);
  assert.match(app, /element\.textContent = content/);
  assert.match(html, /60 days without repository activity/);
  assert.match(html, /It does not refresh CI/);
  assert.match(app, /Discussion: .*row\.activity\.checkedAt.*CI: .*row\.checkedAt/);
});
test('initial head baselines never masquerade as recent changes', () => {
  const row = validateSnapshot(snapshot(), catalog).contributions[0];
  const baseline = { id: 'initial', kind: 'head_update', previousHeadSha: null,
    actor: { classification: 'unknown' }, updatedAt: new Date(now + 60000).toISOString() };
  row.activity.events.push(baseline);
  assert.equal(activityDate(row), now);
  assert.equal(activityFeed([row]).length, 0);
  assert.equal(activityFeed([row], { includeBaselines: true }).length, 1);
  row.activity.events.push({ ...baseline, id: 'changed', previousHeadSha: 'a'.repeat(40) });
  assert.equal(activityDate(row), now + 60000);
  assert.equal(activityFeed([row]).length, 1);
});
test('a late published snapshot upgrades same-head CI without discarding newer direct discussion', () => {
  const prior = snapshot().contributions[0];
  const supplement = { row: structuredClone(prior), checkedAt: new Date(now + 120000).toISOString(), cached: false };
  const incoming = { ...prior, checkedAt: new Date(now + 60000).toISOString(), ci: { ...prior.ci, state: 'success' } };
  const merged = reconcileDirect(incoming, supplement);
  assert.equal(merged.row.ci.state, 'success');
  assert.equal(merged.row.checkedAt, incoming.checkedAt);
  assert.equal(merged.checkedAt, supplement.checkedAt);
  assert.equal(supplement.row.checkedAt, prior.checkedAt);
  const anotherHead = { ...incoming, headSha: 'b'.repeat(40) };
  assert.equal(reconcileDirect(anotherHead, supplement), supplement);
  assert.equal(reconcileDirect({ ...incoming, checkedAt: supplement.checkedAt }, supplement), null);
  assert.equal(reconcileDirect({ ...incoming, updatedAt: new Date(now + 1000).toISOString() }, supplement), null);
});
