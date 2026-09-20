import { CI_LABELS, validateCatalog, validateSnapshot, inboxRows, activityFeed, activityDate, reviewLabel, isStale, chooseSnapshot, reconcileDirect, freshnessMessage, key } from './model.mjs';
import { createLiveClient } from './live.mjs';
import { createIcon, navigationPosition, acceptsSearchShortcut, initialTheme, discussionPresentation, inspectionCaveat } from './ui.mjs';

const $ = id => document.getElementById(id);
const date = value => new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }) + ' UTC';
const shortDate = value => new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const node = (tag, content, className) => {
  const element = document.createElement(tag);
  if (content !== undefined) element.textContent = content;
  if (className) element.className = className;
  return element;
};
const link = (label, url, className) => {
  const element = node('a', label, className);
  element.href = url;
  return element;
};
const views = {
  all: ['All contributions', 'Select a contribution to inspect its review, checks and discussion.'],
  activity: ['Recent activity', 'Public discussion and observed changes. A comment is not automatically an author task.'],
  requests: ['Changes requested', 'Review states, not assigned tasks. Earlier-head requests stay labeled.'],
  failures: ['Check failures', 'Reported failures; context can qualify the cause.'],
  waiting: ['Waiting on CI approval', 'Upstream workflows require maintainer approval.'],
  open: ['Open contributions', 'Work still in review, including PRs with no current review or CI evidence.'],
  merged: ['Merged contributions', 'Completed upstream merges, with their dated historical observations.'],
  closed: ['Closed contributions', 'Closed without merging. Historical evidence is retained.'],
};
const actorLabels = { author: 'PR author', human: 'Verified human', automation: 'Automation', unknown: 'Unclassified account' };
const eventLabels = { comment: 'commented', review_comment: 'left an inline review comment', head_update: 'Head change observed', merged: 'PR merged', closed: 'PR closed' };
let data = null, catalog = null, liveClient = null, controller = null, directController = null;
let generation = 0, directGeneration = 0, selectedView = 'all', selectedKey = null;
let sourceWarning = '', storageWarning = '', timer = null;
let returnFocusKey = null, returnScroll = 0;
const directRows = new Map();
const directMessages = new Map();
const cacheKey = 'leultew-contributions-v2';
const currentRows = () => data?.contributions.map(row => directRows.get(key(row))?.row ?? row) ?? [];
const selectedRow = () => currentRows().find(row => key(row) === selectedKey);
const focusToken = () => document.activeElement?.dataset.focusKey;
function restoreFocus(token) {
  if (!token) return;
  const target = [...document.querySelectorAll('[data-focus-key]')].find(element => element.dataset.focusKey === token);
  if (target) target.focus({ preventScroll: true });
  else { $('results').tabIndex = -1; $('results').focus({ preventScroll: true }); }
}
function eventAction(event) {
  if (event.kind === 'head_update' && event.previousHeadSha === null) return 'Head first recorded';
  return event.kind === 'review' ? ({
    APPROVED: 'approved this contribution', CHANGES_REQUESTED: 'requested changes',
    COMMENTED: 'reviewed with comments', DISMISSED: 'review was dismissed',
  }[event.state] ?? 'submitted a review') : eventLabels[event.kind];
}
function renderFreshness() {
  if (!data) return;
  $('freshness').textContent = freshnessMessage(data);
  $('freshness').title = `Published ${date(data.fetchedAt)}`;
  const stale = currentRows().filter(row => isStale(row)).length;
  const missingActivity = currentRows().filter(row => row.activity.state !== 'complete').length;
  const warnings = [
    !navigator.onLine ? 'Offline. Showing last-good evidence.' : '',
    sourceWarning,
    stale ? `${stale} stale CI/PR observations. Check the original PR for current evidence.` : '',
    missingActivity ? `${missingActivity} activity histories unavailable; empty counts are not an all-clear.` : '',
    storageWarning,
  ].filter(Boolean);
  $('data-warning').textContent = warnings.join(' ');
  $('data-warning').hidden = !warnings.length;
  $('refresh-context').textContent = `Snapshot published ${date(data.fetchedAt)}. ${warnings.join(' ')}`;
  $('refresh-context').hidden = false;
}
function filteredRows() {
  return inboxRows(currentRows(), { search: $('search').value, ci: $('ci-filter').value, sort: $('sort').value, view: selectedView });
}
function selectContribution(row, { focus = true } = {}) {
  if (!document.body.classList.contains('reading')) {
    returnFocusKey = focusToken() ?? `row:${key(row)}`;
    returnScroll = window.scrollY;
  }
  if (selectedKey !== key(row) && directController) {
    directController.abort();
    directMessages.set(selectedKey, 'Direct check canceled on selection change. Last-good evidence retained.');
    directController = null;
    ++directGeneration;
  }
  selectedKey = key(row);
  const url = new URL(location.href);
  url.searchParams.set('pr', selectedKey);
  history.replaceState(null, '', url);
  document.querySelector('.inbox-shell').classList.add('detail-open');
  document.body.classList.add('reading');
  renderRows();
  renderDetail();
  if (focus) {
    const heading = $('detail-header').querySelector('h2');
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }
}
function itemButton(row, event = null) {
  const item = node('li', undefined, `inbox-item${event ? ' feed-item' : ''}`);
  const button = node('button');
  button.type = 'button';
  button.dataset.focusKey = event ? `event:${key(row)}:${event.id}` : `row:${key(row)}`;
  button.dataset.key = key(row);
  button.setAttribute('aria-pressed', String(key(row) === selectedKey));
  button.setAttribute('aria-controls', 'detail');
  const content = node('div', undefined, 'item-content');
  const project = node('span', row.project, 'item-project');
  project.append(node('span', `#${row.number}`, 'item-number'));
  const time = node('time', shortDate(event?.updatedAt ?? new Date(activityDate(row))), 'item-date');
  time.dateTime = event?.updatedAt ?? row.updatedAt;
  time.title = date(time.dateTime);
  const recency = node('div', undefined, 'item-recency');
  recency.append(time);
  const bottom = node('div', undefined, 'item-bottom');
  bottom.append(node('span', row.state[0] + row.state.slice(1).toLowerCase(), `state state-${row.state.toLowerCase()}`));
  if (event) bottom.append(node('span', `${event.actor.login} / ${actorLabels[event.actor.classification]}`, 'signal'));
  else {
    bottom.append(node('span', CI_LABELS[row.ci.state], `signal ci-${row.ci.state}`));
    if (row.activity.review.state === 'changes_requested') bottom.append(node('span',
      row.activity.review.currentHead ? 'Changes requested' : 'Changes requested / earlier head', 'signal review-request'));
    if (isStale(row)) bottom.append(node('span', 'Stale', 'signal stale'));
    const count = activityFeed([row]).length;
    if (count) {
      const eventCount = node('span', undefined, 'event-count');
      eventCount.append(createIcon('review'), node('span', `${count} event${count === 1 ? '' : 's'}`));
      recency.append(eventCount);
    }
  }
  content.append(project, node('p', event ? `${eventAction(event)}${event.body ? `: ${event.body}` : ''}` : row.summary, 'item-summary'));
  button.append(content, bottom, recency);
  button.addEventListener('click', () => selectContribution(row));
  item.append(button);
  return item;
}
function renderRows() {
  if (!data) return;
  const token = focusToken();
  const filtered = filteredRows();
  if (selectedKey && !filtered.some(row => key(row) === selectedKey)) {
    directController?.abort();
    directController = null;
    ++directGeneration;
    selectedKey = null;
    const url = new URL(location.href);
    url.searchParams.delete('pr');
    history.replaceState(null, '', url);
    document.querySelector('.inbox-shell').classList.remove('detail-open');
    document.body.classList.remove('reading');
    renderDetail();
  }
  const feedMode = selectedView === 'activity';
  document.querySelector('.collection-columns').hidden = feedMode;
  const feed = feedMode ? activityFeed(filtered, { excludeAutomation: !$('feed-bots').checked }) : [];
  $('rows').replaceChildren(...(feedMode ? feed.map(({ row, event }) => itemButton(row, event)) : filtered.map(row => itemButton(row))));
  const count = feedMode ? feed.length : filtered.length;
  $('rows').hidden = !count;
  $('empty').hidden = !!count;
  $('feed-controls').hidden = !feedMode;
  $('results').textContent = feedMode ? `${feed.length} events` : `${filtered.length} of ${data.contributions.length}`;
  $('view-heading').textContent = views[selectedView][0];
  $('view-description').textContent = views[selectedView][1];
  $('view-description').hidden = !['requests', 'failures', 'waiting'].includes(selectedView);
  $('empty-heading').textContent = selectedView === 'requests' && !$('search').value ? 'No changes-requested reviews recorded' : feedMode ? 'No matching activity recorded' : 'No matching contributions';
  $('empty-copy').textContent = selectedView === 'requests' ? 'Stale or unavailable evidence is not an all-clear.' :
    feedMode ? 'Include automation or inspect a PR.' : 'Try another search or reset filters.';
  document.querySelectorAll('[data-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === selectedView)));
  restoreFocus(token);
}
function renderDetail() {
  const row = selectedRow();
  $('detail-empty').hidden = !!row;
  $('detail-content').hidden = !row;
  if (!row) return;
  const token = focusToken();
  const contextElement = document.querySelector('.context-box');
  const savedContext = contextElement.dataset.key === selectedKey && contextElement.open;
  contextElement.dataset.key = selectedKey;
  const direct = directRows.get(selectedKey);
  const position = navigationPosition(filteredRows(), selectedKey, key);
  $('detail-position').textContent = `${position.index + 1} of ${position.total}`;
  $('previous-pr').disabled = !position.previous;
  $('next-pr').disabled = !position.next;
  $('detail-github').href = row.url;
  const meta = node('div', undefined, 'detail-meta');
  meta.append(node('span', `${row.owner}/${row.repo} #${row.number}`, 'repo-path'),
    node('span', row.state[0] + row.state.slice(1).toLowerCase(), `state state-${row.state.toLowerCase()}`));
  if (row.draft) meta.append(node('span', 'Draft'));
  const heading = node('h2', row.title);
  heading.tabIndex = -1;
  heading.dataset.focusKey = `heading:${key(row)}`;
  $('detail-header').replaceChildren(heading, meta);
  const review = node('dl');
  const reviewText = row.activity.review.state === 'none' ? 'No decision recorded' : reviewLabel(row);
  review.append(node('dt', 'Review'), node('dd', reviewText, `signal ${row.activity.review.state === 'changes_requested' ? 'review-request' : ''}`));
  const ci = node('dl');
  ci.append(node('dt', 'CI'), node('dd', `${isStale(row) ? 'Stale / ' : row.historical ? 'Historical / ' : ''}${CI_LABELS[row.ci.state]}`, `signal ci-${row.ci.state}`));
  $('detail-signals').replaceChildren(review, ci);
  $('observation-times').textContent = `Discussion: ${row.activity.checkedAt ? date(row.activity.checkedAt) : 'unavailable'} · CI: ${date(row.checkedAt)}`;
  const caveat = inspectionCaveat(row);
  $('qualified-caveat').textContent = caveat ? `${caveat} Inspection: ${shortDate(row.noteAsOf)}.` : '';
  $('qualified-caveat').hidden = !caveat;
  const directStatus = directMessages.get(selectedKey) ?? (direct ?
    `${direct.cached ? 'Cached discussion.' : 'Discussion refreshed.'} CI unchanged.` : '');
  $('direct-status').textContent = [directStatus, liveClient?.warning].filter(Boolean).join(' ');
  $('direct-status').hidden = !$('direct-status').textContent;
  $('refresh-selected').disabled = !!directController && !directController.signal.aborted;
  const context = [node('p', row.summary)];
  if (row.note) context.push(node('p', `${row.note} Context recorded ${date(row.noteAsOf)}.`));
  context.push(node('p', `${row.ci.summary} Head: ${row.headSha}. Opened: ${date(row.createdAt)}. PR updated: ${date(row.updatedAt)}.${row.mergedAt ? ` Merged: ${date(row.mergedAt)}.` : ''}`));
  const { baseline } = discussionPresentation(row);
  if (baseline) context.push(node('p', `First recorded head: ${baseline.headSha.slice(0, 8)} (${date(baseline.date)}). Baseline metadata, not an observed change.`));
  if (row.ci.counts) context.push(node('p', `Reported CI signals (may overlap): ${Object.entries(row.ci.counts).map(([name, value]) => `${value} ${name}`).join(', ')}. These are not counts of unique executed tests.`));
  if (row.error) context.push(node('p', `Collection issue: ${row.error}`));
  context.push(link('Open original PR and checks', row.url));
  $('detail-context').replaceChildren(...context);
  document.querySelector('.context-box').open = savedContext;
  $('open-context').setAttribute('aria-expanded', String(savedContext));
  renderActivity(row);
  restoreFocus(token);
}
function renderActivity(row = selectedRow()) {
  if (!row) return;
  const { events, hiddenAutomation, emptyMessage } = discussionPresentation(row, { includeAutomation: $('include-bots').checked, kind: $('activity-kind').value });
  const activity = row.activity;
  $('activity-count').textContent = events.length;
  $('activity-status').textContent = [
    activity.state !== 'complete' ? `Activity unavailable${activity.error ? ` (${activity.error})` : ''}. Retained evidence only.` : '',
    events.length && hiddenAutomation ? `${hiddenAutomation} automated events hidden.` : '',
  ].filter(Boolean).join(' ');
  $('activity-status').hidden = !$('activity-status').textContent;
  const rendered = events.map(({ event }) => {
    const item = node('li', undefined, 'activity-event');
    const heading = node('div', undefined, 'event-heading');
    const observed = event.kind === 'head_update';
    const actor = node('strong', observed ? 'Dashboard observation' : event.actor.login);
    if (!observed) actor.append(node('span', actorLabels[event.actor.classification], 'actor-label'));
    const time = node('time', date(event.date));
    time.dateTime = event.date;
    heading.append(actor, time);
    const action = `${eventAction(event)}${event.kind === 'review' && event.headSha && event.headSha !== row.headSha ? ' / earlier head' : ''}${event.date !== event.updatedAt ? ` / edited ${date(event.updatedAt)}` : ''}`;
    item.append(heading, node('p', action, 'event-action'));
    if (event.body) {
      if (event.body.length > 900) {
        item.append(node('p', `${event.body.slice(0, 380)}...`, 'event-body'));
        const full = node('details', undefined, 'event-full');
        full.append(node('summary', 'Read full message'), node('p', event.body, 'event-body'));
        item.append(full);
      } else item.append(node('p', event.body, 'event-body'));
    }
    if (observed) item.append(node('p', event.previousHeadSha ?
      `Observed ${event.previousHeadSha.slice(0, 8)} → ${event.headSha.slice(0, 8)}. This is an observation time, not a claimed push time.` :
      `First recorded head: ${event.headSha.slice(0, 8)}. This establishes a baseline; it does not mean the branch changed at this time.`, 'event-body'));
    const source = link('Original source \u2197', event.url, 'event-source');
    source.dataset.focusKey = `source:${key(row)}:${event.id}`;
    item.append(source);
    return item;
  });
  if (!rendered.length) {
    const empty = node('li', undefined, 'activity-empty');
    empty.append(node('p', emptyMessage));
    if (hiddenAutomation) {
      const show = node('button', `Show ${hiddenAutomation} automated event${hiddenAutomation === 1 ? '' : 's'}`);
      show.type = 'button';
      show.id = 'show-automation';
      show.addEventListener('click', () => {
        $('include-bots').checked = true;
        renderActivity();
        $('include-bots').focus();
      });
      empty.append(show);
    }
    rendered.push(empty);
  }
  $('activity-list').replaceChildren(...rendered);
}
function render() {
  const token = focusToken();
  const rows = currentRows();
  $('overview').textContent = `${new Set(rows.map(row => `${row.owner}/${row.repo}`)).size} repositories`;
  for (const element of document.querySelectorAll('[data-count]')) element.textContent = inboxRows(rows, { view: element.dataset.count }).length;
  $('loading').hidden = true;
  $('unavailable').hidden = true;
  $('quotes').replaceChildren(...data.quotes.map(quote => {
    const figure = node('figure', undefined, 'quote');
    const block = node('blockquote', quote.body); block.cite = quote.source;
    const caption = node('figcaption');
    const source = link('Original review \u2197', quote.source); source.dataset.focusKey = `quote:${quote.source}`;
    caption.append(node('strong', quote.author), node('span', `${quote.role} / ${quote.project}`), node('br'), node('span', shortDate(quote.date)), node('br'), source);
    figure.append(block, caption);
    return figure;
  }));
  if (!data.quotes.length) $('quotes').append(node('p', 'No source-verified quotation is available.'));
  if (!selectedKey) {
    const requested = new URL(location.href).searchParams.get('pr');
    if (rows.some(row => key(row) === requested)) {
      selectedKey = requested;
      document.querySelector('.inbox-shell').classList.add('detail-open');
      document.body.classList.add('reading');
      returnFocusKey = `row:${requested}`;
    }
  }
  renderRows(); renderDetail(); renderFreshness(); restoreFocus(token);
}
async function getJSON(path, signal) {
  const response = await fetch(new URL(path, import.meta.url), { cache: 'no-store', signal, credentials: 'omit', redirect: 'error' });
  if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error('Published data request failed.');
  return response.json();
}
function loadCache() {
  try {
    const raw = localStorage.getItem(cacheKey) ?? localStorage.getItem('leultew-contributions-v1');
    if (raw) return validateSnapshot(JSON.parse(raw), catalog);
  } catch { storageWarning = 'Saved browser data is unavailable or invalid; using published evidence instead.'; }
  return null;
}
async function refresh() {
  controller?.abort();
  controller = new AbortController();
  const ownController = controller;
  const thisGeneration = ++generation;
  const timeout = setTimeout(() => ownController.abort(), 20000);
  $('refresh').disabled = true;
  $('refresh').textContent = 'Reloading...';
  try {
    if (!catalog) { catalog = validateCatalog(await getJSON('./catalog.json', ownController.signal)); liveClient = createLiveClient({ catalog }); }
    if (!data) { data = loadCache(); if (data) { sourceWarning = 'Showing saved data while checking the published snapshot.'; render(); } }
    const incoming = validateSnapshot(await getJSON('./data.json', ownController.signal), catalog);
    if (thisGeneration !== generation) return;
    data = chooseSnapshot(data, incoming);
    for (const row of data.contributions) {
      const supplement = directRows.get(key(row));
      const reconciled = reconcileDirect(row, supplement);
      if (reconciled) directRows.set(key(row), reconciled);
      else if (supplement) { directRows.delete(key(row)); directMessages.delete(key(row)); }
    }
    sourceWarning = '';
    try { localStorage.setItem(cacheKey, JSON.stringify(data)); }
    catch { storageWarning = 'Browser storage unavailable. Last-good evidence is retained in this tab only.'; }
    render();
  } catch {
    if (thisGeneration !== generation || document.hidden) return;
    sourceWarning = 'Snapshot reload failed. Last-good evidence is retained. Retry or open the original source.';
    if (!data && catalog) {
      try { data = validateSnapshot(await getJSON('./fallback.json', AbortSignal.timeout(10000)), catalog); sourceWarning = 'Latest snapshot request failed. Showing the bundled deployment snapshot.'; }
      catch { sourceWarning = 'Neither the latest snapshot nor its bundled fallback is available. No statuses are inferred.'; }
    }
    if (data) render();
    else {
      $('loading').hidden = true; $('unavailable').hidden = false;
      $('freshness').textContent = 'Unable to load verified data'; $('results').textContent = 'No snapshot loaded';
      $('data-warning').textContent = sourceWarning; $('data-warning').hidden = false;
    }
  } finally {
    clearTimeout(timeout);
    if (thisGeneration === generation) { $('refresh').disabled = false; $('refresh').textContent = 'Reload'; }
  }
}
async function refreshSelected() {
  const row = selectedRow();
  if (!row || !liveClient) return;
  directController?.abort();
  const ownController = new AbortController();
  directController = ownController;
  const attempt = ++directGeneration;
  const rowKey = key(row);
  directMessages.set(rowKey, 'Checking discussion. CI is unchanged.');
  renderDetail();
  try {
    const result = await liveClient.refresh(catalog.find(entry => key(entry) === rowKey), row, { signal: ownController.signal });
    if (attempt !== directGeneration) return;
    const reconciled = reconcileDirect(data.contributions.find(entry => key(entry) === rowKey), result);
    if (reconciled) {
      directRows.set(rowKey, reconciled);
      directMessages.set(rowKey, `${result.cached ? 'Cached discussion.' : 'Discussion refreshed.'} CI unchanged.`);
    } else {
      directRows.delete(rowKey);
      directMessages.set(rowKey, 'Direct check completed; newer published evidence is retained.');
    }
  } catch (error) {
    if (attempt !== directGeneration) return;
    directMessages.set(rowKey, ownController.signal.aborted ? 'Direct check canceled. Last-good evidence retained.' :
      `Direct check unavailable: ${error.message}. Last-good evidence retained; open GitHub or retry later.`);
  } finally {
    if (attempt === directGeneration) { directController = null; render(); }
  }
}
function clearFilters() { $('filters').reset(); selectedView = 'all'; renderRows(); }
$('filters').addEventListener('submit', event => event.preventDefault());
for (const [id, event] of [['search', 'input'], ['ci-filter', 'change'], ['sort', 'change'], ['feed-bots', 'change']]) $(id).addEventListener(event, renderRows);
document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => {
  selectedView = button.dataset.view;
  document.querySelector('.inbox-shell').classList.remove('detail-open');
  document.body.classList.remove('reading');
  renderRows();
}));
$('clear').addEventListener('click', clearFilters);
$('empty-clear').addEventListener('click', () => { clearFilters(); $('search').focus(); });
$('refresh').addEventListener('click', refresh);
$('refresh-selected').addEventListener('click', refreshSelected);
$('include-bots').addEventListener('change', () => renderActivity());
$('activity-kind').addEventListener('change', () => renderActivity());
$('open-context').addEventListener('click', () => {
  const context = document.querySelector('.context-box');
  context.open = !context.open;
  if (context.open) context.querySelector('summary').focus();
});
document.querySelector('.context-box').addEventListener('toggle', event => {
  $('open-context').setAttribute('aria-expanded', String(event.target.open));
  if (!event.target.open && event.target.contains(document.activeElement)) $('open-context').focus();
});
document.querySelectorAll('[data-panel]').forEach(link => link.addEventListener('click', event => {
  event.preventDefault();
  if (link.dataset.panel === 'feedback' && document.body.classList.contains('reading')) returnToList();
  const panel = $(link.dataset.panel);
  panel.open = true;
  panel.querySelector('summary').focus();
  panel.scrollIntoView({ block: 'start' });
}));
function returnToList() {
  directController?.abort(); ++directGeneration; directController = null;
  document.querySelector('.inbox-shell').classList.remove('detail-open');
  document.body.classList.remove('reading');
  const url = new URL(location.href); url.searchParams.delete('pr');
  history.replaceState(null, '', url);
  renderRows();
  restoreFocus(returnFocusKey ?? `row:${selectedKey}`);
  window.scrollTo(0, returnScroll);
}
$('back-to-list').addEventListener('click', returnToList);
for (const [id, direction] of [['previous-pr', 'previous'], ['next-pr', 'next']]) $(id).addEventListener('click', () => {
  const target = navigationPosition(filteredRows(), selectedKey, key)[direction];
  if (target) selectContribution(target);
});
document.addEventListener('keydown', event => {
  if (acceptsSearchShortcut(event, document.body.classList.contains('reading'))) {
    event.preventDefault(); $('search').focus();
  } else if (event.key === 'Escape' && document.body.classList.contains('reading') &&
      !['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target?.tagName)) {
    returnToList();
  }
});
for (const element of document.querySelectorAll('[data-icon]')) element.append(createIcon(element.dataset.icon));
let theme = initialTheme(null);
try { theme = initialTheme(localStorage.getItem('contribution-theme')); } catch { /* Light mode remains usable without storage. */ }
function applyTheme() {
  document.documentElement.dataset.theme = theme;
  $('theme').textContent = `Theme: ${theme}`;
}
applyTheme();
$('theme').addEventListener('click', () => {
  theme = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light'; applyTheme();
  try { localStorage.setItem('contribution-theme', theme); } catch { $('theme').textContent += ' (this tab)'; }
});
function schedule() { clearInterval(timer); if (!document.hidden) timer = setInterval(refresh, 5 * 60000); }
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { controller?.abort(); directController?.abort(); }
  else { renderFreshness(); refresh(); }
  schedule();
});
window.addEventListener('offline', renderFreshness);
window.addEventListener('online', refresh);
setInterval(() => { if (!document.hidden) renderFreshness(); }, 60000);
schedule();
refresh();
