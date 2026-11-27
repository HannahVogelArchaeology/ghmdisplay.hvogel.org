// Lazy-loaded CDN Able Player 5.0.0 with pinned SHA-384 Subresource Integrity (SRI) hashes.
// Shared by both Video Introduction and Auslan Introduction on the homepage.
// Hosting strategy:
//   1. Self-hosted MP4 + local WebVTT captions primary (zero third-party video cookies/overlays, full Able Player CC & transcript).
//   2. If Able Player CDN is unreachable, degrades cleanly to native HTML5 <video controls> with local MP4 + WebVTT.
//   3. Outside kiosk mode, if a self-hosted MP4 fails to load/decode and a YouTube ID is configured, falls back to YouTube (nocookie) + local WebVTT.
//   4. In gallery kiosk mode (?kiosk=on): strictly self-hosted (never leaves the site to YouTube) + idle background prefetch.

const ABLE_ASSETS = {
  css: {
    href: 'https://cdn.jsdelivr.net/npm/ableplayer@5.0.0/build/ableplayer.min.css',
    integrity: 'sha384-vk1x1wN55ql1lNTQXquRKXiOiaSW0rNLjg7aFRqC/H/5vQ1G6ye9eGXNLeyE5x6w',
  },
  jquery: {
    src: 'https://cdn.jsdelivr.net/npm/jquery@3.7.1/dist/jquery.slim.min.js',
    integrity: 'sha384-5AkRS45j4ukf+JbWAfHL8P4onPA9p0KwwP7pUdjSQA3ss9edbJUJc/XcYAiheSSz',
  },
  ableplayer: {
    src: 'https://cdn.jsdelivr.net/npm/ableplayer@5.0.0/build/ableplayer.min.js',
    integrity: 'sha384-RmzPTW2PV7jxDlzcABEfU2qI7Snz4Enr6ljRCxqmKVjN+ofj5bpiv32lNeeoboZZ',
  },
};

const KIOSK_PREFETCH_KEY = 'ghm_kiosk_media_prefetched';

let assetPromise = null;
let kioskPrefetchStarted = false;
let playerSeq = 0;

function isKioskActive() {
  return document.documentElement.dataset.kiosk === 'on';
}

function loadStylesheet({ href, integrity }) {
  const existing = document.querySelector(`link[rel="stylesheet"][href="${href}"]`);
  if (existing) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.integrity = integrity;
    link.crossOrigin = 'anonymous';
    link.referrerPolicy = 'no-referrer';
    link.addEventListener('load', () => resolve(), { once: true });
    link.addEventListener('error', () => reject(new Error(`Failed to load stylesheet: ${href}`)), { once: true });
    document.head.append(link);
  });
}

function loadScript({ src, integrity }) {
  const existing = document.querySelector(`script[src="${src}"]`);
  if (existing && existing.dataset.loaded === 'true') return Promise.resolve();

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.integrity = integrity;
    script.crossOrigin = 'anonymous';
    script.referrerPolicy = 'no-referrer';
    script.async = true;
    script.addEventListener(
      'load',
      () => {
        script.dataset.loaded = 'true';
        resolve();
      },
      { once: true }
    );
    script.addEventListener(
      'error',
      () => {
        script.remove();
        reject(new Error(`Failed to load script: ${src}`));
      },
      { once: true }
    );
    document.head.append(script);
  });
}

async function ensureAblePlayer() {
  if (window.AblePlayer) return window.AblePlayer;
  if (!assetPromise) {
    assetPromise = (async () => {
      await loadStylesheet(ABLE_ASSETS.css);
      if (!window.jQuery) {
        await loadScript(ABLE_ASSETS.jquery);
      }
      if (!window.AblePlayer) {
        await loadScript(ABLE_ASSETS.ableplayer);
      }
      if (typeof window.AblePlayer !== 'function') {
        throw new Error('AblePlayer global did not initialise');
      }
      return window.AblePlayer;
    })().catch(err => {
      assetPromise = null;
      throw err;
    });
  }
  return assetPromise;
}

