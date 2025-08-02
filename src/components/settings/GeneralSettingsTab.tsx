import React, { useState, useEffect } from "react";
import { TabProps, GeneralSettings } from "../../types/settings";

const GeneralSettingsTab: React.FC<TabProps> = ({
  settings,
  onSave,
    canEdit,
    loading,
    saving,
    error,
    success,
}) => {
    // الحقول المحمية التي تحتاج صلاحيات خاصة
    const protectedFields = ["systemName", "language", "timezone", "currency"];

    // دالة للتحقق من صلاحيات تعديل حقل محدد
    const canEditField = (field: string): boolean => {
        // يمكن إضافة منطق أكثر تعقيداً هنا للتحقق من صلاحيات المستخدم
        // حالياً نستخدم canEdit العام
        return canEdit;
    };
    const [localSettings, setLocalSettings] = useState<GeneralSettings>(settings as GeneralSettings);

    // Update local settings when props change
    useEffect(() => {
        if (settings) {
            console.log("GeneralSettingsTab received settings:", settings);
            setLocalSettings(settings as GeneralSettings);
        }
    }, [settings]);
    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

    const handleInputChange = (field: keyof GeneralSettings, value: string) => {
        setLocalSettings(prev => ({ ...prev, [field]: value }));

        // Clear validation error for this field
        if (validationErrors[field]) {
            setValidationErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[field];
                return newErrors;
            });
        }
    };

    const validateSettings = (): boolean => {
        const errors: Record<string, string> = {};

        if (!localSettings.systemName || localSettings.systemName.length < 2) {
            errors.systemName = "اسم النظام يجب أن يكون أكثر من حرفين";
        }

        if (!localSettings.language) {
            errors.language = "اللغة مطلوبة";
        }

        if (!localSettings.timezone) {
            errors.timezone = "المنطقة الزمنية مطلوبة";
        }

        if (!localSettings.currency) {
            errors.currency = "العملة مطلوبة";
        }

        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSave = async () => {
        if (!canEdit) return;

        if (!validateSettings()) {
            return;
        }

        onSave(localSettings);
    };

    if (!canEdit) {
  return (
            <div className="text-center py-8">
                <div className="text-red-500 text-lg mb-2">🚫</div>
                <p className="text-gray-600">ليس لديك صلاحية لتعديل هذه الإعدادات</p>
        </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="border-b border-gray-200 pb-4">
                <h3 className="text-lg font-medium text-gray-900">الإعدادات العامة</h3>
                <p className="text-sm text-gray-600 mt-1">
                    إعدادات النظام الأساسية مثل الاسم واللغة والعملة
                </p>
            </div>



            {/* Error/Success Messages */}
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                    {error}
                </div>
            )}
            {success && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
                    {success}
            </div>
          )}

            {/* Settings Form */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* System Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                        اسم النظام
                        {!canEditField("systemName") && (
                            <span className="text-red-500 text-xs mr-2">(محظور)</span>
                        )}
                </label>
                <input
                  type="text"
                        value={localSettings.systemName}
                        onChange={(e) => handleInputChange("systemName", e.target.value)}
                        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                            validationErrors.systemName ? "border-red-500" : "border-gray-300"
                        } ${!canEditField("systemName") ? "bg-gray-100 cursor-not-allowed" : ""}`}
                        disabled={loading || saving || !canEditField("systemName")}
                    />
                    {validationErrors.systemName && (
                        <p className="text-red-500 text-sm mt-1">{validationErrors.systemName}</p>
                    )}
                    {!canEditField("systemName") && (
                        <p className="text-orange-500 text-sm mt-1">لا يمكن تعديل اسم النظام - صلاحيات غير كافية</p>
                    )}
              </div>

                {/* Language */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                        اللغة
                        {!canEditField("language") && (
                            <span className="text-red-500 text-xs mr-2">(محظور)</span>
                        )}
                </label>
                <select
                        value={localSettings.language}
                        onChange={(e) => handleInputChange("language", e.target.value)}
                        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                            validationErrors.language ? "border-red-500" : "border-gray-300"
                        } ${!canEditField("language") ? "bg-gray-100 cursor-not-allowed" : ""}`}
                        disabled={loading || saving || !canEditField("language")}
                    >
                        <option value="ar">العربية</option>
                        <option value="en">English</option>
                        <option value="fr">Français</option>
                        <option value="es">Español</option>
                        <option value="de">Deutsch</option>
                        <option value="it">Italiano</option>
                        <option value="pt">Português</option>
                        <option value="ru">Русский</option>
                        <option value="zh">中文</option>
                        <option value="ja">日本語</option>
                        <option value="ko">한국어</option>
                        <option value="hi">हिन्दी</option>
                        <option value="bn">বাংলা</option>
                        <option value="ur">اردو</option>
                        <option value="fa">فارسی</option>
                        <option value="tr">Türkçe</option>
                        <option value="nl">Nederlands</option>
                        <option value="sv">Svenska</option>
                        <option value="no">Norsk</option>
                        <option value="da">Dansk</option>
                        <option value="fi">Suomi</option>
                        <option value="pl">Polski</option>
                        <option value="cs">Čeština</option>
                        <option value="hu">Magyar</option>
                        <option value="ro">Română</option>
                        <option value="bg">Български</option>
                        <option value="hr">Hrvatski</option>
                        <option value="sr">Српски</option>
                        <option value="sl">Slovenščina</option>
                        <option value="sk">Slovenčina</option>
                        <option value="et">Eesti</option>
                        <option value="lv">Latviešu</option>
                        <option value="lt">Lietuvių</option>
                        <option value="el">Ελληνικά</option>
                        <option value="he">עברית</option>
                        <option value="th">ไทย</option>
                        <option value="vi">Tiếng Việt</option>
                        <option value="id">Bahasa Indonesia</option>
                        <option value="ms">Bahasa Melayu</option>
                        <option value="tl">Tagalog</option>
                        <option value="ta">தமிழ்</option>
                        <option value="te">తెలుగు</option>
                        <option value="kn">ಕನ್ನಡ</option>
                        <option value="ml">മലയാളം</option>
                        <option value="gu">ગુજરાતી</option>
                        <option value="pa">ਪੰਜਾਬੀ</option>
                        <option value="mr">मराठी</option>
                        <option value="or">ଓଡ଼ିଆ</option>
                        <option value="as">অসমীয়া</option>
                        <option value="ne">नेपाली</option>
                        <option value="si">සිංහල</option>
                        <option value="my">မြန်မာ</option>
                        <option value="km">ខ្មែរ</option>
                        <option value="lo">ລາວ</option>
                        <option value="mn">Монгол</option>
                        <option value="ka">ქართული</option>
                        <option value="hy">Հայերեն</option>
                        <option value="az">Azərbaycan</option>
                        <option value="uz">O'zbek</option>
                        <option value="kk">Қазақ</option>
                        <option value="ky">Кыргызча</option>
                        <option value="tg">Тоҷикӣ</option>
                        <option value="tk">Türkmen</option>
                        <option value="ps">پښتو</option>
                        <option value="sd">سنڌي</option>
                        <option value="dv">ދިވެހި</option>
                        <option value="am">አማርኛ</option>
                        <option value="sw">Kiswahili</option>
                        <option value="yo">Yorùbá</option>
                        <option value="ig">Igbo</option>
                        <option value="ha">Hausa</option>
                        <option value="zu">isiZulu</option>
                        <option value="xh">isiXhosa</option>
                        <option value="af">Afrikaans</option>
                        <option value="st">Sesotho</option>
                        <option value="tn">Setswana</option>
                        <option value="ts">Xitsonga</option>
                        <option value="ve">Tshivenda</option>
                        <option value="ss">siSwati</option>
                        <option value="nr">isiNdebele</option>
                        <option value="rw">Kinyarwanda</option>
                        <option value="lg">Luganda</option>
                        <option value="ak">Akan</option>
                        <option value="tw">Twi</option>
                        <option value="ff">Fulfulde</option>
                        <option value="wo">Wolof</option>
                        <option value="sn">chiShona</option>
                        <option value="ny">Chichewa</option>
                        <option value="so">Soomaali</option>
                        <option value="om">Afaan Oromoo</option>
                        <option value="ti">ትግርኛ</option>
                        <option value="be">Беларуская</option>
                        <option value="mk">Македонски</option>
                        <option value="sq">Shqip</option>
                        <option value="bs">Bosanski</option>
                        <option value="me">Crnogorski</option>
                        <option value="mt">Malti</option>
                        <option value="cy">Cymraeg</option>
                        <option value="ga">Gaeilge</option>
                        <option value="is">Íslenska</option>
                        <option value="fo">Føroyskt</option>
                        <option value="gl">Galego</option>
                        <option value="eu">Euskara</option>
                        <option value="ca">Català</option>
                        <option value="oc">Occitan</option>
                        <option value="br">Brezhoneg</option>
                        <option value="co">Corsu</option>
                        <option value="fur">Furlan</option>
                        <option value="rm">Rumantsch</option>
                        <option value="lb">Lëtzebuergesch</option>
                        <option value="fy">Frysk</option>
                        <option value="gsw">Schwiizertüütsch</option>
                        <option value="rm">Rumantsch</option>
                        <option value="fur">Furlan</option>
                        <option value="co">Corsu</option>
                        <option value="br">Brezhoneg</option>
                        <option value="oc">Occitan</option>
                        <option value="ca">Català</option>
                        <option value="eu">Euskara</option>
                        <option value="gl">Galego</option>
                        <option value="fo">Føroyskt</option>
                        <option value="is">Íslenska</option>
                        <option value="ga">Gaeilge</option>
                        <option value="cy">Cymraeg</option>
                        <option value="mt">Malti</option>
                        <option value="me">Crnogorski</option>
                        <option value="bs">Bosanski</option>
                        <option value="sq">Shqip</option>
                        <option value="mk">Македонски</option>
                        <option value="be">Беларуская</option>
                        <option value="ti">ትግርኛ</option>
                        <option value="om">Afaan Oromoo</option>
                        <option value="so">Soomaali</option>
                        <option value="ny">Chichewa</option>
                        <option value="sn">chiShona</option>
                        <option value="wo">Wolof</option>
                        <option value="ff">Fulfulde</option>
                        <option value="tw">Twi</option>
                        <option value="ak">Akan</option>
                        <option value="lg">Luganda</option>
                        <option value="rw">Kinyarwanda</option>
                        <option value="nr">isiNdebele</option>
                        <option value="ss">siSwati</option>
                        <option value="ve">Tshivenda</option>
                        <option value="ts">Xitsonga</option>
                        <option value="tn">Setswana</option>
                        <option value="st">Sesotho</option>
                        <option value="af">Afrikaans</option>
                        <option value="xh">isiXhosa</option>
                        <option value="zu">isiZulu</option>
                        <option value="ha">Hausa</option>
                        <option value="ig">Igbo</option>
                        <option value="yo">Yorùbá</option>
                        <option value="sw">Kiswahili</option>
                        <option value="am">አማርኛ</option>
                        <option value="dv">ދިވެހި</option>
                        <option value="sd">سنڌي</option>
                        <option value="ps">پښتو</option>
                        <option value="tk">Türkmen</option>
                        <option value="tg">Тоҷикӣ</option>
                        <option value="ky">Кыргызча</option>
                        <option value="kk">Қазақ</option>
                        <option value="uz">O'zbek</option>
                        <option value="az">Azərbaycan</option>
                        <option value="hy">Հայերեն</option>
                        <option value="ka">ქართული</option>
                        <option value="mn">Монгол</option>
                        <option value="lo">ລາວ</option>
                        <option value="km">ខ្មែរ</option>
                        <option value="my">မြန်မာ</option>
                        <option value="si">සිංහල</option>
                        <option value="ne">नेपाली</option>
                        <option value="as">অসমীয়া</option>
                        <option value="or">ଓଡ଼ିଆ</option>
                        <option value="mr">मराठी</option>
                        <option value="pa">ਪੰਜਾਬੀ</option>
                        <option value="gu">ગુજરાતી</option>
                        <option value="ml">മലയാളം</option>
                        <option value="kn">ಕನ್ನಡ</option>
                        <option value="te">తెలుగు</option>
                        <option value="ta">தமிழ்</option>
                        <option value="tl">Tagalog</option>
                        <option value="ms">Bahasa Melayu</option>
                        <option value="id">Bahasa Indonesia</option>
                        <option value="vi">Tiếng Việt</option>
                        <option value="th">ไทย</option>
                        <option value="he">עברית</option>
                        <option value="el">Ελληνικά</option>
                        <option value="lt">Lietuvių</option>
                        <option value="lv">Latviešu</option>
                        <option value="et">Eesti</option>
                        <option value="sk">Slovenčina</option>
                        <option value="sl">Slovenščina</option>
                        <option value="sr">Српски</option>
                        <option value="hr">Hrvatski</option>
                        <option value="bg">Български</option>
                        <option value="ro">Română</option>
                        <option value="hu">Magyar</option>
                        <option value="cs">Čeština</option>
                        <option value="pl">Polski</option>
                        <option value="fi">Suomi</option>
                        <option value="da">Dansk</option>
                        <option value="no">Norsk</option>
                        <option value="sv">Svenska</option>
                        <option value="nl">Nederlands</option>
                        <option value="tr">Türkçe</option>
                        <option value="fa">فارسی</option>
                        <option value="ur">اردو</option>
                        <option value="bn">বাংলা</option>
                        <option value="hi">हिन्दी</option>
                        <option value="ko">한국어</option>
                        <option value="ja">日本語</option>
                        <option value="zh">中文</option>
                        <option value="ru">Русский</option>
                        <option value="pt">Português</option>
                        <option value="it">Italiano</option>
                        <option value="de">Deutsch</option>
                        <option value="es">Español</option>
                        <option value="fr">Français</option>
                </select>
                    {validationErrors.language && (
                        <p className="text-red-500 text-sm mt-1">{validationErrors.language}</p>
                    )}
                    {!canEditField("language") && (
                        <p className="text-orange-500 text-sm mt-1">لا يمكن تعديل اللغة - صلاحيات غير كافية</p>
                    )}
          </div>

                {/* Timezone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  المنطقة الزمنية
                  {!canEditField("timezone") && (
                      <span className="text-red-500 text-xs mr-2">(محظور)</span>
                  )}
                </label>
                <select
                        value={localSettings.timezone}
                        onChange={(e) => handleInputChange("timezone", e.target.value)}
                        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                            validationErrors.timezone ? "border-red-500" : "border-gray-300"
                        } ${!canEditField("timezone") ? "bg-gray-100 cursor-not-allowed" : ""}`}
                        disabled={loading || saving || !canEditField("timezone")}
                    >
                  <option value="Asia/Riyadh">الرياض (GMT+3)</option>
                  <option value="Asia/Dubai">دبي (GMT+4)</option>
                  <option value="Asia/Kuwait">الكويت (GMT+3)</option>
                  <option value="Asia/Qatar">قطر (GMT+3)</option>
                  <option value="Asia/Bahrain">البحرين (GMT+3)</option>
                  <option value="Asia/Oman">عمان (GMT+4)</option>
                  <option value="Asia/Jerusalem">القدس (GMT+2/+3)</option>
                  <option value="Asia/Tehran">طهران (GMT+3:30)</option>
                  <option value="Asia/Baghdad">بغداد (GMT+3)</option>
                  <option value="Asia/Amman">عمان (GMT+2/+3)</option>
                  <option value="Asia/Beirut">بيروت (GMT+2/+3)</option>
                  <option value="Asia/Damascus">دمشق (GMT+2/+3)</option>
                  <option value="Asia/Cairo">القاهرة (GMT+2/+3)</option>
                  <option value="Asia/Khartoum">الخرطوم (GMT+2/+3)</option>
                  <option value="Asia/Tripoli">طرابلس (GMT+1/+2)</option>
                  <option value="Africa/Casablanca">الدار البيضاء (GMT+0/+1)</option>
                  <option value="Europe/London">لندن (GMT+0/+1)</option>
                  <option value="Europe/Paris">باريس (GMT+1/+2)</option>
                  <option value="Europe/Berlin">برلين (GMT+1/+2)</option>
                  <option value="Europe/Rome">روما (GMT+1/+2)</option>
                  <option value="Europe/Madrid">مدريد (GMT+1/+2)</option>
                  <option value="Europe/Amsterdam">أمستردام (GMT+1/+2)</option>
                  <option value="Europe/Brussels">بروكسل (GMT+1/+2)</option>
                  <option value="Europe/Vienna">فيينا (GMT+1/+2)</option>
                  <option value="Europe/Zurich">زيورخ (GMT+1/+2)</option>
                  <option value="Europe/Stockholm">ستوكهولم (GMT+1/+2)</option>
                  <option value="Europe/Oslo">أوسلو (GMT+1/+2)</option>
                  <option value="Europe/Copenhagen">كوبنهاغن (GMT+1/+2)</option>
                  <option value="Europe/Helsinki">هلسنكي (GMT+2/+3)</option>
                  <option value="Europe/Warsaw">وارسو (GMT+1/+2)</option>
                  <option value="Europe/Prague">براغ (GMT+1/+2)</option>
                  <option value="Europe/Budapest">بودابست (GMT+1/+2)</option>
                  <option value="Europe/Bucharest">بوخارست (GMT+2/+3)</option>
                  <option value="Europe/Sofia">صوفيا (GMT+2/+3)</option>
                  <option value="Europe/Athens">أثينا (GMT+2/+3)</option>
                  <option value="Europe/Istanbul">إسطنبول (GMT+3)</option>
                  <option value="Europe/Moscow">موسكو (GMT+3)</option>
                  <option value="Europe/Kiev">كييف (GMT+2/+3)</option>
                  <option value="Europe/Minsk">مينسك (GMT+3)</option>
                  <option value="Europe/Riga">ريغا (GMT+2/+3)</option>
                  <option value="Europe/Tallinn">تالين (GMT+2/+3)</option>
                  <option value="Europe/Vilnius">فيلنيوس (GMT+2/+3)</option>
                  <option value="America/New_York">نيويورك (GMT-5/-4)</option>
                  <option value="America/Chicago">شيكاغو (GMT-6/-5)</option>
                  <option value="America/Denver">دنفر (GMT-7/-6)</option>
                  <option value="America/Los_Angeles">لوس أنجلوس (GMT-8/-7)</option>
                  <option value="America/Phoenix">فينيكس (GMT-7)</option>
                  <option value="America/Anchorage">أنكوراج (GMT-9/-8)</option>
                  <option value="America/Adak">أداك (GMT-10/-9)</option>
                  <option value="Pacific/Honolulu">هونولولو (GMT-10)</option>
                  <option value="America/Toronto">تورنتو (GMT-5/-4)</option>
                  <option value="America/Vancouver">فانكوفر (GMT-8/-7)</option>
                  <option value="America/Edmonton">إدمونتون (GMT-7/-6)</option>
                  <option value="America/Winnipeg">وينيبيغ (GMT-6/-5)</option>
                  <option value="America/Halifax">هاليفاكس (GMT-4/-3)</option>
                  <option value="America/St_Johns">سانت جون (GMT-3:30/-2:30)</option>
                  <option value="America/Mexico_City">مكسيكو سيتي (GMT-6/-5)</option>
                  <option value="America/Guadalajara">غوادالاخارا (GMT-6/-5)</option>
                  <option value="America/Monterrey">مونتيري (GMT-6/-5)</option>
                  <option value="America/Tijuana">تيخوانا (GMT-8/-7)</option>
                  <option value="America/Sao_Paulo">ساو باولو (GMT-3/-2)</option>
                  <option value="America/Rio_de_Janeiro">ريو دي جانيرو (GMT-3/-2)</option>
                  <option value="America/Buenos_Aires">بوينس آيرس (GMT-3)</option>
                  <option value="America/Santiago">سانتياغو (GMT-3/-4)</option>
                  <option value="America/Lima">ليما (GMT-5)</option>
                  <option value="America/Bogota">بوغوتا (GMT-5)</option>
                  <option value="America/Caracas">كراكاس (GMT-4)</option>
                  <option value="America/La_Paz">لاباز (GMT-4)</option>
                  <option value="America/Asuncion">أسونسيون (GMT-3/-4)</option>
                  <option value="America/Montevideo">مونتيفيديو (GMT-3)</option>
                  <option value="America/Havana">هافانا (GMT-5/-4)</option>
                  <option value="America/Santo_Domingo">سانتو دومينغو (GMT-4)</option>
                  <option value="America/Puerto_Rico">بورتوريكو (GMT-4)</option>
                  <option value="America/Port-au-Prince">بورت أو برنس (GMT-5/-4)</option>
                  <option value="America/Kingston">كينغستون (GMT-5)</option>
                  <option value="America/Nassau">ناساو (GMT-5/-4)</option>
                  <option value="America/Barbados">بربادوس (GMT-4)</option>
                  <option value="America/Trinidad">ترينيداد (GMT-4)</option>
                  <option value="America/Guyana">غيانا (GMT-4)</option>
                  <option value="America/Suriname">سورينام (GMT-3)</option>
                  <option value="America/French_Guiana">غيانا الفرنسية (GMT-3)</option>
                  <option value="Asia/Tokyo">طوكيو (GMT+9)</option>
                  <option value="Asia/Seoul">سيول (GMT+9)</option>
                  <option value="Asia/Shanghai">شنغهاي (GMT+8)</option>
                  <option value="Asia/Beijing">بكين (GMT+8)</option>
                  <option value="Asia/Hong_Kong">هونغ كونغ (GMT+8)</option>
                  <option value="Asia/Singapore">سنغافورة (GMT+8)</option>
                  <option value="Asia/Kuala_Lumpur">كوالالمبور (GMT+8)</option>
                  <option value="Asia/Bangkok">بانكوك (GMT+7)</option>
                  <option value="Asia/Ho_Chi_Minh">هو تشي مينه (GMT+7)</option>
                  <option value="Asia/Phnom_Penh">بنوم بنه (GMT+7)</option>
                  <option value="Asia/Vientiane">فيينتيان (GMT+7)</option>
                  <option value="Asia/Yangon">يانغون (GMT+6:30)</option>
                  <option value="Asia/Dhaka">داكا (GMT+6)</option>
                  <option value="Asia/Kolkata">كولكاتا (GMT+5:30)</option>
                  <option value="Asia/Kathmandu">كاتماندو (GMT+5:45)</option>
                  <option value="Asia/Colombo">كولومبو (GMT+5:30)</option>
                  <option value="Asia/Karachi">كراتشي (GMT+5)</option>
                  <option value="Asia/Tashkent">طشقند (GMT+5)</option>
                  <option value="Asia/Almaty">ألماتي (GMT+6)</option>
                  <option value="Asia/Bishkek">بيشكيك (GMT+6)</option>
                  <option value="Asia/Dushanbe">دوشانبه (GMT+5)</option>
                  <option value="Asia/Ashgabat">عشق آباد (GMT+5)</option>
                  <option value="Asia/Samarkand">سمرقند (GMT+5)</option>
                  <option value="Asia/Tashkent">طشقند (GMT+5)</option>
                  <option value="Asia/Aqtau">آقتاو (GMT+5)</option>
                  <option value="Asia/Aqtobe">آقتوبي (GMT+5)</option>
                  <option value="Asia/Oral">أورال (GMT+5)</option>
                  <option value="Asia/Atyrau">أتيراو (GMT+5)</option>
                  <option value="Asia/Qyzylorda">قزيلوردا (GMT+6)</option>
                  <option value="Asia/Almaty">ألماتي (GMT+6)</option>
                  <option value="Asia/Vladivostok">فلاديفوستوك (GMT+10/+11)</option>
                  <option value="Asia/Magadan">ماغادان (GMT+11/+12)</option>
                  <option value="Asia/Kamchatka">كامتشاتكا (GMT+12)</option>
                  <option value="Asia/Anadyr">أنادير (GMT+12)</option>
                  <option value="Asia/Srednekolymsk">سريدنيكوليمسك (GMT+11)</option>
                  <option value="Asia/Ust-Nera">أوست-نيرا (GMT+10/+11)</option>
                  <option value="Asia/Chita">تشيتا (GMT+9)</option>
                  <option value="Asia/Yakutsk">ياكوتسك (GMT+9/+10)</option>
                  <option value="Asia/Khandyga">خانديجا (GMT+9)</option>
                  <option value="Asia/Vladivostok">فلاديفوستوك (GMT+10/+11)</option>
                  <option value="Asia/Ust-Nera">أوست-نيرا (GMT+10/+11)</option>
                  <option value="Asia/Magadan">ماغادان (GMT+11/+12)</option>
                  <option value="Asia/Srednekolymsk">سريدنيكوليمسك (GMT+11)</option>
                  <option value="Asia/Kamchatka">كامتشاتكا (GMT+12)</option>
                  <option value="Asia/Anadyr">أنادير (GMT+12)</option>
                  <option value="Australia/Sydney">سيدني (GMT+10/+11)</option>
                  <option value="Australia/Melbourne">ملبورن (GMT+10/+11)</option>
                  <option value="Australia/Brisbane">بريزبن (GMT+10)</option>
                  <option value="Australia/Adelaide">أديلايد (GMT+9:30/+10:30)</option>
                  <option value="Australia/Perth">بيرث (GMT+8)</option>
                  <option value="Australia/Darwin">داروين (GMT+9:30)</option>
                  <option value="Australia/Hobart">هوبارت (GMT+10/+11)</option>
                  <option value="Australia/Currie">كوري (GMT+10/+11)</option>
                  <option value="Australia/Lord_Howe">لورد هاو (GMT+10:30/+11)</option>
                  <option value="Australia/Eucla">يوكلا (GMT+8:45/+9:45)</option>
                  <option value="Australia/Lindeman">ليندمان (GMT+10)</option>
                  <option value="Australia/Broken_Hill">بروكين هيل (GMT+9:30/+10:30)</option>
                  <option value="Australia/Canberra">كانبرا (GMT+10/+11)</option>
                  <option value="Australia/ACT">ACT (GMT+10/+11)</option>
                  <option value="Australia/NSW">NSW (GMT+10/+11)</option>
                  <option value="Australia/North">شمال أستراليا (GMT+9:30)</option>
                  <option value="Australia/South">جنوب أستراليا (GMT+9:30/+10:30)</option>
                  <option value="Australia/Tasmania">تسمانيا (GMT+10/+11)</option>
                  <option value="Australia/Victoria">فيكتوريا (GMT+10/+11)</option>
                  <option value="Australia/West">غرب أستراليا (GMT+8)</option>
                  <option value="Pacific/Auckland">أوكلاند (GMT+12/+13)</option>
                  <option value="Pacific/Fiji">فيجي (GMT+12)</option>
                  <option value="Pacific/Guam">غوام (GMT+10)</option>
                  <option value="Pacific/Saipan">سايبان (GMT+10)</option>
                  <option value="Pacific/Chuuk">تشوك (GMT+10)</option>
                  <option value="Pacific/Pohnpei">بونبي (GMT+11)</option>
                  <option value="Pacific/Kosrae">كوسراي (GMT+11)</option>
                  <option value="Pacific/Kwajalein">كواجالين (GMT+12)</option>
                  <option value="Pacific/Majuro">ماجورو (GMT+12)</option>
                  <option value="Pacific/Tarawa">تاراوا (GMT+12)</option>
                  <option value="Pacific/Enderbury">إندربراي (GMT+13)</option>
                  <option value="Pacific/Kiritimati">كيريتيماتي (GMT+14)</option>
                  <option value="Pacific/Apia">أبيا (GMT+13/+14)</option>
                  <option value="Pacific/Fakaofo">فاكاوفو (GMT+13)</option>
                  <option value="Pacific/Tongatapu">تونجاتابو (GMT+13)</option>
                  <option value="Pacific/Chatham">تشاتام (GMT+12:45/+13:45)</option>
                  <option value="Pacific/Easter">جزيرة الفصح (GMT-6/-5)</option>
                  <option value="Pacific/Galapagos">غالاباغوس (GMT-6)</option>
                  <option value="Pacific/Pitcairn">بيتكيرن (GMT-8)</option>
                  <option value="Pacific/Marquesas">ماركيساس (GMT-9:30)</option>
                  <option value="Pacific/Gambier">غامبير (GMT-9)</option>
                  <option value="Pacific/Tahiti">تاهيتي (GMT-10)</option>
                  <option value="Pacific/Rarotonga">راروتونغا (GMT-10)</option>
                  <option value="Pacific/Niue">نيوي (GMT-11)</option>
                  <option value="Pacific/Norfolk">نورفولك (GMT+11/+12)</option>
                  <option value="Pacific/Palau">بالاو (GMT+9)</option>
                  <option value="Pacific/Wallis">واليس (GMT+12)</option>
                  <option value="Pacific/Funafuti">فونافوتي (GMT+12)</option>
                  <option value="Pacific/Wake">ويك (GMT+12)</option>
                  <option value="Pacific/Midway">ميدواي (GMT-11)</option>
                  <option value="Pacific/Johnston">جونستون (GMT-10)</option>
                  <option value="Pacific/Pago_Pago">باغو باغو (GMT-11)</option>
                  <option value="Pacific/Niue">نيوي (GMT-11)</option>
                  <option value="Pacific/Rarotonga">راروتونغا (GMT-10)</option>
                  <option value="Pacific/Tahiti">تاهيتي (GMT-10)</option>
                  <option value="Pacific/Gambier">غامبير (GMT-9)</option>
                  <option value="Pacific/Marquesas">ماركيساس (GMT-9:30)</option>
                  <option value="Pacific/Pitcairn">بيتكيرن (GMT-8)</option>
                  <option value="Pacific/Galapagos">غالاباغوس (GMT-6)</option>
                  <option value="Pacific/Easter">جزيرة الفصح (GMT-6/-5)</option>
                  <option value="Pacific/Chatham">تشاتام (GMT+12:45/+13:45)</option>
                  <option value="Pacific/Tongatapu">تونجاتابو (GMT+13)</option>
                  <option value="Pacific/Fakaofo">فاكاوفو (GMT+13)</option>
                  <option value="Pacific/Apia">أبيا (GMT+13/+14)</option>
                  <option value="Pacific/Kiritimati">كيريتيماتي (GMT+14)</option>
                  <option value="Pacific/Enderbury">إندربراي (GMT+13)</option>
                  <option value="Pacific/Tarawa">تاراوا (GMT+12)</option>
                  <option value="Pacific/Majuro">ماجورو (GMT+12)</option>
                  <option value="Pacific/Kwajalein">كواجالين (GMT+12)</option>
                  <option value="Pacific/Kosrae">كوسراي (GMT+11)</option>
                  <option value="Pacific/Pohnpei">بونبي (GMT+11)</option>
                  <option value="Pacific/Chuuk">تشوك (GMT+10)</option>
                  <option value="Pacific/Saipan">سايبان (GMT+10)</option>
                  <option value="Pacific/Guam">غوام (GMT+10)</option>
                  <option value="Pacific/Fiji">فيجي (GMT+12)</option>
                  <option value="Pacific/Auckland">أوكلاند (GMT+12/+13)</option>
                  <option value="Pacific/Norfolk">نورفولك (GMT+11/+12)</option>
                  <option value="Pacific/Palau">بالاو (GMT+9)</option>
                  <option value="Pacific/Wallis">واليس (GMT+12)</option>
                  <option value="Pacific/Funafuti">فونافوتي (GMT+12)</option>
                  <option value="Pacific/Wake">ويك (GMT+12)</option>
                  <option value="Pacific/Midway">ميدواي (GMT-11)</option>
                  <option value="Pacific/Johnston">جونستون (GMT-10)</option>
                  <option value="Pacific/Pago_Pago">باغو باغو (GMT-11)</option>
                </select>
                    {validationErrors.timezone && (
                        <p className="text-red-500 text-sm mt-1">{validationErrors.timezone}</p>
                    )}
                    {!canEditField("timezone") && (
                        <p className="text-orange-500 text-sm mt-1">لا يمكن تعديل المنطقة الزمنية - صلاحيات غير كافية</p>
                    )}
              </div>

                {/* Currency */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                        العملة
                        {!canEditField("currency") && (
                            <span className="text-red-500 text-xs mr-2">(محظور)</span>
                        )}
                </label>
                <select
                        value={localSettings.currency}
                        onChange={(e) => handleInputChange("currency", e.target.value)}
                        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                            validationErrors.currency ? "border-red-500" : "border-gray-300"
                        } ${!canEditField("currency") ? "bg-gray-100 cursor-not-allowed" : ""}`}
                        disabled={loading || saving || !canEditField("currency")}
                    >
                        <option value="SAR">ريال سعودي (SAR)</option>
                        <option value="AED">درهم إماراتي (AED)</option>
                        <option value="KWD">دينار كويتي (KWD)</option>
                        <option value="QAR">ريال قطري (QAR)</option>
                        <option value="BHD">دينار بحريني (BHD)</option>
                        <option value="OMR">ريال عماني (OMR)</option>
                        <option value="JOD">دينار أردني (JOD)</option>
                        <option value="LBP">ليرة لبنانية (LBP)</option>
                        <option value="EGP">جنيه مصري (EGP)</option>
                        <option value="SDG">جنيه سوداني (SDG)</option>
                        <option value="LYD">دينار ليبي (LYD)</option>
                        <option value="TND">دينار تونسي (TND)</option>
                        <option value="DZD">دينار جزائري (DZD)</option>
                        <option value="MAD">درهم مغربي (MAD)</option>
                        <option value="USD">دولار أمريكي (USD)</option>
                        <option value="EUR">يورو (EUR)</option>
                        <option value="GBP">جنيه إسترليني (GBP)</option>
                        <option value="CHF">فرنك سويسري (CHF)</option>
                        <option value="SEK">كرونة سويدية (SEK)</option>
                        <option value="NOK">كرونة نرويجية (NOK)</option>
                        <option value="DKK">كرونة دنماركية (DKK)</option>
                        <option value="PLN">زلوتي بولندي (PLN)</option>
                        <option value="CZK">كرونة تشيكية (CZK)</option>
                        <option value="HUF">فورنت مجري (HUF)</option>
                        <option value="RON">ليو روماني (RON)</option>
                        <option value="BGN">لف بلغاري (BGN)</option>
                        <option value="HRK">كونا كرواتية (HRK)</option>
                        <option value="RSD">دينار صربي (RSD)</option>
                        <option value="ALL">ليك ألباني (ALL)</option>
                        <option value="MKD">دينار مقدوني (MKD)</option>
                        <option value="TRY">ليرة تركية (TRY)</option>
                        <option value="RUB">روبل روسي (RUB)</option>
                        <option value="UAH">هريفنيا أوكرانية (UAH)</option>
                        <option value="BYN">روبل بيلاروسي (BYN)</option>
                        <option value="MDL">ليو مولدافي (MDL)</option>
                        <option value="GEL">لاري جورجي (GEL)</option>
                        <option value="AMD">درام أرميني (AMD)</option>
                        <option value="AZN">مانات أذربيجاني (AZN)</option>
                        <option value="GEL">لاري جورجي (GEL)</option>
                        <option value="AMD">درام أرميني (AMD)</option>
                        <option value="AZN">مانات أذربيجاني (AZN)</option>
                        <option value="KZT">تينغ كازاخستاني (KZT)</option>
                        <option value="KGS">سوم قيرغيزستاني (KGS)</option>
                        <option value="TJS">سوموني طاجيكستاني (TJS)</option>
                        <option value="TMT">مانات تركمانستاني (TMT)</option>
                        <option value="UZS">سوم أوزبكستاني (UZS)</option>
                        <option value="CNY">يوان صيني (CNY)</option>
                        <option value="JPY">ين ياباني (JPY)</option>
                        <option value="KRW">وون كوري جنوبي (KRW)</option>
                        <option value="HKD">دولار هونغ كونغ (HKD)</option>
                        <option value="SGD">دولار سنغافوري (SGD)</option>
                        <option value="MYR">رينغيت ماليزي (MYR)</option>
                        <option value="THB">بات تايلندي (THB)</option>
                        <option value="VND">دونغ فيتنامي (VND)</option>
                        <option value="IDR">روبية إندونيسية (IDR)</option>
                        <option value="PHP">بيزو فلبيني (PHP)</option>
                        <option value="INR">روبية هندية (INR)</option>
                        <option value="PKR">روبية باكستانية (PKR)</option>
                        <option value="BDT">تاكا بنغلاديشي (BDT)</option>
                        <option value="LKR">روبية سريلانكية (LKR)</option>
                        <option value="NPR">روبية نيبالية (NPR)</option>
                        <option value="MMK">كيات ميانماري (MMK)</option>
                        <option value="LAK">كيب لاوي (LAK)</option>
                        <option value="KHR">رييل كمبودي (KHR)</option>
                        <option value="MNT">توغروغ منغولي (MNT)</option>
                        <option value="AUD">دولار أسترالي (AUD)</option>
                        <option value="NZD">دولار نيوزيلندي (NZD)</option>
                        <option value="CAD">دولار كندي (CAD)</option>
                        <option value="MXN">بيزو مكسيكي (MXN)</option>
                        <option value="BRL">ريال برازيلي (BRL)</option>
                        <option value="ARS">بيزو أرجنتيني (ARS)</option>
                        <option value="CLP">بيزو تشيلي (CLP)</option>
                        <option value="PEN">سول بيروفي (PEN)</option>
                        <option value="COP">بيزو كولومبي (COP)</option>
                        <option value="VES">بوليفار فنزويلي (VES)</option>
                        <option value="BOB">بوليفيانو بوليفي (BOB)</option>
                        <option value="PYG">غواراني باراغواي (PYG)</option>
                        <option value="UYU">بيزو أوروغواي (UYU)</option>
                        <option value="CUP">بيزو كوبي (CUP)</option>
                        <option value="DOP">بيزو دومينيكي (DOP)</option>
                        <option value="HTG">غورد هايتي (HTG)</option>
                        <option value="JMD">دولار جامايكي (JMD)</option>
                        <option value="BSD">دولار باهامي (BSD)</option>
                        <option value="BBD">دولار بربادوسي (BBD)</option>
                        <option value="TTD">دولار ترينيداد وتوباغو (TTD)</option>
                        <option value="GYD">دولار غياني (GYD)</option>
                        <option value="SRD">دولار سورينامي (SRD)</option>
                        <option value="XCD">دولار شرق كاريبي (XCD)</option>
                        <option value="ZAR">راند جنوب أفريقي (ZAR)</option>
                        <option value="NGN">نيرة نيجيرية (NGN)</option>
                        <option value="EGP">جنيه مصري (EGP)</option>
                        <option value="KES">شلن كيني (KES)</option>
                        <option value="UGX">شلن أوغندي (UGX)</option>
                        <option value="TZS">شلن تنزاني (TZS)</option>
                        <option value="GHS">سيدي غاني (GHS)</option>
                        <option value="NGN">نيرة نيجيرية (NGN)</option>
                        <option value="XOF">فرنك غرب أفريقي (XOF)</option>
                        <option value="XAF">فرنك وسط أفريقي (XAF)</option>
                        <option value="CDF">فرنك كونغولي (CDF)</option>
                        <option value="RWF">فرنك رواندي (RWF)</option>
                        <option value="BIF">فرنك بوروندي (BIF)</option>
                        <option value="DJF">فرنك جيبوتي (DJF)</option>
                        <option value="KMF">فرنك جزر القمر (KMF)</option>
                        <option value="MGA">أرياري مدغشقر (MGA)</option>
                        <option value="MUR">روبية موريشيوسية (MUR)</option>
                        <option value="SCR">روبية سيشيلية (SCR)</option>
                        <option value="MVR">روفية مالديفية (MVR)</option>
                        <option value="LKR">روبية سريلانكية (LKR)</option>
                        <option value="BDT">تاكا بنغلاديشي (BDT)</option>
                        <option value="NPR">روبية نيبالية (NPR)</option>
                        <option value="BTN">نغولتروم بوتاني (BTN)</option>
                        <option value="INR">روبية هندية (INR)</option>
                        <option value="PKR">روبية باكستانية (PKR)</option>
                        <option value="AFN">أفغاني أفغاني (AFN)</option>
                        <option value="IRR">ريال إيراني (IRR)</option>
                        <option value="IQD">دينار عراقي (IQD)</option>
                        <option value="SYP">ليرة سورية (SYP)</option>
                        <option value="YER">ريال يمني (YER)</option>
                        <option value="ILS">شيكل إسرائيلي (ILS)</option>
                        <option value="JOD">دينار أردني (JOD)</option>
                        <option value="LBP">ليرة لبنانية (LBP)</option>
                        <option value="EGP">جنيه مصري (EGP)</option>
                        <option value="SDG">جنيه سوداني (SDG)</option>
                        <option value="LYD">دينار ليبي (LYD)</option>
                        <option value="TND">دينار تونسي (TND)</option>
                        <option value="DZD">دينار جزائري (DZD)</option>
                        <option value="MAD">درهم مغربي (MAD)</option>
                        <option value="XOF">فرنك غرب أفريقي (XOF)</option>
                        <option value="XAF">فرنك وسط أفريقي (XAF)</option>
                        <option value="CDF">فرنك كونغولي (CDF)</option>
                        <option value="RWF">فرنك رواندي (RWF)</option>
                        <option value="BIF">فرنك بوروندي (BIF)</option>
                        <option value="DJF">فرنك جيبوتي (DJF)</option>
                        <option value="KMF">فرنك جزر القمر (KMF)</option>
                        <option value="MGA">أرياري مدغشقر (MGA)</option>
                        <option value="MUR">روبية موريشيوسية (MUR)</option>
                        <option value="SCR">روبية سيشيلية (SCR)</option>
                        <option value="MVR">روفية مالديفية (MVR)</option>
                        <option value="LKR">روبية سريلانكية (LKR)</option>
                        <option value="BDT">تاكا بنغلاديشي (BDT)</option>
                        <option value="NPR">روبية نيبالية (NPR)</option>
                        <option value="BTN">نغولتروم بوتاني (BTN)</option>
                        <option value="INR">روبية هندية (INR)</option>
                        <option value="PKR">روبية باكستانية (PKR)</option>
                        <option value="AFN">أفغاني أفغاني (AFN)</option>
                        <option value="IRR">ريال إيراني (IRR)</option>
                        <option value="IQD">دينار عراقي (IQD)</option>
                        <option value="SYP">ليرة سورية (SYP)</option>
                        <option value="YER">ريال يمني (YER)</option>
                        <option value="ILS">شيكل إسرائيلي (ILS)</option>
                </select>
                    {validationErrors.currency && (
                        <p className="text-red-500 text-sm mt-1">{validationErrors.currency}</p>
                    )}
                    {!canEditField("currency") && (
                        <p className="text-orange-500 text-sm mt-1">لا يمكن تعديل العملة - صلاحيات غير كافية</p>
                    )}
            </div>
          </div>

            {/* Save Button */}
            <div className="flex justify-end pt-6 border-t border-gray-200">
                <button
                    onClick={handleSave}
                    disabled={loading || saving}
                    className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {saving ? "جاري الحفظ..." : "حفظ الإعدادات"}
                </button>
          </div>
    </div>
  );
};

export default GeneralSettingsTab;
