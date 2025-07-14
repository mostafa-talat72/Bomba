import React from 'react';
import { useApp } from '../context/AppContext';

interface PermissionGuardProps {
  children: React.ReactNode;
  requiredPermissions?: string[];
  requiredRole?: string;
  fallback?: React.ReactNode;
  showIfNoPermission?: boolean;
}

const PermissionGuard: React.FC<PermissionGuardProps> = ({
  children,
  requiredPermissions = [],
  requiredRole,
  fallback = null,
  showIfNoPermission = false
}) => {
  const { user } = useApp();

  if (!user) {
    return showIfNoPermission ? <>{children}</> : <>{fallback}</>;
  }

  // Check role requirement
  if (requiredRole && user.role !== requiredRole) {
    return showIfNoPermission ? <>{children}</> : <>{fallback}</>;
  }

  // Check permissions requirement
  if (requiredPermissions.length > 0) {
    const hasPermission = user.permissions.includes('all') ||
                         requiredPermissions.some(permission => user.permissions.includes(permission));

    if (!hasPermission) {
      return showIfNoPermission ? <>{children}</> : <>{fallback}</>;
    }
  }

  return <>{children}</>;
};

export default PermissionGuard;
