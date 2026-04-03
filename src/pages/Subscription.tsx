import { useState, useEffect } from 'react';
import { Card, Button, Tag, Alert, Spin } from 'antd';
import { CheckCircleOutlined, ClockCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { useApp } from '../context/AppContext';
import { useLanguage } from '../context/LanguageContext';
import { useOrganization } from '../context/OrganizationContext';
import api from '../services/api';

interface SubscriptionPlan {
  id: string;
  name: string;
  nameEn: string;
  nameFr: string;
  duration: number;
  price: number;
  features: {
    ar: string[];
    en: string[];
    fr: string[];
  };
}

const plans: SubscriptionPlan[] = [
  {
    id: 'trial',
    name: 'باقة تجريبية',
    nameEn: 'Trial Plan',
    nameFr: 'Plan d\'essai',
    duration: 30,
    price: 0,
    features: {
      ar: [
        'تجربة مجانية لمدة 30 يوم',
        'جميع المميزات الأساسية',
        'إدارة الطاولات والجلسات',
        'نظام الطلبات والفواتير',
        'دعم فني محدود'
      ],
      en: [
        '30-day free trial',
        'All basic features',
        'Tables and sessions management',
        'Orders and billing system',
        'Limited technical support'
      ],
      fr: [
        'Essai gratuit de 30 jours',
        'Toutes les fonctionnalités de base',
        'Gestion des tables et sessions',
        'Système de commandes et facturation',
        'Support technique limité'
      ]
    }
  },
  {
    id: 'monthly',
    name: 'باقة شهرية',
    nameEn: 'Monthly Plan',
    nameFr: 'Plan mensuel',
    duration: 30,
    price: 299,
    features: {
      ar: [
        'جميع المميزات الأساسية',
        'إدارة الطاولات والجلسات',
        'نظام الطلبات والفواتير',
        'التقارير والإحصائيات',
        'دعم فني على مدار الساعة'
      ],
      en: [
        'All basic features',
        'Tables and sessions management',
        'Orders and billing system',
        'Reports and statistics',
        '24/7 technical support'
      ],
      fr: [
        'Toutes les fonctionnalités de base',
        'Gestion des tables et sessions',
        'Système de commandes et facturation',
        'Rapports et statistiques',
        'Support technique 24/7'
      ]
    }
  },
  {
    id: 'yearly',
    name: 'باقة سنوية',
    nameEn: 'Yearly Plan',
    nameFr: 'Plan annuel',
    duration: 365,
    price: 2999,
    features: {
      ar: [
        'جميع مميزات الباقة الشهرية',
        'خصم 17% على السعر السنوي',
        'أولوية في الدعم الفني',
        'تحديثات مجانية طوال العام',
        'نسخ احتياطي يومي تلقائي'
      ],
      en: [
        'All monthly plan features',
        '17% discount on annual price',
        'Priority technical support',
        'Free updates all year',
        'Automatic daily backups'
      ],
      fr: [
        'Toutes les fonctionnalités du plan mensuel',
        '17% de réduction sur le prix annuel',
        'Support technique prioritaire',
        'Mises à jour gratuites toute l\'année',
        'Sauvegardes quotidiennes automatiques'
      ]
    }
  }
];

const Subscription = () => {
  const { t } = useTranslation();
  const { currentLanguage, isRTL } = useLanguage();
  const { formatDate: formatOrgDate } = useOrganization();
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

  useEffect(() => {
    if (!loadingSubscription && subscriptionStatus === 'active' && daysLeft !== null) {
      if (daysLeft > 5) {
        const timer = setTimeout(() => {
          navigate('/dashboard');
        }, 2000);
        
        return () => clearTimeout(timer);
      }
    }
  }, [subscriptionStatus, loadingSubscription, daysLeft, navigate]);

  const fetchCurrentSubscription = async () => {
    try {
      setLoadingSubscription(true);
      const response = await api.get('/billing/subscription/status');
      
      if (response?.data?.subscription) {
        setCurrentSubscription(response.data.subscription);
        
        const endDate = new Date(response.data.subscription.endDate);
        const now = new Date();
        const days = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        setDaysLeft(days);
      }
      
      if (response?.data?.userRole) {
        setUserRole(response.data.userRole);
      }
    } catch (error: any) {
      console.error('Error fetching subscription:', error);
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
        toast.success(response.data.message || t('subscription.activatedSuccessfully'));
        
        const newEndDate = new Date(response.data.subscription.endDate);
        const now = new Date();
        const newDaysLeft = Math.ceil((newEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        if (newDaysLeft > 5) {
          setTimeout(() => {
            navigate('/dashboard');
          }, 1000);
        } else {
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        }
      } else if (response.data.paymentUrl) {
        window.location.href = response.data.paymentUrl;
      } else {
        toast.success(t('subscription.requestCreated'));
        
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || t('subscription.errorCreating'));
      setLoading(false);
    }
  };

  const getStatusTag = () => {
    if (subscriptionStatus === 'active') {
      return <Tag icon={<CheckCircleOutlined />} color="success">{t('subscription.status.active')}</Tag>;
    } else if (subscriptionStatus === 'pending') {
      return <Tag icon={<ClockCircleOutlined />} color="warning">{t('subscription.status.pending')}</Tag>;
    } else {
      return <Tag icon={<CloseCircleOutlined />} color="error">{t('subscription.status.expired')}</Tag>;
    }
  };

  const getPlanName = (plan: SubscriptionPlan) => {
    if (currentLanguage === 'ar') return plan.name;
    if (currentLanguage === 'fr') return plan.nameFr;
    return plan.nameEn;
  };

  const getPlanFeatures = (plan: SubscriptionPlan) => {
    if (currentLanguage === 'ar') return plan.features.ar;
    if (currentLanguage === 'fr') return plan.features.fr;
    return plan.features.en;
  };

  const formatDate = (date: string) => {
    const dateObj = new Date(date);
    return formatOrgDate(dateObj);
  };

  const getCurrentPlanName = (planId: string) => {
    if (planId === 'trial') return t('subscription.plans.trial');
    if (planId === 'monthly') return t('subscription.plans.monthly');
    return t('subscription.plans.yearly');
  };

  if (loadingSubscription) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  if (subscriptionStatus === 'active' && daysLeft !== null && daysLeft > 5) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="max-w-md w-full">
          <Alert
            message={t('subscription.activeTitle')}
            description={
              <div className="text-center py-4">
                <div className="text-6xl mb-4">✅</div>
                <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">
                  {t('subscription.activeMessage')}
                </h2>
                <p className="text-gray-600 dark:text-gray-400 text-lg mb-4">
                  {t('subscription.redirecting')}
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="max-w-6xl mx-auto">
        {subscriptionStatus === 'expired' && userRole !== 'owner' && userRole !== 'admin' && (
          <div className="max-w-2xl mx-auto">
            <Alert
              message={t('subscription.expiredForStaff.title')}
              description={
                <div className="text-center py-8">
                  <div className="text-6xl mb-4">🔒</div>
                  <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">
                    {t('subscription.expiredForStaff.message')}
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400 text-lg mb-6">
                    {t('subscription.expiredForStaff.contactAdmin')}
                  </p>
                  <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-4 mt-6">
                    <p className="text-blue-800 dark:text-blue-200">
                      <strong>{t('subscription.expiredForStaff.noteTitle')}:</strong> {t('subscription.expiredForStaff.noteMessage')}
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

        {(userRole === 'owner' || userRole === 'admin' || subscriptionStatus === 'active') && (
          <>
            <div className="text-center mb-8">
              <h1 className="text-3xl md:text-4xl font-bold text-gray-800 dark:text-gray-100 mb-4">
                {t('subscription.title')}
              </h1>
              <p className="text-gray-600 dark:text-gray-400 text-lg">
                {t('subscription.subtitle')}
              </p>
            </div>

            {currentSubscription && (
              <Alert
                message={t('subscription.currentStatus')}
                description={
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="text-gray-800 dark:text-gray-200">
                      <p className="mb-1">
                        <strong>{t('subscription.plan')}:</strong> {getCurrentPlanName(currentSubscription.plan)}
                      </p>
                      <p className="mb-1">
                        <strong>{t('subscription.endDate')}:</strong> {formatDate(currentSubscription.endDate)}
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

            {subscriptionStatus === 'expired' && (
              <Alert
                message={t('subscription.expiredTitle')}
                description={t('subscription.expiredMessage')}
                type="error"
                className="mb-8"
                showIcon
              />
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {plans.map((plan) => (
                <Card
                  key={plan.id}
                  className={`shadow-lg hover:shadow-xl transition-shadow bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 ${
                    plan.id === 'yearly' ? 'border-2 border-orange-500 dark:border-orange-400' : ''
                  }`}
                  title={
                    <div className="text-center py-4">
                      {plan.id === 'yearly' && (
                        <div className="mb-2">
                          <Tag color="orange">{t('subscription.mostPopular')}</Tag>
                        </div>
                      )}
                      <h2 className="text-2xl font-bold text-orange-600 dark:text-orange-400">{getPlanName(plan)}</h2>
                      <div className="mt-4">
                        <span className="text-4xl font-bold text-gray-800 dark:text-gray-100">{plan.price}</span>
                        <span className="text-gray-600 dark:text-gray-400 mx-2">{t('common.currency')}</span>
                      </div>
                      <p className="text-gray-500 dark:text-gray-400 mt-2">
                        {plan.duration === 30 ? (plan.price === 0 ? t('subscription.free') : t('subscription.monthly')) : t('subscription.yearly')}
                      </p>
                    </div>
                  }
                >
                  <div className="space-y-4">
                    <ul className="space-y-3">
                      {getPlanFeatures(plan).map((feature, index) => (
                        <li key={index} className="flex items-start">
                          <CheckCircleOutlined className={`text-green-500 dark:text-green-400 ${isRTL ? 'ml-2' : 'mr-2'} mt-1`} />
                          <span className="text-gray-700 dark:text-gray-300">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <Button
                      type="primary"
                      size="large"
                      block
                      loading={loading}
                      onClick={() => handleSubscribe(plan.id)}
                      className="mt-6 bg-orange-500 hover:bg-orange-600 dark:bg-orange-600 dark:hover:bg-orange-700 border-orange-500 dark:border-orange-600"
                      disabled={
                        (subscriptionStatus === 'active' && currentSubscription?.plan === plan.id) ||
                        plan.id === 'trial'
                      }
                    >
                      {plan.id === 'trial'
                        ? t('subscription.autoOnRegister')
                        : subscriptionStatus === 'active' && currentSubscription?.plan === plan.id
                        ? t('subscription.currentPlan')
                        : t('subscription.subscribeNow')}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>

            <div className="mt-12 text-center">
              <Card className="bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700">
                <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">
                  {t('subscription.paymentMethods')}
                </h3>
                <div className="flex items-center justify-center gap-8 flex-wrap">
                  <div className="text-center">
                    <div className="text-3xl mb-2">💳</div>
                    <p className="text-gray-700 dark:text-gray-300">{t('subscription.fawry')}</p>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl mb-2">🏦</div>
                    <p className="text-gray-700 dark:text-gray-300">{t('subscription.bankTransfer')}</p>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl mb-2">📱</div>
                    <p className="text-gray-700 dark:text-gray-300">{t('subscription.eWallets')}</p>
                  </div>
                </div>
              </Card>
            </div>

            <div className="mt-8 text-center text-gray-600 dark:text-gray-400">
              <p>{t('subscription.supportMessage')}</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Subscription;
