import React, { useState, useEffect, useMemo } from 'react';
import { Utensils, Search, Star, Clock, ShoppingCart, Plus, Minus, X, CheckCircle, Sun, Moon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { MenuItem } from '../services/api';
import { formatCurrency, formatDecimal } from '../utils/formatters';
import '../styles/menu-animations.css';

interface CartItem {
	menuItem: MenuItem;
	quantity: number;
	notes: string;
}

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
	const [orderNotes, setOrderNotes] = useState('');
	const [activeFilters, setActiveFilters] = useState({
		availableOnly: true,
		popularOnly: false
	});

	useEffect(() => {
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
	}, []);

	const filteredItems = useMemo(() => {
		return menuItems.filter(item => {
			if (activeFilters.availableOnly && !item.isAvailable) return false;
			if (activeFilters.popularOnly && !item.isPopular) return false;
			if (searchTerm) {
				const matches = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
					(item.description?.toLowerCase()?.includes(searchTerm.toLowerCase()) ?? false);
				if (!matches) return false;
			}
			return true;
		});
	}, [menuItems, searchTerm, activeFilters]);

	const getCategoriesForSection = (sectionId: string) => {
		return menuCategories.filter(cat => {
			const section = typeof cat.section === 'string' ? cat.section : cat.section?.id || cat.section?._id;
			return section === sectionId;
		}).sort((a, b) => a.sortOrder - b.sortOrder);
	};

	const getItemsForCategory = (categoryId: string) => {
		return filteredItems.filter(item => {
			const category = typeof item.category === 'string' ? item.category : item.category?.id || item.category?._id;
			return category === categoryId;
		}).sort((a, b) => a.name.localeCompare(b.name));
	};

	const addToCart = (item: MenuItem) => {
		setCart(prev => {
			const existing = prev.find(c => c.menuItem.id === item.id);
			if (existing) {
				return prev.map(c => c.menuItem.id === item.id ? { ...c, quantity: c.quantity + 1 } : c);
			}
			return [...prev, { menuItem: item, quantity: 1, notes: '' }];
		});
	};

	const removeFromCart = (itemId: string) => {
		setCart(prev => {
			const existing = prev.find(c => c.menuItem.id === itemId);
			if (existing && existing.quantity > 1) {
				return prev.map(c => c.menuItem.id === itemId ? { ...c, quantity: c.quantity - 1 } : c);
			}
			return prev.filter(c => c.menuItem.id !== itemId);
		});
	};

	const getCartQuantity = (itemId: string) => {
		return cart.find(c => c.menuItem.id === itemId)?.quantity || 0;
	};

	const cartTotal = cart.reduce((acc, item) => acc + (item.menuItem.price * item.quantity), 0);
	const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);

	const handleOrder = async () => {
		if (cart.length === 0) return;

		try {
			const orderData = {
				items: cart.map(c => ({
					menuItem: c.menuItem.id,
					name: c.menuItem.name,
					price: c.menuItem.price,
					quantity: c.quantity,
					notes: c.notes
				})),
				notes: orderNotes
			};

			await createOrder(orderData);
			setShowOrderSuccess(true);
			setCart([]);
			setOrderNotes('');
			setTimeout(() => setShowOrderSuccess(false), 3000);
		} catch (error) {
			console.error('Error placing order:', error);
		}
	};

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

			<div className="max-w-7xl mx-auto px-4 py-6">
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
					{menuSections.sort((a, b) => a.sortOrder - b.sortOrder).map(section => (
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
								const category = menuCategories.find(c => c.id === categoryId);
								const sectionId = category ? (typeof category.section === 'string' ? category.section : category.section?.id || category.section?._id) : null;
								return sectionId === selectedSection;
							})).map(item => (
								<div key={item.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-4 hover:shadow-lg transition-all duration-300">
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
											{formatCurrency(item.price, i18n.language)}
										</span>
										<div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
											<Clock className="h-3 w-3" />
											<span>{formatDecimal(item.preparationTime, i18n.language)} {t('menu.minutes')}</span>
										</div>
									</div>
									<div className="flex items-center justify-end">
										{getCartQuantity(item.id) === 0 ? (
											<button
												onClick={() => addToCart(item)}
												className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-1"
											>
												<Plus className="h-4 w-4" />
												{t('menu.add')}
											</button>
										) : (
											<div className="flex items-center gap-2">
												<button
													onClick={() => removeFromCart(item.id)}
													className="p-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-all"
												>
													<Minus className="h-4 w-4" />
												</button>
												<span className="text-lg font-bold text-gray-900 dark:text-gray-100 w-8 text-center">
													{getCartQuantity(item.id)}
												</span>
												<button
													onClick={() => addToCart(item)}
													className="p-2 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 transition-all"
												>
													<Plus className="h-4 w-4" />
												</button>
											</div>
										)}
									</div>
								</div>
							))}
						</div>
					</div>
				) : (
					/* All Sections View */
					<div className="space-y-8">
						{menuSections.sort((a, b) => a.sortOrder - b.sortOrder).map(section => {
							const sectionItems = filteredItems.filter(item => {
								const categoryId = typeof item.category === 'string' ? item.category : item.category?.id || item.category?._id;
								const category = menuCategories.find(c => c.id === categoryId);
								const sectionId = category ? (typeof category.section === 'string' ? category.section : category.section?.id || category.section?._id) : null;
								return sectionId === section.id;
							});

							if (sectionItems.length === 0) return null;

							return (
								<div key={section.id} className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
									<div className="section-header p-4 border-b-2 border-blue-200 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-900/10">
										<h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{section.name}</h2>
										{section.description && (
											<p className="text-sm text-gray-600 dark:text-gray-400">{section.description}</p>
										)}
									</div>
									<div className="p-4">
										<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
											{sectionItems.slice(0, 8).map(item => (
												<div key={item.id} className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4 border border-gray-100 dark:border-gray-700 hover:shadow-md transition-all duration-300">
													<div className="flex items-start justify-between mb-2">
														<h3 className="text-base font-bold text-gray-900 dark:text-gray-100 truncate">{item.name}</h3>
														{item.isPopular && <Star className="h-3 w-3 text-yellow-500 fill-yellow-500 shrink-0" />}
													</div>
													<div className="flex items-center justify-between mb-3">
														<span className="text-sm font-bold text-green-600 dark:text-green-400">
															{formatCurrency(item.price, i18n.language)}
														</span>
													</div>
													<div className="flex items-center justify-end">
														{getCartQuantity(item.id) === 0 ? (
															<button
																onClick={() => addToCart(item)}
																className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-medium transition-all duration-200"
															>
																<Plus className="h-3 w-3" />
															</button>
														) : (
															<div className="flex items-center gap-1">
																<button
																	onClick={() => removeFromCart(item.id)}
																	className="p-1 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-md"
																>
																	<Minus className="h-3 w-3" />
																</button>
																<span className="text-sm font-bold w-6 text-center">{getCartQuantity(item.id)}</span>
																<button
																	onClick={() => addToCart(item)}
																	className="p-1 bg-green-100 dark:bg-green-900/30 text-green-600 rounded-md"
																>
																	<Plus className="h-3 w-3" />
																</button>
															</div>
														)}
													</div>
												</div>
											))}
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
									cart.map(item => (
										<div key={item.menuItem.id} className="bg-gray-50 dark:bg-gray-700 rounded-xl p-3 flex items-center gap-3">
											<div className="flex-1 min-w-0">
												<h4 className="font-medium text-gray-900 dark:text-gray-100 truncate">{item.menuItem.name}</h4>
												<p className="text-sm text-green-600 dark:text-green-400">
													{formatCurrency(item.menuItem.price, i18n.language)} × {item.quantity}
												</p>
											</div>
											<div className="flex items-center gap-2">
												<button
													onClick={() => removeFromCart(item.menuItem.id)}
													className="p-1.5 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-all"
												>
													<Minus className="h-3 w-3" />
												</button>
												<span className="text-sm font-bold w-6 text-center">{item.quantity}</span>
												<button
													onClick={() => addToCart(item.menuItem)}
													className="p-1.5 bg-green-100 dark:bg-green-900/30 text-green-600 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 transition-all"
												>
													<Plus className="h-3 w-3" />
												</button>
											</div>
										</div>
									))
								)}
							</div>

							{/* Cart Footer */}
							{cart.length > 0 && (
								<div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
									<div className="flex items-center justify-between text-lg font-bold">
										<span className="text-gray-900 dark:text-gray-100">{t('menu.total')}</span>
										<span className="text-green-600 dark:text-green-400">{formatCurrency(cartTotal, i18n.language)}</span>
									</div>
									<textarea
										value={orderNotes}
										onChange={(e) => setOrderNotes(e.target.value)}
										placeholder={t('menu.orderNotes')}
										className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm resize-none"
										rows={2}
									/>
									<button
										onClick={handleOrder}
										className="w-full py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-xl font-medium transition-all duration-200 flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
									>
										<CheckCircle className="h-5 w-5" />
										{t('menu.placeOrder')}
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
						<span className="font-medium">{t('menu.orderSuccess')}</span>
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
