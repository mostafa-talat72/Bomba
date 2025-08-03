import React, { useState, useEffect } from 'react';
import { Users as UsersIcon, Plus, Shield, User, Crown, Search, Filter, Lock, Unlock, Calendar, Phone, MapPin, RefreshCw } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { User as UserType } from '../services/api';
import UserCard from '../components/UserCard';
import { formatDecimal } from '../utils/formatters';

const Users = () => {
  const { users, fetchUsers, createUser, updateUser, deleteUser, showNotification, user } = useApp();
  const [showAddUser, setShowAddUser] = useState(false);
  const [showEditUser, setShowEditUser] = useState(false);
  const [showViewUser, setShowViewUser] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserType | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
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
  });
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserType | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  // إخفاء خيار 'مالك' من قائمة الأدوار في لوحة المدير
  const roles = [
    { id: 'admin', name: 'مدير', icon: Crown, color: 'text-purple-600', bgColor: 'bg-purple-100', description: 'صلاحيات كاملة على النظام - جميع الصلاحيات' },
    { id: 'staff', name: 'موظف', icon: User, color: 'text-blue-600', bgColor: 'bg-blue-100', description: 'صلاحيات محدودة - لوحة التحكم، التقارير، الإعدادات' },
    { id: 'cashier', name: 'كاشير', icon: Shield, color: 'text-green-600', bgColor: 'bg-green-100', description: 'إدارة المبيعات والفواتير - الطلبات، المنيو، الفواتير، التقارير' },
    { id: 'kitchen', name: 'مطبخ', icon: Shield, color: 'text-orange-600', bgColor: 'bg-orange-100', description: 'إدارة الطلبات والمطبخ - الطلبات، المنيو، المخزون، التكاليف' },
    // لا تضف خيار 'مالك' هنا
  ];

  const permissions = [
    { id: 'all', name: 'جميع الصلاحيات', description: 'وصول كامل لجميع الميزات والتحكم الكامل في النظام' },
    { id: 'dashboard', name: 'لوحة التحكم', description: 'التحكم الكامل في لوحة التحكم وعرض الإحصائيات والتقارير' },
    { id: 'playstation', name: 'البلايستيشن', description: 'التحكم الكامل في أجهزة البلايستيشن وجلسات اللعب' },
    { id: 'computer', name: 'الكمبيوتر', description: 'التحكم الكامل في أجهزة الكمبيوتر وجلسات الاستخدام' },
    { id: 'cafe', name: 'الطلبات', description: 'التحكم الكامل في طلبات الطلبات والمشروبات والخدمة' },
    { id: 'menu', name: 'المنيو', description: 'التحكم الكامل في قائمة الطعام والمشروبات والأسعار' },
    { id: 'billing', name: 'الفواتير', description: 'التحكم الكامل في إنشاء وإدارة الفواتير والمدفوعات' },
    { id: 'reports', name: 'التقارير', description: 'التحكم الكامل في عرض وتصدير جميع التقارير' },
    { id: 'inventory', name: 'المخزون', description: 'التحكم الكامل في المخزون والأصناف والمشتريات' },
    { id: 'costs', name: 'التكاليف', description: 'التحكم الكامل في التكاليف والمصروفات والميزانية' },
    { id: 'users', name: 'المستخدمين', description: 'التحكم الكامل في المستخدمين والصلاحيات والأدوار' },
    { id: 'settings', name: 'الإعدادات', description: 'التحكم الكامل في إعدادات النظام والتكوين' },
  ];

  const businessTypes = [
    { id: 'cafe', name: 'كافيه' },
    { id: 'restaurant', name: 'مطعم' },
    { id: 'playstation', name: 'بلايستيشن' },
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
      inventory: ['inventory'],
      costs: ['costs'],
      users: ['users'],
      settings: ['settings'],
      notifications: ['dashboard', 'playstation', 'computer', 'cafe', 'menu', 'billing', 'reports', 'inventory', 'costs', 'users', 'settings']
    };

    const accessiblePages = [];

    for (const [page, requiredPermissions] of Object.entries(pagePermissions)) {
      if (userPermissions.includes('all') || requiredPermissions.some(permission => userPermissions.includes(permission))) {
        accessiblePages.push(page);
      }
    }

    return accessiblePages;
  };

  // Get page display name
  const getPageDisplayName = (page: string) => {
    const pageNames = {
      dashboard: 'لوحة التحكم',
      playstation: 'البلايستيشن',
      computer: 'الكمبيوتر',
      cafe: 'الطلبات',
      menu: 'المنيو',
      billing: 'الفواتير',
      reports: 'التقارير',
      inventory: 'المخزون',
      costs: 'التكاليف',
      users: 'المستخدمين',
      settings: 'الإعدادات',
      notifications: 'الإشعارات'
    };
    return pageNames[page as keyof typeof pageNames] || page;
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
      showNotification('خطأ في تحميل المستخدمين', 'error');
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
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // التحقق من صحة البيانات
    if (!showEditUser && formData.password !== formData.confirmPassword) {
      showNotification('كلمات المرور غير متطابقة', 'error');
      return;
    }

    if (!showEditUser && formData.password.length < 6) {
      showNotification('كلمة المرور يجب أن تكون 6 أحرف على الأقل', 'error');
      return;
    }

    // التحقق من الصلاحيات
    if (formData.permissions.length === 0) {
      showNotification('يجب تحديد صلاحية واحدة على الأقل', 'error');
      return;
    }

    try {
      setLoading(true);

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
      } = {
        name: formData.name,
        email: formData.email,
        role: formData.role,
        status: formData.status,
        phone: formData.phone,
        address: formData.address,
        permissions: formData.permissions
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
        setLoading(false);
        if (user) {
          if (formData.role === 'owner') {
            showNotification('تم إرسال رسالة تأكيد إلى بريدك الإلكتروني. يرجى تفعيل الحساب من الإيميل ثم تسجيل الدخول.', 'success');
            setTimeout(() => {
              resetForm();
              setShowAddUser(false);
              window.location.href = '/login';
            }, 3000);
          } else {
            showNotification('تم إضافة المستخدم بنجاح', 'success');
            setShowAddUser(false);
            resetForm();
          }
        }
      }

      resetForm();
      setSelectedUser(null);
      await loadUsers();

    } catch {
      showNotification('خطأ في حفظ المستخدم', 'error');
    } finally {
      setLoading(false);
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
        setDeleteError('يرجى إدخال كلمة المرور');
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
          setDeleteError('كلمة المرور غير صحيحة');
          setDeleteLoading(false);
          return;
        }
        await deleteUser(deleteTarget.id);
        setShowDeleteModal(false);
        setDeleteTarget(null);
        setDeletePassword('');
      } catch {
        showNotification('خطأ في تحقق المستخدم', 'error');
      } finally {
        setDeleteLoading(false);
      }
    } else {
      // حذف مباشر للعامل
      setDeleteLoading(true);
      try {
        await deleteUser(deleteTarget.id);
        setShowDeleteModal(false);
        setDeleteTarget(null);
      } catch {
        showNotification('خطأ في حذف المستخدم', 'error');
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
    switch (status) {
      case 'active': return 'نشط';
      case 'inactive': return 'غير نشط';
      case 'suspended': return 'معلق';
      case 'pending': return 'في الانتظار';
      default: return 'غير معروف';
    }
  };


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <UsersIcon className="h-8 w-8 text-primary-600 ml-3" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">إدارة المستخدمين</h1>
            <p className="text-gray-600">إدارة الحسابات والصلاحيات</p>
          </div>
        </div>
        <div className="flex items-center space-x-3 space-x-reverse">
          <button
            onClick={loadUsers}
            disabled={loading}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg flex items-center transition-colors duration-200 disabled:opacity-50"
          >
            <RefreshCw className={`h-5 w-5 ml-2 ${loading ? 'animate-spin' : ''}`} />
            تحديث
          </button>
          <button
            onClick={() => {
              resetForm();
              setShowAddUser(true);
            }}
            className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg flex items-center transition-colors duration-200"
          >
            <Plus className="h-5 w-5 ml-2" />
            إضافة مستخدم
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
              <UsersIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="mr-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">إجمالي المستخدمين</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{formatDecimal(stats.totalUsers)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
              <Shield className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div className="mr-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">نشط</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{formatDecimal(stats.activeUsers)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-red-100 dark:bg-red-900 rounded-lg flex items-center justify-center">
              <Lock className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <div className="mr-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">غير نشط</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{formatDecimal(stats.inactiveUsers)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900 rounded-lg flex items-center justify-center">
              <Unlock className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div className="mr-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">معلق</p>
              <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{formatDecimal(stats.suspendedUsers)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center">
              <Crown className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="mr-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">المديرون</p>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {formatDecimal(stats.roleStats.find(r => r.id === 'admin')?.count || 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">البحث والفلترة</h3>
          <div className="flex items-center space-x-2 space-x-reverse">
            <Filter className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            <span className="text-sm text-gray-500 dark:text-gray-400">فلترة متقدمة</span>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">البحث</label>
            <div className="relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="البحث بالاسم أو البريد الإلكتروني أو الهاتف..."
                className="w-full pr-10 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">الدور</label>
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="all">جميع الأدوار</option>
              {roles.map(role => (
                <option key={role.id} value={role.id}>{role.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">الحالة</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="all">جميع الحالات</option>
              <option value="active">نشط</option>
              <option value="inactive">غير نشط</option>
              <option value="suspended">معلق</option>
            </select>
          </div>
        </div>

        {/* Clear filters button */}
        {(searchTerm || filterRole !== 'all' || filterStatus !== 'all') && (
          <div className="mt-4 flex justify-end">
            <button
              onClick={() => {
                setSearchTerm('');
                setFilterRole('all');
                setFilterStatus('all');
              }}
              className="px-3 py-1 text-sm text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors duration-200"
            >
              مسح الفلاتر
            </button>
          </div>
        )}
      </div>

      {/* Users Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {loading ? (
          <div className="col-span-full flex flex-col items-center py-12">
            <RefreshCw className="h-8 w-8 text-blue-600 animate-spin mb-2" />
            <p className="text-gray-500">جاري تحميل المستخدمين...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="col-span-full flex flex-col items-center py-12">
            <UsersIcon className="h-12 w-12 text-gray-400 mb-2" />
            <p className="text-gray-500">لا توجد مستخدمين</p>
            {(searchTerm || filterRole !== 'all' || filterStatus !== 'all') ? (
              <p className="text-sm text-gray-400">جرب تغيير معايير البحث</p>
            ) : (
              <button
                onClick={() => setShowAddUser(true)}
                className="text-primary-600 hover:text-primary-700 text-sm font-medium mt-2"
              >
                إضافة أول مستخدم
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
              getRoleInfo={getRoleInfo}
              getStatusColor={getStatusColor}
              getStatusText={getStatusText}
              permissions={permissions}
            />
          ))
        )}
      </div>

      {/* Add/Edit User Modal */}
      {(showAddUser || showEditUser) && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowAddUser(false);
              setShowEditUser(false);
            }
          }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 rounded-t-lg">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {showEditUser ? 'تعديل المستخدم' : 'إضافة مستخدم جديد'}
                </h3>
                <button
                  className="text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-2xl font-bold transition-colors duration-200"
                  onClick={() => {
                    setShowAddUser(false);
                    setShowEditUser(false);
                  }}
                >×</button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">الاسم الكامل *</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                    placeholder="أدخل الاسم الكامل"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">البريد الإلكتروني *</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                    placeholder="user@bomba.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {showEditUser ? 'كلمة المرور الجديدة (اختياري)' : 'كلمة المرور *'}
                  </label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    required={!showEditUser}
                    minLength={6}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                    placeholder={showEditUser ? "اتركها فارغة إذا لم ترد تغييرها" : "كلمة المرور"}
                  />
                </div>

                {!showEditUser && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      تأكيد كلمة المرور *
                    </label>
                    <input
                      type="password"
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                      required
                      minLength={6}
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                      placeholder="تأكيد كلمة المرور"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">رقم الهاتف</label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                    placeholder="رقم الهاتف"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">الدور *</label>
                  <select
                    name="role"
                    value={formData.role}
                    onChange={handleInputChange}
                    required
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  >
                    {roles.map(role => (
                      <option key={role.id} value={role.id}>{role.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">الحالة *</label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    required
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  >
                    <option value="active">نشط</option>
                    <option value="inactive">غير نشط</option>
                    <option value="suspended">معلق</option>
                  </select>
                </div>

                {formData.role === 'owner' && (
                  <>
                    <div className="mb-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">اسم المنشأة *</label>
                      <input
                        type="text"
                        name="businessName"
                        value={formData.businessName}
                        onChange={handleInputChange}
                        required
                        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                        placeholder="أدخل اسم المنشأة"
                      />
                    </div>
                    <div className="mb-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">نوع المنشأة *</label>
                      <select
                        name="businessType"
                        value={formData.businessType}
                        onChange={handleInputChange}
                        required
                        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      >
                        <option value="">اختر نوع المنشأة</option>
                        {businessTypes.map((type) => (
                          <option key={type.id} value={type.id}>{type.name}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">العنوان</label>
                  <textarea
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    rows={2}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                    placeholder="العنوان"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    الصلاحيات <span className="text-red-500">*</span>
                  </label>
                  <div className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto">
                      {permissions.map(permission => (
                        <label key={permission.id} className="flex items-start p-3 bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-500 transition-colors cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.permissions.includes(permission.id)}
                            onChange={(e) => handlePermissionChange(permission.id, e.target.checked)}
                            className="mt-1 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                          />
                          <div className="mr-3 flex-1">
                            <div className="text-sm font-medium text-gray-700 dark:text-gray-200">{permission.name}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{permission.description}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                    <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-lg">
                      <div className="flex items-center">
                        <div className="w-2 h-2 bg-blue-500 rounded-full ml-2"></div>
                        <span className="text-xs text-blue-700 dark:text-blue-300">
                          الصلاحيات المحددة: {formatDecimal(formData.permissions.length)} من {formatDecimal(permissions.length)}
                        </span>
                      </div>
                      {formData.permissions.includes('all') && (
                        <div className="mt-2 text-xs text-green-600 dark:text-green-400 font-medium">
                          ✓ تم تحديد "جميع الصلاحيات" - سيتم تجاهل الصلاحيات الأخرى
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    * اختر الصلاحيات المطلوبة للمستخدم. اختيار "جميع الصلاحيات" يمنح صلاحيات كاملة
                  </div>
                </div>
              </div>
            </form>

            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3 space-x-reverse">
              <button
                onClick={() => {
                  setShowAddUser(false);
                  setShowEditUser(false);
                  resetForm();
                  setSelectedUser(null);
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors duration-200"
              >
                إلغاء
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors duration-200 disabled:opacity-50"
              >
                {loading ? 'جاري الحفظ...' : (showEditUser ? 'تحديث المستخدم' : 'إضافة المستخدم')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View User Modal */}
      {showViewUser && selectedUser && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowViewUser(false);
              setSelectedUser(null);
            }
          }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-primary-50 to-primary-100 dark:from-primary-900 dark:to-primary-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 rounded-t-xl">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">تفاصيل المستخدم</h3>
                <button
                  onClick={() => {
                    setShowViewUser(false);
                    setSelectedUser(null);
                  }}
                  className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors duration-200 text-2xl font-bold"
                >×</button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* User Header */}
              <div className="flex items-center">
                <div className="w-20 h-20 bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-800 dark:to-primary-700 rounded-full flex items-center justify-center">
                  <User className="h-10 w-10 text-primary-600 dark:text-primary-400" />
                </div>
                <div className="mr-4 flex-1">
                  <h4 className="text-xl font-bold text-gray-900 dark:text-gray-100">{selectedUser.name}</h4>
                  <p className="text-gray-500 dark:text-gray-400">{selectedUser.email}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(selectedUser.status)}`}>
                      {getStatusText(selectedUser.status)}
                    </span>
                    <span className={`px-3 py-1 text-sm font-medium rounded-full ${getRoleInfo(selectedUser.role).bgColor} ${getRoleInfo(selectedUser.role).color}`}>
                      {getRoleInfo(selectedUser.role).name}
                    </span>
                  </div>
                </div>
              </div>

              {/* User Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h5 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">معلومات المستخدم</h5>
                  <div className="space-y-3">
                    <div className="flex items-center">
                      <Phone className="h-4 w-4 text-gray-400 dark:text-gray-500 ml-2" />
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {selectedUser.phone || 'غير محدد'}
                      </span>
                    </div>
                    <div className="flex items-center">
                      <MapPin className="h-4 w-4 text-gray-400 dark:text-gray-500 ml-2" />
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {selectedUser.address || 'غير محدد'}
                      </span>
                    </div>
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 text-gray-400 dark:text-gray-500 ml-2" />
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        انضم في: {new Date(selectedUser.createdAt).toLocaleDateString('ar-EG')}
                      </span>
                    </div>
                    {selectedUser.lastLogin && (
                      <div className="flex items-center">
                        <RefreshCw className="h-4 w-4 text-gray-400 dark:text-gray-500 ml-2" />
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          آخر دخول: {new Date(selectedUser.lastLogin).toLocaleDateString('ar-EG')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h5 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">الصلاحيات</h5>
                  <div className="space-y-2">
                    {selectedUser.permissions.includes('all') ? (
                      <div className="flex items-center p-3 bg-purple-50 dark:bg-purple-900 border border-purple-200 dark:border-purple-700 rounded-lg">
                        <Crown className="h-5 w-5 text-purple-600 dark:text-purple-400 ml-2" />
                        <div>
                          <div className="text-sm font-medium text-purple-800 dark:text-purple-200">جميع الصلاحيات</div>
                          <div className="text-xs text-purple-600 dark:text-purple-400">وصول كامل لجميع الميزات</div>
                        </div>
                      </div>
                    ) : selectedUser.permissions.length === 0 ? (
                      <div className="p-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg">
                        <p className="text-sm text-gray-500 dark:text-gray-400">لا توجد صلاحيات محددة</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-2">
                        {selectedUser.permissions.map(permission => {
                          const permInfo = permissions.find(p => p.id === permission);
                          return (
                            <div key={permission} className="flex items-center p-2 bg-green-50 dark:bg-green-900 border border-green-200 dark:border-green-700 rounded-lg">
                              <div className="w-2 h-2 bg-green-500 rounded-full ml-2"></div>
                              <div>
                                <div className="text-sm font-medium text-green-800 dark:text-green-200">
                                  {permInfo ? permInfo.name : permission}
                                </div>
                                {permInfo && (
                                  <div className="text-xs text-green-600 dark:text-green-400">{permInfo.description}</div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Accessible Pages */}
              <div>
                <h5 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">الصفحات المتاحة</h5>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {getAccessiblePages(selectedUser.permissions).length > 0 ? (
                    getAccessiblePages(selectedUser.permissions).map(page => (
                      <div key={page} className="flex items-center p-2 bg-green-50 dark:bg-green-900 border border-green-200 dark:border-green-700 rounded-lg">
                        <div className="w-2 h-2 bg-green-500 rounded-full ml-2"></div>
                        <span className="text-sm text-green-700 dark:text-green-300 font-medium">
                          {getPageDisplayName(page)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-full p-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg">
                      <p className="text-sm text-gray-500 dark:text-gray-400 text-center">لا توجد صفحات متاحة</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 flex justify-end gap-3">
              <button
                onClick={() => handleEdit(selectedUser)}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors duration-200"
              >
                تعديل المستخدم
              </button>
              <button
                onClick={() => {
                  setShowViewUser(false);
                  setSelectedUser(null);
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-500 transition-colors duration-200"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete User Modal */}
      {showDeleteModal && deleteTarget && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowDeleteModal(false);
              setDeleteTarget(null);
              setDeletePassword('');
              setDeleteError('');
            }
          }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 rounded-t-lg">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">تأكيد حذف المستخدم</h3>
                <button
                  className="text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-2xl font-bold transition-colors duration-200"
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDeleteTarget(null);
                    setDeletePassword('');
                    setDeleteError('');
                  }}
                >×</button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-gray-700 dark:text-gray-300">هل أنت متأكد أنك تريد حذف المستخدم <span className="font-bold text-red-600 dark:text-red-400">{deleteTarget.name}</span>؟</p>
              {deleteTarget.role === 'admin' && (
                <>
                  <input
                    type="password"
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                    placeholder="أدخل كلمة المرور لتأكيد الحذف"
                    value={deletePassword}
                    onChange={e => setDeletePassword(e.target.value)}
                    autoFocus
                  />
                  {deleteError && <div className="text-red-600 dark:text-red-400 text-sm">{deleteError}</div>}
                </>
              )}
            </div>
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3 space-x-reverse">
              <button
                onClick={() => { setShowDeleteModal(false); setDeleteTarget(null); setDeletePassword(''); setDeleteError(''); }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors duration-200"
                disabled={deleteLoading}
              >
                إلغاء
              </button>
              <button
                onClick={confirmDelete}
                className={`px-4 py-2 rounded-lg transition-colors duration-200 disabled:opacity-50 ${deleteTarget.role === 'admin' ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-primary-600 hover:bg-primary-700 text-white'}`}
                disabled={deleteLoading}
              >
                {deleteLoading ? 'جاري الحذف...' : (deleteTarget.role === 'admin' ? 'تأكيد الحذف' : 'نعم، احذف')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;
