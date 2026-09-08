// Safe storage wrapper: localStorage throws (SecurityError) in some mobile
// browsers / in-app WebViews (QR scanner apps, restricted WebViews) when
// storage is blocked. A single unguarded access during boot = white screen.
// Every boot-critical read/write MUST go through here.

const memoryFallback = new Map<string, string>();

function storageAvailable(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  } catch {
    return false;
  }
}

export function safeGet(key: string): string | null {
  if (!storageAvailable()) return memoryFallback.has(key) ? memoryFallback.get(key)! : null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return memoryFallback.has(key) ? memoryFallback.get(key)! : null;
  }
}

export function safeSet(key: string, value: string): void {
  memoryFallback.set(key, value);
  if (!storageAvailable()) return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // storage blocked — memory fallback already set above
  }
}

export function safeRemove(key: string): void {
  memoryFallback.delete(key);
  if (!storageAvailable()) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}
