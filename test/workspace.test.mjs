import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DEFAULT_ROUTE, readRoute, routeQuery, workspaceFeed, PAGE_SIZE } from '../site/workspace.mjs';
import { hashBody } from '../site/activity.mjs';

test('workspace routes roundtrip every view, filter and canonical PR without changing source text', () => {
  for (const tab of ['prs', 'activity', 'feedback', 'help']) {
    const route = { ...DEFAULT_ROUTE, tab, search: 'Chi & "router" #1185', view: 'merged',
      ci: 'gated', sort: 'project', automation: true, kind: 'reviews', page: 4, pr: 'go-chi/chi#1185' };
    assert.deepEqual(readRoute(routeQuery(route)), route);
  }
  assert.equal(routeQuery(DEFAULT_ROUTE), '');
  assert.equal(readRoute('?pr=go-chi%2Fchi%231185').pr, 'go-chi/chi#1185');
});
test('unsupported routes normalize closed vocabularies, invalid selection and pagination', () => {
  const invalid = readRoute('?tab=bogus&state=bogus&ci=green&sort=bogus&kind=bogus&page=-1&pr=https://evil.example');
  assert.deepEqual(invalid, DEFAULT_ROUTE);
  assert.equal(readRoute('?page=1.5').page, 1);
  assert.equal(readRoute('?page=999999').page, 10000);
  assert.equal(readRoute('?tab=feedback&kind=updates').kind, 'all');
  assert.equal(readRoute('?tab=activity&kind=updates').kind, 'updates');
});
const event = (id, kind = 'comment', classification = 'unknown') => ({
  id: String(id), kind, actor: { classification, login: 'example' },
  date: '2026-09-21T00:00:00Z', updatedAt: `2026-09-21T00:${String(id).padStart(2, '0')}:00Z`,
  body: '**Full original**\n\n<details><summary>Context</summary>\n\nNever truncate the evidence.\n</details>',
});
test('feedback includes complete actual comments and reviews, unknown remains unclassified, baseline is not activity', () => {
  const messages = [event(1), event(2, 'review'), event(3, 'review_comment'), event(4, 'comment', 'automation'),
    { ...event(5, 'head_update'), previousHeadSha: null }, { ...event(6, 'head_update'), previousHeadSha: 'a'.repeat(40) }, event(7, 'merged')];
  const rows = [{ activity: { events: messages } }];
  const before = structuredClone(rows);
  const feedback = workspaceFeed(rows, { ...DEFAULT_ROUTE, tab: 'feedback' });
  assert.deepEqual(feedback.events.map(({ event }) => event.id), ['3', '2', '1']);
  assert.equal(feedback.events[0].event.actor.classification, 'unknown');
  assert.equal(hashBody(feedback.events[0].event.body), hashBody(messages[2].body));
  assert.equal(workspaceFeed(rows, { ...DEFAULT_ROUTE, tab: 'activity' }).total, 5);
  assert.equal(workspaceFeed(rows, { ...DEFAULT_ROUTE, tab: 'feedback', automation: true }).total, 4);
  assert.equal(workspaceFeed(rows, { ...DEFAULT_ROUTE, tab: 'feedback', kind: 'reviews' }).total, 2);
  assert.deepEqual(rows, before);
});
test('feed pagination is complete, bounded and clamps without hiding the final page', () => {
  const rows = [{ activity: { events: Array.from({ length: 25 }, (_, i) => event(i + 1)) } }];
  const ids = [];
  for (const page of [1, 2, 3]) {
    const feed = workspaceFeed(rows, { ...DEFAULT_ROUTE, tab: 'feedback', page });
    assert.equal(feed.total, 25);
    assert.equal(feed.pages, 3);
    assert.ok(feed.events.length <= PAGE_SIZE);
    ids.push(...feed.events.map(({ event }) => event.id));
  }
  assert.equal(new Set(ids).size, 25);
  assert.equal(workspaceFeed(rows, { ...DEFAULT_ROUTE, page: 100 }).page, 3);
});
test('workspace uses one PR list, native route links and popstate with filter-bound navigation', async () => {
  const html = await readFile(new URL('../site/index.html', import.meta.url), 'utf8');
  const app = await readFile(new URL('../site/app.mjs', import.meta.url), 'utf8');
  const css = await readFile(new URL('../site/style.css', import.meta.url), 'utf8');
  assert.equal((html.match(/id="rows"/g) ?? []).length, 1);
  assert.doesNotMatch(html, /id="signal-field"|id="signal-board"|Contribution signals/);
  assert.equal((html.match(/data-tab="/g) ?? []).length, 4);
  assert.match(app, /window\.addEventListener\('popstate'/);
  assert.match(app, /'replaceState' : 'pushState'/);
  assert.match(app, /navigationPosition\(filteredRows\(\), selectedKey, key\)/);
  assert.match(app, /event\.ctrlKey \|\| event\.metaKey/);
  assert.match(app, /restoreFocus\(history\.state\?\.focus\)/);
  assert.match(html, /current snapshot records a flat timeline/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(css, /max-width:480px/);
});
