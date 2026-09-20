import test from 'node:test';
import assert from 'node:assert/strict';
import { navigationPosition, acceptsSearchShortcut, createIcon, initialTheme, discussionPresentation, inspectionCaveat } from '../site/ui.mjs';

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
test('first visit uses light even on a dark system, while all explicit choices survive', () => {
  assert.equal(initialTheme(null), 'light');
  assert.equal(initialTheme('invalid'), 'light');
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
