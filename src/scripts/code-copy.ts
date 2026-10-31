for (const pre of document.querySelectorAll<HTMLPreElement>('.prose pre')) {
  const code = pre.querySelector(':scope > code');
  if (!code) continue;

  const block = document.createElement('div');
  block.className = 'code-block';
  const toolbar = document.createElement('div');
  toolbar.className = 'code-toolbar';
  toolbar.setAttribute('data-pagefind-ignore', '');
  const status = document.createElement('span');
  status.className = 'code-copy-status';
  status.setAttribute('role', 'status');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'code-copy';
  button.setAttribute('aria-label', 'コードをコピー');
  button.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h4"/></svg><span>コピー</span>';
  toolbar.append(status, button);
  pre.before(block);
  block.append(toolbar, pre);

  let copying = false;
  button.addEventListener('click', async () => {
    if (copying) return;
    copying = true;
    button.setAttribute('aria-busy', 'true');
    status.textContent = 'コピー中…';
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(code.textContent ?? '');
      status.textContent = 'コピーしました';
    } catch {
      status.textContent = 'コピーできませんでした。コードを選択してコピーしてください。';
    } finally {
      copying = false;
      button.removeAttribute('aria-busy');
    }
  });
}
