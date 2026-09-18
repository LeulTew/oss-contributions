import { CI_LABELS, validateCatalog, validateSnapshot, counts, selectRows, isStale, chooseSnapshot, freshnessMessage } from './model.mjs';

const $ = id => document.getElementById(id);
const date = value => new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }) + ' UTC';
const node = (tag, content, className) => {
  const el = document.createElement(tag);
  if (content !== undefined) el.textContent = content;
  if (className) el.className = className;
  return el;
};
const link = (label, url, className) => {
  const el = node('a', label, className);
  el.href = url;
  return el;
};
function restoreFocus(key) {
  if (!key) return;
  const replacement = [...document.querySelectorAll('[data-focus-key]')].find(el => el.dataset.focusKey === key);
  if (replacement) replacement.focus({ preventScroll: true });
  else {
    $('results').tabIndex = -1;
    $('results').focus({ preventScroll: true });
  }
}
let data = null;
let catalog = null;
let controller = null;
let generation = 0;
let selectedState = 'ALL';
let sourceWarning = '';
let storageWarning = '';
let timer = null;
const cacheKey = 'leultew-contributions-v1';

function renderFreshness() {
  if (!data) return;
  $('freshness').textContent = `${freshnessMessage(data)} / ${date(data.fetchedAt)}`;
  const stale = data.contributions.filter(row => isStale(row)).length;
  const warnings = [
    !navigator.onLine ? 'Offline. Showing the last verified snapshot; connect and refresh for updates.' : '',
    sourceWarning,
    stale ? `${stale} active or failed observations are stale. Their recorded states are not current confirmations.` : '',
    Date.now() - Date.parse(data.fetchedAt) > 45 * 60000 ? 'The published snapshot is over 45 minutes old. Scheduled updates may be delayed; use GitHub for current status.' : '',
    storageWarning,
  ].filter(Boolean);
  $('data-warning').textContent = warnings.join(' ');
  $('data-warning').hidden = !warnings.length;
}

