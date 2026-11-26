const { test, expect } = require('@playwright/test');

test.describe('Gallery Kiosk Mode & Client-Side SVG QR Modal (AC-KIOSK-1)', () => {
  test('?kiosk=on opens accessible confirmation dialog, supports Cancel and Confirm, persists ghm_kiosk, and strips query param', async ({ page }) => {
    await page.goto('/?kiosk=on');

    const dialog = page.locator('dialog.kiosk-confirm-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('aria-labelledby', /.+/);
    await expect(dialog).toHaveAttribute('aria-describedby', /.+/);

    const confirmBtn = dialog.getByRole('button', { name: 'Enable kiosk mode' });
    const cancelBtn = dialog.getByRole('button', { name: 'Cancel' });
    await expect(confirmBtn).toBeFocused();

    // WCAG 2.5.8 / 2.5.5 >= 44x44 CSS px button targets
    for (const btn of [confirmBtn, cancelBtn]) {
      const box = await btn.boundingBox();
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }

    // Cancel leaves kiosk off and strips ?kiosk=on
    await cancelBtn.click();
    await expect(dialog).toBeHidden();
    expect(new URL(page.url()).searchParams.has('kiosk')).toBe(false);
    expect(await page.evaluate(() => localStorage.getItem('ghm_kiosk'))).toBeNull();

    // Confirm enables kiosk mode, persists ghm_kiosk="on", and strips ?kiosk=on
    await page.goto('/?kiosk=on');
    await expect(dialog).toBeVisible();
    await confirmBtn.click();
    await expect(dialog).toBeHidden();
    expect(new URL(page.url()).searchParams.has('kiosk')).toBe(false);
    expect(await page.evaluate(() => localStorage.getItem('ghm_kiosk'))).toBe('on');
    await expect(page.locator('html')).toHaveAttribute('data-kiosk', 'on');
  });

  test('idle timer pauses during active <audio>/<video> playback, shows WCAG 2.2.1 warning, cancels on Stay/Escape, and resets all a11y prefs on expiry', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('ghm_kiosk', 'on');
    });
    await page.clock.install();
    await page.goto('/#main');

    // Configure non-default Accessibility preferences across every setting
    await page.locator('#a11y-trigger').click();
    const panel = page.locator('#a11y-panel');
    await expect(panel).toBeVisible();
    await panel.locator('[data-a11y-size="up"]').click();
    await panel.locator('[data-a11y-size="up"]').click();
    await panel.locator('button[data-a11y-spacing="wide"]').click();
    await panel.locator('button[data-a11y-font="opendyslexic"]').click();
    await panel.locator('button[data-a11y-theme="dark"]').click();
    await panel.locator('#a11y-keyboard-guide').click();
    await page.locator('#a11y-close').click();

    await expect(page.locator('html')).toHaveAttribute('data-text-size', '120');
    await expect(page.locator('html')).toHaveAttribute('data-spacing', 'wide');
    await expect(page.locator('html')).toHaveAttribute('data-font', 'opendyslexic');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('html')).toHaveAttribute('data-keyboard-guide', 'on');

    // Inject synthetic playing <audio> element: idle timer MUST pause while playing
    await page.evaluate(() => {
      const audio = document.createElement('audio');
      audio.id = 'test-kiosk-audio';
      Object.defineProperty(audio, 'paused', { value: false, configurable: true });
      Object.defineProperty(audio, 'ended', { value: false, configurable: true });
      document.body.append(audio);
    });
    await page.clock.fastForward(160_000);
    await page.clock.fastForward(160_000);
    const warningDialog = page.locator('dialog.kiosk-warning-dialog');
    await expect(warningDialog).toHaveCount(0);

    // Pause <audio>, inject playing <video>: idle timer MUST stay paused while <video> plays
    await page.evaluate(() => {
      const audio = document.getElementById('test-kiosk-audio');
      Object.defineProperty(audio, 'paused', { value: true, configurable: true });
      const video = document.createElement('video');
      video.id = 'test-kiosk-video';
      Object.defineProperty(video, 'paused', { value: false, configurable: true });
      Object.defineProperty(video, 'ended', { value: false, configurable: true });
      document.body.append(video);
    });
    await page.clock.fastForward(160_000);
    await page.clock.fastForward(160_000);
    await expect(warningDialog).toHaveCount(0);

    // Pause <video> so idle countdown starts cleanly
    await page.evaluate(() => {
      const video = document.getElementById('test-kiosk-video');
      Object.defineProperty(video, 'paused', { value: true, configurable: true });
    });

    // Advance past 300s - 20s = 280s -> WCAG 2.2.1 warning dialog opens
    await page.clock.fastForward(281_000);
    await expect(warningDialog).toBeVisible();
    await expect(warningDialog).toHaveAttribute('aria-labelledby', /.+/);
    await expect(warningDialog).toHaveAttribute('aria-describedby', /.+/);
    await expect(warningDialog).toContainText('Are you still there?');
    await expect(warningDialog).toContainText(/This display will reset in \d+ seconds?\./);
    await expect(warningDialog.locator('[role="status"][aria-live="polite"]')).toHaveCount(1);

    const stayBtn = warningDialog.getByRole('button', { name: "I'm still here" });
    await expect(stayBtn).toBeFocused();
    const stayBox = await stayBtn.boundingBox();
    expect(stayBox.width).toBeGreaterThanOrEqual(44);
    expect(stayBox.height).toBeGreaterThanOrEqual(44);

    // Clicking "I'm still here" cancels reset and restarts idle countdown
    await stayBtn.click();
    await expect(warningDialog).toBeHidden();
    await page.clock.fastForward(200_000);
    await expect(warningDialog).toBeHidden();

    // Assistive-tech synthetic click-only activation (no pointerdown/keydown) resets idle clock
    await page.evaluate(() => {
      document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await page.clock.fastForward(200_000);
    await expect(warningDialog).toBeHidden();

    // Persisted bfcache pageshow event resets idle clock and keeps interval active
    await page.evaluate(() => {
      window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    });
    await page.clock.fastForward(200_000);
    await expect(warningDialog).toBeHidden();

    // Open #a11y-panel and let warning appear: single Escape closes warningDialog directly
    await page.locator('#a11y-trigger').click();
    await expect(panel).toBeVisible();
    await page.clock.fastForward(281_000);
    await expect(warningDialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(warningDialog).toBeHidden();
    await page.locator('#a11y-close').click();
    await page.clock.fastForward(150_000);
    await expect(warningDialog).toBeHidden();

    // Advance to trigger warning, then let countdown reach 0 -> full reset + navigate to /
    await page.clock.fastForward(131_000);
    await expect(warningDialog).toBeVisible();

    await Promise.all([
      page.waitForEvent('load'),
      page.clock.fastForward(21_000),
    ]);

    const landed = new URL(page.url());
    expect(landed.pathname).toBe('/');
    expect(landed.hash).toBe('');
    expect(await page.evaluate(() => localStorage.getItem('ghm_a11y_prefs'))).toBeNull();
    await expect(page.locator('html')).toHaveAttribute('data-text-size', '100');
    await expect(page.locator('html')).toHaveAttribute('data-spacing', 'default');
    await expect(page.locator('html')).toHaveAttribute('data-font', 'lexend');
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('html')).toHaveAttribute('data-keyboard-guide', 'off');
  });

  test('intercepts all external links with self-generated SVG QR modal (zero external network calls) while leaving internal links & Nira 3D triggers unaffected', async ({ page }) => {
    const externalRequests = [];
    await page.addInitScript(() => {
      localStorage.setItem('ghm_kiosk', 'on');
    });

    await page.goto('/');
    const origin = new URL(page.url()).origin;
    page.on('request', req => {
      const reqUrl = new URL(req.url());
      if (reqUrl.origin !== origin && reqUrl.hostname !== 'nocookieanalytics.com') {
        externalRequests.push(req.url());
      }
    });

    const qrDialog = page.locator('dialog.kiosk-qr-dialog');
    const externalHrefs = [
      'https://www.linkedin.com/in/hannah-vogel-216039149/',
      'https://www.instagram.com/hannah_the_archaeologist/',
      'https://policies.mq.edu.au/document/view.php?id=107',
      'https://policies.mq.edu.au/document/view.php?id=234&version=4',
      'https://github.com/HannahVogelArchaeology/ghmdisplay.hvogel.org',
    ];

    for (let i = 0; i < externalHrefs.length; i++) {
      const href = externalHrefs[i];
      const link = page.locator(`footer a[href="${href}"]`).first();
      await link.scrollIntoViewIfNeeded();
      await link.click();

      await expect(qrDialog).toBeVisible();
      await expect(qrDialog).toHaveAttribute('aria-labelledby', /.+/);
      await expect(qrDialog).toHaveAttribute('aria-describedby', /.+/);
      expect(new URL(page.url()).origin).toBe(origin);

      // Exact guidance text & plain readable URL
      await expect(qrDialog).toContainText('Scan this QR code with your phone to open this link on your own device.');
      await expect(qrDialog.locator('.kiosk-qr-url')).toHaveText(href);

      // Self-generated SVG QR with white quiet zone & black modules
      const svg = qrDialog.locator('svg[role="img"]');
      await expect(svg).toHaveCount(1);
      await expect(svg).toHaveAttribute('aria-label', `QR code for ${href}`);
      await expect(svg.locator('rect[fill="#ffffff"]')).toHaveCount(1);
      await expect(svg.locator('path[fill="#000000"]')).toHaveCount(1);

      const closeBtn = qrDialog.getByRole('button', { name: 'Close' });
      await expect(closeBtn).toBeFocused();
      const closeBox = await closeBtn.boundingBox();
      expect(closeBox.width).toBeGreaterThanOrEqual(44);
      expect(closeBox.height).toBeGreaterThanOrEqual(44);

      // Verify close via button, Escape, and backdrop click all return focus to trigger
      if (i % 3 === 0) {
        await closeBtn.click();
      } else if (i % 3 === 1) {
        await page.keyboard.press('Escape');
      } else {
        await qrDialog.evaluate(d => d.dispatchEvent(new MouseEvent('click', { bubbles: true })));
      }
      await expect(qrDialog).toBeHidden();
      await expect(link).toBeFocused();
    }

    // Opening QR dialog while #a11y-panel is open closes #a11y-panel and closes QR on first Escape
    await page.locator('#a11y-trigger').click();
    const a11yPanel = page.locator('#a11y-panel');
    await expect(a11yPanel).toBeVisible();
    const firstExtLink = page.locator(`footer a[href="${externalHrefs[0]}"]`).first();
    await firstExtLink.evaluate(el => el.click());
    await expect(a11yPanel).toBeHidden();
    await expect(qrDialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(qrDialog).toBeHidden();

    // Verify QR frame remains crisp black-on-white in Dark & High Contrast modes
    for (const theme of ['dark', 'high-contrast']) {
      await page.evaluate(t => {
        document.documentElement.dataset.theme = t;
      }, theme);
      await page.locator(`footer a[href="${externalHrefs[0]}"]`).first().click();
      await expect(qrDialog).toBeVisible();
      const colors = await qrDialog.evaluate(d => {
        const frame = d.querySelector('.kiosk-qr-frame');
        const rect = d.querySelector('svg rect');
        const path = d.querySelector('svg path');
        return {
          frameBg: getComputedStyle(frame).backgroundColor,
          rectFill: rect?.getAttribute('fill'),
          pathFill: path?.getAttribute('fill'),
        };
      });
      expect(colors.frameBg).toBe('rgb(255, 255, 255)');
      expect(colors.rectFill).toBe('#ffffff');
      expect(colors.pathFill).toBe('#000000');
      await page.keyboard.press('Escape');
    }

    // Zero external network requests triggered by QR generation or intercepted clicks
    expect(externalRequests).toEqual([]);

    // Internal same-origin links (both path and hash) are NOT intercepted
    const internalReachedBubble = await page.evaluate(() => {
      const a11yLink = document.querySelector('footer a[href="/accessibility/"]');
      const skipLink = document.querySelector('a.skip-link[href="#main"]');
      let count = 0;
      for (const el of [a11yLink, skipLink]) {
        el.addEventListener('click', e => {
          count++;
          e.preventDefault();
        }, { once: true });
        el.click();
      }
      return count;
    });
    expect(internalReachedBubble).toBe(2);
    await expect(qrDialog).toBeHidden();

    // Nira 3D <button data-src="..."> and <button data-3d-src="..."> are NOT intercepted
    const niraClicks = await page.evaluate(() => {
      let count = 0;
      const b1 = document.createElement('button');
      b1.type = 'button';
      b1.dataset.src = 'https://macquarie.nira.app/a/sample-object-4';
      b1.textContent = 'View in 3D';
      b1.addEventListener('click', () => { count++; });

      const b2 = document.createElement('button');
      b2.type = 'button';
      b2.dataset['3dSrc'] = 'https://macquarie.nira.app/a/sample-object-5';
      b2.textContent = 'View in 3D';
      b2.addEventListener('click', () => { count++; });

      document.body.append(b1, b2);
      b1.click();
      b2.click();
      return count;
    });
    expect(niraClicks).toBe(2);
    await expect(qrDialog).toBeHidden();
  });

  test('window.ghmTrack emits nothing while kiosk mode is active, and ?kiosk=off disables kiosk mode cleanly', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('ghm_kiosk', 'on');
    });
    await page.goto('/');

    // Even when custom_events is forced to "true", ghmTrack MUST remain silent in kiosk mode
    const kioskCalls = await page.evaluate(() => {
      const calls = [];
      document.documentElement.dataset.analyticsCustomEvents = 'true';
      window.nca_track = (...args) => calls.push(args);
      window.ghmTrack('a11y_theme', 'dark');
      return calls;
    });
    expect(kioskCalls).toEqual([]);

    // ?kiosk=off disables kiosk mode, removes storage, strips query param, and restores external link clicks
    await page.goto('/?kiosk=off');
    expect(new URL(page.url()).searchParams.has('kiosk')).toBe(false);
    expect(await page.evaluate(() => localStorage.getItem('ghm_kiosk'))).toBeNull();
    await expect(page.locator('html')).not.toHaveAttribute('data-kiosk', 'on');

    const linkReachedBubble = await page.evaluate(() => {
      const link = document.querySelector('footer a[href^="https://"]');
      let bubbled = false;
      link.addEventListener('click', e => {
        bubbled = true;
        e.preventDefault();
      }, { once: true });
      link.click();
      return bubbled;
    });
    expect(linkReachedBubble).toBe(true);
    await expect(page.locator('dialog.kiosk-qr-dialog')).toHaveCount(0);
  });

  test('qr-svg.js encodes short and long URLs across QR Versions 1–10 with valid square matrices and 4-module quiet zones', async ({ page }) => {
    await page.goto('/');

    const results = await page.evaluate(async () => {
      const { encodeQrMatrix, renderQrSvg } = await import('/assets/js/qr-svg.js');
      const samples = [
        { text: 'https://mq.au', expectedVersion: 1 },
        { text: 'https://policies.mq.edu.au/document/view.php?id=234&version=4', expectedVersion: 4 },
        { text: 'https://www.linkedin.com/in/hannah-vogel-216039149/', expectedVersion: 4 },
        { text: 'https://example.org/' + 'a'.repeat(100), expectedVersion: 7 },
        { text: 'https://example.org/' + 'b'.repeat(185), expectedVersion: 10 },
        { text: 'https://example.org/' + 'c'.repeat(240), expectedVersion: 10 },
      ];

      return samples.map(({ text, expectedVersion }) => {
        const matrix = encodeQrMatrix(text);
        const size = matrix.length;
        const version = (size - 17) / 4;
        const isSquare = matrix.every(row => row.length === size);
        const darkModules = matrix.flat().filter(Boolean).length;
        const svg = renderQrSvg(text, { label: `QR code for ${text}` });
        return {
          expectedVersion,
          version,
          size,
          isSquare,
          darkModules,
          viewBox: svg.getAttribute('viewBox'),
          role: svg.getAttribute('role'),
          ariaLabel: svg.getAttribute('aria-label'),
          rectFill: svg.querySelector('rect')?.getAttribute('fill'),
          pathFill: svg.querySelector('path')?.getAttribute('fill'),
          pathLen: svg.querySelector('path')?.getAttribute('d')?.length || 0,
        };
      });
    });

    for (const r of results) {
      expect(r.isSquare).toBe(true);
      expect(r.version).toBe(r.expectedVersion);
      expect(r.darkModules).toBeGreaterThan(50);
      expect(r.viewBox).toBe(`0 0 ${r.size + 8} ${r.size + 8}`);
      expect(r.role).toBe('img');
      expect(r.ariaLabel).toContain('QR code for ');
      expect(r.rectFill).toBe('#ffffff');
      expect(r.pathFill).toBe('#000000');
      expect(r.pathLen).toBeGreaterThan(20);
    }
  });
});
