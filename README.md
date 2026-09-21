# LeulTew's contribution inbox

A static, hosted-only inbox for selected public open-source contributions. Browse public discussion, explicit review requests, observed branch changes and merges alongside qualified CI evidence. Select a PR for its activity and original sources; no local HTML report is maintained. The interface uses native browser controls and modules, without a framework or bundler; pinned, self-hosted parsers format discussion.

The interface follows the familiar GitHub/Primer-like category standard with an original implementation and no GitHub affiliation. A compact repository header links to **PRs**, **Activity**, **Feedback** and **Help**. PRs appear once in a single bordered list, without a hero, mosaic or featured PR. State, AND-term search, CI filtering, sort and reset combine without conflating lifecycle, review and CI.

Routes preserve filters and canonical `?pr=` selection. Tabs, state buttons, selection and feed pages add history entries; input filters and previous/next PR replace the current entry. Previous/next traverses the filtered set; browser Back restores saved focus and scroll. `/` focuses search without interrupting typing or comboboxes; Escape returns from inspection unless an input, textarea or select has focus.

First visits intentionally use dark mode, independent of OS preference. A native **Theme** disclosure holds **Light**, **Dark** and **System** choices, saved when storage works. System type, neutral surfaces, blue links and categorical status marks prioritize reading. Button/link color, border and background transitions last 150ms, with no view animation; reduced-motion updates are instant. **Details & checks** collapses deeper evidence while the important Gin race qualification stays visible. **Help** explains refresh and privacy and remains reachable even if all JSON requests fail. These controls do not mutate any GitHub record.

**Public site:** https://leultew.github.io/oss-contributions/

## What the numbers mean

The allowlist contains 25 real pull requests across 24 repositories. This is a selected contribution campaign, not a complete export of account or employer activity. Open, merged and closed describe the PR, not the result of its checks.

CI is reported separately as successful checks, failures, pending, maintainer action, canceled, or unknown. An empty check list is never green. Successful check labels do not prove that all intended tests executed. Dated, curated context preserves known qualifications, including masked test errors, coverage-baseline failures and canceled jobs.

The Changes requested filter contains explicit `CHANGES_REQUESTED` review decisions, not requests to review a PR, sentiment or inferred tasks from comments. Earlier-head approval and change-request decisions retain their actual status color with a separate neutral **Earlier head** qualifier; they are not called new feedback. Stale-only global notices and age pills are neutral and never replace underlying CI or review status. Check-failure and maintainer-approval filters are separate and may overlap a changes-requested review. Comments addressed to another participant are simply discussion. No comment is automatically promoted to author attention.

**Activity** lists public comments, reviews and observed head/state changes; **Feedback** renders full actual comment and review messages. Both paginate ten entries per page. The current schema is flat: no reply relationship or thread nesting is invented. First head recordings establish a baseline, not a branch change; they remain metadata in Details & checks and do not inflate activity or its sort order. Automation is hidden by default and can be included; an empty discussion offers Show automation when applicable. A filter-empty view never means no work is needed. Exact known service identities, including the `User`-typed codecov commenter, are labeled automation. Other `User` accounts remain unclassified unless independently source-verified; API type alone is not human provenance. The exact Chi quotation sits in Feedback's initially closed **Featured review · Chi** disclosure, applies only to its original contribution, and is never populated by activity sentiment.

## Updating public content

- `config/contributions.json` is the explicit scope and human-readable change summary. Add only a confirmed public PR authored by LeulTew, with its canonical URL. The collector and frontend accept 1 to 100 allowlisted entries; counts are derived from that catalog, and each snapshot must match its exact identities without extra, missing or duplicate records. Adding a verified PR does not require changing a UI count constant.
- `config/quotes.json` contains exact, manually verified human quotations: author identity, role, date, review state, original permalink and provenance. Verify the human and the specific review before adding a quote; a `User` API type alone does not establish that an account is human. Do not quote bots, empty approvals, or infer a global endorsement.
- `config/initial-state.json` is the public, verified bootstrap snapshot. Routine refreshes do not write commits. Terminal observations are retained through validated Actions cache state; deliberately changing the manifest invalidates that state.
- The deployed `data.json` is the current public snapshot. `catalog.json` is the public identity allowlist; `fallback.json` is the bundled deployment snapshot used if the latest data request fails.

