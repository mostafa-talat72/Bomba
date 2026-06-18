import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { formatCurrency, formatDecimal, formatQuantity } from '../utils/formatters';
import { Package, Plus, AlertTriangle, Edit, Trash2, History, Minus, ChevronDown, ChevronUp, Edit2, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { WarehouseItem, MenuItem } from '../services/api';
import { api } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
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

dayjs.extend(customParseFormat);

const getCairoDateTime = (timezone: string) => {
  const now = new Date();
  const orgTime = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
  const year = orgTime.getFullYear();
  const month = String(orgTime.getMonth() + 1).padStart(2, '0');
  const day = String(orgTime.getDate()).padStart(2, '0');
  const hours = String(orgTime.getHours()).padStart(2, '0');
  const minutes = String(orgTime.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const Warehouse = () => {
  const { t, i18n } = useTranslation();
  const { isRTL } = useLanguage();
  const { timezone, formatDate: formatOrgDate } = useOrganization();
  const { warehouseItems, fetchWarehouseItems, createWarehouseItem, updateWarehouseItem, updateWarehouseStock, user } = useApp();

  const hasPermission = (permission: string) => {
    if (!user) return false;
    return user.permissions.includes('all') || user.permissions.includes('inventory') || user.permissions.includes(permission);
  };

  const getAntdLocale = () => {
    switch (i18n.language) { case 'ar': return arEG; case 'fr': return frFR; default: return enUS_antd; }
  };

  useEffect(() => { dayjs.locale(i18n.language); }, [i18n.language]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showMovementsModal, setShowMovementsModal] = useState(false);
  const [showDeductModal, setShowDeductModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<WarehouseItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WarehouseItem | null>(null);
  const [itemMovements, setItemMovements] = useState<any[]>([]);

  const [deductForm, setDeductForm] = useState({
    quantity: '', reason: '', type: 'out' as 'out' | 'adjustment', date: getCairoDateTime(timezone),
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStock, setFilterStock] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [dateFilterType, setDateFilterType] = useState<'range' | 'month' | 'year'>('range');
  const [showBasicFilters, setShowBasicFilters] = useState(true);
  const [showDateFilters, setShowDateFilters] = useState(false);

  const [showEditMovementModal, setShowEditMovementModal] = useState(false);
  const [showDeleteMovementModal, setShowDeleteMovementModal] = useState(false);
  const [deletingMovementId, setDeletingMovementId] = useState<string | null>(null);
  const [editingMovement, setEditingMovement] = useState<any>(null);
  const [editMovementForm, setEditMovementForm] = useState({
    quantity: '', price: '', reason: '', date: '',
  });

  const [addType, setAddType] = useState<'existing' | 'new'>('existing');
  const [addForm, setAddForm] = useState({
    productId: '', name: '', category: '', quantity: '', price: '', supplier: '', minStock: '', unit: '',
    date: getCairoDateTime(timezone), costStatus: 'pending', paidAmount: '', isRawMaterial: false,
  });
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertType, setAlertType] = useState<'success' | 'error'>('success');
  const [menuCategories, setMenuCategories] = useState<Array<{ id: string; name: string }>>([]);

  const unitOptions = useMemo(() => [
    t('inventory.units.piece'), t('inventory.units.kilo'), t('inventory.units.gram'),
    t('inventory.units.liter'), t('inventory.units.ml'), t('inventory.units.box'),
    t('inventory.units.bag'), t('inventory.units.bottle'),
  ], [t]);

  const normalizeUnit = useCallback((unit: string): string => {
    if (!unit) return '';
    const unitMap: { [key: string]: string } = {
      'قطعة': t('inventory.units.piece'), 'كيلو': t('inventory.units.kilo'), 'جرام': t('inventory.units.gram'),
      'لتر': t('inventory.units.liter'), 'مل': t('inventory.units.ml'), 'علبة': t('inventory.units.box'),
      'كيس': t('inventory.units.bag'), 'زجاجة': t('inventory.units.bottle'),
      'Piece': t('inventory.units.piece'), 'Kilo': t('inventory.units.kilo'), 'Gram': t('inventory.units.gram'),
      'Liter': t('inventory.units.liter'), 'ML': t('inventory.units.ml'), 'Box': t('inventory.units.box'),
      'Bag': t('inventory.units.bag'), 'Bottle': t('inventory.units.bottle'),
      'Pièce': t('inventory.units.piece'), 'Gramme': t('inventory.units.gram'),
      'Litre': t('inventory.units.liter'), 'Boîte': t('inventory.units.box'),
      'Sac': t('inventory.units.bag'), 'Bouteille': t('inventory.units.bottle'),
    };
    return unitMap[unit] || unit;
  }, [t]);

  const normalizeCategory = useCallback((category: string): string => {
    if (!category) return '';
    const categoryMap: { [key: string]: string } = {
      'مشروبات ساخنة': t('inventory.categories.hotDrinks'), 'مشروبات باردة': t('inventory.categories.coldDrinks'),
      'طعام': t('inventory.categories.food'), 'حلويات': t('inventory.categories.desserts'),
      'مواد خام': t('inventory.categories.rawMaterials'), 'أخرى': t('inventory.categories.other'),
      'Hot Drinks': t('inventory.categories.hotDrinks'), 'Cold Drinks': t('inventory.categories.coldDrinks'),
      'Food': t('inventory.categories.food'), 'Desserts': t('inventory.categories.desserts'),
      'Raw Materials': t('inventory.categories.rawMaterials'), 'Other': t('inventory.categories.other'),
      'Boissons chaudes': t('inventory.categories.hotDrinks'), 'Nourriture': t('inventory.categories.food'),
      'Matières premières': t('inventory.categories.rawMaterials'), 'Autre': t('inventory.categories.other'),
    };
    return categoryMap[category] || category;
  }, [t]);

  const defaultCategories = useMemo(() => [
    t('inventory.categories.hotDrinks'), t('inventory.categories.coldDrinks'),
    t('inventory.categories.food'), t('inventory.categories.desserts'),
    t('inventory.categories.rawMaterials'), t('inventory.categories.other'),
  ], [t]);

  const categoryOptions = useMemo(() => {
    const menuCategoryNames = menuCategories.map(cat => cat.name);
    return [...new Set([...defaultCategories, ...menuCategoryNames])].sort();
  }, [menuCategories]);

  const costStatusOptions = useMemo(() => [
    { value: 'pending', label: t('inventory.addModal.pending') },
    { value: 'paid', label: t('inventory.addModal.paid') },
    { value: 'partially_paid', label: t('inventory.addModal.partiallyPaid') },
    { value: 'overdue', label: t('inventory.addModal.overdue') },
  ], [t]);

  const filteredProducts = useMemo(() => {
    if (!productSearchTerm) return warehouseItems;
    return warehouseItems.filter(item =>
      item.name.toLowerCase().includes(productSearchTerm.toLowerCase())
    );
  }, [warehouseItems, productSearchTerm]);

  const translateCategory = (category: string) => {
    const categoryMap: { [key: string]: string } = {
      'مشروبات ساخنة': t('inventory.categories.hotDrinks'), 'مشروبات باردة': t('inventory.categories.coldDrinks'),
      'طعام': t('inventory.categories.food'), 'حلويات': t('inventory.categories.desserts'),
      'مواد خام': t('inventory.categories.rawMaterials'), 'أخرى': t('inventory.categories.other'),
      'Hot Drinks': t('inventory.categories.hotDrinks'), 'Cold Drinks': t('inventory.categories.coldDrinks'),
      'Food': t('inventory.categories.food'), 'Desserts': t('inventory.categories.desserts'),
      'Raw Materials': t('inventory.categories.rawMaterials'), 'Other': t('inventory.categories.other'),
    };
    return categoryMap[category] || category;
  };

  const translateUnit = (unit: string) => {
    const unitMap: { [key: string]: string } = {
      'قطعة': t('inventory.units.piece'), 'كيلو': t('inventory.units.kilo'), 'جرام': t('inventory.units.gram'),
      'لتر': t('inventory.units.liter'), 'مل': t('inventory.units.ml'), 'علبة': t('inventory.units.box'),
      'كيس': t('inventory.units.bag'), 'زجاجة': t('inventory.units.bottle'),
      'piece': t('inventory.units.piece'), 'kilo': t('inventory.units.kilo'), 'gram': t('inventory.units.gram'),
      'liter': t('inventory.units.liter'), 'ml': t('inventory.units.ml'), 'box': t('inventory.units.box'),
      'bag': t('inventory.units.bag'), 'bottle': t('inventory.units.bottle'),
    };
    return unitMap[unit] || unit;
  };

  const translateReason = (reason: string): string => {
    if (!reason) return '-';
    if (reason.includes('طلب رقم') || reason.includes('فاتورة') || reason.includes('Order #') || reason.includes('Invoice') || reason.includes('Commande #') || reason.includes('Facture')) {
      return reason;
    }
    const reasonMap: { [key: string]: string } = {
      'بيع': t('inventory.deductModal.reasons.sale'), 'استهلاك في الإنتاج': t('inventory.deductModal.reasons.production'),
      'تالف': t('inventory.deductModal.reasons.damaged'), 'منتهي الصلاحية': t('inventory.deductModal.reasons.expired'),
      'إرجاع للمورد': t('inventory.deductModal.reasons.returnToSupplier'),
      'جرد دوري': t('inventory.deductModal.reasons.periodicInventory'),
      'تصحيح خطأ': t('inventory.deductModal.reasons.errorCorrection'), 'فقدان': t('inventory.deductModal.reasons.loss'),
      'Sale': t('inventory.deductModal.reasons.sale'), 'Production Consumption': t('inventory.deductModal.reasons.production'),
      'Damaged': t('inventory.deductModal.reasons.damaged'), 'Expired': t('inventory.deductModal.reasons.expired'),
      'Return to Supplier': t('inventory.deductModal.reasons.returnToSupplier'),
      'Periodic Inventory': t('inventory.deductModal.reasons.periodicInventory'),
      'Error Correction': t('inventory.deductModal.reasons.errorCorrection'), 'Loss': t('inventory.deductModal.reasons.loss'),
      'Vente': t('inventory.deductModal.reasons.sale'), 'Consommation de production': t('inventory.deductModal.reasons.production'),
      'Endommagé': t('inventory.deductModal.reasons.damaged'), 'Expiré': t('inventory.deductModal.reasons.expired'),
      'Retour au fournisseur': t('inventory.deductModal.reasons.returnToSupplier'),
      'Inventaire périodique': t('inventory.deductModal.reasons.periodicInventory'),
      "Correction d'erreur": t('inventory.deductModal.reasons.errorCorrection'), 'Perte': t('inventory.deductModal.reasons.loss'),
      'شراء مخزون جديد': t('inventory.addModal.reason'), 'المخزون الأولي': t('inventory.addModal.initialStock'),
      'New stock purchase': t('inventory.addModal.reason'), 'Initial stock': t('inventory.addModal.initialStock'),
      'Achat de nouveau stock': t('inventory.addModal.reason'), 'Stock initial': t('inventory.addModal.initialStock'),
      'نقل إلى المخزون الحالي': t('inventory.transferModal.title'),
      'Transfer to current inventory': t('inventory.transferModal.title'),
      'Transfert vers l\'inventaire actuel': t('inventory.transferModal.title'),
      'إرجاع من المخزون الحالي': t('inventory.returnModal.title'),
      'Return from current inventory': t('inventory.returnModal.title'),
      'Retour de l\'inventaire actuel': t('inventory.returnModal.title'),
    };
    return reasonMap[reason] || reason;
  };

  const socketRef = useRef<Socket | null>(null);

  const lowStockItems = useMemo(() => warehouseItems.filter(item => item.currentStock <= item.minStock), [warehouseItems]);
  const totalValue = useMemo(() => warehouseItems.reduce((sum, item) => sum + (item.totalValue || (item.currentStock * item.price)), 0), [warehouseItems]);
  const categoriesCount = useMemo(() => new Set(warehouseItems.map(item => item.category)).size, [warehouseItems]);
  const rawMaterialsCount = useMemo(() => warehouseItems.filter(item => item.isRawMaterial).length, [warehouseItems]);

  const filteredItems = useMemo(() => {
    return warehouseItems.filter(item => {
      if (searchTerm && !item.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      if (filterCategory && item.category !== filterCategory) return false;
      if (filterType === 'raw' && !item.isRawMaterial) return false;
      if (filterType === 'product' && item.isRawMaterial) return false;
      if (filterStock === 'low' && item.currentStock > item.minStock) return false;
      if (filterStock === 'out' && item.currentStock > 0) return false;
      if (filterDateFrom && filterDateTo) {
        const itemDate = new Date(item.createdAt);
        const from = new Date(filterDateFrom);
        const to = new Date(filterDateTo);
        to.setHours(23, 59, 59, 999);
        if (itemDate < from || itemDate > to) return false;
      }
      if (filterMonth) {
        const itemDate = new Date(item.createdAt);
        const itemMonth = `${itemDate.getFullYear()}-${String(itemDate.getMonth() + 1).padStart(2, '0')}`;
        if (itemMonth !== filterMonth) return false;
      }
      if (filterYear) {
        const itemDate = new Date(item.createdAt);
        if (itemDate.getFullYear().toString() !== filterYear) return false;
      }
      return true;
    });
  }, [warehouseItems, searchTerm, filterCategory, filterType, filterStock, filterDateFrom, filterDateTo, filterMonth, filterYear]);

  useEffect(() => { fetchWarehouseItems(); fetchMenuCategories(); }, []);

  useEffect(() => {
    if (socketRef.current) return;
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    const socketUrl = apiUrl.replace(/\/api\/?$/, '');
    const socket = io(socketUrl, {
      path: '/socket.io/', transports: ['websocket', 'polling'],
      reconnection: true, reconnectionDelay: 1000, reconnectionAttempts: 5,
    });
    socketRef.current = socket;
    socket.on('inventory-update', async () => {
      await fetchWarehouseItems();
      if (showMovementsModal && selectedItem) {
        await refreshStockMovements(selectedItem.id || selectedItem._id);
      }
    });
    socket.on('connect', () => {});
    socket.on('disconnect', () => {});
    return () => {
      socket.off('inventory-update'); socket.off('connect'); socket.off('disconnect');
      socket.disconnect(); socketRef.current = null;
    };
  }, [showMovementsModal, selectedItem]);

  const fetchMenuCategories = async () => {
    try {
      const response = await api.getMenuCategories();
      if (response.success && response.data) {
        setMenuCategories(response.data.map((cat: any) => ({ id: cat.id || cat._id, name: cat.name })));
      }
    } catch (error) { console.error('Error fetching menu categories:', error); }
  };

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowAddModal(false); setShowEditModal(false); setShowDeleteModal(false);
        setShowMovementsModal(false); setShowDeductModal(false);
        setShowEditMovementModal(false); setShowDeleteMovementModal(false); setDeletingMovementId(null);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  const calculateRemainingAmount = () => {
    const totalAmount = parseFloat(addForm.price || '0') * parseFloat(addForm.quantity || '0');
    const paidAmount = parseFloat(addForm.paidAmount || '0');
    return Math.max(0, totalAmount - paidAmount);
  };

  const updatePaymentStatus = () => {
    const totalAmount = parseFloat(addForm.price || '0') * parseFloat(addForm.quantity || '0');
    const paidAmount = parseFloat(addForm.paidAmount || '0');
    if (paidAmount >= totalAmount && totalAmount > 0) setAddForm(prev => ({ ...prev, costStatus: 'paid' }));
    else if (paidAmount > 0 && paidAmount < totalAmount) setAddForm(prev => ({ ...prev, costStatus: 'partially_paid' }));
    else setAddForm(prev => ({ ...prev, costStatus: 'pending' }));
  };

  useEffect(() => { updatePaymentStatus(); }, [addForm.price, addForm.quantity, addForm.paidAmount]);

  const getStockStatus = (current: number, min: number) => {
    if (current <= min) return { status: 'low', color: 'text-red-600', bgColor: 'bg-red-50' };
    if (current <= min * 1.5) return { status: 'medium', color: 'text-yellow-600', bgColor: 'bg-yellow-50' };
    return { status: 'good', color: 'text-green-600', bgColor: 'bg-green-50' };
  };

  const openAddModal = (type?: 'existing' | 'new') => {
    setAddType(type || 'existing');
    setAddForm({
      productId: '', name: '', category: '', quantity: '', price: '', supplier: '', minStock: '', unit: '',
      date: getCairoDateTime(timezone), costStatus: 'pending', paidAmount: '', isRawMaterial: false,
    });
    setProductSearchTerm('');
    setShowProductDropdown(false);
    setError(''); setSuccess(''); setShowAddModal(true);
  };

  const openEditModal = (item: WarehouseItem) => {
    setSelectedItem(item);
    setAddForm({
      name: item.name, category: normalizeCategory(item.category), quantity: '', price: String(item.price),
      supplier: item.supplier || '', minStock: String(item.minStock || ''),
      unit: normalizeUnit(item.unit || ''), date: getCairoDateTime(timezone),
      costStatus: 'pending', paidAmount: '', isRawMaterial: item.isRawMaterial || false,
    });
    setError(''); setSuccess(''); setShowEditModal(true);
  };

  const openDeleteModal = (item: WarehouseItem) => { setDeleteTarget(item); setShowDeleteModal(true); };

  const openMovementsModal = async (item: WarehouseItem) => {
    setSelectedItem(item); setLoading(true);
    try {
      const itemResponse = await api.getWarehouseItem(item.id || item._id);
      if (itemResponse.success && itemResponse.data) setSelectedItem(itemResponse.data);
      const response = await api.getWarehouseStockMovements(item.id || item._id);
      if (response.success && response.data) setItemMovements(response.data); else setItemMovements([]);
    } catch (error) {
      setItemMovements([]);
      toast.error(t('inventory.notifications.movementsLoadError'));
    } finally { setLoading(false); setShowMovementsModal(true); }
  };

  const refreshStockMovements = async (itemId: string) => {
    try {
      const itemResponse = await api.getWarehouseItem(itemId);
      if (itemResponse.success && itemResponse.data) setSelectedItem(itemResponse.data);
      const response = await api.getWarehouseStockMovements(itemId);
      if (response.success && response.data) setItemMovements(response.data);
    } catch (error) { console.error('Error refreshing stock movements:', error); }
  };

  const openDeductModal = (item: WarehouseItem) => {
    setSelectedItem(item);
    setDeductForm({ quantity: '', reason: '', type: 'out', date: getCairoDateTime(timezone) });
    setError(''); setShowDeductModal(true);
  };

  const handleDeductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;
    setLoading(true); setError('');
    try {
      const quantity = Number(deductForm.quantity);
      if (!quantity || quantity <= 0) { setError(t('inventory.messages.enterValidQuantity')); setLoading(false); return; }
      if (deductForm.type === 'out' && quantity > selectedItem.currentStock) {
        setError(t('inventory.messages.quantityExceedsStock', { stock: selectedItem.currentStock, unit: selectedItem.unit })); setLoading(false); return;
      }
      if (!deductForm.reason) { setError(t('inventory.messages.enterReason')); setLoading(false); return; }
      const res = await updateWarehouseStock(selectedItem.id || selectedItem._id, {
        type: deductForm.type, quantity, reason: deductForm.reason, date: deductForm.date,
      });
      if (res) {
        toast.success(deductForm.type === 'adjustment' ? t('inventory.notifications.stockAdjusted') : t('inventory.notifications.stockDeducted'));
        await fetchWarehouseItems(); setShowDeductModal(false);
        setDeductForm({ quantity: '', reason: '', type: 'out', date: getCairoDateTime(timezone) });
        setError('');
      } else { setError(t('inventory.notifications.stockUpdateError')); }
    } catch (err) { const error = err as Error; setError(error.message || t('inventory.notifications.stockUpdateError')); }
    finally { setLoading(false); }
  };

  const openEditMovementModal = (movement: any) => {
    setEditingMovement(movement);
    let orgDateTime = '';
    if (movement.timestamp) {
      const movementDate = new Date(movement.timestamp);
      const orgTime = new Date(movementDate.toLocaleString('en-US', { timeZone: timezone }));
      const year = orgTime.getFullYear(); const month = String(orgTime.getMonth() + 1).padStart(2, '0');
      const day = String(orgTime.getDate()).padStart(2, '0');
      const hours = String(orgTime.getHours()).padStart(2, '0'); const minutes = String(orgTime.getMinutes()).padStart(2, '0');
      orgDateTime = `${year}-${month}-${day}T${hours}:${minutes}`;
    }
    setEditMovementForm({
      quantity: movement.quantity.toString(), price: movement.price ? movement.price.toString() : '',
      reason: movement.reason || '', date: orgDateTime || getCairoDateTime(timezone),
    });
    setShowEditMovementModal(true);
  };

  const handleEditMovementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || !editingMovement) return;
    setLoading(true); setError('');
    try {
      const quantity = Number(editMovementForm.quantity);
      const price = editMovementForm.price ? Number(editMovementForm.price) : undefined;
      if (!quantity || quantity <= 0) { setError(t('inventory.messages.enterValidQuantity')); setLoading(false); return; }
      if (!editMovementForm.reason) { setError(t('inventory.messages.enterReason')); setLoading(false); return; }
      const response = await api.put(`/warehouse/${selectedItem.id || selectedItem._id}/movements/${editingMovement._id}`, {
        quantity, price, reason: editMovementForm.reason, date: editMovementForm.date,
      });
      if (response?.data?.success || response?.success) {
        toast.success(t('inventory.notifications.movementUpdated'));
        setShowEditMovementModal(false); setError('');
        Promise.all([refreshStockMovements(selectedItem.id || selectedItem._id), fetchWarehouseItems()]).catch(console.error);
      } else { setError(t('inventory.notifications.movementUpdateError')); }
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || t('inventory.notifications.movementUpdateError');
      setError(errorMessage); toast.error(errorMessage);
    } finally { setLoading(false); }
  };

  const handleDeleteMovement = async (movementId: string) => {
    if (!selectedItem) return;
    setDeletingMovementId(movementId);
    setShowDeleteMovementModal(true);
  };

  const confirmDeleteMovement = async () => {
    if (!selectedItem || !deletingMovementId) return;
    setLoading(true);
    try {
      const response = await api.delete(`/warehouse/${selectedItem.id || selectedItem._id}/movements/${deletingMovementId}`);
      if (response?.data?.success || response?.success) {
        toast.success(t('inventory.notifications.movementDeleted'));
        setShowDeleteMovementModal(false); setDeletingMovementId(null);
        Promise.all([refreshStockMovements(selectedItem.id || selectedItem._id), fetchWarehouseItems()]).catch(console.error);
      } else { toast.error(t('inventory.notifications.movementDeleteError')); }
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || t('inventory.notifications.movementDeleteError'));
    } finally { setLoading(false); }
  };

  const handleAddTypeChange = (type: 'existing' | 'new') => {
    setAddType(type);
    setProductSearchTerm('');
    setShowProductDropdown(false);
    setAddForm({
      productId: '', name: '', category: '', quantity: '', price: '', supplier: '', minStock: '', unit: '',
      date: getCairoDateTime(timezone), costStatus: 'pending', paidAmount: '', isRawMaterial: false,
    });
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'paidAmount') {
      const quantity = parseFloat(addForm.quantity) || 0;
      const price = parseFloat(addForm.price) || 0;
      const totalCost = quantity * price;
      let paidAmount = parseFloat(value) || 0;
      if (paidAmount > totalCost) paidAmount = totalCost;
      setAddForm(prev => ({ ...prev, [name]: paidAmount.toString() }));
    } else if (name === 'costStatus' && value === 'paid') {
      const quantity = parseFloat(addForm.quantity) || 0;
      const price = parseFloat(addForm.price) || 0;
      const totalCost = quantity * price;
      setAddForm(prev => ({ ...prev, [name]: value, paidAmount: totalCost.toString() }));
    } else if (name === 'paidAmount' && value === '') {
      setAddForm(prev => ({ ...prev, [name]: '0' }));
    } else {
      setAddForm(prev => ({ ...prev, [name]: value }));
    }
  };

  const showAlertMessage = (message: string, type: 'success' | 'error' = 'success') => {
    setAlertMessage(message); setAlertType(type); setShowAlert(true);
    setTimeout(() => setShowAlert(false), 5000);
  };

  const closeAlert = () => { setShowAlert(false); };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError(''); setSuccess('');
    try {
      if (addType === 'existing') {
        if (!addForm.productId || !addForm.quantity) {
          setError(t('inventory.messages.enterAllFields')); showAlertMessage(t('inventory.messages.fillAllFields'), 'error'); setLoading(false); return;
        }
        const res = await updateWarehouseStock(addForm.productId, {
          type: 'in', quantity: Number(addForm.quantity), reason: t('warehouse.addStock'),
          date: getCairoDateTime(timezone), costStatus: addForm.costStatus,
          paidAmount: Number(addForm.paidAmount) || 0,
        });
        if (res) {
          setSuccess(t('inventory.notifications.productAdded')); toast.success(t('inventory.notifications.productAdded'));
          await fetchWarehouseItems(); setShowAddModal(false);
          setAddForm({ productId: '', name: '', category: '', quantity: '', price: '', supplier: '', minStock: '', unit: '', date: getCairoDateTime(timezone), costStatus: 'pending', paidAmount: '', isRawMaterial: false });
          setError(''); setSuccess('');
        } else { setError(t('inventory.notifications.productAddError')); }
      } else {
        if (!addForm.name || !addForm.category || !addForm.quantity || !addForm.price || !addForm.unit || !addForm.minStock) {
          setError(t('inventory.messages.enterAllFields')); showAlertMessage(t('inventory.messages.fillAllFields'), 'error'); setLoading(false); return;
        }
        const res = await createWarehouseItem({
          name: addForm.name, category: addForm.category, currentStock: Number(addForm.quantity),
          minStock: Number(addForm.minStock), unit: addForm.unit, price: Number(addForm.price),
          supplier: addForm.supplier, costStatus: addForm.costStatus,
          paidAmount: Number(addForm.paidAmount) || 0, isRawMaterial: addForm.isRawMaterial,
        });
        if (res) {
          setSuccess(t('inventory.notifications.productAdded')); toast.success(t('inventory.notifications.productAdded'));
          await fetchWarehouseItems(); setShowAddModal(false);
          setAddForm({ productId: '', name: '', category: '', quantity: '', price: '', supplier: '', minStock: '', unit: '', date: getCairoDateTime(timezone), costStatus: 'pending', paidAmount: '', isRawMaterial: false });
          setError(''); setSuccess('');
        } else { setError(t('inventory.notifications.productAddError')); }
      }
    } catch (err) {
      const error = err as Error;
      setError(error.message || t('inventory.notifications.productAddError'));
    } finally { setLoading(false); }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError(''); setSuccess('');
    try {
      if (!selectedItem) { const msg = t('inventory.messages.noProductSelected'); setError(msg); showAlertMessage(msg, 'error'); setLoading(false); return; }
      if (!addForm.name || !addForm.category || !addForm.price || !addForm.unit || !addForm.minStock) {
        setError(t('inventory.messages.enterAllFields')); showAlertMessage(t('inventory.messages.enterAllFields'), 'error'); setLoading(false); return;
      }
      const res = await updateWarehouseItem(selectedItem.id || selectedItem._id, {
        name: addForm.name, category: addForm.category, price: Number(addForm.price),
        minStock: Number(addForm.minStock), unit: addForm.unit, supplier: addForm.supplier, isRawMaterial: addForm.isRawMaterial,
      });
      if (res) {
        setSuccess(t('inventory.notifications.productUpdated')); toast.success(t('inventory.notifications.productUpdated'));
        await fetchWarehouseItems(); setShowEditModal(false);
        setAddForm({ name: '', category: '', quantity: '', price: '', supplier: '', minStock: '', unit: '', date: getCairoDateTime(timezone), costStatus: 'pending', paidAmount: '', isRawMaterial: false });
        setError(''); setSuccess('');
      } else { setError(t('inventory.notifications.productUpdateError')); }
    } catch (err) { const error = err as Error; setError(error.message || t('inventory.notifications.productUpdateError')); }
    finally { setLoading(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setLoading(true); setError('');
    try {
      const res = await api.deleteWarehouseItem(deleteTarget.id || deleteTarget._id);
      if (res.success) {
        toast.success(t('inventory.notifications.productDeleted')); showAlertMessage(t('inventory.notifications.productDeleted'), 'success');
        fetchWarehouseItems(); setShowDeleteModal(false);
      } else { const msg = t('inventory.notifications.productDeleteError'); setError(msg); showAlertMessage(msg, 'error'); }
    } catch (err) { const msg = t('inventory.notifications.productDeleteError'); setError(msg); showAlertMessage(msg, 'error'); }
    finally { setLoading(false); }
  };

  const navigate = useNavigate();

  return (
    <ConfigProvider direction={i18n.language === 'ar' ? 'rtl' : 'ltr'} locale={getAntdLocale()}>
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Alert */}
      {showAlert && (
        <div className={`fixed top-4 right-4 z-[9999] p-4 rounded-lg shadow-lg ${
          alertType === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`}>
          <div className="flex items-center justify-between">
            <span>{alertMessage}</span>
            <button onClick={closeAlert} className="mr-4 text-white hover:text-gray-200">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap xs:flex-col xs:items-start xs:gap-2 xs:space-y-2 xs:w-full">
        <div className="flex items-center xs:w-full xs:justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center xs:text-base xs:w-full xs:text-center">
            <Package className={`h-6 w-6 text-orange-600 dark:text-orange-400 ${isRTL ? 'ml-2' : 'mr-2'}`} />
            {t('warehouse.title')}
          </h1>
          <p className={`text-gray-600 dark:text-gray-300 ${isRTL ? 'mr-4' : 'ml-4'} xs:mr-0 xs:w-full xs:text-center`}>{t('warehouse.subtitle')}</p>
        </div>
        <PermissionGuard requiredPermissions={['canAddInventoryItem', 'canAddStock', 'all']}>
          <button onClick={() => openAddModal()}
            className="bg-orange-600 hover:bg-orange-700 dark:bg-orange-500 dark:hover:bg-orange-600 text-white px-4 py-2 rounded-lg flex items-center transition-colors duration-200 xs:w-full xs:justify-center xs:mt-2">
            <Plus className={`h-5 w-5 ${isRTL ? 'ml-2' : 'mr-2'}`} />
            {t('inventory.addStock')}
          </button>
        </PermissionGuard>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
              <Package className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="mr-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">{t('inventory.stats.totalProducts')}</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{formatDecimal(warehouseItems.length, i18n.language)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
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
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
              <Package className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div className="mr-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">{t('inventory.stats.inventoryValue')}</p>
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
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">{t('inventory.stats.categories')}</p>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{formatDecimal(categoriesCount, i18n.language)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
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
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">{t('warehouse.title')}</h3>

          {/* Filters */}
          <div className="space-y-3">
            {/* Basic Filters */}
            <div className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
              <button onClick={() => setShowBasicFilters(!showBasicFilters)}
                className="w-full bg-gray-50 dark:bg-gray-700 px-4 py-3 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
                <span className="font-medium text-gray-900 dark:text-gray-100">{t('inventory.filters.basicFilters')}</span>
                {showBasicFilters ? <ChevronUp className="h-5 w-5 text-gray-600 dark:text-gray-300" /> : <ChevronDown className="h-5 w-5 text-gray-600 dark:text-gray-300" />}
              </button>
              {showBasicFilters && (
                <div className="p-4 space-y-3">
                  <div className="flex flex-wrap gap-3">
                    <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                      placeholder={t('inventory.filters.searchPlaceholder')}
                      className="flex-1 min-w-[200px] border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2.5 dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500" />
                    <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
                      className="border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2.5 dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500">
                      <option value="">{t('inventory.filters.allCategories')}</option>
                      {categoryOptions.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                    <select value={filterType} onChange={e => setFilterType(e.target.value)}
                      className="border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2.5 dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500">
                      <option value="">{t('inventory.filters.all')}</option>
                      <option value="raw">{t('inventory.filters.rawOnly')}</option>
                      <option value="product">{t('inventory.filters.productsOnly')}</option>
                    </select>
                    <select value={filterStock} onChange={e => setFilterStock(e.target.value)}
                      className="border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2.5 dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500">
                      <option value="">{t('inventory.filters.all')}</option>
                      <option value="low">{t('inventory.filters.lowOnly')}</option>
                      <option value="out">{t('inventory.filters.outOnly')}</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Date Filters */}
            <div className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
              <button onClick={() => setShowDateFilters(!showDateFilters)}
                className="w-full bg-gray-50 dark:bg-gray-700 px-4 py-3 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
                <span className="font-medium text-gray-900 dark:text-gray-100">{t('inventory.filters.dateFilters')}</span>
                {showDateFilters ? <ChevronUp className="h-5 w-5 text-gray-600 dark:text-gray-300" /> : <ChevronDown className="h-5 w-5 text-gray-600 dark:text-gray-300" />}
              </button>
              {showDateFilters && (
                <div className="p-4">
                  <div className="flex flex-wrap gap-3 items-center">
                    <select value={dateFilterType} onChange={e => setDateFilterType(e.target.value as 'range' | 'month' | 'year')}
                      className="border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2.5 dark:bg-gray-700 dark:text-gray-100">
                      <option value="range">{t('inventory.filters.range')}</option>
                      <option value="month">{t('inventory.filters.specificMonth')}</option>
                      <option value="year">{t('inventory.filters.specificYear')}</option>
                    </select>
                    {dateFilterType === 'range' && (
                      <>
                        <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)}
                          className="border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2.5 dark:bg-gray-700 dark:text-gray-100" />
                        <span className="text-gray-500">{t('inventory.filters.toDate')}</span>
                        <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)}
                          className="border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2.5 dark:bg-gray-700 dark:text-gray-100" />
                      </>
                    )}
                    {dateFilterType === 'month' && (
                      <input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
                        className="border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2.5 dark:bg-gray-700 dark:text-gray-100" />
                    )}
                    {dateFilterType === 'year' && (
                      <input type="number" value={filterYear} onChange={e => setFilterYear(e.target.value)} placeholder="YYYY"
                        className="border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2.5 dark:bg-gray-700 dark:text-gray-100 w-24" />
                    )}
                    {(filterDateFrom || filterDateTo || filterMonth || filterYear) && (
                      <button onClick={() => { setFilterDateFrom(''); setFilterDateTo(''); setFilterMonth(''); setFilterYear(''); }}
                        className="text-red-600 hover:text-red-800 text-sm font-medium">
                        {t('inventory.filters.resetAll')}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t('inventory.table.product')}</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t('inventory.table.category')}</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t('inventory.table.currentStock')}</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t('inventory.table.minStock')}</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t('inventory.table.unit')}</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t('inventory.table.lastPurchasePrice')}</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t('inventory.table.totalValue')}</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t('inventory.table.supplier')}</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">{t('inventory.table.actions')}</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center">
                      <Package className="h-12 w-12 text-gray-400 mb-4" />
                      <p className="text-lg font-medium text-gray-500 dark:text-gray-400">{t('inventory.table.noProducts')}</p>
                      <p className="text-sm text-gray-400 dark:text-gray-500">{t('inventory.table.noProducts')}</p>
                    </div>
                  </td>
                </tr>
              ) : (filteredItems.map(item => {
                const stock = getStockStatus(item.currentStock, item.minStock);
                return (
                  <tr key={item.id || item._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className={`w-2 h-2 rounded-full ml-2 ${
                          stock.status === 'low' ? 'bg-red-500' : stock.status === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                        }`} />
                        <span className="font-medium text-gray-900 dark:text-gray-100">{item.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{translateCategory(item.category)}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`font-medium ${stock.color}`}>{formatQuantity(item.currentStock, translateUnit(item.unit), i18n.language)}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{formatQuantity(item.minStock, translateUnit(item.unit), i18n.language)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{translateUnit(item.unit)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{formatCurrency(item.price)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">{formatCurrency(item.totalValue || (item.currentStock * item.price))}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{item.supplier}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2 space-x-reverse">
                      <PermissionGuard requiredPermissions={['canViewStockMovements', 'canViewInventory', 'all']}>
                        <button onClick={() => openMovementsModal(item)}
                          className="text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300 inline-flex items-center"
                          title={t('inventory.table.movementsHistory')}>
                          <History className="h-4 w-4" />
                        </button>
                      </PermissionGuard>
                      <PermissionGuard requiredPermissions={['canAddStock', 'canRemoveStock', 'canAdjustStock', 'all']}>
                        <button onClick={() => openDeductModal(item)}
                          className="text-orange-600 hover:text-orange-800 dark:text-orange-400 dark:hover:text-orange-300 inline-flex items-center"
                          title={t('inventory.table.deductQuantity')}>
                          <Minus className="h-4 w-4" />
                        </button>
                      </PermissionGuard>
                      <PermissionGuard requiredPermissions={['canEditInventoryItem', 'all']}>
                        <button onClick={() => openEditModal(item)}
                          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                          title={t('inventory.table.edit')}>
                          <Edit className="h-4 w-4" />
                        </button>
                      </PermissionGuard>
                      <PermissionGuard requiredPermissions={['canDeleteInventoryItem', 'all']}>
                        <button onClick={() => { setDeleteTarget(item); setShowDeleteModal(true); }}
                          className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                          title={t('inventory.table.delete')}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </PermissionGuard>
                    </td>
                  </tr>
                );
              }))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Modal */}
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
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t('inventory.addModal.title')}</h2>
                <button
                  className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 text-2xl font-bold transition-colors duration-200"
                  onClick={() => setShowAddModal(false)}
                >×</button>
              </div>
            </div>
            <div className="p-6">
            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('inventory.addModal.addType')}</label>
                <select name="addType" value={addType} onChange={(e) => handleAddTypeChange(e.target.value as 'existing' | 'new')} className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-gray-100">
                  <option value="existing">{t('inventory.addModal.addToExisting')}</option>
                  <option value="new">{t('inventory.addModal.addNew')}</option>
                </select>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {addType === 'existing' 
                    ? t('inventory.addModal.existingHint')
                    : t('inventory.addModal.newHint')}
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
                      <div className={`${isRTL ? 'mr-3' : 'ml-3'}`}>
                        <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">{t('inventory.addModal.infoTitle')}</h3>
                        <div className="mt-1 text-sm text-blue-700 dark:text-blue-300">
                          <p>{t('inventory.addModal.infoLine1')}</p>
                          <p>{t('inventory.addModal.infoLine2')}</p>
                          <p>{t('inventory.addModal.infoLine3')}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="md:col-span-2 lg:col-span-3">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('inventory.addModal.selectProduct')}</label>
                    <div className="relative product-dropdown-container">
                      <input
                        type="text"
                        placeholder={t('inventory.addModal.searchProduct')}
                        value={productSearchTerm}
                        onChange={(e) => setProductSearchTerm(e.target.value)}
                        onFocus={() => setShowProductDropdown(true)}
                        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 dark:bg-gray-700 dark:text-gray-100 text-base"
                      />
                      {showProductDropdown && (
                        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                          {filteredProducts.length === 0 ? (
                            <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                              {productSearchTerm ? t('inventory.addModal.noResults') : t('inventory.addModal.startTyping')}
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
                                  {translateCategory(item.category)} - {t('inventory.addModal.stockInfo')}: {formatQuantity(item.currentStock, translateUnit(item.unit), i18n.language)}
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
                      <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">{t('inventory.addModal.selectFromList')}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('inventory.addModal.quantity')}</label>
                    <input type="number" name="quantity" value={addForm.quantity} onChange={handleFormChange} className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 dark:bg-gray-700 dark:text-gray-100 text-base" required min="0.01" step="0.01" placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('inventory.addModal.price')}</label>
                    <input type="number" name="price" value={addForm.price} onChange={handleFormChange} className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 dark:bg-gray-700 dark:text-gray-100 text-base" required min="0" step="0.01" placeholder="0.00" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('inventory.addModal.supplier')}</label>
                    <input type="text" name="supplier" value={addForm.supplier} onChange={handleFormChange} className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 dark:bg-gray-700 dark:text-gray-100 text-base" placeholder={t('inventory.addModal.supplierPlaceholder')} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('inventory.addModal.date')}</label>
                    <DatePicker
                      showTime
                      value={addForm.date ? dayjs(addForm.date) : null}
                      onChange={(date) => {
                        const event = {
                          target: {
                            name: 'date',
                            value: date ? date.format('YYYY-MM-DDTHH:mm') : ''
                          }
                        } as React.ChangeEvent<HTMLInputElement>;
                        handleFormChange(event);
                      }}
                      format="YYYY/MM/DD HH:mm"
                      className="w-full"
                      size="large"
                      placeholder={t('inventory.addModal.date')}
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('inventory.addModal.dateHint')}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('inventory.addModal.costStatus')}</label>
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
                        {t('inventory.addModal.paidAmount')}
                        {addForm.costStatus === 'partially_paid' && (
                          <span className="text-xs text-gray-500 mr-2">({t('inventory.addModal.partial')})</span>
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
                          {t('inventory.addModal.remaining')}: {formatCurrency(calculateRemainingAmount())}
                        </div>
                      )}
                    </div>
                  )}
                  </div>

                  {/* Cost Summary */}
                  {addForm.price && addForm.quantity && (
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                      <div className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-3">{t('inventory.addModal.costSummary')}</div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">{t('inventory.addModal.totalCost')}:</span>
                          <div className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatCurrency(parseFloat(addForm.price || '0') * parseFloat(addForm.quantity || '0'))}</div>
                        </div>
                        {addForm.paidAmount && (
                          <>
                            <div>
                              <span className="text-gray-600 dark:text-gray-400">{t('inventory.addModal.paid')}:</span>
                              <div className="text-lg font-bold text-green-600 dark:text-green-400">{formatCurrency(parseFloat(addForm.paidAmount || '0'))}</div>
                            </div>
                            <div>
                              <span className="text-gray-600 dark:text-gray-400">{t('inventory.addModal.remaining')}:</span>
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
                  {/* Important note */}
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
                          <p>{t('inventory.addModal.noteDifferentBranches')}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('inventory.addModal.productName')}</label>
                    <input type="text" name="name" value={addForm.name} onChange={handleFormChange} className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-gray-100" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('inventory.addModal.category')}</label>
                    <select name="category" value={addForm.category} onChange={handleFormChange} className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-gray-100" required>
                      <option value="">{t('inventory.addModal.selectCategory')}</option>
                      {categoryOptions.map(option => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('inventory.addModal.quantity')}</label>
                    <input type="number" name="quantity" value={addForm.quantity} onChange={handleFormChange} className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-gray-100" required min="0" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('inventory.addModal.unit')}</label>
                    <select name="unit" value={addForm.unit} onChange={handleFormChange} className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-gray-100" required>
                      <option value="">{t('inventory.addModal.selectUnit')}</option>
                      {unitOptions.map(option => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('inventory.addModal.minStock')}</label>
                    <input type="number" name="minStock" value={addForm.minStock} onChange={handleFormChange} className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-gray-100" required min="0" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('inventory.addModal.price')}</label>
                    <input type="number" name="price" value={addForm.price} onChange={handleFormChange} className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-gray-100" required min="0" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('inventory.addModal.supplier')}</label>
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
                      <span className={`${isRTL ? 'mr-2' : 'ml-2'} text-sm text-gray-700 dark:text-gray-300`}>{t('inventory.addModal.isRawMaterial')}</span>
                    </label>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('inventory.addModal.rawMaterialHint')}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('inventory.addModal.costStatus')}</label>
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

                  {/* Paid fields - only if not paid */}
                  {addForm.costStatus !== 'paid' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          {t('inventory.addModal.paidAmount')}
                          {addForm.costStatus === 'partially_paid' && (
                            <span className="text-xs text-gray-500 mr-2">({t('inventory.addModal.partial')})</span>
                          )}
                        </label>
                        <input
                          type="number"
                          name="paidAmount"
                          value={addForm.paidAmount}
                          onChange={handleFormChange}
                          className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-gray-100"
                          min="0"
                          max={parseFloat(addForm.price || '0') * parseFloat(addForm.quantity || '0')}
                          placeholder="0"
                        />
                        {addForm.paidAmount && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {t('inventory.addModal.remaining')}: {formatCurrency(calculateRemainingAmount())}
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {/* Cost Summary */}
                  {addForm.price && addForm.quantity && (
                    <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                      <div className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">{t('inventory.addModal.costSummary')}:</div>
                      <div className="text-sm text-gray-600 dark:text-gray-300">
                        <div>{t('inventory.addModal.totalCost')}: {formatCurrency(parseFloat(addForm.price || '0') * parseFloat(addForm.quantity || '0'))}</div>
                        {addForm.paidAmount && (
                          <>
                            <div>{t('inventory.addModal.paid')}: {formatCurrency(parseFloat(addForm.paidAmount || '0'))}</div>
                            <div>{t('inventory.addModal.remaining')}: {formatCurrency(calculateRemainingAmount())}</div>
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



      {/* Edit Modal */}
      {showEditModal && selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowEditModal(false); }}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">{t('inventory.editModal.title')}</h3>
              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('inventory.addModal.productName')}</label>
                    <input type="text" name="name" value={addForm.name} onChange={handleFormChange}
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 dark:bg-gray-700 dark:text-gray-100" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('inventory.addModal.category')}</label>
                    <select name="category" value={addForm.category} onChange={handleFormChange}
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 dark:bg-gray-700 dark:text-gray-100" required>
                      <option value="">{t('inventory.addModal.selectCategory')}</option>
                      {categoryOptions.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('inventory.addModal.price')}</label>
                    <input type="number" name="price" value={addForm.price} onChange={handleFormChange}
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 dark:bg-gray-700 dark:text-gray-100" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('inventory.addModal.minStock')}</label>
                    <input type="number" name="minStock" value={addForm.minStock} onChange={handleFormChange}
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 dark:bg-gray-700 dark:text-gray-100" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('inventory.addModal.unit')}</label>
                    <select name="unit" value={addForm.unit} onChange={handleFormChange}
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 dark:bg-gray-700 dark:text-gray-100" required>
                      <option value="">{t('inventory.addModal.selectUnit')}</option>
                      {unitOptions.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('inventory.addModal.supplier')}</label>
                    <input type="text" name="supplier" value={addForm.supplier} onChange={handleFormChange}
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 dark:bg-gray-700 dark:text-gray-100" />
                  </div>
                  <div className="flex items-end pb-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={addForm.isRawMaterial} onChange={e => setAddForm({...addForm, isRawMaterial: e.target.checked})}
                        className="rounded border-gray-300 text-orange-600 focus:ring-orange-500" />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{t('inventory.addModal.isRawMaterial')}</span>
                    </label>
                  </div>
                </div>

                {error && <p className="text-red-600 text-sm bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">{error}</p>}
                {success && <p className="text-green-600 text-sm bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">{success}</p>}

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-600">
                  <button type="button" onClick={() => setShowEditModal(false)}
                    className="px-6 py-2.5 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                    {t('common.cancel')}
                  </button>
                  <button type="submit" disabled={loading}
                    className="px-6 py-2.5 bg-orange-600 hover:bg-orange-700 dark:bg-orange-500 dark:hover:bg-orange-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                    {loading ? (
                      <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                      {t('inventory.editModal.updating')}</>
                    ) : (
                      <><Edit2 className="h-4 w-4" />{t('inventory.editModal.update')}</>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && deleteTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowDeleteModal(false); }}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">{t('inventory.deleteModal.title')}</h3>
              <p className="text-gray-600 dark:text-gray-300 mb-6">{t('inventory.deleteModal.confirmMessage')}</p>
              {error && <p className="text-red-600 text-sm bg-red-50 dark:bg-red-900/20 p-3 rounded-lg mb-4">{error}</p>}
              <div className="flex justify-end gap-3">
                <button onClick={() => setShowDeleteModal(false)}
                  className="px-6 py-2.5 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                  {t('common.cancel')}
                </button>
                <button onClick={handleDelete} disabled={loading}
                  className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                  {loading ? (
                    <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                    {t('inventory.deleteModal.deleting')}</>
                  ) : (
                    <><Trash2 className="h-4 w-4" />{t('inventory.deleteModal.confirm')}</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Deduct Modal */}
      {showDeductModal && selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowDeductModal(false); }}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">{deductForm.type === 'out' ? t('inventory.deductModal.title') : t('inventory.deductModal.adjustStock')}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                {t('inventory.deductModal.currentStock')}: <span className="font-semibold">{formatQuantity(selectedItem.currentStock, translateUnit(selectedItem.unit), i18n.language)}</span>
              </p>
              <form onSubmit={handleDeductSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('inventory.deductModal.deductType')}</label>
                  <select value={deductForm.type} onChange={e => setDeductForm({...deductForm, type: e.target.value as 'out' | 'adjustment'})}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 dark:bg-gray-700 dark:text-gray-100">
                    <option value="out">{t('inventory.deductModal.out')}</option>
                    <option value="adjustment">{t('inventory.deductModal.adjustment')}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {deductForm.type === 'out' ? t('inventory.deductModal.quantityToDeduct') : t('inventory.deductModal.correctStock')}
                  </label>
                  <input type="number" value={deductForm.quantity} onChange={e => setDeductForm({...deductForm, quantity: e.target.value})}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 dark:bg-gray-700 dark:text-gray-100" required />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('inventory.deductModal.reason')}</label>
                  <select value={deductForm.reason} onChange={e => setDeductForm({...deductForm, reason: e.target.value})}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 dark:bg-gray-700 dark:text-gray-100">
                    <option value="">{t('inventory.deductModal.selectReason')}</option>
                    <option value="تالف">{t('inventory.deductModal.reasons.damaged')}</option>
                    <option value="منتهي الصلاحية">{t('inventory.deductModal.reasons.expired')}</option>
                    <option value="جرد دوري">{t('inventory.deductModal.reasons.periodicInventory')}</option>
                    <option value="تصحيح خطأ">{t('inventory.deductModal.reasons.errorCorrection')}</option>
                    <option value="فقدان">{t('inventory.deductModal.reasons.loss')}</option>
                    <option value="إرجاع للمورد">{t('inventory.deductModal.reasons.returnToSupplier')}</option>
                    <option value={t('inventory.deductModal.reasons.other')}>{t('inventory.deductModal.reasons.other')}</option>
                  </select>
                  {deductForm.reason === t('inventory.deductModal.reasons.other') && (
                    <input type="text" value={deductForm.reason === t('inventory.deductModal.reasons.other') ? '' : deductForm.reason}
                      onChange={e => setDeductForm({...deductForm, reason: e.target.value})}
                      className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 mt-2 dark:bg-gray-700 dark:text-gray-100"
                      placeholder={t('inventory.deductModal.enterReason')} required />
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('inventory.deductModal.date')}</label>
                  <DatePicker showTime value={deductForm.date ? dayjs(deductForm.date) : null}
                    onChange={(date) => setDeductForm({...deductForm, date: date ? date.format('YYYY-MM-DDTHH:mm') : ''})}
                    className="w-full" format="YYYY-MM-DD HH:mm"
                    locale={i18n.language === 'ar' ? undefined : undefined} />
                </div>

                {error && <p className="text-red-600 text-sm bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">{error}</p>}

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-600">
                  <button type="button" onClick={() => setShowDeductModal(false)}
                    className="px-6 py-2.5 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                    {t('common.cancel')}
                  </button>
                  <button type="submit" disabled={loading}
                    className="px-6 py-2.5 bg-orange-600 hover:bg-orange-700 dark:bg-orange-500 dark:hover:bg-orange-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                    {loading ? (
                      <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                      {t('inventory.deductModal.deducting')}</>
                    ) : (
                      <><Minus className="h-4 w-4" />{deductForm.type === 'out' ? t('inventory.deductModal.deductQuantity') : t('inventory.deductModal.adjustStock')}</>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Movements Modal */}
      {showMovementsModal && selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowMovementsModal(false); }}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200 dark:border-gray-600 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('inventory.movementsModal.title')}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{selectedItem.name} - {t('inventory.movementsModal.currentStock')}: <span className="font-semibold">{formatQuantity(selectedItem.currentStock, translateUnit(selectedItem.unit), i18n.language)}</span></p>
              </div>
              <button onClick={() => setShowMovementsModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <svg className="animate-spin h-8 w-8 text-orange-600" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                </div>
              ) : itemMovements.length === 0 ? (
                <div className="text-center py-12">
                  <History className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 dark:text-gray-400">{t('inventory.movementsModal.noMovements')}</p>
                </div>
              ) : (
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">{t('inventory.movementsModal.date')}</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">{t('inventory.movementsModal.type')}</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">{t('inventory.movementsModal.quantity')}</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">{t('inventory.movementsModal.price')}</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">{t('inventory.movementsModal.balanceAfter')}</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">{t('inventory.movementsModal.reason')}</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">{t('inventory.movementsModal.user')}</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">{t('inventory.movementsModal.actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {itemMovements.map((movement: any, idx: number) => (
                      <tr key={movement._id || idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 whitespace-nowrap">
                          {formatOrgDate ? formatOrgDate(movement.timestamp || movement.date) : new Date(movement.timestamp || movement.date).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            movement.type === 'in' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                            movement.type === 'transfer_in' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' :
                            movement.type === 'out' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
                            movement.type === 'transfer_out' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' :
                            'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                          }`}>
                            {movement.type === 'in' ? t('inventory.movementsModal.types.in') :
                             movement.type === 'transfer_in' ? t('warehouse.transferIn') :
                             movement.type === 'out' ? t('inventory.movementsModal.types.out') :
                             movement.type === 'transfer_out' ? t('warehouse.transferOut') :
                             t('inventory.movementsModal.types.adjustment')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 whitespace-nowrap">{movement.quantity}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 whitespace-nowrap">{movement.price ? formatCurrency(movement.price) : '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 whitespace-nowrap">{movement.balanceAfter}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 max-w-[200px] truncate" title={movement.reason}>{translateReason(movement.reason)}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">{movement.user?.name || t('inventory.movementsModal.system')}</td>
                        <td className="px-4 py-3 text-sm whitespace-nowrap space-x-2 space-x-reverse">
                          {movement.type !== 'transfer_out' && movement.type !== 'transfer_in' && (
                            <button onClick={() => openEditMovementModal(movement)}
                              className="text-blue-600 hover:text-blue-800 dark:text-blue-400" title={t('inventory.movementsModal.edit')}>
                              <Edit2 className="h-4 w-4" />
                            </button>
                          )}
                          {movement.type !== 'transfer_out' && movement.type !== 'transfer_in' && (
                            <button onClick={() => handleDeleteMovement(movement._id)}
                              className="text-red-600 hover:text-red-800 dark:text-red-400" title={t('inventory.movementsModal.delete')}>
                              <Trash2 className="h-4 w-4 inline" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Movement Modal */}
      {showEditMovementModal && editingMovement && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowEditMovementModal(false); }}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">{t('inventory.editMovementModal.title')}</h3>
              <form onSubmit={handleEditMovementSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('inventory.editMovementModal.quantity')}</label>
                  <input type="number" value={editMovementForm.quantity} onChange={e => setEditMovementForm({...editMovementForm, quantity: e.target.value})}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 dark:bg-gray-700 dark:text-gray-100" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('inventory.editMovementModal.price')}</label>
                  <input type="number" value={editMovementForm.price} onChange={e => setEditMovementForm({...editMovementForm, price: e.target.value})}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 dark:bg-gray-700 dark:text-gray-100" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('inventory.editMovementModal.reason')}</label>
                  <input type="text" value={editMovementForm.reason} onChange={e => setEditMovementForm({...editMovementForm, reason: e.target.value})}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 dark:bg-gray-700 dark:text-gray-100" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('inventory.editMovementModal.date')}</label>
                  <DatePicker showTime value={editMovementForm.date ? dayjs(editMovementForm.date) : null}
                    onChange={(date) => setEditMovementForm({...editMovementForm, date: date ? date.format('YYYY-MM-DDTHH:mm') : ''})}
                    className="w-full" format="YYYY-MM-DD HH:mm" />
                </div>
                {error && <p className="text-red-600 text-sm bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">{error}</p>}
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-600">
                  <button type="button" onClick={() => setShowEditMovementModal(false)}
                    className="px-6 py-2.5 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                    {t('inventory.editMovementModal.cancel')}
                  </button>
                  <button type="submit" disabled={loading}
                    className="px-6 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                    {loading ? (
                      <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                      {t('inventory.editMovementModal.updating')}</>
                    ) : (
                      <>{t('inventory.editMovementModal.update')}</>
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowDeleteMovementModal(false); }}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">{t('inventory.deleteMovementModal.title')}</h3>
              <p className="text-gray-600 dark:text-gray-300 mb-6">{t('inventory.deleteMovementModal.confirmMessage')}</p>
              <div className="flex justify-end gap-3">
                <button onClick={() => setShowDeleteMovementModal(false)}
                  className="px-6 py-2.5 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                  {t('inventory.deleteMovementModal.cancel')}
                </button>
                <button onClick={confirmDeleteMovement} disabled={loading}
                  className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                  {loading ? (
                    <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
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

export default Warehouse;
