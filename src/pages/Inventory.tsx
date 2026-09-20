import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Package, Plus, AlertTriangle, Edit, Trash2, History, Minus, ChevronDown, ChevronUp, Edit2, ArrowLeftFromLine, ArrowRightFromLine } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { InventoryItem, MenuItem, WarehouseItem } from '../services/api';
type IngredientItem = string | { _id?: string; id?: string };
type Ingredient = { item: IngredientItem; quantity: number; unit: string; };
import { api } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { formatCurrency, formatDecimal, formatQuantity } from '../utils/formatters';
import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from '../utils/apiBase';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../context/LanguageContext';
import { useOrganization } from '../context/OrganizationContext';
import { toast } from 'react-toastify';
import { DatePicker, ConfigProvider } from 'antd';
import arEG from 'antd/locale/ar_EG';
import enUS_antd from 'antd/locale/en_US';
import frFR from 'antd/locale/fr_FR';
import dayjs from 'dayjs';
import 'dayjs/locale/ar';
import 'dayjs/locale/en';
import 'dayjs/locale/fr';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import PermissionGuard from '../components/PermissionGuard';
import {
  UNIT_CANONICAL, UNIT_LABEL_KEYS, CATEGORY_CANONICAL, CATEGORY_LABEL_KEYS,
  toCanonicalUnit, toCanonicalCategory, toCanonicalReason, isOrderLinkedReason,
  TRANSFER_REASON_AR, RETURN_REASON_AR,
} from '../utils/canonicalInventory';

// Configure dayjs
dayjs.extend(customParseFormat);

