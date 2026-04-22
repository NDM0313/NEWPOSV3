import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { registerAllSyncHandlers } from './lib/registerSyncHandlers';
import { PermissionProvider } from './context/PermissionContext';
import { SettingsProvider } from './context/SettingsContext';

registerAllSyncHandlers();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const base = import.meta.env.BASE_URL || '/';
    navigator.serviceWorker.register(base + 'sw.js').catch(() => {});
  });
}

createRoot(document.getElementById('root')!).render(
  <PermissionProvider>
    <SettingsProvider>
      <App />
    </SettingsProvider>
  </PermissionProvider>
);
