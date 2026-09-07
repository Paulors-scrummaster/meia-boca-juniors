import { ArrowRight, LockKeyhole, UsersRound } from 'lucide-react';
import { Link } from 'react-router-dom';

import { clubConfig } from '@/config/club.config';
import { HERO_LAYER_ALPHA } from '@/features/auth/pages/hero-backdrop.constants';

/**
 * Foto do hero (C-L1). Fotografia própria do clube (FR-033, não de terceiros) — a
 * torcida e os refletores, que na origem ficam do lado esquerdo do arquivo, são
 * espelhados (`-scale-x-100`) para caírem do lado **direito** da composição, onde o
 * véu de `HeroBackdrop` é mais fraco (região dos cards e da marca d'água, sem texto
 * de corpo) — sem o espelhamento, a parte "interessante" da foto ficaria escondida
 * atrás do véu forte que protege o texto à esquerda, e o lado fraco do véu revelaria
 * só a região vazia/lisa da foto.
 */
function HeroPhoto() {
  return (
    <img
      alt=""
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-0 left-1/2 -z-20 h-full w-screen max-w-none -translate-x-1/2 -scale-x-100 object-cover object-left select-none"
      src={clubConfig.assets.heroStadium}
    />
  );
}

/**
 * Véu do hero (C-L1, contracts/landing-composition.md). Fica por cima de
 * `HeroPhoto` e tem quatro camadas de `background-image`, todas com stops
 * derivados de tokens do tema (G-07):
 *   1. Um brilho radial dourado no canto superior esquerdo, simulando refletores.
 *   2. Um véu horizontal opaco o bastante para garantir o teto de luminância de
 *      FR-041/GL-16 sob a coluna de texto **mesmo no pior caso teórico** — pixel
 *      branco puro por trás da foto, não seu tom real (ver T090, que passa a
 *      compor as camadas sequencialmente contra branco por essa razão). Começa
 *      forte à esquerda, onde fica o texto, e afrouxa a partir de 60% da largura,
 *      onde só restam os cards (com fundo próprio) e a marca d'água do escudo —
 *      exatamente onde `HeroPhoto` concentra a torcida espelhada.
 *   3. Uma vinheta radial que escurece as bordas, concentrando a atenção no
 *      centro-esquerda onde fica o conteúdo.
 *   4. Uma textura de grão muito sutil (T027): pontilhado em opacidade quase nula.
 *
 * Posicionado full-bleed via o truque `left-1/2 w-screen -translate-x-1/2` para
 * cobrir a largura do viewport sem alterar a estrutura de `PublicLayout`.
 */
function HeroBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-0 left-1/2 -z-10 w-screen -translate-x-1/2"
      data-testid="hero-backdrop"
      style={{
        backgroundImage: [
          `radial-gradient(60rem 42rem at 22% 6%, hsl(var(--primary) / ${HERO_LAYER_ALPHA.goldGlow}), transparent 60%)`,
          `linear-gradient(90deg, hsl(var(--background) / ${HERO_LAYER_ALPHA.scrimStrong}) 0%, hsl(var(--background) / ${HERO_LAYER_ALPHA.scrimStrong}) 60%, hsl(var(--background) / ${HERO_LAYER_ALPHA.scrimWeak}) 100%)`,
          `radial-gradient(90rem 55rem at 50% 100%, transparent 45%, hsl(var(--overlay) / ${HERO_LAYER_ALPHA.vignette}) 100%)`,
          `repeating-radial-gradient(circle at 0 0, hsl(var(--foreground) / ${HERO_LAYER_ALPHA.grain}) 0, transparent 2px, transparent 4px)`,
        ].join(', '),
      }}
    />
  );
}

/**
 * Escudo em marca d'água (C-L2). Usa o brasão real em resolução maior
 * (`crestLarge`), grande e dominante na região à direita — como pede o contrato
 * ("Escala: Grande — dominante na região, como na referência") — parcialmente
 * sangrado na borda, com opacidade reduzida no elemento para não competir com o
 * conteúdo (GL-04). Fica atrás dos cards (z-index negativo) e fora da coluna de
 * texto à esquerda, então a opacidade mais alta não reduz nenhum contraste de
 * texto abaixo de 4,5:1. Decorativo: `aria-hidden` e `alt=""`, suprimido abaixo
 * de 768px (GL-15).
 */