// Helper function to get current date/time in organization timezone
// Returns format: YYYY-MM-DDTHH:mm for datetime-local input
const getCairoDateTime = (timezone?: string) => {
  const now = new Date();
  const tz = timezone || 'Africa/Cairo';
  // Convert to organization timezone
  const orgTime = new Date(now.toLocaleString('en-US', { timeZone: tz }));
  // Format as YYYY-MM-DDTHH:mm for datetime-local input
  const year = orgTime.getFullYear();
  const month = String(orgTime.getMonth() + 1).padStart(2, '0');
  const day = String(orgTime.getDate()).padStart(2, '0');
  const hours = String(orgTime.getHours()).padStart(2, '0');
  const minutes = String(orgTime.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const Inventory = () => {
  const { t, i18n } = useTranslation();
  const { isRTL } = useLanguage();
  const { timezone, formatDate: formatOrgDate } = useOrganization();
  const {
    inventoryItems,
    fetchInventoryItems,
    updateStock,
    createInventoryItem,
    updateInventoryItem,
    warehouseItems,
    fetchWarehouseItems,
    transferToInventory,
    returnToWarehouse,
    createWarehouseItem,
    user,
  } = useApp();

  // Helper function to check permissions
  const hasPermission = (permission: string) => {
    if (!user) return false;
    return user.permissions.includes('all') || 
           user.permissions.includes('inventory') || 
           user.permissions.includes(permission);
  };

  // Get Ant Design locale based on current language
  const getAntdLocale = () => {
    switch (i18n.language) {
      case 'ar': return arEG;
      case 'fr': return frFR;
      default: return enUS_antd;
    }
  };

  // Set dayjs locale based on current language
  useEffect(() => {
    dayjs.locale(i18n.language);
  }, [i18n.language]);

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
  const [deductCustomReason, setDeductCustomReason] = useState(false);
  const [deductForm, setDeductForm] = useState({
    quantity: '',
    reason: '',
    type: 'out' as 'out' | 'adjustment',
    date: getCairoDateTime(timezone),
  });

  // Warehouse transfer/return states
  const [showTransferFromWarehouseModal, setShowTransferFromWarehouseModal] = useState(false);
  const [showReturnToWarehouseModal, setShowReturnToWarehouseModal] = useState(false);
  const [transferForm, setTransferForm] = useState({
    warehouseItemId: '',
    quantity: '',
    price: '',
    date: getCairoDateTime(timezone),
    reason: '',
  });
  const [returnForm, setReturnForm] = useState({
    warehouseItemId: '',
    quantity: '',
    price: '',
    date: getCairoDateTime(timezone),
    reason: '',
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

  // Display pagination (client-side slice; full list stays in context for other screens)
  const [invPage, setInvPage] = useState(1);
  const INV_PAGE_SIZE = 50;
  useEffect(() => { setInvPage(1); }, [searchTerm, filterCategory, filterType, filterStock, dateFilterType, filterDateFrom, filterDateTo, filterMonth, filterYear]);

  // Edit movement states
  const [showEditMovementModal, setShowEditMovementModal] = useState(false);
  const [showDeleteMovementModal, setShowDeleteMovementModal] = useState(false);
  const [deletingMovementId, setDeletingMovementId] = useState<string | null>(null);
  const [editingMovement, setEditingMovement] = useState<any>(null);
  const [editMovementForm, setEditMovementForm] = useState({
    quantity: '',
    price: '',
    reason: '',
    date: '',
  });

  // Add/Edit form state
  const [addForm, setAddForm] = useState<any>({
    productId: '',
    quantity: '',
    date: '',
    name: '',
    category: '',
    price: '',
    supplier: '',
    minStock: '',
    unit: '',
    isRawMaterial: false,
    warehouseItem: '',
    barcode: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertType, setAlertType] = useState<'success' | 'error'>('success');
  const [menuCategories, setMenuCategories] = useState<Array<{ id: string; name: string }>>([]);

  // الفئات الافتراضية + الفئات من المنيو (القيمة معيارية، والتسمية مترجمة)
  const categoryOptions = useMemo(() => {
    const defaults = CATEGORY_CANONICAL.map((ar, i) => ({ value: ar, label: t(CATEGORY_LABEL_KEYS[i]) }));
    const menuCats = menuCategories.map(cat => ({ value: cat.name, label: cat.name }));
    const merged = [...defaults, ...menuCats.filter(m => !defaults.some(d => d.value === m.value))];
    return merged.sort((a, b) => a.label.localeCompare(b.label, i18n.language));
  }, [menuCategories, t, i18n.language]);

  const costStatusOptions = useMemo(() => [
    { value: 'pending', label: t('inventory.addModal.pending') },
    { value: 'paid', label: t('inventory.addModal.paid') },
    { value: 'partially_paid', label: t('inventory.addModal.partiallyPaid') },
    { value: 'overdue', label: t('inventory.addModal.overdue') },
  ], [t]);

  // Socket.IO reference
  const socketRef = useRef<Socket | null>(null);

  // جلب بيانات المخزون والفئات عند تحميل الصفحة
  useEffect(() => {
    fetchInventoryItems();
    fetchWarehouseItems();
    fetchMenuCategories();
    // eslint-disable-next-line
  }, []);

  // Socket.IO connection for real-time updates (single connection, refs avoid reconnect storms)
  const modalStateRef = useRef({ show: showMovementsModal, item: selectedItem });
  modalStateRef.current = { show: showMovementsModal, item: selectedItem };
  useEffect(() => {
    // Initialize Socket.IO connection
    const apiUrl = API_BASE_URL;
    const socketUrl = apiUrl.replace(/\/api\/?$/, '');
    
    const socket = io(socketUrl, {
        auth: { token: localStorage.getItem('token') || undefined },
      path: '/socket.io/',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: Infinity,
      reconnectionDelayMax: 10000,
    });

    socketRef.current = socket;

    // Listen for inventory updates
    socket.on('inventory-update', async () => {
      // Refresh inventory list
      await fetchInventoryItems();
      
      // If movements modal is open, refresh movements
      const { show, item } = modalStateRef.current;
      if (show && item) {
        await refreshStockMovements(item.id || item._id);
      }
    });

    // Connection event handlers
    socket.on('connect', () => {
    });

    socket.on('disconnect', () => {
    });

    return () => {
      socket.off('inventory-update');
      socket.off('connect');
      socket.off('disconnect');
      socket.disconnect();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
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
        setShowTransferFromWarehouseModal(false);
        setShowReturnToWarehouseModal(false);
        setShowEditMovementModal(false);
        setShowDeleteMovementModal(false);
        setDeletingMovementId(null);
        setError('');
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  // Helper function to translate category names
  const translateCategory = (category: string) => {
    const categoryMap: { [key: string]: string } = {
      'مشروبات ساخنة': t('inventory.categories.hotDrinks'),
      'مشروبات باردة': t('inventory.categories.coldDrinks'),
      'طعام': t('inventory.categories.food'),
      'حلويات': t('inventory.categories.desserts'),
      'مواد خام': t('inventory.categories.rawMaterials'),
      'أخرى': t('inventory.categories.other'),
      // English versions
      'Hot Drinks': t('inventory.categories.hotDrinks'),
      'Cold Drinks': t('inventory.categories.coldDrinks'),
      'Food': t('inventory.categories.food'),
      'Desserts': t('inventory.categories.desserts'),
      'Raw Materials': t('inventory.categories.rawMaterials'),
      'Other': t('inventory.categories.other'),
    };
    return categoryMap[category] || category;
  };

  // Helper function to translate unit names
  const translateUnit = (unit: string) => {
    const unitMap: { [key: string]: string } = {
      'قطعة': t('inventory.units.piece'),
      'كيلو': t('inventory.units.kilo'),
      'جرام': t('inventory.units.gram'),
      'لتر': t('inventory.units.liter'),
      'مل': t('inventory.units.ml'),
      'علبة': t('inventory.units.box'),
      'كيس': t('inventory.units.bag'),
      'زجاجة': t('inventory.units.bottle'),
      // English versions
      'piece': t('inventory.units.piece'),
      'kilo': t('inventory.units.kilo'),
      'gram': t('inventory.units.gram'),
      'liter': t('inventory.units.liter'),
      'ml': t('inventory.units.ml'),
      'box': t('inventory.units.box'),
      'bag': t('inventory.units.bag'),
      'bottle': t('inventory.units.bottle'),
    };
    return unitMap[unit] || unit;
  };

  // Helper function to translate reason names from database
  const translateReason = (reason: string) => {
    if (!reason) return '-';
    
    // Check if reason contains order/invoice reference - don't translate these
    if (reason.includes('طلب رقم') || reason.includes('فاتورة') || 
        reason.includes('Order #') || reason.includes('Invoice') ||
        reason.includes('Commande #') || reason.includes('Facture')) {
      return reason;
    }
    
    const reasonMap: { [key: string]: string } = {
      // Arabic - Deduct reasons
      'بيع': t('inventory.deductModal.reasons.sale'),
      'استهلاك في الإنتاج': t('inventory.deductModal.reasons.production'),
      'تالف': t('inventory.deductModal.reasons.damaged'),
      'منتهي الصلاحية': t('inventory.deductModal.reasons.expired'),
      'إرجاع للمورد': t('inventory.deductModal.reasons.returnToSupplier'),
      // Arabic - Adjustment reasons
      'جرد دوري': t('inventory.deductModal.reasons.periodicInventory'),
      'تصحيح خطأ': t('inventory.deductModal.reasons.errorCorrection'),
      'فقدان': t('inventory.deductModal.reasons.loss'),
      // English - Deduct reasons
      'Sale': t('inventory.deductModal.reasons.sale'),
      'Production Consumption': t('inventory.deductModal.reasons.production'),
      'Damaged': t('inventory.deductModal.reasons.damaged'),
      'Expired': t('inventory.deductModal.reasons.expired'),
      'Return to Supplier': t('inventory.deductModal.reasons.returnToSupplier'),
      // English - Adjustment reasons
      'Periodic Inventory': t('inventory.deductModal.reasons.periodicInventory'),
      'Error Correction': t('inventory.deductModal.reasons.errorCorrection'),
      'Loss': t('inventory.deductModal.reasons.loss'),
      // French - Deduct reasons
      'Vente': t('inventory.deductModal.reasons.sale'),
      'Consommation de production': t('inventory.deductModal.reasons.production'),
      'Endommagé': t('inventory.deductModal.reasons.damaged'),
      'Expiré': t('inventory.deductModal.reasons.expired'),
      'Retour au fournisseur': t('inventory.deductModal.reasons.returnToSupplier'),
      // French - Adjustment reasons
      'Inventaire périodique': t('inventory.deductModal.reasons.periodicInventory'),
      'Correction d\'erreur': t('inventory.deductModal.reasons.errorCorrection'),
      'Perte': t('inventory.deductModal.reasons.loss'),
      // Add stock reasons
      'شراء مخزون جديد': t('inventory.addModal.reason'),
      'المخزون الأولي': t('inventory.addModal.initialStock'),
      'New stock purchase': t('inventory.addModal.reason'),
      'Initial stock': t('inventory.addModal.initialStock'),
      'Achat de nouveau stock': t('inventory.addModal.reason'),
      'Stock initial': t('inventory.addModal.initialStock'),
      // Warehouse transfer reasons (always stored as Arabic in DB)
      'تحويل من المخزن الرئيسي': t('inventory.transferModal.title'),
      'نقل إلى المخزون الحالي': t('inventory.transferModal.title'),
      'إرجاع إلى المخزن الرئيسي': t('inventory.returnModal.title'),
      'إرجاع من المخزون الحالي': t('inventory.returnModal.title'),
      'Transfer from Main Warehouse': t('inventory.transferModal.title'),
      'Return to Main Warehouse': t('inventory.returnModal.title'),
      'Transfert depuis l\'Entrepôt Principal': t('inventory.transferModal.title'),
      'Retour à l\'Entrepôt Principal': t('inventory.returnModal.title'),
    };
    
    return reasonMap[reason] || reason;
  };

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
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const nameMatch = item.name.toLowerCase().includes(term);
        const barcodeMatch = item.barcode && item.barcode.toLowerCase().includes(term);
        if (!nameMatch && !barcodeMatch) {
          return false;
        }
      }
      
      // Category filter (canonical compare so old translated rows still match)
      if (filterCategory && toCanonicalCategory(item.category) !== toCanonicalCategory(filterCategory)) {
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

      // Date filter on creation date
      const created = (item as any).createdAt ? new Date((item as any).createdAt) : null;
      if (dateFilterType === 'range') {
        if (filterDateFrom && (!created || created < new Date(filterDateFrom + 'T00:00:00'))) {
          return false;
        }
        if (filterDateTo && (!created || created > new Date(filterDateTo + 'T23:59:59'))) {
          return false;
        }
      } else if (dateFilterType === 'month' && filterMonth) {
        if (!created) return false;
        const ym = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}`;
        if (ym !== filterMonth) return false;
      } else if (dateFilterType === 'year' && filterYear) {
        if (!created) return false;
        if (String(created.getFullYear()) !== filterYear) return false;
      }
      
      return true;
    });
  }, [inventoryItems, searchTerm, filterCategory, filterType, filterStock, dateFilterType, filterDateFrom, filterDateTo, filterMonth, filterYear]);

  const pagedItems = useMemo(() =>
    filteredItems.slice((invPage - 1) * INV_PAGE_SIZE, invPage * INV_PAGE_SIZE),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filteredItems, invPage]
  );
  const invTotalPages = Math.max(1, Math.ceil(filteredItems.length / INV_PAGE_SIZE));

  const getStockStatus = (current: number, min: number) => {
    if (current <= min) return { status: 'low', color: 'text-red-600', bgColor: 'bg-red-50' };
    if (current <= min * 1.5) return { status: 'medium', color: 'text-yellow-600', bgColor: 'bg-yellow-50' };
    return { status: 'good', color: 'text-green-600', bgColor: 'bg-green-50' };
  };

  // فتح نافذة إضافة مخزون
  const openAddModal = () => {
    setAddForm({
      name: '',
      category: '',
      price: '',
      supplier: '',
      minStock: '',
      unit: '',
      isRawMaterial: false,
      warehouseItem: '',
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
      category: toCanonicalCategory(item.category),
      quantity: '',
      price: String(item.price),
      supplier: item.supplier || '',
      minStock: String(item.minStock || ''),
      unit: toCanonicalUnit(item.unit || ''),
      date: getCairoDateTime(timezone),
      costStatus: 'pending',
      paidAmount: '',
      isRawMaterial: item.isRawMaterial || false,
      warehouseItem: item.warehouseItem || '',
      barcode: item.barcode || '',
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
    setError('');
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
      toast.error(t('inventory.notifications.movementsLoadError'));
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
    setDeductCustomReason(false);
    setDeductForm({
      quantity: '',
      reason: '',
      type: 'out',
      date: getCairoDateTime(timezone),
    });
    setError('');
    setShowDeductModal(true);
  };

  // خصم الكمية
  const handleDeductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;
    if (!hasPermission(deductForm.type === 'out' ? 'canRemoveStock' : 'canAdjustStock')) {
      setError(t('common.permissionDenied'));
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const quantity = Number(deductForm.quantity);
      
      // 'out' يتطلب كمية موجبة، أما 'adjustment' فيسمح بالصفر (تصفير الرصيد)
      if (deductForm.quantity === '' || isNaN(quantity) || quantity < 0 || (deductForm.type === 'out' && quantity <= 0)) {
        setError(t('inventory.messages.enterValidQuantity'));
        setLoading(false);
        return;
      }

      if (deductForm.type === 'out' && quantity > selectedItem.currentStock) {
        setError(t('inventory.messages.quantityExceedsStock', { 
          stock: selectedItem.currentStock, 
          unit: selectedItem.unit 
        }));
        setLoading(false);
        return;
      }

      if (!deductForm.reason) {
        setError(t('inventory.messages.enterReason'));
        setLoading(false);
        return;
      }

      const res = await updateStock(selectedItem.id || selectedItem._id, {
        type: deductForm.type,
        quantity,
        reason: toCanonicalReason(deductForm.reason),
        date: deductForm.date,
      });

      if (res) {
        toast.success(
          deductForm.type === 'adjustment' 
            ? t('inventory.notifications.stockAdjusted')
            : t('inventory.notifications.stockDeducted')
        );
        
        // Refresh inventory list
        await fetchInventoryItems();
        
        // Close modal
        setShowDeductModal(false);
        
        // Reset form
        setDeductCustomReason(false);
        setDeductForm({
          quantity: '',
          reason: '',
          type: 'out',
          date: getCairoDateTime(timezone),
        });
        setError('');
      } else {
        setError(t('inventory.notifications.stockUpdateError'));
      }
    } catch (err) {
      const error = err as Error;
      setError(error.message || t('inventory.notifications.stockUpdateError'));
    } finally {
      setLoading(false);
    }
  };

  // فتح نافذة تحويل من المخزن الرئيسي
  const openTransferFromWarehouseModal = (item: InventoryItem) => {
    setSelectedItem(item);
    setError('');
    const hasLink = !!(item.warehouseItem);
    if (hasLink) {
      const warehouseId = typeof item.warehouseItem === 'string' ? item.warehouseItem : '';
      setTransferForm({
        warehouseItemId: warehouseId,
        quantity: '',
        price: '',
        date: getCairoDateTime(timezone),
        reason: TRANSFER_REASON_AR,
      });
    } else {
      setTransferForm({
        warehouseItemId: '',
        quantity: '',
        price: '',
        date: getCairoDateTime(timezone),
        reason: TRANSFER_REASON_AR,
      });
    }
    fetchWarehouseItems();
    setShowTransferFromWarehouseModal(true);
  };

  // تأكيد التحويل من المخزن الرئيسي
  const handleTransferFromWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;
    if (!hasPermission('canTransferToInventory')) {
      setError(t('common.permissionDenied'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      const quantity = Number(transferForm.quantity);
      if (!quantity || quantity <= 0) {
        setError(t('inventory.messages.enterValidQuantity'));
        setLoading(false);
        return;
      }
      if (!transferForm.warehouseItemId) {
        setError(t('inventory.messages.notLinkedToWarehouse'));
        setLoading(false);
        return;
      }
      const wItem = warehouseItems.find(w => String(w.id || w._id) === String(transferForm.warehouseItemId));
      if (wItem && quantity > Number(wItem.currentStock)) {
        setError(t('inventory.messages.quantityExceedsStock', {
          stock: wItem.currentStock,
          unit: translateUnit(wItem.unit),
        }));
        setLoading(false);
        return;
      }
      const res = await transferToInventory({
        warehouseItemId: transferForm.warehouseItemId,
        inventoryItemId: selectedItem.id || selectedItem._id,
        quantity,
        price: transferForm.price ? Number(transferForm.price) : undefined,
        date: transferForm.date,
        reason: toCanonicalReason(transferForm.reason) || TRANSFER_REASON_AR,
      });
      if (res) {
        setShowTransferFromWarehouseModal(false);
        setTransferForm({ warehouseItemId: '', quantity: '', price: '', date: getCairoDateTime(timezone), reason: '' });
        setError('');
      } else {
        setError(t('inventory.messages.transferFailed'));
      }
    } catch (err) {
      const error = err as Error;
      setError(error.message || t('inventory.messages.transferFailed'));
    } finally {
      setLoading(false);
    }
  };

  // فتح نافذة إرجاع للمخزن الرئيسي
  const openReturnToWarehouseModal = (item: InventoryItem) => {
    setSelectedItem(item);
    setError('');
    const warehouseId = typeof item.warehouseItem === 'string' ? item.warehouseItem : '';
    setReturnForm({
      warehouseItemId: warehouseId,
      quantity: '',
      price: '',
      date: getCairoDateTime(timezone),
      reason: RETURN_REASON_AR,
    });
    fetchWarehouseItems();
    setShowReturnToWarehouseModal(true);
  };

  // إنشاء عنصر في المخزن الرئيسي من عنصر المخزون غير المرتبط
  const handleCreateWarehouseFromInventory = async () => {
    if (!selectedItem) return;
    if (!hasPermission('canAddWarehouseItem')) {
      setError(t('common.permissionDenied'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await createWarehouseItem({
        name: selectedItem.name,
        category: toCanonicalCategory(selectedItem.category),
        unit: toCanonicalUnit(selectedItem.unit),
        minStock: selectedItem.minStock || 0,
        price: selectedItem.price,
        supplier: selectedItem.supplier || '',
        isRawMaterial: selectedItem.isRawMaterial || false,
        currentStock: 0,
      });
      if (res && (res.id || res._id)) {
        const warehouseId = res.id || res._id;
        await updateInventoryItem(selectedItem.id || selectedItem._id, {
          warehouseItem: warehouseId,
        });
        setShowTransferFromWarehouseModal(false);
        setShowReturnToWarehouseModal(false);
        await fetchInventoryItems();
        await fetchWarehouseItems();
        toast.success(t('inventory.messages.warehouseItemCreated'));
        setSelectedItem(null);
        setLoading(false);
      } else {
        setError(t('inventory.messages.warehouseItemCreateError'));
        setLoading(false);
      }
    } catch (err) {
      const error = err as Error;
      setError(error.message || t('inventory.messages.warehouseItemCreateError'));
      setLoading(false);
    }
  };

  // تأكيد الإرجاع للمخزن الرئيسي
  const handleReturnToWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;
    if (!hasPermission('canReturnToWarehouse')) {
      setError(t('common.permissionDenied'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      const quantity = Number(returnForm.quantity);
      if (!quantity || quantity <= 0) {
        setError(t('inventory.messages.enterValidQuantity'));
        setLoading(false);
        return;
      }
      if (quantity > selectedItem.currentStock) {
        setError(t('inventory.messages.quantityExceedsStock', { stock: selectedItem.currentStock, unit: selectedItem.unit }));
        setLoading(false);
        return;
      }
      if (!returnForm.warehouseItemId) {
        setError(t('inventory.messages.notLinkedToWarehouse'));
        setLoading(false);
        return;
      }
      const res = await returnToWarehouse({
        inventoryItemId: selectedItem.id || selectedItem._id,
        warehouseItemId: returnForm.warehouseItemId,
        quantity,
        price: returnForm.price ? Number(returnForm.price) : undefined,
        date: returnForm.date,
        reason: toCanonicalReason(returnForm.reason) || RETURN_REASON_AR,
      });
      if (res) {
        setShowReturnToWarehouseModal(false);
        setReturnForm({ warehouseItemId: '', quantity: '', price: '', date: getCairoDateTime(timezone), reason: '' });
        setError('');
      } else {
        setError(t('inventory.messages.returnFailed'));
      }
    } catch (err) {
      const error = err as Error;
      setError(error.message || t('inventory.messages.returnFailed'));
    } finally {
      setLoading(false);
    }
  };

  // فتح نافذة تعديل الحركة
  const openEditMovementModal = (movement: any) => {
    setEditingMovement(movement);
    
    // Convert movement timestamp to Cairo timezone
    let orgDateTime = '';
    if (movement.timestamp) {
      const movementDate = new Date(movement.timestamp);
      const orgTime = new Date(movementDate.toLocaleString('en-US', { timeZone: timezone }));
      const year = orgTime.getFullYear();
      const month = String(orgTime.getMonth() + 1).padStart(2, '0');
      const day = String(orgTime.getDate()).padStart(2, '0');
      const hours = String(orgTime.getHours()).padStart(2, '0');
      const minutes = String(orgTime.getMinutes()).padStart(2, '0');
      orgDateTime = `${year}-${month}-${day}T${hours}:${minutes}`;
    }
    
    setEditMovementForm({
      quantity: movement.quantity.toString(),
      price: movement.price ? movement.price.toString() : '',
      reason: movement.reason || '',
      date: orgDateTime || getCairoDateTime(timezone),
    });
    setShowEditMovementModal(true);
  };

  // تعديل الحركة
  const handleEditMovementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || !editingMovement) return;
    if (!hasPermission('canEditStockMovement')) {
      setError(t('common.permissionDenied'));
      return;
    }

    setLoading(true);
    setError('');

    try {
      const quantity = Number(editMovementForm.quantity);
      const price = editMovementForm.price ? Number(editMovementForm.price) : undefined;

      if (!quantity || quantity <= 0) {
        setError(t('inventory.messages.enterValidQuantity'));
        setLoading(false);
        return;
      }

      if (!editMovementForm.reason) {
        setError(t('inventory.messages.enterReason'));
        setLoading(false);
        return;
      }

      const response = await api.put(
        `/inventory/${selectedItem.id || selectedItem._id}/movements/${editingMovement._id}`,
        {
          quantity,
          price,
          reason: toCanonicalReason(editMovementForm.reason),
          date: editMovementForm.date,
        }
      );

      // Check for success - handle both response.data.success and response.success
      const isSuccess = response?.data?.success || response?.success;
      
      if (isSuccess) {
        toast.success(t('inventory.notifications.movementUpdated'));
        
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
        setError(t('inventory.notifications.movementUpdateError'));
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || t('inventory.notifications.movementUpdateError');
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // حذف الحركة
  const handleDeleteMovement = async (movementId: string) => {
    if (!selectedItem) return;
    
    // Open delete confirmation modal
    setDeletingMovementId(movementId);
    setShowDeleteMovementModal(true);
  };

  // تأكيد حذف الحركة
  const confirmDeleteMovement = async () => {
    if (!selectedItem || !deletingMovementId) return;
    if (!hasPermission('canDeleteStockMovement')) {
      toast.error(t('common.permissionDenied'));
      return;
    }

    setLoading(true);

    try {
      const response = await api.delete(
        `/inventory/${selectedItem.id || selectedItem._id}/movements/${deletingMovementId}`
      );

      // Check for success
      const isSuccess = response?.data?.success || response?.success;
      
      if (isSuccess) {
        toast.success(t('inventory.notifications.movementDeleted'));
        
        // Close modal
        setShowDeleteMovementModal(false);
        setDeletingMovementId(null);
        
        // Refresh movements and inventory in parallel (in background)
        Promise.all([
          refreshStockMovements(selectedItem.id || selectedItem._id),
          fetchInventoryItems()
        ]).catch(err => {
          console.error('Error refreshing data:', err);
        });
      } else {
        toast.error(t('inventory.notifications.movementDeleteError'));
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || t('inventory.notifications.movementDeleteError');
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // تغيير الحقول
  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setAddForm(prev => ({ ...prev, [name]: value }));
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
    if (!hasPermission('canAddInventoryItem')) {
      setError(t('common.permissionDenied'));
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      if (!addForm.name || !addForm.category || !addForm.unit || !addForm.minStock) {
        setError(t('inventory.messages.enterAllFields'));
        setLoading(false);
        return;
      }
      const res = await createInventoryItem({
        name: addForm.name,
        category: toCanonicalCategory(addForm.category),
        currentStock: 0,
        minStock: Number(addForm.minStock),
        unit: toCanonicalUnit(addForm.unit),
        price: addForm.price ? Number(addForm.price) : 0,
        supplier: addForm.supplier,
        barcode: addForm.barcode || undefined,
        isRawMaterial: addForm.isRawMaterial,
        warehouseItem: addForm.warehouseItem || undefined,
      });
      if (res) {
        setSuccess(t('inventory.notifications.productAdded'));
        toast.success(t('inventory.notifications.productAdded'));

        await fetchInventoryItems();

        setShowAddModal(false);

        setAddForm({
          name: '',
          category: '',
          price: '',
          supplier: '',
          minStock: '',
          unit: '',
          isRawMaterial: false,
          warehouseItem: '',
          barcode: '',
        });
        setError('');
        setSuccess('');
      } else {
        setError(t('inventory.notifications.productAddError'));
      }
    } catch (err) {
      const error = err as Error;
      if (error?.message?.includes('موجود بالفعل') || error?.message?.includes('already exists') || error?.message?.includes('existe déjà')) {
        setError(error.message);
      } else {
        setError(t('inventory.notifications.stockUpdateError'));
      }
    }
    setLoading(false);
  };

  // تعديل منتج
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasPermission('canEditInventoryItem')) {
      setError(t('common.permissionDenied'));
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      if (!selectedItem) {
        const msg = t('inventory.messages.noProductSelected');
        setError(msg);
        showAlertMessage(msg, 'error');
        setLoading(false);
        return;
      }
      if (!addForm.name || !addForm.category || !addForm.price || !addForm.unit || !addForm.minStock) {
        const errorMsg = t('inventory.messages.enterAllFields');
        setError(errorMsg);
        showAlertMessage(errorMsg, 'error');
        setLoading(false);
        return;
      }
      const res = await updateInventoryItem(selectedItem.id || selectedItem._id, {
        name: addForm.name,
        category: toCanonicalCategory(addForm.category),
        price: Number(addForm.price),
        minStock: Number(addForm.minStock),
        unit: toCanonicalUnit(addForm.unit),
        supplier: addForm.supplier,
        barcode: addForm.barcode || null,
        isRawMaterial: addForm.isRawMaterial,
        warehouseItem: addForm.warehouseItem || null,
      });
      if (res) {
        setSuccess(t('inventory.notifications.productUpdated'));
        toast.success(t('inventory.notifications.productUpdated'));
        
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
          date: getCairoDateTime(timezone),
          costStatus: 'pending',
          paidAmount: '',
          isRawMaterial: false,
          warehouseItem: '',
        });
        setError('');
        setSuccess('');
      } else {
        setError(t('inventory.notifications.productUpdateError'));
      }
    } catch (err) {
      const error = err as Error;
      if (error?.message?.includes('موجود بالفعل') || error?.message?.includes('already exists') || error?.message?.includes('existe déjà')) {
        setError(error.message);
      } else {
        setError(t('inventory.notifications.stockUpdateError'));
      }
    } finally {
      setLoading(false);
    }
  };

  // التحقق مما إذا كان المنتج مستخدماً في قائمة الطعام (فشل مغلق: عند الخطأ نمنع الحذف)
  const isItemUsedInMenu = async (itemId: string): Promise<{isUsed: boolean; menuItems?: Array<{name: string}>, itemName: string}> => {
    try {
      // جلب جميع عناصر القائمة مع تفاصيل المكونات
      const response = await api.getMenuItems({
        limit: 5000 // حد أعلى لتغطية القوائم الكبيرة
      });

      if (response.success && response.data) {
        // البحث في كل عنصر في القائمة
        const itemName = inventoryItems.find(item => String(item.id || item._id) === String(itemId))?.name || t('inventory.messages.thisProduct');
        const menuItems = response.data.filter((menuItem: MenuItem) => {
          // التحقق من وجود مكونات للعنصر
          if (!menuItem.ingredients || !Array.isArray(menuItem.ingredients)) {
            return false;
          }
          // البحث عن المكون في قائمة المكونات (يقارن نصياً ليشمل _id و id)
          return menuItem.ingredients.some((ing: Ingredient) => {
            const raw = typeof ing.item === 'string'
              ? ing.item
              : ((ing.item as { _id?: string; id?: string })?._id || (ing.item as { _id?: string; id?: string })?.id);
            return raw != null && String(raw) === String(itemId);
          });
        });

        const isUsed = menuItems.length > 0;
        return {
          isUsed,
          menuItems: menuItems.map((item: MenuItem) => ({ name: item.name })),
          itemName
        };
      }
      const fallback = t('inventory.messages.thisProduct');
      // فشل مغلق: تعذر التحقق → نمنع الحذف
      return { isUsed: true, itemName: fallback };
    } catch (err) {
      const fallback = t('inventory.messages.thisProduct');
      // فشل مغلق: أي خطأ شبكة → نمنع الحذف بدل المخاطرة
      return { isUsed: true, itemName: fallback };
    }
  };

  // حذف منتج
  const handleDelete = async () => {
    if (!deleteTarget) return;
    if (!hasPermission('canDeleteInventoryItem')) {
      const denyMsg = t('common.permissionDenied');
      setError(denyMsg);
      showAlertMessage(denyMsg, 'error');
      return;
    }

    // التحقق مما إذا كان المنتج مستخدماً في قائمة الطعام
    const { isUsed, menuItems, itemName } = await isItemUsedInMenu(deleteTarget.id || deleteTarget._id);
    if (isUsed) {
      if (menuItems && menuItems.length > 0) {
        const menuItemsList = menuItems.map(item => `- ${item.name}`).join('\n');
        const errorMsg = t('inventory.messages.cannotDeleteInUse', { name: itemName, list: menuItemsList });

        setError(errorMsg);
        showAlertMessage(t('inventory.messages.cannotDeleteSummary', { name: itemName, count: menuItems.length }), 'error');
      } else {
        // تعذر التحقق من الارتباط — نمنع الحذف احترازياً
        const errorMsg = t('inventory.messages.cannotDeleteUnknown', { name: itemName });
        setError(errorMsg);
        showAlertMessage(errorMsg, 'error');
      }
      setLoading(false);
      setShowDeleteModal(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await deleteInventoryItemApi(deleteTarget.id || deleteTarget._id);
      if (res) {
        toast.success(t('inventory.notifications.productDeleted'));
        showAlertMessage(t('inventory.notifications.productDeleted'), 'success');
        await fetchInventoryItems();
        setShowDeleteModal(false);
        setDeleteTarget(null);
      } else {
        const errorMsg = t('inventory.notifications.productDeleteError');
        setError(errorMsg);
        showAlertMessage(errorMsg, 'error');
      }
    } catch (err) {
      const errMsg = (err as Error)?.message || t('inventory.notifications.productDeleteError');
      setError(errMsg);
      showAlertMessage(errMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  // أضف دالة حذف المنتج من المخزون (تُظهر سبب السيرفر بدل إخفائه)
  const deleteInventoryItemApi = async (id: string) => {
    if (typeof api.deleteInventoryItem === 'function') {
      const response = await api.deleteInventoryItem(id);
      if (response && response.success === false) {
        throw new Error((response as any).message || t('inventory.notifications.productDeleteError'));
      }
      return response.success;
    }
    return false;
  };

  const navigate = useNavigate();

  return (
    <ConfigProvider
      direction={i18n.language === 'ar' ? 'rtl' : 'ltr'}
      locale={getAntdLocale()}
    >
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center flex-wrap gap-x-2 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center">
            <Package className={`h-5 w-5 sm:h-6 sm:w-6 text-orange-600 dark:text-orange-400 ${isRTL ? 'ml-2' : 'mr-2'}`} />
            {t('inventory.title')}
          </h1>
          <p className={`text-sm sm:text-base text-gray-600 dark:text-gray-300 ${isRTL ? 'mr-2 sm:mr-4' : 'ml-2 sm:ml-4'}`}>{t('inventory.subtitle')}</p>
        </div>
        <PermissionGuard requiredPermissions={['canAddInventoryItem', 'canAddStock', 'all']}>
          <button
            onClick={openAddModal}
            className="bg-orange-600 hover:bg-orange-700 dark:bg-orange-500 dark:hover:bg-orange-600 text-white px-4 py-2 rounded-lg flex items-center transition-colors duration-200 w-full sm:w-auto justify-center"
          >
            <Plus className={`h-5 w-5 ${isRTL ? 'ml-2' : 'mr-2'}`} />
            {t('inventory.addStock')}
          </button>
        </PermissionGuard>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
              <Package className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="mr-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">{t('inventory.stats.totalProducts')}</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{formatDecimal(inventoryItems.length, i18n.language)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-red-100 dark:bg-red-900 rounded-lg flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <div className="mr-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">{t('inventory.stats.lowStock')}</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{formatDecimal(lowStockItems.length, i18n.language)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
              <Package className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div className="mr-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">{t('inventory.stats.inventoryValue')}</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{formatCurrency(totalValue, i18n.language)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center">
              <Package className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="mr-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">{t('inventory.stats.categories')}</p>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{formatDecimal(categoriesCount, i18n.language)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900 rounded-lg flex items-center justify-center">
              <Package className="h-6 w-6 text-orange-600 dark:text-orange-400" />
            </div>
            <div className="mr-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">{t('inventory.stats.rawMaterials')}</p>
              <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{formatDecimal(rawMaterialsCount, i18n.language)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Low Stock Alert */}
      {lowStockItems.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4">
          <div className="flex items-center mb-3">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 ml-2" />
            <h3 className="text-lg font-semibold text-red-800 dark:text-red-200">{t('inventory.alerts.lowStockTitle')}</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {lowStockItems.map(item => (
              <div key={item.id || item._id} className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-red-200 dark:border-red-600">
                <p className="font-medium text-gray-900 dark:text-gray-100">{item.name}</p>
                <p className="text-sm text-red-600 dark:text-red-400">
                  {t('inventory.alerts.remaining')}: {formatQuantity(item.currentStock, translateUnit(item.unit), i18n.language)} ({t('inventory.alerts.minimum')}: {formatQuantity(item.minStock, translateUnit(item.unit), i18n.language)})
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Inventory Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-600">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">{t('nav.inventory')}</h3>
          
          {/* Search and Filters */}
          <div className="space-y-3">
            {/* Basic Filters Section */}
            <div className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
              <button
                onClick={() => setShowBasicFilters(!showBasicFilters)}
                className="w-full bg-gray-50 dark:bg-gray-700 px-4 py-3 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
              >
                <span className="font-medium text-gray-900 dark:text-gray-100">{t('inventory.filters.basicFilters')}</span>
                {showBasicFilters ? (
                  <ChevronUp className="h-5 w-5 text-gray-600 dark:text-gray-300" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-gray-600 dark:text-gray-300" />
                )}
              </button>
              
              {showBasicFilters && (
                <div className="p-4 bg-white dark:bg-gray-800">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    {/* Search */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('inventory.filters.search')}
                      </label>
                      <input
                        type="text"
                        placeholder={t('inventory.filters.searchPlaceholder')}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-gray-100"
                      />
                    </div>

                    {/* Category Filter */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('inventory.filters.category')}
                      </label>
                      <select
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                        className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-gray-100"
                      >
                        <option value="">{t('inventory.filters.allCategories')}</option>
                        {categoryOptions.map(cat => (
                          <option key={cat.value} value={cat.value}>{cat.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* Type Filter */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('inventory.filters.type')}
                      </label>
                      <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                        className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-gray-100"
                      >
                        <option value="">{t('inventory.filters.all')}</option>
                        <option value="raw">{t('inventory.filters.rawOnly')}</option>
                        <option value="product">{t('inventory.filters.productsOnly')}</option>
                      </select>
                    </div>

                    {/* Stock Level Filter */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('inventory.filters.stockStatus')}
                      </label>
                      <select
                        value={filterStock}
                        onChange={(e) => setFilterStock(e.target.value)}
                        className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-gray-100"
                      >
                        <option value="">{t('inventory.filters.all')}</option>
                        <option value="low">{t('inventory.filters.lowOnly')}</option>
                        <option value="out">{t('inventory.filters.outOnly')}</option>
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
                <span className="font-medium text-gray-900 dark:text-gray-100">{t('inventory.filters.dateFilters')}</span>
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
                      {t('inventory.filters.filterType')}
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
                        {t('inventory.filters.range')}
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
                        {t('inventory.filters.specificMonth')}
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
                        {t('inventory.filters.specificYear')}
                      </button>
                    </div>
                  </div>

                  {/* Date Range Filters */}
                  {dateFilterType === 'range' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          {t('inventory.filters.fromDate')}
                        </label>
                        <DatePicker
                          value={filterDateFrom ? dayjs(filterDateFrom) : null}
                          onChange={(date) => setFilterDateFrom(date ? date.format('YYYY-MM-DD') : '')}
                          format="YYYY/MM/DD"
                          className="w-full"
                          size="large"
                          placeholder={t('inventory.filters.fromDate')}
                          disabledDate={(current) => current && current > dayjs().endOf('day')}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          {t('inventory.filters.toDate')}
                        </label>
                        <DatePicker
                          value={filterDateTo ? dayjs(filterDateTo) : null}
                          onChange={(date) => setFilterDateTo(date ? date.format('YYYY-MM-DD') : '')}
                          format="YYYY/MM/DD"
                          className="w-full"
                          size="large"
                          placeholder={t('inventory.filters.toDate')}
                          disabledDate={(current) => current && current > dayjs().endOf('day')}
                        />
                      </div>
                    </div>
                  )}

                  {/* Month Filter */}
                  {dateFilterType === 'month' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('inventory.filters.selectMonth')}
                      </label>
                      <DatePicker
                        picker="month"
                        value={filterMonth ? dayjs(filterMonth + '-01') : null}
                        onChange={(date) => setFilterMonth(date ? date.format('YYYY-MM') : '')}
                        format="MMMM YYYY"
                        className="w-full"
                        size="large"
                        placeholder={t('inventory.filters.selectMonth')}
                        disabledDate={(current) => current && current > dayjs().endOf('month')}
                      />
                    </div>
                  )}

                  {/* Year Filter */}
                  {dateFilterType === 'year' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('inventory.filters.selectYear')}
                      </label>
                      <DatePicker
                        picker="year"
                        value={filterYear ? dayjs(filterYear + '-01-01') : null}
                        onChange={(date) => setFilterYear(date ? date.format('YYYY') : '')}
                        format="YYYY"
                        className="w-full"
                        size="large"
                        placeholder={t('inventory.filters.selectYear')}
                        disabledDate={(current) => current && current > dayjs().endOf('year')}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Results count and reset button */}
            {(searchTerm || filterCategory || filterType || filterStock || filterDateFrom || filterDateTo || filterMonth || filterYear) && (
              <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-600 rounded-lg px-4 py-3">
                <span className="text-sm text-blue-800 dark:text-blue-200">
                  {t('inventory.filters.showing', { filtered: filteredItems.length, total: inventoryItems.length })}
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
                  {t('inventory.filters.resetAll')}
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-600">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className={`px-6 py-3 ${isRTL ? 'text-right' : 'text-left'} text-xs font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider`}>{t('inventory.table.product')}</th>
                <th className={`px-6 py-3 ${isRTL ? 'text-right' : 'text-left'} text-xs font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider`}>{t('inventory.table.type')}</th>
                <th className={`px-6 py-3 ${isRTL ? 'text-right' : 'text-left'} text-xs font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider`}>{t('inventory.table.category')}</th>
                <th className={`px-6 py-3 ${isRTL ? 'text-right' : 'text-left'} text-xs font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider`}>{t('inventory.table.currentStock')}</th>
                <th className={`px-6 py-3 ${isRTL ? 'text-right' : 'text-left'} text-xs font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider`}>{t('inventory.table.minStock')}</th>
                <th className={`px-6 py-3 ${isRTL ? 'text-right' : 'text-left'} text-xs font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider`}>{t('inventory.table.unit')}</th>
                <th className={`px-6 py-3 ${isRTL ? 'text-right' : 'text-left'} text-xs font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider`}>{t('inventory.barcode')}</th>
                <th className={`px-6 py-3 ${isRTL ? 'text-right' : 'text-left'} text-xs font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider`}>{t('inventory.table.lastPurchasePrice')}</th>
                <th className={`px-6 py-3 ${isRTL ? 'text-right' : 'text-left'} text-xs font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider`}>{t('inventory.table.totalValue')}</th>
                <th className={`px-6 py-3 ${isRTL ? 'text-right' : 'text-left'} text-xs font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider`}>{t('inventory.table.supplier')}</th>
                <th className={`px-6 py-3 ${isRTL ? 'text-right' : 'text-left'} text-xs font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider`}>{t('inventory.table.actions')}</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    <div className="flex flex-col items-center">
                      <Package className="h-12 w-12 text-gray-400 mb-4" />
                      <p className="text-lg font-medium text-gray-500 dark:text-gray-400">
                        {searchTerm || filterCategory || filterType || filterStock || filterDateFrom || filterDateTo || filterMonth || filterYear
                          ? t('inventory.table.noResults')
                          : t('inventory.table.noProducts')}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                pagedItems.map((item) => {
                const stockStatus = getStockStatus(item.currentStock, item.minStock);
                return (
                  <tr key={item.id || item._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className={`px-6 py-4 whitespace-nowrap ${isRTL ? 'text-right' : 'text-left'}`}>
                      <div className="font-semibold text-gray-900 dark:text-gray-100">{item.name}</div>
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap ${isRTL ? 'text-right' : 'text-left'}`}>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ring-1 ${
                        item.isRawMaterial
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 ring-blue-200 dark:ring-blue-800'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 ring-gray-200 dark:ring-gray-600'
                      }`}>
                        {item.isRawMaterial ? t('inventory.table.rawMaterial') : t('inventory.table.product')}
                      </span>
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 ${isRTL ? 'text-right' : 'text-left'}`}>{translateCategory(item.category)}</td>
                    <td className={`px-6 py-4 whitespace-nowrap ${isRTL ? 'text-right' : 'text-left'}`}>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ring-1 ${stockStatus.bgColor} ${stockStatus.color}`}>
                        {formatQuantity(item.currentStock, translateUnit(item.unit), i18n.language)}
                      </span>
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 ${isRTL ? 'text-right' : 'text-left'}`}>{formatQuantity(item.minStock, translateUnit(item.unit), i18n.language)}</td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 ${isRTL ? 'text-right' : 'text-left'}`}>{translateUnit(item.unit)}</td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900 dark:text-gray-100 ${isRTL ? 'text-right' : 'text-left'}`}>{item.barcode || <span className="text-gray-400">—</span>}</td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 ${isRTL ? 'text-right' : 'text-left'}`}>{formatCurrency(item.price, i18n.language)}</td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-gray-100 ${isRTL ? 'text-right' : 'text-left'}`}>
                      {formatCurrency(item.totalValue || (item.currentStock * item.price), i18n.language)}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 ${isRTL ? 'text-right' : 'text-left'}`}>{item.supplier || <span className="text-gray-400">—</span>}</td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${isRTL ? 'text-right' : 'text-left'}`}>
                      <div className="flex items-center gap-1">
                      <PermissionGuard requiredPermissions={['canTransferToInventory', 'all']}>
                        <button 
                          className="p-1.5 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors" 
                          onClick={() => openTransferFromWarehouseModal(item)}
                          title={t('inventory.transferModal.title')}
                        >
                          <ArrowRightFromLine className="h-4 w-4" />
                        </button>
                      </PermissionGuard>
                      <PermissionGuard requiredPermissions={['canReturnToWarehouse', 'all']}>
                        <button 
                          className="p-1.5 text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors" 
                          onClick={() => openReturnToWarehouseModal(item)}
                          title={t('inventory.returnModal.title')}
                        >
                          <ArrowLeftFromLine className="h-4 w-4" />
                        </button>
                      </PermissionGuard>
                      <PermissionGuard requiredPermissions={['canViewStockMovements', 'canViewInventory', 'all']}>
                        <button 
                          className="p-1.5 text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors" 
                          onClick={() => openMovementsModal(item)}
                          title={t('inventory.table.movementsHistory')}
                        >
                          <History className="h-4 w-4" />
                        </button>
                      </PermissionGuard>
                      <PermissionGuard requiredPermissions={['canAddStock', 'canRemoveStock', 'canAdjustStock', 'all']}>
                        <button 
                          className="p-1.5 text-orange-600 hover:text-orange-800 dark:text-orange-400 dark:hover:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg transition-colors" 
                          onClick={() => openDeductModal(item)}
                          title={t('inventory.table.deductQuantity')}
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                      </PermissionGuard>
                      <PermissionGuard requiredPermissions={['canEditInventoryItem', 'all']}>
                        <button 
                          className="p-1.5 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors" 
                          onClick={() => openEditModal(item)}
                          title={t('inventory.table.edit')}
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                      </PermissionGuard>
                      <PermissionGuard requiredPermissions={['canDeleteInventoryItem', 'all']}>
                        <button 
                          className="p-1.5 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" 
                          onClick={() => openDeleteModal(item)}
                          title={t('inventory.table.delete')}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </PermissionGuard>
                      </div>
                    </td>
                  </tr>
                );
              })
              )}
            </tbody>
          </table>
        </div>
        {invTotalPages > 1 && (
          <div className="flex items-center justify-between mt-4 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              <span>{t('inventory.pagination.page')} {formatDecimal(invPage, i18n.language)} {t('inventory.pagination.of')} {formatDecimal(invTotalPages, i18n.language)}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setInvPage(p => Math.max(1, p - 1))}
                disabled={invPage <= 1}
                className="px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {t('inventory.pagination.previous')}
              </button>
              <div className="flex items-center gap-1">
                {(() => {
                  let start = Math.max(1, Math.min(invPage - 2, invTotalPages - 4));
                  const end = Math.min(invTotalPages, start + 4);
                  start = Math.max(1, end - 4);
                  const pages: number[] = [];
                  for (let p = start; p <= end; p++) pages.push(p);
                  return pages.map(pageNum => (
                    <button
                      key={pageNum}
                      onClick={() => setInvPage(pageNum)}
                      className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                        invPage === pageNum
                          ? 'bg-orange-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      {formatDecimal(pageNum, i18n.language)}
                    </button>
                  ));
                })()}
              </div>
              <button
                onClick={() => setInvPage(p => Math.min(invTotalPages, p + 1))}
                disabled={invPage >= invTotalPages}
                className="px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {t('inventory.pagination.next')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal إضافة منتج جديد */}
      {showAddModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowAddModal(false);
            }
          }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-600 px-4 py-3 sm:px-6 sm:py-4 rounded-t-lg z-10">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t('inventory.addModal.title')}</h2>
                <button
                  className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 text-2xl font-bold transition-colors duration-200"
                  onClick={() => setShowAddModal(false)}
                >×</button>
              </div>
            </div>
            <div className="p-4 sm:p-6">
            <form onSubmit={handleAddSubmit} className="space-y-4">
              {/* رسالة مفيدة حول قاعدة التسمية */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-600 rounded-lg p-3 mb-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className={`${isRTL ? 'mr-3' : 'ml-3'}`}>
                    <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">{t('inventory.addModal.importantNote')}</h3>
                  <div className="mt-1 text-sm text-blue-700 dark:text-blue-300">
                    <p>{t('inventory.addModal.noteCannotDuplicate')}</p>
                    <p>{t('inventory.addModal.noteUseExisting')}</p>
                  </div>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('inventory.addModal.productName')}</label>
                  <input type="text" name="name" value={addForm.name} onChange={handleFormChange} className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-gray-100" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('inventory.addModal.category')}</label>
                  <select name="category" value={addForm.category} onChange={handleFormChange} className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-gray-100" required>
                    <option value="">{t('inventory.addModal.selectCategory')}</option>
                    {categoryOptions.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('inventory.addModal.unit')}</label>
                  <select name="unit" value={addForm.unit} onChange={handleFormChange} className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-gray-100" required>
                    <option value="">{t('inventory.addModal.selectUnit')}</option>
                    {UNIT_CANONICAL.map((ar, i) => (
                      <option key={ar} value={ar}>{t(UNIT_LABEL_KEYS[i])}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('inventory.addModal.minStock')}</label>
                  <input type="number" name="minStock" value={addForm.minStock} onChange={handleFormChange} className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-gray-100" required min="0" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('inventory.addModal.warehouseItem')}</label>
                  <select name="warehouseItem" value={addForm.warehouseItem} onChange={handleFormChange} className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-gray-100">
                    <option value="">-- {t('inventory.addModal.selectWarehouseItem')} --</option>
                    {warehouseItems.map(w => (
                      <option key={w.id || w._id} value={w.id || w._id}>{w.name} ({formatDecimal(w.currentStock, i18n.language)} {translateUnit(w.unit)})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('inventory.addModal.supplier')}</label>
                  <input type="text" name="supplier" value={addForm.supplier} onChange={handleFormChange} className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-gray-100" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('inventory.barcode')}</label>
                  <div className="flex gap-2">
                    <input type="text" name="barcode" value={addForm.barcode} onChange={handleFormChange} placeholder={t('inventory.barcodePlaceholder')} className="flex-1 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-gray-100 font-mono" />
                  </div>
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
                    <span className={`${isRTL ? 'mr-2' : 'ml-2'} text-sm text-gray-700 dark:text-gray-300`}>{t('inventory.addModal.isRawMaterial')}</span>
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('inventory.addModal.rawMaterialHint')}</p>
                </div>
              </div>
              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-600 rounded-lg p-3">
                  <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
                </div>
              )}
              {success !== '' && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-600 rounded-lg p-3">
                  <p className="text-sm text-green-800 dark:text-green-200">{success}</p>
                  <p className="text-xs text-green-700 dark:text-green-300 mt-1">{t('inventory.addModal.successMessage')}</p>
                  <button
                    type="button"
                    className="text-sm underline text-blue-700 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 mt-2"
                    onClick={() => navigate('/costs')}
                  >{t('inventory.addModal.viewCosts')}</button>
                </div>
              )}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-800 dark:text-gray-100 px-6 py-3 rounded-lg font-medium transition-colors duration-200"
                  disabled={loading}
                >
                  {t('inventory.addModal.cancel')}
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
                      {t('inventory.addModal.saving')}
                    </>
                  ) : (
                    <>
                      <Plus className="h-5 w-5" />
                      {t('inventory.addModal.save')}
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
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t('inventory.editModal.title')}</h2>
                <button
                  className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 text-2xl font-bold transition-colors duration-200"
                  onClick={() => setShowEditModal(false)}
                >×</button>
              </div>
            </div>
            <div className="p-4 sm:p-6">
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('inventory.addModal.productName')}</label>
                <input type="text" name="name" value={addForm.name} onChange={handleFormChange} className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-gray-100" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('inventory.addModal.category')}</label>
                <select name="category" value={addForm.category} onChange={handleFormChange} className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-gray-100" required>
                  <option value="">{t('inventory.addModal.selectCategory')}</option>
                  {categoryOptions.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('inventory.addModal.unit')}</label>
                <select name="unit" value={addForm.unit} onChange={handleFormChange} className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-gray-100" required>
                  <option value="">{t('inventory.addModal.selectUnit')}</option>
                  {UNIT_CANONICAL.map((ar, i) => (
                    <option key={ar} value={ar}>{t(UNIT_LABEL_KEYS[i])}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('inventory.addModal.minStock')}</label>
                <input type="number" name="minStock" value={addForm.minStock} onChange={handleFormChange} className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-gray-100" required min="0" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('inventory.editModal.lastPrice')}</label>
                <input type="number" name="price" value={addForm.price} onChange={handleFormChange} className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-gray-100" required min="0" />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('inventory.editModal.priceNote')}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('inventory.addModal.supplier')}</label>
                <input type="text" name="supplier" value={addForm.supplier} onChange={handleFormChange} className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-gray-100" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('inventory.barcode')}</label>
                <div className="flex gap-2">
                  <input type="text" name="barcode" value={addForm.barcode} onChange={handleFormChange} placeholder={t('inventory.barcodePlaceholder')} className="flex-1 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-gray-100 font-mono" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('inventory.addModal.warehouseItem')}</label>
                <select name="warehouseItem" value={addForm.warehouseItem} onChange={handleFormChange} className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-gray-100">
                  <option value="">-- {t('inventory.addModal.selectWarehouseItem')} --</option>
                  {warehouseItems.map(w => (
                    <option key={w.id || w._id} value={w.id || w._id}>{w.name} ({formatDecimal(w.currentStock, i18n.language)} {translateUnit(w.unit)})</option>
                  ))}
                </select>
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
                  <span className={`${isRTL ? 'mr-2' : 'ml-2'} text-sm text-gray-700 dark:text-gray-300`}>{t('inventory.addModal.isRawMaterial')}</span>
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('inventory.addModal.rawMaterialHint')}</p>
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
                    {t('inventory.editModal.updating')}
                  </>
                ) : t('inventory.editModal.update')}
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
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t('inventory.deleteModal.title')}</h2>
                <button
                  className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 text-2xl font-bold transition-colors duration-200"
                  onClick={() => setShowDeleteModal(false)}
                >×</button>
              </div>
            </div>
            <div className="p-6 text-center">
            <p className="mb-6 text-gray-700 dark:text-gray-300">
              {t('inventory.deleteModal.confirmMessage', { name: deleteTarget?.name })}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{t('inventory.deleteModal.cannotUndo')}</p>
            {error && <div className="text-red-600 dark:text-red-400 text-sm mb-2">{error}</div>}
            <div className="flex gap-4 justify-center">
              <button
                className={`${loading ? 'opacity-50 cursor-not-allowed' : ''} bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-800 dark:text-gray-100 px-4 py-2 rounded-lg font-bold transition-colors duration-200`}
                onClick={() => setShowDeleteModal(false)}
                disabled={loading}
              >
                {t('inventory.addModal.cancel')}
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
                    {t('inventory.deleteModal.deleting')}
                  </>
                ) : t('inventory.deleteModal.confirm')}
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
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t('inventory.deductModal.title')}</h2>
                <button
                  className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 text-2xl font-bold transition-colors duration-200"
                  onClick={() => setShowDeductModal(false)}
                >×</button>
              </div>
            </div>
            <div className="p-4 sm:p-6">
              <div className="mb-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-600 rounded-lg p-3">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>{t('inventory.deductModal.product')}:</strong> {selectedItem.name}
                </p>
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>{t('inventory.deductModal.currentStock')}:</strong> {formatQuantity(selectedItem.currentStock, translateUnit(selectedItem.unit), i18n.language)}
                </p>
              </div>

              <form onSubmit={handleDeductSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('inventory.deductModal.deductType')}
                  </label>
                  <select
                    value={deductForm.type}
                    onChange={(e) => setDeductForm({ ...deductForm, type: e.target.value as 'out' | 'adjustment' })}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-gray-100"
                  >
                    <option value="out">{t('inventory.deductModal.out')}</option>
                    <option value="adjustment">{t('inventory.deductModal.adjustment')}</option>
                  </select>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {deductForm.type === 'out' 
                      ? t('inventory.deductModal.deductHint')
                      : t('inventory.deductModal.adjustmentHint')}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {deductForm.type === 'out' ? t('inventory.deductModal.quantityToDeduct') : t('inventory.deductModal.correctStock')}
                  </label>
                  <input
                    type="number"
                    value={deductForm.quantity}
                    step="0.01"
                    inputMode="decimal"
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '' || /^\d*\.?\d*$/.test(val)) {
                        setDeductForm({ ...deductForm, quantity: val });
                      }
                    }}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-gray-100"
                    required
                    placeholder={deductForm.type === 'out' ? t('inventory.deductModal.exampleQuantity') : `${t('inventory.deductModal.currentLabel')}: ${formatDecimal(selectedItem.currentStock, i18n.language)}`}
                  />
                  {deductForm.type === 'out' && deductForm.quantity && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {t('inventory.deductModal.remainingAfterDeduct')}: {formatQuantity(Math.max(0, selectedItem.currentStock - Number(deductForm.quantity)), translateUnit(selectedItem.unit), i18n.language)}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('inventory.deductModal.reason')}
                  </label>
                  <select
                    value={deductForm.reason}
                    onChange={(e) => {
                      const value = e.target.value;
                      const isOther = value === t('inventory.deductModal.reasons.other');
                      setDeductCustomReason(isOther);
                      setDeductForm({ ...deductForm, reason: isOther ? '' : value });
                    }}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-gray-100 mb-2"
                  >
                    <option value="">{t('inventory.deductModal.selectReason')}</option>
                    {deductForm.type === 'out' ? (
                      <>
                        <option value="بيع">{t('inventory.deductModal.reasons.sale')}</option>
                        <option value="استهلاك في الإنتاج">{t('inventory.deductModal.reasons.production')}</option>
                        <option value="تالف">{t('inventory.deductModal.reasons.damaged')}</option>
                        <option value="منتهي الصلاحية">{t('inventory.deductModal.reasons.expired')}</option>
                        <option value="إرجاع للمورد">{t('inventory.deductModal.reasons.returnToSupplier')}</option>
                        <option value={t('inventory.deductModal.reasons.other')}>{t('inventory.deductModal.reasons.other')}</option>
                      </>
                    ) : (
                      <>
                        <option value="جرد دوري">{t('inventory.deductModal.reasons.periodicInventory')}</option>
                        <option value="تصحيح خطأ">{t('inventory.deductModal.reasons.errorCorrection')}</option>
                        <option value="فقدان">{t('inventory.deductModal.reasons.loss')}</option>
                        <option value={t('inventory.deductModal.reasons.other')}>{t('inventory.deductModal.reasons.other')}</option>
                      </>
                    )}
                  </select>
                  {deductCustomReason && (
                    <input
                      type="text"
                      value={deductForm.reason}
                      onChange={(e) => setDeductForm({ ...deductForm, reason: e.target.value })}
                      className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-gray-100"
                      placeholder={t('inventory.deductModal.enterReason')}
                      required
                    />
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('inventory.deductModal.date')}
                  </label>
                  <DatePicker
                    showTime
                    value={deductForm.date ? dayjs(deductForm.date) : null}
                    onChange={(date) => {
                      setDeductForm({ ...deductForm, date: date ? date.format('YYYY-MM-DDTHH:mm') : '' });
                    }}
                    format="YYYY/MM/DD HH:mm"
                    className="w-full"
                    size="large"
                    placeholder={t('inventory.deductModal.date')}
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    💡 {t('inventory.addModal.dateHint')}
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
                    {t('inventory.addModal.cancel')}
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
                        {t('inventory.deductModal.deducting')}
                      </>
                    ) : (
                      <>
                        <Minus className="h-4 w-4" />
                        {deductForm.type === 'out' ? t('inventory.deductModal.deductQuantity') : t('inventory.deductModal.adjustStock')}
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal تحويل من المخزن الرئيسي */}
      {showTransferFromWarehouseModal && selectedItem && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setShowTransferFromWarehouseModal(false); }}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-gradient-to-r from-blue-600 to-blue-500 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 rounded-full p-2">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                </div>
                <h3 className="text-lg font-bold text-white">{t('inventory.transferModal.title')}</h3>
              </div>
              <button type="button" onClick={() => setShowTransferFromWarehouseModal(false)}
                className="text-white/80 hover:text-white transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-4 sm:p-6">
              {!selectedItem.warehouseItem ? (
                <div className="space-y-5">
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-xl p-5">
                    <div className="flex gap-3">
                      <svg className="w-6 h-6 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                      <div>
                        <p className="text-sm font-medium text-amber-800 dark:text-amber-200">{t('inventory.transferModal.noLinkMessage')}</p>
                      </div>
                    </div>
                  </div>
                  <button type="button" onClick={handleCreateWarehouseFromInventory} disabled={loading}
                    className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white px-4 py-3 rounded-xl font-medium shadow-lg shadow-emerald-200 dark:shadow-emerald-900/30 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                    {loading ? t('inventory.messages.creating') : t('inventory.transferModal.createWarehouseItem')}
                  </button>
                  <button type="button" onClick={() => setShowTransferFromWarehouseModal(false)}
                    className="w-full px-4 py-2.5 text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl transition-colors font-medium">
                    {t('common.cancel')}
                  </button>
                </div>
              ) : (
                <form onSubmit={handleTransferFromWarehouse} className="space-y-5">
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 border border-gray-100 dark:border-gray-600/50">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">{t('inventory.table.product')}</span>
                        <p className="text-base font-bold text-gray-900 dark:text-gray-100 mt-0.5">{selectedItem.name}</p>
                      </div>
                      <div className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-bold px-3 py-1.5 rounded-lg border border-blue-100 dark:border-blue-800/50">
                        <span className="opacity-75">{t('inventory.movementsModal.stock')}: </span>
                        <span>{formatDecimal(selectedItem.currentStock, i18n.language)} {translateUnit(selectedItem.unit)}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">{t('inventory.transferModal.warehouseProduct')}</label>
                    {transferForm.warehouseItemId ? (
                      (() => {
                        const w = warehouseItems.find(wi => (wi.id || wi._id) === transferForm.warehouseItemId);
                        return (
                          <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700/50 rounded-xl p-3 flex items-center gap-3">
                            <div className="bg-emerald-100 dark:bg-emerald-800/40 rounded-lg p-2">
                              <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">{w?.name || ''}</p>
                              {w && <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">{t('inventory.transferModal.available', { stock: formatDecimal(w.currentStock, i18n.language), unit: translateUnit(w.unit) })}</p>}
                            </div>
                          </div>
                        );
                      })()
                    ) : (
                      <select value={transferForm.warehouseItemId}
                        onChange={e => setTransferForm({...transferForm, warehouseItemId: e.target.value})}
                        className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-3 dark:bg-gray-700 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" required>
                        <option value="">{t('inventory.transferModal.selectPlaceholder')}</option>
                        {warehouseItems.filter(w => w.currentStock > 0).map(w => (
                          <option key={w.id || w._id} value={w.id || w._id}>
                            {w.name} ({t('inventory.transferModal.available', { stock: formatDecimal(w.currentStock, i18n.language), unit: translateUnit(w.unit) })})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">{t('inventory.deductModal.quantity')}</label>
                    <div className="relative">
                      <input type="number" value={transferForm.quantity} step="0.01" inputMode="decimal" placeholder="0.00"
                        onChange={e => {
                          const val = e.target.value;
                          if (val === '' || /^\d*\.?\d*$/.test(val)) {
                            setTransferForm({...transferForm, quantity: val});
                          }
                        }}
                        className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-3 dark:bg-gray-700 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all pr-16" required />
                      <span className="absolute inset-y-0 right-0 flex items-center pr-4 text-sm text-gray-400 dark:text-gray-500 font-medium border-l border-gray-200 dark:border-gray-600 pl-3 ml-0">
                        {translateUnit(selectedItem.unit)}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">{t('inventory.addModal.price')}</label>
                    <div className="relative">
                      <input type="number" value={transferForm.price} placeholder="0.00"
                        onChange={e => setTransferForm({...transferForm, price: e.target.value})}
                        className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-3 dark:bg-gray-700 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all pr-16" />
                      <span className="absolute inset-y-0 right-0 flex items-center pr-4 text-sm text-gray-400 dark:text-gray-500 font-medium border-l border-gray-200 dark:border-gray-600 pl-3 ml-0">$</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">{t('inventory.deductModal.reason')}</label>
                    <input type="text" value={transferForm.reason} placeholder="..."
                      onChange={e => setTransferForm({...transferForm, reason: e.target.value})}
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-3 dark:bg-gray-700 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" />
                  </div>

                  {error && <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl p-3"><p className="text-red-600 dark:text-red-400 text-sm">{error}</p></div>}

                  <hr className="border-gray-200 dark:border-gray-600" />

                  <div className="flex justify-end gap-3">
                    <button type="button" onClick={() => setShowTransferFromWarehouseModal(false)}
                      className="px-5 py-2.5 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl font-medium transition-colors">
                      {t('common.cancel')}</button>
                    <button type="submit" disabled={loading}
                      className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-200 dark:shadow-blue-900/30 transition-all duration-200 disabled:opacity-50 flex items-center gap-2">
                      {loading ? (
                        <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>{t('inventory.transferModal.transferring')}</>
                      ) : (
                        <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>{t('inventory.transferModal.transfer')}</>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal إرجاع للمخزن الرئيسي */}
      {showReturnToWarehouseModal && selectedItem && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setShowReturnToWarehouseModal(false); }}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-gradient-to-r from-amber-600 to-amber-500 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 rounded-full p-2">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 17l-4 4m0 0l-4-4m4 4V3" /></svg>
                </div>
                <h3 className="text-lg font-bold text-white">{t('inventory.returnModal.title')}</h3>
              </div>
              <button type="button" onClick={() => setShowReturnToWarehouseModal(false)}
                className="text-white/80 hover:text-white transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-4 sm:p-6">
              {!selectedItem.warehouseItem ? (
                <div className="space-y-5">
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-xl p-5">
                    <div className="flex gap-3">
                      <svg className="w-6 h-6 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                      <div>
                        <p className="text-sm font-medium text-amber-800 dark:text-amber-200">{t('inventory.returnModal.noLinkMessage')}</p>
                      </div>
                    </div>
                  </div>
                  <button type="button" onClick={handleCreateWarehouseFromInventory} disabled={loading}
                    className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white px-4 py-3 rounded-xl font-medium shadow-lg shadow-emerald-200 dark:shadow-emerald-900/30 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                    {loading ? t('inventory.messages.creating') : t('inventory.returnModal.createWarehouseItem')}
                  </button>
                  <button type="button" onClick={() => setShowReturnToWarehouseModal(false)}
                    className="w-full px-4 py-2.5 text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl transition-colors font-medium">
                    {t('common.cancel')}
                  </button>
                </div>
              ) : (
                <form onSubmit={handleReturnToWarehouse} className="space-y-5">
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 border border-gray-100 dark:border-gray-600/50">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">{t('inventory.table.product')}</span>
                        <p className="text-base font-bold text-gray-900 dark:text-gray-100 mt-0.5">{selectedItem.name}</p>
                      </div>
                      <div className="bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs font-bold px-3 py-1.5 rounded-lg border border-amber-100 dark:border-amber-800/50">
                        <span className="opacity-75">{t('inventory.movementsModal.stock')}: </span>
                        <span>{formatDecimal(selectedItem.currentStock, i18n.language)} {translateUnit(selectedItem.unit)}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">{t('inventory.returnModal.warehouseProduct')}</label>
                    {returnForm.warehouseItemId ? (
                      (() => {
                        const w = warehouseItems.find(wi => (wi.id || wi._id) === returnForm.warehouseItemId);
                        return (
                          <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700/50 rounded-xl p-3 flex items-center gap-3">
                            <div className="bg-emerald-100 dark:bg-emerald-800/40 rounded-lg p-2">
                              <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">{w?.name || ''}</p>
                              {w && <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">{t('inventory.returnModal.available', { stock: formatDecimal(w.currentStock, i18n.language), unit: translateUnit(w.unit) })}</p>}
                            </div>
                          </div>
                        );
                      })()
                    ) : (
                      <select value={returnForm.warehouseItemId}
                        onChange={e => setReturnForm({...returnForm, warehouseItemId: e.target.value})}
                        className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-3 dark:bg-gray-700 dark:text-gray-100 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all" required>
                        <option value="">{t('inventory.returnModal.selectPlaceholder')}</option>
                        {warehouseItems.map(w => (
                          <option key={w.id || w._id} value={w.id || w._id}>
                            {w.name} ({t('inventory.returnModal.available', { stock: formatDecimal(w.currentStock, i18n.language), unit: translateUnit(w.unit) })})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">{t('inventory.deductModal.quantity')}</label>
                    <div className="relative">
                      <input type="number" value={returnForm.quantity} step="0.01" inputMode="decimal" placeholder="0.00"
                        onChange={e => {
                          const val = e.target.value;
                          if (val === '' || /^\d*\.?\d*$/.test(val)) {
                            setReturnForm({...returnForm, quantity: val});
                          }
                        }}
                        className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-3 dark:bg-gray-700 dark:text-gray-100 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all pr-16" required />
                      <span className="absolute inset-y-0 right-0 flex items-center pr-4 text-sm text-gray-400 dark:text-gray-500 font-medium border-l border-gray-200 dark:border-gray-600 pl-3 ml-0">
                        {translateUnit(selectedItem.unit)}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">{t('inventory.addModal.price')}</label>
                    <div className="relative">
                      <input type="number" value={returnForm.price} placeholder="0.00"
                        onChange={e => setReturnForm({...returnForm, price: e.target.value})}
                        className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-3 dark:bg-gray-700 dark:text-gray-100 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all pr-16" />
                      <span className="absolute inset-y-0 right-0 flex items-center pr-4 text-sm text-gray-400 dark:text-gray-500 font-medium border-l border-gray-200 dark:border-gray-600 pl-3 ml-0">$</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">{t('inventory.deductModal.reason')}</label>
                    <input type="text" value={returnForm.reason} placeholder="..."
                      onChange={e => setReturnForm({...returnForm, reason: e.target.value})}
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-3 dark:bg-gray-700 dark:text-gray-100 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all" />
                  </div>

                  {error && <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl p-3"><p className="text-red-600 dark:text-red-400 text-sm">{error}</p></div>}

                  <hr className="border-gray-200 dark:border-gray-600" />

                  <div className="flex justify-end gap-3">
                    <button type="button" onClick={() => setShowReturnToWarehouseModal(false)}
                      className="px-5 py-2.5 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl font-medium transition-colors">
                      {t('common.cancel')}</button>
                    <button type="submit" disabled={loading}
                      className="px-6 py-2.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-700 hover:to-amber-600 text-white rounded-xl font-bold shadow-lg shadow-amber-200 dark:shadow-amber-900/30 transition-all duration-200 disabled:opacity-50 flex items-center gap-2">
                      {loading ? (
                        <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>{t('inventory.returnModal.returning')}</>
                      ) : (
                        <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>{t('inventory.returnModal.return')}</>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal سجل حركات المخزون */}
      {showMovementsModal && selectedItem && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setShowMovementsModal(false); }}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-gradient-to-r from-orange-600 to-orange-500 px-6 py-4 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 rounded-full p-2">
                  <Package className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">{t('inventory.movementsModal.title')}</h3>
                  <p className="text-sm text-white/80">{selectedItem.name}</p>
                </div>
              </div>
              <button onClick={() => setShowMovementsModal(false)}
                className="text-white/80 hover:text-white transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-6">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <svg className="animate-spin h-10 w-10 text-orange-600 mb-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <p className="text-gray-500 dark:text-gray-400">{t('inventory.movementsModal.loading')}</p>
                </div>
              ) : itemMovements.length === 0 ? (
                <div className="text-center py-16">
                  <div className="bg-gray-100 dark:bg-gray-700 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                    <Package className="h-8 w-8 text-gray-400" />
                  </div>
                  <p className="text-gray-500 dark:text-gray-400">{t('inventory.movementsModal.noMovements')}</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* ملخص المنتج - بطاقات */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl p-5 border border-blue-200 dark:border-blue-800/50">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="bg-blue-100 dark:bg-blue-800/40 rounded-lg p-2">
                          <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                        </div>
                        <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">{t('inventory.movementsModal.currentStock')}</p>
                      </div>
                      <p className="text-2xl font-bold text-blue-800 dark:text-blue-200">
                        {formatQuantity(selectedItem.currentStock, translateUnit(selectedItem.unit), i18n.language)}
                      </p>
                    </div>
                    <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 rounded-xl p-5 border border-emerald-200 dark:border-emerald-800/50">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="bg-emerald-100 dark:bg-emerald-800/40 rounded-lg p-2">
                          <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">{t('inventory.movementsModal.totalValue')}</p>
                        </div>
                      </div>
                      <p className="text-2xl font-bold text-emerald-800 dark:text-emerald-200">
                        {formatCurrency(selectedItem.totalValue || (selectedItem.currentStock * selectedItem.price), i18n.language)}
                      </p>
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">{t('inventory.movementsModal.totalValueHint')}</p>
                    </div>
                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-xl p-5 border border-purple-200 dark:border-purple-800/50">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="bg-purple-100 dark:bg-purple-800/40 rounded-lg p-2">
                          <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                        </div>
                        <p className="text-sm font-semibold text-purple-700 dark:text-purple-300">{t('inventory.movementsModal.movementsCount')}</p>
                      </div>
                      <p className="text-2xl font-bold text-purple-800 dark:text-purple-200">
                        {formatDecimal(itemMovements.length, i18n.language)}
                      </p>
                    </div>
                  </div>

                  {/* جدول الحركات */}
                  <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-600">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-gray-700">
                          <th className={`px-4 py-3.5 ${isRTL ? 'text-right' : 'text-left'} text-xs font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider`}>{t('inventory.movementsModal.date')}</th>
                          <th className={`px-4 py-3.5 ${isRTL ? 'text-right' : 'text-left'} text-xs font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider`}>{t('inventory.movementsModal.type')}</th>
                          <th className={`px-4 py-3.5 ${isRTL ? 'text-right' : 'text-left'} text-xs font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider`}>{t('inventory.movementsModal.quantity')}</th>
                          <th className={`px-4 py-3.5 ${isRTL ? 'text-right' : 'text-left'} text-xs font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider`}>{t('inventory.movementsModal.pricePerUnit')}</th>
                          <th className={`px-4 py-3.5 ${isRTL ? 'text-right' : 'text-left'} text-xs font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider`}>{t('inventory.movementsModal.total')}</th>
                          <th className={`px-4 py-3.5 ${isRTL ? 'text-right' : 'text-left'} text-xs font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider`}>{t('inventory.movementsModal.reason')}</th>
                          <th className={`px-4 py-3.5 ${isRTL ? 'text-right' : 'text-left'} text-xs font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider`}>{t('inventory.movementsModal.balanceAfter')}</th>
                          <th className={`px-4 py-3.5 ${isRTL ? 'text-right' : 'text-left'} text-xs font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider`}>{t('inventory.movementsModal.actions')}</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
                        {itemMovements.map((movement: any, index: number) => {
                          const displayPrice = movement.price;
                          let displayTotal = null;
                          if (movement.totalCost !== null && movement.totalCost !== undefined) {
                            displayTotal = movement.totalCost;
                          } else if (movement.price) {
                            displayTotal = movement.price * Math.abs(movement.quantity);
                          }
                          return (
                          <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                              {movement.timestamp || movement.date 
                                ? formatOrgDate(movement.timestamp || movement.date, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                                : <span className="text-gray-400 italic">{t('inventory.movementsModal.notSpecified')}</span>}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ring-1 ${
                                movement.type === 'in'
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 ring-green-200 dark:ring-green-800'
                                  : movement.type === 'out'
                                  ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 ring-red-200 dark:ring-red-800'
                                  : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 ring-blue-200 dark:ring-blue-800'
                              }`}>
                                {t(`inventory.movementsModal.types.${movement.type}`)}
                              </span>
                              {movement.archived && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 mr-1">
                                  {t('inventory.movementsModal.archived')}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className={`text-sm font-bold ${
                                movement.type === 'in' || movement.type === 'transfer_in' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                              }`}>
                                {(movement.type === 'in' || movement.type === 'transfer_in') ? '+' : '−'}{formatQuantity(movement.quantity, translateUnit(selectedItem.unit), i18n.language)}
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                              {displayPrice ? (
                                <span className={(movement.type === 'out' || movement.type === 'adjustment') ? 'text-gray-500 dark:text-gray-400' : ''}>
                                  {formatCurrency(displayPrice, i18n.language)}
                                </span>
                              ) : <span className="text-gray-400">—</span>}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-gray-100">
                              {displayTotal ? (
                                <span className={(movement.type === 'out' || movement.type === 'adjustment') ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}>
                                  {formatCurrency(displayTotal, i18n.language)}
                                </span>
                              ) : <span className="text-gray-400">—</span>}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 max-w-[200px] truncate" title={movement.reason}>
                              {translateReason(movement.reason)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-gray-100">
                              {movement.balanceAfter === null || movement.balanceAfter === undefined
                                ? <span className="text-gray-400">—</span>
                                : formatQuantity(movement.balanceAfter, translateUnit(selectedItem.unit), i18n.language)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm">
                              <div className={`flex gap-1 ${isRTL ? 'justify-start' : 'justify-end'}`}>
                                {!isOrderLinkedReason(movement.reason) ? (
                                  <>
                                    <PermissionGuard requiredPermissions={['canEditStockMovement', 'all']}>
                                      <button onClick={() => openEditMovementModal(movement)}
                                        className="p-1.5 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors" title={t('inventory.movementsModal.edit')}>
                                        <Edit2 className="w-4 h-4" />
                                      </button>
                                    </PermissionGuard>
                                    <PermissionGuard requiredPermissions={['canDeleteStockMovement', 'all']}>
                                      <button onClick={() => handleDeleteMovement(movement._id)}
                                        className="p-1.5 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title={t('inventory.movementsModal.delete')}>
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </PermissionGuard>
                                  </>
                                ) : (
                                  <span className="text-xs text-gray-400 italic">{t('inventory.movementsModal.linkedToOrder')}</span>
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
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setShowEditMovementModal(false); }}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-gradient-to-r from-blue-600 to-blue-500 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 rounded-full p-2">
                  <Edit2 className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-lg font-bold text-white">{t('inventory.editMovementModal.title')}</h3>
              </div>
              <button onClick={() => { setShowEditMovementModal(false); setError(''); }}
                className="text-white/80 hover:text-white transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[70vh]">
              <div className={`mb-5 p-5 rounded-xl border ${
                editingMovement.type === 'in' || editingMovement.type === 'transfer_in'
                  ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700/50'
                  : editingMovement.type === 'out' || editingMovement.type === 'transfer_out'
                  ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700/50'
                  : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700/50'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                  <span className="text-sm font-bold text-gray-700 dark:text-gray-200">{t('inventory.editMovementModal.movementType')}:</span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ring-1 ${
                    editingMovement.type === 'in' || editingMovement.type === 'transfer_in'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 ring-green-200 dark:ring-green-800'
                      : editingMovement.type === 'out' || editingMovement.type === 'transfer_out'
                      ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 ring-red-200 dark:ring-red-800'
                      : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 ring-blue-200 dark:ring-blue-800'
                  }`}>
                    {editingMovement.type === 'transfer_in' ? t('warehouse.transferIn') :
                     editingMovement.type === 'transfer_out' ? t('warehouse.transferOut') :
                     t(`inventory.movementsModal.types.${editingMovement.type}`)}
                  </span>
                </div>
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">{t('inventory.editMovementModal.warningTitle')}</p>
                {editingMovement.type === 'in' ? (
                  <div className="space-y-0.5">
                    <p className="text-xs text-gray-600 dark:text-gray-400">{t('inventory.editMovementModal.inWarning1')}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">{t('inventory.editMovementModal.inWarning2')}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">{t('inventory.editMovementModal.inWarning3')}</p>
                  </div>
                ) : editingMovement.type === 'out' ? (
                  <div className="space-y-0.5">
                    <p className="text-xs text-gray-600 dark:text-gray-400">{t('inventory.editMovementModal.outWarning1')}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">{t('inventory.editMovementModal.outWarning2')}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">{t('inventory.editMovementModal.outWarning3')}</p>
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    <p className="text-xs text-gray-600 dark:text-gray-400">{t('inventory.editMovementModal.adjustmentWarning1')}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">{t('inventory.editMovementModal.adjustmentWarning2')}</p>
                  </div>
                )}
              </div>

              {error && <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl p-3.5"><p className="text-red-600 dark:text-red-400 text-sm">{error}</p></div>}

              <form onSubmit={handleEditMovementSubmit} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                      {t('inventory.editMovementModal.quantity')} <span className="text-red-500">*</span>
                    </label>
                    <input type="number" step="0.01" value={editMovementForm.quantity}
                      onChange={(e) => setEditMovementForm({ ...editMovementForm, quantity: e.target.value })}
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-3 dark:bg-gray-700 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" required
                      placeholder={t('inventory.editMovementModal.quantityPlaceholder')} />
                  </div>
                  {editingMovement.type === 'in' && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">{t('inventory.editMovementModal.price')}</label>
                      <input type="number" step="0.01" value={editMovementForm.price}
                        onChange={(e) => setEditMovementForm({ ...editMovementForm, price: e.target.value })}
                        className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-3 dark:bg-gray-700 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                        placeholder={t('inventory.editMovementModal.pricePlaceholder')} />
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                      {t('inventory.editMovementModal.reason')} <span className="text-red-500">*</span>
                    </label>
                    <input type="text" value={editMovementForm.reason}
                      onChange={(e) => setEditMovementForm({ ...editMovementForm, reason: e.target.value })}
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-3 dark:bg-gray-700 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" required
                      placeholder={t('inventory.editMovementModal.reasonPlaceholder')} />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">{t('inventory.editMovementModal.date')}</label>
                    <DatePicker showTime value={editMovementForm.date ? dayjs(editMovementForm.date) : null}
                      onChange={(date) => setEditMovementForm({ ...editMovementForm, date: date ? date.format('YYYY-MM-DDTHH:mm') : '' })}
                      format="YYYY/MM/DD HH:mm" className="w-full [&_.ant-picker]:!rounded-xl [&_.ant-picker]:!py-3" size="large" placeholder={t('inventory.editMovementModal.date')} />
                  </div>
                </div>
                <hr className="border-gray-200 dark:border-gray-600" />
                <div className="flex justify-end gap-3">
                  <button type="button" onClick={() => { setShowEditMovementModal(false); setError(''); }}
                    className="px-5 py-2.5 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl font-medium transition-colors" disabled={loading}>
                    {t('inventory.editMovementModal.cancel')}
                  </button>
                  <button type="submit" disabled={loading}
                    className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-200 dark:shadow-blue-900/30 transition-all duration-200 disabled:opacity-50 flex items-center gap-2">
                    {loading ? (
                      <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                      {t('inventory.editMovementModal.updating')}</>
                    ) : (
                      <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      {t('inventory.editMovementModal.update')}</>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Movement Modal */}
      {showDeleteMovementModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) { setShowDeleteMovementModal(false); setDeletingMovementId(null); } }}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-gradient-to-r from-red-600 to-red-500 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 rounded-full p-2">
                  <Trash2 className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-lg font-bold text-white">{t('inventory.deleteMovementModal.title')}</h3>
              </div>
              <button onClick={() => { setShowDeleteMovementModal(false); setDeletingMovementId(null); }}
                className="text-white/80 hover:text-white transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6 text-center">
              <div className="mb-4 flex justify-center">
                <div className="rounded-full bg-red-100 dark:bg-red-900/20 p-3">
                  <Trash2 className="h-8 w-8 text-red-600 dark:text-red-400" />
                </div>
              </div>
              <p className="mb-3 text-gray-700 dark:text-gray-200 text-lg font-bold">{t('inventory.deleteMovementModal.confirmMessage')}</p>
              <div className="mb-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-xl p-3.5 flex gap-3">
                <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                <p className="text-sm text-amber-800 dark:text-amber-200">{t('inventory.deleteMovementModal.warning')}</p>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">{t('inventory.deleteMovementModal.cannotUndo')}</p>
              <div className="flex justify-center gap-3">
                <button onClick={() => { setShowDeleteMovementModal(false); setDeletingMovementId(null); }}
                  className="px-5 py-2.5 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl font-medium transition-colors" disabled={loading}>
                  {t('inventory.deleteMovementModal.cancel')}
                </button>
                <button onClick={confirmDeleteMovement} disabled={loading}
                  className="px-6 py-2.5 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white rounded-xl font-bold shadow-lg shadow-red-200 dark:shadow-red-900/30 transition-all duration-200 disabled:opacity-50 flex items-center gap-2">
                  {loading ? (
                    <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    {t('inventory.deleteMovementModal.deleting')}</>
                  ) : (
                    <><Trash2 className="h-4 w-4" />{t('inventory.deleteMovementModal.confirm')}</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </ConfigProvider>
  );
};

export default Inventory;
