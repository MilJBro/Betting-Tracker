// The boot splash (#boot in index.html) is a full-screen overlay that sits
// above the app until the first real screen is ready, so startup is one calm
// branded screen instead of a splash → spinner flicker. Pages call
// markAppReady() once their initial content/data is in; a fallback timer in
// main.jsx calls it too so the overlay can never get stuck.
let done = false;

export function markAppReady() {
  if (done) return;
  done = true;
  const el = typeof document !== 'undefined' && document.getElementById('boot');
  if (!el) return;
  // Fade out, then remove so it doesn't intercept taps.
  requestAnimationFrame(() => {
    el.classList.add('boot-hide');
    setTimeout(() => el.remove(), 420);
  });
}
