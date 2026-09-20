import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { collect, collectOne, CollectionError, createClient, main, manifestHash, readSnapshot,
  summarizeCI, validateManifest } from '../scripts/collect.mjs';
import { build } from '../scripts/build.mjs';

const time = '2026-09-18T22:41:34Z';
const sha = 'a'.repeat(40);
const entry = { owner: 'example', repo: 'public-repo', number: 1,
  url: 'https://github.com/example/public-repo/pull/1', project: 'Example',
  summary: 'A public change.', note: 'Historical context.', noteAsOf: time };
const manifest = [entry];
const pr = () => ({ number: 1, user: { login: 'LeulTew', id: 107800362 },
  base: { repo: { private: false, full_name: 'example/public-repo',
    owner: { login: 'example' }, name: 'public-repo' } },
  html_url: entry.url, head: { sha }, state: 'open', title: 'Fix public behavior', draft: false,
  created_at: time, updated_at: time, merged_at: null });
const check = (id = 1, conclusion = 'success') => ({ id, name: 'test', head_sha: sha,
  status: 'completed', conclusion, app: { id: 100 } });
const workflow = (id = 10, conclusion = 'success') => ({ ...check(id, conclusion),
  name: 'Node CI', workflow_id: 1000, run_number: id, run_attempt: 1 });
const status = (id = 1, state = 'success') => ({ id, context: 'external', state });
const envelope = (key, rows, count = rows.length) => ({ [key]: rows, total_count: count });
function fixture({ pull = pr(), checks = [], statuses = [], workflows = [], mutate, calls = [] } = {}) {
  return async path => {
    calls.push(path);
    if (/\/(?:comments|reviews)\?/.test(path)) return [];
    if (path.includes('/pulls/')) return pull;
    const page = Number(new URL(`https://api.github.com${path}`).searchParams.get('page'));
    let data;
    if (path.includes('/check-runs?')) data = envelope('check_runs', checks.slice((page - 1) * 100, page * 100), checks.length);
    else if (path.includes('/status?')) data = { sha, ...envelope('statuses', statuses.slice((page - 1) * 100, page * 100), statuses.length) };
    else if (path.includes('/actions/runs?')) data = envelope('workflow_runs', workflows.slice((page - 1) * 100, page * 100), workflows.length);
    else throw new Error(`Unexpected fixture request: ${path}`);
    return mutate ? mutate(data, path) : data;
  };
}
const snapshot = get => collect({ manifest, get: get ?? fixture(), now: () => time });

test('manifest rejects duplicate, noncanonical, unsafe and nonpublic identity fields', () => {
  assert.equal(validateManifest(manifest), manifest);
  for (const changed of [{ owner: '../private' }, { repo: '..' }, { number: '1' },
    { url: 'https://github.com/other/repo/pull/1' }, { noteAsOf: 'not a date' },
    { machinePath: 'private' }]) assert.throws(() => validateManifest([{ ...entry, ...changed }]));
  assert.throws(() => validateManifest([entry, entry]));
});

test('hash is stable and changes with manifest context', () => {
  assert.equal(manifestHash(manifest), manifestHash(structuredClone(manifest)));
  assert.notEqual(manifestHash(manifest), manifestHash([{ ...entry, note: 'Changed' }]));
});

test('empty CI is unknown and exact-head workflows are always fetched', async () => {
  const calls = [];
  const row = await collectOne(entry, fixture({ calls }), () => time);
  assert.equal(row.ci.state, 'unknown');
  assert.equal(row.checkedAt, time);
  assert.ok(calls.some(path => path.includes(`/actions/runs?head_sha=${sha}`)));
});

test('successful Socket checks cannot conceal approval-gated workflows', async () => {
  const row = await collectOne(entry, fixture({ checks: [{ ...check(), name: 'Socket Security' }],
    workflows: [workflow(10, 'action_required')] }));
  assert.equal(row.ci.state, 'gated');
  assert.equal(row.ci.counts.success, 1);
  assert.equal(row.ci.counts.gated, 1);
});

test('empty checks with action_required workflow stay gated', async () => {
  const row = await collectOne(entry, fixture({ workflows: [workflow(10, 'action_required')] }));
  assert.equal(row.ci.state, 'gated');
});

test('latest check, context and workflow reruns supersede old outcomes', () => {
  const ci = summarizeCI([check(1, 'failure'), check(2)],
    [status(1, 'failure'), status(2)], [workflow(10, 'action_required'), workflow(11)], sha);
  assert.equal(ci.state, 'success');
  assert.equal(ci.counts.success, 3);
  assert.equal(ci.workflowCount, 1);
});

