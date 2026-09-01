import { Bell, BellOff, Share2, Smartphone } from 'lucide-react';
import { useState } from 'react';

import {
  getBrowserPushPermission,
  requestBrowserPushPermission,
  type BrowserPushPermission,
} from '@/shared/adapters/push/onesignal-browser';

const DENIAL_PREFERENCE_KEY = 'mbj:push-permission-denied';

export interface PushPermissionAdapter {
  getPermission(): BrowserPushPermission;
  requestPermission(): Promise<BrowserPushPermission>;
}

export interface PushInstallContext {
  isIos: boolean;
  isStandalone: boolean;
}

interface PushPermissionCardProps {
  adapter?: PushPermissionAdapter;
  installContext?: PushInstallContext;
}

const browserAdapter: PushPermissionAdapter = {
  getPermission: getBrowserPushPermission,
  requestPermission: requestBrowserPushPermission,
};

function readInstallContext(): PushInstallContext {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') {
    return { isIos: false, isStandalone: false };
  }
  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
  const isIos =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return {
    isIos,
    isStandalone:
      navigatorWithStandalone.standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches,
  };
}

function initialPermission(adapter: PushPermissionAdapter): BrowserPushPermission {
  const browserPermission = adapter.getPermission();
  if (
    browserPermission === 'default' &&
    typeof window !== 'undefined' &&
    window.localStorage.getItem(DENIAL_PREFERENCE_KEY) === 'true'
  ) {
    return 'denied';
  }
  return browserPermission;
}

export function PushPermissionCard({
  adapter = browserAdapter,
  installContext = readInstallContext(),
}: PushPermissionCardProps) {
  const [permission, setPermission] = useState<BrowserPushPermission>(() =>
    initialPermission(adapter),
  );
  const [isRequesting, setIsRequesting] = useState(false);
  const [requestFailed, setRequestFailed] = useState(false);

  async function requestPermission() {
    setIsRequesting(true);
    setRequestFailed(false);
    try {
      const result = await adapter.requestPermission();
      setPermission(result);
      if (result === 'denied') window.localStorage.setItem(DENIAL_PREFERENCE_KEY, 'true');
      if (result === 'granted') window.localStorage.removeItem(DENIAL_PREFERENCE_KEY);
    } catch {
      setRequestFailed(true);
    } finally {
      setIsRequesting(false);
    }
  }

  if (installContext.isIos && !installContext.isStandalone) {
    return (
      <section className="rounded-3xl border bg-card p-6" aria-labelledby="ios-push-title">
        <Share2 aria-hidden="true" className="h-7 w-7 text-primary" />
        <h1 className="mt-3 text-2xl font-black" id="ios-push-title">
          Adicione à Tela de Início
        </h1>
        <p className="mt-3 text-muted-foreground">
          No iPhone ou iPad compatível, toque em Compartilhar, escolha “Adicionar à Tela de Início”
          e abra o aplicativo pelo novo ícone. Depois disso, volte aqui para ativar as notificações.
        </p>
      </section>
    );
  }

  if (permission === 'granted') {
    return (
      <section className="rounded-3xl border bg-card p-6" aria-labelledby="push-enabled-title">
        <Bell aria-hidden="true" className="h-7 w-7 text-primary" />
        <h1 className="mt-3 text-2xl font-black" id="push-enabled-title">
          Notificações ativadas
        </h1>
        <p className="mt-3 text-muted-foreground">Notificações ativadas neste dispositivo.</p>
      </section>
    );
  }

  const unavailable = permission === 'unsupported';
  const denied = permission === 'denied';

  return (
    <section className="rounded-3xl border bg-card p-6" aria-labelledby="push-permission-title">
      {unavailable || denied ? (
        <BellOff aria-hidden="true" className="h-7 w-7 text-primary" />
      ) : (
        <Smartphone aria-hidden="true" className="h-7 w-7 text-primary" />
      )}
      <h1 className="mt-3 text-2xl font-black" id="push-permission-title">
        {unavailable
          ? 'Notificações indisponíveis neste navegador'
          : denied
            ? 'Notificações recusadas'
            : 'Receba lembretes importantes'}
      </h1>
      <p className="mt-3 text-muted-foreground">
        {denied
          ? 'Você recusou as notificações neste dispositivo. Altere a permissão do site no navegador e tente novamente.'
          : unavailable
            ? 'Este ambiente não oferece push. Você pode continuar usando todos os recursos normalmente.'
            : 'Ative somente se quiser receber convocações, lembretes, escalações, votações e novos avisos.'}
      </p>
      <p className="mt-3 font-semibold">
        As pendências continuam disponíveis dentro do aplicativo, mesmo sem push.
      </p>
      {!unavailable ? (
        <button
          className="mt-5 inline-flex min-h-12 items-center justify-center rounded-xl bg-primary px-5 font-bold text-primary-foreground disabled:opacity-60"
          disabled={isRequesting}
          onClick={() => void requestPermission()}
          type="button"
        >
          {isRequesting
            ? 'Verificando…'
            : denied || requestFailed
              ? 'Tentar novamente'
              : 'Ativar notificações'}
        </button>
      ) : null}
      {requestFailed ? (
        <p className="mt-4 text-sm text-destructive" role="alert">
          Não foi possível ativar as notificações agora. O aplicativo continua funcionando; tente
          novamente mais tarde.
        </p>
      ) : null}
    </section>
  );
}
