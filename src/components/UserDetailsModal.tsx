import React from 'react';
import { X, User, Mail, Phone, MapPin, Calendar, RefreshCw, Crown, Shield, Edit } from 'lucide-react';
import { User as UserType } from '../services/api';
import { useApp } from '../context/AppContext';

interface Role {
  id: string;
  name: string;
  icon: any;
  color: string;
  bgColor: string;
  description: string;
}

interface Permission {
  id: string;
  name: string;
  description: string;
}

interface UserDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserType | null;
  onEdit: (user: UserType) => void;
  getRoleInfo: (roleId: string) => Role;
  getStatusColor: (status: string) => string;
  getStatusText: (status: string) => string;
  permissions: Permission[];
  getAccessiblePages: (permissions: string[]) => string[];
  getPageDisplayName: (page: string) => string;
}

const UserDetailsModal: React.FC<UserDetailsModalProps> = ({
  isOpen,
  onClose,
  user,
  onEdit,
  getRoleInfo,
  getStatusColor,
  getStatusText,
  permissions,
  getAccessiblePages,
  getPageDisplayName,
}) => {
  const { canEditUser } = useApp();
  
  if (!isOpen || !user) return null;

  const roleInfo = getRoleInfo(user.role);
  const canEdit = canEditUser(user);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div 
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-slideUp"
        dir="rtl"
      >
        {/* Header */}
        <div 
          className="p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0"
          style={{ 
            background: 'linear-gradient(135deg, #F97316 15 0%, #EA580C05 100%)'
          }}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4 flex-1">
              <div
                className="p-4 rounded-2xl"
                style={{ 
                  background: `linear-gradient(135deg, ${roleInfo.color.replace('text-', '#')} 0%, ${roleInfo.color.replace('text-', '#')}dd 100%)`,
                  boxShadow: '0 8px 24px -6px rgba(249, 115, 22, 0.6)'
                }}
              >
                <User className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                  {user.name}
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {user.email}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`px-3 py-1 text-xs font-bold rounded-full ${getStatusColor(user.status)}`}>
                    {getStatusText(user.status)}
                  </span>
                  <span className={`px-3 py-1 text-xs font-bold rounded-full ${roleInfo.bgColor} ${roleInfo.color}`}>
                    {roleInfo.name}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="w-6 h-6 text-gray-500 dark:text-gray-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 modern-scrollbar">
          <div className="space-y-6">
            {/* User Info */}
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-blue-600" />
                معلومات المستخدم
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700/50 dark:to-gray-800/50 rounded-xl border-2 border-gray-200 dark:border-gray-600">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                      <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold">البريد الإلكتروني</p>
                      <p className="text-sm font-bold text-gray-900 dark:text-white">{user.email}</p>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700/50 dark:to-gray-800/50 rounded-xl border-2 border-gray-200 dark:border-gray-600">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                      <Phone className="w-5 h-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold">رقم الهاتف</p>
                      <p className="text-sm font-bold text-gray-900 dark:text-white">{user.phone || 'غير محدد'}</p>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700/50 dark:to-gray-800/50 rounded-xl border-2 border-gray-200 dark:border-gray-600">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                      <Calendar className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold">تاريخ الانضمام</p>
                      <p className="text-sm font-bold text-gray-900 dark:text-white">
                        {user.createdAt ? new Date(user.createdAt).toLocaleDateString('ar-EG') : 'غير محدد'}
                      </p>
                    </div>
                  </div>
                </div>

                {user.lastLogin && (
                  <div className="p-4 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700/50 dark:to-gray-800/50 rounded-xl border-2 border-gray-200 dark:border-gray-600">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30">
                        <RefreshCw className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold">آخر دخول</p>
                        <p className="text-sm font-bold text-gray-900 dark:text-white">
                          {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString('ar-EG') : 'غير محدد'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {user.address && (
                  <div className="md:col-span-2 p-4 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700/50 dark:to-gray-800/50 rounded-xl border-2 border-gray-200 dark:border-gray-600">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                        <MapPin className="w-5 h-5 text-red-600 dark:text-red-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold mb-1">العنوان</p>
                        <p className="text-sm font-bold text-gray-900 dark:text-white">{user.address}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Professional Information */}
            {(user.department || user.position || user.hireDate || user.salary) && (
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <User className="w-5 h-5 text-green-600" />
                  المعلومات المهنية
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {user.department && (
                    <div className="p-4 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700/50 dark:to-gray-800/50 rounded-xl border-2 border-gray-200 dark:border-gray-600">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
                          <Shield className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold">القسم</p>
                          <p className="text-sm font-bold text-gray-900 dark:text-white">{user.department}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {user.position && (
                    <div className="p-4 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700/50 dark:to-gray-800/50 rounded-xl border-2 border-gray-200 dark:border-gray-600">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-teal-100 dark:bg-teal-900/30">
                          <Crown className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold">المنصب</p>
                          <p className="text-sm font-bold text-gray-900 dark:text-white">{user.position}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {user.hireDate && (
                    <div className="p-4 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700/50 dark:to-gray-800/50 rounded-xl border-2 border-gray-200 dark:border-gray-600">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-cyan-100 dark:bg-cyan-900/30">
                          <Calendar className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold">تاريخ التوظيف</p>
                          <p className="text-sm font-bold text-gray-900 dark:text-white">
                            {new Date(user.hireDate).toLocaleDateString('ar-EG')}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {user.salary && (
                    <div className="p-4 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700/50 dark:to-gray-800/50 rounded-xl border-2 border-gray-200 dark:border-gray-600">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
                          <Shield className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold">الراتب</p>
                          <p className="text-sm font-bold text-gray-900 dark:text-white">{user.salary.toLocaleString()} جنيه</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Notes */}
            {user.notes && (
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <User className="w-5 h-5 text-amber-600" />
                  ملاحظات
                </h3>
                <div className="p-5 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-2 border-amber-200 dark:border-amber-800 rounded-xl">
                  <p className="text-sm text-amber-900 dark:text-amber-200 leading-relaxed">{user.notes}</p>
                </div>
              </div>
            )}

            {/* Permissions */}
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Crown className="w-5 h-5 text-purple-600" />
                الصلاحيات
              </h3>
              {user.permissions.includes('all') ? (
                <div className="p-5 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border-2 border-purple-200 dark:border-purple-800 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-purple-100 dark:bg-purple-900/50">
                      <Crown className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <p className="text-lg font-bold text-purple-900 dark:text-purple-200">جميع الصلاحيات</p>
                      <p className="text-sm text-purple-700 dark:text-purple-400">وصول كامل لجميع ميزات النظام</p>
                    </div>
                  </div>
                </div>
              ) : user.permissions.length === 0 ? (
                <div className="p-5 bg-gray-50 dark:bg-gray-700/50 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl text-center">
                  <Shield className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500 dark:text-gray-400 font-semibold">لا توجد صلاحيات محددة</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {user.permissions.map(permission => {
                    const permInfo = permissions.find(p => p.id === permission);
                    return (
                      <div 
                        key={permission} 
                        className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-2 border-green-200 dark:border-green-800 rounded-xl hover:scale-105 transition-transform"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-3 h-3 bg-green-500 rounded-full mt-1 animate-pulse"></div>
                          <div className="flex-1">
                            <p className="text-sm font-bold text-green-900 dark:text-green-200">
                              {permInfo ? permInfo.name : permission}
                            </p>
                            {permInfo && (
                              <p className="text-xs text-green-700 dark:text-green-400 mt-1">
                                {permInfo.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Accessible Pages */}
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-600" />
                الصفحات المتاحة
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {getAccessiblePages(user.permissions).length > 0 ? (
                  getAccessiblePages(user.permissions).map(page => (
                    <div 
                      key={page} 
                      className="p-3 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-xl hover:scale-105 transition-transform"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        <span className="text-sm font-bold text-blue-900 dark:text-blue-200">
                          {getPageDisplayName(page)}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="col-span-full p-5 bg-gray-50 dark:bg-gray-700/50 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl text-center">
                    <p className="text-gray-500 dark:text-gray-400 font-semibold">لا توجد صفحات متاحة</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t-2 border-gray-200 dark:border-gray-700 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 flex-shrink-0">
          <div className="flex gap-3">
            {canEdit && (
              <button
                onClick={() => {
                  onEdit(user);
                  onClose();
                }}
                className="flex-1 group relative overflow-hidden px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 font-bold"
              >
                <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity"></div>
                <div className="relative flex items-center justify-center gap-2">
                  <Edit className="w-5 h-5" />
                  <span>تعديل المستخدم</span>
                </div>
              </button>
            )}
            <button
              onClick={onClose}
              className={`${canEdit ? '' : 'flex-1'} px-6 py-3 bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white rounded-xl transition-all duration-300 shadow-md hover:shadow-lg hover:scale-105 font-bold`}
            >
              إغلاق
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserDetailsModal;
