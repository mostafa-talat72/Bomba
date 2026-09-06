/**
 * Canonical ID helpers — MongoDB uses `_id` (ObjectId), but the client sees
 * populated objects `{_id}`, plain ObjectIds, hex strings, legacy `.id`,
 * temp IDs (`temp-...`) and occasionally null/undefined.
 *
 * ALWAYS use these instead of raw `._id ===` / `.id ||` access:
 * - getId(v): string — canonical hex/string id or '' when missing.
 * - sameId(a, b): boolean — safe equality, never true on two missing ids.
 */

// Canonical id: _id first, then legacy .id, then the value itself (string/ObjectId).
export const getId = (v: any): string => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  if (typeof v === 'object') {
    const inner = (v as any)._id ?? (v as any).id;
    if (inner !== null && inner !== undefined && typeof inner === 'object') {
      try {
        const s = String((inner as any).toString?.() ?? '');
        if (s && s !== '[object Object]') return s;
      } catch { /* fall through */ }
      return '';
    }
    if (typeof inner === 'string' || typeof inner === 'number') return String(inner);
    try {
      const s = String((v as any).toString?.() ?? '');
      if (s && s !== '[object Object]') return s;
    } catch { /* fall through */ }
    return '';
  }
  try {
    return String(v);
  } catch {
    return '';
  }
};

// Safe equality: false when either side is missing (avoids undefined===undefined).
export const sameId = (a: any, b: any): boolean => {
  const x = getId(a);
  const y = getId(b);
  return x !== '' && x === y;
};

// Table/section/category reference may be id-string, ObjectId, or populated object.
export const refId = (v: any): string => getId(v);

export default getId;
