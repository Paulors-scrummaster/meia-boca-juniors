import { ArrowRight, LockKeyhole, UsersRound } from 'lucide-react';
import { Link } from 'react-router-dom';

import { clubConfig } from '@/config/club.config';

/**
 * Fundo do hero (C-L1, contracts/landing-composition.md).
 *
 * Três camadas de `background-image`, todas com stops derivados de tokens do tema
 * (G-07), nunca de fotografia de terceiros (FR-033):
 *   1. Um brilho radial dourado no canto superior esquerdo, simulando refletores.
 *      O pico de opacidade é 16% — abaixo do teto de 18% de FR-041/GL-16, que é o
 *      limite que mantém o contraste do texto calculável e acima de 4,5:1 no pior
 *      caso (ver T035 para a medição).
 *   2. Uma vinheta radial que escurece as bordas, concentrando a atenção no
 *      centro-esquerda onde fica o conteúdo.
 *   3. Uma textura de grão muito sutil (T027): pontilhado em opacidade quase nula.
 *      Preferida a um asset raster — sua contribuição à luminância é desprezível
 *      (< 0,001 mesmo sobreposta ao brilho), então não afeta o teto de FR-041.
 *
 * Posicionado full-bleed via o truque `left-1/2 w-screen -translate-x-1/2` para
 * cobrir a largura do viewport sem alterar a estrutura de `PublicLayout`.
 */
function HeroBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-0 left-1/2 -z-10 w-screen -translate-x-1/2"
      style={{
        backgroundColor: 'hsl(var(--background))',
        backgroundImage: [
          'radial-gradient(60rem 42rem at 22% 6%, hsl(var(--primary) / 0.16), transparent 60%)',
          'radial-gradient(90rem 55rem at 50% 100%, transparent 45%, hsl(var(--overlay) / 0.42) 100%)',
          'repeating-radial-gradient(circle at 0 0, hsl(var(--foreground) / 0.015) 0, transparent 2px, transparent 4px)',
        ].join(', '),
      }}
    />
  );
}

/**
 * Escudo em marca d'água (C-L2). Usa o brasão real em resolução maior
 * (`crestLarge`), grande e parcialmente sangrado na borda direita, com opacidade
 * reduzida no elemento para não competir com o conteúdo (GL-04). Decorativo:
 * `aria-hidden` e `alt=""`, suprimido abaixo de 768px (GL-15).
 */
function CrestWatermark() {
  return (
    <img
      alt=""
      aria-hidden="true"
      className="pointer-events-none absolute -right-16 top-1/2 hidden w-[26rem] -translate-y-1/2 opacity-[0.07] select-none lg:block"
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
