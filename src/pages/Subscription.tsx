import { useState, useEffect } from 'react';
import { Card, Button, Tag, Alert, Spin } from 'antd';
import { CheckCircleOutlined, ClockCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { useApp } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { toast } from 'react-toastify';

interface SubscriptionPlan {
  id: string;
  name: string;
  nameEn: string;
  duration: number;
  price: number;
  features: string[];
}

const plans: SubscriptionPlan[] = [
  {
    id: 'trial',
    name: 'باقة تجريبية',
    nameEn: 'Trial Plan',
    duration: 30,
    price: 0,
    features: [
      'تجربة مجانية لمدة 30 يوم',
      'جميع المميزات الأساسية',
      'إدارة الطاولات والجلسات',
      'نظام الطلبات والفواتير',
      'دعم فني محدود'
    ]
  },
  {
    id: 'monthly',
    name: 'باقة شهرية',
    nameEn: 'Monthly Plan',
    duration: 30,
    price: 299,
    features: [
      'جميع المميزات الأساسية',
      'إدارة الطاولات والجلسات',
      'نظام الطلبات والفواتير',
      'التقارير والإحصائيات',
      'دعم فني على مدار الساعة'
    ]
  },
  {
    id: 'yearly',
    name: 'باقة سنوية',
    nameEn: 'Yearly Plan',
    duration: 365,
    price: 2999,
    features: [
      'جميع مميزات الباقة الشهرية',
      'خصم 17% على السعر السنوي',
      'أولوية في الدعم الفني',
      'تحديثات مجانية طوال العام',
      'نسخ احتياطي يومي تلقائي'
    ]
  }
];

const Subscription = () => {
  const { subscriptionStatus, user } = useApp();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [currentSubscription, setCurrentSubscription] = useState<any>(null);
  const [loadingSubscription, setLoadingSubscription] = useState(true);
  const [userRole, setUserRole] = useState<string>('');
  const [daysLeft, setDaysLeft] = useState<number | null>(null);

  useEffect(() => {
    fetchCurrentSubscription();
  }, []);

  // توجيه تلقائي للـ Dashboard إذا كان الاشتراك نشط وليس في فترة التحذير
  useEffect(() => {
    if (!loadingSubscription && subscriptionStatus === 'active' && daysLeft !== null) {
      // إذا كان باقي أكثر من 5 أيام، وجه للـ Dashboard
      if (daysLeft > 5) {
        const timer = setTimeout(() => {
          navigate('/dashboard');
        }, 2000);
        
        return () => clearTimeout(timer);
      }
      // إذا كان 5 أيام أو أقل، لا توجيه (يبقى في صفحة الاشتراكات للتجديد)
    }
  }, [subscriptionStatus, loadingSubscription, daysLeft, navigate]);

  const fetchCurrentSubscription = async () => {
    try {
      setLoadingSubscription(true);
      const response = await api.get('/billing/subscription/status');
      
      // تعيين معلومات الاشتراك
      if (response?.data?.subscription) {
        setCurrentSubscription(response.data.subscription);
        
        // حساب الأيام المتبقية
        const endDate = new Date(response.data.subscription.endDate);
        const now = new Date();
        const days = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        setDaysLeft(days);
      }
      
      // تعيين دور المستخدم
      if (response?.data?.userRole) {
        setUserRole(response.data.userRole);
      }
    } catch (error: any) {
      console.error('Error fetching subscription:', error);
      // في حالة الخطأ، نفترض أن الاشتراك منتهي
      setUserRole(user?.role || 'staff');
    } finally {
      setLoadingSubscription(false);
    }
  };

  const handleSubscribe = async (planId: string) => {
    try {
      setLoading(true);
      const response = await api.post('/billing/subscription/payment', {
        plan: planId
      });

      if (response.data.developmentMode) {
        // وضع التطوير: تم التفعيل مباشرة
        toast.success(response.data.message || 'تم تفعيل الاشتراك بنجاح!');
        
        // حساب الأيام المتبقية من الاشتراك الجديد
        const newEndDate = new Date(response.data.subscription.endDate);
        const now = new Date();
        const newDaysLeft = Math.ceil((newEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        // إذا كان الاشتراك الجديد أكثر من 5 أيام، وجه للـ Dashboard
        if (newDaysLeft > 5) {
          setTimeout(() => {
            navigate('/dashboard');
          }, 1000);
        } else {
          // إذا كان 5 أيام أو أقل، أعد تحميل الصفحة لتحديث البيانات
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        }
      } else if (response.data.paymentUrl) {
        // وضع الإنتاج: توجيه لصفحة الدفع
        window.location.href = response.data.paymentUrl;
      } else {
        toast.success('تم إنشاء طلب الاشتراك بنجاح');
        
        // تحديث الصفحة بعد ثانية واحدة
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'حدث خطأ أثناء إنشاء الاشتراك');
      setLoading(false); // فقط في حالة الخطأ نوقف loading
    }
  };

  const getStatusTag = () => {
    if (subscriptionStatus === 'active') {
      return <Tag icon={<CheckCircleOutlined />} color="success">نشط</Tag>;
    } else if (subscriptionStatus === 'pending') {
      return <Tag icon={<ClockCircleOutlined />} color="warning">قيد الانتظار</Tag>;
    } else {
      return <Tag icon={<CloseCircleOutlined />} color="error">منتهي</Tag>;
    }
  };

  if (loadingSubscription) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  // رسالة توجيه للمستخدمين عند الاشتراك النشط (فقط إذا كان باقي أكثر من 5 أيام)
  if (subscriptionStatus === 'active' && daysLeft !== null && daysLeft > 5) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <Alert
            message="اشتراكك نشط"
            description={
              <div className="text-center py-4">
                <div className="text-6xl mb-4">✅</div>
                <h2 className="text-2xl font-bold text-gray-800 mb-4">
                  اشتراكك نشط ومفعّل
                </h2>
                <p className="text-gray-600 text-lg mb-4">
                  جاري توجيهك إلى لوحة التحكم...
                </p>
                <Spin />
              </div>
            }
            type="success"
            showIcon
            className="shadow-lg"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* رسالة للموظفين عند انتهاء الاشتراك */}
        {subscriptionStatus === 'expired' && userRole !== 'owner' && userRole !== 'admin' && (
          <div className="max-w-2xl mx-auto">
            <Alert
              message="انتهى اشتراك المنشأة"
              description={
                <div className="text-center py-8">
                  <div className="text-6xl mb-4">🔒</div>
                  <h2 className="text-2xl font-bold text-gray-800 mb-4">
                    عذراً، انتهى اشتراك المنشأة
                  </h2>
                  <p className="text-gray-600 text-lg mb-6">
                    يرجى التواصل مع مدير المنشأة لتجديد الاشتراك
                  </p>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
                    <p className="text-blue-800">
                      <strong>ملاحظة:</strong> سيتم استعادة الوصول الكامل للنظام فور تجديد الاشتراك من قبل المدير
                    </p>
                  </div>
                </div>
              }
              type="warning"
              showIcon
              className="shadow-lg"
            />
          </div>
        )}

        {/* صفحة الاشتراكات للمدير فقط */}
        {(userRole === 'owner' || userRole === 'admin' || subscriptionStatus === 'active') && (
          <>
            <div className="text-center mb-8">
              <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4">
                باقات الاشتراك
              </h1>
              <p className="text-gray-600 text-lg">
                اختر الباقة المناسبة لاحتياجات منشأتك
              </p>
            </div>

            {currentSubscription && (
              <Alert
                message="حالة الاشتراك الحالي"
                description={
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="mb-1">
                        <strong>الباقة:</strong> {currentSubscription.plan === 'trial' ? 'تجريبية' : currentSubscription.plan === 'monthly' ? 'شهرية' : 'سنوية'}
                      </p>
                      <p className="mb-1">
                        <strong>تاريخ الانتهاء:</strong> {new Date(currentSubscription.endDate).toLocaleDateString('ar-EG')}
                      </p>
                    </div>
                    <div>{getStatusTag()}</div>
                  </div>
                }
                type={subscriptionStatus === 'active' ? 'success' : 'warning'}
                className="mb-8"
                showIcon
              />
            )}
          </>
        )}

        {(userRole === 'owner' || userRole === 'admin' || subscriptionStatus === 'active') && (
          <>        {subscriptionStatus === 'expired' && (
          <Alert
            message="انتهى اشتراكك"
            description="يرجى تجديد الاشتراك للاستمرار في استخدام النظام"
            type="error"
            className="mb-8"
            showIcon
          />
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <Card
              key={plan.id}
              className={`shadow-lg hover:shadow-xl transition-shadow ${
                plan.id === 'yearly' ? 'border-2 border-orange-500' : ''
              }`}
              title={
                <div className="text-center py-4">
                  {plan.id === 'yearly' && (
                    <div className="mb-2">
                      <Tag color="orange">الأكثر شعبية</Tag>
                    </div>
                  )}
                  <h2 className="text-2xl font-bold text-orange-600">{plan.name}</h2>
                  <div className="mt-4">
                    <span className="text-4xl font-bold text-gray-800">{plan.price}</span>
                    <span className="text-gray-600 mr-2">جنيه</span>
                  </div>
                  <p className="text-gray-500 mt-2">
                    {plan.duration === 30 ? (plan.price === 0 ? 'مجاناً' : 'شهرياً') : 'سنوياً'}
                  </p>
                </div>
              }
            >
              <div className="space-y-4">
                <ul className="space-y-3">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start">
                      <CheckCircleOutlined className="text-green-500 ml-2 mt-1" />
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  type="primary"
                  size="large"
                  block
                  loading={loading}
                  onClick={() => handleSubscribe(plan.id)}
                  className="mt-6 bg-orange-500 hover:bg-orange-600 border-orange-500"
                  disabled={
                    (subscriptionStatus === 'active' && currentSubscription?.plan === plan.id) ||
                    plan.id === 'trial'
                  }
                >
                  {plan.id === 'trial'
                    ? 'تلقائي عند التسجيل'
                    : subscriptionStatus === 'active' && currentSubscription?.plan === plan.id
                    ? 'الباقة الحالية'
                    : 'اشترك الآن'}
                </Button>
              </div>
            </Card>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Card className="bg-blue-50 border-blue-200">
            <h3 className="text-xl font-bold text-gray-800 mb-4">
              طرق الدفع المتاحة
            </h3>
            <div className="flex items-center justify-center gap-8 flex-wrap">
              <div className="text-center">
                <div className="text-3xl mb-2">💳</div>
                <p className="text-gray-700">فوري</p>
              </div>
              <div className="text-center">
                <div className="text-3xl mb-2">🏦</div>
                <p className="text-gray-700">تحويل بنكي</p>
              </div>
              <div className="text-center">
                <div className="text-3xl mb-2">📱</div>
                <p className="text-gray-700">محافظ إلكترونية</p>
              </div>
            </div>
          </Card>
        </div>

        <div className="mt-8 text-center text-gray-600">
          <p>لأي استفسارات أو مساعدة، يرجى التواصل مع الدعم الفني</p>
        </div>
        </>
        )}
      </div>
    </div>
  );
};

export default Subscription;
