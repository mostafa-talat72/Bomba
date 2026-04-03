import React from 'react';
import { languages } from '../i18n/config';
import { ArrowLeft, ArrowRight } from 'lucide-react';

const LanguagesTest: React.FC = () => {
  const rtlLanguages = languages.filter(lang => lang.dir === 'rtl');
  const ltrLanguages = languages.filter(lang => lang.dir === 'ltr');

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
          اختبار اتجاهات اللغات - Languages Direction Test
        </h1>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
            <div className="text-4xl font-bold text-blue-600 dark:text-blue-400 mb-2">
              {languages.length}
            </div>
            <div className="text-gray-600 dark:text-gray-400">إجمالي اللغات / Total Languages</div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
            <div className="text-4xl font-bold text-green-600 dark:text-green-400 mb-2">
              {rtlLanguages.length}
            </div>
            <div className="text-gray-600 dark:text-gray-400 flex items-center gap-2">
              <ArrowLeft className="w-5 h-5" />
              لغات RTL / RTL Languages
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
            <div className="text-4xl font-bold text-purple-600 dark:text-purple-400 mb-2">
              {ltrLanguages.length}
            </div>
            <div className="text-gray-600 dark:text-gray-400 flex items-center gap-2">
              <ArrowRight className="w-5 h-5" />
              لغات LTR / LTR Languages
            </div>
          </div>
        </div>

        {/* RTL Languages */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-3">
            <ArrowLeft className="w-6 h-6 text-green-600" />
            اللغات RTL (من اليمين لليسار)
          </h2>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-gray-200 dark:bg-gray-700">
              {rtlLanguages.map((lang) => (
                <div
                  key={lang.code}
                  className="bg-white dark:bg-gray-800 p-4"
                  dir={lang.dir}
                >
                  <div className={`flex items-center gap-3 ${lang.dir === 'rtl' ? 'flex-row-reverse' : 'flex-row'}`}>
                    <span className="text-3xl">{lang.flag}</span>
                    <div className={`flex-1 ${lang.dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                      <div className="font-bold text-gray-900 dark:text-white">
                        {lang.nativeName}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {lang.name} ({lang.code})
                      </div>
                      <div className="text-xs text-green-600 dark:text-green-400 font-mono mt-1">
                        dir="{lang.dir}"
                      </div>
                    </div>
                    <div className="text-green-600 dark:text-green-400">
                      <ArrowLeft className="w-5 h-5" />
                    </div>
                  </div>
                  
                  {/* Sample Text */}
                  <div 
                    className={`mt-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg ${lang.dir === 'rtl' ? 'text-right' : 'text-left'}`}
                    dir={lang.dir}
                  >
                    <div className="text-sm text-gray-700 dark:text-gray-300">
                      مرحباً بك في النظام
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* LTR Languages */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-3">
            <ArrowRight className="w-6 h-6 text-purple-600" />
            اللغات LTR (من اليسار لليمين)
          </h2>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-gray-200 dark:bg-gray-700">
              {ltrLanguages.map((lang) => (
                <div
                  key={lang.code}
                  className="bg-white dark:bg-gray-800 p-4"
                  dir={lang.dir}
                >
                  <div className={`flex items-center gap-3 ${lang.dir === 'rtl' ? 'flex-row-reverse' : 'flex-row'}`}>
                    <span className="text-2xl">{lang.flag}</span>
                    <div className={`flex-1 ${lang.dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                      <div className="font-bold text-gray-900 dark:text-white text-sm">
                        {lang.nativeName}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {lang.name}
                      </div>
                      <div className="text-xs text-purple-600 dark:text-purple-400 font-mono">
                        {lang.code}
                      </div>
                    </div>
                    <div className="text-purple-600 dark:text-purple-400">
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>
                  
                  {/* Sample Text */}
                  <div 
                    className={`mt-2 p-2 bg-gray-50 dark:bg-gray-700 rounded text-xs ${lang.dir === 'rtl' ? 'text-right' : 'text-left'}`}
                    dir={lang.dir}
                  >
                    Welcome to the system
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 rounded-xl p-6">
          <h3 className="text-lg font-bold text-blue-900 dark:text-blue-300 mb-3">
            ملاحظات / Notes
          </h3>
          <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
            <li className="flex items-start gap-2">
              <span className="text-green-600 dark:text-green-400">✓</span>
              <span>اللغات RTL تظهر من اليمين لليسار مع عكس اتجاه العناصر (flex-row-reverse)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 dark:text-green-400">✓</span>
              <span>اللغات LTR تظهر من اليسار لليمين بالترتيب الطبيعي (flex-row)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 dark:text-green-400">✓</span>
              <span>كل لغة تحتوي على خاصية dir="{'{rtl|ltr}'}" لتطبيق الاتجاه الصحيح</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 dark:text-green-400">✓</span>
              <span>النصوص داخل كل لغة تتبع اتجاه اللغة تلقائياً</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default LanguagesTest;