function createVideoElement({ playerId, titleId, videoSrc, youtubeId, poster, captions, nativeControls = false }) {
  const video = document.createElement('video');
  video.id = playerId || `able-video-${++playerSeq}`;
  video.className = 'video-card__player';
  video.setAttribute('playsinline', '');
  video.setAttribute('autoplay', '');
  if (poster) {
    video.setAttribute('poster', poster);
  }
  if (titleId) {
    video.setAttribute('aria-labelledby', titleId);
  }

  if (nativeControls) {
    video.setAttribute('controls', '');
    video.setAttribute('preload', 'auto');
  } else {
    video.setAttribute('preload', videoSrc ? 'auto' : 'none');
    video.dataset.headingLevel = '0';
    video.dataset.allowFullscreen = 'true';
    if (!videoSrc && youtubeId) {
      video.dataset.youtubeId = youtubeId;
      video.dataset.youtubeNocookie = 'true';
    }
  }

  if (videoSrc) {
    const source = document.createElement('source');
    source.src = videoSrc;
    source.type = 'video/mp4';
    video.append(source);
  }

  if (captions) {
    const track = document.createElement('track');
    track.kind = 'captions';
    track.src = captions;
    track.srclang = 'en-AU';
    track.label = 'English captions';
    track.default = true;
    video.append(track);
  }

  const fallbackP = document.createElement('p');
  fallbackP.textContent = 'Your browser cannot play this video. Please read the full transcript below.';
  video.append(fallbackP);

  return video;
}

function createLiveRegion(text) {
  const liveRegion = document.createElement('p');
  liveRegion.className = 'visually-hidden';
  liveRegion.setAttribute('role', 'status');
  liveRegion.setAttribute('aria-live', 'polite');
  liveRegion.textContent = text;
  return liveRegion;
}

function renderErrorAlert(container, youtubeId, videoTitle) {
  container.setAttribute('aria-busy', 'false');
  container.classList.remove('able-lazy--loading');
  container.classList.add('able-lazy--error');

  const box = document.createElement('div');
  box.className = 'able-lazy__fallback';
  box.setAttribute('role', 'alert');

  const msg = document.createElement('p');
  msg.textContent =
    youtubeId && !isKioskActive()
      ? 'The accessible video player could not be loaded right now. You can watch the video directly on YouTube or read the full transcript below.'
      : 'The video could not be loaded right now. Please read the full transcript below.';

  box.append(msg);

  if (youtubeId && !isKioskActive()) {
    const link = document.createElement('a');
    link.className = 'btn btn--primary';
    link.href = `https://www.youtube.com/watch?v=${encodeURIComponent(youtubeId)}`;
    link.textContent = `Watch ${videoTitle} on YouTube`;
    box.append(link);
  }

  container.replaceChildren(box);
}

function registerAblePlayer(player) {
  window.__ghmAblePlayers = window.__ghmAblePlayers || [];
  window.__ghmAblePlayers.push(player);
}

function unregisterAblePlayer(player) {
  if (!Array.isArray(window.__ghmAblePlayers)) return;
  window.__ghmAblePlayers = window.__ghmAblePlayers.filter(p => p !== player);
}

function pauseOtherPlayers(activeTarget) {
  const players = window.__ghmAblePlayers;
  if (Array.isArray(players)) {
    for (const other of players) {
      if (!other || other === activeTarget || (activeTarget instanceof HTMLMediaElement && other.media === activeTarget)) {
        continue;
      }
      const isPlaying = other.playing === true || (other.media && !other.media.paused);
      if (isPlaying && typeof other.pauseMedia === 'function') {
        try {
          other.pauseMedia();
        } catch {}
      }
    }
  }
  document.querySelectorAll('main video, main audio').forEach(mediaEl => {
    if (mediaEl === activeTarget) return;
    if (activeTarget?.media && mediaEl === activeTarget.media) return;
    if (!mediaEl.paused) {
      try {
        mediaEl.pause();
      } catch {}
    }
  });
}

let mutualPlayBound = false;
function bindMutualPlayPause() {
  if (mutualPlayBound) return;
  mutualPlayBound = true;
  document.addEventListener(
    'play',
    event => {
      if (event.target instanceof HTMLMediaElement) {
        pauseOtherPlayers(event.target);
      }
    },
    true
  );
}

