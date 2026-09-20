import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ActivityError, collectActivity, hashBody, unavailableActivity, validateActivity } from '../site/activity.mjs';

export const AUTHOR = { login: 'LeulTew', id: 107800362 };
const API = 'https://api.github.com';
const SHA = /^[a-f0-9]{40}$/;
const STATES = new Set(['OPEN', 'MERGED', 'CLOSED']);
const CI_STATES = new Set(['success', 'failure', 'pending', 'gated', 'unknown', 'cancelled']);
const COUNTS = ['success', 'failure', 'pending', 'gated', 'cancelled', 'neutral'];
const MAX_PAGES = 20;
const iso = value => typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
  Number.isFinite(Date.parse(value));
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const integer = value => Number.isSafeInteger(value) && value > 0;
const identity = row => `${row.owner}/${row.repo}#${row.number}`.toLowerCase();
const fail = code => { throw new CollectionError(code); };

export class CollectionError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

export function validateManifest(manifest) {
  if (!Array.isArray(manifest) || !manifest.length || manifest.length > 100) fail('invalid_manifest');
  const seen = new Set();
  const keys = ['owner', 'repo', 'number', 'url', 'project', 'summary', 'note', 'noteAsOf'];
  for (const row of manifest) {
    if (!object(row) || Object.keys(row).some(key => !keys.includes(key)) ||
        !/^[a-zA-Z0-9][a-zA-Z0-9-]*$/.test(row.owner ?? '') ||
        !/^[a-zA-Z0-9_.-]+$/.test(row.repo ?? '') || ['.', '..'].includes(row.repo) ||
        !integer(row.number) || row.url !== `https://github.com/${row.owner}/${row.repo}/pull/${row.number}` ||
        !['project', 'summary', 'note'].every(key => typeof row[key] === 'string') ||
        !iso(row.noteAsOf) || seen.has(identity(row))) fail('invalid_manifest');
    seen.add(identity(row));
  }
  return manifest;
}

export function manifestHash(manifest) {
  validateManifest(manifest);
  return createHash('sha256').update(JSON.stringify(manifest)).digest('hex');
}

export function validateQuotes(quotes) {
  if (!Array.isArray(quotes) || quotes.some(quote => !object(quote))) fail('invalid_quotes');
  return quotes;
}

export function createClient({ token, fetchImpl = fetch, sleep = ms => new Promise(r => setTimeout(r, ms)),
  timeoutMs = 20_000, retries = 2, requestBudget = 240 } = {}) {
  if (!integer(requestBudget) || requestBudget > 240 || !Number.isInteger(retries) ||
      retries < 0 || retries > 2) fail('invalid_request_budget');
  let requests = 0;
  return async function get(path) {
    // Never follow API-supplied URLs or redirects with a credential.
    if (!/^\/repos\/[a-zA-Z0-9-]+\/[a-zA-Z0-9_.-]+\//.test(path) || path.includes('..') ||
        path.includes('\\') || path.includes('#')) fail('invalid_api_path');
    for (let attempt = 0; attempt <= retries; attempt++) {
      if (requests >= requestBudget) fail('request_budget_exhausted');
      requests++;
      let response;
      try {
        response = await fetchImpl(`${API}${path}`, {
          method: 'GET', redirect: 'error', signal: AbortSignal.timeout(timeoutMs),
          headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': 'LeulTew-public-contribution-dashboard',
            ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        });
      } catch {
        if (attempt < retries) { await sleep(1000 * (attempt + 1)); continue; }
        fail('network_unavailable');
      }
      const retryable = response.status === 429 || response.status >= 500 ||
        (response.status === 403 && (response.headers.get('x-ratelimit-remaining') === '0' ||
          response.headers.has('retry-after')));
      if (!response.ok) {
        if (retryable && attempt < retries) {
          const after = Number(response.headers.get('retry-after'));
          await sleep(Math.min(5000, Math.max(1000 * (attempt + 1), Number.isFinite(after) ? after * 1000 : 0)));
          continue;
        }
        fail(retryable ? 'api_rate_or_service_limit' : `api_http_${response.status}`);
      }
      try { return await response.json(); } catch { fail('invalid_api_schema'); }
    }
  };
}

