# Disability Heritage: Archaeology with Difference

Public online exhibition website for **Disability Heritage: Archaeology with Difference** at Macquarie University's [Gale History Museum](https://www.mq.edu.au/faculty-of-arts/about/gale-history-museum) (**10 November 2026 to 11 March 2027**) and online indefinitely at **<https://ghmdisplay.hvogel.org>**.

- **Curator and content owner:** Hannah Vogel (School of Humanities, Macquarie University)
- **Technical and accessibility lead:** Dr Brian Ballsun-Stanton (Macquarie University)
- **Funding:** [National Disability Research Partnership](https://www.ndrp.org.au/) Disability Leadership Program (2026) and an Australian Government Research Training Program Scholarship ([DOI: 10.82133/C42F-K220](https://doi.org/10.82133/C42F-K220))

This production Jekyll site was synthesised from two Macquarie University student capstone prototypes created by Group 33 and Group 34 (see [`CONTRIBUTORS.md`](CONTRIBUTORS.md)).

---

## Accessibility and Exhibition Features

Access is built into both the curatorial framing and the engineering of the site. Every accessibility mode is maintained as a first-class, composable experience rather than a fallback (see [`ACCESSIBILITY.md`](ACCESSIBILITY.md) for the full conformance statement and assistive-technology matrix):

- **WCAG 2.2 AA conformance with AAA (`>= 7:1`) contrast:** All text, link, caption, and control tokens pass Level AAA contrast across **Light**, **Dark**, and **High Contrast** themes, honouring `prefers-color-scheme`, `prefers-contrast: more`, `forced-colors: active`, and `prefers-reduced-motion: reduce`.
- **Cookieless Accessibility panel:** Persisted locally in `localStorage` and applied before first paint—offering four self-hosted reading fonts (**Lexend**, **Atkinson Hyperlegible**, **OpenDyslexic**, **Gentium Plus**), a stepped WCAG 1.4.12 **Text spacing** dial, **80%–200%** `rem` text scaling with lossless mobile/320px reflow, display themes, and an optional visual **Keyboard Guide**.
- **Multimodal media:**
  - Lazy-loaded, SRI-pinned **Able Player 5.0.0** for both the spoken **Video Introduction** and the 1080p 50fps **Auslan Introduction**, using self-hosted MP4 files and local WebVTT closed captions (customizable caption styling, interactive clickable synchronized transcripts, mutual play/pause, guarded YouTube fallback outside kiosk mode, and native `<video controls>` fallback if offline).
  - Per-object **audio description** players with playback speed, volume, seek bar, single-click `−10s` / `+10s` skip buttons, and expandable written transcripts.
  - Universal zoomable `<dialog>` **photo viewer** with pointer drag/pinch and single-click WCAG 2.5.7 zoom/pan controls.
  - On-demand **Nira 3D** model viewers paired with multi-angle photographs, descriptive alt text, and audio descriptions.
- **Site search and section navigation:** Client-side exhibition search (`Search` button, `Ctrl+K` / `Cmd+K`, and experimental `/`), in-page shelf jump strips, and a top-to-footer section stepper (`Shift+↑` for back to top).
- **Museum gallery kiosk mode (`?kiosk=on` / `?kiosk=off`):** Opt-in mode for the on-campus Gale History Museum display iPad featuring a 5-minute idle reset with a 20-second WCAG 2.2.1 warning dialogue, full preference reset, background prefetch of self-hosted introduction videos, and client-side SVG QR codes for external links (zero external QR services).

---

## Repository Structure

| Path | Purpose |
|---|---|
| `pages/` | Exhibition pages (`index.md`, `shelves/{top,middle,bottom}.md`, `curation.md`, `accessibility.md`) |
| `_data/` | Structured YAML shelf catalogue (`shelves/`), JSON schemas (`schemas/`), team, curator portrait, and software licence data |
| `_layouts/` & `_includes/` | Semantic HTML layouts, shared chrome, reusable Able Player facade, responsive image helper, and modal `<dialog>` templates |
| `_sass/` | Design tokens (`_tokens.scss`), base styles, components, layouts, and page stylesheets |
| `assets/` | Self-hosted fonts (`fonts/`), Lucide/social SVG icons (`icons/`), favicons, Open Graph cards (`images/og/`), audio/video/WebVTT media, and ES module scripts (`js/`) |
| `_scripts/` | Build/audit helpers: static HTTP/Range server (`serve.mjs`), WCAG AAA contrast checker (`check-contrast.mjs`), and 3-theme `axe-core` runner (`axe-report.mjs`) |
| `tests/` | Playwright end-to-end, accessibility, kiosk, search, and iPhone 13 Chromium/WebKit mobile-reflow test suites |
| `.github/workflows/` | Automated GitHub Pages deployment (`pages.yml`), YAML schema validation (`validate-data.yml`), and Lighthouse + `axe-core` audits (`lighthouse.yml`) |

---

## Local Development

### Prerequisites

- **Ruby `4.0.7`** (pinned in `.ruby-version`) and **Bundler**
- **ImageMagick** (`magick` or `convert`) for generating responsive JPEGs, blur placeholders, and image dimensions
- **Node.js** (for contrast checks, Playwright tests, and the local static preview server)

### Build and Preview

```bash
bundle install
bundle exec rake serve
```

`bundle exec rake serve` runs the `images` task (generating 400w / 800w / 1600w progressive JPEGs under `assets/resized/`, `_data/lqip.json`, and `_data/image_dims.json`) and serves the site at **<http://127.0.0.1:4000/>**.

For a production build into `_site/`:

```bash
bundle exec rake build
```

When testing large video Range streaming or running local Lighthouse audits, serve the built `_site/` with the concurrent Node static server instead of WEBrick:

```bash
node _scripts/serve.mjs _site 4000
```

---

## Verification and Audits

```bash
# 1. WCAG 2.2 AAA colour-token contrast audit (Light, Dark, High Contrast)
node _scripts/check-contrast.mjs

# 2. Playwright end-to-end suite (Desktop Chrome, Pixel 7, iPhone 13 Chromium)
npm --prefix tests ci
./tests/node_modules/.bin/playwright test --config tests/playwright.config.js

# Optional: also run iPhone 13 WebKit (Safari engine)
PLAYWRIGHT_WEBKIT=1 ./tests/node_modules/.bin/playwright test --config tests/playwright.config.js
```

Continuous integration in `.github/workflows/` enforces:
- **Pages (`pages.yml`):** Builds responsive images and deploys `main` automatically to <https://ghmdisplay.hvogel.org>.
- **Data validation (`validate-data.yml`):** Validates `_data/` YAML files against `_data/schemas/`.
- **Lighthouse + axe-core (`lighthouse.yml`):** Audits desktop and mobile pages against the **100 Accessibility** invariant and **zero axe-core WCAG 2.2 A/AA violations** across Light, Dark, and High Contrast themes.

Lived-experience testing with the Disability Research Leaders Community of Practice is documented in [`docs/community-uat-protocol.md`](docs/community-uat-protocol.md).

---

## Licences and Attribution

- **Exhibition content and media:** All curatorial text, object metadata, captions, alt text, photographs, audio descriptions, transcripts, and videos are **© 2026 Hannah Vogel and Gale History Museum**. All rights reserved unless otherwise stated beside an individual asset.
- **Website source code:** All website templates, stylesheets, scripts, and tooling in this repository are released under the **MIT License** (see [`LICENSE`](LICENSE)).
- **Third-party notices, citation, and contributors:** Full third-party copyright/licence texts, citation metadata, and team acknowledgements are recorded in [`NOTICE.md`](NOTICE.md), [`CITATION.cff`](CITATION.cff), and [`CONTRIBUTORS.md`](CONTRIBUTORS.md).
