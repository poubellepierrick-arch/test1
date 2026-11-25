import { useEffect, useState } from 'react';
import { AI_TIMEOUT_MS } from '../utils/aiTimeoutConfig';

export function useElapsedWait(actif: boolean): number {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    if (!actif) {
      setElapsedMs(0);
      return;
    }
    const debut = Date.now();
    setElapsedMs(0);
    const id = window.setInterval(() => {
      setElapsedMs(Date.now() - debut);
    }, 1000);
    return () => window.clearInterval(id);
  }, [actif]);

  return elapsedMs;
}

export function creerRequeteIaController(
  parentSignal?: AbortSignal,
  timeoutMs: number = AI_TIMEOUT_MS + 10_000
) {
  const controller = new AbortController();
  let expire = false;
  let annule = false;

  const onParentAbort = () => {
    annule = true;
    controller.abort();
  };

  if (parentSignal) {
    if (parentSignal.aborted) {
      annule = true;
      controller.abort();
    } else {
      parentSignal.addEventListener('abort', onParentAbort, { once: true });
    }
  }

  const timer = window.setTimeout(() => {
    expire = true;
    controller.abort();
  }, timeoutMs);

  return {
    signal: controller.signal,
    abort: () => {
      annule = true;
      controller.abort();
    },
    estExpire: () => expire,
    estAnnule: () => annule,
    cleanup: () => {
      window.clearTimeout(timer);
      if (parentSignal) {
        parentSignal.removeEventListener('abort', onParentAbort);
      }
    },
  };
}
