import React from 'react';
import { Plus, Save, Trash2, DollarSign } from 'lucide-react';
import { MenuItem } from '../../services/api';
import { LocalOrderItem } from './tableHelpers';

// بطاقة الصنف — memoized لتجنب إعادة render غير ضرورية
export const ItemCard = React.memo(({ item, qty, qtyByVariant, onAdd, fmt }: {
  item: MenuItem;
  qty: number;
  qtyByVariant?: Record<string, number>;
  onAdd: (item: MenuItem, variant?: string | null) => void;
  fmt: (n: number) => string;
}) => {
  const hasVariants = item.variants && item.variants.length > 1;
  const inOrder = qty > 0;

  if (hasVariants) {
    return (
      <div className={`relative group flex flex-col rounded-lg border overflow-hidden ${inOrder ? 'border-orange-300 dark:border-orange-600 bg-orange-50 dark:bg-orange-900/20' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-orange-200 hover:shadow-sm'}`}>
        <div className="px-1.5 pt-2 pb-1 flex-1 w-full">
          <p className="font-medium text-gray-900 dark:text-gray-100 text-base leading-snug line-clamp-2 text-center mb-1">{item.name}</p>
          <div className="grid grid-cols-2 gap-1 mt-1">
            {item.variants!.map(v => {
              const vQty = qtyByVariant?.[v.size] || 0;
              return (
                <button key={v.size} onClick={() => onAdd(item, v.size)}
                  className={`relative flex flex-col items-center rounded-md border px-1 py-1.5 text-xs font-medium transition-colors ${vQty > 0 ? 'bg-orange-500 text-white border-orange-600' : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-600 hover:border-orange-300'}`}>
                  <span className="font-bold text-sm">{v.size}</span>
                  <span className={`text-[11px] mt-0.5 ${vQty > 0 ? 'text-white/90' : 'text-orange-600 dark:text-orange-400'}`}>{fmt(v.price)}</span>
                  {vQty > 0 && <span className="absolute -top-1.5 -left-1.5 min-w-[18px] h-[18px] bg-green-500 text-white text-[11px] font-bold rounded-full flex items-center justify-center px-0.5 shadow-sm">{vQty}</span>}
                </button>
              );
            })}
          </div>
        </div>
        <div className={`w-full flex items-center justify-center gap-0.5 py-1 border-t text-base font-medium ${inOrder ? 'border-orange-200 dark:border-orange-700 bg-orange-500 text-white' : 'border-gray-100 dark:border-gray-700 text-gray-400 group-hover:text-orange-500 group-hover:bg-orange-50 dark:group-hover:bg-orange-900/20'}`}>
          <span className="text-xs font-semibold">{inOrder ? `${qty} في الطلب` : 'اختر الحجم'}</span>
        </div>
      </div>
    );
  }

  // Single variant or legacy single price
  const displayPrice = item.variants && item.variants.length === 1 ? item.variants[0].price : item.price;
  return (
    <button onClick={() => onAdd(item)}
      className={`relative group flex flex-col items-center rounded-lg border transition-colors duration-100 overflow-hidden active:scale-95 ${inOrder ? 'border-orange-300 dark:border-orange-600 bg-orange-50 dark:bg-orange-900/20' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-orange-200 hover:shadow-sm'}`}>
      {inOrder && (
        <span className="absolute top-1 left-1 min-w-[16px] h-[16px] bg-orange-500 text-white text-base font-bold rounded-full flex items-center justify-center px-0.5 leading-none">{qty}</span>
      )}
      <div className="px-1.5 pt-2 pb-1 flex-1 flex flex-col items-center justify-center w-full">
        <p className="font-medium text-gray-900 dark:text-gray-100 text-base leading-snug line-clamp-2 text-center mb-1">{item.name}</p>
        <p className={`text-base font-bold text-center ${inOrder ? 'text-orange-600 dark:text-orange-400' : 'text-gray-500 dark:text-gray-400'}`}>{fmt(displayPrice)}</p>
        {item.variants && item.variants.length === 1 && <span className="text-[10px] text-gray-400">{item.variants[0].size}</span>}
      </div>
      <div className={`w-full flex items-center justify-center gap-0.5 py-1 border-t text-base font-medium transition-colors duration-100 ${inOrder ? 'border-orange-200 dark:border-orange-700 bg-orange-500 text-white' : 'border-gray-100 dark:border-gray-700 text-gray-400 group-hover:text-orange-500 group-hover:bg-orange-50 dark:group-hover:bg-orange-900/20'}`}>
        <Plus className="h-2.5 w-2.5" /><span>{inOrder ? 'إضافة' : 'أضف'}</span>
      </div>
    </button>
  );
}, (prev, next) => prev.qty === next.qty && prev.item.id === next.item.id && JSON.stringify((prev.item as any).variants) === JSON.stringify((next.item as any).variants) && JSON.stringify(prev.qtyByVariant) === JSON.stringify(next.qtyByVariant));
ItemCard.displayName = 'ItemCard';

