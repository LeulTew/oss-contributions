export const CI_LABELS = Object.freeze({
  success: 'Checks successful', failure: 'Failures reported', pending: 'In progress',
  gated: 'Maintainer action', unknown: 'Unknown / no checks', cancelled: 'Canceled',
});
const states = new Set(['OPEN', 'MERGED', 'CLOSED']);
const timestamp = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
const text = value => typeof value === 'string' && value.length <= 10000;
export const key = row => `${row.owner}/${row.repo}#${row.number}`;

export function validateCatalog(catalog) {
  if (!Array.isArray(catalog) || catalog.length !== 25) throw new Error('Unexpected contribution scope.');
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
  if (!data || data.schemaVersion !== 1 || !timestamp(data.fetchedAt) ||
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
        (row.mergedAt !== null && !timestamp(row.mergedAt))) throw new Error('Invalid contribution evidence.');
    if (Date.parse(row.checkedAt) > Date.parse(data.fetchedAt) + 60000) throw new Error('Invalid observation time.');
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
    contributions: data.contributions.map(row => ({ ...row, ...expected.get(key(row)) })),
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
  const query = search.trim().toLocaleLowerCase('en');
  const selected = rows.filter(row =>
    (state === 'ALL' || row.state === state) &&
    (ci === 'all' || (ci === 'stale' ? isStale(row, now) : row.ci.state === ci)) &&
    `${row.project} ${row.owner}/${row.repo} #${row.number} ${row.summary} ${row.title} ${row.note}`.toLocaleLowerCase('en').includes(query));
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
  const age = minutes < 1 ? 'less than a minute ago' : minutes < 60 ? `${minutes} minutes ago` : `${Math.floor(minutes / 60)}h ${minutes % 60}m ago`;
  return `${minutes > 45 ? 'Updates delayed' : 'Snapshot published'} ${age}`;
}
