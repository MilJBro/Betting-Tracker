import { Link } from 'react-router-dom';
import BrandMark from './BrandMark.jsx';

// Shared layout for the standalone Terms / Privacy pages (public, no session).
export default function LegalLayout({ title, updated, children }) {
  return (
    <div className="legal-wrap">
      <div className="legal">
        <div className="row spread" style={{ marginBottom: 20 }}>
          <Link to="/" className="brand" style={{ fontSize: 20, textDecoration: 'none', color: 'var(--text)' }}>
            <BrandMark /> Betbooks
          </Link>
          <Link to="/" className="btn-ghost btn-sm">← Back</Link>
        </div>
        <h1 style={{ marginBottom: 4, fontSize: 26 }}>{title}</h1>
        <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>Last updated: {updated}</p>
        <div className="legal-body">{children}</div>
        <div className="legal-foot muted">
          <Link to="/terms">Terms</Link> · <Link to="/privacy">Privacy</Link> ·{' '}
          <a href="https://www.begambleaware.org" target="_blank" rel="noreferrer">Please gamble responsibly</a>
        </div>
      </div>
    </div>
  );
}
