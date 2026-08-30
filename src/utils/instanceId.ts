let instanceIdCache: string | null = null;

export function getInstanceId(): string {
  if (instanceIdCache) {
    return instanceIdCache;
  }

  if (typeof window === 'undefined') {
    return 'UNKNOWN';
  }

  let id = localStorage.getItem('bomba_instance_id');
  if (!id) {
    const array = new Uint8Array(3);
    crypto.getRandomValues(array);
    id = Array.from(array)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
    localStorage.setItem('bomba_instance_id', id);
  }
  
  instanceIdCache = id;
  return id;
}

export function clearInstanceIdCache(): void {
  instanceIdCache = null;
}