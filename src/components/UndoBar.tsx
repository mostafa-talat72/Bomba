import React, { useEffect, useState } from 'react';
import { Undo2, X } from 'lucide-react';

export interface UndoRequest {
  message: string;
  /** ينفَّذ عند الضغط على تراجع */
  action: () => void | Promise<void>;
}

interface UndoBarProps {
  request: UndoRequest | null;
  onExpire: () => void;
  /** مدة التوفر قبل الاختفاء (افتراضي 10 ثوانٍ) */
  durationMs?: number;
}

const UndoBar: React.FC<UndoBarProps> = ({ request, onExpire, durationMs = 10000 }) => {
  const [remaining, setRemaining] = useState(100);

  useEffect(() => {
    if (!request) return;
    setRemaining(100);
    const startedAt = Date.now();
    const tick = setInterval(() => {
      const pct = Math.max(0, 100 - ((Date.now() - startedAt) / durationMs) * 100);
      setRemaining(pct);
      if (pct <= 0) { clearInterval(tick); onExpire(); }
    }, 100);
    return () => clearInterval(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request]);

  if (!request) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[400] w-[min(92vw,480px)] animate-slideUp">
      <div className="relative overflow-hidden bg-gray-900 dark:bg-gray-800 text-white rounded-xl shadow-2xl border border-gray-700 px-4 py-3 flex items-center gap-3">
        <span className="text-sm font-medium flex-1 truncate">{request.message}</span>
        <button
          onClick={async () => { const act = request.action; onExpire(); try { await act(); } catch { /* تم التنبيه مسبقاً */ } }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 active:scale-95 rounded-lg text-xs font-bold transition-all flex-shrink-0"
        >
          <Undo2 className="h-3.5 w-3.5" />تراجع
        </button>
        <button onClick={onExpire} className="p-1 hover:bg-white/10 rounded-lg transition-all flex-shrink-0" title="إغلاق">
          <X className="h-4 w-4 text-gray-400" />
        </button>
        {/* شريط الوقت المتبقي */}
        <div
          className="absolute bottom-0 right-0 h-0.5 bg-blue-500 transition-none"
          style={{ width: `${remaining}%` }}
        />
      </div>
    </div>
  );
};

export default UndoBar;
