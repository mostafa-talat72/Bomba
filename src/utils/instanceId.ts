import { safeGet, safeSet } from './safeStorage';

let instanceIdCache: string | null = null;

function randomHex(bytes: number): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      const array = new Uint8Array(bytes);
      crypto.getRandomValues(array);
      return Array.from(array)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase();
    }
  } catch {
    // fall through to Math.random fallback
  }
  let out = '';
  for (let i = 0; i < bytes; i++) {
    out += Math.floor(Math.random() * 256).toString(16).padStart(2, '0');
  }
  return out.toUpperCase();
}

export function getInstanceId(): string {
  if (instanceIdCache) {
    return instanceIdCache;
  }

  if (typeof window === 'undefined') {
    return 'UNKNOWN';
  }

  let id = safeGet('bomba_instance_id');
  if (!id) {
    id = randomHex(3);
    safeSet('bomba_instance_id', id);
  }
  
  instanceIdCache = id;
  return id;
}

export function clearInstanceIdCache(): void {
  instanceIdCache = null;
}