import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import ModalPortal from '../ModalPortal';
import { getTableDisplay } from './tableHelpers';

interface Props {
  billLabel: string;
  tables: any[];
  excludeTableId?: string;
  getSectionName?: (table: any) => string;
  changing: boolean;
  onConfirm: (tableId: string) => void;
  onClose: () => void;
}

/**
 * نافذة نقل فاتورة لطاولة — نفس الشكل في الطاولات والتيك أوي والدليفري:
 * بحث + قائمة بالأقسام + اختيار + تأكيد.
 */
const ChangeTableModal: React.FC<Props> = ({
  billLabel,
  tables,
  excludeTableId,
  getSectionName,
  changing,
  onConfirm,
  onClose,
}) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = selectedId ? (tables || []).find((x: any) => String(x._id || x.id) === String(selectedId)) : null;

  return (
    <ModalPortal>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-[300]" onClick={onClose}>
        <div
          className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-md p-3 sm:p-6 mx-2 sm:mx-0"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-1">{t('billing.changeTableTitle')}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">فاتورة #{billLabel}</p>
          <div className="mb-4">
            {selected && (() => {
              const sn = getSectionName ? getSectionName(selected) : '';
              return (
                <div className="mb-2 px-3 py-2 bg-blue-100 dark:bg-blue-900/40 border border-blue-300 rounded-lg flex items-center justify-between">
                  <span className="text-lg font-semibold text-blue-800 dark:text-blue-200">
                    {t('billing.tableWithNumber', { number: getTableDisplay(selected.number, i18n.language) })}{sn ? ` (${sn})` : ''} ✓
                  </span>
                  <button onClick={() => { setSelectedId(null); setSearch(''); }} className="text-base text-blue-600 dark:text-blue-400 hover:underline font-semibold">
                    {t('common.cancel')}
                  </button>
                </div>
              );
            })()}
            <div className="relative">
              <Search className={`absolute top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 ${isRTL ? 'right-3' : 'left-3'}`} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('billing.searchTable') || 'بحث...'}
                className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100 text-lg ${isRTL ? 'pr-10' : 'pl-10'}`}
                disabled={changing}
              />
            </div>
            <div className="mt-2 max-h-40 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
              {(tables || [])
                .filter((x: any) => x.isActive !== false && String(x._id || x.id) !== String(excludeTableId || ''))
                .filter((x: any) => !search || String(x.number).toLowerCase().includes(search.toLowerCase()))
                .sort((a: any, b: any) => String(a.number).localeCompare(String(b.number), 'ar', { numeric: true }))
                .map((table: any) => (
                  <button
                    key={table._id || table.id}
                    onClick={() => { setSelectedId(String(table._id || table.id)); setSearch(''); }}
                    disabled={changing}
                    className={`w-full text-right px-3 py-2 text-lg transition-colors hover:bg-blue-50 dark:hover:bg-blue-900/30 border-b border-gray-100 dark:border-gray-800 last:border-b-0 flex items-center justify-between gap-2 ${String(selectedId) === String(table._id || table.id) ? 'bg-blue-100 dark:bg-blue-900/50 font-semibold text-blue-800 dark:text-blue-200' : 'text-gray-700 dark:text-gray-300'}`}
                  >
                    <span>{t('billing.tableWithNumber', { number: getTableDisplay(table.number, i18n.language) })}</span>
                    {(() => {
                      const sn = getSectionName ? getSectionName(table) : '';
                      return sn ? <span className="text-sm text-gray-400 dark:text-gray-500 text-right">{sn}</span> : null;
                    })()}
                  </button>
                ))}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3">
            <button
              onClick={onClose}
              disabled={changing}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-900 dark:text-gray-100 transition-colors text-lg sm:text-xl"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={() => { if (selectedId) onConfirm(selectedId); }}
              disabled={changing || !selectedId}
              className={`px-4 sm:px-6 py-2 rounded-lg flex items-center justify-center transition-all text-white text-lg sm:text-xl ${changing || !selectedId ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
            >
              {changing ? t('billing.changing') : t('billing.confirmChange')}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

export default ChangeTableModal;
