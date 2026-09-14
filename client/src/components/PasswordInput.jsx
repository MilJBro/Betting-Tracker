import { useState } from 'react';
import Icon from './Icon.jsx';

// A password field with a show/hide eye toggle. On focus it scrolls itself into
// view so the on-screen keyboard doesn't cover it (a problem on mobile where the
// field sits low on the page).
export default function PasswordInput({
  value,
  onChange,
  placeholder,
  autoComplete = 'current-password',
  required,
  ariaLabel = 'Password',
}) {
  const [show, setShow] = useState(false);

  function onFocus(e) {
    const el = e.target;
    // Wait for the keyboard to animate in, then centre the field in the viewport.
    setTimeout(() => {
      try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch {}
    }, 300);
  }

  return (
    <div className="pw-wrap">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        aria-label={ariaLabel}
        onFocus={onFocus}
      />
      <button
        type="button"
        className="pw-toggle"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? 'Hide password' : 'Show password'}
        aria-pressed={show}
        tabIndex={-1}
      >
        <Icon name={show ? 'eye-off' : 'eye'} size={18} />
      </button>
    </div>
  );
}
