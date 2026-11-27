// Gallery Kiosk Mode (?kiosk=on / ?kiosk=off) for the Gale History Museum display iPad.
// Provides:
//   - Confirmed opt-in activation persisted in localStorage (`ghm_kiosk`)
//   - Idle timeout (default 300s) pausing while any <audio> or <video> is actively playing
//   - WCAG 2.2.1 warning dialog (default 20s) resetting all a11y prefs and returning to `/`
//   - Client-side self-generated SVG QR-code modal intercepting all external <a href> links

import { renderQrSvg } from './qr-svg.js';

const STORAGE_KEY = 'ghm_kiosk';
const JUST_RESET_KEY = 'ghm_kiosk_just_reset';
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'scroll', 'touchstart', 'click'];
const TICK_INTERVAL_MS = 1000;

let kioskActive = false;
let timerId = null;
let lastActivity = Date.now();
let quiescentAfterReset = false;
let isResetting = false;

let confirmDialog = null;
let warningDialog = null;
let warningSecondsEl = null;
let warningUnitEl = null;
let warningLiveEl = null;
let warningStayBtn = null;
let lastWarningFocus = null;
let lastAnnouncedSecond = null;
let warningDismissed = false;

let qrDialog = null;
let qrFrameEl = null;
let qrUrlEl = null;
let qrCloseBtn = null;
let lastQrTrigger = null;

let statusRegion = null;

function readKioskStorage() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'on';
  } catch {
    return false;
  }
}

function writeKioskStorage(enabled) {
  try {
    if (enabled) {
      window.localStorage.setItem(STORAGE_KEY, 'on');
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {}
}

function readJustResetFlag() {
  try {
    return window.sessionStorage.getItem(JUST_RESET_KEY) === '1';
  } catch {
    return false;
  }
}

function writeJustResetFlag(active) {
  try {
    if (active) {
      window.sessionStorage.setItem(JUST_RESET_KEY, '1');
    } else {
      window.sessionStorage.removeItem(JUST_RESET_KEY);
    }
  } catch {}
}

function getIdleSeconds() {
  const val = Number(document.documentElement.dataset.kioskIdle);
  return Number.isFinite(val) && val > 0 ? val : 300;
}

function getWarningSeconds() {
  const val = Number(document.documentElement.dataset.kioskWarning);
  return Number.isFinite(val) && val > 0 ? val : 20;
}

function formatDuration(seconds) {
  if (seconds % 60 === 0) {
    const mins = seconds / 60;
    return `${mins} minute${mins === 1 ? '' : 's'}`;
  }
  return `${seconds} second${seconds === 1 ? '' : 's'}`;
}

function stripKioskParam() {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('kiosk')) return;
    url.searchParams.delete('kiosk');
    const next = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState(window.history.state, '', next);
  } catch {}
}

function announceStatus(message) {
  if (!statusRegion) {
    statusRegion = document.createElement('p');
    statusRegion.className = 'kiosk-status visually-hidden';
    statusRegion.setAttribute('role', 'status');
    statusRegion.setAttribute('aria-live', 'polite');
    statusRegion.setAttribute('aria-atomic', 'true');
    document.body.append(statusRegion);
  }
  statusRegion.textContent = '';
  window.requestAnimationFrame(() => {
    if (statusRegion) statusRegion.textContent = message;
  });
}

function isMediaPlaying() {
  const mediaEls = document.querySelectorAll('audio, video');
  for (const el of mediaEls) {
    if (!el.paused && !el.ended) return true;
  }
  const ablePlayers = window.__ghmAblePlayers;
  if (Array.isArray(ablePlayers)) {
    for (const player of ablePlayers) {
      if (player && player.playing === true) return true;
    }
  }
  return false;
}

function isQuiescentHomeState() {
  if (!quiescentAfterReset) return false;
  if (window.location.pathname !== '/' || window.location.hash) return false;
  if (window.scrollY > 0) return false;
  try {
    if (window.localStorage.getItem('ghm_a11y_prefs')) return false;
  } catch {}
  if (document.querySelector('dialog[open]')) return false;
  const panel = document.getElementById('a11y-panel');
  if (panel && !panel.hidden) return false;
  return true;
}

function markActivity() {
  if (!kioskActive) return;
  if (warningDialog?.open) return;
  if (quiescentAfterReset) {
    quiescentAfterReset = false;
    writeJustResetFlag(false);
  }
  lastActivity = Date.now();
}

function handleMediaPlay() {
  if (!kioskActive) return;
  if (quiescentAfterReset) {
    quiescentAfterReset = false;
    writeJustResetFlag(false);
  }
  lastActivity = Date.now();
  if (warningDialog?.open) {
    warningDialog.close();
  }
}

