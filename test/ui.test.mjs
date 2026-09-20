import test from 'node:test';
import assert from 'node:assert/strict';
import { navigationPosition, acceptsSearchShortcut, createIcon, initialTheme, discussionPresentation, inspectionCaveat, signalColumns, signalNeighbor, reviewPresentation } from '../site/ui.mjs';

test('reading navigation follows only the filtered set and never wraps past endpoints', () => {
  const rows = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const key = row => row.id;
  assert.deepEqual(navigationPosition(rows, 'b', key), { index: 1, total: 3, previous: rows[0], next: rows[2] });
  assert.equal(navigationPosition(rows, 'a', key).previous, null);
  assert.equal(navigationPosition(rows, 'c', key).next, null);
  assert.deepEqual(navigationPosition(rows, 'outside', key), { index: -1, total: 3, previous: null, next: null });
  assert.deepEqual(navigationPosition([], 'a', key), { index: -1, total: 0, previous: null, next: null });
});
test('search shortcut works from contribution buttons but preserves editing and reading focus', () => {
  const event = { key: '/', target: { tagName: 'BODY' } };
  assert.equal(acceptsSearchShortcut(event, false), true);
  assert.equal(acceptsSearchShortcut(event, true), false);
  for (const tagName of ['BUTTON', 'A', 'BODY']) assert.equal(acceptsSearchShortcut({ ...event, target: { tagName } }, false), true);
  for (const tagName of ['INPUT', 'TEXTAREA', 'SELECT']) assert.equal(acceptsSearchShortcut({ ...event, target: { tagName } }, false), false);
  for (const modifier of ['ctrlKey', 'metaKey', 'altKey']) assert.equal(acceptsSearchShortcut({ ...event, [modifier]: true }, false), false);
  assert.equal(acceptsSearchShortcut({ ...event, target: { isContentEditable: true } }, false), false);
  assert.equal(acceptsSearchShortcut({ ...event, target: { closest: () => ({ role: 'combobox' }) } }, false), false);
  assert.equal(acceptsSearchShortcut({ ...event, isComposing: true }, false), false);
  assert.equal(acceptsSearchShortcut({ ...event, defaultPrevented: true }, false), false);
  assert.equal(acceptsSearchShortcut({ ...event, key: 'a' }, false), false);
});
test('first visit uses the chosen dark workstation, while all explicit saved choices survive', () => {
  assert.equal(initialTheme(null), 'dark');
  assert.equal(initialTheme('invalid'), 'dark');
  for (const theme of ['light', 'dark', 'system']) assert.equal(initialTheme(theme), theme);
});
test('icons use a closed local vocabulary rather than remote content', () => {
  assert.throws(() => createIcon('constructor', {}), /Unknown interface icon/);
  assert.throws(() => createIcon('<script>', {}), /Unknown interface icon/);
  const doc = { createElementNS: (namespace, name) => ({ namespace, name, attributes: {}, children: [],
    setAttribute(key, value) { this.attributes[key] = value; }, append(value) { this.children.push(value); } }) };
  const icon = createIcon('branch', doc);
  assert.equal(icon.attributes['aria-hidden'], 'true');
  assert.equal(icon.attributes.focusable, 'false');
  assert.equal(icon.children.length, 5);
  assert.ok(icon.children.every(child => child.name === 'path' && child.namespace === 'http://www.w3.org/2000/svg'));
});
const event = (id, kind, classification = 'unknown', extra = {}) => ({
  id, kind, actor: { login: 'fixture', classification }, body: '<literal public text>',
  updatedAt: '2026-09-20T12:00:00Z', date: '2026-09-20T12:00:00Z', ...extra,
});
const discussionRow = events => ({ owner: 'test', repo: 'fixture', number: 1, activity: { state: 'complete', events } });
test('first-head baseline becomes metadata while genuine head changes remain visible', () => {
  const baseline = event('baseline', 'head_update', 'unknown', { headSha: 'a'.repeat(40), previousHeadSha: null });
  const changed = event('change', 'head_update', 'unknown', { headSha: 'b'.repeat(40), previousHeadSha: 'a'.repeat(40) });
  const result = discussionPresentation(discussionRow([baseline, changed]), { kind: 'updates' });
  assert.equal(result.baseline, baseline);
  assert.deepEqual(result.events.map(({ event }) => event.id), ['change']);
  const onlyBaseline = discussionPresentation(discussionRow([baseline]), { kind: 'updates' });
  assert.equal(onlyBaseline.events.length, 0);
  assert.equal(onlyBaseline.emptyMessage, 'No branch or state changes in this view.');
  assert.equal(discussionPresentation(discussionRow([baseline]), { includeAutomation: true }).events.length, 0);
});
test('empty discussion reports hidden automation without claiming no actual comments', () => {
  const bot = event('bot', 'comment', 'automation');
  const row = discussionRow([bot]);
  const hidden = discussionPresentation(row);
  assert.equal(hidden.events.length, 0);
  assert.equal(hidden.hiddenAutomation, 1);
  assert.match(hidden.emptyMessage, /No non-automated discussion/);
  const included = discussionPresentation(row, { includeAutomation: true });
  assert.equal(included.events[0].event.body, '<literal public text>');
  assert.equal(included.events[0].event, bot);
  assert.equal(included.hiddenAutomation, 0);
});
test('automation counts respect the activity filter and unavailable history stays explicit', () => {
  const row = discussionRow([event('bot', 'comment', 'automation'), event('review', 'review', 'unknown')]);
  const reviews = discussionPresentation(row, { kind: 'reviews' });
  assert.equal(reviews.hiddenAutomation, 0);
  assert.deepEqual(reviews.events.map(({ event }) => event.id), ['review']);
  row.activity.events.push(event('merged', 'merged'), event('closed', 'closed'));
  assert.deepEqual(discussionPresentation(row, { kind: 'updates' }).events.map(({ event }) => event.id), ['closed', 'merged']);
  row.activity = { state: 'unavailable', events: [] };
  assert.match(discussionPresentation(row).emptyMessage, /Activity unavailable.*not a new confirmation/);
});
test('visible Gin race caveat is bound to its canonical identity and curated inspection', () => {
  const row = { owner: 'gin-gonic', repo: 'gin', number: 4836, note: 'one job reported four coverage-mode errors before its tests executed' };
  assert.match(inspectionCaveat(row), /did not run its tests.*not race-test proof/);
  assert.equal(inspectionCaveat({ ...row, owner: 'another' }), null);
  assert.equal(inspectionCaveat({ ...row, note: 'Updated context without that inspection.' }), null);
});
const signalTime = Date.parse('2026-09-20T18:00:00Z');
const signalRow = (number = 1) => ({
  owner: 'test', repo: 'fixture', project: 'Test project', number, state: 'OPEN',
  checkedAt: new Date(signalTime).toISOString(), historical: false, stale: false,
  ci: { state: 'success' }, activity: { state: 'complete', review: { state: 'none', currentHead: false }, events: [] },
});
test('review classes are closed-mapped and earlier-head evidence is a separate qualifier', () => {
  const row = signalRow();
  for (const [state, className] of Object.entries({ approved: 'review-approved', none: 'review-none', unknown: 'review-unknown', changes_requested: 'review-request' })) {
    row.activity.review = { state, currentHead: true };
    assert.equal(reviewPresentation(row).className, className);
    assert.equal(reviewPresentation(row).earlierHead, false);
  }
  row.activity.review = { state: 'approved', currentHead: false };
  assert.deepEqual(reviewPresentation(row), { label: 'Approval recorded', className: 'review-approved', earlierHead: true });
  row.activity.review.state = 'constructor';
  assert.throws(() => reviewPresentation(row), /Unknown review state/);
});
test('signal field derives one independent column per supplied record without mutation or fixed scope size', () => {
  for (const length of [0, 1, 25, 100]) {
    const rows = Array.from({ length }, (_, index) => signalRow(index + 1));
    const before = structuredClone(rows);
    const columns = signalColumns(rows, signalTime);
    assert.equal(columns.length, length);
    assert.equal(new Set(columns.map(column => column.key)).size, length);
    assert.deepEqual(rows, before);
    assert.ok(columns.every(column => column.signals.length === 3));
    if (length) assert.equal(columns[0].row, rows[0]);
  }
});
test('review and CI never collapse into a combined pass or author task', () => {
  const row = signalRow();
  row.activity.review = { state: 'changes_requested', currentHead: true };
  row.ci.state = 'gated';
  const column = signalColumns([row], signalTime)[0];
  assert.deepEqual(column.signals.map(signal => signal.tone), ['open', 'changes_requested', 'gated']);
  assert.match(column.label, /Review: Changes requested.*CI: Maintainer action/);
  row.activity.review = { state: 'approved', currentHead: false };
  assert.equal(signalColumns([row], signalTime)[0].signals[1].tone, 'approved');
  assert.equal(signalColumns([row], signalTime)[0].signals[1].mark, '+~');
  assert.match(signalColumns([row], signalTime)[0].label, /Approval on an earlier head/);
  row.activity.review = { state: 'changes_requested', currentHead: false };
  assert.equal(signalColumns([row], signalTime)[0].signals[1].tone, 'changes_requested');
  assert.equal(signalColumns([row], signalTime)[0].signals[1].mark, '!~');
});
test('staleness is an independent qualifier without erasing the recorded CI state', () => {
  const row = signalRow();
  assert.equal(signalColumns([row], signalTime + 45 * 60000)[0].signals[2].tone, 'success');
  assert.equal(signalColumns([row], signalTime + 46 * 60000)[0].signals[2].tone, 'success');
  assert.equal(signalColumns([row], signalTime + 46 * 60000)[0].stale, true);
  assert.equal(signalColumns([row], signalTime + 45 * 60000)[0].stale, false);
  assert.match(signalColumns([row], signalTime + 46 * 60000)[0].label, /stale observation/);
  row.state = 'MERGED'; row.historical = true;
  const historical = signalColumns([row], signalTime + 999 * 60000)[0];
  assert.equal(historical.signals[0].tone, 'merged');
  assert.equal(historical.signals[2].tone, 'success');
  assert.match(historical.label, /historical/);
});
test('all known evidence states have textual labels and symbols, including missing evidence', () => {
  const row = signalRow();
  for (const state of ['success', 'failure', 'gated', 'pending', 'cancelled', 'unknown']) {
    row.ci.state = state;
    const signal = signalColumns([row], signalTime)[0].signals[2];
    assert.equal(signal.tone, state);
    assert.ok(signal.mark);
    assert.ok(signal.label.startsWith('CI: '));
  }
  row.activity.review = { state: 'unknown', currentHead: false };
  const signal = signalColumns([row], signalTime)[0].signals[1];
  assert.equal(signal.tone, 'unknown');
  assert.equal(signal.mark, '?');
  assert.match(signal.label, /unavailable/);
});
test('signal keyboard navigation uses rendered geometry and never wraps outside the filtered set', () => {
  assert.equal(signalNeighbor(1, 25, 25, 'ArrowRight'), 2);
  assert.equal(signalNeighbor(1, 25, 25, 'ArrowLeft'), 0);
  assert.equal(signalNeighbor(24, 25, 25, 'ArrowRight'), null);
  assert.equal(signalNeighbor(0, 25, 25, 'ArrowLeft'), null);
  assert.equal(signalNeighbor(4, 25, 6, 'ArrowDown'), 10);
  assert.equal(signalNeighbor(10, 25, 6, 'ArrowUp'), 4);
  assert.equal(signalNeighbor(10, 25, 25, 'Home'), 0);
  assert.equal(signalNeighbor(0, 25, 25, 'End'), 24);
  for (const key of ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp']) assert.equal(signalNeighbor(0, 1, 1, key), null);
  assert.equal(signalNeighbor(0, 0, 1, 'End'), null);
  assert.equal(signalNeighbor(0, 25, 25, 'Enter'), null);
});
