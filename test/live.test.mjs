import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createLiveClient, LiveRefreshError } from '../site/live.mjs';

const catalog = JSON.parse(await readFile(new URL('../config/contributions.json', import.meta.url)));
const entry = catalog[0];
const instant = Date.parse('2026-09-20T12:00:00Z');
const iso = time => new Date(time).toISOString();
const sha = 'a'.repeat(40);
function pull(overrides = {}) {
  return {
    number: entry.number, html_url: entry.url, title: 'Public fixture contribution',
    state: 'open', draft: false, created_at: iso(instant - 86400000), updated_at: iso(instant),
    merged_at: null, user: { login: 'LeulTew', id: 107800362, type: 'User' }, head: { sha },
    base: { repo: { full_name: `${entry.owner}/${entry.repo}`, private: false,
      owner: { login: entry.owner }, name: entry.repo } },
    ...overrides,
  };
}
function prior(overrides = {}) {
  return {
    ...entry, title: 'Scheduled title', state: 'OPEN', draft: false, headSha: sha,
    createdAt: iso(instant - 86400000), updatedAt: iso(instant - 60000), mergedAt: null,
    checkedAt: iso(instant - 60000), historical: false, stale: false, error: null,
    ci: { state: 'success', summary: 'Scheduled checks passed',
      counts: { success: 2, failure: 0, pending: 0, gated: 0, cancelled: 0, neutral: 0 } },
    ...overrides,
  };
}
const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json', ...headers },
});
function fixture(options = {}) {
  let time = instant;
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    if (options.fetchImpl) return options.fetchImpl(url, init, calls.length);
    return json(url.includes('?') ? [] : pull(options.pull));
  };
  const client = createLiveClient({ catalog, now: () => time, storage: null, ...options, fetchImpl });
  return { client, calls, advance: ms => { time += ms; } };
}
function memoryStorage() {
  const data = new Map();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
}
const errorCode = code => error => error instanceof LiveRefreshError && error.code === code;

