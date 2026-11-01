const resetTimers = new Set<number>();
document.addEventListener('astro:before-swap', () => {
  for (const timer of resetTimers) window.clearTimeout(timer);
  resetTimers.clear();
});

function initializeCodeCopy() {
  for (const pre of document.querySelectorAll<HTMLPreElement>('.prose pre')) {
    if (pre.closest('.code-block')) continue;
    const code = pre.querySelector(':scope > code');
    if (!code) continue;

    const block = document.createElement('div');
    block.className = 'code-block';
    const status = document.createElement('span');
    status.className = 'code-copy-status';
    status.setAttribute('role', 'status');
    status.setAttribute('data-pagefind-ignore', '');
    const feedback = document.createElement('span');
    feedback.className = 'code-copy-feedback';
    feedback.setAttribute('aria-hidden', 'true');
    feedback.setAttribute('data-pagefind-ignore', '');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'code-copy';
    button.setAttribute('aria-label', 'コードをコピー');
    button.setAttribute('title', 'コードをコピー');
    button.setAttribute('data-pagefind-ignore', '');
    button.innerHTML = '<svg class="code-copy-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h4"/></svg><svg class="code-copy-check" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>';
    pre.before(block);
    block.append(pre, button, feedback, status);

    let copying = false;
    let resetTimer: number | undefined;
    function showState(state: 'idle' | 'copying' | 'copied' | 'failed', message: string) {
      button.dataset.state = state;
      status.dataset.state = state;
      status.textContent = message;
      feedback.dataset.state = state;
      feedback.textContent = state === 'failed' ? 'コピーできませんでした' : message;
    }
    button.addEventListener('click', async () => {
      if (copying) return;
      copying = true;
      window.clearTimeout(resetTimer);
      if (resetTimer !== undefined) resetTimers.delete(resetTimer);
      button.setAttribute('aria-busy', 'true');
      showState('copying', 'コピー中…');
      try {
        if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
        await navigator.clipboard.writeText(code.textContent ?? '');
        if (!button.isConnected) return;
        showState('copied', 'コピーしました');
        resetTimer = window.setTimeout(() => {
          showState('idle', '');
          resetTimers.delete(resetTimer!);
        }, 2500);
        resetTimers.add(resetTimer);
      } catch {
        showState('failed', 'コピーできませんでした。コードを選択してコピーしてください。');
      } finally {
        copying = false;
        button.removeAttribute('aria-busy');
      }
    });
  }
}

initializeCodeCopy();
document.addEventListener('astro:after-swap', initializeCodeCopy);
document.addEventListener('astro:page-load', initializeCodeCopy);
