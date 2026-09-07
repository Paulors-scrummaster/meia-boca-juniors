/**
 * Alfas das camadas do fundo do hero (`HeroBackdrop`, WelcomePage.tsx), extraídos
 * para cá porque a camada 2b (`theme-consistency.spec.ts`, T090) precisa dos mesmos
 * valores para compor sequencialmente as camadas na ordem real de pintura e provar o
 * teto de luminância de FR-041 — fonte única evita que os dois arquivos divirjam.
 *
 * Ordem de pintura (de baixo para cima, `background-image` do CSS pinta o primeiro
 * item da lista por cima dos demais — aqui vai do mais baixo ao mais alto):
 *   1. Fotografia do estádio (`heroStadium`) — própria do clube, FR-033.
 *   2. Textura de grão — praticamente nula, contribuição desprezível.
 *   3. Vinheta radial nas bordas — escurece, nunca clareia.
 *   4. Véu horizontal — a camada que garante o teto sob a coluna de texto.
 *   5. Brilho radial dourado — pinta por cima do véu já escurecido, não da foto.
 */
export const HERO_LAYER_ALPHA = {
  /** Véu horizontal: opaco onde fica o texto (0–60% da largura). */
  scrimStrong: 0.98,
  /** Véu horizontal: mais fraco na borda direita (cards e marca d'água). */
  scrimWeak: 0.55,
  /** Brilho radial dourado, posicionado a 22% 6% — dentro da zona forte do véu. */
  goldGlow: 0.14,
  /** Vinheta radial nas bordas (escurece, não entra no pior caso de clareamento). */
  vignette: 0.42,
  /** Textura de grão (escurece por 1,5%, contribuição desprezível). */
  grain: 0.015,
} as const;
