/**
 * Currency symbols for all supported currencies
 * Shared between frontend and backend
 * 
 * This is the single source of truth for currency symbols
 * Contains all world currencies (ISO 4217)
 */

export const CURRENCY_SYMBOLS = {
    // Africa
    'DZD': { 'ar': 'د.ج', 'en': 'DZD', 'fr': 'DZD' },  // Algeria
    'AOA': { 'ar': 'Kz', 'en': 'Kz', 'fr': 'Kz' },     // Angola
    'BWP': { 'ar': 'P', 'en': 'P', 'fr': 'P' },        // Botswana
    'BIF': { 'ar': 'FBu', 'en': 'FBu', 'fr': 'FBu' },  // Burundi
    'XAF': { 'ar': 'FCFA', 'en': 'FCFA', 'fr': 'FCFA' }, // Central African CFA
    'XOF': { 'ar': 'CFA', 'en': 'CFA', 'fr': 'CFA' },  // West African CFA
    'KMF': { 'ar': 'ف.ق', 'en': 'KMF', 'fr': 'KMF' },  // Comoros
    'CDF': { 'ar': 'FC', 'en': 'FC', 'fr': 'FC' },     // Congo
    'DJF': { 'ar': 'ف.ج', 'en': 'DJF', 'fr': 'DJF' },  // Djibouti
    'EGP': { 'ar': 'ج.م', 'en': 'EGP', 'fr': 'EGP' },  // Egypt
    'ERN': { 'ar': 'Nfk', 'en': 'Nfk', 'fr': 'Nfk' },  // Eritrea
    'ETB': { 'ar': 'Br', 'en': 'Br', 'fr': 'Br' },     // Ethiopia
    'GMD': { 'ar': 'D', 'en': 'D', 'fr': 'D' },        // Gambia
    'GHS': { 'ar': '₵', 'en': '₵', 'fr': '₵' },        // Ghana
    'GNF': { 'ar': 'FG', 'en': 'FG', 'fr': 'FG' },     // Guinea
    'KES': { 'ar': 'KSh', 'en': 'KSh', 'fr': 'KSh' },  // Kenya
    'LSL': { 'ar': 'L', 'en': 'L', 'fr': 'L' },        // Lesotho
    'LRD': { 'ar': '$', 'en': '$', 'fr': '$' },        // Liberia
    'LYD': { 'ar': 'د.ل', 'en': 'LYD', 'fr': 'LYD' },  // Libya
    'MGA': { 'ar': 'Ar', 'en': 'Ar', 'fr': 'Ar' },     // Madagascar
    'MWK': { 'ar': 'MK', 'en': 'MK', 'fr': 'MK' },     // Malawi
    'MUR': { 'ar': '₨', 'en': '₨', 'fr': '₨' },        // Mauritius
    'MAD': { 'ar': 'د.م', 'en': 'MAD', 'fr': 'MAD' },  // Morocco
    'MZN': { 'ar': 'MT', 'en': 'MT', 'fr': 'MT' },     // Mozambique
    'NAD': { 'ar': '$', 'en': '$', 'fr': '$' },        // Namibia
    'NGN': { 'ar': '₦', 'en': '₦', 'fr': '₦' },        // Nigeria
    'RWF': { 'ar': 'FRw', 'en': 'FRw', 'fr': 'FRw' },  // Rwanda
    'STN': { 'ar': 'Db', 'en': 'Db', 'fr': 'Db' },     // São Tomé
    'SCR': { 'ar': '₨', 'en': '₨', 'fr': '₨' },        // Seychelles
    'SLL': { 'ar': 'Le', 'en': 'Le', 'fr': 'Le' },     // Sierra Leone
    'SOS': { 'ar': 'ش.ص', 'en': 'SOS', 'fr': 'SOS' },  // Somalia
    'ZAR': { 'ar': 'R', 'en': 'R', 'fr': 'R' },        // South Africa
    'SSP': { 'ar': '£', 'en': '£', 'fr': '£' },        // South Sudan
    'SDG': { 'ar': 'ج.س', 'en': 'SDG', 'fr': 'SDG' },  // Sudan
    'SZL': { 'ar': 'L', 'en': 'L', 'fr': 'L' },        // Eswatini
    'TZS': { 'ar': 'TSh', 'en': 'TSh', 'fr': 'TSh' },  // Tanzania
    'TND': { 'ar': 'د.ت', 'en': 'TND', 'fr': 'TND' },  // Tunisia
    'UGX': { 'ar': 'USh', 'en': 'USh', 'fr': 'USh' },  // Uganda
    'ZMW': { 'ar': 'ZK', 'en': 'ZK', 'fr': 'ZK' },     // Zambia
    'ZWL': { 'ar': '$', 'en': '$', 'fr': '$' },        // Zimbabwe
    'MRU': { 'ar': 'أ.م', 'en': 'MRU', 'fr': 'MRU' },  // Mauritania
    
    // Americas
    'ARS': { 'ar': '$', 'en': '$', 'fr': '$' },        // Argentina
    'AWG': { 'ar': 'ƒ', 'en': 'ƒ', 'fr': 'ƒ' },        // Aruba
    'BSD': { 'ar': '$', 'en': '$', 'fr': '$' },        // Bahamas
    'BBD': { 'ar': '$', 'en': '$', 'fr': '$' },        // Barbados
    'BZD': { 'ar': '$', 'en': '$', 'fr': '$' },        // Belize
    'BMD': { 'ar': '$', 'en': '$', 'fr': '$' },        // Bermuda
    'BOB': { 'ar': 'Bs', 'en': 'Bs', 'fr': 'Bs' },     // Bolivia
    'BRL': { 'ar': 'R$', 'en': 'R$', 'fr': 'R$' },     // Brazil
    'CAD': { 'ar': '$', 'en': '$', 'fr': '$' },        // Canada
    'KYD': { 'ar': '$', 'en': '$', 'fr': '$' },        // Cayman Islands
    'CLP': { 'ar': '$', 'en': '$', 'fr': '$' },        // Chile
    'COP': { 'ar': '$', 'en': '$', 'fr': '$' },        // Colombia
    'CRC': { 'ar': '₡', 'en': '₡', 'fr': '₡' },        // Costa Rica
    'CUP': { 'ar': '$', 'en': '$', 'fr': '$' },        // Cuba
    'DOP': { 'ar': '$', 'en': '$', 'fr': '$' },        // Dominican Republic
    'XCD': { 'ar': '$', 'en': '$', 'fr': '$' },        // East Caribbean
    'SVC': { 'ar': '$', 'en': '$', 'fr': '$' },        // El Salvador
    'FKP': { 'ar': '£', 'en': '£', 'fr': '£' },        // Falkland Islands
    'GTQ': { 'ar': 'Q', 'en': 'Q', 'fr': 'Q' },        // Guatemala
    'GYD': { 'ar': '$', 'en': '$', 'fr': '$' },        // Guyana
    'HTG': { 'ar': 'G', 'en': 'G', 'fr': 'G' },        // Haiti
    'HNL': { 'ar': 'L', 'en': 'L', 'fr': 'L' },        // Honduras
    'JMD': { 'ar': '$', 'en': '$', 'fr': '$' },        // Jamaica
    'MXN': { 'ar': '$', 'en': '$', 'fr': '$' },        // Mexico
    'NIO': { 'ar': 'C$', 'en': 'C$', 'fr': 'C$' },     // Nicaragua
    'PAB': { 'ar': 'B/.', 'en': 'B/.', 'fr': 'B/.' },  // Panama
    'PYG': { 'ar': '₲', 'en': '₲', 'fr': '₲' },        // Paraguay
    'PEN': { 'ar': 'S/', 'en': 'S/', 'fr': 'S/' },     // Peru
    'SRD': { 'ar': '$', 'en': '$', 'fr': '$' },        // Suriname
    'TTD': { 'ar': '$', 'en': '$', 'fr': '$' },        // Trinidad and Tobago
    'USD': { 'ar': '$', 'en': '$', 'fr': '$' },        // United States
    'UYU': { 'ar': '$', 'en': '$', 'fr': '$' },        // Uruguay
    'VES': { 'ar': 'Bs.S', 'en': 'Bs.S', 'fr': 'Bs.S' }, // Venezuela
    
    // Asia
    'AFN': { 'ar': '؋', 'en': '؋', 'fr': '؋' },        // Afghanistan
    'AMD': { 'ar': '֏', 'en': '֏', 'fr': '֏' },        // Armenia
    'AZN': { 'ar': '₼', 'en': '₼', 'fr': '₼' },        // Azerbaijan
    'BHD': { 'ar': 'د.ب', 'en': 'BHD', 'fr': 'BHD' },  // Bahrain
    'BDT': { 'ar': '৳', 'en': '৳', 'fr': '৳' },        // Bangladesh
    'BTN': { 'ar': 'Nu.', 'en': 'Nu.', 'fr': 'Nu.' },  // Bhutan
    'BND': { 'ar': '$', 'en': '$', 'fr': '$' },        // Brunei
    'KHR': { 'ar': '៛', 'en': '៛', 'fr': '៛' },        // Cambodia
    'CNY': { 'ar': '¥', 'en': '¥', 'fr': '¥' },        // China
    'GEL': { 'ar': '₾', 'en': '₾', 'fr': '₾' },        // Georgia
    'HKD': { 'ar': '$', 'en': '$', 'fr': '$' },        // Hong Kong
    'INR': { 'ar': '₹', 'en': '₹', 'fr': '₹' },        // India
    'IDR': { 'ar': 'Rp', 'en': 'Rp', 'fr': 'Rp' },     // Indonesia
    'IRR': { 'ar': '﷼', 'en': '﷼', 'fr': '﷼' },        // Iran
    'IQD': { 'ar': 'د.ع', 'en': 'IQD', 'fr': 'IQD' },  // Iraq
    'ILS': { 'ar': '₪', 'en': '₪', 'fr': '₪' },        // Israel
    'JPY': { 'ar': '¥', 'en': '¥', 'fr': '¥' },        // Japan
    'JOD': { 'ar': 'د.أ', 'en': 'JOD', 'fr': 'JOD' },  // Jordan
    'KZT': { 'ar': '₸', 'en': '₸', 'fr': '₸' },        // Kazakhstan
    'KWD': { 'ar': 'د.ك', 'en': 'KWD', 'fr': 'KWD' },  // Kuwait
    'KGS': { 'ar': 'с', 'en': 'с', 'fr': 'с' },        // Kyrgyzstan
    'LAK': { 'ar': '₭', 'en': '₭', 'fr': '₭' },        // Laos
    'LBP': { 'ar': 'ل.ل', 'en': 'LBP', 'fr': 'LBP' },  // Lebanon
    'MOP': { 'ar': 'MOP$', 'en': 'MOP$', 'fr': 'MOP$' }, // Macau
    'MYR': { 'ar': 'RM', 'en': 'RM', 'fr': 'RM' },     // Malaysia
    'MVR': { 'ar': 'Rf', 'en': 'Rf', 'fr': 'Rf' },     // Maldives
    'MNT': { 'ar': '₮', 'en': '₮', 'fr': '₮' },        // Mongolia
    'MMK': { 'ar': 'K', 'en': 'K', 'fr': 'K' },        // Myanmar
    'NPR': { 'ar': '₨', 'en': '₨', 'fr': '₨' },        // Nepal
    'KPW': { 'ar': '₩', 'en': '₩', 'fr': '₩' },        // North Korea
    'OMR': { 'ar': 'ر.ع', 'en': 'OMR', 'fr': 'OMR' },  // Oman
    'PKR': { 'ar': '₨', 'en': '₨', 'fr': '₨' },        // Pakistan
    'PHP': { 'ar': '₱', 'en': '₱', 'fr': '₱' },        // Philippines
    'QAR': { 'ar': 'ر.ق', 'en': 'QAR', 'fr': 'QAR' },  // Qatar
    'SAR': { 'ar': 'ر.س', 'en': 'SAR', 'fr': 'SAR' },  // Saudi Arabia
    'SGD': { 'ar': '$', 'en': '$', 'fr': '$' },        // Singapore
    'KRW': { 'ar': '₩', 'en': '₩', 'fr': '₩' },        // South Korea
    'LKR': { 'ar': '₨', 'en': '₨', 'fr': '₨' },        // Sri Lanka
    'SYP': { 'ar': 'ل.س', 'en': 'SYP', 'fr': 'SYP' },  // Syria
    'TWD': { 'ar': 'NT$', 'en': 'NT$', 'fr': 'NT$' },  // Taiwan
    'TJS': { 'ar': 'ЅМ', 'en': 'ЅМ', 'fr': 'ЅМ' },     // Tajikistan
    'THB': { 'ar': '฿', 'en': '฿', 'fr': '฿' },        // Thailand
    'TMT': { 'ar': 'm', 'en': 'm', 'fr': 'm' },        // Turkmenistan
    'AED': { 'ar': 'د.إ', 'en': 'AED', 'fr': 'AED' },  // UAE
    'UZS': { 'ar': 'so\'m', 'en': 'so\'m', 'fr': 'so\'m' }, // Uzbekistan
    'VND': { 'ar': '₫', 'en': '₫', 'fr': '₫' },        // Vietnam
    'YER': { 'ar': 'ر.ي', 'en': 'YER', 'fr': 'YER' },  // Yemen
    
    // Europe
    'ALL': { 'ar': 'L', 'en': 'L', 'fr': 'L' },        // Albania
    'EUR': { 'ar': '€', 'en': '€', 'fr': '€' },        // Euro
    'BAM': { 'ar': 'KM', 'en': 'KM', 'fr': 'KM' },     // Bosnia
    'BGN': { 'ar': 'лв', 'en': 'лв', 'fr': 'лв' },     // Bulgaria
    'HRK': { 'ar': 'kn', 'en': 'kn', 'fr': 'kn' },     // Croatia
    'CZK': { 'ar': 'Kč', 'en': 'Kč', 'fr': 'Kč' },     // Czech Republic
    'DKK': { 'ar': 'kr', 'en': 'kr', 'fr': 'kr' },     // Denmark
    'GBP': { 'ar': '£', 'en': '£', 'fr': '£' },        // United Kingdom
    'HUF': { 'ar': 'Ft', 'en': 'Ft', 'fr': 'Ft' },     // Hungary
    'ISK': { 'ar': 'kr', 'en': 'kr', 'fr': 'kr' },     // Iceland
    'CHF': { 'ar': 'Fr', 'en': 'Fr', 'fr': 'Fr' },     // Switzerland
    'MDL': { 'ar': 'L', 'en': 'L', 'fr': 'L' },        // Moldova
    'MKD': { 'ar': 'ден', 'en': 'ден', 'fr': 'ден' },  // North Macedonia
    'NOK': { 'ar': 'kr', 'en': 'kr', 'fr': 'kr' },     // Norway
    'PLN': { 'ar': 'zł', 'en': 'zł', 'fr': 'zł' },     // Poland
    'RON': { 'ar': 'lei', 'en': 'lei', 'fr': 'lei' },  // Romania
    'RUB': { 'ar': '₽', 'en': '₽', 'fr': '₽' },        // Russia
    'RSD': { 'ar': 'дин', 'en': 'дин', 'fr': 'дин' },  // Serbia
    'SEK': { 'ar': 'kr', 'en': 'kr', 'fr': 'kr' },     // Sweden
    'TRY': { 'ar': '₺', 'en': '₺', 'fr': '₺' },        // Turkey
    'UAH': { 'ar': '₴', 'en': '₴', 'fr': '₴' },        // Ukraine
    'GIP': { 'ar': '£', 'en': '£', 'fr': '£' },        // Gibraltar
    'BYN': { 'ar': 'Br', 'en': 'Br', 'fr': 'Br' },     // Belarus
    
    // Oceania
    'AUD': { 'ar': '$', 'en': '$', 'fr': '$' },        // Australia
    'FJD': { 'ar': '$', 'en': '$', 'fr': '$' },        // Fiji
    'NZD': { 'ar': '$', 'en': '$', 'fr': '$' },        // New Zealand
    'PGK': { 'ar': 'K', 'en': 'K', 'fr': 'K' },        // Papua New Guinea
    'WST': { 'ar': 'T', 'en': 'T', 'fr': 'T' },        // Samoa
    'SBD': { 'ar': '$', 'en': '$', 'fr': '$' },        // Solomon Islands
    'TOP': { 'ar': 'T$', 'en': 'T$', 'fr': 'T$' },     // Tonga
    'VUV': { 'ar': 'Vt', 'en': 'Vt', 'fr': 'Vt' },     // Vanuatu
    'XPF': { 'ar': '₣', 'en': '₣', 'fr': '₣' }         // CFP Franc
};

/**
 * Get currency symbol based on currency code and language
 * @param {string} currencyCode - Currency code (EGP, SAR, etc.)
 * @param {string} language - Language code (ar, en, fr)
 * @returns {string} Currency symbol
 */
export const getCurrencySymbol = (currencyCode, language = 'ar') => {
    return CURRENCY_SYMBOLS[currencyCode]?.[language] || currencyCode;
};
