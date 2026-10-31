(() => {
  const key = 'blog-theme';
  const root = document.documentElement;
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  const normalize = (value) => value === 'light' || value === 'dark' ? value : 'system';
  let preference = 'system';
  let ready = false;
  try { preference = normalize(localStorage.getItem(key)); } catch { /* Storage is optional. */ }

  function apply() {
    root.dataset.theme = preference === 'system' ? (system.matches ? 'dark' : 'light') : preference;
    if (!ready) return;
    const select = document.querySelector('#theme-preference');
    if (select) select.value = preference;
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
  document.addEventListener('DOMContentLoaded', () => {
    ready = true;
    apply();
    const control = document.querySelector('.theme-switcher');
    const select = document.querySelector('#theme-preference');
    if (!control || !select) return;
    select.addEventListener('change', () => {
      preference = normalize(select.value);
      apply();
      try {
        if (preference === 'system') localStorage.removeItem(key);
        else localStorage.setItem(key, preference);
      } catch { /* Keep the current selection even when persistence is unavailable. */ }
    });
    control.hidden = false;
  }, { once: true });
})();
