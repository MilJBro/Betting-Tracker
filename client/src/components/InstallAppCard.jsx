import { useEffect, useState } from 'react';
import {
  getInstallPrompt,
  clearInstallPrompt,
  onInstallChange,
  isStandalone,
} from '../pwa.js';
import InstallHowTo from './InstallHowTo.jsx';

// "Add to Home Screen" card (free for everyone). On Android/desktop Chrome it
// triggers the native install prompt; on iOS (which has no install API) it
// shows the Share → Add to Home Screen steps. Once installed, the app opens
// straight to betbooks.co.uk in its own window.
export default function InstallAppCard() {
  const [prompt, setPrompt] = useState(getInstallPrompt());
  const [howto, setHowto] = useState(false);
  const standalone = isStandalone();

  useEffect(() => onInstallChange(() => setPrompt(getInstallPrompt())), []);

  async function handleAdd() {
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
      <div className="row" style={{ gap: 10, alignItems: 'center', marginBottom: 4 }}>
        <img src="/icon-192.png" alt="" width="34" height="34" style={{ borderRadius: 9, display: 'block' }} />
        <h3 className="section-title" style={{ margin: 0 }}>Add to Home Screen</h3>
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

      {howto && <InstallHowTo onClose={() => setHowto(false)} />}
    </div>
  );
}
