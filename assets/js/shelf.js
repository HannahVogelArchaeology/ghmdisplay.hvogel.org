// Shelf page interactive behaviours (zero external UI CDNs, 100% native Tab stops):
// (Zoomable photo <dialog> & [data-gallery] switching are handled globally by photo-viewer.js)
// 1. "Explore the objects" in-page jump strip (smooth/reduced-motion scroll + heading focus + Esc dismiss)
// 2. Shared Nira 3D <dialog> with on-demand iframe, 15s fallback status, and clean about:blank unload
// 3. Accessible Audio Description player with -10s/+10s skip buttons, seek/volume/speed, and mutual exclusion

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function formatClock(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// 1. "Explore the objects" In-Page Jump Strip (smooth scroll + heading focus + Esc dismiss)
// ---------------------------------------------------------------------------
const jumpTrack = document.querySelector('.object-jump__track');

if (jumpTrack) {
  jumpTrack.addEventListener('pointerleave', () => {
    jumpTrack.classList.remove('is-jump-dismissed');
  });
  jumpTrack.addEventListener('focusout', e => {
    if (!e.relatedTarget || !jumpTrack.contains(e.relatedTarget)) {
      jumpTrack.classList.remove('is-jump-dismissed');
    }
  });
  jumpTrack.addEventListener('focusin', () => {
    jumpTrack.classList.remove('is-jump-dismissed');
  });

  // WCAG 1.4.13: Escape dismisses hover/focus magnification without moving pointer or focus
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (document.querySelector('dialog[open]')) return;
    if (jumpTrack.matches(':hover, :focus-within')) {
      jumpTrack.classList.add('is-jump-dismissed');
    }
  });

  jumpTrack.querySelectorAll('a[data-jump-target]').forEach(link => {
    link.addEventListener('click', e => {
      const targetId = link.dataset.jumpTarget;
      const article = targetId ? document.getElementById(targetId) : null;
      if (!article) return;

      e.preventDefault();
      const heading = article.querySelector('h2') || article;
      if (!heading.hasAttribute('tabindex')) heading.tabIndex = -1;

      if (window.location.hash !== `#${targetId}`) {
        history.pushState(null, '', `#${targetId}`);
      }

      const clearance = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 96;
      const top = Math.max(0, window.scrollY + article.getBoundingClientRect().top - clearance);
      window.scrollTo({ top, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
      heading.focus({ preventScroll: true });
    });
  });
}

// ---------------------------------------------------------------------------
// 4. Shared Nira 3D Model Viewer (<dialog id="model-dialog">)
// ---------------------------------------------------------------------------
const modelDialog = document.getElementById('model-dialog');

if (modelDialog) {
  const titleEl = modelDialog.querySelector('#model-dialog-title');
  const closeBtn = modelDialog.querySelector('[data-md-close]');
  const statusEl = modelDialog.querySelector('[data-md-status]');
  const frameEl = modelDialog.querySelector('[data-md-frame]');
  let slowTimer = 0;
  let lastTrigger = null;

  function clearModelTimer() {
    if (slowTimer) {
      clearTimeout(slowTimer);
      slowTimer = 0;
    }
  }

  frameEl?.addEventListener('load', () => {
    if (!frameEl.getAttribute('src') || frameEl.getAttribute('src') === 'about:blank') return;
    clearModelTimer();
    if (statusEl) statusEl.textContent = '';
  });

  document.querySelectorAll('[data-3d-src]').forEach(button => {
    button.addEventListener('click', () => {
      const src = button.dataset['3dSrc'];
      const title = button.dataset['3dTitle'] || 'Interactive 3D model';
      if (!src || !frameEl) return;

      lastTrigger = button;
      if (titleEl) titleEl.textContent = title;
      frameEl.title = title;
      if (statusEl) statusEl.textContent = 'Loading 3D model…';

      clearModelTimer();
      frameEl.setAttribute('src', src);
      slowTimer = window.setTimeout(() => {
        if (modelDialog.open && statusEl) {
          statusEl.textContent =
            'The 3D model is taking longer than expected to load. You can close this dialog and inspect the high-resolution multi-angle photographs and audio description instead.';
        }
      }, 15000);

      if (!modelDialog.open) {
        modelDialog.showModal();
      }
      closeBtn?.focus();
    });
  });

  function cleanupModel() {
    clearModelTimer();
    if (frameEl && frameEl.getAttribute('src') && frameEl.getAttribute('src') !== 'about:blank') {
      frameEl.src = 'about:blank';
    }
    if (statusEl) statusEl.textContent = '';
  }

  closeBtn?.addEventListener('click', () => {
    cleanupModel();
    modelDialog.close();
  });
  modelDialog.addEventListener('cancel', () => {
    cleanupModel();
  });
  modelDialog.addEventListener('click', e => {
    if (e.target === modelDialog) {
      cleanupModel();
      modelDialog.close();
    }
  });

  modelDialog.addEventListener('close', () => {
    cleanupModel();
    const target = lastTrigger;
    lastTrigger = null;
    target?.focus();
  });
}

// ---------------------------------------------------------------------------
// 5. Accessible Audio Description Players (Progressive Enhancement + Mutual Exclusion)
// ---------------------------------------------------------------------------

// Playing any audio or video pauses all other audio and video elements on the page
document.addEventListener(
  'play',
  e => {
    const active = e.target;
    if (!(active instanceof HTMLMediaElement)) return;
    document.querySelectorAll('audio, video').forEach(media => {
      if (media !== active && !media.paused) {
        media.pause();
      }
    });
  },
  true,
);

document.querySelectorAll('[data-audio-player]').forEach(wrapper => {
  const audio = wrapper.querySelector('audio');
  const bar = wrapper.querySelector('[data-audio-bar]');
  const playBtn = wrapper.querySelector('[data-audio-play]');
  const playText = wrapper.querySelector('[data-audio-play-text]');
  const skipBtns = [...wrapper.querySelectorAll('[data-audio-skip]')];
  const seekEl = wrapper.querySelector('[data-audio-seek]');
  const timeEl = wrapper.querySelector('[data-audio-time]');
  const muteBtn = wrapper.querySelector('[data-audio-mute]');
  const muteText = wrapper.querySelector('[data-audio-mute-text]');
  const volEl = wrapper.querySelector('[data-audio-volume]');
  const speedEl = wrapper.querySelector('[data-audio-speed]');
  const statusEl = wrapper.querySelector('[data-audio-status]');
  const objectLabel = wrapper.dataset.objectLabel || 'this object';

  if (!audio || !bar || !playBtn) return;

  // Progressively replace native controls with our accessible toolbar
  audio.controls = false;
  audio.hidden = true;
  bar.hidden = false;

  const announce = msg => {
    if (statusEl) statusEl.textContent = msg;
  };

  function syncPlayState() {
    const playing = !audio.paused && !audio.ended;
    playBtn.setAttribute('aria-pressed', String(playing));
    playBtn.classList.toggle('is-playing', playing);
    const verb = playing ? 'Pause' : 'Play';
    if (playText) playText.textContent = verb;
    playBtn.setAttribute('aria-label', `${verb} audio description for ${objectLabel}`);
  }

  function syncTime() {
    const dur = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;
    const cur = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
    if (seekEl) {
      seekEl.max = String(dur || 100);
      seekEl.value = String(dur ? cur : 0);
      seekEl.setAttribute('aria-valuetext', `${formatClock(cur)} of ${formatClock(dur)}`);
      seekEl.style.setProperty('--progress', `${dur ? (cur / dur) * 100 : 0}%`);
    }
    if (timeEl) {
      timeEl.textContent = `${formatClock(cur)} / ${formatClock(dur)}`;
    }
  }

  function syncVolume() {
    const effective = audio.muted ? 0 : audio.volume;
    const isMuted = effective === 0;
    if (muteBtn) {
      muteBtn.setAttribute('aria-pressed', String(isMuted));
      muteBtn.classList.toggle('is-muted', isMuted);
      const verb = isMuted ? 'Unmute' : 'Mute';
      if (muteText) muteText.textContent = verb;
      muteBtn.setAttribute('aria-label', `${verb} audio description for ${objectLabel}`);
    }
    if (volEl) {
      volEl.value = String(effective);
      volEl.setAttribute('aria-valuetext', isMuted ? 'Muted' : `${Math.round(effective * 100)}%`);
      volEl.style.setProperty('--progress', `${effective * 100}%`);
    }
  }

  playBtn.addEventListener('click', () => {
    if (audio.paused) {
      const p = audio.play();
      if (p && typeof p.catch === 'function') {
        p.catch(() => {});
      }
    } else {
      audio.pause();
    }
  });

  skipBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const delta = Number(btn.dataset.audioSkip) || 0;
      const dur = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : Infinity;
      const target = Math.min(dur, Math.max(0, audio.currentTime + delta));
      audio.currentTime = Number.isFinite(target) ? target : 0;
      syncTime();
      announce(delta < 0 ? `Rewound ${Math.abs(delta)} seconds to ${formatClock(audio.currentTime)}.` : `Forwarded ${delta} seconds to ${formatClock(audio.currentTime)}.`);
    });
  });

  seekEl?.addEventListener('input', () => {
    const dur = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;
    if (dur > 0) {
      audio.currentTime = Number(seekEl.value);
    }
    syncTime();
  });

  muteBtn?.addEventListener('click', () => {
    if (audio.muted || audio.volume === 0) {
      audio.muted = false;
      if (audio.volume === 0) audio.volume = 1;
      announce('Audio unmuted.');
    } else {
      audio.muted = true;
      announce('Audio muted.');
    }
    syncVolume();
  });

  volEl?.addEventListener('input', () => {
    const val = Number(volEl.value);
    audio.volume = Math.min(1, Math.max(0, val));
    audio.muted = val === 0;
    syncVolume();
  });

  speedEl?.addEventListener('change', () => {
    const rate = Number(speedEl.value) || 1;
    audio.playbackRate = rate;
    announce(`Playback speed ${rate}×.`);
  });

  audio.addEventListener('play', syncPlayState);
  audio.addEventListener('pause', syncPlayState);
  audio.addEventListener('ended', syncPlayState);
  audio.addEventListener('timeupdate', syncTime);
  audio.addEventListener('loadedmetadata', syncTime);
  audio.addEventListener('durationchange', syncTime);
  audio.addEventListener('volumechange', syncVolume);

  syncPlayState();
  syncTime();
  syncVolume();
});