function mountYouTubeAbleFallback(container, AblePlayerCtor, { playerId, titleId, youtubeId, poster, captions }) {
  if (container.dataset.ableFallback === 'youtube' || isKioskActive() || !youtubeId) return;
  container.dataset.ableFallback = 'youtube';

  const video = createVideoElement({
    playerId: `${playerId}-yt`,
    titleId,
    videoSrc: '',
    youtubeId,
    poster,
    captions,
    nativeControls: false,
  });
  const liveRegion = createLiveRegion('Self-hosted video unavailable. Loaded YouTube fallback player.');
  container.replaceChildren(video, liveRegion);

  const player = new AblePlayerCtor(video);
  registerAblePlayer(player);
  pauseOtherPlayers(player);
}

function mountNativeFallback(container, { playerId, titleId, videoTitle, videoSrc, youtubeId, poster, captions }) {
  const video = createVideoElement({
    playerId,
    titleId,
    videoSrc,
    youtubeId: '',
    poster,
    captions,
    nativeControls: true,
  });
  const liveRegion = createLiveRegion(`Loaded standard ${videoTitle} player with closed captions.`);

  const sourceEl = video.querySelector('source');
  const handleNativeError = () => {
    renderErrorAlert(container, youtubeId, videoTitle);
  };
  video.addEventListener('error', handleNativeError, { once: true });
  sourceEl?.addEventListener('error', handleNativeError, { once: true });

  container.replaceChildren(video, liveRegion);
  container.classList.remove('able-lazy--loading');
  container.classList.add('able-lazy--ready', 'able-lazy--native');
  container.dataset.ableState = 'native';
  container.setAttribute('aria-busy', 'false');
  video.focus();
}

async function mountAbleLazyPlayer(container) {
  if (container.dataset.ableState === 'loading' || container.dataset.ableState === 'ready' || container.dataset.ableState === 'native') {
    return;
  }

  const playerId = container.dataset.playerId || `able-video-${++playerSeq}`;
  const titleId = container.dataset.titleId || '';
  const videoTitle = container.dataset.videoTitle || 'video';
  const videoSrc = container.dataset.videoSrc || '';
  const youtubeId = container.dataset.youtubeId || '';
  const poster = container.dataset.poster || '';
  const captions = container.dataset.captions || '';

  if (!videoSrc && (!youtubeId || isKioskActive())) return;

  const trigger = container.querySelector('[data-able-trigger]');
  const triggerLabel = container.querySelector('[data-able-trigger-label]');
  const statusEl = container.querySelector('[data-able-status]');

  container.dataset.ableState = 'loading';
  window.ghmTrack?.('media_video_play', playerId);
  container.setAttribute('aria-busy', 'true');
  container.classList.add('able-lazy--loading');
  if (trigger) trigger.setAttribute('aria-disabled', 'true');
  if (triggerLabel) triggerLabel.textContent = 'Loading accessible player…';
  if (statusEl) statusEl.textContent = `Loading accessible ${videoTitle} player…`;

  try {
    const AblePlayerCtor = await ensureAblePlayer();
    const useSelfHosted = Boolean(videoSrc);
    const video = createVideoElement({
      playerId,
      titleId,
      videoSrc: useSelfHosted ? videoSrc : '',
      youtubeId: useSelfHosted ? '' : youtubeId,
      poster,
      captions,
      nativeControls: false,
    });
    const liveRegion = createLiveRegion(`Accessible ${videoTitle} player loaded.`);

    container.replaceChildren(video, liveRegion);
    container.classList.remove('able-lazy--loading');
    container.classList.add('able-lazy--ready');
    container.dataset.ableState = 'ready';
    container.setAttribute('aria-busy', 'false');

    const player = new AblePlayerCtor(video);
    registerAblePlayer(player);
    pauseOtherPlayers(player);

    // Only fall back to YouTube outside kiosk mode if the self-hosted MP4 truly fails to load
    // BEFORE metadata/playback ever succeeds (never on transient Range resets or mid-playback aborts).
    if (useSelfHosted && youtubeId && !isKioskActive()) {
      let hasLoaded = false;
      let fallbackChecking = false;
      video.addEventListener(
        'loadedmetadata',
        () => {
          hasLoaded = true;
        },
        { once: true }
      );
      const triggerFallback = async () => {
        if (hasLoaded || fallbackChecking || container.dataset.ableFallback === 'youtube') return;
        if (video.error && video.error.code === 1) return; // MEDIA_ERR_ABORTED
        fallbackChecking = true;
        try {
          const head = await fetch(videoSrc, { method: 'HEAD', credentials: 'same-origin' });
          if (head.ok && !video.error) {
            // File is reachable; transient error only — do not hijack with YouTube
            fallbackChecking = false;
            return;
          }
          if (head.ok && video.error && video.error.code !== 4) {
            fallbackChecking = false;
            return;
          }
        } catch {
          // Network/HEAD failure — proceed to YouTube fallback below
        }
        if (hasLoaded || container.dataset.ableFallback === 'youtube') return;
        unregisterAblePlayer(player);
        try {
          if (typeof player.dispose === 'function') player.dispose();
        } catch {}
        mountYouTubeAbleFallback(container, AblePlayerCtor, { playerId, titleId, youtubeId, poster, captions });
      };
      video.addEventListener('error', triggerFallback, { once: true });
      video.querySelector('source')?.addEventListener('error', triggerFallback, { once: true });
    }

    window.setTimeout(() => {
      const firstBtn = container.querySelector('.able-controller button, button');
      if (firstBtn && typeof firstBtn.focus === 'function') {
        firstBtn.focus();
      }
    }, 150);
  } catch {
    if (videoSrc) {
      mountNativeFallback(container, { playerId, titleId, videoTitle, videoSrc, youtubeId, poster, captions });
    } else {
      container.dataset.ableState = 'error';
      renderErrorAlert(container, youtubeId, videoTitle);
    }
  }
}

