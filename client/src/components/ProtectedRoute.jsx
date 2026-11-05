import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Spinner from './ui/Spinner';
import { canViewProgramme, isAdmin, isPlaca } from '../utils/roles';

/**
 * Guards authenticated pages.
 *
 * A user with a temporary password may only reach the change-password page.
 * That rule is also enforced by the API; this redirect just avoids a confusing
 * forbidden screen.
 */
export default function ProtectedRoute({ children, allowPasswordChange = false }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Spinner />;
  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  if (user.must_change_password && !allowPasswordChange) {
    return <Navigate to="/change-password" replace />;
  }
  return children;
}

/**
 * Programme pages are for partners, LACA and PLACA staff. The admin account
 * administers users and the audit log instead, so it is redirected to the
 * dashboard rather than shown a forbidden screen.
 */
export function ProgrammeRoute({ children }) {
  const { user } = useAuth();

  if (user && !canViewProgramme(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

/**
 * Admin-only pages: accounts and the audit log.
 */
export function AdminRoute({ children }) {
  const { user } = useAuth();
  if (user && user.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

/**
 * PLACA-only content, such as the guide editor.
 */
export function PlacaRoute({ children }) {
  const { user } = useAuth();
  if (user && !isPlaca(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

/**
 * User management route: PLACA staff (officers and directors) and system admins.
 */
export function UserManagementRoute({ children }) {
  const { user } = useAuth();
  if (user && !isPlaca(user.role) && !isAdmin(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

export function RedirectIfAuthenticated({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (user) {
    return (
      <Navigate to={user.must_change_password ? '/change-password' : '/dashboard'} replace />
    );
  }
  return children;
}
