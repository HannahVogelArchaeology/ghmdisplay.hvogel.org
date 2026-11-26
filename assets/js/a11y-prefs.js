// Accessibility preferences manager, collapsible Accessibility panel controller,
// window.ghmA11y API (consumed by Reset all and kiosk.js), and ethics-gated window.ghmTrack.

const STORAGE_KEY = 'ghm_a11y_prefs';
const KIOSK_KEY = 'ghm_kiosk';

const DEFAULTS = {
  size: 100,
  spacing: 'default',
  font: 'lexend',
  theme: 'auto',
  keyboardGuide: false,
};

let kgModulePromise = null;

function isKioskActive() {
  try {
    return localStorage.getItem(KIOSK_KEY) === 'on';
  } catch {
    return false;
  }
}

// Ethics-gated custom event tracker: strict no-op unless explicitly enabled via
// _config.yml analytics.custom_events: true, non-kiosk session, and nca_track loaded.
export function ghmTrack(eventName, value) {
  if (document.documentElement.dataset.analyticsCustomEvents !== 'true') return;
  if (isKioskActive()) return;
  if (typeof window.nca_track !== 'function') return;
  try {
    window.nca_track(eventName, value);
  } catch {}
}

window.ghmTrack = ghmTrack;

function readPrefs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw);
    return {
      size: typeof parsed.size === 'number' && parsed.size >= 80 && parsed.size <= 200 ? parsed.size : DEFAULTS.size,
      spacing: ['default', 'relaxed', 'wide'].includes(parsed.spacing) ? parsed.spacing : DEFAULTS.spacing,
      font: ['lexend', 'atkinson', 'opendyslexic', 'gentium'].includes(parsed.font) ? parsed.font : DEFAULTS.font,
      theme: ['auto', 'light', 'dark', 'high-contrast'].includes(parsed.theme) ? parsed.theme : DEFAULTS.theme,
      keyboardGuide: Boolean(parsed.keyboardGuide),
    };
  } catch {
    return { ...DEFAULTS };
  }
}

function writePrefs(prefs) {
  try {
    const isDefault =
      prefs.size === DEFAULTS.size &&
      prefs.spacing === DEFAULTS.spacing &&
      prefs.font === DEFAULTS.font &&
      prefs.theme === DEFAULTS.theme &&
      prefs.keyboardGuide === DEFAULTS.keyboardGuide;
    if (isDefault) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    }
  } catch {}
}

let prefs = readPrefs();

async function syncKeyboardGuide(enabled) {
  document.documentElement.dataset.keyboardGuide = enabled ? 'on' : 'off';
  if (enabled) {
    kgModulePromise = kgModulePromise || import('./keyboard-guide.js');
    const mod = await kgModulePromise;
    mod.enable();
  } else if (kgModulePromise) {
    const mod = await kgModulePromise;
    mod.disable();
  }
}

function applyToDom(current) {
  const root = document.documentElement;
  root.style.fontSize = current.size === 100 ? '' : `${current.size}%`;
  root.dataset.textSize = String(current.size);
  root.dataset.spacing = current.spacing;
  root.dataset.font = current.font;
  if (current.theme === 'auto') {
    delete root.dataset.theme;
  } else {
    root.dataset.theme = current.theme;
  }
  syncKeyboardGuide(current.keyboardGuide);
  document.dispatchEvent(new CustomEvent('ghm:a11y-change', { detail: { ...current } }));
}

function announce(message) {
  const status = document.getElementById('a11y-status');
  if (!status) return;
  status.textContent = '';
  requestAnimationFrame(() => {
    status.textContent = message;
  });
}

function syncPanelUi(current) {
  const sizeOut = document.getElementById('a11y-size-output');
  if (sizeOut) sizeOut.textContent = `${current.size}%`;

  const downBtn = document.querySelector('[data-a11y-size="down"]');
  const upBtn = document.querySelector('[data-a11y-size="up"]');
  if (downBtn) downBtn.setAttribute('aria-disabled', String(current.size <= 80));
  if (upBtn) upBtn.setAttribute('aria-disabled', String(current.size >= 200));

  document.querySelectorAll('[data-a11y-spacing]').forEach(btn => {
    btn.setAttribute('aria-pressed', String(btn.dataset.a11ySpacing === current.spacing));
  });

  document.querySelectorAll('[data-a11y-font]').forEach(btn => {
    btn.setAttribute('aria-pressed', String(btn.dataset.a11yFont === current.font));
  });

  document.querySelectorAll('[data-a11y-theme]').forEach(btn => {
    btn.setAttribute('aria-pressed', String(btn.dataset.a11yTheme === current.theme));
  });

  const kgBtn = document.getElementById('a11y-keyboard-guide');
  if (kgBtn) {
    kgBtn.setAttribute('aria-pressed', String(current.keyboardGuide));
    const stateEl = kgBtn.querySelector('.a11y-kg-state');
    if (stateEl) stateEl.textContent = current.keyboardGuide ? 'On' : 'Off';
  }

  const resetAllBtn = document.getElementById('a11y-reset-all');
  if (resetAllBtn) {
    const isDefault =
      current.size === DEFAULTS.size &&
      current.spacing === DEFAULTS.spacing &&
      current.font === DEFAULTS.font &&
      current.theme === DEFAULTS.theme &&
      current.keyboardGuide === DEFAULTS.keyboardGuide;
    resetAllBtn.setAttribute('aria-disabled', String(isDefault));
  }
}

