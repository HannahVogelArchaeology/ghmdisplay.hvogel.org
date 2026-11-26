// Verifies that every foreground/background colour token pair defined in _sass/_tokens.scss
// satisfies WCAG 2.2 AAA (>= 7.0:1) for text/links/muted labels/buttons and >= 3.0:1 for
// non-text UI borders and focus rings across Light, Dark, and High Contrast themes.
//
// Usage: node _scripts/check-contrast.mjs
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const tokensPath = resolve('_sass/_tokens.scss');
const css = readFileSync(tokensPath, 'utf8');

function extractBlock(marker) {
  const idx = css.indexOf(marker);
  if (idx < 0) throw new Error(`Missing token block marker: ${marker}`);
  const start = css.indexOf('{', idx);
  let depth = 0;
  let end = -1;
  for (let i = start; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  const body = css.slice(start + 1, end);
  const vars = {};
  for (const m of body.matchAll(/(--[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,6})\s*;/g)) {
    vars[m[1]] = m[2].toLowerCase();
  }
  return vars;
}

function parseHex(hex) {
  const raw = hex.slice(1);
  const full = raw.length === 3 ? raw.split('').map(c => c + c).join('') : raw;
  return [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16) / 255);
}

function luminance(hex) {
  const [r, g, b] = parseHex(hex).map(c => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(fg, bg) {
  const l1 = luminance(fg);
  const l2 = luminance(bg);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

const themes = [
  { name: 'light', vars: extractBlock('/* theme:light */') },
  { name: 'dark', vars: extractBlock('/* theme:dark */') },
  { name: 'high-contrast', vars: extractBlock('/* theme:high-contrast */') },
];

const TEXT_PAIRS = [
  ['--text', '--bg'],
  ['--text', '--card'],
  ['--text', '--surface'],
  ['--text-muted', '--bg'],
  ['--text-muted', '--card'],
  ['--text-muted', '--surface'],
  ['--accent', '--bg'],
  ['--accent', '--card'],
  ['--accent', '--surface'],
  ['--accent-fg', '--accent'],
  ['--overlay-fg', '--overlay-bg'],
  ['--overlay-accent', '--overlay-bg'],
  ['--overlay-accent-fg', '--overlay-accent'],
];

const UI_PAIRS = [
  ['--border', '--bg'],
  ['--border', '--card'],
  ['--border', '--surface'],
  ['--focus-ring', '--bg'],
  ['--focus-ring', '--card'],
  ['--focus-ring', '--focus-halo'],
];

let failed = 0;

for (const theme of themes) {
  console.log(`\nTheme: ${theme.name}`);
  for (const [fgVar, bgVar] of TEXT_PAIRS) {
    const fg = theme.vars[fgVar];
    const bg = theme.vars[bgVar];
    if (!fg || !bg) {
      console.error(`  FAIL missing token for ${fgVar} / ${bgVar}`);
      failed++;
      continue;
    }
    const r = ratio(fg, bg);
    const ok = r >= 7.0;
    console.log(`  ${ok ? 'PASS' : 'FAIL'} [text >= 7.0] ${fgVar} (${fg}) on ${bgVar} (${bg}) = ${r.toFixed(2)}:1`);
    if (!ok) failed++;
  }
  for (const [fgVar, bgVar] of UI_PAIRS) {
    const fg = theme.vars[fgVar];
    const bg = theme.vars[bgVar];
    if (!fg || !bg) {
      console.error(`  FAIL missing token for ${fgVar} / ${bgVar}`);
      failed++;
      continue;
    }
    const r = ratio(fg, bg);
    const ok = r >= 3.0;
    console.log(`  ${ok ? 'PASS' : 'FAIL'} [ui   >= 3.0] ${fgVar} (${fg}) on ${bgVar} (${bg}) = ${r.toFixed(2)}:1`);
    if (!ok) failed++;
  }
}

if (failed > 0) {
  console.error(`\nContrast check failed with ${failed} violation(s).`);
  process.exit(1);
}
console.log('\nAll Light, Dark, and High Contrast token pairs pass WCAG 2.2 AAA (>= 7.0:1 text, >= 3.0:1 UI).');
