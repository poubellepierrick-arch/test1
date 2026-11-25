import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import {
  SimulationState,
  WorldChronicleEntry,
} from '../types';
import { assurerMemoireMJ } from './gmTools';
import {
  AI_TIMEOUT_MS,
  appelerIaAvecRetry,
  creerContexteAppelIa,
  estErreurQuotaJournalier,
  RetryInfo,
} from './aiTimeout';

const MODEL_SUPERVISOR = 'gemini-4-hydrogen';

export interface WorldSupervisionInput {
  heuresSautees: number;
  jalonsDetectes: Array<'HEURE' | 'JOUR' | 'SEMAINE' | 'MOIS'>;
  resumeCausal: string;
  chroniqueRecente: WorldChronicleEntry[];
}

export interface WorldSupervisionResult {
  titreChronique: string;
  syntheseCausale: string;
  consequencesPrevisibles: string;
  noteSecreteMJ: string;
  rumeurPublique?: {
    titre: string;
    texte: string;
  };
  arcMisAJour?: {
    titre: string;
    resume: string;
    prochaineEtape: string;
    progression: number;
  };
  modeleUtilise: string;
  latenceMs: number;
}

export interface WorldSupervisionOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  onRetry?: (info: RetryInfo) => void;
}

const SUPERVISION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    titreChronique: { type: Type.STRING },
    syntheseCausale: { type: Type.STRING },
    consequencesPrevisibles: { type: Type.STRING },
    noteSecreteMJ: { type: Type.STRING },
    rumeurPublique: {
      type: Type.OBJECT,
      properties: {
        titre: { type: Type.STRING },
        texte: { type: Type.STRING },
      },
    },
    arcMisAJour: {
      type: Type.OBJECT,
      properties: {
        titre: { type: Type.STRING },
        resume: { type: Type.STRING },
        prochaineEtape: { type: Type.STRING },
        progression: { type: Type.NUMBER },
      },
    },
  },
  required: ['titreChronique', 'syntheseCausale', 'consequencesPrevisibles', 'noteSecreteMJ'],
};

/**
 * Supervise les jalons macroscopiques de la simulation procédurale du monde via Gemini 4 Hydrogen.
 * Ne génère jamais de contenu factice si le service IA est absent ou en erreur.
 */
