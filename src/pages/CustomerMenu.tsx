import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Utensils, Search, Star, Clock, ShoppingCart, Plus, Minus, X, CheckCircle, Sun, Moon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { MenuItem } from '../services/api';
import { api } from '../services/api';
import { formatCurrency, formatDecimal } from '../utils/formatters';
import '../styles/menu-animations.css';

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
	return Number(item.price) || 0;
};

const CustomerMenu: React.FC = () => {
	const { t, i18n } = useTranslation();
	const { isDarkMode, toggleDarkMode } = useTheme();
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
	const [selectedSection, setSelectedSection] = useState<string | null>(null);
	const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
	const [cart, setCart] = useState<CartItem[]>([]);
	const [showCart, setShowCart] = useState(false);
	const [showOrderSuccess, setShowOrderSuccess] = useState(false);
	const [lastOrderNumber, setLastOrderNumber] = useState('');
	const [orderNotes, setOrderNotes] = useState('');
	const [customerName, setCustomerName] = useState('');
	const [orderError, setOrderError] = useState('');
	const [submitting, setSubmitting] = useState(false);
	// تتبع حالة طلب العميل بعد الإرسال (للطلبات المعلقة)
	const [requestOrderId, setRequestOrderId] = useState('');
	const [requestStatus, setRequestStatus] = useState<'idle' | 'pending' | 'accepted' | 'rejected'>('idle');
	const [activeFilters, setActiveFilters] = useState({
		availableOnly: true,
		popularOnly: false
	});

	// Public QR mode: ?org=<id>&table=<id> — works without login
	const [searchParams] = useSearchParams();
	const publicOrgId = (searchParams.get('org') || '').trim();
	const publicTableId = (searchParams.get('table') || '').trim();
	const isPublicMode = publicOrgId.length > 0;
	const [pubItems, setPubItems] = useState<MenuItem[]>([]);
	const [pubSections, setPubSections] = useState<any[]>([]);
	const [pubCategories, setPubCategories] = useState<any[]>([]);
	const [pubLoadError, setPubLoadError] = useState('');
	const [chosenVariant, setChosenVariant] = useState<Record<string, string>>({});

	const effItems = isPublicMode ? pubItems : (menuItems || []);
	const effSections = isPublicMode ? pubSections : (menuSections || []);
	const effCategories = isPublicMode ? pubCategories : (menuCategories || []);

	useEffect(() => {
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
				const res: any = await (api as any).publicRequest(`/menu/public/full?organization=${encodeURIComponent(publicOrgId)}`);
				if (cancelled) return;
				if (res?.success && res?.data) {
					setPubItems(res.data.items || []);
					setPubSections(res.data.sections || []);
					setPubCategories(res.data.categories || []);
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
	}, [isPublicMode, publicOrgId]);

	const filteredItems = useMemo(() => {
		return effItems.filter(item => {
			if (!item) return false;
			if (activeFilters.availableOnly && !item.isAvailable) return false;
			if (activeFilters.popularOnly && !item.isPopular) return false;
			if (searchTerm) {
				const q = searchTerm.toLowerCase();
				const matches = String(item.name || '').toLowerCase().includes(q) ||
					(item.description?.toLowerCase()?.includes(q) ?? false);
				if (!matches) return false;
			}
			return true;
		});
	}, [effItems, searchTerm, activeFilters]);

	const getCategoriesForSection = (sectionId: string) => {
		return effCategories.filter(cat => {
			const section = typeof cat.section === 'string' ? cat.section : cat.section?.id || cat.section?._id;
			return section === sectionId;
		}).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
	};

	const getItemsForCategory = (categoryId: string) => {
		return filteredItems.filter(item => {
			const category = typeof item.category === 'string' ? item.category : item.category?.id || item.category?._id;
			return category === categoryId;
		}).sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
	};

	const flashError = (msg: string) => {
		setOrderError(msg);
		setTimeout(() => setOrderError((cur) => (cur === msg ? '' : cur)), 3000);
	};

	const addToCart = (item: MenuItem, variant?: string | null) => {
		if (!item) return;
		if (item.isAvailable === false) { flashError(t('menu.itemUnavailable')); return; }
		const v = variant ?? null;
		const key = cartKey(String((item as any).id || (item as any)._id), v);
		setCart(prev => {
			const existing = prev.find(c => cartKey(String((c.menuItem as any).id || (c.menuItem as any)._id), c.variant) === key);
			if (existing) {
				return prev.map(c => cartKey(String((c.menuItem as any).id || (c.menuItem as any)._id), c.variant) === key ? { ...c, quantity: c.quantity + 1 } : c);
			}
			return [...prev, { menuItem: item, quantity: 1, notes: '', variant: v }];
		});
	};

	const removeFromCart = (itemId: string, variant?: string | null) => {
		const key = cartKey(String(itemId), variant ?? null);
		setCart(prev => {
			const existing = prev.find(c => cartKey(String((c.menuItem as any).id || (c.menuItem as any)._id), c.variant) === key);
			if (existing && existing.quantity > 1) {
				return prev.map(c => cartKey(String((c.menuItem as any).id || (c.menuItem as any)._id), c.variant) === key ? { ...c, quantity: c.quantity - 1 } : c);
			}
			return prev.filter(c => cartKey(String((c.menuItem as any).id || (c.menuItem as any)._id), c.variant) !== key);
		});
	};

	const getCartQuantity = (itemId: string, variant?: string | null) => {
		const key = cartKey(String(itemId), variant ?? null);
		return cart.find(c => cartKey(String((c.menuItem as any).id || (c.menuItem as any)._id), c.variant) === key)?.quantity || 0;
	};

	const cartTotal = cart.reduce((acc, item) => acc + (priceFor(item.menuItem, item.variant) * item.quantity), 0);
	const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);

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
							menuItem: (c.menuItem as any).id || (c.menuItem as any)._id,
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
					setTimeout(() => setShowOrderSuccess(false), 4000);
				} else {
					flashError(res?.message || t('menu.orderFailed'));
				}
				return;
			}
			const orderData = {
				customerName: name,
				items: cart.map(c => ({
					menuItem: (c.menuItem as any).id || (c.menuItem as any)._id,
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

	if (isPublicMode && pubLoadError && effItems.length === 0) {
		return (
			<div className="min-h-screen bg-gradient-to-br from-orange-50 to-white dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
				<div className="text-center bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 max-w-sm">
					<p className="text-red-600 dark:text-red-400 font-bold mb-2">{pubLoadError}</p>
					<p className="text-sm text-gray-500 dark:text-gray-400">{t('menu.public.retryHint')}</p>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gradient-to-br from-orange-50 to-white dark:from-gray-900 dark:to-gray-800">
			{/* Header */}
			<div className="sticky top-0 z-40 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm border-b border-orange-100 dark:border-gray-700 shadow-sm">
				<div className="max-w-7xl mx-auto px-4 py-4">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-3">
							<div className="p-2 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl">
								<Utensils className="h-6 w-6 text-white" />
							</div>
							<div>
								<h1 className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-orange-500 bg-clip-text text-transparent">
									{t('menu.pageTitle')}
								</h1>
							</div>
						</div>
						<div className="flex items-center gap-2">
							<LanguageSwitcher />
							<button
								onClick={() => toggleDarkMode()}
								className="p-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md border border-gray-200 dark:border-gray-600"
								title={isDarkMode ? t('theme.switchToLight') : t('theme.switchToDark')}
							>
								{isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
							</button>
							<button
								onClick={() => setShowCart(!showCart)}
								className="relative p-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl transition-all duration-200 shadow-md hover:shadow-lg"
						>
							<ShoppingCart className="h-6 w-6" />
							{cartCount > 0 && (
								<span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center">
									{formatDecimal(cartCount, i18n.language)}
								</span>
							)}
						</button>
					</div>
				</div>
</div>
		</div>

		<div className="max-w-7xl mx-auto px-4 py-6">
				{/* حالة الطلب المعلق (وضع عام فقط) */}
				{isPublicMode && requestStatus === 'pending' && (
					<div className="mb-4 p-3 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-amber-800 dark:text-amber-300 text-sm font-bold flex items-center gap-2">
						<span className="animate-pulse">⏳</span>
						<span>{t('menu.request.pending')}</span>
					</div>
				)}
				{isPublicMode && requestStatus === 'accepted' && (
					<div className="mb-4 p-3 rounded-2xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 text-green-800 dark:text-green-300 text-sm font-bold flex items-center gap-2">
						<span>✅</span>
						<span>{t('menu.request.accepted')}</span>
					</div>
				)}
				{isPublicMode && requestStatus === 'rejected' && (
					<div className="mb-4 p-3 rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-red-800 dark:text-red-300 text-sm font-bold">
						<span>❌ {t('menu.request.rejected')}</span>
						<button onClick={() => setRequestStatus('idle')} className="block mt-1 underline text-xs">{t('menu.request.orderAgain')}</button>
					</div>
				)}
				{/* Search + Filters */}
				<div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-4 mb-6">
					<div className="flex items-center gap-4">
						<div className="flex-1 relative">
							<Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
							<input
								type="text"
								value={searchTerm}
								onChange={(e) => setSearchTerm(e.target.value)}
								placeholder={t('menu.searchPlaceholder')}
								className="w-full pr-10 pl-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200"
							/>
						</div>
						<div className="flex items-center gap-2">
							<button
								onClick={() => setActiveFilters(prev => ({ ...prev, availableOnly: !prev.availableOnly }))}
								className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
									activeFilters.availableOnly
										? 'bg-green-500 text-white'
										: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
								}`}
							>
								{t('menu.availableOnly')}
							</button>
							<button
								onClick={() => setActiveFilters(prev => ({ ...prev, popularOnly: !prev.popularOnly }))}
								className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 flex items-center gap-1 ${
									activeFilters.popularOnly
										? 'bg-yellow-500 text-white'
										: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
								}`}
							>
								<Star className="h-4 w-4" />
								{t('menu.popularFilter')}
							</button>
						</div>
					</div>
				</div>

				{/* Sections Tabs */}
				<div className="flex items-center gap-2 overflow-x-auto pb-4 mb-6 scrollbar-hide">
					<button
						onClick={() => { setSelectedSection(null); setSelectedCategory(null); }}
						className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200 ${
							!selectedSection
								? 'bg-orange-500 text-white shadow-md'
								: 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
						}`}
					>
						{t('menu.all')}
					</button>
					{[...effSections].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)).map(section => (
						<button
							key={section.id}
							onClick={() => { setSelectedSection(section.id); setSelectedCategory(null); }}
							className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200 flex items-center gap-2 ${
								selectedSection === section.id
									? 'bg-blue-500 text-white shadow-md'
									: 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
							}`}
						>
							{section.name}
							<span className="px-1.5 py-0.5 text-xs rounded-full bg-white/20">
								{getCategoriesForSection(section.id).reduce((acc, cat) => acc + getItemsForCategory(cat.id).length, 0)}
							</span>
						</button>
					))}
				</div>

				{/* Content */}
				{selectedSection ? (
					<div className="space-y-6">
						{/* Categories for selected section */}
						<div className="flex items-center gap-2 overflow-x-auto pb-4 scrollbar-hide">
							<button
								onClick={() => setSelectedCategory(null)}
								className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-200 ${
									!selectedCategory
										? 'bg-green-500 text-white'
										: 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
								}`}
							>
							{t('menu.all')}
						</button>
						{getCategoriesForSection(selectedSection).map(category => (
								<button
									key={category.id}
									onClick={() => setSelectedCategory(category.id)}
									className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-200 ${
										selectedCategory === category.id
											? 'bg-green-500 text-white'
											: 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
									}`}
								>
									{category.name}
								</button>
							))}
						</div>

						{/* Items Grid */}
						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
							{(selectedCategory ? getItemsForCategory(selectedCategory) : filteredItems.filter(item => {
								const categoryId = typeof item.category === 'string' ? item.category : item.category?.id || item.category?._id;
								const category = effCategories.find(c => c.id === categoryId);
								const sectionId = category ? (typeof category.section === 'string' ? category.section : category.section?.id || category.section?._id) : null;
								return sectionId === selectedSection;
							})).map(item => {
								const itemId = String((item as any).id || (item as any)._id);
								const variants = Array.isArray((item as any).variants) ? (item as any).variants : [];
								const selVariant = chosenVariant[itemId] ?? (variants[0]?.size || null);
								const showPrice = priceFor(item, selVariant);
								const qty = getCartQuantity(itemId, selVariant);
								const unavailable = item.isAvailable === false;
								return (
								<div key={itemId + '::' + (selVariant || '')} className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-4 hover:shadow-lg transition-all duration-300">
									<div className="flex items-start justify-between mb-3">
										<div className="flex-1 min-w-0">
											<h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 truncate">{item.name}</h3>
											{item.description && (
												<p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mt-1">{item.description}</p>
											)}
										</div>
										{item.isPopular && <Star className="h-4 w-4 text-yellow-500 fill-yellow-500 shrink-0" />}
									</div>
									<div className="flex items-center justify-between mb-3">
										<span className="text-lg font-bold text-green-600 dark:text-green-400">
											{formatCurrency(showPrice, i18n.language)}
										</span>
										<div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
											<Clock className="h-3 w-3" />
											<span>{formatDecimal(item.preparationTime, i18n.language)} {t('menu.minutes')}</span>
										</div>
									</div>
									{variants.length > 1 && (
										<select
											value={selVariant || ''}
											onChange={(e) => setChosenVariant((p) => ({ ...p, [itemId]: e.target.value }))}
											className="w-full mb-2 px-2 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 outline-none"
											aria-label={t('menu.variantLabel')}
										>
											{variants.map((v: any) => (
												<option key={v.size} value={v.size}>{v.size} — {formatCurrency(v.price, i18n.language)}</option>
											))}
										</select>
									)}
									<div className="flex items-center justify-end">
										{qty === 0 ? (
											<button
												onClick={() => addToCart(item, selVariant)}
												disabled={unavailable}
												title={unavailable ? t('menu.itemUnavailable') : undefined}
												className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
											>
												<Plus className="h-4 w-4" />
												{t('menu.add')}
											</button>
										) : (
											<div className="flex items-center gap-2">
												<button
													onClick={() => removeFromCart(itemId, selVariant)}
													className="p-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-all"
												>
													<Minus className="h-4 w-4" />
												</button>
												<span className="text-lg font-bold text-gray-900 dark:text-gray-100 w-8 text-center">
													{qty}
												</span>
												<button
													onClick={() => addToCart(item, selVariant)}
													className="p-2 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 transition-all"
												>
													<Plus className="h-4 w-4" />
												</button>
											</div>
										)}
									</div>
								</div>
								);
							})}
						</div>
					</div>
				) : (
					/* All Sections View */
					<div className="space-y-8">
						{[...effSections].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)).map(section => {
							const sectionItems = filteredItems.filter(item => {
								const categoryId = typeof item.category === 'string' ? item.category : item.category?.id || item.category?._id;
								const category = effCategories.find(c => c.id === categoryId);
								const sectionId = category ? (typeof category.section === 'string' ? category.section : category.section?.id || category.section?._id) : null;
								return sectionId === section.id;
							});

							if (sectionItems.length === 0) return null;

							return (
								<div key={section.id} className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
									<div className="section-header p-4 border-b-2 border-blue-200 dark:border-blue-700">
										<h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{section.name}</h2>
										{section.description && (
											<p className="text-sm text-gray-600 dark:text-gray-400">{section.description}</p>
										)}
									</div>
									<div className="p-4">
										<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
											{sectionItems.map(item => {
												const itemId = String((item as any).id || (item as any)._id);
												const variants = Array.isArray((item as any).variants) ? (item as any).variants : [];
												const selVariant = chosenVariant[itemId] ?? (variants[0]?.size || null);
												const showPrice = priceFor(item, selVariant);
												const qty = getCartQuantity(itemId, selVariant);
												const unavailable = item.isAvailable === false;
												return (
												<div key={itemId + '::' + (selVariant || '')} className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4 border border-gray-100 dark:border-gray-700 hover:shadow-md transition-all duration-300">
													<div className="flex items-start justify-between mb-2">
														<h3 className="text-base font-bold text-gray-900 dark:text-gray-100 truncate">{item.name}</h3>
														{item.isPopular && <Star className="h-3 w-3 text-yellow-500 fill-yellow-500 shrink-0" />}
													</div>
													<div className="flex items-center justify-between mb-3">
														<span className="text-sm font-bold text-green-600 dark:text-green-400">
															{formatCurrency(showPrice, i18n.language)}
														</span>
													</div>
													{variants.length > 1 && (
														<select
															value={selVariant || ''}
															onChange={(e) => setChosenVariant((p) => ({ ...p, [itemId]: e.target.value }))}
															className="w-full mb-2 px-2 py-1 text-xs border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none"
															aria-label={t('menu.variantLabel')}
														>
															{variants.map((v: any) => (
																<option key={v.size} value={v.size}>{v.size} — {formatCurrency(v.price, i18n.language)}</option>
															))}
														</select>
													)}
													<div className="flex items-center justify-end">
														{qty === 0 ? (
															<button
																onClick={() => addToCart(item, selVariant)}
																disabled={unavailable}
																title={unavailable ? t('menu.itemUnavailable') : undefined}
																className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-medium transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
															>
																<Plus className="h-3 w-3" />
															</button>
														) : (
															<div className="flex items-center gap-1">
																<button
																	onClick={() => removeFromCart(itemId, selVariant)}
																	className="p-1 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-md"
																>
																	<Minus className="h-3 w-3" />
																</button>
																<span className="text-sm font-bold w-6 text-center">{qty}</span>
																<button
																	onClick={() => addToCart(item, selVariant)}
																	className="p-1 bg-green-100 dark:bg-green-900/30 text-green-600 rounded-md"
																>
																	<Plus className="h-3 w-3" />
																</button>
															</div>
														)}
													</div>
												</div>
												);
											})}
										</div>
									</div>
								</div>
							);
						})}
					</div>
				)}
			</div>

			{/* Cart Sidebar */}
			{showCart && (
				<div className="fixed inset-0 z-50">
					<div className="absolute inset-0 bg-black/50" onClick={() => setShowCart(false)} />
					<div className="absolute right-0 top-0 h-full w-full max-w-md bg-white dark:bg-gray-800 shadow-2xl">
						<div className="flex flex-col h-full">
							{/* Cart Header */}
							<div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
								<h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{t('menu.cart')}</h2>
								<button
									onClick={() => setShowCart(false)}
									className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all"
								>
									<X className="h-5 w-5" />
								</button>
							</div>

							{/* Cart Items */}
							<div className="flex-1 overflow-y-auto p-4 space-y-3">
								{cart.length === 0 ? (
									<div className="text-center py-12">
										<ShoppingCart className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
										<p className="text-gray-500 dark:text-gray-400">{t('menu.cartEmpty')}</p>
									</div>
								) : (
									cart.map(item => {
										const cid = String((item.menuItem as any).id || (item.menuItem as any)._id);
										return (
										<div key={cid + '::' + (item.variant || '')} className="bg-gray-50 dark:bg-gray-700 rounded-xl p-3 flex items-center gap-3">
											<div className="flex-1 min-w-0">
												<h4 className="font-medium text-gray-900 dark:text-gray-100 truncate">{item.menuItem.name}{item.variant ? ` (${item.variant})` : ''}</h4>
												<p className="text-sm text-green-600 dark:text-green-400">
													{formatCurrency(priceFor(item.menuItem, item.variant), i18n.language)} × {item.quantity}
												</p>
											</div>
											<div className="flex items-center gap-2">
												<button
													onClick={() => removeFromCart(cid, item.variant)}
													className="p-1.5 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-all"
												>
													<Minus className="h-3 w-3" />
												</button>
												<span className="text-sm font-bold w-6 text-center">{item.quantity}</span>
												<button
													onClick={() => addToCart(item.menuItem, item.variant)}
													className="p-1.5 bg-green-100 dark:bg-green-900/30 text-green-600 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 transition-all"
												>
													<Plus className="h-3 w-3" />
												</button>
											</div>
										</div>
										);
									})
								)}
							</div>

							{/* Cart Footer */}
							{cart.length > 0 && (
								<div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
									<div className="flex items-center justify-between text-lg font-bold">
										<span className="text-gray-900 dark:text-gray-100">{t('menu.total')}</span>
										<span className="text-green-600 dark:text-green-400">{formatCurrency(cartTotal, i18n.language)}</span>
									</div>
									<input
										value={customerName}
										onChange={(e) => setCustomerName(e.target.value)}
										placeholder={t('menu.customerNamePlaceholder')}
										className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm outline-none"
									/>
									<textarea
										value={orderNotes}
										onChange={(e) => setOrderNotes(e.target.value)}
										placeholder={t('menu.orderNotes')}
										className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm resize-none"
										rows={2}
									/>
									{orderError && (
										<p className="text-sm font-bold text-red-600 dark:text-red-400">{orderError}</p>
									)}
									<button
										onClick={handleOrder}
										disabled={submitting}
										className="w-full py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-xl font-medium transition-all duration-200 flex items-center justify-center gap-2 shadow-md hover:shadow-lg disabled:opacity-50"
									>
										<CheckCircle className="h-5 w-5" />
										{submitting ? t('menu.sending') : t('menu.placeOrder')}
									</button>
								</div>
							)}
						</div>
					</div>
				</div>
			)}

			{/* Order Success Toast */}
			{showOrderSuccess && (
				<div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50">
					<div className="bg-green-500 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-bounce">
						<CheckCircle className="h-5 w-5" />
						<span className="font-medium">{lastOrderNumber ? t('menu.orderSuccessWithNumber', { number: lastOrderNumber }) : t('menu.orderSuccess')}</span>
					</div>
				</div>
			)}

			{/* Floating Cart Button */}
			{cartCount > 0 && !showCart && (
				<div className="fixed bottom-6 left-6 z-40">
					<button
						onClick={() => setShowCart(true)}
						className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2"
					>
						<ShoppingCart className="h-5 w-5" />
						<span className="font-medium">{formatDecimal(cartCount, i18n.language)}</span>
						<span className="text-sm">({formatCurrency(cartTotal, i18n.language)})</span>
					</button>
				</div>
			)}
		</div>
	);
};

export default CustomerMenu;
