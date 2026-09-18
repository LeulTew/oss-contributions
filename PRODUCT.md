# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Visitors evaluating Leul Tewodros Agonafer's selected public open-source contributions, and reviewers following the underlying pull requests.

## Product Purpose

Browse a verified, deliberately selected campaign of 25 public pull requests across 24 repositories. Search changes, distinguish contribution state from CI evidence, and read genuine, source-linked human feedback.

## Capabilities and Constraints

Static, dependency-free site hosted on GitHub Pages. A read-only GitHub Actions collector refreshes approximately every 15 minutes; schedules can be delayed. Only explicitly allowlisted public pull requests authored by LeulTew are included. No credentials, analytics, private work, unpublished patches, or account-wide scraping belong in the site.

Merged and closed records are retained as historical observations. CI success is neither merge approval nor proof that all intended tests executed. Empty check lists, unavailable data, approval-gated workflows, canceled jobs and failed checks must remain distinguishable.

## Evidence on Hand

The public pull-request allowlist and human-readable summaries live in `config/contributions.json`. Human quotations are curated in `config/quotes.json`, with exact source, author, date and provenance. Automated comments and empty approvals are not endorsements.

## Product Principles

- Original GitHub records remain authoritative.
- Show when evidence was checked, not a fabricated live clock.
- Keep last verified data with explicit stale or error labels.
- Explain the contribution before exposing technical detail.

## Accessibility & Inclusion

Keyboard access, semantic labels, reduced-motion support, readable contrast and structural mobile layouts down to 320 CSS pixels.

## Assumptions

The supplied brief settles product scope. Ordinary visual choices are made autonomously: visitors need a focused, readable index rather than a marketing page. This site represents selected public work, not all account or employer activity.
