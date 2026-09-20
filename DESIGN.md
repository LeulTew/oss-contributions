---
name: LeulTew Contribution Inbox
description: A correspondence workbench for inspecting public contributions and their evidence.
colors:
  ground: "#f5f6f9"
  paper: "#fff"
  ink: "#252935"
  muted: "#636978"
  line: "#dfe2ea"
  soft: "#f0f2f7"
  accent: "#454cc1"
  selected: "#eeeffd"
  rail: "#252a38"
  green: "#23724f"
  amber: "#845308"
  amber-bg: "#fff7e6"
  red: "#ab363d"
  purple: "#7248aa"
  focus: "#436ab6"
  dark-ground: "#171b24"
  dark-paper: "#202530"
  dark-ink: "#e2e5ef"
  dark-muted: "#adb3c3"
  dark-line: "#394150"
  dark-soft: "#2a303e"
  dark-accent: "#b3b8ff"
  dark-selected: "#303653"
  dark-green: "#92d7b2"
  dark-amber: "#edc37c"
  dark-amber-bg: "#382e21"
  dark-red: "#f3a8af"
  dark-purple: "#cfb0ee"
  dark-focus: "#98b9ff"
typography:
  display:
    fontFamily: '"Segoe UI", system-ui, -apple-system, sans-serif'
    fontSize: "1.9rem"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "-.03em"
  headline:
    fontFamily: '"Segoe UI", system-ui, -apple-system, sans-serif'
    fontSize: "1.1rem"
    fontWeight: 650
    lineHeight: 1.5
    letterSpacing: "-.015em"
  detail-title:
    fontFamily: '"Segoe UI", system-ui, -apple-system, sans-serif'
    fontSize: "1.3rem"
    fontWeight: 650
    lineHeight: 1.4
    letterSpacing: "-.02em"
  body:
    fontFamily: '"Segoe UI", system-ui, -apple-system, sans-serif'
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  action:
    fontFamily: '"Segoe UI", system-ui, -apple-system, sans-serif'
    fontSize: ".8rem"
    fontWeight: 400
    lineHeight: 1.5
  metadata:
    fontFamily: '"Segoe UI", system-ui, -apple-system, sans-serif'
    fontSize: ".75rem"
  reading:
    fontFamily: '"Segoe UI", system-ui, -apple-system, sans-serif'
    fontSize: ".875rem"
    fontWeight: 400
  project-title:
    fontFamily: '"Segoe UI", system-ui, -apple-system, sans-serif'
    fontSize: ".9375rem"
    fontWeight: 650
    lineHeight: 1.5
  context:
    fontFamily: '"Segoe UI", system-ui, -apple-system, sans-serif'
    fontSize: ".8125rem"
    fontWeight: 400
  quote:
    fontFamily: '"Segoe UI", system-ui, -apple-system, sans-serif'
    fontSize: "1.05rem"
    fontWeight: 500
    lineHeight: 1.7
rounded:
  control: "6px"
  notice: "7px"
  shell: "9px"
spacing:
  compact: "8px"
  small: "12px"
  medium: "16px"
  regular: "20px"
  large: "24px"
  detail: "26px"
components:
  button:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.action}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
  button-hover:
    backgroundColor: "{colors.soft}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
  snapshot-action:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.metadata}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
  search:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "11px 13px"
    width: "100%"
  navigation-selected:
    backgroundColor: "{colors.selected}"
    textColor: "{colors.accent}"
    typography: "{typography.metadata}"
    rounded: "{rounded.control}"
    padding: "10px"
  inbox-selection:
    backgroundColor: "{colors.selected}"
    textColor: "{colors.ink}"
    padding: "18px 20px"
  context:
    backgroundColor: "{colors.ground}"
    typography: "{typography.context}"
    rounded: "{rounded.control}"
  shell:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.shell}"
---

# Design System: LeulTew Contribution Inbox

## Overview

**Creative North Star: "The Correspondence Workbench"**

Graphite identity, white work planes and ink-blue selection form a quiet, task-oriented inbox. Views, selectable contributions and adjacent correspondence keep the next inspection clear without treating contribution counts as a score. The interface feels precise and familiar: system typography, restrained boundaries and useful text take precedence over imagery or ornamental surfaces.

