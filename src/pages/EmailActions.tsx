import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

interface FormErrors {
  email?: string;
}

const EmailActions: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const action = searchParams.get('action');

  // State management
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Refs
  const emailInputRef = useRef<HTMLInputElement>(null);



  // Clear success message after 5 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // Handle input changes
  const handleInputChange = useCallback((value: string) => {
    setEmail(value);
    // Clear field-specific error
    if (errors.email) {
      setErrors(prev => ({ ...prev, email: undefined }));
    }
  }, [errors]);

  // Validation
  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {};

    if (!email.trim()) {
      newErrors.email = 'البريد الإلكتروني مطلوب';
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        newErrors.email = 'البريد الإلكتروني غير صحيح';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [email]);

  // Handle resend verification
  const handleResendVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setErrors({});
    setSuccessMessage(null);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const response = await fetch(`${apiUrl}/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await response.json();

      if (data.success) {
        setSuccessMessage(data.message || 'تم إرسال رابط التفعيل إلى بريدك الإلكتروني بنجاح!');
        setEmail(''); // Clear email field
      } else {
        setErrors({ email: data.message || 'فشل في إعادة إرسال رابط التفعيل' });
      }
    } catch (error) {
      setErrors({ email: 'حدث خطأ أثناء إعادة إرسال رابط التفعيل' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle forgot password
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setErrors({});
    setSuccessMessage(null);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const response = await fetch(`${apiUrl}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await response.json();

      if (data.success) {
        setSuccessMessage(data.message || 'تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني بنجاح!');
        setEmail(''); // Clear email field
      } else {
        setErrors({ email: data.message || 'فشل في إرسال رابط إعادة تعيين كلمة المرور' });
      }
    } catch (error) {
      setErrors({ email: 'حدث خطأ أثناء إرسال رابط إعادة تعيين كلمة المرور' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Auto-focus email field on mount
  useEffect(() => {
    if (emailInputRef.current) {
      setTimeout(() => emailInputRef.current?.focus(), 100);
    }
  }, []);

  // Get page content based on action
  const getPageContent = () => {
    if (action === 'resend') {
      return {
        title: 'إعادة إرسال رابط التفعيل',
        subtitle: 'أدخل بريدك الإلكتروني لإعادة إرسال رابط التفعيل',
        icon: (
          <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        ),
        onSubmit: handleResendVerification,
        buttonText: isSubmitting ? 'جاري الإرسال...' : 'إرسال رابط التفعيل',
        gradient: 'from-blue-500 to-purple-600'
      };
    } else if (action === 'forgot') {
      return {
        title: 'نسيت كلمة المرور',
        subtitle: 'أدخل بريدك الإلكتروني لإرسال رابط إعادة تعيين كلمة المرور',
        icon: (
          <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
        ),
        onSubmit: handleForgotPassword,
        buttonText: isSubmitting ? 'جاري الإرسال...' : 'إرسال رابط إعادة التعيين',
        gradient: 'from-green-500 to-blue-600'
      };
    } else {
      // Default to resend verification
      return {
        title: 'إعادة إرسال رابط التفعيل',
        subtitle: 'أدخل بريدك الإلكتروني لإعادة إرسال رابط التفعيل',
        icon: (
          <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        ),
        onSubmit: handleResendVerification,
        buttonText: isSubmitting ? 'جاري الإرسال...' : 'إرسال رابط التفعيل',
        gradient: 'from-blue-500 to-purple-600'
      };
    }
  };

  const pageContent = getPageContent();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 p-4">
      <div className="relative w-full max-w-md">
        {/* Background decoration */}
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-3xl blur-3xl"></div>

        {/* Main card */}
        <div className="relative bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className={`w-20 h-20 bg-gradient-to-br ${pageContent.gradient} rounded-full flex items-center justify-center shadow-lg mx-auto mb-6`}>
              {pageContent.icon}
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">
              {pageContent.title}
            </h1>
            <p className="text-white/80 text-sm">
              {pageContent.subtitle}
            </p>
          </div>

          {/* Success Message */}
          {successMessage && (
            <div className="mb-6 p-4 bg-green-500/20 border border-green-400/30 rounded-2xl animate-pulse">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-green-100 text-sm font-medium">{successMessage}</span>
              </div>
            </div>
          )}

          {/* Error Message */}
          {errors.email && (
            <div className="mb-6 p-4 bg-red-500/20 border border-red-400/30 rounded-2xl">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-red-100 text-sm font-medium">{errors.email}</span>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={pageContent.onSubmit} className="space-y-6">
            {/* Email Field */}
            <div>
              <label className="block text-sm font-medium text-white/90 mb-3 text-right">
                البريد الإلكتروني
              </label>
              <input
                ref={emailInputRef}
                type="email"
                value={email}
                onChange={(e) => handleInputChange(e.target.value)}
                className={`w-full px-4 py-4 bg-white/10 border rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all text-right text-white placeholder-white/50 ${
                  errors.email ? 'border-red-400' : 'border-white/20'
                }`}
                placeholder="أدخل بريدك الإلكتروني"
                disabled={isSubmitting}
                autoComplete="email"
                dir="rtl"
              />
              {errors.email && (
                <p className="mt-2 text-sm text-red-300 text-right">{errors.email}</p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full py-4 px-6 rounded-2xl font-semibold text-white transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                isSubmitting
                  ? 'bg-gray-500 cursor-not-allowed'
                  : `bg-gradient-to-r ${pageContent.gradient} hover:from-blue-700 hover:to-purple-700 active:scale-95 shadow-lg`
              }`}
            >
              {isSubmitting ? (
                <div className="flex items-center justify-center gap-3">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>جاري الإرسال...</span>
                </div>
              ) : (
                <span>{pageContent.buttonText}</span>
              )}
            </button>
          </form>

          {/* Back to Login */}
          <div className="mt-8 text-center">
            <button
              type="button"
              onClick={() => navigate('/login')}
              disabled={isSubmitting}
              className="text-white/80 hover:text-white font-medium text-sm transition-colors disabled:opacity-50"
            >
              العودة إلى تسجيل الدخول
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailActions;
