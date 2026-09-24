import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

// A small floating "Insights" pill for admins on mobile, sitting just above the
// bottom tab bar so the private stats page is one tap away from any screen. The
// desktop sidebar has its own link, so this is hidden on wider screens via CSS.
// Renders nothing for non-admins.
export default function InsightsFab() {
  const { user } = useAuth();
  if (!user?.isAdmin) return null;
  return (
    <NavLink
      to="/admin"
      className={({ isActive }) => 'insights-fab' + (isActive ? ' active' : '')}
      aria-label="Insights"
    >
      <span className="live-dot" /> Insights
    </NavLink>
  );
}