test('cancellation, neutral, skip, failure, running and waiting remain distinct', () => {
  assert.equal(summarizeCI([check(1, 'cancelled')], [], [], sha).state, 'cancelled');
  for (const outcome of ['neutral', 'skipped']) {
    const ci = summarizeCI([check(1, outcome)], [], [], sha);
    assert.equal(ci.state, 'unknown');
    assert.equal(ci.counts.neutral, 1);
    assert.equal(ci.counts.success, 0);
  }
  assert.equal(summarizeCI([check(1, 'timed_out')], [], [], sha).state, 'failure');
  assert.equal(summarizeCI([{ ...check(), status: 'in_progress', conclusion: null }], [], [], sha).state, 'pending');
  assert.equal(summarizeCI([], [], [{ ...workflow(), status: 'waiting', conclusion: null }], sha).state, 'gated');
});

test('pagination fully collects all three CI sources and deduplicates after collection', async () => {
  const checks = Array.from({ length: 101 }, (_, i) => check(i + 1));
  const statuses = Array.from({ length: 101 }, (_, i) => status(i + 1));
  const workflows = Array.from({ length: 101 }, (_, i) => workflow(i + 1));
  const calls = [];
  const row = await collectOne(entry, fixture({ checks, statuses, workflows, calls }));
  assert.equal(calls.length, 11);
  assert.equal(row.ci.counts.success, 3);
});

test('incomplete, drifting, duplicate and excessive pagination fail closed', async () => {
  await assert.rejects(collectOne(entry, fixture({ mutate: data => ({ ...data, total_count: 101 }) })),
    /incomplete_pagination/);
  const checks = Array.from({ length: 101 }, (_, i) => check(i + 1));
  await assert.rejects(collectOne(entry, fixture({ checks, mutate: (data, path) =>
    path.includes('page=2') ? { ...data, total_count: 102 } : data })), /pagination_changed/);
  await assert.rejects(collectOne(entry, fixture({ checks: [check(), check()] })), /invalid_api_schema/);
  const excessive = Array.from({ length: 2001 }, (_, i) => check(i + 1));
  await assert.rejects(collectOne(entry, fixture({ checks: excessive })), /pagination_limit/);
});

test('head mismatches and unknown response schemas never produce green', async () => {
  await assert.rejects(collectOne(entry, fixture({ checks: [{ ...check(), head_sha: 'b'.repeat(40) }] })), /head_mismatch/);
  await assert.rejects(collectOne(entry, fixture({ workflows: [{ ...workflow(), head_sha: 'b'.repeat(40) }] })), /head_mismatch/);
  await assert.rejects(collectOne(entry, fixture({ mutate: (data, path) =>
    path.includes('/status?') ? { ...data, sha: 'b'.repeat(40) } : data })), /head_mismatch/);
  await assert.rejects(collectOne(entry, fixture({ checks: [{ ...check(), conclusion: 'new_undocumented_value' }] })), /invalid_api_schema/);
  await assert.rejects(collectOne(entry, fixture({ mutate: () => ({}) })), /invalid_api_schema/);
});

test('canonical public repository and fixed author must match every observation', async () => {
  for (const mutate of [
    data => { data.user.id = 2; },
    data => { data.user.login = 'Other'; },
    data => { data.base.repo.private = true; },
    data => { data.base.repo.full_name = 'other/repo'; },
    data => { data.html_url = 'https://github.com/other/repo/pull/1'; },
    data => { data.number = 2; },
  ]) {
    const pull = pr();
    mutate(pull);
    await assert.rejects(collectOne(entry, fixture({ pull })), /identity_mismatch/);
  }
});

test('head changes while collecting invalidate the new observation', async () => {
  const get = fixture();
  let reads = 0;
  await assert.rejects(collectOne(entry, async path => {
    const result = await get(path);
    if (path.includes('/pulls/') && reads++ > 0) return { ...result, head: { sha: 'b'.repeat(40) } };
    return result;
  }), /pull_request_changed/);
});

test('failed collection without verified prior evidence fails atomically', async () => {
  await assert.rejects(snapshot(async () => { throw new Error('secret upstream response'); }), /no_verified_snapshot/);
});

