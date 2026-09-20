---
name: Signal Bench
description: A deep-pine evidence workstation with mint featured work and independent PR signals.
colors:
  ground: "#102c25"
  paper: "#1b3d32"
  ink: "#eef5e5"
  muted: "#bbd0c0"
  line: "#577566"
  soft: "#294d3e"
  selected: "#355b44"
  accent: "#eed078"
  on-accent: "#26351b"
  board: "#153f36"
  board-ink: "#f1f6e4"
  board-muted: "#d0e2d4"
  board-line: "#67897a"
  tile: "#214e41"
  tile-hover: "#30614e"
  feature: "#c9dfc7"
  feature-ink: "#123c35"
  feature-muted: "#385b4d"
  feature-line: "#88a88d"
  green: "#c4e0b7"
  green-soft: "#2c4e36"
  amber: "#f4d984"
  amber-soft: "#423b20"
  red: "#ffc4ac"
  red-soft: "#553b30"
  merged: "#e1ccef"
  merged-soft: "#463c50"
  closed: "#f0bfd9"
  closed-soft: "#543348"
  review: "#abe5d0"
  review-soft: "#1c5042"
  request: "#f1c29b"
  request-soft: "#533b26"
  unknown: "#b8dbf0"
  unknown-soft: "#294454"
  cancelled: "#d2dbe0"
  cancelled-soft: "#36454b"
  focus: "#f2d57b"
  light-ground: "#e5eee6"
  light-paper: "#f5f8ed"
  light-ink: "#123c35"
  light-muted: "#416158"
  light-line: "#a0b9ac"
  light-soft: "#d1e2d5"
  light-selected: "#e0eccf"
  light-green: "#245f46"
  light-green-soft: "#dcebd5"
  light-amber: "#655011"
  light-amber-soft: "#f2df99"
  light-red: "#942e23"
  light-red-soft: "#f4d9cc"
  light-merged: "#59466c"
  light-merged-soft: "#e8dff0"
  light-closed: "#803a61"
  light-closed-soft: "#eedce7"
  light-review: "#216256"
  light-review-soft: "#d6e9df"
  light-request: "#7d4319"
  light-request-soft: "#f6ddbf"
  light-unknown: "#315d79"
  light-unknown-soft: "#dbe9f2"
  light-cancelled: "#555d65"
  light-cancelled-soft: "#e0e4e6"
  light-focus: "#894100"
typography:
  display:
    fontFamily: '"Bahnschrift","Aptos","Helvetica Neue",Arial,sans-serif'
    fontSize: "58px"
    fontWeight: 550
    lineHeight: 1.05
    letterSpacing: "-.035em"
  headline:
    fontFamily: '"Bahnschrift","Aptos","Helvetica Neue",Arial,sans-serif'
    fontSize: "30px"
    fontWeight: 550
    lineHeight: 1.15
    letterSpacing: "-.025em"
  title:
    fontFamily: '"Bahnschrift","Aptos","Helvetica Neue",Arial,sans-serif'
    fontSize: "25px"
    fontWeight: 550
    lineHeight: 1.2
    letterSpacing: "-.02em"
  body:
    fontFamily: '"Bahnschrift","Aptos","Helvetica Neue",Arial,sans-serif'
    fontSize: "16px"
    lineHeight: 1.5
  discussion:
    fontFamily: '"Aptos","Helvetica Neue",Arial,sans-serif'
    fontSize: "16px"
    lineHeight: 1.75
  label:
    fontFamily: '"Bahnschrift","Aptos","Helvetica Neue",Arial,sans-serif'
    fontSize: "14px"
  code:
    fontFamily: "Consolas,ui-monospace,monospace"
    fontSize: "14px"
    lineHeight: 1.7
rounded:
  mark: "1px"
  tile: "2px"
  control: "3px"
  theme-group: "4px"
spacing:
  compact: "8px"
  control: "14px"
  inset: "16px"
  reading: "24px"
  feature: "26px"
  section: "32px"
  desktop-gutter: "48px"
components:
  button:
    backgroundColor: "{colors.soft}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "10px 14px"
  button-hover:
    backgroundColor: "{colors.selected}"
  source-action:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.control}"
    padding: "11px 18px"
  signal-tile:
    backgroundColor: "{colors.tile}"
    textColor: "{colors.board-ink}"
    rounded: "{rounded.tile}"
    padding: "12px 9px 10px"
  signal-tile-hover:
    backgroundColor: "{colors.tile-hover}"
  featured-work:
    backgroundColor: "{colors.feature}"
    textColor: "{colors.feature-ink}"
    rounded: "{rounded.tile}"
    padding: "26px"
  review-approved:
    backgroundColor: "{colors.review-soft}"
    textColor: "{colors.review}"
    rounded: "{rounded.tile}"
    padding: "3px 6px"
  discussion:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    padding: "26px 28px"
---

# Design System: Signal Bench

## Overview