function renderRows() {
  if (!data) return;
  const focusKey = document.activeElement?.dataset.focusKey;
  const filtered = selectRows(data.contributions, { search: $('search').value, ci: $('ci-filter').value, sort: $('sort').value, state: selectedState });
  const expanded = new Set([...document.querySelectorAll('.row-details[open]')].map(el => el.dataset.url));
  const fragment = document.createDocumentFragment();
  for (const row of filtered) {
    const tr = node('tr');
    tr.dataset.url = row.url;
    const project = node('th', undefined, 'project-cell');
    project.scope = 'row';
    const projectLink = link(row.project, row.url, 'project-link');
    projectLink.dataset.focusKey = `project:${row.url}`;
    projectLink.append(node('span', `#${row.number}`, 'pr-number'));
    project.append(projectLink, node('span', `${row.owner}/${row.repo}`, 'repo'));
    const change = node('td', undefined, 'summary-cell');
    change.append(node('p', row.summary, 'summary-text'));
    const details = node('details', undefined, 'row-details');
    details.dataset.url = row.url;
    details.open = expanded.has(row.url);
    const disclosure = node('summary', 'Evidence & context');
    disclosure.dataset.focusKey = `evidence:${row.url}`;
    details.append(disclosure);
    if (row.note) details.append(node('p', `Context recorded ${date(row.noteAsOf)}: ${row.note}`));
    details.append(node('p', `${row.historical ? 'Historical observation' : 'Evidence checked'}: ${date(row.checkedAt)}. PR updated: ${date(row.updatedAt)}.`));
    details.append(node('p', `Head commit: ${row.headSha}. ${row.ci.summary}`));
    if (row.ci.counts) details.append(node('p', `CI signals (may overlap): ${Object.entries(row.ci.counts).map(([state, count]) => `${count} ${state}`).join(', ')}. These are reported signals, not a count of unique tests.`));
    if (row.error) details.append(node('p', `Collection issue: ${row.error}`));
    const originalLink = link('Open original PR and checks', row.url);
    originalLink.dataset.focusKey = `original:${row.url}`;
    details.append(originalLink);
    change.append(details);
    const state = node('td', undefined, 'state-cell');
    state.append(node('span', row.state[0] + row.state.slice(1).toLowerCase(), `state state-${row.state.toLowerCase()}`));
    if (row.draft) state.append(node('span', 'Now a draft', 'ci-detail'));
    if (row.historical) state.append(node('span', 'Historical', 'ci-detail'));
    const ci = node('td', undefined, 'ci-cell');
    ci.append(node('span', CI_LABELS[row.ci.state], `ci-label ci-${row.ci.state}`));
    ci.append(node('span', row.ci.summary, 'ci-detail'));
    if (isStale(row)) ci.append(node('span', 'Stale observation', 'stale-tag'));
    tr.append(project, change, state, ci);
    fragment.append(tr);
  }
  $('rows').replaceChildren(fragment);
  $('ledger').hidden = !filtered.length;
  $('empty').hidden = !!filtered.length;
  $('results').textContent = `${filtered.length} of ${data.contributions.length} contributions`;
  document.querySelectorAll('[data-state]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.state === selectedState)));
  restoreFocus(focusKey);
}

function render() {
  const focusKey = document.activeElement?.dataset.focusKey;
  const totals = counts(data.contributions);
  $('overview').replaceChildren(...[
    `${totals.ALL} pull requests`, `${new Set(data.contributions.map(row => `${row.owner}/${row.repo}`)).size} repositories`,
    `${totals.MERGED} merged`, `${totals.OPEN} open`, ...(totals.CLOSED ? [`${totals.CLOSED} closed`] : []),
  ].map(value => node('span', value)));
  for (const state of ['ALL', 'OPEN', 'MERGED', 'CLOSED']) $(`count-${state.toLowerCase()}`).textContent = totals[state];
  $('nav-count').textContent = totals.ALL;
  $('loading').hidden = true;
  $('unavailable').hidden = true;
  const quotes = data.quotes.map(quote => {
    const figure = node('figure', undefined, 'quote');
    const block = node('blockquote', quote.body);
    block.cite = quote.source;
    const caption = node('figcaption');
    const reviewLink = link('Read the original review \u2197', quote.source);
    reviewLink.dataset.focusKey = `quote:${quote.source}`;
    caption.append(node('strong', quote.author), node('span', `${quote.role} / ${quote.project}`), node('br'), node('span', date(quote.date)), node('br'), reviewLink);
    figure.append(block, caption);
    return figure;
  });
  $('quotes').replaceChildren(...quotes);
  if (!quotes.length) $('quotes').append(node('p', 'No verified quotations are available in this snapshot.'));
  renderRows();
  renderFreshness();
  restoreFocus(focusKey);
}

async function getJSON(path, signal) {
  const response = await fetch(new URL(path, import.meta.url), { cache: 'no-store', signal, credentials: 'omit', redirect: 'error' });
  if (!response.ok) throw new Error('Published data request failed.');
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Unexpected data response.');
  return response.json();
}

function loadCache() {
  try {
    const raw = localStorage.getItem(cacheKey);
    if (raw) return validateSnapshot(JSON.parse(raw), catalog);
  } catch {
    storageWarning = 'Saved browser data is unavailable or invalid; using the published snapshot instead.';
  }
  return null;
}

async function refresh() {
  controller?.abort();
  controller = new AbortController();
  const signal = controller.signal;
  const thisGeneration = ++generation;
  const timeout = setTimeout(() => controller?.abort(), 20000);
  $('refresh').disabled = true;
  $('refresh').textContent = 'Checking snapshot...';
  try {
    if (!catalog) catalog = validateCatalog(await getJSON('./catalog.json', signal));
    if (!data) {
      data = loadCache();
      if (data) { sourceWarning = 'Showing saved browser data while checking the published snapshot.'; render(); }
    }
    const incoming = validateSnapshot(await getJSON('./data.json', signal), catalog);
    if (thisGeneration !== generation) return;
    data = chooseSnapshot(data, incoming);
    sourceWarning = '';
    try { localStorage.setItem(cacheKey, JSON.stringify(data)); }
    catch { storageWarning = 'Browser storage is unavailable. This tab retains its last good snapshot, but offline reload may not work.'; }
    render();
  } catch {
    if (thisGeneration !== generation || document.hidden) return;
    sourceWarning = 'Refresh failed. The last verified snapshot is retained; retry Refresh data or check the original PR on GitHub.';
    if (!data && catalog) {
      try {
        const fallback = validateSnapshot(await getJSON('./fallback.json', AbortSignal.timeout(10000)), catalog);
        data = fallback;
        sourceWarning = 'The latest data request failed. Showing the bundled deployment snapshot; retry Refresh data.';
      } catch {
        sourceWarning = 'Neither the latest snapshot nor the bundled fallback could be loaded. No statuses are being inferred.';
      }
    }
    if (data) render();
    else {
      $('loading').hidden = true;
      $('unavailable').hidden = false;
      $('freshness').textContent = 'Unable to load verified data';
      $('results').textContent = 'No snapshot loaded';
      $('data-warning').textContent = sourceWarning;
      $('data-warning').hidden = false;
    }
  } finally {
    clearTimeout(timeout);
    if (thisGeneration === generation) {
      $('refresh').disabled = false;
      $('refresh').textContent = 'Refresh data';
    }
  }
}

function clearFilters() {
  $('filters').reset();
  selectedState = 'ALL';
  renderRows();
}
$('filters').addEventListener('submit', event => event.preventDefault());
$('search').addEventListener('input', renderRows);
$('ci-filter').addEventListener('change', renderRows);
$('sort').addEventListener('change', renderRows);
document.querySelectorAll('[data-state]').forEach(button => button.addEventListener('click', () => { selectedState = button.dataset.state; renderRows(); }));
$('clear').addEventListener('click', clearFilters);
$('empty-clear').addEventListener('click', () => { clearFilters(); $('search').focus(); });
$('refresh').addEventListener('click', refresh);
let theme = 'system';
try { const saved = localStorage.getItem('contribution-theme'); if (['light', 'dark'].includes(saved)) theme = saved; } catch { /* Theme storage is optional; the operating-system preference remains authoritative. */ }
function applyTheme() {
  if (theme === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
  $('theme').textContent = `Theme: ${theme}`;
}
applyTheme();
$('theme').addEventListener('click', () => {
  theme = theme === 'system' ? 'dark' : theme === 'dark' ? 'light' : 'system';
  applyTheme();
  try { localStorage.setItem('contribution-theme', theme); } catch { $('theme').textContent += ' (this tab)'; }
});
function schedule() {
  clearInterval(timer);
  if (!document.hidden) timer = setInterval(refresh, 5 * 60000);
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) controller?.abort();
  else { renderFreshness(); refresh(); }
  schedule();
});
window.addEventListener('offline', renderFreshness);
window.addEventListener('online', refresh);
setInterval(() => { if (!document.hidden) renderFreshness(); }, 60000);
schedule();
refresh();
