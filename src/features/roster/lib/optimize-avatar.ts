const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const maxOutputBytes = 1_048_576;
const maxOutputDimension = 1024;

export interface SquareCrop {
  height: number;
  outputSize: number;
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
  renderSquare(image: DecodedAvatarImage, crop: SquareCrop, quality: number): Promise<Blob>;
}

export function validateAvatarFile(file: File): void {
  if (!allowedMimeTypes.has(file.type)) {
    throw new Error('Envie uma imagem JPEG, PNG ou WebP.');
  }
  if (file.size === 0) throw new Error('A imagem selecionada está vazia.');
}

export function calculateSquareCrop(
  width: number,
  height: number,
  outputLimit = maxOutputDimension,
): SquareCrop {
  if (width <= 0 || height <= 0) throw new Error('Não foi possível ler as dimensões da imagem.');
  const side = Math.min(width, height);
  return {
    height: side,
    outputSize: Math.min(side, outputLimit),
    width: side,
    x: Math.round((width - side) / 2),
    y: Math.round((height - side) / 2),
  };
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
  async renderSquare(image, crop, quality) {
    const canvas = document.createElement('canvas');
    canvas.width = crop.outputSize;
    canvas.height = crop.outputSize;
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
      crop.outputSize,
      crop.outputSize,
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
    let crop = calculateSquareCrop(image.width, image.height);
    const qualities = [0.82, 0.68, 0.54, 0.4];

    while (true) {
      for (const quality of qualities) {
        const output = await adapter.renderSquare(image, crop, quality);
        if (output.size <= maxOutputBytes) return output;
      }
      if (crop.outputSize <= 256) break;
      crop = { ...crop, outputSize: Math.max(256, Math.floor(crop.outputSize * 0.8)) };
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