**Creative North Star: "Signal Bench"**

A contemporary evidence workstation in deep pine/charcoal, mint featured work and ivory reading contrast. A real per-PR mosaic makes independent evidence visible; an asymmetric index and focused inspector give the work itself priority over administrative chrome. Native controls, square categorical marks and measured local typography provide the character without simulated hardware.

Rendered alternative B was selected autonomously after a three-world comparison. This records the implemented world, not user approval, a seed assignment or an award. The neutral ledger and the earlier light-first candidate are not visual authority. `site/style.css`, the opening contract in `site/index.html`, and the UI modules define the implementation; product and surface constraints remain in their respective documents.

**Key Characteristics:**
- Deep pine/charcoal, mint featured work and ivory reading contrast.
- One actual PR per tile; independent lifecycle, review and CI.
- An asymmetric index with a featured first result and open secondary entries.
- A focused inspector with source-linked, readable discussion.
- Dark-first native themes and brief motion that disappears under reduced motion.

## Colors

Botanical dark surfaces frame pale categorical marks and a mint reading surface; ochre carries actions and qualifications without becoming a universal status.

### Primary

`feature` is the mint emphasis for the first filtered contribution and active theme choice. Its `feature-ink`, `feature-muted` and `feature-line` partners keep this surface readable in either theme. `accent` and `on-accent` support source actions, recovery controls and focus on the dark board; semantic `amber` remains a separate warning role.

### Neutral

The frontmatter's unprefixed theme colors describe the intentional dark default. `ground` surrounds `paper` discussion surfaces; `ink`, `muted`, `line`, `soft` and `selected` establish hierarchy. The signal field retains its own `board` and `tile` family in either theme. `light-*` entries document the light overrides of those roles, not new CSS variable names.

### Evidence

Green, merged, closed, review, request, unknown and cancelled pairs have distinct roles. The board's compact marks use their own pale categorical backgrounds, while the featured entry locally binds darker text and lighter status backgrounds for readability on mint. Theme colors must not be applied blindly across these materials.

**The Independent Evidence Rule.** Lifecycle, review and CI retain their actual status; age and earlier-head qualifiers add context without replacing the status color or inventing a combined score.

Dark is the first-visit default even on a light-preferring OS. Explicit Light, Dark and System choices persist when storage works; only System follows the OS. CSS owns both complete theme sets and local component overrides.

## Typography

**Interface:** Bahnschrift, Aptos, Helvetica Neue, Arial, sans-serif. **Discussion:** Aptos, Helvetica Neue, Arial, sans-serif. **Code:** Consolas, ui-monospace, monospace. These are local stacks, not downloaded fonts.

The desktop page title is 58px; general headings use 30px/25px, with component-specific scales for identity and reading. The featured project is 46px with a 22px summary; ordinary project labels are 25px with 16px summaries. Inspector identity is 52px and its actual PR title 36px. Operational labels remain 14px. Discussion is 16px with 1.75 line height and a 72ch maximum.

At 1000px the page title becomes 48px; at 700px, 39px; at 480px, 36px; below 360px, 32px. Mobile inspector identity/title use 40px/27px. Content wraps rather than compressing evidence into tiny labels.

Formatted discussion uses 28/24/20/18px heading levels, 14px code and tables, and native disclosures. Exact observation dates, actor categories, original text and source links remain legible evidence.

## Layout

The outer container is capped at 1536px with 48px desktop side padding. The collection grid pairs the field and index at 1.08:1 with a 32px gap. The field is sticky at 24px and contains five tile columns, 8px gaps, and locally scrollable content capped at 448px high (560px above 1536px).

Each actual filtered PR occupies one tile, not one narrow column or an invented timeline segment. Desktop tiles have a 114px minimum height. The index uses two columns with 28px row/24px column gaps; its first result spans both columns. Later entries use open top-ruled surfaces instead of identical cards. Recent activity uses a chronological reading lane and hides the mosaic.

### Responsive structure

| Breakpoint | Implemented change |
| --- | --- |
| At most 1200px | 32px outer padding, equal collection columns, four tile columns; inspector side rail becomes 270px. |
| At most 1000px | Collection stacks; mosaic returns to five columns with a 244px scroll cap; masthead search occupies its own row. |
| At most 700px | 20px outer padding, three tile columns, 104px minimum tile height and a 222px scroll cap; index becomes one column; tabs scroll horizontally; inspector becomes a vertical reading flow. |
| At most 480px | 16px outer padding, two tile columns, 102px minimum tile height and a 218px scroll cap. |
| At most 359px | Field heading stacks, filter fields become one column, and detail actions can wrap. |

The inspector is capped at 1250px. Desktop identity and signals share a two-column surface; conversation sits beside a 300px evidence record. The visible qualification spans the inspection surface. On mobile, evidence signals form three columns and the evidence record follows discussion. Reset remains in the search row. Local overflow belongs to the field, tabs, code blocks and tables, not the page.

