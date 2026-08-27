import { useSyncExternalStore } from 'react';

import { AppError } from '@/shared/lib/app-error';

export type ConnectivityReason = 'browser' | 'request' | null;

export interface ConnectivitySnapshot {
  browserOnline: boolean;
  isOnline: boolean;
  reason: ConnectivityReason;
  requestReachable: boolean | null;
}

type Listener = () => void;

const listeners = new Set<Listener>();

function browserIsOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}

function createSnapshot(requestReachable: boolean | null): ConnectivitySnapshot {
  const browserOnline = browserIsOnline();
  const reason: ConnectivityReason = !browserOnline
    ? 'browser'
    : requestReachable === false
      ? 'request'
      : null;

  return {
    browserOnline,
    isOnline: reason === null,
    reason,
    requestReachable,
  };
}

let snapshot = createSnapshot(null);

function emit(nextSnapshot: ConnectivitySnapshot) {
  snapshot = nextSnapshot;
  listeners.forEach((listener) => listener());
}

function handleBrowserStatus() {
  emit(createSnapshot(browserIsOnline() ? null : snapshot.requestReachable));
}

function subscribe(listener: Listener): () => void {
  if (listeners.size === 0 && typeof window !== 'undefined') {
    window.addEventListener('online', handleBrowserStatus);
    window.addEventListener('offline', handleBrowserStatus);
  }

  listeners.add(listener);

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== 'undefined') {
      window.removeEventListener('online', handleBrowserStatus);
      window.removeEventListener('offline', handleBrowserStatus);
    }
  };
}

export function isConnectivityFailure(error: unknown): boolean {
  if (error instanceof AppError) {
    return error.code === 'OFFLINE';
  }

  if (error instanceof TypeError) {
    return /fetch|network|connection/i.test(error.message);
  }

  if (typeof error === 'object' && error !== null && 'status' in error) {
    return error.status === 0;
  }

  return false;
}

export function reportRequestFailure(error: unknown): void {
  if (isConnectivityFailure(error)) {
    emit(createSnapshot(false));
  }
}

export function reportRequestSuccess(): void {
  emit(createSnapshot(true));
}

export function getConnectivitySnapshot(): ConnectivitySnapshot {
  return snapshot;
}

export function useConnectivity(): ConnectivitySnapshot {
  return useSyncExternalStore(subscribe, getConnectivitySnapshot, () => createSnapshot(null));
}

export function resetConnectivityForTests(): void {
  emit(createSnapshot(null));
}

export function setConnectivityForTests(isOnline: boolean): void {
  emit({
    browserOnline: isOnline,
    isOnline,
    reason: isOnline ? null : 'browser',
    requestReachable: isOnline ? true : null,
  });
}
