import React, { useState, useEffect, useMemo } from 'react';
import { Package, Plus, AlertTriangle, Edit, Trash2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { InventoryItem } from '../services/api';
import { api } from '../services/api';
import { useNavigate } from 'react-router-dom';

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
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // القيم المسموحة للفئة والوحدة
  const categoryOptions = ['مشروبات ساخنة', 'مشروبات باردة', 'طعام', 'حلويات', 'مواد خام', 'أخرى'];
  const unitOptions = ['قطعة', 'كيلو', 'جرام', 'لتر', 'مل', 'علبة', 'كيس', 'زجاجة'];

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

  const getStockStatus = (current: number, min: number) => {
    if (current <= min) return { status: 'low', color: 'text-red-600', bgColor: 'bg-red-50' };
    if (current <= min * 1.5) return { status: 'medium', color: 'text-yellow-600', bgColor: 'bg-yellow-50' };
    return { status: 'good', color: 'text-green-600', bgColor: 'bg-green-50' };
  };

  // فتح نافذة إضافة مخزون
  const openAddModal = () => {
    setAddType('existing');
    setAddForm({
      productId: '', name: '', category: '', quantity: '', price: '', supplier: '', minStock: '', unit: '', date: new Date().toISOString().slice(0, 10)
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
      productId: '', name: '', category: '', quantity: '', price: '', supplier: '', minStock: '', unit: '', date: new Date().toISOString().slice(0, 10)
    });
    setError('');
    setSuccess('');
  };

  // تغيير الحقول
  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setAddForm({ ...addForm, [e.target.name]: e.target.value });
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
    } catch {
      setError('حدث خطأ أثناء العملية');
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
      if (!selectedItem) return;
      if (!addForm.name || !addForm.category || !addForm.price || !addForm.unit || !addForm.minStock) {
        setError('يرجى إدخال جميع الحقول المطلوبة.');
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
      });
      if (res) {
        setSuccess('تم تعديل المنتج بنجاح!');
        showNotification('تم تعديل المنتج بنجاح!', 'success');
        fetchInventoryItems();
        setShowEditModal(false);
      } else {
        setError('حدث خطأ أثناء التعديل');
      }
    } catch {
      setError('حدث خطأ أثناء العملية');
    }
    setLoading(false);
  };

  // حذف منتج
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setLoading(true);
    setError('');
    try {
      const res = await deleteInventoryItemApi(deleteTarget.id || deleteTarget._id);
      if (res) {
        showNotification('تم حذف المنتج بنجاح', 'success');
        fetchInventoryItems();
        setShowDeleteModal(false);
      } else {
        setError('حدث خطأ أثناء الحذف');
      }
    } catch {
      setError('حدث خطأ أثناء الحذف');
    }
    setLoading(false);
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
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Package className="h-8 w-8 text-primary-600 ml-3" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">إدارة المخزون</h1>
            <p className="text-gray-600">متابعة المواد الخام والمنتجات</p>
          </div>
        </div>
        <button
          onClick={openAddModal}
          className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg flex items-center transition-colors duration-200"
        >
          <Plus className="h-5 w-5 ml-2" />
          إضافة مخزون
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Package className="h-6 w-6 text-blue-600" />
            </div>
            <div className="mr-4">
              <p className="text-sm font-medium text-gray-600">إجمالي المنتجات</p>
              <p className="text-2xl font-bold text-blue-600">{inventoryItems.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <div className="mr-4">
              <p className="text-sm font-medium text-gray-600">منتجات منخفضة</p>
              <p className="text-2xl font-bold text-red-600">{lowStockItems.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <Package className="h-6 w-6 text-green-600" />
            </div>
            <div className="mr-4">
              <p className="text-sm font-medium text-gray-600">قيمة المخزون</p>
              <p className="text-2xl font-bold text-green-600">{totalValue} ج.م</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Package className="h-6 w-6 text-purple-600" />
            </div>
            <div className="mr-4">
              <p className="text-sm font-medium text-gray-600">الفئات</p>
              <p className="text-2xl font-bold text-purple-600">{categoriesCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Low Stock Alert */}
      {lowStockItems.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center mb-3">
            <AlertTriangle className="h-5 w-5 text-red-600 ml-2" />
            <h3 className="text-lg font-semibold text-red-800">تنبيه: منتجات منخفضة المخزون</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {lowStockItems.map(item => (
              <div key={item.id || item._id} className="bg-white rounded-lg p-3 border border-red-200">
                <p className="font-medium text-gray-900">{item.name}</p>
                <p className="text-sm text-red-600">
                  متبقي: {item.currentStock} {item.unit} (الحد الأدنى: {item.minStock})
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Inventory Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">جرد المخزون</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">المنتج</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الفئة</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">المخزون الحالي</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الحد الأدنى</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الوحدة</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">السعر</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">القيمة الإجمالية</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">المورد</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {inventoryItems.map((item) => {
                const stockStatus = getStockStatus(item.currentStock, item.minStock);
                return (
                  <tr key={item.id || item._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{item.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.category}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${stockStatus.bgColor} ${stockStatus.color}`}>
                        {item.currentStock} {item.unit}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.minStock} {item.unit}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.unit}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.price} ج.م</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.currentStock * item.price} ج.م</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.supplier}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2 space-x-reverse">
                      <button className="text-blue-600 hover:text-blue-800" onClick={() => openEditModal(item)}>
                        <Edit className="h-4 w-4" />
                      </button>
                      <button className="text-red-600 hover:text-red-800" onClick={() => openDeleteModal(item)}>
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
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-lg">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">إضافة مخزون</h2>
                <button
                  className="text-gray-400 hover:text-gray-700 text-2xl font-bold transition-colors duration-200"
                  onClick={() => setShowAddModal(false)}
                >×</button>
              </div>
            </div>
            <div className="p-6">
            <h2 className="text-xl font-bold mb-4 text-center">إضافة مخزون</h2>
            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">نوع الإضافة</label>
                <select name="addType" value={addType} onChange={handleAddTypeChange} className="w-full border rounded px-3 py-2">
                  <option value="existing">إضافة كمية لمنتج موجود</option>
                  <option value="new">إضافة منتج جديد</option>
                </select>
              </div>
              {addType === 'existing' ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">اختر المنتج</label>
                    <select name="productId" value={addForm.productId} onChange={handleFormChange} className="w-full border rounded px-3 py-2" required>
                      <option value="">اختر المنتج</option>
                      {inventoryItems.map(item => (
                        <option key={item.id || item._id} value={item.id || item._id}>{item.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">الكمية</label>
                    <input type="number" name="quantity" value={addForm.quantity} onChange={handleFormChange} className="w-full border rounded px-3 py-2" required min="1" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">السعر للوحدة</label>
                    <input type="number" name="price" value={addForm.price} onChange={handleFormChange} className="w-full border rounded px-3 py-2" required min="0" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">المورد</label>
                    <input type="text" name="supplier" value={addForm.supplier} onChange={handleFormChange} className="w-full border rounded px-3 py-2" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">تاريخ الإضافة</label>
                    <input type="date" name="date" value={addForm.date} onChange={handleFormChange} className="w-full border rounded px-3 py-2" />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">اسم المنتج</label>
                    <input type="text" name="name" value={addForm.name} onChange={handleFormChange} className="w-full border rounded px-3 py-2" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">الفئة</label>
                    <select name="category" value={addForm.category} onChange={handleFormChange} className="w-full border rounded px-3 py-2" required>
                      <option value="">اختر الفئة</option>
                      {categoryOptions.map(option => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">الكمية</label>
                    <input type="number" name="quantity" value={addForm.quantity} onChange={handleFormChange} className="w-full border rounded px-3 py-2" required min="0" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">الوحدة</label>
                    <select name="unit" value={addForm.unit} onChange={handleFormChange} className="w-full border rounded px-3 py-2" required>
                      <option value="">اختر الوحدة</option>
                      {unitOptions.map(option => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">الحد الأدنى</label>
                    <input type="number" name="minStock" value={addForm.minStock} onChange={handleFormChange} className="w-full border rounded px-3 py-2" required min="0" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">السعر للوحدة</label>
                    <input type="number" name="price" value={addForm.price} onChange={handleFormChange} className="w-full border rounded px-3 py-2" required min="0" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">المورد</label>
                    <input type="text" name="supplier" value={addForm.supplier} onChange={handleFormChange} className="w-full border rounded px-3 py-2" />
                  </div>
                </>
              )}
              {error && <div className="text-red-600 text-sm">{error}</div>}
              {success !== '' && (
                <div className="text-green-600 text-sm flex flex-col gap-2">
                  <span>{success}</span>
                  <span>تم تسجيل هذه العملية أيضًا ضمن التكاليف تلقائيًا.</span>
                  <button
                    type="button"
                    className="underline text-blue-700 hover:text-blue-900 w-fit self-end"
                    onClick={() => navigate('/costs')}
                  >عرض صفحة التكاليف</button>
                </div>
              )}
              <button type="submit" className="w-full bg-primary-600 hover:bg-primary-700 text-white py-2 rounded-lg font-bold transition-colors duration-200" disabled={loading}>
                {loading ? 'جاري الحفظ...' : 'حفظ'}
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
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-lg">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">تعديل منتج</h2>
                <button
                  className="text-gray-400 hover:text-gray-700 text-2xl font-bold transition-colors duration-200"
                  onClick={() => setShowEditModal(false)}
                >×</button>
              </div>
            </div>
            <div className="p-6">
            <h2 className="text-xl font-bold mb-4 text-center">تعديل منتج</h2>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">اسم المنتج</label>
                <input type="text" name="name" value={addForm.name} onChange={handleFormChange} className="w-full border rounded px-3 py-2" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الفئة</label>
                <input type="text" name="category" value={addForm.category} onChange={handleFormChange} className="w-full border rounded px-3 py-2" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الوحدة</label>
                <input type="text" name="unit" value={addForm.unit} onChange={handleFormChange} className="w-full border rounded px-3 py-2" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الحد الأدنى</label>
                <input type="number" name="minStock" value={addForm.minStock} onChange={handleFormChange} className="w-full border rounded px-3 py-2" required min="0" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">السعر للوحدة</label>
                <input type="number" name="price" value={addForm.price} onChange={handleFormChange} className="w-full border rounded px-3 py-2" required min="0" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">المورد</label>
                <input type="text" name="supplier" value={addForm.supplier} onChange={handleFormChange} className="w-full border rounded px-3 py-2" />
              </div>
              {error && <div className="text-red-600 text-sm">{error}</div>}
              {success && <div className="text-green-600 text-sm">{success}</div>}
              <button type="submit" className="w-full bg-primary-600 hover:bg-primary-700 text-white py-2 rounded-lg font-bold transition-colors duration-200" disabled={loading}>
                {loading ? 'جاري الحفظ...' : 'حفظ التعديلات'}
              </button>
            </form>
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
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-lg">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">تأكيد حذف المنتج</h2>
                <button
                  className="text-gray-400 hover:text-gray-700 text-2xl font-bold transition-colors duration-200"
                  onClick={() => setShowDeleteModal(false)}
                >×</button>
              </div>
            </div>
            <div className="p-6 text-center">
            <h2 className="text-xl font-bold mb-4">تأكيد حذف المنتج</h2>
            <p className="mb-6">هل أنت متأكد أنك تريد حذف المنتج <span className="font-bold text-red-600">{deleteTarget?.name}</span>؟ لا يمكن التراجع عن هذه العملية.</p>
            {error && <div className="text-red-600 text-sm mb-2">{error}</div>}
            <div className="flex gap-4 justify-center">
              <button
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-lg font-bold transition-colors duration-200"
                onClick={() => setShowDeleteModal(false)}
                disabled={loading}
              >إلغاء</button>
              <button
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-bold transition-colors duration-200"
                onClick={handleDelete}
                disabled={loading}
              >{loading ? 'جاري الحذف...' : 'حذف'}</button>
            </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;
