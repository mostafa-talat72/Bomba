import { useTranslation } from 'react-i18next';

export const TestI18n = () => {
  const { t, i18n } = useTranslation();
  
  console.log('Current language:', i18n.language);
  console.log('Available languages:', Object.keys(i18n.store.data));
  console.log('Test translation:', t('notificationManagement.title'));
  console.log('i18n resources:', i18n.store.data);
  
  return (
    <div style={{ padding: '20px', background: 'white', color: 'black' }}>
      <h1>i18n Debug Info</h1>
      <p>Current Language: {i18n.language}</p>
      <p>Test Translation: {t('notificationManagement.title')}</p>
      <p>Common Save: {t('common.save')}</p>
      <pre>{JSON.stringify(i18n.store.data, null, 2)}</pre>
    </div>
  );
};
