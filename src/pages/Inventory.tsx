import React, { useState, useEffect, useMemo } from 'react';
import { Package, Plus, AlertTriangle, Edit, Trash2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { InventoryItem, MenuItem } from '../services/api';
type IngredientItem = string | { _id?: string; id?: string };
type Ingredient = { item: IngredientItem; quantity: number; unit: string; };
import { api } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { formatCurrency, formatDecimal, formatQuantity } from '../utils/formatters';

const Inventory = () => {
  const {
    inventoryItems,
    fetchInventoryItems,
    updateStock,
    createInventoryItem,
    updateInventoryItem,
    showNotification,
  } = useApp();

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InventoryItem | null>(null);

  // Add/Edit form state
  const [addType, setAddType] = useState<'existing' | 'new'>('existing');
  const [addForm, setAddForm] = useState({
    productId: '',
    name: '',
    category: '',
    quantity: '',
    price: '',
    supplier: '',
    minStock: '',
    unit: '',
    date: new Date().toISOString().slice(0, 10),
    costStatus: 'pending',
    paidAmount: '',
    isRawMaterial: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertType, setAlertType] = useState<'success' | 'error'>('success');

  // القيم المسموحة للفئة والوحدة
  const categoryOptions = ['مشروبات ساخنة', 'مشروبات باردة', 'طعام', 'حلويات', 'مواد خام', 'أخرى'];
  const unitOptions = ['قطعة', 'كيلو', 'جرام', 'لتر', 'مل', 'علبة', 'كيس', 'زجاجة'];
  const costStatusOptions = [
    { value: 'pending', label: 'معلق' },
    { value: 'paid', label: 'مدفوع' },
    { value: 'partially_paid', label: 'مدفوع جزئياً' },
    { value: 'overdue', label: 'متأخر' },
  ];

  // جلب بيانات المخزون عند تحميل الصفحة
  useEffect(() => {
    fetchInventoryItems();
    // eslint-disable-next-line
  }, []);

  // إضافة دعم مفتاح ESC للخروج من النوافذ
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowAddModal(false);
        setShowEditModal(false);
        setShowDeleteModal(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  // حساب المنتجات منخفضة المخزون وقيمة المخزون والفئات
  const lowStockItems = useMemo(() =>
    inventoryItems.filter(item => item.currentStock <= item.minStock),
    [inventoryItems]
  );
  const totalValue = useMemo(() =>
    inventoryItems.reduce((sum, item) => sum + (item.currentStock * item.price), 0),
    [inventoryItems]
  );
  const categoriesCount = useMemo(() =>
    new Set(inventoryItems.map(item => item.category)).size,
    [inventoryItems]
  );
  const rawMaterialsCount = useMemo(() =>
    inventoryItems.filter(item => item.isRawMaterial).length,
    [inventoryItems]
  );

  const getStockStatus = (current: number, min: number) => {
    if (current <= min) return { status: 'low', color: 'text-red-600', bgColor: 'bg-red-50' };
    if (current <= min * 1.5) return { status: 'medium', color: 'text-yellow-600', bgColor: 'bg-yellow-50' };
    return { status: 'good', color: 'text-green-600', bgColor: 'bg-green-50' };
  };

  // حساب المبلغ المتبقي بناءً على حالة الدفع والمبلغ المدفوع
  const calculateRemainingAmount = () => {
    const totalAmount = parseFloat(addForm.price || '0') * parseFloat(addForm.quantity || '0');
    const paidAmount = parseFloat(addForm.paidAmount || '0');
    return Math.max(0, totalAmount - paidAmount);
  };

  // تحديث حالة الدفع تلقائياً بناءً على المبلغ المدفوع
  const updatePaymentStatus = () => {
    const totalAmount = parseFloat(addForm.price || '0') * parseFloat(addForm.quantity || '0');
    const paidAmount = parseFloat(addForm.paidAmount || '0');

    if (paidAmount >= totalAmount && totalAmount > 0) {
      setAddForm(prev => ({ ...prev, costStatus: 'paid' }));
    } else if (paidAmount > 0 && paidAmount < totalAmount) {
      setAddForm(prev => ({ ...prev, costStatus: 'partially_paid' }));
    } else {
      setAddForm(prev => ({ ...prev, costStatus: 'pending' }));
    }
  };

  // مراقبة تغييرات السعر والكمية والمبلغ المدفوع
  useEffect(() => {
    updatePaymentStatus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addForm.price, addForm.quantity, addForm.paidAmount]);

  // فتح نافذة إضافة مخزون
  const openAddModal = () => {
    setAddType('existing');
    setAddForm({
      productId: '',
      name: '',
      category: '',
      quantity: '',
      price: '',
      supplier: '',
      minStock: '',
      unit: '',
      date: new Date().toISOString().slice(0, 10),
      costStatus: 'pending',
      paidAmount: '',
      isRawMaterial: false
    });
    setError('');
    setSuccess('');
    setShowAddModal(true);
  };

  // فتح نافذة تعديل منتج
  const openEditModal = (item: InventoryItem) => {
    setSelectedItem(item);
    setAddForm({
      productId: item.id || item._id,
      name: item.name,
      category: item.category,
      quantity: '',
      price: String(item.price),
      supplier: item.supplier || '',
      minStock: String(item.minStock || ''),
      unit: item.unit || '',
      date: new Date().toISOString().slice(0, 10),
      costStatus: 'pending',
      paidAmount: '',
      isRawMaterial: item.isRawMaterial || false,
    });
    setError('');
    setSuccess('');
    setShowEditModal(true);
  };

  // فتح نافذة حذف منتج
  const openDeleteModal = (item: InventoryItem) => {
    setDeleteTarget(item);
    setShowDeleteModal(true);
  };

  // تغيير نوع الإضافة (منتج جديد أو إضافة كمية لمنتج موجود)
  const handleAddTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setAddType(e.target.value as 'existing' | 'new');
    setAddForm({
      productId: '',
      name: '',
      category: '',
      quantity: '',
      price: '',
      supplier: '',
      minStock: '',
      unit: '',
      date: new Date().toISOString().slice(0, 10),
      costStatus: 'pending',
      paidAmount: '',
      isRawMaterial: false
    });
    setError('');
    setSuccess('');
  };

  // تغيير الحقول
  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    if (name === 'paidAmount') {
      // حساب المبلغ الكلي (الكمية × السعر)
      const quantity = parseFloat(addForm.quantity) || 0;
      const price = parseFloat(addForm.price) || 0;
      const totalCost = quantity * price;

      // التأكد من أن المبلغ المدفوع لا يتجاوز المبلغ الكلي
      let paidAmount = parseFloat(value) || 0;
      if (paidAmount > totalCost) {
        paidAmount = totalCost;
      }

      setAddForm({
        ...addForm,
        [name]: paidAmount.toString()
      });
    } else if (name === 'costStatus' && value === 'paid') {
      // إذا تم اختيار الحالة كـ "مدفوع"، تحديث المبلغ المدفوع تلقائياً
      const quantity = parseFloat(addForm.quantity) || 0;
      const price = parseFloat(addForm.price) || 0;
      const totalCost = quantity * price;

      setAddForm({
        ...addForm,
        [name]: value,
        paidAmount: totalCost.toString()
      });
    } else {
      setAddForm({ ...addForm, [name]: value });
    }
  };

  // إظهار نافذة التنبيه
  const showAlertMessage = (message: string, type: 'success' | 'error' = 'success') => {
    setAlertMessage(message);
    setAlertType(type);
    setShowAlert(true);
    setTimeout(() => setShowAlert(false), 5000);
  };

  // إغلاق نافذة التنبيه
  const closeAlert = () => {
    setShowAlert(false);
  };

  // إضافة كمية جديدة أو منتج جديد
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      if (addType === 'existing') {
        if (!addForm.productId || !addForm.quantity || !addForm.price) {
          setError('يرجى اختيار المنتج وإدخال الكمية والسعر.');
          showAlertMessage('يرجى تعبئة جميع الحقول المطلوبة', 'error');
          setLoading(false);
          return;
        }
        const res = await updateStock(addForm.productId, {
          type: 'in',
          quantity: Number(addForm.quantity),
          reason: 'شراء مخزون جديد',
          price: Number(addForm.price),
          supplier: addForm.supplier,
          date: addForm.date,
          costStatus: addForm.costStatus,
          paidAmount: Number(addForm.paidAmount) || 0,
        });
        if (res) {
          setSuccess('تمت إضافة الكمية بنجاح!');
          showNotification('تمت إضافة الكمية بنجاح!', 'success');
          fetchInventoryItems();
          setShowAddModal(false);
        } else {
          setError('حدث خطأ أثناء الإضافة');
        }
      } else {
        // إضافة منتج جديد بالكامل
        if (!addForm.name || !addForm.category || !addForm.quantity || !addForm.price || !addForm.unit || !addForm.minStock) {
          setError('يرجى إدخال جميع الحقول المطلوبة.');
          setLoading(false);
          return;
        }
        const res = await createInventoryItem({
          name: addForm.name,
          category: addForm.category,
          currentStock: Number(addForm.quantity),
          minStock: Number(addForm.minStock),
          unit: addForm.unit,
          price: Number(addForm.price),
          supplier: addForm.supplier,
          costStatus: addForm.costStatus,
          paidAmount: Number(addForm.paidAmount) || 0,
          isRawMaterial: addForm.isRawMaterial,
        });
        if (res) {
          setSuccess('تمت إضافة المنتج بنجاح!');
          showNotification('تمت إضافة المنتج بنجاح!', 'success');
          fetchInventoryItems();
          setShowAddModal(false);
        } else {
          setError('حدث خطأ أثناء إضافة المنتج');
        }
      }
    } catch (err) {
      const error = err as Error;
      if (error?.message?.includes('موجود بالفعل')) {
        setError(error.message);
      } else {
        setError('حدث خطأ أثناء العملية');
      }
    }
    setLoading(false);
  };

  // تعديل منتج
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      if (!selectedItem) {
        setError('لم يتم تحديد منتج للتعديل');
        showAlertMessage('لم يتم تحديد منتج للتعديل', 'error');
        setLoading(false);
        return;
      }
      if (!addForm.name || !addForm.category || !addForm.price || !addForm.unit || !addForm.minStock) {
        const errorMsg = 'يرجى إدخال جميع الحقول المطلوبة';
        setError(errorMsg);
        showAlertMessage(errorMsg, 'error');
        setLoading(false);
        return;
      }
      const res = await updateInventoryItem(selectedItem.id || selectedItem._id, {
        name: addForm.name,
        category: addForm.category,
        price: Number(addForm.price),
        minStock: Number(addForm.minStock),
        unit: addForm.unit,
        supplier: addForm.supplier,
        isRawMaterial: addForm.isRawMaterial,
      });
      if (res) {
        setSuccess('تم تعديل المنتج بنجاح!');
        showNotification('تم تعديل المنتج بنجاح!', 'success');
        fetchInventoryItems();
        setShowEditModal(false);
      } else {
        setError('حدث خطأ أثناء التعديل');
      }
    } catch (err) {
      const error = err as Error;
      if (error?.message?.includes('موجود بالفعل')) {
        setError(error.message);
      } else {
        setError('حدث خطأ أثناء العملية');
      }
    } finally {
      setLoading(false);
    }
  };

  // التحقق مما إذا كان المنتج مستخدماً في قائمة الطعام
  const isItemUsedInMenu = async (itemId: string): Promise<{isUsed: boolean; menuItems?: Array<{name: string}>, itemName: string}> => {
    try {
      // جلب جميع عناصر القائمة مع تفاصيل المكونات
      const response = await api.getMenuItems({ 
        limit: 1000 // جلب عدد أكبر من العناصر للتأكد
      });
      
      if (response.success && response.data) {
        // البحث في كل عنصر في القائمة
        const itemName = inventoryItems.find(item => item.id === itemId || item._id === itemId)?.name || 'هذا المنتج';
        const menuItems = response.data.filter((menuItem: MenuItem) => {
          // التحقق من وجود مكونات للعنصر
          if (!menuItem.ingredients || !Array.isArray(menuItem.ingredients)) {
            return false;
          }
          // البحث عن المكون في قائمة المكونات
          return menuItem.ingredients.some((ing: Ingredient) => {
            // التحقق من أن المكون موجود وأن المعرف متطابق
            const item = typeof ing.item === 'string' 
              ? ing.item 
              : (ing.item as { _id?: string; id?: string })?.id || (ing.item as { _id?: string; id?: string })?._id;
            return item === itemId;
          });
        });
        
        const isUsed = menuItems.length > 0;
        console.log(`المنتج ${itemName} ${isUsed ? 'مستخدم' : 'غير مستخدم'} في القائمة`);
        return {
          isUsed,
          menuItems: menuItems.map((item: MenuItem) => ({ name: item.name })),
          itemName
        };
      }
      return { isUsed: false, itemName: 'هذا المنتج' };
    } catch (err) {
      console.error('خطأ في التحقق من استخدام المنتج في القائمة:', err);
      return { isUsed: true, itemName: 'هذا المنتج' }; // في حالة الخطأ، نمنع الحذف كإجراء احترازي
    }
  };

  // حذف منتج
  const handleDelete = async () => {
    if (!deleteTarget) return;
    
    // التحقق مما إذا كان المنتج مستخدماً في قائمة الطعام
    const { isUsed, menuItems, itemName } = await isItemUsedInMenu(deleteTarget.id || deleteTarget._id);
    if (isUsed && menuItems && menuItems.length > 0) {
      const menuItemsList = menuItems.map(item => `- ${item.name}`).join('\n');
      const errorMsg = `
        لا يمكن حذف ${itemName} لأنه مستخدم في الأصناف التالية:\n\n${menuItemsList}
        \n\nالرجاء إزالة المنتج من هذه الأصناف أولاً.`;
      
      setError(errorMsg);
      showAlertMessage(`لا يمكن حذف ${itemName} لأنه مستخدم في ${menuItems.length} صنف في القائمة`, 'error');
      setLoading(false);
      setShowDeleteModal(false);
      return;
    }
    
    setLoading(true);
    setError('');
    try {
      const res = await deleteInventoryItemApi(deleteTarget.id || deleteTarget._id);
      if (res) {
        showNotification('تم حذف المنتج بنجاح', 'success');
        showAlertMessage('تم حذف المنتج بنجاح', 'success');
        fetchInventoryItems();
        setShowDeleteModal(false);
      } else {
        const errorMsg = 'حدث خطأ أثناء حذف المنتج';
        setError(errorMsg);
        showAlertMessage(errorMsg, 'error');
      }
    } catch (err) {
      console.error('خطأ في حذف المنتج:', err);
      setError('حدث خطأ أثناء حذف المنتج');
      showAlertMessage('حدث خطأ أثناء حذف المنتج', 'error');
    } finally {
      setLoading(false);
    }
  };

  // أضف دالة حذف المنتج من المخزون
  const deleteInventoryItemApi = async (id: string) => {
    try {
      if (typeof api.deleteInventoryItem === 'function') {
        const response = await api.deleteInventoryItem(id);
        return response.success;
      }
      return false;
    } catch {
      return false;
    }
  };

  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap xs:flex-col xs:items-start xs:gap-2 xs:space-y-2 xs:w-full">
        <div className="flex items-center xs:w-full xs:justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center xs:text-base xs:w-full xs:text-center">
            <Package className="h-6 w-6 text-orange-600 dark:text-orange-400 ml-2" />
            إدارة المخزون
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mr-4 xs:mr-0 xs:w-full xs:text-center">متابعة المواد الخام والمنتجات</p>
        </div>
        <button
          onClick={openAddModal}
          className="bg-orange-600 hover:bg-orange-700 dark:bg-orange-500 dark:hover:bg-orange-600 text-white px-4 py-2 rounded-lg flex items-center transition-colors duration-200 xs:w-full xs:justify-center xs:mt-2"
        >
          <Plus className="h-5 w-5 ml-2" />
          إضافة مخزون
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
              <Package className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="mr-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">إجمالي المنتجات</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{formatDecimal(inventoryItems.length)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-red-100 dark:bg-red-900 rounded-lg flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <div className="mr-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">منتجات منخفضة</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{formatDecimal(lowStockItems.length)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
              <Package className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div className="mr-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">قيمة المخزون</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{formatCurrency(totalValue)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center">
              <Package className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="mr-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">الفئات</p>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{formatDecimal(categoriesCount)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900 rounded-lg flex items-center justify-center">
              <Package className="h-6 w-6 text-orange-600 dark:text-orange-400" />
            </div>
            <div className="mr-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">الخامات</p>
              <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{formatDecimal(rawMaterialsCount)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Low Stock Alert */}
      {lowStockItems.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4">
          <div className="flex items-center mb-3">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 ml-2" />
            <h3 className="text-lg font-semibold text-red-800 dark:text-red-200">تنبيه: منتجات منخفضة المخزون</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {lowStockItems.map(item => (
              <div key={item.id || item._id} className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-red-200 dark:border-red-600">
                <p className="font-medium text-gray-900 dark:text-gray-100">{item.name}</p>
                <p className="text-sm text-red-600 dark:text-red-400">
                  متبقي: {formatQuantity(item.currentStock, item.unit)} (الحد الأدنى: {formatQuantity(item.minStock, item.unit)})
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Inventory Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-600">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">جرد المخزون</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">المنتج</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">النوع</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">الفئة</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">المخزون الحالي</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">الحد الأدنى</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">الوحدة</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">السعر</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">القيمة الإجمالية</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">المورد</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {inventoryItems.map((item) => {
                const stockStatus = getStockStatus(item.currentStock, item.minStock);
                return (
                  <tr key={item.id || item._id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900 dark:text-gray-100">{item.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        item.isRawMaterial
                          ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                      }`}>
                        {item.isRawMaterial ? 'خامة' : 'منتج'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{item.category}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${stockStatus.bgColor} ${stockStatus.color}`}>
                        {formatQuantity(item.currentStock, item.unit)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{formatQuantity(item.minStock, item.unit)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{item.unit}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{formatCurrency(item.price)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">{formatCurrency(item.currentStock * item.price)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{item.supplier}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2 space-x-reverse">
                      <button className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300" onClick={() => openEditModal(item)}>
                        <Edit className="h-4 w-4" />
                      </button>
                      <button className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300" onClick={() => openDeleteModal(item)}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal إضافة مخزون */}
      {showAddModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowAddModal(false);
            }
          }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-600 px-6 py-4 rounded-t-lg">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">إضافة مخزون</h2>
                <button
                  className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 text-2xl font-bold transition-colors duration-200"
                  onClick={() => setShowAddModal(false)}
                >×</button>
              </div>
            </div>
            <div className="p-6">
            <h2 className="text-xl font-bold mb-4 text-center text-gray-900 dark:text-gray-100">إضافة مخزون</h2>
            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">نوع الإضافة</label>
                <select name="addType" value={addType} onChange={handleAddTypeChange} className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-gray-100">
                  <option value="existing">إضافة كمية لمنتج موجود</option>
                  <option value="new">إضافة منتج جديد</option>
                </select>
              </div>
              {addType === 'existing' ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">اختر المنتج</label>
                    <select name="productId" value={addForm.productId} onChange={handleFormChange} className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-gray-100" required>
                      <option value="">اختر المنتج</option>
                      {inventoryItems.map(item => (
                        <option key={item.id || item._id} value={item.id || item._id}>{item.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">الكمية</label>
                    <input type="number" name="quantity" value={addForm.quantity} onChange={handleFormChange} className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-gray-100" required min="1" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">السعر للوحدة</label>
                    <input type="number" name="price" value={addForm.price} onChange={handleFormChange} className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-gray-100" required min="0" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">المورد</label>
                    <input type="text" name="supplier" value={addForm.supplier} onChange={handleFormChange} className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-gray-100" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">تاريخ الإضافة</label>
                    <input type="date" name="date" value={addForm.date} onChange={handleFormChange} className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-gray-100" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">حالة الدفع</label>
                    <select
                      name="costStatus"
                      value={addForm.costStatus}
                      onChange={handleFormChange}
                      className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-gray-100"
                    >
                      {costStatusOptions.map(option => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* إظهار حقول الدفع فقط إذا كانت الحالة ليست "مدفوع" */}
                  {addForm.costStatus !== 'paid' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          المبلغ المدفوع
                          {addForm.costStatus === 'partially_paid' && (
                            <span className="text-xs text-gray-500 mr-2">(جزئي)</span>
                          )}
                        </label>
                        <input
                          type="number"
                          name="paidAmount"
                          value={addForm.paidAmount}
                          onChange={handleFormChange}
                          className="w-full border rounded px-3 py-2"
                          min="0"
                          max={parseFloat(addForm.price || '0') * parseFloat(addForm.quantity || '0')}
                          placeholder="0"
                        />
                        {addForm.paidAmount && (
                          <div className="text-xs text-gray-500 mt-1">
                            المتبقي: {formatCurrency(calculateRemainingAmount())}
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {/* إظهار ملخص التكلفة */}
                  {addForm.price && addForm.quantity && (
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <div className="text-sm font-medium text-gray-700 mb-2">ملخص التكلفة:</div>
                      <div className="text-sm text-gray-600">
                        <div>إجمالي التكلفة: {formatCurrency(parseFloat(addForm.price || '0') * parseFloat(addForm.quantity || '0'))}</div>
                        {addForm.paidAmount && (
                          <>
                            <div>المدفوع: {formatCurrency(parseFloat(addForm.paidAmount || '0'))}</div>
                            <div>المتبقي: {formatCurrency(calculateRemainingAmount())}</div>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {/* رسالة مفيدة حول قاعدة التسمية */}
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-600 rounded-lg p-3 mb-4">
                    <div className="flex items-start">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="mr-3">
                        <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">ملاحظة مهمة</h3>
                        <div className="mt-1 text-sm text-blue-700 dark:text-blue-300">
                          <p>• لا يمكن إضافة منتج بنفس الاسم لمنشأة واحدة</p>
                          <p>• إذا كان المنتج موجود، استخدم "إضافة كمية لمنتج موجود"</p>
                          <p>• يمكن إضافة منتجات بنفس الاسم في منشآت مختلفة</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">اسم المنتج</label>
                    <input type="text" name="name" value={addForm.name} onChange={handleFormChange} className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-gray-100" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">الفئة</label>
                    <select name="category" value={addForm.category} onChange={handleFormChange} className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-gray-100" required>
                      <option value="">اختر الفئة</option>
                      {categoryOptions.map(option => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">الكمية</label>
                    <input type="number" name="quantity" value={addForm.quantity} onChange={handleFormChange} className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-gray-100" required min="0" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">الوحدة</label>
                    <select name="unit" value={addForm.unit} onChange={handleFormChange} className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-gray-100" required>
                      <option value="">اختر الوحدة</option>
                      {unitOptions.map(option => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">الحد الأدنى</label>
                    <input type="number" name="minStock" value={addForm.minStock} onChange={handleFormChange} className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-gray-100" required min="0" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">السعر للوحدة</label>
                    <input type="number" name="price" value={addForm.price} onChange={handleFormChange} className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-gray-100" required min="0" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">المورد</label>
                    <input type="text" name="supplier" value={addForm.supplier} onChange={handleFormChange} className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-gray-100" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        name="isRawMaterial"
                        checked={addForm.isRawMaterial}
                        onChange={(e) => setAddForm({ ...addForm, isRawMaterial: e.target.checked })}
                        className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 dark:border-gray-600 rounded"
                      />
                      <span className="mr-2 text-sm text-gray-700 dark:text-gray-300">خامة (مادة خام)</span>
                    </label>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">حدد هذا الخيار إذا كان العنصر خامة تستخدم في تحضير المنتجات</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">حالة الدفع</label>
                    <select
                      name="costStatus"
                      value={addForm.costStatus}
                      onChange={handleFormChange}
                      className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-gray-100"
                    >
                      {costStatusOptions.map(option => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* إظهار حقول الدفع فقط إذا كانت الحالة ليست "مدفوع" */}
                  {addForm.costStatus !== 'paid' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          المبلغ المدفوع
                          {addForm.costStatus === 'partially_paid' && (
                            <span className="text-xs text-gray-500 mr-2">(جزئي)</span>
                          )}
                        </label>
                        <input
                          type="number"
                          name="paidAmount"
                          value={addForm.paidAmount}
                          onChange={handleFormChange}
                          className="w-full border rounded px-3 py-2"
                          min="0"
                          max={parseFloat(addForm.price || '0') * parseFloat(addForm.quantity || '0')}
                          placeholder="0"
                        />
                        {addForm.paidAmount && (
                          <div className="text-xs text-gray-500 mt-1">
                            المتبقي: {formatCurrency(calculateRemainingAmount())}
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {/* إظهار ملخص التكلفة */}
                  {addForm.price && addForm.quantity && (
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <div className="text-sm font-medium text-gray-700 mb-2">ملخص التكلفة:</div>
                      <div className="text-sm text-gray-600">
                        <div>إجمالي التكلفة: {formatCurrency(parseFloat(addForm.price || '0') * parseFloat(addForm.quantity || '0'))}</div>
                        {addForm.paidAmount && (
                          <>
                            <div>المدفوع: {formatCurrency(parseFloat(addForm.paidAmount || '0'))}</div>
                            <div>المتبقي: {formatCurrency(calculateRemainingAmount())}</div>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
              {error && <div className="text-red-600 dark:text-red-400 text-sm">{error}</div>}
              {success !== '' && (
                <div className="text-green-600 dark:text-green-400 text-sm flex flex-col gap-2">
                  <span>{success}</span>
                  <span>تم تسجيل هذه العملية أيضًا ضمن التكاليف تلقائيًا.</span>
                  <button
                    type="button"
                    className="underline text-blue-700 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 w-fit self-end"
                    onClick={() => navigate('/costs')}
                  >عرض صفحة التكاليف</button>
                </div>
              )}
              <button 
                type="submit" 
                className={`w-full flex items-center justify-center gap-2 ${loading ? 'bg-orange-500' : 'bg-orange-600 hover:bg-orange-700 dark:bg-orange-500 dark:hover:bg-orange-600'} text-white py-2 rounded-lg font-bold transition-colors duration-200`} 
                disabled={loading}
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    جاري الحفظ...
                  </>
                ) : 'حفظ'}
              </button>
            </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal تعديل منتج */}
      {showEditModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowEditModal(false);
            }
          }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-600 px-6 py-4 rounded-t-lg">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">تعديل منتج</h2>
                <button
                  className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 text-2xl font-bold transition-colors duration-200"
                  onClick={() => setShowEditModal(false)}
                >×</button>
              </div>
            </div>
            <div className="p-6">
            <h2 className="text-xl font-bold mb-4 text-center text-gray-900 dark:text-gray-100">تعديل منتج</h2>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">اسم المنتج</label>
                <input type="text" name="name" value={addForm.name} onChange={handleFormChange} className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-gray-100" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">الفئة</label>
                <input type="text" name="category" value={addForm.category} onChange={handleFormChange} className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-gray-100" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">الوحدة</label>
                <input type="text" name="unit" value={addForm.unit} onChange={handleFormChange} className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-gray-100" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">الحد الأدنى</label>
                <input type="number" name="minStock" value={addForm.minStock} onChange={handleFormChange} className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-gray-100" required min="0" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">السعر للوحدة</label>
                <input type="number" name="price" value={addForm.price} onChange={handleFormChange} className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-gray-100" required min="0" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">المورد</label>
                <input type="text" name="supplier" value={addForm.supplier} onChange={handleFormChange} className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-gray-100" />
              </div>
              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    name="isRawMaterial"
                    checked={addForm.isRawMaterial}
                    onChange={(e) => setAddForm({ ...addForm, isRawMaterial: e.target.checked })}
                    className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 dark:border-gray-600 rounded"
                  />
                  <span className="mr-2 text-sm text-gray-700 dark:text-gray-300">خامة (مادة خام)</span>
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">حدد هذا الخيار إذا كان العنصر خامة تستخدم في تحضير المنتجات</p>
              </div>
              {error && <div className="text-red-600 dark:text-red-400 text-sm">{error}</div>}
              {success && <div className="text-green-600 dark:text-green-400 text-sm">{success}</div>}
              <button 
                type="submit" 
                className={`w-full flex items-center justify-center gap-2 ${loading ? 'bg-orange-500' : 'bg-orange-600 hover:bg-orange-700 dark:bg-orange-500 dark:hover:bg-orange-600'} text-white py-2 rounded-lg font-bold transition-colors duration-200`} 
                disabled={loading}
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    جاري التحديث...
                  </>
                ) : 'حفظ التعديلات'}
              </button>
            </form>
            </div>
          </div>
        </div>
      )}

      {/* نافذة التنبيه */}
      {showAlert && (
        <div className="fixed top-4 right-4 z-50 transition-all duration-300 ease-in-out">
          <div className={`px-6 py-4 rounded-lg shadow-lg ${alertType === 'success' ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'}`}>
            <div className="flex items-center justify-between">
              <p>{alertMessage}</p>
              <button 
                onClick={closeAlert}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-gray-100 ml-4"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal حذف منتج */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowDeleteModal(false);
            }
          }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-600 px-6 py-4 rounded-t-lg">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">تأكيد حذف المنتج</h2>
                <button
                  className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 text-2xl font-bold transition-colors duration-200"
                  onClick={() => setShowDeleteModal(false)}
                >×</button>
              </div>
            </div>
            <div className="p-6 text-center">
            <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">تأكيد حذف المنتج</h2>
            <p className="mb-6 text-gray-700 dark:text-gray-300">هل أنت متأكد أنك تريد حذف المنتج <span className="font-bold text-red-600 dark:text-red-400">{deleteTarget?.name}</span>؟ لا يمكن التراجع عن هذه العملية.</p>
            {error && <div className="text-red-600 dark:text-red-400 text-sm mb-2">{error}</div>}
            <div className="flex gap-4 justify-center">
              <button
                className={`${loading ? 'opacity-50 cursor-not-allowed' : ''} bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-800 dark:text-gray-100 px-4 py-2 rounded-lg font-bold transition-colors duration-200`}
                onClick={() => setShowDeleteModal(false)}
                disabled={loading}
              >
                إلغاء
              </button>
              <button
                className={`flex items-center justify-center gap-2 ${loading ? 'bg-red-500' : 'bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700'} text-white px-4 py-2 rounded-lg font-bold transition-colors duration-200`}
                onClick={handleDelete}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    جاري الحذف...
                  </>
                ) : 'حذف'}
              </button>
            </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;
