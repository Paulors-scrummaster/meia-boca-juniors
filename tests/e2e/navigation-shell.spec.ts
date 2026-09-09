import { expect, test } from '@playwright/test';

import { mockAuthenticatedSession } from './support/auth-mock';

/**
 * Verificação da barra lateral desktop (contracts/navigation-shell.md), User Story 2.
 * PRESIDENT+ATHLETE combinados são o "papel de maior alcance" (E-04): sozinho,
 * PRESIDENT vê 11 dos 14 itens — os três exclusivos de ATHLETE exigem esse papel.
 *
 * O conjunto de itens é o vigente em data-model §3.2, estendido pela feature 003
 * (Post-MVP Modules Expansion) com "Histórico & Conquistas", "Resenhas", "Minhas
 * mensalidades" e "Financeiro" — ver a lista em `NavigationList.tsx` (contrato P-01).
 */
const PRESIDENT_MAX_REACH = {
  role: 'PRESIDENT' as const,
  roles: ['PRESIDENT', 'ATHLETE'] as const,
};

// Ordem exata do DOM em `NavigationList.tsx` para o papel de maior alcance.
const NAVIGATION_LABELS = [
  'Início',
  'Elenco',
  'Partidas',
  'Estatísticas',
  'Histórico & Conquistas',
  'Resenhas',
  'Mural',
  'Notificações',
  'Área do atleta',
  'Craque do Jogo',
  'Minhas mensalidades',
  'Comissão técnica',
  'Financeiro',
  'Administração',
];

async function signInAsMaxReachPresident(page: import('@playwright/test').Page) {
  // `mockAuthenticatedSession` já semeia a sessão no localStorage: nenhum
  // `page.goto('/login')` real é necessário, e chamar `signIn()` depois disso
  // quebraria (PublicRouteGuard redireciona /login para /app quando já
  // autenticado, antes do formulário existir para ser preenchido).
  await mockAuthenticatedSession(page, PRESIDENT_MAX_REACH.role, {
    roles: PRESIDENT_MAX_REACH.roles,
  });
}

/**
 * A faixa superior mobile e a gaveta (ambas sempre montadas, só ocultas por CSS ou
 * pelo estado fechado do `<dialog>`) também têm escudo e `<nav aria-label="Navegação
 * principal">` próprios. Locators sem escopo casam com todos, independentemente de
 * visibilidade — só ações e `toBeVisible()` filtram por isso. A barra lateral
 * (`<aside>`, landmark `complementary`) é o escopo estável para testar
 * especificamente o desktop.
 */
function sidebar(page: import('@playwright/test').Page) {
  return page.getByRole('complementary');
}

