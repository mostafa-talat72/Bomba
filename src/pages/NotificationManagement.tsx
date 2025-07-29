import React, { useState, useEffect } from 'react';
import { Bell, Filter, Search, Eye, Trash2, X, AlertCircle, Info, CheckCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import PermissionGuard from '../components/PermissionGuard';
import { formatDecimal } from '../utils/formatters';

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
}

interface NotificationStats {
  total: number;
  unread: number;
  byCategory: Record<string, number>;
  byPriority: Record<string, number>;
}

const NotificationManagement = () => {
  const { user, getNotifications, getNotificationStats, markNotificationAsRead, markAllNotificationsAsRead, deleteNotification, showNotification } = useApp();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [stats, setStats] = useState<NotificationStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterUnread, setFilterUnread] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isMarkingAllAsRead, setIsMarkingAllAsRead] = useState(false);

  const categories = [
    { id: 'all', name: 'جميع الإشعارات', color: 'text-gray-600' },
    { id: 'session', name: 'الجلسات', color: 'text-blue-600' },
    { id: 'order', name: 'الطلبات', color: 'text-green-600' },
    { id: 'inventory', name: 'المخزون', color: 'text-orange-600' },
    { id: 'billing', name: 'الفواتير', color: 'text-purple-600' },
    { id: 'system', name: 'النظام', color: 'text-red-600' },
    { id: 'security', name: 'الأمان', color: 'text-yellow-600' },
  ];

  const priorityColors = {
    low: 'text-gray-500',
    medium: 'text-blue-500',
    high: 'text-orange-500',
    urgent: 'text-red-500'
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

  useEffect(() => {
    loadNotifications();
    loadStats();
    // تحديد جميع الإشعارات كمقروءة عند فتح الصفحة
    handleMarkAllAsReadOnPageLoad();

    // تحديد جميع الإشعارات كمقروءة عند مغادرة الصفحة
    return () => {
      handleMarkAllAsReadOnPageLoad();
    };
  }, [filterCategory, filterUnread]);

  const handleMarkAllAsReadOnPageLoad = async () => {
    if (isMarkingAllAsRead) return; // تجنب الاستدعاءات المتكررة

    try {
      setIsMarkingAllAsRead(true);
      await markAllNotificationsAsRead();
      await loadNotifications();
      await loadStats();
    } catch (error) {
      console.error('Error marking all notifications as read on page load:', error);
    } finally {
      setIsMarkingAllAsRead(false);
    }
  };

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
      showNotification('خطأ في تحميل الإشعارات', 'error');
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
      console.error('Error loading stats');
      setStats(null);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await markNotificationAsRead(notificationId);
      await loadNotifications();
      await loadStats();
      showNotification('تم تحديد الإشعار كمقروء', 'success');
    } catch {
      showNotification('خطأ في تحديد الإشعار كمقروء', 'error');
    }
  };

  const handleMarkAllAsRead = async () => {
    if (isMarkingAllAsRead) return; // تجنب الاستدعاءات المتكررة

    try {
      setIsMarkingAllAsRead(true);
      await markAllNotificationsAsRead();
      await loadNotifications();
      await loadStats();
      showNotification('تم تحديد جميع الإشعارات كمقروءة', 'success');
    } catch {
      showNotification('خطأ في تحديد الإشعارات كمقروءة', 'error');
    } finally {
      setIsMarkingAllAsRead(false);
    }
  };

  const handleDeleteNotification = async (notificationId: string) => {
    try {
      await deleteNotification(notificationId);
      await loadNotifications();
      await loadStats();
      showNotification('تم حذف الإشعار بنجاح', 'success');
    } catch {
      showNotification('خطأ في حذف الإشعار', 'error');
    }
  };

  const getFilteredNotifications = () => {
    if (!notifications) return [];

    return notifications.filter(notification => {
      const matchesSearch = searchTerm === '' ||
        notification.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        notification.message.toLowerCase().includes(searchTerm.toLowerCase());

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">إدارة الإشعارات</h1>
          <p className="text-gray-600">عرض وإدارة الإشعارات حسب صلاحياتك</p>
        </div>
        <div className="flex items-center space-x-2 space-x-reverse">
          <PermissionGuard requiredPermissions={['dashboard', 'playstation', 'computer', 'cafe', 'billing', 'reports', 'inventory', 'costs', 'users', 'settings']}>
            <button
              onClick={handleMarkAllAsRead}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              تحديد الكل كمقروء
            </button>
          </PermissionGuard>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <Bell className="h-8 w-8 text-primary-600" />
              <div className="mr-3">
                <p className="text-sm text-gray-600">إجمالي الإشعارات</p>
                <p className="text-2xl font-bold text-gray-900">{formatDecimal(stats.total)}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <Eye className="h-8 w-8 text-orange-600" />
              <div className="mr-3">
                <p className="text-sm text-gray-600">غير مقروءة</p>
                <p className="text-2xl font-bold text-gray-900">{formatDecimal(stats.unread)}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <div className="mr-3">
                <p className="text-sm text-gray-600">مقروءة</p>
                <p className="text-2xl font-bold text-gray-900">{formatDecimal((stats.total || 0) - (stats.unread || 0))}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <Filter className="h-8 w-8 text-purple-600" />
              <div className="mr-3">
                <p className="text-sm text-gray-600">الفئات</p>
                <p className="text-2xl font-bold text-gray-900">{formatDecimal(Object.keys(stats.byCategory || {}).length)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">البحث</label>
            <div className="relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="البحث في الإشعارات..."
                className="w-full pr-10 pl-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">الفئة</label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
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
                className="ml-2 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <span className="text-sm text-gray-700">غير مقروءة فقط</span>
            </label>
          </div>
        </div>
      </div>

      {/* Notifications List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {loading ? (
          <div className="p-8 text-center">
            <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">جاري تحميل الإشعارات...</p>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="p-8 text-center">
            <Bell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">لا توجد إشعارات</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredNotifications.map((notification) => (
              <div
                key={notification._id}
                className={`p-4 hover:bg-gray-50 transition-colors ${
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
                        <h3 className="text-sm font-medium text-gray-900 truncate">
                          {notification.title}
                        </h3>
                        <span className={`text-xs px-2 py-1 rounded-full ${priorityColors[notification.priority as keyof typeof priorityColors] || 'text-gray-500'}`}>
                          {notification.priority}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600`}>
                          {getCategoryName(notification.category)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{notification.message}</p>
                      <div className="flex items-center space-x-4 space-x-reverse text-xs text-gray-500">
                        <span>{new Date(notification.createdAt).toLocaleString('ar-EG')}</span>
                        {notification.createdBy && (
                          <span>بواسطة: {notification.createdBy.name}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 space-x-reverse">
                    {!notification.readBy?.some((read) => read.user === user?.id) && (
                      <button
                        onClick={() => handleMarkAsRead(notification._id)}
                        className="p-1 text-gray-400 hover:text-green-600 transition-colors"
                        title="تحديد كمقروء"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    )}
                    <PermissionGuard requiredPermissions={['users']}>
                      <button
                        onClick={() => handleDeleteNotification(notification._id)}
                        className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                        title="حذف الإشعار"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
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
