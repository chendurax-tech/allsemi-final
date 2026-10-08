import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles/tailwind.css';

// A public image that cannot be loaded is hidden rather than drawn as a
// broken-image icon or its alt text over the design. Its frame keeps
// its size and background (styles/tailwind.css, img[data-failed]).
document.addEventListener('error', (event) => {
  const el = event.target;
  if (el instanceof HTMLImageElement && !window.location.pathname.startsWith('/admin')) el.dataset.failed = '';
}, true);
// The same element shown again with an image that loads (React reuses
// it when only the address changes) is shown again.
document.addEventListener('load', (event) => {
  const el = event.target;
  if (el instanceof HTMLImageElement && 'failed' in el.dataset) delete el.dataset.failed;
}, true);

createRoot(document.getElementById('root')).render(<App />);
