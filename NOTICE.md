# Copyright, Licence, and Third-Party Notices

## Exhibition Content and Website Code

- **Exhibition content and media:** All curatorial text, object descriptions, captions, alt text, photographs, audio descriptions, transcripts, and videos are **© 2026 Hannah Vogel and Gale History Museum**. All rights reserved unless otherwise noted beside an individual asset.
- **Website source code:** All original website templates, stylesheets, scripts, and build tooling in this repository—including the self-authored client-side SVG QR code generator (`assets/js/qr-svg.js`), exhibition shelf schematic (`_includes/shelf-icon.html`), and site icon (`assets/favicon.svg`)—are distributed under the **MIT License** (see [`LICENSE`](LICENSE)).

### Template and Prototype Provenance

This site was synthesised from two Macquarie University student capstone prototypes (Group 33 and Group 34) whose initial repository scaffolding derived from [Minima 2.5.2](https://github.com/jekyll/minima/tree/v2.5.2) (commit `c6e74bbfe7a0d0ae8c806cb38b012d01b25b1f7d`), copyright Parker Moore, Joel Glovier, and the Minima contributors, distributed under the MIT License retained in [`LICENSE`](LICENSE). All layouts, design tokens, accessibility controls, media viewers, and scripts were subsequently rebuilt as a standalone Jekyll site with no remaining Minima templates or stylesheets.

---

## Third-Party Assets Sent to Website Visitors

All fonts and icons used on the live website are self-hosted inside `assets/` with zero external font or icon CDNs.

### Fonts (SIL Open Font License 1.1)

The full text of the SIL Open Font License, Version 1.1 accompanies each font family in its directory under `assets/fonts/`.

- **Lexend (variable weight, Lexend Exa, and Lexend Mega):** Copyright 2019 The Lexend Project Authors (Bonnie Shaver-Troup and Thomas Jockin; <https://www.lexend.com/>). Self-hosted WOFF2 files packaged from [Fontsource](https://fontsource.org/) v5.3.0. Licensed under the SIL Open Font License 1.1 (`assets/fonts/lexend/LICENSE`).
- **Atkinson Hyperlegible:** Copyright 2020 Braille Institute of America, Inc. (<https://www.brailleinstitute.org/freefont/>). Self-hosted WOFF2 files packaged from [Fontsource](https://fontsource.org/fonts/atkinson-hyperlegible) v5.3.0. Licensed under the SIL Open Font License 1.1 (`assets/fonts/atkinson-hyperlegible/LICENSE`).
- **OpenDyslexic:** Copyright (c) 2012–2019 Abbie Gonzalez (<https://opendyslexic.org/>), with Reserved Font Name OpenDyslexic. Self-hosted WOFF2 files packaged from [Fontsource](https://fontsource.org/) v5.3.0. Licensed under the SIL Open Font License 1.1 (`assets/fonts/opendyslexic/LICENSE`).
- **Gentium Plus:** Copyright (c) 2003–2022 SIL International (<https://software.sil.org/gentium/>). Self-hosted WOFF2 files packaged from [Fontsource](https://fontsource.org/) v5.3.0. Licensed under the SIL Open Font License 1.1 (`assets/fonts/gentium/LICENSE`).

### Icons (ISC License)

Interface icons in `assets/icons/` (rendered via `_includes/icon.html`) come from [Lucide](https://lucide.dev) v0.469.0, distributed under the ISC License:

> Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2022.
>
> Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.
>
> THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.

### Self-Authored Runtime Utilities (MIT License)

- **Client-side SVG QR Code Utility (`assets/js/qr-svg.js`):** Self-authored, zero-dependency byte-mode SVG QR encoder used exclusively in museum gallery kiosk mode (`?kiosk=on`) to render scannable QR codes for external links without calling external QR services. Released under this repository's MIT License.

---

## Build, Validation, and Audit Tools (Not Sent to Visitors)

The following open-source tools are used to build, validate, and audit the exhibition website locally and in GitHub Actions:

| Tool | Role | Licence | Author / Maintainer |
|---|---|---|---|
| **Jekyll 4.4.1** (with `jekyll-seo-tag` and `jekyll-feed`) | Static site generator and page metadata | MIT License | Jekyll contributors (<https://jekyllrb.com>) |
| **Rake 13** | Build and image pipeline tasks | MIT License | Jim Weirich and Ruby contributors (<https://github.com/ruby/rake>) |
| **ImageMagick** | Responsive image resizing and low-quality image placeholders | ImageMagick License | ImageMagick Studio LLC (<https://imagemagick.org>) |
| **axe-core 4.14.0** | Automated WCAG 2.2 A/AA accessibility checks | Mozilla Public License 2.0 | Deque Systems (<https://www.deque.com/axe/>) |
| **Lighthouse 13.5.0** | Automated accessibility, performance, best-practices, and SEO audits | Apache License 2.0 | Google LLC (<https://github.com/GoogleChrome/lighthouse>) |
| **Puppeteer 25.13.0** | Headless browser runner for automated accessibility audits | Apache License 2.0 | Google LLC (<https://pptr.dev>) |
| **Playwright** | End-to-end and cross-mode browser testing | Apache License 2.0 | Microsoft Corporation (<https://playwright.dev>) |
| **check-jsonschema 0.38.2** | YAML data validation against JSON schemas | Apache License 2.0 | Stephen Rosen (<https://github.com/python-jsonschema/check-jsonschema>) |
| **GitHub Actions** (`checkout`, `cache`, `setup-node`, `upload-artifact`, `download-artifact`, `configure-pages`, `upload-pages-artifact`, `deploy-pages`) | Continuous integration and GitHub Pages deployment | MIT License | GitHub, Inc. (<https://github.com/actions>) |
| **ruby/setup-ruby** | Ruby environment setup in GitHub Actions | MIT License | Ruby contributors (<https://github.com/ruby/setup-ruby>) |