function ensureWarningDialog() {
  if (warningDialog) return warningDialog;

  warningDialog = document.createElement('dialog');
  warningDialog.className = 'kiosk-dialog kiosk-warning-dialog';
  warningDialog.setAttribute('aria-labelledby', 'kiosk-warning-title');
  warningDialog.setAttribute('aria-describedby', 'kiosk-warning-desc');

  const body = document.createElement('div');
  body.className = 'kiosk-dialog__body';

  const title = document.createElement('h2');
  title.id = 'kiosk-warning-title';
  title.className = 'kiosk-dialog__title';
  title.textContent = 'Are you still there?';

  const desc = document.createElement('p');
  desc.id = 'kiosk-warning-desc';
  desc.className = 'kiosk-dialog__desc';

  warningSecondsEl = document.createElement('strong');
  warningSecondsEl.className = 'kiosk-warning-seconds';
  warningSecondsEl.textContent = String(getWarningSeconds());

  warningUnitEl = document.createElement('span');
  warningUnitEl.textContent = ' seconds.';

  desc.append('This display will reset in ', warningSecondsEl, warningUnitEl);

  warningLiveEl = document.createElement('p');
  warningLiveEl.className = 'kiosk-warning-live visually-hidden';
  warningLiveEl.setAttribute('role', 'status');
  warningLiveEl.setAttribute('aria-live', 'polite');
  warningLiveEl.setAttribute('aria-atomic', 'true');

  const actions = document.createElement('div');
  actions.className = 'kiosk-dialog__actions';

  warningStayBtn = document.createElement('button');
  warningStayBtn.type = 'button';
  warningStayBtn.className = 'kiosk-btn kiosk-btn--primary';
  warningStayBtn.dataset.kioskStay = '';
  warningStayBtn.textContent = "I'm still here";
  warningStayBtn.addEventListener('click', () => {
    lastActivity = Date.now();
    warningDismissed = true;
    warningDialog.close();
  });

  actions.append(warningStayBtn);
  body.append(title, desc, warningLiveEl, actions);
  warningDialog.append(body);

  warningDialog.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      lastActivity = Date.now();
      warningDismissed = true;
      warningDialog.close();
    }
  });

  warningDialog.addEventListener('cancel', () => {
    lastActivity = Date.now();
    warningDismissed = true;
  });

  warningDialog.addEventListener('close', () => {
    lastAnnouncedSecond = null;
    if (isResetting) return;
    if (!warningDismissed) {
      lastActivity = Date.now();
    }
    warningDismissed = false;
    if (lastWarningFocus && lastWarningFocus.isConnected && typeof lastWarningFocus.focus === 'function') {
      lastWarningFocus.focus();
    }
    lastWarningFocus = null;
  });

  document.body.append(warningDialog);
  return warningDialog;
}

function updateWarningCountdown(secondsLeft, forceAnnounce = false) {
  const clamped = Math.max(0, Math.ceil(secondsLeft));
  if (warningSecondsEl) warningSecondsEl.textContent = String(clamped);
  if (warningUnitEl) warningUnitEl.textContent = clamped === 1 ? ' second.' : ' seconds.';

  const shouldAnnounce =
    forceAnnounce ||
    (clamped !== lastAnnouncedSecond && (clamped === 10 || clamped === 5 || clamped === 3 || clamped === 2 || clamped === 1));
  if (shouldAnnounce && warningLiveEl) {
    lastAnnouncedSecond = clamped;
    warningLiveEl.textContent = `Are you still there? This display will reset in ${clamped} ${clamped === 1 ? 'second' : 'seconds'}.`;
  }
}

function openWarningDialog(secondsLeft) {
  ensureWarningDialog();
  if (!warningDialog.open) {
    warningDismissed = false;
    lastWarningFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    updateWarningCountdown(secondsLeft, true);
    warningDialog.showModal();
    warningStayBtn?.focus();
  } else {
    updateWarningCountdown(secondsLeft, false);
  }
}

function performReset() {
  if (isResetting) return;
  isResetting = true;

  if (timerId !== null) {
    window.clearInterval(timerId);
    timerId = null;
  }

  // Close all open native dialogs and the Accessibility panel
  document.querySelectorAll('dialog[open]').forEach(d => {
    try {
      d.close();
    } catch {}
  });
  window.ghmA11y?.closePanel?.(false);

  // Reset all accessibility preferences back to defaults
  if (typeof window.ghmA11y?.resetAll === 'function') {
    window.ghmA11y.resetAll(true);
  } else {
    try {
      window.localStorage.removeItem('ghm_a11y_prefs');
    } catch {}
  }

  writeJustResetFlag(true);
  window.location.assign('/');
}

