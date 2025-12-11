import React, { useState, useEffect } from 'react';
import { X, Receipt, CheckCircle, Plus, Minus } from 'lucide-react';
import { Bill, Order, OrderItem } from '../services/api';
import { formatCurrency, formatDecimal } from '../utils/formatters';

interface PartialPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  bill: Bill | null;
  onPaymentSubmit: (items: PaymentItem[], paymentMethod: 'cash' | 'card' | 'transfer') => Promise<void>;
  isProcessing: boolean;
}

interface PaymentItem {
  orderItemId: string;
  itemName: string;
  price: number;
  quantity: number;
  orderId: string;
}

interface SimpleItem {
  id: string;
  name: string;
  price: number;
  totalQuantity: number;
  paidQuantity: number;
  remainingQuantity: number;
  orderId: string;
  orderItemId: string;
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

  // تحديث فوري للبيانات عند تغيير itemPayments
  useEffect(() => {
    // إعادة حساب البيانات عند تحديث المدفوعات
    if (bill?.itemPayments) {
      // فرض إعادة رسم المكون
      setSelectedItems({});
      
      // إعادة حساب البيانات بعد فترة قصيرة
      setTimeout(() => {
        setSelectedItems(prev => ({ ...prev }));
      }, 50);
    }
  }, [bill?.itemPayments, bill?.paid, bill?.remaining]);

  if (!isOpen || !bill) return null;

  // تحويل العناصر إلى قائمة مبسطة مع تجميع الأصناف المتشابهة
  const getSimpleItems = (): SimpleItem[] => {
    const itemsMap = new Map<string, SimpleItem>();
    
    bill.orders?.forEach((order: Order) => {
      order.items?.forEach((orderItem: OrderItem) => {
        // إنشاء مفتاح فريد للصنف (اسم + سعر)
        const itemKey = `${orderItem.name}-${orderItem.price}`;
        
        // سيتم حساب الكمية المدفوعة لاحقاً للصنف المجمع

        if (itemsMap.has(itemKey)) {
          // إضافة الكمية للصنف الموجود
          const existingItem = itemsMap.get(itemKey)!;
          existingItem.totalQuantity += orderItem.quantity;
          
          // لا نحتاج لتجميع معرفات الطلبات - سنتعامل معها في handleSubmit
        } else {
          // إنشاء صنف جديد
          itemsMap.set(itemKey, {
            id: itemKey,
            name: orderItem.name,
            price: orderItem.price,
            totalQuantity: orderItem.quantity,
            paidQuantity: 0, // سيتم حسابه لاحقاً
            remainingQuantity: 0, // سيتم حسابه لاحقاً
            orderId: order._id,
            orderItemId: `${order._id}-${orderItem.name}`
          });
        }
      });
    });

    // إعادة حساب الكميات المدفوعة والمتبقية للأصناف المجمعة
    itemsMap.forEach((item) => {
      const totalPaidForItem = bill.itemPayments?.reduce((sum, payment) => {
        if (payment.itemName === item.name && 
            Math.abs(payment.pricePerUnit - item.price) < 0.01) {
          return sum + (payment.paidQuantity || 0);
        }
        return sum;
      }, 0) || 0;
      
      item.paidQuantity = totalPaidForItem;
      item.remainingQuantity = Math.max(0, item.totalQuantity - totalPaidForItem);
    });

    // إرجاع فقط الأصناف التي لها كمية متبقية
    return Array.from(itemsMap.values()).filter(item => item.remainingQuantity > 0);
  };

  const simpleItems = getSimpleItems();

  const handleQuantityChange = (itemId: string, change: number) => {
    const item = simpleItems.find(i => i.id === itemId);
    if (!item) return;

    const currentQuantity = selectedItems[itemId] || 0;
    const newQuantity = Math.max(0, Math.min(item.remainingQuantity, currentQuantity + change));
    
    setSelectedItems(prev => ({
      ...prev,
      [itemId]: newQuantity
    }));
  };

  const handlePayAll = (itemId: string) => {
    const item = simpleItems.find(i => i.id === itemId);
    if (!item) return;

    setSelectedItems(prev => ({
      ...prev,
      [itemId]: item.remainingQuantity
    }));
  };

