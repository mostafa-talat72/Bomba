import React, { useState, useEffect } from 'react';
import { Users as UsersIcon, Plus, Shield, User, Crown, Search, Filter, Lock, Unlock, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../context/LanguageContext';
import { useApp } from '../context/AppContext';
import { User as UserType } from '../services/api';
import UserCard from '../components/UserCard';
import UserFormModal from '../components/UserFormModal';
import UserDetailsModal from '../components/UserDetailsModal';
import UserDeleteModal from '../components/UserDeleteModal';
import PermissionsManagerModal from '../components/PermissionsManagerModal';
import UserStatusModal from '../components/UserStatusModal';
import { formatDecimal } from '../utils/formatters';
import '../styles/users-enhancements.css';

const Users = () => {
  const { t } = useTranslation();
  const { currentLanguage, isRTL } = useLanguage();
  const { users, fetchUsers, createUser, updateUser, deleteUser, showNotification, user } = useApp();
  const [showAddUser, setShowAddUser] = useState(false);
  const [showEditUser, setShowEditUser] = useState(false);
  const [showViewUser, setShowViewUser] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserType | null>(null);
  const [loading, setLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertType, setAlertType] = useState<'success' | 'error'>('success');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'staff',
    status: 'active',
    phone: '',
    address: '',
    permissions: [] as string[],
    businessName: '', // اسم المنشأة
    businessType: '', // نوع المنشأة
    department: '',
    position: '',
    hireDate: '',
    salary: '',
    notes: '',
  });
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserType | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [permissionsUser, setPermissionsUser] = useState<UserType | null>(null);
  const [statusUser, setStatusUser] = useState<UserType | null>(null);

  const roles = [
    { id: 'admin', name: t('users.roles.admin'), icon: Crown, color: 'text-purple-600', bgColor: 'bg-purple-100', description: t('users.roles.adminDesc') },
    { id: 'staff', name: t('users.roles.staff'), icon: User, color: 'text-blue-600', bgColor: 'bg-blue-100', description: t('users.roles.staffDesc') },
    { id: 'cashier', name: t('users.roles.cashier'), icon: Shield, color: 'text-green-600', bgColor: 'bg-green-100', description: t('users.roles.cashierDesc') },
    { id: 'kitchen', name: t('users.roles.kitchen'), icon: Shield, color: 'text-orange-600', bgColor: 'bg-orange-100', description: t('users.roles.kitchenDesc') },
  ];

  const permissions = [
    { id: 'all', name: t('users.permissions.all'), description: t('users.permissions.allDesc') },
    { id: 'dashboard', name: t('users.permissions.dashboard'), description: t('users.permissions.dashboardDesc') },
    { id: 'playstation', name: t('users.permissions.playstation'), description: t('users.permissions.playstationDesc') },
    { id: 'computer', name: t('users.permissions.computer'), description: t('users.permissions.computerDesc') },
    { id: 'cafe', name: t('users.permissions.cafe'), description: t('users.permissions.cafeDesc') },
    { id: 'menu', name: t('users.permissions.menu'), description: t('users.permissions.menuDesc') },
    { id: 'billing', name: t('users.permissions.billing'), description: t('users.permissions.billingDesc') },
    { id: 'reports', name: t('users.permissions.reports'), description: t('users.permissions.reportsDesc') },
    { id: 'consumption', name: t('users.permissions.consumption'), description: t('users.permissions.consumptionDesc') },
    { id: 'inventory', name: t('users.permissions.inventory'), description: t('users.permissions.inventoryDesc') },
    { id: 'costs', name: t('users.permissions.costs'), description: t('users.permissions.costsDesc') },
    { id: 'users', name: t('users.permissions.users'), description: t('users.permissions.usersDesc') },
    { id: 'settings', name: t('users.permissions.settings'), description: t('users.permissions.settingsDesc') },
  ];

  const businessTypes = [
    { id: 'cafe', name: t('users.businessTypes.cafe') },
    { id: 'restaurant', name: t('users.businessTypes.restaurant') },
    { id: 'playstation', name: t('users.businessTypes.playstation') },
  ];

  // Get accessible pages for a user based on their permissions
  const getAccessiblePages = (userPermissions: string[]) => {
    const pagePermissions = {
      dashboard: ['dashboard'],
      playstation: ['playstation'],
      computer: ['computer'],
      cafe: ['cafe'],
      menu: ['menu'],
      billing: ['billing'],
      reports: ['reports'],
      consumption: ['consumption'],
      inventory: ['inventory'],
      costs: ['costs'],
      users: ['users'],
      settings: ['settings'],
      notifications: ['dashboard', 'playstation', 'computer', 'cafe', 'menu', 'billing', 'reports', 'consumption', 'inventory', 'costs', 'users', 'settings']
    };

    const accessiblePages = [];

    for (const [page, requiredPermissions] of Object.entries(pagePermissions)) {
      if (userPermissions.includes('all') || requiredPermissions.some(permission => userPermissions.includes(permission))) {
        accessiblePages.push(page);
      }
    }

    return accessiblePages;
  };

  const getPageDisplayName = (page: string) => {
    const pageNames: Record<string, string> = {
      dashboard: t('nav.dashboard'),
      playstation: t('nav.playstation'),
      computer: t('nav.computer'),
      cafe: t('nav.cafe'),
      menu: t('nav.menu'),
      billing: t('nav.billing'),
      reports: t('nav.reports'),
      consumption: t('nav.consumptionReport'),
      inventory: t('nav.inventory'),
      costs: t('nav.costs'),
      users: t('nav.users'),
      settings: t('nav.settings'),
      notifications: t('nav.notifications')
    };
    return pageNames[page] || page;
  };

  // تحميل البيانات عند بدء الصفحة
  useEffect(() => {
    loadUsers();
  }, []);

  // تحديث تلقائي كل 30 ثانية
  useEffect(() => {
    const interval = setInterval(() => {
      if (!showAddUser && !showEditUser && !showViewUser) {
        loadUsers();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [showAddUser, showEditUser, showViewUser]);

  // إضافة دعم مفتاح ESC للخروج من النوافذ
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowAddUser(false);
        setShowEditUser(false);
        setShowViewUser(false);
        setShowDeleteModal(false);
        setDeleteTarget(null);
        setDeletePassword('');
        setDeleteError('');
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      await fetchUsers();
    } catch {
      setAlertMessage(t('users.errors.loadUsers'));
      setAlertType('error');
      setShowAlert(true);
    } finally {
      setLoading(false);
    }
  };

  // فلترة المستخدمين
  const getFilteredUsers = () => {
    if (!users || users.length === 0) return [];

    return users.filter(user => {
      const matchesSearch =
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.phone?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesRole = filterRole === 'all' || user.role === filterRole;
      const matchesStatus = filterStatus === 'all' || user.status === filterStatus;

      return matchesSearch && matchesRole && matchesStatus;
    });
  };

  const filteredUsers = getFilteredUsers();

  // حساب الإحصائيات
  const calculateStats = () => {
    const totalUsers = users?.length || 0;
    const activeUsers = users?.filter(u => u.status === 'active').length || 0;
    const inactiveUsers = users?.filter(u => u.status === 'inactive').length || 0;
    const suspendedUsers = users?.filter(u => u.status === 'suspended').length || 0;

    const roleStats = roles.map(role => ({
      ...role,
      count: users?.filter(u => u.role === role.id).length || 0
    }));

    return {
      totalUsers,
      activeUsers,
      inactiveUsers,
      suspendedUsers,
      roleStats
    };
  };

  const stats = calculateStats();

  // معالجة النماذج
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handlePermissionChange = (permissionId: string, checked: boolean) => {
    setFormData(prev => {
      let newPermissions: string[];

      if (permissionId === 'all') {
        // إذا تم تحديد "جميع الصلاحيات"
        if (checked) {
          newPermissions = ['all'];
        } else {
          newPermissions = prev.permissions.filter(p => p !== 'all');
        }
      } else {
        // إذا تم تحديد صلاحية أخرى
        if (checked) {
          // إزالة "جميع الصلاحيات" إذا كانت محددة
          const filteredPermissions = prev.permissions.filter(p => p !== 'all');
          newPermissions = [...filteredPermissions, permissionId];
        } else {
          newPermissions = prev.permissions.filter(p => p !== permissionId);
        }
      }

      return {
        ...prev,
        permissions: newPermissions
      };
    });
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      role: 'staff',
      status: 'active',
      phone: '',
      address: '',
      permissions: ['dashboard'], // صلاحية افتراضية للوحة التحكم
      businessName: '',
      businessType: '',
      department: '',
      position: '',
      hireDate: '',
      salary: '',
      notes: '',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!showEditUser && formData.password !== formData.confirmPassword) {
      setAlertMessage(t('users.errors.passwordMismatch'));
      setAlertType('error');
      setShowAlert(true);
      return;
    }

    if (!showEditUser && formData.password.length < 6) {
      setAlertMessage(t('users.errors.passwordMinLength'));
      setAlertType('error');
      setShowAlert(true);
      return;
    }

    if (formData.permissions.length === 0) {
      setAlertMessage(t('users.errors.permissionsRequired'));
      setAlertType('error');
      setShowAlert(true);
      return;
    }

    try {
      setSaveLoading(true);

      const userData: {
        name: string;
        email: string;
        role: string;
        status: string;
        phone: string;
        address: string;
        permissions: string[];
        password?: string;
        businessName?: string;
        businessType?: string;
        department?: string;
        position?: string;
        hireDate?: string;
        salary?: number;
        notes?: string;
      } = {
        name: formData.name,
        email: formData.email,
        role: formData.role,
        status: formData.status,
        phone: formData.phone,
        address: formData.address,
        permissions: formData.permissions,
        department: formData.department,
        position: formData.position,
        hireDate: formData.hireDate,
        salary: formData.salary ? parseFloat(formData.salary) : undefined,
        notes: formData.notes,
      };

      if (showEditUser && selectedUser) {
        // إضافة كلمة المرور فقط إذا تم تغييرها
        if (formData.password) {
          userData.password = formData.password;
        }
        await updateUser(selectedUser.id, userData);
        setShowEditUser(false);
      } else {
        userData.password = formData.password;
        const user = await createUser(userData);
        if (user) {
          if (formData.role === 'owner') {
            setAlertMessage(t('users.success.verificationEmailSent'));
            setAlertType('success');
            setShowAlert(true);
            setTimeout(() => {
              resetForm();
              setShowAddUser(false);
              window.location.href = '/login';
            }, 3000);
          } else {
            setAlertMessage(t('users.success.userAdded'));
            setAlertType('success');
            setShowAlert(true);
            setShowAddUser(false);
            resetForm();
          }
        }
      }

      resetForm();
      setSelectedUser(null);
      await loadUsers();

    } catch {
      setAlertMessage(t('users.errors.saveUser'));
      setAlertType('error');
      setShowAlert(true);
    } finally {
      setSaveLoading(false);
    }
  };

  const handleEdit = (user: UserType) => {
    const u = user as Partial<UserType & { businessName?: string; businessType?: string }>;
    setFormData({
      name: u.name || '',
      email: u.email || '',
      password: '',
      confirmPassword: '',
      role: u.role || 'staff',
      status: u.status || 'active',
      phone: u.phone || '',
      address: u.address || '',
      permissions: u.permissions || [],
      businessName: u.businessName || '',
      businessType: u.businessType || '',
      department: u.department || '',
      position: u.position || '',
      hireDate: u.hireDate ? new Date(u.hireDate).toISOString().split('T')[0] : '',
      salary: u.salary ? u.salary.toString() : '',
      notes: u.notes || '',
    });
    setSelectedUser(user);
    setShowEditUser(true);
    // إغلاق نافذة التفاصيل عند فتح نافذة التعديل
    setShowViewUser(false);
  };

  const handleView = (user: UserType) => {
    setSelectedUser(user);
    setShowViewUser(true);
  };

  const handleManagePermissions = (user: UserType) => {
    setPermissionsUser(user);
    setShowPermissionsModal(true);
  };

  const handleChangeStatus = (user: UserType) => {
    setStatusUser(user);
    setShowStatusModal(true);
  };

  const updateUserPermissions = async (userId: string, permissions: string[]) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/users/${userId}/permissions`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ permissions })
      });

      const data = await response.json();
      
      if (data.success) {
        showNotification(t('users.success.permissionsUpdated'), 'success');
        await loadUsers();
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      showNotification(t('users.errors.updatePermissions'), 'error');
      throw error;
    }
  };

  const updateUserStatus = async (userId: string, status: string) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/users/${userId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ status })
      });

      const data = await response.json();
      
      if (data.success) {
        showNotification(t('users.success.statusUpdated'), 'success');
        await loadUsers();
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      showNotification(t('users.errors.updateStatus'), 'error');
      throw error;
    }
  };

  const handleDelete = (userId: string) => {
    const target = users.find(u => u.id === userId) || null;
    setDeleteTarget(target);
    setShowDeleteModal(true);
    setDeletePassword('');
    setDeleteError('');
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.role === 'admin') {
      if (!deletePassword) {
        setDeleteError(t('users.errors.passwordRequired'));
        return;
      }
      setDeleteLoading(true);
      setDeleteError('');
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/auth/verify-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: user?.email, password: deletePassword })
        });
        const data = await res.json();
        if (!data.success) {
          setDeleteError(t('users.errors.passwordIncorrect'));
          setDeleteLoading(false);
          return;
        }
        await deleteUser(deleteTarget.id);
        setShowDeleteModal(false);
        setDeleteTarget(null);
        setDeletePassword('');
      } catch {
        showNotification(t('users.errors.verifyUser'), 'error');
      } finally {
        setDeleteLoading(false);
      }
    } else {
      setDeleteLoading(true);
      try {
        await deleteUser(deleteTarget.id);
        setShowDeleteModal(false);
        setDeleteTarget(null);
      } catch {
        showNotification(t('users.errors.deleteUser'), 'error');
      } finally {
        setDeleteLoading(false);
      }
    }
  };

  const getRoleInfo = (roleId: string) => {
    return roles.find(role => role.id === roleId) || roles[1];
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'inactive': return 'bg-red-100 text-red-800';
      case 'suspended': return 'bg-yellow-100 text-yellow-800';
      case 'pending': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      active: t('common.active'),
      inactive: t('common.inactive'),
      suspended: t('users.statusTypes.suspended').replace('⏸️ ', ''),
      pending: t('users.statusTypes.pending'),
    };
    return statusMap[status] || t('users.statusTypes.unknown');
  };


  return (
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-xl shadow-lg border-2 border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 shadow-lg">
              <UsersIcon className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                {t('users.title')}
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">{t('users.subtitle')}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={loadUsers}
              disabled={loading}
              className="group relative overflow-hidden px-5 py-3 bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white rounded-xl flex items-center gap-2 transition-all duration-300 shadow-md hover:shadow-lg hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 font-bold"
            >
              <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity"></div>
              <RefreshCw className={`h-5 w-5 relative ${loading ? 'animate-spin' : ''}`} />
              <span className="relative">{t('users.refresh')}</span>
            </button>
            
            {/* Quick Actions */}
            <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-xl">
              <Crown className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-bold text-blue-900 dark:text-blue-200">
                {t('users.advancedManagement')}
              </span>
            </div>
            
            <button
              onClick={() => {
                resetForm();
                setShowAddUser(true);
              }}
              className="group relative overflow-hidden px-6 py-3 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white rounded-xl flex items-center gap-2 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 font-bold"
            >
              <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity"></div>
              <Plus className="h-5 w-5 relative" />
              <span className="relative">{t('users.addUser')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6">
        <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-xl shadow-lg border-2 border-gray-200 dark:border-gray-700 p-6 hover:shadow-xl hover:scale-105 transition-all duration-200">
          <div className="flex items-center">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
              <UsersIcon className="h-7 w-7 text-white" />
            </div>
            <div className="mr-4">
              <p className="text-sm font-bold text-gray-600 dark:text-gray-300">{t('users.totalUsers')}</p>
              <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{formatDecimal(stats.totalUsers, currentLanguage)}</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-xl shadow-lg border-2 border-gray-200 dark:border-gray-700 p-6 hover:shadow-xl hover:scale-105 transition-all duration-200">
          <div className="flex items-center">
            <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
              <Shield className="h-7 w-7 text-white" />
            </div>
            <div className="mr-4">
              <p className="text-sm font-bold text-gray-600 dark:text-gray-300">{t('users.activeUsers')}</p>
              <p className="text-3xl font-bold text-green-600 dark:text-green-400">{formatDecimal(stats.activeUsers, currentLanguage)}</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-xl shadow-lg border-2 border-gray-200 dark:border-gray-700 p-6 hover:shadow-xl hover:scale-105 transition-all duration-200">
          <div className="flex items-center">
            <div className="w-14 h-14 bg-gradient-to-br from-red-500 to-rose-600 rounded-xl flex items-center justify-center shadow-lg">
              <Lock className="h-7 w-7 text-white" />
            </div>
            <div className="mr-4">
              <p className="text-sm font-bold text-gray-600 dark:text-gray-300">{t('users.inactiveUsers')}</p>
              <p className="text-3xl font-bold text-red-600 dark:text-red-400">{formatDecimal(stats.inactiveUsers, currentLanguage)}</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-xl shadow-lg border-2 border-gray-200 dark:border-gray-700 p-6 hover:shadow-xl hover:scale-105 transition-all duration-200">
          <div className="flex items-center">
            <div className="w-14 h-14 bg-gradient-to-br from-yellow-500 to-amber-600 rounded-xl flex items-center justify-center shadow-lg">
              <Unlock className="h-7 w-7 text-white" />
            </div>
            <div className="mr-4">
              <p className="text-sm font-bold text-gray-600 dark:text-gray-300">{t('users.suspendedUsers')}</p>
              <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">{formatDecimal(stats.suspendedUsers, currentLanguage)}</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-xl shadow-lg border-2 border-gray-200 dark:border-gray-700 p-6 hover:shadow-xl hover:scale-105 transition-all duration-200">
          <div className="flex items-center">
            <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
              <Crown className="h-7 w-7 text-white" />
            </div>
            <div className="mr-4">
              <p className="text-sm font-bold text-gray-600 dark:text-gray-300">{t('users.admins')}</p>
              <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                {formatDecimal(stats.roleStats.find(r => r.id === 'admin')?.count || 0, currentLanguage)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-xl shadow-lg border-2 border-gray-200 dark:border-gray-700 p-6 hover:shadow-xl hover:scale-105 transition-all duration-200">
          <div className="flex items-center">
            <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg">
              <Crown className="h-7 w-7 text-white" />
            </div>
            <div className="mr-4">
              <p className="text-sm font-bold text-gray-600 dark:text-gray-300">{t('users.fullPermissions')}</p>
              <p className="text-3xl font-bold text-orange-600 dark:text-orange-400">
                {formatDecimal(users?.filter(u => u.permissions?.includes('all')).length || 0, currentLanguage)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-xl shadow-lg border-2 border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Filter className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            {t('users.searchAndFilter')}
          </h3>
          <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-xs font-bold">
            {t('users.advancedFilter')}
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
              <Search className="w-4 h-4 text-blue-600" />
              {t('common.search')}
            </label>
            <div className="relative">
              <Search className="absolute right-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 dark:text-gray-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t('users.searchPlaceholder')}
                className="w-full pr-12 px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 font-semibold transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-600" />
              {t('users.role')}
            </label>
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-semibold transition-all"
            >
              <option value="all">{t('users.allRoles')}</option>
              {roles.map(role => (
                <option key={role.id} value={role.id}>{role.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
              <Filter className="w-4 h-4 text-blue-600" />
              {t('users.status')}
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-semibold transition-all"
            >
              <option value="all">{t('users.allStatuses')}</option>
              <option value="active">{t('users.statusTypes.active')}</option>
              <option value="inactive">{t('users.statusTypes.inactive')}</option>
              <option value="suspended">{t('users.statusTypes.suspended')}</option>
            </select>
          </div>
        </div>

        {/* Clear filters button */}
        {(searchTerm || filterRole !== 'all' || filterStatus !== 'all') && (
          <div className="mt-5 flex justify-end">
            <button
              onClick={() => {
                setSearchTerm('');
                setFilterRole('all');
                setFilterStatus('all');
              }}
              className="px-5 py-2.5 text-sm font-bold text-gray-700 dark:text-gray-300 bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 hover:from-gray-200 hover:to-gray-300 dark:hover:from-gray-600 dark:hover:to-gray-500 rounded-xl transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105"
            >
              {t('users.clearFilters')}
            </button>
          </div>
        )}
      </div>

      {/* Users Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {loading ? (
          <div className="col-span-full flex flex-col items-center py-12">
            <RefreshCw className="h-8 w-8 text-blue-600 animate-spin mb-2" />
            <p className="text-gray-500">{t('users.loading')}</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="col-span-full flex flex-col items-center py-12">
            <UsersIcon className="h-12 w-12 text-gray-400 mb-2" />
            <p className="text-gray-500">{t('users.noUsers')}</p>
            {(searchTerm || filterRole !== 'all' || filterStatus !== 'all') ? (
              <p className="text-sm text-gray-400">{t('users.tryDifferentSearch')}</p>
            ) : (
              <button
                onClick={() => setShowAddUser(true)}
                className="text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300 text-sm font-medium mt-2"
              >
                {t('users.addFirstUser')}
              </button>
            )}
          </div>
        ) : (
          filteredUsers.map((user) => (
            <UserCard
              key={user.id}
              user={user}
              onView={handleView}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onManagePermissions={handleManagePermissions}
              onChangeStatus={handleChangeStatus}
              getRoleInfo={getRoleInfo}
              getStatusColor={getStatusColor}
              getStatusText={getStatusText}
              permissions={permissions}
            />
          ))
        )}
      </div>

      {/* Add/Edit User Modal */}
      <UserFormModal
        isOpen={showAddUser || showEditUser}
        onClose={() => {
          setShowAddUser(false);
          setShowEditUser(false);
          resetForm();
          setSelectedUser(null);
        }}
        onSubmit={handleSubmit}
        formData={formData}
        onInputChange={handleInputChange}
        onPermissionChange={handlePermissionChange}
        roles={roles}
        permissions={permissions}
        businessTypes={businessTypes}
        isEditing={showEditUser}
        loading={saveLoading}
      />



      {/* View User Modal */}
      {showViewUser && selectedUser && (
        <UserDetailsModal
          isOpen={showViewUser}
          onClose={() => {
            setShowViewUser(false);
            setSelectedUser(null);
          }}
          user={selectedUser}
          onEdit={handleEdit}
          getRoleInfo={getRoleInfo}
          getStatusColor={getStatusColor}
          getStatusText={getStatusText}
          permissions={permissions}
          getAccessiblePages={getAccessiblePages}
          getPageDisplayName={getPageDisplayName}
        />
      )}



      {/* Delete User Modal */}
      {showDeleteModal && deleteTarget && (
        <UserDeleteModal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setDeleteTarget(null);
            setDeletePassword('');
            setDeleteError('');
          }}
          onConfirm={confirmDelete}
          user={deleteTarget}
          password={deletePassword}
          onPasswordChange={setDeletePassword}
          error={deleteError}
          loading={deleteLoading}
        />
      )}

      {/* Permissions Manager Modal */}
      <PermissionsManagerModal
        isOpen={showPermissionsModal}
        onClose={() => {
          setShowPermissionsModal(false);
          setPermissionsUser(null);
        }}
        user={permissionsUser}
        permissions={permissions}
        onUpdatePermissions={updateUserPermissions}
      />

      {/* User Status Modal */}
      <UserStatusModal
        isOpen={showStatusModal}
        onClose={() => {
          setShowStatusModal(false);
          setStatusUser(null);
        }}
        user={statusUser}
        onUpdateStatus={updateUserStatus}
      />



      {/* Alert Notification */}
      {showAlert && (
        <div className="fixed bottom-4 right-4 z-50">
          <div className={`${alertType === 'success' ? 'bg-green-500' : 'bg-red-500'} text-white px-6 py-4 rounded-lg shadow-lg flex items-center justify-between min-w-64`}>
            <div className="flex-1">
              <p className="text-sm">{alertMessage}</p>
            </div>
            <button
              onClick={() => setShowAlert(false)}
              className="text-white hover:text-gray-200 ml-4"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;
