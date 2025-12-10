import { useState, useEffect } from 'react';
import { X, DollarSign } from 'lucide-react';
import { formatCurrency } from '../utils/formatters';

interface Cost {
  _id: string;
  description: string;
  amount: number;
  paidAmount: number;
  remainingAmount: number;
  category: {
    name: string;
    icon: string;
    color: string;
  };
}

interface PaymentAdditionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (paymentAmount: number, paymentMethod: string, notes?: string) => Promise<void>;
  cost: Cost | null;
}

const PaymentAdditionModal = ({ isOpen, onClose, onSave, cost }: PaymentAdditionModalProps) => {
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (isOpen && cost) {
      // Reset form when modal opens
      setPaymentAmount('');
      setPaymentMethod('cash');
      setNotes('');
      setError('');
    }
  }, [isOpen, cost]);

  if (!isOpen || !cost) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const amount = parseFloat(paymentAmount);

    // Validation
    if (isNaN(amount) || amount <= 0) {
      setError('يرجى إدخال مبلغ صحيح');
      return;
    }

    if (amount > cost.remainingAmount) {
      setError(`المبلغ يتجاوز المتبقي (${formatCurrency(cost.remainingAmount)})`);
      return;
    }

    try {
      setLoading(true);
      await onSave(amount, paymentMethod, notes.trim() || undefined);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'فشل في إضافة الدفعة');
    } finally {
      setLoading(false);
    }
  };

  const handlePayFull = () => {
    setPaymentAmount(cost.remainingAmount.toString());
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full animate-slideUp" dir="rtl">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg">
                <DollarSign className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  إضافة دفعة
                </h2>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                  تسجيل دفعة جديدة للتكلفة
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/50 dark:hover:bg-gray-700/50 rounded-xl transition-all duration-200 hover:scale-110"
            >
              <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Cost Info */}
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700/50 dark:to-gray-800/50 rounded-xl p-4 space-y-3 border-2 border-gray-200 dark:border-gray-600">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">الوصف:</span>
              <span className="text-sm font-bold text-gray-900 dark:text-white">
                {cost.description}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">المبلغ الكلي:</span>
              <span className="text-sm font-bold text-gray-900 dark:text-white">
                {formatCurrency(cost.amount)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">المدفوع:</span>
              <span className="text-sm font-bold text-green-600 dark:text-green-400">
                {formatCurrency(cost.paidAmount)}
              </span>
            </div>
            <div className="flex items-center justify-between border-t-2 border-gray-300 dark:border-gray-600 pt-3 mt-2">
              <span className="text-base font-bold text-gray-900 dark:text-white">المتبقي:</span>
              <span className="text-2xl font-bold text-red-600 dark:text-red-400">
                {formatCurrency(cost.remainingAmount)}
              </span>
            </div>
          </div>

          {/* Payment Amount */}
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-green-600" />
              مبلغ الدفعة <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0"
                max={cost.remainingAmount}
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="أدخل مبلغ الدفعة..."
                className="form-field w-full px-4 py-3 pr-12 border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all text-lg font-semibold"
                required
              />
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                <DollarSign className="w-5 h-5" />
              </div>
            </div>
            <button
              type="button"
              onClick={handlePayFull}
              className="mt-2 text-sm font-semibold text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 hover:underline transition-colors"
            >
              💰 دفع المبلغ المتبقي بالكامل ({formatCurrency(cost.remainingAmount)})
            </button>
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
              طريقة الدفع
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="form-field w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all font-semibold"
            >
              <option value="cash">💵 نقدي</option>
              <option value="card">💳 بطاقة</option>
              <option value="transfer">🏦 تحويل بنكي</option>
              <option value="check">📝 شيك</option>
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
              ملاحظات <span className="text-xs font-normal text-gray-500">(اختياري)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="رقم الإيصال، ملاحظات إضافية، تفاصيل الدفع..."
              rows={3}
              className="form-field w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all resize-none"
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-900/30 dark:to-rose-900/30 border-2 border-red-200 dark:border-red-800 rounded-xl p-4 flex items-start gap-3 animate-slideUp">
              <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/50">
                <X className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <p className="text-sm font-semibold text-red-700 dark:text-red-400 flex-1">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t-2 border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 font-semibold hover:scale-105"
              disabled={loading}
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 font-semibold"
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>جاري الحفظ...</span>
                </>
              ) : (
                <>
                  <DollarSign className="w-5 h-5" />
                  <span>إضافة الدفعة</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PaymentAdditionModal;
