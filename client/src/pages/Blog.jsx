import { Link } from 'react-router-dom';
import Logo from '../components/Logo.jsx';
import { POSTS } from '../blog/posts.js';
import { useSeo } from '../useSeo.js';

// Public guides index — SEO landing hub linking to each article.
export default function Blog() {
  useSeo(
    'Betting guides: tracking, ROI & bankroll | Betbooks',
    'Practical betting guides on tracking your bets, betting ROI and bankroll management — from Betbooks, the customizable betting tracker.'
  );

  return (
    <div className="legal-wrap">
      <div className="legal">
        <div className="row spread" style={{ marginBottom: 20 }}>
          <Link to="/" className="brand" style={{ fontSize: 20, textDecoration: 'none', color: 'var(--text)' }}>
            <Logo />
          </Link>
          <Link to="/" className="btn-ghost btn-sm">← Back</Link>
        </div>
        <h1 style={{ marginBottom: 4, fontSize: 26 }}>Betting guides</h1>
        <p className="muted" style={{ marginTop: 0 }}>
          Straight-talking guides on tracking your bets, working out your ROI, and managing a bankroll.
        </p>

        <div className="blog-list">
          {POSTS.map((p) => (
            <Link key={p.slug} to={`/blog/${p.slug}`} className="blog-card">
              <h2>{p.title}</h2>
              <p className="muted">{p.description}</p>
              <span className="blog-meta">{p.read}</span>
            </Link>
          ))}
        </div>

        <div className="legal-foot muted">
          <Link to="/">Home</Link> · <Link to="/terms">Terms</Link> · <Link to="/privacy">Privacy</Link>
        </div>
      </div>
    </div>
  );
}
