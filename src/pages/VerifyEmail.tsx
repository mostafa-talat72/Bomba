import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

const VerifyEmail: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      setMessage('رابط التفعيل غير صالح أو مفقود.');
      return;
    }
    const verify = async () => {
      try {
        // إرسال الطلب مباشرة إلى backend
        const res = await fetch(`http://localhost:5000/api/auth/verify-email?token=${token}`);
        const data = await res.json();
        console.log('[VERIFY][FRONTEND_RESPONSE]', data);
        if (data.success) {
          setStatus('success');
          setMessage(data.message || 'تم تفعيل الحساب بنجاح. يمكنك الآن تسجيل الدخول.');
        } else if (data.message && data.message.includes('الحساب مفعل بالفعل')) {
          setStatus('success');
          setMessage('تم تفعيل الحساب بالفعل. يمكنك الآن تسجيل الدخول.');
        } else {
          setStatus('error');
          setMessage(data.message || 'رابط التفعيل غير صالح أو منتهي.');
        }
      } catch {
        setStatus('error');
        setMessage('حدث خطأ أثناء تفعيل الحساب. حاول مرة أخرى لاحقاً.');
      }
    };
    verify();
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
        {status === 'loading' && (
          <>
            <div className="w-16 h-16 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">جاري التحقق من الحساب...</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            </div>
            <h2 className="text-xl font-bold text-green-700 mb-2">تم تفعيل الحساب</h2>
            <p className="text-gray-700 mb-4">{message}</p>
            <a href="/" className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">تسجيل الدخول</a>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
            </div>
            <h2 className="text-xl font-bold text-red-700 mb-2">فشل التفعيل</h2>
            <p className="text-gray-700 mb-4">{message}</p>
            <a href="/" className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">العودة للرئيسية</a>
          </>
        )}
      </div>
    </div>
  );
};

export default VerifyEmail;
