import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from '@/app/providers/AuthProvider';
import { LoadingState } from '@/shared/components/feedback';
import type { Database } from '@/shared/types/database.generated';

type AppRole = Database['public']['Enums']['app_role'];

interface GuardProps {
  children?: ReactNode;
}

function content(children?: ReactNode) {
  return children ?? <Outlet />;
}

export function PublicRouteGuard({ children }: GuardProps) {
  const auth = useAuth();

  if (auth.status === 'initializing') return <LoadingState label="Verificando sessão" />;
  if (auth.status === 'authenticated') return <Navigate replace to="/app" />;
  return content(children);
}

export function AuthenticatedRouteGuard({ children }: GuardProps) {
  const auth = useAuth();
  const location = useLocation();

  if (auth.status === 'initializing') return <LoadingState label="Verificando sessão" />;
  if (auth.status !== 'authenticated') {
    return <Navigate replace state={{ from: location.pathname }} to="/" />;
  }
  return content(children);
}

export function PasswordChangedRouteGuard({ children }: GuardProps) {
  const auth = useAuth();

  if (auth.status === 'initializing') return <LoadingState label="Verificando credencial" />;
  if (auth.status !== 'authenticated') return <Navigate replace to="/" />;
  if (auth.profile?.must_change_password) return <Navigate replace to="/alterar-senha" />;
  return content(children);
}

export function PasswordChangeRouteGuard({ children }: GuardProps) {
  const auth = useAuth();

  if (auth.status === 'initializing') return <LoadingState label="Verificando credencial" />;
  if (auth.status !== 'authenticated') return <Navigate replace to="/" />;
  if (!auth.profile?.must_change_password) return <Navigate replace to="/app" />;
  return content(children);
}

interface RoleRouteGuardProps extends GuardProps {
  allowedRoles: readonly AppRole[];
}

export function RoleRouteGuard({ allowedRoles, children }: RoleRouteGuardProps) {
  const { roles, status } = useAuth();

  if (status === 'initializing') return <LoadingState label="Verificando permissões" />;
  if (status !== 'authenticated') return <Navigate replace to="/" />;
  if (!roles.some((role) => allowedRoles.includes(role))) {
    return <Navigate replace to="/app/forbidden" />;
  }
  return content(children);
}

export function Aal2RouteGuard({ children }: GuardProps) {
  const { isAal2, status } = useAuth();

  if (status === 'initializing') return <LoadingState label="Verificando segundo fator" />;
  if (status !== 'authenticated') return <Navigate replace to="/" />;
  if (!isAal2) return <Navigate replace to="/mfa" />;
  return content(children);
}
