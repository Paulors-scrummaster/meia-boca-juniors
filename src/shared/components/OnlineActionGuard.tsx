import { useId, type PropsWithChildren } from 'react';

import { useConnectivity } from '@/shared/hooks/use-connectivity';

interface OnlineActionGuardProps extends PropsWithChildren {
  explanation?: string;
}

export function OnlineActionGuard({
  children,
  explanation = 'Reconecte-se à internet para realizar esta ação.',
}: OnlineActionGuardProps) {
  const { isOnline } = useConnectivity();
  const explanationId = useId();

  return (
    <fieldset
      aria-describedby={!isOnline ? explanationId : undefined}
      aria-disabled={!isOnline}
      className="m-0 min-w-0 border-0 p-0"
      disabled={!isOnline}
    >
      <legend className="sr-only">Ação que requer conexão</legend>
      {children}
      {!isOnline ? (
        <p
          id={explanationId}
          className="mt-2 text-sm font-medium text-muted-foreground"
          role="status"
        >
          {explanation}
        </p>
      ) : null}
    </fieldset>
  );
}
