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

  const sections = [...document.querySelectorAll('main h1, main h2, main [data-step]')]
    .filter(el => !el.closest('dialog') && (el.matches('[data-step]') || !el.parentElement?.closest('[data-step]')));

  const nameOf = el => {
    const heading = el.matches('h1, h2, h3') ? el : el.querySelector('h1, h2, h3');
    if (!heading) return 'Section';
    const clone = heading.cloneNode(true);
    clone.querySelectorAll('[aria-hidden="true"], .visually-hidden, .sr-only').forEach(n => n.remove());
    return clone.textContent.trim().replace(/\s+/g, ' ');
  };

  const landing = () => parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 88;
  const atEnd = () => window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
  const previous = () => {
    for (let i = sections.length - 1; i >= 0; i--) {
      if (sections[i].getBoundingClientRect().top < landing() - 8) return sections[i];
    }
    return null;
  };
  const next = () => {
    if (atEnd()) return null;
    const after = Math.max(landing() + 8, window.scrollY < 1 ? window.innerHeight * 0.35 : 0);
    return sections.find(el => el.getBoundingClientRect().top > after) || null;
  };

  const setBtnState = (btn, prefix, target) => {
    if (!btn) return;
    btn.setAttribute('aria-disabled', String(!target));
    btn.setAttribute('aria-label', target ? `${prefix} section: ${nameOf(target)}` : `No ${prefix.toLowerCase()} section`);
    btn.dataset.hint = target ? `${prefix}: ${nameOf(target)}` : '';
  };

  const updateSteps = () => {
    topButton?.classList.toggle('is-shown', window.scrollY > window.innerHeight * 0.65);
    setBtnState(prevButton, 'Previous', previous());
    setBtnState(nextButton, 'Next', next());
  };

  const goTo = el => {
    el.scrollIntoView({ block: 'start', behavior: calm.matches ? 'auto' : 'smooth' });
    if (!el.matches('a, button, [tabindex]')) el.tabIndex = -1;
    el.focus({ preventScroll: true });
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
    window.addEventListener('resize', updateSteps, { passive: true });
    updateSteps();

    topButton?.addEventListener('click', goToTop);
    prevButton?.addEventListener('click', () => {
      const target = previous();
      if (target) goTo(target);
    });
    nextButton?.addEventListener('click', () => {
      const target = next();
      if (target) goTo(target);
    });

    // WCAG 1.4.13 hoverable, persistent, Escape-dismissible hint label
    const showHint = e => {
      const btn = e.target.closest('.steps__button');
      if (!btn || !stepLabel) return;
      stepLabel.textContent = btn.dataset.hint || (btn === topButton ? 'Back to top' : '');
      stepLabel.style.top = `${btn.offsetTop + btn.offsetHeight / 2}px`;
    };
    const clearHint = () => {
      if (!stepLabel) return;
      if (!stepBar.matches(':hover, :focus-within')) stepLabel.textContent = '';
    };
    stepBar.addEventListener('pointerover', showHint);
    stepBar.addEventListener('focusin', showHint);
    stepBar.addEventListener('pointerleave', clearHint);
    stepBar.addEventListener('focusout', () => requestAnimationFrame(clearHint));
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && stepLabel) stepLabel.textContent = '';
    });
  }
}
