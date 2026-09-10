// Feature 003 · US4 · T089 — fundo do cartão.
// Gradiente navy (tokens) + brilho dourado radial + raios em explosão + partículas
// + marca d'água do escudo MBJ em baixa opacidade. Tudo de primitivas do projeto
// (gradientes/SVG/tokens); nenhuma cor fora do sistema; nenhuma imagem JPEG.

import { clubConfig } from '@/config/club.config';

const RAY_ANGLES = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];

const PARTICLES = [
  { cx: 58, cy: 120, r: 2.5, o: 0.3 },
  { cx: 96, cy: 66, r: 1.6, o: 0.22 },
  { cx: 150, cy: 150, r: 2, o: 0.28 },
  { cx: 212, cy: 88, r: 1.4, o: 0.2 },
  { cx: 286, cy: 126, r: 2.6, o: 0.32 },
  { cx: 330, cy: 72, r: 1.8, o: 0.24 },
  { cx: 352, cy: 180, r: 2.2, o: 0.26 },
  { cx: 44, cy: 220, r: 1.6, o: 0.2 },
  { cx: 120, cy: 250, r: 2.4, o: 0.3 },
  { cx: 250, cy: 220, r: 1.5, o: 0.18 },
  { cx: 316, cy: 264, r: 2, o: 0.26 },
  { cx: 72, cy: 320, r: 2.2, o: 0.24 },
  { cx: 196, cy: 300, r: 1.6, o: 0.18 },
  { cx: 300, cy: 340, r: 2.4, o: 0.28 },
  { cx: 150, cy: 380, r: 1.8, o: 0.2 },
  { cx: 250, cy: 392, r: 2, o: 0.22 },
  { cx: 90, cy: 430, r: 1.5, o: 0.16 },
  { cx: 330, cy: 430, r: 1.7, o: 0.18 },
  { cx: 200, cy: 470, r: 1.4, o: 0.14 },
];

interface CardBackdropProps {
  className?: string;
}

export function CardBackdrop({ className = '' }: CardBackdropProps) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden bg-gradient-to-b from-background via-card to-background ${className}`}
    >
      <img
        alt=""
        aria-hidden="true"
        className="absolute left-1/2 top-[42%] w-[70%] -translate-x-1/2 -translate-y-1/2 opacity-[0.06] grayscale"
        src={clubConfig.assets.shield}
      />
      <svg
        className="absolute inset-0 h-full w-full text-secondary"
        fill="none"
        preserveAspectRatio="xMidYMid slice"
        viewBox="0 0 400 600"
      >
        <defs>
          <radialGradient id="mbjCardGlow" cx="0.5" cy="0.4" r="0.62">
            <stop offset="0" stopColor="currentColor" stopOpacity="0.5" />
            <stop offset="0.45" stopColor="currentColor" stopOpacity="0.16" />
            <stop offset="1" stopColor="currentColor" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect fill="url(#mbjCardGlow)" height="600" width="400" x="0" y="0" />
        <g fill="currentColor" opacity="0.09" transform="translate(200 236)">
          {RAY_ANGLES.map((angle) => (
            <polygon key={angle} points="0,0 -14,-360 14,-360" transform={`rotate(${angle})`} />
          ))}
        </g>
        <g fill="currentColor">
          {PARTICLES.map((p) => (
            <circle key={`${p.cx}-${p.cy}`} cx={p.cx} cy={p.cy} opacity={p.o} r={p.r} />
          ))}
        </g>
      </svg>
    </div>
  );
}
