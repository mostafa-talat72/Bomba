import React from 'react';
import { useTranslation } from 'react-i18next';
import ModalPortal from '../ModalPortal';

export interface PrepSection {
  id: string;
  name: string;
}

interface Props {
  billLabel: string;
  sections: PrepSection[];
  selected: string[];
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  onConfirm: () => void;
  onClose: () => void;
}

/** نافذة اختيار أقسام التحضير — نفس شكل نافذة الطاولات. */
const OrderPrintSectionsModal: React.FC<Props> = ({
  billLabel,
  sections,
  selected,
  onToggle,
  onToggleAll,
  onConfirm,
  onClose,
}) => {
  const { t } = useTranslation();
  return (
    <ModalPortal>
      <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-[300] p-4" onClick={onClose}>
        <div
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-gray-700"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-5 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-orange-50 to-white dark:from-gray-800 dark:to-gray-800">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t('orderPrint.chooseSections')}</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {t('orderPrint.chooseSectionsHint')} — #{billLabel}
                </p>
              </div>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-2xl leading-none" aria-label={t('common.cancel')}>×</button>
            </div>
          </div>
          <div className="p-5">
            <button
              onClick={onToggleAll}
              className="mb-3 w-full rounded-xl border border-orange-200 dark:border-orange-900/60 px-4 py-2.5 text-sm font-semibold text-orange-700 dark:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors"
            >
              {selected.length === sections.length ? t('orderPrint.clearAll') : t('orderPrint.selectAll')}
            </button>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {sections.map((section) => (
                <label key={section.id} className="flex items-center gap-3 p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-orange-300 hover:bg-orange-50/60 dark:hover:bg-gray-700 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={selected.includes(section.id)}
                    onChange={() => onToggle(section.id)}
                    className="h-5 w-5 accent-orange-600"
                  />
                  <span className="text-lg text-gray-800 dark:text-gray-100">{section.name}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="p-5 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
            <button onClick={onClose} className="px-5 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 font-medium">{t('common.cancel')}</button>
            <button onClick={onConfirm} disabled={selected.length === 0} className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed">{t('orderPrint.printSelected')}</button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

export default OrderPrintSectionsModal;
