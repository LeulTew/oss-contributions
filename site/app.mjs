import { CI_LABELS, validateCatalog, validateSnapshot, counts, inboxRows, activityFeed, activityDate, reviewLabel, isStale, chooseSnapshot, freshnessMessage, key } from './model.mjs';
import { createLiveClient } from './live.mjs';

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
  requests: ['Changes requested', 'Explicit review states, not assigned tasks. Read who the request addresses; earlier-head requests remain labeled.'],
  failures: ['Check failures', 'Reported CI failures, not inferred code defects. Read the qualified context before acting.'],
  waiting: ['Waiting on CI approval', 'Upstream workflows need maintainer action. This dashboard cannot approve or rerun them.'],
  open: ['Open contributions', 'Work still in review, including PRs with no current review or CI evidence.'],
  merged: ['Merged contributions', 'Completed upstream merges, with their dated historical observations.'],
  closed: ['Closed contributions', 'Closed without merging. Historical evidence is retained.'],
};
const actorLabels = { author: 'PR author', human: 'Verified human', automation: 'Automation', unknown: 'Unclassified account' };
const eventLabels = { comment: 'commented', review_comment: 'left an inline review comment', head_update: 'Head change observed', merged: 'PR merged', closed: 'PR closed' };
let data = null, catalog = null, liveClient = null, controller = null, directController = null;
let generation = 0, directGeneration = 0, selectedView = 'all', selectedKey = null;
let sourceWarning = '', storageWarning = '', timer = null;
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
  $('freshness').textContent = `${freshnessMessage(data)} / ${date(data.fetchedAt)}`;
  const stale = currentRows().filter(row => isStale(row)).length;
  const missingActivity = currentRows().filter(row => row.activity.state !== 'complete').length;
  const warnings = [
    !navigator.onLine ? 'Offline. Showing last-good evidence; reconnect to check for changes.' : '',
    sourceWarning,
    stale ? `${stale} CI/PR observations are stale. Recorded states are not current confirmations.` : '',
    missingActivity ? `${missingActivity} contributions have unavailable or retained activity evidence; empty request counts are not an all-clear.` : '',
    Date.now() - Date.parse(data.fetchedAt) > 45 * 60000 ? 'The shared snapshot is over 45 minutes old. Check a selected PR directly or open GitHub.' : '',
    storageWarning,
  ].filter(Boolean);
  $('data-warning').textContent = warnings.join(' ');
  $('data-warning').hidden = !warnings.length;
}
function filteredRows() {
  return inboxRows(currentRows(), { search: $('search').value, ci: $('ci-filter').value, sort: $('sort').value, view: selectedView });
}
function selectContribution(row, { focus = true } = {}) {
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
  renderRows();
  renderDetail();
  if (focus) {
    const heading = $('detail-header').querySelector('h2');
    heading.tabIndex = -1;
    heading.focus({ preventScroll: !matchMedia('(max-width: 700px)').matches });
  }
}
function itemButton(row, event = null) {
  const item = node('li', undefined, `inbox-item${event ? ' feed-item' : ''}`);
  const button = node('button');
  button.type = 'button';
  button.dataset.focusKey = event ? `event:${key(row)}:${event.id}` : `row:${key(row)}`;
  button.dataset.key = key(row);
  button.setAttribute('aria-pressed', String(key(row) === selectedKey));
  const top = node('div', undefined, 'item-top');
  const project = node('span', row.project, 'item-project');
  project.append(node('span', `#${row.number}`, 'item-number'));
  const time = node('time', shortDate(event?.updatedAt ?? new Date(activityDate(row))), 'item-date');
  time.dateTime = event?.updatedAt ?? row.updatedAt;
  time.title = date(time.dateTime);
  top.append(project, time);
  const bottom = node('div', undefined, 'item-bottom');
  bottom.append(node('span', row.state[0] + row.state.slice(1).toLowerCase(), `state state-${row.state.toLowerCase()}`));
  if (event) bottom.append(node('span', `${event.actor.login} / ${actorLabels[event.actor.classification]}`, 'signal'));
  else {
    bottom.append(node('span', CI_LABELS[row.ci.state], `signal ci-${row.ci.state}`));
    if (row.activity.review.state === 'changes_requested') bottom.append(node('span',
      row.activity.review.currentHead ? 'Changes requested' : 'Changes requested / earlier head', 'signal review-request'));
    if (isStale(row)) bottom.append(node('span', 'Stale', 'signal stale'));
    const count = activityFeed([row]).length;
    if (count) bottom.append(node('span', `${count} event${count === 1 ? '' : 's'}`, 'event-count'));
  }
  button.append(top, node('p', event ? `${eventAction(event)}${event.body ? `: ${event.body}` : ''}` : row.summary, 'item-summary'), bottom);
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
    renderDetail();
  }
  const feedMode = selectedView === 'activity';
  const feed = feedMode ? activityFeed(filtered, { excludeAutomation: !$('feed-bots').checked }) : [];
  $('rows').replaceChildren(...(feedMode ? feed.map(({ row, event }) => itemButton(row, event)) : filtered.map(row => itemButton(row))));
  const count = feedMode ? feed.length : filtered.length;
  $('rows').hidden = !count;
  $('empty').hidden = !!count;
  $('feed-controls').hidden = !feedMode;
  $('results').textContent = feedMode ? `${feed.length} events` : `${filtered.length} of ${data.contributions.length}`;
  $('view-heading').textContent = views[selectedView][0];
  $('view-description').textContent = views[selectedView][1];
  $('empty-heading').textContent = selectedView === 'requests' && !$('search').value ? 'No changes-requested reviews recorded' : feedMode ? 'No matching activity recorded' : 'No matching contributions';
  $('empty-copy').textContent = selectedView === 'requests' ? 'This is the latest available evidence, not a guarantee that no follow-up is needed. Stale or unavailable observations remain flagged.' :
    feedMode ? 'Try including automation, or inspect a contribution for its activity availability.' : 'Try another query or reset these filters.';
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
  $('detail-position').textContent = `${row.project} / #${row.number}`;
  $('detail-github').href = row.url;
  const meta = node('div', undefined, 'detail-meta');
  meta.append(node('span', row.state[0] + row.state.slice(1).toLowerCase(), `state state-${row.state.toLowerCase()}`),
    node('span', `Opened ${shortDate(row.createdAt)}`), node('span', row.mergedAt ? `Merged ${shortDate(row.mergedAt)}` : `PR updated ${shortDate(row.updatedAt)}`));
  if (row.draft) meta.append(node('span', 'Draft'));
  $('detail-header').replaceChildren(node('p', `${row.owner}/${row.repo} #${row.number}`, 'repo-path'),
    node('h2', row.title), node('p', row.summary, 'detail-summary'), meta);
  const review = node('dl');
  review.append(node('dt', 'Review'), node('dd', reviewLabel(row), row.activity.review.state === 'changes_requested' ? 'review-request' : ''));
  review.lastChild.append(node('small', row.activity.checkedAt ? `Observed ${date(row.activity.checkedAt)}` : 'No activity observation available'));
  const ci = node('dl');
  ci.append(node('dt', 'CI evidence'), node('dd', CI_LABELS[row.ci.state], `ci-${row.ci.state}`));
  ci.lastChild.append(node('small', `${isStale(row) ? 'Stale / ' : row.historical ? 'Historical / ' : ''}${date(row.checkedAt)}`));
  $('detail-signals').replaceChildren(review, ci);
  const directStatus = directMessages.get(selectedKey) ?? (direct ?
    `PR and discussion checked ${date(direct.checkedAt)}. ${direct.cached ? 'Short-lived browser cache. ' : ''}CI observation time is unchanged.` : 'No sign-in or token. Subject to anonymous API limits.');
  $('direct-status').textContent = [directStatus, liveClient?.warning].filter(Boolean).join(' ');
  $('refresh-selected').disabled = !!directController && !directController.signal.aborted;
  const context = [node('p', `${row.note} Context recorded ${date(row.noteAsOf)}.`),
    node('p', `${row.ci.summary} Head: ${row.headSha}. Scheduled CI observation: ${date(row.checkedAt)}. PR updated: ${date(row.updatedAt)}.`)];
  if (row.ci.counts) context.push(node('p', `Reported CI signals (may overlap): ${Object.entries(row.ci.counts).map(([name, value]) => `${value} ${name}`).join(', ')}. These are not counts of unique executed tests.`));
  if (row.error) context.push(node('p', `Collection issue: ${row.error}`));
  context.push(link('Open original PR and checks', row.url));
  $('detail-context').replaceChildren(...context);
  document.querySelector('.context-box').open = savedContext;
  renderActivity(row);
  restoreFocus(token);
}
function renderActivity(row = selectedRow()) {
  if (!row) return;
  const events = activityFeed([row], { excludeAutomation: !$('include-bots').checked, kind: $('activity-kind').value, includeBaselines: true });
  const activity = row.activity;
  const hiddenBots = activity.events.filter(event => event.actor.classification === 'automation').length;
  $('activity-count').textContent = `${events.length} shown`;
  $('activity-status').textContent = [
    activity.state !== 'complete' ? `Activity unavailable${activity.error ? ` (${activity.error})` : ''}. Retained events, if any, are not a new confirmation.` :
      `Discussion observed ${date(activity.checkedAt)}.`,
    !$('include-bots').checked && hiddenBots ? `${hiddenBots} automated events hidden.` : '',
    'Unclassified accounts are not assumed human. Comments alone do not create tasks.',
  ].filter(Boolean).join(' ');
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
  if (!rendered.length) rendered.push(node('li', activity.state === 'complete' ? 'No activity matches this filter.' : 'No complete activity history is available in this observation.', 'activity-event event-body'));
  $('activity-list').replaceChildren(...rendered);
}
function render() {
  const token = focusToken();
  const rows = currentRows();
  const totals = counts(rows);
  $('overview').textContent = `${totals.ALL} selected PRs / ${new Set(rows.map(row => `${row.owner}/${row.repo}`)).size} repositories / ${totals.OPEN} open / ${totals.MERGED} merged`;
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
    if (rows.some(row => key(row) === requested)) { selectedKey = requested; document.querySelector('.inbox-shell').classList.add('detail-open'); }
    else if (!matchMedia('(max-width: 700px)').matches) selectedKey = key(inboxRows(rows, { sort: 'activity' })[0]);
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
  $('refresh').textContent = 'Checking snapshot...';
  try {
    if (!catalog) { catalog = validateCatalog(await getJSON('./catalog.json', ownController.signal)); liveClient = createLiveClient({ catalog }); }
    if (!data) { data = loadCache(); if (data) { sourceWarning = 'Showing saved data while checking the published snapshot.'; render(); } }
    const incoming = validateSnapshot(await getJSON('./data.json', ownController.signal), catalog);
    if (thisGeneration !== generation) return;
    data = chooseSnapshot(data, incoming);
    for (const row of data.contributions) {
      const supplement = directRows.get(key(row));
      if (supplement && (Date.parse(row.checkedAt) >= Date.parse(supplement.checkedAt) ||
          Date.parse(row.updatedAt) > Date.parse(supplement.row.updatedAt))) { directRows.delete(key(row)); directMessages.delete(key(row)); }
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
    if (thisGeneration === generation) { $('refresh').disabled = false; $('refresh').textContent = 'Reload snapshot'; }
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
  directMessages.set(rowKey, 'Checking this public PR and its discussion. Scheduled CI is not refreshed.');
  renderDetail();
  try {
    const result = await liveClient.refresh(catalog.find(entry => key(entry) === rowKey), row, { signal: ownController.signal });
    if (attempt !== directGeneration) return;
    directRows.set(rowKey, result);
    directMessages.set(rowKey, `PR and discussion checked ${date(result.checkedAt)}. ${result.cached ? 'Short-lived cache. ' : ''}CI retains its scheduled observation time.`);
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
  selectedView = button.dataset.view; document.querySelector('.inbox-shell').classList.remove('detail-open'); renderRows();
}));
$('clear').addEventListener('click', clearFilters);
$('empty-clear').addEventListener('click', () => { clearFilters(); $('search').focus(); });
$('refresh').addEventListener('click', refresh);
$('refresh-selected').addEventListener('click', refreshSelected);
$('include-bots').addEventListener('change', () => renderActivity());
$('activity-kind').addEventListener('change', () => renderActivity());
$('back-to-list').addEventListener('click', () => {
  directController?.abort(); ++directGeneration; directController = null;
  document.querySelector('.inbox-shell').classList.remove('detail-open');
  const url = new URL(location.href); url.searchParams.delete('pr'); history.replaceState(null, '', url);
  restoreFocus(`row:${selectedKey}`);
});
let theme = 'system';
try { const saved = localStorage.getItem('contribution-theme'); if (['light', 'dark'].includes(saved)) theme = saved; } catch { /* System theme remains usable without storage. */ }
function applyTheme() {
  if (theme === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
  $('theme').textContent = `Theme: ${theme}`;
}
applyTheme();
$('theme').addEventListener('click', () => {
  theme = theme === 'system' ? 'dark' : theme === 'dark' ? 'light' : 'system'; applyTheme();
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
