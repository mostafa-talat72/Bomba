import React, { useState, useEffect } from 'react';
import { Bell, X, Check, Trash2, AlertCircle, Info, CheckCircle, Clock } from 'lucide-react';
import { useApp } from '../context/AppContext';
import NotificationSound from './NotificationSound';
import { formatDecimal } from '../utils/formatters';

interface Notification {
  _id: string;
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'session' | 'order' | 'inventory' | 'billing' | 'system';
  category: 'session' | 'order' | 'inventory' | 'billing' | 'system' | 'security' | 'backup';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  actionRequired: boolean;
  actionUrl?: string;
  actionText?: string;
  createdAt: string;
  readBy: Array<{ user: string; readAt: string }>;
  createdBy: { name: string };
}

// عرف نوع read بشكل صحيح
interface NotificationRead {
  user: string;
  readAt: string;
}

const NotificationCenter: React.FC = () => {
  const {
    getNotifications,
    getNotificationStats,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    deleteNotification,
    user,
    notifications, // استخدم notifications من context
    forceRefreshNotifications,
  } = useApp();

  const [stats, setStats] = useState<{ total: number; unread: number } | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread' | 'read' | 'high' | 'urgent'>('all');
  const [hoveredNotification, setHoveredNotification] = useState<string | null>(null);
  const [playSound, setPlaySound] = useState(false);
  const [soundType, setSoundType] = useState<'default' | 'success' | 'warning' | 'error' | 'urgent'>('default');
  const [prevUnreadCount, setPrevUnreadCount] = useState(0);
  const [isMarkingAllAsRead, setIsMarkingAllAsRead] = useState(false);

  // احسب unreadCount دائماً من notifications في context
  const unreadCount = notifications.filter(n => !n.readBy.some((read: NotificationRead) => read.user === user?.id)).length;

  // عند تحديث notifications من context، شغل الصوت فقط إذا زاد العدد
  useEffect(() => {
    if (!isOpen && unreadCount > prevUnreadCount) {
      // تحديد نوع الصوت حسب أولوية الإشعارات الجديدة
      const newNotifications = notifications.filter(n => !n.readBy.some((read: NotificationRead) => read.user === user?.id));
      const urgentNotification = newNotifications.find(n => n.priority === 'urgent');
      const highPriorityNotification = newNotifications.find(n => n.priority === 'high');
      if (urgentNotification) {
        setSoundType('urgent');
      } else if (highPriorityNotification) {
        setSoundType('warning');
      } else {
        setSoundType('default');
      }
      setPlaySound(true);
    }
    setPrevUnreadCount(unreadCount);
    // حدث الشارة في كل مكان
    const badge = document.querySelector('.notification-badge') as HTMLElement;
    if (badge) {
      badge.textContent = unreadCount > 99 ? '99+' : unreadCount.toString();
      badge.style.display = unreadCount > 0 ? 'flex' : 'none';
    }
  }, [notifications, unreadCount, isOpen, prevUnreadCount]);

  // Close panel when clicking outside (now handled by backdrop)

  useEffect(() => {
    if (isOpen) {
      forceRefreshNotifications();
      loadStats();
    }
  }, [isOpen, filter]);

  // Update count when opening panel
  const handleTogglePanel = async () => {
    const newIsOpen = !isOpen;
    setIsOpen(newIsOpen);

    // إذا كان يتم فتح النافذة، حدد جميع الإشعارات كمقروءة
    if (newIsOpen && !isMarkingAllAsRead) {
      try {
        setIsMarkingAllAsRead(true);
        await markAllNotificationsAsRead();
        await forceRefreshNotifications();
        await loadStats();
      } catch (error) {
        console.error('Error marking all notifications as read:', error);
      } finally {
        setIsMarkingAllAsRead(false);
      }
    }
  };

  // Load notifications and stats on mount
  useEffect(() => {
    loadNotifications();
    loadStats();
  }, []);

  // Refresh notifications every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isOpen) {
        loadNotifications();
        loadStats();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [isOpen]);

  useEffect(() => {
    // عند إغلاق المكون، أعد ضبط الحالة
    return () => {};
  }, []);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const options: { category?: string; unreadOnly?: boolean; limit?: number } = {};
      if (filter === 'unread') {
        options.unreadOnly = true;
      }
      const data = await getNotifications(options);

      // التحقق من الإشعارات الجديدة
      const previousCount = unreadCount;
      const newCount = data.filter(notification => isUnread(notification)).length;

      // إذا كان هناك إشعارات جديدة، شغل الصوت
      if (newCount > previousCount && !isOpen) {
        // تحديد نوع الصوت حسب أولوية الإشعارات الجديدة
        const newNotifications = data.filter(notification => isUnread(notification));
        const urgentNotification = newNotifications.find(n => n.priority === 'urgent');
        const highPriorityNotification = newNotifications.find(n => n.priority === 'high');

        if (urgentNotification) {
          setSoundType('urgent');
        } else if (highPriorityNotification) {
          setSoundType('warning');
        } else {
          setSoundType('default');
        }

        setPlaySound(true);
      }

      // setNotifications(data); // This line was removed as per the edit hint
      // setUnreadCount(newCount); // This line was removed as per the edit hint

      // Update badge count after loading notifications
      const badge = document.querySelector('.notification-badge') as HTMLElement;
      if (badge) {
        badge.textContent = newCount > 99 ? '99+' : newCount.toString();
        badge.style.display = newCount > 0 ? 'flex' : 'none';
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const data = await getNotificationStats();
      // تأكيد النوع
      if (data && typeof data === 'object' && 'total' in data && 'unread' in data) {
        setStats(data as { total: number; unread: number });
        // Update badge count from stats
        const badge = document.querySelector('.notification-badge') as HTMLElement;
        const unread = (data as { unread: number }).unread;
        if (badge) {
          badge.textContent = unread > 99 ? '99+' : unread.toString();
          badge.style.display = unread > 0 ? 'flex' : 'none';
        }
      } else {
        setStats(null);
      }
    } catch (error) {
      console.error('Error loading notification stats:', error);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    if (!notificationId) {
      console.error('Notification ID is undefined');
      return;
    }

    try {
      const success = await markNotificationAsRead(notificationId);
      if (success) {
        await forceRefreshNotifications(); // تحديث الإشعارات فوراً بعد تحديد إشعار كمقروء
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  // Mark notification as read on hover (instant, no delay, no temp message)
  const handleNotificationHover = async (notification: Notification) => {
    if (isUnread(notification)) {
      const id = notification.id || notification._id;
      if (id) {
        await handleMarkAsRead(id);
        setHoveredNotification(null);
      }
    }
  };

  const handleNotificationLeave = () => {
    setHoveredNotification(null);
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllNotificationsAsRead();
      await forceRefreshNotifications(); // تحديث الإشعارات فوراً بعد تحديد الكل كمقروء
      await loadStats(); // تحديث الإحصائيات فوراً
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const handleDelete = async (notificationId: string) => {
    if (!notificationId) {
      console.error('Notification ID is undefined');
      return;
    }

    try {
      const success = await deleteNotification(notificationId);
      if (success) {
        // Check if the deleted notification was unread
        const deletedNotification = notifications.find(n => n.id === notificationId);
        const wasUnread = deletedNotification ? isUnread(deletedNotification) : false;

        // setNotifications(prev => prev.filter(notification => notification.id !== notificationId)); // This line was removed as per the edit hint
        // loadStats(); // This line was removed as per the edit hint

        // Update badge count immediately if notification was unread
        if (wasUnread) {
          const newCount = Math.max(0, unreadCount - 1);
          const badge = document.querySelector('.notification-badge') as HTMLElement;
          if (badge) {
            badge.textContent = newCount > 99 ? '99+' : newCount.toString();
            badge.style.display = newCount > 0 ? 'flex' : 'none';
          }
        }
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case 'session':
        return <Clock className="h-5 w-5 text-blue-500" />;
      case 'order':
        return <CheckCircle className="h-5 w-5 text-purple-500" />;
      case 'inventory':
        return <AlertCircle className="h-5 w-5 text-orange-500" />;
      case 'billing':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      default:
        return <Info className="h-5 w-5 text-blue-500" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'border-red-500 bg-red-50';
      case 'high':
        return 'border-orange-500 bg-orange-50';
      case 'medium':
        return 'border-yellow-500 bg-yellow-50';
      default:
        return 'border-gray-300 bg-gray-50';
    }
  };

  const isUnread = (notification: Notification) => {
    return !notification.readBy.some((read: NotificationRead) => read.user === user?.id);
  };

  const filteredNotifications = notifications.filter(notification => {
    if (filter === 'unread') return isUnread(notification);
    if (filter === 'read') return notification.readBy.some((read: NotificationRead) => read.user === user?.id);
    if (filter === 'high') return notification.priority === 'high' || notification.priority === 'urgent';
    if (filter === 'urgent') return notification.priority === 'urgent';
    return true;
  });

  return (
    <div className="relative flex-shrink-0">
      {/* Notification Bell */}
      <button
        onClick={handleTogglePanel}
        className="notification-bell relative p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors duration-200"
      >
        <Bell className="h-6 w-6" />
        {unreadCount > 0 && (
          <span className="notification-badge absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Panel */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-[9998]"
            onClick={async () => {
              setIsOpen(false);
              // تحديد جميع الإشعارات كمقروءة عند إغلاق النافذة
              if (!isMarkingAllAsRead) {
                try {
                  setIsMarkingAllAsRead(true);
                  await markAllNotificationsAsRead();
                  await forceRefreshNotifications();
                  await loadStats();
                } catch (error) {
                  console.error('Error marking all notifications as read on close:', error);
                } finally {
                  setIsMarkingAllAsRead(false);
                }
              }
            }}
          />
          <div className="notification-panel bg-white dark:bg-gray-800">
          {/* Header */}
          <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">الإشعارات</h3>
            <div className="flex items-center space-x-2 space-x-reverse">
              <button
                onClick={handleMarkAllAsRead}
                className="text-xs sm:text-sm text-blue-600 hover:text-blue-800"
              >
                تحديد الكل كمقروء
              </button>
              <button
                onClick={async () => {
                  setIsOpen(false);
                  // تحديد جميع الإشعارات كمقروءة عند إغلاق النافذة
                  if (!isMarkingAllAsRead) {
                    try {
                      setIsMarkingAllAsRead(true);
                      await markAllNotificationsAsRead();
                      await forceRefreshNotifications();
                      await loadStats();
                    } catch (error) {
                      console.error('Error marking all notifications as read on close:', error);
                    } finally {
                      setIsMarkingAllAsRead(false);
                    }
                  }
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
            </div>
          </div>

          {/* Stats */}
          {stats && (
            <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-sm text-gray-600 space-y-1 sm:space-y-0">
                <span>المجموع: {formatDecimal(stats.total)}</span>
                <div className="flex flex-wrap space-x-2 sm:space-x-4 space-x-reverse">
                  <span className="text-blue-600 font-medium">غير مقروء: {formatDecimal(stats.unread)}</span>
                  <span className="text-green-600 font-medium">مقروء: {formatDecimal(stats.total - stats.unread)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="px-4 py-2 border-b border-gray-200">
            <div className="flex flex-wrap gap-1 sm:gap-2 space-x-reverse">
              <button
                onClick={() => setFilter('all')}
                className={`px-2 sm:px-3 py-1 text-xs sm:text-sm rounded-md transition-colors duration-200 ${
                  filter === 'all'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                الكل
              </button>
              <button
                onClick={() => setFilter('unread')}
                className={`px-2 sm:px-3 py-1 text-xs sm:text-sm rounded-md transition-colors duration-200 ${
                  filter === 'unread'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                غير مقروء
              </button>
              <button
                onClick={() => setFilter('read')}
                className={`px-2 sm:px-3 py-1 text-xs sm:text-sm rounded-md transition-colors duration-200 ${
                  filter === 'read'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                مقروء
              </button>
              <button
                onClick={() => setFilter('high')}
                className={`px-2 sm:px-3 py-1 text-xs sm:text-sm rounded-md transition-colors duration-200 ${
                  filter === 'high'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                عالية
              </button>
              <button
                onClick={() => setFilter('urgent')}
                className={`px-2 sm:px-3 py-1 text-xs sm:text-sm rounded-md transition-colors duration-200 ${
                  filter === 'urgent'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                عاجلة
              </button>
            </div>
          </div>

          {/* Notifications List */}
          <div className="max-h-64 sm:max-h-96 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-gray-500">جاري التحميل...</div>
            ) : filteredNotifications.length === 0 ? (
              <div className="p-4 text-center text-gray-500">لا توجد إشعارات</div>
            ) : (
              filteredNotifications.map((notification) => (
                <div
                  key={notification.id || notification._id || `notification-${Date.now()}-${Math.random()}`}
                  className={`p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200 ${
  isUnread(notification) ? 'bg-blue-50 dark:bg-blue-900 border-r-4 border-r-blue-500' : 'bg-white dark:bg-gray-800 border-r-4 border-r-green-500'
} ${getPriorityColor(notification.priority)}`}
                  onMouseEnter={() => handleNotificationHover(notification)}
                  onMouseLeave={handleNotificationLeave}
                >
                  <div className="flex items-start space-x-2 sm:space-x-3 space-x-reverse">
                    <div className="flex-shrink-0 mt-1">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
                        <h4 className={`text-xs sm:text-sm font-medium ${
                          isUnread(notification) ? 'text-gray-900 dark:text-gray-100' : 'text-gray-600 dark:text-gray-400'
                        }`}>
                          {notification.title}
                          {isUnread(notification) && (
                            <span className="ml-2 text-xs text-blue-600">●</span>
                          )}
                        </h4>
                        <div className="flex items-center space-x-1 sm:space-x-2 space-x-reverse">
                          {notification.actionRequired && (
                            <span className="inline-flex items-center px-1 sm:px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              يتطلب إجراء
                            </span>
                          )}
                          {/* علامة مقروء */}
                          {isUnread(notification) ? (
                            <span className={`inline-flex items-center px-1 sm:px-2 py-1 rounded-full text-xs font-medium ${
                              hoveredNotification === (notification.id || notification._id)
                                ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 animate-pulse'
                                : 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                            }`}>
                              {hoveredNotification === (notification.id || notification._id) ? 'سيصبح مقروءاً...' : 'غير مقروء'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-1 sm:px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300">
                              <Check className="h-3 w-3 sm:h-4 sm:w-4 inline mr-1" /> مقروء
                            </span>
                          )}
                          <button
                            onClick={() => {
                              const id = notification.id || notification._id;
                              if (id) handleMarkAsRead(id);
                            }}
                            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                            title="تحديد كمقروء"
                          >
                            <Check className="h-3 w-3 sm:h-4 sm:w-4" />
                          </button>
                          <button
                            onClick={() => {
                              const id = notification.id || notification._id;
                              if (id) handleDelete(id);
                            }}
                            className="text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400"
                            title="حذف"
                          >
                            <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                          </button>
                        </div>
                      </div>
                      <p className={`text-xs sm:text-sm mt-1 ${
                        isUnread(notification) ? 'text-gray-900 dark:text-gray-100 font-medium' : 'text-gray-600 dark:text-gray-400'
                      }`}>
                        {notification.message}
                      </p>
                      {notification.actionUrl && notification.actionText && (
                        <button
                          onClick={() => {
                            // Handle action navigation
                            window.location.href = notification.actionUrl!;
                          }}
                          className="mt-2 text-xs sm:text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
                        >
                          {notification.actionText}
                        </button>
                      )}
                      <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between mt-2 text-xs space-y-1 sm:space-y-0 ${
                        isUnread(notification) ? 'text-gray-700 dark:text-gray-300' : 'text-gray-500 dark:text-gray-400'
                      }`}>
                        <span>{notification.createdBy?.name}</span>
                        <span>{new Date(notification.createdAt).toLocaleString('ar-EG')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-3 sm:p-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={async () => {
                setIsOpen(false);
                // تحديد جميع الإشعارات كمقروءة عند إغلاق النافذة
                if (!isMarkingAllAsRead) {
                  try {
                    setIsMarkingAllAsRead(true);
                    await markAllNotificationsAsRead();
                    await forceRefreshNotifications();
                    await loadStats();
                  } catch (error) {
                    console.error('Error marking all notifications as read on close:', error);
                  } finally {
                    setIsMarkingAllAsRead(false);
                  }
                }
              }}
              className="w-full text-center text-xs sm:text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            >
              إغلاق
            </button>
          </div>
        </div>
        </>
      )}

      {/* Notification Sound Component */}
      <NotificationSound
        playSound={playSound}
        soundType={soundType}
        onSoundPlayed={() => setPlaySound(false)}
      />
    </div>
  );
};

export default NotificationCenter;
