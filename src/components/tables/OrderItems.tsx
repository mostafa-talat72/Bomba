import React from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import { MenuItem } from '../../services/api';
import { LocalOrderItem } from './tableHelpers';

// بطاقة الصنف — memoized لتجنب إعادة render غير ضرورية
export const ItemCard = React.memo(({ item, qty, onAdd, fmt }: {
  item: MenuItem;
  qty: number;
  onAdd: (item: MenuItem) => void;
  fmt: (n: number) => string;
}) => {
  const inOrder = qty > 0;
  return (
    <button onClick={() => onAdd(item)}
      className={`relative group flex flex-col items-center rounded-lg border transition-colors duration-100 overflow-hidden active:scale-95 ${inOrder ? 'border-orange-300 dark:border-orange-600 bg-orange-50 dark:bg-orange-900/20' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-orange-200 hover:shadow-sm'}`}>
      {inOrder && (
        <span className="absolute top-1 left-1 min-w-[16px] h-[16px] bg-orange-500 text-white text-base font-bold rounded-full flex items-center justify-center px-0.5 leading-none">{qty}</span>
      )}
      <div className="px-1.5 pt-2 pb-1 flex-1 flex flex-col items-center justify-center w-full">
        <p className="font-medium text-gray-900 dark:text-gray-100 text-base leading-snug line-clamp-2 text-center mb-1">{item.name}</p>
        <p className={`text-base font-bold text-center ${inOrder ? 'text-orange-600 dark:text-orange-400' : 'text-gray-500 dark:text-gray-400'}`}>{fmt(item.price)}</p>
      </div>
      <div className={`w-full flex items-center justify-center gap-0.5 py-1 border-t text-base font-medium transition-colors duration-100 ${inOrder ? 'border-orange-200 dark:border-orange-700 bg-orange-500 text-white' : 'border-gray-100 dark:border-gray-700 text-gray-400 group-hover:text-orange-500 group-hover:bg-orange-50 dark:group-hover:bg-orange-900/20'}`}>
        <Plus className="h-2.5 w-2.5" /><span>{inOrder ? 'إضافة' : 'أضف'}</span>
      </div>
    </button>
  );
}, (prev, next) => prev.qty === next.qty && prev.item.id === next.item.id);
ItemCard.displayName = 'ItemCard';

// صف الصنف في قائمة الطلب — memoized
export const OrderItemRow = React.memo(({ item, isFlash, isExpanded, onMinus, onPlus, onRemove, onToggleNote, onNoteChange, notePlaceholder, fmt }: {
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
        <p className="font-semibold text-gray-900 dark:text-gray-100 text-base leading-snug">{item.name}</p>
        <p className="text-base text-orange-600 dark:text-orange-400 font-semibold">{fmt(item.price * item.quantity)}</p>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
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
