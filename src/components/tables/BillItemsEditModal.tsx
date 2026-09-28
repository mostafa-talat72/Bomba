import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { X, Search, Save, ShoppingCart, Table as TableIcon, AlertTriangle, CheckCircle, Printer, Plus, Trash2, Edit, ChefHat } from 'lucide-react';
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
import { canEditItemPrice, canApplyManualDiscount } from '../../utils/permissionHelper';
import { printBill } from '../../utils/printBill';
import type { LocalOrderItem } from './tableHelpers';
import { PaymentMethodSelect } from '../ui/PaymentMethodSelect';
import { DrawerSelect } from '../ui/DrawerSelect';
import { defaultDrawerForFulfillment, type CashDrawer } from '../../utils/paymentDrawer';
import { API_BASE_URL } from '../../utils/apiBase';
import {
  type DeviceCustomer,
  loadDeviceCustomers,
  digitsOf,
  scorePhoneVariants,
} from '../../utils/customerLookup';

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
  // طباعة التحضير بعد الحفظ (تيك أوي/دليفري) — الزر يظهر فقط عند تمريرها.
  onPrepPrint?: (bill: Bill) => void | Promise<void>;
  // طباعة مزدوجة: أي زر طباعة/دفع يطبع التحضير والفاتورة معاً (حسب إعداد الدليفري/التيك أوي)
  printBothTogether?: boolean;
}

function createItemKey(name: string, price: number, menuItem?: string, variant?: string | null) {
  if (menuItem) return `mid:${menuItem}|${price}|${variant || ''}`;
  return `name:${name}|${price}|${variant || ''}`;
}

