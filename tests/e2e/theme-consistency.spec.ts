import { expect, test } from '@playwright/test';

import { HERO_LAYER_ALPHA } from '../../src/features/auth/pages/hero-backdrop.constants';
import { mockAuthenticatedSession } from './support/auth-mock';
import {
  buildAllowedColors,
  composite,
  contrastRatio,
  findPaletteViolations,
  HERO_LUMINANCE_CEILING,
  relativeLuminance,
  readThemeTokens,
} from './support/palette';
import { EXPECTED_ROUTE_COUNT, ROUTE_CATALOG } from './support/route-catalog';

/**
 * Camada 2 do portão (contracts/theme-verification.md): conformidade de paleta em
 * runtime nas 28 rotas do catálogo (SC-003a), agora que a User Story 4 saneou as
 * superfícies de conteúdo (tasks.md, nota de dependência de T089).
 *
 * O contêiner do QR Code em `/mfa` é a única exceção declarada (FR-003g): exigido
 * por requisito funcional de leitura por scanner, marcado com
 * `data-theme-exception="qr-code"`.
 */

const QR_CODE_EXEMPTION = '[data-theme-exception="qr-code"]';

test.describe('conformidade de paleta — catálogo de rotas (SC-003a)', () => {
  test('o catálogo cobre exatamente as 28 rotas esperadas', () => {
    expect(ROUTE_CATALOG).toHaveLength(EXPECTED_ROUTE_COUNT);
  });

  for (const { data, label, path, role } of ROUTE_CATALOG) {
    test(`${label} (${path}) não usa cor fora dos tokens do tema`, async ({ page }) => {
      if (role) {
        await mockAuthenticatedSession(page, role, {
          mustChangePassword: path === '/alterar-senha',
          routes: data,
        });
      }
      await page.goto(path);
      await page.waitForLoadState('networkidle');

      const tokens = await readThemeTokens(page);
      const allowed = buildAllowedColors(tokens);
      const violations = await findPaletteViolations(page, allowed, [QR_CODE_EXEMPTION]);

      expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
    });
  }
});

/**
 * Camada 2b (contracts/theme-verification.md, FR-041, SC-013, GL-16, GL-18): o axe
 * não avalia contraste sobre `background-image` e devolve *incomplete* — nunca
 * reprova gradiente.
 *
 * Desde que o hero passou a ter uma fotografia própria do clube como camada mais
 * baixa (FR-033), o pior caso real deixou de ser previsível a partir só dos tokens —
 * um pixel da foto poderia, em tese, ser tão claro quanto branco. Por isso esta
 * camada compõe as camadas decorativas **sequencialmente, na ordem real de pintura**
 * do CSS (`HERO_LAYER_ALPHA`, fonte única compartilhada com `HeroBackdrop`), partindo
 * de branco puro como pior caso da foto: primeiro o véu horizontal (a camada
 * desenhada para segurar o teto independente do que estiver atrás dela), depois o
 * brilho dourado por cima do véu já escurecido — nunca da foto crua. A vinheta (que
 * só escurece) e o grão (contribuição desprezível, <0,001) ficam de fora do pior
 * caso de propósito: um verdadeiro "pior caso" assume que eles podem não estar
 * presentes naquele ponto exato, não conta com a proteção deles.
 *
 * FR-041 exige o teto apenas "sob texto": a coluna de texto vive inteiramente dentro
 * da zona forte do véu (0–60% da largura), então só essa zona precisa provar o teto.
 */
test.describe('camada 2b — luminância e contraste do hero da Landing Page', () => {
  test('a zona do véu sob o texto mantém o teto de luminância e o contraste dos textos', async ({
    page,
  }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const tokens = await readThemeTokens(page);
    const white = { b: 255, g: 255, r: 255 };

    // Ordem real de pintura: véu (zona forte, onde vive o texto) por cima do pior
    // caso da foto, depois o brilho dourado por cima do véu.
    const scrimOverWorstPhoto = composite(tokens.background!, HERO_LAYER_ALPHA.scrimStrong, white);
    const worstCase = composite(tokens.primary!, HERO_LAYER_ALPHA.goldGlow, scrimOverWorstPhoto);

    const worstCaseLuminance = relativeLuminance(worstCase);
    test.info().annotations.push({
      type: 'luminância',
      description: `pior caso composto (véu + brilho sobre foto branca): ${worstCaseLuminance.toFixed(4)}`,
    });
    expect(
      worstCaseLuminance,
      `pior caso sob o texto excede o teto de luminância de FR-041 (${HERO_LUMINANCE_CEILING})`,
    ).toBeLessThanOrEqual(HERO_LUMINANCE_CEILING);

    const pairs: [string, string][] = [
      ['foreground', 'texto primário'],
      ['muted-foreground', 'texto secundário'],
      ['primary', 'texto dourado'],
    ];
    for (const [tokenName, label] of pairs) {
      const ratio = contrastRatio(worstCase, tokens[tokenName]!);
      test.info().annotations.push({
        type: 'contraste',
        description: `${label} (${tokenName}) sobre o pior caso do hero: ${ratio.toFixed(2)}:1`,
      });
      expect(ratio, `${label} sobre o pior caso do hero deve manter 4,5:1`).toBeGreaterThanOrEqual(
        4.5,
      );
    }
  });
});