function collectKioskPrefetchUrls() {
  const urls = new Set();
  document.querySelectorAll('[data-able-lazy]').forEach(el => {
    if (el.dataset.videoSrc) urls.add(el.dataset.videoSrc);
    if (el.dataset.captions) urls.add(el.dataset.captions);
  });
  document.querySelectorAll('main video source[src]').forEach(srcEl => {
    const href = srcEl.getAttribute('src');
    if (href) urls.add(href);
  });
  document.querySelectorAll('main video track[src]').forEach(trackEl => {
    const href = trackEl.getAttribute('src');
    if (href) urls.add(href);
  });
  return [...urls];
}

function prefetchKioskMedia() {
  if (!isKioskActive() || kioskPrefetchStarted) return;
  try {
    if (window.sessionStorage.getItem(KIOSK_PREFETCH_KEY) === '1') {
      kioskPrefetchStarted = true;
      return;
    }
  } catch {}

  const urls = collectKioskPrefetchUrls();
  if (urls.length === 0) return;

  kioskPrefetchStarted = true;

  const startFetch = async () => {
    for (const url of urls) {
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = url;
      if (url.endsWith('.mp4')) link.as = 'video';
      document.head.append(link);

      try {
        const res = await fetch(url, { credentials: 'same-origin', priority: 'low' });
        if (res.ok && res.body) {
          const reader = res.body.getReader();
          while (true) {
            const { done } = await reader.read();
            if (done) break;
          }
        }
      } catch {
        // Best-effort cache warm; never surface background prefetch errors to visitors
      }
    }
    try {
      window.sessionStorage.setItem(KIOSK_PREFETCH_KEY, '1');
    } catch {}
  };

  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(() => {
      startFetch();
    }, { timeout: 3000 });
  } else {
    window.setTimeout(startFetch, 1500);
  }
}

function initAbleLazyPlayers() {
  bindMutualPlayPause();
  document.querySelectorAll('[data-able-lazy]').forEach(container => {
    const trigger = container.querySelector('[data-able-trigger]');
    if (!trigger) return;
    trigger.addEventListener('click', () => {
      mountAbleLazyPlayer(container);
    });
  });

  if (isKioskActive()) {
    prefetchKioskMedia();
  }
  window.addEventListener('ghm:kiosk-changed', event => {
    if (event.detail?.active) {
      prefetchKioskMedia();
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAbleLazyPlayers, { once: true });
} else {
  initAbleLazyPlayers();
}
