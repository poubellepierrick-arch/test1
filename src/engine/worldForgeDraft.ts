import {
  AzgaarWorldState,
  CampaignArc,
  CharacterStats,
  GmSecretNote,
  SimulationState,
  WorldForgeConfig,
  WorldForgeDraft,
} from '../types';
import {
  genererMondeAzgaarStudio,
  projeterSimulationDepuisAzgaarStudio,
  reconstruireAtlasComplet,
} from './azgaarVoronoi';
import { INITIAL_SIMULATION_STATE } from './initialData';
import {
  TONALITES_DISPONIBLES,
  genererLoreProcedural,
  genererPnjsProcedural,
  reconcilierProximitePnjs,
} from './worldLoreAndNpcs';

export function construireConfigForgeParDefaut(etat?: SimulationState): WorldForgeConfig {
  const studio = etat?.azgaarStudio;
  const carte = etat?.carteAzgaar;
  return {
    seed: studio?.seed || carte?.seed || 104729,
    worldName: studio?.worldName || carte?.nomMonde || 'Marches de Val-Gris',
    template: studio?.template || 'continent',
    climateBias: studio?.climateBias || carte?.climatBias || 'tempere',
    cellsDesired: studio?.cellsDesired || 1500,
    seaLevel: studio?.seaLevel ?? 20,
    windAngle: studio?.windAngle ?? 18,
    stylePreset: studio?.stylePreset || 'parchemin',
    rayonAnneaux: carte?.rayonAnneaux && carte.rayonAnneaux >= 2 ? carte.rayonAnneaux : 3,
    statesCount: Math.max(2, Math.min(7, studio?.states?.length || 4)),
    culturesCount: Math.max(2, Math.min(6, studio?.cultures?.length || 4)),
    religionsCount: Math.max(1, Math.min(5, studio?.religions?.length || 3)),
    burgsCount: Math.max(8, Math.min(34, studio?.burgs?.length || 18)),
    conserverHeros: true,
    tonalite: etat?.loreMonde?.tonalite || TONALITES_DISPONIBLES[0],
    customPrompt: '',
    heroBurgId: studio?.heroBurgId,
    radiusProche: 2,
    lambdaParBourg: 2,
  };
}

/** Initialise un brouillon de forge en 4 paliers depuis un état existant ou une nouvelle graine. */
export function creerBrouillonForgeInitial(
  baseState?: SimulationState,
  configOverride?: Partial<WorldForgeConfig>
): WorldForgeDraft {
  const config: WorldForgeConfig = {
    ...construireConfigForgeParDefaut(baseState),
    ...configOverride,
  };

  const baseSim = genererMondeAzgaarStudio(
    {
      seed: config.seed,
      template: config.template,
      climateBias: config.climateBias,
      cellsDesired: config.cellsDesired,
      windAngle: config.windAngle,
      worldName: config.worldName,
      stylePreset: config.stylePreset,
      rayonAnneaux: config.rayonAnneaux,
      statesCount: config.statesCount,
      culturesCount: config.culturesCount,
      religionsCount: config.religionsCount,
      burgsCount: config.burgsCount,
      conserverHeros: config.conserverHeros,
    },
    baseState
  );

  const studio = baseSim.azgaarStudio!;
  studio.seaLevel = config.seaLevel;
  const hero = baseSim.personnage || INITIAL_SIMULATION_STATE.personnage;
  const lore = genererLoreProcedural(studio, baseSim.factions, config);
  const pnjs = genererPnjsProcedural(studio, baseSim.factions, baseSim.hexagones, lore, hero, config);

  return {
    etapeCourante: 1,
    etapesValidees: { 1: false, 2: false, 3: false, 4: false },
    config,
    studio,
    factions: baseSim.factions,
    hexagones: baseSim.hexagones,
    lore,
    pnjs,
    sourceParEtape: { 1: 'PROCEDURAL', 2: 'PROCEDURAL', 3: 'PROCEDURAL', 4: 'PROCEDURAL' },
  };
}

/** Régénère l'étape 1 (Cartographie & Géographie physique). */
export function regenererEtape1CartoBrouillon(
  draft: WorldForgeDraft,
  hero: CharacterStats
): WorldForgeDraft {
  const fresh = creerBrouillonForgeInitial(
    { ...INITIAL_SIMULATION_STATE, personnage: hero },
    draft.config
  );
  return {
    ...fresh,
    etapeCourante: 1,
    etapesValidees: { 1: false, 2: false, 3: false, 4: false },
  };
}

