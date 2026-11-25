export const AI_TIMEOUT_MINUTES = 15;
export const AI_TIMEOUT_MS = AI_TIMEOUT_MINUTES * 60 * 1000; // 900 000 ms (15 minutes)
export const HTTP_SERVER_TIMEOUT_MS = AI_TIMEOUT_MS + 30 * 1000; // 930 000 ms
export const SSE_KEEPALIVE_INTERVAL_MS = 15 * 1000; // 15 secondes

export function formaterDureeAttente(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSec / 60);
  const secondes = totalSec % 60;
  return `${String(minutes).padStart(2, '0')}:${String(secondes).padStart(2, '0')}`;
}
