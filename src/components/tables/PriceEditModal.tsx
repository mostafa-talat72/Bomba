import React, { useState, useEffect } from 'react';
import { X, DollarSign, Save } from 'lucide-react';
import ModalPortal from '../ModalPortal';
import { useTranslation } from 'react-i18next';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  item: { menuItem: string; name: string; price: number; quantity: number; variant?: string | null } | null;
  onSave: (quantity: number, newPrice: number) => void;
  formatCurrency: (n: number) => string;
}

const PriceEditModal: React.FC<Props> = ({ isOpen, onClose, item, onSave, formatCurrency }) => {
  const { t } = useTranslation();
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && item) {
      setQty(item.quantity);
      setPrice(String(item.price));
      setError(null);
    }
  }, [isOpen, item]);

  if (!isOpen || !item) return null;

  const handleSave = () => {
    const q = parseInt(String(qty));
    const p = parseFloat(String(price));
    if (!q || q < 1 || q > item.quantity) {
      setError(`الكمية يجب أن تكون بين 1 و ${item.quantity}`);
      return;
    }
    if (isNaN(p) || p < 0) {
      setError('السعر يجب أن يكون رقم موجب');
      return;
    }
    onSave(q, p);
    onClose();
  };

  const currentTotal = item.price * item.quantity;
  const newTotalPreview = (() => {
    const q = parseInt(String(qty)) || 0;
    const p = parseFloat(String(price)) || 0;
    if (q >= item.quantity) return q * p;
    // split: (total - q)*old + q*new
    return (item.quantity - q) * item.price + q * p;
  })();

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[330] flex items-center justify-center bg-black/60 backdrop-blur-sm p-3" onClick={onClose}>
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm border border-gray-200 dark:border-gray-700 overflow-hidden" onClick={e => e.stopPropagation()}>
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              <h3 className="font-bold text-lg">تعديل سعر الصنف</h3>
            </div>
            <button onClick={onClose} className="w-8 h-8 bg-white/15 hover:bg-white/25 rounded-lg flex items-center justify-center">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="p-4 space-y-4">
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
              <p className="font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2 flex-wrap">
                {item.name}
                {item.variant && <span className="text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 px-2 py-0.5 rounded-full font-bold">الحجم: {item.variant}</span>}
              </p>
              <p className="text-sm text-gray-500">السعر الحالي: {formatCurrency(item.price)} × {item.quantity} = {formatCurrency(currentTotal)}</p>
              {item.variant && <p className="text-xs text-gray-400">الحجم الحالي: {item.variant}</p>}
            </div>

            {item.quantity > 1 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">الكمية المراد تعديل سعرها</label>
                <div className="flex items-center gap-2">
                  <input type="number" min={1} max={item.quantity} value={qty} onChange={e => setQty(parseInt(e.target.value) || 1)}
                    className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-center font-bold focus:ring-1 focus:ring-blue-400 outline-none dark:text-white" />
                  <span className="text-sm text-gray-500">من {item.quantity}</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">لو اخترت كمية أقل من الإجمالي سيتم تقسيم الصنف إلى سطرين</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">السعر الجديد للوحدة</label>
              <input type="number" min={0} step={0.5} value={price} onChange={e => setPrice(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 font-bold focus:ring-1 focus:ring-blue-400 outline-none dark:text-white" placeholder="0.00" autoFocus />
            </div>

            {error && <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/30 border border-red-200 rounded-lg p-2">{error}</p>}

            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2 text-center border border-blue-200 dark:border-blue-800">
              <p className="text-xs text-gray-500">الإجمالي بعد التعديل</p>
              <p className="font-bold text-blue-600 dark:text-blue-400">{formatCurrency(newTotalPreview)}</p>
              {qty < item.quantity && (
                <p className="text-xs text-gray-500 mt-1">
                  {item.quantity - qty} × {formatCurrency(item.price)} + {qty} × {formatCurrency(parseFloat(price) || 0)}
                </p>
              )}
            </div>
          </div>

          <div className="p-3 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 flex gap-2">
            <button onClick={onClose} className="flex-1 py-2.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-50 text-gray-700 dark:text-gray-300 rounded-xl font-medium">إلغاء</button>
            <button onClick={handleSave} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center justify-center gap-1.5">
              <Save className="h-4 w-4" />حفظ
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

export default PriceEditModal;