test('errors preserve last-good checkedAt but never fake fresh green', async () => {
  const previous = await snapshot(fixture({ checks: [check()] }));
  const result = await collect({ manifest, previous, now: () => '2026-09-19T00:00:00Z',
    get: async () => { throw new Error('Bearer secret-token machine-path'); } });
  const row = result.contributions[0];
  assert.equal(row.state, 'OPEN');
  assert.equal(row.historical, false);
  assert.equal(row.stale, true);
  assert.equal(row.checkedAt, time);
  assert.equal(row.error, 'collection_unavailable');
  assert.equal(row.ci.state, 'unknown');
  assert.equal(row.ci.counts.success, 1);
  assert.equal(result.fetchedAt, '2026-09-19T00:00:00Z');
  assert.ok(!JSON.stringify(result).includes('secret-token'));
});

test('verified terminal observations retain their historical check time without further API requests', async () => {
  for (const merged_at of [null, time]) {
    const previous = await snapshot(fixture({ pull: { ...pr(), state: 'closed', merged_at }, checks: [check()] }));
    let requests = 0;
    const result = await collect({ manifest, previous, now: () => '2026-09-19T00:00:00Z',
      get: async () => { requests++; throw new Error('No terminal refresh expected'); } });
    assert.equal(requests, 0);
    assert.equal(result.contributions[0].state, merged_at ? 'MERGED' : 'CLOSED');
    assert.equal(result.contributions[0].historical, true);
    assert.equal(result.contributions[0].checkedAt, time);
    assert.equal(result.contributions[0].stale, false);
    assert.equal(result.contributions[0].ci.state, 'success');
    assert.equal(result.fetchedAt, '2026-09-19T00:00:00Z');
  }
});

test('stale terminal evidence is retried instead of frozen as a verified observation', async () => {
  const previous = await snapshot(fixture({ pull: { ...pr(), state: 'closed', merged_at: time } }));
  previous.contributions[0].stale = true;
  previous.contributions[0].error = 'api_http_403';
  const calls = [];
  const result = await collect({ manifest, previous,
    get: fixture({ pull: { ...pr(), state: 'closed', merged_at: time }, checks: [check()], calls }) });
  assert.equal(calls.length, 8);
  assert.equal(result.contributions[0].stale, false);
  assert.equal(result.contributions[0].ci.state, 'success');
});

test('cached evidence cannot cross manifests, identities, or malformed terminal records', async () => {
  const previous = await snapshot();
  assert.equal(readSnapshot(previous, manifest).size, 1);
  assert.equal(readSnapshot(previous, [{ ...entry, note: 'Changed' }]).size, 0);
  const wrong = structuredClone(previous);
  wrong.contributions[0].number = 20;
  assert.equal(readSnapshot(wrong, manifest).size, 0);
  const malformed = structuredClone(previous);
  malformed.contributions[0].state = 'MERGED';
  assert.equal(readSnapshot(malformed, manifest).size, 0);
  const duplicate = structuredClone(previous);
  duplicate.contributions.push(duplicate.contributions[0]);
  assert.equal(readSnapshot(duplicate, manifest).size, 0);
});

test('HTTP uses only fixed HTTPS API, env-supplied credential and no redirects', async () => {
  const calls = [];
  const get = createClient({ token: 'fixture-token', fetchImpl: async (...args) => {
    calls.push(args);
    return new Response('{}', { status: 200 });
  } });
  await get('/repos/example/public-repo/pulls/1');
  assert.equal(calls[0][0], 'https://api.github.com/repos/example/public-repo/pulls/1');
  assert.equal(calls[0][1].redirect, 'error');
  assert.equal(calls[0][1].headers.Authorization, 'Bearer fixture-token');
  for (const path of ['https://private.example/', '//private.example', '/repos/example/../pulls/1']) {
    await assert.rejects(get(path), /invalid_api_path/);
  }
  assert.equal(calls.length, 1);
});

test('rate and network retries are bounded and do not disclose API response bodies', async () => {
  const delays = [];
  let calls = 0;
  const get = createClient({ fetchImpl: async () => {
    calls++;
    return new Response('private secret dump', { status: 403,
      headers: { 'x-ratelimit-remaining': '0', 'retry-after': '9999' } });
  }, sleep: async ms => delays.push(ms) });
  await assert.rejects(get('/repos/example/public-repo/pulls/1'), error =>
    error instanceof CollectionError && error.message === 'api_rate_or_service_limit');
  assert.equal(calls, 3);
  assert.deepEqual(delays, [5000, 5000]);
  let retries = 0;
  const recover = createClient({ fetchImpl: async () => {
    if (retries++ === 0) throw new Error('network secret');
    return new Response('{"ok":true}');
  }, sleep: async () => {} });
  assert.deepEqual(await recover('/repos/example/public-repo/pulls/1'), { ok: true });
});

