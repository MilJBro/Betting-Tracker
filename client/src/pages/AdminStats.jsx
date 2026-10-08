import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import Icon from '../components/Icon.jsx';
import Spinner from '../components/Spinner.jsx';

const RANGES = [
  { key: 'today', label: 'Today' },
  { key: 7, label: '7d' },
  { key: 30, label: '30d' },
  { key: 90, label: '90d' },
];

// Friendly labels for the app's routes so the pages list reads plainly.
const PAGE_LABELS = {
  '/': 'Dashboard',
  '/bets': 'My bets',
  '/analytics': 'Analytics',
  '/customise': 'Customise',
  '/pricing': 'Plans / pricing',
  '/account': 'Account',
  '/admin': 'Insights (admin)',
  '/share/:id': 'Shared record',
  '/blog': 'Guides',
  '/blog/:slug': 'Guide article',
  '/reset-password': 'Password reset',
  '/terms': 'Terms',
  '/privacy': 'Privacy',
};
const pageLabel = (p) => PAGE_LABELS[p] || p;

function fmtDuration(sec) {
  if (!sec || sec < 1) return '0s';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}m`;
  if (m) return `${m}m ${s}s`;
  return `${s}s`;
}
// 2-letter ISO country code → full name (e.g. "GB" → "United Kingdom").
const REGION_NAMES = (() => {
  try { return new Intl.DisplayNames(['en'], { type: 'region' }); } catch { return null; }
})();
const countryName = (code) => {
  if (!code) return 'Unknown';
  try { return (REGION_NAMES && REGION_NAMES.of(code)) || code; } catch { return code; }
};
const pctOf = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);
// "Today" is measured in YOUR time zone, so tell the server the offset.
const tzQuery = () => `&tz=${new Date().getTimezoneOffset()}`;
const rangeWord = (days) => (days === 'today' ? 'today' : `${days}d`);
const fmtDay = (d) => {
  if (/^\d{2}$/.test(d)) return `${d}:00`; // an hour of today
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

// A tile. With `onOpen` it's a button that opens that metric's deep dive.
function Kpi({ icon, label, value, sub, live, onOpen }) {
  const body = (
    <>
      <span className="k">{live && <span className="live-dot" />}<Icon name={icon} size={13} /> {label}{onOpen && <Icon name="chevron" size={13} className="kpi-go" />}</span>
      <span className="v">{value}</span>
      {sub && <span className="s">{sub}</span>}
    </>
  );
  return onOpen
    ? <button type="button" className="kpi tap" onClick={onOpen}>{body}</button>
    : <div className="kpi">{body}</div>;
}

// The deep-dive sheet: summary figures, a daily chart, then ranked lists. The
// server returns every metric in the same shape (see routes/admin.js DETAILS).
function DetailSheet({ metric, days, onClose }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    let off = false;
    setD(null); setErr('');
    api.get(`/admin/detail?metric=${metric}&days=${days}${tzQuery()}`)
      .then((x) => { if (!off) setD(x); })
      .catch((e) => { if (!off) setErr(e.message || 'Could not load this'); });
    return () => { off = true; };
  }, [metric, days]);
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);

  const data = d?.series?.data || [];
  return createPortal(
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal detail-sheet" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-label={d?.title || 'Details'}>
        <div className="row spread" style={{ marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>{d?.title || 'Loading…'}</h2>
          <button type="button" className="btn-ghost btn-sm" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {err && <div className="error-banner">{err}</div>}
        {!d && !err && <Spinner />}
        {d && (
          <>
            <div className="ds-summary">
              {d.summary.map((x) => (
                <div key={x.label}><span className="k">{x.label}</span><span className="v">{x.value}</span></div>
              ))}
            </div>
            {data.length >= 2 && (
              <div className="ds-chart">
                <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>{d.series.label}</div>
                <ResponsiveContainer width="100%" height={150}>
                  <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="d" tickFormatter={fmtDay} tick={{ fill: 'var(--muted)', fontSize: 10 }} minTickGap={22} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fill: 'var(--muted)', fontSize: 10 }} axisLine={false} tickLine={false} width={34} />
                    <Tooltip
                      cursor={{ fill: 'var(--border)', opacity: 0.4 }}
                      contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 12 }}
                      labelFormatter={fmtDay}
                      formatter={(v) => [v + (d.series.unit || ''), d.series.label]}
                    />
                    <Bar dataKey="v" fill="var(--primary)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            {d.lists.map((l) => {
              const nums = l.rows.map((r) => (typeof r.value === 'number' ? r.value : null));
              const max = Math.max(1, ...nums.filter((n) => n != null));
              return (
                <div key={l.title} className="ds-list">
                  <div className="set-subhead" style={{ marginTop: 14 }}>{l.title}</div>
                  {l.rows.length === 0 && <p className="muted" style={{ fontSize: 13, margin: '6px 0' }}>Nothing yet.</p>}
                  {l.rows.map((r, i) => (
                    <div key={i} className="ds-row">
                      <div className="ds-main">
                        <span className="p">{l.page ? pageLabel(r.label) : (/^[A-Z]{2}$/.test(r.label) ? countryName(r.label) : r.label)}</span>
                        {r.sub && <span className="s">{r.sub}</span>}
                      </div>
                      {nums[i] != null && <span className="tp-bar"><i style={{ width: `${Math.max(4, (nums[i] / max) * 100)}%` }} /></span>}
                      <span className="tp-n">{r.value}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>,
    document.body
  );
}

export default function AdminStats() {
  const { user } = useAuth();
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [open, setOpen] = useState(null); // metric key of the open deep dive
  const daysRef = useRef(days);
  daysRef.current = days;

  const load = useCallback((d) => {
    return api.get('/admin/stats?days=' + d + tzQuery())
      .then((res) => { setData(res); setErr(''); })
      .catch((e) => setErr(e.message || 'Could not load stats'));
  }, []);

  // Initial load + reload on range change.
  useEffect(() => {
    setLoading(true);
    load(days).finally(() => setLoading(false));
  }, [days, load]);

  // Poll every 15s for a live feel (uses the currently-selected range).
  useEffect(() => {
    const iv = setInterval(() => load(daysRef.current), 15000);
    return () => clearInterval(iv);
  }, [load]);

  // Only the owner(s) get here. Non-admins are bounced home.
  if (user && !user.isAdmin) return <Navigate to="/" replace />;

  if (loading && !data) return <div className="main"><Spinner /></div>;

  if (err && !data) {
    return (
      <div className="main">
        <h1>Insights</h1>
        <div className="error-banner">{err}</div>
      </div>
    );
  }

  const d = data || {};
  const series = d.series || [];
  const maxPage = Math.max(1, ...(d.topPages || []).map((p) => p.views));
  const maxCountry = Math.max(1, ...(d.topCountries || []).map((c) => c.visitors));

  return (
    <div className="main">
      <div className="perf-head">
        <h1>Insights</h1>
        <div className="seg-mini">
          {RANGES.map((r) => (
            <button key={r.key} type="button" className={days === r.key ? 'on' : ''} onClick={() => setDays(r.key)}>
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <p className="muted" style={{ fontSize: 13, margin: '-4px 2px 16px' }}>
        Live app usage · updates automatically · tap any tile for the detail
      </p>

      {/* Live + today */}
      <div className="kpi-grid">
        <Kpi icon="pulse" label="Online now" value={d.liveNow ?? 0} sub="active in last 3 min" live onOpen={() => setOpen('live')} />
        <Kpi icon="account" label="Visitors today" value={d.today?.visitors ?? 0} onOpen={() => setOpen('visitors')} />
        <Kpi icon="eye" label="Views today" value={d.today?.views ?? 0} onOpen={() => setOpen('views')} />
        <Kpi icon="trend" label="Signups today" value={d.today?.signups ?? 0} onOpen={() => setOpen('signups')} />
      </div>

      {/* Range figures */}
      <div className="kpi-grid">
        <Kpi icon="account" label={`Visitors · ${rangeWord(days)}`} value={d.range?.visitors ?? 0} sub={`${d.range?.signups ?? 0} new signups`} onOpen={() => setOpen('visitors')} />
        <Kpi icon="eye" label={`Page views · ${rangeWord(days)}`} value={d.range?.views ?? 0} onOpen={() => setOpen('views')} />
        <Kpi icon="clock" label="Avg. time on app" value={fmtDuration(d.range?.avgSessionSec)} sub="per visit" onOpen={() => setOpen('session')} />
        <Kpi icon="coins" label="Total users" value={d.totals?.users ?? 0} sub={`${d.totals?.pro ?? 0} on Pro`} onOpen={() => setOpen('signups')} />
      </div>

      {/* Who's using it, and are they sticking? */}
      <div className="kpi-grid">
        <Kpi icon="account" label="Active today" value={d.engagement?.dau ?? 0} sub="signed-in users" onOpen={() => setOpen('active')} />
        <Kpi icon="account" label="Active · 7 days" value={d.engagement?.wau ?? 0} sub={`${d.engagement?.mau ?? 0} in 30 days`} onOpen={() => setOpen('active')} />
        <Kpi icon="trend" label="Came back" value={`${d.engagement?.retention7 ?? 0}%`} sub={`of ${d.engagement?.retentionBase ?? 0} signed up 7+ days ago, active this week`} onOpen={() => setOpen('retention')} />
        <Kpi icon="coins" label="Pro conversion" value={`${pctOf(d.totals?.pro, d.totals?.users)}%`} sub={`${d.totals?.pro ?? 0} of ${d.totals?.users ?? 0} users`} onOpen={() => setOpen('pro')} />
      </div>
      <div className="kpi-grid">
        <Kpi icon="bets" label="Bets logged today" value={d.engagement?.betsToday ?? 0} sub={days === 'today' ? undefined : `${d.engagement?.betsRange ?? 0} in ${days}d`} onOpen={() => setOpen('bets')} />
        <Kpi icon="bets" label="Bets logged · all time" value={d.engagement?.betsTotal ?? 0} onOpen={() => setOpen('bets')} />
        <Kpi icon="eye" label="AI scans this month" value={d.engagement?.scansThisMonth ?? 0} onOpen={() => setOpen('scans')} />
        <Kpi icon="globe" label="Public records shared" value={d.engagement?.shares ?? 0} onOpen={() => setOpen('shares')} />
      </div>

      {/* Signup funnel */}
      <div className="card perf-card">
        <div className="perf-card-head static">
          <span className="pch-title"><Icon name="trend" size={18} /> Signup funnel</span>
        </div>
        {[
          { label: `Landing page visitors · ${rangeWord(days)}`, n: d.engagement?.landingVisitors ?? 0 },
          { label: 'Accounts created (all time)', n: d.totals?.users ?? 0 },
          { label: 'Logged at least 1 bet', n: d.engagement?.withBet ?? 0, of: d.totals?.users },
          { label: 'Logged 5+ bets', n: d.engagement?.withFive ?? 0, of: d.totals?.users },
          { label: 'Logged 10+ bets', n: d.engagement?.withTen ?? 0, of: d.totals?.users },
          { label: 'On Pro', n: d.totals?.pro ?? 0, of: d.totals?.users },
        ].map((r) => (
          <div key={r.label} className="tp-row">
            <span className="p">{r.label}</span>
            <span className="tp-n">{r.n}{r.of > 0 ? ` · ${pctOf(r.n, r.of)}%` : ''}</span>
          </div>
        ))}
        <p className="muted" style={{ fontSize: 12, margin: '8px 2px 0' }}>Percentages are of all accounts.</p>
      </div>

      {/* Trend chart */}
      <div className="card perf-card">
        <div className="perf-card-head static">
          <span className="pch-title"><Icon name="analytics" size={18} /> Visitors &amp; views</span>
        </div>
        {series.length >= 2 ? (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={series} margin={{ top: 8, right: 6, bottom: 0, left: -14 }}>
              <defs>
                <linearGradient id="visFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="viewFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#64748b" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="#64748b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="d" tickFormatter={fmtDay} tick={{ fill: 'var(--muted)', fontSize: 11 }} minTickGap={24} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={34} />
              <Tooltip
                contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 12 }}
                labelFormatter={fmtDay}
                formatter={(v, name) => [v, name === 'views' ? 'Views' : 'Visitors']}
              />
              <Area type="monotone" dataKey="views" stroke="#94a3b8" strokeWidth={1.6} fill="url(#viewFill)" />
              <Area type="monotone" dataKey="visitors" stroke="var(--primary)" strokeWidth={2.4} fill="url(#visFill)" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <p className="muted" style={{ fontSize: 13, padding: '8px 2px' }}>
            Not enough data yet — visitor trends appear here as the app is used.
          </p>
        )}
      </div>

      {/* Live now — what people are viewing */}
      {(d.livePages?.length > 0) && (
        <div className="card perf-card">
          <div className="perf-card-head static">
            <span className="pch-title"><span className="live-dot" /> On the app right now</span>
          </div>
          {d.livePages.map((p) => (
            <div key={p.path} className="tp-row">
              <span className="p">{pageLabel(p.path)}</span>
              <span className="tp-n">{p.n} {p.n === 1 ? 'person' : 'people'}</span>
            </div>
          ))}
        </div>
      )}

      {/* Most visited pages */}
      <div className="card perf-card">
        <div className="perf-card-head static">
          <span className="pch-title"><Icon name="bets" size={18} /> Most visited pages</span>
        </div>
        {(d.topPages?.length > 0) ? d.topPages.map((p) => (
          <div key={p.path} className="tp-row">
            <span className="p" title={p.path}>{pageLabel(p.path)}</span>
            <span className="tp-bar"><i style={{ width: `${Math.max(4, (p.views / maxPage) * 100)}%` }} /></span>
            <span className="tp-n">{p.views}</span>
          </div>
        )) : (
          <p className="muted" style={{ fontSize: 13, padding: '8px 2px' }}>No page views recorded yet.</p>
        )}
      </div>

      {/* Where visitors are from */}
      <div className="card perf-card">
        <div className="perf-card-head static">
          <span className="pch-title"><Icon name="globe" size={18} /> Top countries</span>
        </div>
        {(d.topCountries?.length > 0) ? d.topCountries.map((c) => (
          <div key={c.country} className="tp-row">
            <span className="p">{countryName(c.country)}</span>
            <span className="tp-bar"><i style={{ width: `${Math.max(4, (c.visitors / maxCountry) * 100)}%` }} /></span>
            <span className="tp-n">{c.visitors}</span>
          </div>
        )) : (
          <p className="muted" style={{ fontSize: 13, padding: '8px 2px' }}>No country data yet.</p>
        )}
      </div>

      {open && <DetailSheet metric={open} days={days} onClose={() => setOpen(null)} />}

      <p className="muted" style={{ fontSize: 12, textAlign: 'center', margin: '4px 0 8px' }}>
        Private to you · first-party analytics · no third parties
      </p>
    </div>
  );
}
