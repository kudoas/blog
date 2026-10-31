for (const icon of document.querySelectorAll<HTMLImageElement>('.prose img.link-favicon')) {
  const hide = () => { icon.hidden = true; };
  icon.addEventListener('error', hide, { once: true });
  // Failed requests may finish before the module executes.
  if (icon.complete && icon.naturalWidth === 0) hide();
}
