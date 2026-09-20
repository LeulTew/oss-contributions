// Shared by scheduled collection and the tokenless, selected-PR browser refresh.
const SHA = /^[a-f0-9]{40}$/;
const HASH = /^[a-f0-9]{64}$/;
const kinds = new Set(['comment', 'review', 'review_comment', 'head_update', 'merged', 'closed']);
const reviewStates = new Set(['APPROVED', 'CHANGES_REQUESTED', 'COMMENTED', 'DISMISSED']);
const classifications = new Set(['author', 'human', 'automation', 'unknown']);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const integer = value => Number.isSafeInteger(value) && value > 0;
const iso = value => typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
  Number.isFinite(Date.parse(value));
const knownHumans = new Map([['appleboy', 21979], ['markerikson', 1128784], ['vojtechvitek', 139342]]);
const knownAutomation = new Map([['codecov-commenter', 65553080]]);
const unknownActor = () => ({ login: 'unknown', id: null, classification: 'unknown' });
export class ActivityError extends Error {
  constructor(code) { super(code); this.code = code; }
}
const fail = code => { throw new ActivityError(code); };

export function classifyActor(user) {
  if (user === null || user === undefined) return unknownActor();
  if (!object(user) || !/^[a-zA-Z0-9][a-zA-Z0-9_-]*(?:\[bot\])?$/.test(user.login ?? '') ||
      !integer(user.id) || !['User', 'Bot', 'GitHubBot', 'Organization'].includes(user.type)) fail('invalid_activity_actor');
  const login = user.login.toLowerCase();
  let classification = 'unknown';
  if (login === 'leultew' && user.id === 107800362) classification = 'author';
  else if (['Bot', 'GitHubBot'].includes(user.type) || knownAutomation.get(login) === user.id) classification = 'automation';
  else if (user.type === 'User' && knownHumans.get(login) === user.id) classification = 'human';
  return { login: user.login, id: user.id, classification };
}

// A synchronous SHA-256 keeps snapshot validation equally strict in Node and browsers.
export function hashBody(body) {
  if (typeof body !== 'string') fail('invalid_activity_body');
  const bytes = new TextEncoder().encode(body);
  const size = Math.ceil((bytes.length + 9) / 64) * 64;
  const data = new Uint8Array(size);
  data.set(bytes);
  data[bytes.length] = 128;
  const view = new DataView(data.buffer);
  view.setUint32(size - 8, Math.floor(bytes.length / 0x20000000));
  view.setUint32(size - 4, bytes.length * 8);
  const k = [
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2,
  ];
  const h = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const rotate = (x, n) => (x >>> n) | (x << (32 - n));
  const w = new Uint32Array(64);
  for (let offset = 0; offset < size; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4);
    for (let i = 16; i < 64; i++) {
      const x = w[i - 15], y = w[i - 2];
      w[i] = w[i - 16] + (rotate(x, 7) ^ rotate(x, 18) ^ (x >>> 3)) + w[i - 7] +
        (rotate(y, 17) ^ rotate(y, 19) ^ (y >>> 10));
    }
    let [a,b,c,d,e,f,g,h0] = h;
    for (let i = 0; i < 64; i++) {
      const t1 = (h0 + (rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25)) +
        ((e & f) ^ (~e & g)) + k[i] + w[i]) | 0;
      const t2 = ((rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      h0=g; g=f; f=e; e=(d+t1)|0; d=c; c=b; b=a; a=(t1+t2)|0;
    }
    [a,b,c,d,e,f,g,h0].forEach((value, i) => { h[i] = (h[i] + value) | 0; });
  }
  return h.map(value => (value >>> 0).toString(16).padStart(8, '0')).join('');
}

function sourceURL(entry, kind, id) {
  if (kind === 'comment') return `${entry.url}#issuecomment-${id}`;
  if (kind === 'review') return `${entry.url}#pullrequestreview-${id}`;
  if (kind === 'review_comment') return `${entry.url}#discussion_r${id}`;
  return entry.url;
}

export async function paginateActivity(get, path) {
  if (!/^\/repos\/[a-zA-Z0-9-]+\/[a-zA-Z0-9_.-]+\/(?:issues|pulls)\/[1-9]\d*\/(?:comments|reviews)$/.test(path) ||
      path.includes('..')) fail('invalid_api_path');
  const rows = [];
  for (let page = 1; page <= 20; page++) {
    const data = await get(`${path}?per_page=100&page=${page}`);
    if (!Array.isArray(data) || data.length > 100) fail('invalid_activity_schema');
    rows.push(...data);
    if (data.length < 100) return rows;
  }
  fail('activity_pagination_limit');
}

