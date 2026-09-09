// Feature 003 · US4 · T089a/T089b — orquestrador do cartão do atleta.
// `variant="detailed"` (perfil): moldura + fundo + coluna de info + foto herói +
// nameplate + faixa de atributos. `variant="compact"` (grades/listas): moldura e
// fundo simplificados, preserva foto + selo de `overall` + nome + posição + a
// identidade dourado-sobre-navy; omite bandeira e a faixa completa de atributos.
// O `overall` vem verbatim da query `athlete_card` — nunca recalculado no cliente.

import type { AthleteCard } from '../../api/gamification.service';
import { CardAttributes } from './CardAttributes';
import { CardBackdrop } from './CardBackdrop';
import { CardFrame } from './CardFrame';
import { CardInfoRail } from './CardInfoRail';
import { CardNameplate } from './CardNameplate';
import { CardPhoto } from './CardPhoto';
import { abbreviatePosition, CARD_ASPECT_RATIO } from './attributeCard.constants';

export type AttributeCardVariant = 'detailed' | 'compact';

interface AttributeCardProps {
  card: AthleteCard;
  variant?: AttributeCardVariant;
  /** URL assinada do avatar (`athletes.photo_path`), resolvida pelo integrador. */
  avatarUrl?: string | null;
  /** Recorte com fundo transparente, quando existir. */
  cutoutUrl?: string | null;
  className?: string;
}

export function AttributeCard({
  avatarUrl,
  card,
  className = '',
  cutoutUrl,
  variant = 'detailed',
}: AttributeCardProps) {
  const isIncomplete = card.incomplete || card.overall === null;
  const positionAbbr = abbreviatePosition(card.primaryPosition);
  const attributes = {
    pace: card.pace,
    shooting: card.shooting,
    passing: card.passing,
    dribbling: card.dribbling,
    defending: card.defending,
    physical: card.physical,
  };

  return (
    <article
      className={`relative isolate select-none overflow-hidden text-secondary [container-type:inline-size] ${className}`}
      data-incomplete={isIncomplete ? 'true' : undefined}
      data-variant={variant}
      style={{ aspectRatio: CARD_ASPECT_RATIO }}
    >
      <CardBackdrop />
      <CardFrame variant={variant} />

      {variant === 'compact' ? (
        <div className="absolute inset-0 flex flex-col items-center px-[9cqw] pb-[7cqw] pt-[10cqw]">
          {isIncomplete ? null : (
            <span className="font-display absolute left-[9cqw] top-[8cqw] grid h-[20cqw] w-[20cqw] place-items-center rounded-full border border-secondary/70 bg-background/70 text-[10cqw] font-bold leading-none">
              {card.overall}
            </span>
          )}
          <CardPhoto
            avatarUrl={avatarUrl ?? null}
            className="h-[60%] w-[78%]"
            cutoutUrl={cutoutUrl ?? null}
            name={card.shirtName}
          />
          <div className="mt-auto flex flex-col items-center gap-[1cqw]">
            <span className="font-display text-[11cqw] font-bold uppercase leading-none tracking-wide">
              {card.shirtName}
            </span>
            <span className="text-[6cqw] font-semibold leading-none tracking-wide opacity-80">
              {positionAbbr}
            </span>
          </div>
        </div>
      ) : (
        <div className="absolute inset-0 flex flex-col px-[8cqw] pb-[6cqw] pt-[9cqw]">
          <div className="flex flex-1 gap-[2cqw]">
            <CardInfoRail
              className="w-[22%] pt-[4cqw]"
              overall={card.overall}
              positionAbbr={positionAbbr}
            />
            <CardPhoto
              avatarUrl={avatarUrl ?? null}
              className="flex-1"
              cutoutUrl={cutoutUrl ?? null}
              name={card.shirtName}
            />
          </div>
          <CardNameplate className="mt-[2cqw]" name={card.shirtName} />
          <CardAttributes attributes={attributes} className="mt-[3cqw]" />
        </div>
      )}
    </article>
  );
}
