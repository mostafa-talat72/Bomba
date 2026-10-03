import React from 'react';
import { X, FileText, Plus } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useTabs, getModalCount } from '../context/TabsContext';

export interface TabLinkMeta {
  name: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
}

/**
 * شريط تبويبات الديسكتوب: أيقونة + اسم الصفحة لكل تبويب، زر إغلاق،
 * ونقطة تنبيه عند وجود نافذة منبثقة مفتوحة داخل التبويب.
 */
const DesktopTabBar: React.FC<{ links: TabLinkMeta[] }> = ({ links }) => {
  const { tabs, activeId, switchTab, closeTab, openTab, modalTick } = useTabs();
  void modalTick;
  const { isRTL } = useLanguage();

  const metaOf = (path: string): TabLinkMeta => {
    const f = links.find((l) => l.href === path);
    if (f) return f;
    return { name: path.replace(/^\//, ''), href: path, icon: FileText };
  };

  if (tabs.length === 0) return null;

  return (
    <div
      className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-stretch gap-1 px-2 pt-1.5 flex-shrink-0"
      style={{ direction: isRTL ? 'rtl' : 'ltr' }}
      role="tablist"
      aria-label="tabs"
    >
      <div className="flex items-stretch gap-1 overflow-x-auto flex-1 min-w-0">
      {tabs.map((tb) => {
        const meta = metaOf(tb.path);
        const Icon = meta.icon || FileText;
        const active = tb.id === activeId;
        const modals = getModalCount(tb.id);
        return (
          <div
            key={tb.id}
            role="tab"
            aria-selected={active}
            onClick={() => switchTab(tb.id)}
            title={meta.name}
            className={`group relative flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-t-lg border border-b-0 cursor-pointer whitespace-nowrap transition-colors min-w-0 max-w-[180px] ${
              active
                ? 'bg-gray-50 dark:bg-gray-900 text-orange-700 dark:text-orange-300 border-gray-200 dark:border-gray-700 border-b-gray-50 dark:border-b-gray-900 -mb-px z-10'
                : 'bg-gray-100 dark:bg-gray-700/60 text-gray-600 dark:text-gray-300 border-transparent hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            <Icon className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">{meta.name}</span>
            {modals > 0 && (
              <span
                title="نافذة مفتوحة"
                className="flex-shrink-0 w-2 h-2 rounded-full bg-orange-500 animate-pulse"
              />
            )}
            <button
              type="button"
              aria-label="close tab"
              onClick={(e) => { e.stopPropagation(); closeTab(tb.id); }}
              className="flex-shrink-0 rounded p-0.5 text-gray-400 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/40 opacity-60 group-hover:opacity-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
        {/* زر تبويب جديد — بجانب آخر تبويب مباشرة */}
        <button
          type="button"
          title="تبويب جديد"
          aria-label="new tab"
          onClick={() => openTab('/dashboard')}
          className="flex-shrink-0 self-center rounded-lg p-1.5 text-gray-500 hover:text-orange-600 hover:bg-orange-50 dark:text-gray-400 dark:hover:text-orange-300 dark:hover:bg-orange-900/20 transition-colors"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default DesktopTabBar;
