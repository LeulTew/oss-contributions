import { activityFeed, key, isStale, reviewLabel, CI_LABELS } from './model.mjs';

const paths = {
  branch: ['M7 4v11a4 4 0 0 0 4 4h6', 'M7 9h6a4 4 0 0 0 4-4V4', 'M5 2h4v4H5z', 'M15 2h4v4h-4z', 'M15 17h4v4h-4z'],
  activity: ['M3 12h4l3-7 4 14 3-7h4'],
  radar: ['M20 13a8 8 0 1 1-9-9', 'M16 4h4v4', 'M20 4l-8 8', 'M12 9a3 3 0 1 0 3 3'],
  review: ['M5 4h14v12H9l-4 4V4', 'M9 8h6', 'M9 12h4'],
  warning: ['M12 3 2 20h20L12 3Z', 'M12 9v5', 'M12 17h.01'],
  clock: ['M12 8v5l3 2', 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0'],
  chevron: ['m9 5 7 7-7 7'],
  back: ['m10 5-7 7 7 7', 'M3 12h18'],
  up: ['m6 14 6-6 6 6'],
  down: ['m6 10 6 6 6-6'],
  search: ['M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0', 'm15 15 6 6'],
  lock: ['M7 10V7a5 5 0 0 1 10 0v3', 'M5 10h14v11H5z', 'M12 14v3'],
  external: ['M14 3h7v7', 'm21 3-11 11', 'M10 3H3v18h18v-7'],
  quote: ['M3 13V8a4 4 0 0 1 4-4', 'M3 13h6v7H3z', 'M14 13V8a4 4 0 0 1 4-4', 'M14 13h6v7h-6z'],
  help: ['M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0', 'M9.5 8a2.5 2.5 0 1 1 4 2c-1.5.8-1.5 1.5-1.5 3', 'M12 16h.01'],
};
export function createIcon(name, documentRef = document) {
  if (!Object.hasOwn(paths, name)) throw new Error('Unknown interface icon.');
  const svg = documentRef.createElementNS('http://www.w3.org/2000/svg', 'svg');
  for (const [key, value] of Object.entries({ viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.7', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false', class: 'icon' })) svg.setAttribute(key, value);
  for (const d of paths[name]) {
    const path = documentRef.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d); svg.append(path);
  }
  return svg;
}
export function navigationPosition(rows, selectedKey, keyOf) {
  const index = rows.findIndex(row => keyOf(row) === selectedKey);
  return { index, total: rows.length, previous: index > 0 ? rows[index - 1] : null, next: index >= 0 && index + 1 < rows.length ? rows[index + 1] : null };
}
export function acceptsSearchShortcut(event, reading) {
  const target = event.target;
  return !reading && event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey &&
    !event.isComposing && !event.defaultPrevented && !target?.isContentEditable &&
    !['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName) &&
    !target?.closest?.('[role="combobox"], [role="textbox"]');
}
export function initialTheme(saved) {
  return ['light', 'dark', 'system'].includes(saved) ? saved : 'dark';
}
const reviewStates = Object.freeze({
  approved: ['Approval recorded', 'review-approved'],
  changes_requested: ['Changes requested', 'review-request'],
  none: ['No review decision', 'review-none'],
  unknown: ['Review unavailable', 'review-unknown'],
});
export function reviewPresentation(row) {
  const { state, currentHead } = row.activity.review;
  if (!Object.hasOwn(reviewStates, state)) throw new Error('Unknown review state.');
  const [label, className] = reviewStates[state];
  return { label, className, earlierHead: ['approved', 'changes_requested'].includes(state) && !currentHead };
}
export function signalColumns(rows, now = Date.now()) {
  return rows.map(row => {
    const review = row.activity.review;
    const earlier = ['approved', 'changes_requested'].includes(review.state) && !review.currentHead;
    const stale = isStale(row, now);
    const lifecycle = { OPEN: ['open', 'O'], MERGED: ['merged', 'M'], CLOSED: ['closed', 'X'] }[row.state];
    const reviewMark = { approved: '+', changes_requested: '!', none: '-', unknown: '?' }[review.state];
    const ciMark = { success: '+', failure: 'X', gated: '!', pending: '…', cancelled: '-', unknown: '?' }[row.ci.state];
    const signals = [
      { label: `PR: ${row.state.toLowerCase()}`, tone: lifecycle[0], mark: lifecycle[1] },
      { label: `Review: ${reviewLabel(row)}`, tone: review.state, mark: `${reviewMark}${earlier ? '~' : ''}` },
      { label: `CI: ${stale ? 'stale observation / ' : row.historical ? 'historical / ' : ''}${CI_LABELS[row.ci.state]}`, tone: row.ci.state, mark: ciMark },
    ];
    return { row, key: key(row), signals, stale, label: `${row.project} #${row.number}. ${signals.map(signal => signal.label).join('. ')}` };
  });
}
export function signalNeighbor(index, length, columns, pressedKey) {
  if (index < 0 || index >= length || columns < 1) return null;
  const destination = {
    ArrowLeft: index - 1, ArrowRight: index + 1, ArrowUp: index - columns,
    ArrowDown: index + columns, Home: 0, End: length - 1,
  }[pressedKey];
  return Number.isInteger(destination) && destination >= 0 && destination < length ? destination : null;
}
export function discussionPresentation(row, { kind = 'all', includeAutomation = false } = {}) {
  const available = activityFeed([row], { kind, excludeAutomation: false });
  const events = available.filter(({ event }) => includeAutomation || event.actor.classification !== 'automation');
  return {
    events,
    hiddenAutomation: available.length - events.length,
    baseline: row.activity.events.find(event => event.kind === 'head_update' && event.previousHeadSha === null) ?? null,
    emptyMessage: row.activity.state !== 'complete' ? 'Activity unavailable. Retained evidence is not a new confirmation.' :
      kind === 'updates' ? 'No branch or state changes in this view.' :
        includeAutomation ? 'No discussion or changes in this view.' : 'No non-automated discussion or changes in this view.',
  };
}
export function inspectionCaveat(row) {
  return key(row) === 'gin-gonic/gin#4836' && row.note.includes('four coverage-mode errors') ?
    'One inspected race job did not run its tests. Reported pass is not race-test proof.' : null;
}
