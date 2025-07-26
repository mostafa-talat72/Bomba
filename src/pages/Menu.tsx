import React, { useState, useEffect } from 'react';
import { Utensils, Plus, Edit, Trash2, Save, X, Search, TrendingUp, Clock, Star } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { MenuItem } from '../services/api';

const Menu: React.FC = () => {
	const {
		menuItems,
		fetchMenuItems,
		createMenuItem,
		updateMenuItem,
		deleteMenuItem,
		showNotification
	} = useApp();
	const [loading, setLoading] = useState(false);
	const [showAddModal, setShowAddModal] = useState(false);
	const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
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
		calories: '',
		allergens: [] as string[],
		isPopular: false
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

	const allergenOptions = [
		'حليب', 'بيض', 'فول سوداني', 'مكسرات', 'سمك', 'محار', 'قمح', 'صويا'
	];

	useEffect(() => {
		loadMenuItems();
	}, []);

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
		} catch (error) {
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
			calories: '',
			allergens: [],
			isPopular: false
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
			calories: item.calories?.toString() || '',
			allergens: item.allergens || [],
			isPopular: item.isPopular
		});
		setShowAddModal(true);
	};

	const handleDeleteItem = async (id: string) => {
		if (window.confirm('هل أنت متأكد من حذف هذا العنصر؟')) {
			const success = await deleteMenuItem(id);
			if (success) {
				await loadMenuItems();
			}
		}
	};

	const handleSaveItem = async () => {
		if (!formData.name || !formData.price || !formData.category) {
			showNotification('يرجى ملء جميع الحقول المطلوبة', 'error');
			return;
		}

		const price = parseFloat(formData.price);
		if (isNaN(price) || price <= 0) {
			showNotification('يرجى إدخال سعر صحيح', 'error');
			return;
		}

		const itemData = {
			name: formData.name.trim(),
			price: price,
			category: formData.category,
			description: formData.description.trim(),
			isAvailable: formData.isAvailable,
			preparationTime: parseInt(formData.preparationTime),
			calories: formData.calories ? parseFloat(formData.calories) : undefined,
			allergens: formData.allergens,
			isPopular: formData.isPopular
		};

		if (editingItem) {
			const result = await updateMenuItem(editingItem.id, itemData);
			if (result) {
				setShowAddModal(false);
				setEditingItem(null);
				await loadMenuItems();
			}
		} else {
			const result = await createMenuItem(itemData);
			if (result) {
				setShowAddModal(false);
				await loadMenuItems();
			}
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

	const toggleAllergen = (allergen: string) => {
		setFormData(prev => ({
			...prev,
			allergens: prev.allergens.includes(allergen)
				? prev.allergens.filter(a => a !== allergen)
				: [...prev.allergens, allergen]
		}));
	};

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div className="flex items-center">
					<Utensils className="h-8 w-8 text-primary-600 ml-3" />
					<div>
						<h1 className="text-2xl font-bold text-gray-900">إدارة المنيو</h1>
						<p className="text-gray-600">إدارة قائمة الطعام والمشروبات</p>
					</div>
				</div>
				<button
					onClick={handleAddItem}
					className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg flex items-center transition-colors duration-200"
				>
					<Plus className="h-5 w-5 ml-2" />
					إضافة عنصر
				</button>
			</div>

			{/* Search and Filter */}
			<div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
				<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
					<div>
						<label className="block text-sm font-medium text-gray-700 mb-2">البحث</label>
						<div className="relative">
							<Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
							<input
								type="text"
								value={searchTerm}
								onChange={(e) => setSearchTerm(e.target.value)}
								placeholder="البحث في العناصر..."
								className="w-full pr-10 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
							/>
						</div>
					</div>
					<div>
						<label className="block text-sm font-medium text-gray-700 mb-2">الفئة</label>
						<select
							value={selectedCategory}
							onChange={(e) => setSelectedCategory(e.target.value)}
							className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
						>
							<option value="all">جميع الفئات</option>
							{categories.map(category => (
								<option key={category} value={category}>{category}</option>
							))}
						</select>
					</div>
					<div className="flex items-end">
						<div className="text-sm text-gray-600">
							إجمالي العناصر: {filteredItems.length}
						</div>
					</div>
				</div>
			</div>

			{/* Menu Items Grid */}
			{loading ? (
				<div className="text-center py-8">
					<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
					<p className="mt-2 text-gray-600">جاري التحميل...</p>
				</div>
			) : (
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
					{filteredItems.map((item) => (
						<div key={item.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
							<div className="flex items-start justify-between mb-4">
								<div className="flex-1">
									<div className="flex items-center gap-2 mb-1">
										<h3 className="text-lg font-semibold text-gray-900">{item.name}</h3>
										{item.isNew && (
											<span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">جديد</span>
										)}
										{item.isPopular && (
											<Star className="h-4 w-4 text-yellow-500" />
										)}
									</div>
									<p className="text-sm text-gray-600 mb-2">{item.category}</p>
									{item.description && (
										<p className="text-sm text-gray-500 mb-3">{item.description}</p>
									)}
								</div>
								<span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(item.isAvailable)}`}>
									{getStatusText(item.isAvailable)}
								</span>
							</div>

							<div className="space-y-2 mb-4">
								<div className="flex items-center justify-between">
									<span className="text-xl font-bold text-green-600">{item.price} ج.م</span>
									<div className="flex items-center text-sm text-gray-500">
										<TrendingUp className="h-4 w-4 ml-1" />
										{item.orderCount} طلب
									</div>
								</div>
								<div className="flex items-center text-sm text-gray-500">
									<Clock className="h-4 w-4 ml-1" />
									{item.preparationTime} دقيقة للتحضير
								</div>
								{item.calories && (
									<div className="text-sm text-gray-500">
										{item.calories} سعرة حرارية
									</div>
								)}
								{item.allergens && item.allergens.length > 0 && (
									<div className="text-xs text-red-600">
										يحتوي على: {item.allergens.join(', ')}
									</div>
								)}
							</div>

							<div className="flex items-center justify-end space-x-2 space-x-reverse">
								<button
									onClick={() => handleEditItem(item)}
									className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200"
									title="تعديل"
								>
									<Edit className="h-4 w-4" />
								</button>
								<button
									onClick={() => handleDeleteItem(item.id)}
									className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
									title="حذف"
								>
									<Trash2 className="h-4 w-4" />
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
					<div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
						<div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-lg">
							<div className="flex items-center justify-between">
								<h3 className="text-lg font-semibold text-gray-900">
									{editingItem ? 'تعديل العنصر' : 'إضافة عنصر جديد'}
								</h3>
								<button
									onClick={() => setShowAddModal(false)}
									className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
								>
									<X className="h-6 w-6" />
								</button>
							</div>
						</div>
						<div className="p-6">

						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div>
								<label className="block text-sm font-medium text-gray-700 mb-2">اسم العنصر *</label>
								<input
									type="text"
									value={formData.name}
									onChange={(e) => setFormData({ ...formData, name: e.target.value })}
									className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
									placeholder="مثال: قهوة تركية"
								/>
							</div>

							<div>
								<label className="block text-sm font-medium text-gray-700 mb-2">السعر (ج.م) *</label>
								<input
									type="number"
									value={formData.price}
									onChange={(e) => setFormData({ ...formData, price: e.target.value })}
									className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
									placeholder="0.00"
									min="0"
									step="0.01"
								/>
							</div>

							<div>
								<label className="block text-sm font-medium text-gray-700 mb-2">الفئة *</label>
								<select
									value={formData.category}
									onChange={(e) => setFormData({ ...formData, category: e.target.value })}
									className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
								>
									<option value="">اختر الفئة</option>
									{categories.map(category => (
										<option key={category} value={category}>{category}</option>
									))}
								</select>
							</div>

							<div>
								<label className="block text-sm font-medium text-gray-700 mb-2">وقت التحضير (دقائق)</label>
								<input
									type="number"
									value={formData.preparationTime}
									onChange={(e) => setFormData({ ...formData, preparationTime: e.target.value })}
									className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
									min="1"
									max="60"
								/>
							</div>

							<div>
								<label className="block text-sm font-medium text-gray-700 mb-2">السعرات الحرارية</label>
								<input
									type="number"
									value={formData.calories}
									onChange={(e) => setFormData({ ...formData, calories: e.target.value })}
									className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
									min="0"
								/>
							</div>

							<div className="md:col-span-2">
								<label className="block text-sm font-medium text-gray-700 mb-2">الوصف</label>
								<textarea
									value={formData.description}
									onChange={(e) => setFormData({ ...formData, description: e.target.value })}
									className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
									rows={3}
									placeholder="وصف مختصر للعنصر..."
								/>
							</div>

							<div className="md:col-span-2">
								<label className="block text-sm font-medium text-gray-700 mb-2">الحساسية</label>
								<div className="grid grid-cols-2 md:grid-cols-4 gap-2">
									{allergenOptions.map(allergen => (
										<label key={allergen} className="flex items-center">
											<input
												type="checkbox"
												checked={formData.allergens.includes(allergen)}
												onChange={() => toggleAllergen(allergen)}
												className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
											/>
											<span className="mr-2 text-sm text-gray-700">{allergen}</span>
										</label>
									))}
								</div>
							</div>

							<div className="md:col-span-2 flex items-center space-x-4 space-x-reverse">
								<label className="flex items-center">
									<input
										type="checkbox"
										checked={formData.isAvailable}
										onChange={(e) => setFormData({ ...formData, isAvailable: e.target.checked })}
										className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
									/>
									<span className="mr-2 text-sm text-gray-700">متاح للطلب</span>
								</label>
								<label className="flex items-center">
									<input
										type="checkbox"
										checked={formData.isPopular}
										onChange={(e) => setFormData({ ...formData, isPopular: e.target.checked })}
										className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
									/>
									<span className="mr-2 text-sm text-gray-700">عنصر شائع</span>
								</label>
							</div>
						</div>

						<div className="flex justify-end space-x-3 space-x-reverse mt-6">
							<button
								onClick={() => setShowAddModal(false)}
								className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors duration-200"
							>
								إلغاء
							</button>
							<button
								onClick={handleSaveItem}
								className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg flex items-center transition-colors duration-200"
							>
								<Save className="h-4 w-4 ml-2" />
								{editingItem ? 'تحديث' : 'حفظ'}
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