async function paginate(get, path, key, validateEnvelope = () => {}) {
  const result = [];
  const ids = new Set();
  let expected;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const body = await get(`${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`);
    if (!object(body) || !Array.isArray(body[key]) || !Number.isSafeInteger(body.total_count) ||
        body.total_count < 0) fail('invalid_api_schema');
    validateEnvelope(body);
    if (expected !== undefined && expected !== body.total_count) fail('pagination_changed');
    expected = body.total_count;
    if (body[key].length > 100) fail('invalid_api_schema');
    for (const item of body[key]) {
      if (!object(item) || !integer(item.id) || ids.has(item.id)) fail('invalid_api_schema');
      ids.add(item.id);
      result.push(item);
    }
    if (result.length === expected) return result;
    if (result.length > expected || body[key].length < 100) fail('incomplete_pagination');
  }
  fail('pagination_limit');
}

function validatePR(pr, entry) {
  const repo = pr?.base?.repo;
  if (!object(pr) || pr.number !== entry.number || pr.user?.login !== AUTHOR.login ||
      pr.user?.id !== AUTHOR.id || !object(repo) || repo.private !== false ||
      typeof repo.full_name !== 'string' || repo.full_name.toLowerCase() !== `${entry.owner}/${entry.repo}`.toLowerCase() ||
      repo.owner?.login?.toLowerCase() !== entry.owner.toLowerCase() ||
      repo.name?.toLowerCase() !== entry.repo.toLowerCase() ||
      typeof pr.html_url !== 'string' || pr.html_url.toLowerCase() !== entry.url.toLowerCase()) fail('identity_mismatch');
  if (!SHA.test(pr.head?.sha ?? '') || !['open', 'closed'].includes(pr.state) ||
      typeof pr.title !== 'string' || !pr.title.trim() || typeof pr.draft !== 'boolean' ||
      !iso(pr.created_at) || !iso(pr.updated_at) || !(pr.merged_at === null || iso(pr.merged_at)) ||
      (pr.merged_at !== null && pr.state !== 'closed')) fail('invalid_api_schema');
  return pr;
}

function latest(rows, key, rank = row => row.id) {
  const result = new Map();
  for (const row of rows) {
    const previous = result.get(key(row));
    if (!previous || rank(row) > rank(previous)) result.set(key(row), row);
  }
  return [...result.values()];
}

function checkState(row) {
  if (row.conclusion === 'action_required' || ['waiting', 'requested'].includes(row.status)) return 'gated';
  if (row.status !== 'completed') return 'pending';
  if (row.conclusion === 'success') return 'success';
  if (['failure', 'timed_out', 'startup_failure', 'stale'].includes(row.conclusion)) return 'failure';
  if (row.conclusion === 'cancelled') return 'cancelled';
  if (['neutral', 'skipped'].includes(row.conclusion)) return 'neutral';
  return 'unknown';
}

export function summarizeCI(checks, statuses, workflows, sha) {
  const progress = ['queued', 'in_progress', 'completed', 'waiting', 'pending', 'requested'];
  const conclusions = ['success', 'failure', 'neutral', 'cancelled', 'skipped', 'timed_out',
    'action_required', 'stale', 'startup_failure'];
  for (const row of [...checks, ...workflows]) {
    if (!integer(row.id) || row.head_sha !== sha) fail('head_mismatch');
    if (typeof row.name !== 'string' || !progress.includes(row.status) ||
        !(row.conclusion === null || conclusions.includes(row.conclusion)) ||
        (row.status === 'completed' && row.conclusion === null)) fail('invalid_api_schema');
  }
  for (const row of checks) if (!integer(row.app?.id)) fail('invalid_api_schema');
  for (const row of workflows) {
    if (!integer(row.workflow_id) || !integer(row.run_number) ||
        !integer(row.run_attempt)) fail('invalid_api_schema');
  }
  for (const row of statuses) {
    if (!integer(row.id) || typeof row.context !== 'string' || !row.context ||
        !['success', 'failure', 'error', 'pending'].includes(row.state)) fail('invalid_api_schema');
  }
  const currentChecks = latest(checks, row => `${row.app.id}:${row.name}`);
  const currentStatuses = latest(statuses, row => row.context);
  // Workflow runs are independent evidence: successful external checks cannot conceal a gate.
  const currentWorkflows = latest(workflows, row => row.workflow_id);
  const observations = [
    ...currentChecks.map(checkState), ...currentWorkflows.map(checkState),
    ...currentStatuses.map(row => row.state === 'error' ? 'failure' : row.state),
  ];
  const counts = Object.fromEntries(COUNTS.map(key => [key, observations.filter(x => x === key).length]));
  const state = ['failure', 'gated', 'pending', 'cancelled', 'unknown'].find(x => observations.includes(x)) ??
    (counts.success > 0 && counts.neutral === 0 ? 'success' : 'unknown');
  const labels = { success: 'Reported CI passed; this is not merge approval.',
    failure: 'CI reports a failure.', gated: 'A workflow needs approval or action.',
    pending: 'CI is queued or running.', cancelled: 'CI includes a canceled run.',
    unknown: observations.length ? 'CI includes skipped, neutral, or unavailable evidence.' : 'No CI evidence is available.' };
  return { state, summary: labels[state], counts, workflowCount: currentWorkflows.length };
}

