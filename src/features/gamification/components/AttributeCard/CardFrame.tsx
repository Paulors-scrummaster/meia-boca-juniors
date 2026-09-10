// Feature 003 · US4 · T089 — moldura ornamental do cartão.
// SVG inline, retrato ~2:3, traço dourado (tokens `--secondary`/`--accent`),
// topo em ponta curva e aba inferior para a faixa de atributos. Recriada de
// primitivas — nenhuma silhueta/marca proprietária de EA/FIFA.

import { PHOTO_CLIP_PATH } from './attributeCard.constants';

interface CardFrameProps {
  className?: string;
  /** `compact` usa um contorno mais simples, sem os flourishes de canto. */
  variant?: 'detailed' | 'compact';
}

export function CardFrame({ className = '', variant = 'detailed' }: CardFrameProps) {
  return (
    <svg
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 h-full w-full text-secondary ${className}`}
      fill="none"
      preserveAspectRatio="none"
      viewBox="0 0 400 600"
    >
      <defs>
        <clipPath id="mbjCardPhotoClip">
          <path d={PHOTO_CLIP_PATH} />
        </clipPath>
        <linearGradient id="mbjFrameSheen" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity="0.95" />
          <stop offset="0.5" stopColor="currentColor" stopOpacity="0.55" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0.95" />
        </linearGradient>
      </defs>

      <path
        d="M200 8 C150 8 96 20 40 40 C36 150 34 300 44 392 C60 486 120 556 200 592 C280 556 340 486 356 392 C366 300 364 150 360 40 C304 20 250 8 200 8 Z"
        stroke="url(#mbjFrameSheen)"
        strokeWidth="6"
      />
      <path
        d="M200 26 C158 26 110 37 56 55 C52 156 51 296 60 382 C74 468 128 532 200 566 C272 532 326 468 340 382 C349 296 348 156 344 55 C290 37 242 26 200 26 Z"
        stroke="currentColor"
        strokeOpacity="0.5"
        strokeWidth="2"
      />
      <path
        d="M150 34 L200 14 L250 34"
        stroke="currentColor"
        strokeOpacity="0.85"
        strokeWidth="3"
      />
      <circle cx="200" cy="20" fill="currentColor" r="4" />

      {variant === 'detailed' ? (
        <>
          <path
            d="M58 74 L92 74 M58 74 L58 108"
            stroke="currentColor"
            strokeOpacity="0.8"
            strokeWidth="3"
          />
          <path
            d="M342 74 L308 74 M342 74 L342 108"
            stroke="currentColor"
            strokeOpacity="0.8"
            strokeWidth="3"
          />
        </>
      ) : null}

      <path d="M64 470 H336" stroke="currentColor" strokeOpacity="0.85" strokeWidth="3" />
      <path d="M96 486 H304" stroke="currentColor" strokeOpacity="0.45" strokeWidth="1.5" />
    </svg>
  );
}
