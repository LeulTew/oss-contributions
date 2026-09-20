# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Leul Tewodros Agonafer and visitors following a selected public contribution campaign: identify explicit review requests, read recent discussion, understand branch and merge changes, and open the original evidence.

## Product Purpose

The hosted site is the only report. Track a deliberately selected campaign of 25 public pull requests across 24 repositories through a contribution inbox and selected-PR activity view. Preserve source-linked summaries, qualified CI evidence, review states and genuine human feedback.

## Capabilities and Constraints

Static, dependency-free site hosted on GitHub Pages. A read-only GitHub Actions collector is scheduled every 15 minutes, but actual runs can be delayed or dropped for hours. The interface must show actual observation times. Optional on-demand refresh reads only the selected allowlisted public PR and its activity through GitHub's tokenless API, with explicit quota, cache and failure states; it does not refresh CI or promise push delivery.

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

The September 20 visual brief explicitly rejects the sidebar and permanently split correspondence workbench. Its functionality remains evidence, not visual authority. The replacement is a modern release-control surface: horizontal navigation, a compact routing band for explicit review/CI states, a full-width collection, and a focused reading route rather than a cramped permanent inspector. The subsequent color feedback rejects navy, cobalt and blue-grey surfaces. White porcelain, graphite controls, neutral text, readable system typography and restrained depth define the replacement. Color is reserved for explicit evidence roles. No retro paperwork, terminal metaphor, decorative charts or award claims.

Ordinary design choices are autonomous. First visits use light mode, including on a dark operating system. Explicit stored light, dark or system choices are preserved; dark mode uses neutral charcoal, not navy. Operational text is at least 14px, comment bodies 16px, and interactive targets at least 44px. Selected-PR previous/next navigation and reliable return-to-list focus reduce repeated scanning. The slash shortcut works from collection rows and other noneditable controls without interrupting typing or comboboxes. Concise review/CI observations precede conversation; expanded refresh and context follow conversation on mobile, with a direct jump link. The local replacement must be inspected before any new commit or publication.
