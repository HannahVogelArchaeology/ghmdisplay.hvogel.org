const fs = require('node:fs');
const path = require('node:path');
const { test, expect } = require('@playwright/test');

const REPO_ROOT = path.resolve(__dirname, '../..');
const SITE_DIR = path.join(REPO_ROOT, '_site');

const SCAR_TISSUE_UPPER_RE = /\b(TBC|TODO|CHECK)\b/;
const SCAR_TISSUE_PHRASE_RE = /\b(first draft|Lorem|Paliki)\b/i;

function expectNoScarTissue(text) {
  expect(text).not.toMatch(SCAR_TISSUE_UPPER_RE);
  expect(text).not.toMatch(SCAR_TISSUE_PHRASE_RE);
}

test.describe('Outcome 3C: Curation, Accessibility Page, 404 & Repository Governance', () => {
  test('/curation/ section ordering, verbatim acknowledgements, Role+Name-only team, and accessible licence tables', async ({ page }) => {
    await page.goto('/curation/');

    // Heading without decorative 01-05 numbering
    await expect(page.locator('main h1')).toHaveText('Curation & Acknowledgements');
    const headings = await page.locator('main h1, main h2, main h3').allInnerTexts();
    for (const h of headings) {
      expect(h.trim()).not.toMatch(/^0[1-9]\b/);
    }

    // Exact section ordering: Curator -> Acknowledgements -> Funding Bodies -> Website Development Team -> Software & Asset Licences
    const h2Texts = await page.locator('main h2').allInnerTexts();
    expect(h2Texts).toEqual([
      'Curator',
      'Acknowledgements',
      'Funding Bodies',
      'Website Development Team',
      'Software & Asset Licences',
    ]);

    const ackBeforeFunding = await page.evaluate(() => {
      const ack = document.getElementById('acknowledgements-heading');
      const funding = document.getElementById('funding-heading');
      return Boolean(ack && funding && (ack.compareDocumentPosition(funding) & Node.DOCUMENT_POSITION_FOLLOWING));
    });
    expect(ackBeforeFunding).toBe(true);

    // Curator portrait renders with meaningful non-empty alt and figcaption
    const portrait = page.locator('.curation__bio-figure img');
    await expect(portrait).toHaveCount(1);
    const portraitAlt = await portrait.getAttribute('alt');
    expect((portraitAlt || '').trim().length).toBeGreaterThan(20);
    await expect(page.locator('.curation__bio-figure figcaption')).toContainText('Saqqara necropolis, Egypt');

    // Verbatim acknowledgements, identity-first language statement, Sarah Massingham-Porter, and unbracketed funding DOI
    const main = page.locator('main#main');
    await expect(main).toContainText('Wallumattagal people of the Dharug Nation, whose cultures and customs have nurtured and continue to nurture this land, since the Dreaming. Their sovereignty was never ceded.');
    await expect(main).toContainText('In most instances, I have chosen to use identity-first disability language as a personal preference.');
    await expect(main).toContainText('Sarah Massingham-Porter');
    await expect(main.locator('a[href="https://www.ndrp.org.au/"]')).toHaveCount(1);
    await expect(main.locator('a[href="https://doi.org/10.82133/C42F-K220"]')).toHaveCount(1);

    // Website Development Team: Group 33 and Group 34 Role + Name only (zero emails, LinkedIn links, or prohibited aria-labelledby on <dl>)
    const teamSection = page.locator('section[aria-labelledby="team-heading"]');
    await expect(teamSection.locator('h3')).toHaveText(['Group 33', 'Group 34']);
    await expect(teamSection.locator('dl')).toHaveCount(2);
    await expect(teamSection.locator('dl[aria-labelledby]')).toHaveCount(0);
    await expect(teamSection.locator('dt')).toHaveCount(12);
    await expect(teamSection.locator('dd')).toHaveCount(12);
    await expect(teamSection).toContainText('Raphael Munoz');
    await expect(teamSection).toContainText('Kamrul Hasan Somo');
    const teamHtml = await teamSection.innerHTML();
    expect(teamHtml).not.toMatch(/@/);
    expect(teamHtml).not.toMatch(/linkedin\.com/i);
    expect(teamHtml).not.toMatch(/mailto:/i);

    // Software & Asset Licences: two semantic accessible tables inside .table-scroll
    const licenseSection = page.locator('section[aria-labelledby="licenses-heading"]');
    await expect(licenseSection.locator('.table-scroll table')).toHaveCount(2);
    await expect(licenseSection.locator('table caption')).toHaveText([
      'On the website: sent to every visitor',
      'Building and checking the site',
    ]);
    await expect(licenseSection.locator('thead th[scope="col"]')).toHaveCount(6);
    const rowHeaderCount = await licenseSection.locator('tbody th[scope="row"]').count();
    expect(rowHeaderCount).toBeGreaterThanOrEqual(12);

    for (const asset of ['Lexend', 'Atkinson Hyperlegible', 'OpenDyslexic', 'Gentium Plus', 'Lucide', 'Jekyll', 'ImageMagick', 'axe-core', 'Lighthouse', 'Playwright', 'Puppeteer', 'check-jsonschema']) {
      await expect(licenseSection).toContainText(asset);
    }

    // Page-turn navigation
    await expect(page.locator('.page-turn__link--prev')).toHaveAttribute('href', '/shelves/bottom/');
    await expect(page.locator('.page-turn__link--next')).toHaveAttribute('href', '/accessibility/');
  });

  test('/accessibility/ TOC anchors, truthful WCAG 2.1.4 disclosure, zero stale shortcuts, and updated on-campus dates', async ({ page }) => {
    await page.goto('/accessibility/');

    // Heading without Visiting eyebrow or 01-03 numbering
    await expect(page.locator('main h1')).toHaveText('Accessibility');
    const mainText = await page.locator('main#main').innerText();
    expect(mainText).not.toMatch(/^\s*Visiting\b/m);
    const headings = await page.locator('main h1, main h2, main h3').allInnerTexts();
    for (const h of headings) {
      expect(h.trim()).not.toMatch(/^0[1-9]\b/);
    }

    // Immediate "On this page" TOC nav resolving to the three exact headings
    const toc = page.locator('nav.toc-nav[aria-label="On this page"]');
    await expect(toc).toHaveCount(1);
    const tocLinks = toc.locator('a');
    await expect(tocLinks).toHaveCount(3);
    const expectedTargets = [
      ['#website-accessibility', 'Website Accessibility'],
      ['#keyboard-and-screen-reader-tools', 'Keyboard and Screen Reader Tools'],
      ['#on-campus-visitor-information', 'On-Campus Visitor Information'],
    ];

    for (let i = 0; i < expectedTargets.length; i++) {
      const [href, label] = expectedTargets[i];
      const link = tocLinks.nth(i);
      await expect(link).toHaveAttribute('href', href);
      await expect(link).toHaveText(label);
      const box = await link.boundingBox();
      expect(box.height).toBeGreaterThanOrEqual(44);
      const targetId = href.slice(1);
      await expect(page.locator(`main h2#${targetId}`)).toHaveText(label);
    }

    // Truthful documentation of actual site accessibility features and WCAG 2.1.4 disclosure
    const main = page.locator('main#main');
    for (const term of [
      'WCAG',
      '7:1',
      'Lexend',
      'Atkinson Hyperlegible',
      'OpenDyslexic',
      'Gentium',
      '1.4.12',
      '80% and 200%',
      'Light',
      'Dark',
      'High Contrast',
      'forced-colors: active',
      'prefers-reduced-motion: reduce',
      'Auslan',
      '−10s',
      '+10s',
      'Tab',
      'Shift+↑',
      'Ctrl+K',
      'Cmd+K',
      'WCAG 2.1.4',
      'Disability Research Leaders Community of Practice',
      'Keyboard Guide',
    ]) {
      await expect(main).toContainText(term);
    }

    // Zero stale Group 33 shortcut claims
    expect(mainText).not.toMatch(/tabindex="-1"/i);
    expect(mainText).not.toMatch(/single Tab stop/i);
    expect(mainText).not.toMatch(/1 to 6/);
    expect(mainText).not.toMatch(/Z:\s*enlarge/i);
    expect(mainText).not.toMatch(/T:\s*show/i);
    expect(mainText).not.toMatch(/D:\s*open/i);

    // On-campus visitor information with updated dates and official links
    await expect(main).toContainText('10 November 2026 to 11 March 2027');
    await expect(main).toContainText('10am to 4pm, Monday to Friday');
    await expect(main).toContainText("25C Wally's Walk");
    await expect(main.locator('a[href="https://www.mq.edu.au/__data/assets/pdf_file/0016/108142/Campus-Map.pdf"]')).toHaveCount(1);
    await expect(main.locator('a[href="https://www.mq.edu.au/faculty-of-arts/about/gale-history-museum/visit"]')).toHaveCount(1);

    // Page-turn navigation
    await expect(page.locator('.page-turn__link--prev')).toHaveAttribute('href', '/curation/');
    await expect(page.locator('.page-turn__link--next')).toHaveAttribute('href', '/');
  });

  test('/404.html renders cleanly in site chrome with exhibition navigation links', async ({ page }) => {
    await page.goto('/404.html');

    await expect(page.locator('header.site-header')).toHaveCount(1);
    await expect(page.locator('footer.site-footer')).toHaveCount(1);
    await expect(page.locator('#a11y-trigger')).toBeVisible();
    await expect(page.locator('#search-trigger')).toBeVisible();
    await expect(page.locator('main h1')).toHaveText('Page not found');

    const nav = page.locator('main nav[aria-label="Exhibition pages"]');
    await expect(nav).toHaveCount(1);
    for (const href of ['/', '/shelves/top/', '/shelves/middle/', '/shelves/bottom/', '/curation/', '/accessibility/']) {
      await expect(nav.locator(`a[href="${href}"]`)).toHaveCount(1);
    }
  });

  test('Footer governance, production analytics gate, zero scar tissue or square brackets, and 320px/200% reflow', async ({ page }) => {
    for (const route of ['/curation/', '/accessibility/', '/404.html']) {
      await page.goto(route);

      // Footer legal, institutional, and policy metadata
      const footer = page.locator('footer.site-footer');
      await expect(footer).toContainText('CRICOS Provider 00002J');
      await expect(footer).toContainText('ABN 90 952 801 237');
      await expect(footer).toContainText('TEQSA Provider PRV12032');
      await expect(footer).toContainText('© 2026 Hannah Vogel and Gale History Museum');
      await expect(footer).toContainText('MIT License');
      await expect(footer.locator('a[href="https://policies.mq.edu.au/document/view.php?id=107"]')).toHaveCount(1);
      await expect(footer.locator('a[href="https://policies.mq.edu.au/document/view.php?id=234&version=4"]')).toHaveCount(1);
      await expect(footer.locator('a[href="https://github.com/HannahVogelArchaeology/ghmdisplay.hvogel.org"]')).toHaveCount(1);
      await expect(footer.locator('a[href="/curation/#licenses-heading"]')).toHaveCount(1);
      await expect(footer.locator('a[href="https://www.linkedin.com/in/hannah-vogel-216039149/"]')).toHaveCount(1);
      await expect(footer.locator('a[href="https://www.instagram.com/hannah_the_archaeologist/"]')).toHaveCount(1);

      // Analytics script + ethics gate attribute
      await expect(page.locator('script[src="https://nocookieanalytics.com/latest.js"]')).toHaveCount(1);
      await expect(page.locator('html')).toHaveAttribute('data-analytics-custom-events', 'false');

      // Zero square brackets or scar tissue in rendered <main> and <footer>
      const mainText = await page.locator('main#main').innerText();
      const footerText = await footer.innerText();
      for (const text of [mainText, footerText]) {
        expect(text).not.toMatch(/[\[\]]/);
        expectNoScarTissue(text);
      }

      // 320px and 640px viewport + 200% root font-size reflow checks (including .curation__team-item dd bounds)
      for (const width of [320, 640]) {
        await page.setViewportSize({ width, height: 640 });
        await page.evaluate(() => {
          document.documentElement.style.fontSize = '200%';
        });
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow).toBeLessThanOrEqual(1);
        if (route === '/curation/') {
          const clippedDds = await page.evaluate(() => {
            return [...document.querySelectorAll('.curation__team-item dd')]
              .filter(dd => dd.getBoundingClientRect().right > window.innerWidth + 1)
              .map(dd => ({ text: dd.textContent.trim(), right: dd.getBoundingClientRect().right, vw: window.innerWidth }));
          });
          expect(clippedDds).toEqual([]);
        }
      }
      await page.evaluate(() => {
        document.documentElement.style.fontSize = '';
      });
      await page.setViewportSize({ width: 1280, height: 800 });
    }
  });

  test('_site/ excludes repository governance docs and governance docs meet content standards', async () => {
    // Excluded from _site/
    for (const excluded of ['ACCESSIBILITY.md', 'CONTRIBUTORS.md', 'NOTICE.md', 'docs']) {
      expect(fs.existsSync(path.join(SITE_DIR, excluded))).toBe(false);
    }

    // Present in repo root with required content
    const notice = fs.readFileSync(path.join(REPO_ROOT, 'NOTICE.md'), 'utf8');
    for (const term of ['Lexend', 'Atkinson Hyperlegible', 'OpenDyslexic', 'Gentium Plus', 'Lucide', 'qr-svg.js', 'Jekyll', 'ImageMagick', 'axe-core', 'Lighthouse', 'Playwright', '© 2026 Hannah Vogel and Gale History Museum', 'MIT License']) {
      expect(notice).toContain(term);
    }

    const a11yDoc = fs.readFileSync(path.join(REPO_ROOT, 'ACCESSIBILITY.md'), 'utf8');
    expect(a11yDoc).toContain('WCAG 2.1.4');
    expect(a11yDoc).toContain('Disability Research Leaders Community of Practice');
    expect(a11yDoc).toContain('Lighthouse Accessibility');
    expect(a11yDoc).toContain('axe-core');
    expectNoScarTissue(a11yDoc);

    const contributors = fs.readFileSync(path.join(REPO_ROOT, 'CONTRIBUTORS.md'), 'utf8');
    expect(contributors).toContain('Hannah Vogel');
    expect(contributors).toContain('Dr Brian Ballsun-Stanton');
    expect(contributors).toContain('Group 33');
    expect(contributors).toContain('Group 34');
    expect(contributors).toContain('Sarah Massingham-Porter');
    expect(contributors).not.toMatch(/@/);
    expect(contributors).not.toMatch(/linkedin\.com/i);

    const uatProtocol = fs.readFileSync(path.join(REPO_ROOT, 'docs/community-uat-protocol.md'), 'utf8');
    expect(uatProtocol).toContain('WCAG 2.1.4');
    expect(uatProtocol).toContain('WCAG 1.4.12');
    expect(uatProtocol).toContain('Disability Research Leaders Community of Practice');
    expect(uatProtocol).toContain('Keyboard Guide');
    expectNoScarTissue(uatProtocol);
    expect(uatProtocol).not.toMatch(/meeting-2026/i);
    expect(uatProtocol).not.toMatch(/Option 3/i);
    expect(uatProtocol).not.toMatch(/\[disability\]/i);
  });
});
