import { Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import { SettingsProvider } from './context/SettingsContext.jsx';
import Auth from './pages/Auth.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Bets from './pages/Bets.jsx';
import Customise from './pages/Customise.jsx';
import Account from './pages/Account.jsx';
import Share from './pages/Share.jsx';
import ResetPassword from './pages/ResetPassword.jsx';

const NAV = [
  { to: '/', end: true, icon: '📊', label: 'Dashboard' },
  { to: '/bets', icon: '🎯', label: 'My bets' },
  { to: '/customise', icon: '🎨', label: 'Customise' },
  { to: '/account', icon: '👤', label: 'Account' },
];

function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const link = ({ isActive }) => 'nav-link' + (isActive ? ' active' : '');
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-dot">₿</span> Tracker
      </div>
      {NAV.map((n) => (
        <NavLink key={n.to} to={n.to} end={n.end} className={link}>
          {n.icon} {n.label}
        </NavLink>
      ))}
      <div className="nav-spacer" />
      <div className="nav-link" style={{ cursor: 'default', fontSize: 13 }}>{user?.username}</div>
      <div className="nav-link" onClick={() => { logout(); navigate('/'); }}>↪ Log out</div>
    </aside>
  );
}

function BottomNav() {
  const bnav = ({ isActive }) => 'bnav' + (isActive ? ' active' : '');
  return (
    <nav className="bottom-nav">
      {NAV.map((n) => (
        <NavLink key={n.to} to={n.to} end={n.end} className={bnav}>
          <span className="ic">{n.icon}</span>
          {n.label}
        </NavLink>
      ))}
    </nav>
  );
}

function AppShell() {
  const navigate = useNavigate();
  return (
    <SettingsProvider>
      <div className="app-shell">
        <Sidebar />
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/bets" element={<Bets />} />
          <Route path="/customise" element={<Customise />} />
          <Route path="/account" element={<Account />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      {/* Mobile-only: floating add + bottom tab bar */}
      <button className="fab" aria-label="Add bet" onClick={() => navigate('/bets?new=1')}>+</button>
      <BottomNav />
    </SettingsProvider>
  );
}

export default function App() {
  const { user, loading } = useAuth();

  return (
    <Routes>
      {/* Public routes — accessible without a session. */}
      <Route path="/share/:publicId" element={<Share />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route
        path="*"
        element={
          loading ? (
            <div className="auth-wrap"><div className="spinner" /></div>
          ) : user ? (
            <AppShell />
          ) : (
            <Auth />
          )
        }
      />
    </Routes>
  );
}
