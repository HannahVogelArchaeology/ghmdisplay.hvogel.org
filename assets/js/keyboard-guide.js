// Declarative Keyboard Guide visual overlay.
// Discovers real controls via [data-kg-keys] / [data-kg-label] / [data-kg-place] attributes
// without altering DOM tab order or injecting hidden tab stops.

let active = false;
let docLayer = null;
let fixedLayer = null;
let legendEl = null;
let rafId = 0;

function isVisible(el) {
  if (!el || !el.getClientRects().length) return false;
  if (el.closest('[hidden], [inert], dialog:not([open])')) return false;
  const style = getComputedStyle(el);
  if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) === 0) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

function isFixedPosition(el) {
  for (let node = el; node && node !== document.documentElement; node = node.parentElement) {
    const pos = getComputedStyle(node).position;
    if (pos === 'fixed' || pos === 'sticky') return true;
  }
  return false;
}

function makeBadge(keysText, labelText) {
  const badge = document.createElement('div');
  badge.className = 'kg-badge';
  keysText.split(/\s*>\s*/).forEach((step, idx) => {
    if (idx > 0) {
      const sep = document.createElement('span');
      sep.textContent = '›';
      badge.appendChild(sep);
    }
    const kbd = document.createElement('kbd');
    kbd.textContent = step.trim();
    badge.appendChild(kbd);
  });
  if (labelText) {
    const span = document.createElement('span');
    span.textContent = labelText;
    badge.appendChild(span);
  }
  return badge;
}

function buildLegend() {
  const section = document.createElement('section');
  section.className = 'kg-legend';
  section.setAttribute('aria-labelledby', 'kg-legend-title');

  const head = document.createElement('div');
  head.className = 'kg-legend__head';

  const title = document.createElement('h2');
  title.id = 'kg-legend-title';
  title.className = 'kg-legend__title';
  title.textContent = 'Keyboard Guide';

  const offBtn = document.createElement('button');
  offBtn.type = 'button';
  offBtn.className = 'btn';
  offBtn.textContent = 'Turn off Keyboard Guide';
  offBtn.addEventListener('click', () => {
    window.ghmA11y?.setPrefs({ keyboardGuide: false });
    document.getElementById('a11y-trigger')?.focus();
  });

  head.append(title, offBtn);
  section.appendChild(head);

  const intro = document.createElement('p');
  intro.textContent = 'Every link, button, and media control on this site uses standard keyboard navigation. Badges show the keys for visible controls without changing Tab order.';
  section.appendChild(intro);

  const rows = [
    ['Tab / Shift+Tab', 'Move forward or backward through every link, button, and control'],
    ['Enter / Space', 'Follow a link or activate the focused button'],
    ['Ctrl+K or /', 'Open Site Search from anywhere (outside text fields and dialogs)'],
    ['Shift+↑', 'Jump back to the top navigation bar'],
    ['Esc', 'Close any open menu, Accessibility panel, search box, or photo/3D viewer'],
  ];
  const list = document.createElement('ul');
  list.className = 'kg-legend__list';
  for (const [k, desc] of rows) {
    const li = document.createElement('li');
    li.className = 'kg-legend__item';
    const kbd = document.createElement('kbd');
    kbd.textContent = k;
    const text = document.createElement('span');
    text.textContent = desc;
    li.append(kbd, text);
    list.appendChild(li);
  }
  section.appendChild(list);
  return section;
}

export function redraw() {
  rafId = 0;
  if (!active || !docLayer || !fixedLayer) return;

  docLayer.textContent = '';
  fixedLayer.textContent = '';
  docLayer.style.height = `${document.documentElement.scrollHeight}px`;

  const targets = [...document.querySelectorAll('[data-kg-keys]')].filter(isVisible);
  const vw = document.documentElement.clientWidth;
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;

  for (const el of targets) {
    const fixed = isFixedPosition(el);
    const layer = fixed ? fixedLayer : docLayer;
    const rect = el.getBoundingClientRect();
    const x = rect.left + (fixed ? 0 : scrollX);
    const y = rect.top + (fixed ? 0 : scrollY);

    const box = document.createElement('div');
    box.className = 'kg-target-box';
    box.style.left = `${x}px`;
    box.style.top = `${y}px`;
    box.style.width = `${rect.width}px`;
    box.style.height = `${rect.height}px`;
    layer.appendChild(box);

    const badge = makeBadge(el.dataset.kgKeys || 'Tab', el.dataset.kgLabel || '');
    layer.appendChild(badge);

    const bw = badge.offsetWidth;
    const bh = badge.offsetHeight;
    const place = el.dataset.kgPlace || 'below';
    let bx = x;
    let by = y + rect.height + 6;
    if (place === 'above') by = Math.max(4, y - bh - 6);
    else if (place === 'left') {
      bx = x - bw - 8;
      by = y;
    } else if (place === 'inside-tr') {
      bx = x + rect.width - bw - 6;
      by = y + 6;
    }

    bx = Math.max(4, Math.min(bx, vw - bw - 4));
    badge.style.left = `${bx}px`;
    badge.style.top = `${Math.max(4, by)}px`;
  }
}

function schedule() {
  if (active && !rafId) rafId = requestAnimationFrame(redraw);
}

export function enable() {
  if (active) {
    schedule();
    return;
  }
  active = true;
  document.body.classList.add('keyboard-guide-on');

  docLayer = document.createElement('div');
  docLayer.className = 'kg-layer';
  docLayer.setAttribute('aria-hidden', 'true');

  fixedLayer = document.createElement('div');
  fixedLayer.className = 'kg-layer kg-layer--fixed';
  fixedLayer.setAttribute('aria-hidden', 'true');

  document.body.append(docLayer, fixedLayer);

  const main = document.getElementById('main');
  if (main && !legendEl) {
    legendEl = buildLegend();
    main.prepend(legendEl);
  }

  window.addEventListener('resize', schedule, { passive: true });
  window.addEventListener('scroll', schedule, { passive: true });
  document.addEventListener('ghm:a11y-change', schedule);
  schedule();
}

export function disable() {
  if (!active) return;
  active = false;
  document.body.classList.remove('keyboard-guide-on');
  window.removeEventListener('resize', schedule);
  window.removeEventListener('scroll', schedule);
  document.removeEventListener('ghm:a11y-change', schedule);
  if (rafId) cancelAnimationFrame(rafId);
  rafId = 0;
  docLayer?.remove();
  fixedLayer?.remove();
  legendEl?.remove();
  docLayer = null;
  fixedLayer = null;
  legendEl = null;
}
