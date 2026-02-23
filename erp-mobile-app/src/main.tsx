import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { registerAllSyncHandlers } from './lib/registerSyncHandlers';

registerAllSyncHandlers();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const base = import.meta.env.BASE_URL || '/';
    navigator.serviceWorker.register(base + 'sw.js').catch(() => {});
  });
}

createRoot(document.getElementById('root')!).render(<App />);
