import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import CliniqPlatform from './CliniqPlatform.jsx';
import PinGate from './PinGate.jsx';

const originalFetch = window.fetch.bind(window);
window.fetch = function (url, opts = {}) {
  const target = typeof url === 'string' ? url : (url?.url || '');
  const isApi = target.startsWith('/api/') || target.includes('/api/');

  if (!isApi) return originalFetch(url, opts);

  let pin = '';
  try { pin = localStorage.getItem('cliniq_pin') || ''; } catch {}

  const headers = new Headers(opts.headers || {});
  if (pin) headers.set('X-Cliniq-Pin', pin);

  return originalFetch(url, { ...opts, headers }).then((r) => {
    if (r.status === 401 && !target.includes('/api/auth-pin') && !target.includes('/api/client-view')) {
      try { localStorage.removeItem('cliniq_pin'); } catch {}
      setTimeout(() => window.location.reload(), 100);
    }
    return r;
  });
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <PinGate>
      <CliniqPlatform />
    </PinGate>
  </StrictMode>
);
