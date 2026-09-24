import { createPortal } from 'react-dom';
import { isIOS } from '../pwa.js';

// Shared "how to add to home screen" steps, shown on iOS (no install API) or
// any browser that can't trigger the native prompt programmatically.
export default function InstallHowTo({ onClose }) {
  const ios = isIOS();
  return createPortal(
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div className="row spread" style={{ marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>Add to Home Screen</h2>
          <button className="btn-ghost btn-sm" type="button" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {ios ? (
          <ol className="howto-list">
            <li>Tap the <strong>Share</strong> button at the bottom of Safari (the square with an arrow pointing up).</li>
            <li>Scroll down and tap <strong>Add to Home Screen</strong>.</li>
            <li>Tap <strong>Add</strong> in the top corner. Betbooks now sits on your home screen.</li>
          </ol>
        ) : (
          <ol className="howto-list">
            <li>Open your browser’s menu (the <strong>⋮</strong> or <strong>⋯</strong> button).</li>
            <li>Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.</li>
            <li>Confirm — Betbooks is added and opens in its own window.</li>
          </ol>
        )}
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
          <button type="button" className="btn-primary" onClick={onClose}>Got it</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
