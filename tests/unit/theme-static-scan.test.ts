import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Camada 1 do portão de verificação de tema (contracts/theme-verification.md).
 *
 * Varre `src/` em busca de:
 *  - utilitários de cor da paleta padrão do Tailwind (`bg-slate-500`, `text-white`, ...);
 *  - cores literais (`#rrggbb`, `rgb(...)`, `hsl(...)`, ...).
 *
 * Exceções declaradas pelo contrato:
 *  - `src/index.css` (definição dos tokens em si);
 *  - `src/config/club.config.ts` (fonte dos valores dos tokens);
 *  - o contêiner do QR Code em `src/features/auth/pages/MfaPage.tsx` (FR-003g — superfície clara
 *    exigida para leitura por scanner).
 */

const SRC_ROOT = path.resolve(process.cwd(), 'src');

const EXCLUDED_FILES = new Set(
  ['src/index.css', 'src/config/club.config.ts'].map((relative) => path.normalize(relative)),
);

const SCANNED_EXTENSIONS = new Set(['.ts', '.tsx', '.css']);
const EXCLUDED_DIR_NAMES = new Set(['node_modules', 'dist', 'coverage']);
const TEST_FILE_PATTERN = /\.(?:test|spec)\.tsx?$/;

const TAILWIND_DEFAULT_PALETTE = [
  'slate',
  'gray',
  'zinc',
  'neutral',
  'stone',
  'red',
  'orange',
  'amber',
  'yellow',
  'lime',
  'green',
  'emerald',
  'teal',
  'cyan',
  'sky',
  'blue',
  'indigo',
  'violet',
  'purple',
  'fuchsia',
  'pink',
  'rose',
];

// bg-/text-/border-/ring-/from-/to-/via- seguido de uma família padrão do Tailwind (com opacidade
// opcional, ex.: `bg-slate-500/40`) ou de `white`/`black`.
const TAILWIND_UTILITY_PATTERN = new RegExp(
  String.raw`\b(?:bg|text|border|ring|from|to|via)-(?:(?:${TAILWIND_DEFAULT_PALETTE.join('|')})-[0-9]{2,3}|white|black)\b`,
);

// Cor literal: hex de 3/4/6/8 dígitos, ou função rgb()/rgba()/hsl()/hsla() com valor literal —
// `hsl(var(--token))` referencia um token semântico e não é uma cor literal.
const LITERAL_COLOR_PATTERN =
  /#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b|(?:rgba?|hsla?)\((?!\s*var\()/;

interface Violation {
  file: string;
  line: number;
  match: string;
  snippet: string;
}

function collectSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (EXCLUDED_DIR_NAMES.has(entry)) continue;
    const fullPath = path.join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      collectSourceFiles(fullPath, out);
    } else if (SCANNED_EXTENSIONS.has(path.extname(entry))) {
      out.push(fullPath);
    }
  }
  return out;
}

function isExcludedFile(relativePath: string): boolean {
  const normalized = path.normalize(relativePath);
  return EXCLUDED_FILES.has(normalized) || TEST_FILE_PATTERN.test(normalized);
}

// FR-003g: o contêiner do QR Code em MfaPage.tsx é a única superfície clara permitida pelo
// contrato. Ele é marcado explicitamente com `data-theme-exception="qr-code"` no próprio
// elemento, e a exceção só se aplica dentro de uma pequena janela ao redor dessa marca.
const QR_CODE_EXCEPTION_MARKER = 'data-theme-exception="qr-code"';
const QR_CODE_EXCEPTION_WINDOW = 5;

function isMfaQrCodeException(relativePath: string, lines: string[], lineIndex: number): boolean {
  if (path.normalize(relativePath) !== path.normalize('src/features/auth/pages/MfaPage.tsx')) {
    return false;
  }
  const start = Math.max(0, lineIndex - QR_CODE_EXCEPTION_WINDOW);
  const end = Math.min(lines.length, lineIndex + QR_CODE_EXCEPTION_WINDOW + 1);
  return lines.slice(start, end).some((line) => line.includes(QR_CODE_EXCEPTION_MARKER));
}

function scan(pattern: RegExp): Violation[] {
  const violations: Violation[] = [];
  for (const filePath of collectSourceFiles(SRC_ROOT)) {
    const relativePath = path.join('src', path.relative(SRC_ROOT, filePath));
    if (isExcludedFile(relativePath)) continue;

    const lines = readFileSync(filePath, 'utf8').split('\n');
    lines.forEach((line, index) => {
      const match = pattern.exec(line);
      if (!match) return;
      if (isMfaQrCodeException(relativePath, lines, index)) return;
      violations.push({
        file: relativePath,
        line: index + 1,
        match: match[0],
        snippet: line.trim(),
      });
    });
  }
  return violations;
}

function formatViolations(violations: Violation[]): string {
  return violations
    .map(
      (violation) =>
        `${violation.file}:${violation.line} → "${violation.match}" (${violation.snippet})`,
    )
    .join('\n');
}

describe('camada 1 — varredura estática de cor (contracts/theme-verification.md)', () => {
  it('não usa utilitários de cor da paleta padrão do Tailwind fora dos tokens semânticos', () => {
    const violations = scan(TAILWIND_UTILITY_PATTERN);
    expect(violations, formatViolations(violations)).toHaveLength(0);
  });

  it('não usa cores literais (#rrggbb, rgb(), hsl(), ...) em arquivos de componente', () => {
    const violations = scan(LITERAL_COLOR_PATTERN);
    expect(violations, formatViolations(violations)).toHaveLength(0);
  });
});
