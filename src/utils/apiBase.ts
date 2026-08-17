// Desktop app detection + API base URL resolution.
// In the desktop app, Chromium cannot reach 'http://localhost' (resolves to
// ::1) when the bundled server binds 127.0.0.1 - so we use the page origin.
// The desktop build is produced WITHOUT VITE_API_URL (see desktop/scripts/prepare.js).

export const isDesktopApp =
  typeof window !== 'undefined' &&
  (window as any).bombaDesktop?.isDesktop === true;

// Popup windows (e.g. bill view) are created by window.open() without the
// preload script, so bombaDesktop is undefined there. If the page itself is
// served from a local host, the page origin is always the correct API base.
const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

const servedFromLocalHost =
  typeof window !== 'undefined' &&
  window.location.protocol.startsWith('http') &&
  LOCAL_HOSTNAMES.has(window.location.hostname);

export const API_BASE_URL =
  isDesktopApp || servedFromLocalHost
    ? window.location.origin
    : import.meta.env.VITE_API_URL || 'http://localhost:5000';