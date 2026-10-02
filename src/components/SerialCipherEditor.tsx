import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

interface Props {
  title: string;
  description: string;
  value: Record<string, string> | null | undefined;
  onChange: (v: Record<string, string> | null) => void;
}

const encodeSample = (draft: string[]) => {
  const map: Record<string, string> = {};
  DIGITS.forEach((d, i) => { map[d] = draft[i]; });
  return '12'.split('').map(ch => map[ch] || ch).join('');
};

const SerialCipherEditor: React.FC<Props> = ({ title, description, value, onChange }) => {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<string[]>(() => DIGITS.map(d => value?.[d] || ''));
  const [dupChar, setDupChar] = useState<string | null>(null);
  const dupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setDraft(DIGITS.map(d => value?.[d] || ''));
  }, [value]);

  useEffect(() => () => {
    if (dupTimer.current) clearTimeout(dupTimer.current);
  }, []);

  const filled = draft.filter(v => v !== '');
  const complete = filled.length === 10;
  const dupes = complete && new Set(filled).size !== 10;

  const warnDuplicate = (ch: string) => {
    setDupChar(ch);
    if (dupTimer.current) clearTimeout(dupTimer.current);
    dupTimer.current = setTimeout(() => setDupChar(null), 3000);
  };

  // الفرادة على القيم الفعلية: المدخل + هويات الفارغين
  const effectiveValid = (arr: string[]) => {
    const eff = arr.map((v, i) => (v !== '' ? v : DIGITS[i]));
    return new Set(eff).size === 10;
  };

  const commit = (next: string[]) => {
    setDraft(next);
    if (!effectiveValid(next)) return;
    const map: Record<string, string> = {};
    DIGITS.forEach((d, i) => { if (next[i] !== '') map[d] = next[i]; });
    onChange(map);
  };

  const clear = () => {
    setDraft(Array(10).fill(''));
    onChange(null);
  };

  return (
    <div className="bg-gray-50 dark:bg-gray-800/60 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-1">
        <h5 className="font-bold text-gray-900 dark:text-gray-100">{title}</h5>
        <button
          type="button"
          onClick={clear}
          className="text-xs text-red-600 dark:text-red-400 hover:underline font-bold"
        >
          {t('settings.organization.numbering.clear')}
        </button>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">{description}</p>
      <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5" dir="ltr">
        {DIGITS.map((d, i) => (
          <div key={d} className="flex flex-col items-center gap-1">
            <span className="text-xs font-bold text-gray-400 dark:text-gray-500">{d}</span>
            <span className="text-gray-300 dark:text-gray-600 text-xs">↓</span>
            <input
              value={draft[i]}
              maxLength={1}
              onChange={(e) => {
                const raw = e.target.value.replace(/\s/g, '');
                if (raw === '') {
                  const next = [...draft];
                  next[i] = '';
                  commit(next);
                  setDupChar(null);
                  return;
                }
                const ch = raw.slice(-1);
                if (ch === '-' || ch === '/' || ch === '\\') return;
                // منع التعارض مع المدخلات الأخرى ومع هويات الخانات الفارغة
                const taken = new Set<string>();
                draft.forEach((x, j) => {
                  if (j === i) return;
                  taken.add(x !== '' ? x : DIGITS[j]);
                });
                if (taken.has(ch)) {
                  warnDuplicate(ch);
                  return;
                }
                const next = [...draft];
                next[i] = ch;
                commit(next);
                setDupChar(null);
              }}
              placeholder={d}
              className={`w-9 h-9 text-center text-lg font-bold rounded-lg border bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-orange-500 placeholder:text-gray-400 placeholder:font-bold dark:placeholder:text-gray-500 ${
                draft[i] ? 'border-orange-300 dark:border-orange-700' : 'border-gray-200 dark:border-gray-600'
              }`}
            />
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between text-xs">
        <span className="text-gray-500 dark:text-gray-400">
          {t('settings.organization.numbering.example')}: <span className="font-mono font-bold text-gray-800 dark:text-gray-200" dir="ltr">001 ← {complete && !dupes ? encodeSample(draft) : '…'}</span>
        </span>
        {(dupChar || dupes) && (
          <span className="text-red-600 dark:text-red-400 font-bold">
            {dupChar
              ? t('settings.organization.numbering.duplicateChar', { char: dupChar })
              : t('settings.organization.numbering.duplicate')}
          </span>
        )}
        {!dupChar && !dupes && filled.length > 0 && !complete && (
          <span className="text-amber-600 dark:text-amber-400">{t('settings.organization.numbering.incomplete')}</span>
        )}
      </div>
    </div>
  );
};

export default SerialCipherEditor;
