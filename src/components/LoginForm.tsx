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
  const { login, isLoading } = useApp();
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
  }, []);

  // Handle input changes
  const handleInputChange = useCallback((field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear field-specific error
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  }, [errors]);

  // Prevent autocomplete from interfering
  const handleInputFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    // Ensure the input is stable
    e.target.setAttribute('data-focused', 'true');
  }, []);

  const handleInputBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    // Remove focus attribute after a delay
    setTimeout(() => {
      e.target.removeAttribute('data-focused');
    }, 100);
  }, []);

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
        const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/register`, {
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
          if (response.message?.includes('الحساب غير مفعل')) {
            setErrors({ email: 'الحساب غير مفعل. يرجى تفعيل بريدك الإلكتروني أولاً.' });
          } else {
            setErrors({ email: response.message || 'حدث خطأ أثناء تسجيل الدخول.' });
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
    // Don't clear form immediately to prevent autocomplete flickering
    setTimeout(() => {
      clearForm();
    }, 300);
  }, [clearForm]);

  // Auto-focus email field when switching to login
  useEffect(() => {
    if (!isRegister && emailRef.current) {
      setTimeout(() => emailRef.current?.focus(), 400);
    }
  }, [isRegister]);

  // Prevent form submission on Enter key in certain cases
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && isSubmitting) {
      e.preventDefault();
    }
  }, [isSubmitting]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-600 via-blue-500 to-indigo-700 p-4">
      <div className="relative bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl p-8 max-w-md w-full border border-gray-100">
        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-indigo-500 rounded-full flex items-center justify-center shadow-lg mb-4">
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
        <form ref={formRef} onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="space-y-4">
          {/* Register Fields */}
          {isRegister && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 text-right">
                  اسم المالك
                </label>
                                 <input
                   type="text"
                   value={formData.name}
                   onChange={(e) => handleInputChange('name', e.target.value)}
                   onFocus={handleInputFocus}
                   onBlur={handleInputBlur}
                   className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors ${
                     errors.name ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'
                   }`}
                   placeholder="أدخل اسم المالك"
                   disabled={isSubmitting}
                   autoComplete="off"
                   data-lpignore="true"
                   data-form-type="other"
                 />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-600 text-right">{errors.name}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 text-right">
                  اسم المنشأة
                </label>
                                 <input
                   type="text"
                   value={formData.businessName}
                   onChange={(e) => handleInputChange('businessName', e.target.value)}
                   onFocus={handleInputFocus}
                   onBlur={handleInputBlur}
                   className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors ${
                     errors.businessName ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'
                   }`}
                   placeholder="أدخل اسم المنشأة"
                   disabled={isSubmitting}
                   autoComplete="off"
                   data-lpignore="true"
                   data-form-type="other"
                 />
                {errors.businessName && (
                  <p className="mt-1 text-sm text-red-600 text-right">{errors.businessName}</p>
                )}
              </div>
            </>
          )}

          {/* Email Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 text-right">
              البريد الإلكتروني
            </label>
                         <input
               ref={emailRef}
               type="email"
               value={formData.email}
               onChange={(e) => handleInputChange('email', e.target.value)}
               onFocus={handleInputFocus}
               onBlur={handleInputBlur}
               className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors ${
                 errors.email ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'
               }`}
               placeholder="أدخل بريدك الإلكتروني"
               disabled={isSubmitting}
               autoComplete={isRegister ? "email" : "username"}
               data-lpignore="true"
             />
            {errors.email && (
              <p className="mt-1 text-sm text-red-600 text-right">{errors.email}</p>
            )}
          </div>

          {/* Password Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 text-right">
              كلمة المرور
            </label>
                         <input
               ref={passwordRef}
               type="password"
               value={formData.password}
               onChange={(e) => handleInputChange('password', e.target.value)}
               onFocus={handleInputFocus}
               onBlur={handleInputBlur}
               className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors ${
                 errors.password ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'
               }`}
               placeholder="أدخل كلمة المرور"
               disabled={isSubmitting}
               autoComplete={isRegister ? "new-password" : "current-password"}
               data-lpignore="true"
             />
            {errors.password && (
              <p className="mt-1 text-sm text-red-600 text-right">{errors.password}</p>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting || isLoading}
            className={`w-full py-3 px-4 rounded-xl font-semibold text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-400 ${
              isSubmitting || isLoading
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-700 hover:to-indigo-700 active:scale-95'
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
            className="text-primary-600 hover:text-primary-700 font-medium text-sm transition-colors disabled:opacity-50"
          >
            {isRegister ? 'لديك حساب بالفعل؟ تسجيل الدخول' : 'ليس لديك حساب؟ سجل منشأتك الآن'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;
