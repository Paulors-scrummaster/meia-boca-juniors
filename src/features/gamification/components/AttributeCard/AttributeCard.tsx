// Feature 003 · US4 · T089a/T089b — orquestrador do cartão do atleta.
// `variant="detailed"` (perfil): o clube já mantém um cartão pronto (nota, posição,
// bandeira, nome, moldura, tudo) por atleta como a própria foto. A moldura em forma
// de escudo do app não combina com esse cartão retangular pronto — dá choque de
// forma (pontas do escudo cortando o retângulo) — então a variante detalhada não
// desenha moldura/fundo próprios, só uma borda simples ao redor da imagem inteira.
// `variant="compact"` (grades/listas) mantém moldura + fundo + selo de `overall` +
// nome + posição, que ali servem pra diferenciar jogadores numa grade pequena.
// O `overall` vem verbatim da query `athlete_card` — nunca recalculado no cliente.

import type { AthleteCard } from '../../api/gamification.service';
import { CardBackdrop } from './CardBackdrop';
import { CardFrame } from './CardFrame';
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

  return (
    <article
      className={`relative isolate select-none overflow-hidden text-secondary [container-type:inline-size] ${className}`}
      data-incomplete={isIncomplete ? 'true' : undefined}
      data-variant={variant}
      style={{ aspectRatio: CARD_ASPECT_RATIO }}
    >
      {variant === 'compact' ? (
        <>
          <CardBackdrop />
          <CardFrame variant={variant} />
          <div className="absolute inset-0 flex flex-col items-center px-[9cqw] pb-[7cqw] pt-[10cqw]">
            {isIncomplete ? null : (
              <span className="font-display absolute left-[9cqw] top-[8cqw] grid h-[20cqw] w-[20cqw] place-items-center rounded-full border border-secondary bg-elevated text-[10cqw] font-bold leading-none">
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
        </>
      ) : (
        <div className="absolute inset-0 rounded-[3cqw] border border-secondary/40 bg-card">
          <CardPhoto
            avatarUrl={avatarUrl ?? null}
            className="h-full w-full"
            cutoutUrl={cutoutUrl ?? null}
            fit="contain"
            name={card.shirtName}
          />
        </div>
      )}
    </article>
  );
}
