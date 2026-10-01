// Keep a focused form field visible above the on-screen keyboard.
//
// iOS doesn't shrink the layout viewport when the keyboard opens, so
// scrollIntoView({ block: 'center' }) centres the field in the area *behind*
// the keyboard. Instead, wait for the keyboard (visualViewport resize), then
// scroll the window so the field sits in the upper part of the visible area.
// Fields near the bottom of a page can't scroll that far, so while a field is
// focused we pad the bottom of the page by the keyboard's height to make room.
let active = null;   // { el, cleanup }
let origPad = '';    // body padding before any field took focus

export function keepInView(el) {
  if (!el || active?.el === el || typeof window === 'undefined') return;
  const body = document.body;
  // Moving straight from one field to another: hand over without dropping the
  // padding, so the page doesn't jump between fields.
  if (active) active.cleanup(false);
  else origPad = body.style.paddingBottom;

  const vv = window.visualViewport;
  const timers = [];

  const place = () => {
    if (document.activeElement !== el) return;
    const viewH = vv ? vv.height : window.innerHeight;
    const keyboard = Math.max(0, window.innerHeight - viewH);
    body.style.paddingBottom = keyboard ? `${keyboard}px` : origPad;
    const r = el.getBoundingClientRect();
    const top = r.top - (vv ? vv.offsetTop : 0); // position within the visible area
    const delta = top + r.height / 2 - viewH * 0.35;
    if (Math.abs(delta) > 12) window.scrollBy({ top: delta, behavior: 'smooth' });
  };

  const onBlur = () => {
    // Deferred: if focus moves to another field, that field takes over first.
    setTimeout(() => { if (active?.el === el) cleanup(true); }, 150);
  };
  const cleanup = (restore) => {
    timers.forEach(clearTimeout);
    vv?.removeEventListener('resize', place);
    el.removeEventListener('blur', onBlur);
    if (restore) body.style.paddingBottom = origPad;
    if (active?.el === el) active = null;
  };

  vv?.addEventListener('resize', place);
  el.addEventListener('blur', onBlur);
  // Keyboard animation timing varies; re-check as it settles.
  timers.push(setTimeout(place, 60), setTimeout(place, 350), setTimeout(place, 700));
  active = { el, cleanup };
}

// onFocus handler for a form: keeps whichever text field gets focus in view.
export function keepFocusedFieldInView(e) {
  const t = e.target;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) keepInView(t);
}
