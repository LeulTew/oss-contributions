import { validateActivity } from './activity.mjs';

export const CI_LABELS = Object.freeze({
  success: 'Checks successful', failure: 'Failures reported', pending: 'In progress',
  gated: 'Maintainer action', unknown: 'Unknown / no checks', cancelled: 'Canceled',
});
const states = new Set(['OPEN', 'MERGED', 'CLOSED']);
const timestamp = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
const text = value => typeof value === 'string' && value.length <= 10000;
export const key = row => `${row.owner}/${row.repo}#${row.number}`;

export function validateCatalog(catalog) {
  if (!Array.isArray(catalog) || catalog.length < 1 || catalog.length > 100) throw new Error('Unexpected contribution scope.');
  const seen = new Set();
  for (const row of catalog) {
    if (!row || !/^[\w.-]+$/.test(row.owner) || !/^[\w.-]+$/.test(row.repo) ||
        !Number.isSafeInteger(row.number) || row.number < 1 ||
        row.url !== `https://github.com/${row.owner}/${row.repo}/pull/${row.number}` ||
        !text(row.project) || !text(row.summary) || !text(row.note) || !timestamp(row.noteAsOf) || seen.has(key(row))) {
      throw new Error('Invalid contribution identity.');
    }
    seen.add(key(row));
  }
  return catalog;
}

export function validateSnapshot(data, catalog) {
  validateCatalog(catalog);
  if (!data || ![1, 2].includes(data.schemaVersion) || !timestamp(data.fetchedAt) ||
      !Array.isArray(data.contributions) || data.contributions.length !== catalog.length ||
      !Array.isArray(data.quotes) || data.quotes.length > 30 || typeof data.manifestHash !== 'string') {
    throw new Error('Invalid snapshot.');
  }
  const expected = new Map(catalog.map(row => [key(row), row]));
  const seen = new Set();
  for (const row of data.contributions) {
    if (!row) throw new Error('Missing contribution.');
    const original = expected.get(key(row));
    if (!original || seen.has(key(row)) || row.url !== original.url ||
        !states.has(row.state) || typeof row.draft !== 'boolean' ||
        !timestamp(row.createdAt) || !timestamp(row.updatedAt) || !timestamp(row.checkedAt) ||
        !/^[a-f0-9]{40}$/.test(row.headSha) || typeof row.stale !== 'boolean' ||
        typeof row.historical !== 'boolean' || row.historical !== (row.state !== 'OPEN') ||
        !row.ci || !Object.hasOwn(CI_LABELS, row.ci.state) ||
        !text(row.ci.summary) || !text(row.title) ||
        (row.error !== null && !text(row.error)) ||
        (row.state === 'MERGED' ? !timestamp(row.mergedAt) : row.mergedAt !== null)) throw new Error('Invalid contribution evidence.');
    if (Date.parse(row.checkedAt) > Date.parse(data.fetchedAt) + 60000) throw new Error('Invalid observation time.');
    if (data.schemaVersion === 2) validateActivity(row.activity, row);
    if (row.ci.counts && (!['success', 'failure', 'pending', 'gated', 'cancelled', 'neutral'].every(name =>
      Number.isSafeInteger(row.ci.counts[name]) && row.ci.counts[name] >= 0) ||
      Object.keys(row.ci.counts).some(name => !['success', 'failure', 'pending', 'gated', 'cancelled', 'neutral'].includes(name)))) {
      throw new Error('Invalid CI signal counts.');
    }
    seen.add(key(row));
  }
  for (const quote of data.quotes) {
    const original = catalog.find(row => row.url === quote?.contributionUrl);
    if (!original || !text(quote.body) || !text(quote.author) || !text(quote.role) ||
        !text(quote.project) || !timestamp(quote.date) || !text(quote.provenance) ||
        !Number.isSafeInteger(quote.authorId) ||
        !quote.source.startsWith(`${original.url}#`) ||
        !/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/pull\/\d+#(?:pullrequestreview|issuecomment|discussion_r)-?\d+$/.test(quote.source)) {
      throw new Error('Invalid quote provenance.');
    }
  }
  return {
    ...data,
    contributions: data.contributions.map(row => ({ ...row, ...expected.get(key(row)),
      activity: data.schemaVersion === 2 ? row.activity : {
        state: 'unavailable', checkedAt: null, error: 'legacy_snapshot', events: [],
        review: { state: 'unknown', currentHead: false },
      },
    })),
  };
}

