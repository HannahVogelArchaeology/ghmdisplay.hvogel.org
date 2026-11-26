// Shelf page interactive behaviours (zero external UI CDNs, 100% native Tab stops):
// 1. Multi-photo shelf & artifact thumbnail galleries
// 2. "Explore the objects" in-page jump strip (smooth/reduced-motion scroll + heading focus + Esc dismiss)
// 3. Shared zoomable photo <dialog> with single-click Zoom (+/-/Reset) & Pan Up/Down/Left/Right (WCAG 2.5.7)
// 4. Shared Nira 3D <dialog> with on-demand iframe, 15s fallback status, and clean src clearing
// 5. Accessible Audio Description player with -10s/+10s skip buttons, seek/volume/speed, and mutual exclusion

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function formatClock(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// 1. Shared Zoomable Photo Viewer (<dialog id="photo-dialog">)
// ---------------------------------------------------------------------------
const photoDialog = document.getElementById('photo-dialog');
let openPhotoViewer = () => {};

if (photoDialog) {
  const titleEl = photoDialog.querySelector('#photo-dialog-title');
  const countEl = photoDialog.querySelector('[data-pv-count]');
  const statusEl = photoDialog.querySelector('[data-pv-status]');
  const captionEl = photoDialog.querySelector('[data-pv-caption]');
  const stageEl = photoDialog.querySelector('[data-pv-stage]');
  const imgEl = photoDialog.querySelector('[data-pv-image]');
  const prevBtn = photoDialog.querySelector('[data-pv-prev]');
  const nextBtn = photoDialog.querySelector('[data-pv-next]');
  const closeBtn = photoDialog.querySelector('[data-pv-close]');
  const zoomInBtn = photoDialog.querySelector('[data-pv-zoom="in"]');
  const zoomOutBtn = photoDialog.querySelector('[data-pv-zoom="out"]');
  const zoomResetBtn = photoDialog.querySelector('[data-pv-zoom="reset"]');
  const panBtns = [...photoDialog.querySelectorAll('[data-pv-pan-dir]')];

  const MAX_ZOOM = 4;
  const ZOOM_STEP = 1.5;
  const PAN_STEP = 80;

  let photos = [];
  let currentIndex = 0;
  let zoom = 1;
  let panX = 0;
  let panY = 0;
  let lastTrigger = null;
  let onIndexSync = null;

  function announce(message) {
    if (statusEl) statusEl.textContent = message;
  }

  function clampPan() {
    if (!stageEl || !imgEl) return;
    const baseW = imgEl.offsetWidth || stageEl.clientWidth * 0.8;
    const baseH = imgEl.offsetHeight || stageEl.clientHeight * 0.8;
    const maxX = Math.max(0, (baseW * zoom - stageEl.clientWidth) / 2);
    const maxY = Math.max(0, (baseH * zoom - stageEl.clientHeight) / 2);
    panX = Math.min(maxX, Math.max(-maxX, panX));
    panY = Math.min(maxY, Math.max(-maxY, panY));
  }

  function renderTransform() {
    if (!imgEl || !stageEl) return;
    if (zoom <= 1) {
      zoom = 1;
      panX = 0;
      panY = 0;
    } else {
      clampPan();
    }

    imgEl.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
    stageEl.classList.toggle('is-zoomed', zoom > 1);

    if (zoomOutBtn) zoomOutBtn.setAttribute('aria-disabled', String(zoom <= 1));
    if (zoomResetBtn) zoomResetBtn.setAttribute('aria-disabled', String(zoom <= 1 && panX === 0 && panY === 0));
    if (zoomInBtn) zoomInBtn.setAttribute('aria-disabled', String(zoom >= MAX_ZOOM));

    const canPan = zoom > 1;
    panBtns.forEach(btn => {
      btn.setAttribute('aria-disabled', String(!canPan));
    });

    const active = photos[currentIndex];
    if (zoom > 1 && active?.full && imgEl.dataset.loadedFull !== active.full) {
      imgEl.dataset.loadedFull = active.full;
      imgEl.removeAttribute('srcset');
      imgEl.src = active.full;
    }
  }

  function setZoom(nextZoom, cx, cy, announceChange = false) {
    const clamped = Math.min(MAX_ZOOM, Math.max(1, Number(nextZoom.toFixed(2))));
    if (stageEl && cx != null && cy != null) {
      const box = stageEl.getBoundingClientRect();
      const px = cx - (box.left + box.width / 2);
      const py = cy - (box.top + box.height / 2);
      panX = px - (px - panX) * (clamped / zoom);
      panY = py - (py - panY) * (clamped / zoom);
    }
    zoom = clamped;
    renderTransform();
    if (announceChange) {
      announce(zoom === 1 ? 'Reset to fit view.' : `Zoomed to ${Math.round(zoom * 100)}%.`);
    }
  }

  function panBy(dx, dy, label) {
    if (zoom <= 1) return;
    panX += dx;
    panY += dy;
    renderTransform();
    if (label) announce(label);
  }

  function showSlide(index) {
    if (!photos.length || !imgEl) return;
    currentIndex = (index + photos.length) % photos.length;
    const item = photos[currentIndex];
    zoom = 1;
    panX = 0;
    panY = 0;
    delete imgEl.dataset.loadedFull;

    if (item.full) {
      imgEl.removeAttribute('srcset');
      imgEl.src = item.full;
    } else {
      if (item.srcset) imgEl.srcset = item.srcset;
      else imgEl.removeAttribute('srcset');
      imgEl.src = item.src;
    }
    imgEl.alt = item.alt;

    if (captionEl) captionEl.textContent = item.caption || '';
    if (countEl) {
      countEl.textContent = photos.length > 1 ? `Photo ${currentIndex + 1} of ${photos.length}` : 'Photo 1 of 1';
    }

    renderTransform();
    onIndexSync?.(currentIndex);
  }

  openPhotoViewer = ({ title, items, index = 0, opener = null, onSync = null }) => {
    photos = items || [];
    if (!photos.length) return;
    lastTrigger = opener;
    onIndexSync = onSync;

    if (titleEl) titleEl.textContent = title || 'Photo viewer';
    const single = photos.length < 2;
    if (prevBtn) prevBtn.hidden = single;
    if (nextBtn) nextBtn.hidden = single;

    showSlide(index);
    if (!photoDialog.open) {
      photoDialog.showModal();
    }
    closeBtn?.focus();
  };

  closeBtn?.addEventListener('click', () => photoDialog.close());
  photoDialog.addEventListener('click', e => {
    if (e.target === photoDialog) photoDialog.close();
  });
  photoDialog.addEventListener('close', () => {
    announce('');
    const target = lastTrigger;
    lastTrigger = null;
    onIndexSync = null;
    target?.focus();
  });

  prevBtn?.addEventListener('click', () => showSlide(currentIndex - 1));
  nextBtn?.addEventListener('click', () => showSlide(currentIndex + 1));

  zoomInBtn?.addEventListener('click', () => {
    if (zoomInBtn.getAttribute('aria-disabled') === 'true') return;
    setZoom(zoom * ZOOM_STEP, null, null, true);
  });
  zoomOutBtn?.addEventListener('click', () => {
    if (zoomOutBtn.getAttribute('aria-disabled') === 'true') return;
    setZoom(zoom / ZOOM_STEP, null, null, true);
  });
  zoomResetBtn?.addEventListener('click', () => {
    if (zoomResetBtn.getAttribute('aria-disabled') === 'true') return;
    setZoom(1, null, null, true);
  });

  panBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.getAttribute('aria-disabled') === 'true') return;
      const dir = btn.dataset.pvPanDir;
      if (dir === 'up') panBy(0, PAN_STEP, 'Panned up.');
      else if (dir === 'down') panBy(0, -PAN_STEP, 'Panned down.');
      else if (dir === 'left') panBy(PAN_STEP, 0, 'Panned left.');
      else if (dir === 'right') panBy(-PAN_STEP, 0, 'Panned right.');
    });
  });

  photoDialog.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (zoom > 1 && e.key.startsWith('Arrow')) {
      e.preventDefault();
      if (e.key === 'ArrowLeft') panBy(PAN_STEP, 0);
      else if (e.key === 'ArrowRight') panBy(-PAN_STEP, 0);
      else if (e.key === 'ArrowUp') panBy(0, PAN_STEP);
      else if (e.key === 'ArrowDown') panBy(0, -PAN_STEP);
      return;
    }
    if (e.key === 'ArrowLeft' && photos.length > 1) {
      e.preventDefault();
      showSlide(currentIndex - 1);
    } else if (e.key === 'ArrowRight' && photos.length > 1) {
      e.preventDefault();
      showSlide(currentIndex + 1);
    } else if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      setZoom(zoom * ZOOM_STEP, null, null, true);
    } else if (e.key === '-' || e.key === '_') {
      e.preventDefault();
      setZoom(zoom / ZOOM_STEP, null, null, true);
    } else if (e.key === '0') {
      e.preventDefault();
      setZoom(1, null, null, true);
    }
  });

  // Mouse wheel zoom & pointer drag/pinch (progressive enhancement alongside buttons)
  stageEl?.addEventListener(
    'wheel',
    e => {
      e.preventDefault();
      setZoom(zoom * Math.exp(-e.deltaY * 0.002), e.clientX, e.clientY, false);
    },
    { passive: false },
  );

  const activePointers = new Map();
  let dragStart = null;
  let lastTap = 0;

  const pinchDistance = () => {
    const [a, b] = [...activePointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };
  const pinchMidpoint = () => {
    const [a, b] = [...activePointers.values()];
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  };

  stageEl?.addEventListener('pointerdown', e => {
    if (e.target.closest('button')) return;
    try {
      stageEl.setPointerCapture(e.pointerId);
    } catch {}
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    stageEl.classList.add('is-moving');
    dragStart =
      activePointers.size === 2
        ? { pinch: pinchDistance(), zoom }
        : { x: e.clientX, y: e.clientY, ox: panX, oy: panY, time: Date.now() };
  });

  stageEl?.addEventListener('pointermove', e => {
    if (!activePointers.has(e.pointerId)) return;
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (activePointers.size === 2 && dragStart?.pinch) {
      const m = pinchMidpoint();
      setZoom((dragStart.zoom * pinchDistance()) / dragStart.pinch, m.x, m.y, false);
    } else if (activePointers.size === 1 && dragStart && !dragStart.pinch && zoom > 1) {
      panX = dragStart.ox + (e.clientX - dragStart.x);
      panY = dragStart.oy + (e.clientY - dragStart.y);
      renderTransform();
    }
  });

  const endPointer = e => {
    if (!activePointers.has(e.pointerId)) return;
    activePointers.delete(e.pointerId);
    if (activePointers.size > 0) {
      dragStart = null;
      return;
    }
    stageEl.classList.remove('is-moving');
    if (dragStart && !dragStart.pinch) {
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      const quick = Date.now() - dragStart.time < 300;
      if (zoom === 1 && photos.length > 1 && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
        showSlide(currentIndex + (dx < 0 ? 1 : -1));
      } else if (quick && Math.hypot(dx, dy) < 10) {
        const now = Date.now();
        if (now - lastTap < 300) {
          setZoom(zoom > 1 ? 1 : 2.5, e.clientX, e.clientY, true);
          lastTap = 0;
        } else {
          lastTap = now;
        }
      }
    }
    dragStart = null;
  };

  stageEl?.addEventListener('pointerup', endPointer);
  stageEl?.addEventListener('pointercancel', endPointer);
  window.addEventListener('resize', () => {
    if (photoDialog.open) renderTransform();
  });
}

