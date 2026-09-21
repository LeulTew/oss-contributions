---
name: Contribution workspace
description: A familiar, neutral PR workspace with readable discussion and independent evidence.
colors:
  bg: "#0d1117"
  subtle: "#151b23"
  hover: "#212830"
  text: "#f0f6fc"
  muted: "#919ba6"
  border: "#3d444d"
  strong-border: "#656c76"
  link: "#79c0ff"
  green: "#56d364"
  purple: "#d2a8ff"
  red: "#ff7b72"
  amber: "#e3b341"
  warning: "#272115"
  light-bg: "#ffffff"
  light-subtle: "#f6f8fa"
  light-hover: "#eef1f4"
  light-text: "#1f2328"
  light-muted: "#59636e"
  light-border: "#d1d9e0"
  light-strong-border: "#8c959f"
  light-link: "#0969da"
  light-green: "#1a7f37"
  light-purple: "#8250df"
  light-red: "#cf222e"
  light-amber: "#9a6700"
  light-warning: "#fff8c5"
  accent: "#fd8c73"
typography:
  headline:
    fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif'
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.5
  title:
    fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif'
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.5
  body:
    fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif'
    fontSize: "14px"
    lineHeight: 1.5
  discussion:
    fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif'
    fontSize: "16px"
    lineHeight: 1.6
  code:
    fontFamily: "ui-monospace,SFMono-Regular,Consolas,monospace"
    fontSize: "13px"
    lineHeight: 1.6
rounded:
  code: "4px"
  control: "6px"
  menu: "8px"
  pill: "20px"
spacing:
  tight: "4px"
  compact: "8px"
  control: "12px"
  inset: "16px"
  reading: "20px"
  section: "24px"
  wide: "32px"
components:
  button:
    backgroundColor: "{colors.subtle}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
  button-hover:
    backgroundColor: "{colors.hover}"
  search:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "10px 40px"
  navigation:
    textColor: "{colors.text}"
    padding: "10px 14px"
  age-pill:
    textColor: "{colors.muted}"
    rounded: "{rounded.pill}"
    padding: "0 6px"
  discussion:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
  discussion-heading:
    backgroundColor: "{colors.subtle}"
    textColor: "{colors.muted}"
    padding: "8px 16px"
---

# Design System: Contribution workspace

## Overview

**Creative North Star: "Familiar contribution workspace"**

The user-pinned GitHub/Primer-like category standard is the visual authority: system type, neutral surfaces, blue links and categorical status marks. This is an original implementation with no GitHub affiliation, not a new brand concept or a copied component library.

Compact controls and modest headings leave room for real contribution evidence and readable discussion. Dark is the first-visit default; Light, Dark and System remain explicit, persistent choices when storage is available.

**Key Characteristics:**
- Neutral surfaces and fine slate dividers.
- System typography with a compact operational scale and larger reading text.
- Independent status marks with text and symbols, not color alone.
- Native links, buttons, selects and disclosures.

## Colors

White/slate light surfaces and charcoal dark surfaces support the same evidence hierarchy. Unprefixed frontmatter colors describe the default dark theme; `light-*` records its light counterpart. The stylesheet uses the same unprefixed CSS variables in either theme.

### Primary
- **Link blue** identifies destinations, focus outlines and selected theme controls.
- **Navigation coral** is a narrow active-route underline, not a status or large decorative fill.

### Secondary
- **Status green** marks open PRs, reported CI success and approved reviews.
- **Status purple** marks merged PRs.
- **Status red** marks closed PRs, failed CI and change requests.
- **Status amber** marks pending/gated CI and important qualifications.

### Neutral
- **Canvas**, **subtle surface** and **hover surface** distinguish reading areas, control/header bands and interaction.
- **Text** and **muted text** separate content from metadata.
- **Border** and **strong border** divide surfaces and clarify interactive or quoted edges.
- **Warning surface** supports genuine failure or unavailable-evidence notices.

**The Independent Evidence Rule.** PR state, review and CI keep their own categorical marks; stale age and earlier-head qualifiers remain neutral and never recolor the underlying decision.

## Typography

