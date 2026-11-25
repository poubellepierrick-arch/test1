import { useState, useEffect, useCallback, useRef } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User as FirebaseUser } from 'firebase/auth';
import {
  SimulationState,
  NarrativeEvent,
  AdjudicationPayload,
  AzgaarReliefPreset,
  AzgaarClimateBias,
  AzgaarTemplateId,
  AzgaarStylePreset,
  AzgaarWorldState,
  WorldForgeConfig,
  WorldForgeDraft,
  WorldForgeStep,
} from '../types';
import { creerEtatInitialAzgaar } from '../engine/azgaarVoronoi';
import { ActionRequest } from '../engine/adjudication';
import { MjWorldCommand } from '../engine/mjWorldEngine';
import { formaterTitreEnCours, formaterActionJoueur } from '../utils/journalFormatting';
import { auth, googleProvider } from '../firebase/config';
import {
  BACKUP_SYNC_INTERVAL_TURNS,
  DualSaveStatus,
  loadDualSaves,
  restoreBackupIntoPrimary,
  saveToBackupMirror,
  saveToPrimary,
} from '../firebase/saveService';
import { AI_TIMEOUT_MS } from '../utils/aiTimeoutConfig';
import { creerRequeteIaController } from './useElapsedWait';

const AUTH_STORAGE_KEY = 'dnd_session_auth';

export interface AuthSession {
  playerId: string;
  nomAventurier: string;
  sessionId?: string;
}

export interface StreamingNarration {
  titre: string;
  actionJoueur?: string;
  texte: string;
  adjudication?: AdjudicationPayload;
}

function genererSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `sess_${crypto.randomUUID()}`;
  }
  return `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

async function hydraterServeur(etat: SimulationState, sessionId: string): Promise<void> {
  await fetch('/api/simulation/hydrate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Session-Id': sessionId },
    body: JSON.stringify({ etat }),
  });
}

export function useSimulation() {
  const [etat, setEtat] = useState<SimulationState>(() => creerEtatInitialAzgaar());
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [avisAnnulation, setAvisAnnulation] = useState<string | null>(null);
  const [infoRetry, setInfoRetry] = useState<string | null>(null);
  const [narrationEnCours, setNarrationEnCours] = useState<StreamingNarration | null>(null);
  const [resetVersion, setResetVersion] = useState(0);
  const [authSession, setAuthSession] = useState<AuthSession>(() => {
    const newId = genererSessionId();
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as AuthSession;
        if (parsed.sessionId) return parsed;
        const avecId = { ...parsed, sessionId: newId };
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(avecId));
        return avecId;
      }
    } catch {
      // Ignorer
    }
    const init = { playerId: 'player_01', nomAventurier: 'Eldrin', sessionId: newId };
    try {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(init));
    } catch {
      // Ignorer
    }
    return init;
  });
  const sessionId = authSession.sessionId || 'sess_default';

  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [statutSauvegarde, setStatutSauvegarde] = useState<DualSaveStatus | null>(null);
  const [syncEnCours, setSyncEnCours] = useState(false);
  const [messageSync, setMessageSync] = useState<string | null>(null);

  const etatCourantRef = useRef<SimulationState>(etat);
  etatCourantRef.current = etat;
  const authSessionRef = useRef<AuthSession>(authSession);
  authSessionRef.current = authSession;
  const ouvertureEnCoursRef = useRef(false);
  const ouvertureInitialeTenteRef = useRef(false);
  const derniereActionEchoueeRef = useRef<ActionRequest | null>(null);
  const actionControllerRef = useRef<ReturnType<typeof creerRequeteIaController> | null>(null);
  const executerActionRef = useRef<(action: ActionRequest) => Promise<void>>(async () => {});

  const enregistrerAuth = (session: AuthSession) => {
    const complet = { ...session, sessionId: session.sessionId || sessionId };
    setAuthSession(complet);
    try {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(complet));
    } catch {
      // Ignorer
    }
  };

  const chargerEtat = useCallback(async () => {
    try {
      const res = await fetch('/api/simulation/state', {
        headers: { 'X-Session-Id': sessionId },
      });
      if (res.ok) {
        const data: SimulationState = await res.json();
        setEtat(data);
        etatCourantRef.current = data;
        if (data.journalNarratif.length === 0 && !ouvertureInitialeTenteRef.current) {
          ouvertureInitialeTenteRef.current = true;
          await executerActionRef.current({ type: 'OUVERTURE_CAMPAGNE' });
        }
      }
    } catch (err: any) {
      setErreur(err.message || 'Erreur de connexion');
    }
  }, [sessionId]);

  useEffect(() => {
    chargerEtat();
  }, [chargerEtat]);

  const synchroniserVersFirebase = useCallback(
    async (user: FirebaseUser | null, nouvelEtat: SimulationState, forcerSecours = false) => {
      if (!user) return;
      try {
        setSyncEnCours(true);
        const primarySeq = await saveToPrimary(user.uid, nouvelEtat);
        const doitMiroir =
          forcerSecours || nouvelEtat._seq % BACKUP_SYNC_INTERVAL_TURNS === 0;

        let backupSeq = statutSauvegarde?.backupSeq ?? null;
        let backupAvailable = statutSauvegarde?.backupAvailable ?? false;

        if (doitMiroir) {
          backupSeq = await saveToBackupMirror(
            user.uid,
            nouvelEtat,
            user.displayName || authSessionRef.current.nomAventurier
          );
          backupAvailable = true;
          if (forcerSecours) {
            setMessageSync(`Copie de secours enregistrée (#${backupSeq}).`);
          }
        }

        setStatutSauvegarde(prev => ({
          primaryHealthy: true,
          backupAvailable,
          backupSeq,
          primarySeq,
          restoredFromBackup: prev?.restoredFromBackup ?? false,
        }));
      } catch (err: any) {
        setErreur(err?.message || 'Erreur sauvegarde Firebase.');
      } finally {
        setSyncEnCours(false);
      }
    },
    [statutSauvegarde?.backupAvailable, statutSauvegarde?.backupSeq]
  );

  // Écoute Firebase Auth + chargement double base avec détection de corruption
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async user => {
      setFirebaseUser(user);
      if (!user) {
        setStatutSauvegarde(null);
        return;
      }

      setSyncEnCours(true);
      try {
        const result = await loadDualSaves(user.uid);
        setStatutSauvegarde(result.status);

        if (result.stateToLoad) {
          await hydraterServeur(result.stateToLoad, sessionId);
          setEtat(result.stateToLoad);
          etatCourantRef.current = result.stateToLoad;
          if (result.stateToLoad.journalNarratif.length === 0 && !ouvertureInitialeTenteRef.current) {
            ouvertureInitialeTenteRef.current = true;
            await executerActionRef.current({ type: 'OUVERTURE_CAMPAGNE' });
          }
        } else {
          const initial = etatCourantRef.current;
          const pSeq = await saveToPrimary(user.uid, initial);
          const bSeq = await saveToBackupMirror(
            user.uid,
            initial,
            user.displayName || authSessionRef.current.nomAventurier
          );
          setStatutSauvegarde({
            primaryHealthy: true,
            backupAvailable: true,
            primarySeq: pSeq,
            backupSeq: bSeq,
            restoredFromBackup: false,
          });
        }
      } catch (err: any) {
        setErreur(err?.message || 'Erreur chargement Firebase.');
      } finally {
        setSyncEnCours(false);
      }
    });

    return () => unsub();
  }, []);

  const connexionGoogle = async () => {
    setErreur(null);
    setSyncEnCours(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      setErreur(err?.message || 'Connexion Google annulée ou bloquée.');
    } finally {
      setSyncEnCours(false);
    }
  };

  const deconnexionGoogle = async () => {
    await signOut(auth);
    setMessageSync(null);
  };

  const copierVersSecours = async () => {
    if (!firebaseUser) return;
    await synchroniserVersFirebase(firebaseUser, etatCourantRef.current, true);
  };

  const restaurerDepuisSecours = async () => {
    if (!firebaseUser) return;
    setSyncEnCours(true);
    setErreur(null);
    try {
      const { restoredState, seq } = await restoreBackupIntoPrimary(firebaseUser.uid);
      if (restoredState) {
        await hydraterServeur(restoredState, sessionId);
        setEtat(restoredState);
        setStatutSauvegarde({
          primaryHealthy: true,
          backupAvailable: true,
          primarySeq: seq,
          backupSeq: seq,
          restoredFromBackup: false,
        });
        setMessageSync(`Base principale restaurée depuis le secours (#${seq}).`);
      }
    } catch (err: any) {
      setErreur(err?.message || 'Restauration impossible.');
    } finally {
      setSyncEnCours(false);
    }
  };

  // Connexion Server-Sent Events (SSE) avec déduplication de séquence _seq
  useEffect(() => {
    const eventSource = new EventSource(
      `/api/narration/stream?since_seq=${etat._seq}&sessionId=${encodeURIComponent(sessionId)}`
    );

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
  }, [etat._seq, sessionId]);

  const annulerActionEnCours = useCallback(() => {
    if (actionControllerRef.current) {
      actionControllerRef.current.abort();
    }
  }, []);

  const executerAction = async (action: ActionRequest) => {
    if (action.type === 'OUVERTURE_CAMPAGNE') {
      if (ouvertureEnCoursRef.current) return;
      ouvertureInitialeTenteRef.current = true;
      ouvertureEnCoursRef.current = true;
    }
    const etatAvantAction = etatCourantRef.current;
    const estConfigInstantanee =
      action.type === 'CONFIGURER_MODELE_IA' || action.type === 'CONFIGURER_NARRATION';
    if (!estConfigInstantanee) {
      derniereActionEchoueeRef.current = null;
    }

    const reqCtrl = creerRequeteIaController(undefined, AI_TIMEOUT_MS + 10_000);
    if (!estConfigInstantanee) {
      actionControllerRef.current = reqCtrl;
    }

    setChargement(true);
    setErreur(null);
    setAvisAnnulation(null);
    setInfoRetry(null);
    if (!estConfigInstantanee) {
      setNarrationEnCours({
        titre: formaterTitreEnCours(action),
        actionJoueur: formaterActionJoueur(action),
        texte: '',
      });
    }

    try {
      const res = await fetch('/api/simulation/act/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Session-Id': sessionId },
        body: JSON.stringify(action),
        signal: reqCtrl.signal,
      });

      const contentType = res.headers.get('content-type') || '';
      if (!res.body || !contentType.includes('text/event-stream')) {
        const fallbackRes = await fetch('/api/simulation/act', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Session-Id': sessionId },
          body: JSON.stringify(action),
          signal: reqCtrl.signal,
        });
        const data = await fallbackRes.json();
        if (!fallbackRes.ok || !data.succes) throw new Error(data.erreur || 'Échec de l\'action');
        setEtat(data.etat);
        setNarrationEnCours(null);
        await synchroniserVersFirebase(firebaseUser, data.etat);
        if (
          (action.type === 'DEPLACER_HEX' || action.type === 'AJOUTER_QUETE') &&
          data.etat?.pnjsMonde?.some((p: any) => p.enrichmentPending)
        ) {
          void promouvoirPnjsProches(undefined, true);
        }
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let streamTermine = false;
      let etatFinalStream: SimulationState | null = null;

      const traiterBlocSSE = (bloc: string) => {
        const lignes = bloc.split('\n');
        let eventName = 'message';
        const dataLines: string[] = [];

        for (const ligne of lignes) {
          if (ligne.startsWith('event:')) {
            eventName = ligne.slice(6).trim();
          } else if (ligne.startsWith('data:')) {
            dataLines.push(ligne.slice(5).trimStart());
          }
        }

        if (dataLines.length === 0) return;
        const payloadStr = dataLines.join('\n');
        const payload = JSON.parse(payloadStr);

        if (eventName === 'status_retry') {
          const sec = Math.max(1, Math.round(Number(payload.attenteMs || 1000) / 1000));
          setInfoRetry(
            `Nouvelle tentative automatique (#${payload.tentative || 1}) dans ${sec}s — ${payload.raison || 'service temporairement indisponible'}.`
          );
        } else if (eventName === 'adjudication_event') {
          setInfoRetry(null);
          setNarrationEnCours(prev =>
            prev ? { ...prev, adjudication: payload.adjudication } : prev
          );
          setEtat(prev => ({
            ...prev,
            personnage: payload.personnage || prev.personnage,
            horloge: payload.horloge || prev.horloge,
            hexActuel: payload.hexActuel || prev.hexActuel,
            combat: payload.combat || prev.combat,
            donjon: payload.donjon !== undefined ? payload.donjon : prev.donjon,
            modeNarration: payload.modeNarration || prev.modeNarration,
            profilHydrogen: payload.profilHydrogen || prev.profilHydrogen,
            jetEnAttente: payload.jetEnAttente !== undefined ? (payload.jetEnAttente || undefined) : prev.jetEnAttente,
          }));
        } else if (eventName === 'narration_chunk') {
          setInfoRetry(null);
          setNarrationEnCours(prev =>
            prev ? { ...prev, texte: prev.texte + (payload.text || '') } : prev
          );
        } else if (eventName === 'narration_done') {
          streamTermine = true;
          setInfoRetry(null);
          if (payload.etat) {
            etatFinalStream = payload.etat;
            setEtat(payload.etat);
          }
          setNarrationEnCours(null);
        } else if (eventName === 'narration_error') {
          throw new Error(payload.erreur || 'Échec de l\'action');
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let sepIndex: number;
        while ((sepIndex = buffer.indexOf('\n\n')) !== -1) {
          const bloc = buffer.slice(0, sepIndex).trim();
          buffer = buffer.slice(sepIndex + 2);
          if (bloc) traiterBlocSSE(bloc);
        }
      }

      if (buffer.trim()) {
        traiterBlocSSE(buffer.trim());
      }

      if (!streamTermine) {
        setEtat(etatAvantAction);
        await chargerEtat();
        throw new Error('Le MJ IA a interrompu sa réponse. Le tour est annulé.');
      } else if (etatFinalStream) {
        await synchroniserVersFirebase(firebaseUser, etatFinalStream);
        if (
          (action.type === 'DEPLACER_HEX' || action.type === 'AJOUTER_QUETE') &&
          (etatFinalStream as SimulationState).pnjsMonde?.some(p => p.enrichmentPending)
        ) {
          void promouvoirPnjsProches(undefined, true);
        }
      }
    } catch (err: any) {
      setEtat(etatAvantAction);
      setNarrationEnCours(null);
      if (!estConfigInstantanee) {
        derniereActionEchoueeRef.current = action;
      }
      if (reqCtrl.estAnnule()) {
        setAvisAnnulation('Requête annulée par le joueur. L’état précédent a été conservé.');
      } else if (reqCtrl.estExpire()) {
        setErreur('Le MJ IA n\'a pas répondu dans le délai maximal de 15 minutes. Le tour est annulé.');
      } else if (err?.name === 'AbortError') {
        setAvisAnnulation('Requête annulée. L’état précédent a été conservé.');
      } else {
        setErreur(err.message || 'Erreur lors de l\'action');
      }
    } finally {
      reqCtrl.cleanup();
      if (actionControllerRef.current === reqCtrl) {
        actionControllerRef.current = null;
      }
      setInfoRetry(null);
      if (action.type === 'OUVERTURE_CAMPAGNE') {
        ouvertureEnCoursRef.current = false;
      }
      setChargement(false);
    }
  };
  executerActionRef.current = executerAction;

  const avancerTempsAdmin = async (heures: number, avecSupervisionIa = false) => {
    const reqCtrl = creerRequeteIaController(undefined, AI_TIMEOUT_MS + 10_000);
    actionControllerRef.current = reqCtrl;
    setChargement(true);
    setErreur(null);
    setAvisAnnulation(null);
    setInfoRetry(null);
    try {
      const res = await fetch('/api/simulation/tick', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Id': sessionId,
        },
        body: JSON.stringify({ heures, avecSupervisionIa }),
        signal: reqCtrl.signal,
      });
      const data = await res.json();
      if (!res.ok || !data.succes) {
        throw new Error(data.erreur || 'Échec de l\'avancement temporel.');
      }
      setEtat(data.etat);
      await synchroniserVersFirebase(firebaseUser, data.etat);
    } catch (err: any) {
      if (reqCtrl.estAnnule() || err?.name === 'AbortError') {
        setAvisAnnulation('Avancement temporel annulé.');
      } else if (reqCtrl.estExpire()) {
        setErreur('La supervision IA a dépassé le délai maximal de 15 minutes.');
      } else {
        setErreur(err?.message || 'Erreur lors de l\'avancement temporel.');
      }
    } finally {
      reqCtrl.cleanup();
      if (actionControllerRef.current === reqCtrl) {
        actionControllerRef.current = null;
      }
      setChargement(false);
    }
  };

  const forcerWorldTick = async (ticks: number = 1) => {
    await avancerTempsAdmin(Math.max(1, Math.trunc(ticks)) * 24, false);
  };

  const reinitialiserPartie = async () => {
    setChargement(true);
    setErreur(null);
    setNarrationEnCours(null);
    try {
      const res = await fetch('/api/simulation/reset', {
        method: 'POST',
        headers: { 'X-Session-Id': sessionId },
      });
      const data = await res.json();
      if (!res.ok || !data.succes) {
        throw new Error(data.erreur || 'Réinitialisation impossible.');
      }
      setEtat(data.etat);
      etatCourantRef.current = data.etat;
      setResetVersion(v => v + 1);
      await executerActionRef.current({ type: 'OUVERTURE_CAMPAGNE' });
      await synchroniserVersFirebase(firebaseUser, etatCourantRef.current, true);
    } catch (err: any) {
      setErreur(err?.message || 'Réinitialisation impossible.');
    } finally {
      setChargement(false);
    }
  };

  const analyserImportHeros = async (
    rawText: string,
    files: Array<{ nom: string; contenu: string }>,
    signal?: AbortSignal
  ): Promise<{ hero: any; sourceMode: string }> => {
    const reqCtrl = creerRequeteIaController(signal, AI_TIMEOUT_MS + 10_000);
    try {
      const res = await fetch('/api/character/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Session-Id': sessionId },
        body: JSON.stringify({ rawText, files }),
        signal: reqCtrl.signal,
      });
      const data = await res.json();
      if (!res.ok || !data.succes) {
        throw new Error(data.erreur || 'Analyse impossible.');
      }
      return { hero: data.hero, sourceMode: data.sourceMode };
    } catch (err: any) {
      if (reqCtrl.estAnnule() || err?.name === 'AbortError') {
        const cancelErr = new Error('Analyse annulée par le joueur.');
        cancelErr.name = 'AbortError';
        throw cancelErr;
      }
      if (reqCtrl.estExpire()) {
        throw new Error('L\'analyse IA de la fiche a dépassé le délai maximal de 15 minutes.');
      }
      throw err;
    } finally {
      reqCtrl.cleanup();
    }
  };

  const genererMonde = async (config: {
    seed: number;
    modeleRelief?: AzgaarReliefPreset;
    template?: AzgaarTemplateId;
    climatBias?: AzgaarClimateBias;
    climateBias?: AzgaarClimateBias;
    rayonAnneaux?: number;
    cellsDesired?: 800 | 1500 | 2400;
    windAngle?: number;
    nomMonde?: string;
    worldName?: string;
    stylePreset?: AzgaarStylePreset;
    statesCount?: number;
    culturesCount?: number;
    religionsCount?: number;
    burgsCount?: number;
    conserverHeros?: boolean;
  }) => {
    setChargement(true);
    setErreur(null);
    setNarrationEnCours(null);
    try {
      const res = await fetch('/api/world/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Session-Id': sessionId },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (!res.ok || !data.succes) {
        throw new Error(data.erreur || 'Génération du monde impossible.');
      }
      setEtat(data.etat);
      etatCourantRef.current = data.etat;
      setResetVersion(v => v + 1);
      await executerActionRef.current({ type: 'OUVERTURE_CAMPAGNE' });
      await synchroniserVersFirebase(firebaseUser, etatCourantRef.current, true);
    } catch (err: any) {
      setErreur(err?.message || 'Génération du monde impossible.');
    } finally {
      setChargement(false);
    }
  };

  const synchroniserAzgaar = async (studio: AzgaarWorldState) => {
    setErreur(null);
    try {
      const res = await fetch('/api/azgaar/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Session-Id': sessionId },
        body: JSON.stringify({ studio }),
      });
      const data = await res.json();
      if (!res.ok || !data.succes) {
        throw new Error(data.erreur || 'Synchronisation Azgaar impossible.');
      }
      setEtat(data.etat);
      await synchroniserVersFirebase(firebaseUser, data.etat);
    } catch (err: any) {
      setErreur(err?.message || 'Synchronisation Azgaar impossible.');
    }
  };

  const importerCarteAzgaar = async (rawText: string) => {
    setChargement(true);
    setErreur(null);
    try {
      const res = await fetch('/api/azgaar/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Session-Id': sessionId },
        body: JSON.stringify({ rawText }),
      });
      const data = await res.json();
      if (!res.ok || !data.succes) {
        throw new Error(data.erreur || 'Import Azgaar impossible.');
      }
      setEtat(data.etat);
      etatCourantRef.current = data.etat;
      setResetVersion(v => v + 1);
      await executerActionRef.current({ type: 'OUVERTURE_CAMPAGNE' });
      await synchroniserVersFirebase(firebaseUser, etatCourantRef.current, true);
    } catch (err: any) {
      setErreur(err?.message || 'Import Azgaar impossible.');
    } finally {
      setChargement(false);
    }
  };

  const executerActionMJMonde = async (commande: MjWorldCommand) => {
    setErreur(null);
    try {
      const res = await fetch('/api/world/mj', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Session-Id': sessionId },
        body: JSON.stringify(commande),
      });
      const data = await res.json();
      if (!res.ok || !data.succes) {
        throw new Error(data.erreur || 'Action MJ impossible.');
      }
      setEtat(data.etat);
      await synchroniserVersFirebase(firebaseUser, data.etat);
    } catch (err: any) {
      setErreur(err?.message || 'Action MJ impossible.');
    }
  };

  const promouvoirPnjsProches = useCallback(
    async (npcIds?: string[], silencieux = false) => {
      if (!silencieux) setErreur(null);
      try {
        const res = await fetch('/api/world/npcs/promote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Session-Id': sessionId },
          body: JSON.stringify({ npcIds }),
        });
        const data = await res.json();
        if (!res.ok || !data.succes) {
          if (!silencieux) throw new Error(data.erreur || 'Enrichissement PNJ impossible.');
          return;
        }
        setEtat(data.etat);
        etatCourantRef.current = data.etat;
        await synchroniserVersFirebase(firebaseUser, data.etat);
      } catch (err: any) {
        if (!silencieux) {
          setErreur(err?.message || 'Enrichissement PNJ impossible.');
        }
      }
    },
    [sessionId, firebaseUser, synchroniserVersFirebase]
  );

  const initialiserForgeMonde = useCallback(
    async (config?: Partial<WorldForgeConfig>): Promise<WorldForgeDraft> => {
      const res = await fetch('/api/world/forge/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Session-Id': sessionId },
        body: JSON.stringify({ config }),
      });
      const data = await res.json();
      if (!res.ok || !data.succes) {
        throw new Error(data.erreur || 'Initialisation de la forge impossible.');
      }
      return data.draft as WorldForgeDraft;
    },
    [sessionId]
  );

  const executerEtapeForgeMonde = useCallback(
    async (
      draft: WorldForgeDraft,
      step: WorldForgeStep,
      options?: { regenererGeometrie?: boolean; signal?: AbortSignal }
    ): Promise<{ draft: WorldForgeDraft; source: 'GEMINI' | 'PROCEDURAL'; note?: string }> => {
      const reqCtrl = creerRequeteIaController(options?.signal, AI_TIMEOUT_MS + 10_000);
      try {
        const res = await fetch('/api/world/forge/step', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Session-Id': sessionId },
          body: JSON.stringify({
            draft,
            step,
            regenererGeometrie: Boolean(options?.regenererGeometrie),
          }),
          signal: reqCtrl.signal,
        });
        const data = await res.json();
        if (!res.ok || !data.succes) {
          throw new Error(data.erreur || 'Génération de l’étape impossible.');
        }
        return { draft: data.draft, source: data.source, note: data.note };
      } catch (err: any) {
        if (reqCtrl.estAnnule() || err?.name === 'AbortError') {
          const cancelErr = new Error('Étape de forge annulée.');
          cancelErr.name = 'AbortError';
          throw cancelErr;
        }
        throw err;
      } finally {
        reqCtrl.cleanup();
      }
    },
    [sessionId]
  );

  const appliquerForgeMonde = useCallback(
    async (draft: WorldForgeDraft) => {
      setChargement(true);
      setErreur(null);
      setNarrationEnCours(null);
      try {
        const res = await fetch('/api/world/forge/apply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Session-Id': sessionId },
          body: JSON.stringify({ draft }),
        });
        const data = await res.json();
        if (!res.ok || !data.succes) {
          throw new Error(data.erreur || 'Application du monde forgé impossible.');
        }
        setEtat(data.etat);
        etatCourantRef.current = data.etat;
        setResetVersion(v => v + 1);
        await executerActionRef.current({ type: 'OUVERTURE_CAMPAGNE' });
        await synchroniserVersFirebase(firebaseUser, etatCourantRef.current, true);
      } catch (err: any) {
        setErreur(err?.message || 'Application du monde forgé impossible.');
      } finally {
        setChargement(false);
      }
    },
    [sessionId, firebaseUser, synchroniserVersFirebase]
  );

  const reessayerDerniereAction = useCallback(async () => {
    const action = derniereActionEchoueeRef.current;
    if (!action) return;
    await executerActionRef.current(action);
  }, []);

  return {
    etat,
    chargement,
    erreur,
    avisAnnulation,
    infoRetry,
    effacerErreur: () => {
      derniereActionEchoueeRef.current = null;
      setErreur(null);
    },
    effacerAvisAnnulation: () => setAvisAnnulation(null),
    narrationEnCours,
    resetVersion,
    authSession,
    enregistrerAuth,
    firebaseUser,
    statutSauvegarde,
    syncEnCours,
    messageSync,
    effacerMessageSync: () => setMessageSync(null),
    connexionGoogle,
    deconnexionGoogle,
    copierVersSecours,
    restaurerDepuisSecours,
    executerAction,
    reessayerDerniereAction,
    aActionAReessayer: Boolean(derniereActionEchoueeRef.current),
    annulerActionEnCours,
    forcerWorldTick,
    avancerTempsAdmin,
    reinitialiserPartie,
    analyserImportHeros,
    genererMonde,
    synchroniserAzgaar,
    importerCarteAzgaar,
    executerActionMJMonde,
    initialiserForgeMonde,
    executerEtapeForgeMonde,
    appliquerForgeMonde,
    promouvoirPnjsProches,
  };
}