function tickIdleTimer() {
  if (!kioskActive || isResetting) return;

  if (isMediaPlaying()) {
    lastActivity = Date.now();
    if (warningDialog?.open) warningDialog.close();
    return;
  }

  if (isQuiescentHomeState()) {
    lastActivity = Date.now();
    return;
  }

  const idleMs = getIdleSeconds() * 1000;
  const warningMs = getWarningSeconds() * 1000;
  const warnAtMs = warningMs < idleMs ? idleMs - warningMs : idleMs;
  const resetAtMs = warningMs < idleMs ? idleMs : idleMs + warningMs;

  const elapsedMs = Date.now() - lastActivity;
  if (elapsedMs < warnAtMs) {
    if (warningDialog?.open) warningDialog.close();
    return;
  }

  const remainingMs = resetAtMs - elapsedMs;
  if (remainingMs <= 0) {
    updateWarningCountdown(0, false);
    performReset();
    return;
  }

  openWarningDialog(remainingMs / 1000);
}

function ensureQrDialog() {
  if (qrDialog) return qrDialog;

  qrDialog = document.createElement('dialog');
  qrDialog.className = 'kiosk-dialog kiosk-qr-dialog';
  qrDialog.setAttribute('aria-labelledby', 'kiosk-qr-title');
  qrDialog.setAttribute('aria-describedby', 'kiosk-qr-desc');

  const body = document.createElement('div');
  body.className = 'kiosk-dialog__body';

  const title = document.createElement('h2');
  title.id = 'kiosk-qr-title';
  title.className = 'kiosk-dialog__title';
  title.textContent = 'Open link on your own device';

  qrFrameEl = document.createElement('div');
  qrFrameEl.className = 'kiosk-qr-frame';

  const desc = document.createElement('p');
  desc.id = 'kiosk-qr-desc';
  desc.className = 'kiosk-qr-desc';
  desc.textContent = 'Scan this QR code with your phone to open this link on your own device.';

  qrUrlEl = document.createElement('p');
  qrUrlEl.className = 'kiosk-qr-url';

  const actions = document.createElement('div');
  actions.className = 'kiosk-dialog__actions';

  qrCloseBtn = document.createElement('button');
  qrCloseBtn.type = 'button';
  qrCloseBtn.className = 'kiosk-btn kiosk-btn--primary kiosk-qr-close';
  qrCloseBtn.textContent = 'Close';
  qrCloseBtn.addEventListener('click', () => qrDialog.close());

  actions.append(qrCloseBtn);
  body.append(title, qrFrameEl, desc, qrUrlEl, actions);
  qrDialog.append(body);

  qrDialog.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      qrDialog.close();
    }
  });

  qrDialog.addEventListener('click', event => {
    if (event.target === qrDialog) qrDialog.close();
  });

  qrDialog.addEventListener('close', () => {
    const trigger = lastQrTrigger;
    lastQrTrigger = null;
    if (trigger && trigger.isConnected && typeof trigger.focus === 'function') {
      trigger.focus();
    }
  });

  document.body.append(qrDialog);
  return qrDialog;
}

function openQrDialog(url, triggerEl) {
  window.ghmA11y?.closePanel?.(false);
  ensureQrDialog();
  lastQrTrigger = triggerEl instanceof HTMLElement ? triggerEl : null;

  qrFrameEl.textContent = '';
  try {
    const svg = renderQrSvg(url, { label: `QR code for ${url}` });
    qrFrameEl.append(svg);
  } catch {
    const fallback = document.createElement('p');
    fallback.className = 'kiosk-qr-fallback';
    fallback.textContent = 'This address is too long for a QR code. Please enter the link shown below on your device.';
    qrFrameEl.append(fallback);
  }

  qrUrlEl.textContent = url;

  if (!qrDialog.open) {
    qrDialog.showModal();
  }
  qrCloseBtn?.focus();
}

function onDocumentClick(event) {
  if (!kioskActive) return;
  if (event.defaultPrevented || event.button !== 0) return;

  const target = event.target instanceof Element ? event.target : null;
  const link = target?.closest('a[href]');
  if (!link) return;

  const rawHref = link.getAttribute('href');
  if (!rawHref || rawHref.startsWith('#')) return;

  let resolved;
  try {
    resolved = new URL(link.href, window.location.origin);
  } catch {
    return;
  }

  if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') return;
  if (resolved.origin === window.location.origin) return;

  event.preventDefault();
  event.stopPropagation();
  openQrDialog(resolved.href, link);
}

function startKiosk() {
  if (kioskActive) return;
  kioskActive = true;
  isResetting = false;
  lastActivity = Date.now();
  quiescentAfterReset = readJustResetFlag();
  document.documentElement.dataset.kiosk = 'on';

  for (const type of ACTIVITY_EVENTS) {
    window.addEventListener(type, markActivity, { capture: true, passive: true });
  }
  document.addEventListener('play', handleMediaPlay, true);
  document.addEventListener('pause', markActivity, true);
  document.addEventListener('ended', markActivity, true);
  document.addEventListener('click', onDocumentClick, true);

  timerId = window.setInterval(tickIdleTimer, TICK_INTERVAL_MS);
  window.dispatchEvent(new CustomEvent('ghm:kiosk-changed', { detail: { active: true } }));
}

