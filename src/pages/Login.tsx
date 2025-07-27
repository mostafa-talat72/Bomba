import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';

interface FormData {
  email: string;
  password: string;
}

interface FormErrors {
  email?: string;
  password?: string;
}

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useApp();

  // State management
  const [formData, setFormData] = useState<FormData>({
    email: '',
    password: ''
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showResendLink, setShowResendLink] = useState(false);

  // Refs
  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  // Clear form data
  const clearForm = useCallback(() => {
    setFormData({
      email: '',
      password: ''
    });
    setErrors({});
    setShowResendLink(false);
  }, []);

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
    const newErrors: FormErrors = {};

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
  }, [formData]);

  // Handle form submission
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      const result = await login(formData.email, formData.password);

      if (result.success) {
        clearForm();
        // Navigate to dashboard - AppContext will handle the authentication state
        navigate('/dashboard', { replace: true });
      } else {
        const errorMessage = result.message || '';

        if (errorMessage.includes('غير مفعل') || errorMessage.includes('pending')) {
          setErrors({ email: 'الحساب غير مفعل. يرجى تفعيل بريدك الإلكتروني أولاً.' });
          setShowResendLink(true);
        } else if (errorMessage.includes('غير صحيحة') || errorMessage.includes('خطأ')) {
          setErrors({ email: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.' });
        } else if (errorMessage.includes('غير موجود')) {
          setErrors({ email: 'البريد الإلكتروني غير موجود في النظام.' });
        } else {
          setErrors({ email: errorMessage || 'حدث خطأ أثناء تسجيل الدخول.' });
        }
      }
    } catch {
      setErrors({
        email: 'حدث خطأ أثناء تسجيل الدخول. حاول مرة أخرى.'
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, validateForm, login, navigate, clearForm]);

  // Auto-focus email field on mount
  useEffect(() => {
    if (emailInputRef.current) {
      setTimeout(() => emailInputRef.current?.focus(), 100);
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 p-4">
      <div className="relative w-full max-w-md">
        {/* Background decoration */}
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-3xl blur-3xl"></div>

        {/* Main card */}
        <div className="relative bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg mx-auto mb-6">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M9 7a4 4 0 108 0 4 4 0 00-8 0z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">
              تسجيل الدخول
            </h1>
            <p className="text-white/80 text-sm">
              مرحباً بك من جديد في نظام بومبا
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email Field */}
            <div>
              <label className="block text-sm font-medium text-white/90 mb-3 text-right">
                البريد الإلكتروني
              </label>
              <input
                ref={emailInputRef}
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
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

            {/* Password Field */}
            <div>
              <label className="block text-sm font-medium text-white/90 mb-3 text-right">
                كلمة المرور
              </label>
              <div className="relative">
                <input
                  ref={passwordInputRef}
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  className={`w-full px-4 py-4 pr-12 bg-white/10 border rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all text-right text-white placeholder-white/50 ${
                    errors.password ? 'border-red-400' : 'border-white/20'
                  }`}
                  placeholder="أدخل كلمة المرور"
                  disabled={isSubmitting}
                  autoComplete="new-password"
                  dir="rtl"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-4 top-1/2 transform -translate-y-1/2 p-2 text-white/60 hover:text-white transition-colors"
                  disabled={isSubmitting}
                  aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                  title={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="mt-2 text-sm text-red-300 text-right">{errors.password}</p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full py-4 px-6 rounded-2xl font-semibold text-white transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                isSubmitting
                  ? 'bg-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 active:scale-95 shadow-lg'
              }`}
            >
              {isSubmitting ? (
                <div className="flex items-center justify-center gap-3">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>جاري الدخول...</span>
                </div>
              ) : (
                <span>دخول</span>
              )}
            </button>
          </form>

          {/* Additional Options */}
          <div className="mt-8 space-y-4">
            {/* Email Actions Links */}
            <div className="text-center space-y-2">
              {showResendLink && (
                <button
                  type="button"
                  onClick={() => navigate('/email-actions?action=resend')}
                  disabled={isSubmitting}
                  className="block w-full text-white/60 hover:text-white text-sm transition-colors disabled:opacity-50"
                >
                  إعادة إرسال رابط التفعيل
                </button>
              )}
              <button
                type="button"
                onClick={() => navigate('/email-actions?action=forgot')}
                disabled={isSubmitting}
                className="block w-full text-white/60 hover:text-white text-sm transition-colors disabled:opacity-50"
              >
                نسيت كلمة المرور؟
              </button>
            </div>

            {/* Register Link */}
            <div className="text-center">
              <button
                type="button"
                onClick={() => navigate('/register')}
                disabled={isSubmitting}
                className="text-white/80 hover:text-white font-medium text-sm transition-colors disabled:opacity-50"
              >
                ليس لديك حساب؟ سجل منشأتك الآن
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
