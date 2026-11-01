const initialized = new WeakSet<HTMLImageElement>();
function initializeLinkFavicons() {
  for (const icon of document.querySelectorAll<HTMLImageElement>('.prose img.link-favicon')) {
    if (initialized.has(icon)) continue;
    initialized.add(icon);
    const hide = () => { icon.hidden = true; };
    icon.addEventListener('error', hide, { once: true });
    // Failed requests may finish before the module executes.
    if (icon.complete && icon.naturalWidth === 0) hide();
  }
}

initializeLinkFavicons();
document.addEventListener('astro:after-swap', initializeLinkFavicons);
document.addEventListener('astro:page-load', initializeLinkFavicons);
