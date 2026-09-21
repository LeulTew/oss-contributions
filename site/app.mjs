import { CI_LABELS, validateCatalog, validateSnapshot, inboxRows, activityFeed, activityDate, isStale, chooseSnapshot, reconcileDirect, freshnessMessage, key } from './model.mjs';
import { createLiveClient } from './live.mjs';
import { createIcon, navigationPosition, acceptsSearchShortcut, initialTheme, discussionPresentation, inspectionCaveat, reviewPresentation } from './ui.mjs';
import { DEFAULT_ROUTE, readRoute, routeQuery, workspaceFeed } from './workspace.mjs';

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
let route = readRoute(location.search);
let generation = 0, directGeneration = 0, selectedView = route.view, selectedKey = route.pr;
let sourceWarning = '', storageWarning = '', timer = null;
let returnFocusKey = null, returnScroll = 0;
history.scrollRestoration = 'manual';
const directRows = new Map();
const directMessages = new Map();
let markdownModule;
const cacheKey = 'leultew-contributions-v2';
const currentRows = () => data?.contributions.map(row => directRows.get(key(row))?.row ?? row) ?? [];
const selectedRow = () => currentRows().find(row => key(row) === selectedKey);
const focusToken = () => document.activeElement?.dataset.focusKey;
export function formatMessage(element, body, source) {
  element.append(node('p', 'Formatting message...'));
  markdownModule ??= import('./markdown.mjs');
  return markdownModule.then(({ renderMarkdown }) => {
    if (element.isConnected) element.replaceChildren(renderMarkdown(body, source));
  }).catch(error => {
    if (!element.isConnected) return;
    element.replaceChildren(node('p', 'Message formatting unavailable. Read the original text below or reload the page to retry.'));
    console.error('Public message formatting failed:', error);
  });
}
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
    stale ? `${stale} stale PR/CI observations. Open GitHub for current evidence.` : '',
    missingActivity ? `${missingActivity} activity histories unavailable; empty counts are not an all-clear.` : '',
    storageWarning,
  ].filter(Boolean);
  $('data-warning').textContent = warnings.join(' ');
  $('data-warning').hidden = !warnings.length;
  $('data-warning').classList.toggle('warning', !!sourceWarning || !navigator.onLine || missingActivity > 0);
  $('refresh-context').textContent = `Snapshot published ${date(data.fetchedAt)}. ${warnings.join(' ')}`;
  $('refresh-context').hidden = false;
  for (const element of document.querySelectorAll('[data-age-key]')) {
    const row = currentRows().find(row => key(row) === element.dataset.ageKey);
    element.hidden = !row || !isStale(row);
  }
}
function filteredRows() {
  return inboxRows(currentRows(), { search: $('search').value, ci: $('ci-filter').value, sort: $('sort').value, view: selectedView });
}
function applyRoute() {
  selectedView = route.view;
  selectedKey = route.pr;
  for (const [id, value] of [['search', route.search], ['ci-filter', route.ci], ['sort', route.sort], ['review-filter', route.view], ['feed-kind', route.kind], ['activity-kind', route.kind]]) $(id).value = value;
  $('feed-bots').checked = $('include-bots').checked = route.automation;
}
function navigate(next, { replace = false, focus = false } = {}) {
  if (route.pr !== next.pr && directController) {
    directController.abort();
    directMessages.set(selectedKey, 'Direct check canceled on selection change. Last-good evidence retained.');
    directController = null;
    ++directGeneration;
  }
  history.replaceState({ ...history.state, scroll: window.scrollY, focus: focusToken() }, '');
  route = readRoute(routeQuery(next));
  history[replace ? 'replaceState' : 'pushState'](
    { scroll: 0, focus: null, fromList: !!next.pr && (history.state?.fromList || !selectedKey) },
    '', `${location.pathname}${routeQuery(route)}`);
  applyRoute();
  if (data) render();
  else renderWorkspace();
  if (focus) {
    const heading = selectedRow() ? $('detail-header').querySelector('h2') : $('page-heading');
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }
}
function selectContribution(row, { replace = false } = {}) {
  if (!selectedKey) {
    returnFocusKey = focusToken() ?? `row:${key(row)}`;
    returnScroll = window.scrollY;
  }
  navigate({ ...route, pr: key(row) }, { replace, focus: true });
}
function contributionLink(row, label, className, token = `row:${key(row)}`) {
  const anchor = link(label, `${location.pathname}${routeQuery({ ...route, pr: key(row) })}`, className);
  anchor.dataset.focusKey = token;
  anchor.dataset.key = key(row);
  anchor.addEventListener('click', event => {
    if (event.button || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
    event.preventDefault();
    selectContribution(row);
  });
  return anchor;
}
function ageBadge(row) {
  const age = node('span', 'Stale', 'signal stale');
  age.dataset.ageKey = key(row);
  age.hidden = !isStale(row);
  return age;
}
function itemButton(row) {
  const item = node('li', undefined, 'pr-row');
  const icon = node('span', undefined, `pr-icon state-${row.state.toLowerCase()}`);
  icon.append(createIcon('branch'));
  icon.title = row.state.toLowerCase();
  const content = node('div');
  const title = contributionLink(row, row.summary, 'pr-title');
  title.title = row.title;
  const meta = node('div', undefined, 'pr-meta');
  meta.append(link(`${row.owner}/${row.repo}`, `https://github.com/${row.owner}/${row.repo}`),
    node('span', `#${row.number}`), node('span', row.state.toLowerCase(), `state state-${row.state.toLowerCase()}`));
  const time = node('time', `Updated ${shortDate(new Date(activityDate(row)))}`);
  time.dateTime = new Date(activityDate(row)).toISOString();
  time.title = date(time.dateTime);
  meta.append(time);
  const signals = node('div', undefined, 'row-signals');
  signals.append(node('span', CI_LABELS[row.ci.state], `signal ci-${row.ci.state}`));
  const review = reviewPresentation(row);
  signals.append(node('span', review.label, `signal ${review.className}`));
  if (review.earlierHead) signals.append(node('span', 'Earlier head', 'signal earlier-review'));
  if (row.historical) signals.append(node('span', 'Historical', 'signal stale'));
  signals.append(ageBadge(row));
  content.append(title, meta, signals);
  if (inspectionCaveat(row)) content.append(node('p', inspectionCaveat(row), 'item-caveat'));
  const count = activityFeed([row]).length;
  const tail = node('span', undefined, 'row-tail');
  tail.append(createIcon('review'), node('span', String(count)));
  tail.title = `${count} non-automated events; unclassified accounts included`;
  tail.setAttribute('aria-label', tail.title);
  item.append(icon, content, tail);
  return item;
}
function feedItem(row, event) {
  const item = node('li', undefined, 'feed-item');
  const project = node('div', undefined, 'feed-project');
  project.append(contributionLink(row, `${row.project} #${row.number}`, '', `event:${key(row)}:${event.id}`),
    node('span', row.summary));
  item.append(project);
  if (route.tab === 'feedback') item.append(messageElement(row, event, 'article'));
  else {
    const line = node('div', undefined, 'timeline-event');
    line.append(node('strong', event.kind === 'head_update' ? 'Dashboard observation' : event.actor.login),
      node('span', eventAction(event)), node('span', actorLabels[event.actor.classification], 'actor-label'),
      node('time', date(event.updatedAt)), link('Original source', event.url));
    if (event.kind === 'review' && event.headSha && event.headSha !== row.headSha) line.append(node('span', 'Earlier head', 'signal earlier-review'));
    item.append(line);
  }
  return item;
}
function renderRows() {
  if (!data) return;
  const token = focusToken();
  const filtered = filteredRows();
  document.querySelector('.list-toolbar').dataset.filtered = String(!!route.search || route.ci !== 'all' || !['all', 'open', 'merged', 'closed'].includes(route.view));
  const feedMode = ['activity', 'feedback'].includes(route.tab);
  $('rows').classList.toggle('is-feed', feedMode);
  const feed = workspaceFeed(filtered, route);
  $('rows').replaceChildren(...(feedMode ? feed.events.map(({ row, event }) => feedItem(row, event)) : filtered.map(row => itemButton(row))));
  $('rows').setAttribute('aria-label', feedMode ? route.tab === 'feedback' ? 'Review and comment messages' : 'Recent activity' : 'Pull requests');
  const count = feedMode ? feed.total : filtered.length;
  $('rows').hidden = !count;
  $('empty').hidden = !!count;
  $('feed-controls').hidden = !feedMode;
  $('feed-kind').querySelector('[value=updates]').disabled = route.tab === 'feedback';
  $('state-filters').hidden = feedMode;
  $('feedback-highlight').hidden = route.tab !== 'feedback';
  $('feed-pagination').hidden = !feedMode || feed.pages < 2;
  $('feed-page').textContent = `Page ${feed.page} of ${feed.pages}`;
  $('feed-previous').disabled = feed.page === 1;
  $('feed-next').disabled = feed.page === feed.pages;
  $('results').textContent = feedMode ? `${feed.total} ${route.tab === 'feedback' ? 'messages' : 'events'}` : `${filtered.length} of ${data.contributions.length}`;
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
  $('detail-content').hidden = !row;
  if (!row) return;
  const token = focusToken();
  const contextElement = document.querySelector('.context-box');
  const savedContext = contextElement.dataset.key === selectedKey && contextElement.open;
  contextElement.dataset.key = selectedKey;
  const direct = directRows.get(selectedKey);
  const position = navigationPosition(filteredRows(), selectedKey, key);
  $('detail-position').textContent = position.index < 0 ? 'Outside filters' : `${position.index + 1} of ${position.total}`;
  $('previous-pr').disabled = !position.previous;
  $('next-pr').disabled = !position.next;
  $('detail-github').href = row.url;
  const meta = node('div', undefined, 'detail-meta');
  meta.append(link(`${row.owner}/${row.repo}`, `https://github.com/${row.owner}/${row.repo}`), node('span', ` #${row.number} · Opened ${shortDate(row.createdAt)}`));
  if (row.draft) meta.append(node('span', 'Draft'));
  const heading = node('h2', row.title);
  heading.tabIndex = -1;
  heading.dataset.focusKey = `heading:${key(row)}`;
  $('detail-header').replaceChildren(heading, meta);
  const lifecycle = node('dl');
  lifecycle.append(node('dt', 'Pull request'), node('dd', row.state[0] + row.state.slice(1).toLowerCase(), `state state-${row.state.toLowerCase()}`));
  const review = node('dl');
  const verdict = reviewPresentation(row);
  const decision = node('dd');
  decision.append(node('span', verdict.label, `signal ${verdict.className}`));
  if (verdict.earlierHead) decision.append(node('span', 'Earlier head', 'signal earlier-review'));
  review.append(node('dt', 'Review'), decision);
  const ci = node('dl');
  const checks = node('dd');
  checks.append(node('span', CI_LABELS[row.ci.state], `signal ci-${row.ci.state}`));
  if (row.historical) checks.append(node('span', 'Historical', 'signal stale'));
  checks.append(ageBadge(row));
  ci.append(node('dt', 'CI'), checks);
  $('detail-signals').replaceChildren(lifecycle, review, ci);
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
  const rendered = events.map(({ event }) => messageElement(row, event));
  if (!rendered.length) {
    const empty = node('li', undefined, 'activity-empty');
    empty.append(node('p', emptyMessage));
    if (hiddenAutomation) {
      const show = node('button', `Show ${hiddenAutomation} automated event${hiddenAutomation === 1 ? '' : 's'}`);
      show.type = 'button';
      show.id = 'show-automation';
      show.addEventListener('click', () => {
        navigate({ ...route, automation: true }, { replace: true });
        $('include-bots').focus();
      });
      empty.append(show);
    }
    rendered.push(empty);
  }
  $('activity-list').replaceChildren(...rendered);
}
function messageElement(row, event, tag = 'li') {
    const item = node(tag, undefined, 'activity-event');
    item.dataset.eventId = event.id;
    const heading = node('div', undefined, 'event-heading');
    const observed = event.kind === 'head_update';
    const actor = node('strong', observed ? 'Dashboard observation' : event.actor.login);
    const time = node('time', date(event.date));
    time.dateTime = event.date;
    heading.append(actor);
    if (!observed) heading.append(node('span', actorLabels[event.actor.classification], 'actor-label'));
    const action = `${eventAction(event)}${event.date !== event.updatedAt ? ` / edited ${date(event.updatedAt)}` : ''}`;
    heading.append(node('span', action, `event-action${event.state === 'CHANGES_REQUESTED' ? ' requested' : event.state === 'APPROVED' ? ' approved' : ''}`), time);
    if (event.kind === 'review' && event.headSha && event.headSha !== row.headSha) heading.append(node('span', 'Earlier head', 'signal earlier-review'));
    const source = link('Source \u2197', event.url, 'event-source');
    source.dataset.focusKey = `source:${key(row)}:${event.id}`;
    heading.append(source);
    item.append(heading);
    if (event.body) {
      const message = node('div', undefined, 'event-body markdown-body');
      formatMessage(message, event.body, event.url);
      const raw = node('details', undefined, 'source-text');
      const pre = node('pre');
      pre.append(node('code', event.body));
      raw.append(node('summary', 'Original text'), pre);
      item.append(message, raw);
    }
    if (observed) item.append(node('p', event.previousHeadSha ?
      `Observed ${event.previousHeadSha.slice(0, 8)} → ${event.headSha.slice(0, 8)}. This is an observation time, not a claimed push time.` :
      `First recorded head: ${event.headSha.slice(0, 8)}. This establishes a baseline; it does not mean the branch changed at this time.`, 'event-body'));
    return item;
}
function render() {
  document.body.classList.remove('unavailable');
  const token = focusToken();
  const rows = currentRows();
  $('overview').textContent = `${rows.length} selected PRs / ${new Set(rows.map(row => `${row.owner}/${row.repo}`)).size} repositories`;
  $('pr-count').textContent = rows.length;
  for (const element of document.querySelectorAll('[data-count]')) element.textContent = inboxRows(rows, { view: element.dataset.count }).length;
  $('loading').hidden = true;
  $('unavailable').hidden = true;
  $('quotes').replaceChildren(...data.quotes.map(quote => {
    const figure = node('figure', undefined, 'quote');
    const block = node('blockquote', quote.body); block.cite = quote.source;
    const caption = node('figcaption');
    const source = link('Original review \u2197', quote.source); source.dataset.focusKey = `quote:${quote.source}`;
    caption.append(node('strong', quote.author), node('span', `${quote.role} · ${quote.project}`), node('span', shortDate(quote.date)), source);
    figure.append(block, caption);
    return figure;
  }));
  if (!data.quotes.length) $('quotes').append(node('p', 'No source-verified quotation is available.'));
  renderWorkspace();
  if (!selectedRow() && route.tab !== 'help') renderRows();
  else $('rows').replaceChildren();
  renderDetail(); renderFreshness(); restoreFocus(token);
}
function renderWorkspace() {
  const reading = !!selectedRow();
  document.body.classList.toggle('reading', reading);
  $('collection').hidden = reading || route.tab === 'help';
  $('detail').hidden = !reading;
  $('about').hidden = reading || route.tab !== 'help';
  $('route-warning').hidden = !data || !selectedKey || reading;
  $('route-warning').textContent = 'This PR is not in the published collection. Browse the available contributions instead.';
  const title = { prs: 'Pull requests', activity: 'Activity', feedback: 'Feedback', help: 'Help' }[route.tab];
  $('page-heading').textContent = title;
  $('page-heading').hidden = reading;
  document.title = `${reading ? `${selectedRow().project} #${selectedRow().number}` : title} · LeulTew`;
  for (const anchor of document.querySelectorAll('[data-tab]')) {
    if (anchor.dataset.tab === route.tab) anchor.setAttribute('aria-current', 'page');
    else anchor.removeAttribute('aria-current');
    anchor.href = `${location.pathname}${routeQuery({ ...route, tab: anchor.dataset.tab, pr: null, page: 1 })}`;
  }
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
      document.body.classList.add('unavailable');
      $('loading').hidden = true; $('unavailable').hidden = false;
      $('overview').textContent = 'No verified snapshot';
      $('freshness').textContent = 'Unable to load verified data'; $('results').textContent = 'No snapshot loaded';
      $('data-warning').textContent = 'No verified snapshot could be loaded. Reload or open the original PR links.'; $('data-warning').hidden = false;
      renderWorkspace();
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
function clearFilters() { navigate({ ...DEFAULT_ROUTE, tab: route.tab }); }
$('filters').addEventListener('submit', event => event.preventDefault());
for (const [id, property, event] of [['search', 'search', 'input'], ['ci-filter', 'ci', 'change'], ['sort', 'sort', 'change'], ['review-filter', 'view', 'change'], ['feed-kind', 'kind', 'change'], ['activity-kind', 'kind', 'change']]) {
  $(id).addEventListener(event, () => navigate({ ...route, [property]: $(id).value, page: 1 }, { replace: true }));
}
for (const id of ['feed-bots', 'include-bots']) $(id).addEventListener('change', () => navigate({ ...route, automation: $(id).checked, page: 1 }, { replace: true }));
document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => {
  navigate({ ...route, view: button.dataset.view, pr: null, page: 1 });
}));
$('clear').addEventListener('click', clearFilters);
$('empty-clear').addEventListener('click', () => { clearFilters(); $('search').focus(); });
$('refresh').addEventListener('click', refresh);
$('refresh-selected').addEventListener('click', refreshSelected);
document.querySelectorAll('[data-tab]').forEach(anchor => anchor.addEventListener('click', event => {
  if (event.button || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
  event.preventDefault();
  navigate({ ...route, tab: anchor.dataset.tab, pr: null, page: 1 }, { focus: true });
}));
function returnToList() {
  if (history.state?.fromList) history.back();
  else {
    const token = returnFocusKey ?? `row:${selectedKey}`;
    navigate({ ...route, pr: null }, { replace: true });
    restoreFocus(token);
    window.scrollTo(0, returnScroll);
  }
}
window.addEventListener('popstate', () => {
  directController?.abort(); ++directGeneration; directController = null;
  route = readRoute(location.search);
  applyRoute();
  if (data) render();
  else renderWorkspace();
  restoreFocus(history.state?.focus);
  window.scrollTo(0, history.state?.scroll ?? 0);
});
$('back-to-list').addEventListener('click', returnToList);
for (const [id, direction] of [['previous-pr', 'previous'], ['next-pr', 'next']]) $(id).addEventListener('click', () => {
  const target = navigationPosition(filteredRows(), selectedKey, key)[direction];
  if (target) selectContribution(target, { replace: true });
});
for (const [id, delta] of [['feed-previous', -1], ['feed-next', 1]]) $(id).addEventListener('click', () => {
  const feed = workspaceFeed(filteredRows(), route);
  navigate({ ...route, page: feed.page + delta }, { focus: true });
});
document.addEventListener('keydown', event => {
  if (acceptsSearchShortcut(event, document.body.classList.contains('reading') || route.tab === 'help')) {
    event.preventDefault(); $('search').focus();
  } else if (event.key === 'Escape' && document.body.classList.contains('reading') &&
      !['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target?.tagName)) {
    returnToList();
  }
});
for (const element of document.querySelectorAll('[data-icon]')) element.append(createIcon(element.dataset.icon));
let theme = initialTheme(null);
try { theme = initialTheme(localStorage.getItem('contribution-theme')); } catch { /* The default dark workspace remains usable without storage. */ }
function applyTheme() {
  document.documentElement.dataset.theme = theme;
  const choices = document.querySelectorAll('[data-theme-choice]');
  if (choices.length) choices.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.themeChoice === theme)));
  else $('theme').textContent = `Theme: ${theme}`;
}
applyTheme();
$('theme').addEventListener('click', event => {
  const choice = event.target.closest('[data-theme-choice]');
  if (document.querySelector('[data-theme-choice]') && !choice) return;
  theme = choice ? initialTheme(choice.dataset.themeChoice) : theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';
  applyTheme();
  try { localStorage.setItem('contribution-theme', theme); }
  catch { storageWarning = 'Theme preference applies to this tab only because browser storage is unavailable.'; renderFreshness(); }
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
applyRoute();
renderWorkspace();
refresh();
