---
name: ReliefOps
description: Fraud relief operations center for partner banks
colors:
  primary: "#09090B"
  accent: "#D2E823"
  danger: "#FF334B"
  neutral-bg: "#F8F4E8"
  neutral-surface: "#EDE8D5"
  neutral-text: "#09090B"
  neutral-muted: "#52525B"
typography:
  display:
    fontFamily: '"Dela Gothic One", cursive, sans-serif'
    fontSize: "1.875rem"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  body:
    fontFamily: '"Space Grotesk", system-ui, -apple-system, sans-serif'
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "-0.015em"
  mono:
    fontFamily: '"JetBrains Mono", monospace'
    fontSize: "0.75rem"
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: "0em"
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  "2xl": "24px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.accent}"
    rounded: "{rounded.lg}"
    padding: "8px 20px"
  button-secondary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.primary}"
    rounded: "{rounded.lg}"
    padding: "8px 20px"
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.primary}"
    rounded: "{rounded.lg}"
    padding: "8px 20px"
  badge:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.accent}"
    rounded: "{rounded.sm}"
    padding: "2px 10px"
  input:
    backgroundColor: "{colors.neutral-bg}"
    textColor: "{colors.neutral-text}"
    rounded: "{rounded.lg}"
    padding: "8px 14px"
  panel:
    backgroundColor: "{colors.neutral-bg}"
    textColor: "{colors.neutral-text}"
    rounded: "{rounded.xl}"
    padding: "24px 24px"
---

# Design System: ReliefOps

## Overview

**Creative North Star: "The Ledger Desk"**

ReliefOps evokes the physical gravity of a Japanese banking relief operations desk. Heavy black ink strokes, warm archival cream paper, and mechanical tactile feedback replace ephemeral tech aesthetics with bureaucratic permanence and statutory rigor. Every surface behaves like physical paper bound in heavy black ledger boards.

The interface prioritizes dense, unambiguous clarity for operators handling time-critical fraud claims under legal scrutiny. High-contrast typography and deliberate tactile feedback ensure operators work with absolute focus and confidence under strict statutory deadlines.

**Key Characteristics:**
- Archival cream paper foundations grounded by 2px solid ink structural outlines.
- Hard neo-brutalist offset drop-shadows with zero blur radius and mechanical click action.
- High-contrast tripartite typography: authoritative display headings, utilitarian body, and tabular monospace numerals.
- Restrained high-visibility functional signals: acid yellow for focused action, coral red strictly for statutory danger.

## Colors

The palette pairs high-contrast ink and archival paper with two surgical high-visibility accents.

### Primary
- **Ink Black** (`#09090B`): Structural 2px borders, primary actions, heavy text, and crisp offset drop-shadows.

### Secondary
- **Acid Yellow** (`#D2E823`): High-priority active states, active tab backgrounds, focused selections, and key action accents.

### Tertiary
- **Coral Red** (`#FF334B`): Statutory emergency signals, overdue claims, high-risk review alerts, and destructive actions.

### Neutral
- **Warm Cream** (`#F8F4E8`): Canonical canvas background and primary paper panel fill.
- **Muted Sand** (`#EDE8D5`): Subdued card backgrounds, secondary containers, and neutral tag fills.
- **Muted Zinc** (`#52525B`): Secondary labels, table column headers, helper text, and audit metadata.

### Named Rules
**The Coral Discipline Rule.** Coral (`#FF334B`) is strictly reserved for statutory danger, critical failures, and overdue deadlines. It is never used for generic notification badges or decorative alerts.
**The Acid Accent Rule.** Acid yellow (`#D2E823`) represents operational focus and primary forward momentum: active navigation tabs, interactive focus states, primary selections, and high-priority action emphasis.

## Typography

**Display Font:** Dela Gothic One (fallback: cursive, sans-serif)
**Body Font:** Space Grotesk (fallback: system-ui, -apple-system, sans-serif)
**Mono Font:** JetBrains Mono (fallback: monospace)

**Character:** Utilitarian, physical, and authoritative. Display titles ground major screens with immovable weight, while Space Grotesk delivers clean geometric legibility and JetBrains Mono enforces strict tabular alignment.

### Hierarchy
- **Display** (Regular 400, 24px–30px / 1.5rem–1.875rem, line-height 1.2): Main page `h1` headings only.
- **Headline** (Regular 400, 18px–20px / 1.125rem–1.25rem, line-height 1.25): Modal dialog titles only.
- **Title** (Bold 700, 14px–16px / 0.875rem–1rem, line-height 1.3): Panel titles and section headers in Space Grotesk.
- **Body** (Medium 500 / Regular 400, 13px–14px / 0.8125rem–0.875rem, line-height 1.5): Case facts, descriptive text, and messages.
- **Label / Mono** (Bold 700 / Medium 500, 11px–12px / 0.6875rem–0.75rem, line-height 1.4): Table headers, status badges, case references, amounts, and timestamps (`tabular-nums`).

### Named Rules
**The Restrained Display Rule.** Dela Gothic One is used exclusively for primary page `h1` headings and modal dialog titles (exception: the brand wordmark uses Dela Gothic One). It must never appear on card headers, subheaders, body text, or statistics counters (exception: KPI figures use `font-mono font-bold tabular-nums`).
**The Sentence Case Doctrine.** Page headings (`h1`) and modal titles are rendered in clean sentence case. Never apply `uppercase` to Dela Gothic One page titles.

## Layout

