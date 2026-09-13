import { useState, useEffect } from 'react';
import { Mail, Clock, FileText, Users, Plus, X, AlertCircle, Check, Info, Send } from 'lucide-react';
import LocalizedTimePicker from './common/LocalizedTimePicker';
import dayjs, { Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../context/LanguageContext';
import 'dayjs/locale/ar';
import 'dayjs/locale/en';
import 'dayjs/locale/fr';

interface ReportRecipient {
  email: string;
  language: string;
  sectionIds?: string[];
  includeEmployees?: boolean;
  includeCosts?: boolean;
  includePlaystation?: boolean;
  includeComputer?: boolean;
}

interface ReportSettingsSectionProps {
  canManage: boolean;
  isOwner: boolean;
  onSave: (settings: ReportSettings) => Promise<void>;
  onSendNow: () => Promise<void>;
  initialSettings?: ReportSettings;
  availableManagers: Array<{ _id: string; name: string; email: string }>;
  menuSections?: Array<{ _id?: string; id?: string; name: string }>;
}

interface ReportSettings {
  dailyReportEnabled: boolean;
  dailyReportStartTime: string;
  dailyReportSendTime: string;
  dailyReportEmails: ReportRecipient[];
  authorizedToManageReports: string[];
}

const fullScope = (): Pick<ReportRecipient, 'sectionIds' | 'includeEmployees' | 'includeCosts' | 'includePlaystation' | 'includeComputer'> => ({
  sectionIds: [],
  includeEmployees: true,
  includeCosts: true,
  includePlaystation: true,
  includeComputer: true,
});

const normalizeRecipient = (item: any): ReportRecipient => ({
  email: item?.email || '',
  language: item?.language || 'ar',
  sectionIds: Array.isArray(item?.sectionIds) ? item.sectionIds.map(String) : [],
  includeEmployees: item?.includeEmployees !== false,
  includeCosts: item?.includeCosts !== false,
  includePlaystation: item?.includePlaystation !== false,
  includeComputer: item?.includeComputer !== false,
});

export const ReportSettingsSection: React.FC<ReportSettingsSectionProps> = ({
  canManage,
  isOwner,
  onSave,
  onSendNow,
  initialSettings,
  availableManagers,
  menuSections = []
}) => {
  const { t } = useTranslation();
  const { language } = useLanguage();

  const [settings, setSettings] = useState<ReportSettings>({
    dailyReportEnabled: initialSettings?.dailyReportEnabled ?? true,
    dailyReportStartTime: initialSettings?.dailyReportStartTime || '08:00',
    dailyReportSendTime: initialSettings?.dailyReportSendTime || '09:00',
    dailyReportEmails: initialSettings?.dailyReportEmails || [],
    authorizedToManageReports: initialSettings?.authorizedToManageReports || [],
  });

  const [newEmail, setNewEmail] = useState('');
  const [newEmailLanguage, setNewEmailLanguage] = useState('ar');
  const [emailError, setEmailError] = useState('');
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [expandedEmail, setExpandedEmail] = useState<string | null>(null);

  useEffect(() => {
    dayjs.locale(language);
  }, [language]);

  useEffect(() => {
    if (initialSettings) {
      // Handle both old format (array of strings) and new format (array of objects)
      let emails = initialSettings.dailyReportEmails || [];
      if (emails.length > 0 && typeof emails[0] === 'string') {
        // Convert old format to new format
        emails = emails.map((email: any) => ({ email, language: 'ar' }));
      }

      setSettings({
        dailyReportEnabled: initialSettings.dailyReportEnabled ?? true,
        dailyReportStartTime: initialSettings.dailyReportStartTime || '08:00',
        dailyReportSendTime: initialSettings.dailyReportSendTime || '09:00',
        dailyReportEmails: (emails as any[]).map(normalizeRecipient),
        authorizedToManageReports: initialSettings.authorizedToManageReports || []
      });
    }
  }, [initialSettings]);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleAddEmail = () => {
    if (!newEmail.trim()) {
      setEmailError(t('settings.organization.dailyReports.emailRequired'));
      return;
    }

    if (!validateEmail(newEmail)) {
      setEmailError(t('settings.organization.dailyReports.emailInvalid'));
      return;
    }

    if (settings.dailyReportEmails.some(item => item.email === newEmail)) {
      setEmailError(t('settings.organization.dailyReports.emailExists'));
      return;
    }

    setSettings(prev => ({
      ...prev,
      dailyReportEmails: [...prev.dailyReportEmails, { email: newEmail, language: newEmailLanguage, ...fullScope() }]
    }));
    setNewEmail('');
    setNewEmailLanguage('ar');
    setEmailError('');
  };

  const handleUpdateRecipient = (email: string, patch: Partial<ReportRecipient>) => {
    setSettings(prev => ({
      ...prev,
      dailyReportEmails: prev.dailyReportEmails.map(item =>
        item.email === email ? { ...item, ...patch } : item
      )
    }));
  };

  const handleToggleSection = (email: string, sectionId: string) => {
    const item = settings.dailyReportEmails.find(i => i.email === email);
    if (!item) return;
    const current = item.sectionIds || [];
    const next = current.includes(sectionId)
      ? current.filter(id => id !== sectionId)
      : [...current, sectionId];
    handleUpdateRecipient(email, { sectionIds: next });
  };

  const scopeSummary = (item: ReportRecipient): string => {
    const parts: string[] = [];
    const total = menuSections.length;
    const sel = (item.sectionIds || []).length;
    parts.push(sel === 0 || (total > 0 && sel >= total)
      ? t('settings.organization.dailyReports.scopeAllSections')
      : t('settings.organization.dailyReports.scopeSections', { count: sel }));
    const mods: string[] = [];
    if (item.includeEmployees === false) mods.push(t('settings.organization.dailyReports.modEmployees'));
    if (item.includeCosts === false) mods.push(t('settings.organization.dailyReports.modCosts'));
    if (item.includePlaystation === false) mods.push(t('settings.organization.dailyReports.modPS'));
    if (item.includeComputer === false) mods.push(t('settings.organization.dailyReports.modPC'));
    if (mods.length) parts.push(t('settings.organization.dailyReports.scopeExcept', { items: mods.join('، ') }));
    return parts.join(' • ');
  };

  const handleRemoveEmail = (email: string) => {
    setSettings(prev => ({
      ...prev,
      dailyReportEmails: prev.dailyReportEmails.filter(item => item.email !== email)
    }));
  };

  const handleUpdateEmailLanguage = (email: string, language: string) => {
    setSettings(prev => ({
      ...prev,
      dailyReportEmails: prev.dailyReportEmails.map(item =>
        item.email === email ? { ...item, language } : item
      )
    }));
  };

  const handleTimeChange = (time: Dayjs | null, field: 'start' | 'send') => {
    if (time) {
      setSettings(prev => ({
        ...prev,
        [field === 'start' ? 'dailyReportStartTime' : 'dailyReportSendTime']: time.format('HH:mm')
      }));
    }
  };

  const handleToggleManager = (managerId: string) => {
    setSettings(prev => {
      const isSelected = prev.authorizedToManageReports.includes(managerId);
      return {
        ...prev,
        authorizedToManageReports: isSelected
          ? prev.authorizedToManageReports.filter(id => id !== managerId)
          : [...prev.authorizedToManageReports, managerId]
      };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(settings);
    } finally {
      setSaving(false);
    }
  };

  const handleSendNow = async () => {
    setSending(true);
    try {
      await onSendNow();
    } finally {
      setSending(false);
    }
  };

  if (!canManage) {
    return (
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
        <div className="flex items-start">
          <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 ml-3 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
              {t('settings.organization.dailyReports.noPermission')}
            </h4>
            <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
              {t('settings.organization.dailyReports.noPermissionMessage')}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 flex items-center">
          <FileText className="h-5 w-5 ml-2 text-orange-600" />
          {t('settings.organization.dailyReports.title')}
        </h3>
        {isOwner && (
          <span className="bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 text-xs px-2 py-1 rounded-full">
            {t('settings.organization.dailyReports.owner')}
          </span>
        )}
      </div>

      {/* Enable/Disable Toggle */}
      <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h4 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-1">
              {t('settings.organization.dailyReports.enableReport')}
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t('settings.organization.dailyReports.enableReportDesc')}
            </p>
          </div>
          <button
            onClick={() => setSettings(prev => ({ ...prev, dailyReportEnabled: !prev.dailyReportEnabled }))}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              settings.dailyReportEnabled
                ? 'bg-orange-600'
                : 'bg-gray-300 dark:bg-gray-600'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                settings.dailyReportEnabled ? 'translate-x-1' : 'translate-x-6'
              }`}
            />
          </button>
        </div>
      </div>

      {settings.dailyReportEnabled && (
        <>
          {/* Report Start Time */}
          <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
            <h4 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-3 flex items-center">
              <Clock className="h-5 w-5 ml-2 text-blue-600" />
              {t('settings.organization.dailyReports.reportStartTime')}
            </h4>
            <div className="space-y-3">
              <LocalizedTimePicker
                value={dayjs(settings.dailyReportStartTime, 'HH:mm')}
                onChange={(time) => handleTimeChange(time, 'start')}
                className="w-full"
                size="large"
                placeholder={t('settings.organization.dailyReports.selectStartTime')}
              />
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <div className="flex items-start">
                  <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 ml-2 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-blue-800 dark:text-blue-200">
                    <p className="font-medium mb-1">{t('settings.organization.dailyReports.startTimeLabel')}</p>
                    <p>{t('settings.organization.dailyReports.startTimeDesc')}</p>
                    <p className="mt-1">
                      <strong>{t('settings.organization.dailyReports.example')}:</strong> {t('settings.organization.dailyReports.startTimeExample', { time: settings.dailyReportStartTime })}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Report Send Time */}
          <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
            <h4 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-3 flex items-center">
              <Clock className="h-5 w-5 ml-2 text-green-600" />
              {t('settings.organization.dailyReports.reportSendTime')}
            </h4>
            <div className="space-y-3">
              <LocalizedTimePicker
                value={dayjs(settings.dailyReportSendTime, 'HH:mm')}
                onChange={(time) => handleTimeChange(time, 'send')}
                className="w-full"
                size="large"
                placeholder={t('settings.organization.dailyReports.selectSendTime')}
              />
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                <div className="flex items-start">
                  <Info className="h-4 w-4 text-green-600 dark:text-green-400 ml-2 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-green-800 dark:text-green-200">
                    <p className="font-medium mb-1">{t('settings.organization.dailyReports.sendTimeLabel')}</p>
                    <p>{t('settings.organization.dailyReports.sendTimeDesc')}</p>
                    <p className="mt-1">
                      <strong>{t('settings.organization.dailyReports.example')}:</strong> {t('settings.organization.dailyReports.sendTimeExample', { time: settings.dailyReportSendTime })}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Email List */}
          <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
            <h4 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-4 flex items-center">
              <Mail className="h-5 w-5 ml-2 text-green-600" />
              {t('settings.organization.dailyReports.recipientEmails')}
            </h4>
            
            {/* Add Email Input */}
            <div className="mb-4 bg-white dark:bg-gray-800 p-4 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('settings.organization.dailyReports.addNewEmail')}
              </label>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => {
                    setNewEmail(e.target.value);
                    setEmailError('');
                  }}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddEmail()}
                  placeholder={t('settings.organization.dailyReports.enterEmail')}
                  className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                />
                <div className="flex gap-2">
                  <select
                    value={newEmailLanguage}
                    onChange={(e) => setNewEmailLanguage(e.target.value)}
                    className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm min-w-[130px]"
                  >
                    <option value="ar">🇸🇦 العربية</option>
                    <option value="en">🇬🇧 English</option>
                    <option value="fr">🇫🇷 Français</option>
                  </select>
                  <button
                    onClick={handleAddEmail}
                    className="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg flex items-center gap-2 font-medium transition-colors whitespace-nowrap"
                  >
                    <Plus className="h-4 w-4" />
                    {t('common.add')}
                  </button>
                </div>
              </div>
              {emailError && (
                <div className="mt-2 flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{emailError}</span>
                </div>
              )}
            </div>

            {/* Email List */}
            {settings.dailyReportEmails.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                  {t('settings.organization.dailyReports.emailCount', { count: settings.dailyReportEmails.length })}
                </p>
                {settings.dailyReportEmails.map((item, index) => {
                  const expanded = expandedEmail === item.email;
                  const selCount = (item.sectionIds || []).length;
                  const allSelected = selCount === 0 || (menuSections.length > 0 && selCount >= menuSections.length);
                  return (
                  <div
                    key={index}
                    className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-orange-300 dark:hover:border-orange-700 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
                          <Mail className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-sm text-gray-900 dark:text-gray-100 font-medium break-all block">
                            {item.email}
                          </span>
                          <span className="text-[11px] text-gray-500 dark:text-gray-400 block truncate">
                            {scopeSummary(item)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <select
                          value={item.language}
                          onChange={(e) => handleUpdateEmailLanguage(item.email, e.target.value)}
                          className="px-3 py-1.5 text-xs font-medium border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 min-w-[110px]"
                        >
                          <option value="ar">🇸🇦 عربي</option>
                          <option value="en">🇬🇧 EN</option>
                          <option value="fr">🇫🇷 FR</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => setExpandedEmail(expanded ? null : item.email)}
                          className="px-3 py-1.5 text-xs font-bold border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:border-orange-400"
                        >
                          {t('settings.organization.dailyReports.scopeTitle')}
                        </button>
                        <button
                          onClick={() => handleRemoveEmail(item.email)}
                          className="text-red-600 hover:text-white dark:text-red-400 hover:bg-red-600 dark:hover:bg-red-500 p-1.5 rounded transition-colors"
                          title={t('common.delete')}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    {expanded && (
                      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 space-y-3">
                        <div>
                          <p className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">
                            {t('settings.organization.dailyReports.sectionsLabel')}
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleUpdateRecipient(item.email, { sectionIds: [] })}
                              className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${allSelected ? 'bg-orange-600 text-white border-orange-600' : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600'}`}
                            >
                              {t('settings.organization.dailyReports.allSections')}
                            </button>
                            {menuSections.map(sec => {
                              const id = String(sec._id || (sec as any).id);
                              const on = (item.sectionIds || []).includes(id);
                              return (
                                <button
                                  key={id}
                                  type="button"
                                  onClick={() => handleToggleSection(item.email, id)}
                                  className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${on ? 'bg-orange-600 text-white border-orange-600' : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600'}`}
                                >
                                  {sec.name}
                                </button>
                              );
                            })}
                          </div>
                          <p className="text-[11px] text-gray-400 mt-1.5">
                            {t('settings.organization.dailyReports.sectionsHint')}
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          {([
                            ['includeEmployees', 'modEmployeesFull'],
                            ['includeCosts', 'modCostsFull'],
                            ['includePlaystation', 'modPSFull'],
                            ['includeComputer', 'modPCFull'],
                          ] as const).map(([key, labelKey]) => {
                            const on = (item as any)[key] !== false;
                            return (
                              <button
                                key={key}
                                type="button"
                                onClick={() => handleUpdateRecipient(item.email, { [key]: !on } as any)}
                                className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold border transition-all ${on ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700 text-green-700 dark:text-green-300' : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 text-gray-400'}`}
                              >
                                <span>{t(`settings.organization.dailyReports.${labelKey}`)}</span>
                                <span className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${on ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${on ? 'right-0.5' : 'left-0.5'}`} />
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <Mail className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>{t('settings.organization.dailyReports.noEmails')}</p>
              </div>
            )}
          </div>

          {/* Authorized Managers (Owner Only) */}
          {isOwner && availableManagers.length > 0 && (
            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
              <h4 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-3 flex items-center">
                <Users className="h-5 w-5 ml-2 text-purple-600" />
                {t('settings.organization.dailyReports.authorizedManagers')}
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {t('settings.organization.dailyReports.authorizedManagersDesc')}
              </p>
              <div className="space-y-2">
                {availableManagers.map((manager) => (
                  <div
                    key={manager._id}
                    className="flex items-center justify-between bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-600"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                        <Users className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {manager.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {manager.email}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleToggleManager(manager._id)}
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                        settings.authorizedToManageReports.includes(manager._id)
                          ? 'bg-purple-600 border-purple-600'
                          : 'border-gray-300 dark:border-gray-600'
                      }`}
                    >
                      {settings.authorizedToManageReports.includes(manager._id) && (
                        <Check className="h-3 w-3 text-white" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Save Button */}
      <div className="flex justify-between items-center pt-4 border-t border-gray-200 dark:border-gray-700">
        {/* Send Now Button */}
        {settings.dailyReportEnabled && settings.dailyReportEmails.length > 0 && (
          <button
            onClick={handleSendNow}
            disabled={sending}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white px-6 py-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? (
              <>
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>{t('settings.organization.dailyReports.sending')}</span>
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                <span>{t('settings.organization.dailyReports.sendNow')}</span>
              </>
            )}
          </button>
        )}

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={saving || settings.dailyReportEmails.length === 0}
          className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 dark:bg-orange-500 dark:hover:bg-orange-600 text-white px-6 py-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? (
            <>
              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>{t('common.saving')}</span>
            </>
          ) : (
            <>
              <Check className="h-4 w-4" />
              <span>{t('settings.organization.dailyReports.saveSettings')}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
