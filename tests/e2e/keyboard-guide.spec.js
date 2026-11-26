const { test, expect } = require('@playwright/test');

const ALL_PAGES = [
  '/',
  '/shelves/top/',
  '/shelves/middle/',
  '/shelves/bottom/',
  '/curation/',
  '/accessibility/',
];

test.describe('Cross-Site Native Tab Order, Device Attribute Compliance, Copy Cleanliness & Keyboard Guide', () => {
  for (const route of ALL_PAGES) {
    test(`audit ${route}: native Tab, 2.5.3 Label in Name, >=44px controls, 2.4.11 clearance, alt text, zero brackets/scar tissue`, async ({ page }) => {
      await page.goto(route);

      const report = await page.evaluate(() => {
        // 1. Zero tabindex="-1" on interactive controls (outside closed dialogs)
        const interactiveSel = 'a[href], button, input, select, textarea, summary';
        const badTabIndex = [...document.querySelectorAll(interactiveSel)]
          .filter(el => !el.closest('dialog:not([open])') && el.getAttribute('tabindex') === '-1')
          .map(el => el.outerHTML.slice(0, 100));

        // 2. WCAG 2.5.3 Label in Name on visible controls
        const bad253 = [];
        for (const el of document.querySelectorAll('a[href], button')) {
          if (el.closest('dialog:not([open]), [hidden]')) continue;
          const style = getComputedStyle(el);
          if (style.display === 'none' || style.visibility === 'hidden') continue;
          const clone = el.cloneNode(true);
          clone.querySelectorAll('[aria-hidden="true"], .visually-hidden, .sr-only').forEach(n => n.remove());
          const visibleText = clone.textContent.trim().replace(/\s+/g, ' ').toLowerCase();
          const ariaLabel = (el.getAttribute('aria-label') || '').trim().toLowerCase();
          if (visibleText && ariaLabel && !ariaLabel.includes(visibleText)) {
            bad253.push({ visibleText, ariaLabel });
          }
        }

        // 3. >= 44x44px touch targets on visible buttons
        const smallButtons = [];
        for (const btn of document.querySelectorAll('button')) {
          if (btn.closest('dialog:not([open]), [hidden], .steps[hidden]')) continue;
          const style = getComputedStyle(btn);
          if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) continue;
          const r = btn.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          if (r.width < 43.5 || r.height < 43.5) {
            smallButtons.push({ text: btn.textContent.trim().slice(0, 40), w: Math.round(r.width), h: Math.round(r.height) });
          }
        }

        // 4. Every visible <img> has meaningful non-empty alt text and zero title duplicating alt
        const badImages = [];
        for (const img of document.querySelectorAll('img')) {
          if (img.closest('dialog:not([open])')) continue;
          const alt = (img.getAttribute('alt') || '').trim();
          const title = (img.getAttribute('title') || '').trim();
          if (!alt) badImages.push({ reason: 'empty-alt', src: img.getAttribute('src') });
          if (title && title === alt) badImages.push({ reason: 'duplicate-title', src: img.getAttribute('src') });
        }

        // 5. Zero editorial square brackets or scar tissue in rendered <main> and <footer>
        const text = `${document.querySelector('main')?.innerText || ''}\n${document.querySelector('footer')?.innerText || ''}`;
        const hasBrackets = /[\[\]]/.test(text);
        const scarMatch =
          text.match(/\b(TBC|TODO|CHECK)\b/)?.[0] ||
          text.match(/\b(first draft|Lorem|Paliki)\b/i)?.[0] ||
          null;

        // 6. WCAG 2.4.11 scroll-padding-top >= sticky header height
        const scrollPad = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
        const headerH = document.querySelector('header.site-header')?.getBoundingClientRect().height || 0;

        return { badTabIndex, bad253, smallButtons, badImages, hasBrackets, scarMatch, scrollPad, headerH };
      });

      expect(report.badTabIndex).toEqual([]);
      expect(report.bad253).toEqual([]);
      expect(report.smallButtons).toEqual([]);
      expect(report.badImages).toEqual([]);
      expect(report.hasBrackets).toBe(false);
      expect(report.scarMatch).toBeNull();
      expect(report.scrollPad).toBeGreaterThanOrEqual(report.headerH);
    });
  }

  test('Keyboard Guide enables declaratively across pages without changing DOM tab order and turns off cleanly', async ({ page }) => {
    await page.goto('/shelves/middle/');

    const tabCountBefore = await page.evaluate(() =>
      [...document.querySelectorAll('a[href], button, input, select, textarea, summary')]
        .filter(el => !el.closest('dialog:not([open]), [hidden]') && el.tabIndex >= 0).length
    );

    await page.locator('#a11y-trigger').click();
    await page.locator('#a11y-keyboard-guide').click();
    await expect(page.locator('#a11y-keyboard-guide')).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Escape');

    // Legend and declarative badges render
    await expect(page.locator('.kg-legend')).toBeVisible();
    const badgeCount = await page.locator('.kg-badge').count();
    expect(badgeCount).toBeGreaterThanOrEqual(3);

    // Overlay layers are aria-hidden="true" and add zero interactive controls inside .kg-layer
    const layerFocusable = await page.evaluate(() =>
      document.querySelectorAll('.kg-layer a, .kg-layer button, .kg-layer [tabindex]').length
    );
    expect(layerFocusable).toBe(0);

    // Persists across navigation to Home
    await page.goto('/');
    await expect(page.locator('.kg-legend')).toBeVisible();
    expect(await page.locator('.kg-badge').count()).toBeGreaterThanOrEqual(3);

    // Turn off via legend button restores clean DOM
    await page.locator('.kg-legend button').click();
    await expect(page.locator('.kg-legend')).toHaveCount(0);
    await expect(page.locator('.kg-badge')).toHaveCount(0);

    await page.goto('/shelves/middle/');
    const tabCountAfter = await page.evaluate(() =>
      [...document.querySelectorAll('a[href], button, input, select, textarea, summary')]
        .filter(el => !el.closest('dialog:not([open]), [hidden]') && el.tabIndex >= 0).length
    );
    expect(tabCountAfter).toBe(tabCountBefore);
  });
});