function stopKiosk() {
  if (!kioskActive) return;
  kioskActive = false;
  quiescentAfterReset = false;
  delete document.documentElement.dataset.kiosk;
  window.dispatchEvent(new CustomEvent('ghm:kiosk-changed', { detail: { active: false } }));

  if (timerId !== null) {
    window.clearInterval(timerId);
    timerId = null;
  }

  for (const type of ACTIVITY_EVENTS) {
    window.removeEventListener(type, markActivity, true);
  }
  document.removeEventListener('play', handleMediaPlay, true);
  document.removeEventListener('pause', markActivity, true);
  document.removeEventListener('ended', markActivity, true);
  document.removeEventListener('click', onDocumentClick, true);

  if (warningDialog?.open) warningDialog.close();
  if (qrDialog?.open) qrDialog.close();
}

function openConfirmDialog() {
  if (!confirmDialog) {
    confirmDialog = document.createElement('dialog');
    confirmDialog.className = 'kiosk-dialog kiosk-confirm-dialog';
    confirmDialog.setAttribute('aria-labelledby', 'kiosk-confirm-title');
    confirmDialog.setAttribute('aria-describedby', 'kiosk-confirm-desc');

    const body = document.createElement('div');
    body.className = 'kiosk-dialog__body';

    const title = document.createElement('h2');
    title.id = 'kiosk-confirm-title';
    title.className = 'kiosk-dialog__title';
    title.textContent = 'Enable gallery kiosk mode?';

    const desc = document.createElement('p');
    desc.id = 'kiosk-confirm-desc';
    desc.className = 'kiosk-dialog__desc';
    desc.textContent =
      `After ${formatDuration(getIdleSeconds())} without activity, this display will reset all accessibility settings and return to the home page. External links will open as QR codes. To turn kiosk mode off later, open this site with ?kiosk=off.`;

    const actions = document.createElement('div');
    actions.className = 'kiosk-dialog__actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'kiosk-btn kiosk-btn--secondary';
    cancelBtn.dataset.kioskCancel = '';
    cancelBtn.textContent = 'Cancel';

    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.className = 'kiosk-btn kiosk-btn--primary';
    confirmBtn.dataset.kioskConfirm = '';
    confirmBtn.textContent = 'Enable kiosk mode';

    cancelBtn.addEventListener('click', () => {
      stripKioskParam();
      confirmDialog.close();
    });

    confirmBtn.addEventListener('click', () => {
      writeKioskStorage(true);
      writeJustResetFlag(false);
      stripKioskParam();
      confirmDialog.close();
      startKiosk();
      announceStatus('Gallery kiosk mode enabled.');
    });

    actions.append(cancelBtn, confirmBtn);
    body.append(title, desc, actions);
    confirmDialog.append(body);

    confirmDialog.addEventListener('click', event => {
      if (event.target === confirmDialog) {
        stripKioskParam();
        confirmDialog.close();
      }
    });

    confirmDialog.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        stripKioskParam();
        confirmDialog.close();
      }
    });

    confirmDialog.addEventListener('cancel', () => {
      stripKioskParam();
    });

    document.body.append(confirmDialog);
  }

  if (!confirmDialog.open) {
    confirmDialog.showModal();
    confirmDialog.querySelector('[data-kiosk-confirm]')?.focus();
  }
}

function initKiosk() {
  const params = new URLSearchParams(window.location.search);
  const queryKiosk = params.get('kiosk');

  if (queryKiosk === 'off') {
    writeKioskStorage(false);
    writeJustResetFlag(false);
    stopKiosk();
    stripKioskParam();
    announceStatus('Gallery kiosk mode disabled.');
    return;
  }

  if (queryKiosk === 'on') {
    if (readKioskStorage()) {
      stripKioskParam();
      startKiosk();
      announceStatus('Gallery kiosk mode is already enabled.');
    } else {
      openConfirmDialog();
    }
    return;
  }

  if (readKioskStorage()) {
    startKiosk();
  }
}

window.addEventListener('pageshow', event => {
  if (!event.persisted) return;
  if (readKioskStorage()) {
    if (kioskActive) {
      isResetting = false;
      quiescentAfterReset = readJustResetFlag();
      lastActivity = Date.now();
      if (timerId === null) {
        timerId = window.setInterval(tickIdleTimer, TICK_INTERVAL_MS);
      }
    } else {
      startKiosk();
    }
  } else if (kioskActive) {
    stopKiosk();
  }
});

if (document.prerendering) {
  document.addEventListener('prerenderingchange', initKiosk, { once: true });
} else if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initKiosk, { once: true });
} else {
  initKiosk();
}
