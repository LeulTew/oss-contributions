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

The supplied brief settles product scope. Ordinary visual choices are made autonomously: a task-oriented collection with selectable work and a focused activity-reading route serves daily monitoring better than a portfolio table. This site represents selected public work, not all account or employer activity. Desired craft quality is not an award claim.

## Replacement Direction

The neutral brand and ledger topology are rejected. Signal Bench, rendered alternative B, was selected autonomously after a three-world comparison; this is not user approval, a seed assignment or an award claim.

The implemented world is a contemporary evidence workstation, not a simulated hardware console: deep pine/charcoal, mint featured work, ivory text and light-theme reading surfaces. One actual filtered PR occupies each selectable tile in a responsive mosaic. Lifecycle, review and CI are independent marks, never a combined score. Counts derive from the allowlist and current records, not fixed UI constants. The asymmetric index features its first filtered result in mint and leaves subsequent entries open rather than boxing every item identically. The focused inspector separates identity, independent signals, discussion and the evidence record.

Dark is the intentional first-visit default, independent of the OS preference. Explicit Light, Dark and System choices persist when storage is available; System follows the OS rather than being the implicit first-visit choice. Operational text is at least 14px, comment bodies 16px, and interactive targets at least 44px. Native control-color and collection-content transitions last 180ms; reduced-motion updates are instant.

Previous/next follows the filtered set; Back restores the initiating index item or tile and page scroll position. Arrow keys traverse the mosaic using its actual column count; Home/End reach its ends. Narrow layouts keep the field's overflow local and stack the index and inspector. Slash focuses search from noneditable collection controls without interrupting typing or comboboxes. The source action, short Gin race caveat, stale/failure/gate qualifications and independently dated observations stay visible. Earlier-head reviews retain their real approval/change-request color and add a tile qualifier; index entries and inspection show a separate Earlier head label. Age never substitutes for status. Initial heads remain baseline metadata in Details, not fabricated activity. Empty conversation distinguishes missing evidence from hidden automation.

One Data & help disclosure explains refresh limits, privacy and historical semantics. The exact Chi quotation is collection-only Reviewer feedback, not an endorsement of other work. All-snapshot failure hides inert controls and removes loading claims instead of presenting missing data as successful emptiness.

## Discussion Presentation

Safe readable Markdown is intentional. `marked` 18.0.13 (MIT) produces markup, `parse5` 8.0.1 (MIT) parses a pure AST, and a strict allowlist creates DOM nodes without `innerHTML` or `DOMParser`. The lockfile includes `entities` 8.1.0 (BSD-2-Clause). Modules are self-hosted and loaded lazily for discussion; full licenses accompany generated output. Installation disables lifecycle scripts; the build rewrites only generated import paths. See README.md for maintenance and loading-cost details.

Source message bodies, hashes and provenance do not change. Original text and source remain available alongside formatted content. HTML comments are hidden except as literal fenced code. Links must resolve to safe HTTPS URLs without credentials; no image or embed loads automatically.

Formatting limits are 100,000 source characters, 10,000 visited AST nodes and 128 render levels. Node/depth bounds apply after parsing. Per-message parser exceptions, including deep-quotation RangeError failures, are isolated and visibly reported rather than declared impossible. Limit notices and original text preserve access to evidence.
