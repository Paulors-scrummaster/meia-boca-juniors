import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from '@/app/App';
import { initializeMonitoring } from '@/shared/adapters/monitoring/sentry';
import { startOneSignalBrowserBinding } from '@/shared/adapters/push/onesignal-browser';
import '@/index.css';

initializeMonitoring();
void startOneSignalBrowserBinding();

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Elemento raiz da aplicação não encontrado.');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
