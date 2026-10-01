import { useState } from 'react';
import Icon from './Icon.jsx';
import { keepInView } from '../keepInView.js';

// A password field with a show/hide eye toggle. On focus it keeps itself
// visible above the on-screen keyboard.
export default function PasswordInput({
  value,
  onChange,
  placeholder,
  autoComplete = 'current-password',
  required,
  ariaLabel = 'Password',
}) {
  const [show, setShow] = useState(false);

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
        onFocus={(e) => keepInView(e.target)}
      />
      <button
        type="button"
        className="pw-toggle"
        // Keep focus in the field: otherwise tapping the eye blurs it, the
        // keyboard drops, the layout jumps mid-tap and the tap often misses.
        onMouseDown={(e) => e.preventDefault()}
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
