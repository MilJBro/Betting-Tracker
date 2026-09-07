import { Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import { SettingsProvider } from './context/SettingsContext.jsx';
import Auth from './pages/Auth.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Bets from './pages/Bets.jsx';
import Customise from './pages/Customise.jsx';
import Share from './pages/Share.jsx';

function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const link = ({ isActive }) => 'nav-link' + (isActive ? ' active' : '');
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-dot">₿</span> Tracker
      </div>
      <NavLink to="/" end className={link}>📊 Dashboard</NavLink>
      <NavLink to="/bets" className={link}>🎯 My bets</NavLink>
      <NavLink to="/customise" className={link}>🎨 Customise</NavLink>
      <div className="nav-spacer" />
      <div className="nav-link" style={{ cursor: 'default' }}>👤 {user?.username}</div>
      <div className="nav-link" onClick={() => { logout(); navigate('/'); }}>↪ Log out</div>
    </aside>
  );
}

function AppShell() {
  return (
    <SettingsProvider>
      <div className="app-shell">
        <Sidebar />
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/bets" element={<Bets />} />
          <Route path="/customise" element={<Customise />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </SettingsProvider>
  );
}

export default function App() {
  const { user, loading } = useAuth();

  return (
    <Routes>
      {/* Public share page is always accessible. */}
      <Route path="/share/:publicId" element={<Share />} />
      <Route
        path="*"
        element={
          loading ? (
            <div className="auth-wrap"><p className="muted">Loading…</p></div>
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
