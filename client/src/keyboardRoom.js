// Keep a focused field above the on-screen keyboard.
//
// iOS (especially the installed home-screen app) won't lift a field above the
// keyboard when it sits near the bottom of the page — there's no page left
// below it to scroll into, so the keyboard just covers it. So while a field is
// focused we:
//   1. add room below the page (once, off-screen, so nothing visibly moves);
//   2. wait for the keyboard to finish opening (visualViewport stops resizing);
//   3. scroll ONCE, and only if the field is actually hidden — if iOS already
//      revealed it we leave it alone, so we never fight the native scroll.
// (An earlier version scrolled on every resize and resized the page each time,
// which made it jitter.)
const ROOM = 'kb-room';
let current = null;
let settleTimer = null;
let closeTimer = null;
let lockUntil = 0;
let bound = false;

const isField = (el) => !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');

function keyboardUp() {
  const vv = window.visualViewport;
  return !!vv && vv.height < window.innerHeight * 0.85;
}

function reveal() {
  const el = current;
  if (!el || document.activeElement !== el || !keyboardUp()) return;
  if (Date.now() < lockUntil) return; // our own smooth scroll is still running
  const vv = window.visualViewport;
  const top = vv.offsetTop;
  const height = vv.height;
  const r = el.getBoundingClientRect();
  const margin = 16;
  if (r.top >= top + margin && r.bottom <= top + height - margin) return; // already visible
  lockUntil = Date.now() + 700;
  window.scrollBy({ top: r.top + r.height / 2 - (top + height * 0.35), behavior: 'smooth' });
}

function onViewportResize() {
  // Act once the keyboard has stopped animating, not on every frame.
  clearTimeout(settleTimer);
  settleTimer = setTimeout(reveal, 150);
}

function onBlur() {
  clearTimeout(closeTimer);
  closeTimer = setTimeout(() => {
    if (isField(document.activeElement)) return; // moved to another field
    current = null;
    document.documentElement.classList.remove(ROOM);
  }, 400);
}

// onFocus handler (works on a single input or bubbled up from a <form>).
export function keyboardFocus(e) {
  const el = e.target;
  if (!isField(el) || typeof window === 'undefined') return;
  current = el;
  clearTimeout(closeTimer);
  document.documentElement.classList.add(ROOM);
  if (!bound && window.visualViewport) {
    window.visualViewport.addEventListener('resize', onViewportResize);
    bound = true;
  }
  el.addEventListener('blur', onBlur, { once: true });
  // Moving between fields with the keyboard already open fires no resize.
  if (keyboardUp()) { clearTimeout(settleTimer); settleTimer = setTimeout(reveal, 250); }
}
