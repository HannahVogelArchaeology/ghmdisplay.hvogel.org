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

    // Video Introduction (relabelled from Auslan introduction)
    await expect(page.locator('#about h3#video-intro-title')).toHaveText('Video Introduction');
    const video = page.locator('#about video');
    await expect(video).toHaveCount(1);
    await expect(video).toHaveAttribute('controls', '');
    await expect(video).toHaveAttribute('preload', 'metadata');
    await expect(video).toHaveAttribute('poster', '/assets/video/introduction-poster.jpg');

    const source = video.locator('source');
    await expect(source).toHaveAttribute('src', '/assets/video/introduction.mp4');
    await expect(source).toHaveAttribute('type', 'video/mp4');

    const track = video.locator('track');
    await expect(track).toHaveAttribute('kind', 'captions');
    await expect(track).toHaveAttribute('src', '/assets/video/introduction-captions.vtt');
    await expect(track).toHaveAttribute('srclang', 'en-AU');
    await expect(track).toHaveAttribute('label', 'English captions');
    await expect(track).toHaveAttribute('default', '');

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

    // Centered Auslan Introduction section
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

  test('renders 3 linked shelf showcases with icons, uncropped photos, opaque dark panels, and accessible controls', async ({ page }) => {
    await page.goto('/');

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

      // Uncropped photo, non-empty alt, zero title attribute
      const photo = card.locator('img.shelf-showcase__photo');
      const photoCheck = await photo.evaluate(img => ({
        alt: img.getAttribute('alt') || '',
        title: img.getAttribute('title'),
        objectFit: getComputedStyle(img).objectFit,
      }));
      expect(photoCheck.alt.length).toBeGreaterThan(20);
      expect(photoCheck.title).toBeNull();
      expect(photoCheck.objectFit).not.toBe('cover');

      // 100% opaque dark panel (no rgba alpha < 1 and opacity === '1')
      const panelStyle = await card.locator('.shelf-showcase__panel').evaluate(el => {
        const s = getComputedStyle(el);
        return { bg: s.backgroundColor, opacity: s.opacity };
      });
      expect(panelStyle.opacity).toBe('1');
      expect(panelStyle.bg).toMatch(/^rgb\(\d+,\s*\d+,\s*\d+\)$/);
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

  test('enables sticky scroll-rising showcase on desktop default and falls back cleanly under reduced motion, high-contrast, >=150%/200% text size, wide spacing, and 390x844 mobile', async ({ page }, testInfo) => {
    if (testInfo.project.name === 'desktop-chromium') {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await page.goto('/');

      // Desktop default uses sticky positioning on shelf media
      const desktopPosition = await page.locator('.shelf-showcase__media').first().evaluate(el => getComputedStyle(el).position);
      expect(desktopPosition).toBe('sticky');

      // Fallback 1: prefers-reduced-motion: reduce -> static vertical stack
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const reducedPos = await page.locator('.shelf-showcase__media').first().evaluate(el => getComputedStyle(el).position);
      expect(reducedPos).toBe('static');
      await page.emulateMedia({ reducedMotion: 'no-preference' });

      // Fallback 2: High Contrast theme -> static vertical stack
      await page.evaluate(() => window.ghmA11y.setPrefs({ theme: 'high-contrast' }));
      const hcPos = await page.locator('.shelf-showcase__media').first().evaluate(el => getComputedStyle(el).position);
      expect(hcPos).toBe('static');
      await page.evaluate(() => window.ghmA11y.resetAll(true));

      // Fallback 3: text size >= 150% and 200% -> html.showcase-static + static position + zero horizontal overflow
      await page.evaluate(() => window.ghmA11y.setPrefs({ size: 150 }));
      await expect(page.locator('html')).toHaveClass(/showcase-static/);
      const pos150 = await page.locator('.shelf-showcase__media').first().evaluate(el => getComputedStyle(el).position);
      expect(pos150).toBe('static');

      await page.evaluate(() => window.ghmA11y.setPrefs({ size: 200 }));
      const check200 = await page.evaluate(() => {
        const media = document.querySelector('.shelf-showcase__media').getBoundingClientRect();
        const panel = document.querySelector('.shelf-showcase__panel').getBoundingClientRect();
        return {
          hasStaticClass: document.documentElement.classList.contains('showcase-static'),
          position: getComputedStyle(document.querySelector('.shelf-showcase__media')).position,
          overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          panelBelowMedia: panel.top >= media.bottom - 1,
        };
      });
      expect(check200.hasStaticClass).toBe(true);
      expect(check200.position).toBe('static');
      expect(check200.overflowX).toBeLessThanOrEqual(1);
      expect(check200.panelBelowMedia).toBe(true);

      // Fallback 4: expanded spacing ('wide') -> html.showcase-static + static position
      await page.evaluate(() => window.ghmA11y.setPrefs({ size: 100, spacing: 'wide' }));
      await expect(page.locator('html')).toHaveClass(/showcase-static/);
      const widePos = await page.locator('.shelf-showcase__media').first().evaluate(el => getComputedStyle(el).position);
      expect(widePos).toBe('static');

      // Reset restores sticky mode
      await page.evaluate(() => window.ghmA11y.resetAll(true));
      await expect(page.locator('html')).not.toHaveClass(/showcase-static/);
      const restoredPos = await page.locator('.shelf-showcase__media').first().evaluate(el => getComputedStyle(el).position);
      expect(restoredPos).toBe('sticky');
    }

    // Fallback 5: Mobile 390x844 (< 760px) -> static stack + zero horizontal overflow
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    const mobileCheck = await page.evaluate(() => {
      const media = document.querySelector('.shelf-showcase__media');
      const panel = document.querySelector('.shelf-showcase__panel');
      return {
        position: getComputedStyle(media).position,
        overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        panelBelowMedia: panel.getBoundingClientRect().top >= media.getBoundingClientRect().bottom - 1,
      };
    });
    expect(mobileCheck.position).toBe('static');
    expect(mobileCheck.overflowX).toBeLessThanOrEqual(1);
    expect(mobileCheck.panelBelowMedia).toBe(true);
  });
});
