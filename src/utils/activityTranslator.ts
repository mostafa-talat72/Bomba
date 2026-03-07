import i18n from '../i18n/config';

/**
 * ترجمة رسائل النشاط من العربية إلى اللغة الحالية
 * هذه دالة مؤقتة حتى يتم تحديث الـ backend ليرسل مفاتيح ترجمة
 */
export const translateActivityMessage = (message: string): string => {
  const currentLang = i18n.language;
  
  // إذا كانت اللغة عربية، أرجع الرسالة كما هي
  if (currentLang === 'ar') {
    return message;
  }

  // قاموس الترجمة للرسائل الشائعة
  const translations: Record<string, Record<string, string>> = {
    // رسائل الجلسات
    'بدء جلسة جديدة': {
      en: 'New session started',
      fr: 'Nouvelle session démarrée'
    },
    'انتهت جلسة': {
      en: 'Session ended',
      fr: 'Session terminée'
    },
    'انتهاء جلسة': {
      en: 'Session ended',
      fr: 'Session terminée'
    },
    'جلسة جديدة': {
      en: 'New session',
      fr: 'Nouvelle session'
    },
    'إنهاء جلسة': {
      en: 'End session',
      fr: 'Fin de session'
    },
    
    // رسائل الطلبات
    'طلب جديد': {
      en: 'New order',
      fr: 'Nouvelle commande'
    },
    'تم إنشاء طلب جديد': {
      en: 'New order created',
      fr: 'Nouvelle commande créée'
    },
    'طلب قيد التحضير': {
      en: 'Order being prepared',
      fr: 'Commande en préparation'
    },
    'طلب جاهز': {
      en: 'Order ready',
      fr: 'Commande prête'
    },
    'تم تسليم الطلب': {
      en: 'Order delivered',
      fr: 'Commande livrée'
    },
    
    // رسائل الدفع
    'دفعة جديدة': {
      en: 'New payment',
      fr: 'Nouveau paiement'
    },
    'تم الدفع': {
      en: 'Payment completed',
      fr: 'Paiement effectué'
    },
    'دفع جزئي': {
      en: 'Partial payment',
      fr: 'Paiement partiel'
    },
    
    // رسائل الفواتير
    'فاتورة جديدة': {
      en: 'New bill',
      fr: 'Nouvelle facture'
    },
    'تم إنشاء فاتورة': {
      en: 'Bill created',
      fr: 'Facture créée'
    }
  };

  // البحث عن ترجمة مطابقة تماماً
  if (translations[message] && translations[message][currentLang]) {
    return translations[message][currentLang];
  }

  // البحث عن ترجمة جزئية (إذا كانت الرسالة تحتوي على النص)
  for (const [arabicText, langs] of Object.entries(translations)) {
    if (message.includes(arabicText) && langs[currentLang]) {
      return message.replace(arabicText, langs[currentLang]);
    }
  }

  // إذا لم نجد ترجمة، أرجع الرسالة الأصلية
  return message;
};
