import React, { useState, useEffect } from 'react';
import { Utensils, Plus, Edit, Trash2, X, Search, TrendingUp, Clock, Star, CheckCircle, Folder, FolderOpen, ChevronDown, ChevronRight, Layers, Sparkles } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { MenuItem, MenuSection, MenuCategory } from '../services/api';
import { formatCurrency, formatQuantity, formatDecimal } from '../utils/formatters';
import '../styles/menu-animations.css';

const Menu: React.FC = () => {
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
	const [loading, setLoading] = useState(false);
	const [showAddModal, setShowAddModal] = useState(false);
	const [showSectionModal, setShowSectionModal] = useState(false);
	const [showCategoryModal, setShowCategoryModal] = useState(false);
	const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
	const [editingSection, setEditingSection] = useState<MenuSection | null>(null);
	const [editingCategory, setEditingCategory] = useState<MenuCategory | null>(null);
	const [deletingItems, setDeletingItems] = useState<Record<string, boolean>>({});
	const [deletingSections, setDeletingSections] = useState<Record<string, boolean>>({});
	const [deletingCategories, setDeletingCategories] = useState<Record<string, boolean>>({});
	const [savingItem, setSavingItem] = useState(false);
	const [savingSection, setSavingSection] = useState(false);
	const [savingCategory, setSavingCategory] = useState(false);
	const [showDeleteModal, setShowDeleteModal] = useState<{show: boolean, itemId: string | null, type: 'item' | 'section' | 'category'}>({show: false, itemId: null, type: 'item'});
	const [searchTerm, setSearchTerm] = useState('');
	const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
	const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

	// Form state
	const [formData, setFormData] = useState({
		name: '',
		price: '',
		category: '',
		description: '',
		isAvailable: true,
		preparationTime: '5',
		isPopular: false,
		ingredients: [] as { item: string; quantity: number; unit: string }[]
	});

	const unitOptions = ['جرام', 'كيلو', 'مل', 'لتر', 'قطعة', 'ملعقة', 'كوب'];

	// Form states
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

	useEffect(() => {
		loadMenuItems();
		loadMenuSections();
		loadMenuCategories();
		fetchInventoryItems();
	}, []);

	const loadMenuSections = async () => {
		try {
			await fetchMenuSections();
		} catch (error) {
			showNotification('خطأ في تحميل الأقسام', 'error');
		}
	};

	const loadMenuCategories = async () => {
		try {
			await fetchMenuCategories();
		} catch (error) {
			showNotification('خطأ في تحميل الفئات', 'error');
		}
	};

	// إعادة تحميل الخامات عند فتح النافذة
	useEffect(() => {
		if (showAddModal && inventoryItems.length === 0) {
			fetchInventoryItems();
		}
	}, [showAddModal]);


	// إضافة دعم مفتاح ESC للخروج من النوافذ
	useEffect(() => {
		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				setShowAddModal(false);
				setShowSectionModal(false);
				setShowCategoryModal(false);
			}
		};

		document.addEventListener('keydown', handleEscape);
		return () => document.removeEventListener('keydown', handleEscape);
	}, []);

	// Helper functions
	const toggleSection = (sectionId: string) => {
		setExpandedSections(prev => ({
			...prev,
			[sectionId]: !prev[sectionId]
		}));
	};

	const toggleCategory = (categoryId: string) => {
		setExpandedCategories(prev => ({
			...prev,
			[categoryId]: !prev[categoryId]
		}));
	};

	// Get categories for a section
	const getCategoriesForSection = (sectionId: string) => {
		return menuCategories.filter(cat => {
			const section = typeof cat.section === 'string' ? cat.section : cat.section?.id || cat.section?._id;
			return section === sectionId;
		}).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
	};

	// Get items for a category
	const getItemsForCategory = (categoryId: string) => {
		return menuItems.filter(item => {
			const category = typeof item.category === 'string' ? item.category : item.category?.id || item.category?._id;
			return category === categoryId;
		}).sort((a, b) => a.name.localeCompare(b.name));
	};

	const loadMenuItems = async () => {
		setLoading(true);
		try {
			// Fetch all menu items
			await fetchMenuItems();
		} catch (error) {
			showNotification('خطأ في تحميل قائمة الطعام', 'error');
		} finally {
			setLoading(false);
		}
	};

	const handleAddItem = (categoryId?: string) => {
		setEditingItem(null);
		setFormData({
			name: '',
			price: '',
			category: categoryId || '',
			description: '',
			isAvailable: true,
			preparationTime: '5',
			isPopular: false,
			ingredients: []
		});
		setShowAddModal(true);
	};

	const handleEditItem = (item: MenuItem) => {
		setEditingItem(item);
		const categoryId = typeof item.category === 'string' ? item.category : item.category?.id || item.category?._id || '';
		setFormData({
			name: item.name,
			price: item.price.toString(),
			category: categoryId,
			description: item.description || '',
			isAvailable: item.isAvailable,
			preparationTime: item.preparationTime.toString(),
			isPopular: item.isPopular,
			ingredients: item.ingredients || []
		});
		setShowAddModal(true);
	};

	const handleDeleteItem = async () => {
		const { itemId } = showDeleteModal;
		if (!itemId || showDeleteModal.type !== 'item') return;

		try {
			setDeletingItems(prev => ({ ...prev, [itemId]: true }));
			const success = await deleteMenuItem(itemId);
			if (success) {
				await loadMenuItems();
				setShowDeleteModal({show: false, itemId: null, type: 'item'});
			}
		} catch (error) {
			showNotification('حدث خطأ أثناء حذف العنصر', 'error');
		} finally {
			setDeletingItems(prev => ({ ...prev, [itemId]: false }));
		}
	};

	const openDeleteModal = (itemId: string, type: 'item' | 'section' | 'category' = 'item') => {
		setShowDeleteModal({show: true, itemId, type});
	};

	const closeDeleteModal = () => {
		setShowDeleteModal({show: false, itemId: null, type: 'item'});
	};

	// Section handlers
	const handleAddSection = () => {
		setEditingSection(null);
		setSectionFormData({
			name: '',
			description: '',
			sortOrder: menuSections.length
		});
		setShowSectionModal(true);
	};

	const handleEditSection = (section: MenuSection) => {
		setEditingSection(section);
		setSectionFormData({
			name: section.name,
			description: section.description || '',
			sortOrder: section.sortOrder
		});
		setShowSectionModal(true);
	};

	const handleSaveSection = async () => {
		if (!sectionFormData.name.trim()) {
			showNotification('يرجى إدخال اسم القسم', 'error');
			return;
		}

		setSavingSection(true);
		try {
			if (editingSection) {
				await updateMenuSection(editingSection.id, sectionFormData);
			} else {
				await createMenuSection(sectionFormData);
			}
			setShowSectionModal(false);
			setEditingSection(null);
			await loadMenuSections();
		} catch (error) {
			showNotification('حدث خطأ أثناء حفظ القسم', 'error');
		} finally {
			setSavingSection(false);
		}
	};

	const handleDeleteSection = async () => {
		const { itemId } = showDeleteModal;
		if (!itemId || showDeleteModal.type !== 'section') return;

		try {
			setDeletingSections(prev => ({ ...prev, [itemId]: true }));
			const success = await deleteMenuSection(itemId);
			if (success) {
				await loadMenuSections();
				setShowDeleteModal({show: false, itemId: null, type: 'item'});
			}
		} catch (error) {
			showNotification('حدث خطأ أثناء حذف القسم', 'error');
		} finally {
			setDeletingSections(prev => ({ ...prev, [itemId]: false }));
		}
	};

	// Category handlers
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
		setCategoryFormData({
			name: category.name,
			description: category.description || '',
			section: sectionId || '',
			sortOrder: category.sortOrder
		});
		setShowCategoryModal(true);
	};

	const handleSaveCategory = async () => {
		if (!categoryFormData.name.trim()) {
			showNotification('يرجى إدخال اسم الفئة', 'error');
			return;
		}

		if (!categoryFormData.section) {
			showNotification('يرجى اختيار القسم', 'error');
			return;
		}

		setSavingCategory(true);
		try {
			if (editingCategory) {
				await updateMenuCategory(editingCategory.id, categoryFormData);
			} else {
				await createMenuCategory(categoryFormData);
			}
			setShowCategoryModal(false);
			setEditingCategory(null);
			await loadMenuCategories();
		} catch (error) {
			showNotification('حدث خطأ أثناء حفظ الفئة', 'error');
		} finally {
			setSavingCategory(false);
		}
	};

	const handleDeleteCategory = async () => {
		const { itemId } = showDeleteModal;
		if (!itemId || showDeleteModal.type !== 'category') return;

		try {
			setDeletingCategories(prev => ({ ...prev, [itemId]: true }));
			const success = await deleteMenuCategory(itemId);
			if (success) {
				await loadMenuCategories();
				setShowDeleteModal({show: false, itemId: null, type: 'item'});
			}
		} catch (error) {
			showNotification('حدث خطأ أثناء حذف الفئة', 'error');
		} finally {
			setDeletingCategories(prev => ({ ...prev, [itemId]: false }));
		}
	};

	const handleSaveItem = async () => {
		if (!formData.name || !formData.price || !formData.category) {
			showNotification('يرجى ملء جميع الحقول المطلوبة', 'error');
			return;
		}

		setSavingItem(true);

		const price = parseFloat(formData.price);
		if (isNaN(price) || price <= 0) {
			showNotification('يرجى إدخال سعر صحيح', 'error');
			return;
		}

		// تصفية الخامات الفارغة أو غير الصالحة
		const validIngredients = formData.ingredients.filter(ing =>
			// احتفظ فقط بالخامات التي تحتوي على معرف وجزء صحيح موجب
			ing.item && ing.item.trim() !== '' &&
			!isNaN(ing.quantity) &&
			ing.quantity > 0
		);

		// التحقق من أن جميع الخامات المضافة صحيحة (فقط إذا كانت هناك خامات مضافة)
		if (formData.ingredients.length > 0 && validIngredients.length !== formData.ingredients.length) {
			showNotification('يرجى التأكد من إدخال بيانات صحيحة للخامات المضافة', 'error');
			return;
		}

		const itemData = {
			name: formData.name.trim(),
			price: price,
			category: formData.category,
			description: formData.description.trim(),
			isAvailable: formData.isAvailable,
			preparationTime: parseInt(formData.preparationTime),
			isPopular: formData.isPopular,
			ingredients: validIngredients.length > 0 ? validIngredients : undefined
		};

		try {
			if (editingItem) {
				const result = await updateMenuItem(editingItem.id, itemData);
				if (result) {
					setShowAddModal(false);
					setEditingItem(null);
					await loadMenuItems();
					showNotification('تم تحديث العنصر بنجاح', 'success');
				}
			} else {
				const result = await createMenuItem(itemData);
				if (result) {
					setShowAddModal(false);
					await loadMenuItems();
					showNotification('تمت إضافة العنصر بنجاح', 'success');
				}
			}
		} catch (error) {
			showNotification('حدث خطأ أثناء حفظ العنصر', 'error');
		} finally {
			setSavingItem(false);
		}
	};

	// Debug: Log the raw menu items
	useEffect(() => {
		// Menu items loaded
	}, [menuItems]);

	// Filter menu items by search term
	const filteredMenuItems = menuItems.filter(item => {
		if (!searchTerm) return true;
		const matches = (
			item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
			(item.description?.toLowerCase()?.includes(searchTerm.toLowerCase()) ?? false)
		);
		return matches;
	});


	const getStatusText = (isAvailable: boolean) => {
		return isAvailable ? 'متاح' : 'غير متاح';
	};

	const addIngredient = () => {
		// التحقق من وجود خامات متاحة للاختيار
		const availableRawMaterials = inventoryItems.filter(item => item.isRawMaterial);
		const selectedItems = formData.ingredients.map(ing => ing.item).filter(item => item !== '');
		const availableItems = availableRawMaterials.filter(item => !selectedItems.includes(item.id));

		if (availableItems.length === 0) {
			// لا نضيف صف جديد إذا لم تكن هناك خامات متاحة
			// الرسالة ستظهر في الواجهة تلقائياً
			return;
		}

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

	// دالة لتحويل الكمية بين الوحدات المتوافقة
	const convertQuantity = (quantity: number, fromUnit: string, toUnit: string): number => {
		const conversions: { [key: string]: { [key: string]: number } } = {
			'كيلو': { 'جرام': 1000 },
			'جرام': { 'كيلو': 0.001 },
			'لتر': { 'مل': 1000 },
			'مل': { 'لتر': 0.001 }
		};

		const conversionRate = conversions[fromUnit]?.[toUnit];
		return conversionRate ? quantity * conversionRate : quantity;
	};

	// دالة للحصول على الوحدات المتوافقة بناءً على وحدة الخامة
	const getCompatibleUnits = (inventoryUnit: string) => {
		const unitCompatibility: { [key: string]: string[] } = {
			'كيلو': ['كيلو', 'جرام'],
			'جرام': ['جرام', 'كيلو'],
			'لتر': ['لتر', 'مل'],
			'مل': ['مل', 'لتر'],
			'قطعة': ['قطعة'],
			'علبة': ['علبة'],
			'كيس': ['كيس'],
			'زجاجة': ['زجاجة']
		};

		return unitCompatibility[inventoryUnit] || [inventoryUnit];
	};

	const updateIngredient = (index: number, field: 'item' | 'quantity' | 'unit', value: string | number) => {
		// إذا تم تغيير الوحدة، تحويل الكمية تلقائياً
		if (field === 'unit') {
			const currentIngredient = formData.ingredients[index];
			const selectedInventoryItem = inventoryItems.find(item => item.id === currentIngredient.item);

			if (selectedInventoryItem && currentIngredient.quantity > 0) {
				const convertedQuantity = convertQuantity(currentIngredient.quantity, currentIngredient.unit, value as string);

				setFormData(prev => ({
					...prev,
					ingredients: prev.ingredients.map((ingredient, i) =>
						i === index ? {
							...ingredient,
							unit: value as string,
							quantity: Math.round(convertedQuantity * 1000) / 1000 // تقريب إلى 3 أرقام عشرية
						} : ingredient
					)
				}));
				return;
			}
		}

		setFormData(prev => ({
			...prev,
			ingredients: prev.ingredients.map((ingredient, i) =>
				i === index ? {
					...ingredient,
					[field]: field === 'item' ? value as string : value
				} : ingredient
			)
		}));

		// إذا تم تغيير الخامة، تحديث الوحدة تلقائياً بناءً على وحدة الخامة في المخزون
		if (field === 'item' && value !== '') {
			const selectedInventoryItem = inventoryItems.find(item => item.id === value);
			if (selectedInventoryItem) {
				setFormData(prev => ({
					...prev,
					ingredients: prev.ingredients.map((ingredient, i) =>
						i === index ? {
							...ingredient,
							item: value as string,
							unit: selectedInventoryItem.unit // تحديث الوحدة تلقائياً
						} : ingredient
					)
				}));
			}
		}

		// إذا تم تغيير الخامة، تأكد من عدم تكرارها في صفوف أخرى
		if (field === 'item' && value !== '') {
			setFormData(prev => ({
				...prev,
				ingredients: prev.ingredients.map((ingredient, i) => {
					if (i !== index && ingredient.item === value) {
						// إزالة الخامة المكررة من الصفوف الأخرى
						return { ...ingredient, item: '' };
					}
					return ingredient;
				})
			}));
		}
	};



	return (
		<div className="space-y-6 p-4">
			{/* Header with gradient background */}
			<div className="bg-gradient-to-r from-orange-50 via-white to-orange-50 dark:from-gray-800 dark:via-gray-800 dark:to-gray-800 rounded-2xl shadow-lg border border-orange-100 dark:border-gray-700 p-6">
				<div className="flex items-center justify-between flex-wrap xs:flex-col xs:items-start xs:gap-4 xs:w-full">
					<div className="flex flex-col xs:w-full">
						<div className="flex items-center gap-3 mb-2">
							<div className="p-3 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-lg">
								<Utensils className="h-7 w-7 text-white" />
							</div>
							<div>
								<h1 className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-orange-500 bg-clip-text text-transparent dark:from-orange-400 dark:to-orange-300">
									إدارة المنيو
								</h1>
								<p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1">
									<Sparkles className="h-4 w-4" />
									إدارة قائمة الطعام والمشروبات بأناقة
								</p>
							</div>
						</div>
					</div>
					<div className="flex items-center gap-2 xs:w-full xs:flex-col">
						<button
							onClick={handleAddSection}
							className="action-button bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 dark:from-blue-500 dark:to-blue-600 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-md hover:shadow-lg transition-all duration-200 xs:w-full xs:justify-center"
						>
							<Layers className="h-5 w-5" />
							<span className="font-medium">إضافة قسم</span>
						</button>
						<button
							onClick={() => handleAddCategory()}
							className="action-button bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 dark:from-green-500 dark:to-green-600 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-md hover:shadow-lg transition-all duration-200 xs:w-full xs:justify-center"
						>
							<Folder className="h-5 w-5" />
							<span className="font-medium">إضافة فئة</span>
						</button>
						<button
							onClick={() => handleAddItem()}
							className="action-button bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 dark:from-orange-500 dark:to-orange-600 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-md hover:shadow-lg transition-all duration-200 xs:w-full xs:justify-center"
						>
							<Plus className="h-5 w-5" />
							<span className="font-medium">إضافة عنصر</span>
						</button>
					</div>
				</div>
			</div>

			{/* Search with enhanced design */}
			<div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-xl transition-shadow duration-300">
				<div className="flex items-center gap-4 flex-wrap">
					<div className="flex-1 min-w-[250px]">
						<label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
							<Search className="h-4 w-4 text-orange-500" />
							البحث السريع
						</label>
						<div className="relative">
							<Search className="absolute right-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 dark:text-gray-500" />
							<input
								type="text"
								value={searchTerm}
								onChange={(e) => setSearchTerm(e.target.value)}
								placeholder="ابحث في الأقسام والفئات والعناصر..."
								className="search-input w-full pr-12 pl-4 border-2 border-gray-200 dark:border-gray-600 rounded-xl px-4 py-3 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 focus:bg-white dark:focus:bg-gray-600 transition-all duration-200"
							/>
						</div>
					</div>
					<div className="flex items-end">
						<div className="bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 px-6 py-3 rounded-xl border border-orange-200 dark:border-orange-700">
							<div className="text-xs text-gray-600 dark:text-gray-400 mb-1">إجمالي العناصر</div>
							<div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{filteredMenuItems.length}</div>
						</div>
					</div>
				</div>
			</div>

			{/* Hierarchical Menu Display */}
			{loading ? (
				<div className="text-center py-12 bg-white dark:bg-gray-800 rounded-2xl shadow-lg">
					<div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-200 border-t-orange-600 dark:border-orange-800 dark:border-t-orange-400 mx-auto"></div>
					<p className="mt-4 text-gray-600 dark:text-gray-300 font-medium">جاري التحميل...</p>
				</div>
			) : menuSections.length === 0 ? (
				<div className="empty-state text-center py-16 bg-gradient-to-br from-gray-50 to-white dark:from-gray-800 dark:to-gray-800 rounded-2xl shadow-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
					<div className="bg-gradient-to-br from-orange-100 to-orange-50 dark:from-orange-900/20 dark:to-orange-800/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
						<Layers className="h-10 w-10 text-orange-600 dark:text-orange-400" />
					</div>
					<p className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">لا توجد أقسام في المنيو</p>
					<p className="text-sm text-gray-500 dark:text-gray-400">ابدأ بإضافة قسم جديد لتنظيم قائمة الطعام</p>
				</div>
			) : (
				<div className="space-y-6">
					{menuSections
						.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
						.map((section) => {
							const sectionCategories = getCategoriesForSection(section.id);
							const isExpanded = expandedSections[section.id] ?? false;
							
							return (
								<div key={section.id} className="menu-card bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
									{/* Section Header with enhanced gradient */}
									<div className="section-header p-5 border-b-2 border-blue-200 dark:border-blue-700">
										<div className="flex items-center justify-between">
											<div className="flex items-center gap-4 flex-1">
												<button
													onClick={() => toggleSection(section.id)}
													className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-all duration-200"
												>
													{isExpanded ? <ChevronDown className="h-6 w-6" /> : <ChevronRight className="h-6 w-6" />}
												</button>
												<div className="p-2.5 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-md">
													<Layers className="h-5 w-5 text-white" />
												</div>
												<div className="flex-1">
													<h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1">{section.name}</h2>
													{section.description && (
														<p className="text-sm text-gray-600 dark:text-gray-400">{section.description}</p>
													)}
												</div>
											</div>
											<div className="flex items-center gap-2">
												<button
													onClick={() => handleAddCategory(section.id)}
													className="action-button p-2.5 text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md"
													title="إضافة فئة"
												>
													<Plus className="h-5 w-5" />
												</button>
												<button
													onClick={() => handleEditSection(section)}
													className="action-button p-2.5 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md"
													title="تعديل القسم"
												>
													<Edit className="h-5 w-5" />
												</button>
												<button
													onClick={() => openDeleteModal(section.id, 'section')}
													disabled={deletingSections[section.id]}
													className={`action-button p-2.5 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md ${deletingSections[section.id] ? 'opacity-50 cursor-not-allowed' : ''}`}
													title="حذف القسم"
												>
													{deletingSections[section.id] ? (
														<div className="animate-spin rounded-full h-5 w-5 border-2 border-red-200 border-t-red-600"></div>
													) : (
														<Trash2 className="h-5 w-5" />
													)}
												</button>
											</div>
										</div>
									</div>

									{/* Categories */}
									{isExpanded && (
										<div className="p-5 space-y-4 bg-gray-50/50 dark:bg-gray-900/20">
											{sectionCategories.length === 0 ? (
												<div className="empty-state text-center py-8 bg-white dark:bg-gray-800 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600">
													<Folder className="h-8 w-8 text-gray-400 mx-auto mb-2" />
													<p className="text-gray-500 dark:text-gray-400 text-sm">لا توجد فئات في هذا القسم</p>
												</div>
											) : (
												sectionCategories.map((category) => {
													const categoryItems = getItemsForCategory(category.id);
													const isCategoryExpanded = expandedCategories[category.id] ?? false;
													const filteredCategoryItems = searchTerm
														? categoryItems.filter(item => 
															item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
															(item.description?.toLowerCase()?.includes(searchTerm.toLowerCase()) ?? false)
														)
														: categoryItems;

													return (
														<div key={category.id} className="menu-card border-2 border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-800 shadow-md">
															{/* Category Header */}
															<div className="category-header p-4 border-b-2 border-gray-200 dark:border-gray-700">
																<div className="flex items-center justify-between">
																	<div className="flex items-center gap-3 flex-1">
																		<button
																			onClick={() => toggleCategory(category.id)}
																			className="p-1.5 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-lg transition-all duration-200"
																		>
																			{isCategoryExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
																		</button>
																		<div className="p-2 bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-sm">
																			<FolderOpen className="h-4 w-4 text-white" />
																		</div>
																		<div className="flex-1">
																			<div className="flex items-center gap-2">
																				<h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{category.name}</h3>
																				<span className="badge px-2.5 py-1 text-xs font-semibold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full">
																					{filteredCategoryItems.length} عنصر
																				</span>
																			</div>
																			{category.description && (
																				<p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{category.description}</p>
																			)}
																		</div>
																	</div>
																	<div className="flex items-center gap-2">
																		<button
																			onClick={() => handleAddItem(category.id)}
																			className="action-button p-2 text-orange-600 hover:bg-orange-50 dark:text-orange-400 dark:hover:bg-orange-900/20 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md"
																			title="إضافة عنصر"
																		>
																			<Plus className="h-4 w-4" />
																		</button>
																		<button
																			onClick={() => handleEditCategory(category)}
																			className="action-button p-2 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md"
																			title="تعديل الفئة"
																		>
																			<Edit className="h-4 w-4" />
																		</button>
																		<button
																			onClick={() => openDeleteModal(category.id, 'category')}
																			disabled={deletingCategories[category.id]}
																			className={`action-button p-2 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md ${deletingCategories[category.id] ? 'opacity-50 cursor-not-allowed' : ''}`}
																			title="حذف الفئة"
																		>
																			{deletingCategories[category.id] ? (
																				<div className="animate-spin rounded-full h-4 w-4 border-2 border-red-200 border-t-red-600"></div>
																			) : (
																				<Trash2 className="h-4 w-4" />
																			)}
																		</button>
																	</div>
																</div>
															</div>

															{/* Items Grid */}
															{isCategoryExpanded && (
																<div className="p-5 bg-gradient-to-br from-gray-50 to-white dark:from-gray-900/30 dark:to-gray-800/30">
																	{filteredCategoryItems.length === 0 ? (
																		<div className="empty-state text-center py-8 bg-white dark:bg-gray-800 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600">
																			<Utensils className="h-8 w-8 text-gray-400 mx-auto mb-2" />
																			<p className="text-gray-500 dark:text-gray-400 text-sm">
																				{searchTerm ? 'لا توجد نتائج للبحث' : 'لا توجد عناصر في هذه الفئة'}
																			</p>
																		</div>
																	) : (
																		<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
																			{filteredCategoryItems.map((item) => (
																				<div key={item.id} className="item-card bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-6 hover:border-orange-300 dark:hover:border-orange-600 transition-all duration-300">
																					<div className="flex items-start justify-between mb-4">
																						<div className="flex-1">
																							<div className="flex items-center gap-2 mb-2 flex-wrap">
																								<h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{item.name}</h3>
																								{item.isNew && (
																									<span className="badge px-2.5 py-1 text-xs font-semibold bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-full shadow-sm">جديد</span>
																								)}
																								{item.isPopular && (
																									<Star className="popular-star h-5 w-5 text-yellow-500 fill-yellow-500" />
																								)}
																							</div>
																							{item.description && (
																								<p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">{item.description}</p>
																							)}
																							{item.ingredients && item.ingredients.length > 0 && (
																								<div className="text-xs text-blue-600 dark:text-blue-400 mb-3 bg-blue-50 dark:bg-blue-900/20 p-2 rounded-lg">
																									<span className="font-semibold">الخامات:</span> {item.ingredients.map(ing => {
																										const ingredientItem = inventoryItems.find(inv => inv.id === ing.item);
																										return ingredientItem ? `${ingredientItem.name} (${formatQuantity(ing.quantity, ing.unit)})` : `${formatQuantity(ing.quantity, ing.unit)}`;
																									}).join(', ')}
																								</div>
																							)}
																						</div>
																						<span className={`badge px-3 py-1.5 text-xs font-bold rounded-full shadow-sm ${item.isAvailable ? 'status-available bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'}`}>
																							{getStatusText(item.isAvailable)}
																						</span>
																					</div>

																					<div className="space-y-3 mb-5 pb-5 border-b border-gray-200 dark:border-gray-700">
																						<div className="flex items-center justify-between">
																							<span className="price-tag text-2xl font-bold bg-gradient-to-r from-green-600 to-green-500 bg-clip-text text-transparent">{formatCurrency(item.price)}</span>
																							<div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-3 py-1.5 rounded-full">
																								<TrendingUp className="h-4 w-4" />
																								<span className="font-semibold">{formatDecimal(item.orderCount)}</span>
																							</div>
																						</div>
																						<div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
																							<Clock className="h-4 w-4 text-orange-500" />
																							<span>{formatDecimal(item.preparationTime)} دقيقة</span>
																						</div>
																					</div>

																					<div className="flex items-center justify-end gap-2">
																						<button
																							onClick={() => handleEditItem(item)}
																							className="action-button flex-1 p-2.5 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md flex items-center justify-center gap-2"
																							title="تعديل"
																						>
																							<Edit className="h-4 w-4" />
																							<span className="text-sm font-medium">تعديل</span>
																						</button>
																						<button
																							onClick={() => openDeleteModal(item.id, 'item')}
																							disabled={deletingItems[item.id]}
																							className={`action-button flex-1 p-2.5 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md flex items-center justify-center gap-2 ${deletingItems[item.id] ? 'opacity-50 cursor-not-allowed' : ''}`}
																							title="حذف"
																						>
																							{deletingItems[item.id] ? (
																								<div className="animate-spin rounded-full h-4 w-4 border-2 border-red-200 border-t-red-600"></div>
																							) : (
																								<>
																									<Trash2 className="h-4 w-4" />
																									<span className="text-sm font-medium">حذف</span>
																								</>
																							)}
																						</button>
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
							);
						})}
					</div>
				)}


			{/* Add/Edit Modal */}
			{showAddModal && (
				<div
					className="modal-backdrop fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
					onClick={(e) => {
						if (e.target === e.currentTarget) {
							setShowAddModal(false);
						}
					}}
				>
					<div className="modal-content bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden border border-gray-200 dark:border-gray-700">
						<div className="sticky top-0 bg-gradient-to-r from-orange-500 to-orange-600 dark:from-orange-600 dark:to-orange-700 px-6 py-5 rounded-t-2xl shadow-lg">
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-3">
									<div className="p-2 bg-white/20 rounded-lg">
										<Utensils className="h-6 w-6 text-white" />
									</div>
									<h3 className="text-xl font-bold text-white">
										{editingItem ? 'تعديل العنصر' : 'إضافة عنصر جديد'}
									</h3>
								</div>
								<button
									onClick={() => setShowAddModal(false)}
									className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-all duration-200"
								>
									<X className="h-6 w-6" />
								</button>
							</div>
						</div>
						<div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
							<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
							<div>
								<label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">اسم العنصر *</label>
								<input
									type="text"
									value={formData.name}
									onChange={(e) => setFormData({ ...formData, name: e.target.value })}
									className="w-full border-2 border-gray-300 dark:border-gray-600 rounded-xl px-4 py-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200"
									placeholder="مثال: قهوة تركية"
								/>
							</div>

							<div>
								<label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">السعر (ج.م) *</label>
								<input
									type="number"
									value={formData.price}
									onChange={(e) => setFormData({ ...formData, price: e.target.value })}
									className="w-full border-2 border-gray-300 dark:border-gray-600 rounded-xl px-4 py-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200"
									placeholder="0.00"
									min="0"
									step="0.01"
								/>
							</div>

							<div>
								<label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">الفئة *</label>
								<select
									value={formData.category}
									onChange={(e) => setFormData({ ...formData, category: e.target.value })}
									className="w-full border-2 border-gray-300 dark:border-gray-600 rounded-xl px-4 py-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200"
								>
									<option value="">اختر الفئة</option>
									{menuCategories.map(category => {
										const sectionName = typeof category.section === 'string' 
											? menuSections.find(s => s.id === category.section)?.name || ''
											: (category.section as MenuSection)?.name || '';
										return (
											<option key={category.id} value={category.id}>
												{sectionName ? `${sectionName} - ` : ''}{category.name}
											</option>
										);
									})}
								</select>
							</div>

							<div>
								<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">وقت التحضير (دقيقة)</label>
								<input
									type="number"
									value={formData.preparationTime}
									onChange={(e) => setFormData({ ...formData, preparationTime: e.target.value })}
									className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
									min="1"
									max="60"
								/>
							</div>

								<div className="flex items-center space-x-4 space-x-reverse">
									<label className="flex items-center">
										<input
											type="checkbox"
											checked={formData.isAvailable}
											onChange={(e) => setFormData({ ...formData, isAvailable: e.target.checked })}
											className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 dark:border-gray-600 rounded"
										/>
										<span className="mr-2 text-sm text-gray-700 dark:text-gray-300">متاح للطلب</span>
									</label>
									<label className="flex items-center">
								<input
											type="checkbox"
											checked={formData.isPopular}
											onChange={(e) => setFormData({ ...formData, isPopular: e.target.checked })}
											className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 dark:border-gray-600 rounded"
										/>
										<span className="mr-2 text-sm text-gray-700 dark:text-gray-300">شائع</span>
									</label>
							</div>

							<div className="md:col-span-2">
								<label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">الوصف</label>
								<textarea
									value={formData.description}
									onChange={(e) => setFormData({ ...formData, description: e.target.value })}
									className="w-full border-2 border-gray-300 dark:border-gray-600 rounded-xl px-4 py-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200"
									rows={3}
									placeholder="وصف مختصر للعنصر..."
								/>
							</div>

							<div className="md:col-span-2">
									<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
										الخامات المرتبطة
										<span className="text-xs text-gray-500 dark:text-gray-400 mr-2 font-normal">
											({(() => {
												const availableRawMaterials = inventoryItems.filter(item => item.isRawMaterial);
												const selectedItems = formData.ingredients.map(ing => ing.item).filter(item => item !== '');
												const availableItems = availableRawMaterials.filter(item => !selectedItems.includes(item.id));
												return `${formatDecimal(availableItems.length)} من ${formatDecimal(availableRawMaterials.length)} خامة متاحة`;
											})()})
										</span>
										{inventoryItems.length === 0 && (
											<button
												type="button"
												onClick={() => fetchInventoryItems()}
												className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 mr-2"
											>
												تحديث الخامات
											</button>
										)}
									</label>

									{/* تمت إزالة رسالة تحذير الخامات المطلوبة */}

									<div className="space-y-3 max-h-60 overflow-y-auto">
									{formData.ingredients.map((ingredient, index) => (
											<div key={index} className="flex items-center gap-3 bg-gray-50 dark:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
											<div className="flex-1">
													<label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">الخامة</label>
												<select
													value={ingredient.item}
													onChange={(e) => updateIngredient(index, 'item', e.target.value)}
														className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm"
												>
													<option value="">اختر الخامة</option>
													{inventoryItems && inventoryItems.length > 0 ? (
														inventoryItems.filter(item => item.isRawMaterial).length > 0 ? (
															(() => {
																const availableItems = inventoryItems
																	.filter(item => item.isRawMaterial)
																	.filter(item => {
																		// لا تظهر الخامة إذا كانت مختارة في صف آخر
																		const isSelectedInOtherRows = formData.ingredients.some((ing, ingIndex) =>
																			ingIndex !== index && ing.item === item.id
																		);
																		return !isSelectedInOtherRows;
																	});

																if (availableItems.length === 0) {
																	return <option value="" disabled>جميع الخامات مختارة بالفعل</option>;
																}

																return availableItems.map(item => (
																		<option key={item.id} value={item.id}>
																			{item.name}
																		</option>
																));
															})()
														) : (
															<option value="" disabled>لا توجد خامات في المخزون</option>
														)
													) : (
														<option value="" disabled>جاري تحميل الخامات...</option>
													)}
												</select>
											</div>
											<div className="w-24">
													<label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">الكمية</label>
												<input
													type="number"
													value={ingredient.quantity}
													onChange={(e) => updateIngredient(index, 'quantity', parseFloat(e.target.value) || 0)}
														className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm"
														placeholder="0"
													min="0"
													step="0.1"
												/>
											</div>
											<div className="w-24">
													<label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
														الوحدة
														{(() => {
															const selectedInventoryItem = inventoryItems.find(item => item.id === ingredient.item);
															return selectedInventoryItem ? (
																<span className="text-blue-600 dark:text-blue-400 font-medium"> ({selectedInventoryItem.unit})</span>
															) : '';
														})()}
													</label>
												<select
													value={ingredient.unit}
													onChange={(e) => updateIngredient(index, 'unit', e.target.value)}
														className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm"
													>
														{(() => {
															const selectedInventoryItem = inventoryItems.find(item => item.id === ingredient.item);
															if (selectedInventoryItem) {
																const compatibleUnits = getCompatibleUnits(selectedInventoryItem.unit);
																return compatibleUnits.map(unit => (
																	<option key={unit} value={unit}>{unit}</option>
																));
															}
															return unitOptions.map(unit => (
														<option key={unit} value={unit}>{unit}</option>
															));
														})()}
												</select>
											</div>
											<button
												type="button"
												onClick={() => removeIngredient(index)}
													className="p-2 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded-lg transition-colors duration-200 self-end"
											>
												<Trash2 className="h-4 w-4" />
											</button>
										</div>
									))}

									{(() => {
										const availableRawMaterials = inventoryItems.filter(item => item.isRawMaterial);
										const selectedItems = formData.ingredients.map(ing => ing.item).filter(item => item !== '');
										const availableItems = availableRawMaterials.filter(item => !selectedItems.includes(item.id));

										if (availableItems.length === 0 && availableRawMaterials.length > 0) {
												return (
													<div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-600 rounded-lg p-4 text-center">
														<div className="flex items-center justify-center mb-2">
															<svg className="h-5 w-5 text-yellow-600 dark:text-yellow-400 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
															</svg>
															<span className="text-yellow-800 dark:text-yellow-200 font-medium">جميع الخامات مختارة بالفعل</span>
														</div>
														<p className="text-sm text-yellow-700 dark:text-yellow-300">لا يمكن إضافة المزيد من الخامات</p>
													</div>
												);
											} else if (availableRawMaterials.length === 0 && inventoryItems.length > 0) {
												return (
													<div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-600 rounded-lg p-4 text-center">
														<div className="flex items-center justify-center mb-2">
															<svg className="h-5 w-5 text-blue-600 dark:text-blue-400 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
															</svg>
															<span className="text-blue-800 dark:text-blue-200 font-medium">لا توجد خامات متاحة</span>
														</div>
														<p className="text-sm text-blue-700 dark:text-blue-300">يجب إضافة خامات في المخزون أولاً</p>
													</div>
												);
											} else {
										return (
											<button
												type="button"
												onClick={addIngredient}
														className="w-full p-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:border-orange-500 dark:hover:border-orange-400 hover:text-orange-600 dark:hover:text-orange-400 transition-colors duration-200 flex items-center justify-center"
													>
														<Plus className="h-4 w-4 ml-2" />
														إضافة خامة
											</button>
										);
											}
									})()}
							</div>
						</div>
					</div>

					<div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
							<button
									type="button"
								onClick={() => setShowAddModal(false)}
								className="action-button px-6 py-3 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl transition-all duration-200 font-medium shadow-sm hover:shadow-md"
							>
								إلغاء
							</button>
							<button
									type="button"
								onClick={handleSaveItem}
								disabled={savingItem}
									className="action-button px-8 py-3 bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 dark:from-orange-500 dark:to-orange-600 text-white rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium shadow-md hover:shadow-lg"
								>
									{savingItem ? (
										<>
											<div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white"></div>
											<span>{editingItem ? 'جاري التحديث...' : 'جاري الإضافة...'}</span>
										</>
									) : (
										<>
											<CheckCircle className="h-5 w-5" />
											<span>{editingItem ? 'تحديث العنصر' : 'إضافة العنصر'}</span>
										</>
									)}
							</button>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Delete Confirmation Modal */}
			{showDeleteModal.show && (
				<div className="modal-backdrop fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
					<div className="modal-content bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-gray-700">
						<div className="p-6">
							<div className="flex items-center justify-between mb-6">
								<div className="flex items-center gap-3">
									<div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-xl">
										<Trash2 className="h-6 w-6 text-red-600 dark:text-red-400" />
									</div>
									<h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">تأكيد الحذف</h3>
								</div>
								<button
									onClick={closeDeleteModal}
									className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all duration-200"
									disabled={
										(showDeleteModal.type === 'item' && deletingItems[showDeleteModal.itemId || '']) ||
										(showDeleteModal.type === 'section' && deletingSections[showDeleteModal.itemId || '']) ||
										(showDeleteModal.type === 'category' && deletingCategories[showDeleteModal.itemId || ''])
									}
								>
									<X className="h-6 w-6" />
								</button>
							</div>

							<div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-xl p-4 mb-6">
								<p className="text-gray-700 dark:text-gray-300 text-center font-medium">
									{showDeleteModal.type === 'section' && 'هل أنت متأكد من رغبتك في حذف هذا القسم؟'}
									{showDeleteModal.type === 'category' && 'هل أنت متأكد من رغبتك في حذف هذه الفئة؟'}
									{showDeleteModal.type === 'item' && 'هل أنت متأكد من رغبتك في حذف هذا العنصر؟'}
								</p>
								<p className="text-sm text-red-600 dark:text-red-400 text-center mt-2">
									⚠️ لا يمكن التراجع عن هذه العملية
								</p>
							</div>

							<div className="flex justify-end gap-3">
								<button
									onClick={closeDeleteModal}
									disabled={
										(showDeleteModal.type === 'item' && deletingItems[showDeleteModal.itemId || '']) ||
										(showDeleteModal.type === 'section' && deletingSections[showDeleteModal.itemId || '']) ||
										(showDeleteModal.type === 'category' && deletingCategories[showDeleteModal.itemId || ''])
									}
									className="action-button px-6 py-3 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl transition-all duration-200 disabled:opacity-50 font-medium shadow-sm hover:shadow-md"
								>
									إلغاء
								</button>
								<button
									onClick={() => {
										if (showDeleteModal.type === 'item') handleDeleteItem();
										else if (showDeleteModal.type === 'section') handleDeleteSection();
										else if (showDeleteModal.type === 'category') handleDeleteCategory();
									}}
									disabled={
										(showDeleteModal.type === 'item' && deletingItems[showDeleteModal.itemId || '']) ||
										(showDeleteModal.type === 'section' && deletingSections[showDeleteModal.itemId || '']) ||
										(showDeleteModal.type === 'category' && deletingCategories[showDeleteModal.itemId || ''])
									}
									className="action-button px-8 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 dark:from-red-500 dark:to-red-600 text-white rounded-xl transition-all duration-200 disabled:opacity-50 flex items-center gap-2 font-medium shadow-md hover:shadow-lg"
								>
									{((showDeleteModal.type === 'item' && deletingItems[showDeleteModal.itemId || '']) ||
										(showDeleteModal.type === 'section' && deletingSections[showDeleteModal.itemId || '']) ||
										(showDeleteModal.type === 'category' && deletingCategories[showDeleteModal.itemId || ''])) ? (
										<>
											<div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white"></div>
											<span>جاري الحذف...</span>
										</>
									) : (
										<>
											<Trash2 className="h-5 w-5" />
											<span>حذف نهائياً</span>
										</>
									)}
								</button>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Add/Edit Section Modal */}
			{showSectionModal && (
				<div
					className="modal-backdrop fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
					onClick={(e) => {
						if (e.target === e.currentTarget) {
							setShowSectionModal(false);
						}
					}}
				>
					<div className="modal-content bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg border border-gray-200 dark:border-gray-700">
						<div className="bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 px-6 py-5 rounded-t-2xl">
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-3">
									<div className="p-2 bg-white/20 rounded-lg">
										<Layers className="h-6 w-6 text-white" />
									</div>
									<h3 className="text-xl font-bold text-white">
										{editingSection ? 'تعديل القسم' : 'إضافة قسم جديد'}
									</h3>
								</div>
								<button
									onClick={() => setShowSectionModal(false)}
									className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-all duration-200"
								>
									<X className="h-6 w-6" />
								</button>
							</div>
						</div>
						<div className="p-6 space-y-5">
							<div>
								<label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">اسم القسم *</label>
								<input
									type="text"
									value={sectionFormData.name}
									onChange={(e) => setSectionFormData({ ...sectionFormData, name: e.target.value })}
									className="w-full border-2 border-gray-300 dark:border-gray-600 rounded-xl px-4 py-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
									placeholder="مثال: المشروبات"
								/>
							</div>
							<div>
								<label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">الوصف</label>
								<textarea
									value={sectionFormData.description}
									onChange={(e) => setSectionFormData({ ...sectionFormData, description: e.target.value })}
									className="w-full border-2 border-gray-300 dark:border-gray-600 rounded-xl px-4 py-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
									rows={3}
									placeholder="وصف القسم..."
								/>
							</div>
							<div>
								<label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">ترتيب العرض</label>
								<input
									type="number"
									value={sectionFormData.sortOrder}
									onChange={(e) => setSectionFormData({ ...sectionFormData, sortOrder: parseInt(e.target.value) || 0 })}
									className="w-full border-2 border-gray-300 dark:border-gray-600 rounded-xl px-4 py-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
									min="0"
								/>
							</div>
							<div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
								<button
									onClick={() => setShowSectionModal(false)}
									className="action-button px-6 py-3 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl transition-all duration-200 font-medium shadow-sm hover:shadow-md"
								>
									إلغاء
								</button>
								<button
									onClick={handleSaveSection}
									disabled={savingSection}
									className="action-button px-8 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 dark:from-blue-500 dark:to-blue-600 text-white rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium shadow-md hover:shadow-lg"
								>
									{savingSection ? (
										<>
											<div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white"></div>
											<span>{editingSection ? 'جاري التحديث...' : 'جاري الإضافة...'}</span>
										</>
									) : (
										<>
											<CheckCircle className="h-5 w-5" />
											<span>{editingSection ? 'تحديث القسم' : 'إضافة القسم'}</span>
										</>
									)}
								</button>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Add/Edit Category Modal */}
			{showCategoryModal && (
				<div
					className="modal-backdrop fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
					onClick={(e) => {
						if (e.target === e.currentTarget) {
							setShowCategoryModal(false);
						}
					}}
				>
					<div className="modal-content bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg border border-gray-200 dark:border-gray-700">
						<div className="bg-gradient-to-r from-green-500 to-green-600 dark:from-green-600 dark:to-green-700 px-6 py-5 rounded-t-2xl">
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-3">
									<div className="p-2 bg-white/20 rounded-lg">
										<Folder className="h-6 w-6 text-white" />
									</div>
									<h3 className="text-xl font-bold text-white">
										{editingCategory ? 'تعديل الفئة' : 'إضافة فئة جديدة'}
									</h3>
								</div>
								<button
									onClick={() => setShowCategoryModal(false)}
									className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-all duration-200"
								>
									<X className="h-6 w-6" />
								</button>
							</div>
						</div>
						<div className="p-6 space-y-5">
							<div>
								<label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">اسم الفئة *</label>
								<input
									type="text"
									value={categoryFormData.name}
									onChange={(e) => setCategoryFormData({ ...categoryFormData, name: e.target.value })}
									className="w-full border-2 border-gray-300 dark:border-gray-600 rounded-xl px-4 py-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200"
									placeholder="مثال: المشروبات الساخنة"
								/>
							</div>
							<div>
								<label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">القسم *</label>
								<select
									value={categoryFormData.section}
									onChange={(e) => setCategoryFormData({ ...categoryFormData, section: e.target.value })}
									className="w-full border-2 border-gray-300 dark:border-gray-600 rounded-xl px-4 py-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200"
								>
									<option value="">اختر القسم</option>
									{menuSections.map(section => (
										<option key={section.id} value={section.id}>{section.name}</option>
									))}
								</select>
							</div>
							<div>
								<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">الوصف</label>
								<textarea
									value={categoryFormData.description}
									onChange={(e) => setCategoryFormData({ ...categoryFormData, description: e.target.value })}
									className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-green-500"
									rows={3}
									placeholder="وصف الفئة..."
								/>
							</div>
							<div>
								<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">ترتيب العرض</label>
								<input
									type="number"
									value={categoryFormData.sortOrder}
									onChange={(e) => setCategoryFormData({ ...categoryFormData, sortOrder: parseInt(e.target.value) || 0 })}
									className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-green-500"
									min="0"
								/>
							</div>
							<div className="flex justify-end space-x-3 space-x-reverse pt-4">
								<button
									onClick={() => setShowCategoryModal(false)}
									className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-lg transition-colors duration-200"
								>
									إلغاء
								</button>
								<button
									onClick={handleSaveCategory}
									disabled={savingCategory}
									className="px-6 py-2 bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 text-white rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
								>
									{savingCategory ? (
										<>
											<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white ml-2"></div>
											{editingCategory ? 'جاري التحديث...' : 'جاري الإضافة...'}
										</>
									) : (
										<>
											<CheckCircle className="h-4 w-4 ml-2" />
											{editingCategory ? 'تحديث الفئة' : 'إضافة الفئة'}
										</>
									)}
								</button>
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default Menu;