Selection is the organizing gesture. A contribution stays connected to its review state, dated CI evidence and actor-qualified discussion; attention views narrow the work without inventing tasks from comments. Dark mode retains the same structure with graphite surfaces and pale ink-blue accents. Source-linked human quotations remain supporting evidence, not a promotional layer.

The implemented sidebar uses the paper surface, not a solid graphite fill; the `rail` token supplies the identity mark. This document follows `site/style.css`, `site/index.html` and `site/app.mjs`. Durable evidence and accessibility constraints are defined in `PRODUCT.md`. The companion `.impeccable/design.json` contains source-based component samples and illustrative tonal ramps; the ramps are not additional implemented colors.

**Key Characteristics:**
- Graphite identity and neutral work planes with ink-blue selection.
- Adjacent inbox and detail, becoming a list-to-detail flow on narrow screens.
- Ruled correspondence with no floating-card elevation.
- Separate PR, review, CI and activity evidence, each with explicit context.
- System fonts, native controls and source-linked text instead of imagery.

## Colors

Cool neutral surfaces carry the reading experience; ink-blue marks interaction, while distinct semantic colors qualify evidence. Frontmatter is the normative token layer. Each `dark-` token replaces its matching light role; `rail` remains unchanged.

### Primary

- **Ink-blue** (`accent`): source links, selected navigation text, checkboxes and the selected inbox edge.
- **Selection wash** (`selected`): the current view and selected contribution. Selection is not a success state.
- **Focus blue** (`focus`): the keyboard outline, distinct from both selection and evidence.

### Secondary

- **Evidence green** (`green`): open PRs and successful CI, always paired with their own text.
- **Evidence amber** (`amber`, `amber-bg`): pending, canceled, gated or stale evidence and warning notices. These meanings must remain distinguishable in words.
- **Attention red** (`red`): closed PRs, reported check failures and explicit changes-requested reviews; shared hue does not imply shared cause.
- **Merge purple** (`purple`): merged PR state.

### Neutral

- **Workspace ground** (`ground`): the outer canvas and inset context disclosure.
- **Paper** (`paper`): masthead, sidebar, inbox/detail shell, buttons and fields.
- **Graphite ink** (`ink`) and **secondary ink** (`muted`): primary reading and contextual metadata.
- **Correspondence rule** (`line`): shell boundaries, pane separation and event dividers.
- **Soft neutral** (`soft`): hover surfaces, initials background and static loading placeholders.
- **Graphite identity** (`rail`): the compact brand mark, not the current sidebar background.

**The Separate Evidence Rule.** Selection, PR state, changes-requested reviews, CI evidence and actor classification are different signals; never collapse them into one color or one implied verdict.

The theme button names its current mode and cycles system, dark and light. System mode follows the operating-system preference; dark mode is a complete role substitution rather than a tinted overlay.

## Typography

**Display and body font:** the system stack recorded in frontmatter. Remote fonts and image-based headings are not part of this system. Code, when present, uses the native monospace stack.

**Character:** compact interface typography with moderate weight contrast and narrowly tightened headings. Reading copy keeps generous line height; dates and counts remain visually subordinate. Counts use tabular numerals.

### Hierarchy

- **Display:** the page title uses `display`, reducing to (1.6rem) at the narrow breakpoint.
- **Headline:** `headline` supplies the general section hierarchy; the inbox heading is deliberately quieter than the page title.
- **Detail title:** `detail-title` gives the selected PR its own reading hierarchy, reducing to (1.14rem) on narrow screens.
- **Body:** `body` is the inherited root baseline, not a claim that all text is rendered at that size.
- **Primary reading:** `reading` supplies contribution summaries, selected-PR summaries and message bodies, with component line heights from (1.65) to (1.8).
- **Project title:** `project-title` makes the project name prominent within each selectable inbox row.
- **Operational metadata:** `metadata` groups view controls, filters, dates, state signals, observation qualifiers and actor labels.
- **Context:** `context` supplies the context disclosure summary and paragraphs, plus explanatory paragraphs.
- **Action:** `action` records the shared base button and field text, with component-specific emphasis rather than a promotional display treatment.
- **Quotation:** `quote` sets original human words apart through weight and line height, not dramatic scale.

