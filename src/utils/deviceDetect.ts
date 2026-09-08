// True on phones/tablets (Android/iOS). Used to route print jobs to the
// MAIN device over LAN instead of a local print agent (phones have none).
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  try {
    const ua = navigator.userAgent || '';
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua);
  } catch {
    return false;
  }
}
