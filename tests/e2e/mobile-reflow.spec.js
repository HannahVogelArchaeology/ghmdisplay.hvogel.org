const { test, expect } = require('@playwright/test');

const IPHONE13_VIEWPORT = { width: 390, height: 844 };

const ROUTES = [
  '/',
  '/shelves/top/',
  '/shelves/middle/',
  '/shelves/bottom/',
  '/curation/',
  '/accessibility/',
  '/404.html',
];

const MODES = [
  { name: '100%', prefs: null, browserZoom200: false },
  { name: '200% (site pref)', prefs: { size: 200, spacing: 'default', font: 'lexend', theme: 'light', keyboardGuide: false }, browserZoom200: false },
  { name: '200% (browser root font-size)', prefs: null, browserZoom200: true },
  { name: '200% + wide spacing', prefs: { size: 200, spacing: 'wide', font: 'lexend', theme: 'light', keyboardGuide: false }, browserZoom200: false },
  { name: '200% + high contrast', prefs: { size: 200, spacing: 'default', font: 'lexend', theme: 'high-contrast', keyboardGuide: false }, browserZoom200: false },
];

async function collectGeometryViolations(page, scopeSelector = null) {
  return page.evaluate((scopeSel) => {
    const vw = document.documentElement.clientWidth;
    const sw = document.documentElement.scrollWidth;
    const docOverflow = sw > vw + 1 ? { scrollWidth: sw, clientWidth: vw } : null;

    const root = scopeSel ? document.querySelector(scopeSel) : document.body;
    if (!root) {
      return { docOverflow, overlaps: [], parentClips: [], viewportClips: [], textClips: [], rowIssues: [] };
    }

    const isVisible = (el) => {
      if (!el || !el.isConnected) return false;
      if (el.closest('[hidden], .visually-hidden, .sr-only')) return false;
      const st = getComputedStyle(el);
      if (st.display === 'none' || st.visibility === 'hidden' || parseFloat(st.opacity) === 0) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0.5 && r.height > 0.5;
    };

    const describe = (el) => {
      const tag = el.tagName.toLowerCase();
      const id = el.id ? `#${el.id}` : '';
      const cls = typeof el.className === 'string' && el.className.trim()
        ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.')
        : '';
      const text = (el.textContent || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 32);
      return `${tag}${id}${cls}("${text}")`;
    };

    const interactiveSel = 'button, a[href], input, select, summary';
    const items = Array.from(root.querySelectorAll(interactiveSel)).filter((el) => {
      if (!isVisible(el)) return false;
      if (el.classList.contains('skip-link')) return false;
      if (!scopeSel) {
        const dlg = el.closest('dialog');
        if (dlg && !dlg.open) return false;
      }
      return true;
    });

    const entries = items.map((el) => {
      const st = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const boxes = st.display === 'inline'
        ? Array.from(el.getClientRects()).filter((b) => b.width > 0.5 && b.height > 0.5)
        : [r];
      return {
        el,
        desc: describe(el),
        isInline: st.display === 'inline',
        isFixed: Boolean(el.closest('.steps, .site-header, .a11y-panel, dialog[open]')),
        rect: r,
        boxes,
      };
    });

    const overlaps = [];
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const a = entries[i];
        const b = entries[j];
        if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
        if (a.isFixed !== b.isFixed) continue;
        if (a.el.closest('.steps') !== b.el.closest('.steps')) continue;

        let hit = null;
        for (const ba of a.boxes) {
          for (const bb of b.boxes) {
            const ox = Math.min(ba.right, bb.right) - Math.max(ba.left, bb.left);
            const oy = Math.min(ba.bottom, bb.bottom) - Math.max(ba.top, bb.top);
            if (ox > 1.5 && oy > 1.5) {
              hit = [Math.round(ox), Math.round(oy)];
              break;
            }
          }
          if (hit) break;
        }
        if (hit) {
          overlaps.push({ a: a.desc, b: b.desc, overlapPx: hit });
        }
      }
    }

    const parentClips = [];
    const viewportClips = [];
    const textClips = [];

    for (const item of entries) {
      const { el, rect, desc } = item;
      if (!el.closest('.table-scroll')) {
        if (rect.right > vw + 1.5 || rect.left < -1.5) {
          viewportClips.push({ el: desc, left: Math.round(rect.left), right: Math.round(rect.right), vw });
        }
        const parent = el.parentElement;
        if (parent && !el.closest('.steps')) {
          const pr = parent.getBoundingClientRect();
          if (pr.width > 0 && (rect.right > pr.right + 2 || rect.left < pr.left - 2)) {
            parentClips.push({
              el: desc,
              parent: describe(parent),
              elX: [Math.round(rect.left), Math.round(rect.right)],
              parentX: [Math.round(pr.left), Math.round(pr.right)],
            });
          }
        }
      }

      if (
        el.tagName === 'BUTTON' ||
        el.classList.contains('btn') ||
        el.classList.contains('a11y-choice') ||
        el.classList.contains('page-turn__link')
      ) {
        if (el.scrollWidth > el.clientWidth + 3) {
          textClips.push({ el: desc, scrollWidth: el.scrollWidth, clientWidth: el.clientWidth });
        }
      }
    }

    const rowSelectors = [
      '.site-header__inner',
      '.header-tools',
      '.home-hero__actions',
      '.artifact-gallery__controls',
      '.audio-player__transport',
      '.audio-player__scrub',
      '.audio-player__extras',
      '.page-turn',
      '.a11y-size-row',
      '.a11y-segment',
      '.photo-viewer__bar',
      '.photo-viewer__toolbar',
      '.photo-viewer__zoom',
      '.footer-social',
    ];
    const rowIssues = [];
    for (const sel of rowSelectors) {
      root.querySelectorAll(sel).forEach((container) => {
        if (!isVisible(container)) return;
        const cr = container.getBoundingClientRect();
        const kids = Array.from(container.children).filter(isVisible);
        if (kids.length < 2) return;
        const kidRects = kids.map((k) => ({ desc: describe(k), r: k.getBoundingClientRect() }));
        for (let i = 0; i < kidRects.length; i++) {
          const a = kidRects[i];
          if (a.r.right > cr.right + 2 || a.r.left < cr.left - 2) {
            rowIssues.push({
              container: sel,
              issue: 'child-escapes-row',
              child: a.desc,
              childX: [Math.round(a.r.left), Math.round(a.r.right)],
              containerX: [Math.round(cr.left), Math.round(cr.right)],
            });
          }
          for (let j = i + 1; j < kidRects.length; j++) {
            const b = kidRects[j];
            const ox = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
            const oy = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
            if (ox > 1 && oy > 1) {
              rowIssues.push({ container: sel, issue: 'children-overlap', a: a.desc, b: b.desc });
            }
          }
        }
        for (let i = 0; i < kidRects.length - 1; i++) {
          const a = kidRects[i];
          const b = kidRects[i + 1];
          const minH = Math.min(a.r.height, b.r.height);
          const oy = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
          if (oy > minH * 0.5 && b.r.left < a.r.right - 1) {
            rowIssues.push({ container: sel, issue: 'slipped-past-sibling', a: a.desc, b: b.desc });
          }
        }
      });
    }

    return { docOverflow, overlaps, parentClips, viewportClips, textClips, rowIssues };
  }, scopeSelector);
}

