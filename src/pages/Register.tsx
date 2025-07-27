import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface FormData {
  name: string;
  businessName: string;
  email: string;
  password: string;
}

interface FormErrors {
  name?: string;
  businessName?: string;
  email?: string;
  password?: string;
}

const Register: React.FC = () => {
  const navigate = useNavigate();

  // State management
  const [formData, setFormData] = useState<FormData>({
    name: '',
    businessName: '',
    email: '',
    password: ''
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Refs
  const nameInputRef = useRef<HTMLInputElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

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

    if (!formData.name.trim()) {
      newErrors.name = 'اسم المالك مطلوب';
    }

    if (!formData.businessName.trim()) {
      newErrors.businessName = 'اسم المنشأة مطلوب';
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
  }, [formData]);

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
        // Don't clear form immediately to show success message
        setFormData({
          name: '',
          businessName: '',
          email: '',
          password: ''
        });
        setErrors({});
      } else {
        if (data.message?.includes('فشل إرسال رسالة التفعيل')) {
          setErrors({ email: 'تعذر إرسال رسالة التفعيل. يرجى التأكد من صحة البريد أو المحاولة لاحقًا.' });
        } else if (data.message?.includes('موجود')) {
          setErrors({ email: 'البريد الإلكتروني مسجل بالفعل في النظام.' });
        } else {
          setErrors({ email: data.message || 'حدث خطأ أثناء التسجيل.' });
        }
      }
    } catch {
      setErrors({
        email: 'حدث خطأ أثناء التسجيل. حاول مرة أخرى.'
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, validateForm, clearForm]);

  // Auto-focus name field on mount
  useEffect(() => {
    if (nameInputRef.current) {
      setTimeout(() => nameInputRef.current?.focus(), 100);
    }
  }, []);

  // Clear success message after 5 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 p-4">
      <div className="relative w-full max-w-md">
        {/* Background decoration */}
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-3xl blur-3xl"></div>

        {/* Main card */}
        <div className="relative bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-blue-600 rounded-full flex items-center justify-center shadow-lg mx-auto mb-6">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">
              تسجيل منشأة جديدة
            </h1>
            <p className="text-white/80 text-sm">
              ابدأ رحلتك مع نظام بومبا
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
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Owner Name Field */}
            <div>
              <label className="block text-sm font-medium text-white/90 mb-3 text-right">
                اسم المالك
              </label>
              <input
                ref={nameInputRef}
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className={`w-full px-4 py-4 bg-white/10 border rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all text-right text-white placeholder-white/50 ${
                  errors.name ? 'border-red-400' : 'border-white/20'
                }`}
                placeholder="أدخل اسم المالك"
                disabled={isSubmitting}
                autoComplete="name"
                dir="rtl"
              />
              {errors.name && (
                <p className="mt-2 text-sm text-red-300 text-right">{errors.name}</p>
              )}
            </div>

            {/* Business Name Field */}
            <div>
              <label className="block text-sm font-medium text-white/90 mb-3 text-right">
                اسم المنشأة
              </label>
              <input
                type="text"
                value={formData.businessName}
                onChange={(e) => handleInputChange('businessName', e.target.value)}
                className={`w-full px-4 py-4 bg-white/10 border rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all text-right text-white placeholder-white/50 ${
                  errors.businessName ? 'border-red-400' : 'border-white/20'
                }`}
                placeholder="أدخل اسم المنشأة"
                disabled={isSubmitting}
                autoComplete="organization"
                dir="rtl"
              />
              {errors.businessName && (
                <p className="mt-2 text-sm text-red-300 text-right">{errors.businessName}</p>
              )}
            </div>

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
                  : 'bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 active:scale-95 shadow-lg'
              }`}
            >
              {isSubmitting ? (
                <div className="flex items-center justify-center gap-3">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>جاري التسجيل...</span>
                </div>
              ) : (
                <span>تسجيل</span>
              )}
            </button>
          </form>

          {/* Login Link */}
          <div className="mt-8 text-center">
            <button
              type="button"
              onClick={() => navigate('/login')}
              disabled={isSubmitting}
              className="text-white/80 hover:text-white font-medium text-sm transition-colors disabled:opacity-50"
            >
              لديك حساب بالفعل؟ تسجيل الدخول
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
