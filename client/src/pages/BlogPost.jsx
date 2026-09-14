import { useParams, Link, Navigate } from 'react-router-dom';
import Logo from '../components/Logo.jsx';
import { getPost } from '../blog/posts.js';
import { useSeo } from '../useSeo.js';

function Block({ block }) {
  if (block.h2) return <h2>{block.h2}</h2>;
  if (block.p) return <p>{block.p}</p>;
  if (block.ul) return <ul>{block.ul.map((li, i) => <li key={i}>{li}</li>)}</ul>;
  return null;
}

export default function BlogPost() {
  const { slug } = useParams();
  const post = getPost(slug);

  useSeo(
    post ? `${post.title} | Betbooks` : 'Betbooks',
    post ? post.description : '',
    post && {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: post.title,
      description: post.description,
      datePublished: post.date,
      author: { '@type': 'Organization', name: 'Betbooks' },
      publisher: { '@type': 'Organization', name: 'Betbooks' },
      mainEntityOfPage: `https://betbooks.co.uk/blog/${post.slug}`,
    }
  );

  if (!post) return <Navigate to="/blog" replace />;

  return (
    <div className="legal-wrap">
      <div className="legal">
        <div className="row spread" style={{ marginBottom: 20 }}>
          <Link to="/" className="brand" style={{ fontSize: 20, textDecoration: 'none', color: 'var(--text)' }}>
            <Logo />
          </Link>
          <Link to="/blog" className="btn-ghost btn-sm">← Guides</Link>
        </div>

        <h1 style={{ marginBottom: 4, fontSize: 28, lineHeight: 1.2 }}>{post.title}</h1>
        <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>{post.read}</p>

        <div className="legal-body blog-body">
          {post.content.map((b, i) => <Block key={i} block={b} />)}
        </div>

        <div className="card blog-cta">
          <strong style={{ display: 'block', marginBottom: 4 }}>Track your bets with Betbooks</strong>
          <p className="muted" style={{ margin: '0 0 12px', fontSize: 14 }}>
            See your profit, ROI, win rate and unit performance automatically — free to start.
          </p>
          <Link to="/" className="btn-primary">Get started free</Link>
        </div>

        <div className="legal-foot muted">
          <Link to="/blog">All guides</Link> · <Link to="/terms">Terms</Link> · <Link to="/privacy">Privacy</Link>
        </div>
      </div>
    </div>
  );
}
