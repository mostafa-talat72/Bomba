import React, { useMemo, useState } from 'react';
import {
  Crown, LayoutGrid, ShoppingCart, Receipt, Timer, History, Clock, UtensilsCrossed, Gamepad2,
  Package, Warehouse, Wallet, Banknote, ChefHat, Wrench, Folder, Search,
  ChevronDown, Check, X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../context/LanguageContext';
import { PERMISSION_GROUPS, togglePermissionSelection } from '../utils/permissionGroups';

export interface PickerPermission {
  id: string;
  name: string;
  description: string;
}

interface PermissionPickerProps {
  permissions: PickerPermission[];
  selected: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  lockNote?: string | null;
}

export const GROUP_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  crown: Crown,
  layout: LayoutGrid,
  cart: ShoppingCart,
  receipt: Receipt,
  timer: Timer,
  history: History,
  clock: Clock,
  menu: UtensilsCrossed,
  gamepad: Gamepad2,
  package: Package,
  warehouse: Warehouse,
  wallet: Wallet,
  payroll: Banknote,
  chef: ChefHat,
  tools: Wrench,
  other: Folder,
};

const PermissionPicker: React.FC<PermissionPickerProps> = ({
  permissions,
  selected,
  onChange,
  disabled = false,
  lockNote = null,
}) => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const byId = useMemo(() => {
    const map = new Map<string, PickerPermission>();
    permissions.forEach(p => map.set(p.id, p));
    return map;
  }, [permissions]);

  const groupedIds = useMemo(() => {
    const set = new Set<string>();
    PERMISSION_GROUPS.forEach(g => g.permissionIds.forEach(id => set.add(id)));
    return set;
  }, []);

  // Safety net: any catalog permission missing from the groups still shows up.
  // Plus: unknown SELECTED ids (stale/legacy stored values) show under "other" so the admin sees and can remove them.
  const groups = useMemo(() => {
    const ungrouped = permissions.filter(p => !groupedIds.has(p.id)).map(p => p.id);
    const unknownSelected = selected.filter(id => !byId.has(id) && !groupedIds.has(id));
    const extra = [...ungrouped, ...unknownSelected.filter(id => !ungrouped.includes(id))];
    if (extra.length === 0) return PERMISSION_GROUPS;
    return [...PERMISSION_GROUPS, { id: 'other', titleKey: 'users.permissionGroups.other', icon: 'other', permissionIds: extra }];
  }, [permissions, groupedIds, selected, byId]);

  const allSelected = selected.includes('all');

  const toggle = (id: string, checked: boolean) => {
    if (disabled) return;
    onChange(togglePermissionSelection(selected, id, checked));
  };

  const toggleGroup = (ids: string[]) => {
    if (disabled) return;
    const present = ids.filter(id => selected.includes(id));
    if (present.length === ids.length) {
      // all present → clear the group
      onChange(selected.filter(id => !ids.includes(id)));
    } else {
      // add missing (dropping the exclusive 'all')
      const missing = ids.filter(id => !selected.includes(id));
      onChange([...selected.filter(id => id !== 'all'), ...missing]);
    }
  };

  const setAllCollapsed = (value: boolean) => {
    const next: Record<string, boolean> = {};
    groups.forEach(g => { next[g.id] = value; });
    setCollapsed(next);
  };

  const q = query.trim().toLowerCase();
  const searchResults = useMemo(() => {
    if (!q) return [];
    return permissions.filter(p =>
      p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)
    );
  }, [permissions, q]);

  const groupOf = useMemo(() => {
    const map = new Map<string, string>();
    groups.forEach(g => g.permissionIds.forEach(id => map.set(id, g.id)));
    return map;
  }, [groups]);

  const renderRow = (perm: PickerPermission, groupId?: string) => {
    const isChecked = selected.includes(perm.id);
    const isDisabled = disabled || (allSelected && perm.id !== 'all');
    return (
      <label
        key={perm.id}
        className={`flex items-start p-3.5 bg-white dark:bg-gray-700 border-2 rounded-xl transition-all group ${
          isDisabled ? 'opacity-60 pointer-events-none' : 'cursor-pointer'
        } ${
          isChecked
            ? 'border-green-300 dark:border-green-500 bg-green-50 dark:bg-green-900/20'
            : 'border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-500'
        }`}
      >
        <div className="relative flex-shrink-0">
          <input
            type="checkbox"
            checked={isChecked}
            onChange={(e) => toggle(perm.id, e.target.checked)}
            disabled={isDisabled}
            className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-5 h-5"
          />
          {isChecked && (
            <Check className="absolute top-0.5 left-0.5 w-4 h-4 text-green-600 pointer-events-none" />
          )}
        </div>
        <div className={`${isRTL ? 'mr-3' : 'ml-3'} flex-1 min-w-0`}>
          <div className={`text-sm font-bold transition-colors flex items-center gap-1.5 flex-wrap ${
            isChecked
              ? 'text-green-900 dark:text-green-200'
              : 'text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400'
          }`}>
            <span>{perm.name}</span>
            {perm.id === 'all' && <Crown className="w-4 h-4 text-purple-600" />}
            {groupId && q && (
              <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-300 rounded-full text-[11px] font-semibold">
                {t(groups.find(g => g.id === groupId)?.titleKey || '')}
              </span>
            )}
          </div>
          <div className={`text-xs mt-0.5 ${
            isChecked ? 'text-green-700 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'
          }`}>
            {perm.description}
          </div>
        </div>
      </label>
    );
  };

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'}>
      {lockNote && (
        <p className="mb-3 text-xs font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
          {lockNote}
        </p>
      )}

      {/* Toolbar: search + count + actions */}
      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <div className="relative flex-1">
          <Search className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 ${isRTL ? 'right-3' : 'left-3'}`} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('users.permissionsUI.search')}
            disabled={disabled}
            className={`w-full py-2.5 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none ${isRTL ? 'pr-9 pl-8' : 'pl-9 pr-8'}`}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className={`absolute top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 ${isRTL ? 'left-2' : 'right-2'}`}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-xl text-xs font-bold whitespace-nowrap">
            {selected.length} / {permissions.length}
          </span>
          {!q && (
            <>
              <button
                type="button"
                onClick={() => setAllCollapsed(false)}
                disabled={disabled}
                className="px-3 py-2 text-xs font-bold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl transition-colors whitespace-nowrap disabled:opacity-50"
              >
                {t('users.permissionsUI.expandAll')}
              </button>
              <button
                type="button"
                onClick={() => setAllCollapsed(true)}
                disabled={disabled}
                className="px-3 py-2 text-xs font-bold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl transition-colors whitespace-nowrap disabled:opacity-50"
              >
                {t('users.permissionsUI.collapseAll')}
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => !disabled && onChange([])}
            disabled={disabled || selected.length === 0}
            className="px-3 py-2 text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-xl transition-colors whitespace-nowrap disabled:opacity-50"
          >
            {t('users.permissionsUI.clearAll')}
          </button>
        </div>
      </div>

      {q ? (
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700/50 dark:to-gray-800/50 border-2 border-gray-200 dark:border-gray-600 rounded-xl p-4">
          {searchResults.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
              {t('users.permissionsUI.noResults')}
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-96 overflow-y-auto modern-scrollbar">
              {searchResults.map(p => renderRow(p, groupOf.get(p.id)))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map(g => {
            const items = g.permissionIds
              .map(id => byId.get(id) || { id, name: id, description: t('users.permissionsUI.unknownPermission') })
              .filter((p): p is NonNullable<typeof p> => !!p);
            if (items.length === 0) return null;
            const count = items.filter(p => selected.includes(p.id)).length;
            const isCollapsed = !!collapsed[g.id];
            const allInGroup = count === items.length;
            const Icon = GROUP_ICONS[g.icon] || Folder;
            return (
              <div
                key={g.id}
                className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700/50 dark:to-gray-800/50 border-2 border-gray-200 dark:border-gray-600 rounded-xl overflow-hidden"
              >
                <div className="flex items-center gap-2 p-3">
                  <button
                    type="button"
                    onClick={() => setCollapsed(prev => ({ ...prev, [g.id]: !prev[g.id] }))}
                    className="flex items-center gap-2.5 flex-1 min-w-0 text-start"
                  >
                    <span className="p-2 rounded-lg bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 shadow-sm flex-shrink-0">
                      <Icon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </span>
                    <span className="font-bold text-sm text-gray-900 dark:text-gray-100 truncate">
                      {t(g.titleKey)}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold flex-shrink-0 ${
                      count > 0
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                        : 'bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-300'
                    }`}>
                      {count}/{items.length}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${isCollapsed ? (isRTL ? '-rotate-90' : 'rotate-90') : ''}`} />
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleGroup(items.map(p => p.id))}
                    disabled={disabled}
                    className="px-2.5 py-1.5 text-[11px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors whitespace-nowrap disabled:opacity-50"
                  >
                    {allInGroup ? t('users.permissionsUI.clear') : t('users.permissionsUI.selectAll')}
                  </button>
                </div>
                {!isCollapsed && (
                  <div className="px-3 pb-3 grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {items.map(p => renderRow(p))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PermissionPicker;
