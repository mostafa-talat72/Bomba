import React from 'react';
import { useTranslation } from 'react-i18next';
import type { UserNotificationPrefsDraft } from '../services/api/users';

export type NotifPrefsDraft = UserNotificationPrefsDraft & { smartAlerts?: boolean };

interface Props {
  value: NotifPrefsDraft;
  onChange: (next: NotifPrefsDraft) => void;
  disabled?: boolean;
}

const KINDS = ['order', 'bill', 'session', 'table', 'inventory', 'system'] as const;

/**
 * نموذج إعدادات إشعارات مستخدم واحد — مشترك بين صفحة المستخدمين (لأي مستخدم)
 * وقسم "إشعاراتي" (للنفس). القيم الغائبة تعني الافتراضي (مفعّل ما عدا منبه المطبخ).
 */
const UserNotificationPrefsForm: React.FC<Props> = ({ value, onChange, disabled }) => {
  const { t } = useTranslation();
  const kinds = value.toastKinds || {};

  const setKind = (kind: (typeof KINDS)[number], on: boolean) => {
    onChange({ ...value, toastKinds: { ...kinds, [kind]: on } });
  };

  const row = (label: string, on: boolean, set: (v: boolean) => void, key: string) => (
    <button
      key={key}
      type="button"
      disabled={disabled}
      onClick={() => set(!on)}
      className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
    >
      <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{label}</span>
      <span
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
          on ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            on ? 'translate-x-4 rtl:-translate-x-4' : 'translate-x-0.5 rtl:-translate-x-0.5'
          }`}
        />
      </span>
    </button>
  );

  return (
    <div className="space-y-2">
      <div className="text-xs font-bold text-gray-500 dark:text-gray-400">
        {t('notifPrefs.toastTitle')}
      </div>
      {KINDS.map((k) =>
        row(
          t(`notifPrefs.kinds.${k}`),
          kinds[k] !== false,
          (v) => setKind(k, v),
          k
        )
      )}
      <div className="text-xs font-bold text-gray-500 dark:text-gray-400 pt-2">
        {t('notifPrefs.otherTitle')}
      </div>
      {row(
        t('notifPrefs.sound'),
        value.sound !== false,
        (v) => onChange({ ...value, sound: v }),
        'sound'
      )}
      {row(
        t('notifPrefs.kitchenAlarm'),
        value.kitchenAlarm === true,
        (v) => onChange({ ...value, kitchenAlarm: v }),
        'kitchenAlarm'
      )}
      {row(
        t('notifPrefs.smartAlerts'),
        (value as any).smartAlerts !== false,
        (v) => onChange({ ...value, smartAlerts: v }),
        'smartAlerts'
      )}
    </div>
  );
};

export default UserNotificationPrefsForm;