## Elevation & Depth

Tonal contrast and rules do most of the work. The featured mint surface has a restrained solid lower offset (`0 5px 0 #6d927b`); discussion events use `0 4px 0 var(--soft)`. These are material distinctions, not floating-card blur effects. Native focus uses a 3px outline with a 4px default offset, tightened where controls sit inside a group or tile.

**The Evidence Before Effects Rule.** Depth and motion identify surfaces and state; neither simulates hardware nor encodes evidence quality.

## Shapes

Marks use 1px corners, tiles and status chips 2px, general controls and boards 3px, and the theme group 4px. Borders are mostly thin structural rules; secondary entries have a 3px top rule and discussion events a 4px top rule. Lifecycle symbols add a circle, diamond or cross alongside text; CI/review symbols distinguish result categories.

Native controls have at least 44px targets. A 22px status mark is informational within its full tile button, not an independent tiny control. Preserve the actual tile geometry rather than reintroducing the former 48px record columns.

## Components

### Native controls, search and navigation

Buttons use 10px/14px padding, a 3px radius, soft backgrounds and selected hover fill; active buttons move down 1px. Disabled controls use reduced opacity and retain native semantics. The source action uses ochre and an inline original SVG icon. Search is an ivory inset within the pine masthead, with Reset in the same row. Light/Dark/System are explicit pressed-state buttons.

Collection tabs use a filled active state; evidence filters use an active underline. Filter & sort is a native disclosure. Native elements, original SVG paths and CSS define the UI: no copied component effects, GSAP or UI framework.

### Signal mosaic

One tile shows project, PR number, optional Stale age and three categorical marks in PR/review/CI order. Tile hover and selection change the background and border. A text preview and accessible label expand the evidence. Arrows move by the computed grid width; Home/End reach the first/last tile.

Earlier reviews retain approved or changes-requested tones and display `+~` or `!~`. Index entries and inspector show the real verdict plus a separate Earlier head label. Staleness does not repaint a failed or successful check as a different result.

### Featured index and inspector

The first filtered contribution is featured by position, not merit. Its mint material, larger project name and summary anchor the index. Subsequent contributions are open stations. The focused inspector gives actual identity/title room beside independently labeled signals.

The short Gin race caveat remains visible outside disclosures. Detailed context includes exact dates, head and observation provenance. Initial-head baselines are metadata only. Previous/next follows the filtered set; Back restores the initiating item or tile and page scroll position.

### Readable public discussion

Public messages intentionally render safe Markdown: headings, lists, quotations, tables, fenced code and disclosures. The source body and hash remain unchanged. Original text and Original source are always available for messages.

`marked` feeds a pure `parse5` AST; a strict allowlist creates DOM nodes without `innerHTML` or `DOMParser`. HTML comments are hidden except as literal code. Links require safe HTTPS URLs; no automatic image or embed loads occur. Code and tables scroll locally. Limits and per-message exceptions are visible, not silent truncation: 100,000 characters, 10,000 visited AST nodes and 128 render levels. Parsing happens before the latter two limits; deep quotations can still cause a caught RangeError.

The pinned, self-hosted parser dependency graph is a deliberate reading feature, not an animation or framework dependency. README.md owns versions, licensing, installation and loading-cost details.

### Supporting and unavailable states

Empty, loading, stale, help and feedback states reuse the same palette and forms. All-snapshot failure applies `body.unavailable`, hides inert controls and removes Loading claims. Empty discussion distinguishes unavailable evidence from hidden automation. Actor categories remain explicit.

Exact Chi feedback stays in the collection-only Reviewer feedback disclosure and is not generalized into praise for other work.

### Motion

Control-color transitions use 180ms ease-out. Changing collection views restarts a 180ms opacity transition from .65 to 1 with `cubic-bezier(.16,1,.3,1)`. Reduced-motion mode removes animation and transitions and uses automatic scrolling. There is no spring engine, ornamental timeline or animated score.

## Do's and Don'ts

### Do:
- **Do** keep real lifecycle, review and CI separate from age and earlier-head qualifiers.
- **Do** preserve the mint first result, open secondary entries and real per-PR tile mosaic.
- **Do** start in dark mode and honor explicit Light, Dark and System choices.
- **Do** preserve 44px targets, local overflow, readable text and instant reduced-motion updates.
- **Do** retain original text, source links, exact dates, actor categories and visible formatting limits.
- **Do** keep the Gin caveat visible and the Chi quotation collection-specific.

### Don't:
- **Don't** restore the neutral ledger, light-first default or narrow record-column field.
- **Don't** invent combined scores, live activity, fixed UI counts or endorsement from comments.
- **Don't** replace real status colors with stale or earlier-head age categories.
- **Don't** inject parser markup into the browser or automatically load message images and embeds.
- **Don't** claim parser failures are impossible or hide the original message after a formatting error.
- **Don't** treat source documentation or functional checks as complete artistic approval.
