import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import ModalPortal from './ModalPortal';
import UserNotificationPrefsForm, { type NotifPrefsDraft } from './UserNotificationPrefsForm';
import { usersApi } from '../services/api/users';

interface Props {
  userId: string | null;
  userName?: string;
  isOpen: boolean;
  onClose: () => void;
  showNotification: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  onSaved?: (prefs: NotifPrefsDraft) => void;
}

/**
 * محرر إعدادات إشعارات مستخدم واحد (تتبعه على أي جهاز).
 * يُستخدم من صفحة المستخدمين (لأي مستخدم) — و"إشعاراتي" تستخدم النموذج مباشرة.
 */
const UserNotificationPrefsModal: React.FC<Props> = ({ userId, userName, isOpen, onClose, showNotification, onSaved }) => {
  const { t } = useTranslation();
  const [prefs, setPrefs] = useState<NotifPrefsDraft>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen || !userId) return;
    let cancelled = false;
    setLoading(true);
    usersApi
      .getUserNotificationSettings(userId)
      .then((res) => {
        if (!cancelled && res?.success && res.data) setPrefs(res.data);
      })
      .catch(() => {
        if (!cancelled) showNotification(t('notifPrefs.loadError'), 'error');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, userId]);

  if (!isOpen || !userId) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await usersApi.updateUserNotificationSettings(userId, prefs);
      if (res?.success) {
        showNotification(t('notifPrefs.saved'), 'success');
        try { onSaved?.(res.data || prefs); } catch {}
        onClose();
      } else {
        showNotification((res as any)?.message || t('notifPrefs.loadError'), 'error');
      }
    } catch {
      showNotification(t('notifPrefs.loadError'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[320] flex items-center justify-center bg-black/50 p-3" onClick={onClose}>
        <div
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-gray-700 p-5 max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
            {t('notifPrefs.title')}
          </h3>
          {userName && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{userName}</p>
          )}
          {loading ? (
            <p className="text-sm text-gray-500 py-6 text-center">...</p>
          ) : (
            <UserNotificationPrefsForm value={prefs} onChange={setPrefs} disabled={saving} />
          )}
          <div className="flex gap-2 mt-5">
            <button
              onClick={handleSave}
              disabled={saving || loading}
              className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-lg disabled:opacity-50"
            >
              {t('notifPrefs.save')}
            </button>
            <button
              onClick={onClose}
              disabled={saving}
              className="flex-1 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm font-bold rounded-lg"
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

export default UserNotificationPrefsModal;
