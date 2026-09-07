// Gera os ícones PNG da PWA a partir do escudo vetorial.
//
// Usa o Chromium do Playwright, já presente como dependência de desenvolvimento,
// em vez de adicionar uma biblioteca de processamento de imagem (research D-04).
// A saída é versionada no repositório: o build de produção não gera imagem.
//
// Uso: npm run brand:icons

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { chromium } from '@playwright/test';

const ROOT = process.cwd();
const SHIELD = resolve(ROOT, 'public/brand/mbj-shield.svg');
const NAVY = '#0A1325';

/**
 * `any`: escudo preenchendo o quadro, fundo transparente.
 * `maskable`: escudo dentro da zona de segurança circular de 80%, sobre navy opaco,
 * para que o recorte do sistema operacional não corte o contorno (GA-03).
 */
const TARGETS = [
  { file: 'public/brand/mbj-icon-192.png', size: 192, scale: 1, background: null },
  { file: 'public/brand/mbj-icon-512.png', size: 512, scale: 1, background: null },
  { file: 'public/brand/mbj-icon-maskable-512.png', size: 512, scale: 0.6, background: NAVY },
];

/** Orçamento por artefato, em bytes (contracts/brand-assets.md). */
const PNG_BUDGET = 40 * 1024;

function page(svg, { size, scale, background }) {
  const inset = ((1 - scale) / 2) * 100;
  return `<!doctype html><meta charset="utf-8"><style>
    html,body{margin:0;padding:0}
    #frame{width:${size}px;height:${size}px;position:relative;
      background:${background ?? 'transparent'}}
    #frame svg{position:absolute;inset:${inset}%;width:${scale * 100}%;height:${scale * 100}%}
  </style><div id="frame">${svg}</div>`;
}

const svg = await readFile(SHIELD, 'utf8');
const browser = await chromium.launch();
const results = [];

try {
  for (const target of TARGETS) {
    const tab = await browser.newPage({
      viewport: { width: target.size, height: target.size },
      deviceScaleFactor: 1,
    });
    await tab.setContent(page(svg, target), { waitUntil: 'load' });
    const buffer = await tab.locator('#frame').screenshot({
      omitBackground: target.background === null,
      type: 'png',
    });
    await tab.close();

    const out = resolve(ROOT, target.file);
    await mkdir(dirname(out), { recursive: true });
    await writeFile(out, buffer);
    results.push({ file: target.file, bytes: buffer.byteLength });
  }
} finally {
  await browser.close();
}

let failed = false;
for (const { file, bytes } of results) {
  const kb = (bytes / 1024).toFixed(1);
  const over = bytes > PNG_BUDGET;
  if (over) failed = true;
  console.log(`${over ? 'ACIMA DO ORCAMENTO' : 'ok'}  ${file}  ${kb} KB`);
}

if (failed) {
  console.error(`\nOrcamento por PNG e de ${PNG_BUDGET / 1024} KB (contracts/brand-assets.md).`);
  process.exitCode = 1;
}
