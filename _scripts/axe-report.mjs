// Runs axe-core's automated WCAG 2.2 A and AA rules on each page across Light, Dark,
// and High Contrast themes, writing:
//   <out>/wcag-<device>.md   -> also appended to the GitHub job summary
//   <out>/wcag-<device>.json -> full axe results, one entry per (page, theme)
//
// Usage: node _scripts/axe-report.mjs <base-url> <desktop|mobile> <path>...
//   e.g. node _scripts/axe-report.mjs http://127.0.0.1:4173 desktop / /shelves/top/
// Optional env:
//   AXE_THEMES=light,dark,high-contrast  (default: light,dark,high-contrast)
//   AXE_OUT=<dir>                        (default: current folder)
//   CHROME=<path-to-chrome>
import puppeteer from 'puppeteer-core';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';

const [base, device, ...paths] = process.argv.slice(2);
const out = process.env.AXE_OUT || '.';
const themes = (process.env.AXE_THEMES || 'light,dark,high-contrast')
  .split(',')
  .map(t => t.trim())
  .filter(Boolean);

const require = createRequire(import.meta.url);
const axeSource = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const axeVersion = require('axe-core/package.json').version;
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'];
const viewport = device === 'mobile'
  ? { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
  : { width: 1350, height: 940 };

const criteria = tags => tags.filter(t => /^wcag\d{3,}$/.test(t))
  .map(t => t.slice(4).replace(/^(\d)(\d)/, '$1.$2.')).join(', ') || '(none)';
const cell = s => String(s).replace(/\s+/g, ' ').replace(/\|/g, '\\|').trim();
const code = s => '`' + cell(s).replace(/`/g, "'").slice(0, 120) + '`';

const browser = await puppeteer.launch({ executablePath: process.env.CHROME, args: ['--no-sandbox'] });
const results = [];

for (const theme of themes) {
  for (const path of paths) {
    const page = await browser.newPage();
    await page.setViewport(viewport);
    await page.evaluateOnNewDocument(t => {
      try {
        localStorage.setItem('ghm_a11y_prefs', JSON.stringify({ theme: t }));
      } catch {}
    }, theme);
    const normalized = path.startsWith('/') ? path : `/${path}`;
    const url = new URL(normalized, base.replace(/\/$/, '') + '/').href;
    await page.goto(url, { waitUntil: 'networkidle0' });
    await page.evaluate(t => {
      document.documentElement.dataset.theme = t;
    }, theme);
    await page.addScriptTag({ content: axeSource });
    const r = await page.evaluate(async tags => {
      const r = await axe.run(document, { runOnly: { type: 'tag', values: tags } });
      const name = e => e.tagName.toLowerCase() + (e.classList[0] ? '.' + e.classList[0] : '');
      const scopeOf = el => {
        if (el.classList.length) return name(el);
        const parent = el.parentElement?.closest('[class]');
        return parent ? `${name(parent)} ${el.tagName.toLowerCase()}` : name(el);
      };
      for (const rule of [...r.violations, ...r.incomplete]) {
        for (const n of rule.nodes) {
          const el = n.target.length === 1 && typeof n.target[0] === 'string'
            ? document.querySelector(n.target[0])
            : null;
          n.scope = el ? scopeOf(el) : n.target.flat().join(' ');
        }
      }
      return r;
    }, TAGS);
    results.push({
      page: new URL(url).pathname,
      theme,
      violations: r.violations,
      incomplete: r.incomplete,
    });
    await page.close();
  }
}
await browser.close();

const HINTS = {
  bgImage: 'Text is over an image. Give the text (or a box behind it) a solid `background-color`, or check contrast by hand against the image\'s lightest part.',
  bgGradient: 'Text is over a gradient. Give the text a solid `background-color`, or check contrast by hand against the gradient\'s lightest part.',
  imgNode: 'Text is inside or over an `<img>`. Check contrast by hand, or put the text on a solid background.',
  pseudoContent: 'A `::before`/`::after` sits behind the text. Give the text its own solid `background-color`, or check contrast by hand.',
  bgOverlap: 'Another element overlaps the text. Check it by hand where they overlap, or stop the overlap.',
  elmPartiallyObscured: 'The text is partly covered or scrolled out of view. Check it by hand once it is in view.',
  fgAlpha: 'The text colour is see-through. Use an opaque `color`.',
  shortTextContent: 'Too little text to judge. Check by hand; if decorative, hide with `aria-hidden="true"`.',
  nonBmp: 'The text is an icon or symbol character. Check by hand; if decorative, hide with `aria-hidden="true"`.',
};

const groups = kind => {
  const map = new Map();
  for (const { page, theme, [kind]: rules } of results) {
    for (const rule of rules) {
      for (const node of rule.nodes) {
        const check = [...node.any, ...node.all, ...node.none].find(c => c.message) ?? {};
        const reason = check.data?.messageKey ?? check.message ?? '';
        const key = [rule.id, node.scope, reason].join('|');
        const g = map.get(key) ?? map.set(key, {
          sc: criteria(rule.tags),
          rule,
          scope: node.scope,
          reason,
          why: check.message ?? '',
          places: new Set(),
          count: 0,
          html: node.html,
        }).get(key);
        g.places.add(`${page} [${theme}]`);
        g.count++;
      }
    }
  }
  return [...map.values()].sort((a, b) => a.sc.localeCompare(b.sc, 'en', { numeric: true }) || b.count - a.count);
};

const totalRuns = paths.length * themes.length;
const table = list => [
  '| Criterion | Component | Why | What to change | Where | Example |',
  '| --- | --- | --- | --- | --- | --- |',
  ...list.map(g => {
    const where = g.places.size === totalRuns ? `all ${paths.length} pages × ${themes.length} themes` : [...g.places].join(', ');
    const fix = HINTS[g.reason] ?? `See [${cell(g.rule.help)}](${g.rule.helpUrl}).`;
    return `| ${g.sc} | ${code(g.scope)} | ${cell(g.why)} | ${fix} | ${where} (${g.count}×) | ${code(g.html)} |`;
  }),
].join('\n');

const failures = groups('violations');
const review = groups('incomplete');
const count = list => list.reduce((n, g) => n + g.count, 0);
const failedRuns = new Set(failures.flatMap(g => [...g.places])).size;

const md = [
  `## WCAG 2.2 A/AA automated check: ${device} (${themes.join(', ')})`,
  '',
  failures.length
    ? `**${count(failures)} failing element(s) in ${failures.length} component(s), across ${failedRuns} of ${totalRuns} page-theme run(s).**`
    : `No automated failures across ${paths.length} page(s) × ${themes.length} theme(s) (${totalRuns} runs).`,
  '',
  failures.length ? table(failures) : '',
  '',
  `<details><summary>Needs a person to check: ${review.length} component(s), ${count(review)} element(s) axe could not decide</summary>`,
  '',
  'Not failures: axe could not work out the answer, usually what colour sits behind some text.',
  'Each row is one component; the change shown fixes or settles every element in it.',
  '',
  review.length ? table(review) : 'None.',
  '',
  '</details>',
  '',
  `axe-core ${axeVersion}. Automated rules find only part of WCAG; pair with keyboard, screen reader, and Community of Practice UAT.`,
  '',
].join('\n');

writeFileSync(`${out}/wcag-${device}.md`, md);
writeFileSync(`${out}/wcag-${device}.json`, JSON.stringify(results, null, 2));
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `failures=${count(failures)}\n`);
console.log(`${device} (${themes.join('/')}): ${count(failures)} failing element(s), ${count(review)} to check by hand in ${review.length} component(s)`);