function CrestWatermark() {
  return (
    <img
      alt=""
      aria-hidden="true"
      className="pointer-events-none absolute -right-24 top-1/2 -z-10 hidden w-[40rem] -translate-y-1/2 opacity-[0.16] select-none lg:block"
      src={clubConfig.assets.crestLarge}
    />
  );
}

/**
 * Faixa institucional (C-L7). Conteúdo exclusivamente derivado da configuração já
 * aprovada — nome do clube e slogan oficial — nunca texto novo (GL-13, SC-012).
 */
function InstitutionalFooter() {
  return (
    <footer className="relative mt-16 flex flex-col items-center gap-3 border-t border-border pt-6 text-xs font-semibold tracking-[0.3em] text-muted-foreground uppercase sm:flex-row sm:justify-between">
      <span className="font-black text-foreground">{clubConfig.identity.fullName}</span>
      <span aria-hidden="true" className="hidden h-px flex-1 bg-primary sm:block" />
      <span>{clubConfig.identity.slogan}</span>
    </footer>
  );
}

export function WelcomePage() {
  return (
    <div className="relative isolate">
      <HeroPhoto />
      <HeroBackdrop />

      <section className="relative grid min-h-[calc(100dvh-9rem)] items-center gap-8 py-8 lg:grid-cols-[1.35fr_0.65fr]">
        <CrestWatermark />

        <div className="relative">
          <img
            alt={`Escudo do ${clubConfig.identity.shortName}`}
            className="mb-7 h-24 w-24 drop-shadow-lg"
            src={clubConfig.assets.crest}
          />
          <p className="mb-3 text-sm font-black tracking-[0.22em] text-primary uppercase">
            {clubConfig.identity.shortName}
          </p>
          <h1 className="max-w-2xl text-4xl font-black tracking-tight sm:text-6xl">
            <span className="text-foreground">{clubConfig.institutional.welcomeTitleLead}</span>{' '}
            <span className="text-primary">{clubConfig.institutional.welcomeTitleHighlight}</span>
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
            {clubConfig.institutional.welcomeDescription}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-primary px-7 font-bold text-primary-foreground"
              to="/login"
            >
              Entrar no clube <ArrowRight aria-hidden="true" className="h-5 w-5" />
            </Link>
            <Link
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-primary bg-card px-7 font-bold"
              to="/convite"
            >
              Ativar convite
            </Link>
          </div>
        </div>

        <div className="relative grid gap-4" aria-label="Recursos de acesso">
          <article
            className="rounded-3xl border border-primary p-6 shadow-lg shadow-primary/5"
            style={{
              backgroundImage: 'linear-gradient(135deg, hsl(var(--elevated)), hsl(var(--card)))',
            }}
          >
            <UsersRound aria-hidden="true" className="h-8 w-8 text-primary" />
            <h2 className="mt-4 text-xl font-black">Um acesso, todos os seus papéis</h2>
            <p className="mt-2 text-muted-foreground">
              Atleta, Técnico e Presidente usam a mesma conta, com permissões somadas com segurança.
            </p>
          </article>
          <article
            className="rounded-3xl border border-primary p-6 shadow-lg"
            style={{
              backgroundImage: 'linear-gradient(160deg, hsl(var(--card)), hsl(var(--background)))',
            }}
          >
            <LockKeyhole aria-hidden="true" className="h-8 w-8 text-primary" />
            <h2 className="mt-4 text-xl font-black">Acesso somente por convite</h2>
            <p className="mt-2 text-muted-foreground">
              Sua identidade é confirmada antes de liberar qualquer informação privada do clube.
            </p>
          </article>
        </div>
      </section>

      <InstitutionalFooter />
    </div>
  );
}
