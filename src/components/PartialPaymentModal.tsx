import React, { useState, useEffect } from 'react';
import { X, Receipt, CheckCircle, Plus, Minus } from 'lucide-react';
import { Bill, Order, OrderItem } from '../services/api';
import { formatCurrency, formatDecimal } from '../utils/formatters';
import { aggregateItemsWithPayments } from '../utils/billAggregation';

interface PartialPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  bill: Bill | null;
  onPaymentSubmit: (items: Array<{ itemId: string; quantity: number }>, paymentMethod: 'cash' | 'card' | 'transfer') => Promise<void>;
  isProcessing: boolean;
}

const PartialPaymentModal: React.FC<PartialPaymentModalProps> = ({
  isOpen,
  onClose,
  bill,
  onPaymentSubmit,
  isProcessing
}) => {
  const [selectedItems, setSelectedItems] = useState<{ [key: string]: number }>({});
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'transfer'>('cash');

  // إعادة تعيين العناصر المحددة عند فتح النافذة أو تغيير الفاتورة
  useEffect(() => {
    if (isOpen) {
      setSelectedItems({});
    }
  }, [isOpen, bill?._id, bill?.id]);

  // إعادة تعيين العناصر المحددة عند تحديث بيانات الفاتورة
  useEffect(() => {
    if (bill) {
      setSelectedItems({});
    }
  }, [bill?.itemPayments?.length, bill?.orders?.length, bill?.paid, bill?.remaining]);

  if (!isOpen || !bill) return null;

  // استخدام aggregateItemsWithPayments للحصول على بيانات دقيقة
  const aggregatedItems = aggregateItemsWithPayments(
    bill.orders || [],
    bill.itemPayments || [],
    bill.status,
    bill.paid,
    bill.total
  );

  // فلترة العناصر التي لها كمية متبقية فقط
  const availableItems = aggregatedItems.filter(item => item.remainingQuantity > 0);

  const handleQuantityChange = (itemId: string, change: number) => {
    const item = availableItems.find(i => i.id === itemId);
    if (!item) return;

    const currentQuantity = selectedItems[itemId] || 0;
    const newQuantity = Math.max(0, Math.min(item.remainingQuantity, currentQuantity + change));
    
    setSelectedItems(prev => ({
      ...prev,
      [itemId]: newQuantity
    }));
  };

  const handlePayAll = (itemId: string) => {
    const item = availableItems.find(i => i.id === itemId);
    if (!item) return;

    setSelectedItems(prev => ({
      ...prev,
      [itemId]: item.remainingQuantity
    }));
  };

  const handleSubmit = async () => {
    const itemsToPay: Array<{ itemId: string; quantity: number }> = [];
    
    Object.entries(selectedItems).forEach(([itemId, quantity]) => {
      if (quantity > 0) {
        itemsToPay.push({
          itemId: itemId,
          quantity: quantity
        });
      }
    });

    if (itemsToPay.length === 0) {
      return;
    }

    await onPaymentSubmit(itemsToPay, paymentMethod);
  };

  const totalAmount = Object.entries(selectedItems).reduce((sum, [itemId, quantity]) => {
    const item = availableItems.find(i => i.id === itemId);
    return sum + (item ? item.price * quantity : 0);
  }, 0);

  const hasSelectedItems = Object.values(selectedItems).some(qty => qty > 0);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50 animate-fade-in">
      <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl w-full max-w-4xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto shadow-2xl border-2 border-green-200 dark:border-green-800 animate-bounce-in mx-2 sm:mx-0">
        
        {/* Header */}
        <div className="sticky top-0 z-10 p-3 sm:p-6 bg-gradient-to-r from-green-600 to-emerald-600 dark:from-green-700 dark:to-emerald-700 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
            <div className="w-10 h-10 sm:w-14 sm:h-14 bg-white dark:bg-gray-800 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
              <Receipt className="h-5 w-5 sm:h-8 sm:w-8 text-green-600 dark:text-green-400" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-lg sm:text-2xl font-bold text-white truncate">دفع مشروبات محددة</h3>
              <p className="text-xs sm:text-sm text-green-100 mt-1 truncate">فاتورة #{bill.billNumber}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 sm:w-10 sm:h-10 bg-white/20 hover:bg-white/30 rounded-lg transition-all duration-200 flex items-center justify-center text-white hover:scale-110 transform flex-shrink-0"
          >
            <X className="h-4 w-4 sm:h-6 sm:w-6" />
          </button>
        </div>

        <div className="p-3 sm:p-6">
          {/* العناصر المتاحة للدفع */}
          <div className="mb-4 sm:mb-6">
            <h4 className="font-bold text-lg sm:text-xl text-gray-900 dark:text-gray-100 mb-3 sm:mb-4 flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              اختر المشروبات المطلوب دفعها
            </h4>

            {availableItems.length === 0 ? (
              <div className="text-center py-8 sm:py-12 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 rounded-xl border-2 border-green-300 dark:border-green-700 shadow-lg">
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4 shadow-lg">
                  <CheckCircle className="h-8 w-8 sm:h-10 sm:w-10 text-white" />
                </div>
                <h5 className="font-bold text-lg sm:text-xl text-green-900 dark:text-green-100 mb-2">جميع العناصر مدفوعة بالكامل!</h5>
                <p className="text-green-700 dark:text-green-300 text-base sm:text-lg px-4">
                  لا توجد عناصر متبقية للدفع في هذه الفاتورة
                </p>
              </div>
            ) : (
              <div className="space-y-3 sm:space-y-4">
                {availableItems.map((item) => (
                  <div key={item.id} className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-700 dark:to-gray-800 rounded-xl p-3 sm:p-5 border-2 border-green-200 dark:border-green-700 shadow-md hover:shadow-lg transition-all">
                    
                    {/* معلومات العنصر */}
                    <div className="flex items-center justify-between mb-3 sm:mb-4">
                      <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg flex items-center justify-center shadow-md flex-shrink-0">
                          <Receipt className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-base sm:text-lg text-gray-900 dark:text-gray-100 truncate">{item.name}</span>
                            {item.hasAddons && (
                              <span className="text-xs bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 px-2 py-1 rounded-full whitespace-nowrap">
                                🍯 مع إضافات
                              </span>
                            )}
                          </div>
                          <div className="text-xs sm:text-sm text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/50 px-2 py-1 rounded-lg inline-block mt-1">
                            {formatCurrency(item.price)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* إحصائيات العنصر */}
                    <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-3 sm:mb-4">
                      <div className="text-center p-2 sm:p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
                        <div className="text-gray-600 dark:text-gray-400 text-xs mb-1">الكمية الكلية</div>
                        <div className="font-bold text-sm sm:text-lg text-gray-900 dark:text-gray-100">{formatDecimal(item.totalQuantity)}</div>
                      </div>
                      <div className="text-center p-2 sm:p-3 bg-green-100 dark:bg-green-900/50 rounded-lg">
                        <div className="text-green-700 dark:text-green-300 text-xs mb-1">المدفوع</div>
                        <div className="font-bold text-sm sm:text-lg text-green-800 dark:text-green-200">{formatDecimal(item.paidQuantity)}</div>
                      </div>
                      <div className="text-center p-2 sm:p-3 bg-orange-100 dark:bg-orange-900/50 rounded-lg">
                        <div className="text-orange-700 dark:text-orange-300 text-xs mb-1">المتبقي</div>
                        <div className="font-bold text-sm sm:text-lg text-orange-800 dark:text-orange-200">{formatDecimal(item.remainingQuantity)}</div>
                      </div>
                    </div>

                    {/* أزرار التحكم */}
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div className="flex items-center gap-2 sm:gap-3 bg-green-100 dark:bg-green-900/50 px-3 sm:px-4 py-2 rounded-lg">
                        <button
                          type="button"
                          className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white text-lg sm:text-xl font-bold shadow-md hover:shadow-lg transition-all transform hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed"
                          onClick={() => handleQuantityChange(item.id, -1)}
                          disabled={(selectedItems[item.id] || 0) <= 0}
                        >
                          <Minus className="h-3 w-3 sm:h-4 sm:w-4" />
                        </button>
                        
                        <span className="mx-1 sm:mx-2 w-8 sm:w-12 text-center select-none font-bold text-lg sm:text-2xl text-green-700 dark:text-green-300">
                          {formatDecimal(selectedItems[item.id] || 0)}
                        </span>
                        
                        <button
                          type="button"
                          className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg bg-gradient-to-br from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white text-lg sm:text-xl font-bold shadow-md hover:shadow-lg transition-all transform hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed"
                          onClick={() => handleQuantityChange(item.id, 1)}
                          disabled={(selectedItems[item.id] || 0) >= item.remainingQuantity}
                        >
                          <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
                        </button>
                      </div>

                      <button
                        type="button"
                        className="px-3 sm:px-4 py-2 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white text-xs sm:text-sm font-bold rounded-lg shadow-md hover:shadow-lg transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={() => handlePayAll(item.id)}
                        disabled={(selectedItems[item.id] || 0) === item.remainingQuantity}
                      >
                        دفع الكمية بالكامل
                      </button>
                    </div>

                    {/* عرض المبلغ المحدد */}
                    {(selectedItems[item.id] || 0) > 0 && (
                      <div className="mt-3 p-2 sm:p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg">
                        <div className="flex justify-between items-center text-sm sm:text-base">
                          <span className="text-blue-800 dark:text-blue-200 font-medium">
                            المبلغ المحدد: {formatDecimal(selectedItems[item.id])} × {formatCurrency(item.price)}
                          </span>
                          <span className="font-bold text-blue-900 dark:text-blue-100">
                            = {formatCurrency(item.price * (selectedItems[item.id] || 0))}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* طريقة الدفع */}
          {availableItems.length > 0 && (
            <div className="mb-4 sm:mb-6">
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3 sm:mb-4">طريقة الدفع</h4>
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <button
                  onClick={() => setPaymentMethod('cash')}
                  className={`p-2 sm:p-3 border-2 rounded-lg text-center transition-colors duration-200 ${
                    paymentMethod === 'cash' 
                      ? 'border-orange-500 bg-orange-50 dark:bg-orange-900 text-orange-700 dark:text-orange-300' 
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <div className="text-xl sm:text-2xl mb-1">💵</div>
                  <div className="text-xs sm:text-sm font-medium">نقداً</div>
                </button>
                <button
                  onClick={() => setPaymentMethod('card')}
                  className={`p-2 sm:p-3 border-2 rounded-lg text-center transition-colors duration-200 ${
                    paymentMethod === 'card' 
                      ? 'border-orange-500 bg-orange-50 dark:bg-orange-900 text-orange-700 dark:text-orange-300' 
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <div className="text-xl sm:text-2xl mb-1">💳</div>
                  <div className="text-xs sm:text-sm font-medium">بطاقة</div>
                </button>
                <button
                  onClick={() => setPaymentMethod('transfer')}
                  className={`p-2 sm:p-3 border-2 rounded-lg text-center transition-colors duration-200 ${
                    paymentMethod === 'transfer' 
                      ? 'border-orange-500 bg-orange-50 dark:bg-orange-900 text-orange-700 dark:text-orange-300' 
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <div className="text-xl sm:text-2xl mb-1">📱</div>
                  <div className="text-xs sm:text-sm font-medium">تحويل</div>
                </button>
              </div>
            </div>
          )}

          {/* ملخص الدفع */}
          {hasSelectedItems && (
            <div className="mb-4 sm:mb-6 bg-orange-50 dark:bg-orange-900 p-3 sm:p-4 rounded-lg border border-orange-200 dark:border-orange-700">
              <h4 className="font-medium text-orange-900 dark:text-orange-100 mb-2">ملخص الدفع</h4>
              <div className="space-y-2">
                {Object.entries(selectedItems)
                  .filter(([_, quantity]) => quantity > 0)
                  .map(([itemId, quantity]) => {
                    const item = availableItems.find(i => i.id === itemId);
                    if (!item) return null;
                    
                    return (
                      <div key={itemId} className="flex justify-between text-xs sm:text-sm bg-orange-100 dark:bg-orange-800 p-2 rounded border border-orange-200 dark:border-orange-600">
                        <span className="text-orange-800 dark:text-orange-200 truncate flex-1 pr-2">
                          {item.name} × {formatDecimal(quantity)}
                        </span>
                        <span className="font-bold text-orange-900 dark:text-orange-100 flex-shrink-0">
                          {formatCurrency(item.price * quantity)}
                        </span>
                      </div>
                    );
                  })}
                <div className="border-t border-orange-200 dark:border-orange-600 pt-2 mt-2">
                  <div className="flex justify-between font-bold text-base sm:text-lg text-orange-900 dark:text-orange-100">
                    <span>المجموع الكلي:</span>
                    <span>{formatCurrency(totalAmount)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-6 border-t border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors duration-200 order-2 sm:order-1"
            disabled={isProcessing}
          >
            إلغاء
          </button>

          <button
            onClick={handleSubmit}
            disabled={!hasSelectedItems || isProcessing}
            className={`px-4 sm:px-6 py-2 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2 min-w-[140px] sm:min-w-[180px] order-1 sm:order-2 ${
              !hasSelectedItems || isProcessing
                ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                : 'bg-orange-600 hover:bg-orange-700 text-white'
            }`}
          >
            {isProcessing ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="hidden sm:inline">جاري الدفع...</span>
                <span className="sm:hidden">جاري...</span>
              </>
            ) : (
              <>
                <span className="hidden sm:inline">تأكيد الدفع - {formatCurrency(totalAmount)}</span>
                <span className="sm:hidden">تأكيد - {formatCurrency(totalAmount)}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PartialPaymentModal;