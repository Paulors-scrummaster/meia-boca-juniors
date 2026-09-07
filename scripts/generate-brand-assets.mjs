// Gera os ativos de marca a partir das fontes do repositório.
//
// Dois artefatos com propósitos diferentes (research D-03):
//
//   1. Brasão em tela — extraído de `logo mbj 2.png`, o arquivo oficial em alta
//      resolução, com o fundo branco removido. Preserva relevo, brilho e o campo de
//      estrelas do brasão real, exigido pela referência normativa da interface.
//   2. Ícones da PWA — rasterizados do escudo vetorial `mbj-shield.svg`, que é uma
//      simplificação legível em tamanhos pequenos, onde o detalhe fino do brasão real
//      vira ruído.
//
// Usa o Chromium do Playwright, já presente como dependência de desenvolvimento, em
// vez de adicionar uma biblioteca de processamento de imagem. A saída é versionada:
// o build de produção não gera imagem.
//
// Uso: npm run brand:assets

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { chromium } from '@playwright/test';

const ROOT = process.cwd();
const CREST_SOURCE = resolve(ROOT, 'logo mbj 2.png');
const SHIELD = resolve(ROOT, 'public/brand/mbj-shield.svg');
const NAVY = '#0A1325';

/**
 * Tamanhos do brasão em tela. O de 1024 serve a marca d'água do hero, exibida em
 * opacidade baixa, onde qualidade menor de compressão é imperceptível.
 */
const CREST_SIZES = [
  { size: 512, quality: 0.92 },
  { size: 1024, quality: 0.84 },
];

const ICON_TARGETS = [
  { file: 'public/brand/mbj-icon-192.png', size: 192, scale: 1, background: null },
  { file: 'public/brand/mbj-icon-512.png', size: 512, scale: 1, background: null },
  { file: 'public/brand/mbj-icon-maskable-512.png', size: 512, scale: 0.6, background: NAVY },
];

const BUDGETS = { svg: 20 * 1024, icon: 40 * 1024, crest: 120 * 1024, total: 300 * 1024 };

/**
 * Remove o fundo branco por preenchimento a partir das bordas, recorta ao brasão e
 * reamostra para o tamanho pedido.
 *
 * O preenchimento parte das bordas de propósito: um limiar global sobre "quase branco"
 * furaria os brilhos especulares do dourado, que chegam perto do branco. O brasão tem
 * contorno azul-escuro, então o preenchimento para de forma limpa na silhueta.
 */
async function extractCrest(page, dataUrl, size, quality) {
  return page.evaluate(
    async ({ url, target, quality: q }) => {
      const img = new Image();
      img.src = url;
      await img.decode();

      const source = document.createElement('canvas');
      source.width = img.width;
      source.height = img.height;
      const ctx = source.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);

      const { width: w, height: h } = source;
      const image = ctx.getImageData(0, 0, w, h);
      const data = image.data;

      const isNearWhite = (i, tolerance) =>
        data[i] >= 255 - tolerance &&
        data[i + 1] >= 255 - tolerance &&
        data[i + 2] >= 255 - tolerance;

      // Preenchimento iterativo a partir de todos os pixels de borda.
      const background = new Uint8Array(w * h);
      const stack = [];
      for (let x = 0; x < w; x += 1) {
        stack.push(x, (h - 1) * w + x);
      }
      for (let y = 0; y < h; y += 1) {
        stack.push(y * w, y * w + w - 1);
      }
      while (stack.length > 0) {
        const p = stack.pop();
        if (background[p]) continue;
        if (!isNearWhite(p * 4, 42)) continue;
        background[p] = 1;
        const x = p % w;
        const y = (p - x) / w;
        if (x > 0) stack.push(p - 1);
        if (x < w - 1) stack.push(p + 1);
        if (y > 0) stack.push(p - w);
        if (y < h - 1) stack.push(p + w);
      }

      // Remove a franja de antisserrilhamento: pixels claros encostados no fundo.
      const fringe = new Uint8Array(w * h);
      for (let y = 1; y < h - 1; y += 1) {
        for (let x = 1; x < w - 1; x += 1) {
          const p = y * w + x;
          if (background[p]) continue;
          const touchesBackground =
            background[p - 1] || background[p + 1] || background[p - w] || background[p + w];
          if (touchesBackground && isNearWhite(p * 4, 70)) fringe[p] = 1;
        }
      }

      let minX = w;
      let minY = h;
      let maxX = -1;
      let maxY = -1;
      for (let p = 0; p < w * h; p += 1) {
        if (background[p] || fringe[p]) {
          data[p * 4 + 3] = 0;
          continue;
        }
        const x = p % w;
        const y = (p - x) / w;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
      ctx.putImageData(image, 0, 0);

      // Recorta ao brasão e reamostra mantendo a proporção, centralizado no quadro.
      const cropW = maxX - minX + 1;
      const cropH = maxY - minY + 1;
      const scale = target / Math.max(cropW, cropH);
      const out = document.createElement('canvas');
      out.width = target;
      out.height = target;
      const outCtx = out.getContext('2d');
      outCtx.imageSmoothingEnabled = true;
      outCtx.imageSmoothingQuality = 'high';
      outCtx.drawImage(
        source,
        minX,
        minY,
        cropW,
        cropH,
        (target - cropW * scale) / 2,
        (target - cropH * scale) / 2,
        cropW * scale,
        cropH * scale,
      );

      return {
        dataUrl: out.toDataURL('image/webp', q),
        crop: { x: minX, y: minY, width: cropW, height: cropH },
        source: { width: w, height: h },
      };
    },
    { url: dataUrl, target: size, quality },
  );
}

