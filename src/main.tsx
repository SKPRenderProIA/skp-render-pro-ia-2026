import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

// Gracefully suppress benign Vite HMR websocket disconnection notices
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    if (
      event.reason &&
      (typeof event.reason === 'string' || typeof event.reason?.message === 'string')
    ) {
      const msg = event.reason?.message || event.reason;
      if (
        typeof msg === 'string' &&
        (msg.includes('WebSocket') || msg.includes('websocket') || msg.includes('vite'))
      ) {
        event.preventDefault();
      }
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