  const handleSubmit = async () => {
    const itemsToPay: PaymentItem[] = [];
    
    Object.entries(selectedItems).forEach(([itemId, quantity]) => {
      if (quantity > 0) {
        const item = simpleItems.find(i => i.id === itemId);
        if (item) {
          // البحث عن العناصر الأصلية في الطلبات للحصول على معرفات صحيحة
          let remainingQuantityToPay = quantity;
          
          bill.orders?.forEach((order: Order) => {
            if (remainingQuantityToPay <= 0) return;
            
            order.items?.forEach((orderItem: OrderItem) => {
              if (remainingQuantityToPay <= 0) return;
              
              // التحقق من تطابق الصنف
              if (orderItem.name === item.name && 
                  Math.abs(orderItem.price - item.price) < 0.01) {
                
                // حساب الكمية المتاحة من هذا العنصر
                const paidForThisItem = bill.itemPayments?.reduce((sum, payment) => {
                  if (payment.itemName === orderItem.name && 
                      Math.abs(payment.pricePerUnit - orderItem.price) < 0.01) {
                    return sum + (payment.paidQuantity || 0);
                  }
                  return sum;
                }, 0) || 0;
                
                const availableQuantity = orderItem.quantity - paidForThisItem;
                
                if (availableQuantity > 0) {
                  const quantityFromThisItem = Math.min(remainingQuantityToPay, availableQuantity);
                  
                  itemsToPay.push({
                    orderItemId: `${order._id}-${orderItem.name}`,
                    itemName: orderItem.name,
                    price: orderItem.price,
                    quantity: quantityFromThisItem,
                    orderId: order._id
                  });
                  
                  remainingQuantityToPay -= quantityFromThisItem;
                }
              }
            });
          });
        }
      }
    });

    if (itemsToPay.length === 0) {
      return;
    }

    await onPaymentSubmit(itemsToPay, paymentMethod);
  };

  const totalAmount = Object.entries(selectedItems).reduce((sum, [itemId, quantity]) => {
    const item = simpleItems.find(i => i.id === itemId);
    return sum + (item ? item.price * quantity : 0);
  }, 0);

  const hasSelectedItems = Object.values(selectedItems).some(qty => qty > 0);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl border-2 border-green-200 dark:border-green-800 animate-bounce-in">
        
        {/* Header */}
        <div className="sticky top-0 z-10 p-6 bg-gradient-to-r from-green-600 to-emerald-600 dark:from-green-700 dark:to-emerald-700 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white dark:bg-gray-800 rounded-xl flex items-center justify-center shadow-lg">
              <Receipt className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-white">دفع مشروبات محددة</h3>
              <p className="text-sm text-green-100 mt-1">فاتورة #{bill.billNumber}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-lg transition-all duration-200 flex items-center justify-center text-white hover:scale-110 transform"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6">
          {/* العناصر المتاحة للدفع */}
          <div className="mb-6">
            <h4 className="font-bold text-xl text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              اختر المشروبات المطلوب دفعها
            </h4>

