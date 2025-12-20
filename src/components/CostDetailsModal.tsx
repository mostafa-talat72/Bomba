import { useState } from 'react';
import { X, DollarSign, CheckCircle, AlertCircle, Clock, Wallet, User, Plus, TrendingUp, Edit, Trash2 } from 'lucide-react';
import { formatCurrency } from '../utils/formatters';
import * as LucideIcons from 'lucide-react';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';
import ConfirmDialog from './ConfirmDialog';

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
  category: {
    name: string;
    icon: string;
    color: string;
  };
  description: string;
  amount: number;
  paidAmount: number;
  remainingAmount: number;
  date: string;
  dueDate?: string;
  status: string;
  paymentMethod: string;
  vendor?: string;
  notes?: string;
  paymentHistory?: PaymentHistoryItem[];
  amountHistory?: AmountHistoryItem[];
  createdAt: string;
}

interface CostDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  cost: Cost | null;
  onRefresh?: () => void;
  onEdit?: (cost: Cost) => void;
  onDelete?: (costId: string) => void;
  onAddPayment?: (cost: Cost) => void;
}

const CostDetailsModal = ({ isOpen, onClose, cost, onRefresh, onEdit, onDelete, onAddPayment }: CostDetailsModalProps) => {
  const { showNotification } = useApp();
  const [showIncreaseModal, setShowIncreaseModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [additionalAmount, setAdditionalAmount] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  
  if (!isOpen || !cost) return null;

  const handleIncreaseAmount = async () => {
    const amount = parseFloat(additionalAmount);
    
    if (isNaN(amount) || amount <= 0) {
      showNotification('يرجى إدخال مبلغ صحيح', 'error');
      return;
    }

    try {
      setLoading(true);
      await api.post(`/costs/${cost._id}/increase`, {
        additionalAmount: amount,
        reason: reason.trim() || undefined,
      });
      showNotification('تم زيادة المبلغ بنجاح', 'success');
      setShowIncreaseModal(false);
      setAdditionalAmount('');
      setReason('');
      if (onRefresh) onRefresh();
      onClose();
    } catch (error: any) {
      showNotification(error.response?.data?.message || 'فشل في زيادة المبلغ', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!onDelete) {
      return;
    }
    
    try {
      setDeleteLoading(true);
      await onDelete(cost._id);
      showNotification('تم حذف التكلفة بنجاح', 'success');
      setShowDeleteConfirm(false);
      if (onRefresh) onRefresh();
      onClose();
    } catch (error: any) {
      showNotification(error.response?.data?.message || 'فشل في حذف التكلفة', 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  const getCategoryIcon = (iconName: string) => {
    const Icon = (LucideIcons as any)[iconName] || DollarSign;
    return <Icon className="w-6 h-6" />;
  };

  const getPaymentMethodText = (method: string) => {
    switch (method) {
      case 'cash': return 'نقدي';
      case 'card': return 'بطاقة';
      case 'transfer': return 'تحويل';
      case 'check': return 'شيك';
      default: return method;
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div 
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden"
        dir="rtl"
      >
        {/* Header */}
        <div 
          className="p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0"
          style={{ 
            background: `linear-gradient(135deg, ${cost?.category?.color || '#667eea'}15 0%, ${cost?.category?.color || '#667eea'}05 100%)`
          }}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4 flex-1">
              <div
                className="p-4 rounded-2xl"
                style={{ 
                  background: `linear-gradient(135deg, ${cost?.category?.color || '#667eea'} 0%, ${cost?.category?.color || '#667eea'}dd 100%)`,
                  boxShadow: `0 8px 24px -6px ${cost?.category?.color || '#667eea'}60`
                }}
              >
                <div className="text-white">
                  {getCategoryIcon(cost?.category?.icon || 'DollarSign')}
                </div>
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                  {cost.description}
                </h2>
                <div className="flex items-center gap-2 flex-wrap">
                  <span 
                    className="px-3 py-1 rounded-full text-sm font-bold"
                    style={{ 
                      backgroundColor: `${cost?.category?.color || '#667eea'}20`,
                      color: cost?.category?.color || '#667eea'
                    }}
                  >
                    {cost?.category?.name || 'غير محدد'}
                  </span>
                  {cost.vendor && (
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      • {cost.vendor}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="w-6 h-6 text-gray-500 dark:text-gray-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 modern-scrollbar">
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-semibold text-blue-900 dark:text-blue-300">المبلغ الإجمالي</span>
              </div>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {formatCurrency(cost.amount)}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                <span className="text-sm font-semibold text-green-900 dark:text-green-300">المدفوع</span>
              </div>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {formatCurrency(cost.paidAmount)}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                <span className="text-sm font-semibold text-red-900 dark:text-red-300">المتبقي</span>
              </div>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                {formatCurrency(cost.remainingAmount)}
              </p>
            </div>
          </div>

          {/* Details */}
          <div className="mb-6 p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">التاريخ:</span>
              <span className="text-sm text-gray-900 dark:text-white">
                {new Date(cost.date).toLocaleDateString('ar-EG', { 
                  day: 'numeric', 
                  month: 'long', 
                  year: 'numeric' 
                })}
              </span>
            </div>
            {cost.dueDate && (
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">تاريخ الاستحقاق:</span>
                <span className="text-sm text-gray-900 dark:text-white">
                  {new Date(cost.dueDate).toLocaleDateString('ar-EG', { 
                    day: 'numeric', 
                    month: 'long', 
                    year: 'numeric' 
                  })}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">الحالة:</span>
              <span className="text-sm font-bold" style={{ color: cost?.category?.color || '#667eea' }}>
                {getStatusText(cost.status)}
              </span>
            </div>
            {cost.notes && (
              <div className="pt-3 border-t border-gray-200 dark:border-gray-600">
                <span className="text-sm font-semibold text-gray-600 dark:text-gray-400 block mb-1">ملاحظات:</span>
                <p className="text-sm text-gray-700 dark:text-gray-300">{cost.notes}</p>
              </div>
            )}
          </div>

          {/* Amount History */}
          {cost.amountHistory && cost.amountHistory.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  سجل زيادات المبلغ
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 text-xs font-bold">
                  {cost.amountHistory.length}
                </span>
              </div>

              <div className="space-y-3">
                {cost.amountHistory.map((increase, idx) => (
                  <div 
                    key={idx}
                    className="p-4 rounded-xl bg-gradient-to-br from-orange-50 to-yellow-50 dark:from-orange-900/20 dark:to-yellow-900/20 border border-orange-200 dark:border-orange-800 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30">
                          <TrendingUp className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-lg font-bold text-orange-600 dark:text-orange-400">
                              +{formatCurrency(increase.addedAmount)}
                            </p>
                          </div>
                          <div className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">من:</span>
                              <span>{formatCurrency(increase.previousTotal)}</span>
                              <span className="text-gray-400">←</span>
                              <span className="font-semibold">إلى:</span>
                              <span className="font-bold text-orange-600 dark:text-orange-400">
                                {formatCurrency(increase.newTotal)}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mt-2">
                            <Clock className="w-4 h-4" />
                            <span>
                              {new Date(increase.addedAt).toLocaleDateString('ar-EG', { 
                                day: 'numeric', 
                                month: 'long', 
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                          {increase.addedBy && (
                            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mt-1">
                              <User className="w-4 h-4" />
                              <span>{increase.addedBy.name}</span>
                            </div>
                          )}
                          {increase.reason && (
                            <p className="text-sm text-gray-700 dark:text-gray-300 mt-2 p-2 rounded bg-white dark:bg-gray-700/50 border border-orange-200 dark:border-orange-800">
                              <span className="font-semibold">السبب: </span>
                              {increase.reason}
                            </p>
                          )}
                        </div>
                      </div>
                      <span className="text-xs font-bold text-orange-600 dark:text-orange-400">
                        #{idx + 1}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Payment History */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Wallet className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                سجل الدفعات
              </h3>
              {cost.paymentHistory && cost.paymentHistory.length > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-bold">
                  {cost.paymentHistory.length}
                </span>
              )}
            </div>

            {!cost.paymentHistory || cost.paymentHistory.length === 0 ? (
              <div className="text-center py-8 px-4 rounded-xl bg-gray-50 dark:bg-gray-700/50 border-2 border-dashed border-gray-300 dark:border-gray-600">
                <Wallet className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400">لا توجد دفعات مسجلة</p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                  سيتم عرض جميع الدفعات هنا
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {cost.paymentHistory.map((payment, idx) => (
                  <div 
                    key={idx}
                    className="p-4 rounded-xl bg-gradient-to-br from-white to-gray-50 dark:from-gray-700 dark:to-gray-800 border border-gray-200 dark:border-gray-600 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                          <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-lg font-bold text-gray-900 dark:text-white">
                              {formatCurrency(payment.amount)}
                            </p>
                            <span className="px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-600 text-xs font-medium text-gray-700 dark:text-gray-300">
                              {getPaymentMethodText(payment.paymentMethod)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                            <Clock className="w-4 h-4" />
                            <span>
                              {new Date(payment.paidAt).toLocaleDateString('ar-EG', { 
                                day: 'numeric', 
                                month: 'long', 
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                          {payment.paidBy && (
                            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mt-1">
                              <User className="w-4 h-4" />
                              <span>{payment.paidBy.name}</span>
                            </div>
                          )}
                          {payment.notes && (
                            <p className="text-sm text-gray-700 dark:text-gray-300 mt-2 p-2 rounded bg-gray-100 dark:bg-gray-600/50">
                              {payment.notes}
                            </p>
                          )}
                        </div>
                      </div>
                      <span className="text-xs font-bold text-gray-500 dark:text-gray-400">
                        #{idx + 1}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer - Action Buttons */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 flex-shrink-0">
          {/* Primary Action Buttons */}
          {(cost.remainingAmount > 0 && cost.status !== 'cancelled' && onAddPayment) ? (
            // Show both buttons when payment is available
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <button
                onClick={() => {
                  onAddPayment(cost);
                  onClose();
                }}
                className="group relative overflow-hidden px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 font-semibold"
              >
                <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity"></div>
                <div className="relative flex items-center justify-center gap-2">
                  <Wallet className="w-5 h-5" />
                  <span>إضافة دفعة</span>
                </div>
              </button>
              
              <button
                onClick={() => setShowIncreaseModal(true)}
                className="group relative overflow-hidden px-4 py-3 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 font-semibold"
              >
                <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity"></div>
                <div className="relative flex items-center justify-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  <span>زيادة المبلغ</span>
                </div>
              </button>
            </div>
          ) : (
            // Show only increase button when payment is not available
            <div className="mb-3">
              <button
                onClick={() => setShowIncreaseModal(true)}
                className="w-full group relative overflow-hidden px-4 py-3 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 font-semibold"
              >
                <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity"></div>
                <div className="relative flex items-center justify-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  <span>زيادة المبلغ</span>
                </div>
              </button>
            </div>
          )}

          <div className={`grid gap-3 ${cost.status === 'paid' ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'}`}>
            {/* Edit Button */}
            {onEdit && (
              <button
                onClick={() => {
                  onEdit(cost);
                  onClose();
                }}
                className="group relative overflow-hidden px-4 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl transition-all duration-300 shadow-md hover:shadow-lg hover:scale-105 font-medium"
              >
                <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity"></div>
                <div className="relative flex items-center justify-center gap-2">
                  <Edit className="w-4 h-4" />
                  <span>تعديل</span>
                </div>
              </button>
            )}

            {/* Delete Button - Only show if not fully paid */}
            {onDelete && cost.status !== 'paid' && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="group relative overflow-hidden px-4 py-2.5 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white rounded-xl transition-all duration-300 shadow-md hover:shadow-lg hover:scale-105 font-medium"
              >
                <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity"></div>
                <div className="relative flex items-center justify-center gap-2">
                  <Trash2 className="w-4 h-4" />
                  <span>حذف</span>
                </div>
              </button>
            )}

            {/* Close Button */}
            <button
              onClick={onClose}
              className="group relative overflow-hidden px-4 py-2.5 bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white rounded-xl transition-all duration-300 shadow-md hover:shadow-lg hover:scale-105 font-medium"
            >
              <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity"></div>
              <div className="relative flex items-center justify-center gap-2">
                <X className="w-4 h-4" />
                <span>إغلاق</span>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Increase Amount Modal */}
      {showIncreaseModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-fadeIn">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl max-w-md w-full animate-slideUp" dir="rtl">
            {/* Header with Gradient */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 rounded-t-3xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 shadow-lg">
                    <TrendingUp className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                      زيادة المبلغ
                    </h3>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                      إضافة مبلغ إضافي للتكلفة
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowIncreaseModal(false)}
                  className="p-2 hover:bg-white/50 dark:hover:bg-gray-700/50 rounded-xl transition-all duration-200 hover:scale-110"
                  disabled={loading}
                >
                  <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5">
              {/* Current Amount Display */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-2 border-blue-200 dark:border-blue-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    <span className="text-sm font-semibold text-blue-900 dark:text-blue-300">المبلغ الحالي</span>
                  </div>
                  <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {formatCurrency(cost.amount)}
                  </span>
                </div>
              </div>

              {/* Additional Amount Input */}
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-orange-600" />
                  المبلغ الإضافي <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={additionalAmount}
                    onChange={(e) => setAdditionalAmount(e.target.value)}
                    placeholder="أدخل المبلغ الإضافي..."
                    className="w-full px-4 py-3 pr-12 border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all text-lg font-semibold"
                    disabled={loading}
                  />
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                    <DollarSign className="w-5 h-5" />
                  </div>
                </div>
              </div>

              {/* Reason Input */}
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-gray-600" />
                  السبب <span className="text-xs font-normal text-gray-500">(اختياري)</span>
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="مثال: شراء إضافي، زيادة في السعر، تكاليف إضافية..."
                  rows={3}
                  className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all resize-none"
                  disabled={loading}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowIncreaseModal(false)}
                  className="flex-1 px-4 py-3 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 font-semibold hover:scale-105"
                  disabled={loading}
                >
                  إلغاء
                </button>
                <button
                  onClick={handleIncreaseAmount}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-lg hover:shadow-xl hover:scale-105 flex items-center justify-center gap-2"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>جاري الحفظ...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-5 h-5" />
                      <span>تأكيد الزيادة</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteConfirm}
        title="تأكيد الحذف"
        message="هل أنت متأكد من حذف هذه التكلفة؟ لا يمكن التراجع عن هذا الإجراء."
        confirmText="حذف"
        cancelText="إلغاء"
        type="danger"
        loading={deleteLoading}
      />
    </div>
  );
};

export default CostDetailsModal;
