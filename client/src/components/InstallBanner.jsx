import { useEffect, useState } from 'react';
import {
  getInstallPrompt,
  clearInstallPrompt,
  onInstallChange,
  isStandalone,
} from '../pwa.js';
import InstallHowTo from './InstallHowTo.jsx';

const DISMISS_KEY = 'bt_install_dismissed';

// A prominent "Add to Home Screen" banner for the start (dashboard) page. Shown
// to everyone until the app is installed — once it's on the home screen (the
// app runs standalone) it disappears for good. A tap on the X hides it for the
// current session only, so it stays front-of-mind on the next visit.
export default function InstallBanner() {
  const [prompt, setPrompt] = useState(getInstallPrompt());
  const [howto, setHowto] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
  });

  useEffect(() => onInstallChange(() => setPrompt(getInstallPrompt())), []);

  // Already installed → never show it.
  if (isStandalone() || dismissed) return null;

  function dismiss() {
    setDismissed(true);
    try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch {}
  }

  async function handleAdd() {
    if (prompt) {
      prompt.prompt();
      try { await prompt.userChoice; } catch {}
      clearInstallPrompt();
      setPrompt(null);
    } else {
      setHowto(true);
    }
  }

  return (
    <div className="install-banner">
      <img src="/icon-192.png" alt="" width="38" height="38" className="ib-icon" />
      <div className="ib-txt">
        <strong>Add Betbooks to your home screen</strong>
        <span>One-tap access, opens like a real app.</span>
      </div>
      <button type="button" className="ib-add" onClick={handleAdd}>Add</button>
      <button type="button" className="ib-x" onClick={dismiss} aria-label="Dismiss">✕</button>
      {howto && <InstallHowTo onClose={() => setHowto(false)} />}
    </div>
  );
}