export function summarizeReviews(events, headSha) {
  const latest = new Map();
  const reviewer = event => event.actor.id ?? event.id;
  for (const event of events) {
    if (event.kind !== 'review' || ['automation', 'author'].includes(event.actor.classification)) continue;
    const key = reviewer(event);
    const prior = latest.get(key);
    if (!prior || Date.parse(event.date) > Date.parse(prior.date) ||
        (Date.parse(event.date) === Date.parse(prior.date) &&
          Number(event.id.split(':')[1]) > Number(prior.id.split(':')[1]))) latest.set(key, event);
  }
  // A later COMMENTED review does not dismiss a prior explicit decision.
  const decisions = [];
  for (const actor of latest.keys()) {
    const explicit = events.filter(event => event.kind === 'review' &&
      reviewer(event) === actor &&
      event.state !== 'COMMENTED').sort((a, b) => Date.parse(b.date) - Date.parse(a.date) ||
        Number(b.id.split(':')[1]) - Number(a.id.split(':')[1]));
    if (explicit.length) decisions.push(explicit[0]);
  }
  const requests = decisions.filter(event => event.state === 'CHANGES_REQUESTED');
  if (requests.length) return { state: 'changes_requested', currentHead: requests.every(event => event.headSha === headSha) };
  const approvals = decisions.filter(event => event.state === 'APPROVED');
  if (approvals.length) return { state: 'approved', currentHead: approvals.every(event => event.headSha === headSha) };
  return { state: 'none', currentHead: false };
}

export function unavailableActivity(prior = null, code = 'activity_unavailable') {
  return { state: 'unavailable', checkedAt: prior?.checkedAt ?? null,
    error: /^[a-z0-9_]+$/.test(code) ? code : 'activity_unavailable',
    events: prior?.events ?? [], review: { state: 'unknown', currentHead: false } };
}

export function validateActivity(activity, entry) {
  if (!object(activity) || !['complete', 'unavailable'].includes(activity.state) ||
      !(activity.checkedAt === null || iso(activity.checkedAt)) || !Array.isArray(activity.events) ||
      activity.events.length > 6100 || !object(activity.review) ||
      !['changes_requested', 'approved', 'none', 'unknown'].includes(activity.review.state) ||
      typeof activity.review.currentHead !== 'boolean' ||
      (activity.state === 'complete' ? !iso(activity.checkedAt) || activity.error !== null :
        typeof activity.error !== 'string' || !/^[a-z0-9_]+$/.test(activity.error) ||
        activity.review.state !== 'unknown' || activity.review.currentHead)) fail('invalid_activity_schema');
  const ids = new Set();
  let totalBody = 0;
  for (const event of activity.events) {
    if (!object(event) || !kinds.has(event.kind) || typeof event.id !== 'string' ||
        ids.has(event.id) || !object(event.actor) || !classifications.has(event.actor.classification) ||
        typeof event.actor.login !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]*(?:\[bot\])?$/.test(event.actor.login) ||
        !(event.actor.id === null || integer(event.actor.id)) ||
        typeof event.body !== 'string' || [...event.body].length > 65536 ||
        !HASH.test(event.bodyHash ?? '') || hashBody(event.body) !== event.bodyHash ||
        !iso(event.date) || !iso(event.updatedAt) || Date.parse(event.updatedAt) < Date.parse(event.date) ||
        !(event.headSha === null || SHA.test(event.headSha)) ||
        !(event.previousHeadSha === null || SHA.test(event.previousHeadSha))) fail('invalid_activity_event');
    totalBody += event.body.length;
    if (totalBody > 8_000_000) fail('activity_size_limit');
    ids.add(event.id);
    const numeric = event.id.match(/^(comment|review|review_comment):([1-9]\d*)$/);
    if (['comment', 'review', 'review_comment'].includes(event.kind)) {
      if (!numeric || numeric[1] !== event.kind || !integer(Number(numeric[2])) ||
          event.url !== sourceURL(entry, event.kind, numeric[2]) || event.previousHeadSha !== null) fail('invalid_activity_source');
    } else if (event.url !== entry.url || event.body !== '' || event.state !== null) fail('invalid_activity_source');
    if (event.kind === 'review' ? !reviewStates.has(event.state) || !SHA.test(event.headSha ?? '') :
        event.state !== null) fail('invalid_activity_review');
    if (event.kind === 'comment' && event.headSha !== null) fail('invalid_activity_head');
    if (event.kind === 'review_comment' && !SHA.test(event.headSha ?? '')) fail('invalid_activity_head');
    if (event.kind === 'head_update' && (!SHA.test(event.headSha ?? '') ||
        event.headSha === event.previousHeadSha ||
        event.id !== `head_update:${event.headSha}:${event.date}`)) fail('invalid_activity_head');
    if (['merged', 'closed'].includes(event.kind) && (event.id !== `${event.kind}:${event.date}` ||
        event.previousHeadSha !== null || !SHA.test(event.headSha ?? ''))) fail('invalid_activity_head');
    if (event.actor.classification === 'author' &&
        (event.actor.login.toLowerCase() !== 'leultew' || event.actor.id !== 107800362)) fail('invalid_activity_actor');
    if (event.actor.classification === 'human' &&
        knownHumans.get(event.actor.login.toLowerCase()) !== event.actor.id) fail('invalid_activity_actor');
  }
  if (activity.state === 'complete') {
    const heads = activity.events.filter(event => event.kind === 'head_update');
    const head = heads.at(-1)?.headSha;
    if (!head || (entry.headSha !== undefined && entry.headSha !== head)) fail('activity_head_mismatch');
    for (let i = 1; i < heads.length; i++) {
      if (heads[i].previousHeadSha !== heads[i - 1].headSha ||
          Date.parse(heads[i].date) < Date.parse(heads[i - 1].date)) fail('invalid_activity_head');
    }
    if (heads[0].previousHeadSha !== null) fail('invalid_activity_head');
    const expected = summarizeReviews(activity.events, head);
    if (expected.state !== activity.review.state || expected.currentHead !== activity.review.currentHead) fail('invalid_activity_review');
  }
  return activity;
}