test.describe('iPhone 13 (390x844) mobile reflow, button-row alignment, and zero-overlap invariants', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(IPHONE13_VIEWPORT);
    await page.route('**/*nocookieanalytics*', (route) => route.abort());
  });

  for (const mode of MODES) {
    test(`all pages have zero overflow, zero overlap, and zero clipping at ${mode.name}`, async ({ page }) => {
      if (mode.prefs) {
        await page.addInitScript((p) => {
          localStorage.setItem('ghm_a11y_prefs', JSON.stringify(p));
        }, mode.prefs);
      }

      for (const route of ROUTES) {
        await page.goto(route, { waitUntil: 'load' });
        await page.evaluate(() => document.fonts?.ready);
        if (mode.browserZoom200) {
          await page.evaluate(() => {
            document.documentElement.style.fontSize = '200%';
          });
        }
        await page.waitForTimeout(80);

        const result = await collectGeometryViolations(page);
        expect(result.docOverflow, `${route} (${mode.name}) horizontal overflow`).toBeNull();
        expect(result.overlaps, `${route} (${mode.name}) interactive overlaps`).toEqual([]);
        expect(result.parentClips, `${route} (${mode.name}) parent clips`).toEqual([]);
        expect(result.viewportClips, `${route} (${mode.name}) viewport clips`).toEqual([]);
        expect(result.textClips, `${route} (${mode.name}) button text clips`).toEqual([]);
        expect(result.rowIssues, `${route} (${mode.name}) button row slippage/overflow`).toEqual([]);
      }
    });
  }

  test('Middle Shelf key button rows stay aligned on one row at 100% and 200% without slipping past each other', async ({ page }) => {
    for (const size of [100, 200]) {
      await page.goto('/shelves/middle/', { waitUntil: 'load' });
      await page.evaluate((s) => {
        document.documentElement.style.fontSize = s === 100 ? '' : `${s}%`;
        document.documentElement.dataset.textSize = String(s);
        return document.fonts?.ready;
      }, size);
      await page.waitForTimeout(100);

      // 1. Header Menu + Search + Accessibility sit on ONE horizontal row
      const headerRow = await page.evaluate(() => {
        const menu = document.querySelector('.nav-toggle').getBoundingClientRect();
        const search = document.querySelector('#search-trigger').getBoundingClientRect();
        const a11y = document.querySelector('#a11y-trigger').getBoundingClientRect();
        return {
          menuRight: menu.right,
          searchLeft: search.left,
          searchRight: search.right,
          a11yLeft: a11y.left,
          sameRow:
            Math.abs((menu.top + menu.bottom) / 2 - (search.top + search.bottom) / 2) < 8 &&
            Math.abs((search.top + search.bottom) / 2 - (a11y.top + a11y.bottom) / 2) < 8,
        };
      });
      expect(headerRow.sameRow, `Header controls must stay on one row at ${size}%`).toBe(true);
      expect(headerRow.searchLeft).toBeGreaterThanOrEqual(headerRow.menuRight - 1);
      expect(headerRow.a11yLeft).toBeGreaterThanOrEqual(headerRow.searchRight - 1);

      // 2. Artifact gallery Previous + Next buttons sit side-by-side on ONE row without slipping
      const galleryRow = await page.evaluate(() => {
        const ctrl = document.querySelector('.artifact-gallery__controls');
        const prev = ctrl.querySelector('[data-gallery-prev]').getBoundingClientRect();
        const next = ctrl.querySelector('[data-gallery-next]').getBoundingClientRect();
        return {
          prevRight: prev.right,
          nextLeft: next.left,
          sameRow: Math.abs(prev.top - next.top) < 4,
          sameHeight: Math.abs(prev.height - next.height) < 4,
        };
      });
      expect(galleryRow.sameRow, `Previous and Next photo buttons must stay on one row at ${size}%`).toBe(true);
      expect(galleryRow.sameHeight, `Previous and Next photo buttons must match height at ${size}%`).toBe(true);
      expect(galleryRow.nextLeft).toBeGreaterThan(galleryRow.prevRight);
    }
  });

  for (const mode of [
    { name: '100%', prefs: null },
    { name: '200%', prefs: { size: 200, spacing: 'default', font: 'lexend', theme: 'light', keyboardGuide: false } },
    { name: '200% + wide spacing', prefs: { size: 200, spacing: 'wide', font: 'lexend', theme: 'light', keyboardGuide: false } },
  ]) {
    test(`interactive overlays (mobile nav, a11y panel, search dialog, photo lightbox) stay unclipped and non-overlapping at ${mode.name}`, async ({ page }) => {
      if (mode.prefs) {
        await page.addInitScript((p) => {
          localStorage.setItem('ghm_a11y_prefs', JSON.stringify(p));
        }, mode.prefs);
      }

      await page.goto('/shelves/middle/', { waitUntil: 'load' });
      await page.evaluate(() => document.fonts?.ready);
      await page.waitForTimeout(100);

      // Mobile nav
      await page.click('.nav-toggle');
      const navResult = await collectGeometryViolations(page, '.site-header');
      expect(navResult.overlaps, `mobile nav overlaps (${mode.name})`).toEqual([]);
      expect(navResult.parentClips, `mobile nav parent clips (${mode.name})`).toEqual([]);
      expect(navResult.viewportClips, `mobile nav viewport clips (${mode.name})`).toEqual([]);
      await page.click('.nav-toggle');

      // Accessibility panel
      await page.click('#a11y-trigger');
      const a11yResult = await collectGeometryViolations(page, '#a11y-panel');
      expect(a11yResult.overlaps, `a11y panel overlaps (${mode.name})`).toEqual([]);
      expect(a11yResult.parentClips, `a11y panel parent clips (${mode.name})`).toEqual([]);
      expect(a11yResult.viewportClips, `a11y panel viewport clips (${mode.name})`).toEqual([]);
      expect(a11yResult.rowIssues, `a11y panel row issues (${mode.name})`).toEqual([]);

      // Panel must not cover header trigger buttons
      const panelBelowHeader = await page.evaluate(() => {
        const trigger = document.querySelector('#a11y-trigger').getBoundingClientRect();
        const panel = document.querySelector('#a11y-panel').getBoundingClientRect();
        return panel.top >= trigger.bottom - 1;
      });
      expect(panelBelowHeader, `a11y panel must sit below header trigger (${mode.name})`).toBe(true);

      // Text-size stepper buttons stay on one row at 100% and 200%
      if (mode.name !== '200% + wide spacing') {
        const sizeRowAligned = await page.evaluate(() => {
          const btns = [...document.querySelectorAll('.a11y-size-row .a11y-choice')].map((b) => b.getBoundingClientRect());
          return (
            btns.length === 3 &&
            Math.abs(btns[0].top - btns[1].top) < 4 &&
            Math.abs(btns[1].top - btns[2].top) < 4 &&
            btns[1].left > btns[0].right &&
            btns[2].left > btns[1].right
          );
        });
        expect(sizeRowAligned, `A-/Reset/A+ must stay on one row (${mode.name})`).toBe(true);
      }
      await page.click('#a11y-close');

      // Search dialog
      await page.click('#search-trigger');
      await page.fill('#search-input', 'pelike');
      await page.waitForTimeout(150);
      const searchResult = await collectGeometryViolations(page, '#search-dialog');
      expect(searchResult.overlaps, `search dialog overlaps (${mode.name})`).toEqual([]);
      expect(searchResult.parentClips, `search dialog parent clips (${mode.name})`).toEqual([]);
      expect(searchResult.viewportClips, `search dialog viewport clips (${mode.name})`).toEqual([]);
      await page.click('#search-close');

      // Photo lightbox dialog
      await page.locator('[data-gallery-enlarge]').first().click();
      await page.waitForTimeout(200);
      const photoResult = await collectGeometryViolations(page, '#photo-dialog');
      expect(photoResult.overlaps, `photo dialog overlaps (${mode.name})`).toEqual([]);
      expect(photoResult.parentClips, `photo dialog parent clips (${mode.name})`).toEqual([]);
      expect(photoResult.viewportClips, `photo dialog viewport clips (${mode.name})`).toEqual([]);
      expect(photoResult.rowIssues, `photo dialog row issues (${mode.name})`).toEqual([]);

      if (mode.name !== '200% + wide spacing') {
        const toolbarOneRow = await page.evaluate(() => {
          const btns = [...document.querySelectorAll('.photo-viewer__toolbar .photo-viewer__btn')].map((b) => b.getBoundingClientRect());
          const cy0 = (btns[0].top + btns[0].bottom) / 2;
          return btns.every((b, idx) => idx === 0 || (Math.abs((b.top + b.bottom) / 2 - cy0) < 6 && b.left > btns[idx - 1].right));
        });
        expect(toolbarOneRow, `photo dialog toolbar buttons must stay on one row (${mode.name})`).toBe(true);
      }
      await page.click('[data-pv-close]');
    });
  }
});
