// Feature 003 · US4 · T089a — faixa de atributos (FR-019g).
// Seis colunas iguais separadas por filetes dourados finos; cada uma mostra a
// sigla sobre o valor, com "—" quando o atributo é nulo (estado incompleto).

import { ATTRIBUTE_COLUMNS, type CardAttributeKey } from './attributeCard.constants';

interface CardAttributesProps {
  attributes: Record<CardAttributeKey, number | null>;
  className?: string;
}

export function CardAttributes({ attributes, className = '' }: CardAttributesProps) {
  return (
    <div className={`grid grid-cols-6 text-secondary ${className}`}>
      {ATTRIBUTE_COLUMNS.map(({ key, sigla }, index) => (
        <div
          className={`flex flex-col items-center gap-[0.6cqw] px-[0.5cqw] ${
            index > 0 ? 'border-l border-secondary/40' : ''
          }`}
          key={key}
        >
          <span className="text-[4.5cqw] font-semibold leading-none tracking-wide opacity-80">
            {sigla}
          </span>
          <span className="font-display text-[7cqw] font-bold leading-none">
            {attributes[key] ?? '—'}
          </span>
        </div>
      ))}
    </div>
  );
}
