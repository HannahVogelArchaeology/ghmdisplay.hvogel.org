// Global chrome behaviour: mobile menu disclosure (100% native Tab order),
// dynamic scroll-padding-top (WCAG 2.4.11), and section stepper (WCAG 1.4.13).

const header = document.querySelector('.site-header');
const nav = document.querySelector('.site-nav');
const navToggle = nav?.querySelector('.nav-toggle');

// Dynamic scroll-padding-top so sticky header never obscures focused elements (WCAG 2.4.11)
function updateHeaderClearance() {
  if (!header) return;
  const height = Math.ceil(header.getBoundingClientRect().height + 16);
  document.documentElement.style.setProperty('--header-clearance', `${height}px`);
}

if (header) {
  updateHeaderClearance();
  if (typeof ResizeObserver === 'function') {
    new ResizeObserver(updateHeaderClearance).observe(header);
  }
  window.addEventListener('resize', updateHeaderClearance, { passive: true });
  document.addEventListener('ghm:a11y-change', () => requestAnimationFrame(updateHeaderClearance));
}

// Mobile navigation disclosure (zero tabindex="-1" on links — native Tab order preserved)
if (nav && navToggle) {
  nav.classList.add('has-js');
  const setOpen = open => {
    nav.classList.toggle('is-open', open);
    navToggle.setAttribute('aria-expanded', String(open));
  };
  const isOpen = () => nav.classList.contains('is-open');

  navToggle.addEventListener('click', () => setOpen(!isOpen()));

  document.addEventListener('click', e => {
    if (isOpen() && !nav.contains(e.target)) setOpen(false);
  });

  nav.addEventListener('keydown', e => {
    if (e.key === 'Escape' && isOpen()) {
      e.preventDefault();
      setOpen(false);
      navToggle.focus();
    }
  });

  nav.addEventListener('focusout', e => {
    if (isOpen() && e.relatedTarget && !nav.contains(e.relatedTarget)) {
      setOpen(false);
    }
  });

  window.addEventListener('pageshow', () => setOpen(false));
}

// Section stepper (Back to top / Previous section / Next section)
const stepBar = document.querySelector('.steps');
const calm = window.matchMedia('(prefers-reduced-motion: reduce)');

function goToTop() {
  window.scrollTo({ top: 0, behavior: calm.matches ? 'auto' : 'smooth' });
  const target = document.querySelector('.site-nav__link[aria-current="page"]') || document.querySelector('.site-nav__link') || navToggle;
  target?.focus({ preventScroll: true });
}

document.addEventListener('keydown', e => {
  if (!e.shiftKey || e.key !== 'ArrowUp' || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.target.closest('input, textarea, select, [contenteditable], dialog')) return;
  e.preventDefault();
  goToTop();
});

