import { Navigate, Outlet, useLocation } from 'react-router-dom';
import type { Role } from '@/types/api';
import { useAuthStore } from '@/store/useAuthStore';
import { PATHS, homeFor } from './paths';

interface RequireAuthProps {
  /** Roles allowed past this guard. Omit to allow any logged-in user. */
  roles?: Role[];
}

/**
 * Route guard. Logged-out users go to /login with ?next= so they come back after
 * logging in; users with the wrong role go to their own home page.
 * This only hides screens. The backend still enforces every permission.
 */
export function RequireAuth({ roles }: RequireAuthProps) {
  const user = useAuthStore((s) => s.user);
  const location = useLocation();

  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`${PATHS.login}?next=${next}`} replace />;
  }
  if (roles && !roles.includes(user.role)) {
    return <Navigate to={homeFor(user.role)} replace />;
  }
  return <Outlet />;
}

/** Sends "/" to the current user's home page (or /login). */
export function HomeRedirect() {
  const user = useAuthStore((s) => s.user);
  return <Navigate to={homeFor(user?.role)} replace />;
}
