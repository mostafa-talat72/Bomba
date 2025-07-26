import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';

const LoginForm: React.FC = () => {
  const { login, isLoading } = useApp();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState('cafe');
  const [isRegister, setIsRegister] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    if (isRegister) {
      // تحقق من الحقول قبل الإرسال
      if (!name.trim() || !businessName.trim() || !email.trim() || !password.trim()) {
        setError('يرجى ملء جميع الحقول المطلوبة.');
        return;
      }
      // تحقق من صحة البريد الإلكتروني
      const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
      if (!emailRegex.test(email)) {
        setError('يرجى إدخال بريد إلكتروني صحيح.');
        return;
      }
      // تحقق من قوة كلمة المرور
      if (password.length < 6) {
        setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل.');
        return;
      }
      if (!['cafe', 'restaurant', 'playstation'].includes(businessType)) {
        setError('يرجى اختيار نوع نشاط صحيح.');
        return;
      }
      // منطق التسجيل
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            email,
            password,
            role: 'owner',
            businessName,
            businessType
          })
        });
        const data = await res.json();
        if (data.success) {
          setSuccessMessage('تم إرسال رابط التفعيل إلى بريدك الإلكتروني. يرجى تفعيل الحساب قبل تسجيل الدخول.');
          setIsRegister(false);
          setName('');
          setBusinessName('');
          setBusinessType('cafe');
          setEmail('');
          setPassword('');
        } else {
          if (data.message && data.message.includes('فشل إرسال رسالة التفعيل')) {
            setError('تعذر إرسال رسالة التفعيل إلى بريدك الإلكتروني. يرجى التأكد من صحة البريد أو المحاولة لاحقًا.');
          } else {
            setError(data.message || 'حدث خطأ أثناء التسجيل.');
          }
        }
      } catch {
        setError('حدث خطأ أثناء التسجيل. حاول مرة أخرى.');
      }
    } else {
      // منطق تسجيل الدخول
      const response = await login(email, password);
      if (!response.success) {
        if (response.message?.includes('الحساب غير مفعل')) {
          setError('الحساب غير مفعل. يرجى تفعيل بريدك الإلكتروني أولاً.');
        } else if (response.message) {
          setError(response.message);
        } else {
          setError('حدث خطأ أثناء تسجيل الدخول. حاول مرة أخرى.');
        }
      } else {
        navigate('/dashboard', { replace: true });
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-600 via-blue-500 to-indigo-700 p-4">
      <form onSubmit={handleSubmit} className="relative bg-white/90 backdrop-blur-md rounded-3xl shadow-2xl p-10 max-w-md w-full border border-gray-100">
        {/* أيقونة أعلى النموذج */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-20 h-20 bg-gradient-to-br from-primary-500 to-indigo-500 rounded-full flex items-center justify-center shadow-lg mb-2 animate-bounce-slow">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M9 7a4 4 0 108 0 4 4 0 00-8 0z" /></svg>
          </div>
          <h2 className="text-3xl font-extrabold text-gray-900 mb-1 tracking-tight drop-shadow">{isRegister ? 'تسجيل منشأة جديدة' : 'تسجيل الدخول'}</h2>
          <p className="text-gray-500 text-sm font-medium mb-2">{isRegister ? 'ابدأ رحلتك مع نظام بومبا' : 'مرحباً بك من جديد في نظام بومبا'}</p>
        </div>
        {successMessage && (
          <div className="mb-4 flex items-center gap-2 bg-green-100 border border-green-300 text-green-800 rounded-xl px-4 py-3 text-center shadow">
            <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            <span>{successMessage}</span>
          </div>
        )}
        {error && (
          <div className="mb-4 flex items-center gap-2 bg-red-100 border border-red-300 text-red-800 rounded-xl px-4 py-3 text-center shadow">
            <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            <span>{error}</span>
          </div>
        )}
        {isRegister ? (
          <>
            <div className="mb-4">
              <label className="block mb-1 text-right font-semibold text-gray-700">اسم المالك</label>
              <input
                type="text"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 bg-gray-50"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="mb-4">
              <label className="block mb-1 text-right font-semibold text-gray-700">اسم المنشأة</label>
              <input
                type="text"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 bg-gray-50"
                value={businessName}
                onChange={e => setBusinessName(e.target.value)}
                required
              />
            </div>
            <div className="mb-4">
              <label className="block mb-1 text-right font-semibold text-gray-700">نوع النشاط</label>
              <select
                className="w-full border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 bg-gray-50"
                value={businessType}
                onChange={e => setBusinessType(e.target.value)}
                required
              >
                <option value="cafe">كافيه</option>
                <option value="restaurant">مطعم</option>
                <option value="playstation">بلايستيشن</option>
              </select>
            </div>
            <div className="mb-4">
              <label className="block mb-1 text-right font-semibold text-gray-700">البريد الإلكتروني</label>
              <input
                type="email"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 bg-gray-50"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="mb-6">
              <label className="block mb-1 text-right font-semibold text-gray-700">كلمة المرور</label>
              <input
                type="password"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 bg-gray-50"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
          </>
        ) : (
          <>
            <div className="mb-4">
              <label className="block mb-1 text-right font-semibold text-gray-700">البريد الإلكتروني</label>
              <input
                type="email"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 bg-gray-50"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="mb-6">
              <label className="block mb-1 text-right font-semibold text-gray-700">كلمة المرور</label>
              <input
                type="password"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 bg-gray-50"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
          </>
        )}
        <button
          type="submit"
          className="w-full bg-gradient-to-r from-primary-600 to-indigo-600 text-white py-3 rounded-2xl font-bold text-lg shadow-lg hover:from-primary-700 hover:to-indigo-700 transition-all duration-200 active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary-400 mb-4"
          disabled={isLoading}
        >
          {isLoading ? (isRegister ? 'جاري التسجيل...' : 'جاري الدخول...') : (isRegister ? 'تسجيل' : 'دخول')}
        </button>
        <div className="text-center mt-2">
          <button
            type="button"
            className="text-primary-700 hover:underline text-sm font-semibold transition-colors"
            onClick={() => { setIsRegister(r => !r); setError(null); setSuccessMessage(null); }}
          >
            {isRegister ? 'لديك حساب بالفعل؟ تسجيل الدخول' : 'ليس لديك حساب؟ سجل منشأتك الآن'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default LoginForm;
