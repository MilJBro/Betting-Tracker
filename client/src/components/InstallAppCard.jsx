import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  getInstallPrompt,
  clearInstallPrompt,
  onInstallChange,
  isStandalone,
  isIOS,
} from '../pwa.js';

// Pro-gated "Add to Home Screen" card. On Android/desktop Chrome it triggers
// the native install prompt; on iOS (which has no install API) it shows the
// Share → Add to Home Screen steps. Once installed, the app opens straight to
// betbooks.co.uk in its own window.
export default function InstallAppCard({ isPro, onUpgrade }) {
  const [prompt, setPrompt] = useState(getInstallPrompt());
  const [howto, setHowto] = useState(false);
  const standalone = isStandalone();

  useEffect(() => onInstallChange(() => setPrompt(getInstallPrompt())), []);

  async function handleAdd() {
    if (!isPro) { onUpgrade(); return; }
    if (prompt) {
      // Native install prompt (Android / desktop Chrome).
      prompt.prompt();
      try { await prompt.userChoice; } catch {}
      clearInstallPrompt();
      setPrompt(null);
    } else {
      // iOS, or a browser that can't prompt programmatically — show the steps.
      setHowto(true);
    }
  }

  return (
    <div className="card" style={{ marginBottom: 18 }}>
      <div className="row spread" style={{ marginBottom: 4 }}>
        <div className="row" style={{ gap: 10, alignItems: 'center' }}>
          <img src="/icon-192.png" alt="" width="34" height="34" style={{ borderRadius: 9, display: 'block' }} />
          <h3 className="section-title" style={{ margin: 0 }}>Add to Home Screen</h3>
        </div>
        {!isPro && <span className="pro-pill">Pro</span>}
      </div>

      {standalone ? (
        <p className="muted" style={{ marginTop: 8, fontSize: 13 }}>
          You’re using the Betbooks app — it’s already on your home screen.
        </p>
      ) : (
        <>
          <p className="muted" style={{ marginTop: 4, marginBottom: 12, fontSize: 13 }}>
            Add Betbooks to your home screen for one-tap access. It opens straight to the
            app in its own window — no address bar, just like a native app.
          </p>
          <button className="btn-primary" onClick={handleAdd}>Add to Home Screen</button>
        </>
      )}

      {howto && <HowToModal onClose={() => setHowto(false)} />}
    </div>
  );
}

function HowToModal({ onClose }) {
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