Curated context has its own `noteAsOf` date. It is not automatically rewritten from check names and should not be read as a new observation.

## Refresh and failure behavior

GitHub Actions is scheduled at minutes **7, 22, 37 and 52** each hour on the default branch. Schedules can be delayed or dropped under high load. GitHub automatically disables scheduled workflows in public repositories after **60 days without repository activity**. The Actions history is the authoritative record of refresh execution; there is no instant or guaranteed real-time feed.

If the snapshot is stale, inspect the [refresh history](https://github.com/LeulTew/oss-contributions/actions), correct any collection/deployment error, and re-enable the schedule or manually dispatch this repository's publishing workflow when appropriate. Do not create keepalive or generated-data commits merely to manufacture activity. See [GitHub's scheduled-workflow limitations](https://docs.github.com/en/actions/how-tos/troubleshoot-workflows#scheduled-workflows-running-at-unexpected-times).

The browser retrieves same-origin JSON every five minutes while visible, aborts in-flight requests when hidden, and offers **Reload**. That button reloads the published snapshot, not the GitHub API, and never triggers an upstream workflow. Actual schedule history has included multi-hour gaps between successful runs; an active schedule is not a freshness guarantee.

**Refresh discussion** optionally reads only the selected allowlisted PR and its public discussion directly from `https://api.github.com`. It uses no token, authorization header, cookies or credential proxy. Anonymous API limits are shared by public IP and can make this unavailable. The client uses a five-minute result cache, bounded pagination, a ten-request attempt ceiling, a 35-request sliding hourly budget, a 20-second request timeout and persisted rate-limit backoff. It never automatically retries rate failures. Storage failure is reported and reduces local budget coordination to the current tab. Requests are canceled when selection changes or the document is hidden.

Direct refresh supplements this tab only. It does **not** refresh CI. The scheduled CI `checkedAt` stays unchanged, and a changed head invalidates old-head CI to unknown. A subsequently loaded published snapshot can advance CI evidence for the same exact head without discarding a newer direct discussion observation. The detail panel shows the direct PR/discussion observation separately. A failed, incomplete or rate-limited direct request leaves last-good evidence intact with an explicit error. This is polling, not push, and never promises instant or exhaustive all-event delivery.

Each record distinguishes its `checkedAt` observation from the PR's `updatedAt`. Active observations older than 45 minutes are marked delayed/stale. A failed refresh retains last-good evidence with an explicit warning instead of silently resetting its clock. Merged and closed observations are historical and are not routinely polled; their original dates remain visible.

Schema version 2 adds `activity` with its own completeness state, observation date, normalized events and review state. Events carry stable IDs, source URLs, dates, body hashes, actor classifications and head bindings where available. Discussion is presented as safely reconstructed Markdown without changing the source body or hash; **Original text** and **Original source** remain available. The collector validates complete bounded pagination and reconfirms the PR after collection; identity, head or update drift rejects the new observation. Head-change dates mean “observed at,” not invented push times. A terminal event uses its actual API merge/close date. Legacy v1 caches migrate explicitly to unavailable activity; they are not interpreted as an empty, fully checked inbox.

If browser storage is available, a validated last-good snapshot is retained locally. The bundled fallback is also available while the deployment can be reached. This is not a service-worker offline application: a first offline visit or a reload without cached site resources may fail. No unavailable state is represented as success.

## Readable discussion and dependencies

Discussion supports headings, lists, tables, quotations, code and disclosures. `marked` produces markup, `parse5` parses it into a pure AST, and a strict allowlist reconstructs browser DOM nodes. No `innerHTML` or `DOMParser` inserts the result. Source attributes are not copied wholesale: links must resolve to HTTPS without credentials, scripts/styles are discarded, and images or embeds never load automatically. Image references can expose a deliberate safe link instead. HTML comments are hidden in formatted discussion; comment syntax inside a fenced code block remains literal code.

Formatting is bounded to **100,000 source characters**, **10,000 visited AST nodes** and **128 levels of rendered nesting**. The character limit applies before parsing; node/depth limits apply during DOM reconstruction, not inside the parsers. Per-message exceptions remain possible, including a `RangeError` for deeply nested quotations. A failed message shows a visible formatting-unavailable notice while its original text and source remain usable; limits and omissions are also visible. These safeguards do not claim parsing cannot fail.

<details>
<summary>Parser versions, redistribution and loading cost</summary>

- Direct dependencies: `marked` **18.0.13** (MIT) and `parse5` **8.0.1** (MIT). The lockfile resolves `entities` **8.1.0** (BSD-2-Clause).
- Install using `npm ci --ignore-scripts --no-audit --no-fund`. Both CI workflows use this command; dependency lifecycle scripts are not needed.
- The build copies self-hosted modules and includes full redistribution licenses in `dist/THIRD-PARTY-LICENSES.txt`, accessible through **Licenses** in **Help** (`./THIRD-PARTY-LICENSES.txt`). It rewrites import paths only in generated output, leaving package and site sources unchanged. There is no framework, bundler or runtime CDN.
- The Markdown graph loads lazily when a discussion message needs formatting, not for the collection alone. The current graph is 23 module requests including the renderer, totaling 414,683 raw bytes. Summed per-file estimates are 90,881 bytes with gzip and 78,796 bytes with Brotli; these are **not measured hosted transfer sizes** and exclude request overhead.
- The generated vendor directory contains 26 files totaling 437,021 raw bytes; not every copied module belongs to the loaded graph. These figures describe the current pinned output, not a size guarantee for future dependency updates.

</details>

## Local development

Use Node.js 24 or newer and install the locked parser dependencies without lifecycle scripts.

```sh
npm ci --ignore-scripts --no-audit --no-fund
node --test
node scripts/collect.mjs
node scripts/build.mjs
node scripts/serve.mjs dist 4173
```

Collection reads `GH_TOKEN` or `GITHUB_TOKEN` only from the process environment; use a read-only credential and never put it in a source file or shell transcript. It writes ignored `site/data.json` and `.cache/contributions.json`. The build writes only public site assets, manifests and verified data to `dist/`.

The scheduled collector is sequential and capped at 240 actual HTTP requests per run, including retries. The initial v2 collection used 200; the current single-page steady state uses approximately 184 for 23 active PRs, with two terminal records retained. Activity pagination is finite and must complete: budget exhaustion or drift produces explicit unavailable/stale evidence, never silently truncated success. The budget is not a promise that every larger future catalog fits one run.

The server binds only to `127.0.0.1`. Open `http://127.0.0.1:4173` after building the static output. The same output is deployed under the repository's GitHub Pages subpath. Serve both `.mjs` and vendored `.js` files with a JavaScript MIME type; the local server includes that mapping, covered by an HTTP regression test.

For authoritative source-hash verification, compare against Git's LF source bytes, not a Windows checkout whose line endings may have become CRLF. Generated output is not uniformly byte-identical to source: the build intentionally rewrites the Markdown renderer's imports to self-hosted paths and parse5's `entities` imports inside the pinned vendor output. Reproduce those transformations with the locked dependencies before comparing generated hashes; preserve original discussion bodies and their body hashes independently of formatting.

The Pages artifact is retained for one day. The versioned observation cache stores one small snapshot per run, isolated by manifest hash; GitHub applies its normal cache quota and unused-cache eviction policy. Cache loss falls back to the committed bootstrap rather than fetching unrelated work.

## Publication and access boundaries

The site is hosted by this repository's GitHub Pages workflow. The collection/build job runs the complete Node builtin test suite before collecting or building; deployment depends on that job succeeding. The collection/build job has read-only repository permissions. Only the deployment job receives `pages: write` and `id-token: write`, under the `github-pages` environment.

The collector uses a server-side `GITHUB_TOKEN` and a fixed GitHub API origin. There is no credential in the browser, generated JSON, or committed source, and no public credential proxy. Public visitors need no account. The app makes no upstream comments, approvals, reactions, reruns, merges or settings changes.

No analytics, third-party-hosted scripts, remote fonts or image services are used. The Markdown parsers are third-party code served from the site's own origin with their licenses. Local fonts avoid downloads and additional font redistribution. The small SVG mark and interface icons are part of the site's own source. GitHub message content reaches the DOM only through the allowlisted Markdown reconstruction or literal text, never unsanitized HTML insertion. Only the allowlisted public evidence is built into the site; private notes and unpublished work are excluded.

`PRODUCT.md` records scope and accessibility requirements. `DESIGN.md` records the implemented design system.