function iconPage(svg, { size, scale, background }) {
  const inset = ((1 - scale) / 2) * 100;
  return `<!doctype html><meta charset="utf-8"><style>
    html,body{margin:0;padding:0}
    #frame{width:${size}px;height:${size}px;position:relative;
      background:${background ?? 'transparent'}}
    #frame svg{position:absolute;inset:${inset}%;width:${scale * 100}%;height:${scale * 100}%}
  </style><div id="frame">${svg}</div>`;
}

const browser = await chromium.launch();
const results = [];

try {
  // --- Brasão em tela, a partir do arquivo oficial ---
  const sourceBuffer = await readFile(CREST_SOURCE);
  const sourceUrl = `data:image/png;base64,${sourceBuffer.toString('base64')}`;
  const crestPage = await browser.newPage();
  await crestPage.setContent('<!doctype html><meta charset="utf-8"><body>');

  for (const { size, quality } of CREST_SIZES) {
    const { dataUrl, crop, source } = await extractCrest(crestPage, sourceUrl, size, quality);
    const buffer = Buffer.from(dataUrl.split(',')[1], 'base64');
    const file = `public/brand/mbj-crest-${size}.webp`;
    const out = resolve(ROOT, file);
    await mkdir(dirname(out), { recursive: true });
    await writeFile(out, buffer);
    results.push({ file, bytes: buffer.byteLength, budget: BUDGETS.crest });
    if (size === CREST_SIZES[0].size) {
      console.log(
        `origem ${source.width}x${source.height}, brasao recortado em ${crop.width}x${crop.height}`,
      );
    }
  }
  await crestPage.close();

  // --- Ícones da PWA, a partir do escudo vetorial ---
  const svg = await readFile(SHIELD, 'utf8');
  for (const target of ICON_TARGETS) {
    const tab = await browser.newPage({
      viewport: { width: target.size, height: target.size },
      deviceScaleFactor: 1,
    });
    await tab.setContent(iconPage(svg, target), { waitUntil: 'load' });
    const buffer = await tab.locator('#frame').screenshot({
      omitBackground: target.background === null,
      type: 'png',
    });
    await tab.close();

    const out = resolve(ROOT, target.file);
    await writeFile(out, buffer);
    results.push({ file: target.file, bytes: buffer.byteLength, budget: BUDGETS.icon });
  }
} finally {
  await browser.close();
}

let failed = false;
let total = 0;
for (const { file, bytes, budget } of results) {
  total += bytes;
  const over = bytes > budget;
  if (over) failed = true;
  console.log(
    `${over ? 'ACIMA DO ORCAMENTO' : 'ok'}  ${file}  ${(bytes / 1024).toFixed(1)} KB  (limite ${budget / 1024} KB)`,
  );
}

const shieldBytes = (await readFile(SHIELD)).byteLength;
total += shieldBytes;
console.log(`ok  public/brand/mbj-shield.svg  ${(shieldBytes / 1024).toFixed(1)} KB`);
console.log(`total de marca ${(total / 1024).toFixed(1)} KB (limite ${BUDGETS.total / 1024} KB)`);
if (total > BUDGETS.total) failed = true;

if (failed) {
  console.error('\nOrcamento estourado (contracts/brand-assets.md).');
  process.exitCode = 1;
}
