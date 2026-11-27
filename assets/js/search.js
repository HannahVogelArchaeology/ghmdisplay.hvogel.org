// Instant zero-dependency Site Search (<dialog id="search-dialog">).
// Triggered by header Search button, Ctrl+K / Cmd+K, or experimental "/" outside text inputs and dialogs.

const trigger = document.getElementById('search-trigger');
const dialog = document.getElementById('search-dialog');
const closeBtn = document.getElementById('search-close');
const input = document.getElementById('search-input');
const statusEl = document.getElementById('search-status');
const resultsEl = document.getElementById('search-results');

let indexPromise = null;
let lastTrigger = null;
let suppressRestoreFocus = false;

function loadIndex() {
  if (!indexPromise) {
    indexPromise = fetch('/assets/data/search-index.json')
      .then(r => (r.ok ? r.json() : []))
      .catch(() => []);
  }
  return indexPromise;
}

function renderResults(items, query) {
  if (!resultsEl || !statusEl) return;
  resultsEl.textContent = '';

  const q = query.trim().toLowerCase();
  const matches = q
    ? items.filter(item => {
        const hay = [
          item.number != null ? `object ${item.number} ${item.number}` : '',
          item.title || '',
          item.accNo || '',
          item.material || '',
          item.shelf || '',
          item.snippet || '',
        ]
          .join(' ')
          .toLowerCase();
        return q.split(/\s+/).every(token => hay.includes(token));
      })
    : items.filter(item => item.type === 'object' || item.type === 'shelf');

  if (!matches.length) {
    statusEl.textContent = `No matches for "${query.trim()}". Try an object name, number, material, or accession number.`;
    return;
  }

  statusEl.textContent = q
    ? `${matches.length} result${matches.length === 1 ? '' : 's'} for "${query.trim()}".`
    : `Showing ${matches.length} shelves and exhibition objects. Type to filter.`;

  const frag = document.createDocumentFragment();
  for (const item of matches) {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.className = 'search-results__link';
    a.href = item.url;

    const title = document.createElement('span');
    title.className = 'search-results__title';
    title.textContent = item.number != null ? `${item.number}. ${item.title}` : item.title;

    const meta = document.createElement('span');
    meta.className = 'search-results__meta';
    const metaParts = [item.shelf, item.accNo, item.material].filter(Boolean);
    meta.textContent = metaParts.join(' · ') || item.snippet || '';

    a.append(title, meta);
    a.addEventListener('click', () => {
      window.ghmTrack?.('nav_search_select', item.type || 'result');
      const targetUrl = new URL(a.href, window.location.origin);
      const isSamePageJump = targetUrl.pathname === window.location.pathname && Boolean(targetUrl.hash);
      if (isSamePageJump) {
        suppressRestoreFocus = true;
      }
      dialog?.close();
      if (isSamePageJump) {
        const target = document.getElementById(targetUrl.hash.slice(1));
        if (target) {
          const focusEl = target.querySelector('h2, h3, h1') || target;
          if (!focusEl.matches('a, button, [tabindex]')) focusEl.tabIndex = -1;
          requestAnimationFrame(() => {
            target.scrollIntoView({ block: 'start' });
            focusEl.focus({ preventScroll: true });
          });
        }
      }
    });

    li.appendChild(a);
    frag.appendChild(li);
  }
  resultsEl.appendChild(frag);
}

async function openSearch(opener, source = 'button') {
  if (!dialog) return;
  if (!dialog.open) {
    lastTrigger = opener || trigger;
    dialog.showModal();
    window.ghmTrack?.('nav_search_open', source);
  }
  if (input) {
    input.focus();
    input.select();
  }
  const items = await loadIndex();
  renderResults(items, input?.value || '');
}

function closeSearch() {
  if (dialog?.open) dialog.close();
}

dialog?.addEventListener('close', () => {
  if (suppressRestoreFocus) {
    suppressRestoreFocus = false;
    return;
  }
  lastTrigger?.focus();
});

trigger?.addEventListener('click', () => openSearch(trigger, 'button'));
closeBtn?.addEventListener('click', closeSearch);

dialog?.addEventListener('click', e => {
  if (e.target === dialog) closeSearch();
});

input?.addEventListener('input', async () => {
  const items = await loadIndex();
  renderResults(items, input.value);
});

dialog?.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    e.preventDefault();
    closeSearch();
    return;
  }
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
  const links = [...(resultsEl?.querySelectorAll('a') || [])];
  if (!links.length) return;
  const idx = links.indexOf(document.activeElement);
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    links[(idx + 1) % links.length].focus();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (idx <= 0) input?.focus();
    else links[idx - 1].focus();
  }
});

// Global shortcuts: Ctrl+K / Cmd+K and experimental bare "/" (ignored in inputs/dialogs)
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    openSearch(document.activeElement instanceof HTMLElement ? document.activeElement : trigger, 'ctrl_k');
    return;
  }

  if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
    if (document.querySelector('dialog[open]')) return;
    if (e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable]')) return;
    e.preventDefault();
    openSearch(document.activeElement instanceof HTMLElement ? document.activeElement : trigger, 'slash');
  }
});
