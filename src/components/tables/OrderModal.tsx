import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { ShoppingCart, Search, X, Printer, CheckCircle, ChefHat, Table as TableIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../context/LanguageContext';
import type { MenuItem, MenuSection, MenuCategory, Order } from '../../services/api';
import ModalPortal from '../ModalPortal';
import { ItemCard, OrderItemRow } from './OrderItems';
import { getTableDisplay, type LocalOrderItem } from './tableHelpers';
import { formatCurrency as formatCurrencyUtil } from '../../utils/formatters';

export interface OrderModalProps {
  table: { _id: string; number: string | number; name?: string };
  orderItems: LocalOrderItem[];
  setOrderItems: React.Dispatch<React.SetStateAction<LocalOrderItem[]>>;
  orderNotes: string; setOrderNotes: (n: string) => void;
  menuSections: MenuSection[]; menuCategories: MenuCategory[]; menuItems: MenuItem[];
  expandedSections: Record<string, boolean>; expandedCategories: Record<string, boolean>;
  toggleSection: (id: string) => void; toggleCategory: (id: string) => void;
  getCategoriesForSection: (id: string) => MenuCategory[];
  getItemsForCategory: (id: string) => MenuItem[];
  addItemToOrder: (item: MenuItem, variant?: string | null) => void;
  updateItemQuantity: (id: string, delta: number, variant?: string | null) => void;
  updateItemNotes: (id: string, notes: string, variant?: string | null) => void;
  removeItemFromOrder: (id: string, variant?: string | null) => void;
  calculateTotal: () => number;
  onSave: () => void; onSaveAndPrint: () => void; onSaveAndSend: () => void; onClose: () => void;
  loading: boolean; isEdit: boolean;
  canEditPrice?: boolean;
  onEditPrice?: (index: number, item: LocalOrderItem) => void;
}


const OrderModal: React.FC<OrderModalProps> = ({
  table, orderItems, setOrderItems, orderNotes, setOrderNotes, menuSections, menuCategories, menuItems,
  expandedSections, expandedCategories, toggleSection, toggleCategory, getCategoriesForSection,
  getItemsForCategory, addItemToOrder, updateItemQuantity, updateItemNotes, removeItemFromOrder,
  calculateTotal, onSave, onSaveAndPrint, onSaveAndSend, onClose, loading, isEdit,
  canEditPrice, onEditPrice,
}) => {
  const { t, i18n } = useTranslation();
  const { isRTL } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // ── مرة واحدة، لا تتغير في كل render ──────────────────────────────
  const cur = useRef(localStorage.getItem('organizationCurrency') || 'EGP').current;
  const fmt = useCallback((n: number) => formatCurrencyUtil(n, i18n.language, cur), [i18n.language, cur]);

  // ── map الكمية: O(1) بدل O(n) في كل صنف — with variant support ───────
  const qtyMap = useMemo(() => {
    const map: Record<string, number> = {};
    orderItems.forEach(i => { map[i.menuItem] = (map[i.menuItem] || 0) + i.quantity; });
    return map;
  }, [orderItems]);
  const qtyByVariantMap = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    orderItems.forEach(i => {
      const v = i.variant || '';
      if (!map[i.menuItem]) map[i.menuItem] = {};
      map[i.menuItem][v] = (map[i.menuItem][v] || 0) + i.quantity;
      if (i.variant) map[i.menuItem][i.variant] = (map[i.menuItem][i.variant] || 0) + i.quantity;
    });
    return map;
  }, [orderItems]);

  // ── الأقسام النشطة ───────────────────────────────────────────────────
  const activeSections = useMemo(() =>
    menuSections.filter(s => s.isActive).sort((a, b) => a.sortOrder - b.sortOrder),
  [menuSections]);

  const [activeSectionId, setActiveSectionId] = useState<string>(() =>
    menuSections.find(s => s.isActive)?._id || menuSections.find(s => s.isActive)?.id || ''
  );
  const [activeCategoryId, setActiveCategoryId] = useState<string>('all');
  useEffect(() => { setActiveCategoryId('all'); }, [activeSectionId]);
  // لو المنيو لسه بيحمل أو activeSectionId فاضي، اختار أول قسم متاح تلقائياً (يضمن التوزيع يظهر في الإضافة والتعديل)
  useEffect(() => {
    if (!activeSectionId && activeSections.length > 0) {
      const firstId = (activeSections[0] as any).id || activeSections[0]._id;
      setActiveSectionId(String(firstId));
    }
  }, [activeSections, activeSectionId]);

  const activeSectionCategories = useMemo(() => {
    if (!activeSectionId) return [];
    return getCategoriesForSection(activeSectionId);
  }, [activeSectionId, menuCategories]);

  // ── الأصناف المعروضة — توزيع كامل: أقسام → فئات → أصناف + بحث + fallback للمنيو الكامل ──
  const displayedItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q) return menuItems.filter(i => i.isAvailable && i.name.toLowerCase().includes(q));
    if (!activeSectionId) return menuItems.filter(i => i.isAvailable);
    const cats = activeCategoryId === 'all'
      ? getCategoriesForSection(activeSectionId)
      : getCategoriesForSection(activeSectionId).filter(c => c._id === activeCategoryId || c.id === activeCategoryId);
    return cats.flatMap(cat => getItemsForCategory(String(cat._id || cat.id)));
  }, [searchQuery, activeSectionId, activeCategoryId, menuItems, getCategoriesForSection, getItemsForCategory]);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const itemRefsMap = useRef<Record<string, HTMLDivElement | null>>({});
  const [flashId, setFlashId] = useState<string | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});

  const prevLengthRef = useRef(orderItems.length);
  useEffect(() => {
    if (orderItems.length > prevLengthRef.current) {
      const last = orderItems[orderItems.length - 1];
      if (last) {
        if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
        setFlashId(last.menuItem);
        flashTimerRef.current = setTimeout(() => setFlashId(null), 700);
        setTimeout(() => { itemRefsMap.current[last.menuItem]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, 30);
      }
    }
    prevLengthRef.current = orderItems.length;
  }, [orderItems.length]);

  const handleAddWithFlash = useCallback((menuItem: MenuItem, variant?: string | null) => {
    addItemToOrder(menuItem, variant);
    let effPrice = menuItem.price;
    if (menuItem.variants && menuItem.variants.length > 0) {
      if (variant) {
        const m = menuItem.variants.find(v => v.size === variant);
        if (m) effPrice = m.price;
        else effPrice = menuItem.variants[0].price;
      } else {
        effPrice = menuItem.variants[0].price;
      }
    }
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    const flashKey = `${menuItem.id}::${variant || ''}::${effPrice}`;
    const fallbackKey = variant ? `${menuItem.id}::${variant}` : menuItem.id;
    setFlashId(flashKey);
    flashTimerRef.current = setTimeout(() => setFlashId(null), 700);
    setTimeout(() => {
      const el = itemRefsMap.current[flashKey] || itemRefsMap.current[fallbackKey] || itemRefsMap.current[menuItem.id];
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 30);
  }, [addItemToOrder]);

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  useEffect(() => () => { if (flashTimerRef.current) clearTimeout(flashTimerRef.current); }, []);

  return (
    <ModalPortal>
    <div className="fixed inset-0 z-[300] flex bg-black/50" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white dark:bg-gray-900 w-full flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>

        {/* HEADER — بدون بحث */}
        <div className="bg-gradient-to-r from-orange-500 to-red-500 px-4 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 bg-white/15 rounded-xl flex items-center justify-center ring-1 ring-white/25 flex-shrink-0">
              <ShoppingCart className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xl sm:text-2xl font-bold text-white truncate">{isEdit ? t('cafe.orderModal.editOrderTitle') : t('cafe.orderModal.newOrderTitle')}</h2>
              <p className="text-base text-orange-100 flex items-center gap-1">
                <TableIcon className="h-3 w-3 flex-shrink-0" />
                {t('cafe.orderModal.table', { number: getTableDisplay(table.number, i18n.language) })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {orderItems.length > 0 && (
              <div className="bg-white/15 rounded-xl px-3 py-1.5 ring-1 ring-white/25 text-center">
                <p className="text-base text-orange-100 leading-none">الإجمالي</p>
                <p className="text-lg font-bold text-white">{fmt(calculateTotal())}</p>
              </div>
            )}
            <button onClick={onClose} className="w-8 h-8 bg-white/15 hover:bg-white/25 rounded-xl flex items-center justify-center text-white ring-1 ring-white/25 transition-all">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* BODY */}
        <div className="flex-1 flex overflow-hidden min-h-0">

          {/* Col 1: Sections */}
          {!searchQuery.trim() && (
            <div className="w-24 sm:w-28 flex-shrink-0 flex flex-col border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
              <div className="px-2 py-2 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
                <p className="text-base font-semibold text-gray-400 dark:text-gray-500 text-center">الأقسام</p>
              </div>
              <div className="flex-1 overflow-y-auto py-1.5 px-1.5 space-y-1">
                {activeSections.map(sec => {
                  const hasCats = getCategoriesForSection(sec.id).length > 0;
                  if (!hasCats) return null;
                  const isAct = activeSectionId === sec.id;
                  return (
                    <button key={sec.id} onClick={() => setActiveSectionId(sec.id)}
                      className={`w-full px-2 py-2 rounded-lg text-base font-medium transition-all text-right leading-snug ${isAct ? 'bg-orange-500 text-white shadow-sm' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                      {sec.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Col 2: Categories */}
          {!searchQuery.trim() && activeSectionCategories.length > 1 && (
            <div className="w-24 sm:w-28 flex-shrink-0 flex flex-col border-l border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
              <div className="px-2 py-2 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
                <p className="text-base font-semibold text-gray-400 dark:text-gray-500 text-center">الفئات</p>
              </div>
              <div className="flex-1 overflow-y-auto py-1.5 px-1.5 space-y-1">
                <button onClick={() => setActiveCategoryId('all')}
                  className={`w-full px-2 py-2 rounded-lg text-base font-medium transition-all text-right ${activeCategoryId === 'all' ? 'bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                  الكل
                </button>
                {activeSectionCategories.map(cat => {
                  const catId = cat._id || cat.id;
                  const isAct = activeCategoryId === catId;
                  const count = getItemsForCategory(cat.id).length;
                  if (count === 0) return null;
                  return (
                    <button key={catId} onClick={() => setActiveCategoryId(catId)}
                      className={`w-full px-2 py-2 rounded-lg text-base font-medium transition-all text-right leading-snug ${isAct ? 'bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                      <span className="block">{cat.name}</span>
                      <span className={`text-base ${isAct ? 'text-white/70 dark:text-gray-700' : 'text-gray-400'}`}>{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Col 3: Items */}
          <div className="flex-1 flex flex-col min-h-0 min-w-0 bg-gray-50 dark:bg-gray-900">

            {/* البحث داخل الأصناف */}
            <div className="px-2 pt-2 pb-1.5 flex-shrink-0">
              <div className="relative">
                <Search className={`absolute ${isRTL ? 'right-2.5' : 'left-2.5'} top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none`} />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder={t('cafe.orderModal.searchPlaceholder')}
                  className={`w-full ${isRTL ? 'pr-8 pl-7' : 'pl-8 pr-7'} py-1.5 text-base rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-1 focus:ring-orange-400 focus:border-orange-400 outline-none transition-all`}
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className={`absolute ${isRTL ? 'left-2' : 'right-2'} top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600`}>
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>

            <div className="px-2 py-1 border-b border-gray-100 dark:border-gray-700 flex-shrink-0 flex items-center justify-between">
              <p className="text-base font-semibold text-gray-400 dark:text-gray-500">
                {searchQuery
                  ? 'نتائج البحث'
                  : (activeSectionCategories.find(c => (c._id || c.id) === activeCategoryId)?.name
                    || activeSections.find(s => s.id === activeSectionId)?.name
                    || 'الأصناف')}
              </p>
              {displayedItems.length > 0 && <span className="text-base text-gray-400">{displayedItems.length}</span>}
            </div>
            <div className="flex-1 overflow-y-auto p-1.5 min-h-0">
              {displayedItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-300 dark:text-gray-600 select-none">
                  <Search className="h-8 w-8 mb-2 opacity-30" />
                  <p className="text-base">{searchQuery ? t('cafe.orderModal.noResults') : 'اختر قسماً'}</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-1">
                  {displayedItems.map(item => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      qty={qtyMap[item.id] || 0}
                      qtyByVariant={qtyByVariantMap[item.id]}
                      onAdd={handleAddWithFlash}
                      fmt={fmt}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Col 4: Order — أوسع */}
          <div className="w-64 sm:w-72 flex-shrink-0 flex flex-col border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700 flex-shrink-0 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <div className="w-1 h-4 bg-gradient-to-b from-green-400 to-emerald-500 rounded-full"></div>
                <span className="font-bold text-gray-800 dark:text-gray-100 text-base">{t('cafe.orderModal.orders')}</span>
                {orderItems.length > 0 && (
                  <span className="min-w-[18px] h-[18px] px-1 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 text-base font-bold rounded-full flex items-center justify-center leading-none">{orderItems.length}</span>
                )}
              </div>
              <span className="text-base font-bold text-orange-600 dark:text-orange-400">{fmt(calculateTotal())}</span>
            </div>

            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-2 py-2 space-y-1.5 min-h-0">
              {orderItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full select-none">
                  <ShoppingCart className="h-8 w-8 text-gray-200 dark:text-gray-700 mb-1" />
                  <p className="text-base text-gray-300 dark:text-gray-600">{t('cafe.orderModal.noItems')}</p>
                </div>
              ) : orderItems.map((item, idx) => {
                const compositeKey = item.variant ? `${item.menuItem}::${item.variant}::${item.price}` : `${item.menuItem}::${item.price}`;
                return (
                <div key={compositeKey + idx} ref={el => { itemRefsMap.current[compositeKey] = el as HTMLDivElement | null; if (!item.variant) itemRefsMap.current[item.menuItem] = el as HTMLDivElement | null; }}>
                  <OrderItemRow
                    item={item}
                    isFlash={flashId === compositeKey || flashId === item.menuItem}
                    isExpanded={!!expandedNotes[compositeKey]}
                    onMinus={() => setOrderItems(prev => { const cp=[...prev]; const it=cp[idx]; if(!it) return prev; const q=it.quantity-1; if(q<=0) cp.splice(idx,1); else cp[idx]={...it, quantity:q}; return cp; })}
                    onPlus={() => setOrderItems(prev => { const cp=[...prev]; const it=cp[idx]; if(!it) return prev; cp[idx]={...it, quantity:it.quantity+1}; return cp; })}
                    onRemove={() => setOrderItems(prev => prev.filter((_, i) => i !== idx))}
                    onToggleNote={() => setExpandedNotes(p => ({ ...p, [compositeKey]: !p[compositeKey] }))}
                    onNoteChange={v => setOrderItems(prev => { const cp=[...prev]; if(cp[idx]) cp[idx]={...cp[idx], notes:v}; return cp; })}
                    notePlaceholder={t('cafe.orderModal.itemNotesPlaceholder')}
                    fmt={fmt}
                    canEditPrice={canEditPrice}
                    onEditPrice={onEditPrice ? () => onEditPrice(idx, item) : undefined}
                  />
                </div>
                );
              })}
            </div>

            <div className="px-2 pt-2 pb-1 border-t border-gray-100 dark:border-gray-700 flex-shrink-0">
              <textarea value={orderNotes} onChange={e => setOrderNotes(e.target.value)}
                placeholder={t('cafe.orderModal.orderNotesPlaceholder')} rows={2}
                className="w-full text-base border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 resize-none focus:ring-1 focus:ring-orange-400 outline-none" />
            </div>

            <div className="px-2 pb-3 flex-shrink-0 space-y-1.5">
              <button onClick={onSaveAndSend} disabled={loading || orderItems.length === 0}
                className="w-full py-2.5 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold text-base rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed">
                {loading
                  ? <><svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>{t('cafe.orderModal.saving')}</>
                  : <><ChefHat className="h-3.5 w-3.5" />{t('cafe.orderModal.saveAndSend')}</>}
              </button>
              <div className="flex gap-1.5">
                <button onClick={onSave} disabled={loading || orderItems.length === 0}
                  className="flex-1 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-gray-50 text-gray-600 dark:text-gray-300 font-medium text-base rounded-lg flex items-center justify-center gap-1 transition-all disabled:opacity-50">
                  <CheckCircle className="h-3 w-3 text-green-500" />{t('cafe.orderModal.save')}
                </button>
                <button onClick={onSaveAndPrint} disabled={loading || orderItems.length === 0}
                  className="flex-1 py-2 border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 text-blue-600 dark:text-blue-400 font-medium text-base rounded-lg flex items-center justify-center gap-1 transition-all disabled:opacity-50">
                  <Printer className="h-3 w-3" />{t('cafe.orderModal.saveAndPrint')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
};

export default OrderModal;