test('nonretryable 404, redirects, invalid JSON and timeouts stay sanitized', async () => {
  for (const [response, message] of [[new Response('secret', { status: 404 }), 'api_http_404'],
    [new Response('secret', { status: 302 }), 'api_http_302'],
    [new Response('not-json'), 'invalid_api_schema']]) {
    let calls = 0;
    const get = createClient({ fetchImpl: async () => { calls++; return response; } });
    await assert.rejects(get('/repos/example/public-repo/pulls/1'), { message });
    assert.equal(calls, 1);
  }
  const get = createClient({ fetchImpl: async () => { throw new Error('timeout secret'); },
    sleep: async () => {} });
  await assert.rejects(get('/repos/example/public-repo/pulls/1'), /network_unavailable/);
});

test('actual HTTP request budget includes retries and stops before exceeding the ceiling', async () => {
  let requests = 0;
  const get = createClient({ requestBudget: 2, fetchImpl: async () => {
    requests++;
    return new Response('', { status: 503 });
  }, sleep: async () => {} });
  await assert.rejects(get('/repos/example/public-repo/pulls/1'), /request_budget_exhausted/);
  await assert.rejects(get('/repos/example/public-repo/pulls/1'), /request_budget_exhausted/);
  assert.equal(requests, 2);
  assert.throws(() => createClient({ requestBudget: 241 }), /invalid_request_budget/);
});

test('v1 terminal snapshots hydrate activity once and preserve historical core checkedAt', async () => {
  const previous = await snapshot(fixture({ pull: { ...pr(), state: 'closed', merged_at: time } }));
  previous.schemaVersion = 1;
  delete previous.contributions[0].activity;
  assert.equal(readSnapshot(previous, manifest).get('example/public-repo#1').activity.state, 'unavailable');
  const calls = [];
  const result = await collect({ manifest, previous, now: () => '2026-09-19T00:00:00Z',
    get: fixture({ pull: { ...pr(), state: 'closed', merged_at: time }, calls }) });
  assert.equal(calls.length, 8);
  assert.equal(result.schemaVersion, 2);
  assert.equal(result.contributions[0].checkedAt, time);
  assert.equal(result.contributions[0].activity.checkedAt, '2026-09-19T00:00:00Z');
  assert.equal(result.contributions[0].activity.state, 'complete');
  await collect({ manifest, previous: result,
    get: async () => { assert.fail('hydrated terminal row must stay cached'); } });
});

test('activity failures preserve old activity with unavailable marker and never fabricate a clean inbox', async () => {
  const previous = await snapshot();
  const underlying = fixture();
  const get = async path => {
    if (path.includes('/issues/')) throw new CollectionError('api_http_403');
    return underlying(path);
  };
  const result = await collect({ manifest, previous, get, now: () => '2026-09-19T00:00:00Z' });
  const row = result.contributions[0];
  assert.equal(row.stale, true);
  assert.equal(row.activity.state, 'unavailable');
  assert.equal(row.activity.error, 'api_http_403');
  assert.equal(row.activity.checkedAt, time);
  assert.deepEqual(row.activity.events, previous.contributions[0].activity.events);
  assert.deepEqual(row.activity.review, { state: 'unknown', currentHead: false });
  assert.equal(readSnapshot(result, manifest).size, 1);
  const first = await collect({ manifest, get, now: () => time });
  assert.equal(first.contributions[0].activity.checkedAt, null);
});

test('malformed v2 activity cannot be consumed as a v1 snapshot', async () => {
  const previous = await snapshot();
  delete previous.contributions[0].activity;
  assert.equal(readSnapshot(previous, manifest).size, 0);
  const changed = await snapshot();
  changed.contributions[0].activity.events[0].headSha = 'b'.repeat(40);
  assert.equal(readSnapshot(changed, manifest).size, 0);
});

test('v1 migration retains the dated prior head observation when a new head is collected', async () => {
  const previous = await snapshot();
  previous.schemaVersion = 1;
  delete previous.contributions[0].activity;
  const nextSha = 'b'.repeat(40);
  const get = fixture({ pull: { ...pr(), head: { sha: nextSha } },
    mutate: (data, path) => path.includes('/status?') ? { ...data, sha: nextSha } : data });
  const result = await collect({ manifest, previous, get, now: () => '2026-09-19T00:00:00Z' });
  const heads = result.contributions[0].activity.events.filter(event => event.kind === 'head_update');
  assert.equal(heads.length, 2);
  assert.equal(heads[0].date, time);
  assert.equal(heads[0].headSha, sha);
  assert.equal(heads[1].previousHeadSha, sha);
  assert.equal(heads[1].headSha, nextSha);
});

