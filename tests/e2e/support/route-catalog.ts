import type { AppRole } from './auth-mock';

/**
 * Catálogo das 28 rotas catalogadas na seção "Superfícies Impactadas" da spec.
 *
 * Fonte única para a auditoria de acessibilidade e para a conformidade de paleta.
 *
 * Regra de escopo (research D-07): cada rota é auditada **uma vez, com um papel
 * autorizado a alcançá-la**. Os três papéis em conjunto cobrem o catálogo. Auditar
 * toda rota com todo papel geraria 84 execuções, a maioria terminando em
 * redirecionamento por guarda, sem ganho de sinal.
 */

export interface CatalogEntry {
  /** Caminho navegável, com os parâmetros já resolvidos para identificadores fictícios. */
  path: string;
  /** Rótulo legível, usado no nome do teste. */
  label: string;
  /** `null` para rotas públicas e de fluxo de autenticação. */
  role: AppRole | null;
  /** Dados mínimos por caminho de API para a tela renderizar conteúdo. */
  data?: Record<string, unknown>;
}

const MATCH_ID = '00000000-0000-4000-8000-000000010001';
const ATHLETE_ID = '00000000-0000-4000-8000-000000010002';

const athlete = {
  anonymized_at: null,
  created_at: '2026-08-25T00:00:00.000Z',
  full_name: 'Atleta de Teste',
  id: ATHLETE_ID,
  inactivated_at: null,
  photo_path: null,
  primary_position: 'Meio-campo',
  shirt_name: 'Teste',
  shirt_number: 10,
  status: 'ACTIVE',
  updated_at: '2026-08-25T00:00:00.000Z',
};

const match = {
  away_score: null,
  competition: 'Amistoso',
  home_score: null,
  id: MATCH_ID,
  kickoff_at: '2026-10-01T22:00:00.000Z',
  opponent: 'Adversário de Teste',
  status: 'SCHEDULED',
  venue: 'Campo de Teste',
};

/** Rotas públicas e de fluxo de autenticação. */
export const PUBLIC_ROUTES: CatalogEntry[] = [
  { path: '/', label: 'Landing Page', role: null },
  { path: '/login', label: 'Entrar', role: null },
  { path: '/convite', label: 'Ativar convite', role: null },
  { path: '/alterar-senha', label: 'Alterar senha', role: null },
  { path: '/mfa', label: 'Verificação em duas etapas', role: 'COACH' },
  { path: '/rota-inexistente', label: 'Página não encontrada', role: null },
];

/** Rotas autenticadas, sob o layout com navegação. */
export const AUTHENTICATED_ROUTES: CatalogEntry[] = [
  { path: '/app', label: 'Redirecionamento por papel', role: 'ATHLETE' },
  {
    path: '/app/roster',
    label: 'Elenco',
    role: 'ATHLETE',
    data: { '/rest/v1/athletes': [athlete] },
  },
  {
    path: `/app/roster/${ATHLETE_ID}`,
    label: 'Perfil do atleta',
    role: 'ATHLETE',
    data: { '/rest/v1/athletes': athlete },
  },
  {
    path: '/app/matches',
    label: 'Partidas',
    role: 'ATHLETE',
    data: { '/rest/v1/matches': [match] },
  },
  {
    path: `/app/matches/${MATCH_ID}`,
    label: 'Detalhe da partida',
    role: 'ATHLETE',
    data: { '/rest/v1/matches': match },
  },
  {
    path: `/app/matches/${MATCH_ID}/lineup`,
    label: 'Escalação publicada',
    role: 'ATHLETE',
    data: { '/rest/v1/matches': match, '/rest/v1/lineups': [] },
  },
  {
    path: '/app/statistics',
    label: 'Estatísticas',
    role: 'ATHLETE',
    data: { '/rest/v1/season_rankings': [] },
  },
  {
    path: '/app/notices',
    label: 'Mural de avisos',
    role: 'ATHLETE',
    data: { '/rest/v1/notices': [] },
  },
  { path: '/app/notification-preferences', label: 'Preferências de notificação', role: 'ATHLETE' },
  { path: '/app/athlete', label: 'Área do atleta', role: 'ATHLETE' },
  {
    path: `/app/athlete/matches/${MATCH_ID}/attendance`,
    label: 'Resposta de presença',
    role: 'ATHLETE',
    data: { '/rest/v1/call_ups': [] },
  },
  {
    path: '/app/athlete/mvp-voting',
    label: 'Craque do Jogo',
    role: 'ATHLETE',
    data: { '/rest/v1/mvp_rounds': [] },
  },
  { path: '/app/staff', label: 'Comissão técnica', role: 'COACH' },
  { path: '/app/staff/matches/new', label: 'Nova partida', role: 'COACH' },
  {
    path: `/app/staff/matches/${MATCH_ID}/edit`,
    label: 'Editar partida',
    role: 'COACH',
    data: { '/rest/v1/matches': match, '/rest/v1/call_ups': [] },
  },
  {
    path: `/app/staff/matches/${MATCH_ID}/attendance`,
    label: 'Painel de presenças',
    role: 'COACH',
    data: { '/rest/v1/call_ups': [] },
  },
  {
    path: `/app/staff/matches/${MATCH_ID}/lineup`,
    label: 'Editor de escalação',
    role: 'COACH',
    data: { '/rest/v1/matches': match, '/rest/v1/lineups': [], '/rest/v1/athletes': [athlete] },
  },
  {
    path: '/app/admin',
    label: 'Administração de papéis',
    role: 'PRESIDENT',
    data: { '/rest/v1/user_roles_admin': [], '/rest/v1/invitations': [] },
  },
  { path: '/app/admin/roster/new', label: 'Novo atleta', role: 'PRESIDENT' },
  {
    path: `/app/admin/roster/${ATHLETE_ID}/edit`,
    label: 'Editar atleta',
    role: 'PRESIDENT',
    data: { '/rest/v1/athletes': athlete },
  },
  {
    path: `/app/admin/matches/${MATCH_ID}/statistics`,
    label: 'Consolidação de estatísticas',
    role: 'PRESIDENT',
    data: { '/rest/v1/matches': match, '/rest/v1/lineups': [] },
  },
  { path: '/app/forbidden', label: 'Acesso negado', role: 'ATHLETE' },
];

/** As 28 rotas catalogadas (GV-01): 6 públicas e de fluxo de autenticação, 22 autenticadas. */
export const ROUTE_CATALOG: CatalogEntry[] = [...PUBLIC_ROUTES, ...AUTHENTICATED_ROUTES];

export const EXPECTED_ROUTE_COUNT = 28;