const BillItemsEditModal: React.FC<Props> = ({ isOpen, onClose, bill, menuItems, menuSections, menuCategories, onSuccess, getCategoriesForSection: propGetCats, getItemsForCategory: propGetItems, onPrepPrint, printBothTogether = false }) => {
  const { t, i18n } = useTranslation();
  const { isRTL } = useLanguage();
  const [items, setItems] = useState<AggregatedEditItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inventoryErrors, setInventoryErrors] = useState<string[]>([]);
  const [fullBill, setFullBill] = useState<Bill | null>(null);
  const [loadingBill, setLoadingBill] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [billManualDiscount, setBillManualDiscount] = useState(0);
  const [billDiscountType, setBillDiscountType] = useState<'amount' | 'percent'>('percent');
  const [payMethod, setPayMethod] = useState<'cash' | 'card' | 'transfer' | 'e_wallet'>('cash');
  const [payDrawer, setPayDrawer] = useState<CashDrawer>('safe');
  // بيانات العميل (دليفري فقط) — قابلة للتعديل داخل النافذة.
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custAddress, setCustAddress] = useState('');
  const [custFee, setCustFee] = useState('');
  const custInitRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isOpen || !bill) { if (!bill) custInitRef.current = null; return; }
    const bid = String((bill as any)._id || (bill as any).id || '');
    if (bid && bid === custInitRef.current) return;
    custInitRef.current = bid || null;
    const b: any = bill;
    setCustName(b.deliveryInfo?.customerName || b.customerName || '');
    setCustPhone(b.deliveryInfo?.phone || b.customerPhone || '');
    setCustAddress(b.deliveryInfo?.address || '');
    const bf = b.deliveryInfo?.deliveryFee;
    setCustFee(bf === undefined || bf === null || bf === '' ? '' : String(bf));
  }, [isOpen, bill]);
  const isDeliveryBill = ((fullBill || bill) as any)?.fulfillmentType === 'delivery';

  // مناطق التوصيل (لاختيار المنطقة + رسومها داخل نافذة التعديل).
  const [custZones, setCustZones] = useState<Array<{ name: string; fee: number }>>([]);
  useEffect(() => {
    if (!isOpen || !isDeliveryBill || custZones.length > 0) return;
    let alive = true;
    (async () => {
      try {
        const res: any = await (api as any).getDeliveryZones?.();
        if (alive && res?.success && Array.isArray(res.data) && res.data.length > 0) {
          setCustZones(res.data.filter((z: any) => z && z.name));
          return;
        }
      } catch {}
      try {
        const local = JSON.parse(localStorage.getItem('deliveryZones') || '[]');
        if (alive && Array.isArray(local)) setCustZones(local.filter((z: any) => z && z.name));
      } catch {}
    })();
    return () => { alive = false; };
  }, [isOpen, isDeliveryBill]);

  const ZONE_SEP = ' - ';
  const detectCustZone = (addr: string): string => {
    const a = String(addr || '');
    const names = custZones.map(z => z.name).filter(Boolean).sort((x, y) => y.length - x.length);
    for (const zn of names) {
      if (a === zn || a.startsWith(zn + ZONE_SEP)) return zn;
      if (a.startsWith(zn) && /^[\s\-:]/.test(a.slice(zn.length))) return zn;
    }
    return '';
  };
  const stripCustZone = (addr: string): string => {
    const zn = detectCustZone(addr);
    if (!zn) return addr;
    if (addr === zn) return '';
    const p = zn + ZONE_SEP;
    if (addr.startsWith(p)) return addr.slice(p.length);
    return addr.slice(zn.length).replace(/^[\s\-:]+/, '');
  };
  const selectCustZone = (zoneName: string) => {
    const z = custZones.find(zz => zz.name === zoneName);
    const remainder = stripCustZone(custAddress);
    setCustAddress((zoneName ? zoneName + ZONE_SEP : '') + remainder);
    if (z) setCustFee(String(z.fee ?? ''));
  };

  // بحث العميل أثناء الكتابة (سجل السيرفر + المحلي) — كنافذة إنشاء الدليفري.
  const [custHits, setCustHits] = useState<DeviceCustomer[]>([]);
  useEffect(() => {
    if (!isOpen || !isDeliveryBill) return;
    const phoneQ = custPhone.trim();
    const nameQ = custName.trim();
    const hasPhone = digitsOf(phoneQ).length >= 2;
    const hasName = nameQ.length >= 2;
    if (!hasPhone && !hasName) { setCustHits([]); return; }
    const q = hasPhone ? phoneQ : nameQ;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/delivery-customers/search?q=${encodeURIComponent(q)}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
          signal: ctrl.signal,
        });
        const j: any = await res.json().catch(() => null);
        if (j?.success && Array.isArray(j.data)) {
          setCustHits(j.data.map((d: any) => ({
            name: d.customerName || '',
            phone: d.phone || '',
            address: d.address || '',
            count: d.orderCount || 1,
            lastUsed: d.updatedAt ? new Date(d.updatedAt).getTime() : Date.now(),
          })));
        }
      } catch {}
    }, 320);
    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [isOpen, isDeliveryBill, custPhone, custName]);

  type SugC = { phone: string; name: string; address: string; count: number; lastUsed: number };
  // قائمة مرتبة واحدة للعرض والملء معًا — الملء يأخذ أولها دائمًا.
  const buildCustSuggestions = (q: string, qn: string, hits: DeviceCustomer[]): SugC[] => {
    if (q.length < 2 && qn.length < 2) return [];
    const map = new Map<string, SugC>();
    for (const c of hits) {
      const key = digitsOf((c as any).phone);
      if (!key || map.has(key)) continue;
      map.set(key, { phone: key, name: String((c as any).name || ''), address: String((c as any).address || ''), count: Number((c as any).count) || 0, lastUsed: Number((c as any).lastUsed) || 0 });
    }
    for (const c of loadDeviceCustomers()) {
      const key = digitsOf(c.phone);
      if (!key || map.has(key)) continue;
      map.set(key, { phone: key, name: c.name || '', address: (c as any).address || '', count: c.count || 0, lastUsed: c.lastUsed || 0 });
    }
    const out: Array<SugC & { score: number }> = [];
    for (const r of map.values()) {
      const sc = q.length >= 2 ? scorePhoneVariants(r.phone, q) : null;
      const okPhone = sc !== null;
      const okName = q.length < 2 && qn.length >= 2 && r.name.includes(qn);
      if (!okPhone && !okName) continue;
      out.push({ ...r, score: sc !== null ? sc : 1000 });
    }
    out.sort((a, b) => a.score - b.score || b.count - a.count || b.lastUsed - a.lastUsed);
    return out.slice(0, 8);
  };
  const custSuggestions = useMemo(() => {
    if (!isOpen || !isDeliveryBill) return [];
    return buildCustSuggestions(digitsOf(custPhone), custName.trim(), custHits);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isDeliveryBill, custPhone, custName, custHits]);

  // آخر تعبئة تلقائية — المكتوب يدويًا لا يُمس.
  const custAutoRef = useRef<{ phone: string; name: string; address: string } | null>(null);
  // قائمة الاقتراحات لا تظهر إلا وحقل الهاتف مركّز.
  const [custPhoneFocused, setCustPhoneFocused] = useState(false);
  const handleCustPhoneChange = (v: string) => {
    const q = digitsOf(v);
    setCustPhone(v);
    if (!isDeliveryBill) return;
    if (q.length < 4) { custAutoRef.current = null; return; }
    const best = buildCustSuggestions(q, '', custHits)[0];
    if (!best) return;
    const prev = custAutoRef.current;
    setCustName(cur => (!cur.trim() || (!!prev && cur === prev.name) ? (best.name || cur) : cur));
    setCustAddress(cur => {
      if (!cur.trim()) return best.address || cur;
      if (!!prev && cur === prev.address) return best.address || cur;
      return cur;
    });
    custAutoRef.current = { phone: best.phone, name: best.name, address: best.address };
  };
  // نص النسبة المحلي — يسمح بالكتابة الحرة دون أن يعيد العرض الكتابة فوقها
  const [billPctText, setBillPctText] = useState<string | null>(null);
  // Mobile: tabbed view (menu | order) instead of 4 squeezed columns.
  const [mobileTab, setMobileTab] = useState<'menu' | 'order'>('menu');
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});
  const searchInputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const itemRefsMap = useRef<Record<string, HTMLDivElement | null>>({});
  const [flashId, setFlashId] = useState<string | null>(null);
  const [showServiceDialog, setShowServiceDialog] = useState(false);
  const [serviceName, setServiceName] = useState(t('billEdit.defaultServiceName'));
  const [serviceAmount, setServiceAmount] = useState('');
  const [serviceShowInPrint, setServiceShowInPrint] = useState(true);
  const [editingServiceIndex, setEditingServiceIndex] = useState<number | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevLengthRef = useRef(items.length);
  // حارس متزامن ضد الحفظ المزدوج: setSaving غير متزامن فقد تنفذ ضغطتان
  // متتاليتان قبل إعادة العرض — المرجع يمنع الثانية فوراً (كانت تنشئ فاتورتين بنفس الأصناف).
  const saveInFlightRef = useRef(false);
  // معرف الفاتورة المنشأة من المسودة: أي حفظ لاحق يُحدِّثها بدل إنشاء واحدة جديدة.
  const createdBillIdRef = useRef<string | null>(null);

  const { user } = useApp() as any;
  const canEditPrice = canEditItemPrice(user);
  const canApplyDiscount = canApplyManualDiscount(user);
  const [showPriceEditModal, setShowPriceEditModal] = useState(false);
  const [priceEditTarget, setPriceEditTarget] = useState<{ index: number; item: AggregatedEditItem } | null>(null);

  const curCurrency = useRef(localStorage.getItem('organizationCurrency') || 'EGP').current;
  // مفتاح صنف موحد عبر كل الأنواع: ObjectId / نص / كائن مدمج — يمنع تكرار السطور بدل دمج الكمية.
  const menuItemKey = (v: any): string => String(v?._id || v?.id || v || '');
  const fmt = useCallback((n: number) => formatCurrencyUtil(n, i18n.language, curCurrency), [i18n.language, curCurrency]);
  const calculateTotal = useCallback(() => items.reduce((s, it) => s + it.price * it.quantity, 0), [items]);
  // إعدادات الخصم الثابت من المنشأة — للفاتورة الجديدة (بلا طلبات محفوظة) قبل الحفظ
  const [orgFD, setOrgFD] = useState<any>(null);
  useEffect(() => {
    if (!isOpen) return;
    let alive = true;
    api.getOrganization().then((res: any) => {
      if (alive && res?.success && res?.data?.fixedDiscount) setOrgFD(res.data.fixedDiscount);
    }).catch(() => {});
    return () => { alive = false; };
  }, [isOpen]);
  useEffect(() => { setBillPctText(null); }, [billDiscountType]);
  // لو الإجمالي تغيّر (إضافة صنف) والنسبة مكتوبة — أعد حساب المبلغ من نفس النسبة
  const billTotalForPct = calculateTotal();
  useEffect(() => {
    if (billDiscountType !== 'percent') return;
    if (billPctText == null || billPctText === '') return;
    const raw = parseFloat(billPctText);
    if (!Number.isFinite(raw)) return;
    const pct = Math.min(100, Math.max(0, raw));
    const expect = Math.round((billTotalForPct * pct) / 100);
    if (expect !== billManualDiscount) setBillManualDiscount(expect);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [billTotalForPct]);

  // Fetch full bill if needed (draft bills live only locally until first save)
  const payDrawerBillRef = useRef<string | null>(null);
  useEffect(() => {
    createdBillIdRef.current = null;
    if (!isOpen || !bill) { setFullBill(null); return; }
    const bid = String((bill as any)?._id || (bill as any)?.id || '');
    if (bid && bid !== payDrawerBillRef.current) {
      payDrawerBillRef.current = bid;
      setPayDrawer(defaultDrawerForFulfillment((bill as any)?.fulfillmentType));
    }
    if ((bill as any).__isDraft) { setFullBill(bill); return; }
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
        const isService = (it as any).isService === true;
        const showInPrint = (it as any).showInPrint !== false;
        const key = isService ? `service:${it.name}|${it.price}|${showInPrint}` : createItemKey(it.name, it.price, mid, variant);
        const existing = map.get(key);
        if (existing) existing.quantity += it.quantity;
        else map.set(key, { menuItem: mid || it.name, name: it.name, price: it.price, quantity: it.quantity, notes: it.notes || undefined, variant, isService, showInPrint } as any);
        const stored = map.get(key)!;
        if (mid) stored.menuItem = mid;
        (stored as any).variant = variant;
        (stored as any).isService = isService;
        (stored as any).showInPrint = showInPrint;
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
      isService: (it as any).isService === true,
      showInPrint: (it as any).showInPrint !== false,
    } as any as LocalOrderItem));
    setItems(normalized);
    // حِمّل الخصم اليدوي المجمّع من الطلبات تلقائياً
    const aggManual = (orders as any[]).reduce((sum: number, o: any) => sum + (Number(o?.discount) || 0), 0);
    setBillManualDiscount(aggManual);
    setBillDiscountType('percent');
    setBillPctText(null);
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
      : getCategoriesForSection(activeSectionId).filter(c => String((c as any)._id || (c as any).id) === String(activeCategoryId));
    return cats.flatMap(cat => getItemsForCategory(String((cat as any)._id || (cat as any).id)));
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
      const ex = prev.find(i => menuItemKey(i.menuItem) === menuItemKey(id) && (i as any).variant === effVariant && i.price === effPrice);
      if (ex) return prev.map(i => menuItemKey(i.menuItem) === menuItemKey(id) && (i as any).variant === effVariant && i.price === effPrice ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { menuItem: id, name: menuItem.name, price: effPrice, variant: effVariant, quantity: 1 } as any];
    });
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    setFlashId(flashKey);
    flashTimerRef.current = setTimeout(() => setFlashId(null), 700);
    setTimeout(() => { const el = itemRefsMap.current[flashKey] || itemRefsMap.current[id]; el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, 30);
  }, []);

  const handlePriceEditSaveBill = (qty: number, newPrice: number) => {
    if (!priceEditTarget) return;
    const { index, item } = priceEditTarget;
    setItems(prev => {
      const cp = [...prev];
      let idx = index;
      if (!cp[idx] || menuItemKey(cp[idx].menuItem) !== menuItemKey(item.menuItem) || cp[idx].price !== item.price) {
        idx = cp.findIndex(i => menuItemKey(i.menuItem) === menuItemKey(item.menuItem) && i.price === item.price);
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

  const doSave = async ({ shouldPrint = false, shouldPayFull = false, shouldPrepPrint = false }: { shouldPrint?: boolean; shouldPayFull?: boolean; shouldPrepPrint?: boolean } = {}) => {
    if (saveInFlightRef.current) return;
    const targetBill = fullBill || bill;
    if (!targetBill) return;
    // تحقق بيانات العميل للدليفري — كشرط نافذة الإنشاء (هاتف + عنوان).
    if (isDeliveryBill && (!custPhone.trim() || !custAddress.trim())) {
      setError(t('billEdit.custRequired', 'بيانات العميل ناقصة: رقم الهاتف والعنوان مطلوبان لحفظ فاتورة الدليفري'));
      return;
    }
    saveInFlightRef.current = true;
    setSaving(true);
    setError(null);
    setInventoryErrors([]);
    try {
      const isDraft = !createdBillIdRef.current && !!(targetBill as any).__isDraft;
      let billId = createdBillIdRef.current || (targetBill as any)._id || (targetBill as any).id;
      const payloadItems = items.map(it => {
        const isObjectId = /^[a-f\d]{24}$/i.test(it.menuItem) && !(it as any).isService;
        if (isObjectId) {
          const payload: any = { menuItem: it.menuItem, quantity: it.quantity, notes: it.notes || undefined };
          if (it.price !== undefined) payload.price = it.price;
          if ((it as any).variant) payload.variant = (it as any).variant;
          return payload;
        }
        if ((it as any).isService) {
          return { name: it.name, price: it.price, quantity: it.quantity, isService: true, showInPrint: (it as any).showInPrint === true };
        }
        const payload: any = { name: it.name, price: it.price, quantity: it.quantity, notes: it.notes || undefined };
        if ((it as any).variant) payload.variant = (it as any).variant;
        return payload;
      });
      if (isDraft) {
        // Draft bills are created on the server only at first save — nothing
        // is persisted (and no bill number consumed) before this point.
        if (payloadItems.length === 0) { onClose(); return; }
        const tb: any = targetBill as any;
        const tbIsDelivery = (tb.fulfillmentType || (bill as any)?.fulfillmentType) === 'delivery';
        const created: any = await api.createBill({
          fulfillmentType: tb.fulfillmentType || 'takeaway',
          billType: tb.billType || 'cafe',
          customerName: (tbIsDelivery && custName.trim()) || tb.customerName || undefined,
          customerPhone: (tbIsDelivery && custPhone.trim()) || tb.customerPhone || undefined,
          table: tb.table || undefined,
          notes: tb.notes || undefined,
          deliveryInfo: tbIsDelivery
            ? { ...(tb.deliveryInfo || {}), customerName: custName.trim() || tb.deliveryInfo?.customerName || tb.customerName || undefined, phone: custPhone.trim() || tb.deliveryInfo?.phone || tb.customerPhone || undefined, address: custAddress.trim() || tb.deliveryInfo?.address || undefined, ...(custFee.trim() === '' ? {} : { deliveryFee: Math.max(0, Number(custFee) || 0) }) }
            : (tb.deliveryInfo || undefined),
        } as any);
        if (!created?.success || !created?.data) {
          setError(created?.message || t('billEdit.saveError'));
          return;
        }
        billId = created.data._id || created.data.id;
        // المسودة أصبحت فاتورة حقيقية: احفظ معرفها حتى لا ينشئ أي حفظ لاحق
        // (إعادة بعد فشل التحديث مثلاً) فاتورة ثانية — يُحدَّث نفس السجل.
        createdBillIdRef.current = billId;
      }
      const res: any = await api.updateBillAggregatedItems(billId, {
        items: payloadItems,
        discount: billManualDiscount,
        ...(isDeliveryBill ? { customerName: custName.trim(), customerPhone: custPhone.trim(), address: custAddress.trim(), deliveryFee: custFee.trim() === '' ? undefined : Math.max(0, Number(custFee) || 0) } : {}),
      });
      if (!res.success) {
        setError(res.message || t('billEdit.saveError'));
        if (res.errors) setInventoryErrors(res.errors);
        if (res.details) setInventoryErrors(res.details.map((d: any) => t('billEdit.inventoryDetail', { name: d.name, required: d.required, unit: d.unit, available: d.available })));
        if (res.inventoryErrors) setInventoryErrors(res.inventoryErrors);
        return;
      }

      let finalBill = res.data || targetBill;

      if (shouldPayFull) {
        const remaining = Number(finalBill?.remaining ?? 0);
        if (remaining > 0) {
          const paymentRes: any = await api.updatePayment(billId, {
            paid: Number(finalBill?.paid || 0) + remaining,
            remaining: 0,
            status: 'paid',
            paymentAmount: remaining,
            method: payMethod,
            drawer: payDrawer,
            reference: '',
          } as any);

          if (paymentRes?.success && paymentRes.data) {
            finalBill = paymentRes.data;
            // استجابة الدفع قد تصل بلا تفاصيل الأصناف — أعد الجلب الكامل
            // قبل التحديث والطباعة (يصلح التحضير والفاتورة معاً)
            try {
              const fresh: any = await api.getBill(billId);
              if (fresh?.success && fresh.data) finalBill = fresh.data;
            } catch {}
          } else {
            setError(paymentRes?.message || t('billEdit.fullPayError'));
            return;
          }
        }
      }

      onSuccess(finalBill);
      // الطباعة المزدوجة: أي زر طباعة/تحضير/دفع يطبع المستندين معاً عند تفعيل الخيار
      const printBillNow = shouldPrint || (printBothTogether && (shouldPrepPrint || shouldPayFull));
      const prepNow = shouldPrepPrint || (printBothTogether && (shouldPrint || shouldPayFull));
      if (printBillNow) {
        try { await printBill(finalBill, (user as any)?.organizationName || '', i18n.language, t); } catch {}
      }
      if (prepNow) {
        try { await onPrepPrint?.(finalBill); } catch {}
      }
      onClose();
    } catch (e: any) {
      const msg = e?.message || e?.data?.message || t('billEdit.saveFailed');
      setError(msg);
      if (e?.data?.errors) setInventoryErrors(e.data.errors);
      if (e?.data?.details) setInventoryErrors(e.data.details.map((d: any) => t('billEdit.inventoryDetailNoUnit', { name: d.name, required: d.required, available: d.available })));
      if (e?.data?.inventoryErrors) setInventoryErrors(e.data.inventoryErrors);
    } finally {
      saveInFlightRef.current = false;
      setSaving(false);
    }
  };
  const handleSave = () => doSave({ shouldPrint: false, shouldPayFull: false });
  const handleSaveAndPrint = () => doSave({ shouldPrint: true, shouldPayFull: false });
  const handleSaveAndPayFull = () => doSave({ shouldPrint: false, shouldPayFull: true });
  const handleSaveAndPrepPrint = () => doSave({ shouldPrint: false, shouldPayFull: false, shouldPrepPrint: true });
  const saveService = () => {
    const amount = Number(serviceAmount);
    if (!serviceName.trim() || !Number.isFinite(amount) || amount < 0) return;
    setItems(prev => {
      const current = editingServiceIndex === null ? null : prev[editingServiceIndex];
      const service = { menuItem: current?.menuItem || `service-${Date.now()}`, name: serviceName.trim(), price: amount, quantity: current?.quantity || 1, isService: true, showInPrint: serviceShowInPrint } as any;
      return editingServiceIndex === null ? [...prev, service] : prev.map((item, index) => index === editingServiceIndex ? service : item);
    });
    setServiceName(t('billEdit.defaultServiceName')); setServiceAmount(''); setServiceShowInPrint(true); setEditingServiceIndex(null); setShowServiceDialog(false);
  };
  const openServiceEditor = (index: number) => {
    const service = items[index] as any;
    setEditingServiceIndex(index);
    setServiceName(service.name || t('billEdit.defaultServiceName'));
    setServiceAmount(String(service.price ?? ''));
    setServiceShowInPrint(service.showInPrint !== false);
    setShowServiceDialog(true);
  };

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
          <div className="bg-gradient-to-r from-orange-500 to-red-500 px-3 py-2 sm:px-4 sm:py-3 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="w-8 h-8 sm:w-9 sm:h-9 bg-white/15 rounded-xl flex items-center justify-center ring-1 ring-white/25 flex-shrink-0">
                <ShoppingCart className="h-4 w-4 text-white" />
              </div>
              <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 flex justify-end">
                <button onClick={() => setShowServiceDialog(true)} className="group px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-md shadow-indigo-500/20 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0">
                  <span className="flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-lg bg-white/20 transition-transform group-hover:rotate-90"><Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" /></span>
                  <span>{t('billEdit.addService')}</span>
                </button>
              </div>
              <div className="min-w-0">
                <h2 className="text-lg sm:text-2xl font-bold text-white truncate">{(displayBill as any).__isDraft ? t('billEdit.newTitle', 'فاتورة جديدة') : t('billEdit.title', { billNumber })}</h2>
                <p className="text-sm sm:text-base text-orange-100 flex items-center gap-1">
                  <TableIcon className="h-3 w-3 flex-shrink-0" />
                  {tableNumber ? t('billEdit.tableLabel', { table: getTableDisplay(tableNumber, i18n.language) }) : t('billEdit.billLabel')} · {t('billEdit.itemsCount', { count: items.length })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {items.length > 0 && (
                <div className="bg-white/15 rounded-xl px-2.5 py-1 sm:px-3 sm:py-1.5 ring-1 ring-white/25 text-center min-w-[230px] sm:min-w-[280px]">
                  {(() => {
                    const subtotal = calculateTotal();
                    const billSecKey = (bill as any)?.fulfillmentType === 'takeaway' ? 'takeaway' : (bill as any)?.fulfillmentType === 'delivery' ? 'delivery' : 'tables';
                    const savedCfg = ((bill as any)?.orders || []).reduce((acc: any, o: any) => {
                      const p = Number(o?.fixedDiscount?.percentage) || 0;
                      if (p > acc.pct) { acc.pct = p; acc.cap = Number(o?.fixedDiscount?.maxCap) || Infinity; }
                      return acc;
                    }, { pct: 0, cap: Infinity });
                    const orgPct = orgFD?.enabled ? (orgFD?.sections?.[billSecKey] || orgFD?.percentage || 0) : 0;
                    const fdPct = orgPct > 0 ? orgPct : savedCfg.pct;
                    const fdCap = orgPct > 0 ? (orgFD?.maxCap || Infinity) : savedCfg.cap;
                    const totalFD = fdPct > 0 ? Math.min(Math.round((subtotal * fdPct) / 100), fdCap) : 0;
                    const totalAll = totalFD + (billManualDiscount || 0);
                    const final = Math.max(0, subtotal - totalAll);
                    // الرسوم الحية من الحقل (منطقة/يدوي) — والمحفوظة قبل أي تعديل.
                    const savedFee = Number((displayBill as any)?.deliveryInfo?.deliveryFee) || 0;
                    const deliveryFee = isDeliveryBill
                      ? (custFee.trim() === '' ? savedFee : (Number(custFee) || 0))
                      : savedFee;
                    const feeLine = deliveryFee > 0 ? (
                      <div className="text-xs sm:text-sm font-bold text-sky-200 whitespace-nowrap mt-0.5">🚚 {t('billEdit.deliveryFee', { amount: fmt(deliveryFee), defaultValue: `رسوم التوصيل: ${fmt(deliveryFee)}` })}</div>
                    ) : null;
                    if (totalAll > 0) {
                      return (
                        <>
                          <div className="flex items-center justify-center gap-2 sm:gap-3">
                            <span className="text-base sm:text-lg font-bold text-white/85 line-through whitespace-nowrap">{fmt(subtotal)}</span>
                            <span className="text-base sm:text-lg font-bold text-yellow-200 whitespace-nowrap">{t('billEdit.discount', { amount: fmt(totalAll) })}</span>
                            <span className="text-base sm:text-lg font-bold text-white whitespace-nowrap">{t('billEdit.net', { amount: fmt(final) })}</span>
                          </div>
                          {feeLine}
                        </>
                      );
                    }
                    return (
                      <>
                        <p className="text-base sm:text-lg font-bold text-white whitespace-nowrap">
                          <span className="text-sm sm:text-base font-medium text-orange-100">{t('billEdit.total')}: </span>
                          {fmt(subtotal)}
                        </p>
                        {feeLine}
                      </>
                    );
                  })()}
                </div>
              )}
              <button onClick={onClose} className="w-8 h-8 bg-white/15 hover:bg-white/25 rounded-xl flex items-center justify-center text-white ring-1 ring-white/25 transition-all">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Mobile tabs: menu | order */}
          <div className="lg:hidden flex-shrink-0 grid grid-cols-2 gap-1 p-1.5 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={() => setMobileTab('menu')}
              className={`py-2 rounded-lg text-sm font-bold transition-all ${mobileTab === 'menu' ? 'bg-white dark:bg-gray-700 text-orange-600 dark:text-orange-400 shadow' : 'text-gray-500 dark:text-gray-400'}`}
            >
              {t('billEdit.menuTab')}
            </button>
            <button
              type="button"
              onClick={() => setMobileTab('order')}
              className={`py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${mobileTab === 'order' ? 'bg-white dark:bg-gray-700 text-green-700 dark:text-green-400 shadow' : 'text-gray-500 dark:text-gray-400'}`}
            >
              {t('billEdit.orderTab')}
              {items.length > 0 && (
                <span className="min-w-[20px] h-5 px-1 bg-green-500 text-white text-xs font-bold rounded-full flex items-center justify-center leading-none">{items.length}</span>
              )}
            </button>
          </div>

          {/* تنبيه: تعديل فاتورة مدفوعة — سيعاد حساب المتبقي/الحالة تلقائياً */}
          {((fullBill as any)?.status || (bill as any)?.status) === 'paid' && (
            <div className="mx-2 mt-2 p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg text-center text-xs text-amber-700 dark:text-amber-300 font-medium">
              {t('billEdit.paidNotice')}
            </div>
          )}

          {/* بيانات العميل — دليفري فقط: صف واحد مدمج */}
          {isDeliveryBill && (
            <div className="mx-2 mt-2 px-2 py-1.5 bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-700 rounded-lg flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
              <span className="flex-shrink-0 text-[11px] font-bold text-sky-700 dark:text-sky-300 whitespace-nowrap">👤 {t('billEdit.customerTitle', 'بيانات العميل')}</span>
              <input
                type="text"
                value={custName}
                onChange={e => setCustName(e.target.value)}
                placeholder={t('billEdit.custName', 'اسم العميل')}
                className="flex-1 min-w-[90px] px-2 py-1.5 text-sm border border-sky-200 dark:border-sky-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:ring-1 focus:ring-sky-500"
              />
              <div className="flex-1 min-w-[100px] relative">
                <input
                  type="text"
                  inputMode="tel"
                  dir="ltr"
                  value={custPhone}
                  onChange={e => handleCustPhoneChange(e.target.value)}
                  onFocus={() => setCustPhoneFocused(true)}
                  onBlur={() => setTimeout(() => setCustPhoneFocused(false), 150)}
                  placeholder={t('billEdit.custPhone', 'رقم الهاتف')}
                  className="w-full px-2 py-1.5 text-sm border border-sky-200 dark:border-sky-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:ring-1 focus:ring-sky-500"
                />
                {custPhoneFocused && custSuggestions.length > 0 && (
                  <div className="absolute z-30 left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-xl border border-violet-200 dark:border-violet-800 bg-white dark:bg-gray-900 shadow-xl">
                    {custSuggestions.map((c) => (
                      <button
                        key={c.phone}
                        type="button"
                        onClick={() => {
                          custAutoRef.current = { phone: c.phone, name: c.name, address: c.address };
                          setCustPhone(c.phone);
                          setCustName(cur => (!cur.trim() ? (c.name || cur) : cur));
                          setCustAddress(cur => (!cur.trim() ? (c.address || cur) : cur));
                        }}
                        className="w-full text-right px-3 py-2 hover:bg-violet-50 dark:hover:bg-violet-900/30 text-sm border-b border-violet-100 dark:border-violet-800 last:border-b-0"
                      >
                        <span className="font-bold text-gray-800 dark:text-gray-100">📱 {c.name || c.phone}</span>
                        <span className="text-gray-500 dark:text-gray-400 text-xs mr-2" dir="ltr">{c.phone}</span>
                        {c.count > 1 && <span className="text-violet-600 dark:text-violet-300 text-xs mr-2">{t('delivery.form.orderCount', { count: c.count })}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <select
                value={detectCustZone(custAddress)}
                onChange={e => selectCustZone(e.target.value)}
                title={t('delivery.form.zonePlaceholder', 'المنطقة')}
                className="w-24 sm:w-28 flex-shrink-0 px-2 py-1.5 text-sm border border-sky-200 dark:border-sky-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:ring-1 focus:ring-sky-500"
              >
                <option value="">{t('delivery.form.zonePlaceholder', 'المنطقة')}</option>
                {custZones.map(z => <option key={z.name} value={z.name}>{z.name}</option>)}
              </select>
              <input
                type="text"
                value={custAddress}
                onChange={e => setCustAddress(e.target.value)}
                placeholder={t('billEdit.custAddress', 'العنوان')}
                className="flex-[2] min-w-[110px] px-2 py-1.5 text-sm border border-sky-200 dark:border-sky-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:ring-1 focus:ring-sky-500"
              />
              <span className="flex-shrink-0 inline-flex items-center gap-1" title={t('billEdit.deliveryFeeShort', 'رسوم')}>
                <span className="text-sm leading-none">🚚</span>
                <input
                  type="number"
                  min="0"
                  dir="ltr"
                  value={custFee}
                  onChange={e => setCustFee(e.target.value)}
                  placeholder="0"
                  className="w-16 sm:w-20 px-2 py-1.5 text-sm border border-sky-200 dark:border-sky-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:ring-1 focus:ring-sky-500"
                />
              </span>
            </div>
          )}

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
            <div className="mx-2 mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 rounded-lg text-center text-sm text-blue-600">{t('billEdit.loadingItems')}</div>
          )}

          {/* BODY - 4 أعمدة نفس OrderModal */}
          <div className="flex-1 flex overflow-hidden min-h-0">

            {/* Col 1: Sections (desktop columns; chips on mobile) */}
            {!searchQuery.trim() && (
              <div className="w-24 lg:w-28 flex-shrink-0 hidden lg:flex flex-col border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                <div className="px-2 py-2 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
                  <p className="text-base font-semibold text-gray-400 dark:text-gray-500 text-center">{t('billEdit.sections')}</p>
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

            {/* Col 2: Categories (desktop columns; chips on mobile) */}
            {!searchQuery.trim() && activeSectionCategories.length > 1 && (
              <div className="w-24 lg:w-28 flex-shrink-0 hidden lg:flex flex-col border-l border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                <div className="px-2 py-2 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
                  <p className="text-base font-semibold text-gray-400 dark:text-gray-500 text-center">{t('billEdit.categories')}</p>
                </div>
                <div className="flex-1 overflow-y-auto py-1.5 px-1.5 space-y-1">
                  <button onClick={() => setActiveCategoryId('all')}
                    className={`w-full px-2 py-2 rounded-lg text-base font-medium transition-all text-right ${activeCategoryId === 'all' ? 'bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                    {t('billEdit.all')}
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
            <div className={`flex-1 flex-col min-h-0 min-w-0 bg-gray-50 dark:bg-gray-900 ${mobileTab === 'menu' ? 'flex' : 'hidden'} lg:flex`}>
              {/* Mobile chips: sections + categories */}
              {!searchQuery.trim() && (
                <div className="lg:hidden flex-shrink-0 px-2 pt-2 space-y-1.5">
                  <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                    {activeSections.map(sec => {
                      const hasCats = getCategoriesForSection(sec.id).length > 0;
                      if (!hasCats) return null;
                      const isAct = activeSectionId === sec.id;
                      return (
                        <button key={sec.id} onClick={() => setActiveSectionId(sec.id)}
                          className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-bold whitespace-nowrap transition-all ${isAct ? 'bg-orange-500 text-white shadow' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700'}`}>
                          {sec.name}
                        </button>
                      );
                    })}
                  </div>
                  {activeSectionCategories.length > 1 && (
                    <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                      <button onClick={() => setActiveCategoryId('all')}
                        className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${activeCategoryId === 'all' ? 'bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 shadow' : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700'}`}>
                        {t('billEdit.all')}
                      </button>
                      {activeSectionCategories.map(cat => {
                        const catId = (cat as any)._id || (cat as any).id;
                        const isAct = activeCategoryId === catId;
                        const count = getItemsForCategory(catId).length;
                        if (count === 0) return null;
                        return (
                          <button key={catId} onClick={() => setActiveCategoryId(catId)}
                            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${isAct ? 'bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 shadow' : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700'}`}>
                            {cat.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
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
                    {searchQuery ? t('billEdit.searchResults') : (activeSectionCategories.find(c => (c._id || (c as any).id) === activeCategoryId)?.name || activeSections.find(s => s.id === activeSectionId)?.name || t('billEdit.menuTab'))}
                </p>
                {displayedItems.length > 0 && <span className="text-base text-gray-400">{displayedItems.length}</span>}
              </div>
              <div className="flex-1 overflow-y-auto p-1.5 min-h-0">
                {displayedItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-300 dark:text-gray-600 select-none">
                    <Search className="h-8 w-8 mb-2 opacity-30" />
                    <p className="text-base">{searchQuery ? t('cafe.orderModal.noResults') : t('billEdit.chooseSection')}</p>
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
            <div className={`w-full lg:w-80 xl:w-96 flex-shrink-0 flex-col border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 ${mobileTab === 'order' ? 'flex flex-1 min-h-0' : 'hidden'} lg:flex`}>
              <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700 flex-shrink-0 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="w-1 h-4 bg-gradient-to-b from-green-400 to-emerald-500 rounded-full"></div>
                  <span className="font-bold text-gray-800 dark:text-gray-100 text-base">{t('billEdit.orderTab')}</span>
                  {items.length > 0 && (
                    <span className="min-w-[18px] h-[18px] px-1 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 text-base font-bold rounded-full flex items-center justify-center leading-none">{items.length}</span>
                  )}
                </div>
                <span className="text-base font-bold text-orange-600 dark:text-orange-400">{fmt(calculateTotal())}</span>
              </div>

              <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-2 py-2 space-y-1.5 min-h-0 pb-28">
                {items.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full select-none">
                    <ShoppingCart className="h-8 w-8 text-gray-200 dark:text-gray-700 mb-1" />
                    <p className="text-base text-gray-300 dark:text-gray-600">{t('billEdit.noItems')}</p>
                    <p className="text-xs text-gray-400 mt-1">{t('billEdit.addFromMenu')}</p>
                  </div>
                ) : items.map((item, idx) => {
                  const compositeKey = `${item.menuItem}::${(item as any).variant || ''}::${item.price}`;
                  const itemVariant = (item as any).variant || null;
                  return (
                  <div key={compositeKey + idx} ref={el => { itemRefsMap.current[compositeKey] = el as HTMLDivElement | null; itemRefsMap.current[item.menuItem] = el as HTMLDivElement | null; }}>
                    {(item as any).isService && <div className="flex items-center gap-2 text-indigo-600 text-xs font-bold">{t('billEdit.defaultServiceName')} <button onClick={() => openServiceEditor(idx)} className="rounded-md p-1 text-indigo-600 hover:bg-indigo-100 dark:hover:bg-indigo-900/40" title={t('billEdit.editServiceTitle')}><Edit className="h-4 w-4" /></button><button onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))} className="mr-auto text-red-500" title={t('billEdit.deleteServiceTitle')}><Trash2 className="h-4 w-4" /></button></div>}
                    <OrderItemRow
                      item={item}
                      isFlash={flashId === compositeKey || flashId === item.menuItem}
                      isExpanded={!!expandedNotes[compositeKey]}
                      onMinus={() => setItems(prev => { const cp=[...prev]; const it=cp[idx]; if(!it) return prev; const q=it.quantity-1; if(q<=0) cp.splice(idx,1); else cp[idx]={...it, quantity:q}; return cp; })}
                      onPlus={() => setItems(prev => { const cp=[...prev]; cp[idx]={...cp[idx], quantity:cp[idx].quantity+1}; return cp; })}
                      onQuantityChange={v => setItems(prev => { const cp=[...prev]; if(cp[idx]) cp[idx]={...cp[idx], quantity:v}; return cp; })}
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

              <div className="sticky bottom-0 z-10 px-3 py-3 flex-shrink-0 bg-white/95 dark:bg-gray-800/95 border-t border-gray-200 dark:border-gray-700">
                {canApplyDiscount ? (
                <div className="mb-3 p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-700">
                  <label className="text-xs font-bold text-purple-700 dark:text-purple-300 block mb-1">{t('billEdit.manualDiscount', 'الخصم اليدوي المجمع')}</label>
                  <div className="flex items-center gap-1.5">
                    {billDiscountType === 'percent' ? (
                    <input
                      type="text"
                      inputMode="decimal"
                      dir="ltr"
                      value={billPctText ?? (billManualDiscount > 0 && calculateTotal() > 0 ? ((billManualDiscount / calculateTotal()) * 100).toFixed(1).replace(/\.0$/, '') : '')}
                      onChange={e => {
                        const text = e.target.value.replace(/[^0-9.]/g, '');
                        const parts = text.split('.');
                        const clean = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : text;
                        setBillPctText(clean);
                        const raw = parseFloat(clean);
                        if (!Number.isFinite(raw)) { setBillManualDiscount(0); return; }
                        const pct = Math.min(100, Math.max(0, raw));
                        const total = calculateTotal() || 0;
                        setBillManualDiscount(Math.round((total * pct) / 100));
                      }}
                      onBlur={() => setBillPctText(null)}
                      placeholder="0%"
                      className="flex-1 text-sm border border-purple-300 dark:border-purple-600 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-purple-500 outline-none"
                    />
                    ) : (
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={billManualDiscount || ''}
                      onChange={e => {
                        const raw = parseFloat(e.target.value) || 0;
                        setBillManualDiscount(Math.max(0, Math.round(raw)));
                      }}
                      placeholder="0"
                      className="flex-1 text-sm border border-purple-300 dark:border-purple-600 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-purple-500 outline-none"
                    />
                    )}
                    <button
                      type="button"
                      onClick={() => { setBillPctText(null); setBillDiscountType(billDiscountType === 'amount' ? 'percent' : 'amount'); }}
                      className={`px-2 py-1 text-xs font-bold rounded-lg border transition-colors ${billDiscountType === 'percent' ? 'bg-purple-100 dark:bg-purple-800 text-purple-700 dark:text-purple-200 border-purple-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600'}`}
                    >
                      {billDiscountType === 'percent' ? '%' : t('billEdit.currency')}
                    </button>
                  </div>
                  {billManualDiscount > 0 && (
                    <div className="mt-1 text-[10px] text-purple-600 dark:text-purple-400 font-bold">{t('billEdit.manualSummary', { amount: fmt(billManualDiscount), pct: ((billManualDiscount / (calculateTotal() || 1)) * 100).toFixed(1) })}</div>
                  )}
                </div>
                ) : billManualDiscount > 0 ? (
                <div className="mb-3 p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-700">
                  <div className="text-xs font-bold text-purple-700 dark:text-purple-300">{t('billEdit.manualDiscount', 'الخصم اليدوي المجمع')}: {fmt(billManualDiscount)}</div>
                </div>
                ) : null}
                <div className="space-y-3">
                  {onPrepPrint && !printBothTogether && (
                    <button onClick={handleSaveAndPrepPrint} disabled={saving || loadingBill}
                      className="w-full min-h-[46px] py-2.5 bg-white hover:bg-orange-50 dark:bg-gray-900 dark:hover:bg-gray-800 text-orange-600 dark:text-orange-400 font-bold text-sm rounded-xl flex items-center justify-center gap-1.5 shadow-md border border-orange-300 dark:border-orange-800 transition-all active:scale-[0.98] disabled:opacity-50">
                      <ChefHat className="h-4 w-4" />{t('billEdit.savePrintOrders')}
                    </button>
                  )}
<div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <PaymentMethodSelect
                        value={payMethod}
                        onChange={setPayMethod}
                        className="flex-1"
                        showLabels={true}
                      />
                      <DrawerSelect
                        value={payDrawer}
                        onChange={setPayDrawer}
                        className="flex-1"
                        showLabels={true}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={handleSave} disabled={saving || loadingBill}
                        className="min-h-[46px] py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-1.5 shadow-md border border-blue-700 transition-all active:scale-[0.98] disabled:opacity-50">
                        {saving
                          ? <><svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>{t('billEdit.saving')}</>
                          : <><Save className="h-4 w-4" />{t('billEdit.save')}</>}
                      </button>
                      <button onClick={handleSaveAndPrint} disabled={saving || loadingBill}
                        className="min-h-[46px] py-2.5 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 active:from-orange-700 active:to-red-700 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-1.5 shadow-md border border-orange-600 transition-all active:scale-[0.98] disabled:opacity-50">
                          <Printer className="h-4 w-4" />{printBothTogether ? t('billEdit.savePrintAll') : t('billEdit.savePrintBill')}
                        </button>
                        </div>
                        <button onClick={handleSaveAndPayFull} disabled={saving || loadingBill}
                          className="w-full min-h-[50px] py-3 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:from-orange-600 hover:via-amber-600 hover:to-orange-700 active:from-orange-700 active:via-amber-700 active:to-orange-800 text-white font-black text-sm rounded-xl flex items-center justify-center gap-1.5 shadow-lg border-2 border-orange-300 transition-all active:scale-[0.98] disabled:opacity-50">
                            <CheckCircle className="h-4 w-4" />{t('billEdit.saveAndPayFull')}
                          </button>
                        </div>
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
        {showServiceDialog && (
          <div className="fixed inset-0 z-[320] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" onClick={() => setShowServiceDialog(false)}>
            <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900" onClick={e => e.stopPropagation()}>
              <div className="flex items-start justify-between bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-4 text-white">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25"><Plus className="h-5 w-5" /></div>
                  <div><h3 className="text-lg font-black">{editingServiceIndex === null ? t('billEdit.addServiceToBill') : t('billEdit.editService')}</h3><p className="mt-0.5 text-xs text-indigo-100">{t('billEdit.serviceSubtitle')}</p></div>
                </div>
                <button onClick={() => setShowServiceDialog(false)} className="rounded-lg p-1.5 text-white/80 transition hover:bg-white/15 hover:text-white"><X className="h-5 w-5" /></button>
              </div>
              <div className="space-y-4 p-5">
                <label className="block"><span className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-200">{t('billEdit.serviceNameLabel')}</span><input autoFocus value={serviceName} onChange={e => setServiceName(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 dark:border-slate-600 dark:bg-slate-800 dark:text-white" placeholder={t('billEdit.serviceNamePlaceholder')} /></label>
                <label className="block"><span className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-200">{t('billEdit.amountLabel')}</span><div className="relative"><input value={serviceAmount} onChange={e => setServiceAmount(e.target.value)} type="number" min="0" step="0.01" className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 pl-14 text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 dark:border-slate-600 dark:bg-slate-800 dark:text-white" placeholder="0.00" /><span className="absolute inset-y-0 left-3 flex items-center text-xs font-bold text-slate-500">EGP</span></div></label>
                <label className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/70"><span><span className="block text-sm font-bold text-slate-800 dark:text-slate-100">{t('billEdit.showServiceInPrint')}</span><span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{t('billEdit.showServiceHint')}</span></span><input type="checkbox" checked={serviceShowInPrint} onChange={e => setServiceShowInPrint(e.target.checked)} className="h-5 w-5 accent-indigo-600" /></label>
                <div className="flex gap-3 border-t border-slate-200 pt-4 dark:border-slate-700"><button onClick={() => { setShowServiceDialog(false); setEditingServiceIndex(null); }} className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 font-bold text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">{t('billEdit.cancel')}</button><button onClick={saveService} disabled={!serviceName.trim() || !serviceAmount || Number(serviceAmount) < 0} className="flex-1 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 font-bold text-white shadow-md transition hover:from-indigo-700 hover:to-violet-700 disabled:cursor-not-allowed disabled:opacity-50">{editingServiceIndex === null ? t('billEdit.addServiceConfirm') : t('billEdit.saveEdit')}</button></div>
              </div>
            </div>
          </div>
        )}
      </ModalPortal>
  );
};

export default BillItemsEditModal;
