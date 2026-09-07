import type { Page } from '@playwright/test';

/**
 * Helpers da camada 2 (conformidade de paleta) e da camada 2b (luminância do hero)
 * do portão definido em `contracts/theme-verification.md`.
 *
 * A camada 2 compara as cores computadas contra uma lista enumerável derivada dos
 * tokens resolvidos em `:root`. A camada 2b existe porque o axe é estruturalmente
 * incapaz de avaliar contraste sobre gradiente: ele não determina a cor de fundo em
 * `background-image` e devolve *incomplete*, que não reprova (GL-18).
 */

/** Opacidades permitidas pelo conjunto fechado de FR-003b. */
const SURFACE_ALPHA = 0.1;
const BORDER_ALPHA = 0.4;
const OVERLAY_ALPHA = 0.6;

/** Teto de luminância de qualquer região do hero sob texto (FR-041). */
export const HERO_LUMINANCE_CEILING = 0.03;

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

function channelLuminance(value: number): number {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Luminância relativa conforme a definição da WCAG. */
export function relativeLuminance({ r, g, b }: Rgb): number {
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
}

export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Compõe uma cor com alfa sobre um fundo opaco. */
export function composite(foreground: Rgb, alpha: number, background: Rgb): Rgb {
  return {
    r: foreground.r * alpha + background.r * (1 - alpha),
    g: foreground.g * alpha + background.g * (1 - alpha),
    b: foreground.b * alpha + background.b * (1 - alpha),
  };
}

/** Aceita `rgb(r, g, b)`, `rgba(r, g, b, a)` e a forma com barra do CSS Color 4. */
export function parseRgb(value: string): (Rgb & { a: number }) | null {
  const match = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,/\s]+([\d.]+))?\s*\)/i.exec(
    value,
  );
  if (!match) return null;
  return {
    r: Number(match[1]),
    g: Number(match[2]),
    b: Number(match[3]),
    a: match[4] === undefined ? 1 : Number(match[4]),
  };
}

function normalize({ r, g, b, a }: Rgb & { a: number }): string {
  const round = (n: number) => Math.round(n);
  return a >= 1
    ? `${round(r)},${round(g)},${round(b)},1`
    : `${round(r)},${round(g)},${round(b)},${a.toFixed(2)}`;
}

/** Lê os valores resolvidos dos tokens declarados em `:root`. */
export async function readThemeTokens(page: Page): Promise<Record<string, Rgb>> {
  const raw = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    const probe = document.createElement('span');
    document.body.append(probe);
    const names = Array.from(document.styleSheets)
      .flatMap((sheet) => {
        try {
          return Array.from(sheet.cssRules);
        } catch {
          return [];
        }
      })
      .flatMap((rule) =>
        rule instanceof CSSStyleRule && rule.selectorText === ':root'
          ? Array.from(rule.style).filter((name) => name.startsWith('--'))
          : [],
      );
    const resolved: Record<string, string> = {};
    for (const name of names) {
      const value = style.getPropertyValue(name).trim();
      if (!/^\d/.test(value)) continue;
      probe.style.color = `hsl(${value})`;
      resolved[name.slice(2)] = getComputedStyle(probe).color;
    }
    probe.remove();
    return resolved;
  });

  const tokens: Record<string, Rgb> = {};
  for (const [name, value] of Object.entries(raw)) {
    const parsed = parseRgb(value);
    if (parsed) tokens[name] = { r: parsed.r, g: parsed.g, b: parsed.b };
  }
  return tokens;
}

/**
 * Lista enumerável de cores permitidas: todo token sólido, cada token nas opacidades
 * de superfície e borda, o véu a 60% e o transparente.
 */
export function buildAllowedColors(tokens: Record<string, Rgb>): Set<string> {
  // Derivado de `normalize()`, não escrito à mão: o formato do sentinel transparente
  // precisa bater exatamente com o que `normalizeValue()` produz no navegador (camada
  // 2b), inclusive o sufixo decimal do alfa quando ele é zero.
  const allowed = new Set<string>([normalize({ a: 0, b: 0, g: 0, r: 0 })]);
  for (const [name, rgb] of Object.entries(tokens)) {
    allowed.add(normalize({ ...rgb, a: 1 }));
    allowed.add(normalize({ ...rgb, a: SURFACE_ALPHA }));
    allowed.add(normalize({ ...rgb, a: BORDER_ALPHA }));
    if (name === 'overlay') allowed.add(normalize({ ...rgb, a: OVERLAY_ALPHA }));
  }
  return allowed;
}

