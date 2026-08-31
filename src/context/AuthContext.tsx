import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import api, { User } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { getDataActionsRef } from './dataActionsRef';

interface NotificationType {
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isLoggingOut: boolean;
  error: string | null;
  notification: NotificationType | null;
  subscriptionStatus: 'active' | 'expired' | 'pending' | 'loading';

  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  setIsAuthenticated: React.Dispatch<React.SetStateAction<boolean>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  setNotification: React.Dispatch<React.SetStateAction<NotificationType | null>>;
  setIsLoggingOut: React.Dispatch<React.SetStateAction<boolean>>;
  setSubscriptionStatus: React.Dispatch<React.SetStateAction<'active' | 'expired' | 'pending' | 'loading'>>;

  login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  resendVerification: (email: string) => Promise<{ success: boolean; message?: string }>;
  forgotPassword: (email: string) => Promise<{ success: boolean; message?: string }>;
  resetPassword: (token: string, password: string) => Promise<{ success: boolean; message?: string }>;

  hasPermission: (permission: string) => boolean;
  canDeleteUsers: () => boolean;
  canManageUsers: () => boolean;
  canEditUser: (targetUser: User) => boolean;
  canDeleteUser: (targetUser: User) => boolean;

  showNotification: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const getInitialLoadingState = () => {
    const currentPath = window.location.pathname;
    const isBillView = /^\/bill\/[a-fA-F0-9]{24}$/.test(currentPath);
    const isPublicPage = currentPath === '/login' || currentPath === '/register' ||
                        currentPath.startsWith('/verify-email') ||
                        currentPath.startsWith('/reset-password') ||
                        currentPath.startsWith('/email-actions') ||
                        isBillView;
    return !isPublicPage;
  };

  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(getInitialLoadingState());
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<NotificationType | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<'active' | 'expired' | 'pending' | 'loading'>('loading');

  const firstLoginRef = useRef(true);

