import test from 'node:test';
import assert from 'node:assert/strict';
import { navigationPosition, acceptsSearchShortcut, createIcon, initialTheme } from '../site/ui.mjs';

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
