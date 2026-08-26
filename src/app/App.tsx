import type { PropsWithChildren } from 'react';

import { clubConfig } from '@/config/club.config';

function AppProviders({ children }: PropsWithChildren) {
  return children;
}

export function App() {
  return (
    <AppProviders>
      <main className="min-h-dvh bg-background px-5 py-10 text-foreground">
        <section className="mx-auto flex min-h-[calc(100dvh-5rem)] max-w-3xl items-center">
          <div className="w-full rounded-3xl border bg-card p-8 shadow-xl shadow-primary/10 sm:p-12">
            <img
              className="mb-8 h-24 w-24"
              src={clubConfig.assets.logo}
              alt={`Escudo do ${clubConfig.identity.shortName}`}
            />
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-primary">
              {clubConfig.identity.shortName}
            </p>
            <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
              {clubConfig.institutional.welcomeTitle}
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
              {clubConfig.institutional.welcomeDescription}
            </p>
            <p className="mt-8 inline-flex rounded-full bg-secondary px-4 py-2 text-sm font-bold text-secondary-foreground">
              Base do aplicativo pronta para evoluir com segurança.
            </p>
          </div>
        </section>
      </main>
    </AppProviders>
  );
}
