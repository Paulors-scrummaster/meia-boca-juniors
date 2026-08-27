/* eslint-disable react-refresh/only-export-components -- route elements and configuration are intentionally colocated */
import { createBrowserRouter, Link, Navigate, Outlet, type RouteObject } from 'react-router-dom';

import { AuthenticatedLayout } from '@/app/layouts/AuthenticatedLayout';
import { useAuth } from '@/app/providers/AuthProvider';
import {
  Aal2RouteGuard,
  AuthenticatedRouteGuard,
  PasswordChangedRouteGuard,
  PasswordChangeRouteGuard,
  PublicRouteGuard,
  RoleRouteGuard,
} from '@/app/router/guards';
import { RoleAdministrationPage } from '@/features/auth/components/RoleManager';
import { CallUpManager } from '@/features/attendance/components/CallUpManager';
import { PresenceResponsePanel } from '@/features/attendance/components/PresenceResponsePanel';
import { AttendanceDashboardPage } from '@/features/attendance/pages/AttendanceDashboardPage';
import { AcceptInvitationPage } from '@/features/auth/pages/AcceptInvitationPage';
import { ChangePasswordPage } from '@/features/auth/pages/ChangePasswordPage';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { MfaPage } from '@/features/auth/pages/MfaPage';
import { WelcomePage } from '@/features/auth/pages/WelcomePage';
import { createMatchesService, matchKeys } from '@/features/matches/api/matches.service';
import { MatchForm } from '@/features/matches/components/MatchForm';
import { MatchDetailPage } from '@/features/matches/pages/MatchDetailPage';
import { MatchesPage } from '@/features/matches/pages/MatchesPage';
import { AthleteProfilePage } from '@/features/roster/pages/AthleteProfilePage';
import { RosterPage } from '@/features/roster/pages/RosterPage';
import { CreateAthletePage, EditAthletePage } from '@/features/roster/pages/RosterManagementPage';
import { EmptyState, ErrorState } from '@/shared/components/feedback';
import { LoadingState } from '@/shared/components/feedback';
import type { Database } from '@/shared/types/database.generated';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';

type AppRole = Database['public']['Enums']['app_role'];

function PublicLayout() {
  return (
    <main className="min-h-dvh bg-background px-5 py-8 text-foreground">
      <div className="mx-auto max-w-5xl">
        <nav aria-label="Navegação pública" className="mb-4 flex justify-end gap-2">
          <Link className="min-h-11 rounded-lg px-3 py-2 font-semibold text-primary" to="/">
            Início
          </Link>
          <Link className="min-h-11 rounded-lg px-3 py-2 font-semibold text-primary" to="/login">
            Entrar
          </Link>
          <Link className="min-h-11 rounded-lg px-3 py-2 font-semibold text-primary" to="/convite">
            Ativar convite
          </Link>
        </nav>
        <Outlet />
      </div>
    </main>
  );
}

function AuthFlowLayout() {
  return (
    <main className="min-h-dvh bg-background px-5 py-12 text-foreground">
      <Outlet />
    </main>
  );
}

function Placeholder({ description, title }: { description: string; title: string }) {
  return <EmptyState description={description} title={title} />;
}

export function defaultRouteForRoles(roles: readonly AppRole[]): string {
  if (roles.includes('PRESIDENT')) return '/app/admin';
  if (roles.includes('COACH')) return '/app/staff';
  if (roles.includes('ATHLETE')) return '/app/athlete';
  return '/app/forbidden';
}

function RoleHomeRedirect() {
  const { roles } = useAuth();
  return <Navigate replace to={defaultRouteForRoles(roles)} />;
}

function RosterRoutePage() {
  const { isAal2, roles } = useAuth();
  return <RosterPage canManage={isAal2 && roles.includes('PRESIDENT')} />;
}

function AthleteProfileRoutePage() {
  const { isAal2, roles } = useAuth();
  return <AthleteProfilePage canManage={isAal2 && roles.includes('PRESIDENT')} />;
}

function MatchesRoutePage() {
  const { isAal2, roles } = useAuth();
  return (
    <MatchesPage
      canManage={isAal2 && roles.some((role) => role === 'COACH' || role === 'PRESIDENT')}
    />
  );
}

function MatchDetailRoutePage() {
  const { isAal2, roles } = useAuth();
  const { matchId = '' } = useParams();
  return (
    <MatchDetailPage
      canManage={isAal2 && roles.some((role) => role === 'COACH' || role === 'PRESIDENT')}
      isAthlete={roles.includes('ATHLETE')}
      matchId={matchId}
    />
  );
}