            {simpleItems.length === 0 ? (
              <div className="text-center py-12 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 rounded-xl border-2 border-green-300 dark:border-green-700 shadow-lg">
                <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <CheckCircle className="h-10 w-10 text-white" />
                </div>
                <h5 className="font-bold text-xl text-green-900 dark:text-green-100 mb-2">جميع العناصر مدفوعة بالكامل!</h5>
                <p className="text-green-700 dark:text-green-300 text-lg">
                  لا توجد عناصر متبقية للدفع في هذه الفاتورة
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {simpleItems.map((item) => (
                  <div key={item.id} className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-700 dark:to-gray-800 rounded-xl p-5 border-2 border-green-200 dark:border-green-700 shadow-md hover:shadow-lg transition-all">
                    
                    {/* معلومات العنصر */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg flex items-center justify-center shadow-md">
                          <Receipt className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-lg text-gray-900 dark:text-gray-100">{item.name}</span>
                            {(() => {
                              // التحقق من وجود نفس الصنف في طلبات متعددة
                              const itemCount = bill.orders?.reduce((count, order) => {
                                const hasItem = order.items?.some(orderItem => 
                                  orderItem.name === item.name && 
                                  Math.abs(orderItem.price - item.price) < 0.01
                                );
                                return hasItem ? count + 1 : count;
                              }, 0) || 0;
                              
                              return itemCount > 1 && (
                                <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded-full">
                                  📋 من {itemCount} طلبات
                                </span>
                              );
                            })()}
                          </div>
                          <div className="text-sm text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/50 px-2 py-1 rounded-lg inline-block mt-1">
                            {formatCurrency(item.price)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* إحصائيات العنصر */}
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <div className="text-center p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
                        <div className="text-gray-600 dark:text-gray-400 text-xs mb-1">الكمية الكلية</div>
                        <div className="font-bold text-lg text-gray-900 dark:text-gray-100">{formatDecimal(item.totalQuantity)}</div>
                      </div>
                      <div className="text-center p-3 bg-green-100 dark:bg-green-900/50 rounded-lg">
                        <div className="text-green-700 dark:text-green-300 text-xs mb-1">المدفوع</div>
                        <div className="font-bold text-lg text-green-800 dark:text-green-200">{formatDecimal(item.paidQuantity)}</div>
                      </div>
                      <div className="text-center p-3 bg-orange-100 dark:bg-orange-900/50 rounded-lg">
                        <div className="text-orange-700 dark:text-orange-300 text-xs mb-1">المتبقي</div>
                        <div className="font-bold text-lg text-orange-800 dark:text-orange-200">{formatDecimal(item.remainingQuantity)}</div>
                      </div>
                    </div>

                    {/* أزرار التحكم */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 bg-green-100 dark:bg-green-900/50 px-4 py-2 rounded-lg">
                        <button
                          type="button"
                          className="w-8 h-8 flex items-center justify-center rounded-lg bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white text-xl font-bold shadow-md hover:shadow-lg transition-all transform hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed"
                          onClick={() => handleQuantityChange(item.id, -1)}
                          disabled={(selectedItems[item.id] || 0) <= 0}
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        
                        <span className="mx-2 w-12 text-center select-none font-bold text-2xl text-green-700 dark:text-green-300">
                          {formatDecimal(selectedItems[item.id] || 0)}
                        </span>
                        
                        <button
                          type="button"
                          className="w-8 h-8 flex items-center justify-center rounded-lg bg-gradient-to-br from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white text-xl font-bold shadow-md hover:shadow-lg transition-all transform hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed"
                          onClick={() => handleQuantityChange(item.id, 1)}
                          disabled={(selectedItems[item.id] || 0) >= item.remainingQuantity}
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>

                      <button
                        type="button"
                        className="px-4 py-2 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white text-sm font-bold rounded-lg shadow-md hover:shadow-lg transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={() => handlePayAll(item.id)}
                        disabled={(selectedItems[item.id] || 0) === item.remainingQuantity}
                      >
                        دفع الكمية بالكامل
                      </button>
                    </div>

                    {/* عرض المبلغ المحدد */}
                    {(selectedItems[item.id] || 0) > 0 && (
                      <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg">
                        <div className="flex justify-between items-center">
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
          {simpleItems.length > 0 && (
            <div className="mb-6">
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-4">طريقة الدفع</h4>
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => setPaymentMethod('cash')}
                  className={`p-3 border-2 rounded-lg text-center transition-colors duration-200 ${
                    paymentMethod === 'cash' 
                      ? 'border-orange-500 bg-orange-50 dark:bg-orange-900 text-orange-700 dark:text-orange-300' 
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <div className="text-2xl mb-1">💵</div>
                  <div className="text-sm font-medium">نقداً</div>
                </button>
                <button
                  onClick={() => setPaymentMethod('card')}
                  className={`p-3 border-2 rounded-lg text-center transition-colors duration-200 ${
                    paymentMethod === 'card' 
                      ? 'border-orange-500 bg-orange-50 dark:bg-orange-900 text-orange-700 dark:text-orange-300' 
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <div className="text-2xl mb-1">💳</div>
                  <div className="text-sm font-medium">بطاقة</div>
                </button>
                <button
                  onClick={() => setPaymentMethod('transfer')}
                  className={`p-3 border-2 rounded-lg text-center transition-colors duration-200 ${
                    paymentMethod === 'transfer' 
                      ? 'border-orange-500 bg-orange-50 dark:bg-orange-900 text-orange-700 dark:text-orange-300' 
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <div className="text-2xl mb-1">📱</div>
                  <div className="text-sm font-medium">تحويل</div>
                </button>
              </div>
            </div>
          )}

          {/* ملخص الدفع */}
          {hasSelectedItems && (
            <div className="mb-6 bg-orange-50 dark:bg-orange-900 p-4 rounded-lg border border-orange-200 dark:border-orange-700">
              <h4 className="font-medium text-orange-900 dark:text-orange-100 mb-2">ملخص الدفع</h4>
              <div className="space-y-2">
                {Object.entries(selectedItems)
                  .filter(([_, quantity]) => quantity > 0)
                  .map(([itemId, quantity]) => {
                    const item = simpleItems.find(i => i.id === itemId);
                    if (!item) return null;
                    
                    return (
                      <div key={itemId} className="flex justify-between text-sm bg-orange-100 dark:bg-orange-800 p-2 rounded border border-orange-200 dark:border-orange-600">
                        <span className="text-orange-800 dark:text-orange-200">
                          {item.name} × {formatDecimal(quantity)}
                        </span>
                        <span className="font-bold text-orange-900 dark:text-orange-100">
                          {formatCurrency(item.price * quantity)}
                        </span>
                      </div>
                    );
                  })}
                <div className="border-t border-orange-200 dark:border-orange-600 pt-2 mt-2">
                  <div className="flex justify-between font-bold text-lg text-orange-900 dark:text-orange-100">
                    <span>المجموع الكلي:</span>
                    <span>{formatCurrency(totalAmount)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors duration-200"
            disabled={isProcessing}
          >
            إلغاء
          </button>

          <button
            onClick={handleSubmit}
            disabled={!hasSelectedItems || isProcessing}
            className={`px-6 py-2 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2 min-w-[180px] ${
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
                جاري الدفع...
              </>
            ) : (
              `تأكيد الدفع - ${formatCurrency(totalAmount)}`
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PartialPaymentModal;