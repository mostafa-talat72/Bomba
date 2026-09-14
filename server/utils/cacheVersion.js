/**
 * Tiny per-key monotonic versions, used to invalidate response caches on ANY
 * data mutation (local writes AND changes applied through sync from other
 * devices). A bumped version makes previously cached responses miss on the
 * next request without having to find/delete individual cache keys.
 */
const versions = new Map();

export const bumpVersion = (key) => {
    versions.set(key, (versions.get(key) || 0) + 1);
};

export const getVersion = (key) => versions.get(key) || 0;