import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { X, Search, Save, ShoppingCart, Table as TableIcon, ChefHat, AlertTriangle, CheckCircle, Printer } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Bill, MenuItem, MenuSection, MenuCategory } from '../../services/api';
import { api } from '../../services/api';
import { formatCurrency as formatCurrencyUtil } from '../../utils/formatters';
import { useLanguage } from '../../context/LanguageContext';
import { getTableDisplay } from './tableHelpers';
import { ItemCard, OrderItemRow } from './OrderItems';
import ModalPortal from '../ModalPortal';
import PriceEditModal from './PriceEditModal';
import { useApp } from '../../context/AppContext';
import { canEditItemPrice } from '../../utils/permissionHelper';
import { printBill } from '../../utils/printBill';
import type { LocalOrderItem } from './tableHelpers';

interface AggregatedEditItem extends LocalOrderItem {}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  bill: Bill | null;
  menuItems: MenuItem[];
  menuSections: MenuSection[];
  menuCategories: MenuCategory[];
  onSuccess: (updatedBill: Bill) => void;
  getCategoriesForSection?: (sectionId: string) => MenuCategory[];
  getItemsForCategory?: (categoryId: string) => MenuItem[];
}

function createItemKey(name: string, price: number, menuItem?: string, variant?: string | null) {
  if (menuItem) return `mid:${menuItem}|${price}|${variant || ''}`;
  return `name:${name}|${price}|${variant || ''}`;
}