test('selected refresh is tokenless, CORS-only, bounded to exact public paths, and leaves scheduled CI unchanged', async () => {
  const { client, calls } = fixture();
  const previous = prior();
  const untouched = structuredClone(previous);
  const result = await client.refresh(entry, previous);
  assert.equal(calls.length, 5);
  assert.equal(result.cached, false);
  assert.equal(result.checkedAt, iso(instant));
  assert.equal(result.row.checkedAt, previous.checkedAt);
  assert.deepEqual(result.row.ci, previous.ci);
  assert.deepEqual(previous, untouched);
  assert.equal(result.row.title, pull().title);
  assert.ok(result.row.activity);
  for (const { url, init } of calls) {
    assert.equal(new URL(url).origin, 'https://api.github.com');
    assert.match(new URL(url).pathname, new RegExp(`^/repos/${entry.owner}/${entry.repo}/(?:pulls|issues)/${entry.number}(?:/(?:comments|reviews))?$`));
    assert.equal(init.method, 'GET');
    assert.equal(init.mode, 'cors');
    assert.equal(init.credentials, 'omit');
    assert.equal(init.redirect, 'error');
    assert.equal(init.referrerPolicy, 'no-referrer');
    assert.equal(init.cache, 'no-store');
    assert.deepEqual(init.headers, { Accept: 'application/vnd.github+json' });
    assert.ok(init.signal instanceof AbortSignal);
    assert.doesNotMatch(url, /check-runs|actions|\/users\/|\/search\//);
  }
});

test('allowlist is required, copied at construction, and matched exactly before any request', async () => {
  assert.throws(() => createLiveClient(), errorCode('invalid_catalog'));
  for (const owner of ['../evil', 'api.github.com@evil', '']) {
    assert.throws(() => createLiveClient({ catalog: [{ ...entry, owner }] }), errorCode('invalid_catalog'));
  }
  const { client, calls } = fixture();
  for (const selected of [
    { ...entry, number: entry.number + 1 }, { ...entry, owner: 'unlisted' },
    { ...entry, url: 'https://evil.example/pull/283' },
  ]) await assert.rejects(client.refresh(selected, prior()), errorCode('identity_mismatch'));
  await assert.rejects(client.refresh(entry, prior({ number: 1 })), errorCode('identity_mismatch'));
  assert.equal(calls.length, 0);
  const mutable = structuredClone(catalog);
  const other = fixture({ catalog: mutable });
  mutable[0].number = 1;
  await other.client.refresh(entry, prior());
  assert.equal(other.calls.length, 5);
});

test('GitHub PR identity, public repository, author and core evidence are validated before activity', async () => {
  const invalid = [
    { number: 1 }, { html_url: 'https://evil.example' },
    { user: { login: 'LeulTew', id: 1 } }, { user: { login: 'someone-else', id: 107800362 } },
    { base: { repo: { ...pull().base.repo, private: true } } },
    { base: { repo: { ...pull().base.repo, full_name: 'other/repo' } } },
    { base: { repo: { ...pull().base.repo, owner: { login: 'wrong' } } } },
    { head: { sha: 'bad' } }, { draft: 'false' }, { state: 'unknown' },
    { updated_at: 'tomorrow' }, { merged_at: iso(instant) }, { title: '' },
  ];
  for (const change of invalid) {
    const { client, calls } = fixture({ pull: change });
    await assert.rejects(client.refresh(entry, prior()));
    assert.equal(calls.length, 1);
  }
});

test('head changes remove old green CI and counts without advancing the scheduled CI timestamp', async () => {
  const { client } = fixture({ pull: { head: { sha: 'b'.repeat(40) } } });
  const result = await client.refresh(entry, prior());
  assert.equal(result.row.ci.state, 'unknown');
  assert.deepEqual(result.row.ci.counts, {
    success: 0, failure: 0, pending: 0, gated: 0, cancelled: 0, neutral: 0,
  });
  assert.equal(result.row.ci.workflowCount, 0);
  assert.match(result.row.ci.summary, /different head/);
  assert.equal(result.row.checkedAt, prior().checkedAt);
  assert.equal(result.row.headSha, 'b'.repeat(40));
});

test('closed and merged direct observations have coherent history and merge timestamps', async () => {
  for (const merged_at of [null, iso(instant)]) {
    const { client } = fixture({ pull: { state: 'closed', merged_at } });
    const { row } = await client.refresh(entry, prior());
    assert.equal(row.state, merged_at ? 'MERGED' : 'CLOSED');
    assert.equal(row.historical, true);
    assert.equal(row.mergedAt, merged_at);
  }
});

test('five-minute cache makes no requests, uses current prior CI, and returns isolated data', async () => {
  const { client, calls, advance } = fixture();
  const first = await client.refresh(entry, prior());
  first.row.title = 'Mutated outside client';
  advance(299999);
  const updated = prior({ checkedAt: iso(instant + 1000), ci: { state: 'failure', summary: 'New scheduled CI' } });
  const cached = await client.refresh(entry, updated);
  assert.equal(cached.cached, true);
  assert.equal(cached.checkedAt, iso(instant));
  assert.equal(cached.row.title, pull().title);
  assert.equal(cached.row.ci.state, 'failure');
  assert.equal(cached.row.checkedAt, updated.checkedAt);
  assert.equal(calls.length, 5);
  advance(1);
  assert.equal((await client.refresh(entry, prior())).cached, false);
  assert.equal(calls.length, 10);
});

test('403/429 respect Retry-After and reset without automatically retrying', async () => {
  for (const status of [403, 429]) {
    const { client, calls, advance } = fixture({
      fetchImpl: () => json({ message: 'untrusted remote error' }, status, {
        'Retry-After': '120', 'X-RateLimit-Reset': `${(instant + 180000) / 1000}`,
      }),
    });
    await assert.rejects(client.refresh(entry, prior()), error => {
      assert.equal(error.retryAt, iso(instant + 180000));
      return errorCode('rate_limited')(error);
    });
    advance(179999);
    await assert.rejects(client.refresh(entry, prior()), errorCode('rate_limited'));
    assert.equal(calls.length, 1);
    advance(1);
    await assert.rejects(client.refresh(entry, prior()), errorCode('rate_limited'));
    assert.equal(calls.length, 2);
  }
});

test('HTTP-date Retry-After is honored and zero remaining blocks subsequent requests', async () => {
  const dated = fixture({ fetchImpl: () => json({}, 429, { 'Retry-After': new Date(instant + 120000).toUTCString() }) });
  await assert.rejects(dated.client.refresh(entry, prior()), error => error.retryAt === iso(instant + 120000));
  const empty = fixture({ fetchImpl: () => json(pull(), 200, {
    'X-RateLimit-Remaining': '0', 'X-RateLimit-Reset': `${(instant + 120000) / 1000}`,
  }) });
  await assert.rejects(empty.client.refresh(entry, prior()), errorCode('rate_limited'));
  assert.equal(empty.calls.length, 1);
});

test('sliding hourly budget counts actual requests and is shared by persisted clients', async () => {
  const storage = memoryStorage();
  const one = fixture({ storage, maxHourlyRequests: 5 });
  await one.client.refresh(entry, prior());
  assert.equal(one.client.warning, null);
  assert.equal(one.client.budgetScope, 'origin-best-effort');
  const two = fixture({ storage, maxHourlyRequests: 5 });
  await assert.rejects(two.client.refresh(entry, prior()), errorCode('hourly_budget'));
  assert.equal(two.calls.length, 0);
  two.advance(3600000);
  await two.client.refresh(entry, prior());
  assert.equal(two.calls.length, 5);
});

test('backoff survives a new client with the same storage', async () => {
  const storage = memoryStorage();
  const limited = fixture({ storage, fetchImpl: () => json({}, 429, { 'Retry-After': '300' }) });
  await assert.rejects(limited.client.refresh(entry, prior()), errorCode('rate_limited'));
  const next = fixture({ storage });
  await assert.rejects(next.client.refresh(entry, prior()), errorCode('rate_limited'));
  assert.equal(next.calls.length, 0);
});

test('unavailable or corrupt storage explicitly exposes tab-only protection', async () => {
  for (const storage of [null,
    { getItem() { throw new Error('denied'); }, setItem() {} },
    { getItem() { return null; }, setItem() { throw new Error('quota'); } },
    { getItem() { return '{"requests":false}'; }, setItem() {} },
  ]) {
    const { client } = fixture({ storage });
    assert.equal(client.budgetScope, 'tab');
    assert.match(client.warning, /only to this tab/);
    await client.refresh(entry, prior());
  }
});

test('attempt request ceiling fails rather than returning incomplete activity', async () => {
  const { client, calls } = fixture({ maxAttemptRequests: 4 });
  await assert.rejects(client.refresh(entry, prior()), errorCode('request_budget'));
  assert.equal(calls.length, 4);
});

test('cancelled and timed-out requests stop, release the client, and never cache success', async () => {
  const controller = new AbortController();
  controller.abort();
  const initial = fixture();
  await assert.rejects(initial.client.refresh(entry, prior(), { signal: controller.signal }), errorCode('cancelled'));
  assert.equal(initial.calls.length, 0);

  for (const timeout of [false, true]) {
    const controller = new AbortController();
    const slow = fixture({ timeoutMs: timeout ? 5 : 1000, fetchImpl: () => {
      if (!timeout) queueMicrotask(() => controller.abort());
      return new Promise(() => {});
    } });
    await assert.rejects(slow.client.refresh(entry, prior(), { signal: controller.signal }),
      errorCode(timeout ? 'timeout' : 'cancelled'));
    assert.equal(slow.calls.length, 1);
    assert.equal(slow.calls[0].init.signal.aborted, true);
  }
});

test('HTTP, network, JSON and changed-during-refresh failures preserve last good input and do not cache', async () => {
  for (const fetchImpl of [
    () => json({}, 503),
    () => { throw new Error('network'); },
    () => new Response('invalid JSON'),
    (url, init, count) => json(url.includes('?') ? [] : pull({ title: count % 5 === 1 ? 'Original' : 'Changed during observation' })),
  ]) {
    const { client, calls } = fixture({ fetchImpl });
    const previous = prior();
    const untouched = structuredClone(previous);
    await assert.rejects(client.refresh(entry, previous));
    assert.deepEqual(previous, untouched);
    const before = calls.length;
    await assert.rejects(client.refresh(entry, previous));
    assert.ok(calls.length > before);
  }
});

function comment(id, overrides = {}) {
  return { id, html_url: `${entry.url}#issuecomment-${id}`,
    body: 'Source-readable <b>text</b>, not rendered HTML.',
    created_at: iso(instant - 1000), updated_at: iso(instant - 1000),
    user: { login: 'unverified-contributor', id: 1234, type: 'User' }, ...overrides };
}

test('activity pagination completes at a short page without following supplied Link URLs', async () => {
  const { client, calls } = fixture({ fetchImpl: url => {
    if (!url.includes('?')) return json(pull());
    if (url.includes('/issues/')) {
      const page = Number(new URL(url).searchParams.get('page'));
      return json(page === 1 ? Array.from({ length: 100 }, (_, i) => comment(i + 1)) : [comment(101)],
        200, { Link: '<https://evil.example/private>; rel="next"' });
    }
    return json([]);
  } });
  const { row } = await client.refresh(entry, prior());
  assert.equal(calls.length, 6);
  assert.equal(row.activity.state, 'complete');
  const comments = row.activity.events.filter(event => event.kind === 'comment');
  assert.equal(comments.length, 101);
  assert.equal(comments[0].actor.classification, 'unknown');
  assert.equal(comments[0].body, comment(1).body);
  assert.ok(calls.every(({ url }) => url.startsWith('https://api.github.com/')));
});

test('large activity cannot silently truncate or exceed ten requests per selected attempt', async () => {
  const { client, calls } = fixture({ fetchImpl: url => {
    if (!url.includes('?')) return json(pull());
    const page = Number(new URL(url).searchParams.get('page'));
    return json(Array.from({ length: 100 }, (_, i) => comment(page * 100 + i)));
  } });
  const previous = prior();
  const unchanged = structuredClone(previous);
  await assert.rejects(client.refresh(entry, previous), errorCode('request_budget'));
  assert.equal(calls.length, 10);
  assert.deepEqual(previous, unchanged);
});

test('only explicit reviews, not comments, produce changes-requested activity', async () => {
  const { client } = fixture({ fetchImpl: url => {
    if (!url.includes('?')) return json(pull());
    if (url.includes('/issues/')) return json([comment(1, { body: 'Please change this; ordinary comment only.' })]);
    if (url.includes('/reviews?')) return json([{
      id: 2, html_url: `${entry.url}#pullrequestreview-2`, body: 'Requested revision.',
      state: 'CHANGES_REQUESTED', submitted_at: iso(instant - 1000), commit_id: sha,
      user: { login: 'unverified-contributor', id: 1234, type: 'User' },
    }]);
    return json([]);
  } });
  const { row } = await client.refresh(entry, prior());
  assert.equal(row.activity.review.state, 'changes_requested');
  assert.equal(row.activity.review.currentHead, true);
  assert.equal(row.activity.events.find(event => event.kind === 'review').actor.classification, 'unknown');
  const commentsOnly = fixture({ fetchImpl: url => json(!url.includes('?') ? pull() :
    url.includes('/issues/') ? [comment(1, { body: 'Please change this.' })] : []) });
  const result = await commentsOnly.client.refresh(entry, prior());
  assert.equal(result.row.activity.review.state, 'none');
});

test('default hourly cap allows at most 35 actual anonymous requests, including failed requests', async () => {
  const { client, calls, advance } = fixture({ fetchImpl: () => json({}, 503) });
  for (let i = 0; i < 35; i++) await assert.rejects(client.refresh(entry, prior()), errorCode('http_503'));
  await assert.rejects(client.refresh(entry, prior()), errorCode('hourly_budget'));
  assert.equal(calls.length, 35);
  advance(3600000);
  await assert.rejects(client.refresh(entry, prior()), errorCode('http_503'));
  assert.equal(calls.length, 36);
});

test('concurrent uncached attempts are refused and cancellation allows a later attempt', async () => {
  let started;
  const ready = new Promise(resolve => { started = resolve; });
  let hanging = true;
  const { client, calls } = fixture({ fetchImpl: url => {
    if (hanging) { started(); return new Promise(() => {}); }
    return json(url.includes('?') ? [] : pull());
  } });
  const controller = new AbortController();
  const request = client.refresh(entry, prior(), { signal: controller.signal });
  await ready;
  await assert.rejects(client.refresh(entry, prior()), errorCode('busy'));
  controller.abort();
  await assert.rejects(request, errorCode('cancelled'));
  hanging = false;
  assert.equal((await client.refresh(entry, prior())).cached, false);
  assert.equal(calls.length, 6);
});
