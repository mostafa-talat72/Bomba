import React, { useState, useEffect, useRef } from 'react';
import { Bell, Filter, Search, Eye, Trash2, X, Check, CheckCheck, AlertCircle, Info, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import PermissionGuard from '../components/PermissionGuard';
import { api } from '../services/api';
import { formatDecimal } from '../utils/formatters';
import { getLocaleFromLanguage } from '../utils/localeMapper';
import { useTranslation } from 'react-i18next';
import { useOrganization } from '../context/OrganizationContext';

interface Notification {
  _id: string;
  title: string;
  message: string;
  type: string;
  category: string;
  priority: string;
  createdAt: string;
  readBy: Array<{ user: string; readAt: string }>;
  createdBy?: { name: string };
  metadata?: {
    translations?: {
      ar?: { title: string; message: string };
      en?: { title: string; message: string };
      fr?: { title: string; message: string };
    };
    [key: string]: any;
  };
}

interface NotificationStats {
  total: number;
  unread: number;
  byCategory: Record<string, number>;
  byPriority: Record<string, number>;
}

const NotificationManagement = () => {
  const { t, i18n } = useTranslation();
  const { user, getNotifications, getNotificationStats, markNotificationAsRead, markAllNotificationsAsRead, deleteNotification, showNotification, isLoggingOut, orders, bills } = useApp() as any;
  const navigate = useNavigate();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [stats, setStats] = useState<NotificationStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterUnread, setFilterUnread] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isMarkingAllAsRead, setIsMarkingAllAsRead] = useState(false);

  // Helper function to format numbers based on language
  const formatNumber = (num: number) => {
    const locale = getLocaleFromLanguage(i18n.language);
    return new Intl.NumberFormat(locale).format(num);
  };

  // Use formatDateTime from OrganizationContext for timezone support
  const { formatDateTime } = useOrganization();

  // Helper function to get notification text based on current language
  const getNotificationText = (notification: Notification, field: 'title' | 'message') => {
    const currentLang = i18n.language;
    
    // Check if notification has translations object
    if (notification.metadata?.translations) {
      const translations = notification.metadata.translations;
      // Return translation for current language, fallback to Arabic, then to the field itself
      return translations[currentLang as 'ar' | 'en' | 'fr']?.[field] || translations['ar']?.[field] || notification[field];
    }
    
    // If no translations, return the original text (for old notifications)
    return notification[field];
  };

  const categories = [
    { id: 'all', name: t('notificationManagement.categories.all'), color: 'text-gray-600' },
    { id: 'session', name: t('notificationManagement.categories.session'), color: 'text-blue-600' },
    { id: 'order', name: t('notificationManagement.categories.order'), color: 'text-green-600' },
    { id: 'inventory', name: t('notificationManagement.categories.inventory'), color: 'text-orange-600' },
    { id: 'billing', name: t('notificationManagement.categories.billing'), color: 'text-purple-600' },
    { id: 'system', name: t('notificationManagement.categories.system'), color: 'text-red-600' },
    { id: 'security', name: t('notificationManagement.categories.security'), color: 'text-yellow-600' },
    { id: 'backup', name: t('notificationManagement.categories.backup'), color: 'text-teal-600' },
  ];

  const priorityStyles = {
    low: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
    medium: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
    high: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
    urgent: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
  };

  const typeIcons = {
    info: Info,
    success: CheckCircle,
    warning: AlertCircle,
    error: X,
    session: Bell,
    order: Bell,
    inventory: Bell,
    billing: Bell,
    system: Bell
  };

  // تعليم تلقائي كمقروء مرة واحدة عند فتح الصفحة فقط (وليس عند تغيير الفلاتر)
  const didAutoMarkRef = useRef(false);
  useEffect(() => {
    if (!user || isLoggingOut) return;
    loadNotifications();
    loadStats();
    if (!didAutoMarkRef.current) {
      didAutoMarkRef.current = true;
      (async () => {
        try {
          setIsMarkingAllAsRead(true);
          await markAllNotificationsAsRead();
          await loadNotifications();
          await loadStats();
        } catch { /* ignore */ }
        finally { setIsMarkingAllAsRead(false); }
      })();
    }
  }, [filterCategory, filterUnread, user, isLoggingOut]);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const options: { limit?: number; category?: string; unreadOnly?: boolean } = {
        limit: 100
      };

      if (filterCategory !== 'all') {
        options.category = filterCategory;
      }

      if (filterUnread) {
        options.unreadOnly = true;
      }

      const data = await getNotifications(options);
      setNotifications(data);
    } catch {
      // تجاهل الأخطاء إذا لم يكن المستخدم مصادق عليه أو أثناء تسجيل الخروج
      if (!user || isLoggingOut) return;
      showNotification(t('notificationManagement.messages.loadError'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const data = await getNotificationStats();
      if (data && typeof data === 'object' && 'total' in data && 'unread' in data) {
        setStats(data as NotificationStats);
      } else {
        setStats(null);
      }
    } catch {
      // تجاهل الأخطاء إذا لم يكن المستخدم مصادق عليه أو أثناء تسجيل الخروج
      if (!user || isLoggingOut) return;
      setStats(null);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await markNotificationAsRead(notificationId);
      await loadNotifications();
      await loadStats();
      showNotification(t('notificationManagement.messages.markedAsRead'), 'success');
    } catch {
      showNotification(t('notificationManagement.messages.markAsReadError'), 'error');
    }
  };

  const handleMarkAllAsRead = async () => {
    if (isMarkingAllAsRead) return; // تجنب الاستدعاءات المتكررة

    try {
      setIsMarkingAllAsRead(true);
      await markAllNotificationsAsRead();
      await loadNotifications();
      await loadStats();
      showNotification(t('notificationManagement.messages.allMarkedAsRead'), 'success');
    } catch {
      showNotification(t('notificationManagement.messages.allMarkAsReadError'), 'error');
    } finally {
      setIsMarkingAllAsRead(false);
    }
  };

  const handleDeleteNotification = async (notificationId: string) => {
    try {
      await deleteNotification(notificationId);
      setConfirmDeleteId(null);
      await loadNotifications();
      await loadStats();
      showNotification(t('notificationManagement.messages.deleted'), 'success');
    } catch {
      showNotification(t('notificationManagement.messages.deleteError'), 'error');
    }
  };

  // عرض الطلب من الإشعار (نفس سلوك نافذة الإشعارات)
  const handleViewOrder = async (n: Notification) => {
    const md = (n?.metadata || {}) as any;
    const orderId = md.orderId ? String(md.orderId) : '';
    const orderNumLabel = md.orderNumber ? `#${md.orderNumber}` : t('notificationManagement.actions.viewOrder');
    if (!orderId) return;
    try { await markNotificationAsRead(n._id); } catch { /* ignore */ }
    let order: any = (orders || []).find((o: any) => String(o._id || o.id) === orderId);
    if (!order) {
      try {
        const r: any = await api.getOrder(orderId);
        if (r?.success && r.data) order = r.data;
      } catch { /* ignore */ }
    }
    if (!order || !(order as any)._id) {
      showNotification(t('notificationCenter.messages.orderNotFound', { order: orderNumLabel }), 'error');
      return;
    }
    const bRef = (order as any).bill;
    const billId = bRef ? String((bRef as any)?._id || (bRef as any)?.id || bRef) : (md.billId ? String(md.billId) : '');
    let bill: any = billId ? (bills || []).find((b: any) => String(b._id || b.id) === billId) : null;
    if (!bill && billId) {
      try {
        const rb: any = await api.getBill(billId);
        if (rb?.success && rb.data) bill = rb.data;
      } catch { /* ignore */ }
    }
    if (!bill) {
      showNotification(t('notificationCenter.messages.billNotFound', { order: orderNumLabel }), 'error');
      return;
    }
    if ((bill as any)?.status === 'cancelled') {
      showNotification(t('notificationCenter.messages.billCancelled', { order: orderNumLabel }), 'error');
      return;
    }
    const fulfillment = (bill as any)?.fulfillmentType || (order as any)?.fulfillmentType || md.fulfillmentType || 'dine_in';
    const tRaw = (order as any)?.table ?? (bill as any)?.table ?? md.tableId ?? null;
    const tableId = tRaw ? String((tRaw as any)?._id || (tRaw as any)?.id || tRaw) : '';
    const realBillId = String((bill as any)._id || (bill as any).id || billId);
    const realOrderId = String((order as any)._id || (order as any).id || orderId);
    if ((bill as any)?.status === 'paid') {
      navigate(fulfillment === 'takeaway' ? '/takeaway' : fulfillment === 'delivery' ? '/delivery' : '/tables',
        { state: { openPaymentForBill: realBillId } });
      return;
    }
    if (tableId) {
      navigate('/tables', { state: { openTableModal: true, tableId, previewOrderId: realOrderId } });
      return;
    }
    navigate(fulfillment === 'delivery' ? '/delivery' : '/takeaway', { state: { openPaymentForBill: realBillId } });
  };

  const getFilteredNotifications = () => {
    if (!notifications) return [];
    const q = searchTerm.trim().toLowerCase();

    return notifications.filter(notification => {
      // البحث يشمل النص المترجم المعروض وليس الخام فقط
      const matchesSearch = searchTerm === '' ||
        notification.title.toLowerCase().includes(q) ||
        notification.message.toLowerCase().includes(q) ||
        getNotificationText(notification, 'title').toLowerCase().includes(q) ||
        getNotificationText(notification, 'message').toLowerCase().includes(q);

      return matchesSearch;
    });
  };

  const filteredNotifications = getFilteredNotifications();

  const getTypeIcon = (type: string) => {
    const Icon = typeIcons[type as keyof typeof typeIcons] || Info;
    return <Icon className="h-4 w-4" />;
  };

  const getCategoryName = (category: string) => {
    const cat = categories.find(c => c.id === category);
    return cat ? cat.name : category;
  };

  const getCategoryColor = (category: string) => {
    const cat = categories.find(c => c.id === category);
    return cat ? cat.color : 'text-gray-600';
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center flex-wrap gap-x-2 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center">
            <Bell className="h-5 w-5 sm:h-6 sm:w-6 text-orange-600 dark:text-orange-400 ml-2" />
            {t('notificationManagement.title')}
          </h1>
          <p className="text-xs sm:text-base text-gray-600 dark:text-gray-300 mr-2 sm:mr-4">{t('notificationManagement.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleMarkAllAsRead}
            disabled={isMarkingAllAsRead}
            className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-bold text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors disabled:opacity-50"
          >
            <CheckCheck className="h-4 w-4" />
            {t('notificationManagement.actions.markAllAsRead')}
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white dark:bg-gray-800 p-3 sm:p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center min-w-0">
              <Bell className="h-6 w-6 sm:h-8 sm:w-8 text-orange-600 dark:text-orange-400 flex-shrink-0" />
              <div className="mr-2 sm:mr-3 min-w-0">
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 truncate">{t('notificationManagement.stats.total')}</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">{formatNumber(stats.total)}</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-3 sm:p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center min-w-0">
              <Eye className="h-6 w-6 sm:h-8 sm:w-8 text-orange-600 dark:text-orange-400 flex-shrink-0" />
              <div className="mr-2 sm:mr-3 min-w-0">
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 truncate">{t('notificationManagement.stats.unread')}</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">{formatNumber(stats.unread)}</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-3 sm:p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center min-w-0">
              <CheckCircle className="h-6 w-6 sm:h-8 sm:w-8 text-green-600 dark:text-green-400 flex-shrink-0" />
              <div className="mr-2 sm:mr-3 min-w-0">
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 truncate">{t('notificationManagement.stats.read')}</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">{formatNumber((stats.total || 0) - (stats.unread || 0))}</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-3 sm:p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center min-w-0">
              <Filter className="h-6 w-6 sm:h-8 sm:w-8 text-purple-600 dark:text-purple-400 flex-shrink-0" />
              <div className="mr-2 sm:mr-3 min-w-0">
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 truncate">{t('notificationManagement.stats.categories')}</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">{formatNumber(Object.keys(stats.byCategory || {}).length)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('notificationManagement.filters.search')}</label>
            <div className="relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t('notificationManagement.filters.searchPlaceholder')}
                className="w-full pr-10 pl-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('notificationManagement.filters.category')}</label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              {categories.map(category => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={filterUnread}
                onChange={(e) => setFilterUnread(e.target.checked)}
                className="ml-2 h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 dark:border-gray-600 rounded"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">{t('notificationManagement.filters.unreadOnly')}</span>
            </label>
          </div>
        </div>
      </div>

      {/* Notifications List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        {loading ? (
          <div className="p-8 text-center">
            <div className="w-8 h-8 border-4 border-orange-600 dark:border-orange-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">{t('notificationManagement.messages.loading')}</p>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="p-8 text-center">
            <Bell className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">{t('notificationManagement.messages.noNotifications')}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredNotifications.map((notification) => (
              <div
                key={notification._id}
                className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                  notification.readBy?.some((read) => read.user === user?.id) ? 'opacity-75' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3 space-x-reverse flex-1">
                    <div className={`mt-1 ${getCategoryColor(notification.category)}`}>
                      {getTypeIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 space-x-reverse mb-1">
                        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {getNotificationText(notification, 'title')}
                        </h3>
                        <span className={`text-xs px-2 py-1 rounded-full font-bold ${priorityStyles[notification.priority as keyof typeof priorityStyles] || 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
                          {notification.priority === 'low' ? t('notificationManagement.priority.low') :
                           notification.priority === 'medium' ? t('notificationManagement.priority.medium') :
                           notification.priority === 'high' ? t('notificationManagement.priority.high') :
                           notification.priority === 'urgent' ? t('notificationManagement.priority.urgent') :
                           notification.priority}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300`}>
                          {getCategoryName(notification.category)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">{getNotificationText(notification, 'message')}</p>
                      <div className="flex items-center space-x-4 space-x-reverse text-xs text-gray-500 dark:text-gray-400">
                        <span>{formatDateTime(notification.createdAt)}</span>
                        {notification.createdBy && notification.createdBy.name && (
                          <span>{t('notificationManagement.createdBy', { name: notification.createdBy.name })}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 space-x-reverse">
                    {!notification.readBy?.some((read) => read.user === user?.id) && (
                      <button
                        onClick={() => handleMarkAsRead(notification._id)}
                        className="p-1 text-gray-400 hover:text-green-600 dark:hover:text-green-400 transition-colors"
                        title={t('notificationManagement.actions.markAsRead')}
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    )}
                    {(notification.metadata as any)?.orderId && (
                      <button
                        onClick={() => handleViewOrder(notification)}
                        className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        title={t('notificationManagement.actions.viewOrder')}
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    )}
                    <PermissionGuard requiredPermissions={['canDeleteNotification', 'users']}>
                      {confirmDeleteId === notification._id ? (
                        <span className="flex items-center gap-1">
                          <button
                            onClick={() => handleDeleteNotification(notification._id)}
                            className="p-1 text-red-600 dark:text-red-400 hover:text-red-800 transition-colors"
                            title={t('notificationManagement.actions.confirmDelete')}
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                            title={t('common.cancel')}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </span>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteId(notification._id)}
                          className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                          title={t('notificationManagement.actions.delete')}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </PermissionGuard>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationManagement;