The grouped declarations near the end of `site/style.css` are authoritative for these roles, including at narrow widths; they supersede earlier component-level sizes. At the default root size, metadata is 12px, primary reading is 14px, project titles are 15px and context text is 13px. These are role-specific sizes, not a universal minimum or a claim of accessibility approval. Explanatory paragraphs are capped at (75ch); messages wrap long content and preserve source line breaks.

**The Reading Priority Rule.** Keep titles and message bodies above metadata in the hierarchy; compact supporting text must not become the default for new reading surfaces.

## Layout

The wide-screen model is a masthead over a view sidebar and a two-pane work area. The masthead is (68px) high; the sidebar occupies (222px). Main content has a maximum width of (1800px), uses padding (32px 30px 0), and allows its grid children to shrink without forcing the viewport wider.

The inbox shell divides into a list pane with a minimum width of (320px) and a preferred share of (42%), plus a flexible detail pane. The list and detail each scroll at desktop sizes. List rows are full-width selectable surfaces separated by rules; the selected row has a fine accent edge. The detail pane places identity, independent evidence summaries, refresh, context and activity in reading order.

### Responsive structure

- **At 1600px and above:** main padding becomes (38px 42px 0); the inbox prefers (40%) with a minimum width of (370px). List and detail height limits increase.
- **At 1200px and below:** the sidebar narrows to (190px), main gutters tighten, the inbox prefers (44%) with a minimum width of (285px), and filter controls can wrap.
- **At 980px and below:** the sidebar becomes an in-flow, wrapping view strip above the workspace. Identity details and sidebar footer are hidden, while all view buttons remain available.
- **At 700px and below:** the shell becomes a single-pane flow. Selecting a contribution replaces the list with detail; “Back to inbox” returns to the list. Pane height limits disappear. The masthead simplifies, refresh stacks, filters and activity controls can wrap, quotations and explanatory columns become single-column, and the page title reduces in size.

The supported product target starts at (320 CSS pixels). These descriptions come from the source, not a claim of completed pixel-level or mobile visual review. Preserve the list/detail transition and access to every attention view rather than shrinking two desktop panes into a phone.

Print hides navigation, filtering and refresh controls and removes pane height limits. It is a reading rendition of the same evidence, not a separate report or identity.

## Elevation & Depth

Paper work planes, ground-toned context and one-pixel rules provide structure. There are no diffuse elevation shadows. The selected inbox row uses an inset accent line implemented as `box-shadow: inset 1px 0 var(--accent)`; it is a selection edge, not an elevated card.

**The Adjacent Context Rule.** On wide screens, preserve the selected contribution beside its discussion; use rules and tonal selection, not floating layers, to connect them.

Keyboard focus uses the focus token for an outline (3px) with an offset (3px). Buttons and links transition background and text color over (150ms ease-out) only when reduced motion is not requested. Selection does not depend on animation, movement or a loading shimmer.

## Shapes

Controls and context disclosures share restrained rounding through `control`; freshness uses `notice`, and the enclosing inbox/detail surface uses `shell`. Interior inbox rows stay square and flush to their column. PR states pair a small circular dot with text, without a filled pill around every signal.

The correspondence frame is the reusable form: a lightly rounded outer boundary containing ruled, rectilinear work. Initials and the compact brand mark are identity details, not a reason to repeat decorative badges or avatars throughout activity.

## Components

### Buttons

Ordinary actions use paper, ink, a thin rule border and `button` padding, with a base minimum height of (40px). Hover uses soft neutral and a firmer border. Disabled actions retain readable action text, a waiting cursor and reduced opacity (.65).

Quiet actions use transparent backgrounds and borders with secondary ink. The theme button exposes its current mode in its visible label. “Check this PR now” uses accent text but stays a bounded read action, not a filled marketing CTA.

### Fields and view navigation