export function isStale(row, now = Date.now()) {
  return row.stale || (!row.historical && now - Date.parse(row.checkedAt) > 45 * 60000);
}
export function counts(rows) {
  return { ALL: rows.length, OPEN: rows.filter(r => r.state === 'OPEN').length,
    MERGED: rows.filter(r => r.state === 'MERGED').length, CLOSED: rows.filter(r => r.state === 'CLOSED').length };
}
export function selectRows(rows, { search = '', state = 'ALL', ci = 'all', sort = 'newest' }, now = Date.now()) {
  const terms = search.toLocaleLowerCase('en').trim().split(/\s+/).filter(Boolean);
  const selected = rows.filter(row => {
    const indexed = `${row.project} ${row.owner}/${row.repo} #${row.number} ${row.summary} ${row.title} ${row.note}`.toLocaleLowerCase('en');
    return (state === 'ALL' || row.state === state) &&
      (ci === 'all' || (ci === 'stale' ? isStale(row, now) : row.ci.state === ci)) &&
      terms.every(term => indexed.includes(term));
  });
  return selected.sort((a, b) => sort === 'project'
    ? a.project.localeCompare(b.project, 'en') || b.number - a.number
    : Date.parse(sort === 'updated' ? b.updatedAt : b.createdAt) - Date.parse(sort === 'updated' ? a.updatedAt : a.createdAt) || key(a).localeCompare(key(b)));
}
export function chooseSnapshot(current, incoming) {
  if (current && Date.parse(incoming.fetchedAt) < Date.parse(current.fetchedAt)) throw new Error('An older snapshot was received.');
  return incoming;
}
export function freshnessMessage(data, now = Date.now()) {
  const minutes = Math.max(0, Math.floor((now - Date.parse(data.fetchedAt)) / 60000));
  const age = minutes < 1 ? 'less than a minute ago' : minutes < 60 ? `${minutes} minute${minutes === 1 ? '' : 's'} ago` : `${Math.floor(minutes / 60)}h ${minutes % 60}m ago`;
  return `${minutes > 45 ? 'Updates delayed' : 'Snapshot published'} ${age}`;
}

export function reviewLabel(row) {
  const review = row.activity?.review;
  if (review?.state === 'changes_requested') return review.currentHead ? 'Changes requested' : 'Changes requested on an earlier head';
  if (review?.state === 'approved') return review.currentHead ? 'Approval recorded' : 'Approval on an earlier head';
  return review?.state === 'none' ? 'No decisive review recorded' : 'Review evidence unavailable';
}

export function attention(row) {
  if (row.state === 'MERGED') return 'merged';
  if (row.state === 'CLOSED') return 'closed';
  if (row.activity?.review?.state === 'changes_requested') return 'requests';
  if (row.ci.state === 'failure') return 'failures';
  if (row.ci.state === 'gated') return 'waiting';
  return 'open';
}

export function activityDate(row) {
  return Math.max(Date.parse(row.updatedAt), ...(row.activity?.events ?? [])
    .filter(event => event.kind !== 'head_update' || event.previousHeadSha !== null)
    .map(event => Date.parse(event.updatedAt)));
}

export function inboxRows(rows, options = {}, now = Date.now()) {
  const filtered = selectRows(rows, { ...options, sort: options.sort === 'activity' ? 'updated' : options.sort }, now)
    .filter(row => !options.view || ['all', 'activity'].includes(options.view) ||
      (options.view === 'open' ? row.state === 'OPEN' :
        options.view === 'failures' ? row.state === 'OPEN' && row.ci.state === 'failure' :
          options.view === 'waiting' ? row.state === 'OPEN' && row.ci.state === 'gated' : attention(row) === options.view));
  return options.sort === 'activity' ? filtered.sort((a, b) => activityDate(b) - activityDate(a) || key(a).localeCompare(key(b))) : filtered;
}

export function activityFeed(rows, { excludeAutomation = true, kind = 'all', includeBaselines = false } = {}) {
  return rows.flatMap(row => (row.activity?.events ?? [])
    .filter(event => (!excludeAutomation || event.actor.classification !== 'automation') &&
      (includeBaselines || event.kind !== 'head_update' || event.previousHeadSha !== null) &&
      (kind === 'all' || (kind === 'reviews' ? event.kind === 'review' || event.kind === 'review_comment' :
        kind === 'updates' ? ['head_update', 'merged', 'closed'].includes(event.kind) : event.kind === 'comment')))
    .map(event => ({ row, event })))
    .sort((a, b) => Date.parse(b.event.updatedAt) - Date.parse(a.event.updatedAt) || a.event.id.localeCompare(b.event.id));
}
