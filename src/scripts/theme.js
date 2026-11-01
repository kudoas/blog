(() => {
  const key = 'blog-theme';
  const root = document.documentElement;
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  const normalize = (value) => value === 'light' || value === 'dark' ? value : 'system';
  let preference = 'system';
  let ready = false;
  let controls;
  try { preference = normalize(localStorage.getItem(key)); } catch { /* Storage is optional. */ }

  function syncComments() {
    const theme = root.dataset.theme === 'dark' ? 'transparent_dark' : 'light';
    const client = document.querySelector('.giscus script[src="https://giscus.app/client.js"]');
    if (client) client.dataset.theme = theme;
    const frame = document.querySelector('iframe.giscus-frame');
    frame?.contentWindow?.postMessage({ giscus: { setConfig: { theme } } }, 'https://giscus.app');
  }

  // The async client and lazy iframe may appear before or after DOMContentLoaded.
  const commentsObserver = new MutationObserver(syncComments);
  commentsObserver.observe(root, { childList: true, subtree: true });
  document.addEventListener('load', (event) => {
    if (event.target instanceof HTMLIFrameElement && event.target.matches('iframe.giscus-frame')) syncComments();
  }, true);

  function apply() {
    root.dataset.theme = preference === 'system' ? (system.matches ? 'dark' : 'light') : preference;
    syncComments();
    if (!ready) return;
    document.querySelectorAll('input[name="theme-preference"]').forEach((input) => {
      input.checked = input.value === root.dataset.theme;
    });
    const background = getComputedStyle(root).getPropertyValue('--bg').trim();
    document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => { meta.content = background; });
  }

  apply();
  system.addEventListener('change', () => { if (preference === 'system') apply(); });
  window.addEventListener('storage', (event) => {
    if (event.key === key || event.key === null) {
      preference = normalize(event.newValue);
      apply();
    }
  });
  function initializePage() {
    controls?.abort();
    controls = new AbortController();
    ready = true;
    commentsObserver.disconnect();
    const comments = document.querySelector('.giscus');
    if (comments) commentsObserver.observe(comments, { childList: true, subtree: true });
    apply();
    const control = document.querySelector('.theme-switcher');
    if (!control) return;
    function selectTheme(event) {
      if (!(event.target instanceof HTMLInputElement)) return;
      const next = normalize(event.target.value);
      if (next === preference) return;
      preference = next;
      apply();
      try { localStorage.setItem(key, preference); } catch { /* Persistence is optional. */ }
    }
    // Clicking the already selected system color also counts as an explicit choice.
    control.addEventListener('click', selectTheme, { signal: controls.signal });
    control.addEventListener('change', selectTheme, { signal: controls.signal });
    control.hidden = false;
  }
  document.addEventListener('DOMContentLoaded', initializePage, { once: true });
  document.addEventListener('astro:before-swap', (event) => {
    controls?.abort();
    commentsObserver.disconnect();
    // Apply the preference before the incoming page can be painted or snapshotted.
    event.newDocument.documentElement.dataset.theme = root.dataset.theme;
  });
  document.addEventListener('astro:after-swap', initializePage);
  document.addEventListener('astro:page-load', initializePage);
})();
