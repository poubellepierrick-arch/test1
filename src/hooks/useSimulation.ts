import { useState, useEffect, useCallback } from 'react';
import { SimulationState, NarrativeEvent } from '../types';
import { INITIAL_SIMULATION_STATE } from '../engine/initialData';
import { ActionRequest } from '../engine/adjudication';

const AUTH_STORAGE_KEY = 'dnd_session_auth';

export interface AuthSession {
  playerId: string;
  nomAventurier: string;
}

export function useSimulation() {
  const [etat, setEtat] = useState<SimulationState>(INITIAL_SIMULATION_STATE);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [authSession, setAuthSession] = useState<AuthSession>(() => {
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch {
      // Ignorer
    }
    return { playerId: 'player_01', nomAventurier: 'Eldrin' };
  });

  const enregistrerAuth = (session: AuthSession) => {
    setAuthSession(session);
    try {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
    } catch {
      // Ignorer
    }
  };

  const chargerEtat = useCallback(async () => {
    try {
      const res = await fetch('/api/simulation/state');
      if (res.ok) {
        const data: SimulationState = await res.json();
        setEtat(data);
      }
    } catch (err: any) {
      setErreur(err.message || 'Erreur de connexion');
    }
  }, []);

  useEffect(() => {
    chargerEtat();
  }, [chargerEtat]);

  // Connexion Server-Sent Events (SSE) avec déduplication de séquence _seq
  useEffect(() => {
    const eventSource = new EventSource(`/api/narration/stream?since_seq=${etat._seq}`);

    eventSource.addEventListener('narration_event', (event: MessageEvent) => {
      try {
        const nouveauMsg: NarrativeEvent = JSON.parse(event.data);
        setEtat(prev => {
          if (prev.journalNarratif.some(e => e._seq === nouveauMsg._seq)) {
            return prev;
          }
          return {
            ...prev,
            _seq: Math.max(prev._seq, nouveauMsg._seq),
            journalNarratif: [...prev.journalNarratif, nouveauMsg],
          };
        });
      } catch (err) {
        console.error('Erreur décodage SSE:', err);
      }
    });

    return () => {
      eventSource.close();
    };
  }, [etat._seq]);

  const executerAction = async (action: ActionRequest) => {
    setChargement(true);
    setErreur(null);
    try {
      const res = await fetch('/api/simulation/act', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action),
      });
      const data = await res.json();
      if (!data.succes) {
        throw new Error(data.erreur || 'Échec de l\'action');
      }
      setEtat(data.etat);
    } catch (err: any) {
      setErreur(err.message);
    } finally {
      setChargement(false);
    }
  };

  const forcerWorldTick = async () => {
    setChargement(true);
    try {
      const res = await fetch('/api/simulation/tick', { method: 'POST' });
      const data = await res.json();
      if (data.succes) {
        setEtat(data.etat);
      }
    } catch (err: any) {
      setErreur(err.message);
    } finally {
      setChargement(false);
    }
  };

  const reinitialiserPartie = async () => {
    setChargement(true);
    try {
      const res = await fetch('/api/simulation/reset', { method: 'POST' });
      const data = await res.json();
      if (data.succes) {
        setEtat(data.etat);
      }
    } catch (err: any) {
      setErreur(err.message);
    } finally {
      setChargement(false);
    }
  };

  return {
    etat,
    chargement,
    erreur,
    authSession,
    enregistrerAuth,
    executerAction,
    forcerWorldTick,
    reinitialiserPartie,
  };
}
