import { activityFeed } from './model.mjs';

const tabs = ['prs', 'activity', 'feedback', 'help'];
const states = ['all', 'open', 'merged', 'closed', 'requests', 'failures', 'waiting'];
const checks = ['all', 'success', 'failure', 'gated', 'pending', 'unknown', 'cancelled', 'stale'];
const sorts = ['activity', 'updated', 'newest', 'project'];
const kinds = ['all', 'reviews', 'comments', 'updates'];
export const PAGE_SIZE = 10;
export const DEFAULT_ROUTE = Object.freeze({
  tab: 'prs', view: 'all', search: '', ci: 'all', sort: 'activity',
  automation: false, kind: 'all', page: 1, pr: null,
});
const choice = (value, allowed, fallback) => allowed.includes(value) ? value : fallback;
export function readRoute(search) {
  const params = new URLSearchParams(search);
  const page = Number(params.get('page') ?? 1);
  const pr = params.get('pr');
  const tab = choice(params.get('tab'), tabs, 'prs');
  return {
    tab,
    view: choice(params.get('state'), states, 'all'),
    search: params.get('q') ?? '',
    ci: choice(params.get('ci'), checks, 'all'),
    sort: choice(params.get('sort'), sorts, 'activity'),
    automation: params.get('automation') === '1',
    kind: choice(params.get('kind'), tab === 'feedback' ? kinds.filter(kind => kind !== 'updates') : kinds, 'all'),
    page: Number.isSafeInteger(page) && page > 0 ? Math.min(page, 10000) : 1,
    pr: pr && /^[\w.-]+\/[\w.-]+#[1-9]\d*$/.test(pr) ? pr : null,
  };
}
export function routeQuery(route) {
  const params = new URLSearchParams();
  for (const [key, name] of [['tab', 'tab'], ['view', 'state'], ['search', 'q'], ['ci', 'ci'], ['sort', 'sort'], ['kind', 'kind'], ['page', 'page']]) {
    if (route[key] !== DEFAULT_ROUTE[key]) params.set(name, String(route[key]));
  }
  if (route.automation) params.set('automation', '1');
  if (route.pr) params.set('pr', route.pr);
  return params.size ? `?${params}` : '';
}
export function workspaceFeed(rows, route) {
  const events = activityFeed(rows, { excludeAutomation: !route.automation, kind: route.kind })
    .filter(({ event }) => route.tab !== 'feedback' || ['comment', 'review', 'review_comment'].includes(event.kind));
  const pages = Math.max(1, Math.ceil(events.length / PAGE_SIZE));
  const page = Math.min(route.page, pages);
  return { events: events.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), total: events.length, pages, page };
}
