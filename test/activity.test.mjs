import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { classifyActor, collectActivity, hashBody, paginateActivity,
  unavailableActivity, validateActivity } from '../site/activity.mjs';

const time = '2026-09-18T22:41:34Z';
const later = '2026-09-19T00:00:00Z';
const sha = 'a'.repeat(40);
const otherSha = 'b'.repeat(40);
const entry = { owner: 'example', repo: 'public-repo', number: 1,
  url: 'https://github.com/example/public-repo/pull/1' };
const user = (login = 'unverified-reviewer', id = 2, type = 'User') => ({ login, id, type });
const comment = (id = 1, body = 'Thanks @SukkaW', actor = user()) => ({
  id, body, user: actor, html_url: `${entry.url}#issuecomment-${id}`,
  created_at: time, updated_at: time,
});
const review = (id = 1, state = 'CHANGES_REQUESTED', commit_id = sha, actor = user()) => ({
  id, body: '', user: actor, html_url: `${entry.url}#pullrequestreview-${id}`,
  submitted_at: time, state, commit_id,
});
function getFixture({ comments = [], reviews = [], inline = [] } = {}) {
  return async path => {
    const page = Number(new URL(`https://api.github.com${path}`).searchParams.get('page'));
    const rows = path.includes('/issues/') ? comments : path.includes('/reviews?') ? reviews : inline;
    return rows.slice((page - 1) * 100, page * 100);
  };
}
const collect = (fixture = {}, prior = null, head = sha, at = time) =>
  collectActivity(entry, { head: { sha: head }, state: 'open', merged_at: null }, getFixture(fixture), prior, at);

test('browser-compatible SHA256 matches Node including unicode and maximum bodies', () => {
  for (const body of ['', 'abc', '<script>not interpreted</script>', '🌍\nمرحبا', 'a'.repeat(65536)]) {
    assert.equal(hashBody(body), createHash('sha256').update(body).digest('hex'));
  }
});

test('classification requires curated exact identity and never treats arbitrary Users as human', () => {
  for (const [actor, classification] of [
    [user('LeulTew', 107800362), 'author'],
    [user('LeulTew', 3), 'unknown'],
    [user('codecov-commenter', 65553080), 'automation'],
    [user('codecov-commenter', 3), 'unknown'],
    [user('github-actions[bot]', 41898282, 'Bot'), 'automation'],
    [user('service', 42, 'Bot'), 'automation'],
    [user('appleboy', 21979), 'human'],
    [user('markerikson', 1128784), 'human'],
    [user('appleboy', 3), 'unknown'],
    [user('VojtechVitek', 139342), 'human'],
    [user('VojtechVitek', 3), 'unknown'],
    [user('JounQin', 8336744), 'unknown'],
    [user(), 'unknown'], [null, 'unknown'],
  ]) assert.equal(classifyActor(actor).classification, classification);
  assert.throws(() => classifyActor({ login: 'bad/url', id: 2, type: 'User' }));
});

test('array pagination requests a terminating empty page after full pages, ignores Link URLs', async () => {
  const calls = [];
  const rows = await paginateActivity(async path => {
    calls.push(path);
    return calls.length < 3 ? Array(100).fill({ id: calls.length }) : [];
  }, '/repos/example/public-repo/issues/1/comments');
  assert.equal(rows.length, 200);
  assert.equal(calls.length, 3);
  assert.ok(calls[2].endsWith('per_page=100&page=3'));
  await assert.rejects(paginateActivity(async () => Array(100).fill({ id: 1 }),
    '/repos/example/public-repo/issues/1/comments'), /activity_pagination_limit/);
  await assert.rejects(paginateActivity(async () => ({}),
    '/repos/example/public-repo/issues/1/comments'), /invalid_activity_schema/);
});

test('exact duplicates deduplicate, but changed actor/date/body for one ID rejects snapshot', async () => {
  const value = await collect({ comments: [comment(), comment()] });
  assert.equal(value.events.filter(event => event.kind === 'comment').length, 1);
  for (const change of [{ body: 'edited' }, { user: user('other', 4) }, { updated_at: later }]) {
    await assert.rejects(collect({ comments: [comment(), { ...comment(), ...change }] }),
      /activity_pagination_changed/);
  }
});

test('comments and empty approval bodies never create praise or requests inferred from prose', async () => {
  const value = await collect({ comments: [comment(5749503680)] });
  assert.deepEqual(value.review, { state: 'none', currentHead: false });
  assert.equal(value.events[0].body, 'Thanks @SukkaW');
  const approval = await collect({ reviews: [review(1, 'APPROVED')] });
  assert.deepEqual(approval.review, { state: 'approved', currentHead: true });
  assert.equal(approval.events.find(event => event.kind === 'review').body, '');
});