/** Régénère l'étape 2 (Peuples, États & Factions) sur la carte de l'étape 1. */
export function regenererEtape2GeopolitiqueBrouillon(
  draft: WorldForgeDraft,
  hero: CharacterStats
): WorldForgeDraft {
  const sim = genererMondeAzgaarStudio(
    {
      seed: draft.config.seed,
      template: draft.config.template,
      climateBias: draft.config.climateBias,
      cellsDesired: draft.config.cellsDesired,
      windAngle: draft.config.windAngle,
      worldName: draft.config.worldName,
      stylePreset: draft.config.stylePreset,
      rayonAnneaux: draft.config.rayonAnneaux,
      statesCount: draft.config.statesCount,
      culturesCount: draft.config.culturesCount,
      religionsCount: draft.config.religionsCount,
      burgsCount: draft.config.burgsCount,
      conserverHeros: draft.config.conserverHeros,
    },
    { ...INITIAL_SIMULATION_STATE, personnage: hero }
  );

  const studio = sim.azgaarStudio!;
  studio.seaLevel = draft.config.seaLevel;
  const lore = genererLoreProcedural(studio, sim.factions, draft.config);
  const pnjs = genererPnjsProcedural(studio, sim.factions, sim.hexagones, lore, hero, draft.config);

  return {
    ...draft,
    studio,
    factions: sim.factions,
    hexagones: sim.hexagones,
    lore,
    pnjs,
    etapesValidees: { ...draft.etapesValidees, 2: false, 3: false, 4: false },
    sourceParEtape: { ...draft.sourceParEtape, 2: 'PROCEDURAL' },
  };
}

/** Applique un brouillon de forge validé à la simulation active. */
export function appliquerBrouillonForgeASimulation(
  draft: WorldForgeDraft,
  baseState?: SimulationState
): SimulationState {
  const studioClone: AzgaarWorldState = JSON.parse(JSON.stringify(draft.studio));
  if (draft.config.heroBurgId) {
    const chosen = studioClone.burgs.find(b => b.id === draft.config.heroBurgId);
    if (chosen) {
      studioClone.heroBurgId = chosen.id;
      studioClone.heroCell = chosen.cell;
      studioClone.heroX = chosen.x;
      studioClone.heroY = chosen.y;
      studioClone.originHexX = chosen.x;
      studioClone.originHexY = chosen.y;
    }
  }
  studioClone.layers = {
    ...studioClone.layers,
    etats: true,
    bourgs: true,
    rivieres: true,
    routes: true,
  };

  const geo = reconstruireAtlasComplet(studioClone);
  const sim = projeterSimulationDepuisAzgaarStudio(
    studioClone,
    geo,
    draft.config.conserverHeros ? baseState : undefined,
    draft.config.rayonAnneaux
  );

  sim.factions = sim.factions.map((f, idx) => {
    const match = draft.factions.find(df => df.id === f.id) || draft.factions[idx];
    if (!match) return f;
    return {
      ...f,
      nom: match.nom,
      posture: match.posture,
      relationsJoueur: match.relationsJoueur,
      objectifs: match.objectifs,
    };
  });

  sim.grapheNoeuds = sim.grapheNoeuds.filter(n => n.type !== 'Actor');
  sim.grapheLiens = sim.grapheLiens.filter(l => !l.source.startsWith('npc_'));
  const loreApplique = JSON.parse(JSON.stringify(draft.lore)) as typeof draft.lore;
  const pnjsAppliques = JSON.parse(JSON.stringify(draft.pnjs)) as typeof draft.pnjs;
  sim.loreMonde = loreApplique;
  sim.pnjsMonde = pnjsAppliques;

  const arcs: CampaignArc[] = (loreApplique.arcsInitiaux || []).map((a, idx) => ({
    id: a.id || `arc_forge_${idx}`,
    titre: a.titre,
    statut: 'ACTIF',
    progression: 10,
    resume: `${a.resume} Enjeu : ${a.enjeu}`,
    acteursLies: a.acteursNoms,
    prochaineEtape: a.prochaineEtape,
    derniereMajJour: 1,
  }));

  const notesSecretes: GmSecretNote[] = (loreApplique.secretsMondeMJ || []).map((txt, idx) => ({
    id: `sec_forge_${idx}`,
    jour: 1,
    titre: `Secret du Monde #${idx + 1}`,
    contenu: txt,
    categorie: 'MONDE',
    resolu: false,
  }));

  sim.memoireMJ = {
    filNarratif: [
      `Jour 1, 08:00 — Arrivée à ${sim.hexActuel.nom} (${sim.azgaarStudio?.worldName || 'Monde'}).`,
    ],
    promessesEtQuetes: [],
    consequencesDifferees: [],
    arcsNarratifs: arcs,
    journalSecretMJ: notesSecretes,
  };

  const liensHeros = pnjsAppliques.filter(p => p.estLienHeros);
  if (sim.personnage) {
    const infos = [
      loreApplique.regionsLore[0]?.histoireLocale || `Vous arrivez à ${sim.hexActuel.nom}.`,
      ...liensHeros.slice(0, 2).map(p => `${p.nom} (${p.profession}) : ${p.lienHerosNature || p.resumePublic}`),
    ];
    sim.personnage.memoire = {
      dernieresInfos: infos.slice(0, 4),
      souvenirsContextuels: [loreApplique.genese],
    };
  }

  reconcilierProximitePnjs(sim, draft.config.radiusProche);
  return sim;
}
