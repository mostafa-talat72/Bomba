import React, { useState, useEffect } from 'react';
import { Wallet, Plus, TrendingUp, TrendingDown, Calendar, Receipt, Filter, Edit, Trash2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Cost } from '../services/api';
import { formatCurrency as formatCurrencyUtil, formatDecimal } from '../utils/formatters';

const Costs = () => {
  const { costs, fetchCosts, createCost, updateCost, deleteCost, showNotification } = useApp();
  const [showAddCost, setShowAddCost] = useState(false);
  const [showEditCost, setShowEditCost] = useState(false);
  const [selectedCost, setSelectedCost] = useState<Cost | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState('month');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [costToDelete, setCostToDelete] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    category: '',
    description: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    status: 'pending',
    paymentMethod: 'cash',
    receipt: '',
    vendor: '',
    vendorContact: '',
    notes: '',
    paidAmount: '',
    remainingAmount: ''
  });

  const costCategories = [
    { id: 'rent', name: 'الإيجار', color: 'bg-red-500', icon: '🏠' },
    { id: 'utilities', name: 'المرافق', color: 'bg-blue-500', icon: '⚡' },
    { id: 'salaries', name: 'المرتبات', color: 'bg-green-500', icon: '👥' },
    { id: 'maintenance', name: 'الصيانة', color: 'bg-yellow-500', icon: '🔧' },
    { id: 'inventory', name: 'المخزون', color: 'bg-purple-500', icon: '📦' },
    { id: 'marketing', name: 'التسويق', color: 'bg-pink-500', icon: '📢' },
    { id: 'insurance', name: 'التأمين', color: 'bg-indigo-500', icon: '🛡️' },
    { id: 'other', name: 'أخرى', color: 'bg-gray-500', icon: '📋' },
  ];

  // تحميل البيانات عند بدء الصفحة
  useEffect(() => {
    loadCosts();
  }, []);

  const loadCosts = async () => {
    try {
      setLoading(true);
      await fetchCosts();
    } catch (error) {
      showNotification('خطأ في تحميل التكاليف', 'error');
    } finally {
      setLoading(false);
    }
  };

  // فلترة التكاليف حسب الفترة المحددة
  const getFilteredCosts = () => {
    if (!costs || costs.length === 0) return [];

    let startDate: Date;
    let endDate: Date;

    switch (selectedPeriod) {
      case 'today':
        startDate = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
        endDate = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() + 1);
        break;
      case 'week': {
        const dayOfWeek = new Date().getDay();
        const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        startDate = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() - daysToSubtract);
        endDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);
        break;
      }
      case 'month': {
        startDate = new Date(selectedYear, selectedMonth, 1);
        endDate = new Date(selectedYear, selectedMonth + 1, 1);
        break;
      }
      case 'quarter': {
        const quarter = Math.floor(selectedMonth / 3);
        startDate = new Date(selectedYear, quarter * 3, 1);
        endDate = new Date(selectedYear, (quarter + 1) * 3, 1);
        break;
      }
      case 'year':
        startDate = new Date(selectedYear, 0, 1);
        endDate = new Date(selectedYear + 1, 0, 1);
        break;
      default:
        return costs;
    }

    return costs.filter(cost => {
      const costDate = new Date(cost.date);
      const matchesDate = costDate >= startDate && costDate < endDate;
      const matchesCategory = filterCategory === 'all' || cost.category === filterCategory;
      const matchesStatus = filterStatus === 'all' || cost.status === filterStatus;

      return matchesDate && matchesCategory && matchesStatus;
    });
  };

  const filteredCosts = getFilteredCosts();

  // حساب الإحصائيات
  const calculateStats = () => {
    const totalAmount = filteredCosts.reduce((sum, cost) => sum + cost.amount, 0);
    const paidAmount = filteredCosts.filter(cost => cost.status === 'paid').reduce((sum, cost) => sum + cost.amount, 0);
    const pendingAmount = filteredCosts.filter(cost => cost.status === 'pending').reduce((sum, cost) => sum + cost.amount, 0);
    const overdueAmount = filteredCosts.filter(cost => cost.status === 'overdue').reduce((sum, cost) => sum + cost.amount, 0);

    // حساب التكاليف حسب الفئة
    const categoryStats = costCategories.map(category => {
      const categoryCosts = filteredCosts.filter(cost => cost.category === category.id);
      const total = categoryCosts.reduce((sum, cost) => sum + cost.amount, 0);
      const count = categoryCosts.length;
      const percentage = totalAmount > 0 ? (total / totalAmount) * 100 : 0;

      return {
        ...category,
        total,
        count,
        percentage
      };
    });

    return {
      totalAmount,
      paidAmount,
      pendingAmount,
      overdueAmount,
      totalCount: filteredCosts.length,
      categoryStats
    };
  };

  const stats = calculateStats();

  // حساب متوسط التكاليف اليومية
  const getDailyAverage = () => {
    if (selectedPeriod === 'today') return stats.totalAmount;

    let daysCount = 1;

    switch (selectedPeriod) {
      case 'week':
        daysCount = 7;
        break;
      case 'month':
        daysCount = new Date(selectedYear, selectedMonth + 1, 0).getDate();
        break;
      case 'quarter':
        daysCount = 90;
        break;
      case 'year':
        daysCount = 365;
        break;
    }

    return stats.totalAmount / daysCount;
  };

  // الحصول على بيانات الشهور السابقة للمقارنة
  const getMonthlyComparison = () => {
    const months = [];
    const currentYear = new Date().getFullYear();

    for (let i = 11; i >= 0; i--) {
      const month = new Date(currentYear, new Date().getMonth() - i, 1);
      const monthCosts = costs?.filter(cost => {
        const costDate = new Date(cost.date);
        return costDate.getFullYear() === month.getFullYear() &&
          costDate.getMonth() === month.getMonth();
      }) || [];

      const total = monthCosts.reduce((sum, cost) => sum + cost.amount, 0);

      months.push({
        month: month.toLocaleDateString('ar-EG', { month: 'short', year: 'numeric' }),
        total,
        count: monthCosts.length
      });
    }

    return months;
  };

  const monthlyData = getMonthlyComparison();

  // حساب المبلغ المتبقي بناءً على حالة الدفع والمبلغ المدفوع
  const calculateRemainingAmount = () => {
    const totalAmount = parseFloat(formData.amount || '0');
    const paidAmount = parseFloat(formData.paidAmount || '0');
    return Math.max(0, totalAmount - paidAmount);
  };

  // تحديث حالة الدفع تلقائياً بناءً على المبلغ المدفوع
  const updatePaymentStatus = () => {
    const totalAmount = parseFloat(formData.amount || '0');
    const paidAmount = parseFloat(formData.paidAmount || '0');

    if (paidAmount >= totalAmount && totalAmount > 0) {
      setFormData(prev => ({ ...prev, status: 'paid' }));
    } else if (paidAmount > 0 && paidAmount < totalAmount) {
      setFormData(prev => ({ ...prev, status: 'partially_paid' }));
    } else {
      setFormData(prev => ({ ...prev, status: 'pending' }));
    }
  };

  // مراقبة تغييرات المبلغ والمبلغ المدفوع
  useEffect(() => {
    updatePaymentStatus();
  }, [formData.amount, formData.paidAmount]);

  // معالجة النماذج
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;

    if (name === 'status' && value === 'paid') {
      // إذا تم اختيار الحالة كـ "مدفوع"، تحديث المبلغ المدفوع والمتبقي تلقائياً
      const amount = parseFloat(formData.amount) || 0;
      setFormData(prev => ({
        ...prev,
        [name]: value,
        paidAmount: amount.toString(),
        remainingAmount: '0'
      }));
    } else if (name === 'amount' || name === 'paidAmount') {
      // حساب المتبقي تلقائياً عند تغيير المبلغ أو المبلغ المدفوع
      const currentAmount = name === 'amount' ? parseFloat(value) || 0 : parseFloat(formData.amount) || 0;
      let currentPaidAmount = name === 'paidAmount' ? parseFloat(value) || 0 : parseFloat(formData.paidAmount) || 0;

      // التأكد من أن المبلغ المدفوع لا يتجاوز المبلغ الكلي
      if (name === 'paidAmount' && currentPaidAmount > currentAmount) {
        currentPaidAmount = currentAmount;
      }

      const remainingAmount = Math.max(0, currentAmount - currentPaidAmount);

      setFormData(prev => ({
        ...prev,
        [name]: name === 'paidAmount' ? currentPaidAmount.toString() : value,
        remainingAmount: remainingAmount.toString()
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const resetForm = () => {
    setFormData({
      category: '',
      description: '',
      amount: '',
      date: new Date().toISOString().split('T')[0],
      status: 'pending',
      paymentMethod: 'cash',
      receipt: '',
      vendor: '',
      vendorContact: '',
      notes: '',
      paidAmount: '',
      remainingAmount: ''
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setLoading(true);

      const costData = {
        ...formData,
        amount: parseFloat(formData.amount),
        paidAmount: parseFloat(formData.paidAmount || '0'),
        remainingAmount: parseFloat(formData.remainingAmount || '0'),
        date: new Date(formData.date)
      };

      if (showEditCost && selectedCost) {
        const updatedCost = await updateCost(selectedCost.id, costData);
        if (updatedCost) {
          showNotification('تم تحديث التكلفة بنجاح', 'success');
          setShowEditCost(false);
          // إعادة تحميل البيانات للتأكد من التحديث
          await loadCosts();
        }
      } else {
        await createCost(costData);
        showNotification('تم إضافة التكلفة بنجاح', 'success');
        setShowAddCost(false);
        // إعادة تحميل البيانات للتأكد من التحديث
        await loadCosts();
      }

      resetForm();
      setSelectedCost(null);
      // await loadCosts(); // This line is removed as per the edit hint

    } catch (error) {
      showNotification('خطأ في حفظ التكلفة', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (cost: Cost) => {
    setSelectedCost(cost);
    setFormData({
      category: cost.category,
      description: cost.description,
      amount: cost.amount.toString(),
      date: new Date(cost.date).toISOString().split('T')[0],
      status: cost.status,
      paymentMethod: cost.paymentMethod,
      receipt: cost.receipt || '',
      vendor: cost.vendor || '',
      vendorContact: cost.vendorContact || '',
      notes: cost.notes || '',
      paidAmount: cost.paidAmount?.toString() || '0',
      remainingAmount: cost.remainingAmount?.toString() || '0'
    });
    setShowEditCost(true);
  };

  const handleDeleteClick = (costId: string) => {
    setCostToDelete(costId);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!costToDelete) return;
    
    try {
      setDeleteLoading(true);
      await deleteCost(costToDelete);
      showNotification('تم حذف التكلفة بنجاح', 'success');
      await loadCosts();
    } catch (error) {
      showNotification('خطأ في حذف التكلفة', 'error');
    } finally {
      setDeleteLoading(false);
      setShowDeleteModal(false);
      setCostToDelete(null);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteModal(false);
    setCostToDelete(null);
  };

  const getCategoryName = (categoryId: string) => {
    return costCategories.find(cat => cat.id === categoryId)?.name || 'غير معروف';
  };

  const getCategoryIcon = (categoryId: string) => {
    return costCategories.find(cat => cat.id === categoryId)?.icon || '📋';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'partially_paid': return 'bg-blue-100 text-blue-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'paid': return 'مدفوع';
      case 'pending': return 'معلق';
      case 'partially_paid': return 'مدفوع جزئياً';
      case 'overdue': return 'متأخر';
      default: return 'غير معروف';
    }
  };

  const formatCurrency = (amount: number) => {
    return formatCurrencyUtil(amount);
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap xs:flex-col xs:items-start xs:gap-2 xs:space-y-2 xs:w-full">
        <div className="flex items-center xs:w-full xs:justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center xs:text-base xs:w-full xs:text-center">
            <Wallet className="h-6 w-6 text-orange-600 dark:text-orange-400 ml-2" />
            إدارة التكاليف
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mr-4 xs:mr-0 xs:w-full xs:text-center">متابعة وتحليل المصروفات والتكاليف</p>
        </div>
        <div className="flex items-center space-x-3 space-x-reverse xs:w-full xs:justify-center xs:mt-2">
          <button
            onClick={loadCosts}
            disabled={loading}
            className="bg-orange-600 hover:bg-orange-700 dark:bg-orange-500 dark:hover:bg-orange-600 text-white px-4 py-2 rounded-lg flex items-center transition-colors duration-200 disabled:opacity-50 xs:w-full xs:justify-center"
          >
            <Calendar className="h-5 w-5 ml-2" />
            تحديث
          </button>
          <button
            onClick={() => {
              resetForm();
              setShowAddCost(true);
            }}
            className="bg-orange-600 hover:bg-orange-700 dark:bg-orange-500 dark:hover:bg-orange-600 text-white px-4 py-2 rounded-lg flex items-center transition-colors duration-200 xs:w-full xs:justify-center"
          >
            <Plus className="h-5 w-5 ml-2" />
            إضافة مصروف
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">الفلترة والبحث</h3>
          <Filter className="h-5 w-5 text-gray-500 dark:text-gray-400" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">الفترة الزمنية</label>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 dark:bg-gray-700 dark:text-gray-100"
            >
              <option value="today">اليوم</option>
              <option value="week">هذا الأسبوع</option>
              <option value="month">هذا الشهر</option>
              <option value="quarter">هذا الربع</option>
              <option value="year">هذا العام</option>
            </select>
          </div>

          {selectedPeriod === 'month' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">الشهر</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 dark:bg-gray-700 dark:text-gray-100"
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i} value={i}>
                      {new Date(2024, i).toLocaleDateString('ar-EG', { month: 'long' })}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">السنة</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 dark:bg-gray-700 dark:text-gray-100"
                >
                  {Array.from({ length: 5 }, (_, i) => {
                    const year = new Date().getFullYear() - 2 + i;
                    return (
                      <option key={year} value={year}>{year}</option>
                    );
                  })}
                </select>
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">الفئة</label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 dark:bg-gray-700 dark:text-gray-100"
            >
              <option value="all">جميع الفئات</option>
              {costCategories.map(category => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">الحالة</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 dark:bg-gray-700 dark:text-gray-100"
            >
              <option value="all">جميع الحالات</option>
              <option value="paid">مدفوع</option>
              <option value="pending">معلق</option>
              <option value="overdue">متأخر</option>
            </select>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-red-100 dark:bg-red-900 rounded-lg flex items-center justify-center">
              <TrendingDown className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <div className="mr-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">إجمالي التكاليف</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{formatCurrency(stats.totalAmount)}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">متوسط يومي: {formatCurrency(getDailyAverage())}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div className="mr-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">المدفوع</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{formatCurrency(stats.paidAmount)}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {stats.totalAmount > 0 ? formatDecimal((stats.paidAmount / stats.totalAmount) * 100) : '٠'}% من الإجمالي
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900 rounded-lg flex items-center justify-center">
              <Calendar className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div className="mr-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">معلق</p>
              <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{formatCurrency(stats.pendingAmount)}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {stats.totalAmount > 0 ? formatDecimal((stats.pendingAmount / stats.totalAmount) * 100) : '٠'}% من الإجمالي
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
              <Receipt className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="mr-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">عدد المعاملات</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{formatDecimal(stats.totalCount)}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">متوسط: {formatCurrency(stats.totalCount > 0 ? stats.totalAmount / stats.totalCount : 0)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-600">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">توزيع التكاليف حسب الفئة</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.categoryStats
              .filter(cat => cat.total > 0)
              .sort((a, b) => b.total - a.total)
              .map(category => (
                <div key={category.id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 hover:shadow-md transition-shadow duration-200">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center">
                      <span className="text-2xl mr-2">{category.icon}</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">{category.name}</span>
                    </div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">{formatDecimal(category.percentage)}%</span>
                  </div>
                  <div className="mb-2">
                    <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${category.color}`}
                        style={{ width: `${category.percentage}%` }}
                      ></div>
                    </div>
                  </div>
                  <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatCurrency(category.total)}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{formatDecimal(category.count)} معاملة</p>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Monthly Comparison */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-600">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">مقارنة الشهور (آخر 12 شهر)</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-12 gap-4">
            {monthlyData.map((month, index) => (
              <div key={index} className="text-center">
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">{month.month}</p>
                  <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{formatCurrency(month.total)}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{formatDecimal(month.count)} معاملة</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Costs List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-600">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">سجل التكاليف</h3>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {formatDecimal(filteredCosts.length)} من {formatDecimal(costs?.length || 0)} معاملة
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  التاريخ
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  الفئة
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  الوصف
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  المبلغ
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  المدفوع
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  المتبقي
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  رقم الإيصال
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  الحالة
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  الإجراءات
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                    جاري التحميل...
                  </td>
                </tr>
              ) : filteredCosts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                    لا توجد تكاليف في الفترة المحددة
                  </td>
                </tr>
              ) : (
                filteredCosts.map((cost) => (
                  <tr key={cost.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {formatDate(cost.date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <span className="text-lg mr-2">{getCategoryIcon(cost.category)}</span>
                        <span className="text-sm text-gray-900 dark:text-gray-100">{getCategoryName(cost.category)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {cost.description}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-red-600 dark:text-red-400">
                      {formatCurrency(cost.amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600 dark:text-green-400">
                      {formatCurrency(cost.paidAmount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-yellow-600 dark:text-yellow-400">
                      {formatCurrency(cost.remainingAmount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {cost.receipt || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(cost.status)}`}>
                        {getStatusText(cost.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-2 space-x-reverse">
                        <button
                          onClick={() => handleEdit(cost)}
                          className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 p-1"
                          title="تعديل"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(cost.id)}
                          className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 p-1 disabled:opacity-50"
                          title="حذف"
                          disabled={deleteLoading}
                        >
                          {deleteLoading && costToDelete === cost.id ? (
                            <span className="inline-flex items-center">
                              <svg className="animate-spin -ml-1 mr-1 h-4 w-4 text-red-600 dark:text-red-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              جاري الحذف...
                            </span>
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Cost Modal */}
      {(showAddCost || showEditCost) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-600">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {showEditCost ? 'تعديل التكلفة' : 'إضافة مصروف جديد'}
              </h3>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">الفئة *</label>
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleInputChange}
                  required
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 dark:bg-gray-700 dark:text-gray-100"
                >
                  <option value="">اختر الفئة</option>
                  {costCategories.map(category => (
                    <option key={category.id} value={category.id}>
                      {category.icon} {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">الوصف *</label>
                <input
                  type="text"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  required
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 dark:bg-gray-700 dark:text-gray-100"
                  placeholder="وصف المصروف"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">المبلغ *</label>
                <input
                  type="number"
                  name="amount"
                  value={formData.amount}
                  onChange={handleInputChange}
                  required
                  step="0.01"
                  min="0"
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 dark:bg-gray-700 dark:text-gray-100"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">التاريخ *</label>
                <input
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleInputChange}
                  required
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 dark:bg-gray-700 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">طريقة الدفع</label>
                <select
                  name="paymentMethod"
                  value={formData.paymentMethod}
                  onChange={handleInputChange}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 dark:bg-gray-700 dark:text-gray-100"
                >
                  <option value="cash">نقداً</option>
                  <option value="card">بطاقة ائتمان</option>
                  <option value="transfer">تحويل بنكي</option>
                  <option value="check">شيك</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">الحالة</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleInputChange}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 dark:bg-gray-700 dark:text-gray-100"
                >
                  <option value="pending">معلق</option>
                  <option value="paid">مدفوع</option>
                  <option value="partially_paid">مدفوع جزئياً</option>
                  <option value="overdue">متأخر</option>
                </select>
              </div>

              {/* إظهار حقول الدفع فقط إذا كانت الحالة ليست "مدفوع" */}
              {formData.status !== 'paid' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    المبلغ المدفوع
                    {formData.status === 'partially_paid' && (
                      <span className="text-xs text-gray-500 dark:text-gray-400 mr-2">(جزئي)</span>
                    )}
                  </label>
                  <input
                    type="number"
                    name="paidAmount"
                    value={formData.paidAmount}
                    onChange={handleInputChange}
                    step="0.01"
                    min="0"
                    max={parseFloat(formData.amount || '0')}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 dark:bg-gray-700 dark:text-gray-100"
                    placeholder="0.00"
                  />
                  {formData.paidAmount && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      المتبقي: {formatDecimal(calculateRemainingAmount())} ج.م
                    </div>
                  )}
                </div>
              )}

              {/* إظهار ملخص التكلفة */}
              {formData.amount && (
                <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">ملخص التكلفة:</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    <div>إجمالي التكلفة: {formatDecimal(parseFloat(formData.amount || '0'))} ج.م</div>
                    {formData.paidAmount && (
                      <>
                        <div>المدفوع: {formatDecimal(parseFloat(formData.paidAmount || '0'))} ج.م</div>
                        <div>المتبقي: {formatDecimal(calculateRemainingAmount())} ج.م</div>
                      </>
                    )}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">رقم الإيصال (اختياري)</label>
                <input
                  type="text"
                  name="receipt"
                  value={formData.receipt}
                  onChange={handleInputChange}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 dark:bg-gray-700 dark:text-gray-100"
                  placeholder="REC-2024-001"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">المورد (اختياري)</label>
                <input
                  type="text"
                  name="vendor"
                  value={formData.vendor}
                  onChange={handleInputChange}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 dark:bg-gray-700 dark:text-gray-100"
                  placeholder="اسم المورد"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">رقم هاتف المورد (اختياري)</label>
                <input
                  type="text"
                  name="vendorContact"
                  value={formData.vendorContact}
                  onChange={handleInputChange}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 dark:bg-gray-700 dark:text-gray-100"
                  placeholder="رقم الهاتف"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">ملاحظات (اختياري)</label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 dark:bg-gray-700 dark:text-gray-100"
                  placeholder="ملاحظات إضافية"
                />
              </div>
            </form>

            <div className="p-6 border-t border-gray-200 dark:border-gray-600 flex justify-end space-x-3 space-x-reverse">
              <button
                onClick={() => {
                  setShowAddCost(false);
                  setShowEditCost(false);
                  resetForm();
                  setSelectedCost(null);
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-lg transition-colors duration-200"
              >
                إلغاء
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 dark:bg-orange-500 dark:hover:bg-orange-600 text-white rounded-lg transition-colors duration-200 disabled:opacity-50 flex items-center justify-center min-w-24"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {showEditCost ? 'جاري التحديث...' : 'جاري الحفظ...'}
                  </>
                ) : showEditCost ? 'تحديث التكلفة' : 'إضافة المصروف'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">تأكيد الحذف</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6">هل أنت متأكد من حذف هذه التكلفة؟ لا يمكن التراجع عن هذا الإجراء.</p>
            <div className="flex justify-end space-x-3 space-x-reverse">
              <button
                onClick={handleCancelDelete}
                disabled={deleteLoading}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-lg transition-colors duration-200 disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleteLoading}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 text-white rounded-lg transition-colors duration-200 disabled:opacity-50 flex items-center justify-center min-w-24"
              >
                {deleteLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
      )}
    </div>
  );
};

export default Costs;
