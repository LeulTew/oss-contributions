# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Leul Tewodros Agonafer and visitors following a selected public contribution campaign: identify explicit review requests, read recent discussion, understand branch and merge changes, and open the original evidence.

## Product Purpose

The hosted site is the only report. Track a deliberately selected campaign of 25 public pull requests across 24 repositories through a contribution inbox and selected-PR activity view. Preserve source-linked summaries, qualified CI evidence, review states and genuine human feedback.

## Capabilities and Constraints

Static site hosted on GitHub Pages, using native controls and browser modules without a framework or bundler. Discussion uses pinned, self-hosted Markdown parsers; this is not a dependency-free application. A read-only GitHub Actions collector is scheduled every 15 minutes, but actual runs can be delayed or dropped for hours. The interface must show actual observation times. Optional on-demand refresh reads only the selected allowlisted public PR and its activity through GitHub's tokenless API, with explicit quota, cache and failure states; it does not refresh CI or promise push delivery.

Only explicitly allowlisted public pull requests authored by LeulTew are included. No credentials, analytics, private work, unpublished patches, account-wide scraping, or local HTML report belong in the site. All upstream interaction is read-only.

Merged and closed records are retained as historical observations. CI success is neither merge approval nor proof that all intended tests executed. Empty check lists, unavailable data, approval-gated workflows, canceled jobs and failed checks must remain distinguishable.

Attention is derived from explicit review states, not sentiment or the presence of a comment. Workflow approval gates mean waiting on a maintainer, not an author request. A comment may address another participant. An API `User` type is not proof of a human; known automation is identified and unknown accounts are labeled honestly. Activity is not automatically promoted to curated praise.

## Evidence on Hand

The public pull-request allowlist and human-readable summaries live in `config/contributions.json`. Human quotations are curated in `config/quotes.json`, with exact source, author, date and provenance. Automated comments and empty approvals are not endorsements.

## Product Principles

- Original GitHub records remain authoritative.
- Show when evidence was checked, not a fabricated live clock.
- Keep last verified data with explicit stale or error labels.
- Make the next inspection clear without inventing a task or an endorsement.
- Preserve the distinction between PR state, review requests, CI and public conversation.

## Accessibility & Inclusion

Keyboard access, semantic labels, reduced-motion support, readable contrast and structural mobile layouts down to 320 CSS pixels.

## Assumptions

The supplied brief settles product scope and pins the familiar GitHub/Primer-like category standard. This is an original implementation, not a GitHub product or affiliation. The site represents selected public work, not all account or employer activity. Desired craft quality is not an award claim.

## Replacement Direction

Use the user-pinned GitHub/Primer-like category canon directly, without a seed, concept tournament or invented approval. The previous pine/mint mosaic direction is superseded.

A compact repository header and native PRs, Activity, Feedback and Help links lead to a single bordered PR list. Each matching contribution appears once; there is no hero, mosaic or featured PR. System typography, modest headings, white/slate/charcoal surfaces, blue links and green/purple/red/amber categorical marks serve inspection rather than decoration. Lifecycle, review and CI remain independent, never a combined score. All UI counts derive from the catalog and current records.

Dark remains the first-visit default, independent of OS preference. A native Theme disclosure contains Light, Dark and System controls with at least 44px targets; choices persist when storage works, and System follows the OS. Operational text is generally 14px and discussion bodies 16px, with compact numeric and code exceptions. Native button/link color, border and background transitions last 150ms; there is no view animation, and reduced-motion updates are instant.

State, AND-term search, CI filtering, sort and reset work together. Shareable routes include canonical `?pr=` selection; tabs, state-button changes, selection and feed pages push history, while input filters and previous/next PR replace it. Previous/next follows the filtered set. Browser Back restores saved focus and scroll. Slash focuses search without interrupting editable controls; Escape leaves inspection when an input, textarea or select is not focused. Narrow layouts retain native navigation and keep code/table overflow local.

The source action and short Gin race qualification stay visible; deeper context is collapsed in Details & checks. Earlier-head decisions retain their actual review color alongside a neutral Earlier head label. Stale-only global notices and age pills are neutral and independent of CI status; failures and unavailable evidence retain explicit warnings. Initial heads remain baseline metadata, not activity.

Activity and Feedback paginate ten events/messages per page. Feedback presents full actual comments and reviews, not inferred endorsements, with the exact source-verified Chi quotation in a closed, scoped disclosure. Original text and source remain accessible; unclassified accounts are never relabeled human. The current schema is a flat timeline, not an invented reply tree. Help remains reachable even when every JSON request fails; unavailable states hide inert controls and remove loading claims.

## Discussion Presentation

Safe readable Markdown is intentional. `marked` 18.0.13 (MIT) produces markup, `parse5` 8.0.1 (MIT) parses a pure AST, and a strict allowlist creates DOM nodes without `innerHTML` or `DOMParser`. The lockfile includes `entities` 8.1.0 (BSD-2-Clause). Modules are self-hosted and loaded lazily for discussion; full licenses accompany generated output. Installation disables lifecycle scripts; the build rewrites only generated import paths. See README.md for maintenance and loading-cost details.

Source message bodies, hashes and provenance do not change. Original text and source remain available alongside formatted content. HTML comments are hidden except as literal fenced code. Links must resolve to safe HTTPS URLs without credentials; no image or embed loads automatically.

Formatting limits are 100,000 source characters, 10,000 visited AST nodes and 128 render levels. Node/depth bounds apply after parsing. Per-message parser exceptions, including deep-quotation RangeError failures, are isolated and visibly reported rather than declared impossible. Limit notices and original text preserve access to evidence.
