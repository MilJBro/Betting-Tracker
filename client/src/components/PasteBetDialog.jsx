import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon.jsx';
import { parseBetText } from '../scan.js';

// A lightweight step in front of the Add-bet slip: paste the text a bookmaker
// gives you when you share a bet (e.g. bet365's "share bet" message), and we
// read it into a pre-filled slip for you to confirm. Works for any bookmaker.
export default function PasteBetDialog({ onParsed, onClose, onUpgrade }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const taRef = useRef(null);

  useEffect(() => { taRef.current?.focus(); }, []);

  const pasteFromClipboard = async () => {
    try {
      const t = await navigator.clipboard?.readText();
      if (t) { setText(t); setError(''); }
    } catch {
      setError('Couldn’t read the clipboard — paste into the box instead.');
    }
  };

  const read = async () => {
    const t = text.trim();
    if (!t) { setError('Paste the shared bet text first.'); return; }
    setBusy(true); setError('');
    try {
      const res = await parseBetText(t);
      onParsed(res.bet, res);
    } catch (e) {
      if (e?.data?.upgrade || e?.status === 402) {
        setError(e.message || 'You’ve used all your free reads this month.');
        onUpgrade?.();
      } else {
        setError(e?.message || 'Couldn’t read that bet. Try adding it manually.');
      }
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal" style={{ maxWidth: 460 }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="row spread" style={{ marginBottom: 6 }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>Paste a bet</h2>
          <button className="btn-ghost btn-sm" type="button" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <p className="muted" style={{ margin: '0 0 12px', fontSize: 13.5, lineHeight: 1.5 }}>
          In your bookmaker app, tap <strong>Share</strong> on the bet and copy the text, then paste it here.
          We’ll read the selections and odds and open a slip for you to check. The stake often isn’t shared,
          so you may need to add it.
        </p>

        <textarea
          ref={taRef}
          className="paste-area"
          rows={6}
          value={text}
          onChange={(e) => { setText(e.target.value); if (error) setError(''); }}
          placeholder={'Paste the shared bet here, e.g.\n\nArsenal to win & Over 2.5 Goals\nBet Builder @ 4.10\nbet365'}
        />

        <div className="row" style={{ gap: 8, marginTop: 8 }}>
          <button type="button" className="btn-ghost btn-sm" onClick={pasteFromClipboard}>
            <Icon name="clipboard" size={15} /> Paste from clipboard
          </button>
          {text && <button type="button" className="btn-ghost btn-sm" onClick={() => setText('')}>Clear</button>}
        </div>

        {error && <div className="error-banner" style={{ marginTop: 12 }}>{error}</div>}

        <div className="row spread" style={{ marginTop: 16 }}>
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="btn-primary" onClick={read} disabled={busy || !text.trim()}>
            {busy ? 'Reading…' : 'Read bet'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
