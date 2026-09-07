import { expect, test } from '@playwright/test';

import { mockAuthenticatedSession, signIn } from './support/auth-mock';

/**
 * Verificação da barra lateral desktop (contracts/navigation-shell.md), User Story 2.
 * PRESIDENT+ATHLETE combinados são o "papel de maior alcance" (E-04): sozinho,
 * PRESIDENT vê 8 dos 10 itens — os dois exclusivos de ATHLETE exigem esse papel.
 */
const PRESIDENT_MAX_REACH = {
  role: 'PRESIDENT' as const,
  roles: ['PRESIDENT', 'ATHLETE'] as const,
};

const NAVIGATION_LABELS = [
  'Início',
  'Elenco',
  'Partidas',
  'Estatísticas',
  'Mural',
  'Notificações',
  'Área do atleta',
  'Craque do Jogo',
  'Comissão técnica',
  'Administração',
];

async function signInAsMaxReachPresident(page: import('@playwright/test').Page) {
  await mockAuthenticatedSession(page, PRESIDENT_MAX_REACH.role, {
    roles: PRESIDENT_MAX_REACH.roles,
  });
  await signIn(page, PRESIDENT_MAX_REACH.role);
}

test.describe('barra lateral desktop', () => {
  test('ordena topo, corpo e rodapé; nenhuma faixa de cabeçalho acima de 768px', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await signInAsMaxReachPresident(page);
    await page.goto('/app/roster');

    const brand = page.getByAltText('Escudo do MBJ');
    const nav = page.getByRole('navigation', { name: 'Navegação principal' });
    const signOutButton = page.getByRole('button', { name: /Sair/ });

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
    const asideTop = await page
      .getByAltText('Escudo do MBJ')
      .evaluate((img) => img.closest('aside')?.getBoundingClientRect().y ?? -1);
    expect(asideTop).toBe(0);
  });

  test('indica a rota atual com aria-current="page"', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await signInAsMaxReachPresident(page);
    await page.goto('/app/roster');

    const activeLink = page
      .getByRole('navigation', { name: 'Navegação principal' })
      .getByRole('link', { name: 'Elenco' });
    await expect(activeLink).toHaveAttribute('aria-current', 'page');

    const inactiveLink = page
      .getByRole('navigation', { name: 'Navegação principal' })
      .getByRole('link', { name: 'Partidas' });
    await expect(inactiveLink).not.toHaveAttribute('aria-current', 'page');
  });

  for (const { height, width } of [
    { height: 1080, width: 1920 },
    { height: 768, width: 1366 },
  ]) {
    test(`mostra os 10 itens do papel de maior alcance sem rolagem em ${width}x${height}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height });
      await signInAsMaxReachPresident(page);
      await page.goto('/app/roster');

      const nav = page.getByRole('navigation', { name: 'Navegação principal' });
      for (const label of NAVIGATION_LABELS) {
        await expect(nav.getByRole('link', { name: label })).toBeVisible();
      }
      await expect(nav.getByRole('link')).toHaveCount(NAVIGATION_LABELS.length);

      const overflows = await nav.evaluate((el) => el.scrollHeight > el.clientHeight + 1);
      expect(overflows, 'a lista de itens não deve exigir rolagem interna nesta largura').toBe(
        false,
      );
    });
  }

  test('mantém alvo de toque mínimo de 44x44 em cada item e no botão "Sair" (FR-025)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await signInAsMaxReachPresident(page);
    await page.goto('/app/roster');

    const nav = page.getByRole('navigation', { name: 'Navegação principal' });
    const links = nav.getByRole('link');
    for (let index = 0; index < (await links.count()); index += 1) {
      const box = await links.nth(index).boundingBox();
      expect(box, `item de navegação ${index}`).not.toBeNull();
      expect(box!.height, `altura do item ${index}`).toBeGreaterThanOrEqual(44);
      expect(box!.width, `largura do item ${index}`).toBeGreaterThanOrEqual(44);
    }

    const signOutBox = await page.getByRole('button', { name: /Sair/ }).boundingBox();
    expect(signOutBox).not.toBeNull();
    expect(signOutBox!.height).toBeGreaterThanOrEqual(44);
    expect(signOutBox!.width).toBeGreaterThanOrEqual(44);
  });
});
