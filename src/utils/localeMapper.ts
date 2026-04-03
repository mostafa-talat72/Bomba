/**
 * Map language codes to their corresponding locale identifiers
 * for use with Intl.DateTimeFormat and other locale-aware APIs
 */

/**
 * Convert language code to full locale identifier
 * @param langCode - ISO 639-1 language code (e.g., 'ar', 'en', 'zh')
 * @returns Full locale identifier (e.g., 'ar-EG', 'en-US', 'zh-CN')
 */
export const getLocaleFromLanguage = (langCode: string): string => {
  // Map of language codes to their most common locale
  const localeMap: Record<string, string> = {
    // Major languages
    ar: 'ar-SA',    // Arabic (Saudi Arabia)
    en: 'en-US',    // English (United States)
    fr: 'fr-FR',    // French (France)
    es: 'es-ES',    // Spanish (Spain)
    de: 'de-DE',    // German (Germany)
    it: 'it-IT',    // Italian (Italy)
    pt: 'pt-BR',    // Portuguese (Brazil)
    ru: 'ru-RU',    // Russian (Russia)
    zh: 'zh-CN',    // Chinese (Simplified, China)
    ja: 'ja-JP',    // Japanese (Japan)
    ko: 'ko-KR',    // Korean (South Korea)
    
    // Indian languages
    hi: 'hi-IN',    // Hindi (India)
    bn: 'bn-IN',    // Bengali (India)
    pa: 'pa-IN',    // Punjabi (India)
    te: 'te-IN',    // Telugu (India)
    mr: 'mr-IN',    // Marathi (India)
    ta: 'ta-IN',    // Tamil (India)
    ur: 'ur-PK',    // Urdu (Pakistan)
    gu: 'gu-IN',    // Gujarati (India)
    kn: 'kn-IN',    // Kannada (India)
    ml: 'ml-IN',    // Malayalam (India)
    
    // European languages
    tr: 'tr-TR',    // Turkish (Turkey)
    vi: 'vi-VN',    // Vietnamese (Vietnam)
    th: 'th-TH',    // Thai (Thailand)
    pl: 'pl-PL',    // Polish (Poland)
    nl: 'nl-NL',    // Dutch (Netherlands)
    el: 'el-GR',    // Greek (Greece)
    cs: 'cs-CZ',    // Czech (Czech Republic)
    sv: 'sv-SE',    // Swedish (Sweden)
    ro: 'ro-RO',    // Romanian (Romania)
    hu: 'hu-HU',    // Hungarian (Hungary)
    da: 'da-DK',    // Danish (Denmark)
    fi: 'fi-FI',    // Finnish (Finland)
    no: 'no-NO',    // Norwegian (Norway)
    sk: 'sk-SK',    // Slovak (Slovakia)
    bg: 'bg-BG',    // Bulgarian (Bulgaria)
    hr: 'hr-HR',    // Croatian (Croatia)
    sr: 'sr-RS',    // Serbian (Serbia)
    uk: 'uk-UA',    // Ukrainian (Ukraine)
    he: 'he-IL',    // Hebrew (Israel)
    
    // Southeast Asian languages
    id: 'id-ID',    // Indonesian (Indonesia)
    ms: 'ms-MY',    // Malay (Malaysia)
    fa: 'fa-IR',    // Persian (Iran)
    sw: 'sw-KE',    // Swahili (Kenya)
    
    // African languages
    af: 'af-ZA',    // Afrikaans (South Africa)
    am: 'am-ET',    // Amharic (Ethiopia)
    ha: 'ha-NG',    // Hausa (Nigeria)
    ig: 'ig-NG',    // Igbo (Nigeria)
    yo: 'yo-NG',    // Yoruba (Nigeria)
    zu: 'zu-ZA',    // Zulu (South Africa)
    xh: 'xh-ZA',    // Xhosa (South Africa)
    
    // Other languages
    sq: 'sq-AL',    // Albanian (Albania)
    hy: 'hy-AM',    // Armenian (Armenia)
    az: 'az-AZ',    // Azerbaijani (Azerbaijan)
    eu: 'eu-ES',    // Basque (Spain)
    be: 'be-BY',    // Belarusian (Belarus)
    bs: 'bs-BA',    // Bosnian (Bosnia)
    ca: 'ca-ES',    // Catalan (Spain)
    et: 'et-EE',    // Estonian (Estonia)
    tl: 'fil-PH',   // Filipino (Philippines)
    gl: 'gl-ES',    // Galician (Spain)
    ka: 'ka-GE',    // Georgian (Georgia)
    is: 'is-IS',    // Icelandic (Iceland)
    ga: 'ga-IE',    // Irish (Ireland)
    kk: 'kk-KZ',    // Kazakh (Kazakhstan)
    km: 'km-KH',    // Khmer (Cambodia)
    ku: 'ku-TR',    // Kurdish (Turkey)
    ky: 'ky-KG',    // Kyrgyz (Kyrgyzstan)
    lo: 'lo-LA',    // Lao (Laos)
    lv: 'lv-LV',    // Latvian (Latvia)
    lt: 'lt-LT',    // Lithuanian (Lithuania)
    mk: 'mk-MK',    // Macedonian (North Macedonia)
    mg: 'mg-MG',    // Malagasy (Madagascar)
    mt: 'mt-MT',    // Maltese (Malta)
    mi: 'mi-NZ',    // Maori (New Zealand)
    mn: 'mn-MN',    // Mongolian (Mongolia)
    my: 'my-MM',    // Myanmar (Myanmar)
    ne: 'ne-NP',    // Nepali (Nepal)
    ps: 'ps-AF',    // Pashto (Afghanistan)
    si: 'si-LK',    // Sinhala (Sri Lanka)
    sl: 'sl-SI',    // Slovenian (Slovenia)
    so: 'so-SO',    // Somali (Somalia)
    su: 'su-ID',    // Sundanese (Indonesia)
    tg: 'tg-TJ',    // Tajik (Tajikistan)
    tk: 'tk-TM',    // Turkmen (Turkmenistan)
    uz: 'uz-UZ',    // Uzbek (Uzbekistan)
    cy: 'cy-GB',    // Welsh (United Kingdom)
    yi: 'yi-001',   // Yiddish
    
    // Less common languages (fallback to language code)
    as: 'as-IN',    // Assamese
    ay: 'ay-BO',    // Aymara
    bm: 'bm-ML',    // Bambara
    ceb: 'ceb-PH',  // Cebuano
    co: 'co-FR',    // Corsican
    dv: 'dv-MV',    // Dhivehi
    ee: 'ee-GH',    // Ewe
    eo: 'eo-001',   // Esperanto
    fy: 'fy-NL',    // Frisian
    gd: 'gd-GB',    // Scottish Gaelic
    gn: 'gn-PY',    // Guarani
    haw: 'haw-US',  // Hawaiian
    ht: 'ht-HT',    // Haitian Creole
    ik: 'ik-US',    // Inupiaq
    iu: 'iu-CA',    // Inuktitut
    jv: 'jv-ID',    // Javanese
    kl: 'kl-GL',    // Greenlandic
    kr: 'kr-NG',    // Kanuri
    kri: 'kri-SL',  // Krio
    ks: 'ks-IN',    // Kashmiri
    la: 'la-VA',    // Latin
    lb: 'lb-LU',    // Luxembourgish
    lg: 'lg-UG',    // Luganda
    ln: 'ln-CD',    // Lingala
    lu: 'lu-CD',    // Luba-Katanga
    mh: 'mh-MH',    // Marshallese
    nd: 'nd-ZW',    // North Ndebele
    ng: 'ng-NA',    // Ndonga
    nr: 'nr-ZA',    // South Ndebele
    nv: 'nv-US',    // Navajo
    ny: 'ny-MW',    // Chichewa
    oc: 'oc-FR',    // Occitan
    om: 'om-ET',    // Oromo
    or: 'or-IN',    // Odia
    os: 'os-GE',    // Ossetian
    pi: 'pi-IN',    // Pali
    qu: 'qu-PE',    // Quechua
    rm: 'rm-CH',    // Romansh
    rw: 'rw-RW',    // Kinyarwanda
    sa: 'sa-IN',    // Sanskrit
    sd: 'sd-PK',    // Sindhi
    sg: 'sg-CF',    // Sango
    sm: 'sm-WS',    // Samoan
    sn: 'sn-ZW',    // Shona
    ss: 'ss-ZA',    // Swati
    st: 'st-ZA',    // Sesotho
    ti: 'ti-ET',    // Tigrinya
    tn: 'tn-ZA',    // Tswana
    to: 'to-TO',    // Tonga
    ts: 'ts-ZA',    // Tsonga
    tt: 'tt-RU',    // Tatar
    tw: 'tw-GH',    // Twi
    ty: 'ty-PF',    // Tahitian
    ug: 'ug-CN',    // Uyghur
    ve: 've-ZA',    // Venda
    wa: 'wa-BE',    // Walloon
    wo: 'wo-SN',    // Wolof
    za: 'za-CN',    // Zhuang
  };

  // Return mapped locale or fallback to language code with generic region
  return localeMap[langCode] || `${langCode}-${langCode.toUpperCase()}`;
};

/**
 * Get current locale based on i18next language
 * @returns Current locale identifier
 */
export const getCurrentLocale = (): string => {
  const currentLang = localStorage.getItem('i18nextLng') || 
                      localStorage.getItem('language') || 
                      'en';
  return getLocaleFromLanguage(currentLang);
};
