import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Package, Plus, AlertTriangle, Edit, Trash2, History, Minus, ChevronDown, ChevronUp, Edit2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { InventoryItem, MenuItem } from '../services/api';
type IngredientItem = string | { _id?: string; id?: string };
type Ingredient = { item: IngredientItem; quantity: number; unit: string; };
import { api } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { formatCurrency, formatDecimal, formatQuantity } from '../utils/formatters';
import { io, Socket } from 'socket.io-client';

// Helper function to get current date/time in Cairo timezone (Egypt)
// Returns format: YYYY-MM-DDTHH:mm for datetime-local input
const getCairoDateTime = () => {
  const now = new Date();
  // Convert to Cairo timezone (Africa/Cairo - UTC+2 or UTC+3 with DST)
  const cairoTime = new Date(now.toLocaleString('en-US', { timeZone: 'Africa/Cairo' }));
  // Format as YYYY-MM-DDTHH:mm for datetime-local input
  const year = cairoTime.getFullYear();
  const month = String(cairoTime.getMonth() + 1).padStart(2, '0');
  const day = String(cairoTime.getDate()).padStart(2, '0');
  const hours = String(cairoTime.getHours()).padStart(2, '0');
  const minutes = String(cairoTime.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

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
  const [showMovementsModal, setShowMovementsModal] = useState(false);
  const [showDeductModal, setShowDeductModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InventoryItem | null>(null);
  const [itemMovements, setItemMovements] = useState<any[]>([]);
  
  // Deduct form state
  const [deductForm, setDeductForm] = useState({
    quantity: '',
    reason: '',
    type: 'out' as 'out' | 'adjustment',
    date: getCairoDateTime(),
  });

  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterType, setFilterType] = useState(''); // 'raw' or 'product'
  const [filterStock, setFilterStock] = useState(''); // 'all', 'low', 'out'
  const [filterDateFrom, setFilterDateFrom] = useState(''); // Date filter from
  const [filterDateTo, setFilterDateTo] = useState(''); // Date filter to
  const [filterMonth, setFilterMonth] = useState(''); // Month filter (YYYY-MM)
  const [filterYear, setFilterYear] = useState(''); // Year filter (YYYY)
  const [dateFilterType, setDateFilterType] = useState<'range' | 'month' | 'year'>('range'); // Type of date filter
  const [showBasicFilters, setShowBasicFilters] = useState(true); // Toggle basic filters
  const [showDateFilters, setShowDateFilters] = useState(false); // Toggle date filters

  // Edit movement states
  const [showEditMovementModal, setShowEditMovementModal] = useState(false);
  const [editingMovement, setEditingMovement] = useState<any>(null);
  const [editMovementForm, setEditMovementForm] = useState({
    quantity: '',
    price: '',
    reason: '',
    date: '',
  });
  const [productSearchTerm, setProductSearchTerm] = useState(''); // For add modal product search
  const [showProductDropdown, setShowProductDropdown] = useState(false); // Show/hide product dropdown

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
    date: getCairoDateTime(),
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
  const [menuCategories, setMenuCategories] = useState<Array<{ id: string; name: string }>>([]);

  // القيم المسموحة للوحدة
  const unitOptions = ['قطعة', 'كيلو', 'جرام', 'لتر', 'مل', 'علبة', 'كيس', 'زجاجة'];
  
  // الفئات الافتراضية + الفئات من المنيو
  const defaultCategories = ['مشروبات ساخنة', 'مشروبات باردة', 'طعام', 'حلويات', 'مواد خام', 'أخرى'];
  const categoryOptions = useMemo(() => {
    const menuCategoryNames = menuCategories.map(cat => cat.name);
    const allCategories = [...new Set([...defaultCategories, ...menuCategoryNames])];
    return allCategories.sort();
  }, [menuCategories]);
  const costStatusOptions = [
    { value: 'pending', label: 'معلق' },
    { value: 'paid', label: 'مدفوع' },
    { value: 'partially_paid', label: 'مدفوع جزئياً' },
    { value: 'overdue', label: 'متأخر' },
  ];

  // Socket.IO reference
  const socketRef = useRef<Socket | null>(null);

  // جلب بيانات المخزون والفئات عند تحميل الصفحة
  useEffect(() => {
    fetchInventoryItems();
    fetchMenuCategories();
    // eslint-disable-next-line
  }, []);

  // Socket.IO connection for real-time updates
  useEffect(() => {
    // Prevent duplicate connections in React Strict Mode
    if (socketRef.current) {
      return;
    }

    // Initialize Socket.IO connection
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    const socketUrl = apiUrl.replace(/\/api\/?$/, '');
    
    const socket = io(socketUrl, {
      path: '/socket.io/',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    socketRef.current = socket;

    // Listen for inventory updates
    socket.on('inventory-update', async (data: any) => {
      console.log('Inventory update received:', data);
      // Refresh inventory list
      await fetchInventoryItems();
      
      // If movements modal is open, refresh movements
      if (showMovementsModal && selectedItem) {
        await refreshStockMovements(selectedItem.id || selectedItem._id);
      }
    });

    // Connection event handlers
    socket.on('connect', () => {
      console.log('Socket.IO connected for inventory updates');
    });

    socket.on('disconnect', (reason) => {
      console.log('Socket.IO disconnected:', reason);
    });

    return () => {
      if (import.meta.env.DEV) {
        socket.off('inventory-update');
        socket.off('connect');
        socket.off('disconnect');
      } else {
        socket.off('inventory-update');
        socket.off('connect');
        socket.off('disconnect');
        socket.disconnect();
        socketRef.current = null;
      }
    };
  }, [showMovementsModal, selectedItem]);
  
  // جلب فئات المنيو
  const fetchMenuCategories = async () => {
    try {
      const response = await api.getMenuCategories();
      if (response.success && response.data) {
        setMenuCategories(response.data.map((cat: any) => ({
          id: cat.id || cat._id,
          name: cat.name
        })));
      }
    } catch (error) {
      console.error('Error fetching menu categories:', error);
      // لا نعرض خطأ للمستخدم - سنستخدم الفئات الافتراضية
    }
  };

  // إضافة دعم مفتاح ESC للخروج من النوافذ
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowAddModal(false);
        setShowEditModal(false);
        setShowDeleteModal(false);
        setShowMovementsModal(false);
        setShowDeductModal(false);
        setShowProductDropdown(false);
        setShowEditMovementModal(false);
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.product-dropdown-container')) {
        setShowProductDropdown(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // حساب المنتجات منخفضة المخزون وقيمة المخزون والفئات
  const lowStockItems = useMemo(() =>
    inventoryItems.filter(item => item.currentStock <= item.minStock),
    [inventoryItems]
  );
  const totalValue = useMemo(() =>
    inventoryItems.reduce((sum, item) => sum + (item.totalValue || (item.currentStock * item.price)), 0),
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

  // Filtered inventory items based on search and filters
  const filteredItems = useMemo(() => {
    return inventoryItems.filter(item => {
      // Search filter
      if (searchTerm && !item.name.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      
      // Category filter
      if (filterCategory && item.category !== filterCategory) {
        return false;
      }
      
      // Type filter (raw material or product)
      if (filterType === 'raw' && !item.isRawMaterial) {
        return false;
      }
      if (filterType === 'product' && item.isRawMaterial) {
        return false;
      }
      
      // Stock level filter
      if (filterStock === 'low' && item.currentStock > item.minStock) {
        return false;
      }
      if (filterStock === 'out' && item.currentStock > 0) {
        return false;
      }
      
      return true;
    });
  }, [inventoryItems, searchTerm, filterCategory, filterType, filterStock]);

  // Filtered products for add modal dropdown
  const filteredProducts = useMemo(() => {
    if (!productSearchTerm) return inventoryItems;
    return inventoryItems.filter(item => 
      item.name.toLowerCase().includes(productSearchTerm.toLowerCase())
    );
  }, [inventoryItems, productSearchTerm]);

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
    setProductSearchTerm(''); // Reset search term
    setAddForm({
      productId: '',
      name: '',
      category: '',
      quantity: '',
      price: '',
      supplier: '',
      minStock: '',
      unit: '',
      date: getCairoDateTime(),
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
      date: getCairoDateTime(),
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

  // فتح نافذة عرض حركات المخزون
  const openMovementsModal = async (item: InventoryItem) => {
    setSelectedItem(item);
    setLoading(true);
    try {
      // Fetch updated item data with totalValue
      const itemResponse = await api.getInventoryItem(item.id || item._id);
      if (itemResponse.success && itemResponse.data) {
        setSelectedItem(itemResponse.data);
      }
      
      // Fetch movements
      const response = await api.getStockMovements(item.id || item._id);
      if (response.success && response.data) {
        setItemMovements(response.data);
      } else {
        setItemMovements([]);
      }
    } catch (error) {
      console.error('Error fetching stock movements:', error);
      setItemMovements([]);
      showNotification('فشل في جلب سجل الحركات', 'error');
    } finally {
      setLoading(false);
      setShowMovementsModal(true);
    }
  };

  // تحديث حركات المخزون (للاستخدام بعد التعديل/الحذف)
  const refreshStockMovements = async (itemId: string) => {
    try {
      // Fetch updated item data with totalValue
      const itemResponse = await api.getInventoryItem(itemId);
      if (itemResponse.success && itemResponse.data) {
        setSelectedItem(itemResponse.data);
      }
      
      // Fetch movements
      const response = await api.getStockMovements(itemId);
      if (response.success && response.data) {
        setItemMovements(response.data);
      }
    } catch (error) {
      console.error('Error refreshing stock movements:', error);
    }
  };

  // فتح نافذة خصم الكمية
  const openDeductModal = (item: InventoryItem) => {
    setSelectedItem(item);
    setDeductForm({
      quantity: '',
      reason: '',
      type: 'out',
      date: getCairoDateTime(),
    });
    setError('');
    setShowDeductModal(true);
  };

  // خصم الكمية
  const handleDeductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;

    setLoading(true);
    setError('');
    
    try {
      const quantity = Number(deductForm.quantity);
      
      if (!quantity || quantity <= 0) {
        setError('يرجى إدخال كمية صحيحة');
        setLoading(false);
        return;
      }

      if (deductForm.type === 'out' && quantity > selectedItem.currentStock) {
        setError(`الكمية المتوفرة: ${selectedItem.currentStock} ${selectedItem.unit} فقط`);
        setLoading(false);
        return;
      }

      if (!deductForm.reason) {
        setError('يرجى إدخال سبب الخصم');
        setLoading(false);
        return;
      }

      const res = await updateStock(selectedItem.id || selectedItem._id, {
        type: deductForm.type,
        quantity: deductForm.type === 'adjustment' ? quantity : quantity,
        reason: deductForm.reason,
        date: deductForm.date,
      });

      if (res) {
        showNotification(
          deductForm.type === 'adjustment' 
            ? 'تم تعديل المخزون بنجاح' 
            : 'تم خصم الكمية بنجاح',
          'success'
        );
        
        // Refresh inventory list
        await fetchInventoryItems();
        
        // Close modal
        setShowDeductModal(false);
        
        // Reset form
        setDeductForm({
          quantity: '',
          reason: '',
          type: 'out',
          date: getCairoDateTime(),
        });
        setError('');
      } else {
        setError('حدث خطأ أثناء العملية');
      }
    } catch (err) {
      const error = err as Error;
      setError(error.message || 'حدث خطأ أثناء العملية');
    } finally {
      setLoading(false);
    }
  };

  // فتح نافذة تعديل الحركة
  const openEditMovementModal = (movement: any) => {
    setEditingMovement(movement);
    
    // Convert movement timestamp to Cairo timezone
    let cairoDateTime = '';
    if (movement.timestamp) {
      const movementDate = new Date(movement.timestamp);
      const cairoTime = new Date(movementDate.toLocaleString('en-US', { timeZone: 'Africa/Cairo' }));
      const year = cairoTime.getFullYear();
      const month = String(cairoTime.getMonth() + 1).padStart(2, '0');
      const day = String(cairoTime.getDate()).padStart(2, '0');
      const hours = String(cairoTime.getHours()).padStart(2, '0');
      const minutes = String(cairoTime.getMinutes()).padStart(2, '0');
      cairoDateTime = `${year}-${month}-${day}T${hours}:${minutes}`;
    }
    
    setEditMovementForm({
      quantity: movement.quantity.toString(),
      price: movement.price ? movement.price.toString() : '',
      reason: movement.reason || '',
      date: cairoDateTime || getCairoDateTime(),
    });
    setShowEditMovementModal(true);
  };

  // تعديل الحركة
  const handleEditMovementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || !editingMovement) return;

    setLoading(true);
    setError('');

    try {
      const quantity = Number(editMovementForm.quantity);
      const price = editMovementForm.price ? Number(editMovementForm.price) : undefined;

      if (!quantity || quantity <= 0) {
        setError('يرجى إدخال كمية صحيحة');
        setLoading(false);
        return;
      }

      if (!editMovementForm.reason) {
        setError('يرجى إدخال السبب');
        setLoading(false);
        return;
      }

      const response = await api.put(
        `/inventory/${selectedItem.id || selectedItem._id}/movements/${editingMovement._id}`,
        {
          quantity,
          price,
          reason: editMovementForm.reason,
          date: editMovementForm.date,
        }
      );

      // Check for success - handle both response.data.success and response.success
      const isSuccess = response?.data?.success || response?.success;
      
      if (isSuccess) {
        showNotification('تم تحديث الحركة بنجاح', 'success');
        
        // Close modal immediately
        setShowEditMovementModal(false);
        setError('');
        
        // Refresh movements and inventory in parallel (in background)
        Promise.all([
          refreshStockMovements(selectedItem.id || selectedItem._id),
          fetchInventoryItems()
        ]).catch(err => {
          console.error('Error refreshing data:', err);
        });
      } else {
        setError('حدث خطأ أثناء تحديث الحركة');
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'حدث خطأ أثناء تحديث الحركة';
      setError(errorMessage);
      showNotification(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  // حذف الحركة
  const handleDeleteMovement = async (movementId: string) => {
    if (!selectedItem) return;

    if (!window.confirm('هل أنت متأكد من حذف هذه الحركة؟ سيتم إعادة حساب المخزون تلقائياً.')) {
      return;
    }

    setLoading(true);

    try {
      const response = await api.delete(
        `/inventory/${selectedItem.id || selectedItem._id}/movements/${movementId}`
      );

      // Check for success
      const isSuccess = response?.data?.success || response?.success;
      
      if (isSuccess) {
        showNotification('تم حذف الحركة بنجاح', 'success');
        
        // Refresh movements and inventory in parallel (in background)
        Promise.all([
          refreshStockMovements(selectedItem.id || selectedItem._id),
          fetchInventoryItems()
        ]).catch(err => {
          console.error('Error refreshing data:', err);
        });
      } else {
        showNotification('حدث خطأ أثناء حذف الحركة', 'error');
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'حدث خطأ أثناء حذف الحركة';
      showNotification(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  // تغيير نوع الإضافة (منتج جديد أو إضافة كمية لمنتج موجود)
  const handleAddTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setAddType(e.target.value as 'existing' | 'new');
    setProductSearchTerm(''); // Reset search term when changing type
    setAddForm({
      productId: '',
      name: '',
      category: '',
      quantity: '',
      price: '',
      supplier: '',
      minStock: '',
      unit: '',
      date: getCairoDateTime(),
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
          
          // Refresh inventory list
          await fetchInventoryItems();
          
          // Close modal
          setShowAddModal(false);
          
          // Reset form
          setAddForm({
            productId: '',
            name: '',
            category: '',
            quantity: '',
            price: '',
            supplier: '',
            minStock: '',
            unit: '',
            date: getCairoDateTime(),
            costStatus: 'pending',
            paidAmount: '',
            isRawMaterial: false,
          });
          setError('');
          setSuccess('');
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
          
          // Refresh inventory list
          await fetchInventoryItems();
          
          // Close modal
          setShowAddModal(false);
          
          // Reset form
          setAddForm({
            productId: '',
            name: '',
            category: '',
            quantity: '',
            price: '',
            supplier: '',
            minStock: '',
            unit: '',
            date: getCairoDateTime(),
            costStatus: 'pending',
            paidAmount: '',
            isRawMaterial: false,
          });
          setError('');
          setSuccess('');
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
        
        // Refresh inventory list
        await fetchInventoryItems();
        
        // Close modal
        setShowEditModal(false);
        
        // Reset form
        setAddForm({
          productId: '',
          name: '',
          category: '',
          quantity: '',
          price: '',
          supplier: '',
          minStock: '',
          unit: '',
          date: getCairoDateTime(),
          costStatus: 'pending',
          paidAmount: '',
          isRawMaterial: false,
        });
        setError('');
        setSuccess('');
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
        return {
          isUsed,
          menuItems: menuItems.map((item: MenuItem) => ({ name: item.name })),
          itemName
        };
      }
      return { isUsed: false, itemName: 'هذا المنتج' };
    } catch (err) {
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
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">جرد المخزون</h3>
          
          {/* Search and Filters */}
          <div className="space-y-3">
            {/* Basic Filters Section */}
            <div className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
              <button
                onClick={() => setShowBasicFilters(!showBasicFilters)}
                className="w-full bg-gray-50 dark:bg-gray-700 px-4 py-3 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
              >
                <span className="font-medium text-gray-900 dark:text-gray-100">الفلاتر الأساسية</span>
                {showBasicFilters ? (
                  <ChevronUp className="h-5 w-5 text-gray-600 dark:text-gray-300" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-gray-600 dark:text-gray-300" />
                )}
              </button>
              
              {showBasicFilters && (
                <div className="p-4 bg-white dark:bg-gray-800">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Search */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        بحث
                      </label>
                      <input
                        type="text"
                        placeholder="ابحث عن منتج..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-gray-100"
                      />
                    </div>

                    {/* Category Filter */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        الفئة
                      </label>
                      <select
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                        className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-gray-100"
                      >
                        <option value="">جميع الفئات</option>
                        {categoryOptions.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>

                    {/* Type Filter */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        النوع
                      </label>
                      <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                        className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-gray-100"
                      >
                        <option value="">الكل</option>
                        <option value="raw">خامات فقط</option>
                        <option value="product">منتجات فقط</option>
                      </select>
                    </div>

                    {/* Stock Level Filter */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        حالة المخزون
                      </label>
                      <select
                        value={filterStock}
                        onChange={(e) => setFilterStock(e.target.value)}
                        className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-gray-100"
                      >
                        <option value="">الكل</option>
                        <option value="low">منخفض فقط</option>
                        <option value="out">نفذ فقط</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Date Filters Section */}
            <div className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
              <button
                onClick={() => setShowDateFilters(!showDateFilters)}
                className="w-full bg-gray-50 dark:bg-gray-700 px-4 py-3 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
              >
                <span className="font-medium text-gray-900 dark:text-gray-100">فلترة بالتاريخ</span>
                {showDateFilters ? (
                  <ChevronUp className="h-5 w-5 text-gray-600 dark:text-gray-300" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-gray-600 dark:text-gray-300" />
                )}
              </button>
              
              {showDateFilters && (
                <div className="p-4 bg-white dark:bg-gray-800 space-y-4">
                  {/* Date Filter Type Selector */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      نوع الفلترة
                    </label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setDateFilterType('range');
                          setFilterMonth('');
                          setFilterYear('');
                        }}
                        className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                          dateFilterType === 'range'
                            ? 'bg-orange-600 text-white'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                        }`}
                      >
                        من - إلى
                      </button>
                      <button
                        onClick={() => {
                          setDateFilterType('month');
                          setFilterDateFrom('');
                          setFilterDateTo('');
                          setFilterYear('');
                        }}
                        className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                          dateFilterType === 'month'
                            ? 'bg-orange-600 text-white'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                        }`}
                      >
                        شهر محدد
                      </button>
                      <button
                        onClick={() => {
                          setDateFilterType('year');
                          setFilterDateFrom('');
                          setFilterDateTo('');
                          setFilterMonth('');
                        }}
                        className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                          dateFilterType === 'year'
                            ? 'bg-orange-600 text-white'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                        }`}
                      >
                        سنة محددة
                      </button>
                    </div>
                  </div>

                  {/* Date Range Filters */}
                  {dateFilterType === 'range' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          من تاريخ
                        </label>
                        <input
                          type="date"
                          value={filterDateFrom}
                          onChange={(e) => setFilterDateFrom(e.target.value)}
                          className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-gray-100"
                          max={new Date().toISOString().slice(0, 10)}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          إلى تاريخ
                        </label>
                        <input
                          type="date"
                          value={filterDateTo}
                          onChange={(e) => setFilterDateTo(e.target.value)}
                          className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-gray-100"
                          max={new Date().toISOString().slice(0, 10)}
                        />
                      </div>
                    </div>
                  )}

                  {/* Month Filter */}
                  {dateFilterType === 'month' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        اختر الشهر
                      </label>
                      <input
                        type="month"
                        value={filterMonth}
                        onChange={(e) => setFilterMonth(e.target.value)}
                        className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-gray-100"
                        max={new Date().toISOString().slice(0, 7)}
                      />
                    </div>
                  )}

                  {/* Year Filter */}
                  {dateFilterType === 'year' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        اختر السنة
                      </label>
                      <select
                        value={filterYear}
                        onChange={(e) => setFilterYear(e.target.value)}
                        className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-gray-100"
                      >
                        <option value="">كل السنوات</option>
                        {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map(year => (
                          <option key={year} value={year}>{year}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Results count and reset button */}
            {(searchTerm || filterCategory || filterType || filterStock || filterDateFrom || filterDateTo || filterMonth || filterYear) && (
              <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-600 rounded-lg px-4 py-3">
                <span className="text-sm text-blue-800 dark:text-blue-200">
                  عرض {filteredItems.length} من {inventoryItems.length} منتج
                </span>
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setFilterCategory('');
                    setFilterType('');
                    setFilterStock('');
                    setFilterDateFrom('');
                    setFilterDateTo('');
                    setFilterMonth('');
                    setFilterYear('');
                  }}
                  className="text-sm font-medium text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300 underline"
                >
                  إعادة تعيين جميع الفلاتر
                </button>
              </div>
            )}
          </div>
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
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">آخر سعر شراء</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">القيمة الإجمالية</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">المورد</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                    {searchTerm || filterCategory || filterType || filterStock || filterDateFrom || filterDateTo || filterMonth || filterYear
                      ? 'لا توجد نتائج مطابقة للبحث'
                      : 'لا توجد منتجات في المخزون'}
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                      {formatCurrency(item.totalValue || (item.currentStock * item.price))}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{item.supplier}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2 space-x-reverse">
                      <button 
                        className="text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300 inline-flex items-center" 
                        onClick={() => openMovementsModal(item)}
                        title="سجل الحركات"
                      >
                        <History className="h-4 w-4" />
                      </button>
                      <button 
                        className="text-orange-600 hover:text-orange-800 dark:text-orange-400 dark:hover:text-orange-300 inline-flex items-center" 
                        onClick={() => openDeductModal(item)}
                        title="خصم كمية"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <button 
                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300" 
                        onClick={() => openEditModal(item)}
                        title="تعديل"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button 
                        className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300" 
                        onClick={() => openDeleteModal(item)}
                        title="حذف"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })
              )}
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
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-600 px-6 py-4 rounded-t-lg z-10">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">إضافة مخزون</h2>
                <button
                  className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 text-2xl font-bold transition-colors duration-200"
                  onClick={() => setShowAddModal(false)}
                >×</button>
              </div>
            </div>
            <div className="p-6">
            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">نوع الإضافة</label>
                <select name="addType" value={addType} onChange={handleAddTypeChange} className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-gray-100">
                  <option value="existing">إضافة كمية لمنتج موجود (بسعر جديد)</option>
                  <option value="new">إضافة منتج جديد تماماً</option>
                </select>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {addType === 'existing' 
                    ? '💡 استخدم هذا الخيار لإضافة كمية جديدة بسعر مختلف لمنتج موجود (مثال: شراء سكر بسعر جديد)'
                    : '💡 استخدم هذا الخيار فقط لإضافة منتج لم يكن موجوداً من قبل'}
                </p>
              </div>
              {addType === 'existing' ? (
                <>
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-600 rounded-lg p-3">
                    <div className="flex items-start">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="mr-3">
                        <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">إضافة كمية بسعر جديد</h3>
                        <div className="mt-1 text-sm text-blue-700 dark:text-blue-300">
                          <p>• يمكنك إضافة كمية جديدة بسعر مختلف عن السعر السابق</p>
                          <p>• سيتم حفظ سجل كامل بكل عمليات الشراء والأسعار</p>
                          <p>• يمكنك مراجعة السجل من زر "سجل الحركات" 📊</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="md:col-span-2 lg:col-span-3">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">اختر المنتج</label>
                    <div className="relative product-dropdown-container">
                      <input
                        type="text"
                        placeholder="ابحث عن منتج بالكتابة..."
                        value={productSearchTerm}
                        onChange={(e) => setProductSearchTerm(e.target.value)}
                        onFocus={() => setShowProductDropdown(true)}
                        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 dark:bg-gray-700 dark:text-gray-100 text-base"
                      />
                      {showProductDropdown && (
                        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                          {filteredProducts.length === 0 ? (
                            <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                              {productSearchTerm ? 'لا توجد منتجات مطابقة للبحث' : 'ابدأ بالكتابة للبحث...'}
                            </div>
                          ) : (
                            filteredProducts.map(item => (
                              <button
                                key={item.id || item._id}
                                type="button"
                                onClick={() => {
                                  setAddForm({ ...addForm, productId: item.id || item._id });
                                  setProductSearchTerm(item.name);
                                  setShowProductDropdown(false);
                                }}
                                className="w-full text-right px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                              >
                                <div className="font-medium text-gray-900 dark:text-gray-100">{item.name}</div>
                                <div className="text-sm text-gray-600 dark:text-gray-400">
                                  {item.category} - المخزون: {formatQuantity(item.currentStock, item.unit)}
                                </div>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                      {addForm.productId && (
                        <input type="hidden" name="productId" value={addForm.productId} />
                      )}
                    </div>
                    {!addForm.productId && productSearchTerm && (
                      <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">يرجى اختيار منتج من القائمة</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">الكمية</label>
                    <input type="number" name="quantity" value={addForm.quantity} onChange={handleFormChange} className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 dark:bg-gray-700 dark:text-gray-100 text-base" required min="0.01" step="0.01" placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">السعر للوحدة</label>
                    <input type="number" name="price" value={addForm.price} onChange={handleFormChange} className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 dark:bg-gray-700 dark:text-gray-100 text-base" required min="0" step="0.01" placeholder="0.00" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">المورد</label>
                    <input type="text" name="supplier" value={addForm.supplier} onChange={handleFormChange} className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 dark:bg-gray-700 dark:text-gray-100 text-base" placeholder="اختياري" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">تاريخ ووقت الإضافة</label>
                    <input type="datetime-local" name="date" value={addForm.date} onChange={handleFormChange} className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 dark:bg-gray-700 dark:text-gray-100 text-base" />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">💡 يمكنك تحديد تاريخ ووقت سابق للعملية</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">حالة الدفع</label>
                    <select
                      name="costStatus"
                      value={addForm.costStatus}
                      onChange={handleFormChange}
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 dark:bg-gray-700 dark:text-gray-100 text-base"
                    >
                      {costStatusOptions.map(option => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                  {addForm.costStatus !== 'paid' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
                        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 dark:bg-gray-700 dark:text-gray-100 text-base"
                        min="0"
                        step="0.01"
                        max={parseFloat(addForm.price || '0') * parseFloat(addForm.quantity || '0')}
                        placeholder="0.00"
                      />
                      {addForm.paidAmount && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          المتبقي: {formatCurrency(calculateRemainingAmount())}
                        </div>
                      )}
                    </div>
                  )}
                  </div>

                  {/* إظهار ملخص التكلفة */}
                  {addForm.price && addForm.quantity && (
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                      <div className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-3">ملخص التكلفة</div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">إجمالي التكلفة:</span>
                          <div className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatCurrency(parseFloat(addForm.price || '0') * parseFloat(addForm.quantity || '0'))}</div>
                        </div>
                        {addForm.paidAmount && (
                          <>
                            <div>
                              <span className="text-gray-600 dark:text-gray-400">المدفوع:</span>
                              <div className="text-lg font-bold text-green-600 dark:text-green-400">{formatCurrency(parseFloat(addForm.paidAmount || '0'))}</div>
                            </div>
                            <div>
                              <span className="text-gray-600 dark:text-gray-400">المتبقي:</span>
                              <div className="text-lg font-bold text-red-600 dark:text-red-400">{formatCurrency(calculateRemainingAmount())}</div>
                            </div>
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
              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-600 rounded-lg p-3">
                  <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
                </div>
              )}
              {success !== '' && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-600 rounded-lg p-3">
                  <p className="text-sm text-green-800 dark:text-green-200">{success}</p>
                  <p className="text-xs text-green-700 dark:text-green-300 mt-1">تم تسجيل هذه العملية أيضًا ضمن التكاليف تلقائيًا.</p>
                  <button
                    type="button"
                    className="text-sm underline text-blue-700 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 mt-2"
                    onClick={() => navigate('/costs')}
                  >عرض صفحة التكاليف</button>
                </div>
              )}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-800 dark:text-gray-100 px-6 py-3 rounded-lg font-medium transition-colors duration-200"
                  disabled={loading}
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className={`flex-1 ${loading ? 'bg-orange-500' : 'bg-orange-600 hover:bg-orange-700 dark:bg-orange-500 dark:hover:bg-orange-600'} text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200 flex items-center justify-center gap-2`}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      جاري الحفظ...
                    </>
                  ) : (
                    <>
                      <Plus className="h-5 w-5" />
                      حفظ
                    </>
                  )}
                </button>
              </div>
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

      {/* Modal خصم الكمية */}
      {showDeductModal && selectedItem && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowDeductModal(false);
            }
          }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-600 px-6 py-4 rounded-t-lg">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">خصم كمية</h2>
                <button
                  className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 text-2xl font-bold transition-colors duration-200"
                  onClick={() => setShowDeductModal(false)}
                >×</button>
              </div>
            </div>
            <div className="p-6">
              <div className="mb-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-600 rounded-lg p-3">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>المنتج:</strong> {selectedItem.name}
                </p>
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>المخزون الحالي:</strong> {formatQuantity(selectedItem.currentStock, selectedItem.unit)}
                </p>
              </div>

              <form onSubmit={handleDeductSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    نوع العملية
                  </label>
                  <select
                    value={deductForm.type}
                    onChange={(e) => setDeductForm({ ...deductForm, type: e.target.value as 'out' | 'adjustment' })}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-gray-100"
                  >
                    <option value="out">خصم (بيع/استهلاك/إرجاع)</option>
                    <option value="adjustment">تعديل المخزون (جرد)</option>
                  </select>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {deductForm.type === 'out' 
                      ? '💡 يخصم الكمية من المخزون الحالي'
                      : '💡 يضبط المخزون على الكمية المحددة (للجرد)'}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {deductForm.type === 'out' ? 'الكمية المراد خصمها' : 'المخزون الصحيح'}
                  </label>
                  <input
                    type="number"
                    value={deductForm.quantity}
                    onChange={(e) => setDeductForm({ ...deductForm, quantity: e.target.value })}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-gray-100"
                    required
                    min="0"
                    step="0.01"
                    placeholder={deductForm.type === 'out' ? 'مثال: 5' : `الحالي: ${selectedItem.currentStock}`}
                  />
                  {deductForm.type === 'out' && deductForm.quantity && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      المتبقي بعد الخصم: {Math.max(0, selectedItem.currentStock - Number(deductForm.quantity))} {selectedItem.unit}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    السبب
                  </label>
                  <select
                    value={deductForm.reason}
                    onChange={(e) => {
                      const value = e.target.value;
                      setDeductForm({ ...deductForm, reason: value === 'أخرى' ? '' : value });
                    }}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-gray-100 mb-2"
                  >
                    <option value="">اختر السبب</option>
                    {deductForm.type === 'out' ? (
                      <>
                        <option value="بيع">بيع</option>
                        <option value="استهلاك في الإنتاج">استهلاك في الإنتاج</option>
                        <option value="تالف">تالف</option>
                        <option value="منتهي الصلاحية">منتهي الصلاحية</option>
                        <option value="إرجاع للمورد">إرجاع للمورد</option>
                        <option value="أخرى">أخرى (حدد السبب)</option>
                      </>
                    ) : (
                      <>
                        <option value="جرد دوري">جرد دوري</option>
                        <option value="تصحيح خطأ">تصحيح خطأ</option>
                        <option value="فقدان">فقدان</option>
                        <option value="أخرى">أخرى (حدد السبب)</option>
                      </>
                    )}
                  </select>
                  {(!deductForm.reason || deductForm.reason === 'أخرى') && (
                    <input
                      type="text"
                      value={deductForm.reason === 'أخرى' ? '' : deductForm.reason}
                      onChange={(e) => setDeductForm({ ...deductForm, reason: e.target.value })}
                      className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-gray-100"
                      placeholder="اكتب السبب..."
                      required
                    />
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    التاريخ والوقت
                  </label>
                  <input
                    type="datetime-local"
                    value={deductForm.date}
                    onChange={(e) => setDeductForm({ ...deductForm, date: e.target.value })}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-gray-100"
                    required
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    💡 يمكنك تحديد تاريخ ووقت سابق للعملية
                  </p>
                </div>

                {error && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-600 rounded-lg p-3">
                    <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowDeductModal(false)}
                    className="flex-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-800 dark:text-gray-100 px-4 py-2 rounded-lg font-medium transition-colors duration-200"
                    disabled={loading}
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className={`flex-1 ${loading ? 'bg-orange-500' : 'bg-orange-600 hover:bg-orange-700'} text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200 flex items-center justify-center gap-2`}
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        جاري الخصم...
                      </>
                    ) : (
                      <>
                        <Minus className="h-4 w-4" />
                        {deductForm.type === 'out' ? 'خصم الكمية' : 'تعديل المخزون'}
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal سجل حركات المخزون */}
      {showMovementsModal && selectedItem && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowMovementsModal(false);
            }
          }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-600 px-6 py-4 rounded-t-lg z-10">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">سجل حركات المخزون</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{selectedItem.name}</p>
                </div>
                <button
                  className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 text-2xl font-bold transition-colors duration-200"
                  onClick={() => setShowMovementsModal(false)}
                >×</button>
              </div>
            </div>
            <div className="p-6">
              {loading ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
                  <p className="mt-2 text-gray-600 dark:text-gray-400">جاري التحميل...</p>
                </div>
              ) : itemMovements.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">لا توجد حركات مخزون لهذا المنتج</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* ملخص المنتج */}
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">المخزون الحالي</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                        {formatQuantity(selectedItem.currentStock, selectedItem.unit)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">القيمة الإجمالية</p>
                      <p className="text-lg font-bold text-green-600 dark:text-green-400">
                        {formatCurrency(selectedItem.totalValue || (selectedItem.currentStock * selectedItem.price))}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        محسوبة بناءً على سعر كل دفعة (FIFO)
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">عدد الحركات</p>
                      <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                        {itemMovements.length}
                      </p>
                    </div>
                  </div>

                  {/* جدول الحركات */}
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">التاريخ</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">النوع</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">الكمية</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">السعر/الوحدة</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">الإجمالي</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">السبب</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">المخزون بعد</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">إجراءات</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {itemMovements.map((movement: any, index: number) => {
                          // Use stored totalCost if available, otherwise calculate from price
                          const displayPrice = movement.price;
                          let displayTotal = null;
                          
                          if (movement.totalCost !== null && movement.totalCost !== undefined) {
                            // Use stored totalCost from database (FIFO calculated)
                            displayTotal = movement.totalCost;
                          } else if (movement.price) {
                            // Fallback: calculate from price for old movements
                            displayTotal = movement.price * Math.abs(movement.quantity);
                          }
                          
                          return (
                          <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                              {movement.timestamp || movement.date 
                                ? new Date(movement.timestamp || movement.date).toLocaleDateString('ar-EG', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })
                                : 'غير محدد'}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                movement.type === 'in'
                                  ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                                  : movement.type === 'out'
                                  ? 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                                  : 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                              }`}>
                                {movement.type === 'in' ? 'إضافة' : movement.type === 'out' ? 'خصم' : 'تعديل'}
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className={`font-medium ${
                                movement.type === 'in' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                              }`}>
                                {movement.type === 'in' ? '+' : '-'}{formatQuantity(movement.quantity, selectedItem.unit)}
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                              {displayPrice ? (
                                <span className={(movement.type === 'out' || movement.type === 'adjustment') ? 'text-gray-500 dark:text-gray-400' : ''}>
                                  {formatCurrency(displayPrice)}
                                </span>
                              ) : '-'}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                              {displayTotal ? (
                                <span className={(movement.type === 'out' || movement.type === 'adjustment') ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}>
                                  {formatCurrency(displayTotal)}
                                </span>
                              ) : '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                              {movement.reason || '-'}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                              {formatQuantity(movement.balanceAfter, selectedItem.unit)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm">
                              <div className="flex gap-2 justify-end">
                                {/* لا يمكن تعديل أو حذف الحركات المرتبطة بالطلبات */}
                                {!movement.reason?.includes('طلب رقم') && !movement.reason?.includes('فاتورة') ? (
                                  <>
                                    <button
                                      onClick={() => openEditMovementModal(movement)}
                                      className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                                      title="تعديل"
                                    >
                                      <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteMovement(movement._id)}
                                      className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                                      title="حذف"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </>
                                ) : (
                                  <span className="text-xs text-gray-500 dark:text-gray-400 italic">
                                    مرتبط بطلب
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        )})}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Movement Modal */}
      {showEditMovementModal && editingMovement && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">
                تعديل الحركة
              </h2>

              {/* نوع الحركة والتحذير */}
              <div className={`mb-4 p-4 rounded-lg ${
                editingMovement.type === 'in' 
                  ? 'bg-green-50 dark:bg-green-900/20 border-2 border-green-300 dark:border-green-600' 
                  : editingMovement.type === 'out'
                  ? 'bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-600'
                  : 'bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-300 dark:border-blue-600'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-bold text-base">نوع الحركة:</span>
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold ${
                    editingMovement.type === 'in'
                      ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                      : editingMovement.type === 'out'
                      ? 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                      : 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                  }`}>
                    {editingMovement.type === 'in' ? '➕ إضافة' : editingMovement.type === 'out' ? '➖ خصم' : '🔄 تعديل'}
                  </span>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                    ⚠️ تحذير هام:
                  </p>
                  {editingMovement.type === 'in' ? (
                    <>
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        • هذه حركة <strong>إضافة</strong> - تعديل الكمية سيؤثر على المخزون الحالي
                      </p>
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        • زيادة الكمية = زيادة المخزون | تقليل الكمية = تقليل المخزون
                      </p>
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        • تعديل السعر سيؤثر على حسابات FIFO للحركات اللاحقة
                      </p>
                    </>
                  ) : editingMovement.type === 'out' ? (
                    <>
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        • هذه حركة <strong>خصم</strong> - تعديل الكمية سيؤثر على المخزون الحالي
                      </p>
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        • زيادة الكمية = تقليل المخزون أكثر | تقليل الكمية = زيادة المخزون
                      </p>
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        • السعر محسوب تلقائياً بطريقة FIFO من أقدم الدفعات
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        • هذه حركة <strong>تعديل</strong> - تعديل الكمية سيضبط المخزون للقيمة الجديدة
                      </p>
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        • الكمية الجديدة ستحل محل المخزون الحالي في هذه النقطة الزمنية
                      </p>
                    </>
                  )}
                </div>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 rounded">
                  {error}
                </div>
              )}

              <form onSubmit={handleEditMovementSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      الكمية <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={editMovementForm.quantity}
                      onChange={(e) => setEditMovementForm({ ...editMovementForm, quantity: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                      required
                    />
                  </div>

                  {editingMovement.type === 'in' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        السعر/الوحدة
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={editMovementForm.price}
                        onChange={(e) => setEditMovementForm({ ...editMovementForm, price: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      السبب <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={editMovementForm.reason}
                      onChange={(e) => setEditMovementForm({ ...editMovementForm, reason: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      التاريخ والوقت
                    </label>
                    <input
                      type="datetime-local"
                      value={editMovementForm.date}
                      onChange={(e) => setEditMovementForm({ ...editMovementForm, date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                    />
                  </div>
                </div>

                <div className="flex gap-3 justify-end mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditMovementModal(false);
                      setError('');
                    }}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
                    disabled={loading}
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                    disabled={loading}
                  >
                    {loading ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;


