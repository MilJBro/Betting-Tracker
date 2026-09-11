import { useEffect, useRef, useState } from 'react';

// A text input with a suggestions dropdown. On focus it shows the saved
// options (acting like a dropdown); as you type it filters them (match
// anywhere, case-insensitive). Click, tap or arrow-key + Enter to pick one.
export default function AutocompleteInput({
  value,
  onChange,
  options = [],
  ariaLabel,
  placeholder,
  className,
  max = 8,
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const wrapRef = useRef(null);

  const q = (value || '').trim().toLowerCase();
  const matches = options
    .filter((o) => {
      const lo = o.toLowerCase();
      if (!q) return true; // show everything on focus → dropdown behaviour
      return lo.includes(q) && lo !== q; // hide the exact match (nothing to add)
    })
    .slice(0, max);

  // Close when clicking/tapping outside the field.
  useEffect(() => {
    function onDoc(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const pick = (v) => { onChange(v); setOpen(false); setActive(-1); };

  return (
    <div className={`ac ${className || ''}`} ref={wrapRef}>
      <input
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setActive(-1); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (!open) { setOpen(true); return; }
            setActive((a) => Math.min(a + 1, matches.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === 'Enter' && open && active >= 0 && matches[active]) {
            e.preventDefault();
            pick(matches[active]);
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
        aria-label={ariaLabel}
        placeholder={placeholder}
        autoComplete="off"
      />
      {open && matches.length > 0 && (
        <ul className="ac-menu" role="listbox">
          {matches.map((o, i) => (
            <li
              key={o}
              role="option"
              aria-selected={i === active}
              className={i === active ? 'ac-item on' : 'ac-item'}
              onMouseDown={(e) => { e.preventDefault(); pick(o); }}
              onMouseEnter={() => setActive(i)}
            >
              {o}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
