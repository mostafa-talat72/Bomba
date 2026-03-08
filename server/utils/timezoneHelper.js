/**
 * Timezone helper utilities for backend
 * جميع المناطق الزمنية للدول العربية
 */

// قائمة المناطق الزمنية المدعومة - جميع الدول العربية
export const supportedTimezones = [
  // مصر
  { value: 'Africa/Cairo', label: 'القاهرة، مصر (GMT+2)', labelEn: 'Cairo, Egypt (GMT+2)', labelFr: 'Le Caire, Égypte (GMT+2)', offset: '+02:00' },
  
  // السعودية
  { value: 'Asia/Riyadh', label: 'الرياض، السعودية (GMT+3)', labelEn: 'Riyadh, Saudi Arabia (GMT+3)', labelFr: 'Riyad, Arabie Saoudite (GMT+3)', offset: '+03:00' },
  
  // الإمارات
  { value: 'Asia/Dubai', label: 'دبي، الإمارات (GMT+4)', labelEn: 'Dubai, UAE (GMT+4)', labelFr: 'Dubaï, EAU (GMT+4)', offset: '+04:00' },
  
  // الكويت
  { value: 'Asia/Kuwait', label: 'الكويت (GMT+3)', labelEn: 'Kuwait (GMT+3)', labelFr: 'Koweït (GMT+3)', offset: '+03:00' },
  
  // قطر
  { value: 'Asia/Qatar', label: 'الدوحة، قطر (GMT+3)', labelEn: 'Doha, Qatar (GMT+3)', labelFr: 'Doha, Qatar (GMT+3)', offset: '+03:00' },
  
  // البحرين
  { value: 'Asia/Bahrain', label: 'المنامة، البحرين (GMT+3)', labelEn: 'Manama, Bahrain (GMT+3)', labelFr: 'Manama, Bahreïn (GMT+3)', offset: '+03:00' },
  
  // عمان
  { value: 'Asia/Muscat', label: 'مسقط، عمان (GMT+4)', labelEn: 'Muscat, Oman (GMT+4)', labelFr: 'Mascate, Oman (GMT+4)', offset: '+04:00' },
  
  // العراق
  { value: 'Asia/Baghdad', label: 'بغداد، العراق (GMT+3)', labelEn: 'Baghdad, Iraq (GMT+3)', labelFr: 'Bagdad, Irak (GMT+3)', offset: '+03:00' },
  
  // سوريا
  { value: 'Asia/Damascus', label: 'دمشق، سوريا (GMT+3)', labelEn: 'Damascus, Syria (GMT+3)', labelFr: 'Damas, Syrie (GMT+3)', offset: '+03:00' },
  
  // لبنان
  { value: 'Asia/Beirut', label: 'بيروت، لبنان (GMT+3)', labelEn: 'Beirut, Lebanon (GMT+3)', labelFr: 'Beyrouth, Liban (GMT+3)', offset: '+03:00' },
  
  // الأردن
  { value: 'Asia/Amman', label: 'عمّان، الأردن (GMT+3)', labelEn: 'Amman, Jordan (GMT+3)', labelFr: 'Amman, Jordanie (GMT+3)', offset: '+03:00' },
  
  // فلسطين
  { value: 'Asia/Gaza', label: 'غزة، فلسطين (GMT+3)', labelEn: 'Gaza, Palestine (GMT+3)', labelFr: 'Gaza, Palestine (GMT+3)', offset: '+03:00' },
  { value: 'Asia/Hebron', label: 'الخليل، فلسطين (GMT+3)', labelEn: 'Hebron, Palestine (GMT+3)', labelFr: 'Hébron, Palestine (GMT+3)', offset: '+03:00' },
  
  // اليمن
  { value: 'Asia/Aden', label: 'عدن، اليمن (GMT+3)', labelEn: 'Aden, Yemen (GMT+3)', labelFr: 'Aden, Yémen (GMT+3)', offset: '+03:00' },
  
  // المغرب
  { value: 'Africa/Casablanca', label: 'الدار البيضاء، المغرب (GMT+1)', labelEn: 'Casablanca, Morocco (GMT+1)', labelFr: 'Casablanca, Maroc (GMT+1)', offset: '+01:00' },
  
  // الجزائر
  { value: 'Africa/Algiers', label: 'الجزائر (GMT+1)', labelEn: 'Algiers, Algeria (GMT+1)', labelFr: 'Alger, Algérie (GMT+1)', offset: '+01:00' },
  
  // تونس
  { value: 'Africa/Tunis', label: 'تونس (GMT+1)', labelEn: 'Tunis, Tunisia (GMT+1)', labelFr: 'Tunis, Tunisie (GMT+1)', offset: '+01:00' },
  
  // ليبيا
  { value: 'Africa/Tripoli', label: 'طرابلس، ليبيا (GMT+2)', labelEn: 'Tripoli, Libya (GMT+2)', labelFr: 'Tripoli, Libye (GMT+2)', offset: '+02:00' },
  
  // السودان
  { value: 'Africa/Khartoum', label: 'الخرطوم، السودان (GMT+2)', labelEn: 'Khartoum, Sudan (GMT+2)', labelFr: 'Khartoum, Soudan (GMT+2)', offset: '+02:00' },
  
  // الصومال
  { value: 'Africa/Mogadishu', label: 'مقديشو، الصومال (GMT+3)', labelEn: 'Mogadishu, Somalia (GMT+3)', labelFr: 'Mogadiscio, Somalie (GMT+3)', offset: '+03:00' },
  
  // جيبوتي
  { value: 'Africa/Djibouti', label: 'جيبوتي (GMT+3)', labelEn: 'Djibouti (GMT+3)', labelFr: 'Djibouti (GMT+3)', offset: '+03:00' },
  
  // جزر القمر
  { value: 'Indian/Comoro', label: 'موروني، جزر القمر (GMT+3)', labelEn: 'Moroni, Comoros (GMT+3)', labelFr: 'Moroni, Comores (GMT+3)', offset: '+03:00' },
  
  // موريتانيا
  { value: 'Africa/Nouakchott', label: 'نواكشوط، موريتانيا (GMT+0)', labelEn: 'Nouakchott, Mauritania (GMT+0)', labelFr: 'Nouakchott, Mauritanie (GMT+0)', offset: '+00:00' },
  
  // مناطق زمنية عالمية شائعة
  { value: 'Europe/London', label: 'لندن (GMT+0)', labelEn: 'London (GMT+0)', labelFr: 'Londres (GMT+0)', offset: '+00:00' },
  { value: 'Europe/Paris', label: 'باريس (GMT+1)', labelEn: 'Paris (GMT+1)', labelFr: 'Paris (GMT+1)', offset: '+01:00' },
  { value: 'Europe/Berlin', label: 'برلين (GMT+1)', labelEn: 'Berlin (GMT+1)', labelFr: 'Berlin (GMT+1)', offset: '+01:00' },
  { value: 'Europe/Rome', label: 'روما (GMT+1)', labelEn: 'Rome (GMT+1)', labelFr: 'Rome (GMT+1)', offset: '+01:00' },
  { value: 'Europe/Madrid', label: 'مدريد (GMT+1)', labelEn: 'Madrid (GMT+1)', labelFr: 'Madrid (GMT+1)', offset: '+01:00' },
  { value: 'Europe/Istanbul', label: 'إسطنبول (GMT+3)', labelEn: 'Istanbul (GMT+3)', labelFr: 'Istanbul (GMT+3)', offset: '+03:00' },
  { value: 'America/New_York', label: 'نيويورك (GMT-5)', labelEn: 'New York (GMT-5)', labelFr: 'New York (GMT-5)', offset: '-05:00' },
  { value: 'America/Los_Angeles', label: 'لوس أنجلوس (GMT-8)', labelEn: 'Los Angeles (GMT-8)', labelFr: 'Los Angeles (GMT-8)', offset: '-08:00' },
  { value: 'America/Chicago', label: 'شيكاغو (GMT-6)', labelEn: 'Chicago (GMT-6)', labelFr: 'Chicago (GMT-6)', offset: '-06:00' },
  { value: 'Asia/Tokyo', label: 'طوكيو (GMT+9)', labelEn: 'Tokyo (GMT+9)', labelFr: 'Tokyo (GMT+9)', offset: '+09:00' },
  { value: 'Asia/Shanghai', label: 'شنغهاي (GMT+8)', labelEn: 'Shanghai (GMT+8)', labelFr: 'Shanghai (GMT+8)', offset: '+08:00' },
  { value: 'Asia/Singapore', label: 'سنغافورة (GMT+8)', labelEn: 'Singapore (GMT+8)', labelFr: 'Singapour (GMT+8)', offset: '+08:00' },
  { value: 'Asia/Kolkata', label: 'كولكاتا (GMT+5:30)', labelEn: 'Kolkata (GMT+5:30)', labelFr: 'Calcutta (GMT+5:30)', offset: '+05:30' },
  { value: 'Australia/Sydney', label: 'سيدني (GMT+10)', labelEn: 'Sydney (GMT+10)', labelFr: 'Sydney (GMT+10)', offset: '+10:00' },
];

/**
 * Get timezone label by language
 */
export const getTimezoneLabel = (timezone, language = 'ar') => {
  const tz = supportedTimezones.find(t => t.value === timezone);
  if (!tz) return timezone;
  
  switch (language) {
    case 'en':
      return tz.labelEn;
    case 'fr':
      return tz.labelFr;
    default:
      return tz.label;
  }
};

/**
 * Validate if timezone is supported
 */
export const isValidTimezone = (timezone) => {
  return supportedTimezones.some(tz => tz.value === timezone);
};