const BillItemsEditModal: React.FC<Props> = ({ isOpen, onClose, bill, menuItems, menuSections, menuCategories, onSuccess, getCategoriesForSection: propGetCats, getItemsForCategory: propGetItems }) => {
  const { t, i18n } = useTranslation();
  const { isRTL } = useLanguage();
  const [items, setItems] = useState<AggregatedEditItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inventoryErrors, setInventoryErrors] = useState<string[]>([]);
  const [fullBill, setFullBill] = useState<Bill | null>(null);
  const [loadingBill, setLoadingBill] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});
  const searchInputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const itemRefsMap = useRef<Record<string, HTMLDivElement | null>>({});
  const [flashId, setFlashId] = useState<string | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevLengthRef = useRef(items.length);

  const { user } = useApp() as any;
  const canEditPrice = canEditItemPrice(user);
  const [showPriceEditModal, setShowPriceEditModal] = useState(false);
  const [priceEditTarget, setPriceEditTarget] = useState<{ index: number; item: AggregatedEditItem } | null>(null);

  const curCurrency = useRef(localStorage.getItem('organizationCurrency') || 'EGP').current;
  const fmt = useCallback((n: number) => formatCurrencyUtil(n, i18n.language, curCurrency), [i18n.language, curCurrency]);
  const calculateTotal = useCallback(() => items.reduce((s, it) => s + it.price * it.quantity, 0), [items]);

  // Fetch full bill if needed
  useEffect(() => {
    if (!isOpen || !bill) { setFullBill(null); return; }
    const billId = (bill as any)._id || (bill as any).id;
    const orders = (bill as any).orders || [];
    const hasItems = orders.some((o: any) => o && typeof o === 'object' && o.items && o.items.length > 0);
    if (hasItems) { setFullBill(bill); return; }
    setLoadingBill(true);
    api.getBill(billId).then(res => {
      if (res.success && res.data) setFullBill(res.data);
      else setFullBill(bill);
    }).catch(() => setFullBill(bill)).finally(() => setLoadingBill(false));
  }, [isOpen, bill]);

  // Initialize aggregated items
  useEffect(() => {
    if (!isOpen || !fullBill) return;
    const orders = (fullBill as any).orders || [];
    const map = new Map<string, AggregatedEditItem>();
    for (const order of orders) {
      if (!order || typeof order !== 'object' || !order.items) continue;
      for (const it of order.items) {
        const menuItemId = it.menuItem?._id || it.menuItem || (typeof it.menuItem === 'string' ? it.menuItem : undefined);
        const mid = menuItemId ? String(menuItemId) : undefined;
        const variant = (it as any).variant || null;
        const key = createItemKey(it.name, it.price, mid, variant);
        const existing = map.get(key);
        if (existing) existing.quantity += it.quantity;
        else map.set(key, { menuItem: mid || it.name, name: it.name, price: it.price, quantity: it.quantity, notes: it.notes || undefined, variant } as any);
        const stored = map.get(key)!;
        if (mid) stored.menuItem = mid;
        (stored as any).variant = variant;
      }
    }
    // Normalize to LocalOrderItem: menuItem must be string id
    const normalized = Array.from(map.values()).map(it => ({
      menuItem: it.menuItem,
      name: it.name,
      price: it.price,
      quantity: it.quantity,
      notes: (it as any).notes,
      variant: (it as any).variant || null,
    } as any as LocalOrderItem));
    setItems(normalized);
    setError(null);
    setInventoryErrors([]);
    setSearchQuery('');
  }, [isOpen, fullBill]);

  useEffect(() => { searchInputRef.current?.focus(); }, [isOpen]);
  useEffect(() => () => { if (flashTimerRef.current) clearTimeout(flashTimerRef.current); }, []);

  // qtyMap for ItemCard badges
  const qtyMap = useMemo(() => {
    const map: Record<string, number> = {};
    items.forEach(i => { map[i.menuItem] = (map[i.menuItem] || 0) + i.quantity; });
    return map;
  }, [items]);
  const qtyByVariantMap = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    items.forEach(i => {
      const v = (i as any).variant || '';
      if (!v) return;
      if (!map[i.menuItem]) map[i.menuItem] = {};
      map[i.menuItem][v] = (map[i.menuItem][v] || 0) + i.quantity;
    });
    return map;
  }, [items]);

  // Sections / Categories logic identical to OrderModal - نسخ طبق الأصل لسرعة الجلب
  const activeSections = useMemo(() => menuSections.filter(s => s.isActive).sort((a, b) => a.sortOrder - b.sortOrder), [menuSections]);
  const [activeSectionId, setActiveSectionId] = useState<string>(() => menuSections.find(s => s.isActive)?._id || (menuSections.find(s => s.isActive) as any)?.id || '');
  useEffect(() => {
    if (!activeSectionId && activeSections.length > 0) {
      const firstId = (activeSections[0] as any).id || activeSections[0]._id;
      setActiveSectionId(String(firstId));
    }
  }, [activeSections, activeSectionId]);
  // عند فتح النافذة لو لسه activeSectionId فاضي حاول تظبطه فورا (نفس منطق OrderModal)
  useEffect(() => {
    if (isOpen && !activeSectionId && menuSections.length > 0) {
      const first = menuSections.find(s => s.isActive);
      if (first) setActiveSectionId(String((first as any).id || first._id));
    }
  }, [isOpen, menuSections, activeSectionId]);
  const [activeCategoryId, setActiveCategoryId] = useState<string>('all');
  useEffect(() => { setActiveCategoryId('all'); }, [activeSectionId]);

  const getCategoriesForSection = useCallback((sectionId: string) => {
    if (propGetCats) return propGetCats(sectionId);
    return menuCategories.filter(c => {
      const sec = (c as any).section;
      const secId = typeof sec === 'string' ? sec : sec?._id || sec?.id;
      return String(secId) === String(sectionId) && c.isActive;
    }).sort((a, b) => a.sortOrder - b.sortOrder);
  }, [menuCategories, propGetCats]);

  const getItemsForCategory = useCallback((catId: string) => {
    if (propGetItems) return propGetItems(catId);
    return menuItems.filter(mi => {
      const cat = (mi as any).category;
      const cId = typeof cat === 'string' ? cat : cat?._id || cat?.id;
      return String(cId) === String(catId) && mi.isAvailable;
    });
  }, [menuItems, propGetItems]);

  const activeSectionCategories = useMemo(() => {
    if (!activeSectionId) return [];
    return getCategoriesForSection(activeSectionId);
  }, [activeSectionId, getCategoriesForSection]);

  // نفس منطق OrderModal — جلب كامل موزع: أقسام → فئات → أصناف + بحث + fallback للمنيو الكامل
  const displayedItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q) return menuItems.filter(i => i.isAvailable && i.name.toLowerCase().includes(q));
    if (!activeSectionId) return menuItems.filter(i => i.isAvailable);
    const cats = activeCategoryId === 'all'
      ? getCategoriesForSection(activeSectionId)
      : getCategoriesForSection(activeSectionId).filter(c => c._id === activeCategoryId || (c as any).id === activeCategoryId);
    const catsItems = cats.flatMap(cat => getItemsForCategory((cat as any).id || cat._id));
    // لو القسم/الفئة فاضية لكن المنيو موجود، اعرض المنيو الكامل موزعاً
    if (catsItems.length === 0) return menuItems.filter(i => i.isAvailable);
    return catsItems;
  }, [searchQuery, activeSectionId, activeCategoryId, menuItems, getCategoriesForSection, getItemsForCategory]);

  // flash logic
  useEffect(() => {
    if (items.length > prevLengthRef.current) {
      const last = items[items.length - 1];
      if (last) {
        if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
        setFlashId(last.menuItem);
        flashTimerRef.current = setTimeout(() => setFlashId(null), 700);
        setTimeout(() => { itemRefsMap.current[last.menuItem]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, 30);
      }
    }
    prevLengthRef.current = items.length;
  }, [items.length]);

  const handleAddWithFlash = useCallback((menuItem: MenuItem, variant?: string | null) => {
    const id = (menuItem as any)._id || (menuItem as any).id;
    let effVariant: string | null = variant ? String(variant).trim() : null;
    let effPrice = menuItem.price;
    if (menuItem.variants && menuItem.variants.length > 0) {
      if (effVariant) {
        const matched = menuItem.variants.find(v => v.size === effVariant);
        if (matched) effPrice = matched.price;
        else { effVariant = menuItem.variants[0].size; effPrice = menuItem.variants[0].price; }
      } else { effVariant = menuItem.variants[0].size; effPrice = menuItem.variants[0].price; }
    }
    const flashKey = `${id}::${effVariant || ''}::${effPrice}`;
    setItems(prev => {
      const ex = prev.find(i => i.menuItem === id && (i as any).variant === effVariant && i.price === effPrice);
      if (ex) return prev.map(i => i.menuItem === id && (i as any).variant === effVariant && i.price === effPrice ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { menuItem: id, name: menuItem.name, price: effPrice, variant: effVariant, quantity: 1 } as any];
    });
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    setFlashId(flashKey);
    flashTimerRef.current = setTimeout(() => setFlashId(null), 700);
    setTimeout(() => { const el = itemRefsMap.current[flashKey] || itemRefsMap.current[id]; el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, 30);
  }, []);

  const updateItemQuantity = (menuItemId: string, delta: number) => {
    setItems(prev => {
      const next = prev.map(it => it.menuItem === menuItemId ? { ...it, quantity: it.quantity + delta } : it).filter(it => it.quantity > 0);
      return next;
    });
  };
  const removeItemFromOrder = (menuItemId: string) => {
    setItems(prev => prev.filter(it => it.menuItem !== menuItemId));
  };
  const updateItemNotes = (menuItemId: string, notes: string) => {
    setItems(prev => prev.map(it => it.menuItem === menuItemId ? { ...it, notes } : it));
  };

  const handlePriceEditSaveBill = (qty: number, newPrice: number) => {
    if (!priceEditTarget) return;
    const { index, item } = priceEditTarget;
    setItems(prev => {
      const cp = [...prev];
      let idx = index;
      if (!cp[idx] || cp[idx].menuItem !== item.menuItem || cp[idx].price !== item.price) {
        idx = cp.findIndex(i => i.menuItem === item.menuItem && i.price === item.price);
        if (idx === -1) return prev;
      }
      const target = cp[idx];
      if (qty >= target.quantity) {
        cp[idx] = { ...target, price: newPrice };
      } else {
        cp[idx] = { ...target, quantity: target.quantity - qty };
        const newItem = { menuItem: target.menuItem, name: target.name, price: newPrice, quantity: qty, notes: target.notes, variant: (target as any).variant || null } as AggregatedEditItem;
        cp.splice(idx + 1, 0, newItem);
      }
      return cp;
    });
  };

  const doSave = async (shouldPrint: boolean) => {
    const targetBill = fullBill || bill;
    if (!targetBill) return;
    setSaving(true);
    setError(null);
    setInventoryErrors([]);
    try {
      const billId = (targetBill as any)._id || (targetBill as any).id;
      const payloadItems = items.map(it => {
        const isObjectId = /^[a-f\d]{24}$/i.test(it.menuItem);
        if (isObjectId) {
          const payload: any = { menuItem: it.menuItem, quantity: it.quantity, notes: it.notes || undefined };
          if (it.price !== undefined) payload.price = it.price;
          if ((it as any).variant) payload.variant = (it as any).variant;
          return payload;
        }
        const payload: any = { name: it.name, price: it.price, quantity: it.quantity, notes: it.notes || undefined };
        if ((it as any).variant) payload.variant = (it as any).variant;
        return payload;
      });
      const res: any = await api.updateBillAggregatedItems(billId, { items: payloadItems });
      if (res.success) {
        onSuccess(res.data);
        if (shouldPrint) {
          try { await printBill(res.data, (user as any)?.organizationName || '', i18n.language, t); } catch {}
        }
        onClose();
      } else {
        setError(res.message || 'حدث خطأ أثناء حفظ التعديلات');
        if (res.errors) setInventoryErrors(res.errors);
        if (res.details) setInventoryErrors(res.details.map((d: any) => `${d.name}: المطلوب ${d.required} ${d.unit} المتوفر ${d.available}`));
        if (res.inventoryErrors) setInventoryErrors(res.inventoryErrors);
      }
    } catch (e: any) {
      const msg = e?.message || e?.data?.message || 'خطأ في حفظ التعديلات';
      setError(msg);
      if (e?.data?.errors) setInventoryErrors(e.data.errors);
      if (e?.data?.details) setInventoryErrors(e.data.details.map((d: any) => `${d.name}: المطلوب ${d.required} المتوفر ${d.available}`));
      if (e?.data?.inventoryErrors) setInventoryErrors(e.data.inventoryErrors);
    } finally {
      setSaving(false);
    }
  };
  const handleSave = () => doSave(false);
  const handleSaveAndPrint = () => doSave(true);

  if (!isOpen || !bill) return null;
  const displayBill = fullBill || bill;
  const tableNumber = (displayBill as any).table?.number || (displayBill as any).table || '';
  const billNumber = (displayBill as any).billNumber || '';

  return (
    <ModalPortal>
      {/* z-[310] ليظهر فوق نافذة الطاولة z-[300] */}
      <div className="fixed inset-0 z-[310] flex bg-black/50" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="bg-white dark:bg-gray-900 w-full flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>

          {/* HEADER - نفس OrderModal */}
          <div className="bg-gradient-to-r from-orange-500 to-red-500 px-4 py-3 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 bg-white/15 rounded-xl flex items-center justify-center ring-1 ring-white/25 flex-shrink-0">
                <ShoppingCart className="h-4 w-4 text-white" />
              </div>
              <div className="min-w-0">
                <h2 className="text-xl sm:text-2xl font-bold text-white truncate">تعديل أصناف الفاتورة #{billNumber}</h2>
                <p className="text-base text-orange-100 flex items-center gap-1">
                  <TableIcon className="h-3 w-3 flex-shrink-0" />
                  {tableNumber ? `طاولة ${getTableDisplay(tableNumber, i18n.language)}` : 'فاتورة'} · {items.length} أصناف
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {items.length > 0 && (
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

          {/* Error */}
          {error && (
            <div className="mx-2 mt-2 p-2 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg flex gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-red-700 dark:text-red-300 font-medium truncate">{error}</p>
                {inventoryErrors.length > 0 && (
                  <ul className="mt-1 list-disc pr-4 text-xs text-red-600 dark:text-red-400 space-y-0.5">
                    {inventoryErrors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                )}
              </div>
            </div>
          )}
          {loadingBill && (
            <div className="mx-2 mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 rounded-lg text-center text-sm text-blue-600">جاري تحميل الأصناف...</div>
          )}

          {/* BODY - 4 أعمدة نفس OrderModal */}
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
                    const catId = (cat as any)._id || (cat as any).id;
                    const isAct = activeCategoryId === catId;
                    const count = getItemsForCategory(catId).length;
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
                  {searchQuery ? 'نتائج البحث' : (activeSectionCategories.find(c => (c._id || (c as any).id) === activeCategoryId)?.name || activeSections.find(s => s.id === activeSectionId)?.name || 'الأصناف')}
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
                      <ItemCard key={item.id} item={item} qty={qtyMap[item.id] || 0} qtyByVariant={qtyByVariantMap[item.id]} onAdd={handleAddWithFlash} fmt={fmt} />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Col 4: Order - مجمع */}
            <div className="w-64 sm:w-72 flex-shrink-0 flex flex-col border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
              <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700 flex-shrink-0 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="w-1 h-4 bg-gradient-to-b from-green-400 to-emerald-500 rounded-full"></div>
                  <span className="font-bold text-gray-800 dark:text-gray-100 text-base">الأصناف المجمعة</span>
                  {items.length > 0 && (
                    <span className="min-w-[18px] h-[18px] px-1 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 text-base font-bold rounded-full flex items-center justify-center leading-none">{items.length}</span>
                  )}
                </div>
                <span className="text-base font-bold text-orange-600 dark:text-orange-400">{fmt(calculateTotal())}</span>
              </div>

              <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-2 py-2 space-y-1.5 min-h-0">
                {items.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full select-none">
                    <ShoppingCart className="h-8 w-8 text-gray-200 dark:text-gray-700 mb-1" />
                    <p className="text-base text-gray-300 dark:text-gray-600">لا توجد أصناف</p>
                    <p className="text-xs text-gray-400 mt-1">أضف من القائمة</p>
                  </div>
                ) : items.map((item, idx) => {
                  const compositeKey = `${item.menuItem}::${(item as any).variant || ''}::${item.price}`;
                  return (
                  <div key={compositeKey + idx} ref={el => { itemRefsMap.current[compositeKey] = el as HTMLDivElement | null; itemRefsMap.current[item.menuItem] = el as HTMLDivElement | null; }}>
                    <OrderItemRow
                      item={item}
                      isFlash={flashId === compositeKey || flashId === item.menuItem}
                      isExpanded={!!expandedNotes[compositeKey]}
                      onMinus={() => setItems(prev => { const cp=[...prev]; const it=cp[idx]; if(!it) return prev; const q=it.quantity-1; if(q<=0) cp.splice(idx,1); else cp[idx]={...it, quantity:q}; return cp; })}
                      onPlus={() => setItems(prev => { const cp=[...prev]; cp[idx]={...cp[idx], quantity:cp[idx].quantity+1}; return cp; })}
                      onRemove={() => setItems(prev => prev.filter((_, i) => i !== idx))}
                      onToggleNote={() => setExpandedNotes(p => ({ ...p, [compositeKey]: !p[compositeKey] }))}
                      onNoteChange={v => setItems(prev => { const cp=[...prev]; if(cp[idx]) cp[idx]={...cp[idx], notes:v}; return cp; })}
                      notePlaceholder={t('cafe.orderModal.itemNotesPlaceholder')}
                      fmt={fmt}
                      canEditPrice={canEditPrice}
                      onEditPrice={() => { setPriceEditTarget({ index: idx, item }); setShowPriceEditModal(true); }}
                      showVariantBadge={true}
                    />
                  </div>
                  );
                })}
              </div>

              <div className="px-3 py-3 flex-shrink-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                <div className="grid grid-cols-3 gap-2">
                  <button onClick={onClose} disabled={saving}
                    className="py-2.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 font-semibold text-sm rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-[0.98] disabled:opacity-50">
                    <X className="h-4 w-4" />إلغاء
                  </button>
                  <button onClick={handleSave} disabled={saving || loadingBill}
                    className="py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-1.5 shadow-md border border-blue-700 transition-all active:scale-[0.98] disabled:opacity-50">
                    {saving ? <><svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>جاري الحفظ...</> : <><Save className="h-4 w-4" />حفظ</>}
                  </button>
                  <button onClick={handleSaveAndPrint} disabled={saving || loadingBill}
                    className="py-2.5 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 active:from-orange-700 active:to-red-700 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-1.5 shadow-md border border-orange-600 transition-all active:scale-[0.98] disabled:opacity-50">
                    <Printer className="h-4 w-4" />حفظ وطباعة
                  </button>
                </div>
              </div>
              </div>
            </div>
          </div>
        </div>
        <PriceEditModal
          isOpen={showPriceEditModal}
          onClose={() => { setShowPriceEditModal(false); setPriceEditTarget(null); }}
          item={priceEditTarget?.item || null}
          onSave={handlePriceEditSaveBill}
          formatCurrency={fmt}
        />
      </ModalPortal>
  );
};

export default BillItemsEditModal;
