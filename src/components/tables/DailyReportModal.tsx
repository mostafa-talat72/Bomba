import React from 'react';
import { FileText, Printer, X } from 'lucide-react';
import type { Bill } from '../../services/api';
import ModalPortal from '../ModalPortal';

const DailyReportModal: React.FC<{
  bills: Bill[];
  formatCurrency: (n: number) => string;
  onPrint: () => void;
  onClose: () => void;
  isPrinting: boolean;
}> = ({ bills, formatCurrency, onPrint, onClose, isPrinting }) => {
  const today = new Date();
  const todayBills = bills.filter(b => new Date(b.createdAt).toDateString() === today.toDateString());
  const paid = todayBills.filter(b => b.status === 'paid');
  const unpaid = todayBills.filter(b => ['draft','partial','overdue'].includes(b.status));
  const totalRevenue = paid.reduce((s, b) => s + (b.total || 0), 0);
  const totalCollected = todayBills.reduce((s, b) => s + (b.paid || 0), 0);
  const totalRemaining = unpaid.reduce((s, b) => s + (b.remaining || 0), 0);

  return (
    <ModalPortal>
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[300] p-3" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700">
        <div className="p-4 bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center border border-white/30">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-white">التقرير اليومي</h3>
              <p className="text-base text-green-100">{today.toLocaleDateString('ar-EG', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-lg flex items-center justify-center text-white"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'إيرادات الفواتير المدفوعة', value: formatCurrency(totalRevenue), color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700' },
              { label: 'إجمالي المحصّل', value: formatCurrency(totalCollected), color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700' },
              { label: 'إجمالي المتبقي', value: formatCurrency(totalRemaining), color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700' },
            ].map((s, i) => (
              <div key={i} className={`p-3 rounded-xl border ${s.bg}`}>
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-base text-gray-500 dark:text-gray-400 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'إجمالي الفواتير', value: todayBills.length, color: 'text-gray-700 dark:text-gray-300' },
              { label: 'مدفوعة', value: paid.length, color: 'text-green-600' },
              { label: 'غير مدفوعة', value: unpaid.length, color: 'text-red-600' },
            ].map((s, i) => (
              <div key={i} className="p-3 rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-center">
                <p className={`text-4xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-base text-gray-500 dark:text-gray-400 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Bills Table */}
          {todayBills.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
              <table className="w-full text-lg">
                <thead className="bg-emerald-500 text-white">
                  <tr>
                    {['#', 'رقم الفاتورة', 'الطاولة', 'الإجمالي', 'المدفوع', 'المتبقي', 'الحالة'].map(h => (
                      <th key={h} className="px-3 py-2 text-right font-semibold text-base">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {todayBills.map((b, i) => (
                    <tr key={b.id || b._id} className={i % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-750'}>
                      <td className="px-3 py-2 text-base text-gray-500">{i + 1}</td>
                      <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100 text-base">#{b.billNumber || (b.id || b._id)?.slice(-6)}</td>
                      <td className="px-3 py-2 text-base text-gray-600 dark:text-gray-400">{b.table ? `طاولة ${(b.table as any).number || ''}` : '—'}</td>
                      <td className="px-3 py-2 font-semibold text-base text-gray-900 dark:text-gray-100">{formatCurrency(b.total || 0)}</td>
                      <td className="px-3 py-2 text-base text-green-600 dark:text-green-400 font-semibold">{formatCurrency(b.paid || 0)}</td>
                      <td className="px-3 py-2 text-base text-red-600 dark:text-red-400 font-semibold">{formatCurrency(b.remaining || 0)}</td>
                      <td className="px-3 py-2">
                        <span className={`px-1.5 py-0.5 rounded-full text-base font-bold ${
                          b.status === 'paid' ? 'bg-green-100 text-green-700' :
                          b.status === 'partial' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-600'}`}>
                          {b.status === 'paid' ? 'مدفوعة' : b.status === 'partial' ? 'جزئي' : b.status === 'draft' ? 'معلقة' : b.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {todayBills.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>لا توجد فواتير اليوم</p>
            </div>
          )}
        </div>

        <div className="p-3 border-t border-gray-200 dark:border-gray-700 flex-shrink-0 flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-xl text-lg font-medium transition-colors">إغلاق</button>
          <button onClick={onPrint} disabled={isPrinting}
            className="flex-1 py-2.5 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white rounded-xl text-lg font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2">
            {isPrinting ? <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> : <Printer className="h-4 w-4" />}
            {isPrinting ? 'جاري الطباعة...' : 'طباعة التقرير'}
          </button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
};

export default DailyReportModal;
