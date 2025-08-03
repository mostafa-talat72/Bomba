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
  const statusColor = getStatusColor(user.status);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <UserCheck className="h-3 w-3" />;
      case 'inactive': return <UserX className="h-3 w-3" />;
      case 'suspended': return <Shield className="h-3 w-3" />;
      default: return <User className="h-3 w-3" />;
    }
  };

  const formatLastLogin = (date: string | Date) => {
    if (!date) return 'لم يسجل دخول';
    return new Date(date).toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div
      className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all duration-200 cursor-pointer group relative overflow-hidden"
      onClick={() => onView(user)}
      tabIndex={0}
      role="button"
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onView(user); }}
      aria-label={`تفاصيل المستخدم ${user.name}`}
    >
      {/* Status Badge */}
      <div className={`absolute top-3 left-3 flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${statusColor} z-10`}>
        {getStatusIcon(user.status)}
        {getStatusText(user.status)}
      </div>

      {/* Main Content */}
      <div className="p-4 pt-10">
        {/* User Header */}
        <div className="flex items-start mb-3">
          <div className="w-12 h-12 bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-900 dark:to-primary-800 rounded-full flex items-center justify-center flex-shrink-0">
            <User className="h-6 w-6 text-primary-600 dark:text-primary-400" />
          </div>
          <div className="mr-3 flex-1 min-w-0">
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 truncate">{user.name}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
          </div>
        </div>

        {/* Role Badge */}
        <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mb-2 ${roleInfo.bgColor} ${roleInfo.color}`}>
          <RoleIcon className="h-3 w-3 ml-1" />
          {roleInfo.name}
        </div>

        {/* Last Login */}
        <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 mb-3">
          <Calendar className="h-3 w-3 ml-1 flex-shrink-0" />
          <span className="truncate">
            آخر دخول: {formatLastLogin(user.lastLogin || '')}
          </span>
        </div>

        {/* Permissions */}
        <div className="mb-3">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">الصلاحيات:</div>
          <div className="flex flex-wrap gap-1">
            {user.permissions?.includes('all') ? (
              <span className="inline-flex items-center px-2 py-1 text-xs bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded-full font-medium">
                <Crown className="h-3 w-3 ml-1" />
                جميع الصلاحيات
              </span>
            ) : user.permissions && user.permissions.length > 0 ? (
              <>
                {user.permissions?.slice(0, 2).map(perm => (
                  <span key={perm} className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full">
                    {permissions.find(p => p.id === perm)?.name || perm}
                  </span>
                ))}
                {user.permissions.length > 2 && (
                  <span className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full">
                    +{user.permissions.length - 2}
                  </span>
                )}
              </>
            ) : (
              <span className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-full">
                لا توجد صلاحيات
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div
          className="flex items-center justify-end gap-1 pt-2 border-t border-gray-100 dark:border-gray-700"
          onClick={e => e.stopPropagation()}
        >
          <button
            onClick={() => onView(user)}
            className="p-1.5 text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 hover:bg-green-50 dark:hover:bg-green-900 rounded transition-colors duration-200"
            title="عرض التفاصيل"
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onEdit(user)}
            className="p-1.5 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900 rounded transition-colors duration-200"
            title="تعديل المستخدم"
          >
            <Edit className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onDelete(user.id)}
            className="p-1.5 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900 rounded transition-colors duration-200"
            title="حذف المستخدم"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Hover Effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary-500/5 dark:from-primary-400/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none" />
    </div>
  );
};

export default UserCard;
