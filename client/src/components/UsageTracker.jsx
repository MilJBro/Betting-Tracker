import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { track } from '../analytics.js';

// Records a lightweight pageview on every route change, plus a heartbeat while
// the tab is visible. These power the private admin Insights page (live
// visitors, time on app, most-visited pages). No personal data is sent — only a
// random per-browser id, the path, and a timestamp. Renders nothing.
export default function UsageTracker() {
  const { pathname } = useLocation();
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  // A view per route change.
  useEffect(() => {
    track(pathname, 'view');
  }, [pathname]);

  // A heartbeat every 30s while the tab is in the foreground.
  useEffect(() => {
    const beat = () => {
      if (document.visibilityState === 'visible') track(pathRef.current, 'ping');
    };
    const iv = setInterval(beat, 30000);
    document.addEventListener('visibilitychange', beat);
    return () => {
      clearInterval(iv);
      document.removeEventListener('visibilitychange', beat);
    };
  }, []);

  return null;
}
