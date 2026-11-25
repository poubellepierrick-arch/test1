import http from 'node:http';
import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { ActionRequest } from './src/engine/adjudication';
import {
  simulerMondeComplet,
  appliquerResultatMonde,
  simulerAvancementTemporel,
  CausalStepOutcome,
} from './src/engine/worldSim';
import { SimulationState, NarrativeEvent } from './src/types';
import { executerTourMaitreDuJeu } from './src/server/gmOrchestrator';
import { superviserJalonsMondeParIA, WorldSupervisionResult } from './src/server/worldSupervisor';
import { assurerMemoireMJ } from './src/server/gmTools';
import { compresserMemoireCampagne } from './src/server/gmCoherence';
import { genererAudioScene, genererIllustrationScene } from './src/server/sceneMedia';
import { chargerAjoutsCodex, sauvegarderAjoutsCodex } from './src/server/codexStore';
import { obtenirManifesteCompletude, rechercherCompendium } from './src/engine/compendium';
import { SrdCategory } from './src/types/srd';
import { obtenirIllustrationObjet } from './src/server/itemIllustrations';
import { globalSessionStore } from './src/server/sessionStore';
import { extraireHerosEtDocuments } from './src/server/heroImporter';
import {
  genererMondeAzgaarStudio,
  parserImportAzgaarJsonOuMap,
  projeterSimulationDepuisAzgaarStudio,
  synchroniserSecteurDepuisAzgaar,
} from './src/engine/azgaarVoronoi';
import { appliquerCommandeMJMonde, MjWorldCommand } from './src/engine/mjWorldEngine';
import {
  AzgaarClimateBias,
  AzgaarStylePreset,
  AzgaarTemplateId,
  AzgaarWorldState,
  WorldForgeDraft,
  WorldForgeStep,
} from './src/types';
import {
  appliquerBrouillonForgeASimulation,
  creerBrouillonForgeInitial,
} from './src/engine/worldForgeDraft';
import {
  enrichirPnjsPromusServeur,
  executerEtapeForgeServeur,
} from './src/server/worldForgeService';
import {
  AI_TIMEOUT_MS,
  HTTP_SERVER_TIMEOUT_MS,
  SSE_KEEPALIVE_INTERVAL_MS,
} from './src/utils/aiTimeoutConfig';
import { AiCancelledError } from './src/server/aiTimeout';

dotenv.config();

const app = express();
app.use(express.json({ limit: '4mb' }));

const PORT = 3000;

// Charger les ajouts personnalisés du Codex 5e dès le démarrage
chargerAjoutsCodex();

function obtenirSessionId(req: Request): string {
  const headerId = req.headers['x-session-id'];
  const queryId = typeof req.query.sessionId === 'string' ? req.query.sessionId : undefined;
  return globalSessionStore.normaliserId(
    (Array.isArray(headerId) ? headerId[0] : headerId) || queryId
  );
}

function lierSignalRequete(req: Request, res: Response) {
  req.setTimeout?.(HTTP_SERVER_TIMEOUT_MS);
  res.setTimeout?.(HTTP_SERVER_TIMEOUT_MS);
  const controller = new AbortController();
  const onAborted = () => {
    if (!controller.signal.aborted) {
      controller.abort(new AiCancelledError());
    }
  };
  const onClose = () => {
    if (!res.writableEnded && !controller.signal.aborted) {
      controller.abort(new AiCancelledError());
    }
  };
  req.on('aborted', onAborted);
  res.on('close', onClose);
  return {
    signal: controller.signal,
    cleanup: () => {
      req.off('aborted', onAborted);
      res.off('close', onClose);
    },
  };
}