The spatial model uses an 8-column to 12-column responsive grid contained within a maximum width of 1280px (`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`). Density reflects an operations workstation: compact vertical rhythm, 16px to 24px module spacing (`gap-4` to `gap-6`), and high information density.

## Elevation & Depth

Surfaces are tactile physical planes floating exactly 2px to 8px above the canvas, casting solid ink silhouettes without blur.

### Shadow Vocabulary
- **Small Shadow** (`2px 2px 0px 0px #09090B`): Badges, compact button variants, icon controls, and input resting states.
- **Medium Shadow** (`4px 4px 0px 0px #09090B`): Primary cards, workstation panels, and focused inputs.
- **Large Shadow** (`8px 8px 0px 0px #09090B`): Modal dialogs and floating slide-over panels.

### Named Rules
**The Mechanical Press Rule.** Interactive elements press physically into their shadow on hover (`translate(2px, 2px)` with shadow reducing to `2px`) and fully compress on active press (`translate(4px, 4px)` with zero shadow).
**The Modal Nesting Rule.** Panels and cards nested inside a modal must omit all drop-shadows and use a muted border (`border border-[#09090B]/15`) to prevent visual stacking clash.

## Shapes

Containers and interactive elements feature geometric curvature bound by consistent 2px solid ink strokes (`border-2 border-[#09090B]`).
- Corner radii: `rounded-2xl` (16px) for panels and modal shells; `rounded-xl` (12px) for buttons, inputs, and tab bars; `rounded-lg` (8px) for compact tags; `rounded-md` (6px) for status badges.
- Focus treatment: Accessible keyboard navigation requires `focus-visible:ring-2 focus-visible:ring-[#09090B]` with `outline-offset: 2px`.

## Components

### Buttons
- **Shape:** Rounded rectangle (`rounded-xl`, 12px; compact: `rounded-lg`, 8px).
- **Primary:** Ink background (`#09090B`), acid text (`#D2E823`), 2px border, `4px 4px` shadow, padding `px-5 py-2`.
- **Secondary / Acid:** Acid background (`#D2E823`), ink text (`#09090B`), 2px border, `4px 4px` shadow.
- **Danger:** Coral background (`#FF334B`), ink text (`#09090B`), 2px border, `4px 4px` shadow.
- **Ghost:** Transparent background, ink text (`#09090B`), 2px transparent border becoming `#09090B` on hover with acid tint.
- **Hover / Focus:** Mechanical depression via `pressable` utilities and `focus-visible:ring-2 focus-visible:ring-[#09090B]`.

### Badges & Status Chips
- **Style:** Compact uppercase pill (`px-2.5 py-0.5 rounded-md text-xs font-bold font-["Space_Grotesk"]`).
- **Structure:** Solid 2px ink border (`border-2 border-[#09090B]`) with 1px hard shadow (`shadow-[1px_1px_0px_0px_#09090B]`).

### Panels & Cards
- **Corner Style:** `rounded-2xl` (16px).
- **Border & Shadow:** `border-2 border-[#09090B] shadow-hard` (or `border border-[#09090B]/15 shadow-none` when nested in modals).
- **Padding:** `p-4 sm:p-6`.

### Inputs & Fields
- **Style:** Cream fill (`#F8F4E8`), ink border (`border-2 border-[#09090B]`), `rounded-xl` (12px), `shadow-[2px_2px_0px_0px_#09090B]`.
- **Focus:** `focus-visible:ring-2 focus-visible:ring-[#09090B]`, shifts `translate(-1px, -1px)` with `shadow-hard`.

### Tables & Data Lists
- **Header:** Transparent background, `border-b border-[#09090B]/15`, `text-xs font-bold uppercase tracking-wide text-[#52525B]`.
- **Row Focus:** Active row highlights with acid tint (`bg-[#D2E823]/25`). Never use colored side borders.

### Navigation
- **Tabs & Links:** Geometric pills (`px-3 py-1.5 rounded-lg text-sm font-semibold`). Active state uses acid fill (`bg-[#D2E823] text-[#09090B] border-[#09090B]`).

## Do's and Don'ts

### Do:
- **Do** use Dela Gothic One only for top-level page `h1` and modal dialog titles.
- **Do** format page `h1` headings in sentence case with subtitle `text-sm text-[#52525B]`.
- **Do** build primary panels with `border-2 border-[#09090B] rounded-2xl shadow-hard` and `p-4 sm:p-6` padding.
- **Do** style nested panels inside modals with `border border-[#09090B]/15` and zero shadow.
- **Do** style table headers with `text-xs font-bold uppercase tracking-wide text-[#52525B]` on transparent background.
- **Do** highlight focused table rows with `bg-[#D2E823]/25` tint across the row.
- **Do** apply `focus-visible:ring-2 focus-visible:ring-[#09090B]` for accessible keyboard focus rings.
- **Do** use JetBrains Mono with `tabular-nums` for all currency amounts, case references, timestamps, and account numbers.

### Don't:
- **Don't** use Dela Gothic One for card titles, stat values, table cells, badges, or buttons.
- **Don't** use `uppercase` on page `h1` headings.
- **Don't** use coral (`#FF334B`) for standard counters, decorative badges, or non-urgent notifications.
- **Don't** use coral for counts or badges that are not danger or overdue.
- **Don't** add colored side-stripe borders on focused table rows.
- **Don't** use fuzzy, blurred, or ambient drop-shadows; keep all shadows crisp hard-edge 0px blur.
- **Don't** use banned elements: glitch text, stickers, marquees, custom cursor, noise overlay, or side-stripe borders.
- **Don't** use banned hype words in interfaces: "syndicate", "telemetry", "command".