export async function collectOne(entry, get, now = () => new Date().toISOString(), priorActivity = null) {
  const base = `/repos/${entry.owner}/${entry.repo}`;
  const pr = validatePR(await get(`${base}/pulls/${entry.number}`), entry);
  const sha = pr.head.sha;
  const checks = await paginate(get, `${base}/commits/${sha}/check-runs?filter=all`, 'check_runs');
  const statuses = await paginate(get, `${base}/commits/${sha}/status`, 'statuses', body => {
    if (body.sha !== sha) fail('head_mismatch');
  });
  const workflows = await paginate(get, `${base}/actions/runs?head_sha=${sha}`, 'workflow_runs');
  const ci = summarizeCI(checks, statuses, workflows, sha);
  let activity;
  try {
    activity = await collectActivity(entry, pr, get, priorActivity, now());
  } catch (error) {
    activity = unavailableActivity(priorActivity, safeError(error));
  }
  const confirmed = validatePR(await get(`${base}/pulls/${entry.number}`), entry);
  if (confirmed.head.sha !== sha || confirmed.state !== pr.state || confirmed.merged_at !== pr.merged_at ||
      confirmed.updated_at !== pr.updated_at) fail('pull_request_changed');
  const state = pr.merged_at ? 'MERGED' : pr.state === 'open' ? 'OPEN' : 'CLOSED';
  return { ...entry, title: pr.title, state, draft: pr.draft, headSha: sha,
    createdAt: pr.created_at, updatedAt: pr.updated_at, mergedAt: pr.merged_at,
    checkedAt: now(), ci, historical: state !== 'OPEN', stale: activity.state !== 'complete',
    error: activity.error, activity };
}

function reusableRow(row, entry) {
  return object(row) && identity(row) === identity(entry) && row.url === entry.url &&
    STATES.has(row.state) && typeof row.title === 'string' && typeof row.draft === 'boolean' &&
    SHA.test(row.headSha ?? '') && iso(row.checkedAt) && iso(row.createdAt) && iso(row.updatedAt) &&
    (row.mergedAt === null || iso(row.mergedAt)) && object(row.ci) && CI_STATES.has(row.ci.state) &&
    (row.state === 'MERGED' ? iso(row.mergedAt) : row.mergedAt === null) &&
    typeof row.ci.summary === 'string' && object(row.ci.counts) &&
    COUNTS.every(key => Number.isSafeInteger(row.ci.counts[key]) && row.ci.counts[key] >= 0) &&
    Number.isSafeInteger(row.ci.workflowCount) && row.ci.workflowCount >= 0 &&
    typeof row.stale === 'boolean' && (row.error === null || typeof row.error === 'string');
}