// صف الصنف في قائمة الطلب — memoized
export const OrderItemRow = React.memo(({ item, isFlash, isExpanded, onMinus, onPlus, onRemove, onToggleNote, onNoteChange, notePlaceholder, fmt, onEditPrice, canEditPrice, showVariantBadge }: {
  item: LocalOrderItem;
  isFlash: boolean;
  isExpanded: boolean;
  onMinus: () => void;
  onPlus: () => void;
  onRemove: () => void;
  onToggleNote: () => void;
  onNoteChange: (v: string) => void;
  notePlaceholder: string;
  fmt: (n: number) => string;
  onEditPrice?: () => void;
  canEditPrice?: boolean;
  showVariantBadge?: boolean;
}) => (
  <div className={`rounded-lg border overflow-hidden transition-colors duration-150 ${isFlash ? 'border-orange-400 bg-orange-50 dark:bg-orange-900/30 ring-1 ring-orange-300' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900'}`}>
     <div className="flex items-center gap-2 px-2 py-2">
       <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden flex-shrink-0">
         <button onClick={onMinus} title="تقليل الكمية"
           className="w-7 h-7 flex items-center justify-center text-red-500 hover:bg-red-500 hover:text-white transition-colors font-bold text-xl">−</button>
         <span className="w-7 text-center font-bold text-lg text-gray-900 dark:text-gray-100 select-none border-x border-gray-200 dark:border-gray-700">{item.quantity}</span>
         <button onClick={onPlus} title="زيادة الكمية"
           className="w-7 h-7 flex items-center justify-center text-green-500 hover:bg-green-500 hover:text-white transition-colors font-bold text-xl">+</button>
       </div>
       <div className="flex-1 min-w-0">
         <div className="flex items-center gap-1.5 flex-wrap">
           <p className="font-semibold text-gray-900 dark:text-gray-100 text-base leading-snug">
             {item.name}
           </p>
           {(showVariantBadge !== false && item.variant) && (
             <span className="text-xs bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/40 dark:to-pink-900/40 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-full font-medium whitespace-nowrap border border-purple-200 dark:border-purple-700/50">
               📏 {item.variant}
             </span>
           )}
         </div>
         <p className="text-base text-orange-600 dark:text-orange-400 font-semibold">{fmt(item.price * item.quantity)} <span className="text-xs text-gray-400">({fmt(item.price)} × {item.quantity})</span></p>
       </div>
       <div className="flex items-center gap-1 flex-shrink-0">
         {canEditPrice && onEditPrice && (
           <button onClick={onEditPrice} title="تعديل السعر"
             className="w-7 h-7 rounded-lg flex items-center justify-center bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-800 transition-colors">
             <DollarSign className="h-3.5 w-3.5" />
           </button>
         )}
         <button onClick={onToggleNote} title={item.notes ? 'عرض/تعديل الملاحظة' : 'إضافة ملاحظة'}
           className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${item.notes || isExpanded ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600' : 'bg-gray-100 dark:bg-gray-700 text-gray-400 hover:bg-blue-50 hover:text-blue-500'}`}>
           <Save className="h-3.5 w-3.5" />
         </button>
         <button onClick={onRemove} title="حذف الصنف"
           className="w-7 h-7 rounded-lg flex items-center justify-center bg-gray-100 dark:bg-gray-700 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/30 transition-colors">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
    {(isExpanded || item.notes) && (
      <div className="px-2 pb-2">
        <input type="text" value={item.notes || ''} onChange={e => onNoteChange(e.target.value)}
          placeholder={notePlaceholder} autoFocus
          className="w-full text-base border border-blue-200 dark:border-blue-700 rounded-lg px-2 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-1 focus:ring-blue-400 outline-none" />
      </div>
    )}
  </div>
));
OrderItemRow.displayName = 'OrderItemRow';