function updatePrefs(patch, announcement, trackKey) {
  prefs = { ...prefs, ...patch };
  writePrefs(prefs);
  applyToDom(prefs);
  syncPanelUi(prefs);
  if (announcement) announce(announcement);
  if (trackKey) ghmTrack(trackKey, patch[Object.keys(patch)[0]]);
}

function resetAll(silent = false) {
  prefs = { ...DEFAULTS };
  writePrefs(prefs);
  applyToDom(prefs);
  syncPanelUi(prefs);
  if (!silent) announce('All display settings reset to defaults.');
  ghmTrack('a11y_reset', 'default');
}

const trigger = document.getElementById('a11y-trigger');
const panel = document.getElementById('a11y-panel');
const closeBtn = document.getElementById('a11y-close');

function openPanel() {
  if (!panel || !trigger) return;
  panel.hidden = false;
  trigger.setAttribute('aria-expanded', 'true');
  closeBtn?.focus();
}

function closePanel(restoreFocus = true) {
  if (!panel || !trigger || panel.hidden) return;
  panel.hidden = true;
  trigger.setAttribute('aria-expanded', 'false');
  if (restoreFocus) trigger.focus();
}

trigger?.addEventListener('click', () => {
  if (panel?.hidden) openPanel();
  else closePanel(false);
});

closeBtn?.addEventListener('click', () => closePanel(true));

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && panel && !panel.hidden) {
    e.preventDefault();
    closePanel(true);
  }
});

document.addEventListener('click', e => {
  if (!panel || panel.hidden) return;
  if (panel.contains(e.target) || trigger?.contains(e.target)) return;
  closePanel(false);
});

panel?.addEventListener('click', e => {
  const sizeBtn = e.target.closest('[data-a11y-size]');
  if (sizeBtn) {
    const action = sizeBtn.dataset.a11ySize;
    let next = prefs.size;
    if (action === 'up') next = Math.min(200, prefs.size + 10);
    else if (action === 'down') next = Math.max(80, prefs.size - 10);
    else if (action === 'reset') next = 100;
    if (next !== prefs.size) {
      updatePrefs({ size: next }, `Text size ${next} percent.`, 'a11y_size');
    }
    return;
  }

  const spacingBtn = e.target.closest('[data-a11y-spacing]');
  if (spacingBtn) {
    const spacing = spacingBtn.dataset.a11ySpacing;
    updatePrefs({ spacing }, `Text spacing set to ${spacing}.`, 'a11y_spacing');
    return;
  }

  const fontBtn = e.target.closest('[data-a11y-font]');
  if (fontBtn) {
    const font = fontBtn.dataset.a11yFont;
    updatePrefs({ font }, `Reading font set to ${fontBtn.textContent.trim()}.`, 'a11y_font');
    return;
  }

  const themeBtn = e.target.closest('[data-a11y-theme]');
  if (themeBtn) {
    const theme = themeBtn.dataset.a11yTheme;
    updatePrefs({ theme }, `Display theme set to ${themeBtn.textContent.trim()}.`, 'a11y_theme');
    return;
  }

  if (e.target.closest('#a11y-keyboard-guide')) {
    const next = !prefs.keyboardGuide;
    updatePrefs({ keyboardGuide: next }, `Keyboard Guide ${next ? 'on' : 'off'}.`, 'a11y_keyboard_guide');
    return;
  }

  const resetBtn = e.target.closest('#a11y-reset-all');
  if (resetBtn) {
    if (resetBtn.getAttribute('aria-disabled') === 'true') return;
    resetAll(false);
  }
});

window.ghmA11y = {
  getPrefs: () => ({ ...prefs }),
  setPrefs: patch => updatePrefs(patch),
  resetAll,
  openPanel,
  closePanel,
};

// Synchronize initial UI state and react to back/forward cache restores
applyToDom(prefs);
syncPanelUi(prefs);
window.addEventListener('pageshow', e => {
  if (e.persisted) {
    prefs = readPrefs();
    applyToDom(prefs);
    syncPanelUi(prefs);
  }
});
