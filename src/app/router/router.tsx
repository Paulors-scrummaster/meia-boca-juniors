/* eslint-disable react-refresh/only-export-components -- route modules intentionally colocate route elements and configuration */
import { createBrowserRouter, Link, Outlet, type RouteObject } from 'react-router-dom';

import { AuthenticatedLayout } from '@/app/layouts/AuthenticatedLayout';
import {
  Aal2RouteGuard,
  AuthenticatedRouteGuard,
  PublicRouteGuard,
  RoleRouteGuard,
} from '@/app/router/guards';
import { clubConfig } from '@/config/club.config';
import { EmptyState, ErrorState } from '@/shared/components/feedback';

function PublicLayout() {
  return (
    <main className="min-h-dvh bg-background px-5 py-10 text-foreground">
      <div className="mx-auto max-w-3xl">
        <nav aria-label="Navegação pública" className="mb-6 flex justify-end gap-2">
          <Link className="min-h-11 rounded-lg px-3 py-2 font-semibold text-primary" to="/login">
            Entrar
          </Link>
          <Link className="min-h-11 rounded-lg px-3 py-2 font-semibold text-primary" to="/convite">
            Validar convite
          </Link>
        </nav>
        <Outlet />
      </div>
    </main>
  );
}

function WelcomePage() {
  return (
    <section className="flex min-h-[calc(100dvh-9rem)] items-center">
      <div className="w-full rounded-3xl border bg-card p-8 shadow-xl shadow-primary/10 sm:p-12">
        <img
          alt={`Escudo do ${clubConfig.identity.shortName}`}
          className="mb-8 h-24 w-24"
          src={clubConfig.assets.logo}
        />
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-primary">
          {clubConfig.identity.shortName}
        </p>
        <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
          {clubConfig.institutional.welcomeTitle}
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
          {clubConfig.institutional.welcomeDescription}
        </p>
        <p className="mt-8 inline-flex rounded-full bg-secondary px-4 py-2 text-sm font-bold text-secondary-foreground">
          Base do aplicativo pronta para evoluir com segurança.
        </p>
      </div>
    </section>
  );
}

function FoundationPlaceholder({ description, title }: { description: string; title: string }) {
  return <EmptyState description={description} title={title} />;
}

export const appRoutes: RouteObject[] = [
  {
    element: <PublicRouteGuard />,
    children: [
      {
        element: <PublicLayout />,
        children: [
          { index: true, element: <WelcomePage /> },
          {
            path: '/login',
            element: (
              <FoundationPlaceholder
                description="O fluxo de autenticação será habilitado na próxima etapa de identidade."
                title="Acesso ao clube"
              />
            ),
          },
          {
            path: '/convite',
            element: (
              <FoundationPlaceholder
                description="A ativação individual será habilitada com o módulo de convites."
                title="Validação de convite"
              />
            ),
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
        element: <AuthenticatedLayout />,
        children: [
          {
            index: true,
            element: (
              <FoundationPlaceholder
                description="Sua sessão e permissões estão prontas para os módulos do clube."
                title="Área autenticada"
              />
            ),
          },
          {
            path: 'athlete',
            element: <RoleRouteGuard allowedRoles={['ATHLETE']} />,
            children: [
              {
                index: true,
                element: (
                  <FoundationPlaceholder
                    description="Os recursos do atleta serão adicionados nas histórias funcionais."
                    title="Área do atleta"
                  />
                ),
              },
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
                      <FoundationPlaceholder
                        description="As ferramentas esportivas serão adicionadas nos próximos módulos."
                        title="Comissão técnica"
                      />
                    ),
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
                  {
                    path: 'admin',
                    element: (
                      <FoundationPlaceholder
                        description="A administração será habilitada junto aos fluxos de identidade."
                        title="Administração"
                      />
                    ),
                  },
                ],
              },
            ],
          },
          {
            path: 'forbidden',
            element: (
              <ErrorState
                message="Você não tem permissão para acessar esta área."
                title="Acesso negado"
              />
            ),
          },
          {
            path: 'mfa-required',
            element: (
              <ErrorState
                message="Confirme a verificação em duas etapas para acessar funções administrativas."
                title="Verificação necessária"
              />
            ),
          },
        ],
      },
    ],
  },
  {
    path: '*',
    element: (
      <main className="mx-auto max-w-xl px-5 py-16">
        <ErrorState message="A página solicitada não existe." title="Página não encontrada" />
      </main>
    ),
  },
];

export const appRouter = createBrowserRouter(appRoutes);
