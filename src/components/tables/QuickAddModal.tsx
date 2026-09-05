import React, { useState, useMemo } from 'react';
import { Zap, Search, X, Plus, CheckCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../context/LanguageContext';
import type { Table, MenuItem, MenuSection, MenuCategory } from '../../services/api';
import ModalPortal from '../ModalPortal';
import { getTableDisplay, type LocalOrderItem } from './tableHelpers';
import { formatCurrency as formatCurrencyUtil } from '../../utils/formatters';

const QuickAddModal: React.FC<{
  table: Table;
  menuItems: MenuItem[];
  menuSections: MenuSection[];
  menuCategories: MenuCategory[];
  items: LocalOrderItem[];
  setItems: React.Dispatch<React.SetStateAction<LocalOrderItem[]>>;
  onSave: () => void;
  onClose: () => void;
  saving: boolean;
}> = ({ table, menuItems, menuSections, menuCategories, items, setItems, onSave, onClose, saving }) => {
  const { t, i18n } = useTranslation();
  const { isRTL } = useLanguage();
  const [search, setSearch] = useState('');
  const cur = localStorage.getItem('organizationCurrency') || 'EGP';

  const filtered = useMemo(() => {
    if (!search.trim()) return menuItems.filter(m => m.isAvailable);
    const q = search.toLowerCase();
    return menuItems.filter(m => m.isAvailable && m.name.toLowerCase().includes(q));
  }, [menuItems, search]);

  const total = items.reduce((s, i) => s + i.price * i.quantity, 0);

  const addItem = (mi: MenuItem, variant?: string | null) => {
    let effPrice = mi.price;
    let effVariant: string | null = variant ? String(variant).trim() : null;
    if (mi.variants && mi.variants.length > 0) {
      if (effVariant) {
        const m = mi.variants.find(v => v.size === effVariant);
        if (m) effPrice = m.price;
      } else {
        effVariant = mi.variants[0].size;
        effPrice = mi.variants[0].price;
      }
    } else effVariant = effVariant || null;
    const keyVariant = effVariant || '';
    setItems(prev => {
      const ex = prev.find(i => i.menuItem === mi.id && (i.variant || '') === keyVariant);
      if (ex) return prev.map(i => (i.menuItem === mi.id && (i.variant || '') === keyVariant) ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { menuItem: mi.id, name: mi.name, price: effPrice, variant: effVariant, quantity: 1 }];
    });
  };

  const changeQty = (id: string, delta: number, variant?: string | null) => {
    setItems(prev => prev.map(i => {
      const match = variant !== undefined ? (i.menuItem === id && (i.variant || '') === (variant || '')) : i.menuItem === id;
      if (!match) return i;
      const q = i.quantity + delta;
      return q <= 0 ? null as any : { ...i, quantity: q };
    }).filter(Boolean));
  };

  return (
    <ModalPortal>
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[300] p-3" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="p-4 bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center border border-white/30">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-white">إضافة سريعة</h3>
              <p className="text-base text-orange-100">طاولة {getTableDisplay(table.number, i18n.language)}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-lg flex items-center justify-center text-white transition-all">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="relative">
            <Search className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400`} />
            <input autoFocus type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="ابحث في المنيو..."
              className={`w-full ${isRTL ? 'pr-9 pl-3' : 'pl-9 pr-3'} py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-lg focus:ring-2 focus:ring-orange-400`} />
          </div>
        </div>

        {/* Content with variant support */}
        <div className="flex-1 overflow-y-auto p-3 min-h-0 grid grid-cols-1 gap-2">
          {filtered.length === 0 ? (
            <p className="text-center text-gray-400 py-8">لا توجد أصناف</p>
          ) : filtered.map(mi => {
            const hasVariants = mi.variants && mi.variants.length > 1;
            if (hasVariants) {
              return (
                <div key={mi.id} className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                  <p className="font-medium text-lg text-gray-900 dark:text-gray-100 truncate mb-2">{mi.name}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {mi.variants!.map(v => {
                      const inOrderV = items.find(i => i.menuItem === mi.id && i.variant === v.size);
                      return (
                        <div key={v.size} className={`flex items-center justify-between p-2 rounded-lg border ${inOrderV ? 'border-orange-300 bg-orange-50 dark:bg-orange-900/20' : 'border-gray-200 dark:border-gray-600'}`}>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{v.size}</p>
                            <p className="text-xs text-orange-600 dark:text-orange-400 font-semibold">{formatCurrencyUtil(v.price, i18n.language, cur)}</p>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {inOrderV ? (
                              <>
                                <button onClick={() => changeQty(mi.id, -1, v.size)} className="w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-lg flex items-center justify-center font-bold text-sm">−</button>
                                <span className="w-5 text-center font-bold text-sm text-gray-900 dark:text-gray-100">{inOrderV.quantity}</span>
                                <button onClick={() => changeQty(mi.id, 1, v.size)} className="w-6 h-6 bg-green-500 hover:bg-green-600 text-white rounded-lg flex items-center justify-center font-bold text-sm">+</button>
                              </>
                            ) : (
                              <button onClick={() => addItem(mi, v.size)} className="w-6 h-6 bg-orange-500 hover:bg-orange-600 text-white rounded-lg flex items-center justify-center">
                                <Plus className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            }
            const displayPrice = mi.variants && mi.variants.length === 1 ? mi.variants[0].price : mi.price;
            const displaySize = mi.variants && mi.variants.length === 1 ? mi.variants[0].size : null;
            const inOrder = items.find(i => i.menuItem === mi.id);
            return (
              <div key={mi.id} className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${inOrder ? 'border-orange-300 bg-orange-50 dark:bg-orange-900/20 dark:border-orange-700' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}`}>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-lg text-gray-900 dark:text-gray-100 truncate flex items-center gap-1">{mi.name} {displaySize && displaySize !== 'عادي' && <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded-full">{displaySize}</span>}</p>
                  <p className="text-base text-orange-600 dark:text-orange-400 font-semibold">{formatCurrencyUtil(displayPrice, i18n.language, cur)}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {inOrder ? (
                    <>
                      <button onClick={() => changeQty(mi.id, -1)} className="w-7 h-7 bg-red-500 hover:bg-red-600 text-white rounded-lg flex items-center justify-center font-bold text-lg transition-colors">−</button>
                      <span className="w-6 text-center font-bold text-gray-900 dark:text-gray-100 text-lg">{inOrder.quantity}</span>
                      <button onClick={() => changeQty(mi.id, 1)} className="w-7 h-7 bg-green-500 hover:bg-green-600 text-white rounded-lg flex items-center justify-center font-bold text-lg transition-colors">+</button>
                    </>
                  ) : (
                    <button onClick={() => addItem(mi)} className="w-7 h-7 bg-orange-500 hover:bg-orange-600 text-white rounded-lg flex items-center justify-center transition-colors">
                      <Plus className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-gray-200 dark:border-gray-700 flex-shrink-0 space-y-2">
          {items.length > 0 && (
            <div className="flex items-center justify-between bg-orange-50 dark:bg-orange-900/20 px-3 py-2 rounded-xl border border-orange-200 dark:border-orange-700">
              <span className="text-lg font-medium text-gray-700 dark:text-gray-300">{items.length} أصناف</span>
              <span className="text-lg font-bold text-orange-600 dark:text-orange-400">{formatCurrencyUtil(total, i18n.language, cur)}</span>
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-xl text-lg font-medium transition-colors">إلغاء</button>
            <button onClick={onSave} disabled={saving || items.length === 0}
              className="flex-1 py-2 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-xl text-lg font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5">
              {saving ? <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> : <CheckCircle className="h-4 w-4" />}
              {saving ? 'جاري الحفظ...' : 'إرسال الطلب'}
            </button>
          </div>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
};

export default QuickAddModal;
