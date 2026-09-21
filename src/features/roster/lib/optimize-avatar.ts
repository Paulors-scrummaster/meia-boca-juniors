const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const maxOutputBytes = 1_048_576;
const maxOutputDimension = 1024;

/**
 * Proporção retrato do recorte (largura/altura). O cartão do atleta reserva um
 * espaço bem mais alto que largo para a foto — um recorte quadrado sobrava
 * espaço vazio e, pior, cortava cabeça/pés na maioria das fotos verticais
 * comuns (retrato de celular). 3:4 é um meio-termo: reduz o corte necessário
 * sem virar uma tira estreita demais para fotos horizontais.
 */
const PHOTO_CROP_ASPECT_RATIO = 3 / 4;

/**
 * Fração do espaço vertical sobrando que fica ACIMA do recorte quando a
 * origem é mais alta que o alvo. Time de futebol costuma fotografar com a
 * pessoa perto do topo do quadro e sobra de chão embaixo; 0.35 (menos que a
 * metade) preserva mais cabeça do que um corte central puro (0.5).
 */
const TOP_BIAS_FRACTION = 0.35;

export interface PhotoCrop {
  height: number;
  outputHeight: number;
  outputWidth: number;
  width: number;
  x: number;
  y: number;
}

export interface DecodedAvatarImage {
  close: () => void;
  height: number;
  source: CanvasImageSource;
  width: number;
}

export interface AvatarImageAdapter {
  decode(file: File): Promise<DecodedAvatarImage>;
  renderCrop(image: DecodedAvatarImage, crop: PhotoCrop, quality: number): Promise<Blob>;
}

export function validateAvatarFile(file: File): void {
  if (!allowedMimeTypes.has(file.type)) {
    throw new Error('Envie uma imagem JPEG, PNG ou WebP.');
  }
  if (file.size === 0) throw new Error('A imagem selecionada está vazia.');
}

export function calculatePhotoCrop(
  width: number,
  height: number,
  outputLimit = maxOutputDimension,
): PhotoCrop {
  if (width <= 0 || height <= 0) throw new Error('Não foi possível ler as dimensões da imagem.');

  const sourceAspectRatio = width / height;
  let cropWidth: number;
  let cropHeight: number;
  if (sourceAspectRatio > PHOTO_CROP_ASPECT_RATIO) {
    cropHeight = height;
    cropWidth = Math.round(height * PHOTO_CROP_ASPECT_RATIO);
  } else {
    cropWidth = width;
    cropHeight = Math.round(width / PHOTO_CROP_ASPECT_RATIO);
  }

  const x = Math.round((width - cropWidth) / 2);
  const verticalSlack = height - cropHeight;
  const y = verticalSlack > 0 ? Math.round(verticalSlack * TOP_BIAS_FRACTION) : 0;

  const outputHeight = Math.min(cropHeight, outputLimit);
  const outputWidth = Math.round(outputHeight * PHOTO_CROP_ASPECT_RATIO);

  return { height: cropHeight, outputHeight, outputWidth, width: cropWidth, x, y };
}

const browserAdapter: AvatarImageAdapter = {
  async decode(file) {
    const bitmap = await createImageBitmap(file);
    return {
      close: () => bitmap.close(),
      height: bitmap.height,
      source: bitmap,
      width: bitmap.width,
    };
  },
  async renderCrop(image, crop, quality) {
    const canvas = document.createElement('canvas');
    canvas.width = crop.outputWidth;
    canvas.height = crop.outputHeight;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('O navegador não conseguiu preparar a imagem.');
    context.drawImage(
      image.source,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      0,
      crop.outputWidth,
      crop.outputHeight,
    );
    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Não foi possível otimizar a imagem.'))),
        'image/webp',
        quality,
      );
    });
  },
};

export async function optimizeAvatar(
  file: File,
  adapter: AvatarImageAdapter = browserAdapter,
): Promise<Blob> {
  validateAvatarFile(file);
  const image = await adapter.decode(file);

  try {
    let crop = calculatePhotoCrop(image.width, image.height);
    const qualities = [0.82, 0.68, 0.54, 0.4];

    while (true) {
      for (const quality of qualities) {
        const output = await adapter.renderCrop(image, crop, quality);
        if (output.size <= maxOutputBytes) return output;
      }
      if (crop.outputHeight <= 256) break;
      const outputHeight = Math.max(256, Math.floor(crop.outputHeight * 0.8));
      crop = {
        ...crop,
        outputHeight,
        outputWidth: Math.round(outputHeight * PHOTO_CROP_ASPECT_RATIO),
      };
    }
  } finally {
    image.close();
  }

  throw new Error('Não foi possível reduzir a imagem para o limite de 1 MB.');
}

export const avatarLimits = {
  allowedMimeTypes: [...allowedMimeTypes],
  maxOutputBytes,
  maxOutputDimension,
} as const;
