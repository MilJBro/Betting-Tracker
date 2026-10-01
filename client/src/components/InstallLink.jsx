import { useEffect, useState } from 'react';
import {
  getInstallPrompt,
  clearInstallPrompt,
  onInstallChange,
  isStandalone,
  isIOS,
  isAndroid,
} from '../pwa.js';
import InstallHowTo from './InstallHowTo.jsx';

// A small text link for the landing page: "Add Betbooks to your Home Screen".
// Android Chrome gets the native install prompt when the browser offers one;
// otherwise (and on iPhone) it opens the step-by-step pop-up. Phones only, and
// hidden once the app is already installed.
export default function InstallLink() {
  const [prompt, setPrompt] = useState(getInstallPrompt());
  const [howto, setHowto] = useState(false);

  useEffect(() => onInstallChange(() => setPrompt(getInstallPrompt())), []);

  if (isStandalone() || !(isIOS() || isAndroid())) return null;

  async function go() {
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
    <>
      <p className="lp-install">
        <button type="button" onClick={go}>Add Betbooks to your Home Screen</button>
      </p>
      {howto && <InstallHowTo onClose={() => setHowto(false)} />}
    </>
  );
}
