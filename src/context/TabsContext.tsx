import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { isDesktopApp } from '../utils/apiBase';

/** الحد الأقصى للتبويبات — قرار المستخدم */
export const MAX_TABS = 10;

export interface DeskTab {
  id: number;
  path: string;
}

/** مسارات لا تُفتح في تبويبات (عامة/خارج الهيكل) */
const NON_TAB_PREFIXES = [
  '/login', '/register', '/verify-email', '/reset-password',
  '/email-actions', '/menu-view', '/bill/',
];

export const normalizeTabPath = (p?: string | null): string => {
  let s = String(p || '').split('?')[0].split('#')[0].trim();
  if (!s.startsWith('/')) s = '/' + s;
  if (s.length > 1) s = s.replace(/\/+$/, '');
  return s || '/';
};

export const isTabablePath = (p?: string | null): boolean => {
  const n = normalizeTabPath(p);
  if (n === '/') return false;
  return !NON_TAB_PREFIXES.some((pre) => n === pre || n.startsWith(pre));
};

// ── تتبع المودال: أي تبويب فيه نافذة مغطية؟ ──────────────────────────────
// المودالات تُبث إلى document.body (خارج شجرة التبويب) — فنراقب DOM وننسب
// كل نافذة للتبويب النشط لحظة ظهورها.
let activeTabIdRef: number | null = null;
const modalCounts = new Map<number, number>();
const modalListeners = new Set<() => void>();
const emitModals = () => { modalListeners.forEach((l) => { try { l(); } catch {} }); };

const MODAL_SEL = '.modal-backdrop, .ant-modal-wrap, .ant-modal-confirm, [data-tab-modal]';

const noteModalOpened = (): (() => void) => {
  const tabId = activeTabIdRef;
  if (tabId == null) return () => {};
  modalCounts.set(tabId, (modalCounts.get(tabId) || 0) + 1);
  emitModals();
  let done = false;
  return () => {
    if (done) return;
    done = true;
    const cur = (modalCounts.get(tabId) || 1) - 1;
    if (cur <= 0) modalCounts.delete(tabId);
    else modalCounts.set(tabId, cur);
    emitModals();
  };
};

export const subscribeModalCounts = (l: () => void): (() => void) => {
  modalListeners.add(l);
  return () => { modalListeners.delete(l); };
};

export const getModalCount = (tabId: number): number => modalCounts.get(tabId) || 0;

/** إظهار نوافذ التبويب النشط فقط — نوافذ التبويبات الأخرى مخفية مع تبويبها */
export const applyModalVisibility = (): void => {
  const active = activeTabIdRef;
  try {
    document.body.querySelectorAll(MODAL_SEL).forEach((el) => {
      const h = el as HTMLElement;
      const owner = h?.dataset?.ownerTab;
      h.classList.toggle('tab-modal-hidden', !!owner && Number(owner) !== active);
    });
  } catch {}
};

interface TabsCtx {
  tabsOn: boolean;
  tabs: DeskTab[];
  activeId: number | null;
  activeTab: DeskTab | null;
  openTab: (path: string) => void;
  /** تنقل داخل التبويب النشط — أو انتقال لتبويبها لو مفتوحة فيه */
  navigateInTab: (path: string) => void;
  closeTab: (id: number) => void;
  switchTab: (id: number) => void;
  /** مزامنة مسار التبويب النشط مع تنقلات الراوتر الداخلية */
  syncPath: (pathname: string) => void;
  modalTick: number;
  saveScroll: (path: string, y: number) => void;
  getScroll: (path: string) => number | undefined;
}

const Ctx = createContext<TabsCtx | null>(null);

export const useTabs = (): TabsCtx => {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTabs must be used inside TabsProvider');
  return v;
};

