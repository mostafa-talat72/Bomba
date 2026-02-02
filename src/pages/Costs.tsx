import { useState, useEffect } from 'react';
import { 
  DollarSign, Plus, Filter, Search, 
  TrendingUp, AlertCircle, CheckCircle,
  Clock, XCircle, Settings, RefreshCw
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { formatCurrency } from '../utils/formatters';
import * as LucideIcons from 'lucide-react';
import CategoryManagerModal from '../components/CategoryManagerModal';
import CostFormModal from '../components/CostFormModal';
import PaymentAdditionModal from '../components/PaymentAdditionModal';
import CostDetailsModal from '../components/CostDetailsModal';
import { 
  StatisticsCardsSkeleton, 
  CategoriesFilterSkeleton, 
  CostsTableSkeleton 
} from '../components/CostsPageSkeleton';
import '../styles/cost-animations.css';
import '../styles/modern-costs.css';
import '../styles/modern-enhancements.css';

interface CostCategory {
  _id: string;
  name: string;
  icon: string;
  color: string;
  description?: string;
  isActive: boolean;
  sortOrder: number;
}

interface PaymentHistoryItem {
  amount: number;
  paymentMethod: string;
  paidBy?: {
    _id: string;
    name: string;
  };
  paidAt: string;
  notes?: string;
  receipt?: string;
}

interface AmountHistoryItem {
  addedAmount: number;
  previousTotal: number;
  newTotal: number;
  addedBy?: {
    _id: string;
    name: string;
  };
  addedAt: string;
  reason?: string;
}

interface Cost {
  _id: string;
  category: CostCategory;
  description: string;
  amount: number;
  paidAmount: number;
  remainingAmount: number;
  date: string;
  dueDate?: string;
  status: 'pending' | 'paid' | 'partially_paid' | 'overdue' | 'cancelled';
  paymentMethod: string;
  vendor?: string;
  notes?: string;
  paymentHistory?: PaymentHistoryItem[];
  amountHistory?: AmountHistoryItem[];
  createdAt: string;
  updatedAt?: string;
}

const Costs = () => {
  const { showNotification } = useApp();
  const [costs, setCosts] = useState<Cost[]>([]);
  const [categories, setCategories] = useState<CostCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [showCostModal, setShowCostModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [editingCost, setEditingCost] = useState<Cost | null>(null);
  const [selectedCostForPayment, setSelectedCostForPayment] = useState<Cost | null>(null);
  const [selectedCostForDetails, setSelectedCostForDetails] = useState<Cost | null>(null);
  const [loading, setLoading] = useState(true);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);

  // Collapsible sections state
  const [isCategoryBreakdownCollapsed, setIsCategoryBreakdownCollapsed] = useState(true);
  const [isStatusBreakdownCollapsed, setIsStatusBreakdownCollapsed] = useState(true);
  const [isCategoryFilterCollapsed, setIsCategoryFilterCollapsed] = useState(true);
  const [isDateFilterCollapsed, setIsDateFilterCollapsed] = useState(true);

  // Statistics
  const [stats, setStats] = useState({
    total: 0,
    paid: 0,
    remaining: 0,
    count: 0,
  });

  // Additional backend data
  const [categoryBreakdown, setCategoryBreakdown] = useState([]);
  const [statusBreakdown, setStatusBreakdown] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    totalPages: 1,
    hasNext: false,
    hasPrev: false
  });

  useEffect(() => {
    fetchCategories();
  }, []);

  // Real-time filtering with debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      // Reset to first page when filters change
      setPagination(prev => ({ ...prev, page: 1 }));
      fetchCosts();
    }, 300);

    return () => clearTimeout(timer);
  }, [selectedCategory, selectedStatus, searchTerm, dateFrom, dateTo]);

  // Fetch costs when pagination changes
  useEffect(() => {
    fetchCosts();
  }, [pagination.page]);

  const fetchCategories = async () => {
    try {
      setCategoriesLoading(true);
      setCategoriesError(null);
      const response = await api.get('/cost-categories');
      
      if (response.success) {
        setCategories(response.data || []);
      } else {
        throw new Error(response.message || 'فشل في تحميل الأقسام');
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'فشل في تحميل الأقسام';
      setCategoriesError(errorMessage);
      setCategories([]);
      showNotification(errorMessage, 'error');
      console.error('Error fetching categories:', error);
    } finally {
      setCategoriesLoading(false);
    }
  };

  const fetchCosts = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: any = {
        page: pagination.page,
        limit: pagination.limit
      };
      
      // Combine filters with AND logic
      if (selectedCategory) params.category = selectedCategory;
      if (selectedStatus !== 'all') params.status = selectedStatus;
      if (searchTerm.trim()) params.search = searchTerm.trim();
      if (dateFrom) params.startDate = dateFrom;
      if (dateTo) params.endDate = dateTo;

      const response = await api.getCosts(params);
      
      // Handle API response format
      if (response.success) {
        setCosts(response.data || []);
        setStats(response.totalStats || { total: 0, paid: 0, remaining: 0, count: 0 });
        setCategoryBreakdown(response.categoryBreakdown || []);
        setStatusBreakdown(response.statusBreakdown || []);
        setPagination(response.pagination || pagination);
      } else {
        throw new Error(response.message || 'فشل في تحميل التكاليف');
      }
    } catch (error: any) {
      console.error('Error in fetchCosts:', error);
      const errorMessage = error.response?.data?.message || error.message || 'فشل في تحميل التكاليف';
      setError(errorMessage);
      setCosts([]);
      setStats({ total: 0, paid: 0, remaining: 0, count: 0 });
      setCategoryBreakdown([]);
      setStatusBreakdown([]);
      showNotification(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Remove frontend calculation function since we rely on backend
  // const calculateStats = (costsData: Cost[]) => {
  //   // This function is no longer needed as all calculations are done on backend
  // };

  const getStatusColor = (status: string) => {
    const baseClasses = 'status-badge';
    switch (status) {
      case 'paid': return `${baseClasses} status-paid bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400`;
      case 'partially_paid': return `${baseClasses} status-partially-paid bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400`;
      case 'pending': return `${baseClasses} status-pending bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400`;
      case 'overdue': return `${baseClasses} status-overdue bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400`;
      case 'cancelled': return `${baseClasses} bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400`;
      default: return `${baseClasses} bg-gray-100 text-gray-800`;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid': return <CheckCircle className="w-4 h-4" />;
      case 'partially_paid': return <Clock className="w-4 h-4" />;
      case 'pending': return <AlertCircle className="w-4 h-4" />;
      case 'overdue': return <XCircle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'paid': return 'مدفوع';
      case 'partially_paid': return 'مدفوع جزئياً';
      case 'pending': return 'معلق';
      case 'overdue': return 'متأخر';
      case 'cancelled': return 'ملغي';
      default: return status;
    }
  };

  const getCategoryIcon = (iconName: string) => {
    const Icon = (LucideIcons as any)[iconName] || DollarSign;
    return <Icon className="w-5 h-5" />;
  };

  const clearAllFilters = () => {
    setSelectedCategory(null);
    setSelectedStatus('all');
    setSearchTerm('');
    setDateFrom('');
    setDateTo('');
    setPagination(prev => ({ ...prev, page: 1 }));
    // Keep sections expanded when clearing filters
    setIsCategoryFilterCollapsed(false);
    setIsDateFilterCollapsed(false);
  };

  const hasActiveFilters = selectedCategory !== null || selectedStatus !== 'all' || searchTerm.trim() !== '' || dateFrom !== '' || dateTo !== '';

  const handleDeleteCost = async (costId: string) => {
    try {
      const response = await api.delete(`/costs/${costId}`);
      showNotification('تم حذف التكلفة بنجاح', 'success');
      fetchCosts();
      return Promise.resolve();
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'فشل في حذف التكلفة';
      showNotification(errorMessage, 'error');
      throw error;
    }
  };

  const handleAddPayment = async (paymentAmount: number, paymentMethod: string, notes?: string) => {
    if (!selectedCostForPayment) return;

    try {
      await api.post(`/costs/${selectedCostForPayment._id}/payment`, {
        paymentAmount,
        paymentMethod,
        reference: notes,
      });
      showNotification('تم إضافة الدفعة بنجاح', 'success');
      fetchCosts();
      setShowPaymentModal(false);
      setSelectedCostForPayment(null);
    } catch (error: any) {
      throw error; // Let the modal handle the error
    }
  };

  const openPaymentModal = (cost: any) => {
    setSelectedCostForPayment(cost);
    setShowPaymentModal(true);
  };

  const handleRetry = () => {
    if (error) {
      fetchCosts();
    }
    if (categoriesError) {
      fetchCategories();
    }
  };

  return (
    <div className="p-6 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex justify-between items-center slide-up">
        <div>
          <h1 className="text-4xl font-bold gradient-text-animated">
            إدارة التكاليف
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2 text-lg">
            تتبع وإدارة جميع تكاليف المشروع بأناقة وسهولة
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowCategoryModal(true)}
            className="modern-action-btn modern-action-btn-secondary flex items-center gap-2"
          >
            <Settings className="w-5 h-5" />
            إدارة الأقسام
          </button>
          <button
            onClick={() => {
              setEditingCost(null);
              setShowCostModal(true);
            }}
            className="modern-action-btn modern-action-btn-primary flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            إضافة تكلفة
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      {loading && !costs.length ? (
        <StatisticsCardsSkeleton />
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Total Card */}
        <div 
          className="modern-stats-card stats-card hover-lift"
          style={selectedCategory && categories.find(c => c._id === selectedCategory) ? {
            borderRight: `5px solid ${categories.find(c => c._id === selectedCategory)?.color}`,
          } : {}}
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">إجمالي التكاليف</p>
              <p className="stats-number text-3xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(stats.total)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {stats.count} تكلفة
              </p>
            </div>
            <div 
              className="modern-icon-container"
              style={selectedCategory && categories.find(c => c._id === selectedCategory) ? {
                backgroundColor: `${categories.find(c => c._id === selectedCategory)?.color}20`,
              } : {
                backgroundColor: 'rgba(59, 130, 246, 0.15)'
              }}
            >
              {selectedCategory && categories.find(c => c._id === selectedCategory) ? (
                <div style={{ color: categories.find(c => c._id === selectedCategory)?.color }}>
                  {getCategoryIcon(categories.find(c => c._id === selectedCategory)?.icon || 'DollarSign')}
                </div>
              ) : (
                <DollarSign className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              )}
            </div>
          </div>
        </div>

        {/* Paid Card */}
        <div 
          className="modern-stats-card stats-card hover-lift"
          style={selectedCategory && categories.find(c => c._id === selectedCategory) ? {
            borderRight: `5px solid ${categories.find(c => c._id === selectedCategory)?.color}`,
          } : {}}
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">المدفوع</p>
              <p 
                className="stats-number text-3xl font-bold cost-filter-transition"
                style={selectedCategory && categories.find(c => c._id === selectedCategory) ? {
                  color: categories.find(c => c._id === selectedCategory)?.color,
                } : {
                  color: '#16a34a'
                }}
              >
                {formatCurrency(stats.paid)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {stats.total > 0 ? `${((stats.paid / stats.total) * 100).toFixed(1)}%` : '0%'} مكتمل
              </p>
            </div>
            <div 
              className="modern-icon-container"
              style={selectedCategory && categories.find(c => c._id === selectedCategory) ? {
                backgroundColor: `${categories.find(c => c._id === selectedCategory)?.color}20`,
              } : {
                backgroundColor: 'rgba(34, 197, 94, 0.15)'
              }}
            >
              {selectedCategory && categories.find(c => c._id === selectedCategory) ? (
                <div style={{ color: categories.find(c => c._id === selectedCategory)?.color }}>
                  <CheckCircle className="w-8 h-8" />
                </div>
              ) : (
                <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
              )}
            </div>
          </div>
        </div>

        {/* Remaining Card */}
        <div 
          className="modern-stats-card stats-card hover-lift"
          style={selectedCategory && categories.find(c => c._id === selectedCategory) ? {
            borderRight: `5px solid ${categories.find(c => c._id === selectedCategory)?.color}`,
          } : {}}
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">المتبقي</p>
              <p 
                className="stats-number text-3xl font-bold cost-filter-transition"
                style={selectedCategory && categories.find(c => c._id === selectedCategory) ? {
                  color: categories.find(c => c._id === selectedCategory)?.color,
                } : {
                  color: '#ea580c'
                }}
              >
                {formatCurrency(stats.remaining)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {stats.total > 0 ? `${((stats.remaining / stats.total) * 100).toFixed(1)}%` : '0%'} متبقي
              </p>
            </div>
            <div 
              className="modern-icon-container"
              style={selectedCategory && categories.find(c => c._id === selectedCategory) ? {
                backgroundColor: `${categories.find(c => c._id === selectedCategory)?.color}20`,
              } : {
                backgroundColor: 'rgba(234, 88, 12, 0.15)'
              }}
            >
              {selectedCategory && categories.find(c => c._id === selectedCategory) ? (
                <div style={{ color: categories.find(c => c._id === selectedCategory)?.color }}>
                  <TrendingUp className="w-8 h-8" />
                </div>
              ) : (
                <TrendingUp className="w-8 h-8 text-orange-600 dark:text-orange-400" />
              )}
            </div>
          </div>
        </div>

        {/* Average Card */}
        <div 
          className="modern-stats-card stats-card hover-lift"
          style={selectedCategory && categories.find(c => c._id === selectedCategory) ? {
            borderRight: `5px solid ${categories.find(c => c._id === selectedCategory)?.color}`,
          } : {}}
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">متوسط التكلفة</p>
              <p 
                className="stats-number text-3xl font-bold cost-filter-transition"
                style={selectedCategory && categories.find(c => c._id === selectedCategory) ? {
                  color: categories.find(c => c._id === selectedCategory)?.color,
                } : {
                  color: '#8b5cf6'
                }}
              >
                {formatCurrency(stats.count > 0 ? stats.total / stats.count : 0)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                لكل تكلفة
              </p>
            </div>
            <div 
              className="modern-icon-container"
              style={selectedCategory && categories.find(c => c._id === selectedCategory) ? {
                backgroundColor: `${categories.find(c => c._id === selectedCategory)?.color}20`,
              } : {
                backgroundColor: 'rgba(139, 92, 246, 0.15)'
              }}
            >
              {selectedCategory && categories.find(c => c._id === selectedCategory) ? (
                <div style={{ color: categories.find(c => c._id === selectedCategory)?.color }}>
                  <TrendingUp className="w-8 h-8" />
                </div>
              ) : (
                <TrendingUp className="w-8 h-8 text-purple-600 dark:text-purple-400" />
              )}
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Category and Status Breakdown */}
      {!loading && (categoryBreakdown.length > 0 || statusBreakdown.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Category Breakdown */}
          {categoryBreakdown.length > 0 && (
            <div className="modern-filter-section breakdown-section">
              <div 
                className="flex items-center justify-between cursor-pointer mb-4 filter-section-header"
                onClick={() => setIsCategoryBreakdownCollapsed(!isCategoryBreakdownCollapsed)}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600">
                    <Filter className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">تفصيل الأقسام</h3>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {categoryBreakdown.length} قسم • {formatCurrency(categoryBreakdown.reduce((sum: number, cat: any) => sum + cat.total, 0))}
                  </span>
                  <div className={`transform transition-transform duration-200 collapse-indicator ${isCategoryBreakdownCollapsed ? 'collapsed' : ''}`}>
                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>
              
              {!isCategoryBreakdownCollapsed && (
                <div className="max-h-80 overflow-y-auto modern-scrollbar space-y-3">
                  {categoryBreakdown.map((category: any) => (
                    <div 
                      key={category._id}
                      className="group flex items-center justify-between p-3 rounded-xl bg-white dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 hover:shadow-md transition-all breakdown-card"
                      onClick={() => {
                        setSelectedCategory(category._id);
                        setIsCategoryFilterCollapsed(false);
                      }}
                      title="انقر لتطبيق فلتر هذا القسم"
                    >
                      <div className="flex items-center gap-3">
                        <div 
                          className="p-2 rounded-lg"
                          style={{ backgroundColor: `${category.categoryColor}20` }}
                        >
                          <div style={{ color: category.categoryColor }}>
                            {getCategoryIcon(category.categoryIcon)}
                          </div>
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white">
                            {category.categoryName || 'غير محدد'}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {category.count} تكلفة
                          </p>
                        </div>
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-gray-900 dark:text-white">
                          {formatCurrency(category.total)}
                        </p>
                        <p className="text-sm text-green-600 dark:text-green-400">
                          مدفوع: {formatCurrency(category.paid)}
                        </p>
                        <p className="text-sm text-red-600 dark:text-red-400">
                          متبقي: {formatCurrency(category.total - category.paid)}
                        </p>
                      </div>
                      <div className="mr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Status Breakdown */}
          {statusBreakdown.length > 0 && (
            <div className="modern-filter-section breakdown-section">
              <div 
                className="flex items-center justify-between cursor-pointer mb-4 filter-section-header"
                onClick={() => setIsStatusBreakdownCollapsed(!isStatusBreakdownCollapsed)}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600">
                    <CheckCircle className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">تفصيل الحالات</h3>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {statusBreakdown.length} حالة • {formatCurrency(statusBreakdown.reduce((sum: number, status: any) => sum + status.total, 0))}
                  </span>
                  <div className={`transform transition-transform duration-200 collapse-indicator ${isStatusBreakdownCollapsed ? 'collapsed' : ''}`}>
                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>
              
              {!isStatusBreakdownCollapsed && (
                <div className="max-h-80 overflow-y-auto modern-scrollbar space-y-3">
                  {statusBreakdown.map((status: any) => (
                    <div 
                      key={status._id}
                      className="group flex items-center justify-between p-3 rounded-xl bg-white dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 hover:shadow-md transition-all breakdown-card"
                      onClick={() => {
                        setSelectedStatus(status._id);
                      }}
                      title="انقر لتطبيق فلتر هذه الحالة"
                    >
                      <div className="flex items-center gap-3">
                        <span className={`modern-status-badge text-xs ${getStatusColor(status._id)}`}>
                          {getStatusIcon(status._id)}
                          {getStatusText(status._id)}
                        </span>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {status.count} تكلفة
                        </p>
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-gray-900 dark:text-white">
                          {formatCurrency(status.total)}
                        </p>
                        <p className="text-sm text-green-600 dark:text-green-400">
                          مدفوع: {formatCurrency(status.paid)}
                        </p>
                        <p className="text-sm text-red-600 dark:text-red-400">
                          متبقي: {formatCurrency(status.total - status.paid)}
                        </p>
                      </div>
                      <div className="mr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Categories Filter */}
      {categoriesLoading ? (
        <CategoriesFilterSkeleton />
      ) : categoriesError ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertCircle className="w-5 h-5" />
              <span>{categoriesError}</span>
            </div>
            <button
              onClick={fetchCategories}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              إعادة المحاولة
            </button>
          </div>
        </div>
      ) : (
      <div className="modern-filter-section stagger-item">
        <div 
          className="flex items-center justify-between cursor-pointer mb-5"
          onClick={() => setIsCategoryFilterCollapsed(!isCategoryFilterCollapsed)}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600">
              <Filter className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">تصفية حسب القسم</h3>
          </div>
          <div className="flex items-center gap-3">
            {selectedCategory && (
              <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                مُفعل
              </span>
            )}
            <div className={`transform transition-transform duration-200 collapse-indicator ${isCategoryFilterCollapsed ? 'collapsed' : ''}`}>
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>
        
        {!isCategoryFilterCollapsed && (
          <div className="max-h-60 overflow-y-auto modern-scrollbar">
            <div className="flex flex-wrap gap-3 pb-2">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`modern-category-btn transition-bounce ${
                  !selectedCategory ? 'modern-category-btn-selected' : ''
                }`}
                style={{
                  '--category-color': '#667eea',
                  '--category-color-dark': '#764ba2'
                } as React.CSSProperties}
              >
                الكل
              </button>
              {categories?.map(category => (
                <button
                  key={category._id}
                  onClick={() => setSelectedCategory(category._id)}
                  className={`modern-category-btn flex items-center gap-2 transition-bounce ${
                    selectedCategory === category._id ? 'modern-category-btn-selected' : ''
                  }`}
                  style={{
                    '--category-color': category.color,
                    '--category-color-dark': category.color,
                    backgroundColor: selectedCategory === category._id ? category.color : undefined,
                  } as React.CSSProperties}
                >
                  {getCategoryIcon(category.icon)}
                  <span>{category.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      )}

      {/* Filters and Search */}
      <div className="modern-filter-section stagger-item">
        <div 
          className="flex items-center justify-between cursor-pointer mb-4"
          onClick={() => setIsDateFilterCollapsed(!isDateFilterCollapsed)}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600">
              <Filter className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">البحث والتصفية</h3>
          </div>
          <div className="flex items-center gap-3">
            {hasActiveFilters && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  clearAllFilters();
                }}
                className="modern-action-btn modern-action-btn-secondary flex items-center gap-2"
              >
                <XCircle className="w-4 h-4" />
                مسح الكل
              </button>
            )}
            <div className={`transform transition-transform duration-200 collapse-indicator ${isDateFilterCollapsed ? 'collapsed' : ''}`}>
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>

        {!isDateFilterCollapsed && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Search Input */}
              <div className="lg:col-span-2 modern-search-container">
                <input
                  type="text"
                  placeholder="ابحث عن تكلفة، مورد، أو وصف..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="modern-search-input transition-smooth"
                />
                <Search className="modern-search-icon w-5 h-5" />
              </div>

              {/* Status Filter */}
              <div className="relative">
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="modern-form-input transition-smooth w-full appearance-none"
                  style={{ paddingRight: '2.5rem' }}
                >
                  <option value="all">جميع الحالات</option>
                  <option value="pending">معلق</option>
                  <option value="partially_paid">مدفوع جزئياً</option>
                  <option value="paid">مدفوع</option>
                </select>
                <Filter className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>

              {/* Quick Date Filters */}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const today = new Date().toISOString().split('T')[0];
                    setDateFrom(today);
                    setDateTo(today);
                  }}
                  className="flex-1 px-3 py-2 quick-action-btn text-white rounded-lg transition-all text-sm font-medium"
                  style={{ '--btn-color': '#3b82f6', '--btn-color-dark': '#1d4ed8' } as React.CSSProperties}
                >
                  اليوم
                </button>
                <button
                  onClick={() => {
                    const today = new Date();
                    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
                    setDateFrom(weekAgo.toISOString().split('T')[0]);
                    setDateTo(today.toISOString().split('T')[0]);
                  }}
                  className="flex-1 px-3 py-2 quick-action-btn text-white rounded-lg transition-all text-sm font-medium"
                  style={{ '--btn-color': '#10b981', '--btn-color-dark': '#047857' } as React.CSSProperties}
                >
                  أسبوع
                </button>
              </div>
            </div>

            {/* Date Range Filters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 border border-gray-200 dark:border-gray-700">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  من تاريخ
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="modern-form-input transition-smooth w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  إلى تاريخ
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="modern-form-input transition-smooth w-full"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => {
                    const today = new Date();
                    const monthAgo = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
                    setDateFrom(monthAgo.toISOString().split('T')[0]);
                    setDateTo(today.toISOString().split('T')[0]);
                  }}
                  className="w-full px-3 py-2 quick-action-btn text-white rounded-lg transition-all text-sm font-medium"
                  style={{ '--btn-color': '#8b5cf6', '--btn-color-dark': '#7c3aed' } as React.CSSProperties}
                >
                  شهر
                </button>
              </div>
            </div>

            {/* Active Filters Display */}
            {hasActiveFilters && (
              <div className="flex flex-wrap gap-2">
                {searchTerm && (
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-sm font-medium">
                    <Search className="w-3.5 h-3.5" />
                    {searchTerm}
                    <button onClick={() => setSearchTerm('')} className="hover:text-blue-900 dark:hover:text-blue-200">
                      <XCircle className="w-3.5 h-3.5" />
                    </button>
                  </span>
                )}
                {selectedStatus !== 'all' && (
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 text-sm font-medium">
                    <Filter className="w-3.5 h-3.5" />
                    {selectedStatus === 'pending' ? 'معلق' : 
                     selectedStatus === 'paid' ? 'مدفوع' : 
                     selectedStatus === 'partially_paid' ? 'مدفوع جزئياً' : selectedStatus}
                    <button onClick={() => setSelectedStatus('all')} className="hover:text-purple-900 dark:hover:text-purple-200">
                      <XCircle className="w-3.5 h-3.5" />
                    </button>
                  </span>
                )}
                {dateFrom && (
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-sm font-medium">
                    <Clock className="w-3.5 h-3.5" />
                    من: {new Date(dateFrom).toLocaleDateString('ar-EG')}
                    <button onClick={() => setDateFrom('')} className="hover:text-green-900 dark:hover:text-green-200">
                      <XCircle className="w-3.5 h-3.5" />
                    </button>
                  </span>
                )}
                {dateTo && (
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 text-sm font-medium">
                    <Clock className="w-3.5 h-3.5" />
                    إلى: {new Date(dateTo).toLocaleDateString('ar-EG')}
                    <button onClick={() => setDateTo('')} className="hover:text-orange-900 dark:hover:text-orange-200">
                      <XCircle className="w-3.5 h-3.5" />
                    </button>
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Costs List */}
      {loading && !costs.length ? (
        <CostsTableSkeleton />
      ) : error ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-8">
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <AlertCircle className="w-16 h-16 text-red-500 dark:text-red-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                حدث خطأ أثناء تحميل التكاليف
              </h3>
              <p className="text-gray-600 dark:text-gray-400">{error}</p>
            </div>
            <button
              onClick={handleRetry}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <RefreshCw className="w-5 h-5" />
              إعادة المحاولة
            </button>
          </div>
        </div>
      ) : (
      <div className="modern-table-container stagger-item">
        {!costs || costs.length === 0 ? (
          <div className="modern-empty-state">
            <div className="modern-empty-icon">
              <DollarSign className="w-12 h-12" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">لا توجد تكاليف</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              {hasActiveFilters ? 'لم يتم العثور على نتائج مطابقة للفلاتر المحددة' : 'ابدأ بإضافة أول تكلفة'}
            </p>
            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="modern-action-btn modern-action-btn-primary"
              >
                مسح الفلاتر
              </button>
            )}
          </div>
        ) : (
          <div className="costs-list-container modern-scrollbar">
            {costs?.map((cost, index) => (
              <div
                key={cost._id}
                className="cost-card-modern stagger-item cursor-pointer"
                style={{ 
                  animationDelay: `${index * 0.05}s`,
                  '--category-color': cost.category?.color || '#667eea'
                } as React.CSSProperties}
                onClick={() => {
                  setSelectedCostForDetails(cost);
                  setShowDetailsModal(true);
                }}
              >
                {/* Header Section */}
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {/* Category Icon */}
                    <div
                      className="cost-card-icon"
                      style={{ 
                        background: `linear-gradient(135deg, ${cost.category?.color || '#667eea'} 0%, ${cost.category?.color || '#667eea'}dd 100%)`,
                        boxShadow: `0 6px 20px -6px ${cost.category?.color || '#667eea'}40`
                      }}
                    >
                      {getCategoryIcon(cost.category?.icon || 'DollarSign')}
                    </div>
                    
                    {/* Title & Description */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h3 className="text-base font-bold text-gray-900 dark:text-white truncate">
                          {cost.description}
                        </h3>
                        <span 
                          className="px-2.5 py-0.5 rounded-full text-xs font-bold flex-shrink-0"
                          style={{ 
                            backgroundColor: `${cost.category?.color || '#667eea'}20`,
                            color: cost.category?.color || '#667eea'
                          }}
                        >
                          {cost.category?.name || 'غير محدد'}
                        </span>
                      </div>
                      {cost.vendor && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                          <span className="w-1 h-1 rounded-full bg-gray-400"></span>
                          <span className="truncate">{cost.vendor}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Status Badge */}
                  <span className={`modern-status-badge flex-shrink-0 text-xs ${getStatusColor(cost.status)}`}>
                    {getStatusIcon(cost.status)}
                    {getStatusText(cost.status)}
                  </span>
                </div>

                {/* Amounts Section */}
                <div className="grid grid-cols-3 gap-3 mb-3">
                  {/* Total Amount */}
                  <div className="cost-amount-card">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                        <DollarSign className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">الإجمالي</span>
                    </div>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                      {formatCurrency(cost.amount)}
                    </p>
                  </div>

                  {/* Paid Amount */}
                  <div className="cost-amount-card">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <div className="p-1.5 rounded-lg bg-green-100 dark:bg-green-900/30">
                        <CheckCircle className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                      </div>
                      <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">المدفوع</span>
                    </div>
                    <p className="text-lg font-bold text-green-600 dark:text-green-400">
                      {formatCurrency(cost.paidAmount)}
                    </p>
                  </div>

                  {/* Remaining Amount */}
                  <div className="cost-amount-card">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <div className="p-1.5 rounded-lg bg-red-100 dark:bg-red-900/30">
                        <AlertCircle className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                      </div>
                      <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">المتبقي</span>
                    </div>
                    <p className="text-lg font-bold text-red-600 dark:text-red-400">
                      {formatCurrency(cost.remainingAmount)}
                    </p>
                  </div>
                </div>

                {/* Footer Section */}
                <div className="flex items-center justify-center pt-3 border-t border-gray-200 dark:border-gray-700">
                  {/* Date */}
                  <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{new Date(cost.date).toLocaleDateString('ar-EG', { 
                      day: 'numeric', 
                      month: 'short', 
                      year: 'numeric' 
                    })}</span>
                  </div>
                </div>
              </div>
            ))}

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <span>صفحة {pagination.page} من {pagination.totalPages}</span>
                  <span>•</span>
                  <span>إجمالي {stats.count} تكلفة</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const newPage = pagination.page - 1;
                      if (newPage >= 1) {
                        setPagination(prev => ({ ...prev, page: newPage }));
                      }
                    }}
                    disabled={!pagination.hasPrev}
                    className="px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    السابق
                  </button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                      const pageNum = i + 1;
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setPagination(prev => ({ ...prev, page: pageNum }))}
                          className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                            pagination.page === pageNum
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => {
                      const newPage = pagination.page + 1;
                      if (newPage <= pagination.totalPages) {
                        setPagination(prev => ({ ...prev, page: newPage }));
                      }
                    }}
                    disabled={!pagination.hasNext}
                    className="px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    التالي
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      )}

      {/* Category Manager Modal */}
      <CategoryManagerModal
        isOpen={showCategoryModal}
        onClose={() => {
          setShowCategoryModal(false);
          // Refresh categories when modal closes
          fetchCategories();
        }}
        onSave={() => {
          fetchCategories();
          fetchCosts();
        }}
      />

      {/* Cost Form Modal */}
      <CostFormModal
        isOpen={showCostModal}
        onClose={() => {
          setShowCostModal(false);
          setEditingCost(null);
        }}
        onSave={() => {
          fetchCosts();
          setShowCostModal(false);
          setEditingCost(null);
        }}
        editingCost={editingCost}
        categories={categories}
      />

      {/* Payment Addition Modal */}
      <PaymentAdditionModal
        isOpen={showPaymentModal}
        onClose={() => {
          setShowPaymentModal(false);
          setSelectedCostForPayment(null);
        }}
        onSave={handleAddPayment}
        cost={selectedCostForPayment}
      />

      {/* Cost Details Modal */}
      <CostDetailsModal
        isOpen={showDetailsModal}
        onClose={() => {
          setShowDetailsModal(false);
          setSelectedCostForDetails(null);
        }}
        cost={selectedCostForDetails}
        onRefresh={fetchCosts}
        onEdit={(cost) => {
          setEditingCost(cost as any);
          setShowCostModal(true);
        }}
        onDelete={handleDeleteCost}
        onAddPayment={openPaymentModal}
      />
    </div>
  );
};

export default Costs;
