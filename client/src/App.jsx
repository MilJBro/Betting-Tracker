import { useEffect } from 'react';
import { Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom';
import Logo from './components/Logo.jsx';
import { useAuth } from './context/AuthContext.jsx';
import { SettingsProvider, useSettings } from './context/SettingsContext.jsx';
import { TrackerProvider } from './context/TrackerContext.jsx';
import { AddBetProvider, useAddBet } from './context/AddBetContext.jsx';
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
import Terms from './pages/Terms.jsx';
import Privacy from './pages/Privacy.jsx';
import Blog from './pages/Blog.jsx';
import BlogPost from './pages/BlogPost.jsx';

const NAV = [
  { to: '/', end: true, icon: 'house', label: 'Dashboard', short: 'Home' },
  { to: '/bets', icon: 'bets', label: 'My bets', short: 'Bets' },
  { to: '/analytics', icon: 'analytics', label: 'Analytics', short: 'Stats' },
  { to: '/customise', icon: 'sliders', label: 'Customise', short: 'Style' },
  { to: '/account', icon: 'account', label: 'Account', short: 'You' },
];

// The mobile bottom bar: Home · Bets · [+ add] · Stats · You. Customise
// (Style) lives inside the You/Account page there to keep the bar to five.
const BOTTOM_NAV = [
  { to: '/', end: true, icon: 'house', short: 'Home' },
  { to: '/bets', icon: 'bets', short: 'Bets' },
  { to: '/analytics', icon: 'analytics', short: 'Stats' },
  { to: '/account', icon: 'account', short: 'You' },
];

function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const link = ({ isActive }) => 'nav-link' + (isActive ? ' active' : '');
  return (
    <aside className="sidebar">
      <div className="brand">
        <Logo />
      </div>
      {NAV.map((n) => (
        <NavLink key={n.to} to={n.to} end={n.end} className={link}>
          <Icon name={n.icon} size={18} /> {n.label}
        </NavLink>
      ))}
      <div className="nav-spacer" />
      <div className="nav-link" style={{ cursor: 'default', fontSize: 13 }}>{user?.username}</div>
      <div className="nav-link" onClick={() => { logout(); navigate('/'); }}>Log out</div>
    </aside>
  );
}

function BottomNav() {
  const { openAddBet } = useAddBet();
  const bnav = ({ isActive }) => 'bnav' + (isActive ? ' active' : '');
  const left = BOTTOM_NAV.slice(0, 2);
  const right = BOTTOM_NAV.slice(2);
  // Open the Add-bet slip over the current tab — no navigating to My bets.
  const addBet = () => openAddBet();
  return (
    <nav className="bottom-nav">
      {left.map((n) => (
        <NavLink key={n.to} to={n.to} end={n.end} className={bnav}>
          <Icon name={n.icon} size={22} />
          {n.short}
        </NavLink>
      ))}
      <button type="button" className="bnav-add" aria-label="Add bet" onClick={addBet}>
        <span>+</span>
      </button>
      {right.map((n) => (
        <NavLink key={n.to} to={n.to} end={n.end} className={bnav}>
          <Icon name={n.icon} size={22} />
          {n.short}
        </NavLink>
      ))}
    </nav>
  );
}

function ShellInner() {
  const { settings } = useSettings();
  const showApp = !!settings && !(settings.profile && !settings.profile.onboarded);

  // Lock the document to the viewport only while the app shell is on screen, so
  // just the content area scrolls (kills the small iOS toolbar scroll/snap).
  // Public/long pages (login, onboarding, landing, legal) keep normal scrolling.
  useEffect(() => {
    if (!showApp) return;
    document.body.classList.add('app-view');
    return () => document.body.classList.remove('app-view');
  }, [showApp]);

  // Wait for settings, then send brand-new accounts through the questionnaire.
  if (!settings) return <div className="auth-wrap"><div className="spinner" /></div>;
  if (settings.profile && !settings.profile.onboarded) return <Onboarding />;

  return (
    <TrackerProvider>
      <AddBetProvider>
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
        {/* Mobile-only: bottom tab bar with a centred add button */}
        <BottomNav />
      </AddBetProvider>
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
      <Route path="/terms" element={<Terms />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/blog" element={<Blog />} />
      <Route path="/blog/:slug" element={<BlogPost />} />
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
