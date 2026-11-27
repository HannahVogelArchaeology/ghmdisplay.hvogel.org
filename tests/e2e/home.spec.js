const { test, expect } = require('@playwright/test');

test.describe('Homepage & Dual Video Showcase (Outcome 3A)', () => {
  test('renders hero with uncropped display photo, clean alt text, exact caption, fact strip, dates, and WCAG 2.5.3 / 2.5.8 CTAs', async ({ page }) => {
    await page.goto('/');

    // Landmarks & heading structure
    await expect(page.locator('main#main section[aria-labelledby="hero-title"]')).toHaveCount(1);
    await expect(page.locator('main#main section#about[aria-labelledby="about-title"]')).toHaveCount(1);
    await expect(page.locator('main#main section#auslan[aria-labelledby="auslan-title"]')).toHaveCount(1);
    await expect(page.locator('main#main section#shelves[aria-labelledby="shelves-title"]')).toHaveCount(1);

    await expect(page.locator('h1#hero-title')).toHaveText('Disability Heritage: Archaeology with Difference');
    await expect(page.locator('.home-hero .eyebrow')).toHaveText('Curated by Hannah Vogel');
    await expect(page.locator('.home-hero__facts')).toContainText('3 shelves · 11 objects');

    const museumLink = page.locator('.home-hero__visit a');
    await expect(museumLink).toHaveText('Gale History Museum, Macquarie University');
    await expect(museumLink).toHaveAttribute(
      'href',
      'https://www.mq.edu.au/faculty-of-arts/about/gale-history-museum'
    );
    await expect(page.locator('.home-hero__visit')).toContainText('10 November 2026 to 11 March 2027');

    // Hero CTAs: href, >= 44x44px, WCAG 2.5.3 Label in Name, declarative Keyboard Guide attrs
    const exploreCta = page.locator('.home-hero__actions a[href="#shelves"]');
    const auslanCta = page.locator('.home-hero__actions a[href="#auslan"]');
    await expect(exploreCta).toContainText('Explore the Exhibition');
    await expect(auslanCta).toContainText('Watch the Auslan Introduction');
    await expect(exploreCta).toHaveAttribute('data-kg-keys', 'Tab > Enter');
    await expect(auslanCta).toHaveAttribute('data-kg-keys', 'Tab > Enter');
    await expect(exploreCta).toHaveAttribute('data-kg-label', /.+/);
    await expect(auslanCta).toHaveAttribute('data-kg-label', /.+/);

    for (const target of [museumLink, exploreCta, auslanCta]) {
      const box = await target.boundingBox();
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }

    // Uncropped display photo + clean alt text (zero Paliki typo) + exact capitalized caption + zero title attr
    const heroImg = page.locator('.home-hero__figure img');
    await expect(heroImg).toHaveCount(1);
    const imgInfo = await heroImg.evaluate(async img => {
      if (!img.complete) {
        await new Promise(resolve => {
          img.addEventListener('load', resolve, { once: true });
          img.addEventListener('error', resolve, { once: true });
        });
      }
      const rect = img.getBoundingClientRect();
      const style = getComputedStyle(img);
      return {
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        renderedWidth: rect.width,
        renderedHeight: rect.height,
        objectFit: style.objectFit,
        alt: img.getAttribute('alt') || '',
        title: img.getAttribute('title'),
      };
    });
    expect(imgInfo.naturalWidth).toBeGreaterThan(0);
    expect(imgInfo.naturalHeight).toBeGreaterThan(0);
    expect(imgInfo.objectFit).not.toBe('cover');
    const naturalRatio = imgInfo.naturalWidth / imgInfo.naturalHeight;
    const renderedRatio = imgInfo.renderedWidth / imgInfo.renderedHeight;
    expect(Math.abs(naturalRatio - renderedRatio)).toBeLessThan(0.05);
    expect(imgInfo.alt.length).toBeGreaterThan(40);
    expect(imgInfo.alt).not.toMatch(/Paliki/i);
    expect(imgInfo.title).toBeNull();

    await expect(page.locator('.home-hero__figure figcaption')).toHaveText(
      'Photograph of the display and panel for the exhibition "Disability Heritage: Archaeology with Difference" © Gale History Museum & Hannah Vogel 2026'
    );
  });

  test('renders About the Exhibition with Video Introduction, valid .vtt captions, and fixed transcript without 01/02 prefixes or editorial brackets', async ({ page, request }) => {
    await page.goto('/');

    // Exact headings, zero 01 / 02 prefixes
    await expect(page.locator('h2#about-title')).toHaveText('About the Exhibition');
    await expect(page.locator('h2#auslan-title')).toHaveText('Auslan Introduction');
    await expect(page.locator('h2#shelves-title')).toHaveText('Explore the Exhibition');

    const headingTexts = await page.locator('main h1, main h2, main h3').allTextContents();
    for (const text of headingTexts) {
      expect(text.trim()).not.toMatch(/^0[1-9]\b/);
    }

    // Exhibition overview prose preserves italics *within* and *for*
    const emTexts = await page.locator('.home-about__prose em').allTextContents();
    expect(emTexts).toEqual(['within', 'for']);

    // Video Introduction (lazy-loaded Able Player 5.0.0 facade with self-hosted MP4 + WebVTT captions)
    await expect(page.locator('#about h3#video-intro-title')).toHaveText('Video Introduction');
    const introLazy = page.locator('#about [data-able-lazy]');
    await expect(introLazy).toHaveAttribute('data-video-src', '/assets/video/introduction.mp4');
    await expect(introLazy).toHaveAttribute('data-poster', '/assets/video/introduction-poster.jpg');
    await expect(introLazy).toHaveAttribute('data-captions', '/assets/video/introduction-captions.vtt');

    const introTrigger = page.locator('#about [data-able-trigger]');
    await expect(introTrigger).toContainText('Play Video Introduction');
    const introBtnBox = await introTrigger.boundingBox();
    expect(introBtnBox.width).toBeGreaterThanOrEqual(44);
    expect(introBtnBox.height).toBeGreaterThanOrEqual(44);

    const introPoster = page.locator('#about img.able-lazy__poster');
    await expect(introPoster).toHaveAttribute('src', '/assets/video/introduction-poster.jpg');
    await introPoster.scrollIntoViewIfNeeded();
    const introPosterLoaded = await introPoster.evaluate(async img => {
      if (!img.complete) {
        await new Promise(resolve => {
          img.addEventListener('load', resolve, { once: true });
          img.addEventListener('error', resolve, { once: true });
        });
      }
      return img.naturalWidth;
    });
    expect(introPosterLoaded).toBeGreaterThan(0);

    // Verify .vtt file loads cleanly as text/vtt with WEBVTT header
    const vttResp = await request.get('/assets/video/introduction-captions.vtt');
    expect(vttResp.status()).toBe(200);
    const vttBody = await vttResp.text();
    expect(vttBody.trim().startsWith('WEBVTT')).toBe(true);

    // Expand Video Introduction transcript & verify Design §9 fixes
    const summary = page.locator('#about details > summary');
    await expect(summary).toHaveText('Transcript of Video Introduction');
    await summary.click();
    const transcriptText = await page.locator('#about .video-transcript__body').textContent();
    expect(transcriptText).toContain('The introductory panel reads:');
    expect(transcriptText).toContain('a tactile fabrication of the scene on the first object');
    expect(transcriptText).toContain('On the middle shelf there are seven small figurines or amulets.');
    expect(transcriptText).toContain('creating change in material culture.');
    expect(transcriptText).toContain('10th of November 2026 until the 1st of March 2027');

    // Centered Auslan Introduction section: lazy-loaded SRI Able Player facade
    const auslanTrigger = page.locator('#auslan [data-able-trigger]');
    await expect(auslanTrigger).toHaveCount(1);
    await expect(auslanTrigger).toContainText('Play Auslan Introduction');
    const auslanBtnBox = await auslanTrigger.boundingBox();
    expect(auslanBtnBox.width).toBeGreaterThanOrEqual(44);
    expect(auslanBtnBox.height).toBeGreaterThanOrEqual(44);

    // Zero third-party Able Player / jQuery / YouTube tags loaded prior to click
    await expect(page.locator('script[src*="ableplayer"], script[src*="jquery"], iframe[src*="youtube"]')).toHaveCount(0);

    const auslanPoster = page.locator('#auslan img.able-lazy__poster');
    await expect(auslanPoster).toHaveAttribute('src', '/assets/video/auslan-poster.jpg');
    await auslanPoster.scrollIntoViewIfNeeded();
    const posterLoaded = await auslanPoster.evaluate(async img => {
      if (!img.complete) {
        await new Promise(resolve => {
          img.addEventListener('load', resolve, { once: true });
          img.addEventListener('error', resolve, { once: true });
        });
      }
      return img.naturalWidth;
    });
    expect(posterLoaded).toBeGreaterThan(0);

    const auslanCaption = page.locator('#auslan figcaption');
    await expect(auslanCaption).toHaveText(
      'This video is an Auslan interpreted video introduction to this exhibition and associated website'
    );
    const auslanSummary = page.locator('#auslan details > summary');
    await expect(auslanSummary).toHaveText('Transcript of Auslan Introduction');
    await auslanSummary.click();
    const auslanTranscript = await page.locator('#auslan .video-transcript__body').textContent();
    expect(auslanTranscript).toContain('Disability Heritage: Archaeology with Difference');
    expect(auslanTranscript).toContain('creating change in material culture.');

    // Zero square brackets, Paliki typo, or scar tissue anywhere in <main>
    const mainText = await page.locator('main#main').textContent();
    expect(mainText).not.toMatch(/[\[\]]/);
    expect(mainText).not.toMatch(/\bPaliki\b/i);
    expect(mainText).not.toMatch(/\b(TBC|TODO|CHECK|Lorem)\b/);
  });

  test('renders 3 linked side-by-side shelf showcases with icons, uncropped photos, and site-wide photo lightbox', async ({ page }) => {
    await page.goto('/');

    // Hero display photo opens shared zoomable lightbox
    await page.locator('.home-hero__figure [data-gallery-enlarge]').click();
    await expect(page.locator('#photo-dialog')).toBeVisible();
    await expect(page.locator('#photo-dialog [data-pv-caption]')).toContainText('Disability Heritage: Archaeology with Difference');
    await page.keyboard.press('Escape');
    await expect(page.locator('#photo-dialog')).toBeHidden();

    const showcases = page.locator('.shelf-showcase');
    await expect(showcases).toHaveCount(3);

    const expected = [
      { meta: 'Shelf 1 of 3 · 1 object', title: 'Top Shelf', href: '/shelves/top/', cta: 'View Top Shelf', snippet: 'mobility aid' },
      { meta: 'Shelf 2 of 3 · 7 objects', title: 'Middle Shelf', href: '/shelves/middle/', cta: 'View Middle Shelf', snippet: 'Figurines' },
      { meta: 'Shelf 3 of 3 · 3 objects', title: 'Bottom Shelf', href: '/shelves/bottom/', cta: 'View Bottom Shelf', snippet: 'feeding vessels' },
    ];

    for (let i = 0; i < expected.length; i++) {
      const card = showcases.nth(i);
      await expect(card.locator('.shelf-showcase__meta')).toHaveText(expected[i].meta);
      await expect(card.locator('.shelf-showcase__desc')).toContainText(expected[i].snippet);

      const headingLink = card.locator('h3 a');
      await expect(headingLink).toHaveAttribute('href', expected[i].href);
      await expect(headingLink).toContainText(expected[i].title);
      await expect(headingLink.locator('svg[aria-hidden="true"]')).toHaveCount(1);

      const headingBox = await headingLink.boundingBox();
      expect(headingBox.height).toBeGreaterThanOrEqual(44);

      const cta = card.locator('.shelf-showcase__cta');
      await expect(cta).toHaveAttribute('href', expected[i].href);
      await expect(cta).toContainText(expected[i].cta);
      const ctaBox = await cta.boundingBox();
      expect(ctaBox.width).toBeGreaterThanOrEqual(44);
      expect(ctaBox.height).toBeGreaterThanOrEqual(44);

      // Uncropped photo with overlaid lightbox enlarge trigger, non-empty alt, zero title attribute
      const photo = card.locator('img.shelf-showcase__photo');
      const photoCheck = await photo.evaluate(img => ({
        alt: img.getAttribute('alt') || '',
        title: img.getAttribute('title'),
        objectFit: getComputedStyle(img).objectFit,
      }));
      expect(photoCheck.alt.length).toBeGreaterThan(20);
      expect(photoCheck.title).toBeNull();
      expect(photoCheck.objectFit).not.toBe('cover');
      await expect(card.locator('[data-gallery-enlarge]')).toHaveCount(1);
    }

    // Zero tabindex="-1" on interactive controls inside <main> and WCAG 2.5.3 Label in Name check
    const violations = await page.evaluate(() => {
      const hiddenTab = [];
      const badLabels = [];
      const controls = [...document.querySelectorAll('main a, main button, main summary')];
      for (const el of controls) {
        if (el.getAttribute('tabindex') === '-1') hiddenTab.push(el.outerHTML.slice(0, 80));
        const clone = el.cloneNode(true);
        clone.querySelectorAll('[aria-hidden="true"], .visually-hidden, .sr-only').forEach(n => n.remove());
        const visibleText = clone.textContent.trim().replace(/\s+/g, ' ').toLowerCase();
        const ariaLabel = (el.getAttribute('aria-label') || '').trim().toLowerCase();
        if (visibleText && ariaLabel && !ariaLabel.includes(visibleText)) {
          badLabels.push({ visibleText, ariaLabel });
        }
      }
      return { hiddenTab, badLabels };
    });
    expect(violations.hiddenTab).toEqual([]);
    expect(violations.badLabels).toEqual([]);
  });

  test('renders side-by-side shelf rows cleanly on desktop and stacks without overflow on mobile and at 200% text size', async ({ page }, testInfo) => {
    if (testInfo.project.name === 'desktop-chromium') {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto('/');

      // Desktop side-by-side: shelf copy sits to the right of the uncropped photo (no sticky scroll overlay)
      const desktopLayout = await page.evaluate(() => {
        const media = document.querySelector('.shelf-showcase__media').getBoundingClientRect();
        const copy = document.querySelector('.shelf-showcase__copy').getBoundingClientRect();
        return {
          mediaPos: getComputedStyle(document.querySelector('.shelf-showcase__media')).position,
          sideBySide: copy.left >= media.right - 2,
        };
      });
      expect(desktopLayout.mediaPos).toBe('static');
      expect(desktopLayout.sideBySide).toBe(true);

      // 200% text size + wide spacing -> zero horizontal overflow
      await page.evaluate(() => window.ghmA11y.setPrefs({ size: 200, spacing: 'wide' }));
      const overflow200 = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow200).toBeLessThanOrEqual(1);
      await page.evaluate(() => window.ghmA11y.resetAll(true));
    }

    // Mobile 390x844 -> stacked vertically with zero horizontal overflow
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    const mobileCheck = await page.evaluate(() => {
      const media = document.querySelector('.shelf-showcase__media').getBoundingClientRect();
      const copy = document.querySelector('.shelf-showcase__copy').getBoundingClientRect();
      return {
        overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        stacked: copy.top >= media.bottom - 1,
      };
    });
    expect(mobileCheck.overflowX).toBeLessThanOrEqual(1);
    expect(mobileCheck.stacked).toBe(true);
  });

  test('lazy-loads SRI-pinned Able Player CDN assets on click, degrades cleanly to self-hosted native video if CDN fails, and prefetches in kiosk mode', async ({ page, request }) => {
    // Verify Auslan WebVTT captions exist and have valid WEBVTT header
    const auslanVtt = await request.get('/assets/video/auslan-captions.vtt');
    expect(auslanVtt.status()).toBe(200);
    expect((await auslanVtt.text()).trim().startsWith('WEBVTT')).toBe(true);

    const cdnRequested = [];
    const videoRequested = [];
    await page.route('https://cdn.jsdelivr.net/**', route => {
      cdnRequested.push(route.request().url());
      return route.abort();
    });
    await page.route('**/assets/video/auslan-introduction.mp4', route => {
      videoRequested.push(route.request().url());
      return route.abort();
    });

    await page.goto('/');
    // Normal mode: zero eager CDN or Auslan MP4 downloads before click
    expect(cdnRequested).toEqual([]);
    expect(videoRequested).toEqual([]);
    await expect(page.locator('link[rel="prefetch"][href*="auslan-introduction.mp4"]')).toHaveCount(0);

    const trigger = page.locator('#auslan [data-able-trigger]');
    await trigger.click();

    // Verify SRI-pinned stylesheet tag was injected with sha384 integrity + anonymous CORS
    const cssTag = page.locator('link[rel="stylesheet"][href*="ableplayer@5.0.0"]');
    await expect(cssTag).toHaveCount(1);
    await expect(cssTag).toHaveAttribute('integrity', /^sha384-[A-Za-z0-9+/=]+$/);
    await expect(cssTag).toHaveAttribute('crossorigin', 'anonymous');

    // Aborted CDN degrades to self-hosted native <video controls> + local captions (or fallback alert once mocked MP4 aborts)
    const fallbackOrNative = page.locator('#auslan video[controls], #auslan .able-lazy__fallback[role="alert"]');
    await expect(fallbackOrNative.first()).toBeVisible();
  });

  test('prefetches both self-hosted videos in gallery kiosk mode without falling back to YouTube', async ({ page }) => {
    const prefetched = [];
    await page.route('**/assets/video/*.mp4', route => {
      prefetched.push(route.request().url());
      return route.continue();
    });
    await page.route('https://cdn.jsdelivr.net/**', route => route.abort());

    await page.addInitScript(() => {
      window.localStorage.setItem('ghm_kiosk', 'on');
    });
    await page.goto('/');

    // Wait for idle kiosk prefetch to inject <link rel="prefetch"> for both self-hosted intro videos
    await expect(page.locator('link[rel="prefetch"][href="/assets/video/introduction.mp4"]')).toHaveCount(1, { timeout: 8000 });
    await expect(page.locator('link[rel="prefetch"][href="/assets/video/auslan-introduction.mp4"]')).toHaveCount(1, { timeout: 8000 });
    expect(prefetched.some(u => u.includes('introduction.mp4'))).toBe(true);
    expect(prefetched.some(u => u.includes('auslan-introduction.mp4'))).toBe(true);

    // Click Play on both players with CDN offline in kiosk mode -> both stay self-hosted native video with captions, zero YouTube links
    await page.locator('#about [data-able-trigger]').click();
    await expect(page.locator('#about video[controls] source')).toHaveAttribute('src', '/assets/video/introduction.mp4');
    await expect(page.locator('#about video[controls] track')).toHaveAttribute('src', '/assets/video/introduction-captions.vtt');

    await page.locator('#auslan [data-able-trigger]').click();
    await expect(page.locator('#auslan video[controls] source')).toHaveAttribute('src', '/assets/video/auslan-introduction.mp4');
    await expect(page.locator('#auslan video[controls] track')).toHaveAttribute('src', '/assets/video/auslan-captions.vtt');
    await expect(page.locator('#auslan a[href*="youtube.com"]')).toHaveCount(0);
  });
});
