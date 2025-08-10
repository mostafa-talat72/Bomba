import React, { useState, useEffect } from 'react';
import { Utensils, Plus, Edit, Trash2, X, Search, TrendingUp, Clock, Star, CheckCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { MenuItem, InventoryItem } from '../services/api';
import { formatCurrency, formatQuantity, formatDecimal } from '../utils/formatters';

const Menu: React.FC = () => {
	const {
		menuItems,
		fetchMenuItems,
		createMenuItem,
		updateMenuItem,
		deleteMenuItem,
		inventoryItems,
		fetchInventoryItems,
		showNotification
	} = useApp();
	const [loading, setLoading] = useState(false);
	const [showAddModal, setShowAddModal] = useState(false);
	const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
	const [deletingItems, setDeletingItems] = useState<Record<string, boolean>>({});
	const [savingItem, setSavingItem] = useState(false);
	const [searchTerm, setSearchTerm] = useState('');
	const [selectedCategory, setSelectedCategory] = useState('all');

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

	const categories = [
		'مشروبات ساخنة',
		'مشروبات باردة',
		'طعام',
		'حلويات',
		'وجبات سريعة',
		'عصائر طبيعية',
		'منتجات أخرى'
	];

	const unitOptions = ['جرام', 'كيلو', 'مل', 'لتر', 'قطعة', 'ملعقة', 'كوب'];

	useEffect(() => {
		loadMenuItems();
		fetchInventoryItems();
	}, []);

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
			}
		};

		document.addEventListener('keydown', handleEscape);
		return () => document.removeEventListener('keydown', handleEscape);
	}, []);

			const loadMenuItems = async () => {
			setLoading(true);
			try {
				await fetchMenuItems();
			} catch {
				showNotification('خطأ في تحميل قائمة الطعام', 'error');
			} finally {
				setLoading(false);
			}
		};

	const handleAddItem = () => {
		setEditingItem(null);
		setFormData({
			name: '',
			price: '',
			category: '',
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
		setFormData({
			name: item.name,
			price: item.price.toString(),
			category: item.category,
			description: item.description || '',
			isAvailable: item.isAvailable,
			preparationTime: item.preparationTime.toString(),
			isPopular: item.isPopular,
			ingredients: item.ingredients || []
		});
		setShowAddModal(true);
	};

	const handleDeleteItem = async (id: string) => {
		if (window.confirm('هل أنت متأكد من حذف هذا العنصر؟')) {
			try {
				setDeletingItems(prev => ({ ...prev, [id]: true }));
				const success = await deleteMenuItem(id);
				if (success) {
					await loadMenuItems();
					showNotification('تم حذف العنصر بنجاح', 'success');
				}
			} catch (error) {
				showNotification('حدث خطأ أثناء حذف العنصر', 'error');
			} finally {
				setDeletingItems(prev => ({ ...prev, [id]: false }));
			}
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

		// التحقق من وجود خامة واحدة على الأقل
		const validIngredients = formData.ingredients.filter(ing => ing.item !== '' && ing.quantity > 0);
		if (validIngredients.length === 0) {
			showNotification('يجب إضافة خامة واحدة على الأقل للعنصر', 'error');
			return;
		}

		// التحقق من أن جميع الخامات المضافة صحيحة
		const invalidIngredients = formData.ingredients.filter(ing => ing.item !== '' && (ing.quantity <= 0 || ing.quantity === undefined));
		if (invalidIngredients.length > 0) {
			showNotification('يرجى التأكد من إدخال كمية صحيحة لجميع الخامات', 'error');
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
			ingredients: formData.ingredients
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

	const filteredItems = menuItems.filter(item => {
		const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
			item.description?.toLowerCase().includes(searchTerm.toLowerCase());
		const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
		return matchesSearch && matchesCategory;
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

  const getIngredientDisplay = (ing: { item: string; quantity: number; unit: string }) => {
    const ingredientItem = inventoryItems.find(item => item.id === ing.item);
    return ingredientItem ? `${ingredientItem.name} (${formatQuantity(ing.quantity, ing.unit)})` : `${formatQuantity(ing.quantity, ing.unit)}`;
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
				<button
					onClick={handleAddItem}
					className="bg-orange-600 hover:bg-orange-700 dark:bg-orange-500 dark:hover:bg-orange-600 text-white px-4 py-2 rounded-lg flex items-center transition-colors duration-200 xs:w-full xs:justify-center xs:mt-2"
				>
					<Plus className="h-5 w-5 ml-2" />
					إضافة عنصر
				</button>
			</div>

			{/* Search and Filter */}
			<div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
				<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
					<div>
						<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">البحث</label>
						<div className="relative">
							<Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
							<input
								type="text"
								value={searchTerm}
								onChange={(e) => setSearchTerm(e.target.value)}
								placeholder="البحث في العناصر..."
								className="w-full pr-10 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
							/>
						</div>
					</div>
					<div>
						<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">الفئة</label>
						<select
							value={selectedCategory}
							onChange={(e) => setSelectedCategory(e.target.value)}
							className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
						>
							<option value="all">جميع الفئات</option>
							{categories.map(category => (
								<option key={category} value={category}>{category}</option>
							))}
						</select>
					</div>
					<div className="flex items-end">
						<div className="text-sm text-gray-600 dark:text-gray-400">
							إجمالي العناصر: {filteredItems.length}
						</div>
					</div>
				</div>
			</div>

			{/* Menu Items Grid */}
			{loading ? (
				<div className="text-center py-8">
					<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 dark:border-orange-400 mx-auto"></div>
					<p className="mt-2 text-gray-600 dark:text-gray-300">جاري التحميل...</p>
				</div>
			) : (
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
					{filteredItems.map((item) => (
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
									<p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{item.category}</p>
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
									onClick={() => handleDeleteItem(item.id)}
									disabled={deletingItems[item.id]}
									className={`p-2 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded-lg transition-colors duration-200 ${deletingItems[item.id] ? 'opacity-50 cursor-not-allowed' : ''}`}
									title={deletingItems[item.id] ? 'جاري الحذف...' : 'حذف'}
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

			{!loading && filteredItems.length === 0 && (
				<div className="text-center py-8">
					<Utensils className="h-12 w-12 text-gray-400 mx-auto mb-4" />
					<p className="text-gray-500">لا توجد عناصر في القائمة</p>
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
									{categories.map(category => (
										<option key={category} value={category}>{category}</option>
									))}
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

									{/* تحذير إذا لم تكن هناك خامات مضافة */}
									{formData.ingredients.length === 0 && (
										<div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-600 rounded-lg p-3 mb-3">
											<div className="flex items-center">
												<svg className="h-4 w-4 text-red-600 dark:text-red-400 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
												</svg>
												<span className="text-red-800 dark:text-red-200 text-sm font-medium">يجب إضافة خامة واحدة على الأقل</span>
											</div>
										</div>
									)}

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
		</div>
	);
};

export default Menu;
