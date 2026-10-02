import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import Icon from '../components/Icon.jsx';
import Spinner from '../components/Spinner.jsx';

const RANGES = [
  { key: 7, label: '7 days' },
  { key: 30, label: '30 days' },
  { key: 90, label: '90 days' },
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
const fmtDay = (d) => {
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

function Kpi({ icon, label, value, sub, live }) {
  return (
    <div className="kpi">
      <span className="k">{live && <span className="live-dot" />}<Icon name={icon} size={13} /> {label}</span>
      <span className="v">{value}</span>
      {sub && <span className="s">{sub}</span>}
    </div>
  );
}

export default function AdminStats() {
  const { user } = useAuth();
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const daysRef = useRef(days);
  daysRef.current = days;

  const load = useCallback((d) => {
    return api.get('/admin/stats?days=' + d)
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
        Live app usage · updates automatically
      </p>

      {/* Live + today */}
      <div className="kpi-grid">
        <Kpi icon="pulse" label="Online now" value={d.liveNow ?? 0} sub="active in last 3 min" live />
        <Kpi icon="account" label="Visitors today" value={d.today?.visitors ?? 0} />
        <Kpi icon="eye" label="Views today" value={d.today?.views ?? 0} />
        <Kpi icon="trend" label="Signups today" value={d.today?.signups ?? 0} />
      </div>

      {/* Range figures */}
      <div className="kpi-grid">
        <Kpi icon="account" label={`Visitors · ${days}d`} value={d.range?.visitors ?? 0} sub={`${d.range?.signups ?? 0} new signups`} />
        <Kpi icon="eye" label={`Page views · ${days}d`} value={d.range?.views ?? 0} />
        <Kpi icon="clock" label="Avg. time on app" value={fmtDuration(d.range?.avgSessionSec)} sub="per visit" />
        <Kpi icon="coins" label="Total users" value={d.totals?.users ?? 0} sub={`${d.totals?.pro ?? 0} on Pro`} />
      </div>

      {/* Who's using it, and are they sticking? */}
      <div className="kpi-grid">
        <Kpi icon="account" label="Active today" value={d.engagement?.dau ?? 0} sub="signed-in users" />
        <Kpi icon="account" label="Active · 7 days" value={d.engagement?.wau ?? 0} sub={`${d.engagement?.mau ?? 0} in 30 days`} />
        <Kpi icon="trend" label="Came back" value={`${d.engagement?.retention7 ?? 0}%`} sub={`of ${d.engagement?.retentionBase ?? 0} signed up 7+ days ago, active this week`} />
        <Kpi icon="coins" label="Pro conversion" value={`${pctOf(d.totals?.pro, d.totals?.users)}%`} sub={`${d.totals?.pro ?? 0} of ${d.totals?.users ?? 0} users`} />
      </div>
      <div className="kpi-grid">
        <Kpi icon="bets" label="Bets logged today" value={d.engagement?.betsToday ?? 0} sub={`${d.engagement?.betsRange ?? 0} in ${days}d`} />
        <Kpi icon="bets" label="Bets logged · all time" value={d.engagement?.betsTotal ?? 0} />
        <Kpi icon="eye" label="AI scans this month" value={d.engagement?.scansThisMonth ?? 0} />
        <Kpi icon="globe" label="Public records shared" value={d.engagement?.shares ?? 0} />
      </div>

      {/* Signup funnel */}
      <div className="card perf-card">
        <div className="perf-card-head static">
          <span className="pch-title"><Icon name="trend" size={18} /> Signup funnel</span>
        </div>
        {[
          { label: `Landing page visitors · ${days}d`, n: d.engagement?.landingVisitors ?? 0 },
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

      <p className="muted" style={{ fontSize: 12, textAlign: 'center', margin: '4px 0 8px' }}>
        Private to you · first-party analytics · no third parties
      </p>
    </div>
  );
}
