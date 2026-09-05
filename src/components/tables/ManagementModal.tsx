import React, { useState, useEffect } from 'react';
import { Settings, Trash2, Edit, Plus, Layers, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../context/LanguageContext';
import type { Table, TableSection } from '../../services/api';
import ModalPortal from '../ModalPortal';
import { getTableDisplay } from './tableHelpers';

const ManagementModal: React.FC<{
  tableSections: TableSection[]; tables: Table[]; onClose: () => void;
  onAddSection: () => void; onEditSection: (s: TableSection) => void; onDeleteSection: (id: string) => Promise<void>;
  onAddTable: (sectionId: string) => void; onEditTable: (t: Table) => void; onDeleteTable: (id: string) => Promise<void>;
  getTablesBySection: (id: string) => Table[];
}> = ({ tableSections, tables, onClose, onAddSection, onEditSection, onDeleteSection, onAddTable, onEditTable, onDeleteTable, getTablesBySection }) => {
  const { t, i18n } = useTranslation();
  const { isRTL } = useLanguage();

  // ── #8 Drag & Drop state ──
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [localOrder, setLocalOrder] = useState<Table[]>(tables);

  useEffect(() => { setLocalOrder(tables); }, [tables]);

  const handleDragStart = (e: React.DragEvent, tableId: string) => {
    setDraggedId(tableId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, tableId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (tableId !== draggedId) setDragOverId(tableId);
  };

  const handleDrop = (e: React.DragEvent, targetId: string, sectionId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) { setDraggedId(null); setDragOverId(null); return; }
    setLocalOrder(prev => {
      const secTables = prev.filter(tb => {
        const sid = typeof tb.section === 'string' ? tb.section : (tb.section as TableSection)?._id || (tb.section as TableSection)?.id;
        return sid === sectionId;
      });
      const dragIdx = secTables.findIndex(tb => (tb._id || (tb as any).id) === draggedId);
      const dropIdx = secTables.findIndex(tb => (tb._id || (tb as any).id) === targetId);
      if (dragIdx === -1 || dropIdx === -1) return prev;
      const reordered = [...secTables];
      const [moved] = reordered.splice(dragIdx, 1);
      reordered.splice(dropIdx, 0, moved);
      const otherTables = prev.filter(tb => {
        const sid = typeof tb.section === 'string' ? tb.section : (tb.section as TableSection)?._id || (tb.section as TableSection)?.id;
        return sid !== sectionId;
      });
      return [...otherTables, ...reordered];
    });
    setDraggedId(null);
    setDragOverId(null);
  };

  const getLocalTablesBySection = (sectionId: string) =>
    localOrder.filter(tb => {
      const sid = typeof tb.section === 'string' ? tb.section : (tb.section as TableSection)?._id || (tb.section as TableSection)?.id;
      return sid === sectionId;
    });

  return (
    <ModalPortal>
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[300] p-3 sm:p-4 md:p-6">
      <div className="bg-white dark:bg-gray-800 rounded-2xl sm:rounded-3xl shadow-2xl max-w-sm sm:max-w-2xl md:max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-gray-200 dark:border-gray-700">
        <div className="relative p-4 sm:p-5 md:p-6 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex-shrink-0">
          <div className="relative flex items-center justify-between z-10">
            <div className="flex items-center gap-2 sm:gap-3 md:gap-4 min-w-0 flex-1">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 backdrop-blur-sm rounded-xl sm:rounded-2xl flex items-center justify-center shadow-xl border border-white/30 flex-shrink-0">
                <Settings className="h-5 w-5 sm:h-6 sm:w-6 md:h-7 md:w-7 text-white" />
              </div>
              <div>
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white drop-shadow-lg truncate">{t('cafe.managementModal.title')}</h2>
                <p className="text-base sm:text-lg text-white/80 mt-1">{t('cafe.managementModal.sectionsCount', { count: tableSections.length })} • {t('cafe.managementModal.tablesCount', { count: tables.length })}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 sm:p-2.5 hover:bg-white/20 backdrop-blur-sm rounded-xl border border-white/30 hover:scale-110 flex-shrink-0"><X className="h-5 w-5 sm:h-6 sm:w-6 text-white" /></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 md:p-6 bg-gray-50 dark:bg-gray-900">
          <div className="mb-4 sm:mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-5">
              <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <div className="w-1 h-5 sm:h-6 bg-gradient-to-b from-indigo-500 to-purple-500 rounded-full"></div>{t('cafe.managementModal.sections')}
              </h3>
              <button onClick={onAddSection} className="w-full sm:w-auto bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white px-4 py-2.5 rounded-xl flex items-center justify-center text-lg font-bold shadow-lg hover:scale-105">
                <Plus className={`h-4 w-4 ${isRTL ? 'ml-1' : 'mr-1'}`} />{t('cafe.managementModal.addSection')}
              </button>
            </div>
            <div className="space-y-3 sm:space-y-4">
              {tableSections.sort((a, b) => a.sortOrder - b.sortOrder).map(section => {
                const sectionTables = getLocalTablesBySection(section.id);
                return (
                  <div key={section.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl sm:rounded-2xl p-4 sm:p-5 hover:shadow-lg transition-all">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4 mb-3 sm:mb-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                          <h4 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 truncate">{section.name}</h4>
                          <span className="w-fit px-2 py-1 bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 text-base font-bold rounded-full">{t('cafe.managementModal.tableCount', { count: sectionTables.length })}</span>
                        </div>
                        {section.description && <p className="text-base sm:text-lg text-gray-600 dark:text-gray-400 line-clamp-2">{section.description}</p>}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button onClick={() => onEditSection(section)} className="p-2 sm:p-2.5 hover:bg-orange-50 dark:hover:bg-orange-900/30 rounded-xl transition-all hover:scale-110 border border-transparent hover:border-orange-200"><Edit className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600 dark:text-orange-400" /></button>
                        <button onClick={() => onDeleteSection(section.id)} className="p-2 sm:p-2.5 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl transition-all hover:scale-110 border border-transparent hover:border-red-200"><Trash2 className="h-4 w-4 sm:h-5 sm:w-5 text-red-600 dark:text-red-400" /></button>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                      {/* #8 Drag & Drop table chips */}
                      <div className="flex flex-wrap gap-2 flex-1">
                        {sectionTables.length === 0 && (
                          <span className="text-base text-gray-400 italic">اسحب الطاولات هنا</span>
                        )}
                        {sectionTables.map(table => {
                          const tid = table._id || (table as any).id;
                          const isDragging = draggedId === tid;
                          const isDragOver = dragOverId === tid;
                          return (
                            <div
                              key={String(tid)}
                              draggable
                              onDragStart={e => handleDragStart(e, tid)}
                              onDragOver={e => handleDragOver(e, tid)}
                              onDrop={e => handleDrop(e, tid, section.id)}
                              onDragEnd={() => { setDraggedId(null); setDragOverId(null); }}
                              className={`group flex items-center gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl border transition-all cursor-grab active:cursor-grabbing select-none
                                ${isDragging ? 'opacity-40 scale-95 border-dashed border-indigo-400 bg-indigo-50 dark:bg-indigo-900/30' :
                                  isDragOver ? 'border-2 border-indigo-500 bg-indigo-50 dark:bg-indigo-900/40 shadow-lg scale-105' :
                                  'bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 border-gray-300 dark:border-gray-600 hover:border-indigo-300 hover:shadow-md'}`}>
                              {/* Drag handle */}
                              <div className="flex flex-col gap-0.5 opacity-40 group-hover:opacity-100 transition-opacity">
                                <div className="w-3 h-0.5 bg-gray-500 rounded-full"></div>
                                <div className="w-3 h-0.5 bg-gray-500 rounded-full"></div>
                                <div className="w-3 h-0.5 bg-gray-500 rounded-full"></div>
                              </div>
                              <span className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100">{getTableDisplay(table.number, i18n.language)}</span>
                              <div className="flex items-center gap-1">
                                <button onClick={e => { e.stopPropagation(); onEditTable(table); }} className="p-1 hover:bg-orange-200 dark:hover:bg-orange-800 rounded-lg transition-all"><Edit className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-orange-600 dark:text-orange-400" /></button>
                                <button onClick={e => { e.stopPropagation(); onDeleteTable(table.id); }} className="p-1 hover:bg-red-200 dark:hover:bg-red-800 rounded-lg transition-all"><Trash2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-red-600 dark:text-red-400" /></button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <button onClick={() => onAddTable(section.id)} className="w-full sm:w-auto bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white px-3 py-2 rounded-xl text-base sm:text-lg font-bold flex items-center justify-center gap-1 shadow-md hover:scale-105">
                        <Plus className="h-3 w-3 sm:h-4 sm:w-4" />{t('cafe.managementModal.addTable')}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          {draggedId && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-indigo-600 text-white px-4 py-2 rounded-full shadow-xl text-lg font-medium z-50 flex items-center gap-2 pointer-events-none">
              <Layers className="h-4 w-4" />
              اسحب فوق طاولة أخرى لتبديل الترتيب
            </div>
          )}
        </div>
        <div className="flex items-center justify-end p-4 sm:p-5 md:p-6 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0">
          <button onClick={onClose} className="w-full sm:w-auto px-4 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-xl transition-colors text-lg sm:text-xl font-medium">{t('common.close')}</button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
};

export default ManagementModal;
