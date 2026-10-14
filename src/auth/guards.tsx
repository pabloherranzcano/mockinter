import { Navigate, Outlet } from 'react-router';
import { useAuth } from './AuthProvider';

function Loading() {
  return <main className="wrap"><p className="muted">Cargando…</p></main>;
}

/** Requiere sesión iniciada. */
export function RequireAuth() {
  const { ready, session } = useAuth();
  if (!ready) return <Loading />;
  return session ? <Outlet /> : <Navigate to="/login" replace />;
}

/** Requiere sesión y haber completado el onboarding. */
export function RequireOnboarded() {
  const { ready, session, profile } = useAuth();
  if (!ready) return <Loading />;
  if (!session) return <Navigate to="/login" replace />;
  if (!profile) return <Loading />;
  return profile.onboarded ? <Outlet /> : <Navigate to="/onboarding" replace />;
}

/** Solo para quien no ha iniciado sesión (pantalla de login). */
export function GuestOnly() {
  const { ready, session } = useAuth();
  if (!ready) return <Loading />;
  return session ? <Navigate to="/" replace /> : <Outlet />;
}

/** Solo administradores. La seguridad real está en la base de datos; esto solo evita mostrar la pantalla. */
export function RequireAdmin() {
  const { ready, session, profile, isAdmin } = useAuth();
  if (!ready || (session && !profile)) return <Loading />;
  return isAdmin ? <Outlet /> : <Navigate to="/" replace />;
}