if (stepBar) {
  const topButton = stepBar.querySelector('.steps__top');
  const prevButton = stepBar.querySelector('.steps__prev');
  const nextButton = stepBar.querySelector('.steps__next');
  const stepLabel = stepBar.querySelector('.steps__label');

  const rawSections = [...document.querySelectorAll('main h1, main h2, main [data-step], nav.page-turn[data-step], footer[data-step]')]
    .filter(el => !el.closest('dialog') && (el.matches('[data-step]') || !el.parentElement?.closest('[data-step]')));

  // Coalesce stops that sit right on top of each other (< 140px) so clicking Next never hitches
  const sections = [];
  for (const el of rawSections) {
    const prev = sections[sections.length - 1];
    if (prev && !el.matches('nav.page-turn, footer')) {
      const gap = Math.abs(el.getBoundingClientRect().top - prev.getBoundingClientRect().top);
      if (gap < 140) continue;
    }
    sections.push(el);
  }

  const nameOf = el => {
    if (el.dataset.stepLabel) return el.dataset.stepLabel.trim();
    const heading = el.matches('h1, h2, h3') ? el : el.querySelector('h1, h2, h3');
    if (!heading) return 'Section';
    const clone = heading.cloneNode(true);
    clone.querySelectorAll('[aria-hidden="true"], .visually-hidden, .sr-only').forEach(n => n.remove());
    return clone.textContent.trim().replace(/\s+/g, ' ');
  };

  const landing = () => parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 88;
  const maxScrollY = () => Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  const atEnd = () => window.scrollY >= maxScrollY() - 2;

  let steeredIndex = null;
  let scrollAnimId = 0;
  let hoveredBtn = null;

  const cancelSteer = () => {
    steeredIndex = null;
    if (scrollAnimId) {
      cancelAnimationFrame(scrollAnimId);
      scrollAnimId = 0;
    }
  };

  const currentIndex = () => {
    if (steeredIndex !== null) return steeredIndex;
    if (atEnd()) return sections.length - 1;
    const cutoff = landing() + 36;
    let idx = 0;
    for (let i = 0; i < sections.length; i++) {
      if (sections[i].getBoundingClientRect().top <= cutoff) {
        idx = i;
      } else {
        break;
      }
    }
    return idx;
  };

  const previousIndex = () => {
    const idx = currentIndex();
    return idx > 0 ? idx - 1 : -1;
  };

  const nextIndex = () => {
    const idx = currentIndex();
    if (idx >= sections.length - 1) return -1;
    if (steeredIndex === null && atEnd()) return -1;
    return idx + 1;
  };

  const setBtnState = (btn, prefix, target) => {
    if (!btn) return;
    btn.setAttribute('aria-disabled', String(!target));
    btn.setAttribute('aria-label', target ? `${prefix} section: ${nameOf(target)}` : `No ${prefix.toLowerCase()} section`);
    btn.dataset.hint = target ? `${prefix}: ${nameOf(target)}` : '';
  };

  const refreshHint = () => {
    if (!stepLabel) return;
    if (!hoveredBtn || !stepBar.matches(':hover, :focus-within')) {
      stepLabel.textContent = '';
      return;
    }
    stepLabel.textContent = hoveredBtn.dataset.hint || (hoveredBtn === topButton ? 'Back to top' : '');
    stepLabel.style.top = `${hoveredBtn.offsetTop + hoveredBtn.offsetHeight / 2}px`;
  };

  const updateSteps = () => {
    topButton?.classList.toggle('is-shown', window.scrollY > window.innerHeight * 0.65);
    const pIdx = previousIndex();
    const nIdx = nextIndex();
    setBtnState(prevButton, 'Previous', pIdx >= 0 ? sections[pIdx] : null);
    setBtnState(nextButton, 'Next', nIdx >= 0 ? sections[nIdx] : null);
    refreshHint();
  };

  const animateScrollTo = (targetEl, onDone) => {
    if (scrollAnimId) {
      cancelAnimationFrame(scrollAnimId);
      scrollAnimId = 0;
    }
    const computeDesired = () => {
      const docTop = targetEl.getBoundingClientRect().top + window.scrollY;
      return Math.min(maxScrollY(), Math.max(0, Math.round(docTop - landing())));
    };

    if (calm.matches) {
      window.scrollTo({ top: computeDesired(), behavior: 'instant' });
      onDone();
      return;
    }

    const startY = window.scrollY;
    const duration = 220;
    const startTime = performance.now();

    const frame = now => {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const endY = computeDesired();
      window.scrollTo({ top: Math.round(startY + (endY - startY) * eased), behavior: 'instant' });
      if (t < 1) {
        scrollAnimId = requestAnimationFrame(frame);
      } else {
        scrollAnimId = 0;
        onDone();
      }
    };
    scrollAnimId = requestAnimationFrame(frame);
  };

  const goToIndex = targetIdx => {
    const el = sections[targetIdx];
    if (!el) return;
    steeredIndex = targetIdx;
    updateSteps();

    animateScrollTo(el, () => {
      if (!el.matches('a, button, [tabindex]')) el.tabIndex = -1;
      el.focus({ preventScroll: true });
      // Release steered lock after landing so manual scrolling resumes naturally
      steeredIndex = null;
      updateSteps();
    });
  };

  if (sections.length > 1) {
    stepBar.hidden = false;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        updateSteps();
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', () => {
      cancelSteer();
      updateSteps();
    }, { passive: true });
    window.addEventListener('wheel', cancelSteer, { passive: true });
    window.addEventListener('touchstart', cancelSteer, { passive: true });
    updateSteps();

    topButton?.addEventListener('click', () => {
      cancelSteer();
      goToTop();
    });
    prevButton?.addEventListener('click', () => {
      const idx = previousIndex();
      if (idx >= 0) goToIndex(idx);
    });
    nextButton?.addEventListener('click', () => {
      const idx = nextIndex();
      if (idx >= 0) goToIndex(idx);
    });

    // WCAG 1.4.13 hoverable, persistent, Escape-dismissible hint label
    const showHint = e => {
      const btn = e.target.closest('.steps__button');
      if (!btn || !stepLabel) return;
      hoveredBtn = btn;
      refreshHint();
    };
    const clearHint = () => {
      if (!stepBar.matches(':hover, :focus-within')) {
        hoveredBtn = null;
        if (stepLabel) stepLabel.textContent = '';
      }
    };
    stepBar.addEventListener('pointerover', showHint);
    stepBar.addEventListener('focusin', showHint);
    stepBar.addEventListener('pointerleave', clearHint);
    stepBar.addEventListener('focusout', () => requestAnimationFrame(clearHint));
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && stepLabel) {
        hoveredBtn = null;
        stepLabel.textContent = '';
      }
    });
  }
}
