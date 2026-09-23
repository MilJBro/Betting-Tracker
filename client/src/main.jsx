import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import App from './App.jsx';
import { registerSW, reloadIfReturningFromStripe } from './pwa.js';
import { markAppReady } from './boot.js';
import './styles.css';

// If we're bouncing back from Stripe in the installed app, reload once before
// mounting anything (see pwa.js) — and don't render, so the reload can't abort
// the app's startup requests.
if (!reloadIfReturningFromStripe()) {
  registerSW();

  // Safety net: never let the boot splash get stuck if a screen forgets to
  // signal ready (e.g. an unusual deep link or a slow first fetch).
  setTimeout(markAppReady, 8000);

  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <BrowserRouter>
        <ToastProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    </React.StrictMode>
  );
}