// Initialisation Gemini Server-Side si clé présente
const apiKey = process.env.GEMINI_API_KEY;
let aiClient: GoogleGenAI | null = null;
if (apiKey) {
  aiClient = new GoogleGenAI({
    apiKey,
    httpOptions: {
      timeout: AI_TIMEOUT_MS,
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Endpoints REST
app.get('/api/codex/manifest', (_req: Request, res: Response) => {
  res.json(obtenirManifesteCompletude());
});

app.get('/api/codex/search', (req: Request, res: Response) => {
  const q = typeof req.query.q === 'string' ? req.query.q : undefined;
  const cat = typeof req.query.categorie === 'string' ? (req.query.categorie as SrdCategory | 'tout') : 'tout';
  const biome = typeof req.query.biome === 'string' ? req.query.biome : undefined;
  const fpMax = typeof req.query.fpMax === 'string' && req.query.fpMax !== '' ? Number(req.query.fpMax) : undefined;
  const limite = typeof req.query.limite === 'string' ? Number(req.query.limite) : 50;

  const resultats = rechercherCompendium({
    requete: q,
    categorie: cat,
    biome,
    fpMax,
    limite,
  });
  res.json({ resultats, manifest: obtenirManifesteCompletude() });
});

app.post('/api/codex/import', (req: Request, res: Response) => {
  try {
    const entries = Array.isArray(req.body) ? req.body : req.body?.entries;
    if (!Array.isArray(entries) || entries.length === 0) {
      res.status(400).json({ succes: false, erreur: 'Tableau JSON d\'entrées requis.' });
      return;
    }
    const out = sauvegarderAjoutsCodex(entries);
    res.json({ succes: true, ...out });
  } catch (err: any) {
    res.status(400).json({ succes: false, erreur: err?.message || 'Import invalide.' });
  }
});

app.post('/api/items/illustration', async (req: Request, res: Response) => {
  const reqSignal = lierSignalRequete(req, res);
  try {
    const body = req.body || {};
    if (!body.nom && !body.itemId) {
      res.status(400).json({ succes: false, erreur: 'Objet requis.' });
      return;
    }
    const result = await obtenirIllustrationObjet(
      aiClient,
      {
        itemId: String(body.itemId || body.nom),
        nom: String(body.nom || body.itemId),
        nomEn: typeof body.nomEn === 'string' ? body.nomEn : undefined,
        sousCategorie: typeof body.sousCategorie === 'string' ? body.sousCategorie : undefined,
        rarete: typeof body.rarete === 'string' ? body.rarete : undefined,
        effet: typeof body.effet === 'string' ? body.effet : undefined,
        degats: typeof body.degats === 'string' ? body.degats : undefined,
        caBase: typeof body.caBase === 'number' ? body.caBase : undefined,
      },
      { signal: reqSignal.signal, timeoutMs: AI_TIMEOUT_MS }
    );
    if (!res.writableEnded && !reqSignal.signal.aborted) {
      res.json({ succes: true, ...result });
    }
  } catch (err: any) {
    if (!res.writableEnded && !reqSignal.signal.aborted) {
      res.status(500).json({ succes: false, erreur: err?.message || 'Erreur illustration.' });
    }
  } finally {
    reqSignal.cleanup();
  }
});

app.post('/api/character/import', async (req: Request, res: Response) => {
  const reqSignal = lierSignalRequete(req, res);
  try {
    const rawText = typeof req.body?.rawText === 'string' ? req.body.rawText : '';
    const files = Array.isArray(req.body?.files) ? req.body.files : [];
    const resultat = await extraireHerosEtDocuments(aiClient, rawText, files, {
      signal: reqSignal.signal,
      timeoutMs: AI_TIMEOUT_MS,
    });
    if (!res.writableEnded && !reqSignal.signal.aborted) {
      res.json({
        succes: true,
        hero: resultat.hero,
        sourceMode: resultat.sourceMode,
      });
    }
  } catch (err: any) {
    if (!res.writableEnded && !reqSignal.signal.aborted) {
      res.status(400).json({ succes: false, erreur: err?.message || 'Analyse impossible.' });
    }
  } finally {
    reqSignal.cleanup();
  }
});

app.get('/api/simulation/state', (req: Request, res: Response) => {
  const sessionId = obtenirSessionId(req);
  res.json(globalSessionStore.getState(sessionId));
});

app.post('/api/simulation/hydrate', (req: Request, res: Response) => {
  const sessionId = obtenirSessionId(req);
  const etat = req.body?.etat as SimulationState | undefined;
  if (!etat || !etat.personnage || !etat.horloge || !Array.isArray(etat.hexagones)) {
    res.status(400).json({ succes: false, erreur: 'État de simulation invalide.' });
    return;
  }
  const saved = globalSessionStore.setState(sessionId, etat);
  res.json({ succes: true, etat: saved });
});

app.post('/api/simulation/act', async (req: Request, res: Response) => {
  const reqSignal = lierSignalRequete(req, res);
  try {
    const sessionId = obtenirSessionId(req);
    const etatCourant = globalSessionStore.getState(sessionId);
    const action: ActionRequest = req.body;
    const resultat = await executerTourMaitreDuJeu(aiClient, etatCourant, action, undefined, {
      signal: reqSignal.signal,
      timeoutMs: AI_TIMEOUT_MS,
    });
    if (reqSignal.signal.aborted || res.writableEnded) return;
    const saved = globalSessionStore.setState(sessionId, resultat.nouvelEtat);

    res.json({
      succes: true,
      etat: saved,
      dernierEvenement: resultat.evenementNarratif,
    });
  } catch (error: any) {
    if (reqSignal.signal.aborted || res.writableEnded) return;
    const msg = String(error?.message || 'Erreur inconnue');
    const status = /quota/i.test(msg) ? 429 : 400;
    if (!msg.startsWith('Le MJ IA')) {
      console.error('Erreur adjudication:', msg);
    }
    res.status(status).json({ succes: false, erreur: msg });
  } finally {
    reqSignal.cleanup();
  }
});

// Endpoint SSE en streaming temps réel pour les actions du joueur
app.post('/api/simulation/act/stream', async (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const reqSignal = lierSignalRequete(req, res);

  const sendEvent = (event: string, data: any) => {
    if (res.writableEnded || reqSignal.signal.aborted) return;
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const keepaliveTimer = setInterval(() => {
    if (!res.writableEnded && !reqSignal.signal.aborted) {
      res.write(': keepalive\n\n');
    }
  }, SSE_KEEPALIVE_INTERVAL_MS);

  try {
    const sessionId = obtenirSessionId(req);
    const etatCourant = globalSessionStore.getState(sessionId);
    const action: ActionRequest = req.body;
    const resultat = await executerTourMaitreDuJeu(
      aiClient,
      etatCourant,
      action,
      {
        onAdjudication: (adjudication, etatIntermediaire) => {
          sendEvent('adjudication_event', {
            adjudication,
            personnage: etatIntermediaire.personnage,
            horloge: etatIntermediaire.horloge,
            hexActuel: etatIntermediaire.hexActuel,
            combat: etatIntermediaire.combat,
            donjon: etatIntermediaire.donjon,
            modeNarration: etatIntermediaire.modeNarration,
            profilHydrogen: etatIntermediaire.profilHydrogen,
            jetEnAttente: etatIntermediaire.jetEnAttente ?? null,
          });
        },
        onChunk: (deltaText) => {
          sendEvent('narration_chunk', { text: deltaText });
        },
        onRetryStatus: (info) => {
          sendEvent('status_retry', info);
        },
      },
      { signal: reqSignal.signal, timeoutMs: AI_TIMEOUT_MS }
    );

    if (reqSignal.signal.aborted || res.writableEnded) return;
    const saved = globalSessionStore.setState(sessionId, resultat.nouvelEtat);
    sendEvent('narration_done', {
      succes: true,
      etat: saved,
      dernierEvenement: resultat.evenementNarratif,
    });
    if (!res.writableEnded) res.end();
  } catch (error: any) {
    if (!reqSignal.signal.aborted && !res.writableEnded) {
      const msg = String(error?.message || 'Erreur inconnue');
      if (!msg.startsWith('Le MJ IA')) {
        console.error('Erreur stream MJ:', msg);
      }
      sendEvent('narration_error', {
        succes: false,
        erreur: msg,
      });
      res.end();
    }
  } finally {
    clearInterval(keepaliveTimer);
    reqSignal.cleanup();
  }
});

app.post('/api/simulation/tick', async (req: Request, res: Response) => {
  const reqSignal = lierSignalRequete(req, res);
  try {
    const sessionId = obtenirSessionId(req);
    const etatCourant = globalSessionStore.getState(sessionId);
    const etat: SimulationState = JSON.parse(JSON.stringify(etatCourant));
    const debut = Date.now();
    const tickDebut = etat.horloge.tick;

    const heuresBody = req.body?.heures;
    const modeHeures = typeof heuresBody === 'number' && Number.isFinite(heuresBody) && heuresBody > 0;
    const heuresSautees = modeHeures ? Math.max(1, Math.min(720, Math.round(Number(heuresBody)))) : 0;
    const nbTicksRaw = Number(req.body?.ticks ?? 1);
    const nbTicks = Number.isFinite(nbTicksRaw) ? Math.max(1, Math.min(30, Math.floor(nbTicksRaw))) : 1;
    const avecSupervisionIa = Boolean(req.body?.avecSupervisionIa);

    let stepOutcome: CausalStepOutcome = {
      journaux: [],
      chroniqueAjoutee: [],
      jalonsDetectes: [],
      resumeCausal: '',
    };

    if (modeHeures) {
      stepOutcome = simulerAvancementTemporel(etat, heuresSautees);
    } else {
      const journauxCumules: string[] = [];
      const chroniquesCumulees = [] as CausalStepOutcome['chroniqueAjoutee'];
      for (let i = 0; i < nbTicks; i += 1) {
        const { etatModifie, resultat } = simulerMondeComplet(etat, { evoluerTempsMeteo: true });
        appliquerResultatMonde(etat, etatModifie);
        if (resultat.journalFactions.length > 0) {
          journauxCumules.push(...resultat.journalFactions);
        }
        chroniquesCumulees.push(...resultat.chroniqueAjouts);
      }
      stepOutcome = {
        journaux: journauxCumules,
        chroniqueAjoutee: chroniquesCumulees,
        jalonsDetectes: ['JOUR'],
        resumeCausal: journauxCumules.slice(0, 3).join(' | ') || 'Cycle quotidien simulé.',
      };
    }

    let supervision: WorldSupervisionResult | null = null;
    const doitSuperviser =
      avecSupervisionIa &&
      (stepOutcome.jalonsDetectes.includes('JOUR') ||
        stepOutcome.jalonsDetectes.includes('SEMAINE') ||
        stepOutcome.jalonsDetectes.includes('MOIS') ||
        stepOutcome.chroniqueAjoutee.length > 0);

    if (doitSuperviser) {
      supervision = await superviserJalonsMondeParIA(
        aiClient,
        etat,
        {
          heuresSautees: modeHeures ? heuresSautees : nbTicks * 24,
          jalonsDetectes: stepOutcome.jalonsDetectes,
          resumeCausal: stepOutcome.resumeCausal,
          chroniqueRecente: etat.chroniqueMonde || stepOutcome.chroniqueAjoutee,
        },
        {
          signal: reqSignal.signal,
          timeoutMs: AI_TIMEOUT_MS,
        }
      );
    }

    if (reqSignal.signal.aborted || res.writableEnded) {
      return;
    }

    etat._seq += 1;
    const texteFaction =
      supervision?.syntheseCausale ||
      stepOutcome.resumeCausal ||
      stepOutcome.journaux.join(' | ') ||
      'Aucun mouvement majeur.';

    const labelSaut = modeHeures
      ? heuresSautees >= 720
        ? '+1 mois'
        : heuresSautees >= 168
          ? '+1 semaine'
          : heuresSautees >= 24
            ? `+${Math.round(heuresSautees / 24)}j`
            : `+${heuresSautees}h`
      : `+${nbTicks} tick${nbTicks > 1 ? 's' : ''}`;

    assurerMemoireMJ(etat);
    etat.memoireMJ!.filNarratif.push(
      `Jour ${etat.horloge.jour}, ${String(etat.horloge.heure).padStart(2, '0')}:00 — Monde (${labelSaut}) : ${texteFaction}`
    );
    compresserMemoireCampagne(etat, 8);

    const fin = Date.now();
    const nbEntitesActives = (etat.entitesMonde || []).filter(e => e.statut === 'EN_ROUTE').length;

    const traceTick = {
      seq: etat._seq,
      timestamp: `Jour ${etat.horloge.jour}, ${String(etat.horloge.heure).padStart(2, '0')}:00`,
      actionType: 'WORLD_TICK_FACTIONS',
      donneesEntree: {
        tickPrecedent: tickDebut,
        nouveauTick: etat.horloge.tick,
        heuresSautees: modeHeures ? heuresSautees : undefined,
        ticksExecutes: Math.max(0, etat.horloge.tick - tickDebut),
        superviseParIa: Boolean(supervision),
      },
      promptSystemeIa: supervision
        ? 'Supervision IA Gemini 4 Hydrogen sur jalons procéduraux.'
        : 'Moteur causal continu multi-échelles (Simulation procédurale pure).',
      promptUtilisateurIa: `Évolution temporelle (${labelSaut}) : météo, hydrologie, ressources, convois, diplomatie, marché et chronique.`,
      reponseBruteIa: texteFaction,
      modeleIa: supervision ? supervision.modeleUtilise : 'Moteur Causal Procédural',
      latenceMs: fin - debut,
      donneesUtilisees: {
        reglesSrd: [`Simulation multi-échelles (${labelSaut}) : ${stepOutcome.jalonsDetectes.join(', ') || 'HEURE'}`],
        attributsPersonnage: ['Aucun (Résolution hors du champ de vision du joueur)'],
        noeudsGraphInjectes: [
          `${stepOutcome.chroniqueAjoutee.length} entrée(s) chronique`,
          `${nbEntitesActives} unité(s) en mouvement`,
        ],
        noeudsGraphFiltresMasques: ['Événements non encore propagés jusqu’à l’hexagone du joueur'],
        hexagonesInterroges: etat.hexagones.map(
          h => `${h.nom} (Contrôle: ${h.factionControleId || 'Aucun'}, Sécurité: ${h.securite}, Pression: ${h.pressionDanger ?? 0})`
        ),
        factionsImpliquees: etat.factions.map(
          f => `${f.nom} (${f.posture || 'ACTIF'}, Force: ${f.forceMilitaire}, Moral: ${f.moral ?? 65}, Richesse: ${f.richesse})`
        ),
        formuleMathematique: 'Cause-à-effet continu (Heure/Jour/Semaine/Mois) + d20 contextuel',
      },
    };

    const evt: NarrativeEvent = {
      _seq: etat._seq,
      horodatageTick: etat.horloge.tick,
      horodatageDate: `Jour ${etat.horloge.jour}, ${String(etat.horloge.heure).padStart(2, '0')}:00`,
      titre: supervision ? supervision.titreChronique : `Évolution du monde (${labelSaut})`,
      texteNarratif: supervision
        ? `${supervision.syntheseCausale} ${supervision.consequencesPrevisibles}`
        : `Le monde a poursuivi son cours (${labelSaut}). ${texteFaction}`,
      tonAmbiance: 'NEUTRE',
      suggestionsMJ: [
        'Consulter l\'état des factions et des flux commerciaux',
        'Observer les changements sur la carte du secteur',
        'Poursuivre votre expédition selon votre plan de route',
      ],
      evenementFaction: {
        factionNom: supervision ? 'Supervision MJ IA' : 'Simulation Monde',
        cibleNoeudNom: 'Monde',
        action: `Saut temporel (${labelSaut})`,
        impact: texteFaction,
      },
      trace: traceTick,
    };

    etat.journalNarratif.push(evt);
    if (!etat.historiqueTraces) etat.historiqueTraces = [];
    etat.historiqueTraces.push(traceTick);

    const saved = globalSessionStore.setState(sessionId, etat);
    res.json({ succes: true, etat: saved, dernierEvenement: evt, supervision });
  } catch (error: any) {
    if (!reqSignal.signal.aborted && !res.writableEnded) {
      res.status(500).json({ succes: false, erreur: error?.message || 'Erreur simulation temporelle.' });
    }
  } finally {
    reqSignal.cleanup();
  }
});

app.post('/api/world/generate', (req: Request, res: Response) => {
  try {
    const sessionId = obtenirSessionId(req);
    const etatCourant = globalSessionStore.getState(sessionId);
    const body = req.body || {};

    const seed = Math.max(1, Math.trunc(Number(body.seed) || Math.floor(Math.random() * 900000) + 10000));
    const validTemplates: AzgaarTemplateId[] = [
      'continent',
      'archipel',
      'peninsule',
      'mediterranee',
      'detroit',
      'volcan',
      'haute_chaine',
    ];
    let template: AzgaarTemplateId = 'continent';
    if (validTemplates.includes(body.template)) {
      template = body.template;
    } else if (body.modeleRelief === 'archipel') {
      template = 'archipel';
    } else if (body.modeleRelief === 'peninsule') {
      template = 'peninsule';
    } else if (body.modeleRelief === 'monts') {
      template = 'haute_chaine';
    } else if (body.modeleRelief === 'vallee') {
      template = 'mediterranee';
    }

    const climateBias = (['tempere', 'boreal', 'aride'].includes(String(body.climateBias || body.climatBias || ''))
      ? String(body.climateBias || body.climatBias)
      : 'tempere') as AzgaarClimateBias;
    const cellsDesired = ([800, 1500, 2400].includes(Number(body.cellsDesired))
      ? Number(body.cellsDesired)
      : 1500) as 800 | 1500 | 2400;
    const windAngle = Number.isFinite(Number(body.windAngle)) ? Number(body.windAngle) : undefined;
    const stylePreset = (['classique', 'parchemin', 'politique', 'relief', 'sombre'].includes(String(body.stylePreset || ''))
      ? String(body.stylePreset)
      : etatCourant.azgaarStudio?.stylePreset || 'classique') as AzgaarStylePreset;
    const rayonAnneaux = Math.max(2, Math.min(4, Math.trunc(Number(body.rayonAnneaux) || 2)));
    const worldName = typeof (body.worldName || body.nomMonde) === 'string'
      ? String(body.worldName || body.nomMonde).slice(0, 60)
      : undefined;
    const conserverHeros = body.conserverHeros !== false;

    const nouveauMonde = genererMondeAzgaarStudio(
      {
        seed,
        template,
        climateBias,
        cellsDesired,
        windAngle,
        stylePreset,
        worldName,
        rayonAnneaux,
        statesCount: Number.isFinite(Number(body.statesCount)) ? Number(body.statesCount) : undefined,
        culturesCount: Number.isFinite(Number(body.culturesCount)) ? Number(body.culturesCount) : undefined,
        religionsCount: Number.isFinite(Number(body.religionsCount)) ? Number(body.religionsCount) : undefined,
        burgsCount: Number.isFinite(Number(body.burgsCount)) ? Number(body.burgsCount) : undefined,
        conserverHeros,
      },
      etatCourant
    );
    nouveauMonde.profilHydrogen = etatCourant.profilHydrogen || 'STANDARD';
    const saved = globalSessionStore.setState(sessionId, nouveauMonde);
    res.json({ succes: true, etat: saved });
  } catch (err: any) {
    res.status(400).json({ succes: false, erreur: err?.message || 'Génération impossible.' });
  }
});

app.post('/api/azgaar/sync', (req: Request, res: Response) => {
  try {
    const sessionId = obtenirSessionId(req);
    const etatCourant = globalSessionStore.getState(sessionId);
    const studio = req.body?.studio as AzgaarWorldState | undefined;
    if (!studio || !Array.isArray(studio.states) || !Array.isArray(studio.burgs)) {
      res.status(400).json({ succes: false, erreur: 'Carte Azgaar invalide.' });
      return;
    }
    const synced = synchroniserSecteurDepuisAzgaar(etatCourant, studio);
    const saved = globalSessionStore.setState(sessionId, synced);
    res.json({ succes: true, etat: saved });
  } catch (err: any) {
    res.status(400).json({ succes: false, erreur: err?.message || 'Synchronisation impossible.' });
  }
});

app.post('/api/azgaar/import', (req: Request, res: Response) => {
  try {
    const sessionId = obtenirSessionId(req);
    const etatCourant = globalSessionStore.getState(sessionId);
    const rawText = typeof req.body?.rawText === 'string' ? req.body.rawText : '';
    const studio = parserImportAzgaarJsonOuMap(rawText, etatCourant);
    const nouveauMonde = projeterSimulationDepuisAzgaarStudio(studio, undefined, etatCourant);
    nouveauMonde.profilHydrogen = etatCourant.profilHydrogen || 'STANDARD';
    const saved = globalSessionStore.setState(sessionId, nouveauMonde);
    res.json({ succes: true, etat: saved });
  } catch (err: any) {
    res.status(400).json({ succes: false, erreur: err?.message || 'Import .map / .json impossible.' });
  }
});

app.post('/api/world/forge/init', (req: Request, res: Response) => {
  try {
    const sessionId = obtenirSessionId(req);
    const etatCourant = globalSessionStore.getState(sessionId);
    const configOverride = req.body?.config && typeof req.body.config === 'object' ? req.body.config : undefined;
    const draft = creerBrouillonForgeInitial(etatCourant, configOverride);
    res.json({ succes: true, draft });
  } catch (err: any) {
    res.status(400).json({ succes: false, erreur: err?.message || 'Initialisation de la forge impossible.' });
  }
});

app.post('/api/world/forge/step', async (req: Request, res: Response) => {
  const reqSignal = lierSignalRequete(req, res);
  try {
    const sessionId = obtenirSessionId(req);
    const etatCourant = globalSessionStore.getState(sessionId);
    const draft = req.body?.draft as WorldForgeDraft | undefined;
    const stepRaw = Number(req.body?.step);
    const step = ([1, 2, 3, 4].includes(stepRaw) ? stepRaw : 1) as WorldForgeStep;
    const regenererGeometrie = Boolean(req.body?.regenererGeometrie);

    if (!draft || !draft.studio || !draft.config) {
      res.status(400).json({ succes: false, erreur: 'Brouillon de forge invalide.' });
      return;
    }

    const result = await executerEtapeForgeServeur(
      aiClient,
      draft,
      step,
      etatCourant.personnage,
      {
        signal: reqSignal.signal,
        timeoutMs: AI_TIMEOUT_MS,
        regenererGeometrie,
      }
    );

    if (!res.writableEnded && !reqSignal.signal.aborted) {
      res.json({ succes: true, ...result });
    }
  } catch (err: any) {
    if (!res.writableEnded && !reqSignal.signal.aborted) {
      res.status(500).json({ succes: false, erreur: err?.message || 'Échec de l’étape de forge.' });
    }
  } finally {
    reqSignal.cleanup();
  }
});

app.post('/api/world/forge/apply', (req: Request, res: Response) => {
  try {
    const sessionId = obtenirSessionId(req);
    const etatCourant = globalSessionStore.getState(sessionId);
    const draft = req.body?.draft as WorldForgeDraft | undefined;
    if (!draft || !draft.studio || !draft.lore || !Array.isArray(draft.pnjs)) {
      res.status(400).json({ succes: false, erreur: 'Brouillon de forge incomplet.' });
      return;
    }
    const nouveauMonde = appliquerBrouillonForgeASimulation(draft, etatCourant);
    nouveauMonde.profilHydrogen = etatCourant.profilHydrogen || 'STANDARD';
    nouveauMonde.modeNarration = etatCourant.modeNarration || 'CONCIS';
    const saved = globalSessionStore.setState(sessionId, nouveauMonde);
    res.json({ succes: true, etat: saved });
  } catch (err: any) {
    res.status(400).json({ succes: false, erreur: err?.message || 'Application du monde impossible.' });
  }
});

app.post('/api/world/npcs/promote', async (req: Request, res: Response) => {
  const reqSignal = lierSignalRequete(req, res);
  try {
    const sessionId = obtenirSessionId(req);
    const etatCourant = globalSessionStore.getState(sessionId);
    const npcIds = Array.isArray(req.body?.npcIds) ? req.body.npcIds.map(String) : undefined;
    const result = await enrichirPnjsPromusServeur(aiClient, etatCourant, npcIds, {
      signal: reqSignal.signal,
      timeoutMs: AI_TIMEOUT_MS,
    });

    if (reqSignal.signal.aborted || res.writableEnded) return;
    const saved = globalSessionStore.setState(sessionId, result.etat);
    res.json({
      succes: true,
      etat: saved,
      promotedOrEnrichedIds: result.promotedOrEnrichedIds,
      source: result.source,
    });
  } catch (err: any) {
    if (!reqSignal.signal.aborted && !res.writableEnded) {
      res.status(500).json({ succes: false, erreur: err?.message || 'Promotion PNJ impossible.' });
    }
  } finally {
    reqSignal.cleanup();
  }
});

app.post('/api/world/mj', (req: Request, res: Response) => {
  try {
    const sessionId = obtenirSessionId(req);
    const etatCourant = globalSessionStore.getState(sessionId);
    const commande = req.body as MjWorldCommand | undefined;
    if (!commande || !commande.type) {
      res.status(400).json({ succes: false, erreur: 'Commande MJ invalide.' });
      return;
    }
    const { etat: prochainEtat, resume } = appliquerCommandeMJMonde(etatCourant, commande);
    const saved = globalSessionStore.setState(sessionId, prochainEtat);
    res.json({ succes: true, etat: saved, resume });
  } catch (err: any) {
    res.status(400).json({ succes: false, erreur: err?.message || 'Action MJ impossible.' });
  }
});

app.post('/api/narration/tts', async (req: Request, res: Response) => {
  const reqSignal = lierSignalRequete(req, res);
  try {
    const body = req.body || {};
    const texte = typeof body.texte === 'string' ? body.texte : '';
    const titre = typeof body.titre === 'string' ? body.titre : '';
    const tonRaw = typeof body.tonAmbiance === 'string' ? body.tonAmbiance : typeof body.ton === 'string' ? body.ton : undefined;
    const ton = (['CHAMPETRE', 'SOMBRE', 'PERIL', 'NEUTRE'].includes(String(tonRaw)) ? tonRaw : undefined) as
      | 'CHAMPETRE'
      | 'SOMBRE'
      | 'PERIL'
      | 'NEUTRE'
      | undefined;
    if (!texte.trim()) {
      res.status(400).json({ succes: false, erreur: 'Texte narratif requis.' });
      return;
    }
    const result = await genererAudioScene(
      aiClient,
      {
        sceneKey: typeof body.sceneId === 'string' ? body.sceneId : typeof body.sceneKey === 'string' ? body.sceneKey : undefined,
        titre,
        texte,
        ton,
      },
      { signal: reqSignal.signal, timeoutMs: AI_TIMEOUT_MS }
    );
    if (!res.writableEnded && !reqSignal.signal.aborted) {
      res.json({ succes: true, ...result });
    }
  } catch (err: any) {
    if (!res.writableEnded && !reqSignal.signal.aborted) {
      res.status(500).json({ succes: false, erreur: err?.message || 'Génération audio impossible.' });
    }
  } finally {
    reqSignal.cleanup();
  }
});

app.post('/api/narration/illustrate', async (req: Request, res: Response) => {
  const reqSignal = lierSignalRequete(req, res);
  try {
    const body = req.body || {};
    const titre = typeof body.titre === 'string' ? body.titre : 'Scène de campagne';
    const texte = typeof body.texte === 'string' ? body.texte : '';
    const tonRaw = typeof body.tonAmbiance === 'string' ? body.tonAmbiance : typeof body.ton === 'string' ? body.ton : undefined;
    const ton = (['CHAMPETRE', 'SOMBRE', 'PERIL', 'NEUTRE'].includes(String(tonRaw)) ? tonRaw : undefined) as
      | 'CHAMPETRE'
      | 'SOMBRE'
      | 'PERIL'
      | 'NEUTRE'
      | undefined;
    if (!texte.trim() && !titre.trim()) {
      res.status(400).json({ succes: false, erreur: 'Scène requise.' });
      return;
    }
    const result = await genererIllustrationScene(
      aiClient,
      {
        sceneKey:
          typeof body.sceneId === 'string'
            ? body.sceneId
            : typeof body.sceneKey === 'string'
            ? body.sceneKey
            : `scene_${Date.now()}`,
        titre,
        texte,
        ton,
        lieuNom: typeof body.lieuNom === 'string' ? body.lieuNom : undefined,
        terrain: typeof body.terrain === 'string' ? body.terrain : undefined,
        biomeAzgaar: typeof body.biomeAzgaar === 'string' ? body.biomeAzgaar : undefined,
        meteo: typeof body.meteo === 'string' ? body.meteo : undefined,
        heure: typeof body.heure === 'number' ? body.heure : undefined,
        enCombat: Boolean(body.enCombat),
        enDonjon: Boolean(body.enDonjon),
      },
      { signal: reqSignal.signal, timeoutMs: AI_TIMEOUT_MS }
    );
    if (!res.writableEnded && !reqSignal.signal.aborted) {
      res.json({ succes: true, svg: result.svg, svgMarkup: result.svg, source: result.source });
    }
  } catch (err: any) {
    if (!res.writableEnded && !reqSignal.signal.aborted) {
      res.status(500).json({ succes: false, erreur: err?.message || 'Illustration impossible.' });
    }
  } finally {
    reqSignal.cleanup();
  }
});

app.post('/api/simulation/reset', (req: Request, res: Response) => {
  const sessionId = obtenirSessionId(req);
  const precedent = globalSessionStore.getState(sessionId);
  const reset = globalSessionStore.resetState(sessionId);
  reset.profilHydrogen = precedent.profilHydrogen || 'STANDARD';
  globalSessionStore.setState(sessionId, reset);
  res.json({ succes: true, etat: reset });
});

// Endpoint SSE avec déduplication _seq
app.get('/api/narration/stream', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sessionId = obtenirSessionId(req);
  const etat = globalSessionStore.getState(sessionId);
  const sinceSeq = parseInt((req.query.since_seq as string) || '0', 10);
  const eventsAEnvoyer = etat.journalNarratif.filter(e => e._seq > sinceSeq);

  for (const evt of eventsAEnvoyer) {
    res.write(`id: ${evt._seq}\n`);
    res.write(`event: narration_event\n`);
    res.write(`data: ${JSON.stringify(evt)}\n\n`);
  }

  const heartbeat = setInterval(() => {
    res.write(': keepalive\n\n');
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
  });
});

async function demarrerServeur() {
  const httpServer = http.createServer(app);
  // Permet aux appels IA longs (jusqu'à 15 minutes + marge) de s'achever sans coupure HTTP prématurée
  httpServer.requestTimeout = HTTP_SERVER_TIMEOUT_MS;
  httpServer.setTimeout(HTTP_SERVER_TIMEOUT_MS);
  const hmrDisabled = process.env.DISABLE_HMR === 'true';

  const vite = await createViteServer({
    server: {
      middlewareMode: true,
      allowedHosts: true,
      hmr: hmrDisabled ? false : { server: httpServer },
      ws: hmrDisabled ? { server: httpServer } : undefined,
    },
    appType: 'spa',
  });

  app.use(vite.middlewares);

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Serveur D&D 5e Monde Indifférent actif sur http://0.0.0.0:${PORT}`);
  });
}

demarrerServeur();
