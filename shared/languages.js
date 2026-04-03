/**
 * All world languages (ISO 639-1 codes)
 * Shared between frontend and backend
 * 
 * This is the single source of truth for supported languages
 * 
 * RTL Languages (Right-to-Left):
 * - Arabic (ar), Hebrew (he), Persian/Farsi (fa), Urdu (ur)
 * - Pashto (ps), Yiddish (yi), Sindhi (sd), Uyghur (ug)
 * - Dhivehi (dv), Kurdish (ku)
 */

export const WORLD_LANGUAGES = [
    // RTL Languages
    { code: 'ar', name: 'Arabic', nativeName: 'العربية', rtl: true, flag: '🇸🇦' },
    { code: 'he', name: 'Hebrew', nativeName: 'עברית', rtl: true, flag: '🇮🇱' },
    { code: 'fa', name: 'Persian', nativeName: 'فارسی', rtl: true, flag: '🇮🇷' },
    { code: 'ur', name: 'Urdu', nativeName: 'اردو', rtl: true, flag: '🇵🇰' },
    { code: 'ps', name: 'Pashto', nativeName: 'پښتو', rtl: true, flag: '🇦🇫' },
    { code: 'yi', name: 'Yiddish', nativeName: 'ייִדיש', rtl: true, flag: '🇮🇱' },
    { code: 'sd', name: 'Sindhi', nativeName: 'سنڌي', rtl: true, flag: '🇵🇰' },
    { code: 'ug', name: 'Uyghur', nativeName: 'ئۇيغۇرچە', rtl: true, flag: '🇨🇳' },
    { code: 'dv', name: 'Dhivehi', nativeName: 'ދިވެހި', rtl: true, flag: '🇲🇻' },
    { code: 'ku', name: 'Kurdish', nativeName: 'Kurdî', rtl: true, flag: '🇮🇶' },
    
    // LTR Languages - Major Languages
    { code: 'en', name: 'English', nativeName: 'English', rtl: false, flag: '🇬🇧' },
    { code: 'fr', name: 'French', nativeName: 'Français', rtl: false, flag: '🇫🇷' },
    { code: 'es', name: 'Spanish', nativeName: 'Español', rtl: false, flag: '🇪🇸' },
    { code: 'de', name: 'German', nativeName: 'Deutsch', rtl: false, flag: '🇩🇪' },
    { code: 'it', name: 'Italian', nativeName: 'Italiano', rtl: false, flag: '🇮🇹' },
    { code: 'pt', name: 'Portuguese', nativeName: 'Português', rtl: false, flag: '🇵🇹' },
    { code: 'ru', name: 'Russian', nativeName: 'Русский', rtl: false, flag: '🇷🇺' },
    { code: 'zh', name: 'Chinese', nativeName: '中文', rtl: false, flag: '🇨🇳' },
    { code: 'ja', name: 'Japanese', nativeName: '日本語', rtl: false, flag: '🇯🇵' },
    { code: 'ko', name: 'Korean', nativeName: '한국어', rtl: false, flag: '🇰🇷' },
    { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', rtl: false, flag: '🇮🇳' },
    { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', rtl: false, flag: '🇧🇩' },
    { code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', rtl: false, flag: '🇮🇳' },
    { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', rtl: false, flag: '🇮🇳' },
    { code: 'mr', name: 'Marathi', nativeName: 'मराठी', rtl: false, flag: '🇮🇳' },
    { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', rtl: false, flag: '🇮🇳' },
    { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', rtl: false, flag: '🇹🇷' },
    { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt', rtl: false, flag: '🇻🇳' },
    { code: 'th', name: 'Thai', nativeName: 'ไทย', rtl: false, flag: '🇹🇭' },
    { code: 'pl', name: 'Polish', nativeName: 'Polski', rtl: false, flag: '🇵🇱' },
    { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', rtl: false, flag: '🇳🇱' },
    { code: 'el', name: 'Greek', nativeName: 'Ελληνικά', rtl: false, flag: '🇬🇷' },
    { code: 'cs', name: 'Czech', nativeName: 'Čeština', rtl: false, flag: '🇨🇿' },
    { code: 'sv', name: 'Swedish', nativeName: 'Svenska', rtl: false, flag: '🇸🇪' },
    { code: 'ro', name: 'Romanian', nativeName: 'Română', rtl: false, flag: '🇷🇴' },
    { code: 'hu', name: 'Hungarian', nativeName: 'Magyar', rtl: false, flag: '🇭🇺' },
    { code: 'da', name: 'Danish', nativeName: 'Dansk', rtl: false, flag: '🇩🇰' },
    { code: 'fi', name: 'Finnish', nativeName: 'Suomi', rtl: false, flag: '🇫🇮' },
    { code: 'no', name: 'Norwegian', nativeName: 'Norsk', rtl: false, flag: '🇳🇴' },
    { code: 'sk', name: 'Slovak', nativeName: 'Slovenčina', rtl: false, flag: '🇸🇰' },
    { code: 'bg', name: 'Bulgarian', nativeName: 'Български', rtl: false, flag: '🇧🇬' },
    { code: 'hr', name: 'Croatian', nativeName: 'Hrvatski', rtl: false, flag: '🇭🇷' },
    { code: 'sr', name: 'Serbian', nativeName: 'Српски', rtl: false, flag: '🇷🇸' },
    { code: 'uk', name: 'Ukrainian', nativeName: 'Українська', rtl: false, flag: '🇺🇦' },
    { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia', rtl: false, flag: '🇮🇩' },
    { code: 'ms', name: 'Malay', nativeName: 'Bahasa Melayu', rtl: false, flag: '🇲🇾' },
    { code: 'sw', name: 'Swahili', nativeName: 'Kiswahili', rtl: false, flag: '🇰🇪' },
    
    // LTR Languages - Additional Languages
    { code: 'af', name: 'Afrikaans', nativeName: 'Afrikaans', rtl: false, flag: '🇿🇦' },
    { code: 'sq', name: 'Albanian', nativeName: 'Shqip', rtl: false, flag: '🇦🇱' },
    { code: 'am', name: 'Amharic', nativeName: 'አማርኛ', rtl: false, flag: '🇪🇹' },
    { code: 'hy', name: 'Armenian', nativeName: 'Հայերեն', rtl: false, flag: '🇦🇲' },
    { code: 'az', name: 'Azerbaijani', nativeName: 'Azərbaycan', rtl: false, flag: '🇦🇿' },
    { code: 'eu', name: 'Basque', nativeName: 'Euskara', rtl: false, flag: '🇪🇸' },
    { code: 'be', name: 'Belarusian', nativeName: 'Беларуская', rtl: false, flag: '🇧🇾' },
    { code: 'bs', name: 'Bosnian', nativeName: 'Bosanski', rtl: false, flag: '🇧🇦' },
    { code: 'ca', name: 'Catalan', nativeName: 'Català', rtl: false, flag: '🇪🇸' },
    { code: 'et', name: 'Estonian', nativeName: 'Eesti', rtl: false, flag: '🇪🇪' },
    { code: 'tl', name: 'Filipino', nativeName: 'Filipino', rtl: false, flag: '🇵🇭' },
    { code: 'gl', name: 'Galician', nativeName: 'Galego', rtl: false, flag: '🇪🇸' },
    { code: 'ka', name: 'Georgian', nativeName: 'ქართული', rtl: false, flag: '🇬🇪' },
    { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી', rtl: false, flag: '🇮🇳' },
    { code: 'ha', name: 'Hausa', nativeName: 'Hausa', rtl: false, flag: '🇳🇬' },
    { code: 'is', name: 'Icelandic', nativeName: 'Íslenska', rtl: false, flag: '🇮🇸' },
    { code: 'ig', name: 'Igbo', nativeName: 'Igbo', rtl: false, flag: '🇳🇬' },
    { code: 'ga', name: 'Irish', nativeName: 'Gaeilge', rtl: false, flag: '🇮🇪' },
    { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ', rtl: false, flag: '🇮🇳' },
    { code: 'kk', name: 'Kazakh', nativeName: 'Қазақ', rtl: false, flag: '🇰🇿' },
    { code: 'km', name: 'Khmer', nativeName: 'ខ្មែរ', rtl: false, flag: '🇰🇭' },
    { code: 'ky', name: 'Kyrgyz', nativeName: 'Кыргызча', rtl: false, flag: '🇰🇬' },
    { code: 'lo', name: 'Lao', nativeName: 'ລາວ', rtl: false, flag: '🇱🇦' },
    { code: 'lv', name: 'Latvian', nativeName: 'Latviešu', rtl: false, flag: '🇱🇻' },
    { code: 'lt', name: 'Lithuanian', nativeName: 'Lietuvių', rtl: false, flag: '🇱🇹' },
    { code: 'mk', name: 'Macedonian', nativeName: 'Македонски', rtl: false, flag: '🇲🇰' },
    { code: 'mg', name: 'Malagasy', nativeName: 'Malagasy', rtl: false, flag: '🇲🇬' },
    { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം', rtl: false, flag: '🇮🇳' },
    { code: 'mt', name: 'Maltese', nativeName: 'Malti', rtl: false, flag: '🇲🇹' },
    { code: 'mi', name: 'Maori', nativeName: 'Māori', rtl: false, flag: '🇳🇿' },
    { code: 'mn', name: 'Mongolian', nativeName: 'Монгол', rtl: false, flag: '🇲🇳' },
    { code: 'my', name: 'Myanmar', nativeName: 'မြန်မာ', rtl: false, flag: '🇲🇲' },
    { code: 'ne', name: 'Nepali', nativeName: 'नेपाली', rtl: false, flag: '🇳🇵' },
    { code: 'si', name: 'Sinhala', nativeName: 'සිංහල', rtl: false, flag: '🇱🇰' },
    { code: 'sl', name: 'Slovenian', nativeName: 'Slovenščina', rtl: false, flag: '🇸🇮' },
    { code: 'so', name: 'Somali', nativeName: 'Soomaali', rtl: false, flag: '🇸🇴' },
    { code: 'su', name: 'Sundanese', nativeName: 'Basa Sunda', rtl: false, flag: '🇮🇩' },
    { code: 'tg', name: 'Tajik', nativeName: 'Тоҷикӣ', rtl: false, flag: '🇹🇯' },
    { code: 'tk', name: 'Turkmen', nativeName: 'Türkmen', rtl: false, flag: '🇹🇲' },
    { code: 'uz', name: 'Uzbek', nativeName: 'Oʻzbek', rtl: false, flag: '🇺🇿' },
    { code: 'cy', name: 'Welsh', nativeName: 'Cymraeg', rtl: false, flag: '🏴󠁧󠁢󠁷󠁬󠁳󠁿' },
    { code: 'xh', name: 'Xhosa', nativeName: 'isiXhosa', rtl: false, flag: '🇿🇦' },
    { code: 'yo', name: 'Yoruba', nativeName: 'Yorùbá', rtl: false, flag: '🇳🇬' },
    { code: 'zu', name: 'Zulu', nativeName: 'isiZulu', rtl: false, flag: '🇿🇦' },
    { code: 'jv', name: 'Javanese', nativeName: 'Basa Jawa', rtl: false, flag: '🇮🇩' },
    { code: 'ceb', name: 'Cebuano', nativeName: 'Cebuano', rtl: false, flag: '🇵🇭' },
    { code: 'ht', name: 'Haitian Creole', nativeName: 'Kreyòl Ayisyen', rtl: false, flag: '🇭🇹' },
    { code: 'la', name: 'Latin', nativeName: 'Latina', rtl: false, flag: '🇻🇦' },
    { code: 'lb', name: 'Luxembourgish', nativeName: 'Lëtzebuergesch', rtl: false, flag: '🇱🇺' },
    { code: 'ny', name: 'Chichewa', nativeName: 'Chichewa', rtl: false, flag: '🇲🇼' },
    { code: 'sn', name: 'Shona', nativeName: 'chiShona', rtl: false, flag: '🇿🇼' },
    { code: 'st', name: 'Sesotho', nativeName: 'Sesotho', rtl: false, flag: '🇱🇸' },
    { code: 'gd', name: 'Scottish Gaelic', nativeName: 'Gàidhlig', rtl: false, flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿' },
    { code: 'fy', name: 'Frisian', nativeName: 'Frysk', rtl: false, flag: '🇳🇱' },
    { code: 'co', name: 'Corsican', nativeName: 'Corsu', rtl: false, flag: '🇫🇷' },
    { code: 'eo', name: 'Esperanto', nativeName: 'Esperanto', rtl: false, flag: '🌍' },
    { code: 'haw', name: 'Hawaiian', nativeName: 'ʻŌlelo Hawaiʻi', rtl: false, flag: '🇺🇸' },
    { code: 'iu', name: 'Inuktitut', nativeName: 'ᐃᓄᒃᑎᑐᑦ', rtl: false, flag: '🇨🇦' },
    { code: 'kl', name: 'Greenlandic', nativeName: 'Kalaallisut', rtl: false, flag: '🇬🇱' },
    { code: 'rw', name: 'Kinyarwanda', nativeName: 'Ikinyarwanda', rtl: false, flag: '🇷🇼' },
    { code: 'lg', name: 'Luganda', nativeName: 'Luganda', rtl: false, flag: '🇺🇬' },
    { code: 'ln', name: 'Lingala', nativeName: 'Lingála', rtl: false, flag: '🇨🇩' },
    { code: 'lu', name: 'Luba-Katanga', nativeName: 'Kiluba', rtl: false, flag: '🇨🇩' },
    { code: 'or', name: 'Odia', nativeName: 'ଓଡ଼ିଆ', rtl: false, flag: '🇮🇳' },
    { code: 'om', name: 'Oromo', nativeName: 'Oromoo', rtl: false, flag: '🇪🇹' },
    { code: 'qu', name: 'Quechua', nativeName: 'Runa Simi', rtl: false, flag: '🇵🇪' },
    { code: 'sm', name: 'Samoan', nativeName: 'Gagana Samoa', rtl: false, flag: '🇼🇸' },
    { code: 'sa', name: 'Sanskrit', nativeName: 'संस्कृतम्', rtl: false, flag: '🇮🇳' },
    { code: 'ti', name: 'Tigrinya', nativeName: 'ትግርኛ', rtl: false, flag: '🇪🇷' },
    { code: 'ts', name: 'Tsonga', nativeName: 'Xitsonga', rtl: false, flag: '🇿🇦' },
    { code: 'tt', name: 'Tatar', nativeName: 'Татар', rtl: false, flag: '🇷🇺' },
    { code: 've', name: 'Venda', nativeName: 'Tshivenḓa', rtl: false, flag: '🇿🇦' },
    { code: 'wo', name: 'Wolof', nativeName: 'Wolof', rtl: false, flag: '🇸🇳' },
    { code: 'as', name: 'Assamese', nativeName: 'অসমীয়া', rtl: false, flag: '🇮🇳' },
    { code: 'ay', name: 'Aymara', nativeName: 'Aymar Aru', rtl: false, flag: '🇧🇴' },
    { code: 'bm', name: 'Bambara', nativeName: 'Bamanankan', rtl: false, flag: '🇲🇱' },
    { code: 'ee', name: 'Ewe', nativeName: 'Eʋegbe', rtl: false, flag: '🇬🇭' },
    { code: 'gn', name: 'Guarani', nativeName: 'Avañe\'ẽ', rtl: false, flag: '🇵🇾' },
    { code: 'ik', name: 'Inupiaq', nativeName: 'Iñupiatun', rtl: false, flag: '🇺🇸' },
    { code: 'kri', name: 'Krio', nativeName: 'Krio', rtl: false, flag: '🇸🇱' },
    { code: 'ks', name: 'Kashmiri', nativeName: 'कश्मीरी', rtl: false, flag: '🇮🇳' },
    { code: 'kr', name: 'Kanuri', nativeName: 'Kanuri', rtl: false, flag: '🇳🇬' },
    { code: 'mh', name: 'Marshallese', nativeName: 'Kajin M̧ajeļ', rtl: false, flag: '🇲🇭' },
    { code: 'nv', name: 'Navajo', nativeName: 'Diné Bizaad', rtl: false, flag: '🇺🇸' },
    { code: 'nd', name: 'North Ndebele', nativeName: 'isiNdebele', rtl: false, flag: '🇿🇼' },
    { code: 'nr', name: 'South Ndebele', nativeName: 'isiNdebele', rtl: false, flag: '🇿🇦' },
    { code: 'ng', name: 'Ndonga', nativeName: 'Owambo', rtl: false, flag: '🇳🇦' },
    { code: 'oc', name: 'Occitan', nativeName: 'Occitan', rtl: false, flag: '🇫🇷' },
    { code: 'os', name: 'Ossetian', nativeName: 'Ирон', rtl: false, flag: '🇷🇺' },
    { code: 'pi', name: 'Pali', nativeName: 'पालि', rtl: false, flag: '🇮🇳' },
    { code: 'rm', name: 'Romansh', nativeName: 'Rumantsch', rtl: false, flag: '🇨🇭' },
    { code: 'sg', name: 'Sango', nativeName: 'Sängö', rtl: false, flag: '🇨🇫' },
    { code: 'ss', name: 'Swati', nativeName: 'SiSwati', rtl: false, flag: '🇸🇿' },
    { code: 'tn', name: 'Tswana', nativeName: 'Setswana', rtl: false, flag: '🇧🇼' },
    { code: 'to', name: 'Tonga', nativeName: 'Lea Faka-Tonga', rtl: false, flag: '🇹🇴' },
    { code: 'tw', name: 'Twi', nativeName: 'Twi', rtl: false, flag: '🇬🇭' },
    { code: 'ty', name: 'Tahitian', nativeName: 'Reo Tahiti', rtl: false, flag: '🇵🇫' },
    { code: 'wa', name: 'Walloon', nativeName: 'Walon', rtl: false, flag: '🇧🇪' },
    { code: 'za', name: 'Zhuang', nativeName: 'Cuengh', rtl: false, flag: '🇨🇳' }
];

/**
 * Get language by code
 * @param {string} code - ISO 639-1 language code
 * @returns {Object|null} Language object or null
 */
export const getLanguageByCode = (code) => {
    return WORLD_LANGUAGES.find(lang => lang.code === code) || null;
};

/**
 * Check if language is RTL
 * @param {string} code - ISO 639-1 language code
 * @returns {boolean} True if RTL, false otherwise
 */
export const isLanguageRTL = (code) => {
    const lang = getLanguageByCode(code);
    return lang ? lang.rtl : false;
};

/**
 * Get all RTL languages
 * @returns {Array} Array of RTL language objects
 */
export const getRTLLanguages = () => {
    return WORLD_LANGUAGES.filter(lang => lang.rtl);
};

/**
 * Get all LTR languages
 * @returns {Array} Array of LTR language objects
 */
export const getLTRLanguages = () => {
    return WORLD_LANGUAGES.filter(lang => !lang.rtl);
};