/**
 * Feature 003 · T097 — as telas novas de US1–US4 entram no mesmo portão de paleta
 * (SC-003a) e ganham uma checagem leve de pt-BR (FR-041): rótulos conhecidos
 * visíveis e nenhuma string de fallback (chave crua de i18n, `[object Object]`).
 *
 * Lista local — não infla o `ROUTE_CATALOG` da feature 002 (cujo total 28 é
 * asseverado em dois specs), mas reusa exatamente os mesmos helpers de paleta.
 */
const POST_MVP_MATCH_ID = '00000000-0000-4000-8000-0000000e5001';

const postMvpMatch = {
  competition_name: 'Liga de Teste',
  confirmation_deadline: '2026-10-01T18:00:00.000Z',
  current_consolidation_id: null,
  id: POST_MVP_MATCH_ID,
  location_name: 'Campo Fictício',
  match_date: '2026-10-02T18:00:00.000Z',
  opponent_name: 'Adversário Teste',
  schedule_revision: 1,
  season_id: '00000000-0000-4000-8000-0000000e5901',
  status: 'SCHEDULED',
};

const POST_MVP_SCREENS = [
  {
    data: {
      '/rest/v1/athlete_trophies': [],
      '/rest/v1/club_all_time_record': {
        draws: 1,
        goal_diff: 6,
        goals_against: 4,
        goals_for: 10,
        losses: 1,
        matches_played: 6,
        wins: 4,
      },
    },
    label: 'Histórico & Conquistas',
    path: '/app/historico',
    ptLabels: ['Histórico & Conquistas', 'Retrospecto do clube', 'Galeria de troféus'],
    role: 'ATHLETE' as const,
  },
  {
    data: { '/rest/v1/social_events': [] },
    label: 'Resenhas',
    path: '/app/resenhas',
    ptLabels: ['Resenhas', 'Nenhum evento'],
    role: 'ATHLETE' as const,
  },
  {
    data: {
      '/rest/v1/athlete_charges': [],
      '/rest/v1/finance_overview': [],
    },
    label: 'Financeiro',
    path: '/app/financeiro',
    ptLabels: ['Financeiro', 'Controle de mensalidades'],
    role: 'PRESIDENT' as const,
  },
  {
    data: {
      '/rest/v1/athletes': [],
      '/rest/v1/live_match_events': [],
      '/rest/v1/live_match_setups': [],
      '/rest/v1/matches': postMvpMatch,
    },
    label: 'Súmula ao vivo',
    path: `/app/partidas/${POST_MVP_MATCH_ID}/sumula`,
    ptLabels: ['Súmula'],
    role: 'COACH' as const,
  },
];

test.describe('conformidade de paleta e pt-BR — telas novas de US1–US4 (T097, FR-041)', () => {
  for (const { data, label, path, ptLabels, role } of POST_MVP_SCREENS) {
    test(`${label} (${path}) não usa cor fora dos tokens e renderiza em pt-BR`, async ({ page }) => {
      await mockAuthenticatedSession(page, role, { routes: data });
      await page.goto(path);
      await page.waitForLoadState('networkidle');

      const tokens = await readThemeTokens(page);
      const allowed = buildAllowedColors(tokens);
      const violations = await findPaletteViolations(page, allowed, [QR_CODE_EXEMPTION]);
      expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);

      // Escopo no conteúdo principal: os rótulos também aparecem nos links de
      // navegação, ocultos na gaveta mobile.
      const main = page.getByRole('main');
      for (const labelText of ptLabels) {
        await expect(main.getByText(labelText, { exact: false }).first()).toBeVisible();
      }

      const bodyText = await main.innerText();
      for (const fallback of ['[object Object]', '{{', 'undefined', 'NaN']) {
        expect(bodyText, `fallback "${fallback}" visível em ${path}`).not.toContain(fallback);
      }
    });
  }
});

/**
 * FR-042 / SC-014 / GL-17: pares não textuais sujeitos a 3:1 — limites de controle,
 * indicadores de foco e objetos gráficos informativos. Valores de referência
 * calculados em `spec.md` (seção "Contraste de elementos não textuais").
 */
test.describe('não textual — limites de controle, foco e marcações (FR-042)', () => {
  test('contorno de campo, anel de foco e marcação do campo mantêm 3:1', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    const tokens = await readThemeTokens(page);
    const pairs: [string, string, string][] = [
      ['input', 'card', 'contorno de campo sobre superfície de card'],
      ['input', 'background', 'contorno de campo sobre o fundo'],
      ['ring', 'card', 'anel de foco sobre superfície de card'],
      ['ring', 'background', 'anel de foco sobre o fundo'],
      ['pitch-line', 'pitch', 'marcação do campo tático sobre o gramado'],
    ];

    for (const [foregroundToken, backgroundToken, label] of pairs) {
      const ratio = contrastRatio(tokens[foregroundToken]!, tokens[backgroundToken]!);
      test.info().annotations.push({
        type: 'contraste',
        description: `${label} (${foregroundToken} sobre ${backgroundToken}): ${ratio.toFixed(2)}:1`,
      });
      expect(ratio, `${label} deve manter 3:1`).toBeGreaterThanOrEqual(3);
    }
  });
});
