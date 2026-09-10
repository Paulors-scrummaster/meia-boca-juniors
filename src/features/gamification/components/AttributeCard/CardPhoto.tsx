// Feature 003 · US4 · T089a — foto do atleta, elemento visual primário do cartão.
// Cadeia de fallback (FR-019d): recorte transparente → avatar `athletes.photo_path`
// → silhueta neutra. Recortes por atleta são melhoria futura; esta fase reaproveita
// o avatar existente sem mudança de dados/armazenamento.

import { useState } from 'react';

interface CardPhotoProps {
  /** Recorte com fundo transparente, quando existir. */
  cutoutUrl?: string | null;
  /** URL assinada do avatar (`athletes.photo_path`), resolvida pelo integrador. */
  avatarUrl?: string | null;
  name: string;
  className?: string;
}

function Silhouette({ label }: { label: string }) {
  return (
    <svg
      aria-label={label}
      className="h-full w-full text-secondary opacity-40"
      fill="none"
      preserveAspectRatio="xMidYMax meet"
      role="img"
      viewBox="0 0 200 200"
    >
      <g fill="currentColor">
        <circle cx="100" cy="74" r="40" />
        <path d="M28 200 C28 150 60 122 100 122 C140 122 172 150 172 200 Z" />
      </g>
    </svg>
  );
}

export function CardPhoto({ avatarUrl, className = '', cutoutUrl, name }: CardPhotoProps) {
  const [failed, setFailed] = useState<Set<string>>(() => new Set());
  const candidate = [cutoutUrl, avatarUrl].find((url) => url && !failed.has(url)) ?? null;

  return (
    <div className={`relative flex items-end justify-center overflow-hidden ${className}`}>
      {candidate ? (
        <img
          alt={`Foto de ${name}`}
          className="h-full w-full object-contain object-bottom"
          onError={() => setFailed((prev) => new Set(prev).add(candidate))}
          src={candidate}
        />
      ) : (
        <Silhouette label={`Sem foto de ${name}`} />
      )}
    </div>
  );
}
