import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import AssistantWidget from './components/assistant/AssistantWidget';
import ErrorBoundary from './components/ErrorBoundary';
import { AuthProvider } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import { reloadOnce } from './utils/reload';
import './i18n';
import './index.css';

// Vite emits this when a hashed bundle from an older deployment disappears.
// Reload once so the browser picks up the current app shell instead of showing
// an empty page. The helper enforces a cooldown to avoid a reload loop.
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  reloadOnce('preload');
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter basename="/app">
        <AuthProvider>
          <LanguageProvider>
            <App />
            <AssistantWidget />
          </LanguageProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);

// The bundle mounted, so the static boot fallback in app.html is not needed.
document.getElementById('boot-fallback')?.remove();