test.describe('barra lateral desktop', () => {
  // Sob emulação de dispositivo móvel, sobrepor o viewport para 1920x1080 não
  // reproduz de forma confiável um contexto desktop (a emulação de toque/mobile do
  // dispositivo permanece); este bloco é escopo do projeto `desktop-chromium`
  // (T051). A gaveta mobile tem sua própria suíte abaixo, testada nos dois
  // projetos porque depende só da largura, não da emulação de dispositivo.
  test.beforeEach(({ isMobile }) => {
    test.skip(isMobile, 'cenário desktop — ver a suíte "gaveta de navegação mobile"');
  });

  test('ordena topo, corpo e rodapé; nenhuma faixa de cabeçalho acima de 768px', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await signInAsMaxReachPresident(page);
    await page.goto('/app/roster');

    const brand = sidebar(page).getByAltText('Escudo do MBJ');
    const nav = sidebar(page).getByRole('navigation', { name: 'Navegação principal' });
    const signOutButton = sidebar(page).getByRole('button', { name: /Sair/ });

    const [brandBox, navBox, signOutBox] = await Promise.all([
      brand.boundingBox(),
      nav.boundingBox(),
      signOutButton.boundingBox(),
    ]);
    expect(brandBox).not.toBeNull();
    expect(navBox).not.toBeNull();
    expect(signOutBox).not.toBeNull();

    // Topo antes do corpo, corpo antes do rodapé (ordem vertical).
    expect(navBox!.y).toBeGreaterThanOrEqual(brandBox!.y + brandBox!.height - 1);
    expect(signOutBox!.y).toBeGreaterThanOrEqual(navBox!.y + navBox!.height - 1);

    // Nenhuma faixa de cabeçalho acima da barra lateral (FR-015a): o contêiner do
    // topo começa exatamente no topo do viewport, sem elemento empurrando-o para
    // baixo. O deslocamento do escudo em si vem do padding interno da região, não
    // de uma faixa de cabeçalho.
    const asideTop = await brand.evaluate(
      (img) => img.closest('aside')?.getBoundingClientRect().y ?? -1,
    );
    expect(asideTop).toBe(0);
  });

  test('indica a rota atual com aria-current="page"', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await signInAsMaxReachPresident(page);
    await page.goto('/app/roster');

    const nav = sidebar(page).getByRole('navigation', { name: 'Navegação principal' });
    const activeLink = nav.getByRole('link', { name: 'Elenco' });
    await expect(activeLink).toHaveAttribute('aria-current', 'page');

    const inactiveLink = nav.getByRole('link', { name: 'Partidas' });
    await expect(inactiveLink).not.toHaveAttribute('aria-current', 'page');
  });

  for (const { height, width } of [
    { height: 1080, width: 1920 },
    { height: 768, width: 1366 },
  ]) {
    test(`expõe todos os itens do papel de maior alcance; topo e rodapé ficam fixos em ${width}x${height}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height });
      await signInAsMaxReachPresident(page);
      await page.goto('/app/roster');

      const nav = sidebar(page).getByRole('navigation', { name: 'Navegação principal' });

      // O conjunto exato é o definido pela feature (data-model §3.2 + feature 003).
      await expect(nav.getByRole('link')).toHaveCount(NAVIGATION_LABELS.length);

      // Todo destino é alcançável — o corpo rola até ele quando necessário (o
      // contrato navigation-shell §Estrutura: "apenas o corpo rola, e apenas
      // quando o conteúdo excede a altura", FR-020 / E-02).
      for (const label of NAVIGATION_LABELS) {
        const link = nav.getByRole('link', { name: label });
        await link.scrollIntoViewIfNeeded();
        await expect(link).toBeVisible();
      }

      // Só o CORPO pode rolar. A barra lateral como um todo nunca rola, então
      // topo (escudo) e rodapé ("Sair") permanecem fixos e visíveis mesmo com o
      // corpo rolado.
      const asideOverflows = await sidebar(page).evaluate(
        (el) => el.scrollHeight > el.clientHeight + 1,
      );
      expect(asideOverflows, 'a barra lateral inteira nunca rola — topo e rodapé são fixos').toBe(
        false,
      );
      await expect(sidebar(page).getByAltText('Escudo do MBJ')).toBeVisible();
      await expect(sidebar(page).getByRole('button', { name: /Sair/ })).toBeVisible();

      // Em altura de desktop cheia (1080) os 14 itens cabem sem rolagem interna;
      // em 768 o corpo pode rolar — comportamento contratado, não regressão.
      const bodyOverflows = await nav.evaluate((el) => el.scrollHeight > el.clientHeight + 1);
      if (height >= 1000) {
        expect(
          bodyOverflows,
          'com altura de desktop cheia o corpo acomoda todos os itens sem rolagem',
        ).toBe(false);
      }
    });
  }

  test('mantém alvo de toque mínimo de 44x44 em cada item e no botão "Sair" (FR-025)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await signInAsMaxReachPresident(page);
    await page.goto('/app/roster');

    const nav = sidebar(page).getByRole('navigation', { name: 'Navegação principal' });
    const links = nav.getByRole('link');
    for (let index = 0; index < (await links.count()); index += 1) {
      const box = await links.nth(index).boundingBox();
      expect(box, `item de navegação ${index}`).not.toBeNull();
      expect(box!.height, `altura do item ${index}`).toBeGreaterThanOrEqual(44);
      expect(box!.width, `largura do item ${index}`).toBeGreaterThanOrEqual(44);
    }

    const signOutBox = await sidebar(page).getByRole('button', { name: /Sair/ }).boundingBox();
    expect(signOutBox).not.toBeNull();
    expect(signOutBox!.height).toBeGreaterThanOrEqual(44);
    expect(signOutBox!.width).toBeGreaterThanOrEqual(44);
  });
});

/**
 * Gaveta de navegação mobile (contracts/navigation-shell.md), User Story 3. O
 * cenário de referência da spec é 360x640 (Independent Test da US3).
 */
test.describe('gaveta de navegação mobile', () => {
  const menuButton = (page: import('@playwright/test').Page) =>
    page.getByRole('button', { name: 'Abrir menu de navegação' });
  const drawerNav = (page: import('@playwright/test').Page) =>
    page.getByRole('navigation', { name: 'Navegação principal' });

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await signInAsMaxReachPresident(page);
    await page.goto('/app/roster');
  });

  test('fica inacessível por teclado enquanto fechada (V-15)', async ({ page }) => {
    await expect(drawerNav(page)).toBeHidden();
    await expect(menuButton(page)).toHaveAttribute('aria-expanded', 'false');
  });

  test('abre com showModal, expõe todos os itens e reflete o estado em aria-expanded', async ({
    page,
  }) => {
    await menuButton(page).click();
    await expect(menuButton(page)).toHaveAttribute('aria-expanded', 'true');
    await expect(drawerNav(page)).toBeVisible();
    await expect(drawerNav(page).getByRole('link')).toHaveCount(NAVIGATION_LABELS.length);
    for (const label of NAVIGATION_LABELS) {
      await expect(drawerNav(page).getByRole('link', { name: label })).toBeVisible();
    }
  });

  test('alcança qualquer destino em no máximo dois toques e fecha ao selecionar (FR-023, SC-005)', async ({
    page,
  }) => {
    // Toque 1: abrir o menu.
    await menuButton(page).click();
    // Toque 2: escolher o destino.
    await drawerNav(page).getByRole('link', { name: 'Partidas' }).click();

    await expect(page).toHaveURL(/\/app\/matches$/);
    await expect(drawerNav(page)).toBeHidden();
  });

  test('fecha com Esc e devolve o foco ao botão de menu (FR-024, V-14)', async ({ page }) => {
    await menuButton(page).click();
    await expect(drawerNav(page)).toBeVisible();

    await page.keyboard.press('Escape');

    await expect(drawerNav(page)).toBeHidden();
    await expect(menuButton(page)).toBeFocused();
  });

  test('fecha ao acionar o véu e devolve o foco ao botão de menu', async ({ page }) => {
    await menuButton(page).click();
    await expect(drawerNav(page)).toBeVisible();

    // O painel ocupa até 288px (w-72) à esquerda; um clique fora dele, dentro do
    // viewport de 360px, cai no véu (research D-02: comparação de event.target).
    await page.mouse.click(340, 300);

    await expect(drawerNav(page)).toBeHidden();
    await expect(menuButton(page)).toBeFocused();
  });

  test('mantém alvo de toque mínimo de 44x44 no botão de menu e em cada item (FR-025)', async ({
    page,
  }) => {
    const menuBox = await menuButton(page).boundingBox();
    expect(menuBox).not.toBeNull();
    expect(menuBox!.height).toBeGreaterThanOrEqual(44);
    expect(menuBox!.width).toBeGreaterThanOrEqual(44);

    await menuButton(page).click();
    const links = drawerNav(page).getByRole('link');
    for (let index = 0; index < (await links.count()); index += 1) {
      const box = await links.nth(index).boundingBox();
      expect(box, `item da gaveta ${index}`).not.toBeNull();
      expect(box!.height, `altura do item ${index}`).toBeGreaterThanOrEqual(44);
      expect(box!.width, `largura do item ${index}`).toBeGreaterThanOrEqual(44);
    }
  });
});
