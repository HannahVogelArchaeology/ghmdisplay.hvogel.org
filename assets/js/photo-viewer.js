// Universal site-wide zoomable photo lightbox (<dialog id="photo-dialog">)
// and gallery controller for every [data-gallery] figure across Home, Shelves, and Curation.
// Provides smooth pointer drag-to-pan, pinch/wheel zoom, keyboard shortcuts, and
// WCAG 2.5.7 single-click Zoom & Pan buttons with full focus continuity.

const photoDialog = document.getElementById('photo-dialog');
let openPhotoViewerImpl = () => {};

if (photoDialog) {
  const titleEl = photoDialog.querySelector('#photo-dialog-title');
  const countEl = photoDialog.querySelector('[data-pv-count]');
  const statusEl = photoDialog.querySelector('[data-pv-status]');
  const captionEl = photoDialog.querySelector('[data-pv-caption]');
  const stageEl = photoDialog.querySelector('[data-pv-stage]');
  let imgEl = photoDialog.querySelector('[data-pv-image]');
  const prevBtn = photoDialog.querySelector('[data-pv-prev]');
  const nextBtn = photoDialog.querySelector('[data-pv-next]');
  const closeBtn = photoDialog.querySelector('[data-pv-close]');
  const zoomInBtn = photoDialog.querySelector('[data-pv-zoom="in"]');
  const zoomOutBtn = photoDialog.querySelector('[data-pv-zoom="out"]');
  const zoomResetBtn = photoDialog.querySelector('[data-pv-zoom="reset"]');
  const panBtns = [...photoDialog.querySelectorAll('[data-pv-pan-dir]')];

  const MAX_ZOOM = 4;
  const ZOOM_STEP = 1.75;
  const PAN_STEP = 90;

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
    const baseW = imgEl.offsetWidth || stageEl.clientWidth * 0.7;
    const baseH = imgEl.offsetHeight || stageEl.clientHeight * 0.7;
    // Allow generous panning even for tall/narrow portrait photographs as soon as zoom > 1
    const maxX = Math.max(
      stageEl.clientWidth * 0.25 * (zoom - 1),
      (baseW * zoom - stageEl.clientWidth) / 2,
    );
    const maxY = Math.max(
      stageEl.clientHeight * 0.25 * (zoom - 1),
      (baseH * zoom - stageEl.clientHeight) / 2,
    );
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

  function ensureImageEl() {
    if (imgEl && imgEl.isConnected) return imgEl;
    if (!stageEl) return null;
    imgEl = document.createElement('img');
    imgEl.className = 'photo-viewer__image';
    imgEl.draggable = false;
    imgEl.dataset.pvImage = '';
    imgEl.addEventListener('dragstart', e => e.preventDefault());
    imgEl.addEventListener('load', () => {
      if (photoDialog.open) renderTransform();
    });
    stageEl.prepend(imgEl);
    return imgEl;
  }

  function showSlide(index) {
    if (!photos.length || !ensureImageEl()) return;
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
    imgEl.alt = item.alt || 'Selected exhibition photograph';

    if (captionEl) captionEl.textContent = item.caption || '';
    if (countEl) {
      countEl.textContent = photos.length > 1 ? `Photo ${currentIndex + 1} of ${photos.length}` : 'Photo 1 of 1';
    }

    renderTransform();
    onIndexSync?.(currentIndex);
  }

  openPhotoViewerImpl = ({ title, items, index = 0, opener = null, onSync = null }) => {
    photos = items || [];
    if (!photos.length) return;
    lastTrigger = opener;
    onIndexSync = onSync;

    window.ghmA11y?.closePanel?.(false);

    if (titleEl) titleEl.textContent = title || 'Photo viewer';
    const single = photos.length < 2;
    if (prevBtn) prevBtn.hidden = single;
    if (nextBtn) nextBtn.hidden = single;

    showSlide(index);
    if (!photoDialog.open) {
      photoDialog.showModal();
      window.ghmTrack?.('media_photo_enlarge', title || 'photo');
    }
    closeBtn?.focus();
  };

  closeBtn?.addEventListener('click', () => photoDialog.close());
  photoDialog.addEventListener('click', e => {
    if (e.target === photoDialog) photoDialog.close();
  });
  photoDialog.addEventListener('close', () => {
    announce('');
    if (imgEl && imgEl.isConnected) {
      imgEl.remove();
      imgEl = null;
    }
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
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      photoDialog.close();
      return;
    }
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

  // Mouse wheel zoom & reliable pointer drag/pinch pan (desktop + touch)
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
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
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

export function openPhotoViewer(opts) {
  openPhotoViewerImpl(opts);
}

// Universal gallery & single-photo lightbox binder across all pages
document.querySelectorAll('[data-gallery]').forEach(gallery => {
  const mainImg = gallery.querySelector(
    '[data-gallery-image], .shelf-gallery__image, .artifact-gallery__image, .home-hero__image, .shelf-showcase__photo, .curation__portrait, img',
  );
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

  enlargeBtn?.addEventListener('click', e => {
    e.stopPropagation();
    launchViewer(enlargeBtn);
  });
  mainImg.addEventListener('click', () => launchViewer(enlargeBtn));
});
