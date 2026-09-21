---
version: 1
slug: "site-index-html"
primary_target: "site/index.html"
related_targets: ["site/style.css","site/app.mjs","site/workspace.mjs","site/ui.mjs","site/markdown.mjs"]
---

Mode: Operate for PRs and Activity; Read for Feedback, selected-PR conversation and Help.

Audience and task: the contributor and visitors inspecting selected public work. Find a change, distinguish independent evidence, read its actual discussion, open its source and return to the same place.

Direction: user-pinned GitHub/Primer-like category canon, implemented originally without affiliation. Neutral white/slate/charcoal surfaces, system typography, blue links and categorical green/purple/red/amber marks. No seed, concept tournament, hero, mosaic or featured PR.

First viewport: compact repository identity and native Theme disclosure above PRs, Activity, Feedback and Help navigation. Modest heading, snapshot status and search/filter controls precede one bordered PR list. Every matching PR appears once. Counts derive from the catalog and current records; no hardcoded campaign count, score or decorative activity.

Routes: native links carry shareable tab/filter state and canonical `?pr=` identity. Tabs, state buttons, selection and feed pages push history. Input filters, automation toggles and previous/next PR replace it. Search terms combine with AND, alongside state/review, CI and sort; Reset retains the current tab. Browser Back restores saved focus and scroll. Previous/next follows filtered PRs. Slash focuses search outside inspection/Help without interrupting editable controls; Escape leaves inspection outside inputs, textareas and selects.

PRs: one shared frame and divided rows show a contribution summary, repository/number, independent PR/review/CI signals and dates. Earlier-head reviews retain their actual decision color with a neutral qualifier. Stale age stays neutral, including stale-only global notices; genuine failures/unavailable histories remain explicit. The short Gin race qualification is visible rather than buried.

Activity and Feedback: both paginate ten entries. Activity shows concise source-linked events; Feedback shows full actual comments, submitted reviews and inline review comments, with safe Markdown, Original text and source links. Automation is hidden by default and can be included. Unclassified actors are not called human. The current schema is a flat timeline: never invent parent/reply relationships. Baseline head metadata does not become an activity event.

Scoped quotation: Feedback alone contains the initially closed Featured review · Chi disclosure. Preserve the exact curated quotation and its attribution/permalink; it applies only to that contribution, not the whole campaign.

Inspection: actual PR title and independent signals precede the conversation. Open on GitHub and Refresh discussion remain explicit; the important Gin qualification stays visible. Details & checks collapses deeper summary, dated context, observation times, baseline and check evidence. Direct refresh observes PR/discussion separately and never advances CI.

Responsive structure: main width is bounded at 1216px. At 800px the conversation/context columns stack, with collapsed context before discussion. At 480px search takes a full row, state controls remain a single compact row, decorative nav icons and trailing row counts disappear, and source actions fill the width. Redundant unfiltered result counts remain accessible without extending the visible mobile stack. Long prose wraps; code and tables scroll locally. Native controls retain 44px minimum targets.

Theme and motion: dark first visit, saved Light/Dark/System preference when storage works, System follows OS. Native Theme disclosure contains the three choices. System UI text is generally 14px, messages 16px, with compact code/counter exceptions. Only button/link background, border and text color transition for 150ms ease-out; no view animation. Reduced motion removes transitions and animation.

Help and failure: Help stays in primary navigation and remains readable even if every JSON load fails. It explains status semantics, polling, anonymous API limits, privacy, sources, formatting and licenses. All-snapshot failure hides inert search/filter controls and loading claims rather than pretending evidence is empty or successful. No upstream mutation is offered.

Discussion safety: pinned self-hosted marked output passes through a pure parse5 AST and a strict DOM allowlist, never innerHTML/DOMParser. Exact bodies, hashes and source remain intact. Images/embeds never autoload; links require safe HTTPS. Formatting limits and per-message parser exceptions remain visible while original text stays available.

Product/data guarantees, dependency versions, installation and refresh budgets remain in PRODUCT.md and README.md. This contract records implemented structure, not an award, optimization score or approval claim.
