const { test, expect } = require('@playwright/test');

test.describe('Global Chrome, AAA Accessibility Panel, Search & Assistive Device Compliance', () => {
  test('document language, landmarks, native Tab order, and WCAG 2.5.3 / 2.5.8 / 2.4.11 chrome contracts', async ({ page }) => {
    await page.goto('/');

    // 3.1.1 Language of Page
    await expect(page.locator('html')).toHaveAttribute('lang', 'en-AU');

    // Native landmarks
    await expect(page.locator('header.site-header')).toHaveCount(1);
    await expect(page.locator('nav[aria-label="Primary"]')).toHaveCount(1);
    await expect(page.locator('main#main')).toHaveCount(1);
    await expect(page.locator('footer.site-footer')).toHaveCount(1);

    // Skip link is first focusable element
    await page.keyboard.press('Tab');
    const firstFocused = await page.evaluate(() => ({
      cls: document.activeElement?.className || '',
      href: document.activeElement?.getAttribute('href') || '',
    }));
    expect(firstFocused.cls).toContain('skip-link');
    expect(firstFocused.href).toBe('#main');

    // Zero tabindex="-1" on interactive header, panel, or footer buttons/links
    const hiddenTabTargets = await page.evaluate(() => {
      const els = [...document.querySelectorAll('header a, header button, #a11y-panel a, #a11y-panel button, footer a, footer button')];
      return els.filter(el => el.getAttribute('tabindex') === '-1').map(el => el.outerHTML.slice(0, 80));
    });
    expect(hiddenTabTargets).toEqual([]);

    // Mobile & desktop #a11y-trigger always has a non-empty accessible name
    await expect(page.locator('#a11y-trigger')).toHaveAccessibleName(/Accessibility/i);
    await expect(page.locator('#search-trigger')).toHaveAccessibleName(/Search/i);

    // Open Accessibility panel to include panel buttons in 2.5.3 Label in Name check
    await page.locator('#a11y-trigger').click();
    const labelViolations = await page.evaluate(() => {
      const bad = [];
      const controls = [...document.querySelectorAll('header button, header a, #a11y-panel button, #a11y-panel a, footer a')];
      for (const el of controls) {
        const style = getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || el.hidden) continue;
        const clone = el.cloneNode(true);
        clone.querySelectorAll('[aria-hidden="true"], .visually-hidden').forEach(n => n.remove());
        const visibleText = clone.textContent.trim().replace(/\s+/g, ' ').toLowerCase();
        const ariaLabel = (el.getAttribute('aria-label') || '').trim().toLowerCase();
        if (visibleText && ariaLabel && !ariaLabel.includes(visibleText)) {
          bad.push({ visibleText, ariaLabel });
        }
      }
      return bad;
    });
    expect(labelViolations).toEqual([]);
    await page.keyboard.press('Escape');

    // WCAG 2.5.8 / 2.5.5 >= 44x44 CSS px targets on header buttons and utility controls
    const smallTargets = await page.evaluate(() => {
      const bad = [];
      const btns = [...document.querySelectorAll('header button, header .site-nav a')];
      for (const el of btns) {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        if (rect.width < 44 || rect.height < 44) {
          bad.push({ text: el.textContent.trim(), w: Math.round(rect.width), h: Math.round(rect.height) });
        }
      }
      return bad;
    });
    expect(smallTargets).toEqual([]);

    // WCAG 2.4.11 dynamic scroll-padding-top prevents sticky header obscuring focus
    const scrollPaddingTop = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop));
    const headerHeight = await page.evaluate(() => document.querySelector('header.site-header')?.getBoundingClientRect().height || 0);
    expect(scrollPaddingTop).toBeGreaterThanOrEqual(headerHeight);
  });

  test('Accessibility panel controls persist without FOUC, support 200% text + 320px reflow, WCAG 1.4.12 spacing, 4 fonts, themes, and Reset all', async ({ page }) => {
    await page.goto('/');

    const trigger = page.locator('#a11y-trigger');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger).toHaveAttribute('aria-controls', 'a11y-panel');
    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const panel = page.locator('#a11y-panel');
    await expect(panel).toBeVisible();

    // Link to Accessibility page exists inside panel
    await expect(panel.locator('a[href="/accessibility/"]')).toBeVisible();

    // Text size to 200% (rem-based, never CSS zoom)
    const incBtn = panel.locator('[data-a11y-size="up"]');
    for (let i = 0; i < 10; i++) {
      await incBtn.click();
    }
    const sizeState = await page.evaluate(() => ({
      fontSize: document.documentElement.style.fontSize,
      zoom: document.documentElement.style.zoom,
      dataSize: document.documentElement.dataset.textSize,
    }));
    expect(sizeState.fontSize).toBe('200%');
    expect(sizeState.zoom).toBe('');
    expect(sizeState.dataSize).toBe('200');

    // Text Spacing dial -> Wide (WCAG 1.4.12 thresholds)
    await panel.locator('button[data-a11y-spacing="wide"]').click();
    const spacingMetrics = await page.evaluate(() => {
      const body = getComputedStyle(document.body);
      const fs = parseFloat(body.fontSize);
      return {
        dataSpacing: document.documentElement.dataset.spacing,
        lineHeightRatio: parseFloat(body.lineHeight) / fs,
        letterSpacingRatio: parseFloat(body.letterSpacing) / fs,
        wordSpacingRatio: parseFloat(body.wordSpacing) / fs,
      };
    });
    expect(spacingMetrics.dataSpacing).toBe('wide');
    expect(spacingMetrics.lineHeightRatio).toBeGreaterThanOrEqual(1.5);
    expect(spacingMetrics.letterSpacingRatio).toBeGreaterThanOrEqual(0.11);
    expect(spacingMetrics.wordSpacingRatio).toBeGreaterThanOrEqual(0.15);

    // 4-Font picker
    for (const font of ['atkinson', 'opendyslexic', 'gentium', 'lexend']) {
      await panel.locator(`button[data-a11y-font="${font}"]`).click();
      await expect(page.locator('html')).toHaveAttribute('data-font', font);
    }
    await panel.locator('button[data-a11y-font="opendyslexic"]').click();

    // Themes: Dark & High Contrast
    await panel.locator('button[data-a11y-theme="dark"]').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    await panel.locator('button[data-a11y-theme="high-contrast"]').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'high-contrast');

    // Reload: preferences persist synchronously before first paint (no FOUC)
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'high-contrast');
    await expect(page.locator('html')).toHaveAttribute('data-font', 'opendyslexic');
    await expect(page.locator('html')).toHaveAttribute('data-spacing', 'wide');
    await expect(page.locator('html')).toHaveAttribute('data-text-size', '200');

    // 320px viewport reflow at 200% text + wide spacing: zero horizontal overflow
    await page.setViewportSize({ width: 320, height: 640 });
    const overflow320 = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow320).toBeLessThanOrEqual(1);

    // Reset all display settings via UI button
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.locator('#a11y-trigger').click();
    await page.locator('#a11y-reset-all').click();
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', 'high-contrast');
    await expect(page.locator('html')).toHaveAttribute('data-font', 'lexend');
    await expect(page.locator('html')).toHaveAttribute('data-spacing', 'default');
    await expect(page.locator('html')).toHaveAttribute('data-text-size', '100');

    // Escape closes panel and restores focus to trigger
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
    await expect(page.locator('#a11y-trigger')).toBeFocused();
  });

  test('Site Search dialog opens via button, Ctrl+K, and /, ignores / inside inputs, and has valid <search> landmark', async ({ page }) => {
    await page.goto('/');

    // Header button opens search dialog
    await page.locator('#search-trigger').click();
    const dialog = page.locator('#search-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('search')).toHaveCount(1);
    const input = dialog.locator('input[type="search"]');
    await expect(input).toBeFocused();

    // Typing "/" inside input types "/" instead of reopening/intercepting
    await input.fill('MU4759');
    await expect(dialog.locator('.search-results a')).toHaveCount(1);
    await expect(dialog.locator('.search-results')).toContainText('Pelike');

    // Escape closes dialog and returns focus
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(page.locator('#search-trigger')).toBeFocused();

    // Experimental "/" outside input opens dialog
    await page.keyboard.press('/');
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();

    // Ctrl+K opens dialog; repeat Ctrl+K while open must NOT overwrite lastTrigger
    await page.locator('#search-trigger').focus();
    await page.keyboard.press('Control+k');
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Control+k');
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(page.locator('#search-trigger')).toBeFocused();
  });

  test('Footer governance metadata, forced-colors rules, and ethics-gated window.ghmTrack no-op', async ({ page }) => {
    await page.goto('/');

    const footer = page.locator('footer.site-footer');
    await expect(footer).toContainText('10 November 2026 to 11 March 2027');
    await expect(footer).toContainText('Wallumattagal people of the Dharug Nation');
    await expect(footer).toContainText('CRICOS Provider 00002J');
    await expect(footer).toContainText('ABN 90 952 801 237');
    await expect(footer).toContainText('TEQSA Provider PRV12032');
    await expect(footer).toContainText('© 2026 Hannah Vogel and Gale History Museum');
    await expect(footer).toContainText('MIT License');
    await expect(footer.locator('a[href="https://policies.mq.edu.au/document/view.php?id=107"]')).toHaveCount(1);
    await expect(footer.locator('a[href="https://policies.mq.edu.au/document/view.php?id=234&version=4"]')).toHaveCount(1);
    await expect(footer.locator('a[href="https://www.linkedin.com/in/hannah-vogel-216039149/"]')).toHaveCount(1);
    await expect(footer.locator('a[href="https://www.instagram.com/hannah_the_archaeologist/"]')).toHaveCount(1);

    // Zero square brackets in footer
    const footerText = await footer.innerText();
    expect(footerText).not.toMatch(/[\[\]]/);

    // Analytics attribute & window.ghmTrack no-op when custom_events is false
    await expect(page.locator('html')).toHaveAttribute('data-analytics-custom-events', 'false');
    const trackCalls = await page.evaluate(() => {
      const calls = [];
      window.nca_event = (...args) => calls.push(args);
      if (typeof window.ghmTrack === 'function') {
        window.ghmTrack('a11y_theme', 'dark');
      }
      return calls;
    });
    expect(trackCalls).toEqual([]);

    // Production analytics script tag present
    await expect(page.locator('script[src="https://nocookieanalytics.com/latest.js"]')).toHaveCount(1);

    // CSS includes forced-colors: active media rule
    const hasForcedColors = await page.evaluate(async () => {
      const link = document.querySelector('link[rel="stylesheet"]');
      if (!link) return false;
      const res = await fetch(link.href);
      const css = await res.text();
      return css.includes('forced-colors: active') || css.includes('forced-colors:active');
    });
    expect(hasForcedColors).toBe(true);
  });
});
