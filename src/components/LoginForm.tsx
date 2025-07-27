import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';

interface FormData {
  name: string;
  businessName: string;
  email: string;
  password: string;
}

const LoginForm: React.FC = () => {
  const { login, isLoading, resendVerification, forgotPassword } = useApp();
  const navigate = useNavigate();

  // State management
  const [isRegister, setIsRegister] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    name: '',
    businessName: '',
    email: '',
    password: ''
  });
  const [errors, setErrors] = useState<Partial<FormData>>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showResendForm, setShowResendForm] = useState(false);
  const [showForgotForm, setShowForgotForm] = useState(false);
  const [resendEmail, setResendEmail] = useState('');
  const [forgotEmail, setForgotEmail] = useState('');
  const [isResending, setIsResending] = useState(false);
  const [isForgotSubmitting, setIsForgotSubmitting] = useState(false);
  // أضف متغير حالة جديد
  const [showResendActivationLink, setShowResendActivationLink] = useState(false);

  // Refs for form stability
  const formRef = useRef<HTMLFormElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  // Clear form data
  const clearForm = useCallback(() => {
    setFormData({
      name: '',
      businessName: '',
      email: '',
      password: ''
    });
    setErrors({});
    setSuccessMessage(null);
    setShowResendActivationLink(false);
  }, []);

  // Handle resend verification
  const handleResendVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resendEmail.trim()) {
      setErrors({ email: 'البريد الإلكتروني مطلوب' });
      return;
    }

    setIsResending(true);
    setErrors({});
    setShowResendActivationLink(false); // إخفاء زر إعادة الإرسال

    try {
      const response = await resendVerification(resendEmail);
      if (response.success) {
        setSuccessMessage(response.message || 'تم إرسال رابط التفعيل إلى بريدك الإلكتروني');
        setShowResendForm(false);
        setResendEmail('');
        // إزالة رسالة الخطأ السابقة إذا كانت موجودة
        setErrors({});
      } else {
        setErrors({ email: response.message || 'فشل في إعادة إرسال رابط التفعيل' });
      }
    } catch {
      setErrors({ email: 'حدث خطأ أثناء إعادة إرسال رابط التفعيل' });
    } finally {
      setIsResending(false);
    }
  };

  // Handle forgot password
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) {
      setErrors({ email: 'البريد الإلكتروني مطلوب' });
      return;
    }

    setIsForgotSubmitting(true);
    setErrors({});
    setShowResendActivationLink(false); // إخفاء زر إعادة الإرسال

    try {
      const response = await forgotPassword(forgotEmail);
      if (response.success) {
        setSuccessMessage(response.message || 'تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني');
        setShowForgotForm(false);
        setForgotEmail('');
      } else {
        setErrors({ email: response.message || 'فشل في إرسال رابط إعادة تعيين كلمة المرور' });
      }
    } catch {
      setErrors({ email: 'حدث خطأ أثناء إرسال رابط إعادة تعيين كلمة المرور' });
    } finally {
      setIsForgotSubmitting(false);
    }
  };

  // Handle input changes
  const handleInputChange = useCallback((field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear field-specific error
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  }, [errors]);

  // Validation
  const validateForm = useCallback((): boolean => {
    const newErrors: Partial<FormData> = {};

    if (isRegister) {
      if (!formData.name.trim()) {
        newErrors.name = 'اسم المالك مطلوب';
      }
      if (!formData.businessName.trim()) {
        newErrors.businessName = 'اسم المنشأة مطلوب';
      }
    }

    if (!formData.email.trim()) {
      newErrors.email = 'البريد الإلكتروني مطلوب';
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        newErrors.email = 'البريد الإلكتروني غير صحيح';
      }
    }

    if (!formData.password.trim()) {
      newErrors.password = 'كلمة المرور مطلوبة';
    } else if (formData.password.length < 6) {
      newErrors.password = 'كلمة المرور يجب أن تكون 6 أحرف على الأقل';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData, isRegister]);

  // Handle form submission
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setErrors({});
    setSuccessMessage(null);

    try {
      if (isRegister) {
        // Registration logic
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
        const response = await fetch(`${apiUrl}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formData.name,
            email: formData.email,
            password: formData.password,
            role: 'owner',
            businessName: formData.businessName,
          })
        });

        const data = await response.json();

        if (data.success) {
          setSuccessMessage('تم إرسال رابط التفعيل إلى بريدك الإلكتروني. يرجى تفعيل الحساب قبل تسجيل الدخول.');
          setIsRegister(false);
          // Clear only email and password for login
          setFormData(prev => ({ ...prev, email: '', password: '' }));
        } else {
          if (data.message?.includes('فشل إرسال رسالة التفعيل')) {
            setErrors({ email: 'تعذر إرسال رسالة التفعيل. يرجى التأكد من صحة البريد أو المحاولة لاحقًا.' });
          } else {
            setErrors({ email: data.message || 'حدث خطأ أثناء التسجيل.' });
          }
        }
      } else {
        // Login logic
        const response = await login(formData.email, formData.password);

        if (!response.success) {
          // تحليل رسالة الخطأ لتحديد نوع المشكلة
          const errorMessage = response.message || '';

          if (errorMessage.includes('غير مفعل') || errorMessage.includes('pending')) {
            // عرض رسالة خاصة للحساب غير المفعل مع إمكانية إعادة إرسال التفعيل
            setErrors({ email: 'الحساب غير مفعل. يرجى تفعيل بريدك الإلكتروني أولاً.' });
            setShowResendActivationLink(true);
            setResendEmail(formData.email);
          } else if (errorMessage.includes('غير صحيحة') || errorMessage.includes('خطأ')) {
            setErrors({ email: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.' });
          } else if (errorMessage.includes('غير موجود')) {
            setErrors({ email: 'البريد الإلكتروني غير موجود في النظام.' });
          } else {
            setErrors({ email: errorMessage || 'حدث خطأ أثناء تسجيل الدخول.' });
          }
        } else {
          clearForm();
          navigate('/dashboard', { replace: true });
        }
      }
    } catch {
      setErrors({
        email: isRegister ? 'حدث خطأ أثناء التسجيل. حاول مرة أخرى.' : 'حدث خطأ أثناء تسجيل الدخول. حاول مرة أخرى.'
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, isRegister, validateForm, login, navigate, clearForm]);

  // Handle mode toggle
  const handleToggleMode = useCallback(() => {
    setIsRegister(prev => !prev);
    clearForm();
  }, [clearForm]);

  // Auto-focus email field when switching to login
  useEffect(() => {
    if (!isRegister && emailRef.current) {
      setTimeout(() => emailRef.current?.focus(), 100);
    }
  }, [isRegister]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-700 p-4">
      <div className="relative bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl p-8 max-w-md w-full border border-gray-100">
        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center shadow-lg mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M9 7a4 4 0 108 0 4 4 0 00-8 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {isRegister ? 'تسجيل منشأة جديدة' : 'تسجيل الدخول'}
          </h1>
          <p className="text-gray-600 text-sm text-center">
            {isRegister ? 'ابدأ رحلتك مع نظام بومبا' : 'مرحباً بك من جديد في نظام بومبا'}
          </p>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-green-800 text-sm">{successMessage}</span>
            </div>
          </div>
        )}

        {/* Form */}
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
          {/* Register Fields */}
          {isRegister && (
            <>
                             <div>
                 <label htmlFor="owner-name" className="block text-sm font-medium text-gray-700 mb-2 text-right">
                   اسم المالك
                 </label>
                                                  <input
                  id="owner-name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors text-right ${
                    errors.name ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'
                  }`}
                  placeholder="أدخل اسم المالك"
                  disabled={isSubmitting}
                  autoComplete="new-password"
                  dir="rtl"
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-600 text-right">{errors.name}</p>
                )}
              </div>

                             <div>
                 <label htmlFor="business-name" className="block text-sm font-medium text-gray-700 mb-2 text-right">
                   اسم المنشأة
                 </label>
                                                  <input
                  id="business-name"
                  type="text"
                  value={formData.businessName}
                  onChange={(e) => handleInputChange('businessName', e.target.value)}
                  className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors text-right ${
                    errors.businessName ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'
                  }`}
                  placeholder="أدخل اسم المنشأة"
                  disabled={isSubmitting}
                  autoComplete="new-password"
                  dir="rtl"
                />
                {errors.businessName && (
                  <p className="mt-1 text-sm text-red-600 text-right">{errors.businessName}</p>
                )}
              </div>
            </>
          )}

          {/* Email Field */}
                     <div>
             <label htmlFor={isRegister ? "register-email" : "login-email"} className="block text-sm font-medium text-gray-700 mb-2 text-right">
               البريد الإلكتروني
             </label>
                                                    <input
                key={`email-${isRegister ? 'register' : 'login'}`}
                ref={emailRef}
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors text-right ${
                  errors.email ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'
                }`}
                placeholder="أدخل بريدك الإلكتروني"
                disabled={isSubmitting}
                autoComplete="new-password"
                name={isRegister ? "register-email" : "login-email"}
                id={isRegister ? "register-email" : "login-email"}
                dir="rtl"
              />
            {errors.email && (
              <>
                <p className="mt-1 text-sm text-red-600 text-right">{errors.email}</p>
                {showResendActivationLink && !isRegister && (
                  <button
                    type="button"
                    className="block mt-2 text-xs text-blue-600 hover:underline focus:outline-none"
                    onClick={() => setShowResendForm(true)}
                  >
                    إعادة إرسال رابط التفعيل
                  </button>
                )}
              </>
            )}
          </div>

          {/* Password Field */}
                     <div>
             <label htmlFor={isRegister ? "register-password" : "login-password"} className="block text-sm font-medium text-gray-700 mb-2 text-right">
               كلمة المرور
             </label>
             <div className="relative">
                               <input
                  key={`password-${isRegister ? 'register' : 'login'}`}
                  ref={passwordRef}
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  className={`w-full px-4 py-3 pr-12 pl-4 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors text-right ${
                    errors.password ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'
                  }`}
                  placeholder="أدخل كلمة المرور"
                  disabled={isSubmitting}
                  autoComplete="new-password"
                  name={isRegister ? "register-password" : "login-password"}
                  id={isRegister ? "register-password" : "login-password"}
                  dir="rtl"
                />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-3 top-1/2 transform -translate-y-1/2 p-1 text-gray-500 hover:text-gray-700 transition-colors"
                disabled={isSubmitting}
                aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                title={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
              >
                {showPassword ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
            {errors.password && (
              <p className="mt-1 text-sm text-red-600 text-right">{errors.password}</p>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting || isLoading}
            className={`w-full py-3 px-4 rounded-xl font-semibold text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-400 ${
              isSubmitting || isLoading
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 active:scale-95'
            }`}
          >
            {isSubmitting || isLoading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>{isRegister ? 'جاري التسجيل...' : 'جاري الدخول...'}</span>
              </div>
            ) : (
              <span>{isRegister ? 'تسجيل' : 'دخول'}</span>
            )}
          </button>
        </form>

        {/* Toggle Mode */}
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={handleToggleMode}
            disabled={isSubmitting}
            className="text-blue-600 hover:text-blue-700 font-medium text-sm transition-colors disabled:opacity-50"
          >
            {isRegister ? 'لديك حساب بالفعل؟ تسجيل الدخول' : 'ليس لديك حساب؟ سجل منشأتك الآن'}
          </button>
        </div>

        {/* Additional Options for Login */}
        {!isRegister && (
          <div className="mt-4 space-y-2">
            {/* Forgot Password - يظهر فقط إذا لم تكن النموذج مفتوح */}
            {!showForgotForm && (
              <button
                type="button"
                onClick={() => {
                  setShowForgotForm(true);
                  setShowResendForm(false);
                  setForgotEmail(formData.email);
                }}
                disabled={isSubmitting}
                className="w-full text-center text-xs text-gray-600 hover:text-gray-800 transition-colors disabled:opacity-50"
              >
                نسيت كلمة المرور؟
              </button>
            )}
          </div>
        )}

        {/* Resend Verification Form */}
        {showResendForm && !isRegister && (
          <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
            <h3 className="text-sm font-medium text-gray-900 mb-3 text-right">إعادة إرسال رابط التفعيل</h3>
            <form onSubmit={handleResendVerification} className="space-y-3">
                             <div>
                 <label htmlFor="resend-email" className="sr-only">البريد الإلكتروني لإعادة إرسال التفعيل</label>
                                   <input
                    id="resend-email"
                    type="email"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors text-right"
                    placeholder="أدخل بريدك الإلكتروني"
                    disabled={isResending}
                    autoComplete="new-password"
                    dir="rtl"
                  />
                {errors.email && !errors.email.includes('غير مفعل') && (
                  <p className="mt-1 text-sm text-red-600 text-right">{errors.email}</p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={isResending}
                  className="flex-1 py-2 px-3 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {isResending ? 'جاري الإرسال...' : 'إرسال'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowResendForm(false)}
                  disabled={isResending}
                  className="px-3 py-2 text-gray-600 text-sm rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Forgot Password Form */}
        {showForgotForm && !isRegister && (
          <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
            <h3 className="text-sm font-medium text-gray-900 mb-3 text-right">نسيت كلمة المرور</h3>
            <p className="text-xs text-gray-600 mb-3 text-right">أدخل بريدك الإلكتروني لإرسال رابط إعادة تعيين كلمة المرور</p>
            <form onSubmit={handleForgotPassword} className="space-y-3">
                             <div>
                 <label htmlFor="forgot-email" className="sr-only">البريد الإلكتروني لنسيت كلمة المرور</label>
                                   <input
                    id="forgot-email"
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors text-right"
                    placeholder="أدخل بريدك الإلكتروني"
                    disabled={isForgotSubmitting}
                    autoComplete="new-password"
                    dir="rtl"
                  />
                {errors.email && !errors.email.includes('غير مفعل') && (
                  <p className="mt-1 text-sm text-red-600 text-right">{errors.email}</p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={isForgotSubmitting}
                  className="flex-1 py-2 px-3 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {isForgotSubmitting ? 'جاري الإرسال...' : 'إرسال'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForgotForm(false)}
                  disabled={isForgotSubmitting}
                  className="px-3 py-2 text-gray-600 text-sm rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoginForm;
