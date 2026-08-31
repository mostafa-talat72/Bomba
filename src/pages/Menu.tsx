import React, { useState, useEffect, useMemo } from 'react';
import { Utensils, Plus, Search, Sparkles, Eye, EyeOff, ChevronDown, ChevronRight, Edit, Trash2, Copy, LayoutGrid } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../context/AppContext';
import { MenuItem, MenuSection, MenuCategory } from '../services/api';
import { formatDecimal } from '../utils/formatters';
import '../styles/menu-animations.css';
import {
	MenuItemModal,
	MenuQuickViewModal,
	MenuSectionModal,
	MenuCategoryModal,
	MenuDeleteModal
} from '../components/menu';

const Menu: React.FC = () => {
	const { t, i18n } = useTranslation();
	const {
		menuItems,
		menuSections,
		menuCategories,
		fetchMenuItems,
		fetchMenuSections,
		fetchMenuCategories,
		createMenuItem,
		updateMenuItem,
		deleteMenuItem,
		createMenuSection,
		updateMenuSection,
		deleteMenuSection,
		createMenuCategory,
		updateMenuCategory,
		deleteMenuCategory,
		inventoryItems,
		fetchInventoryItems,
		showNotification
	} = useApp();

	// UI State
	const [loading, setLoading] = useState(false);
	const [searchTerm, setSearchTerm] = useState('');
	const [showUnavailable, setShowUnavailable] = useState(true);
	const [activeSection, setActiveSection] = useState<string | null>(null);
	const [activeCategory, setActiveCategory] = useState<string | null>(null);
	const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
	const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
	const [showAddDropdown, setShowAddDropdown] = useState(false);

	// Modal State
	const [showItemModal, setShowItemModal] = useState(false);
	const [showSectionModal, setShowSectionModal] = useState(false);
	const [showCategoryModal, setShowCategoryModal] = useState(false);
	const [showQuickView, setShowQuickView] = useState(false);
	const [showDeleteModal, setShowDeleteModal] = useState<{ show: boolean; id: string | null; type: 'item' | 'section' | 'category' }>({ show: false, id: null, type: 'item' });

	// Editing State
	const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
	const [editingSection, setEditingSection] = useState<MenuSection | null>(null);
	const [editingCategory, setEditingCategory] = useState<MenuCategory | null>(null);
	const [quickViewItem, setQuickViewItem] = useState<MenuItem | null>(null);

	// Form State
	const [formData, setFormData] = useState({
		name: '',
		price: '',
		variants: [] as { size: string; price: string; sku?: string; barcode?: string }[],
		category: '',
		description: '',
		isAvailable: true,
		preparationTime: '5',
		isPopular: false,
		ingredients: [] as { item: string; quantity: number; unit: string }[]
	});

	const [sectionFormData, setSectionFormData] = useState({
		name: '',
		description: '',
		sortOrder: 0
	});

	const [categoryFormData, setCategoryFormData] = useState({
		name: '',
		description: '',
		section: '',
		sortOrder: 0
	});

	// Loading State
	const [deletingItems, setDeletingItems] = useState<Record<string, boolean>>({});
	const [deletingSections, setDeletingSections] = useState<Record<string, boolean>>({});
	const [deletingCategories, setDeletingCategories] = useState<Record<string, boolean>>({});
	const [savingItem, setSavingItem] = useState(false);
	const [savingSection, setSavingSection] = useState(false);
	const [savingCategory, setSavingCategory] = useState(false);

	const unitOptions = [
		t('menu.units.gram'),
		t('menu.units.kilo'),
		t('menu.units.ml'),
		t('menu.units.liter'),
		t('menu.units.piece'),
		t('menu.units.spoon'),
		t('menu.units.cup')
	];

	// Load Data
	useEffect(() => {
		loadMenuItems();
		loadMenuSections();
		loadMenuCategories();
		fetchInventoryItems();
	}, []);

	useEffect(() => {
		if (showItemModal && inventoryItems.length === 0) {
			fetchInventoryItems();
		}
	}, [showItemModal]);

	useEffect(() => {
		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				setShowItemModal(false);
				setShowSectionModal(false);
				setShowCategoryModal(false);
				setShowQuickView(false);
			}
		};
		document.addEventListener('keydown', handleEscape);
		return () => document.removeEventListener('keydown', handleEscape);
	}, []);

	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			const target = e.target as HTMLElement;
			if (!target.closest('[data-add-dropdown]')) {
				setShowAddDropdown(false);
			}
		};
		document.addEventListener('mousedown', handleClickOutside);
		return () => document.removeEventListener('mousedown', handleClickOutside);
	}, []);

	// Data Loading
	const loadMenuSections = async () => {
		try {
			await fetchMenuSections();
		} catch {
			showNotification(t('menu.notifications.loadingSectionsError'), 'error');
		}
	};

	const loadMenuCategories = async () => {
		try {
			await fetchMenuCategories();
		} catch {
			showNotification(t('menu.notifications.loadingCategoriesError'), 'error');
		}
	};

	const loadMenuItems = async () => {
		setLoading(true);
		try {
			await fetchMenuItems();
		} catch {
			showNotification(t('menu.notifications.loadingMenuError'), 'error');
		} finally {
			setLoading(false);
		}
	};

	// Item Handlers
	const handleAddItem = (categoryId?: string) => {
		setEditingItem(null);
		setFormData({
			name: '',
			price: '',
			variants: [{ size: 'عادي', price: '' }],
			category: categoryId || '',
			description: '',
			isAvailable: true,
			preparationTime: '5',
			isPopular: false,
			ingredients: []
		});
		setShowItemModal(true);
	};

	const handleEditItem = (item: MenuItem) => {
		setEditingItem(item);
		const categoryId = typeof item.category === 'string' ? item.category : item.category?.id || item.category?._id || '';
		const variantsData = item.variants && item.variants.length > 0
			? item.variants.map(v => ({ size: v.size, price: String(v.price), sku: v.sku || '', barcode: v.barcode || '' }))
			: [{ size: 'عادي', price: item.price != null ? item.price.toString() : '' }];
		setFormData({
			name: item.name,
			price: item.price != null ? item.price.toString() : (variantsData[0]?.price || ''),
			variants: variantsData,
			category: categoryId,
			description: item.description || '',
			isAvailable: item.isAvailable,
			preparationTime: item.preparationTime.toString(),
			isPopular: item.isPopular,
			ingredients: item.ingredients || []
		});
		setShowItemModal(true);
	};

	const handleDuplicateItem = (item: MenuItem) => {
		setEditingItem(null);
		const categoryId = typeof item.category === 'string' ? item.category : item.category?.id || item.category?._id || '';
		const variantsData = item.variants && item.variants.length > 0
			? item.variants.map(v => ({ size: v.size, price: String(v.price), sku: v.sku || '', barcode: v.barcode || '' }))
			: [{ size: 'عادي', price: item.price != null ? item.price.toString() : '' }];
		setFormData({
			name: `${item.name} (${t('menu.duplicate')})`,
			price: variantsData[0]?.price || '',
			variants: variantsData,
			category: categoryId,
			description: item.description || '',
			isAvailable: item.isAvailable,
			preparationTime: item.preparationTime.toString(),
			isPopular: item.isPopular,
			ingredients: item.ingredients || []
		});
		setShowItemModal(true);
	};

	const handleQuickViewItem = (item: MenuItem) => {
		setQuickViewItem(item);
		setShowQuickView(true);
	};

	const handleSaveItem = async (data: { name: string; price: string; variants?: { size: string; price: string; sku?: string; barcode?: string }[]; category: string; description: string; isAvailable: boolean; preparationTime: string; isPopular: boolean; ingredients: { item: string; quantity: number; unit: string }[] }) => {
		if (!data.name || !data.category) {
			showNotification(t('menu.notifications.enterItemName'), 'error');
			return;
		}
		// Variants validation
		const rawVariants = data.variants && data.variants.length > 0 ? data.variants : [{ size: 'عادي', price: data.price }];
		const cleanedVariants = rawVariants.map(v => ({
			size: String(v.size || '').trim(),
			price: parseFloat(String(v.price)),
			sku: v.sku ? String(v.sku).trim() : undefined,
			barcode: v.barcode ? String(v.barcode).trim() : undefined,
		})).filter(v => v.size && !isNaN(v.price) && v.price >= 0);
		if (cleanedVariants.length === 0) {
			showNotification(t('menu.notifications.enterPrice'), 'error');
			return;
		}
		for (const v of cleanedVariants) {
			if (!v.size) { showNotification('اسم الحجم مطلوب', 'error'); return; }
			if (isNaN(v.price) || v.price <= 0) { showNotification(t('menu.notifications.enterPrice'), 'error'); return; }
		}
		const price = cleanedVariants[0].price;

		const validIngredients = data.ingredients.filter((ing: { item: string; quantity: number; unit: string }) =>
			ing.item && ing.item.trim() !== '' && !isNaN(ing.quantity) && ing.quantity > 0
		);

		if (data.ingredients.length > 0 && validIngredients.length !== data.ingredients.length) {
			showNotification(t('menu.notifications.invalidIngredients'), 'error');
			return;
		}

		const itemData: any = {
			name: data.name.trim(),
			price: price,
			variants: cleanedVariants,
			category: data.category,
			description: data.description.trim(),
			isAvailable: data.isAvailable,
			preparationTime: parseInt(data.preparationTime),
			isPopular: data.isPopular,
			ingredients: validIngredients
		};

		setSavingItem(true);
		try {
			if (editingItem) {
				const result = await updateMenuItem(editingItem.id, itemData);
				if (result) {
					setShowItemModal(false);
					setEditingItem(null);
					await loadMenuItems();
					showNotification(t('menu.notifications.itemUpdatedSuccess'), 'success');
				}
			} else {
				const result = await createMenuItem(itemData);
				if (result) {
					setShowItemModal(false);
					await loadMenuItems();
					showNotification(t('menu.notifications.itemAddedSuccess'), 'success');
				}
			}
		} catch {
			showNotification(t('menu.notifications.saveItemError'), 'error');
		} finally {
			setSavingItem(false);
		}
	};

	const handleDeleteItem = async () => {
		const { id } = showDeleteModal;
		if (!id || showDeleteModal.type !== 'item') return;

		try {
			setDeletingItems(prev => ({ ...prev, [id]: true }));
			const success = await deleteMenuItem(id);
			if (success) {
				await loadMenuItems();
				setShowDeleteModal({ show: false, id: null, type: 'item' });
			}
		} catch {
			showNotification(t('menu.notifications.deleteItemError'), 'error');
		} finally {
			setDeletingItems(prev => ({ ...prev, [id]: false }));
		}
	};

	// Section Handlers
	const handleAddSection = () => {
		setEditingSection(null);
		setSectionFormData({ name: '', description: '', sortOrder: menuSections.length });
		setShowSectionModal(true);
	};

	const handleEditSection = (section: MenuSection) => {
		setEditingSection(section);
		setSectionFormData({ name: section.name, description: section.description || '', sortOrder: section.sortOrder });
		setShowSectionModal(true);
	};

	const handleSaveSection = async (data: { name: string; description: string; sortOrder: number }) => {
		if (!data.name.trim()) {
			showNotification(t('menu.notifications.enterSectionName'), 'error');
			return;
		}

		setSavingSection(true);
		try {
			if (editingSection) {
				await updateMenuSection(editingSection.id, data);
			} else {
				await createMenuSection(data);
			}
			setShowSectionModal(false);
			setEditingSection(null);
			await loadMenuSections();
			showNotification(t('menu.notifications.sectionAddedSuccess'), 'success');
		} catch {
			showNotification(t('menu.notifications.saveSectionError'), 'error');
		} finally {
			setSavingSection(false);
		}
	};

	const handleDeleteSection = async () => {
		const { id } = showDeleteModal;
		if (!id || showDeleteModal.type !== 'section') return;

		try {
			setDeletingSections(prev => ({ ...prev, [id]: true }));
			const success = await deleteMenuSection(id);
			if (success) {
				await loadMenuSections();
				setShowDeleteModal({ show: false, id: null, type: 'item' });
			}
		} catch {
			showNotification(t('menu.notifications.deleteSectionError'), 'error');
		} finally {
			setDeletingSections(prev => ({ ...prev, [id]: false }));
		}
	};

	// Category Handlers
	const handleAddCategory = (sectionId?: string) => {
		setEditingCategory(null);
		setCategoryFormData({
			name: '',
			description: '',
			section: sectionId || '',
			sortOrder: menuCategories.filter(cat => {
				const section = typeof cat.section === 'string' ? cat.section : cat.section?.id || cat.section?._id;
				return section === sectionId;
			}).length
		});
		setShowCategoryModal(true);
	};

	const handleEditCategory = (category: MenuCategory) => {
		setEditingCategory(category);
		const sectionId = typeof category.section === 'string' ? category.section : category.section?.id || category.section?._id;
		setCategoryFormData({ name: category.name, description: category.description || '', section: sectionId || '', sortOrder: category.sortOrder });
		setShowCategoryModal(true);
	};

	const handleSaveCategory = async (data: { name: string; description: string; section: string; sortOrder: number }) => {
		if (!data.name.trim()) {
			showNotification(t('menu.notifications.enterCategoryName'), 'error');
			return;
		}
		if (!data.section) {
			showNotification(t('menu.selectSection'), 'error');
			return;
		}

		setSavingCategory(true);
		try {
			if (editingCategory) {
				await updateMenuCategory(editingCategory.id, data);
			} else {
				await createMenuCategory(data);
			}
			setShowCategoryModal(false);
			setEditingCategory(null);
			await loadMenuCategories();
			showNotification(t('menu.notifications.categoryAddedSuccess'), 'success');
		} catch {
			showNotification(t('menu.notifications.saveCategoryError'), 'error');
		} finally {
			setSavingCategory(false);
		}
	};

	const handleDeleteCategory = async () => {
		const { id } = showDeleteModal;
		if (!id || showDeleteModal.type !== 'category') return;

		try {
			setDeletingCategories(prev => ({ ...prev, [id]: true }));
			const success = await deleteMenuCategory(id);
			if (success) {
				await loadMenuCategories();
				setShowDeleteModal({ show: false, id: null, type: 'item' });
			}
		} catch {
			showNotification(t('menu.notifications.deleteCategoryError'), 'error');
		} finally {
			setDeletingCategories(prev => ({ ...prev, [id]: false }));
		}
	};

	// Ingredients Handlers
	const addIngredient = () => {
		const availableRawMaterials = inventoryItems.filter(item => item.isRawMaterial);
		const selectedItems = formData.ingredients.map(ing => ing.item).filter(item => item !== '');
		const availableItems = availableRawMaterials.filter(item => !selectedItems.includes(item.id));

		if (availableItems.length === 0) return;

		setFormData(prev => ({
			...prev,
			ingredients: [...prev.ingredients, { item: '', quantity: 0, unit: 'جرام' }]
		}));
	};

	const removeIngredient = (index: number) => {
		setFormData(prev => ({
			...prev,
			ingredients: prev.ingredients.filter((_, i) => i !== index)
		}));
	};

	const updateIngredient = (index: number, field: 'item' | 'quantity' | 'unit', value: string | number) => {
		setFormData(prev => {
			const newIngredients = [...prev.ingredients];
			const current = { ...newIngredients[index] };

			if (field === 'unit' && current.quantity > 0) {
				const invItem = inventoryItems.find(i => i.id === current.item);
				if (invItem) {
					const conversions: Record<string, Record<string, number>> = {
						'كيلو': { 'جرام': 1000 }, 'جرام': { 'كيلو': 0.001 },
						'لتر': { 'مل': 1000 }, 'مل': { 'لتر': 0.001 }
					};
					const rate = conversions[current.unit]?.[value as string];
					current.quantity = rate ? Math.round(current.quantity * rate * 1000) / 1000 : current.quantity;
				}
			}

			if (field === 'item' && value !== '') {
				current.unit = inventoryItems.find(i => i.id === value)?.unit || current.unit;
				newIngredients.forEach((ing, i) => { if (i !== index && ing.item === value) ing.item = ''; });
			}

			current[field] = field === 'item' ? (value as string) : value;
			newIngredients[index] = current;
			return { ...prev, ingredients: newIngredients };
		});
	};

	// Filtered Data
	const filteredMenuItems = useMemo(() => {
		let items = menuItems;
		if (searchTerm) {
			items = items.filter(item =>
				item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
				(item.description?.toLowerCase()?.includes(searchTerm.toLowerCase()) ?? false)
			);
		}
		if (!showUnavailable) {
			items = items.filter(item => item.isAvailable);
		}
		return items;
	}, [menuItems, searchTerm, showUnavailable]);

	const filteredMenuItemsByAvailability = showUnavailable
		? menuItems
		: menuItems.filter(item => item.isAvailable);

	const getCategoryId = (item: MenuItem) => typeof item.category === 'string' ? item.category : item.category?.id || item.category?._id;
	const getSectionId = (cat: MenuCategory) => typeof cat.section === 'string' ? cat.section : cat.section?.id || cat.section?._id;

	const sortedSections = useMemo(() =>
		[...menuSections].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
		[menuSections]
	);

	const sectionGroups = useMemo(() =>
		sortedSections.map(section => {
			const categories = menuCategories
				.filter(cat => getSectionId(cat) === section.id)
				.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
			const categoryIds = new Set(categories.map(c => c.id));
			const items = filteredMenuItems.filter(item => categoryIds.has(getCategoryId(item)));
			return { section, categories, items };
		}),
		[sortedSections, menuCategories, filteredMenuItems]
	);

	const filteredGroups = useMemo(() => {
		let groups = sectionGroups;
		if (activeSection) {
			groups = groups.filter(g => g.section.id === activeSection);
		}
		if (activeCategory) {
			groups = groups.map(g => ({
				...g,
				categories: g.categories.filter(c => c.id === activeCategory),
				items: g.items.filter(item => {
					const catId = typeof item.category === 'string' ? item.category : item.category?.id || item.category?._id;
					return catId === activeCategory;
				})
			})).filter(g => g.items.length > 0);
		}
		return groups;
	}, [sectionGroups, activeSection, activeCategory]);

	const toggleSectionCollapse = (sectionId: string) => {
		setCollapsedSections(prev => ({ ...prev, [sectionId]: !prev[sectionId] }));
	};

	const toggleCategoryCollapse = (categoryId: string) => {
		setCollapsedCategories(prev => ({ ...prev, [categoryId]: !prev[categoryId] }));
	};

	return (
		<div className="space-y-6 p-4">
			{/* Header */}
			<div className="bg-gradient-to-r from-orange-50 via-white to-orange-50 dark:from-gray-800 dark:via-gray-800 dark:to-gray-800 rounded-2xl shadow-lg border border-orange-100 dark:border-gray-700 p-6">
				<div className="flex items-center justify-between flex-wrap gap-4">
					<div className="flex flex-col">
						<div className="flex items-center gap-3 mb-2">
							<div className="p-3 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-lg">
								<Utensils className="h-7 w-7 text-white" />
							</div>
							<div>
								<h1 className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-orange-500 bg-clip-text text-transparent dark:from-orange-400 dark:to-orange-300">
									{t('menu.pageTitle')}
								</h1>
								<p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1">
									<Sparkles className="h-4 w-4" />
									{t('menu.pageSubtitle')}
								</p>
							</div>
						</div>
					</div>
					<div className="flex items-center gap-2 flex-wrap">
						<button
							onClick={() => window.open('/menu-view', '_blank')}
							className="action-button bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-md hover:shadow-lg transition-all duration-200"
						>
							<Eye className="h-5 w-5" />
							<span className="font-medium">{t('menu.preview')}</span>
						</button>
						<div className="relative" data-add-dropdown>
							<button
								onClick={() => setShowAddDropdown(!showAddDropdown)}
								className="action-button bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 dark:from-orange-500 dark:to-orange-600 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-md hover:shadow-lg transition-all duration-200"
							>
								<Plus className="h-5 w-5" />
								<span className="font-medium">{t('menu.add')}</span>
								<ChevronDown className={`h-4 w-4 transition-transform duration-200 ${showAddDropdown ? 'rotate-180' : ''}`} />
							</button>
							{showAddDropdown && (
								<div className="absolute right-0 mt-2 w-52 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 py-2 z-50">
									<button
										onClick={() => { setShowAddDropdown(false); handleAddSection(); }}
										className="w-full px-4 py-2.5 text-left flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
									>
										<div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
											<LayoutGrid className="h-4 w-4 text-blue-600 dark:text-blue-400" />
										</div>
										<div>
											<div className="text-sm font-medium text-gray-900 dark:text-gray-100">{t('menu.addSection')}</div>
										</div>
									</button>
									<button
										onClick={() => { setShowAddDropdown(false); handleAddCategory(); }}
										className="w-full px-4 py-2.5 text-left flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
									>
										<div className="p-1.5 bg-green-100 dark:bg-green-900/30 rounded-lg">
											<LayoutGrid className="h-4 w-4 text-green-600 dark:text-green-400" />
										</div>
										<div>
											<div className="text-sm font-medium text-gray-900 dark:text-gray-100">{t('menu.addCategory')}</div>
										</div>
									</button>
									<button
										onClick={() => { setShowAddDropdown(false); handleAddItem(); }}
										className="w-full px-4 py-2.5 text-left flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
									>
										<div className="p-1.5 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
											<Plus className="h-4 w-4 text-orange-600 dark:text-orange-400" />
										</div>
										<div>
											<div className="text-sm font-medium text-gray-900 dark:text-gray-100">{t('menu.addItem')}</div>
										</div>
									</button>
								</div>
							)}
						</div>
					</div>
				</div>
			</div>

			{/* Search + Filters */}
			<div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-4">
				<div className="flex items-center gap-4 flex-wrap">
					<div className="flex-1 min-w-[250px]">
						<div className="relative">
							<Search className="absolute right-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 dark:text-gray-500" />
							<input
								type="text"
								value={searchTerm}
								onChange={(e) => setSearchTerm(e.target.value)}
								placeholder={t('menu.searchPlaceholder')}
								className="search-input w-full pr-12 pl-4 border-2 border-gray-200 dark:border-gray-600 rounded-xl px-4 py-3 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 focus:bg-white dark:focus:bg-gray-600 transition-all duration-200"
							/>
						</div>
					</div>
					<div className="flex items-center gap-2">
						<button
							onClick={() => setShowUnavailable(!showUnavailable)}
							className={`p-2.5 rounded-xl transition-all duration-200 ${showUnavailable ? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400' : 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400'}`}
							title={showUnavailable ? t('menu.showAvailable') : t('menu.hideUnavailable')}
						>
							{showUnavailable ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
						</button>
					</div>
					<div className="bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 px-4 py-2 rounded-xl border border-orange-200 dark:border-orange-700">
						<div className="text-xs text-gray-600 dark:text-gray-400">{t('menu.totalItems')}</div>
						<div className="text-lg font-bold text-orange-600 dark:text-orange-400">{formatDecimal(filteredMenuItemsByAvailability.length, i18n.language)}</div>
					</div>
				</div>
			</div>

			{/* Section Tabs */}
			{menuSections.length > 0 && (
				<div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
					<button
						onClick={() => { setActiveSection(null); setActiveCategory(null); }}
						className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200 flex-shrink-0 ${
							!activeSection
								? 'bg-orange-500 text-white shadow-md'
								: 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
						}`}
					>
						{t('menu.all')}
						<span className="ms-1.5 text-xs opacity-80">({formatDecimal(filteredMenuItemsByAvailability.length, i18n.language)})</span>
					</button>
					{sortedSections.map(section => {
						const sectionCatIds = menuCategories.filter(c => getSectionId(c) === section.id).map(c => c.id);
						const count = filteredMenuItemsByAvailability.filter(item => sectionCatIds.includes(getCategoryId(item))).length;
						return (
							<button
								key={section.id}
								onClick={() => { setActiveSection(activeSection === section.id ? null : section.id); setActiveCategory(null); }}
								className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200 flex items-center gap-1.5 flex-shrink-0 ${
									activeSection === section.id
										? 'bg-blue-500 text-white shadow-md'
										: 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
								}`}
							>
								{section.name}
								<span className={`text-xs px-1.5 py-0.5 rounded-full ${
									activeSection === section.id ? 'bg-blue-400 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400'
								}`}>{formatDecimal(count, i18n.language)}</span>
							</button>
						);
					})}
				</div>
			)}

			{/* Category Tabs (shown when a section is selected) */}
			{activeSection && (() => {
				const sectionCategories = menuCategories.filter(c => getSectionId(c) === activeSection).sort((a, b) => a.sortOrder - b.sortOrder);
				if (sectionCategories.length <= 1) return null;
				return (
					<div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
						<button
							onClick={() => setActiveCategory(null)}
							className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-200 flex-shrink-0 ${
								!activeCategory
									? 'bg-emerald-500 text-white shadow-sm'
									: 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-600'
							}`}
						>
							{t('menu.all')}
						</button>
						{sectionCategories.map(cat => {
							const count = filteredMenuItems.filter(item => getCategoryId(item) === cat.id).length;
							return (
								<button
									key={cat.id}
									onClick={() => setActiveCategory(activeCategory === cat.id ? null : cat.id)}
									className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-200 flex items-center gap-1.5 flex-shrink-0 ${
										activeCategory === cat.id
											? 'bg-emerald-500 text-white shadow-sm'
											: 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-600'
									}`}
								>
									{cat.name}
									<span className={`text-xs px-1 py-0.5 rounded-full ${
										activeCategory === cat.id ? 'bg-emerald-400 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400'
									}`}>{formatDecimal(count, i18n.language)}</span>
								</button>
							);
						})}
					</div>
				);
			})()}

			{/* Main Content */}
			{loading ? (
				<div className="text-center py-12 bg-white dark:bg-gray-800 rounded-2xl shadow-lg">
					<div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-200 border-t-orange-600 dark:border-orange-800 dark:border-t-orange-400 mx-auto"></div>
					<p className="mt-4 text-gray-600 dark:text-gray-300 font-medium">{t('menu.loading')}</p>
				</div>
			) : menuSections.length === 0 ? (
				<div className="empty-state text-center py-16 bg-gradient-to-br from-gray-50 to-white dark:from-gray-800 dark:to-gray-800 rounded-2xl shadow-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
					<div className="bg-gradient-to-br from-orange-100 to-orange-50 dark:from-orange-900/20 dark:to-orange-800/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
						<LayoutGrid className="h-10 w-10 text-orange-600 dark:text-orange-400" />
					</div>
					<p className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('menu.noSections')}</p>
					<p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{t('menu.noSectionsSubtitle')}</p>
					<button
						onClick={handleAddSection}
						className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-medium transition-all duration-200"
					>
						{t('menu.addSection')}
					</button>
				</div>
			) : filteredGroups.length === 0 ? (
				<div className="empty-state text-center py-16 bg-gradient-to-br from-gray-50 to-white dark:from-gray-800 dark:to-gray-800 rounded-2xl shadow-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
					<div className="bg-gradient-to-br from-orange-100 to-orange-50 dark:from-orange-900/20 dark:to-orange-800/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
						<Search className="h-10 w-10 text-orange-600 dark:text-orange-400" />
					</div>
					<p className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('menu.noSearchResults')}</p>
					<p className="text-sm text-gray-500 dark:text-gray-400">{t('menu.tryDifferentSearch')}</p>
				</div>
			) : (
				<div className="space-y-6">
					{filteredGroups.map(({ section, categories, items }) => (
						<div key={section.id} className="rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
							{/* Section Header */}
							<div className="bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-700 dark:to-blue-800 px-6 py-4 cursor-pointer hover:from-blue-700 hover:to-blue-800 transition-colors" onClick={() => toggleSectionCollapse(section.id)}>
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-3">
										<div className="p-1.5 text-white/60">
											{collapsedSections[section.id] ? <ChevronRight className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
										</div>
										<div className="w-1.5 h-10 bg-white/30 rounded-full"></div>
										<div>
											<h2 className="text-lg font-bold text-white">{section.name}</h2>
											{section.description && (
												<p className="text-xs text-blue-100 mt-0.5">{section.description}</p>
											)}
										</div>
										<span className="text-xs bg-white/20 text-white px-2.5 py-1 rounded-full font-medium">
											{formatDecimal(items.length, i18n.language)} {t('menu.itemsCountLabel')}
										</span>
									</div>
									<div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
										<button
											onClick={() => handleAddCategory(section.id)}
											className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium flex items-center gap-1.5 transition-colors"
											title={t('menu.addCategory')}
										>
											<Plus className="h-3.5 w-3.5" />
											{t('menu.addCategory')}
										</button>
										<button
											onClick={() => handleEditSection(section)}
											className="p-2 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors"
											title={t('common.edit')}
										>
											<Edit className="h-4 w-4" />
										</button>
										<button
											onClick={() => setShowDeleteModal({ show: true, id: section.id, type: 'section' })}
											className="p-2 rounded-lg hover:bg-red-500/30 text-white/80 hover:text-white transition-colors"
											title={t('common.delete')}
											disabled={!!deletingSections[section.id]}
										>
											<Trash2 className="h-4 w-4" />
										</button>
									</div>
								</div>
							</div>

							{/* Categories */}
							{!collapsedSections[section.id] && (
							<div className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
								{categories.length === 0 && items.length === 0 ? (
									<div className="px-6 py-8 text-center">
										<p className="text-sm text-gray-400 dark:text-gray-500 italic">{t('menu.noCategoriesOrItems')}</p>
									</div>
								) : (
									categories.map(category => {
										const categoryItems = items.filter(item => getCategoryId(item) === category.id);
										return (
											<div key={category.id}>
												{/* Category Header */}
												<div className="bg-gradient-to-r from-emerald-50 to-emerald-100/50 dark:from-emerald-900/20 dark:to-emerald-800/10 px-6 py-3 cursor-pointer hover:from-emerald-100 hover:to-emerald-100/70 dark:hover:from-emerald-900/30 dark:hover:to-emerald-800/20 transition-colors" onClick={() => toggleCategoryCollapse(category.id)}>
													<div className="flex items-center justify-between">
														<div className="flex items-center gap-2.5">
															<div className="p-1 text-emerald-500 dark:text-emerald-400">
																{collapsedCategories[category.id] ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
															</div>
															<div className="w-1.5 h-6 bg-emerald-500 rounded-full"></div>
															<h3 className="text-sm font-bold text-emerald-800 dark:text-emerald-300">{category.name}</h3>
															{category.description && (
																<span className="text-xs text-emerald-600/70 dark:text-emerald-400/60">- {category.description}</span>
															)}
															<span className="text-xs bg-emerald-200 dark:bg-emerald-800/40 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full font-medium">
																{formatDecimal(categoryItems.length, i18n.language)}
															</span>
														</div>
														<div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
															<button
																onClick={() => handleAddItem(category.id)}
																className="px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 hover:bg-emerald-200 dark:hover:bg-emerald-800/50 text-emerald-700 dark:text-emerald-400 text-xs font-medium flex items-center gap-1 transition-colors"
																title={t('menu.addItem')}
															>
																<Plus className="h-3 w-3" />
																{t('menu.addItem')}
															</button>
															<button
																onClick={() => handleEditCategory(category)}
																className="p-1.5 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 transition-colors"
																title={t('common.edit')}
															>
																<Edit className="h-3.5 w-3.5" />
															</button>
															<button
																onClick={() => setShowDeleteModal({ show: true, id: category.id, type: 'category' })}
																className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 dark:text-red-400 transition-colors"
																title={t('common.delete')}
																disabled={!!deletingCategories[category.id]}
															>
																<Trash2 className="h-3.5 w-3.5" />
															</button>
														</div>
													</div>
												</div>

												{/* Items Grid */}
												{!collapsedCategories[category.id] && (
												<div>
												{categoryItems.length === 0 ? (
													<div className="px-6 py-5 text-center">
														<p className="text-xs text-gray-400 dark:text-gray-500 italic">{t('menu.noItemsInCategory')}</p>
													</div>
												) : (
													<div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
														{categoryItems.map(item => (
															<div
																key={item.id}
																className="group bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-xl border border-gray-200 dark:border-gray-600 p-4 transition-all duration-200 hover:shadow-md"
															>
																<div className="flex items-start justify-between mb-2">
																	<div className="flex-1 min-w-0">
																		<div className="flex items-center gap-2">
																			<p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{item.name}</p>
																			{item.isPopular && (
																				<span className="text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 px-1.5 py-0.5 rounded-full flex-shrink-0">★</span>
																			)}
																		</div>
																		{item.description && (
																			<p className="text-xs text-gray-400 dark:text-gray-500 mt-1 truncate">{item.description}</p>
																		)}
																	</div>
																	<span className={`flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
																		item.isAvailable
																			? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
																			: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
																	}`}>
																		{item.isAvailable ? t('menu.available') : t('menu.unavailable')}
																	</span>
																</div>

																<div className="flex items-center justify-between mt-3">
																	<div className="flex flex-col gap-1">
																		{item.variants && item.variants.length > 0 ? (
																			<div className="flex flex-wrap gap-1">
																				{item.variants.slice(0,3).map(v => (
																					<span key={v.size} className="text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 px-1.5 py-0.5 rounded-full">
																						{v.size}: {formatDecimal(v.price, i18n.language)}
																					</span>
																				))}
																				{item.variants.length > 3 && <span className="text-xs text-gray-400">+{item.variants.length - 3}</span>}
																			</div>
																		) : (
																			<span className="text-base font-bold text-gray-900 dark:text-gray-100">
																				{formatDecimal(item.price, i18n.language)}
																			</span>
																		)}
																		<span className="text-xs text-gray-400 dark:text-gray-500">
																			{formatDecimal(item.preparationTime, i18n.language)} {t('menu.minutes')}
																		</span>
																	</div>
																	<div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
																		<button
																			onClick={() => handleQuickViewItem(item)}
																			className="p-1.5 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 text-purple-600 dark:text-purple-400 transition-colors"
																			title={t('menu.view')}
																		>
																			<Eye className="h-3.5 w-3.5" />
																		</button>
																		<button
																			onClick={() => handleEditItem(item)}
																			className="p-1.5 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 transition-colors"
																			title={t('common.edit')}
																		>
																			<Edit className="h-3.5 w-3.5" />
																		</button>
																		<button
																			onClick={() => handleDuplicateItem(item)}
																			className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 dark:text-gray-400 transition-colors"
																			title={t('menu.duplicate')}
																		>
																			<Copy className="h-3.5 w-3.5" />
																		</button>
																		<button
																			onClick={() => setShowDeleteModal({ show: true, id: item.id, type: 'item' })}
																			className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 dark:text-red-400 transition-colors"
																			title={t('common.delete')}
																			disabled={!!deletingItems[item.id]}
																		>
																			<Trash2 className="h-3.5 w-3.5" />
																		</button>
																	</div>
																</div>
															</div>
														))}
													</div>
												)}
												</div>
												)}
											</div>
										);
									})
								)}
							</div>
							)}
						</div>
					))}
				</div>
			)}

			{/* Modals */}
			<MenuItemModal
				isOpen={showItemModal}
				onClose={() => setShowItemModal(false)}
				onSave={handleSaveItem}
				editingItem={editingItem}
				formData={formData}
				setFormData={setFormData}
				menuCategories={menuCategories}
				menuSections={menuSections}
				inventoryItems={inventoryItems}
				saving={savingItem}
				unitOptions={unitOptions}
				addIngredient={addIngredient}
				removeIngredient={removeIngredient}
				updateIngredient={updateIngredient}
				fetchInventoryItems={fetchInventoryItems}
			/>

			<MenuQuickViewModal
				isOpen={showQuickView}
				onClose={() => setShowQuickView(false)}
				item={quickViewItem}
				onEdit={handleEditItem}
				onDuplicate={handleDuplicateItem}
				inventoryItems={inventoryItems}
			/>

			<MenuSectionModal
				isOpen={showSectionModal}
				onClose={() => setShowSectionModal(false)}
				onSave={handleSaveSection}
				editingSection={editingSection}
				formData={sectionFormData}
				setFormData={setSectionFormData}
				saving={savingSection}
			/>

			<MenuCategoryModal
				isOpen={showCategoryModal}
				onClose={() => setShowCategoryModal(false)}
				onSave={handleSaveCategory}
				editingCategory={editingCategory}
				formData={categoryFormData}
				setFormData={setCategoryFormData}
				menuSections={menuSections}
				saving={savingCategory}
			/>

			<MenuDeleteModal
				isOpen={showDeleteModal.show}
				onClose={() => setShowDeleteModal({ show: false, id: null, type: 'item' })}
				onConfirm={() => {
					if (showDeleteModal.type === 'item') handleDeleteItem();
					else if (showDeleteModal.type === 'section') handleDeleteSection();
					else if (showDeleteModal.type === 'category') handleDeleteCategory();
				}}
				type={showDeleteModal.type}
				isDeleting={
					(showDeleteModal.type === 'item' && deletingItems[showDeleteModal.id || '']) ||
					(showDeleteModal.type === 'section' && deletingSections[showDeleteModal.id || '']) ||
					(showDeleteModal.type === 'category' && deletingCategories[showDeleteModal.id || '']) ||
					false
				}
			/>
		</div>
	);
};

export default Menu;
