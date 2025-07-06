import React, { useState, useEffect } from 'react';
import { Users as UsersIcon, Plus, Edit, Trash2, Shield, User, Crown, Search, Filter, Eye, Lock, Unlock, Calendar, Phone, MapPin, RefreshCw } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { User as UserType } from '../services/api';

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
    permissions: [] as string[]
  });
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserType | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  const roles = [
    { id: 'admin', name: 'مدير', icon: Crown, color: 'text-purple-600', bgColor: 'bg-purple-100', description: 'صلاحيات كاملة على النظام' },
    { id: 'staff', name: 'موظف', icon: User, color: 'text-blue-600', bgColor: 'bg-blue-100', description: 'صلاحيات محدودة' },
    { id: 'cashier', name: 'كاشير', icon: Shield, color: 'text-green-600', bgColor: 'bg-green-100', description: 'إدارة المبيعات والفواتير' },
    { id: 'kitchen', name: 'مطبخ', icon: Shield, color: 'text-orange-600', bgColor: 'bg-orange-100', description: 'إدارة الطلبات والمطبخ' },
  ];

  const permissions = [
    { id: 'all', name: 'جميع الصلاحيات', description: 'وصول كامل لجميع الميزات' },
    { id: 'dashboard', name: 'لوحة التحكم', description: 'عرض الإحصائيات والتقارير' },
    { id: 'playstation', name: 'البلايستيشن', description: 'إدارة جلسات البلايستيشن' },
    { id: 'computer', name: 'الكمبيوتر', description: 'إدارة جلسات الكمبيوتر' },
    { id: 'cafe', name: 'الكافيه', description: 'إدارة الطلبات والمشروبات' },
    { id: 'billing', name: 'الفواتير', description: 'إنشاء وإدارة الفواتير' },
    { id: 'reports', name: 'التقارير', description: 'عرض وتصدير التقارير' },
    { id: 'inventory', name: 'المخزون', description: 'إدارة المخزون والأصناف' },
    { id: 'costs', name: 'التكاليف', description: 'إدارة التكاليف والمصروفات' },
    { id: 'users', name: 'المستخدمين', description: 'إدارة المستخدمين والصلاحيات' },
    { id: 'settings', name: 'الإعدادات', description: 'تعديل إعدادات النظام' },
  ];

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

  const loadUsers = async () => {
    try {
      setLoading(true);
      await fetchUsers();
    } catch (error) {
      console.error('Error loading users:', error);
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
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePermissionChange = (permissionId: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      permissions: checked
        ? [...prev.permissions, permissionId]
        : prev.permissions.filter(p => p !== permissionId)
    }));
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
      permissions: []
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

    try {
      setLoading(true);

      const userData: any = {
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
        await createUser(userData);
        setShowAddUser(false);
      }

      resetForm();
      setSelectedUser(null);
      await loadUsers();

    } catch (error) {
      console.error('Error saving user:', error);
      showNotification('خطأ في حفظ المستخدم', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (user: UserType) => {
    setSelectedUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: '',
      confirmPassword: '',
      role: user.role,
      status: user.status,
      phone: user.phone || '',
      address: user.address || '',
      permissions: user.permissions || []
    });
    setShowEditUser(true);
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
        const res = await fetch('/api/auth/verify-password', {
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
      } catch (err) {
        setDeleteError('حدث خطأ أثناء التحقق');
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
      } catch (err) {
        setDeleteError('حدث خطأ أثناء الحذف');
      } finally {
        setDeleteLoading(false);
      }
    }
  };

  const handleStatusChange = async (userId: string, newStatus: string) => {
    try {
      setLoading(true);
      await updateUser(userId, { status: newStatus });
      showNotification('تم تحديث حالة المستخدم بنجاح', 'success');
      await loadUsers();
    } catch (error) {
      console.error('Error updating user status:', error);
      showNotification('خطأ في تحديث حالة المستخدم', 'error');
    } finally {
      setLoading(false);
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

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatDateTime = (date: string | Date) => {
    return new Date(date).toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <UsersIcon className="h-6 w-6 text-blue-600" />
            </div>
            <div className="mr-4">
              <p className="text-sm font-medium text-gray-600">إجمالي المستخدمين</p>
              <p className="text-2xl font-bold text-blue-600">{stats.totalUsers}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <Shield className="h-6 w-6 text-green-600" />
            </div>
            <div className="mr-4">
              <p className="text-sm font-medium text-gray-600">نشط</p>
              <p className="text-2xl font-bold text-green-600">{stats.activeUsers}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
              <Lock className="h-6 w-6 text-red-600" />
            </div>
            <div className="mr-4">
              <p className="text-sm font-medium text-gray-600">غير نشط</p>
              <p className="text-2xl font-bold text-red-600">{stats.inactiveUsers}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Unlock className="h-6 w-6 text-yellow-600" />
            </div>
            <div className="mr-4">
              <p className="text-sm font-medium text-gray-600">معلق</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.suspendedUsers}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Crown className="h-6 w-6 text-purple-600" />
            </div>
            <div className="mr-4">
              <p className="text-sm font-medium text-gray-600">المديرون</p>
              <p className="text-2xl font-bold text-purple-600">
                {stats.roleStats.find(r => r.id === 'admin')?.count || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">البحث والفلترة</h3>
          <div className="flex items-center space-x-2 space-x-reverse">
            <Filter className="h-5 w-5 text-gray-500" />
            <span className="text-sm text-gray-500">فلترة متقدمة</span>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">البحث</label>
            <div className="relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="البحث بالاسم أو البريد الإلكتروني أو الهاتف..."
                className="w-full pr-10 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">الدور</label>
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="all">جميع الأدوار</option>
              {roles.map(role => (
                <option key={role.id} value={role.id}>{role.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">الحالة</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
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
              className="px-3 py-1 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors duration-200"
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
          filteredUsers.map((user) => {
            const roleInfo = getRoleInfo(user.role);
            const RoleIcon = roleInfo.icon;
            const statusColor = getStatusColor(user.status);
            return (
              <div
                key={user.id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex flex-col relative hover:shadow-lg transition-shadow duration-200 cursor-pointer group"
                onClick={() => handleView(user)}
                tabIndex={0}
                role="button"
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') handleView(user); }}
                aria-label={`تفاصيل المستخدم ${user.name}`}
              >
                {/* حالة المستخدم */}
                <span className={`absolute top-4 left-4 px-3 py-1 text-xs font-bold rounded-full ${statusColor}`}
                  title={getStatusText(user.status)}>
                  {getStatusText(user.status)}
                </span>
                {/* صورة أو أيقونة */}
                <div className="flex items-center mb-4">
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                    <User className="h-6 w-6 text-gray-600" />
                  </div>
                  <div className="mr-4">
                    <div className="text-lg font-bold text-gray-900">{user.name}</div>
                    <div className="text-xs text-gray-500">{user.email}</div>
                  </div>
                </div>
                {/* الدور */}
                <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mb-2 ${roleInfo.bgColor} ${roleInfo.color}`}
                  title={roleInfo.description}>
                  <RoleIcon className="h-3 w-3 ml-1" />
                  {roleInfo.name}
                </div>
                {/* آخر دخول */}
                <div className="text-xs text-gray-400 mb-2">
                  آخر دخول: {user.lastLogin ? formatDateTime(user.lastLogin) : 'لم يسجل دخول'}
                </div>
                {/* الصلاحيات */}
                <div className="flex flex-wrap gap-1 mb-3">
                  {user.permissions?.includes('all') ? (
                    <span className="text-purple-600 font-medium text-xs">جميع الصلاحيات</span>
                  ) : (
                    user.permissions?.slice(0, 2).map(perm => (
                      <span key={perm} className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                        {permissions.find(p => p.id === perm)?.name || perm}
                      </span>
                    ))
                  )}
                  {user.permissions && user.permissions.length > 2 && (
                    <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
                      +{user.permissions.length - 2}
                    </span>
                  )}
                </div>
                {/* أزرار الإجراءات */}
                <div
                  className="flex items-center gap-2 mt-auto z-10"
                  onClick={e => e.stopPropagation()}
                >
                  <button
                    onClick={() => handleView(user)}
                    className="text-green-600 hover:text-green-900 p-1 rounded hover:bg-green-50 transition-colors"
                    title="عرض"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleEdit(user)}
                    className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50 transition-colors"
                    title="تعديل"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(user.id)}
                    className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50 transition-colors"
                    title="حذف"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add/Edit User Modal */}
      {(showAddUser || showEditUser) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {showEditUser ? 'تعديل المستخدم' : 'إضافة مستخدم جديد'}
              </h3>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">الاسم الكامل *</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="أدخل الاسم الكامل"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">البريد الإلكتروني *</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="user@bastira.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {showEditUser ? 'كلمة المرور الجديدة (اختياري)' : 'كلمة المرور *'}
                  </label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    required={!showEditUser}
                    minLength={6}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder={showEditUser ? "اتركها فارغة إذا لم ترد تغييرها" : "كلمة المرور"}
                  />
                </div>

                {!showEditUser && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      تأكيد كلمة المرور *
                    </label>
                    <input
                      type="password"
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                      required
                      minLength={6}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="تأكيد كلمة المرور"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">رقم الهاتف</label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="رقم الهاتف"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">الدور *</label>
                  <select
                    name="role"
                    value={formData.role}
                    onChange={handleInputChange}
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    {roles.map(role => (
                      <option key={role.id} value={role.id}>{role.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">الحالة *</label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="active">نشط</option>
                    <option value="inactive">غير نشط</option>
                    <option value="suspended">معلق</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">العنوان</label>
                  <textarea
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    rows={2}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="العنوان"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">الصلاحيات</label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-3">
                    {permissions.map(permission => (
                      <label key={permission.id} className="flex items-start p-2 border border-gray-200 rounded hover:bg-gray-50 transition-colors">
                        <input
                          type="checkbox"
                          checked={formData.permissions.includes(permission.id)}
                          onChange={(e) => handlePermissionChange(permission.id, e.target.checked)}
                          className="mt-1 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                        <div className="mr-2">
                          <div className="text-sm font-medium text-gray-700">{permission.name}</div>
                          <div className="text-xs text-gray-500">{permission.description}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                  <div className="mt-2 text-xs text-gray-500">
                    * اختر "جميع الصلاحيات" لمنح صلاحيات كاملة
                  </div>
                </div>
              </div>
            </form>

            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3 space-x-reverse">
              <button
                onClick={() => {
                  setShowAddUser(false);
                  setShowEditUser(false);
                  resetForm();
                  setSelectedUser(null);
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors duration-200"
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">تفاصيل المستخدم</h3>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-center">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                  <User className="h-8 w-8 text-gray-600" />
                </div>
                <div className="mr-4">
                  <h4 className="text-lg font-semibold text-gray-900">{selectedUser.name}</h4>
                  <p className="text-gray-500">{selectedUser.email}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">الدور</label>
                  <p className="text-sm text-gray-900">{getRoleInfo(selectedUser.role).name}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">الحالة</label>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(selectedUser.status)}`}>
                    {getStatusText(selectedUser.status)}
                  </span>
                </div>

                {selectedUser.phone && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">رقم الهاتف</label>
                    <p className="text-sm text-gray-900 flex items-center">
                      <Phone className="h-4 w-4 ml-1" />
                      {selectedUser.phone}
                    </p>
                  </div>
                )}

                {selectedUser.address && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">العنوان</label>
                    <p className="text-sm text-gray-900 flex items-center">
                      <MapPin className="h-4 w-4 ml-1" />
                      {selectedUser.address}
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700">آخر دخول</label>
                  <p className="text-sm text-gray-900 flex items-center">
                    <Calendar className="h-4 w-4 ml-1" />
                    {selectedUser.lastLogin ? formatDateTime(selectedUser.lastLogin) : 'لم يسجل دخول'}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">تاريخ الإنشاء</label>
                  <p className="text-sm text-gray-900">{formatDate(selectedUser.createdAt)}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">الصلاحيات</label>
                  <div className="mt-2">
                    {selectedUser.permissions?.includes('all') ? (
                      <span className="text-purple-600 font-medium">جميع الصلاحيات</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {selectedUser.permissions?.map(perm => (
                          <span key={perm} className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                            {permissions.find(p => p.id === perm)?.name || perm}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => {
                  setShowViewUser(false);
                  setSelectedUser(null);
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors duration-200"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete User Modal */}
      {showDeleteModal && deleteTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">تأكيد حذف المستخدم</h3>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-gray-700">هل أنت متأكد أنك تريد حذف المستخدم <span className="font-bold text-red-600">{deleteTarget.name}</span>؟</p>
              {deleteTarget.role === 'admin' && (
                <>
                  <input
                    type="password"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="أدخل كلمة المرور لتأكيد الحذف"
                    value={deletePassword}
                    onChange={e => setDeletePassword(e.target.value)}
                    autoFocus
                  />
                  {deleteError && <div className="text-red-600 text-sm">{deleteError}</div>}
                </>
              )}
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3 space-x-reverse">
              <button
                onClick={() => { setShowDeleteModal(false); setDeleteTarget(null); setDeletePassword(''); setDeleteError(''); }}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors duration-200"
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
