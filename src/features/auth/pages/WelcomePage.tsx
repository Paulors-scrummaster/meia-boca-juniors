import { ArrowRight, LockKeyhole, UsersRound } from 'lucide-react';
import { Link } from 'react-router-dom';

import { clubConfig } from '@/config/club.config';

export function WelcomePage() {
  return (
    <section className="grid min-h-[calc(100dvh-9rem)] items-center gap-8 py-8 lg:grid-cols-[1.2fr_0.8fr]">
      <div>
        <img
          alt={`Escudo do ${clubConfig.identity.shortName}`}
          className="mb-7 h-24 w-24 drop-shadow-lg"
          src={clubConfig.assets.logo}
        />
        <p className="mb-3 text-sm font-black uppercase tracking-[0.22em] text-primary">
          {clubConfig.identity.shortName}
        </p>
        <h1 className="max-w-2xl text-4xl font-black tracking-tight sm:text-6xl">
          {clubConfig.institutional.welcomeTitle}
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
          {clubConfig.institutional.welcomeDescription}
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 font-bold text-primary-foreground"
            to="/login"
          >
            Entrar no clube <ArrowRight aria-hidden="true" className="h-5 w-5" />
          </Link>
          <Link
            className="inline-flex min-h-12 items-center justify-center rounded-xl border bg-card px-6 font-bold"
            to="/convite"
          >
            Ativar convite
          </Link>
        </div>
      </div>

      <div className="grid gap-4" aria-label="Recursos de acesso">
        <article className="rounded-3xl border bg-card p-6 shadow-lg shadow-primary/5">
          <UsersRound aria-hidden="true" className="h-8 w-8 text-primary" />
          <h2 className="mt-4 text-xl font-black">Um acesso, todos os seus papéis</h2>
          <p className="mt-2 text-muted-foreground">
            Atleta, Técnico e Presidente usam a mesma conta, com permissões somadas com segurança.
          </p>
        </article>
        <article className="rounded-3xl border bg-primary p-6 text-primary-foreground shadow-lg">
          <LockKeyhole aria-hidden="true" className="h-8 w-8 text-secondary" />
          <h2 className="mt-4 text-xl font-black">Acesso somente por convite</h2>
          <p className="mt-2 text-primary-foreground/80">
            Sua identidade é confirmada antes de liberar qualquer informação privada do clube.
          </p>
        </article>
      </div>
    </section>
  );
}
