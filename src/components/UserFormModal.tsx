import React from 'react';
import { X, Save, User, Mail, Lock, Phone, MapPin, Shield, Crown } from 'lucide-react';

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

interface FormData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: string;
  status: string;
  phone: string;
  address: string;
  permissions: string[];
  businessName: string;
  businessType: string;
}

interface UserFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  formData: FormData;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  onPermissionChange: (permissionId: string, checked: boolean) => void;
  roles: Role[];
  permissions: Permission[];
  businessTypes: { id: string; name: string; }[];
  isEditing: boolean;
  loading: boolean;
}

const UserFormModal: React.FC<UserFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  formData,
  onInputChange,
  onPermissionChange,
  roles,
  permissions,
  businessTypes,
  isEditing,
  loading,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div 
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-slideUp"
        dir="rtl"
      >
        {/* Header */}
        <div 
          className="p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0"
          style={{ 
            background: isEditing 
              ? 'linear-gradient(135deg, #3B82F615 0%, #6366F105 100%)'
              : 'linear-gradient(135deg, #10B98115 0%, #05966905 100%)'
          }}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4 flex-1">
              <div
                className="p-4 rounded-2xl"
                style={{ 
                  background: isEditing 
                    ? 'linear-gradient(135deg, #3B82F6 0%, #6366F1 100%)'
                    : 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                  boxShadow: isEditing 
                    ? '0 8px 24px -6px rgba(59, 130, 246, 0.6)'
                    : '0 8px 24px -6px rgba(16, 185, 129, 0.6)'
                }}
              >
                <User className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                  {isEditing ? 'تعديل المستخدم' : 'إضافة مستخدم جديد'}
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {isEditing ? 'تحديث بيانات المستخدم' : 'إضافة مستخدم جديد للنظام'}
                </p>
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
          <form onSubmit={onSubmit} className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Name */}
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                  <User className="w-4 h-4 text-blue-600" />
                  الاسم الكامل <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={onInputChange}
                  required
                  placeholder="أدخل الاسم الكامل..."
                  className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-semibold"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-blue-600" />
                  البريد الإلكتروني <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={onInputChange}
                  required
                  placeholder="user@example.com"
                  className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-semibold"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-blue-600" />
                  {isEditing ? 'كلمة المرور الجديدة (اختياري)' : 'كلمة المرور'} 
                  {!isEditing && <span className="text-red-500">*</span>}
                </label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={onInputChange}
                  required={!isEditing}
                  minLength={6}
                  placeholder={isEditing ? "اتركها فارغة إذا لم ترد تغييرها" : "كلمة المرور (6 أحرف على الأقل)"}
                  className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-semibold"
                />
              </div>

              {/* Confirm Password */}
              {!isEditing && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                    <Lock className="w-4 h-4 text-blue-600" />
                    تأكيد كلمة المرور <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={onInputChange}
                    required
                    minLength={6}
                    placeholder="تأكيد كلمة المرور"
                    className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-semibold"
                  />
                </div>
              )}

              {/* Phone */}
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                  <Phone className="w-4 h-4 text-blue-600" />
                  📱 رقم الهاتف
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={onInputChange}
                  placeholder="رقم الهاتف..."
                  className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-semibold"
                />
              </div>

              {/* Role */}
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-blue-600" />
                  الدور <span className="text-red-500">*</span>
                </label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={onInputChange}
                  required
                  className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-semibold"
                >
                  {roles.map(role => (
                    <option key={role.id} value={role.id}>{role.name}</option>
                  ))}
                </select>
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                  الحالة <span className="text-red-500">*</span>
                </label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={onInputChange}
                  required
                  className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-semibold"
                >
                  <option value="active">✅ نشط</option>
                  <option value="inactive">❌ غير نشط</option>
                  <option value="suspended">⏸️ معلق</option>
                </select>
              </div>

              {/* Address */}
              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-blue-600" />
                  📍 العنوان
                </label>
                <textarea
                  name="address"
                  value={formData.address}
                  onChange={onInputChange}
                  rows={2}
                  placeholder="العنوان..."
                  className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all resize-none"
                />
              </div>
            </div>

            {/* Permissions */}
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                <Crown className="w-5 h-5 text-purple-600" />
                الصلاحيات <span className="text-red-500">*</span>
              </label>
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700/50 dark:to-gray-800/50 border-2 border-gray-200 dark:border-gray-600 rounded-xl p-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-80 overflow-y-auto modern-scrollbar">
                  {permissions.map(permission => (
                    <label 
                      key={permission.id} 
                      className="flex items-start p-4 bg-white dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-600 hover:border-blue-300 dark:hover:border-blue-500 transition-all cursor-pointer group"
                    >
                      <input
                        type="checkbox"
                        checked={formData.permissions.includes(permission.id)}
                        onChange={(e) => onPermissionChange(permission.id, e.target.checked)}
                        className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-5 h-5"
                      />
                      <div className="mr-3 flex-1">
                        <div className="text-sm font-bold text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {permission.name}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {permission.description}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
                
                {/* Permissions Summary */}
                <div className="mt-4 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
                      <span className="text-sm font-bold text-blue-900 dark:text-blue-300">
                        الصلاحيات المحددة: {formData.permissions.length} من {permissions.length}
                      </span>
                    </div>
                    {formData.permissions.includes('all') && (
                      <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-full text-xs font-bold">
                        ✨ جميع الصلاحيات
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex gap-3 pt-4 border-t-2 border-gray-200 dark:border-gray-700">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 group relative overflow-hidden px-6 py-4 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 font-bold text-lg"
              >
                <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity"></div>
                <div className="relative flex items-center justify-center gap-2">
                  {loading ? (
                    <>
                      <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>{isEditing ? 'جاري التحديث...' : 'جاري الحفظ...'}</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-6 h-6" />
                      <span>{isEditing ? 'تحديث المستخدم' : 'إضافة مستخدم'}</span>
                    </>
                  )}
                </div>
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-6 py-4 bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white rounded-xl transition-all duration-300 shadow-md hover:shadow-lg hover:scale-105 font-bold"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default UserFormModal;
