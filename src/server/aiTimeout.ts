import { AI_TIMEOUT_MS } from '../utils/aiTimeoutConfig';

export { AI_TIMEOUT_MS };

export class AiTimeoutError extends Error {
  constructor(message = 'Le délai maximal de 15 minutes a été dépassé.') {
    super(message);
    this.name = 'AiTimeoutError';
  }
}

export class AiCancelledError extends Error {
  constructor(message = 'Requête annulée par le joueur.') {
    super(message);
    this.name = 'AbortError';
  }
}

export interface ManagedAiSignalContext {
  signal: AbortSignal;
  deadlineMs: number;
  timeoutMs: number;
  estExpire: () => boolean;
  estAnnuleParClient: () => boolean;
  cleanup: () => void;
}

export function creerContexteAppelIa(
  parentSignal?: AbortSignal,
  timeoutMs: number = AI_TIMEOUT_MS
): ManagedAiSignalContext {
  const controller = new AbortController();
  const debutMs = Date.now();
  const deadlineMs = debutMs + timeoutMs;
  let expire = false;
  let annuleClient = false;

  const onParentAbort = () => {
    annuleClient = true;
    controller.abort(new AiCancelledError());
  };

  if (parentSignal) {
    if (parentSignal.aborted) {
      annuleClient = true;
      controller.abort(new AiCancelledError());
    } else {
      parentSignal.addEventListener('abort', onParentAbort, { once: true });
    }
  }

  const timer = setTimeout(() => {
    expire = true;
    controller.abort(new AiTimeoutError());
  }, Math.max(1, timeoutMs));

  const cleanup = () => {
    clearTimeout(timer);
    if (parentSignal) {
      parentSignal.removeEventListener('abort', onParentAbort);
    }
  };

  return {
    signal: controller.signal,
    deadlineMs,
    timeoutMs,
    estExpire: () => expire || Date.now() >= deadlineMs,
    estAnnuleParClient: () => annuleClient,
    cleanup,
  };
}

export interface RetryInfo {
  tentative: number;
  attenteMs: number;
  raison: string;
}

export interface AppelerIaAvecRetryOptions {
  signal?: AbortSignal;
  deadlineMs?: number;
  timeoutMs?: number;
  maxDelaiBackoffMs?: number;
  onRetry?: (info: RetryInfo) => void;
}

export function estErreurQuotaJournalier(err: any): boolean {
  const msg = String(err?.message || err || '');
  return /PerDay|GenerateRequestsPerDay|FreeTier|requests per day/i.test(msg);
}

export function estErreurTransitoireIa(err: any): boolean {
  if (!err) return false;
  if (err.name === 'AbortError' || err instanceof AiTimeoutError || err instanceof AiCancelledError) {
    return false;
  }

  const msg = String(err?.message || err || '');
  const status = Number(err?.status ?? err?.code ?? 0);

  // Erreurs définitives à ne jamais réessayer inutilement
  if (estErreurQuotaJournalier(err)) return false;
  if (
    status === 400 ||
    status === 401 ||
    status === 403 ||
    status === 404 ||
    /API_KEY_INVALID|PERMISSION_DENIED|INVALID_ARGUMENT|API key/i.test(msg)
  ) {
    return false;
  }

  return (
    status === 408 ||
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    /503|429|502|504|500|UNAVAILABLE|RESOURCE_EXHAUSTED|DEADLINE_EXCEEDED|ECONNRESET|ETIMEDOUT|EAI_AGAIN|UND_ERR_CONNECT_TIMEOUT|fetch failed|network|overloaded|high demand|timeout|temporarily/i.test(
      msg
    )
  );
}

function extraireRaisonLisible(err: any): string {
  const msg = String(err?.message || '');
  const status = Number(err?.status ?? err?.code ?? 0);
  if (status === 429 || /429|RESOURCE_EXHAUSTED/i.test(msg)) {
    return 'limite momentanée de requêtes';
  }
  if (status === 503 || /503|UNAVAILABLE|overloaded|high demand/i.test(msg)) {
    return 'serveur IA temporairement saturé';
  }
  if (/ETIMEDOUT|DEADLINE_EXCEEDED|timeout/i.test(msg)) {
    return 'délai réseau intermédiaire';
  }
  return 'indisponibilité passagère du service IA';
}

function sleepAvecSignal(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  if (signal?.aborted) {
    return Promise.reject(signal.reason instanceof Error ? signal.reason : new AiCancelledError());
  }
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason instanceof Error ? signal.reason : new AiCancelledError());
    };
    const timer = setTimeout(() => {
      if (signal) signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    if (signal) {
      signal.addEventListener('abort', onAbort, { once: true });
    }
  });
}

export async function appelerIaAvecRetry<T>(
  operation: (ctx: { tentative: number; signal?: AbortSignal }) => Promise<T>,
  options: AppelerIaAvecRetryOptions = {}
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? AI_TIMEOUT_MS;
  const deadlineMs = options.deadlineMs ?? Date.now() + timeoutMs;
  const maxDelai = options.maxDelaiBackoffMs ?? 30_000;

  let tentative = 0;
  let derniereErreur: any;

  while (true) {
    if (options.signal?.aborted) {
      throw options.signal.reason instanceof Error ? options.signal.reason : new AiCancelledError();
    }
    if (Date.now() >= deadlineMs) {
      throw new AiTimeoutError();
    }

    try {
      return await operation({ tentative, signal: options.signal });
    } catch (err: any) {
      derniereErreur = err;

      if (options.signal?.aborted) {
        throw options.signal.reason instanceof Error ? options.signal.reason : err;
      }
      if (Date.now() >= deadlineMs) {
        throw new AiTimeoutError();
      }
      if (!estErreurTransitoireIa(err)) {
        throw err;
      }

      const backoffNominal = Math.min(maxDelai, 1000 * Math.pow(2, Math.min(tentative, 5)));
      const restantMs = deadlineMs - Date.now();
      if (restantMs <= 250) {
        throw new AiTimeoutError();
      }
      const attenteMs = Math.min(backoffNominal, Math.max(100, restantMs - 200));

      options.onRetry?.({
        tentative: tentative + 1,
        attenteMs,
        raison: extraireRaisonLisible(err),
      });

      tentative += 1;
      await sleepAvecSignal(attenteMs, options.signal);
    }
  }

  throw derniereErreur;
}
