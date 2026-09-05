import type { User } from '../services/api';

// Tiny process-wide cache of the logged-in user so non-React utilities
// (printBill/printOrder instant drawer open) can apply per-user overrides
// without prop drilling. AuthContext keeps it in sync.
let cached: User | null = null;

export function setCurrentUserCache(user: User | null) {
  cached = user;
}

export function getCurrentUserCache(): User | null {
  return cached;
}
