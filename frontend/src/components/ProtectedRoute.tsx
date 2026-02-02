import { Navigate, useLocation } from 'react-router-dom';
import { getAuthSession } from '@/lib/api';
import type { Permission } from '@/lib/types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: Permission;
}

export function ProtectedRoute({ children, requiredPermission }: ProtectedRouteProps) {
  const location = useLocation();
  const session = getAuthSession();

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredPermission) {
    const permissionHierarchy: Permission[] = ['readonly', 'editor', 'admin'];
    const userLevel = permissionHierarchy.indexOf(session.user.permission);
    const requiredLevel = permissionHierarchy.indexOf(requiredPermission);

    if (userLevel < requiredLevel) {
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
}
