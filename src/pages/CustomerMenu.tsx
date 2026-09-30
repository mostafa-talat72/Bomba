import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ShoppingCart, Search, X, CheckCircle, Sun, Moon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { MenuItem } from '../services/api';
import { api } from '../services/api';
import { formatCurrency } from '../utils/formatters';
import { safeGet } from '../utils/safeStorage';
import { ItemCard, OrderItemRow } from '../components/tables/OrderItems';
import { getTableDisplay, type LocalOrderItem } from '../components/tables/tableHelpers';

interface CartItem {
	menuItem: MenuItem;
	quantity: number;
	notes: string;
	variant?: string | null;
}

const cartKey = (menuId: string, variant?: string | null) => `${menuId}::${variant || ''}`;
const priceFor = (item: MenuItem, variant?: string | null): number => {
	if (variant && Array.isArray((item as any).variants)) {
		const m = (item as any).variants.find((v: any) => v.size === variant);
		if (m) return Number(m.price) || 0;
	}
	if (!variant && Array.isArray((item as any).variants) && (item as any).variants.length > 0) {
		return Number((item as any).variants[0].price) || 0;
	}
	return Number(item.price) || 0;
};
const idOf = (d: any) => String(d?.id || d?._id || '');

const CustomerMenu: React.FC = () => {
	const { t, i18n } = useTranslation();
	const { isDarkMode, toggleDarkMode, setTheme } = useTheme();
	const {
		menuItems,
		menuSections,
		menuCategories,
		fetchMenuItems,
		fetchMenuSections,
		fetchMenuCategories,
		createOrder
	} = useApp();

	const [loading, setLoading] = useState(true);
	const [searchTerm, setSearchTerm] = useState('');
	const [cart, setCart] = useState<CartItem[]>([]);
	const [orderNotes, setOrderNotes] = useState('');
	const [customerName, setCustomerName] = useState('');
	const [orderError, setOrderError] = useState('');
	const [submitting, setSubmitting] = useState(false);
	const [showOrderSuccess, setShowOrderSuccess] = useState(false);
	const [lastOrderNumber, setLastOrderNumber] = useState('');
	// تتبع حالة طلب العميل بعد الإرسال (للطلبات المعلقة)
	const [requestOrderId, setRequestOrderId] = useState('');
	const [requestStatus, setRequestStatus] = useState<'idle' | 'pending' | 'accepted' | 'rejected'>('idle');
	// تبويب الموبايل (المنيو | الطلب) — نفس نافذة الاستاف
	const [mobileTab, setMobileTab] = useState<'menu' | 'order'>('menu');
	const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});
	const [pubTableNumber, setPubTableNumber] = useState<string | number | null>(null);

	// Public QR mode: ?org=<id>&table=<id> — works without login
	const [searchParams] = useSearchParams();
	const publicOrgId = (searchParams.get('org') || '').trim();
	const publicTableId = (searchParams.get('table') || '').trim();
	const isPublicMode = publicOrgId.length > 0;
	// الرابط يجب أن يحمل المعرفين معًا — غير ذلك شاشة خطأ (لا وضع بديل)
	const linkInvalid = !publicOrgId || !publicTableId;
	// الوضع العام: العربية والوضع النهاري افتراضيًا ما لم يختر العميل غير ذلك
	useEffect(() => {
		if (!isPublicMode) return;
		try {
			if (!safeGet('language')) { void i18n.changeLanguage('ar'); }
		} catch { /* ignore */ }
		// تأكيد الاتجاه فورًا (حدث اللغة قد لا يُطلق عند التهيئة)
		try {
			const d = i18n.dir() === 'rtl' ? 'rtl' : 'ltr';
			document.documentElement.dir = d;
			document.body.dir = d;
		} catch { /* ignore */ }
		try {
			if (localStorage.getItem('darkMode') === null) { void setTheme('light', false); }
		} catch { /* ignore */ }
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isPublicMode]);
	const [pubItems, setPubItems] = useState<MenuItem[]>([]);
	const [pubSections, setPubSections] = useState<any[]>([]);
	const [pubCategories, setPubCategories] = useState<any[]>([]);
	const [pubLoadError, setPubLoadError] = useState('');

	const effItems = isPublicMode ? pubItems : (menuItems || []);
	const effSections = isPublicMode ? pubSections : (menuSections || []);
	const effCategories = isPublicMode ? pubCategories : (menuCategories || []);

	const fmt = useCallback((n: number) => formatCurrency(n, i18n.language), [i18n.language]);

	useEffect(() => {
		if (linkInvalid) { setLoading(false); return; }
		if (!isPublicMode) {
			const loadMenu = async () => {
				setLoading(true);
				try {
					await Promise.all([
						fetchMenuItems(),
						fetchMenuSections(),
						fetchMenuCategories()
					]);
				} catch (error) {
					console.error('Error loading menu:', error);
				} finally {
					setLoading(false);
				}
			};
			loadMenu();
			return;
		}
		let cancelled = false;
		(async () => {
			setLoading(true);
			setPubLoadError('');
			try {
				const res: any = await (api as any).publicRequest(`/menu/public/full?organization=${encodeURIComponent(publicOrgId)}&table=${encodeURIComponent(publicTableId)}`);
				if (cancelled) return;
				if (res?.success && res?.data) {
					// JSON العام خام: `_id` فقط بلا `id` — طبّع المعرفات (بما فيها المراجع المعبأة)
					const normRef = (ref: any) => (ref && typeof ref === 'object'
						? { ...ref, id: String(ref.id || ref._id || '') }
						: ref);
					setPubItems((res.data.items || []).map((it: any) => ({
						...it,
						id: String(it.id || it._id || ''),
						category: normRef(it.category),
					})));
					setPubSections((res.data.sections || []).map((s: any) => ({
						...s,
						id: String(s.id || s._id || ''),
					})));
					setPubCategories((res.data.categories || []).map((c: any) => ({
						...c,
						id: String(c.id || c._id || ''),
						section: normRef(c.section),
					})));
					setPubTableNumber(res.data.tableNumber ?? null);
				} else if (!cancelled) {
					setPubLoadError(res?.message || t('menu.public.loadError'));
				}
			} catch (error) {
				if (!cancelled) {
					console.error('Error loading public menu:', error);
					setPubLoadError(t('menu.public.loadError'));
				}
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();
		return () => { cancelled = true; };
	}, [isPublicMode, linkInvalid, publicOrgId, publicTableId]);

	// ── مطابقة نافذة الاستاف: قسم واحد نشط + فئة نشطة ──
	const activeSections = useMemo(() =>
		[...effSections].filter((s: any) => s.isActive !== false).sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0)),
	[effSections]);

	const [activeSectionId, setActiveSectionId] = useState<string>('');
	const [activeCategoryId, setActiveCategoryId] = useState<string>('all');
	useEffect(() => { setActiveCategoryId('all'); }, [activeSectionId]);
	useEffect(() => {
		if (!activeSectionId && activeSections.length > 0) {
			setActiveSectionId(idOf(activeSections[0]));
		}
	}, [activeSections, activeSectionId]);

	const getCategoriesForSection = (sectionId: string) => {
		return effCategories.filter((cat: any) => {
			const section = typeof cat.section === 'string' ? cat.section : cat.section?.id || cat.section?._id;
			return String(section) === String(sectionId);
		}).sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0));
	};

	const getItemsForCategory = (categoryId: string) => {
		return filteredItems.filter(item => {
			const category = typeof item.category === 'string' ? item.category : (item as any).category?.id || (item as any).category?._id;
			return String(category) === String(categoryId);
		}).sort((a: any, b: any) => String(a.name || '').localeCompare(String(b.name || '')));
	};

	// العميل يرى المتاح فقط + البحث
	const filteredItems = useMemo(() => {
		const q = searchTerm.trim().toLowerCase();
		return (effItems || []).filter((item: any) => {
			if (!item) return false;
			if (item.isAvailable === false) return false;
			if (q) {
				const matches = String(item.name || '').toLowerCase().includes(q) ||
					(item.description?.toLowerCase()?.includes(q) ?? false);
				if (!matches) return false;
			}
			return true;
		});
	}, [effItems, searchTerm]);

	const activeSectionCategories = useMemo(() => {
		if (!activeSectionId) return [];
		return getCategoriesForSection(activeSectionId);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [activeSectionId, effCategories, filteredItems]);

	const displayedItems = useMemo(() => {
		const q = searchTerm.trim();
		if (q) return filteredItems;
		if (!activeSectionId) return filteredItems;
		const cats = activeCategoryId === 'all'
			? getCategoriesForSection(activeSectionId)
			: getCategoriesForSection(activeSectionId).filter((c: any) => String(c._id || c.id) === String(activeCategoryId));
		return cats.flatMap((cat: any) => getItemsForCategory(idOf(cat)));
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [searchTerm, activeSectionId, activeCategoryId, filteredItems, effCategories]);

	// ── السلة بنفس دلالات الاستاف (الحجم يُحسم دائمًا — الأول افتراضيًا) ──
	const addToCart = (menuItem: MenuItem, variant?: string | null) => {
		if (!menuItem) return;
		if ((menuItem as any).isAvailable === false) { flashError(t('menu.itemUnavailable')); return; }
		let effVariant: string | null = variant ? String(variant).trim() : null;
		const variants = Array.isArray((menuItem as any).variants) ? (menuItem as any).variants : [];
		if (variants.length > 0) {
			if (effVariant) {
				const matched = variants.find((v: any) => String(v.size) === effVariant);
				effVariant = matched ? String(matched.size) : String(variants[0].size);
			} else {
				effVariant = String(variants[0].size);
			}
		} else {
			effVariant = effVariant || null;
		}
		const mid = idOf(menuItem);
		const keyVariant = effVariant || '';
		const effPrice = priceFor(menuItem, effVariant);
		setCart(prev => {
			const existing = prev.find(c => idOf(c.menuItem) === mid && (c.variant || '') === keyVariant && priceFor(c.menuItem, c.variant) === effPrice);
			if (existing) {
				return prev.map(c => idOf(c.menuItem) === mid && (c.variant || '') === keyVariant && priceFor(c.menuItem, c.variant) === effPrice
					? { ...c, quantity: c.quantity + 1 } : c);
			}
			return [...prev, { menuItem, quantity: 1, notes: '', variant: effVariant }];
		});
	};

	const lineKeyOf = (cid: string, variant?: string | null) => cartKey(cid, variant ?? null);

	const setLineQty = (cid: string, variant: string | null | undefined, qty: number) => {
		const key = lineKeyOf(cid, variant ?? null);
		setCart(prev => {
			if (qty <= 0) return prev.filter(c => cartKey(idOf(c.menuItem), c.variant) !== key);
			return prev.map(c => cartKey(idOf(c.menuItem), c.variant) === key ? { ...c, quantity: qty } : c);
		});
	};

	const removeLine = (cid: string, variant: string | null | undefined) => {
		const key = lineKeyOf(cid, variant ?? null);
		setCart(prev => prev.filter(c => cartKey(idOf(c.menuItem), c.variant) !== key));
	};

	const setLineNotes = (cid: string, variant: string | null | undefined, notes: string) => {
		const key = lineKeyOf(cid, variant ?? null);
		setCart(prev => prev.map(c => cartKey(idOf(c.menuItem), c.variant) === key ? { ...c, notes } : c));
	};

	const cartRows: LocalOrderItem[] = useMemo(() => cart.map(c => ({
		menuItem: idOf(c.menuItem),
		name: c.menuItem.name,
		price: priceFor(c.menuItem, c.variant),
		variant: c.variant || null,
		quantity: c.quantity,
		notes: c.notes || '',
	})), [cart]);

	const qtyMap = useMemo(() => {
		const map: Record<string, number> = {};
		cart.forEach(c => {
			const id = idOf(c.menuItem);
			map[id] = (map[id] || 0) + c.quantity;
		});
		return map;
	}, [cart]);

	const qtyByVariantMap = useMemo(() => {
		const map: Record<string, Record<string, number>> = {};
		cart.forEach(c => {
			const id = idOf(c.menuItem);
			const v = c.variant || '';
			if (!map[id]) map[id] = {};
			map[id][v] = (map[id][v] || 0) + c.quantity;
		});
		return map;
	}, [cart]);

	const cartTotal = cart.reduce((acc, c) => acc + (priceFor(c.menuItem, c.variant) * c.quantity), 0);
	const cartCount = cart.reduce((acc, c) => acc + c.quantity, 0);

	const flashError = (msg: string) => {
		setOrderError(msg);
		setTimeout(() => setOrderError((cur) => (cur === msg ? '' : cur)), 3000);
	};

	const handleOrder = async () => {
		if (cart.length === 0 || submitting) return;
		const name = customerName.trim();
		if (name.length < 2) { flashError(t('menu.customerNameRequired')); return; }
		setSubmitting(true);
		setOrderError('');
		try {
			if (isPublicMode) {
				if (!publicTableId) { flashError(t('menu.public.tableRequired')); return; }
				const res: any = await (api as any).publicRequest('/orders/public', {
					method: 'POST',
					body: JSON.stringify({
						organization: publicOrgId,
						table: publicTableId,
						customerName: name,
						notes: orderNotes,
						items: cart.map(c => ({
							menuItem: idOf(c.menuItem),
							quantity: c.quantity,
							notes: c.notes,
							variant: c.variant || undefined,
						})),
					}),
				});
				if (res?.success && res?.data) {
					setLastOrderNumber(res.data.orderNumber || '');
					setRequestOrderId(String(res.data._id || res.data.id || ''));
					setRequestStatus('pending');
					setShowOrderSuccess(true);
					setCart([]);
					setOrderNotes('');
					setMobileTab('menu');
					setTimeout(() => setShowOrderSuccess(false), 4000);
				} else {
					flashError(res?.message || t('menu.orderFailed'));
				}
				return;
			}
			const orderData = {
				customerName: name,
				items: cart.map(c => ({
					menuItem: idOf(c.menuItem),
					name: c.menuItem.name,
					price: priceFor(c.menuItem, c.variant),
					quantity: c.quantity,
					notes: c.notes,
					variant: c.variant || undefined,
				})),
				notes: orderNotes
			};

			const created: any = await createOrder(orderData);
			if (created) {
				setLastOrderNumber(created.orderNumber || '');
				setShowOrderSuccess(true);
				setCart([]);
				setOrderNotes('');
				setMobileTab('menu');
				setTimeout(() => setShowOrderSuccess(false), 4000);
			} else {
				flashError(t('menu.orderFailed'));
			}
		} catch (error) {
			console.error('Error placing order:', error);
			flashError(t('menu.orderFailed'));
		} finally {
			setSubmitting(false);
		}
	};

	// متابعة حالة الطلب المعلق كل 10 ثوانٍ (مقبول / مرفوض)
	useEffect(() => {
		if (!isPublicMode || requestStatus !== 'pending' || !requestOrderId) return;
		let cancelled = false;
		const poll = async () => {
			try {
				const res: any = await (api as any).publicRequest(
					`/orders/public/${requestOrderId}?organization=${encodeURIComponent(publicOrgId)}`
				);
				if (cancelled) return;
				if (res?.success && res?.data) {
					if (res.data.status && res.data.status !== 'awaiting_approval') {
						setRequestStatus('accepted');
					}
				} else if (res && res.success === false) {
					// 404 = اتحذف (رفض أو إلغاء تلقائي)
					setRequestStatus('rejected');
				}
			} catch {
				// تجاهل أخطاء الشبكة المؤقتة — المحاولة القادمة بعد 10 ثوانٍ
			}
		};
		poll();
		const id = setInterval(poll, 10000);
		return () => { cancelled = true; clearInterval(id); };
	}, [isPublicMode, requestStatus, requestOrderId, publicOrgId]);

	if (loading) {
		return (
			<div className="min-h-screen bg-gradient-to-br from-orange-50 to-white dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
				<div className="text-center">
					<div className="animate-spin rounded-full h-16 w-16 border-4 border-orange-200 border-t-orange-600 mx-auto"></div>
					<p className="mt-4 text-gray-600 dark:text-gray-300 font-medium">{t('menu.loading')}</p>
				</div>
			</div>
		);
	}

	if (linkInvalid) {
		return (
			<div className="min-h-screen bg-gradient-to-br from-orange-50 to-white dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
				<div className="text-center bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 max-w-sm">
					<div className="text-5xl mb-3">⚠️</div>
					<p className="text-red-600 dark:text-red-400 font-bold mb-2">{t('menu.public.invalidLink')}</p>
					<p className="text-sm text-gray-500 dark:text-gray-400">{t('menu.public.retryHint')}</p>
				</div>
			</div>
		);
	}

	if (isPublicMode && pubLoadError && effItems.length === 0) {
		return (
			<div className="min-h-screen bg-gradient-to-br from-orange-50 to-white dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
				<div className="text-center bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 max-w-sm">
					<p className="text-red-600 dark:text-red-400 font-bold mb-2">{pubLoadError}</p>
					<p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{t('menu.public.retryHint')}</p>
					<button
						onClick={() => window.location.reload()}
						className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-bold transition-all shadow-md"
					>
						↻ {t('menu.public.retry')}
					</button>
				</div>
			</div>
		);
	}

	const showSearch = searchTerm.trim().length > 0;

	return (
		<div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
			{/* HEADER — نفس نافذة الاستاف (بدون إغلاق وبدون خصم) */}
			<div className="sticky top-0 z-40 bg-gradient-to-r from-orange-500 to-red-500 px-3 py-2 sm:px-4 sm:py-3 flex items-center justify-between flex-shrink-0">
				<div className="flex items-center gap-2 sm:gap-3 min-w-0">
					<div className="w-8 h-8 sm:w-9 sm:h-9 bg-white/15 rounded-xl flex items-center justify-center ring-1 ring-white/25 flex-shrink-0">
						<ShoppingCart className="h-4 w-4 text-white" />
					</div>
					<div className="min-w-0">
						<h2 className="text-lg sm:text-2xl font-bold text-white truncate">{t('menu.pageTitle')}</h2>
						{isPublicMode && pubTableNumber != null && (
							<p className="text-sm sm:text-base text-orange-100 truncate">
								🪑 {t('menu.public.tableLabel')} {getTableDisplay(pubTableNumber, i18n.language)}
							</p>
						)}
					</div>
				</div>
				<div className="flex items-center gap-2 flex-shrink-0">
					{cartCount > 0 && (
						<div className="bg-white/15 rounded-xl px-2.5 py-1 sm:px-3 sm:py-1.5 ring-1 ring-white/25 text-center">
							<p className="text-sm sm:text-base text-orange-100 leading-none">{t('menu.total')}</p>
							<p className="text-base sm:text-lg font-bold text-white">{fmt(cartTotal)}</p>
						</div>
					)}
					<LanguageSwitcher />
					<button
						onClick={() => toggleDarkMode()}
						className="w-8 h-8 bg-white/15 hover:bg-white/25 rounded-xl flex items-center justify-center text-white ring-1 ring-white/25 transition-all"
						title={isDarkMode ? t('theme.switchToLight') : t('theme.switchToDark')}
					>
						{isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
					</button>
				</div>
			</div>

			{/* حالة الطلب المعلق (وضع عام فقط) */}
			{isPublicMode && requestStatus !== 'idle' && (
				<div className="px-3 sm:px-4 pt-2 flex-shrink-0">
					{requestStatus === 'pending' && (
						<div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-amber-800 dark:text-amber-300 text-sm font-bold flex items-center gap-2">
							<span className="animate-pulse">⏳</span>
							<span>{t('menu.request.pending')}</span>
						</div>
					)}
					{requestStatus === 'accepted' && (
						<div className="p-3 rounded-2xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 text-green-800 dark:text-green-300 text-sm font-bold flex items-center gap-2">
							<span>✅</span>
							<span>{t('menu.request.accepted')}</span>
						</div>
					)}
					{requestStatus === 'rejected' && (
						<div className="p-3 rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-red-800 dark:text-red-300 text-sm font-bold">
							<span>❌ {t('menu.request.rejected')}</span>
							<button onClick={() => setRequestStatus('idle')} className="block mt-1 underline text-xs">{t('menu.request.orderAgain')}</button>
						</div>
					)}
				</div>
			)}

			{/* Mobile tabs: menu | order */}
			<div className="lg:hidden flex-shrink-0 grid grid-cols-2 gap-1 p-1.5 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
				<button
					type="button"
					onClick={() => setMobileTab('menu')}
					className={`py-2 rounded-lg text-sm font-bold transition-all ${mobileTab === 'menu' ? 'bg-white dark:bg-gray-700 text-orange-600 dark:text-orange-400 shadow' : 'text-gray-500 dark:text-gray-400'}`}
				>
					{t('cafe.orderModal.menuTab')}
				</button>
				<button
					type="button"
					onClick={() => setMobileTab('order')}
					className={`py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${mobileTab === 'order' ? 'bg-white dark:bg-gray-700 text-green-700 dark:text-green-400 shadow' : 'text-gray-500 dark:text-gray-400'}`}
				>
					{t('cafe.orderModal.orderTab')}
					{cartRows.length > 0 && (
						<span className="min-w-[20px] h-5 px-1 bg-green-500 text-white text-xs font-bold rounded-full flex items-center justify-center leading-none">{cartRows.length}</span>
					)}
				</button>
			</div>

			{/* BODY */}
			<div className="flex-1 flex flex-col lg:flex-row min-h-0 w-full max-w-7xl mx-auto">

				{/* Col 1: Sections (desktop columns; chips on mobile) */}
				{!showSearch && (
					<div className="w-24 lg:w-28 flex-shrink-0 hidden lg:flex flex-col border-e border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
						<div className="px-2 py-2 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
							<p className="text-base font-semibold text-gray-400 dark:text-gray-500 text-center">{t('cafe.orderModal.sections')}</p>
						</div>
						<div className="flex-1 py-1.5 px-1.5 space-y-1">
							{activeSections.map((sec: any) => {
								const sid = idOf(sec);
								const hasCats = getCategoriesForSection(sid).length > 0;
								if (!hasCats) return null;
								const isAct = activeSectionId === sid;
								return (
									<button key={sid} onClick={() => setActiveSectionId(sid)}
										className={`w-full px-2 py-2 rounded-lg text-base font-medium transition-all text-start leading-snug ${isAct ? 'bg-orange-500 text-white shadow-sm' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
										{sec.name}
									</button>
								);
							})}
						</div>
					</div>
				)}

				{/* Col 2: Categories (desktop columns; chips on mobile) */}
				{!showSearch && activeSectionCategories.length > 1 && (
					<div className="w-24 lg:w-28 flex-shrink-0 hidden lg:flex flex-col border-e border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
						<div className="px-2 py-2 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
							<p className="text-base font-semibold text-gray-400 dark:text-gray-500 text-center">{t('cafe.orderModal.categories')}</p>
						</div>
						<div className="flex-1 py-1.5 px-1.5 space-y-1">
							<button onClick={() => setActiveCategoryId('all')}
								className={`w-full px-2 py-2 rounded-lg text-base font-medium transition-all text-start ${activeCategoryId === 'all' ? 'bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
								{t('cafe.orderModal.all')}
							</button>
							{activeSectionCategories.map((cat: any) => {
								const catId = String(cat._id || cat.id);
								const isAct = activeCategoryId === catId;
								const count = getItemsForCategory(idOf(cat)).length;
								if (count === 0) return null;
								return (
									<button key={catId} onClick={() => setActiveCategoryId(catId)}
										className={`w-full px-2 py-2 rounded-lg text-base font-medium transition-all text-start leading-snug ${isAct ? 'bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
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
					{!showSearch && (
						<div className="lg:hidden flex-shrink-0 px-2 pt-2 space-y-1.5">
							<div className="flex gap-1.5 overflow-x-auto pb-0.5">
								{activeSections.map((sec: any) => {
									const sid = idOf(sec);
									const hasCats = getCategoriesForSection(sid).length > 0;
									if (!hasCats) return null;
									const isAct = activeSectionId === sid;
									return (
										<button key={sid} onClick={() => setActiveSectionId(sid)}
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
										{t('cafe.orderModal.all')}
									</button>
									{activeSectionCategories.map((cat: any) => {
										const catId = String(cat._id || cat.id);
										const isAct = activeCategoryId === catId;
										const count = getItemsForCategory(idOf(cat)).length;
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

					{/* البحث داخل الأصناف */}
					<div className="px-2 pt-2 pb-1.5 flex-shrink-0">
						<div className="relative">
							<Search className="absolute start-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
							<input
								type="text"
								value={searchTerm}
								onChange={e => setSearchTerm(e.target.value)}
								placeholder={t('cafe.orderModal.searchPlaceholder')}
								className="w-full ps-8 pe-7 py-1.5 text-base rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-1 focus:ring-orange-400 focus:border-orange-400 outline-none transition-all"
							/>
							{searchTerm && (
								<button onClick={() => setSearchTerm('')} className="absolute end-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
									<X className="h-3 w-3" />
								</button>
							)}
						</div>
					</div>

					<div className="px-2 py-1 border-b border-gray-100 dark:border-gray-700 flex-shrink-0 flex items-center justify-between">
						<p className="text-base font-semibold text-gray-400 dark:text-gray-500">
							{showSearch
								? t('cafe.orderModal.searchResults')
								: (activeSectionCategories.find((c: any) => String(c._id || c.id) === activeCategoryId)?.name
									|| activeSections.find((s: any) => idOf(s) === activeSectionId)?.name
									|| t('cafe.orderModal.itemsFallback'))}
						</p>
						{displayedItems.length > 0 && <span className="text-base text-gray-400">{displayedItems.length}</span>}
					</div>
					<div className="p-1.5 min-h-0">
						{displayedItems.length === 0 ? (
							<div className="flex flex-col items-center justify-center py-10 text-gray-300 dark:text-gray-600 select-none">
								<Search className="h-8 w-8 mb-2 opacity-30" />
								<p className="text-base">{showSearch ? t('cafe.orderModal.noResults') : t('cafe.orderModal.chooseSection')}</p>
							</div>
						) : (
							<div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-1">
								{displayedItems.map(item => (
									<ItemCard
										key={idOf(item)}
										item={item as MenuItem}
										qty={qtyMap[idOf(item)] || 0}
										qtyByVariant={qtyByVariantMap[idOf(item)]}
										onAdd={addToCart}
										fmt={fmt}
									/>
								))}
							</div>
						)}
					</div>
				</div>

				{/* Col 4: Order — تأكيد فقط (بلا حفظ/طباعة وبلا خصم) */}
				<div className={`w-full lg:w-80 xl:w-96 flex-shrink-0 flex-col border-s border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 ${mobileTab === 'order' ? 'flex flex-1 min-h-0' : 'hidden'} lg:flex lg:sticky lg:top-24 lg:self-start lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto`}>
					<div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-1.5">
								<div className="w-1 h-4 bg-gradient-to-b from-green-400 to-emerald-500 rounded-full"></div>
								<span className="font-bold text-gray-800 dark:text-gray-100 text-base">{t('cafe.orderModal.orders')}</span>
								{cartRows.length > 0 && (
									<span className="min-w-[18px] h-[18px] px-1 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 text-base font-bold rounded-full flex items-center justify-center leading-none">{cartRows.length}</span>
								)}
							</div>
						</div>
					</div>

					<div className="flex-1 px-2 py-2 space-y-1.5 min-h-0">
						{cartRows.length === 0 ? (
							<div className="flex flex-col items-center justify-center py-8 select-none">
								<ShoppingCart className="h-8 w-8 text-gray-200 dark:text-gray-700 mb-1" />
								<p className="text-base text-gray-300 dark:text-gray-600">{t('cafe.orderModal.noItems')}</p>
							</div>
						) : cartRows.map((row) => {
							const compositeKey = row.variant ? `${row.menuItem}::${row.variant}::${row.price}` : `${row.menuItem}::${row.price}`;
							return (
								<OrderItemRow
									key={compositeKey}
									item={row}
									isFlash={false}
									isExpanded={!!expandedNotes[compositeKey]}
									onMinus={() => setLineQty(row.menuItem, row.variant, row.quantity - 1)}
									onPlus={() => setLineQty(row.menuItem, row.variant, row.quantity + 1)}
									onQuantityChange={v => setLineQty(row.menuItem, row.variant, v)}
									onRemove={() => removeLine(row.menuItem, row.variant)}
									onToggleNote={() => setExpandedNotes(p => ({ ...p, [compositeKey]: !p[compositeKey] }))}
									onNoteChange={v => setLineNotes(row.menuItem, row.variant, v)}
									notePlaceholder={t('menu.itemNotePlaceholder')}
									fmt={fmt}
								/>
							);
						})}
					</div>

					<div className="px-2 pt-2 pb-1 flex-shrink-0 space-y-2">
						<input
							value={customerName}
							onChange={(e) => setCustomerName(e.target.value)}
							placeholder={t('menu.customerNamePlaceholder')}
							className="w-full text-base border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-1 focus:ring-orange-400 outline-none"
						/>
						<textarea value={orderNotes} onChange={e => setOrderNotes(e.target.value)}
							placeholder={t('menu.orderNotes')} rows={2}
							className="w-full text-base border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 resize-none focus:ring-1 focus:ring-orange-400 outline-none" />
						{orderError && (
							<p className="text-sm font-bold text-red-600 dark:text-red-400">{orderError}</p>
						)}
					</div>

					<div className="px-2 pb-3 flex-shrink-0">
						<button onClick={handleOrder} disabled={submitting || cartRows.length === 0}
							className="w-full py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-bold text-base rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-md hover:shadow-lg disabled:opacity-50">
							{submitting
								? <><svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>{t('menu.sending')}</>
								: <><CheckCircle className="h-4 w-4" />{t('menu.placeOrder')} · {fmt(cartTotal)}</>}
						</button>
					</div>
				</div>
			</div>

			{/* Order Success Toast */}
			{showOrderSuccess && (
				<div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50">
					<div className="bg-green-500 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-bounce">
						<CheckCircle className="h-5 w-5" />
						<span className="font-medium">{lastOrderNumber ? t('menu.orderSuccessWithNumber', { number: lastOrderNumber }) : t('menu.orderSuccess')}</span>
					</div>
				</div>
			)}
		</div>
	);
};

export default CustomerMenu;