  const showNotification = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info'): void => {
    const options = {
      autoClose: 3500,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      rtl: true,
    };
    switch (type) {
      case 'success': toast.success(message, options); break;
      case 'error': toast.error(message, options); break;
      case 'warning': toast.warning(message, options); break;
      case 'info': toast.info(message, options); break;
    }
  };

  const shouldBlockExit = (): boolean => {
    try {
      return sessionStorage.getItem('bombaExitGuard') === 'true';
    } catch {
      return false;
    }
  };

  const logout = (): void => {
    if (shouldBlockExit()) {
      const confirmed = window.confirm('توجد طاولات مشغولة، هل تريد تسجيل الخروج؟');
      if (!confirmed) {
        setIsLoggingOut(false);
        return;
      }
    }

    setIsLoggingOut(true);

    const token = localStorage.getItem('token');
    if (token) {
      try { api.logout(); } catch {}
    }

    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    api.clearToken();

    setUser(null);
    setIsAuthenticated(false);

    // Clear all data state via ref (DataProvider populates this ref)
    const actions = getDataActionsRef();
    if (actions) {
      actions.setSessions([]);
      actions.setOrders([]);
      actions.setInventory([]);
      actions.setBills([]);
      actions.setCosts([]);
      actions.setDevices([]);
      actions.setMenuItems([]);
      actions.setInventoryItems([]);
      actions.setUsers([]);
      actions.setNotifications([]);
      actions.setSettings(null);
      actions.setError(null);
      actions.setNotification(null);
    }

    navigate('/login', { replace: true });
    showNotification(t('auth.logoutSuccess'), 'info');

    setIsLoggingOut(false);
  };

  useEffect(() => {
    const checkToken = () => {
      const token = localStorage.getItem('token');
      const path = window.location.pathname;
      const isVerifyEmail = path.startsWith('/verify-email');
      const isBillView = /^\/bill\/[a-fA-F0-9]{24}$/.test(path);
      const isResetPassword = path.startsWith('/reset-password');
      const isRegister = path === '/register';
      const isEmailActions = path.startsWith('/email-actions');
      const isLogin = path === '/login';

      if (isLogin) return;

      if (!token && !isVerifyEmail && !isBillView && !isResetPassword && !isRegister && !isEmailActions) {
        setUser(null);
        setIsAuthenticated(false);
        const actions = getDataActionsRef();
        if (actions) actions.clearAllData();
        navigate('/login', { replace: true });
      }
    };

    const initialDelay = setTimeout(checkToken, 2000);
    const interval = setInterval(checkToken, 3000);

    return () => {
      clearTimeout(initialDelay);
      clearInterval(interval);
    };
  }, [navigate]);

  useEffect(() => {
    const currentPath = window.location.pathname;
    const isBillView = /^\/bill\/[a-fA-F0-9]{24}$/.test(currentPath);

    const checkAuth = async () => {
      try {
        const token = localStorage.getItem('token');
        if (token) {
          const response = await api.getMe();

          if (response.success && response.data?.user) {
            setUser(response.data.user);
            setIsAuthenticated(true);
          } else if (!response.success) {
            localStorage.removeItem('token');
            localStorage.removeItem('refreshToken');
            api.clearToken();
            setUser(null);
            setIsAuthenticated(false);

            const currentPath = window.location.pathname;
            const isBillView = /^\/bill\/[a-fA-F0-9]{24}$/.test(currentPath);

            if (!isBillView) {
              if (response.message?.includes('صلاحية الجلسة') || response.message?.includes('session')) {
                showNotification(t('auth.sessionExpired'), 'error');
              }
              navigate('/login', { replace: true });
            }
          }
        } else {
          setUser(null);
          setIsAuthenticated(false);
        }
      } catch (error) {
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        api.clearToken();
        setUser(null);
        setIsAuthenticated(false);

        const currentPath = window.location.pathname;
        const isBillView = /^\/bill\/[a-fA-F0-9]{24}$/.test(currentPath);

        if (!isBillView) {
          showNotification(t('auth.sessionExpired'), 'error');
          navigate('/login', { replace: true });
        }
      } finally {
        setIsLoading(false);
      }
    };

    if (!isBillView) {
      checkAuth();
    } else {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated || isLoggingOut) return;

    const fetchSubscription = async () => {
      try {
        setSubscriptionStatus('loading');
        const token = localStorage.getItem('token');
        const res = await fetch(`${(await import('../utils/apiBase')).API_BASE_URL}/api/billing/subscription/status`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });

        if (!res.ok) {
          console.error('Subscription status error:', res.status);
          setSubscriptionStatus('expired');
          return;
        }

        const data = await res.json();
        if (data.status === 'active') {
          setSubscriptionStatus('active');
        } else {
          setSubscriptionStatus('expired');
        }
      } catch (error) {
        console.error('Error fetching subscription:', error);
        if (!isAuthenticated || isLoggingOut) return;
        setSubscriptionStatus('expired');
      }
    };
    fetchSubscription();
  }, [isAuthenticated, isLoggingOut]);

  useEffect(() => {
    if (subscriptionStatus === 'expired' && isAuthenticated && !isLoggingOut) {
      const currentPath = window.location.pathname;
      if (currentPath !== '/subscription' && currentPath !== '/login' && currentPath !== '/register') {
        navigate('/subscription');
      }
    }
  }, [subscriptionStatus, navigate, isAuthenticated, isLoggingOut]);

  const login = async (email: string, password: string): Promise<{ success: boolean; message?: string }> => {
    try {
      const response = await api.login(email, password);
      const loginUser = response.data?.user;
      const token = response.data?.token;
      if (response.success && loginUser && token) {
        localStorage.setItem('token', token);
        api.setToken(token);
        setUser(loginUser);
        setIsAuthenticated(true);
        if (firstLoginRef.current) {
          showNotification(t('auth.welcome', { name: loginUser.name }), 'success');
          firstLoginRef.current = false;
        }

        // لغة — في الخلفية بلا حجب
        api.getGeneralSettings().then(async (settingsRes) => {
          if (settingsRes.success && settingsRes.data?.language && window.i18n) {
            const lang = settingsRes.data.language;
            localStorage.setItem('language', lang);
            await window.i18n.changeLanguage(lang);
            const rtlLanguages = ['ar', 'he', 'fa', 'ur', 'ps', 'yi', 'sd', 'ug', 'dv', 'ku'];
            const isRTL = rtlLanguages.includes(lang);
            document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
            document.body.dir = isRTL ? 'rtl' : 'ltr';
            document.documentElement.lang = lang;
          }
        }).catch(async () => {
          const savedLanguage = localStorage.getItem('language') || 'ar';
          if (window.i18n) await window.i18n.changeLanguage(savedLanguage);
        });

        // طابعة — في الخلفية (المسار الصحيح /print/auto-detect بدون /api مكرر)
        api.post('/print/auto-detect', { deviceId: 'default' }).then((printerRes: any) => {
          if (printerRes.data?.success && printerRes.data?.printer) {
            showNotification(`تم اكتشاف الطابعة تلقائيًا: ${printerRes.data.printer.name || printerRes.data.printer.path}`, 'success');
          } else if (printerRes.data?.printers && printerRes.data.printers.length > 1) {
            showNotification(`تم العثور على ${printerRes.data.printers.length} طابعات متصلة، يرجى اختيار واحدة من الإعدادات`, 'info');
          }
        }).catch((printerError) => { console.error('Auto-detect printer error:', printerError); });

        return { success: true };
      } else {
        const errorMessage = response.message || 'فشل تسجيل الدخول';
        setError(errorMessage);
        showNotification(errorMessage, 'error');
        return { success: false, message: errorMessage };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'حدث خطأ أثناء تسجيل الدخول';
      setError(errorMessage);
      showNotification(errorMessage, 'error');
      return { success: false, message: errorMessage };
    }
  };

  const resendVerification = async (email: string): Promise<{ success: boolean; message?: string }> => {
    try {
      const response = await api.resendVerification(email);
      return { success: response.success, message: response.message };
    } catch (error: unknown) {
      const err = error as { message?: string };
      return { success: false, message: err.message || 'فشل في إعادة إرسال رابط التفعيل' };
    }
  };

  const forgotPassword = async (email: string): Promise<{ success: boolean; message?: string }> => {
    try {
      const response = await api.forgotPassword(email);
      return { success: response.success, message: response.message };
    } catch (error: unknown) {
      const err = error as { message?: string };
      return { success: false, message: err.message || 'فشل في طلب إعادة تعيين كلمة المرور' };
    }
  };

  const resetPassword = async (token: string, password: string): Promise<{ success: boolean; message?: string }> => {
    try {
      const response = await api.resetPassword(token, password);
      return { success: response.success, message: response.message };
    } catch (error: unknown) {
      const err = error as { message?: string };
      return { success: false, message: err.message || 'فشل في إعادة تعيين كلمة المرور' };
    }
  };

  const hasPermission = (permission: string): boolean => {
    if (!user) return false;
    return user.permissions?.includes('all') || user.permissions?.includes(permission) || false;
  };

  const canDeleteUsers = (): boolean => {
    if (!user) return false;
    return user.role === 'admin' || hasPermission('users') || hasPermission('all');
  };

  const canManageUsers = (): boolean => {
    if (!user) return false;
    return hasPermission('users') || hasPermission('all');
  };

  const canEditUser = (targetUser: User): boolean => {
    if (!user) return false;

    const hasBasicPermission = user.role === 'admin' || hasPermission('users') || hasPermission('all');
    if (!hasBasicPermission) return false;

    if (targetUser.role === 'admin') {
      const currentUserId = (user._id || user.id)?.toString();
      const targetUserId = (targetUser._id || targetUser.id)?.toString();
      const ownerId = user.organization?.owner?.toString();

      const isOwner = !!(ownerId && currentUserId === ownerId);
      const isEditingSelf = currentUserId === targetUserId;
      return isOwner || isEditingSelf;
    }

    return true;
  };

  const canDeleteUser = (targetUser: User): boolean => {
    if (!user) return false;

    const hasBasicPermission = user.role === 'admin' || hasPermission('users') || hasPermission('all');
    if (!hasBasicPermission) return false;

    const currentUserId = (user._id || user.id)?.toString();
    const targetUserId = (targetUser._id || targetUser.id)?.toString();

    if (currentUserId === targetUserId) return false;

    if (targetUser.role === 'admin') {
      const ownerId = user.organization?.owner?.toString();

      const isOwner = !!(ownerId && currentUserId === ownerId);
      return isOwner;
    }

    return true;
  };

  const value: AuthContextType = {
    user,
    isAuthenticated,
    isLoading,
    isLoggingOut,
    error,
    notification,
    subscriptionStatus,

    setUser,
    setIsAuthenticated,
    setError,
    setNotification,
    setIsLoggingOut,
    setSubscriptionStatus,

    login,
    logout,
    resendVerification,
    forgotPassword,
    resetPassword,

    hasPermission,
    canDeleteUsers,
    canManageUsers,
    canEditUser,
    canDeleteUser,

    showNotification,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
