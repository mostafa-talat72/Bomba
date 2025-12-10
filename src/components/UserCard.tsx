import React from 'react';
import { User, Eye, Edit, Trash2, Calendar, Shield, Crown, UserCheck, UserX } from 'lucide-react';
import { User as UserType } from '../services/api';

interface RoleInfo {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  bgColor: string;
  color: string;
  description: string;
}

interface Permission {
  id: string;
  name: string;
  description: string;
}

interface UserCardProps {
  user: UserType;
  onView: (user: UserType) => void;
  onEdit: (user: UserType) => void;
  onDelete: (userId: string) => void;
  getRoleInfo: (roleId: string) => RoleInfo;
  getStatusColor: (status: string) => string;
  getStatusText: (status: string) => string;
  permissions: Permission[];
}

const UserCard: React.FC<UserCardProps> = ({
  user,
  onView,
  onEdit,
  onDelete,
  getRoleInfo,
  getStatusColor,
  getStatusText,
  permissions
}) => {
  const roleInfo = getRoleInfo(user.role);
  const RoleIcon = roleInfo.icon;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <UserCheck className="h-4 w-4" />;
      case 'inactive': return <UserX className="h-4 w-4" />;
      case 'suspended': return <Shield className="h-4 w-4" />;
      default: return <User className="h-4 w-4" />;
    }
  };

  const getStatusGradient = (status: string) => {
    switch (status) {
      case 'active': return 'from-green-500 to-emerald-600';
      case 'inactive': return 'from-red-500 to-rose-600';
      case 'suspended': return 'from-yellow-500 to-amber-600';
      default: return 'from-gray-500 to-gray-600';
    }
  };

  const formatLastLogin = (date?: Date) => {
    if (!date) return 'لم يسجل دخول';
    return new Date(date).toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div
      className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl shadow-lg border-2 border-gray-200 dark:border-gray-700 hover:shadow-xl hover:scale-105 transition-all duration-300 cursor-pointer group relative overflow-hidden animate-slideUp"
      onClick={() => onView(user)}
      tabIndex={0}
      role="button"
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onView(user); }}
      aria-label={`تفاصيل المستخدم ${user.name}`}
      dir="rtl"
    >
      {/* Status Badge */}
      <div className="absolute top-4 left-4 z-10">
        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl shadow-lg bg-gradient-to-r ${getStatusGradient(user.status)} text-white font-bold text-sm`}>
          {getStatusIcon(user.status)}
          <span>{getStatusText(user.status)}</span>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6 pt-16">
        {/* User Header */}
        <div className="flex items-center mb-4">
          <div 
            className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0"
            style={{ 
              background: `linear-gradient(135deg, ${roleInfo.color.replace('text-', '#')} 0%, ${roleInfo.color.replace('text-', '#')}dd 100%)`,
              boxShadow: '0 8px 24px -6px rgba(249, 115, 22, 0.4)'
            }}
          >
            <User className="h-8 w-8 text-white" />
          </div>
          <div className="mr-4 flex-1 min-w-0">
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 truncate mb-1">{user.name}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 truncate mb-2">{user.email}</p>
            
            {/* Role Badge */}
            <div className={`inline-flex items-center px-3 py-1.5 rounded-xl text-sm font-bold shadow-md ${roleInfo.bgColor} ${roleInfo.color}`}>
              <RoleIcon className="h-4 w-4 ml-2" />
              {roleInfo.name}
            </div>
          </div>
        </div>

        {/* Last Login */}
        <div className="flex items-center text-sm text-gray-600 dark:text-gray-400 mb-4 p-3 bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 rounded-xl">
          <Calendar className="h-4 w-4 ml-2 text-blue-600 dark:text-blue-400" />
          <span className="font-semibold">
            آخر دخول: {formatLastLogin(user.lastLogin)}
          </span>
        </div>

        {/* Permissions */}
        <div className="mb-4">
          <div className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
            <Crown className="w-4 h-4 text-purple-600" />
            الصلاحيات:
          </div>
          <div className="flex flex-wrap gap-2">
            {user.permissions?.includes('all') ? (
              <span className="inline-flex items-center px-3 py-2 text-sm bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl font-bold shadow-md">
                <Crown className="h-4 w-4 ml-2" />
                جميع الصلاحيات
              </span>
            ) : user.permissions && user.permissions.length > 0 ? (
              <>
                {user.permissions?.slice(0, 2).map(perm => (
                  <span key={perm} className="px-3 py-2 text-sm bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-semibold shadow-md">
                    {permissions.find(p => p.id === perm)?.name || perm}
                  </span>
                ))}
                {user.permissions.length > 2 && (
                  <span className="px-3 py-2 text-sm bg-gradient-to-r from-gray-500 to-gray-600 text-white rounded-xl font-semibold shadow-md">
                    +{user.permissions.length - 2} أخرى
                  </span>
                )}
              </>
            ) : (
              <span className="px-3 py-2 text-sm bg-gradient-to-r from-gray-400 to-gray-500 text-white rounded-xl font-semibold">
                لا توجد صلاحيات
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div
          className="flex items-center justify-center gap-2 pt-4 border-t-2 border-gray-200 dark:border-gray-700"
          onClick={e => e.stopPropagation()}
        >
          <button
            onClick={() => onView(user)}
            className="group relative overflow-hidden flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 font-bold"
            title="عرض التفاصيل"
          >
            <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity"></div>
            <div className="relative flex items-center justify-center gap-2">
              <Eye className="h-4 w-4" />
              <span>عرض</span>
            </div>
          </button>
          
          <button
            onClick={() => onEdit(user)}
            className="group relative overflow-hidden flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 font-bold"
            title="تعديل المستخدم"
          >
            <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity"></div>
            <div className="relative flex items-center justify-center gap-2">
              <Edit className="h-4 w-4" />
              <span>تعديل</span>
            </div>
          </button>
          
          <button
            onClick={() => onDelete(user.id)}
            className="group relative overflow-hidden px-4 py-3 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 font-bold"
            title="حذف المستخدم"
          >
            <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity"></div>
            <div className="relative flex items-center justify-center">
              <Trash2 className="h-4 w-4" />
            </div>
          </button>
        </div>
      </div>

      {/* Hover Effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-orange-500/10 dark:from-orange-400/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
    </div>
  );
};

export default UserCard;
