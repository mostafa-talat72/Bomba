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
//
// LAN: phones/tablets open the app as http://<server-lan-ip>:5000, so any
// private-LAN hostname is also origin-based (zero config on mobile browsers).
const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

function isPrivateLanHostname(hostname: string): boolean {
  return (
    /^192\.168\.\d+\.\d+$/.test(hostname) ||
    /^10\.\d+\.\d+\.\d+$/.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/.test(hostname)
  );
}

const servedFromLocalHost =
  typeof window !== 'undefined' &&
  window.location.protocol.startsWith('http') &&
  (LOCAL_HOSTNAMES.has(window.location.hostname) || isPrivateLanHostname(window.location.hostname));

// Manual override (Capacitor builds where origin is capacitor://, or any
// custom server). Set from the connection settings screen.
export function getServerUrlOverride(): string | null {
  try {
    const v = typeof window !== 'undefined' ? window.localStorage.getItem('bomba_server_url') : null;
    return v && v.trim() ? v.trim().replace(/\/+$/, '') : null;
  } catch {
    return null;
  }
}

export const API_BASE_URL =
  getServerUrlOverride() ||
  (isDesktopApp || servedFromLocalHost
    ? window.location.origin
    : import.meta.env.VITE_API_URL || 'http://localhost:5000');