import { useState, useEffect, useRef, useCallback } from 'react';

export interface InfinitePage<T> {
  items: T[];
  total: number;
  hasMore: boolean;
}

interface UseInfiniteListOptions<T> {
  /** حجم الصفحة */
  pageSize?: number;
  /** يتغير عند تغير الفلاتر/البحث → تصفير وإعادة من 1 */
  depsKey: string;
  /** جلب صفحة من السيرفر (وضع السيرفر) */
  fetchPage?: (page: number, limit: number) => Promise<InfinitePage<T>>;
  /** بيانات محلية جاهزة (وضع محلي: تقسيم للعرض فقط) */
  localItems?: T[];
  /** معرف فريد للدمج ومنع التكرار */
  getId: (item: T) => string;
  /** مفعّل أم لا */
  enabled?: boolean;
}

/**
 * Infinite scroll موحد: وضع سيرفر (صفحات حقيقية) أو وضع محلي (تقطيع عرض).
 * - دمج بلا تكرار حسب getId
 * - upsert/remove للدمج مع السوكت والأحداث دون قفز السكرول
 * - refreshFirstPage لإشعارات "جديد" دون إعادة كل الصفحات
 */
export function useInfiniteList<T>(options: UseInfiniteListOptions<T>) {
  const { pageSize = 25, depsKey, fetchPage, localItems, getId, enabled = true } = options;
  const [items, setItems] = useState<T[]>([]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadingRef = useRef(false);
  const stateRef = useRef({ page: 0, hasMore: true, key: '' });
  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;
  const localRef = useRef(localItems);
  localRef.current = localItems;
  const getIdRef = useRef(getId);
  getIdRef.current = getId;

  const mergeItems = useCallback((base: T[], incoming: T[], reset: boolean): T[] => {
    const start = reset ? [] : base;
    const seen = new Set(start.map((it) => { try { return getIdRef.current(it); } catch { return ''; } }));
    const merged = [...start];
    for (const it of incoming) {
      let id = '';
      try { id = getIdRef.current(it); } catch { continue; }
      if (!id || seen.has(id)) continue;
      seen.add(id);
      merged.push(it);
    }
    return merged;
  }, []);

  const loadPage = useCallback(async (target: number, reset: boolean): Promise<boolean> => {
    if (loadingRef.current || !enabled) return false;
    loadingRef.current = true;
    if (reset) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const fn = fetchRef.current;
      const local = localRef.current;
      if (fn) {
        const res = await fn(target, pageSize);
        const incoming = Array.isArray(res?.items) ? res.items : [];
        setTotal(typeof res?.total === 'number' ? res.total : incoming.length);
        const more = res?.hasMore === true;
        setHasMore(more);
        setPage(target);
        stateRef.current.page = target;
        stateRef.current.hasMore = more;
        setItems((prev) => mergeItems(prev, incoming, reset));
        return more;
      }
      if (local) {
        const slice = local.slice((target - 1) * pageSize, target * pageSize);
        setTotal(local.length);
        const more = target * pageSize < local.length;
        setHasMore(more);
        setPage(target);
        stateRef.current.page = target;
        stateRef.current.hasMore = more;
        setItems((prev) => mergeItems(prev, slice, reset));
        return more;
      }
      return false;
    } catch (e: any) {
      setError(e?.message || 'فشل الجلب');
      return stateRef.current.hasMore;
    } finally {
      loadingRef.current = false;
      setRefreshing(false);
      setLoading(false);
    }
  }, [enabled, pageSize, mergeItems]);

  // تصفير عند تغير الفلاتر + تحميل أول صفحة
  useEffect(() => {
    if (!enabled) return;
    if (stateRef.current.key === depsKey) return;
    stateRef.current.key = depsKey;
    stateRef.current.page = 0;
    stateRef.current.hasMore = true;
    setItems([]);
    setTotal(0);
    setHasMore(true);
    setPage(0);
    setError(null);
    void loadPage(1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depsKey, enabled]);

  // وضع محلي: البيانات تحدثت (سوكت/دفع) — أعِد اشتقاق نفس العمق بدل التصفير
  const localSeen = useRef<{ key: string; arr: any[] | undefined }>({ key: '', arr: undefined });
  useEffect(() => {
    if (!enabled || fetchRef.current) return;
    const local = localRef.current;
    if (!local) return;
    if (localSeen.current.key === depsKey && localSeen.current.arr === local) return;
    localSeen.current = { key: depsKey, arr: local };
    if (stateRef.current.key !== depsKey) return; // مسار التصفير يتكفل بالتحميل
    const n = Math.max(pageSize, stateRef.current.page * pageSize);
    setItems(local.slice(0, n));
    setTotal(local.length);
    const more = n < local.length;
    setHasMore(more);
    stateRef.current.hasMore = more;
  });

  const loadMore = useCallback(() => {
    if (!stateRef.current.hasMore || loadingRef.current) return;
    void loadPage(stateRef.current.page + 1, false);
  }, [loadPage]);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !enabled) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((en) => en.isIntersecting)) loadMore();
      },
      { rootMargin: '400px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [enabled, loadMore, items.length]);

  // دمج تحديث (سوكت/تفاؤلي): تحديث في مكانه، أو حذف لو خرج من الفلتر
  const upsert = useCallback((item: T | null, remove = false) => {
    let id = '';
    try { id = item ? getIdRef.current(item) : ''; } catch { return; }
    if (!id && !remove) return;
    setItems((prev) => {
      const idx = prev.findIndex((it) => {
        try { return getIdRef.current(it) === id; } catch { return false; }
      });
      if (remove) {
        if (idx === -1) return prev;
        const cp = [...prev];
        cp.splice(idx, 1);
        return cp;
      }
      if (idx === -1) return prev;
      const cp = [...prev];
      cp[idx] = item as T;
      return cp;
    });
  }, []);

  // إدراج عنصر جديد أعلى القائمة (وصول سوكت) — بلا تكرار
  const prepend = useCallback((item: T) => {
    let id = '';
    try { id = getIdRef.current(item); } catch { return; }
    if (!id) return;
    setItems((prev) => {
      const exists = prev.some((it) => {
        try { return getIdRef.current(it) === id; } catch { return false; }
      });
      if (exists) return prev;
      return [item, ...prev];
    });
    setTotal((t) => t + 1);
  }, []);

  const remove = useCallback((id: string) => {
    setItems((prev) => prev.filter((it) => {
      try { return getIdRef.current(it) !== id; } catch { return true; }
    }));
  }, []);

  // إعادة الصفحة الأولى فقط (وصول جديد) — بلا قفز سكرول
  const refreshFirstPage = useCallback(async () => {
    await loadPage(1, false);
  }, [loadPage]);

  const reset = useCallback(() => {
    stateRef.current.page = 0;
    stateRef.current.hasMore = true;
    setItems([]);
    setTotal(0);
    setHasMore(true);
    setPage(0);
    void loadPage(1, true);
  }, [loadPage]);

  return {
    items, total, hasMore, loading, refreshing, error, page,
    sentinelRef, loadMore, upsert, prepend, remove, refreshFirstPage, reset,
    setItems,
  };
}

export default useInfiniteList;
