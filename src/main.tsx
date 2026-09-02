import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/i18n';
import '@/styles/globals.css';
import { App } from './App';

const container = document.getElementById('root');
if (!container) throw new Error('Root container #root is missing');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