Search is a full-width native field with the `search` surface and padding. Its accessible label is visually hidden in the implemented layout; the placeholder provides a query hint, not the only programmatic name. CI and sort controls have visible compact labels; activity type has a visually hidden label. Native checkboxes use the accent color.

View navigation is a group of actual buttons with `aria-pressed`, not an ARIA tablist. Selected views gain selection wash, accent text and weight (650); view buttons retain a minimum height of (40px). Rules group general views, attention views and lifecycle states. Counts are contextual observations, not notification badges asserting unread work.

The attention view is labeled “Changes requested”: it describes explicit `CHANGES_REQUESTED` review states, not a request for someone to perform a review or an assigned author task. Earlier-head requests remain qualified in the row and detail.

### Selectable contribution and activity rows

Each inbox item is a full-width button containing project/number, date, a plain-language summary and independent signals. Hover uses soft neutral; selection uses wash plus the inset edge. The row is not itself an outbound link: selecting it opens the detail context, where GitHub remains directly accessible.

The Recent activity view uses the same row structure with actor-qualified event text. Feed excerpts clamp visually; full content belongs in the detail pane. Automation inclusion is explicit rather than silently mixing every actor into one human conversation.

### Detail and evidence summaries

The detail header separates repository identity, PR title, summary and lifecycle metadata. Review and CI appear in separate definition-list blocks, each with an observation qualifier. The context disclosure retains technical evidence and original-source access behind a native summary control.

Selecting a contribution updates the address and focuses the detail title. The application restores keyed row and source-link focus after relevant re-renders, with a result-summary fallback when an item is absent. Narrow screens expose a Back to inbox action; these behaviors are implementation facts, not a claim that every keyboard path has been visually reviewed.

If filtering or changing views excludes the selected PR from the filtered contribution results, selection and detail are cleared, its address parameter is removed and any direct check is canceled. Detail must not continue presenting a hidden, out-of-results selection.

### Refresh and warning surfaces

The top freshness bar reloads the published snapshot. The selected-PR action separately checks PR and discussion evidence, with quota/cache/failure text nearby. Its result must not make the scheduled CI observation look newer.

Warnings use amber text and a tinted, bordered notice. Offline, stale, unavailable and retained evidence remain explicit. Loading uses static soft rectangles; empty attention views qualify what was observed instead of declaring that no follow-up exists.

### Actor-qualified correspondence

Activity is an ordered list of ruled events: actor, classification, date, action, body and original source. The vocabulary distinguishes PR author, verified human, automation and unclassified account. Unknown classification is not silently displayed as human.

Long messages can expand through a native “Read full message” disclosure. Message bodies preserve whitespace and wrap long values. Branch-update wording names an observation rather than claiming a push time; earlier-head review context remains attached to the review.

An initial head recording is labeled “Head first recorded” under “Dashboard observation.” It establishes a baseline, not a new branch change. Baselines remain available in the selected PR's detail but are excluded from Recent activity, inbox event counts and event-based recency ordering.

### Human quotation

A semantic figure pairs exact words with author, role/project, date and original-review link. It sits below the work area as supporting context. The attribution and specific-contribution qualification remain present; public activity is not automatically transformed into praise.

## Do's and Don'ts

### Do:

- **Do** use graphite neutrals, white work planes and ink-blue selection consistently across the inbox and detail.
- **Do** preserve separate labels and observation context for PR state, review, CI and activity.
- **Do** keep the selected work adjacent to its context on wide screens and provide a clear return path on narrow screens.
- **Do** retain semantic controls, visible keyboard focus and source-linked actor qualification.
- **Do** keep original human quotations separate from uncurated public activity.
- **Do** clear detail when the selected contribution leaves the filtered results.

### Don't:

- **Don't** convert comments or unknown account classifications into inferred author tasks or human endorsements.
- **Don't** suggest that selected-PR refresh updates scheduled CI or guarantees immediate upstream delivery.
- **Don't** replace the correspondence workbench with a scorecard, decorative card grid or floating elevation.
- **Don't** add remote fonts or ornamental imagery to this text-led interface.
- **Don't** use superseded local text sizes or illustrative color ramps as reusable tokens.
- **Don't** present an initial head baseline as newly occurring activity.