test('explicit reviews handle latest decisions, old heads, dismissal, authors and automation', async () => {
  const unknown = await collect({ reviews: [review()] });
  assert.equal(unknown.review.state, 'changes_requested');
  assert.equal(unknown.events.find(event => event.kind === 'review').actor.classification, 'unknown');
  assert.deepEqual((await collect({ reviews: [review(1, 'APPROVED', otherSha)] })).review,
    { state: 'approved', currentHead: false });
  assert.equal((await collect({ reviews: [review(), review(2, 'APPROVED')] })).review.state, 'approved');
  assert.equal((await collect({ reviews: [review(), review(2, 'COMMENTED')] })).review.state, 'changes_requested');
  assert.equal((await collect({ reviews: [review(), review(2, 'DISMISSED')] })).review.state, 'none');
  for (const actor of [user('LeulTew', 107800362), user('codecov-commenter', 65553080),
    user('reviewer[bot]', 55, 'Bot')]) {
    assert.equal((await collect({ reviews: [review(1, 'CHANGES_REQUESTED', sha, actor)] })).review.state, 'none');
  }
  assert.equal((await collect({ reviews: [{ ...review(), state: 'PENDING', submitted_at: null }] })).review.state, 'none');
});

test('head updates are dated observations, retained unchanged through future collections', async () => {
  const initial = await collect();
  const same = await collect({}, initial, sha, later);
  assert.equal(same.events.length, 1);
  assert.equal(same.events[0].date, time);
  assert.equal(same.checkedAt, later);
  const changed = await collect({}, same, otherSha, later);
  assert.equal(changed.events.length, 2);
  assert.equal(changed.events[1].previousHeadSha, sha);
  assert.equal(changed.events[1].date, later);
  assert.equal(changed.events[1].actor.classification, 'unknown');
  assert.throws(() => validateActivity(changed, { ...entry, headSha: sha }), /activity_head_mismatch/);
});

test('inline comments retain source commit binding and submitted review URLs are canonical', async () => {
  const inline = { ...comment(), html_url: `${entry.url}#discussion_r1`, commit_id: otherSha };
  const value = await collect({ inline: [inline] });
  assert.equal(value.events.find(event => event.kind === 'review_comment').headSha, otherSha);
  for (const item of [{ ...inline, commit_id: 'bad' }, { ...inline, html_url: 'https://evil.test/' }]) {
    await assert.rejects(collect({ inline: [item] }));
  }
});

test('validation rejects corrupt hashes, chronology, fields, source identity and head bindings', async () => {
  const original = await collect({ reviews: [review()], comments: [comment()] });
  for (const mutate of [
    value => { value.events[0].bodyHash = '0'.repeat(64); },
    value => { value.events[0].url = 'https://github.com/other/repo/pull/1'; },
    value => { value.review.currentHead = false; },
    value => { value.events[0].actor.classification = 'human'; },
    value => { value.events[0].updatedAt = '2020-01-01T00:00:00Z'; },
    value => { value.events[0].body = 'a'.repeat(65537); },
    value => { value.events.push(value.events[0]); },
    value => { value.events.find(event => event.kind === 'head_update').previousHeadSha = otherSha; },
  ]) {
    const value = structuredClone(original);
    mutate(value);
    assert.throws(() => validateActivity(value, entry));
  }
});

test('unavailable activity preserves last-good evidence and never reports no-action', async () => {
  const original = await collect({ reviews: [review()] });
  const value = unavailableActivity(original, 'api_http_403');
  assert.equal(value.checkedAt, time);
  assert.deepEqual(value.events, original.events);
  assert.deepEqual(value.review, { state: 'unknown', currentHead: false });
  assert.equal(validateActivity(value, { ...entry, headSha: otherSha }), value);
  assert.equal(unavailableActivity(null, 'secret/path').error, 'activity_unavailable');
  assert.equal(validateActivity(unavailableActivity(), entry).checkedAt, null);
});

test('terminal events use actual merged/closed API dates, never refresh time', async () => {
  for (const [kind, extra] of [['merged', { merged_at: time }], ['closed', { closed_at: time }]]) {
    const value = await collectActivity(entry, { head: { sha }, state: 'closed', ...extra },
      getFixture(), null, later);
    assert.equal(value.events.find(event => event.kind === kind).date, time);
  }
});
