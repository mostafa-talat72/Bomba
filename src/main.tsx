import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './i18n/config'; // i18n configuration
import App from './App.tsx';
import './index.css';

// Apply language direction IMMEDIATELY on app load (before React renders)
// This prevents any layout shift or incorrect direction on initial render
(() => {
  const savedLanguage = localStorage.getItem('language') || 'ar'; // Default to Arabic
  
  // List of RTL languages (from shared/languages.js)
  // ar, he, fa, ur, ps, yi, sd, ug, dv, ku
  const rtlLanguages = ['ar', 'he', 'fa', 'ur', 'ps', 'yi', 'sd', 'ug', 'dv', 'ku'];
  const isRTL = rtlLanguages.includes(savedLanguage);
  
  // Apply direction to html and body immediately
  document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
  document.documentElement.lang = savedLanguage;
  
  // Check if user is authenticated
  const token = localStorage.getItem('token');
  const isAuthPage = window.location.pathname.match(/^\/(login|register|verify-email|reset-password|email-actions)/);
  
  // Apply direction to body based on authentication status
  if (token && !isAuthPage) {
    document.body.dir = isRTL ? 'rtl' : 'ltr';
  } else {
    document.body.dir = 'ltr';
  }
})();

// Disable old service workers and remove their caches. Data must always come
// from the API/database rather than an offline snapshot.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map(registration => registration.unregister()));
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)));
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
