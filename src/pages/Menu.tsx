import React, { useState, useEffect } from 'react';
import { Utensils, Plus, Edit, Trash2, X, Search, TrendingUp, Clock, Star, CheckCircle, Folder, FolderOpen, ChevronDown, ChevronRight, Layers } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { MenuItem, MenuSection, MenuCategory } from '../services/api';
import { formatCurrency, formatQuantity, formatDecimal } from '../utils/formatters';

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


	const getStatusColor = (isAvailable: boolean) => {
		return isAvailable ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
	};

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
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between flex-wrap xs:flex-col xs:items-start xs:gap-2 xs:space-y-2 xs:w-full">
				<div className="flex items-center xs:w-full xs:justify-between">
					<h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center xs:text-base xs:w-full xs:text-center">
						<Utensils className="h-6 w-6 text-orange-600 dark:text-orange-400 ml-2" />
						إدارة المنيو
					</h1>
					<p className="text-gray-600 dark:text-gray-300 mr-4 xs:mr-0 xs:w-full xs:text-center">إدارة قائمة الطعام والمشروبات</p>
				</div>
				<div className="flex items-center gap-2 xs:w-full xs:flex-col">
					<button
						onClick={handleAddSection}
						className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center transition-colors duration-200 xs:w-full xs:justify-center"
					>
						<Layers className="h-5 w-5 ml-2" />
						إضافة قسم
					</button>
					<button
						onClick={() => handleAddCategory()}
						className="bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 text-white px-4 py-2 rounded-lg flex items-center transition-colors duration-200 xs:w-full xs:justify-center"
					>
						<Folder className="h-5 w-5 ml-2" />
						إضافة فئة
					</button>
					<button
						onClick={() => handleAddItem()}
						className="bg-orange-600 hover:bg-orange-700 dark:bg-orange-500 dark:hover:bg-orange-600 text-white px-4 py-2 rounded-lg flex items-center transition-colors duration-200 xs:w-full xs:justify-center"
					>
						<Plus className="h-5 w-5 ml-2" />
						إضافة عنصر
					</button>
				</div>
			</div>

			{/* Search */}
			<div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
				<div className="flex items-center gap-4">
					<div className="flex-1">
						<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">البحث</label>
						<div className="relative">
							<Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
							<input
								type="text"
								value={searchTerm}
								onChange={(e) => setSearchTerm(e.target.value)}
								placeholder="البحث في الأقسام والفئات والعناصر..."
								className="w-full pr-10 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
							/>
						</div>
					</div>
					<div className="flex items-end">
						<div className="text-sm text-gray-600 dark:text-gray-400">
							إجمالي العناصر: {filteredMenuItems.length}
						</div>
					</div>
				</div>
			</div>

			{/* Hierarchical Menu Display */}
			{loading ? (
				<div className="text-center py-8">
					<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 dark:border-orange-400 mx-auto"></div>
					<p className="mt-2 text-gray-600 dark:text-gray-300">جاري التحميل...</p>
				</div>
			) : menuSections.length === 0 ? (
				<div className="text-center py-8 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
					<Layers className="h-12 w-12 text-gray-400 mx-auto mb-4" />
					<p className="text-gray-500 dark:text-gray-400">لا توجد أقسام في المنيو</p>
					<p className="text-sm text-gray-400 dark:text-gray-500 mt-2">ابدأ بإضافة قسم جديد</p>
				</div>
			) : (
				<div className="space-y-4">
					{menuSections
						.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
						.map((section) => {
							const sectionCategories = getCategoriesForSection(section.id);
							const isExpanded = expandedSections[section.id] ?? true;
							
							return (
								<div key={section.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
									{/* Section Header */}
									<div className="p-4 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-b border-gray-200 dark:border-gray-700">
										<div className="flex items-center justify-between">
											<div className="flex items-center gap-3 flex-1">
												<button
													onClick={() => toggleSection(section.id)}
													className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
												>
													{isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
												</button>
												<Layers className="h-5 w-5 text-blue-600 dark:text-blue-400" />
												<h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{section.name}</h2>
												{section.description && (
													<p className="text-sm text-gray-600 dark:text-gray-400 mr-2">{section.description}</p>
												)}
											</div>
											<div className="flex items-center gap-2">
												<button
													onClick={() => handleAddCategory(section.id)}
													className="p-2 text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20 rounded-lg transition-colors"
													title="إضافة فئة"
												>
													<Plus className="h-4 w-4" />
												</button>
												<button
													onClick={() => handleEditSection(section)}
													className="p-2 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
													title="تعديل القسم"
												>
													<Edit className="h-4 w-4" />
												</button>
												<button
													onClick={() => openDeleteModal(section.id, 'section')}
													disabled={deletingSections[section.id]}
													className={`p-2 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded-lg transition-colors ${deletingSections[section.id] ? 'opacity-50 cursor-not-allowed' : ''}`}
													title="حذف القسم"
												>
													{deletingSections[section.id] ? (
														<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
													) : (
														<Trash2 className="h-4 w-4" />
													)}
												</button>
											</div>
										</div>
									</div>

									{/* Categories */}
									{isExpanded && (
										<div className="p-4 space-y-4">
											{sectionCategories.length === 0 ? (
												<div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
													لا توجد فئات في هذا القسم
												</div>
											) : (
												sectionCategories.map((category) => {
													const categoryItems = getItemsForCategory(category.id);
													const isCategoryExpanded = expandedCategories[category.id] ?? true;
													const filteredCategoryItems = searchTerm
														? categoryItems.filter(item => 
															item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
															(item.description?.toLowerCase()?.includes(searchTerm.toLowerCase()) ?? false)
														)
														: categoryItems;

													return (
														<div key={category.id} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
															{/* Category Header */}
															<div className="p-3 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
																<div className="flex items-center justify-between">
																	<div className="flex items-center gap-2 flex-1">
																		<button
																			onClick={() => toggleCategory(category.id)}
																			className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
																		>
																			{isCategoryExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
																		</button>
																		<FolderOpen className="h-4 w-4 text-green-600 dark:text-green-400" />
																		<h3 className="text-md font-medium text-gray-900 dark:text-gray-100">{category.name}</h3>
																		{category.description && (
																			<p className="text-xs text-gray-600 dark:text-gray-400 mr-2">{category.description}</p>
																		)}
																		<span className="text-xs text-gray-500 dark:text-gray-400">({filteredCategoryItems.length} عنصر)</span>
																	</div>
																	<div className="flex items-center gap-2">
																		<button
																			onClick={() => handleAddItem(category.id)}
																			className="p-1.5 text-orange-600 hover:bg-orange-50 dark:text-orange-400 dark:hover:bg-orange-900/20 rounded transition-colors"
																			title="إضافة عنصر"
																		>
																			<Plus className="h-3.5 w-3.5" />
																		</button>
																		<button
																			onClick={() => handleEditCategory(category)}
																			className="p-1.5 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 rounded transition-colors"
																			title="تعديل الفئة"
																		>
																			<Edit className="h-3.5 w-3.5" />
																		</button>
																		<button
																			onClick={() => openDeleteModal(category.id, 'category')}
																			disabled={deletingCategories[category.id]}
																			className={`p-1.5 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded transition-colors ${deletingCategories[category.id] ? 'opacity-50 cursor-not-allowed' : ''}`}
																			title="حذف الفئة"
																		>
																			{deletingCategories[category.id] ? (
																				<div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-red-600"></div>
																			) : (
																				<Trash2 className="h-3.5 w-3.5" />
																			)}
																		</button>
																	</div>
																</div>
															</div>

															{/* Items Grid */}
															{isCategoryExpanded && (
																<div className="p-4">
																	{filteredCategoryItems.length === 0 ? (
																		<div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
																			{searchTerm ? 'لا توجد نتائج' : 'لا توجد عناصر في هذه الفئة'}
																		</div>
																	) : (
																		<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
																			{filteredCategoryItems.map((item) => (
																				<div key={item.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
																					<div className="flex items-start justify-between mb-4">
																						<div className="flex-1">
																							<div className="flex items-center gap-2 mb-1">
																								<h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{item.name}</h3>
																								{item.isNew && (
																									<span className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full">جديد</span>
																								)}
																								{item.isPopular && (
																									<Star className="h-4 w-4 text-yellow-500" />
																								)}
																							</div>
																							{item.description && (
																								<p className="text-sm text-gray-500 dark:text-gray-400 mb-3">{item.description}</p>
																							)}
																							{item.ingredients && item.ingredients.length > 0 && (
																								<div className="text-xs text-blue-600 dark:text-blue-400 mb-2">
																									الخامات: {item.ingredients.map(ing => {
																										const ingredientItem = inventoryItems.find(inv => inv.id === ing.item);
																										return ingredientItem ? `${ingredientItem.name} (${formatQuantity(ing.quantity, ing.unit)})` : `${formatQuantity(ing.quantity, ing.unit)}`;
																									}).join(', ')}
																								</div>
																							)}
																						</div>
																						<span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(item.isAvailable)}`}>
																							{getStatusText(item.isAvailable)}
																						</span>
																					</div>

																					<div className="space-y-2 mb-4">
																						<div className="flex items-center justify-between">
																							<span className="text-xl font-bold text-green-600">{formatCurrency(item.price)}</span>
																							<div className="flex items-center text-sm text-gray-500">
																								<TrendingUp className="h-4 w-4 ml-1" />
																								{formatDecimal(item.orderCount)} طلب
																							</div>
																						</div>
																						<div className="flex items-center text-sm text-gray-500">
																							<Clock className="h-4 w-4 ml-1" />
																							{formatDecimal(item.preparationTime)} دقيقة للتحضير
																						</div>
																					</div>

																					<div className="flex items-center justify-end space-x-2 space-x-reverse">
																						<button
																							onClick={() => handleEditItem(item)}
																							className="p-2 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 rounded-lg transition-colors duration-200"
																							title="تعديل"
																						>
																							<Edit className="h-4 w-4" />
																						</button>
																						<button
																							onClick={() => openDeleteModal(item.id, 'item')}
																							disabled={deletingItems[item.id]}
																							className={`p-2 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded-lg transition-colors duration-200 ${deletingItems[item.id] ? 'opacity-50 cursor-not-allowed' : ''}`}
																							title="حذف"
																						>
																							{deletingItems[item.id] ? (
																								<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600 dark:border-red-400"></div>
																							) : (
																								<Trash2 className="h-4 w-4" />
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
					className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
					onClick={(e) => {
						if (e.target === e.currentTarget) {
							setShowAddModal(false);
						}
					}}
				>
					<div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
						<div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 rounded-t-lg">
							<div className="flex items-center justify-between">
								<h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
									{editingItem ? 'تعديل العنصر' : 'إضافة عنصر جديد'}
								</h3>
								<button
									onClick={() => setShowAddModal(false)}
									className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors duration-200"
								>
									<X className="h-6 w-6" />
								</button>
							</div>
						</div>
						<div className="p-6">
							<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
							<div>
								<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">اسم العنصر *</label>
								<input
									type="text"
									value={formData.name}
									onChange={(e) => setFormData({ ...formData, name: e.target.value })}
									className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
									placeholder="مثال: قهوة تركية"
								/>
							</div>

							<div>
								<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">السعر (ج.م) *</label>
								<input
									type="number"
									value={formData.price}
									onChange={(e) => setFormData({ ...formData, price: e.target.value })}
									className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
									placeholder="0.00"
									min="0"
									step="0.01"
								/>
							</div>

							<div>
								<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">الفئة *</label>
								<select
									value={formData.category}
									onChange={(e) => setFormData({ ...formData, category: e.target.value })}
									className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
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
								<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">الوصف</label>
								<textarea
									value={formData.description}
									onChange={(e) => setFormData({ ...formData, description: e.target.value })}
									className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
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

					<div className="mt-6 flex justify-end space-x-3 space-x-reverse">
							<button
									type="button"
								onClick={() => setShowAddModal(false)}
								className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-lg transition-colors duration-200"
							>
								إلغاء
							</button>
							<button
									type="button"
								onClick={handleSaveItem}
								disabled={savingItem}
									className="px-6 py-2 bg-orange-600 hover:bg-orange-700 dark:bg-orange-500 dark:hover:bg-orange-600 text-white rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
								>
									{savingItem ? (
										<>
											<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white ml-2"></div>
											{editingItem ? 'جاري التحديث...' : 'جاري الإضافة...'}
										</>
									) : (
										<>
											<CheckCircle className="h-4 w-4 ml-2" />
											{editingItem ? 'تحديث العنصر' : 'إضافة العنصر'}
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
				<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
					<div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
						<div className="p-6">
							<div className="flex items-center justify-between mb-4">
								<h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">تأكيد الحذف</h3>
								<button
									onClick={closeDeleteModal}
									className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors duration-200"
									disabled={
										(showDeleteModal.type === 'item' && deletingItems[showDeleteModal.itemId || '']) ||
										(showDeleteModal.type === 'section' && deletingSections[showDeleteModal.itemId || '']) ||
										(showDeleteModal.type === 'category' && deletingCategories[showDeleteModal.itemId || ''])
									}
								>
									<X className="h-6 w-6" />
								</button>
							</div>

							<p className="text-gray-600 dark:text-gray-300 mb-6">
								{showDeleteModal.type === 'section' && 'هل أنت متأكد من رغبتك في حذف هذا القسم؟ لا يمكن التراجع عن هذه العملية.'}
								{showDeleteModal.type === 'category' && 'هل أنت متأكد من رغبتك في حذف هذه الفئة؟ لا يمكن التراجع عن هذه العملية.'}
								{showDeleteModal.type === 'item' && 'هل أنت متأكد من رغبتك في حذف هذا العنصر؟ لا يمكن التراجع عن هذه العملية.'}
							</p>

							<div className="flex justify-end space-x-3 space-x-reverse">
								<button
									onClick={closeDeleteModal}
									disabled={
										(showDeleteModal.type === 'item' && deletingItems[showDeleteModal.itemId || '']) ||
										(showDeleteModal.type === 'section' && deletingSections[showDeleteModal.itemId || '']) ||
										(showDeleteModal.type === 'category' && deletingCategories[showDeleteModal.itemId || ''])
									}
									className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-lg transition-colors duration-200 disabled:opacity-50"
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
									className="px-6 py-2 bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 text-white rounded-lg transition-colors duration-200 disabled:opacity-50 flex items-center"
								>
									{((showDeleteModal.type === 'item' && deletingItems[showDeleteModal.itemId || '']) ||
										(showDeleteModal.type === 'section' && deletingSections[showDeleteModal.itemId || '']) ||
										(showDeleteModal.type === 'category' && deletingCategories[showDeleteModal.itemId || ''])) ? (
										<>
											<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white ml-2"></div>
											جاري الحذف...
										</>
									) : (
										<>
											<Trash2 className="h-4 w-4 ml-2" />
											حذف
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
					className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
					onClick={(e) => {
						if (e.target === e.currentTarget) {
							setShowSectionModal(false);
						}
					}}
				>
					<div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
						<div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 rounded-t-lg">
							<div className="flex items-center justify-between">
								<h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
									{editingSection ? 'تعديل القسم' : 'إضافة قسم جديد'}
								</h3>
								<button
									onClick={() => setShowSectionModal(false)}
									className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors duration-200"
								>
									<X className="h-6 w-6" />
								</button>
							</div>
						</div>
						<div className="p-6 space-y-4">
							<div>
								<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">اسم القسم *</label>
								<input
									type="text"
									value={sectionFormData.name}
									onChange={(e) => setSectionFormData({ ...sectionFormData, name: e.target.value })}
									className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
									placeholder="مثال: المشروبات"
								/>
							</div>
							<div>
								<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">الوصف</label>
								<textarea
									value={sectionFormData.description}
									onChange={(e) => setSectionFormData({ ...sectionFormData, description: e.target.value })}
									className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
									rows={3}
									placeholder="وصف القسم..."
								/>
							</div>
							<div>
								<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">ترتيب العرض</label>
								<input
									type="number"
									value={sectionFormData.sortOrder}
									onChange={(e) => setSectionFormData({ ...sectionFormData, sortOrder: parseInt(e.target.value) || 0 })}
									className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
									min="0"
								/>
							</div>
							<div className="flex justify-end space-x-3 space-x-reverse pt-4">
								<button
									onClick={() => setShowSectionModal(false)}
									className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-lg transition-colors duration-200"
								>
									إلغاء
								</button>
								<button
									onClick={handleSaveSection}
									disabled={savingSection}
									className="px-6 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
								>
									{savingSection ? (
										<>
											<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white ml-2"></div>
											{editingSection ? 'جاري التحديث...' : 'جاري الإضافة...'}
										</>
									) : (
										<>
											<CheckCircle className="h-4 w-4 ml-2" />
											{editingSection ? 'تحديث القسم' : 'إضافة القسم'}
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
					className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
					onClick={(e) => {
						if (e.target === e.currentTarget) {
							setShowCategoryModal(false);
						}
					}}
				>
					<div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
						<div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 rounded-t-lg">
							<div className="flex items-center justify-between">
								<h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
									{editingCategory ? 'تعديل الفئة' : 'إضافة فئة جديدة'}
								</h3>
								<button
									onClick={() => setShowCategoryModal(false)}
									className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors duration-200"
								>
									<X className="h-6 w-6" />
								</button>
							</div>
						</div>
						<div className="p-6 space-y-4">
							<div>
								<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">اسم الفئة *</label>
								<input
									type="text"
									value={categoryFormData.name}
									onChange={(e) => setCategoryFormData({ ...categoryFormData, name: e.target.value })}
									className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-green-500"
									placeholder="مثال: المشروبات الساخنة"
								/>
							</div>
							<div>
								<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">القسم *</label>
								<select
									value={categoryFormData.section}
									onChange={(e) => setCategoryFormData({ ...categoryFormData, section: e.target.value })}
									className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-green-500"
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
