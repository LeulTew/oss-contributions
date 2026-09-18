# LeulTew's public contribution index

A small, dependency-free dashboard for selected public open-source contributions: the change, the pull-request state, the CI evidence, and human reviewer feedback with its original source.

**Public site:** https://leultew.github.io/oss-contributions/

## What the numbers mean

The allowlist contains 25 real pull requests across 24 repositories. This is a selected contribution campaign, not a complete export of account or employer activity. Open, merged and closed describe the PR, not the result of its checks.

CI is reported separately as successful checks, failures, pending, maintainer action, canceled, or unknown. An empty check list is never green. Successful check labels do not prove that all intended tests executed. Dated, curated context preserves known qualifications, including masked test errors, coverage-baseline failures and canceled jobs.

## Updating public content

- `config/contributions.json` is the explicit scope and human-readable change summary. Add only a confirmed public PR authored by LeulTew, with its canonical URL. The collector and frontend accept 1 to 100 allowlisted entries; counts are derived from that catalog, and each snapshot must match its exact identities without extra, missing or duplicate records. Adding a verified PR does not require changing a UI count constant.
- `config/quotes.json` contains exact, manually verified human quotations: author identity, role, date, review state, original permalink and provenance. Verify the human and the specific review before adding a quote; a `User` API type alone does not establish that an account is human. Do not quote bots, empty approvals, or infer a global endorsement.
- `config/initial-state.json` is the public, verified bootstrap snapshot. Routine refreshes do not write commits. Terminal observations are retained through validated Actions cache state; deliberately changing the manifest invalidates that state.
- The deployed `data.json` is the current public snapshot. `catalog.json` is the public identity allowlist; `fallback.json` is the bundled deployment snapshot used if the latest data request fails.

Curated context has its own `noteAsOf` date. It is not automatically rewritten from check names and should not be read as a new observation.

## Refresh and failure behavior

GitHub Actions is scheduled at minutes **7, 22, 37 and 52** each hour on the default branch. Schedules can be delayed or dropped under high load. GitHub automatically disables scheduled workflows in public repositories after **60 days without repository activity**. The Actions history is the authoritative record of refresh execution; there is no instant or guaranteed real-time feed.

If the snapshot is stale, inspect the [refresh history](https://github.com/LeulTew/oss-contributions/actions), correct any collection/deployment error, and re-enable the schedule or manually dispatch this repository's publishing workflow when appropriate. Do not create keepalive or generated-data commits merely to manufacture activity. See [GitHub's scheduled-workflow limitations](https://docs.github.com/en/actions/how-tos/troubleshoot-workflows#scheduled-workflows-running-at-unexpected-times).

The browser retrieves same-origin JSON every five minutes while visible, aborts in-flight requests when hidden, and offers a manual **Refresh data** button. That button reloads the published snapshot, not the GitHub API, and never triggers an upstream workflow.

Each record distinguishes its `checkedAt` observation from the PR's `updatedAt`. Active observations older than 45 minutes are marked delayed/stale. A failed refresh retains last-good evidence with an explicit warning instead of silently resetting its clock. Merged and closed observations are historical and are not routinely polled; their original dates remain visible.

If browser storage is available, a validated last-good snapshot is retained locally. The bundled fallback is also available while the deployment can be reached. This is not a service-worker offline application: a first offline visit or a reload without cached site resources may fail. No unavailable state is represented as success.

## Local development

Use Node.js 24 or newer. No package installation is required.

```sh
node --test
node scripts/collect.mjs
node scripts/build.mjs
node scripts/serve.mjs dist 4173
```

Collection reads `GH_TOKEN` or `GITHUB_TOKEN` only from the process environment; use a read-only credential and never put it in a source file or shell transcript. It writes ignored `site/data.json` and `.cache/contributions.json`. The build writes only public site assets, manifests and verified data to `dist/`.

The server binds only to `127.0.0.1`. Open `http://127.0.0.1:4173` after building the static output. The same output is deployed under the repository's GitHub Pages subpath.

The Pages artifact is retained for one day. The versioned observation cache stores one small snapshot per run, isolated by manifest hash; GitHub applies its normal cache quota and unused-cache eviction policy. Cache loss falls back to the committed bootstrap rather than fetching unrelated work.

## Publication and access boundaries

The site is hosted by this repository's GitHub Pages workflow. The collection/build job runs the complete Node builtin test suite before collecting or building; deployment depends on that job succeeding. The collection/build job has read-only repository permissions. Only the deployment job receives `pages: write` and `id-token: write`, under the `github-pages` environment.

The collector uses a server-side `GITHUB_TOKEN` and a fixed GitHub API origin. There is no credential in the browser, generated JSON, or committed source, and no public credential proxy. Public visitors need no account. The app makes no upstream comments, approvals, reactions, reruns, merges or settings changes.

No analytics, third-party scripts, remote fonts or image services are used. System fonts avoid downloads and additional font licenses. The small SVG mark is part of the site's own source. GitHub API content is rendered as text, never raw HTML. Only the allowlisted public evidence is built into the site; private notes and unpublished work are excluded.

`PRODUCT.md` records scope and accessibility requirements. `DESIGN.md` records the implemented design system.
