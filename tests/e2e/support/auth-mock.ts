import type { Page, Route } from '@playwright/test';

/**
 * Fixture de autenticação compartilhada.
 *
 * As specs de ponta a ponta não conversam com um Supabase real: `playwright.config.ts`
 * aponta para `http://127.0.0.1:54321` com chave placeholder, e cada spec intercepta
 * as chamadas com `page.route()`. O padrão estava replicado em oito arquivos, cada um
 * redefinindo `jwt()`, `user()` e `json()`.
 *
 * Este módulo extrai esse padrão parametrizado por papel, para que a auditoria das 24
 * rotas não multiplique a duplicação por três.
 *
 * Nenhuma credencial real, chave de serviço ou dado de jogador entra aqui
 * (Constituição, Princípio I).
 */

export type AppRole = 'ATHLETE' | 'COACH' | 'PRESIDENT';

const SUPABASE_ORIGIN = 'http://127.0.0.1:54321';

/** Identificadores fictícios estáveis, um por papel, para facilitar o diagnóstico. */
const USER_ID: Record<AppRole, string> = {
  ATHLETE: '00000000-0000-4000-8000-0000000a0001',
  COACH: '00000000-0000-4000-8000-0000000c0001',
  PRESIDENT: '00000000-0000-4000-8000-0000000f0001',
};

const EMAIL: Record<AppRole, string> = {
  ATHLETE: 'atleta@mbj.test',
  COACH: 'comissao@mbj.test',
  PRESIDENT: 'presidente@mbj.test',
};

/**
 * Papéis efetivos por perfil. Presidente e técnico também precisam de AAL2, que as
 * rotas administrativas exigem; atleta não.
 */
const ROLES: Record<AppRole, AppRole[]> = {
  ATHLETE: ['ATHLETE'],
  COACH: ['COACH'],
  PRESIDENT: ['PRESIDENT'],
};

export function signedJwt(role: AppRole): string {
  const payload = {
    aal: role === 'ATHLETE' ? 'aal1' : 'aal2',
    exp: 2_000_000_000,
    sub: USER_ID[role],
  };
  return `header.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature`;
}

export async function json(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({
    body: JSON.stringify(body),
    contentType: 'application/json',
    headers: { 'access-control-allow-origin': '*' },
    status,
  });
}

function sessionUser(role: AppRole) {
  return {
    app_metadata: {},
    aud: 'authenticated',
    created_at: '2026-08-25T00:00:00.000Z',
    email: EMAIL[role],
    id: USER_ID[role],
    role: 'authenticated',
    updated_at: '2026-08-25T00:00:00.000Z',
    user_metadata: {},
  };
}

export interface AuthMockOptions {
  /** Respostas adicionais por caminho, para os dados que a rota sob teste precisa renderizar. */
  routes?: Record<string, unknown>;
  /** Nome exibido no rodapé da navegação. */
  fullName?: string;
  /** `true` para exercitar `PasswordChangeRouteGuard` (rota `/alterar-senha`). Padrão: `false`. */
  mustChangePassword?: boolean;
}

/**
 * Intercepta as chamadas ao Supabase e responde como um usuário autenticado do papel
 * indicado. Caminhos não cobertos respondem 500 com mensagem explícita, para que um
 * mock ausente apareça como falha clara em vez de tela vazia.
 */
export async function mockAuthenticatedSession(
  page: Page,
  role: AppRole,
  options: AuthMockOptions = {},
): Promise<void> {
  const { fullName = 'Usuário de Teste', mustChangePassword = false, routes = {} } = options;

  await page.route(`${SUPABASE_ORIGIN}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const { pathname } = url;

    if (request.method() === 'OPTIONS') return json(route, null, 204);

    if (pathname === '/auth/v1/token')
      return json(route, {
        access_token: signedJwt(role),
        expires_at: 2_000_000_000,
        expires_in: 3600,
        refresh_token: 'refresh',
        token_type: 'bearer',
        user: sessionUser(role),
      });

    if (pathname === '/auth/v1/user') return json(route, sessionUser(role));

    if (pathname === '/rest/v1/profiles')
      return json(route, {
        account_status: 'ACTIVE',
        full_name: fullName,
        id: USER_ID[role],
        must_change_password: mustChangePassword,
      });

    if (pathname === '/rest/v1/user_roles')
      return json(
        route,
        ROLES[role].map((value) => ({ role: value })),
      );

    if (pathname in routes) return json(route, routes[pathname]);

    return json(route, { message: `Mock ausente: ${request.method()} ${pathname}` }, 500);
  });
}

/** Executa o formulário de login já interceptado, deixando a sessão ativa. */
export async function signIn(page: Page, role: AppRole): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(EMAIL[role]);
  await page.getByLabel('Senha').fill('senha-local');
  await page.getByRole('button', { name: 'Entrar' }).click();
}

/** Atalho: intercepta, autentica e navega até a rota pedida. */
export async function visitAs(
  page: Page,
  role: AppRole,
  path: string,
  options: AuthMockOptions = {},
): Promise<void> {
  await mockAuthenticatedSession(page, role, options);
  await signIn(page, role);
  await page.goto(path);
}
