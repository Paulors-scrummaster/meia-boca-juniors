// Feature 003 · US4 · T089a — constantes do cartão do atleta.
// Mapa sigla↔atributo e ordem fixa das colunas (FR-019g), mapa de abreviação de
// posição pt-BR com fallback de 3 letras (FR-019c), e a geometria do cartão.

export type CardAttributeKey =
  | 'pace'
  | 'shooting'
  | 'passing'
  | 'dribbling'
  | 'defending'
  | 'physical';

/** Sigla exibida sobre cada valor. Ordem canônica em `ATTRIBUTE_COLUMNS`. */
export const ATTRIBUTE_SIGLA: Record<CardAttributeKey, string> = {
  pace: 'RIT',
  shooting: 'FIN',
  passing: 'PAS',
  dribbling: 'CON',
  defending: 'DEF',
  physical: 'FÍS',
};

/** Colunas na ordem exigida por FR-019g: RIT, FIN, PAS, CON, DEF, FÍS. */
export const ATTRIBUTE_COLUMNS: ReadonlyArray<{ key: CardAttributeKey; sigla: string }> = [
  { key: 'pace', sigla: ATTRIBUTE_SIGLA.pace },
  { key: 'shooting', sigla: ATTRIBUTE_SIGLA.shooting },
  { key: 'passing', sigla: ATTRIBUTE_SIGLA.passing },
  { key: 'dribbling', sigla: ATTRIBUTE_SIGLA.dribbling },
  { key: 'defending', sigla: ATTRIBUTE_SIGLA.defending },
  { key: 'physical', sigla: ATTRIBUTE_SIGLA.physical },
];

/**
 * Abreviação pt-BR da posição, derivada no cliente a partir do texto livre
 * `athletes.primary_position` (exposto por `athlete_card`). Chaves normalizadas
 * (minúsculas, sem acento). Sem correspondência → primeiras 3 letras em maiúsculas.
 */
export const POSITION_ABBREVIATIONS: Record<string, string> = {
  goleiro: 'GOL',
  zagueiro: 'ZAG',
  'zagueiro central': 'ZAG',
  lateral: 'LAT',
  'lateral direito': 'LAD',
  'lateral esquerdo': 'LAE',
  ala: 'ALA',
  volante: 'VOL',
  'primeiro volante': 'VOL',
  meia: 'MEI',
  'meia armador': 'MEI',
  'meio campo': 'MC',
  'meio-campo': 'MC',
  atacante: 'ATA',
  'segundo atacante': 'SA',
  ponta: 'PON',
  'ponta direita': 'PTD',
  'ponta esquerda': 'PTE',
  centroavante: 'CA',
};

const stripDiacritics = (value: string) =>
  value.normalize('NFD').replace(/\p{Diacritic}/gu, '');

export function normalizePositionKey(primaryPosition: string): string {
  return stripDiacritics(primaryPosition.trim().toLowerCase()).replace(/\s+/g, ' ');
}

export function abbreviatePosition(primaryPosition: string | null | undefined): string {
  const raw = (primaryPosition ?? '').trim();
  if (raw === '') return '—';
  const normalized = normalizePositionKey(raw);
  const mapped = POSITION_ABBREVIATIONS[normalized];
  if (mapped) return mapped;
  return stripDiacritics(raw).slice(0, 3).toUpperCase();
}

/** Retrato colecionável ~2:3 (FR-019a). */
export const CARD_ASPECT_RATIO = '2 / 3';

/** Caminho do recorte da foto — compartilhado por CardFrame e CardPhoto. */
export const PHOTO_CLIP_PATH =
  'M40 96 H360 V150 C360 300 300 372 200 400 C100 372 40 300 40 150 Z';

/**
 * Largura de referência de cada variante para as container queries; a tipografia
 * e o espaçamento internos escalam com `cqw` a partir daí (FR-019h).
 */
export const CARD_CONTAINER = {
  detailed: { minWidth: 240, maxWidth: 420 },
  compact: { minWidth: 128, maxWidth: 200 },
} as const;
