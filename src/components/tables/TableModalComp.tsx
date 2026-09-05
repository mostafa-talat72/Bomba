import React, { useEffect, useRef } from 'react';
import { Plus, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Table, TableSection } from '../../services/api';
import ModalPortal from '../ModalPortal';

const TableModalComp: React.FC<{
  formData: { number: string; section: string };
  setFormData: (d: { number: string; section: string }) => void;
  tableSections: TableSection[]; editingTable: Table | null; onSave: () => void; onClose: () => void;
}> = ({ formData, setFormData, tableSections, editingTable, onSave, onClose }) => {
  const { t } = useTranslation();
  const numRef = useRef<HTMLInputElement>(null);
  useEffect(() => { const timer = setTimeout(() => numRef.current?.focus(), 100); return () => clearTimeout(timer); }, []);
  return (
    <ModalPortal>
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[300] p-3 sm:p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-sm sm:max-w-md w-full border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="relative p-4 sm:p-5 bg-gradient-to-br from-green-500 to-emerald-600">
          <div className="relative flex items-center justify-between z-10">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/30 flex-shrink-0"><Plus className="h-5 w-5 sm:h-6 sm:w-6 text-white" /></div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white drop-shadow-lg truncate">{editingTable ? t('cafe.tableModal.editTitle') : t('cafe.tableModal.addTitle')}</h2>
            </div>
            <button onClick={onClose} className="p-2 sm:p-2.5 hover:bg-white/20 backdrop-blur-sm rounded-xl border border-white/30 flex-shrink-0"><X className="h-5 w-5 sm:h-6 sm:w-6 text-white" /></button>
          </div>
        </div>
        <div className="p-4 sm:p-5 space-y-4 sm:space-y-5 bg-gray-50 dark:bg-gray-900">
          <div>
            <label className="block text-lg font-bold text-gray-700 dark:text-gray-300 mb-2">{t('cafe.tableModal.tableNumberRequired')}</label>
            <input ref={numRef} type="text" value={formData.number} onChange={e => setFormData({ ...formData, number: e.target.value })} autoFocus
              className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-lg sm:text-xl focus:ring-2 focus:ring-green-500"
              placeholder={t('cafe.tableModal.tableNumberPlaceholder')} />
          </div>
          <div>
            <label className="block text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">{t('cafe.tableModal.sectionRequired')}</label>
            <select value={formData.section} onChange={e => setFormData({ ...formData, section: e.target.value })}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-lg sm:text-xl focus:ring-2 focus:ring-green-500">
              <option value="">{t('cafe.tableModal.selectSection')}</option>
              {tableSections.filter(s => s.isActive !== false).sort((a, b) => a.sortOrder - b.sortOrder).map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-end gap-3 p-4 sm:p-5 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <button onClick={onClose} className="w-full sm:w-auto px-4 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-xl text-lg sm:text-xl font-medium">{t('cafe.tableModal.cancel')}</button>
          <button onClick={onSave} className="w-full sm:w-auto px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-lg sm:text-xl font-medium">{t('cafe.tableModal.save')}</button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
};

export default TableModalComp;
