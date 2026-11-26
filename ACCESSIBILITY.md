# Accessibility Statement

This repository builds the public exhibition website for **Disability Heritage: Archaeology with Difference** (<https://ghmdisplay.hvogel.org>), curated by Hannah Vogel at Macquarie University's Gale History Museum. Access is central to both the curatorial framing and the engineering of this site: every accessibility mode is maintained as a primary, composable experience rather than a secondary fallback.

## Conformance Target

- **Target standard:** Web Content Accessibility Guidelines (WCAG) 2.2 at **Level AA** across every public page (`/`, `/shelves/top/`, `/shelves/middle/`, `/shelves/bottom/`, `/curation/`, `/accessibility/`, and `/404.html`).
- **Colour contrast:** Every foreground/background text, link, caption, and control token across the **Light**, **Dark**, and **High Contrast** themes is engineered to meet **WCAG 2.2 Level AAA** contrast (**at least 7.0:1**), with non-text boundaries and focus indicators at **at least 3.0:1**.
- **Self-hosted assets:** All reading fonts, interface icons, and client-side scripts are self-hosted so accessibility controls continue to operate reliably without third-party font or UI CDNs.

## Built-in Accessibility Controls and Media

Every page provides a collapsible **Accessibility** panel in the header (desktop and mobile) whose preferences persist locally in `localStorage` without cookies and apply before first paint to prevent a flash of unstyled content:

- **Reading font:** Self-hosted **Lexend** (default), **Atkinson Hyperlegible**, **OpenDyslexic**, and **Gentium** (serif).
- **Text spacing (anti-crowding):** **Default**, **Relaxed**, and **Wide** steps expanding line height, paragraph gaps, letter spacing, and word spacing up to WCAG 1.4.12 thresholds, automatically engaging wider Lexend letter-spacing grades (`Lexend Exa` and `Lexend Mega`) when Lexend is active.
- **Text size:** Root `rem`-based scaling from **80% to 200%** in 10% increments, preserving lossless WCAG 1.4.10 reflow down to a 320 CSS px viewport width.
- **Display themes and OS preferences:** **Auto** (honouring `prefers-color-scheme` and `prefers-contrast: more`), warm archival-paper **Light**, warm charcoal **Dark**, stripped-back **High Contrast**, and Windows High Contrast (`forced-colors: active`).
- **Reduced motion:** Honours `prefers-reduced-motion: reduce` site-wide and automatically switches the homepage scroll-rising shelf panels to a static vertical layout whenever reduced motion, narrow viewports (`< 760px`), High Contrast, `forced-colors: active`, enlarged text (`>= 150%`), or expanded spacing is active.
- **Keyboard Guide:** Optional visual badge overlay highlighting real controls via declarative `data-kg-*` attributes without changing DOM tab order.
- **Multimodal exhibition media:** Spoken and Auslan (Australian Sign Language) introduction videos with closed captions and expandable full transcripts; per-object audio descriptions with speed, volume, seek, `−10s`/`+10s` skip controls, and full written transcripts; enlarged photo viewer with zoom and single-click pan buttons; and high-resolution multi-angle photographic fallbacks for all interactive Nira 3D scans.
- **On-campus museum kiosk mode:** Opt-in `?kiosk=on` mode for the Gale History Museum display iPad with a 5-minute idle timer, a 20-second WCAG 2.2.1 expiry warning dialogue, full accessibility-preference reset on expiry, and client-side SVG QR codes for external links.

## Assistive Technology and Device Support Matrix

| Assistive Technology / Mode | Implemented HTML, ARIA, and Interaction Guarantees | Governing WCAG 2.2 Criteria |
|---|---|---|
| **Screen Readers** (NVDA, JAWS, VoiceOver, TalkBack) | `lang="en-AU"` on `<html>`; native landmarks (`<header>`, `<nav aria-label>`, `<main>`, `<search>`, `<footer>`, `<section aria-labelledby>`, `<article aria-labelledby>`); ordered headings; `aria-current="page"`, `aria-expanded` + `aria-controls`, `aria-pressed`, `aria-haspopup="dialog"`, `aria-valuetext`, concise `aria-live="polite"` / `role="status"` announcements; `aria-hidden="true"` on decorative SVGs; meaningful non-empty `alt` text on all photographs and gallery thumbnails. | 1.1.1, 1.3.1, 2.4.6, 3.1.1, 4.1.2, 4.1.3 |
| **Refreshable Braille Displays** | Linear, concise accessible names; `<th scope="col">` and `<th scope="row">` on licence tables; semantic `<dl>`/`<dt>`/`<dd>` structures for object metadata and team lists; non-chatty status updates; no `title` attributes duplicating `alt` text. | 1.3.1, 2.4.6, 4.1.3 |
| **Voice Control / Speech Recognition** (Dragon, Apple Voice Control, Windows Voice Access) | Exact visible button and link text preserved inside each control's accessible name (Label in Name); distinct accessible names for repeated actions across object cards; native `<button>`, `<a>`, and `<input>` roles. | 2.5.3, 4.1.2 |
| **Keyboard-Only, Switch Access, Head Pointers, Eye Gaze, and Touch** | 100% native `Tab` / `Shift+Tab` focus order on every interactive control (zero `tabindex="-1"` hiding buttons); minimum `44×44` CSS px interactive targets; single-pointer button alternatives to every drag or pinch gesture (photo zoom/pan buttons, audio `−10s`/`+10s` skip buttons); activation on `click`; dynamic `scroll-padding-top` preventing sticky-header focus obscuration; high-contrast `>= 3px` `:focus-visible` outlines. | 2.1.1, 2.4.7, 2.4.11, 2.4.13, 2.5.1, 2.5.2, 2.5.5, 2.5.7, 2.5.8 |
| **Screen Magnifiers and Low Vision** (ZoomText, Fusion, OS Zoom, Windows Forced Colors) | `rem`-based 200% text scaling and lossless 320px/400% reflow; WCAG 1.4.12 spacing dial; `>= 7:1` AAA contrast tokens across all three themes; visible structural borders and native sliders in `forced-colors: active`; hover/focus tooltips hoverable, persistent, and dismissible via `Esc`. | 1.4.3, 1.4.4, 1.4.6, 1.4.10, 1.4.11, 1.4.12, 1.4.13 |
| **Reader Modes and Text-to-Speech** | Semantic HTML prose, `<figure>`/`<figcaption>`, and native `<details>` transcripts present in the initial DOM without requiring JavaScript. | 1.3.1, 1.3.2 |
| **Deaf and Hard of Hearing Media** | `<video controls>` with `<track kind="captions" srclang="en-AU" default>`, dedicated Auslan introduction video, expandable transcripts, and full `prefers-reduced-motion: reduce` support. | 1.2.2, 1.2.3, 1.2.6, 2.3.3 |

## Transparent WCAG 2.1.4 Disclosure: Experimental `/` Search Shortcut

Visitors can open Site Search from the **Search** button in the header, by pressing `Ctrl+K` (`Cmd+K` on macOS), or by pressing the bare `/` key. Because bare `/` is a single-character shortcut under **WCAG 2.1.4 (Character Key Shortcuts, Level A)**, it is shipped explicitly as an experimental trade-off currently under lived-experience evaluation with the **Disability Research Leaders Community of Practice** (see [`docs/community-uat-protocol.md`](docs/community-uat-protocol.md)).

To prevent accidental activation while typing or navigating modals, the `/` listener is suppressed whenever focus sits inside an `<input>`, `<textarea>`, `<select>`, `[contenteditable]` region, or open `<dialog>`. If community testing identifies any accidental triggers or conflicts with voice control, switch access, or screen reader browse modes, the bare `/` binding will be removed while retaining the header Search button and `Ctrl+K` / `Cmd+K`.

## Automated Continuous Integration Verification

Every pull request and push to `main` is verified through automated workflows in `.github/workflows/`:

- **Lighthouse Accessibility:** Must score **100** on both desktop and mobile across all public exhibition pages.
- **axe-core WCAG 2.2 A/AA:** Must report **zero violations** across all pages (including `/404.html`) in **Light**, **Dark**, and **High Contrast** themes on desktop and mobile viewports (`_scripts/axe-report.mjs`).
- **Colour Contrast Token Audit:** Verifies `>= 7.0:1` text/link contrast and `>= 3.0:1` UI/focus contrast across all colour tokens (`_scripts/check-contrast.mjs`).
- **Data Schema Validation:** Validates all YAML exhibition, team, portrait, and licence files against JSON schemas (`_data/schemas/`).
- **Playwright End-to-End Tests:** Verifies native keyboard navigation, focus restoration, WCAG 2.5.3 Label in Name, target sizing, 200% text and 320px reflow, search behaviour, media transcripts, and gallery kiosk mode.

Automated audits catch structural and contrast regressions reliably, but they cannot substitute for lived-experience testing with disabled visitors. Structured community evaluation is guided by [`docs/community-uat-protocol.md`](docs/community-uat-protocol.md).

## Feedback and Reporting Accessibility Barriers

If you experience an accessibility barrier on <https://ghmdisplay.hvogel.org>, or have a suggestion to improve access:

- Open an issue in the public repository: <https://github.com/HannahVogelArchaeology/ghmdisplay.hvogel.org/issues>
- Contact Macquarie University's Gale History Museum: <https://www.mq.edu.au/faculty-of-arts/about/gale-history-museum>

Please include the page URL, the browser or assistive technology you were using, and a brief description of what happened so we can reproduce and resolve the barrier promptly.