export const TabsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const tabsOn = isDesktopApp === true;
  const navigate = useNavigate();
  const { t } = useTranslation();
  const idRef = useRef(0);
  const scrollMap = useRef<Record<string, number>>({});

  const initialPath = (() => {
    const p = normalizeTabPath(typeof window !== 'undefined' ? window.location.pathname : '/dashboard');
    return isTabablePath(p) ? p : '/dashboard';
  })();
  const tabsRef = useRef<DeskTab[]>([{ id: 0, path: initialPath }]);
  const [tabs, setTabs] = useState<DeskTab[]>(tabsRef.current);
  const activeRef = useRef<number>(0);
  const [activeId, setActiveId] = useState<number>(0);
  const [modalTick, setModalTick] = useState(0);

  const commitTabs = useCallback((next: DeskTab[]) => {
    tabsRef.current = next;
    setTabs(next);
  }, []);

  const activate = useCallback((id: number, path?: string) => {
    activeRef.current = id;
    // تحديث فوري متزامن — قبل applyModalVisibility وقبل أي قراءة (الـ effect وحده متأخر)
    activeTabIdRef = tabsOn ? id : null;
    setActiveId(id);
    applyModalVisibility();
    if (path) {
      try { navigate(path); } catch {}
    }
  }, [navigate, tabsOn]);

  // التبويب النشط متاح على مستوى الوحدة لنسب المودالات — مع إعادة تطبيق الإخفاء كضمان
  useEffect(() => {
    activeTabIdRef = tabsOn ? activeRef.current : null;
    applyModalVisibility();
  }, [tabsOn, activeId]);
  useEffect(() => {
    activeTabIdRef = tabsOn ? activeRef.current : null;
    return () => {
      activeTabIdRef = null;
      modalCounts.clear();
      emitModals();
    };
  }, [tabsOn]);

  // مراقبة النوافذ المنبثقة في body ونسبها للتبويب النشط
  useEffect(() => {
    if (!tabsOn) return;
    const seen = new WeakMap<Element, () => void>();
    const track = (el: Element) => {
      if (seen.has(el)) return;
      seen.set(el, noteModalOpened());
      // نسب النافذة للتبويب النشط لحظة ظهورها
      try {
        if (activeTabIdRef != null) (el as HTMLElement).dataset.ownerTab = String(activeTabIdRef);
      } catch {}
      applyModalVisibility();
    };
    try {
      document.body.querySelectorAll(MODAL_SEL).forEach(track);
    } catch {}
    const obs = new MutationObserver((muts) => {
      muts.forEach((m) => {
        m.addedNodes.forEach((n) => {
          if (!(n instanceof Element)) return;
          try {
            if (n.matches(MODAL_SEL)) track(n);
            n.querySelectorAll(MODAL_SEL).forEach(track);
          } catch {}
        });
        m.removedNodes.forEach((n) => {
          if (!(n instanceof Element)) return;
          try {
            const leave = seen.get(n);
            if (leave) { seen.delete(n); leave(); }
            n.querySelectorAll(MODAL_SEL).forEach((el) => {
              const l = seen.get(el);
              if (l) { seen.delete(el); l(); }
            });
          } catch {}
        });
      });
    });
    try { obs.observe(document.body, { childList: true, subtree: true }); } catch {}
    return () => { try { obs.disconnect(); } catch {} };
  }, [tabsOn]);

  useEffect(() => subscribeModalCounts(() => setModalTick((x) => x + 1)), []);

  // وضع الديسكتوب على body لإزاحة النوافذ أسفل شريط التبويبات
  useEffect(() => {
    try { document.body.classList.toggle('desk-tabs-on', tabsOn); } catch {}
    return () => { try { document.body.classList.remove('desk-tabs-on'); } catch {} };
  }, [tabsOn]);

  const openTab = useCallback((rawPath: string) => {
    const path = normalizeTabPath(rawPath);
    if (!tabsOn || !isTabablePath(path)) {
      try { navigate(path); } catch {}
      return;
    }
    const prev = tabsRef.current;
    if (prev.length >= MAX_TABS) {
      try { toast.warn(t('tabs.maxReached', 'الحد الأقصى 10 تبويبات مفتوحة')); } catch {}
      return;
    }
    // مسموح بتكرار نفس الصفحة في أكثر من تبويب — لا دمج
    const nt = { id: ++idRef.current, path };
    commitTabs([...prev, nt]);
    activate(nt.id, path);
  }, [tabsOn, navigate, activate, commitTabs, t]);

  const switchTab = useCallback((id: number) => {
    const tb = tabsRef.current.find((x) => x.id === id);
    if (!tb || tb.id === activeRef.current) return;
    activate(tb.id, tb.path);
  }, [activate]);

  /**
   * تنقل من السايدبار: يفتح دائمًا داخل التبويب النشط نفسه —
   * مسموح بتكرار نفس الصفحة في أكثر من تبويب.
   */
  const navigateInTab = useCallback((rawPath: string) => {
    const path = normalizeTabPath(rawPath);
    if (!tabsOn || !isTabablePath(path)) {
      try { navigate(path); } catch {}
      return;
    }
    const prev = tabsRef.current;
    const cur = prev.find((tb) => tb.id === activeRef.current);
    if (cur && cur.path !== path) {
      commitTabs(prev.map((tb) => (tb.id === cur.id ? { ...tb, path } : tb)));
    }
    try { navigate(path); } catch {}
  }, [tabsOn, navigate, activate, commitTabs]);

  const closeTab = useCallback((id: number) => {
    const prev = tabsRef.current;
    if (!prev.some((tb) => tb.id === id)) return;
    const next = prev.filter((tb) => tb.id !== id);
    if (next.length === 0) {
      const nt = { id: ++idRef.current, path: '/dashboard' };
      commitTabs([nt]);
      activate(nt.id, nt.path);
      return;
    }
    commitTabs(next);
    if (id === activeRef.current) {
      const idx = prev.findIndex((tb) => tb.id === id);
      const nb = next[Math.min(idx, next.length - 1)];
      activate(nb.id, nb.path);
    }
  }, [activate, commitTabs]);

  const syncPath = useCallback((pathname: string) => {
    if (!tabsOn) return;
    const path = normalizeTabPath(pathname);
    if (!isTabablePath(path)) return;
    const prev = tabsRef.current;
    const cur = prev.find((tb) => tb.id === activeRef.current);
    if (!cur || cur.path === path) return;
    commitTabs(prev.map((tb) => (tb.id === cur.id ? { ...tb, path } : tb)));
  }, [tabsOn, commitTabs]);

  const saveScroll = useCallback((path: string, y: number) => {
    scrollMap.current[normalizeTabPath(path)] = y;
  }, []);
  const getScroll = useCallback((path: string) => {
    return scrollMap.current[normalizeTabPath(path)];
  }, []);

  const value = useMemo<TabsCtx>(() => ({
    tabsOn,
    tabs,
    activeId,
    activeTab: tabs.find((tb) => tb.id === activeId) || null,
    openTab,
    closeTab,
    switchTab,
    navigateInTab,
    syncPath,
    modalTick,
    saveScroll,
    getScroll,
  }), [tabsOn, tabs, activeId, openTab, closeTab, switchTab, navigateInTab, syncPath, modalTick, saveScroll, getScroll]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};