export function readSnapshot(snapshot, manifest) {
  if (!object(snapshot) || ![1, 2].includes(snapshot.schemaVersion) || snapshot.manifestHash !== manifestHash(manifest) ||
      !Array.isArray(snapshot.contributions) || snapshot.contributions.length !== manifest.length) return new Map();
  const rows = new Map();
  for (const entry of manifest) {
    const matching = snapshot.contributions.filter(row => object(row) && identity(row) === identity(entry));
    if (matching.length !== 1 || !reusableRow(matching[0], entry)) return new Map();
    const row = matching[0];
    if (snapshot.schemaVersion === 2) {
      // Unlike an absent v1 field, invalid v2 evidence must never be silently migrated.
      try { validateActivity(row.activity, row); } catch { return new Map(); }
    }
    if (snapshot.schemaVersion === 1) {
      const activity = unavailableActivity(null, 'activity_not_collected');
      // The v1 core observation proves when this head was seen, not when it was pushed.
      activity.events.push({ id: `head_update:${row.headSha}:${row.checkedAt}`, kind: 'head_update',
        actor: { login: 'unknown', id: null, classification: 'unknown' },
        body: '', bodyHash: hashBody(''), date: row.checkedAt, updatedAt: row.checkedAt,
        url: row.url, state: null, headSha: row.headSha, previousHeadSha: null });
      rows.set(identity(entry), { ...row, activity });
    } else rows.set(identity(entry), row);
  }
  return rows;
}

export async function collect({ manifest, quotes = [], previous, get, now = () => new Date().toISOString() }) {
  validateManifest(manifest);
  validateQuotes(quotes);
  const cached = readSnapshot(previous, manifest);
  const contributions = [];
  for (const entry of manifest) {
    const prior = cached.get(identity(entry));
    if (prior && prior.state !== 'OPEN' && !prior.stale && prior.error === null &&
        prior.activity.state === 'complete') {
      contributions.push({ ...prior, ...entry, historical: true });
      continue;
    }
    try {
      const row = await collectOne(entry, get, now, prior?.activity);
      // Terminal v1 hydration can add activity without rewriting the historical core check time.
      if (prior && prior.state !== 'OPEN' && !prior.stale && prior.error === null &&
          prior.headSha === row.headSha && prior.state === row.state) row.checkedAt = prior.checkedAt;
      contributions.push(row);
    } catch (error) {
      // A row without a verified PR observation cannot safely invent a state or timestamp.
      if (!prior) fail(`no_verified_snapshot:${identity(entry)}:${safeError(error)}`);
      contributions.push({ ...prior, ...entry, historical: prior.state !== 'OPEN', stale: true,
        error: safeError(error), ci: { ...prior.ci, state: 'unknown',
          summary: 'Refresh failed; previous CI counts are historical, not current evidence.' },
        activity: unavailableActivity(prior.activity, safeError(error)) });
    }
  }
  return { schemaVersion: 2, fetchedAt: now(), refreshMinutes: 15,
    manifestHash: manifestHash(manifest), contributions, quotes };
}

function safeError(error) {
  return (error instanceof CollectionError || error instanceof ActivityError) && /^[a-z0-9_]+$/.test(error.code) ?
    error.code : 'collection_unavailable';
}

async function json(path, optional = false) {
  try { return JSON.parse(await readFile(path, 'utf8')); }
  catch (error) { if (optional && (error.code === 'ENOENT' || error instanceof SyntaxError)) return null; throw error; }
}

export async function atomicJSON(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const staging = `${path}.${randomUUID()}.staging`;
  await writeFile(staging, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await rename(staging, path);
}

export async function main(root = process.cwd(), { get = createClient({
  token: process.env.GH_TOKEN || process.env.GITHUB_TOKEN,
}) } = {}) {
  const manifest = await json(resolve(root, 'config', 'contributions.json'));
  const quotes = await json(resolve(root, 'config', 'quotes.json'));
  validateManifest(manifest);
  const cached = await json(resolve(root, '.cache', 'contributions.json'), true);
  const initial = await json(resolve(root, 'config', 'initial-state.json'), true);
  const previous = readSnapshot(cached, manifest).size ? cached : initial;
  const result = await collect({ manifest, quotes, previous, get });
  await atomicJSON(resolve(root, 'site', 'data.json'), result);
  await atomicJSON(resolve(root, '.cache', 'contributions.json'), result);
  const stale = result.contributions.filter(row => row.stale).length;
  console.log(`Collected ${result.contributions.length} public contributions (${stale} explicitly stale).`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(error instanceof CollectionError ? error.message : 'Collection failed; no new artifact published.');
    process.exitCode = 1;
  });
}
