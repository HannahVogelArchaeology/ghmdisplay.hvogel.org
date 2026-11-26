const { test, expect } = require('@playwright/test');

const SHELVES = [
  {
    url: '/shelves/top/',
    title: 'Top Shelf',
    eyebrow: 'Shelf 1 of 3',
    expectedCount: 1,
    hasJumpStrip: false,
    prevLabel: 'Home',
    nextLabel: 'Middle Shelf',
    model3dNums: [],
  },
  {
    url: '/shelves/middle/',
    title: 'Middle Shelf',
    eyebrow: 'Shelf 2 of 3',
    expectedCount: 7,
    hasJumpStrip: true,
    prevLabel: 'Top Shelf',
    nextLabel: 'Bottom Shelf',
    model3dNums: [4, 5, 6, 8],
  },
  {
    url: '/shelves/bottom/',
    title: 'Bottom Shelf',
    eyebrow: 'Shelf 3 of 3',
    expectedCount: 3,
    hasJumpStrip: true,
    prevLabel: 'Middle Shelf',
    nextLabel: 'Curation & Acknowledgements',
    model3dNums: [9, 10],
  },
];

test.describe('Shelf Pages, Thumbnail Galleries, Jump Strip, Viewers & Audio Player (Outcome 3B)', () => {
  test('all 3 shelves render all 11 objects with canonical IDs, capitalized headings/page-turns, zero external UI CDNs, and full accessibility contracts', async ({ page }) => {
    const externalCdnRequests = [];
    page.on('request', req => {
      const u = req.url();
      if (/swiper|fontawesome|font-awesome|cdnjs|jsdelivr|unpkg/i.test(u)) {
        externalCdnRequests.push(u);
      }
    });

    let totalObjects = 0;

    for (const shelf of SHELVES) {
      await page.goto(shelf.url);

      // Capitalized heading & eyebrow
      await expect(page.locator('h1')).toContainText(shelf.title);
      await expect(page.locator('.shelf-header .eyebrow')).toContainText(shelf.eyebrow);

      // Page-turn links
      const pageTurn = page.locator('nav.page-turn');
      await expect(pageTurn.locator('.page-turn__link--prev')).toContainText(shelf.prevLabel);
      await expect(pageTurn.locator('.page-turn__link--next')).toContainText(shelf.nextLabel);

      // Artifact count & canonical IDs matching search-index.json
      const cards = page.locator('article.artifact-card');
      await expect(cards).toHaveCount(shelf.expectedCount);
      totalObjects += shelf.expectedCount;

      const idsValid = await page.evaluate(() => {
        const articles = [...document.querySelectorAll('article.artifact-card')];
        return articles.every(art => {
          const id = art.id;
          const labelledBy = art.getAttribute('aria-labelledby') || '';
          const h2 = art.querySelector('h2');
          return (
            id.startsWith('art-') &&
            labelledBy === `art-heading-${id.slice(4)}` &&
            h2?.id === labelledBy
          );
        });
      });
      expect(idsValid).toBe(true);

      // Jump strip presence: Middle & Bottom ONLY, absent on Top
      const jumpStrip = page.locator('section.object-jump');
      if (shelf.hasJumpStrip) {
        await expect(jumpStrip).toBeVisible();
        await expect(jumpStrip.locator('h2')).toHaveText('Explore the objects');
        await expect(jumpStrip.locator('a.object-jump__card')).toHaveCount(shelf.expectedCount);
      } else {
        await expect(jumpStrip).toHaveCount(0);
      }

      // Exact Nira 3D buttons on this shelf
      const buttons3d = page.locator('button[data-3d-src]');
      await expect(buttons3d).toHaveCount(shelf.model3dNums.length);
      for (const num of shelf.model3dNums) {
        await expect(page.locator(`button[data-3d-title^="3D model: ${num}."]`)).toHaveCount(1);
      }

      // ZERO tabindex="-1" on ANY interactive control (buttons, links, inputs, selects, summary)
      const hiddenTabControls = await page.evaluate(() => {
        const els = [...document.querySelectorAll('main a, main button, main input, main select, main summary')];
        return els
          .filter(el => el.getAttribute('tabindex') === '-1')
          .map(el => el.outerHTML.slice(0, 100));
      });
      expect(hiddenTabControls).toEqual([]);

      // Every single <img> on the page (hero, shelf thumbs, jump strip, artifact main & thumbs) has meaningful non-empty alt & zero title duplicating alt
      const imgAudit = await page.evaluate(() => {
        const imgs = [...document.querySelectorAll('main img')];
        const badAlt = [];
        const dupTitle = [];
        for (const img of imgs) {
          const alt = (img.getAttribute('alt') || '').trim();
          const title = (img.getAttribute('title') || '').trim();
          if (alt.length < 5) badAlt.push(img.outerHTML.slice(0, 100));
          if (title && title === alt) dupTitle.push(img.outerHTML.slice(0, 100));
        }
        return { count: imgs.length, badAlt, dupTitle };
      });
      expect(imgAudit.count).toBeGreaterThan(0);
      expect(imgAudit.badAlt).toEqual([]);
      expect(imgAudit.dupTitle).toEqual([]);

      // WCAG 2.5.3 Label in Name on all visible main buttons and links
      const labelViolations = await page.evaluate(() => {
        const bad = [];
        const controls = [...document.querySelectorAll('main button, main a')];
        for (const el of controls) {
          if (el.closest('dialog:not([open])') || el.hidden) continue;
          const style = getComputedStyle(el);
          if (style.display === 'none' || style.visibility === 'hidden') continue;
          const clone = el.cloneNode(true);
          clone.querySelectorAll('[aria-hidden="true"], .visually-hidden, .sr-only').forEach(n => n.remove());
          const visibleText = clone.textContent.trim().replace(/\s+/g, ' ').toLowerCase();
          const ariaLabel = (el.getAttribute('aria-label') || '').trim().toLowerCase();
          if (visibleText && ariaLabel && !ariaLabel.includes(visibleText)) {
            bad.push({ visibleText, ariaLabel });
          }
        }
        return bad;
      });
      expect(labelViolations).toEqual([]);

      // WCAG 2.5.8 / 2.5.5 >= 44x44 CSS px targets on all visible buttons, thumbnails, and jump links
      const smallTargets = await page.evaluate(() => {
        const bad = [];
        const els = [...document.querySelectorAll('main button, main a.object-jump__card, main a.page-turn__link, main select, main summary')];
        for (const el of els) {
          if (el.closest('dialog:not([open])') || el.hidden) continue;
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) continue;
          if (rect.width < 43.5 || rect.height < 43.5) {
            bad.push({
              tag: el.tagName,
              cls: el.className,
              text: el.textContent.trim().slice(0, 40),
              w: Math.round(rect.width),
              h: Math.round(rect.height),
            });
          }
        }
        return bad;
      });
      expect(smallTargets).toEqual([]);
    }

    expect(totalObjects).toBe(11);
    expect(externalCdnRequests).toEqual([]);
  });

  test('Middle Shelf 4-photo shelf carousel switches main photo, updates aria-pressed, and announces view', async ({ page }) => {
    await page.goto('/shelves/middle/');

    const shelfMedia = page.locator('.shelf-header__media');
    const thumbs = shelfMedia.locator('[data-gallery-thumb]');
    await expect(thumbs).toHaveCount(4);

    // First thumb starts pressed
    await expect(thumbs.nth(0)).toHaveAttribute('aria-pressed', 'true');
    await expect(thumbs.nth(1)).toHaveAttribute('aria-pressed', 'false');

    const initialSrc = await shelfMedia.locator('.shelf-gallery__image').getAttribute('src');

    // Click second shelf view ("Objects 3, 4 and 5")
    await thumbs.nth(1).click();
    await expect(thumbs.nth(0)).toHaveAttribute('aria-pressed', 'false');
    await expect(thumbs.nth(1)).toHaveAttribute('aria-pressed', 'true');

    const nextSrc = await shelfMedia.locator('.shelf-gallery__image').getAttribute('src');
    expect(nextSrc).not.toBe(initialSrc);
    await expect(shelfMedia.locator('[data-gallery-status]')).toContainText('View 2 of 4');
    await expect(shelfMedia.locator('[data-gallery-caption]')).toContainText('objects 3, 4 and 5');
  });

  test('"Explore the objects" jump strip jumps in-page to #art-<slug>, focuses heading unobscured below sticky header, and supports Esc dismissal', async ({ page }) => {
    await page.goto('/shelves/middle/');

    const jumpLink = page.locator('.object-jump a.object-jump__card[href="#art-amulet-of-pataikos"]');
    await expect(jumpLink).toBeVisible();

    // Hover & press Escape (WCAG 1.4.13 dismissal of hover magnification)
    await jumpLink.focus();
    await page.keyboard.press('Escape');
    await expect(page.locator('.object-jump__track')).toHaveClass(/is-jump-dismissed/);

    // Click jump link: must stay on /shelves/middle/ (no separate per-object page!)
    await jumpLink.click();
    await expect(page).toHaveURL(/\/shelves\/middle\/#art-amulet-of-pataikos$/);

    const targetHeading = page.locator('#art-heading-amulet-of-pataikos');
    await expect(targetHeading).toBeFocused();

    // WCAG 2.4.11: focused heading is NOT obscured by the sticky header
    await page.waitForTimeout(350);
    const clearanceCheck = await page.evaluate(() => {
      const header = document.querySelector('header.site-header');
      const heading = document.getElementById('art-heading-amulet-of-pataikos');
      return {
        headerBottom: header?.getBoundingClientRect().bottom || 0,
        headingTop: heading?.getBoundingClientRect().top || 0,
      };
    });
    expect(clearanceCheck.headingTop).toBeGreaterThanOrEqual(clearanceCheck.headerBottom - 2);
  });

  test('Artifact thumbnail gallery, zoomable photo <dialog> (zoom, single-click pan WCAG 2.5.7, prev/next, Esc focus return)', async ({ page }) => {
    await page.goto('/shelves/top/');

    const card = page.locator('#art-pelike');
    const thumbs = card.locator('[data-gallery-thumb]');
    await expect(thumbs).toHaveCount(3);

    // Switch via thumbnail
    await thumbs.nth(2).click();
    await expect(thumbs.nth(2)).toHaveAttribute('aria-pressed', 'true');
    await expect(card.locator('[data-gallery-status]')).toHaveText('Photo 3 of 3');

    // Open photo viewer via Enlarge button
    const enlargeBtn = card.locator('[data-gallery-enlarge]');
    await enlargeBtn.click();

    const dialog = page.locator('#photo-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('[data-pv-count]')).toHaveText('Photo 3 of 3');

    // Before zoom: Pan buttons and Zoom out/Reset use aria-disabled="true" (never native disabled, preserving focus continuity)
    const panRight = dialog.locator('[data-pv-pan-dir="right"]');
    const panDown = dialog.locator('[data-pv-pan-dir="down"]');
    const zoomIn = dialog.locator('[data-pv-zoom="in"]');
    const zoomOut = dialog.locator('[data-pv-zoom="out"]');
    const zoomReset = dialog.locator('[data-pv-zoom="reset"]');

    await expect(panRight).toHaveAttribute('aria-disabled', 'true');
    await expect(zoomOut).toHaveAttribute('aria-disabled', 'true');
    await expect(zoomReset).toHaveAttribute('aria-disabled', 'true');
    await expect(panRight).not.toHaveAttribute('disabled');
    await expect(zoomOut).not.toHaveAttribute('disabled');
    await expect(zoomReset).not.toHaveAttribute('disabled');

    // Single-click Zoom in enables single-click Pan buttons (WCAG 2.5.7)
    await zoomIn.click();
    await expect(panRight).toHaveAttribute('aria-disabled', 'false');
    await expect(panDown).toHaveAttribute('aria-disabled', 'false');
    await expect(zoomOut).toHaveAttribute('aria-disabled', 'false');
    await expect(zoomReset).toHaveAttribute('aria-disabled', 'false');

    // Single-click Pan right & Reset view: focus MUST remain inside #photo-dialog (not drop to document.body)
    await panRight.click();
    await expect(dialog.locator('[data-pv-status]')).toContainText('Panned right');
    await zoomReset.focus();
    await zoomReset.click();
    await expect(panRight).toHaveAttribute('aria-disabled', 'true');
    await expect(zoomReset).toBeFocused();

    // Zoom in again and Zoom out back to 100%: focus MUST remain on Zoom out (not drop to document.body)
    await zoomIn.click();
    await zoomOut.focus();
    await zoomOut.click();
    await expect(zoomOut).toHaveAttribute('aria-disabled', 'true');
    await expect(zoomOut).toBeFocused();

    // Prev photo inside dialog syncs back to card
    await dialog.locator('[data-pv-prev]').click();
    await expect(dialog.locator('[data-pv-count]')).toHaveText('Photo 2 of 3');

    // Escape closes dialog and restores focus to the exact Enlarge button that opened it
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(enlargeBtn).toBeFocused();
    await expect(thumbs.nth(1)).toHaveAttribute('aria-pressed', 'true');

    // Zero CSS zoom hacks on documentElement
    const docZoom = await page.evaluate(() => document.documentElement.style.zoom);
    expect(docZoom).toBe('');
  });

  test('Nira 3D <dialog> opens on demand, unloads iframe to about:blank on close, and returns focus', async ({ page }) => {
    // Intercept external Nira URL so test stays self-contained & fast
    await page.route('https://macquarie.nira.app/**', route =>
      route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Mock 3D</title><p>3D Ready</p>' }),
    );

    await page.goto('/shelves/bottom/');

    // Bottom shelf has 3 objects: 9 (3D), 10 (3D), 11 (no 3D)
    const btn3d = page.locator('#art-feeding-cup button[data-3d-src]');
    await expect(btn3d).toBeVisible();
    await expect(page.locator('#art-feeding-vessel button[data-3d-src]')).toHaveCount(0);

    await btn3d.click();
    const dialog = page.locator('#model-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('#model-dialog-title')).toContainText('9. Feeding cup');
    await expect(dialog.locator('iframe')).toHaveAttribute('src', /macquarie\.nira\.app/);
    await expect(dialog.frameLocator('iframe').locator('body')).toContainText('3D Ready');

    // Close via Escape -> iframe navigates to about:blank (genuinely unloading WebGL/3D document) & focus returns to button
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(dialog.locator('iframe')).toHaveAttribute('src', 'about:blank');
    await expect
      .poll(() =>
        dialog.locator('iframe').evaluate(f => ({
          href: f.contentWindow?.location?.href || '',
          text: f.contentDocument?.body?.textContent?.trim() || '',
        })),
      )
      .toEqual({ href: 'about:blank', text: '' });
    await expect(btn3d).toBeFocused();
  });

  test('Audio description player supports -10s/+10s skips, speed, transcript toggle, mutual exclusion, and no-JS fallback markup', async ({ page }) => {
    await page.goto('/shelves/bottom/');

    const card1 = page.locator('#art-feeding-cup');
    const card2 = page.locator('#art-spouted-vessel');

    // Enhanced player bar is visible, native audio is hidden
    await expect(card1.locator('[data-audio-bar]')).toBeVisible();
    await expect(card1.locator('audio.audio-player__native')).toBeHidden();

    // -10s / +10s single-click skip controls update audio time and status
    const forwardBtn = card1.locator('[data-audio-skip="10"]');
    const rewindBtn = card1.locator('[data-audio-skip="-10"]');
    await expect(forwardBtn).toBeVisible();
    await expect(rewindBtn).toBeVisible();

    await forwardBtn.click();
    await expect(card1.locator('[data-audio-status]')).toContainText('Forwarded 10 seconds');
    await rewindBtn.click();
    await expect(card1.locator('[data-audio-status]')).toContainText('Rewound 10 seconds');

    // Speed selector changes playbackRate
    const speedSelect = card1.locator('[data-audio-speed]');
    await speedSelect.selectOption('1.5');
    const rate = await card1.locator('audio').evaluate(a => a.playbackRate);
    expect(rate).toBe(1.5);

    // Transcript <details> opens and reveals curatorial audio description text
    const details = card1.locator('details.artifact-transcript');
    await expect(details).not.toHaveAttribute('open', '');
    await details.locator('summary').click();
    await expect(details).toHaveAttribute('open', '');
    await expect(details).toContainText('white porcelain cup');

    // Mutual exclusion: dispatching play on second audio pauses the first audio & any video
    const mutualExclusionWorks = await page.evaluate(() => {
      const audios = [...document.querySelectorAll('audio')];
      if (audios.length < 2) return false;
      let pausedFirst = false;
      Object.defineProperty(audios[0], 'paused', { configurable: true, get: () => pausedFirst });
      audios[0].pause = () => {
        pausedFirst = true;
      };
      audios[1].dispatchEvent(new Event('play', { bubbles: false }));
      return pausedFirst;
    });
    expect(mutualExclusionWorks).toBe(true);

    // Dimensions formatting omits 0 values cleanly (Feeding cup is [53, 124, 0] -> "H: 53 mm, W: 124 mm")
    await expect(card1.locator('.artifact-meta')).toContainText('H: 53 mm, W: 124 mm');
    await expect(card1.locator('.artifact-meta')).not.toContainText('0 mm');
    await expect(card1.locator('.artifact-meta')).not.toContainText('n/a');
  });

  test('No-JS fallback keeps native <audio controls> and <details> transcript usable', async ({ browser, baseURL }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
    const page = await context.newPage();
    await page.goto('/shelves/top/');

    const nativeAudio = page.locator('#art-pelike audio[controls]');
    await expect(nativeAudio).toBeVisible();
    await expect(nativeAudio).toHaveAttribute('preload', 'none');
    await expect(page.locator('#art-pelike [data-audio-bar]')).toBeHidden();

    const details = page.locator('#art-pelike details.artifact-transcript');
    await details.locator('summary').click();
    await expect(details).toHaveAttribute('open', '');
    await expect(details).toContainText('ceramic vessel');
    await context.close();
  });

  test('Nira 3D <dialog> updates polite status with fallback guidance after 15 seconds if slow', async ({ page }) => {
    await page.clock.install();
    await page.route('https://macquarie.nira.app/**', () => {
      // Intentionally never fulfill to simulate a slow 3D load
    });

    await page.goto('/shelves/bottom/');
    await page.locator('#art-feeding-cup button[data-3d-src]').click();

    const status = page.locator('#model-dialog [data-md-status]');
    await expect(status).toContainText('Loading 3D model');

    await page.clock.fastForward(15000);
    await expect(status).toContainText('high-resolution multi-angle photographs');
    await page.keyboard.press('Escape');
  });

  test('Shelf pages reflow cleanly at 320px width and 960px width under 200% text size and wide spacing with zero clipping or overflow', async ({ page }) => {
    await page.goto('/shelves/middle/');

    // 960px desktop width under 200% text size + wide spacing: Middle Shelf jump strip wraps to grid without squeezing or clipping
    await page.setViewportSize({ width: 960, height: 800 });
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '200%';
      document.documentElement.dataset.textSize = '200';
      document.documentElement.dataset.spacing = 'wide';
    });
    await page.waitForTimeout(100);

    const desktopReflow = await page.evaluate(() => {
      const track = document.querySelector('.object-jump__track');
      const cards = [...document.querySelectorAll('.object-jump__card')];
      const clipped = [];
      let minWidth = Infinity;
      for (const card of cards) {
        const rect = card.getBoundingClientRect();
        minWidth = Math.min(minWidth, rect.width);
        if (card.scrollWidth > card.clientWidth + 1 || card.scrollHeight > card.clientHeight + 1) {
          clipped.push({
            text: card.textContent.trim().slice(0, 30),
            sw: card.scrollWidth,
            cw: card.clientWidth,
            sh: card.scrollHeight,
            ch: card.clientHeight,
          });
        }
      }
      return {
        display: track ? getComputedStyle(track).display : '',
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        minWidth: Math.round(minWidth),
        clipped,
      };
    });
    expect(desktopReflow.display).toBe('grid');
    expect(desktopReflow.overflow).toBeLessThanOrEqual(1);
    expect(desktopReflow.minWidth).toBeGreaterThanOrEqual(180);
    expect(desktopReflow.clipped).toEqual([]);

    // 320px narrow mobile width under 200% text size + wide spacing: zero horizontal overflow
    await page.setViewportSize({ width: 320, height: 640 });
    await page.waitForTimeout(100);
    const overflow320 = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow320).toBeLessThanOrEqual(1);
  });
});