export interface PaletteViolation {
  selector: string;
  property: string;
  value: string;
}

/**
 * Percorre os elementos visíveis e devolve as cores fora da lista permitida.
 *
 * Gradientes ficam fora por construção (research D-12): são `background-image`, não
 * `background-color`, e seus stops derivam de tokens por exigência de G-07.
 */
export async function findPaletteViolations(
  page: Page,
  allowed: Set<string>,
  exemptSelectors: string[] = [],
): Promise<PaletteViolation[]> {
  return page.evaluate(
    ({ allowedList, exempt }) => {
      const allowedSet = new Set(allowedList);
      const violations: { selector: string; property: string; value: string }[] = [];
      const properties = [
        'backgroundColor',
        'color',
        'borderTopColor',
        'borderRightColor',
        'borderBottomColor',
        'borderLeftColor',
      ] as const;

      const describe = (element: Element) => {
        const id = element.id ? `#${element.id}` : '';
        const cls =
          typeof element.className === 'string' && element.className
            ? `.${element.className.trim().split(/\s+/).slice(0, 3).join('.')}`
            : '';
        return `${element.tagName.toLowerCase()}${id}${cls}`;
      };

      const normalizeValue = (value: string) => {
        const m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,/\s]+([\d.]+))?\s*\)/i.exec(
          value,
        );
        if (!m) return value;
        const a = m[4] === undefined ? 1 : Number(m[4]);
        const round = (n: string) => Math.round(Number(n));
        return a >= 1
          ? `${round(m[1])},${round(m[2])},${round(m[3])},1`
          : `${round(m[1])},${round(m[2])},${round(m[3])},${a.toFixed(2)}`;
      };

      for (const element of Array.from(document.body.querySelectorAll('*'))) {
        if (exempt.some((selector) => element.closest(selector))) continue;
        const box = element.getBoundingClientRect();
        if (box.width === 0 || box.height === 0) continue;
        const style = getComputedStyle(element);
        if (style.visibility === 'hidden' || style.display === 'none') continue;

        for (const property of properties) {
          const value = normalizeValue(style[property]);
          if (!allowedSet.has(value)) {
            violations.push({ selector: describe(element), property, value });
          }
        }
      }
      return violations.slice(0, 40);
    },
    { allowedList: [...allowed], exempt: exemptSelectors },
  );
}

export interface GradientStop {
  color: Rgb & { a: number };
  luminanceOverBase: number;
}

/**
 * Camada 2b: extrai os stops do `background-image` de um elemento e devolve a
 * luminância de cada um composto sobre o fundo base.
 *
 * Opera sobre os stops declarados, não sobre pixels — não exige decodificar imagem e
 * produz o mesmo resultado em qualquer máquina (GL-16).
 */
export async function readGradientStops(
  page: Page,
  selector: string,
  base: Rgb,
): Promise<GradientStop[]> {
  const backgroundImage = await page.evaluate((target) => {
    const element = document.querySelector(target);
    return element ? getComputedStyle(element).backgroundImage : '';
  }, selector);

  const stops: GradientStop[] = [];
  for (const match of backgroundImage.matchAll(
    /rgba?\(\s*[\d.]+[,\s]+[\d.]+[,\s]+[\d.]+(?:[,/\s]+[\d.]+)?\s*\)/gi,
  )) {
    const parsed = parseRgb(match[0]);
    if (!parsed) continue;
    const over = composite({ r: parsed.r, g: parsed.g, b: parsed.b }, parsed.a, base);
    stops.push({ color: parsed, luminanceOverBase: relativeLuminance(over) });
  }
  return stops;
}

/** Cor equivalente ao pior caso (mais claro) do fundo, para calcular contraste. */
export function worstCaseBackground(base: Rgb, stops: GradientStop[]): Rgb {
  let worst = base;
  let worstLuminance = relativeLuminance(base);
  for (const stop of stops) {
    if (stop.luminanceOverBase > worstLuminance) {
      worstLuminance = stop.luminanceOverBase;
      worst = composite({ r: stop.color.r, g: stop.color.g, b: stop.color.b }, stop.color.a, base);
    }
  }
  return worst;
}
