import { Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import { SettingsProvider, useSettings } from './context/SettingsContext.jsx';
import { TrackerProvider } from './context/TrackerContext.jsx';
import TrackerBar from './components/TrackerBar.jsx';
import Icon from './components/Icon.jsx';
import Login from './pages/Login.jsx';
import Onboarding from './pages/Onboarding.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Bets from './pages/Bets.jsx';
import Analytics from './pages/Analytics.jsx';
import Customise from './pages/Customise.jsx';
import Account from './pages/Account.jsx';
import Share from './pages/Share.jsx';
import ResetPassword from './pages/ResetPassword.jsx';

const NAV = [
  { to: '/', end: true, icon: 'dashboard', label: 'Dashboard', short: 'Home' },
  { to: '/bets', icon: 'bets', label: 'My bets', short: 'Bets' },
  { to: '/analytics', icon: 'analytics', label: 'Analytics', short: 'Stats' },
  { to: '/customise', icon: 'sliders', label: 'Customise', short: 'Style' },
  { to: '/account', icon: 'account', label: 'Account', short: 'You' },
];

function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const link = ({ isActive }) => 'nav-link' + (isActive ? ' active' : '');
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-dot">₿</span> Betfolio
      </div>
      {NAV.map((n) => (
        <NavLink key={n.to} to={n.to} end={n.end} className={link}>
          <Icon name={n.icon} size={18} /> {n.label}
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
          <Icon name={n.icon} size={22} />
          {n.short || n.label}
        </NavLink>
      ))}
    </nav>
  );
}

function ShellInner() {
  const navigate = useNavigate();
  const { settings } = useSettings();

  // Wait for settings, then send brand-new accounts through the questionnaire.
  if (!settings) return <div className="auth-wrap"><div className="spinner" /></div>;
  if (settings.profile && !settings.profile.onboarded) return <Onboarding />;

  return (
    <TrackerProvider>
      <div className="app-shell">
        <Sidebar />
        <div className="content-col">
          <TrackerBar />
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/bets" element={<Bets />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/customise" element={<Customise />} />
            <Route path="/account" element={<Account />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
      {/* Mobile-only: floating add + bottom tab bar */}
      <button className="fab" aria-label="Add bet" onClick={() => navigate('/bets?new=1')}>+</button>
      <BottomNav />
    </TrackerProvider>
  );
}

function AppShell() {
  return (
    <SettingsProvider>
      <ShellInner />
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
            <Login />
          )
        }
      />
    </Routes>
  );
}
