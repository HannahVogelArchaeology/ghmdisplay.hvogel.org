// Homepage showcase accessibility fallback controller & video mutual exclusion.
// Toggles html.showcase-static whenever text size >= 150% or text spacing is expanded,
// ensuring scroll-rising shelf panels cleanly stack without occlusion or clipping.

function getCurrentPrefs(detail) {
  const root = document.documentElement;
  const size = Number(detail?.size ?? root.dataset.textSize) || 100;
  const spacing = detail?.spacing ?? root.dataset.spacing ?? 'default';
  return { size, spacing };
}

function syncShowcaseMode(detail) {
  const { size, spacing } = getCurrentPrefs(detail);
  const useStatic = size >= 150 || spacing !== 'default';
  document.documentElement.classList.toggle('showcase-static', useStatic);
}

syncShowcaseMode();

document.addEventListener('ghm:a11y-change', event => {
  syncShowcaseMode(event.detail);
});

window.addEventListener('pageshow', () => {
  syncShowcaseMode();
});

// Pause any other playing video on the homepage when another video starts playing.
const videos = [...document.querySelectorAll('.home video')];
for (const video of videos) {
  video.addEventListener('play', () => {
    for (const other of videos) {
      if (other !== video && !other.paused) {
        other.pause();
      }
    }
  });
}