test('build publishes only site and public config, never cache or initial-state', async t => {
  const root = resolve('test', '.backend-fixtures', 'safe-build');
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(resolve(root, 'site'), { recursive: true });
  await mkdir(resolve(root, 'config'), { recursive: true });
  await writeFile(resolve(root, 'config', 'contributions.json'), JSON.stringify(manifest));
  await writeFile(resolve(root, 'config', 'quotes.json'), '[]');
  await writeFile(resolve(root, 'config', 'initial-state.json'), '{"private":"not for publishing"}');
  await writeFile(resolve(root, 'PRIVATE.md'), 'private notes');
  await writeFile(resolve(root, 'site', 'index.html'), '<!doctype html><title>Fixture</title>');
  await writeFile(resolve(root, 'site', 'data.json'), JSON.stringify(await snapshot()));
  await build(root);
  assert.ok((await readFile(resolve(root, 'dist', 'index.html'), 'utf8')).includes('Fixture'));
  assert.deepEqual(JSON.parse(await readFile(resolve(root, 'dist', 'catalog.json'), 'utf8')), manifest);
  assert.deepEqual(JSON.parse(await readFile(resolve(root, 'dist', 'fallback.json'), 'utf8')),
    JSON.parse(await readFile(resolve(root, 'dist', 'data.json'), 'utf8')));
  await assert.rejects(readFile(resolve(root, 'dist', 'PRIVATE.md')), { code: 'ENOENT' });
  await assert.rejects(readFile(resolve(root, 'dist', 'config', 'initial-state.json')), { code: 'ENOENT' });
  await writeFile(resolve(root, 'site', 'markdown.mjs'), await readFile(new URL('../site/markdown.mjs', import.meta.url), 'utf8'));
  await build(root);
  const renderer = await import(pathToFileURL(resolve(root, 'dist', 'markdown.mjs')).href);
  assert.equal(typeof renderer.renderMarkdown, 'function');
  const notices = await readFile(resolve(root, 'dist', 'THIRD-PARTY-LICENSES.txt'), 'utf8');
  assert.match(notices, /marked 18\.0\.13 \(MIT\)/);
  assert.match(notices, /parse5 8\.0\.1 \(MIT\)/);
  assert.match(notices, /entities .* \(BSD-2-Clause\)/);
  assert.doesNotMatch(await readFile(resolve(root, 'dist', 'vendor', 'parse5', 'tokenizer', 'index.js'), 'utf8'), /from ['"]entities/);
  await writeFile(resolve(root, 'site', '.env'), 'secret');
  await assert.rejects(build(root), /Hidden site content/);
});

test('initial-state bootstrap retains terminal evidence and cache survives subsequent failures', async t => {
  const root = resolve('test', '.backend-fixtures', 'cache-bootstrap');
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(resolve(root, 'config'), { recursive: true });
  await writeFile(resolve(root, 'config', 'contributions.json'), JSON.stringify(manifest));
  await writeFile(resolve(root, 'config', 'quotes.json'), '[]');
  const initial = await snapshot(fixture({ pull: { ...pr(), state: 'closed', merged_at: time } }));
  await writeFile(resolve(root, 'config', 'initial-state.json'), JSON.stringify(initial));
  const get = async () => { throw new CollectionError('api_http_403'); };
  await main(root, { get });
  const state = JSON.parse(await readFile(resolve(root, '.cache', 'contributions.json'), 'utf8'));
  assert.equal(state.contributions[0].state, 'MERGED');
  assert.equal(state.contributions[0].checkedAt, time);
  assert.equal(state.contributions[0].stale, false);
  await rm(resolve(root, 'config', 'initial-state.json'));
  await main(root, { get });
  const published = await readFile(resolve(root, 'site', 'data.json'), 'utf8');
  await writeFile(resolve(root, 'config', 'contributions.json'), JSON.stringify([{ ...entry, note: 'Changed manifest' }]));
  await assert.rejects(main(root, { get }), /no_verified_snapshot/);
  assert.equal(await readFile(resolve(root, 'site', 'data.json'), 'utf8'), published);
});
