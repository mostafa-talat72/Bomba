// True on phones/tablets (Android/iOS). Used to route print jobs to the
// MAIN device over LAN instead of a local print agent (phones have none).
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  try {
    const ua = navigator.userAgent || '';
    if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua)) return true;
    // iPadOS reports as Macintosh — detect via touch support.
    if (/Macintosh/.test(ua) && (navigator.maxTouchPoints || 0) > 1) return true;
    return false;
  } catch {
    return false;
  }
}
