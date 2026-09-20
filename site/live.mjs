import { validateCatalog } from './model.mjs';
import { collectActivity } from './activity.mjs';

const API = 'https://api.github.com';
const STORAGE_KEY = 'contribution-inbox:anonymous-budget:v1';
const HOUR = 60 * 60 * 1000;
const TTL = 5 * 60 * 1000;
const AUTHOR = { login: 'LeulTew', id: 107800362 };
const identity = row => `${row?.owner}/${row?.repo}#${row?.number}`;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const date = value => typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
  Number.isFinite(Date.parse(value));
const errors = {
  invalid_catalog: 'The contribution allowlist is invalid.',
  identity_mismatch: 'GitHub returned a different or non-public contribution.',
  invalid_response: 'GitHub returned invalid contribution evidence.',
  request_budget: 'This selected refresh needs more requests than the safe limit allows.',
  hourly_budget: 'The anonymous browser request budget is exhausted. Scheduled data is unchanged.',
  rate_limited: 'GitHub has limited anonymous requests. Scheduled data is unchanged.',
  network_unavailable: 'GitHub could not be reached from this browser. Scheduled data is unchanged.',
  timeout: 'The selected refresh exceeded its 20-second deadline.',
  cancelled: 'The selected refresh was cancelled.',
  busy: 'Another selected contribution refresh is already running.',
  pull_request_changed: 'The contribution changed during refresh. Scheduled data is unchanged.',
};

export class LiveRefreshError extends Error {
  constructor(code, retryAt = null) {
    super(errors[code] ?? `GitHub refresh unavailable (${code}). Scheduled data is unchanged.`);
    this.name = 'LiveRefreshError';
    this.code = code;
    this.retryAt = retryAt;
  }
}
const fail = (code, retryAt) => { throw new LiveRefreshError(code, retryAt); };

function validatePR(pr, entry) {
  const repo = pr?.base?.repo;
  if (!object(pr) || pr.number !== entry.number || pr.user?.login !== AUTHOR.login ||
      pr.user?.id !== AUTHOR.id || !object(repo) || repo.private !== false ||
      typeof repo.full_name !== 'string' || repo.full_name.toLowerCase() !== `${entry.owner}/${entry.repo}`.toLowerCase() ||
      typeof repo.owner?.login !== 'string' || repo.owner.login.toLowerCase() !== entry.owner.toLowerCase() ||
      typeof repo.name !== 'string' || repo.name.toLowerCase() !== entry.repo.toLowerCase() ||
      typeof pr.html_url !== 'string' || pr.html_url.toLowerCase() !== entry.url.toLowerCase()) {
    fail('identity_mismatch');
  }
  if (!/^[a-f0-9]{40}$/.test(pr.head?.sha ?? '') || !['open', 'closed'].includes(pr.state) ||
      typeof pr.title !== 'string' || !pr.title.trim() || pr.title.length > 10000 ||
      typeof pr.draft !== 'boolean' || !date(pr.created_at) || !date(pr.updated_at) ||
      !(pr.merged_at === null || date(pr.merged_at)) ||
      (pr.merged_at !== null && pr.state !== 'closed') ||
      Date.parse(pr.updated_at) < Date.parse(pr.created_at)) fail('invalid_response');
  return {
    title: pr.title, state: pr.merged_at ? 'MERGED' : pr.state.toUpperCase(),
    draft: pr.draft, headSha: pr.head.sha, createdAt: pr.created_at,
    updatedAt: pr.updated_at, mergedAt: pr.merged_at,
    historical: pr.state !== 'open',
  };
}

function overlay(priorRow, core, activity) {
  return {
    ...priorRow, ...core, activity,
    // Live requests do not collect CI: its observation date must not advance.
    checkedAt: priorRow.checkedAt,
    ci: core.headSha === priorRow.headSha ? structuredClone(priorRow.ci) : {
      state: 'unknown', summary: 'Previous CI belongs to a different head commit. CI was not refreshed.',
      counts: { success: 0, failure: 0, pending: 0, gated: 0, cancelled: 0, neutral: 0 },
      workflowCount: 0,
    },
  };
}