// ---------------------------------------------------------------------------
// 2. Shelf & Artifact Thumbnail Galleries
// ---------------------------------------------------------------------------
document.querySelectorAll('[data-gallery]').forEach(gallery => {
  const mainImg = gallery.querySelector('.shelf-gallery__image, .artifact-gallery__image');
  const captionEl = gallery.querySelector('[data-gallery-caption]');
  const statusEl = gallery.querySelector('[data-gallery-status]');
  const prevBtn = gallery.querySelector('[data-gallery-prev]');
  const nextBtn = gallery.querySelector('[data-gallery-next]');
  const enlargeBtn = gallery.querySelector('[data-gallery-enlarge]');
  const thumbs = [...gallery.querySelectorAll('[data-gallery-thumb]')];
  const title = gallery.dataset.galleryTitle || 'Exhibition photograph';

  if (!mainImg) return;

  const items = thumbs.length
    ? thumbs.map(btn => {
        const img = btn.querySelector('img');
        return {
          src: img?.getAttribute('src') || '',
          srcset: img?.getAttribute('srcset') || '',
          lqip: img?.style.getPropertyValue('--lqip') || '',
          full: btn.dataset.full || img?.dataset.full || img?.getAttribute('src') || '',
          alt: img?.getAttribute('alt') || '',
          caption: btn.dataset.caption || '',
          label: btn.dataset.label || '',
        };
      })
    : [
        {
          src: mainImg.getAttribute('src') || '',
          srcset: mainImg.getAttribute('srcset') || '',
          lqip: mainImg.style.getPropertyValue('--lqip') || '',
          full: mainImg.dataset.full || mainImg.getAttribute('src') || '',
          alt: mainImg.getAttribute('alt') || '',
          caption: captionEl?.textContent?.trim() || '',
          label: '',
        },
      ];

  let activeIndex = 0;

  function selectPhoto(index, announceChange = true) {
    activeIndex = (index + items.length) % items.length;
    const item = items[activeIndex];

    if (item.srcset) mainImg.setAttribute('srcset', item.srcset);
    else mainImg.removeAttribute('srcset');
    mainImg.setAttribute('src', item.src);
    mainImg.setAttribute('alt', item.alt);
    if (item.full) mainImg.dataset.full = item.full;
    if (item.lqip) mainImg.style.setProperty('--lqip', item.lqip);

    if (captionEl) captionEl.textContent = item.caption;

    thumbs.forEach((btn, idx) => {
      const selected = idx === activeIndex;
      btn.setAttribute('aria-pressed', String(selected));
      btn.classList.toggle('is-active', selected);
    });

    if (statusEl && announceChange && items.length > 1) {
      statusEl.textContent = item.label
        ? `View ${activeIndex + 1} of ${items.length}: ${item.label}`
        : `Photo ${activeIndex + 1} of ${items.length}`;
    }
  }

  thumbs.forEach((btn, idx) => {
    btn.addEventListener('click', () => selectPhoto(idx, true));
  });

  prevBtn?.addEventListener('click', () => selectPhoto(activeIndex - 1, true));
  nextBtn?.addEventListener('click', () => selectPhoto(activeIndex + 1, true));

  const launchViewer = opener => {
    openPhotoViewer({
      title,
      items,
      index: activeIndex,
      opener: opener || enlargeBtn,
      onSync: idx => {
        if (idx !== activeIndex) selectPhoto(idx, false);
      },
    });
  };

  enlargeBtn?.addEventListener('click', () => launchViewer(enlargeBtn));
  mainImg.addEventListener('click', () => launchViewer(enlargeBtn));
});

// ---------------------------------------------------------------------------
// 3. "Explore the objects" In-Page Jump Strip (smooth scroll + heading focus + Esc dismiss)
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