export async function superviserJalonsMondeParIA(
  aiClient: GoogleGenAI | null,
  etat: SimulationState,
  input: WorldSupervisionInput,
  options?: WorldSupervisionOptions
): Promise<WorldSupervisionResult> {
  if (!aiClient) {
    throw new Error('Supervision IA indisponible : clé Gemini serveur absente.');
  }

  const debut = Date.now();
  const ctx = creerContexteAppelIa(options?.signal, options?.timeoutMs ?? AI_TIMEOUT_MS);

  try {
    const niveau = etat.profilHydrogen === 'MAX' ? ThinkingLevel.HIGH : ThinkingLevel.MEDIUM;

    const etatFactions = etat.factions
      .map(
        f =>
          `- ${f.nom} (${f.posture || 'ACTIF'}, force ${f.forceMilitaire}, richesse ${f.richesse}, moral ${f.moral ?? 65}, lassitude ${f.lassitudeGuerre ?? 10}%)`
      )
      .join('\n');

    const etatEconomie = `Fer ×${etat.marche.multiplicateurFer.toFixed(2)} (${etat.marche.tendanceFer || 'STABLE'}), Vivres ×${(etat.marche.multiplicateurVivres ?? 1).toFixed(2)}, Routes: ${etat.marche.securiteRoutes}, Tension commerciale: ${etat.marche.indiceTensionCommerciale ?? 20}/100`;

    const jalonsTexte = input.jalonsDetectes.join(', ') || 'JOUR';
    const chroniqueTexte =
      input.chroniqueRecente
        .slice(0, 8)
        .map(
          c =>
            `[J${c.jour} · ${c.echelle || 'JOUR'} · ${c.categorie}] ${c.titre} — ${c.causeDirecte || c.impact} -> ${c.consequences || c.impact}`
        )
        .join('\n') || 'Aucun événement majeur enregistré.';

    const arcsExistants =
      (etat.memoireMJ?.arcsNarratifs || [])
        .map(a => `- ${a.titre} (${a.statut}, ${a.progression}%) : ${a.resume}`)
        .join('\n') || 'Aucun arc actif.';

    const prompt = `Supervise cette évolution procédurale du monde après un saut temporel de ${input.heuresSautees}h (jalons : ${jalonsTexte}).
Date actuelle : Jour ${etat.horloge.jour}, ${String(etat.horloge.heure).padStart(2, '0')}:00 (${etat.horloge.saison || 'Automne'}, ${etat.horloge.meteo}).
Position actuelle du héros : ${etat.hexActuel.nom}.

ÉCONOMIE & MARCHÉ :
${etatEconomie}

FACTIONS :
${etatFactions}

ÉVÉNEMENTS CAUSAUX PRODUITS PAR LE MOTEUR :
${chroniqueTexte}

ARCS NARRATIFS EN COURS :
${arcsExistants}

TÂCHE :
1. Synthétise la logique de cause à effet entre économie, météo, ressources et factions en français sobre et concret.
2. Déduis les conséquences géopolitiques ou commerciales prévisibles à court terme.
3. Rédige une note secrète de MJ cohérente (qui reste cachée du joueur) et, si pertinent, une rumeur crédible circulant sur les routes + une mise à jour d'arc narratif.`;

    const response = await appelerIaAvecRetry(
      async ({ signal }) => {
        return await aiClient.models.generateContent({
          model: MODEL_SUPERVISOR,
          contents: prompt,
          config: {
            systemInstruction:
              'Tu es le superviseur géopolitique et économique du Maître du Jeu D&D 5e. Reste strictement factuel, cohérent avec les données fournies, sans cliché ni emphase.',
            responseMimeType: 'application/json',
            responseSchema: SUPERVISION_SCHEMA,
            thinkingConfig: { thinkingLevel: niveau },
            abortSignal: signal,
          },
        });
      },
      {
        signal: ctx.signal,
        deadlineMs: ctx.deadlineMs,
        timeoutMs: ctx.timeoutMs,
        onRetry: options?.onRetry,
      }
    );

    const rawText = (response.text || '').trim();
    if (!rawText) {
      throw new Error('Réponse vide du superviseur IA.');
    }

    const parsed = JSON.parse(rawText) as {
      titreChronique?: string;
      syntheseCausale?: string;
      consequencesPrevisibles?: string;
      noteSecreteMJ?: string;
      rumeurPublique?: { titre?: string; texte?: string };
      arcMisAJour?: { titre?: string; resume?: string; prochaineEtape?: string; progression?: number };
    };

    const titreChronique = (parsed.titreChronique || 'Supervision des jalons du monde').trim();
    const syntheseCausale = (parsed.syntheseCausale || input.resumeCausal).trim();
    const consequencesPrevisibles = (
      parsed.consequencesPrevisibles || 'Équilibre régional surveillé.'
    ).trim();
    const noteSecreteMJ = (parsed.noteSecreteMJ || syntheseCausale).trim();

    assurerMemoireMJ(etat);
    etat.memoireMJ!.journalSecretMJ = [
      {
        id: `sec_sup_${etat.horloge.jour}_${Date.now()}`,
        jour: etat.horloge.jour,
        titre: titreChronique,
        contenu: `${noteSecreteMJ} | Conséquences : ${consequencesPrevisibles}`,
        categorie: 'MONDE' as const,
      },
      ...(etat.memoireMJ!.journalSecretMJ || []),
    ].slice(0, 16);

    if (parsed.arcMisAJour?.titre && parsed.arcMisAJour?.resume) {
      const arcs = etat.memoireMJ!.arcsNarratifs || [];
      const existant = arcs.find(
        a => a.titre.toLowerCase() === parsed.arcMisAJour!.titre!.trim().toLowerCase()
      );
      const prog = Math.max(0, Math.min(100, Math.round(Number(parsed.arcMisAJour.progression ?? 35))));
      if (existant) {
        existant.resume = parsed.arcMisAJour.resume.trim();
        existant.prochaineEtape = parsed.arcMisAJour.prochaineEtape?.trim() || existant.prochaineEtape;
        existant.progression = prog;
        existant.derniereMajJour = etat.horloge.jour;
      } else {
        arcs.push({
          id: `arc_sup_${etat.horloge.jour}_${arcs.length + 1}`,
          titre: parsed.arcMisAJour.titre.trim(),
          statut: prog >= 100 ? 'RESOLU' : 'ACTIF',
          progression: prog,
          resume: parsed.arcMisAJour.resume.trim(),
          prochaineEtape: parsed.arcMisAJour.prochaineEtape?.trim(),
          derniereMajJour: etat.horloge.jour,
        });
      }
      etat.memoireMJ!.arcsNarratifs = arcs.slice(-8);
    }

    if (parsed.rumeurPublique?.titre && parsed.rumeurPublique?.texte) {
      const deja = (etat.rumeurs || []).some(
        r => r.titre.toLowerCase() === parsed.rumeurPublique!.titre!.trim().toLowerCase()
      );
      if (!deja) {
        etat.rumeurs = [
          {
            id: `rum_sup_${etat.horloge.tick}_${Date.now()}`,
            titre: parsed.rumeurPublique.titre.trim(),
            texte: parsed.rumeurPublique.texte.trim(),
            source: 'Récits des voyageurs et marchands',
            veracite: true,
            tickEmission: etat.horloge.tick,
            statutPerception: 'INCERTAINE' as const,
            lieuObtention: etat.hexActuel.nom,
          },
          ...(etat.rumeurs || []),
        ].slice(0, 12);
      }
    }

    const echelleMax = input.jalonsDetectes.includes('MOIS')
      ? 'MOIS'
      : input.jalonsDetectes.includes('SEMAINE')
        ? 'SEMAINE'
        : input.jalonsDetectes.includes('JOUR')
          ? 'JOUR'
          : 'HEURE';

    const entreeChronique: WorldChronicleEntry = {
      id: `chr_sup_ia_${etat.horloge.jour}_${etat.horloge.tick}_${Date.now()}`,
      tick: etat.horloge.tick,
      jour: etat.horloge.jour,
      echelle: echelleMax,
      categorie: 'SUPERVISION_IA',
      titre: titreChronique,
      impact: syntheseCausale,
      causeDirecte: `Supervision IA sur jalons (${jalonsTexte})`,
      consequences: consequencesPrevisibles,
      superviseParIa: true,
    };
    etat.chroniqueMonde = [entreeChronique, ...(etat.chroniqueMonde || [])].slice(0, 24);

    return {
      titreChronique,
      syntheseCausale,
      consequencesPrevisibles,
      noteSecreteMJ,
      rumeurPublique:
        parsed.rumeurPublique?.titre && parsed.rumeurPublique?.texte
          ? {
              titre: parsed.rumeurPublique.titre.trim(),
              texte: parsed.rumeurPublique.texte.trim(),
            }
          : undefined,
      arcMisAJour:
        parsed.arcMisAJour?.titre && parsed.arcMisAJour?.resume
          ? {
              titre: parsed.arcMisAJour.titre.trim(),
              resume: parsed.arcMisAJour.resume.trim(),
              prochaineEtape: parsed.arcMisAJour.prochaineEtape?.trim() || '',
              progression: Math.max(0, Math.min(100, Math.round(Number(parsed.arcMisAJour.progression ?? 35)))),
            }
          : undefined,
      modeleUtilise: MODEL_SUPERVISOR,
      latenceMs: Date.now() - debut,
    };
  } catch (err: any) {
    if (estErreurQuotaJournalier(err)) {
      throw new Error(
        'Le superviseur IA a atteint le quota journalier de requêtes Gemini. Désactivez la supervision IA pour continuer en mode purement procédural.'
      );
    }
    throw err;
  } finally {
    ctx.cleanup();
  }
}
