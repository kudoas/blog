import type { TransitionBeforePreparationEvent, TransitionBeforeSwapEvent } from 'astro:transitions/client';

// document.referrer is fixed for the lifetime of a ClientRouter document.
let referrer = document.referrer;
export const pageReferrer = () => referrer;
const sources = new WeakMap<AbortSignal, string>();

document.addEventListener('astro:before-preparation', (event) => {
  const navigation = event as TransitionBeforePreparationEvent;
  // Search filters update the current URL with replaceState outside the router.
  sources.set(navigation.signal, navigation.navigationType === 'traverse' ? navigation.from.href : location.href);
});

document.addEventListener('astro:before-swap', (event) => {
  const navigation = event as TransitionBeforeSwapEvent;
  referrer = sources.get(navigation.signal) ?? navigation.from.href;
});