function AthleteAttendanceRoutePage() {
  const { matchId = '' } = useParams();
  return <PresenceResponsePanel matchId={matchId} />;
}

function StaffAttendanceRoutePage() {
  const { matchId = '' } = useParams();
  return <AttendanceDashboardPage matchId={matchId} />;
}

function NewMatchRoutePage() {
  return <MatchForm />;
}

function EditMatchRoutePage() {
  const { matchId = '' } = useParams();
  const service = createMatchesService();
  const query = useQuery({
    queryFn: () => service.getMatch(matchId),
    queryKey: matchKeys.detail(matchId),
  });
  if (query.isPending) return <LoadingState label="Carregando partida" />;
  if (query.isError)
    return <ErrorState title="Não foi possível carregar a partida" message="Tente novamente." />;
  return (
    <div className="space-y-6">
      <MatchForm match={query.data} service={service} />
      <CallUpManager matchId={matchId} />
    </div>
  );
}

export const appRoutes: RouteObject[] = [
  {
    element: <PublicLayout />,
    children: [
      {
        element: <PublicRouteGuard />,
        children: [
          { index: true, element: <WelcomePage /> },
          { path: '/login', element: <LoginPage /> },
        ],
      },
      { path: '/convite', element: <AcceptInvitationPage /> },
    ],
  },
  {
    element: <AuthFlowLayout />,
    children: [
      {
        element: <PasswordChangeRouteGuard />,
        children: [{ path: '/alterar-senha', element: <ChangePasswordPage /> }],
      },
      {
        element: <AuthenticatedRouteGuard />,
        children: [
          {
            element: <PasswordChangedRouteGuard />,
            children: [
              {
                element: <RoleRouteGuard allowedRoles={['COACH', 'PRESIDENT']} />,
                children: [{ path: '/mfa', element: <MfaPage /> }],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    path: '/app',
    element: <AuthenticatedRouteGuard />,
    children: [
      {
        element: <PasswordChangedRouteGuard />,
        children: [
          {
            element: <AuthenticatedLayout />,
            children: [
              { index: true, element: <RoleHomeRedirect /> },
              { path: 'roster', element: <RosterRoutePage /> },
              { path: 'roster/:athleteId', element: <AthleteProfileRoutePage /> },
              { path: 'matches', element: <MatchesRoutePage /> },
              { path: 'matches/:matchId', element: <MatchDetailRoutePage /> },
              {
                path: 'athlete',
                element: <RoleRouteGuard allowedRoles={['ATHLETE']} />,
                children: [
                  {
                    index: true,
                    element: (
                      <Placeholder
                        title="Área do atleta"
                        description="Seu acesso de atleta está ativo."
                      />
                    ),
                  },
                  { path: 'matches/:matchId/attendance', element: <AthleteAttendanceRoutePage /> },
                ],
              },
              {
                element: <RoleRouteGuard allowedRoles={['COACH', 'PRESIDENT']} />,
                children: [
                  {
                    element: <Aal2RouteGuard />,
                    children: [
                      {
                        path: 'staff',
                        element: (
                          <Placeholder
                            title="Comissão técnica"
                            description="Seu acesso à comissão técnica está protegido por verificação em duas etapas."
                          />
                        ),
                      },
                      { path: 'staff/matches/new', element: <NewMatchRoutePage /> },
                      { path: 'staff/matches/:matchId/edit', element: <EditMatchRoutePage /> },
                      {
                        path: 'staff/matches/:matchId/attendance',
                        element: <StaffAttendanceRoutePage />,
                      },
                    ],
                  },
                ],
              },
              {
                element: <RoleRouteGuard allowedRoles={['PRESIDENT']} />,
                children: [
                  {
                    element: <Aal2RouteGuard />,
                    children: [
                      { path: 'admin', element: <RoleAdministrationPage /> },
                      { path: 'admin/roster/new', element: <CreateAthletePage /> },
                      { path: 'admin/roster/:athleteId/edit', element: <EditAthletePage /> },
                    ],
                  },
                ],
              },
              {
                path: 'forbidden',
                element: (
                  <ErrorState
                    title="Acesso negado"
                    message="Você não tem permissão para acessar esta área."
                  />
                ),
              },
            ],
          },
        ],
      },
    ],
  },
  {
    path: '*',
    element: (
      <main className="mx-auto max-w-xl px-5 py-16">
        <ErrorState title="Página não encontrada" message="A página solicitada não existe." />
      </main>
    ),
  },
];

export const appRouter = createBrowserRouter(appRoutes);
