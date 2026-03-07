import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../context/LanguageContext';
import LanguageSwitcherAuth from '../components/LanguageSwitcherAuth';

const VerifyEmail: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      setMessage(t('auth.invalidVerificationLink'));
      return;
    }
    const verify = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
        const res = await fetch(`${apiUrl}/auth/verify-email?token=${token}`);
        const data = await res.json();
        if (data.success) {
          setStatus('success');
          setMessage(data.message || t('auth.verificationSuccessMessage'));
        } else if (data.message && data.message.includes('الحساب مفعل بالفعل')) {
          setStatus('success');
          setMessage(t('auth.verificationAlreadyDone'));
        } else {
          setStatus('error');
          setMessage(data.message || t('auth.verificationFailedMessage'));
        }
      } catch {
        setStatus('error');
        setMessage(t('auth.verificationError'));
      }
    };
    verify();
  }, [searchParams, t]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 p-4">
      {/* Language Switcher - Top Corner (RTL/LTR aware) */}
      <div className={`fixed top-4 z-50 ${isRTL ? 'left-4' : 'right-4'}`}>
        <LanguageSwitcherAuth />
      </div>

      <div className="relative w-full max-w-md">
        {/* Background decoration */}
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-3xl blur-3xl"></div>

        {/* Main card */}
        <div className="relative bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 p-8">
          <div className="text-center">
            {status === 'loading' && (
              <>
                <div className="w-20 h-20 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-6"></div>
                <p className="text-white text-lg">{t('auth.verifying')}</p>
              </>
            )}
            {status === 'success' && (
              <>
                <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-white mb-3">{t('auth.verificationSuccess')}</h2>
                <p className="text-white/80 mb-6">{message}</p>
                <a 
                  href="/login" 
                  className="inline-block px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-2xl font-semibold transition-all duration-200 shadow-lg"
                >
                  {t('auth.loginButton')}
                </a>
              </>
            )}
            {status === 'error' && (
              <>
                <div className="w-20 h-20 bg-gradient-to-br from-red-500 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-white mb-3">{t('auth.verificationFailed')}</h2>
                <p className="text-white/80 mb-6">{message}</p>
                <a 
                  href="/login" 
                  className="inline-block px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-2xl font-semibold transition-all duration-200 shadow-lg"
                >
                  {t('auth.backToHome')}
                </a>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;
