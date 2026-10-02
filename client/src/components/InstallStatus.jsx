import { useEffect, useState } from 'react';
import { getInstallPrompt, clearInstallPrompt, onInstallChange, isStandalone } from '../pwa.js';
import InstallHowTo from './InstallHowTo.jsx';

// A small status chip for the profile header: shows whether Betbooks is on the
// home screen. Running as the installed app = added. In a browser it says not
// added and a tap adds it (the native prompt on Android/desktop Chrome, or the
// Share -> Add to Home Screen steps on iPhone, which has no install API).
// (A browser can't tell if you installed it earlier and are now in a tab, so
// "not added" only means "you're not using it from the home screen right now".)
export default function InstallStatus() {
  const [prompt, setPrompt] = useState(getInstallPrompt());
  const [howto, setHowto] = useState(false);
  const standalone = isStandalone();

  useEffect(() => onInstallChange(() => setPrompt(getInstallPrompt())), []);

  async function add() {
    if (prompt) {
      try {
        await prompt.prompt();
        await prompt.userChoice;
        clearInstallPrompt();
        setPrompt(null);
        return;
      } catch {
        // The browser refused the native prompt (stale or not a real tap), so
        // fall through to the manual steps rather than doing nothing.
        clearInstallPrompt();
        setPrompt(null);
      }
    }
    setHowto(true);
  }

  return (
    <>
      {standalone ? (
        <span className="install-chip on">✓ Added to Home Screen</span>
      ) : (
        <button type="button" className="install-chip off" onClick={add}>
          Not on Home Screen · <strong>Add</strong>
        </button>
      )}
      {howto && <InstallHowTo onClose={() => setHowto(false)} />}
    </>
  );
}
