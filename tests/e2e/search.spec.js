const { test, expect } = require('@playwright/test');

test.describe('Site Search Across All 11 Objects, Shelves, Pages & Real Kiosk Integration', () => {
  test('search-index.json covers all 11 objects, 3 shelves, and 3 pages with valid target anchors', async ({ page }) => {
    await page.goto('/');
    const index = await page.evaluate(async () => {
      const r = await fetch('/assets/data/search-index.json');
      return r.json();
    });
    const objects = index.filter(x => x.type === 'object');
    const shelves = index.filter(x => x.type === 'shelf');
    const pages = index.filter(x => x.type === 'page');
    expect(objects).toHaveLength(11);
    expect(shelves).toHaveLength(3);
    expect(pages).toHaveLength(3);

    // Every object query works by number, name, accession number, or material
    await page.keyboard.press('/');
    const dialog = page.locator('#search-dialog');
    const input = dialog.locator('#search-input');
    await expect(dialog).toBeVisible();

    await input.fill('MU0523');
    await expect(dialog.locator('.search-results a')).toHaveCount(1);
    await expect(dialog.locator('.search-results a').first()).toContainText('8. Amulet of Pataikos');

    await input.fill('AHM/1985/053');
    await expect(dialog.locator('.search-results a')).toHaveCount(1);
    await expect(dialog.locator('.search-results a').first()).toContainText('9. Feeding cup');

    await input.fill('Faience');
    await expect(dialog.locator('.search-results a')).toHaveCount(1);

    // Cross-page jump from Home to Middle Shelf Object 8
    await input.fill('Pataikos');
    await dialog.locator('.search-results a').first().click();
    await page.waitForURL('**/shelves/middle/#art-amulet-of-pataikos');
    await expect(page.locator('#art-amulet-of-pataikos')).toBeVisible();
  });

  test('same-page search jump focuses target artifact heading unobscured below sticky header', async ({ page }) => {
    await page.goto('/shelves/middle/');

    await page.keyboard.press('Control+k');
    const dialog = page.locator('#search-dialog');
    await expect(dialog).toBeVisible();
    await dialog.locator('#search-input').fill('Priapus');
    await expect(dialog.locator('.search-results a')).toHaveCount(1);
    await dialog.locator('.search-results a').first().click();

    await expect(dialog).toBeHidden();
    await page.waitForTimeout(150);

    const focusMetrics = await page.evaluate(() => {
      const target = document.getElementById('art-bronze-figure-of-priapus');
      const heading = target?.querySelector('h2');
      const header = document.querySelector('header.site-header');
      return {
        focusedId: document.activeElement?.id || '',
        headingId: heading?.id || '',
        headingTop: heading?.getBoundingClientRect().top ?? -999,
        headerBottom: header?.getBoundingClientRect().bottom ?? 0,
      };
    });
    expect(focusMetrics.focusedId).toBe(focusMetrics.headingId);
    expect(focusMetrics.headingTop).toBeGreaterThanOrEqual(focusMetrics.headerBottom - 2);
  });

  test('kiosk mode integrates cleanly with real Middle Shelf Nira 3D button and external footer links', async ({ page }) => {
    await page.goto('/shelves/middle/?kiosk=on');
    await page.locator('.kiosk-confirm-dialog button[data-kiosk-confirm]').click();
    await expect(page.locator('.kiosk-confirm-dialog')).toBeHidden();

    // Real Nira 3D button on Object 4 MUST NOT be intercepted by kiosk QR dialog
    await page.route('https://macquarie.nira.app/**', route =>
      route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><p>Nira 3D</p>' })
    );
    await page.locator('#art-figure-of-a-musician .btn--3d').click();
    await expect(page.locator('#model-dialog')).toBeVisible();
    await expect(page.locator('.kiosk-qr-dialog[open]')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(page.locator('#model-dialog')).toBeHidden();

    // Real external link in footer IS intercepted by kiosk QR dialog
    await page.locator('footer a[href*="policies.mq.edu.au"]').first().click();
    await expect(page.locator('.kiosk-qr-dialog')).toBeVisible();
    await expect(page.locator('.kiosk-qr-dialog svg[role="img"]')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.kiosk-qr-dialog')).toBeHidden();

    // Turn off kiosk cleanly
    await page.goto('/?kiosk=off');
  });
});
