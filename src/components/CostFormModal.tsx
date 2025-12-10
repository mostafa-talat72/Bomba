import React, { useState, useEffect } from 'react';
import { Save, DollarSign, AlertCircle, CheckCircle, X } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';

interface CostCategory {
  _id: string;
  name: string;
  icon: string;
  color: string;
  description?: string;
  isActive: boolean;
  sortOrder: number;
}

interface Cost {
  _id: string;
  category: string | CostCategory;
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
}

interface CostFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  editingCost?: Cost | null;
  categories: CostCategory[];
}

const CostFormModal: React.FC<CostFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingCost,
  categories,
}) => {
  const { showNotification } = useApp();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    category: '',
    description: '',
    amount: 0,
    paidAmount: 0,
    date: new Date().toISOString().split('T')[0],
    dueDate: '',
    paymentMethod: 'cash',
    vendor: '',
    notes: '',
  });

  // Calculate remaining amount
  const remainingAmount = Math.max(0, formData.amount - formData.paidAmount);

  useEffect(() => {
    if (editingCost) {
      const categoryId = typeof editingCost.category === 'string' 
        ? editingCost.category 
        : editingCost.category._id;
      
      setFormData({
        category: categoryId,
        description: editingCost.description,
        amount: editingCost.amount,
        paidAmount: editingCost.paidAmount,
        date: editingCost.date.split('T')[0],
        dueDate: editingCost.dueDate ? editingCost.dueDate.split('T')[0] : '',
        paymentMethod: editingCost.paymentMethod,
        vendor: editingCost.vendor || '',
        notes: editingCost.notes || '',
      });
    } else {
      // Reset form for new cost
      setFormData({
        category: '',
        description: '',
        amount: 0,
        paidAmount: 0,
        date: new Date().toISOString().split('T')[0],
        dueDate: '',
        paymentMethod: 'cash',
        vendor: '',
        notes: '',
      });
    }
  }, [editingCost, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.category) {
      showNotification('يرجى اختيار القسم', 'error');
      return;
    }

    if (!formData.description.trim()) {
      showNotification('يرجى إدخال وصف التكلفة', 'error');
      return;
    }

    if (formData.amount <= 0) {
      showNotification('يرجى إدخال مبلغ صحيح', 'error');
      return;
    }

    if (formData.paidAmount < 0) {
      showNotification('المبلغ المدفوع لا يمكن أن يكون سالباً', 'error');
      return;
    }

    if (formData.paidAmount > formData.amount) {
      showNotification('المبلغ المدفوع لا يمكن أن يتجاوز المبلغ الإجمالي', 'error');
      return;
    }

    try {
      setLoading(true);

      const payload = {
        ...formData,
        currency: 'EGP', // Add default currency
        dueDate: formData.dueDate || undefined,
      };

      console.log('Cost Form - Payload:', payload);

      if (editingCost) {
        // Update existing cost
        const response = await api.put(`/costs/${editingCost._id}`, payload);
        console.log('Cost Form - Update Response:', response);
        showNotification('تم تحديث التكلفة بنجاح', 'success');
      } else {
        // Create new cost
        const response = await api.post('/costs', payload);
        console.log('Cost Form - Create Response:', response);
        showNotification('تم إضافة التكلفة بنجاح', 'success');
      }

      onSave();
      onClose();
    } catch (error: any) {
      console.error('Cost Form - Error:', error);
      const message = error.response?.data?.message || error.message || 'فشل في حفظ التكلفة';
      showNotification(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const getCategoryIcon = (iconName: string) => {
    const Icon = (LucideIcons as any)[iconName] || LucideIcons.DollarSign;
    return <Icon className="w-5 h-5" />;
  };

  const getSelectedCategory = () => {
    return categories.find(cat => cat._id === formData.category);
  };

  const selectedCategory = getSelectedCategory();

  return isOpen ? (
    <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div 
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden"
        dir="rtl"
      >
        {/* Header */}
        <div 
          className="p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0"
          style={{ 
            background: editingCost 
              ? 'linear-gradient(135deg, #3B82F615 0%, #6366F105 100%)'
              : 'linear-gradient(135deg, #10B98115 0%, #059669 05 100%)'
          }}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4 flex-1">
              <div
                className="p-4 rounded-2xl"
                style={{ 
                  background: editingCost 
                    ? 'linear-gradient(135deg, #3B82F6 0%, #6366F1 100%)'
                    : 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                  boxShadow: editingCost 
                    ? '0 8px 24px -6px rgba(59, 130, 246, 0.6)'
                    : '0 8px 24px -6px rgba(16, 185, 129, 0.6)'
                }}
              >
                <DollarSign className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                  {editingCost ? 'تعديل التكلفة' : 'إضافة تكلفة جديدة'}
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {editingCost ? 'تحديث بيانات التكلفة' : 'إضافة تكلفة جديدة للنظام'}
                </p>
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
          <form onSubmit={handleSubmit} className="space-y-5">
        {/* Category Selection */}
        <div>
          <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
            القسم <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="form-field w-full px-4 py-3 pr-12 border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all appearance-none font-semibold"
              required
            >
              <option value="">اختر القسم</option>
              {categories?.map((cat) => (
                <option key={cat._id} value={cat._id}>
                  {cat.name}
                </option>
              ))}
            </select>
            {selectedCategory && (
              <div
                className="absolute left-3 top-1/2 transform -translate-y-1/2 p-1 rounded"
                style={{ backgroundColor: `${selectedCategory.color}20` }}
              >
                <div style={{ color: selectedCategory.color }}>
                  {getCategoryIcon(selectedCategory.icon)}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
            الوصف <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="مثال: فاتورة كهرباء شهر يناير"
            className="form-field w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-semibold"
            required
          />
        </div>

        {/* Amount and Paid Amount */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-blue-600" />
              المبلغ الإجمالي <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
              placeholder="أدخل المبلغ الإجمالي..."
              className="form-field w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-semibold text-lg"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              المبلغ المدفوع
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              max={formData.amount}
              value={formData.paidAmount}
              onChange={(e) => setFormData({ ...formData, paidAmount: parseFloat(e.target.value) || 0 })}
              placeholder="أدخل المبلغ المدفوع..."
              className="form-field w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all font-semibold text-lg"
            />
          </div>
        </div>

        {/* Remaining Amount Display */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <DollarSign className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <span className="text-sm font-bold text-blue-900 dark:text-blue-300">
                المبلغ المتبقي:
              </span>
            </div>
            <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {remainingAmount.toFixed(2)} جنيه
            </span>
          </div>
          {formData.paidAmount > 0 && formData.paidAmount < formData.amount && (
            <div className="flex items-center gap-2 mt-3 p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
              <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
              <p className="text-xs text-yellow-700 dark:text-yellow-400 font-medium">
                سيتم تحديث حالة الدفع تلقائياً إلى "مدفوع جزئياً"
              </p>
            </div>
          )}
          {formData.paidAmount >= formData.amount && formData.amount > 0 && (
            <div className="flex items-center gap-2 mt-3 p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
              <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
              <p className="text-xs text-green-700 dark:text-green-400 font-medium">
                سيتم تحديث حالة الدفع تلقائياً إلى "مدفوع"
              </p>
            </div>
          )}
        </div>

        {/* Date and Due Date */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
              📅 التاريخ <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="form-field w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-semibold"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
              📆 تاريخ الاستحقاق <span className="text-xs font-normal text-gray-500">(اختياري)</span>
            </label>
            <input
              type="date"
              value={formData.dueDate}
              onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
              className="form-field w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-semibold"
            />
          </div>
        </div>

        {/* Payment Method */}
        <div>
          <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
            طريقة الدفع
          </label>
          <select
            value={formData.paymentMethod}
            onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
            className="form-field w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-semibold"
          >
            <option value="cash">💵 نقدي</option>
            <option value="card">💳 بطاقة</option>
            <option value="transfer">🏦 تحويل بنكي</option>
            <option value="check">📝 شيك</option>
          </select>
        </div>

        {/* Vendor */}
        <div>
          <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
            🏢 المورد <span className="text-xs font-normal text-gray-500">(اختياري)</span>
          </label>
          <input
            type="text"
            value={formData.vendor}
            onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
            placeholder="اسم المورد أو الجهة..."
            className="form-field w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-semibold"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
            📝 ملاحظات <span className="text-xs font-normal text-gray-500">(اختياري)</span>
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="أي ملاحظات إضافية..."
            rows={3}
            className="form-field w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all resize-none"
          />
        </div>

        {/* Form Actions */}
        <div className="flex gap-3 pt-6 border-t-2 border-gray-200 dark:border-gray-700">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 group relative overflow-hidden px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 font-semibold"
          >
            <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity"></div>
            <div className="relative flex items-center justify-center gap-2">
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>جاري الحفظ...</span>
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  <span>{editingCost ? 'تحديث التكلفة' : 'حفظ التكلفة'}</span>
                </>
              )}
            </div>
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-6 py-3 bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white rounded-xl transition-all duration-300 shadow-md hover:shadow-lg hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 font-semibold"
          >
            إلغاء
          </button>
        </div>
          </form>
        </div>
      </div>
    </div>
  ) : null;
};

export default CostFormModal;
