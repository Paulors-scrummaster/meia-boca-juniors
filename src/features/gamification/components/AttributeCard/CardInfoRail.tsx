// Feature 003 · US4 · T089a — coluna de informações (FR-019c).
// `overall` em destaque, abreviação de posição logo abaixo, bandeira do Brasil e
// escudo oficial do MBJ. A bandeira aparece para todo atleta (o MVP não tem campo
// de nacionalidade e nenhum é adicionado).

import { clubConfig } from '@/config/club.config';

import brFlag from '../../assets/br-flag.svg';

interface CardInfoRailProps {
  overall: number | null;
  positionAbbr: string;
  className?: string;
}

export function CardInfoRail({ className = '', overall, positionAbbr }: CardInfoRailProps) {
  return (
    <div className={`flex flex-col items-center gap-[1.5cqw] text-secondary ${className}`}>
      <span className="font-display text-[16cqw] font-bold leading-none">
        {overall ?? '—'}
      </span>
      <span className="text-[6cqw] font-bold leading-none tracking-wide">{positionAbbr}</span>
      <img alt="Bandeira do Brasil" className="w-[10cqw] rounded-[0.4cqw]" src={brFlag} />
      <img alt="Escudo do MBJ" className="w-[11cqw]" src={clubConfig.assets.shield} />
    </div>
  );
}
