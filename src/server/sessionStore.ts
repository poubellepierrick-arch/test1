import { creerEtatInitialAzgaar } from '../engine/azgaarVoronoi';
import { SimulationState } from '../types';

export interface SessionRecord {
  state: SimulationState;
  lastAccessedAt: number;
}

const DEFAULT_SESSION_ID = 'default';
const MAX_SESSIONS = 200;
const SESSION_TTL_MS = 6 * 60 * 60 * 1000;

export class SessionStore {
  private sessions = new Map<string, SessionRecord>();

  normaliserId(rawId?: string | string[] | null): string {
    const val = Array.isArray(rawId) ? rawId[0] : rawId;
    if (!val || typeof val !== 'string') return DEFAULT_SESSION_ID;
    const cleaned = val.trim().replace(/[^a-zA-Z0-9_.-]/g, '').slice(0, 80);
    return cleaned || DEFAULT_SESSION_ID;
  }

  private nettoyer(maintenant = Date.now()): void {
    for (const [id, rec] of this.sessions.entries()) {
      if (id !== DEFAULT_SESSION_ID && maintenant - rec.lastAccessedAt > SESSION_TTL_MS) {
        this.sessions.delete(id);
      }
    }
    if (this.sessions.size > MAX_SESSIONS) {
      const entries = Array.from(this.sessions.entries())
        .filter(([id]) => id !== DEFAULT_SESSION_ID)
        .sort((a, b) => a[1].lastAccessedAt - b[1].lastAccessedAt);
      const aSupprimer = this.sessions.size - MAX_SESSIONS;
      for (let i = 0; i < aSupprimer && i < entries.length; i++) {
        this.sessions.delete(entries[i][0]);
      }
    }
  }

  getState(rawSessionId?: string | string[] | null): SimulationState {
    const id = this.normaliserId(rawSessionId);
    const maintenant = Date.now();
    this.nettoyer(maintenant);

    let rec = this.sessions.get(id);
    if (!rec) {
      rec = {
        state: creerEtatInitialAzgaar(),
        lastAccessedAt: maintenant,
      };
      this.sessions.set(id, rec);
    } else {
      rec.lastAccessedAt = maintenant;
    }
    return rec.state;
  }

  setState(rawSessionId: string | string[] | null | undefined, newState: SimulationState): SimulationState {
    const id = this.normaliserId(rawSessionId);
    const maintenant = Date.now();
    this.sessions.set(id, {
      state: newState,
      lastAccessedAt: maintenant,
    });
    this.nettoyer(maintenant);
    return newState;
  }

  resetState(rawSessionId?: string | string[] | null): SimulationState {
    const id = this.normaliserId(rawSessionId);
    const fresh: SimulationState = creerEtatInitialAzgaar();
    fresh._seq = 1;
    this.sessions.set(id, {
      state: fresh,
      lastAccessedAt: Date.now(),
    });
    return fresh;
  }

  count(): number {
    return this.sessions.size;
  }
}

export const globalSessionStore = new SessionStore();
