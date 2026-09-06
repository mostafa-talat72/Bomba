/**
 * Canonical ID helpers (server side) — MongoDB uses `_id` (ObjectId), but code
 * meets populated docs `{_id}`, plain ObjectIds, hex strings, legacy `.id`
 * and occasionally null/undefined.
 *
 * ALWAYS use these instead of raw `._id.toString() ===` chains:
 * - getId(v): string — canonical id or '' when missing (never throws).
 * - sameId(a, b): boolean — safe equality, never true on two missing ids.
 */

export const getId = (v) => {
    if (v === null || v === undefined) return '';
    if (typeof v === 'string') return v;
    if (typeof v === 'number') return String(v);
    if (typeof v === 'object') {
        const inner = v._id ?? v.id;
        if (inner !== null && inner !== undefined && typeof inner === 'object') {
            try {
                const s = String(inner.toString?.() ?? '');
                if (s && s !== '[object Object]') return s;
            } catch { /* fall through */ }
            return '';
        }
        if (typeof inner === 'string' || typeof inner === 'number') return String(inner);
        try {
            const s = String(v.toString?.() ?? '');
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

export const sameId = (a, b) => {
    const x = getId(a);
    const y = getId(b);
    return x !== '' && x === y;
};

export const isOrgOwner = (organization, user) => {
    const ownerId = organization?.owner?._id || organization?.owner;
    return (!!ownerId && sameId(ownerId, user?._id)) || user?.role === 'owner';
};

export const includesUser = (list, user) =>
    Array.isArray(list) && list.some((m) => sameId(m?._id || m, user?._id));

export default getId;