/** Read-only, selected-PR observations. No credentials, CI calls, or scheduled-data writes. */
export function createLiveClient({ catalog, fetchImpl = globalThis.fetch, now = Date.now,
  storage, maxHourlyRequests = 35, maxAttemptRequests = 10, timeoutMs = 20_000 } = {}) {
  try {
    validateCatalog(catalog);
    if (catalog.some(entry => !/^[a-zA-Z0-9][a-zA-Z0-9-]*$/.test(entry.owner) ||
      !/^[a-zA-Z0-9_.-]+$/.test(entry.repo) || ['.', '..'].includes(entry.repo))) fail('invalid_catalog');
  } catch { fail('invalid_catalog'); }
  if (![maxHourlyRequests, maxAttemptRequests, timeoutMs].every(Number.isSafeInteger) ||
      maxHourlyRequests < 1 || maxHourlyRequests > 35 || maxAttemptRequests < 1 ||
      maxAttemptRequests > 10 || timeoutMs < 1 || timeoutMs > 20_000) fail('invalid_catalog');
  const allowed = new Map(catalog.map(entry => [identity(entry), structuredClone(entry)]));
  const cache = new Map();
  let active = false;
  let persistent = true;
  let ledger = { requests: [], blockedUntil: 0 };
  try { storage = storage === undefined ? globalThis.localStorage : storage; }
  catch { storage = null; }
  if (!storage) persistent = false;

  function readLedger() {
    if (persistent) {
      try {
        const saved = storage.getItem(STORAGE_KEY);
        if (saved !== null) {
          const parsed = JSON.parse(saved);
          if (!object(parsed) || !Array.isArray(parsed.requests) || parsed.requests.length > 1000 ||
              !Number.isFinite(parsed.blockedUntil) || parsed.blockedUntil < 0 ||
              parsed.requests.some(item => !object(item) || typeof item.id !== 'string' ||
                !Number.isFinite(item.at) || item.at < 0)) throw new Error('Invalid budget storage');
          ledger.requests = [...new Map([...parsed.requests, ...ledger.requests].map(item => [item.id, item])).values()];
          ledger.blockedUntil = Math.max(ledger.blockedUntil, parsed.blockedUntil);
        }
      } catch { persistent = false; }
    }
    ledger.requests = ledger.requests.filter(item => item.at > now() - HOUR);
    return ledger;
  }
  function saveLedger() {
    if (persistent) {
      try { storage.setItem(STORAGE_KEY, JSON.stringify(ledger)); }
      catch { persistent = false; }
    }
  }
  readLedger();
  saveLedger();

  async function reserve(signal) {
    function update() {
      if (signal.aborted) throw signal.reason;
      readLedger();
      if (ledger.blockedUntil > now()) fail('rate_limited', new Date(ledger.blockedUntil).toISOString());
      if (ledger.requests.length >= maxHourlyRequests) {
        fail('hourly_budget', new Date(Math.min(...ledger.requests.map(item => item.at)) + HOUR).toISOString());
      }
      ledger.requests.push({ id: globalThis.crypto?.randomUUID?.() ?? `${now()}-${Math.random()}`, at: now() });
      saveLedger();
    }
    // Web Locks serializes origin-wide reservations where available; storage alone is best effort.
    if (persistent && globalThis.navigator?.locks?.request) {
      await globalThis.navigator.locks.request(STORAGE_KEY, { signal }, update);
    } else update();
  }

  function rateLimit(response) {
    const limited = response.status === 403 || response.status === 429;
    if (!limited && response.headers.get('x-ratelimit-remaining') !== '0') return;
    const retry = response.headers.get('retry-after');
    const reset = response.headers.get('x-ratelimit-reset');
    const retryAt = retry === null ? 0 : /^\d+(?:\.\d+)?$/.test(retry) ? now() + Number(retry) * 1000 : Date.parse(retry);
    const resetAt = reset !== null && /^\d+$/.test(reset) ? Number(reset) * 1000 : 0;
    readLedger();
    ledger.blockedUntil = Math.max(ledger.blockedUntil, now() + 60_000,
      Number.isFinite(retryAt) ? retryAt : 0, Number.isFinite(resetAt) ? resetAt : 0);
    saveLedger();
    if (limited) fail('rate_limited', new Date(ledger.blockedUntil).toISOString());
  }

  return {
    get warning() {
      return persistent ? null : 'Persistent request limits are unavailable. The 35-request/hour limit applies only to this tab; other tabs and visitors share GitHub’s anonymous IP limit.';
    },
    get budgetScope() { return persistent ? 'origin-best-effort' : 'tab'; },
    async refresh(entry, priorRow, { signal } = {}) {
      const selected = allowed.get(identity(entry));
      if (!selected || entry.url !== selected.url || identity(priorRow) !== identity(selected) ||
          priorRow.url !== selected.url) fail('identity_mismatch');
      if (signal?.aborted) fail('cancelled');
      const saved = cache.get(identity(selected));
      if (saved && now() - saved.at >= 0 && now() - saved.at < TTL) {
        return { row: overlay(priorRow, saved.core, structuredClone(saved.activity)), checkedAt: saved.checkedAt, cached: true };
      }
      if (active) fail('busy');
      active = true;
      const controller = new AbortController();
      const cancel = () => controller.abort(new LiveRefreshError('cancelled'));
      signal?.addEventListener('abort', cancel, { once: true });
      const timer = setTimeout(() => controller.abort(new LiveRefreshError('timeout')), timeoutMs);
      const abortSignal = controller.signal;
      const onAbort = [];
      const bounded = operation => new Promise((resolve, reject) => {
        if (abortSignal.aborted) return reject(abortSignal.reason);
        const abort = () => reject(abortSignal.reason);
        abortSignal.addEventListener('abort', abort, { once: true });
        onAbort.push(abort);
        Promise.resolve(operation).then(resolve, reject).finally(() => abortSignal.removeEventListener('abort', abort));
      });
      const base = `/repos/${selected.owner}/${selected.repo}`;
      const pullPath = `${base}/pulls/${selected.number}`;
      const listPaths = new Set([`${base}/issues/${selected.number}/comments`,
        `${pullPath}/reviews`, `${pullPath}/comments`]);
      let requests = 0;
      const get = async path => {
        const [resource, ...queryParts] = path.split('?');
        if (!(path === pullPath || (listPaths.has(resource) && queryParts.length === 1 &&
            /^per_page=100&page=[1-9]\d*$/.test(queryParts[0])))) {
          fail('identity_mismatch');
        }
        if (abortSignal.aborted) throw abortSignal.reason;
        if (++requests > maxAttemptRequests) fail('request_budget');
        await bounded(reserve(abortSignal));
        let response;
        try {
          response = await bounded(fetchImpl(`${API}${path}`, {
            method: 'GET', mode: 'cors', credentials: 'omit', redirect: 'error',
            referrerPolicy: 'no-referrer', cache: 'no-store', signal: abortSignal,
            headers: { Accept: 'application/vnd.github+json' },
          }));
        } catch (error) {
          if (abortSignal.aborted) throw abortSignal.reason;
          if (error instanceof LiveRefreshError) throw error;
          fail('network_unavailable');
        }
        rateLimit(response);
        if (!response.ok) fail(`http_${response.status}`);
        try { return await bounded(response.json()); }
        catch {
          if (abortSignal.aborted) throw abortSignal.reason;
          fail('invalid_response');
        }
      };
      try {
        const pr = await get(pullPath);
        const core = validatePR(pr, selected);
        const checkedAt = new Date(now()).toISOString();
        const activity = await collectActivity(selected, pr, get, priorRow.activity ?? null, checkedAt);
        const confirmed = validatePR(await get(pullPath), selected);
        if (JSON.stringify(core) !== JSON.stringify(confirmed)) fail('pull_request_changed');
        if (abortSignal.aborted) throw abortSignal.reason;
        const observedAt = new Date(now()).toISOString();
        cache.set(identity(selected), { core, activity: structuredClone(activity), checkedAt: observedAt, at: now() });
        return { row: overlay(priorRow, core, activity), checkedAt: observedAt, cached: false };
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', cancel);
        for (const listener of onAbort) abortSignal.removeEventListener('abort', listener);
        active = false;
      }
    },
  };
}