export async function collectActivity(entry, pr, get, priorActivity = null, observedAt = new Date().toISOString()) {
  if (!SHA.test(pr?.head?.sha ?? '') || !iso(observedAt)) fail('invalid_activity_head');
  if (priorActivity) validateActivity(priorActivity, { ...entry, headSha: undefined });
  const base = `/repos/${entry.owner}/${entry.repo}`;
  const endpoints = [
    ['comment', `${base}/issues/${entry.number}/comments`],
    ['review', `${base}/pulls/${entry.number}/reviews`],
    ['review_comment', `${base}/pulls/${entry.number}/comments`],
  ];
  const events = [];
  const seen = new Map();
  let totalBody = 0;
  for (const [kind, path] of endpoints) {
    for (const row of await paginateActivity(get, path)) {
      if (!object(row) || !integer(row.id)) fail('invalid_activity_schema');
      if (kind === 'review' && row.state === 'PENDING') continue;
      const date = kind === 'review' ? row.submitted_at : row.created_at;
      const body = row.body;
      if (typeof body !== 'string' || [...body].length > 65536 || !iso(date) ||
          row.html_url !== sourceURL(entry, kind, row.id)) fail('invalid_activity_schema');
      const event = { id: `${kind}:${row.id}`, kind, actor: classifyActor(row.user), body,
        bodyHash: hashBody(body), date, updatedAt: kind === 'review' ? date : row.updated_at,
        url: row.html_url, state: kind === 'review' ? row.state : null,
        headSha: kind === 'comment' ? null : row.commit_id, previousHeadSha: null };
      const previous = seen.get(event.id);
      if (previous) {
        if (JSON.stringify(previous) !== JSON.stringify(event)) fail('activity_pagination_changed');
        continue;
      }
      seen.set(event.id, event);
      totalBody += body.length;
      if (totalBody > 8_000_000) fail('activity_size_limit');
      events.push(event);
    }
  }
  const heads = (priorActivity?.events ?? []).filter(event => event.kind === 'head_update');
  const previousHeadSha = heads.at(-1)?.headSha ?? null;
  if (previousHeadSha !== pr.head.sha) heads.push({
    id: `head_update:${pr.head.sha}:${observedAt}`, kind: 'head_update', actor: unknownActor(),
    body: '', bodyHash: hashBody(''), date: observedAt, updatedAt: observedAt, url: entry.url,
    state: null, headSha: pr.head.sha, previousHeadSha,
  });
  events.push(...heads);
  const terminal = pr.merged_at ? ['merged', pr.merged_at] : pr.state === 'closed' ? ['closed', pr.closed_at] : null;
  if (terminal && iso(terminal[1])) {
    const [kind, date] = terminal;
    events.push({ id: `${kind}:${date}`, kind, actor: kind === 'merged' ? classifyActor(pr.merged_by) : unknownActor(),
      body: '', bodyHash: hashBody(''), date, updatedAt: date, url: entry.url, state: null,
      headSha: pr.head.sha, previousHeadSha: null });
  }
  events.sort((a, b) => Date.parse(a.date) - Date.parse(b.date) || a.id.localeCompare(b.id));
  return validateActivity({ state: 'complete', checkedAt: observedAt, error: null, events,
    review: summarizeReviews(events, pr.head.sha) }, { ...entry, headSha: pr.head.sha });
}