Use the local system stack for UI and discussion, and local monospace for code. There is no remote font or oversized display treatment.

- **Headline:** modest page, help and empty-state headings.
- **Title:** semibold PR links and conversation headings; PR links reduce to 15px at the narrow breakpoint.
- **Body:** operational copy, metadata, controls and status labels.
- **Discussion:** full message bodies, with more reading space.
- **Code:** literal source and formatted code; small numeric counters are also permitted.

The selected PR title is 26px/1.35 at weight 500, reducing to 22px on stacked layouts. Markdown headings use 22/18/16px steps, with the largest reducing to 20px on narrow screens. Do not convert these contextual headings into a promotional display scale.

## Layout

The header is bounded at 1280px and main content at 1216px, with desktop horizontal padding of 32px. A compact header and one navigation row precede search, filters and a single bordered PR list. Rows use icon/content/trailing-count columns and shared dividers, not independent featured cards.

Inspection uses a flexible conversation column and a 240px context column separated by 32px. At 800px and below it becomes one column, with the collapsed context before conversation; gutters reduce to 20px. At 480px and below, main gutters reduce to 12px, the search field takes its own row and source actions become full-width. State controls remain on one line; the redundant unfiltered result count is visually hidden but accessible. Long content wraps, while code and tables scroll locally.

Use the spacing scale for controls and reading surfaces rather than adding pre-list promotional space. Surface-specific routing and content placement live in `.impeccable/surfaces/site-index-html.md`.

## Elevation & Depth

**The Flat Reading Rule.** Lists and messages use borders and subtle header bands, not lifted-card shadows.

Only anchored Theme and Filters panels use a small overlay shadow (`0 8px 24px #0002`). Selected theme controls use an inset blue underline. There is no decorative lift, glass, gradient or view-transition effect.

## Shapes

Controls, list frames, notices and message containers use the control radius. Filters use the slightly larger menu radius; code uses the smaller code radius. Counters and neutral qualifiers are pills, not rectangular status tiles. One-pixel borders and shared list separators organize the workspace.

## Components

### Buttons and fields

Native, restrained controls use subtle backgrounds, fine borders and at least 44px control height. Buttons use medium weight; hover changes background and border. Search uses the canvas background and inset icon/shortcut space. Disabled controls retain native disabled semantics with reduced opacity.

Focus is a 2px blue outline offset by 3px. Buttons and links transition only background, border and text color for 150ms ease-out when motion is permitted. Reduced motion removes animations and transitions and uses automatic scrolling.

### Navigation and theme

Primary destinations are real links with `aria-current`, a coral active underline and 48px minimum height. Narrow layouts hide decorative icons rather than introducing another navigation layer. Theme is a native disclosure containing Light/Dark/System buttons with pressed state and 44px minimum targets.

### Status marks and qualifiers

Categorical colors accompany readable text and symbols. Stale, Historical, Earlier head and actor labels use muted text; age alone does not produce an amber alarm. Counts use tabular numerals.

### Lists and discussion

One shared border contains the PR rows, each separated by a rule and highlighted subtly on hover. Discussion messages have a subtle metadata band, padded reading body and native Original text disclosure. Original-source links remain explicit. Full messages are not clipped into promotional excerpts.

### Disclosures and notices

Theme, Filters, Details & checks, Original text and scoped review feedback use native disclosure behavior. Deep context is collapsed, while the important Gin qualification stays visible. A stale-only global notice is neutral; collection failures and unavailable activity use warning treatment. Help remains a primary destination, including unavailable-data states.

## Do's and Don'ts

### Do:
- **Do** keep lifecycle, review, CI and observation age visually independent.
- **Do** use neutral bordered reading surfaces, blue links and native controls.
- **Do** retain full message text, source access and honest actor labels.
- **Do** preserve explicit theme choice, visible focus and reduced-motion behavior.

### Don't:
- **Don't** restore pine/mint branding, a mosaic, a hero or a featured PR.
- **Don't** substitute color, sentiment or a combined score for evidence.
- **Don't** add decorative view animation or lifted reading cards.
- **Don't** imply GitHub affiliation, an award or a design score.
