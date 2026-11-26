# Community of Practice User Acceptance Testing Protocol

This guide supports lived-experience User Acceptance Testing (UAT) of the **Disability Heritage: Archaeology with Difference** website (<https://ghmdisplay.hvogel.org>) with members of the **Disability Research Leaders Community of Practice** and invited disabled peers. Automated tools verify markup, contrast ratios, and baseline conformance, but only lived-experience testing can judge whether deliberate design trade-offs genuinely reduce friction across diverse assistive technologies and reading preferences.

## 1. Ethics, Privacy, and Participation Arrangements

- **Quality improvement versus publishable research:** Community consultation undertaken to identify usability barriers and improve the public exhibition website operates as quality improvement and co-design. Participant recordings, verbatim quotes, or custom accessibility-preference analytics must not be published as research data without prior Macquarie University Human Research Ethics Committee approval. Consistent with this boundary, custom accessibility-event telemetry remains disabled by default (`analytics.custom_events: false`).
- **Flexible, low-burden participation:** Testers may choose whichever format suits their access needs and energy: an asynchronous screen-and-voice recording (for example, via Zoom, Loom, or OBS), a live facilitated walkthrough with the curator, or brief written notes responding to the tasks below.
- **Advance materials and attribution:** Share the site URL and plain-text task prompts ahead of each session. Confirm each tester's preference for attribution (named acknowledgement on the exhibition site or remaining anonymous).

## 2. Accessibility Modes and Assistive Technologies to Include

Inviting even one or two testers from each cluster below helps surface practical barriers that automated checks cannot observe:

| Accessibility Mode / Group | Assistive Technology or Setup | Primary Surfaces to Evaluate |
|---|---|---|
| **Voice Control and Speech Recognition** | Dragon NaturallySpeaking, Apple Voice Control ("Show Numbers" and dictation), Windows Voice Access | Experimental `/` search shortcut (WCAG 2.1.4); visible-label matching (WCAG 2.5.3 Label in Name) on controls such as **Accessibility**, **Search**, **Audio description**, **View in 3D**, and **Close**. |
| **Screen Readers and Refreshable Braille** | NVDA (Firefox or Chrome), JAWS, VoiceOver (macOS and iOS), TalkBack, refreshable Braille display | Landmarks (`header`, `nav`, `main`, `search`, `footer`), skip link, object headings, concise `role="status"` updates, thumbnail alt text, audio player sliders, 3D model fallbacks, and `/` behaviour in browse mode. |
| **Low Vision and Screen Magnifiers** | 200%–400% browser zoom, 200% in-site text size, ZoomText, macOS Zoom, Windows High Contrast (`forced-colors`), Dark and High Contrast themes | Text reflow at 200% text size with Wide spacing; homepage scroll-rising shelf panel fallback; legibility of accession codes (such as `MU0101` and `AHM/1985/053`) in Lexend versus Atkinson Hyperlegible; enlarged photo zoom viewer; `Esc` dismissal of hover/focus tooltips. |
| **Dyslexic, Neurodivergent, and Cognitive Reading Preferences** | Lexend (default), OpenDyslexic, Atkinson Hyperlegible, Gentium; automatic Text Spacing dial; Reduced Motion | Cognitive clarity of the Accessibility panel; reading comfort across the four fonts and spacing steps; whether the homepage scroll showcase feels calm or distracting; visual clarity versus clutter of the Keyboard Guide. |
| **Keyboard-Only, Switch Access, Head Pointers, and Eye Gaze** | Standard `Tab` / `Shift+Tab` / `Enter` / `Space` / `Esc`, switch scanning, head pointer, eye gaze | Navigating from the top of Middle Shelf to Object 8 using the "Explore the objects" jump strip, Site Search, and Section Stepper; focus visibility below the sticky header; single-click photo pan and audio `−10s`/`+10s` skip controls; `>= 44×44` CSS px target sizing. |
| **Deaf and Hard of Hearing Visitors** | Auslan users and closed-caption or transcript readers (desktop and mobile) | Auslan video framing and signing clarity; caption accuracy, timing, and contrast across Light, Dark, and High Contrast themes; usefulness of expandable full transcripts. |
| **On-Campus Museum Touchscreen (Optional In-Person)** | Gale History Museum display iPad (`?kiosk=on`) | Touch target comfort in gallery conditions; scanning external-link QR codes under gallery lighting; clarity of the 5-minute idle reset countdown dialogue. |

## 3. Structured Evaluation Tasks

Each task pairs a realistic visitor goal with a focused design question and a clear action rule so community feedback translates directly into site improvements.

### Task 1: Site Search and the Experimental `/` Shortcut (WCAG 2.1.4)

- **Context:** Site Search can be opened from the **Search** button in the header, with `Ctrl+K` (`Cmd+K` on macOS), or with the single-character `/` shortcut (suppressed inside form fields and open dialogues). Bare `/` is shipped deliberately as an experiment to test whether it helps keyboard navigation or interferes with voice control and screen reader browse modes.
- **Suggested task:** Browse the Home page and Middle Shelf using your usual assistive technology, then search for `"Object 5"` or `"feeding cup"`.
- **Questions to consider:**
  1. Did Site Search ever open unexpectedly when you did not intend to search?
  2. Which way of opening Search felt most natural and reliable: the header button, `Ctrl+K` / `Cmd+K`, or `/`?
  3. Were the search results and the jump straight to the matching object clear?
- **How feedback guides changes:** If any voice-control, motor, or screen reader tester experiences an accidental `/` trigger—or recommends strict WCAG 2.1.4 compliance without single-character bindings—we will remove the bare `/` listener immediately and update the Accessibility page and `ACCESSIBILITY.md` accordingly.

### Task 2: Reading Fonts and the Automatic Text Spacing Dial (WCAG 1.4.12)

- **Context:** Self-hosted **Lexend** is the default typeface, paired with a four-font picker (**Lexend**, **Atkinson Hyperlegible**, **OpenDyslexic**, **Gentium**) and a single stepped **Text spacing** dial (**Default**, **Relaxed**, **Wide**) that adjusts line height, paragraph gaps, letter spacing, and word spacing—and engages wider Lexend spacing grades automatically—without exposing sub-variant font menus.
- **Suggested task:** Read the **About the Exhibition** section on the Home page and several Middle Shelf object cards (paying attention to accession numbers such as `MU0101` and `AHM/1985/053`), then test the four reading fonts and three text spacing levels in the Accessibility panel.
- **Questions to consider:**
  1. Is Lexend comfortable as the default reading font, including for alphanumeric accession codes?
  2. Did switching fonts or stepping the Text spacing dial noticeably improve or worsen reading comfort?
  3. Is **Gentium** valuable as a serif reading option?
  4. Did **Wide** spacing cause awkward line breaks, crowding, or overlapping controls anywhere?
- **How feedback guides changes:** Retain all four typefaces where each benefits at least one reader profile without introducing layout regressions; refine default line length or spacing values if readers report crowding before adjusting the dial.

### Task 3: Homepage Shelf Showcase under Zoom and Reduced Motion

- **Context:** On desktop screens, the three **Explore the Exhibition** shelf showcases display the full uncropped shelf photograph first and then slide a solid, opaque dark text panel up over the image as the visitor scrolls. To prevent motion discomfort or text occlusion, the showcase automatically switches to a static vertical stack under `prefers-reduced-motion: reduce`, narrow screens (`< 760px`), High Contrast mode, Windows `forced-colors`, text sizes of `150%` or greater, or expanded text spacing.
- **Suggested task:** Scroll through **Explore the Exhibition** on the Home page at your usual settings, then increase text size to **200%** in the Accessibility panel (or enable Reduce Motion on your device) and scroll through the shelves again.
- **Questions to consider:**
  1. At default settings, does the rising opaque text panel feel clear and comfortable, or disorienting and motion-triggering?
  2. Does the automatic switch to static stacked blocks at large text or reduced motion feel seamless and legible?
- **How feedback guides changes:** If multiple testers find the sticky scroll transition uncomfortable even without system reduced motion enabled, we will either add an explicit motion toggle inside the Accessibility panel or adopt the static stacked layout across all desktop views.

### Task 4: Colour Themes and Visual Contrast

- **Context:** All three display themes—warm archival-paper **Light**, warm charcoal **Dark**, and stripped-back **High Contrast**—are engineered to meet WCAG 2.2 Level AAA contrast (`>= 7:1`) alongside automatic support for system Dark mode and Windows Forced Colors.
- **Suggested task:** Spend two minutes reading in your preferred theme, then switch among **Light**, **Dark**, and **High Contrast** (and test your system High Contrast or Forced Colors setting if you use one).
- **Questions to consider:**
  1. Did you notice glare, eye fatigue, or any low-contrast border, icon, or caption?
  2. Were active states—such as the current navigation page, selected gallery thumbnail, pressed captions button, and audio slider—always unmistakable without relying on colour alone?
- **How feedback guides changes:** Adjust affected colour tokens or state indicators while maintaining at least 7:1 contrast on all text and links.

### Task 5: Keyboard Navigation, Long-Scroll Shelves, and the Visual Keyboard Guide

- **Context:** Every link, thumbnail, audio control, and dialogue button sits in the standard browser tab order. To keep long shelf pages effortless without hiding controls from `Tab`, shelves with multiple objects include an in-page **Explore the objects** jump strip alongside Site Search, the Section Stepper, and an optional visual **Keyboard Guide** overlay.
- **Suggested task:** Without using a mouse, navigate to **Middle Shelf**, reach **Object 8 (Amulet of Pataikos)**, play its audio description, expand its transcript, and open its 3D model. Turn **Keyboard Guide** on and off from the Accessibility panel while browsing.
- **Questions to consider:**
  1. Did reaching an object further down a seven-object shelf feel efficient or tiring by keyboard or screen reader?
  2. Was the visual **Keyboard Guide** genuinely useful—for instance, when learning controls or demonstrating keyboard access—or visually noisy?
  3. Did any Keyboard Guide badge obscure text or misdescribe a control?
- **How feedback guides changes:** If moving across multiple objects still requires too many tab stops, add a lightweight skip-to-next-object or back-to-shelf-overview link per card; adjust badge placement wherever overlap occurs.

### Task 6: Multimodal Media (Video, Auslan, Audio Descriptions, Enlarged Photos, and 3D Models)

- **Context:** The exhibition integrates spoken video, Auslan interpretation, closed captions, written transcripts, audio descriptions with `−10s`/`+10s` skip controls, zoomable photographs with single-click pan controls, and interactive Nira 3D models.
- **Suggested task:** Watch the **Video Introduction** and **Auslan Introduction** with captions and transcripts open, listen to at least one object's **Audio description** while toggling its transcript, enlarge an object photograph to zoom and pan, and open a **View in 3D** dialogue.
- **Questions to consider:**
  1. Are captions, Auslan framing, transcripts, and audio descriptions clear, well paced, and straightforward to control?
  2. When inspecting a zoomed photograph or playing audio without dragging a slider, do the single-click pan and `−10s`/`+10s` skip buttons work comfortably?
  3. If an embedded Nira 3D model is difficult to operate with your assistive technology, is the alternative path via multi-angle photographs and audio description obvious and satisfying?
- **How feedback guides changes:** Refine control labels, caption presentation, or 3D guidance wording directly from tester observations.

## 4. Running a Session and Recording Feedback

- **Session length:** Aim for 25 to 40 minutes of unhurried think-aloud exploration, or a shorter written response focusing on whichever tasks matter most to the tester's own assistive setup.
- **Feedback log template:** Record each observation in a simple four-column table so fixes and design rationales stay transparent:

| Device, Browser, and Assistive Technology | Page and Feature | Observation (Barrier, Friction, or Strength) | Outcome |
|---|---|---|---|
| Example: Windows 11, Firefox, NVDA 2025 | Middle Shelf / Site Search (`/`) | Pressing `/` in browse mode opened Search unexpectedly while looking for text. | Removed bare `/` binding; retained Search button and `Ctrl+K`. |

- **Evaluation schedule:** Circulate the site to early Community of Practice testers ahead of the **3 December 2026** launch so high-impact adjustments (such as refining or removing bare `/`, tuning spacing, or clarifying labels) can land before launch, and continue gathering feedback throughout the physical display period (**10 November 2026 to 11 March 2027**).
