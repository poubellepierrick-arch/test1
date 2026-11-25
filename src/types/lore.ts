import type {
  AzgaarStylePreset,
  AzgaarTemplateId,
  AzgaarWorldState,
} from './azgaar';
import type { AzgaarClimateBias, Faction, HexNode } from './index';

export type WorldNpcTier =
  | 'MAJEUR_MONDE'
  | 'LIEN_HEROS'
  | 'PROCHE_PREGEN'
  | 'LAMBDA_LOINTAIN';

export type WorldNpcDetailLevel = 'COMPLET' | 'LOCAL' | 'LEGER';

export type WorldNpcImportance =
  | 'SOUVERAIN'
  | 'CHEF_FACTION'
  | 'AUTORITE_CULTE'
  | 'MENTOR'
  | 'RIVAL'
  | 'CONTACT'
  | 'CIBLE_ARC'
  | 'CITOYEN';

export interface WorldNpcRecord {
  id: string;
  nom: string;
  profession: string;
  tier: WorldNpcTier;
  detailLevel: WorldNpcDetailLevel;
  importance: WorldNpcImportance;
  generationSource: 'GEMINI' | 'PROCEDURAL' | 'MANUEL';
  enrichmentPending?: boolean;
  burgId?: number;
  hexId?: string;
  stateId?: number;
  factionId?: string;
  cultureId?: number;
  religionId?: number;
  arcIds?: string[];
  distanceHex: number;
  proximityScore: number;
  estLienHeros?: boolean;
  lienHerosNature?: string;
  alignement: string;
  disposition: 'AMICAL' | 'NEUTRE' | 'MEFIANT' | 'HOSTILE';
  humeur: string;
  seuilDD: number;
  apparence: string;
  voixEtManies: string;
  resumePublic: string;
  biographie: string;
  motivationImmediate: string;
  objectifLongTerme?: string;
  secret?: string;
  rumeurConnue?: {
    titre: string;
    texte: string;
  };
  suggestions: string[];
  connaitPnjIds?: string[];
  decouvertParJoueur: boolean;
}

export interface WorldLoreEra {
  id: string;
  periode: string;
  titre: string;
  resume: string;
  tracesActuelles: string;
}

export interface WorldStateLore {
  stateId: number;
  nom: string;
  devise: string;
  histoire: string;
  tensionInterne: string;
  secretEtat?: string;
}

export interface WorldReligionLore {
  religionId: number;
  nom: string;
  dogme: string;
  rites: string;
  clerge: string;
  heresieSecrete?: string;
}

export interface WorldRegionLore {
  id: string;
  burgId?: number;
  hexId?: string;
  nom: string;
  histoireLocale: string;
  legendePopulaire: string;
  particulariteEconomique: string;
  secretLocal?: string;
}

export interface WorldLoreArcSeed {
  id: string;
  titre: string;
  resume: string;
  acteursNoms: string[];
  enjeu: string;
  prochaineEtape: string;
}

export interface WorldLoreBundle {
  version: number;
  tonalite: string;
  generationSource: 'GEMINI' | 'PROCEDURAL' | 'MANUEL';
  genese: string;
  chroniqueEres: WorldLoreEra[];
  etatsLore: WorldStateLore[];
  religionsLore: WorldReligionLore[];
  regionsLore: WorldRegionLore[];
  arcsInitiaux: WorldLoreArcSeed[];
  secretsMondeMJ: string[];
}

export type WorldForgeStep = 1 | 2 | 3 | 4;

export interface WorldForgeConfig {
  seed: number;
  worldName: string;
  template: AzgaarTemplateId;
  climateBias: AzgaarClimateBias;
  cellsDesired: 800 | 1500 | 2400;
  seaLevel: number;
  windAngle: number;
  stylePreset: AzgaarStylePreset;
  rayonAnneaux: number;
  statesCount: number;
  culturesCount: number;
  religionsCount: number;
  burgsCount: number;
  conserverHeros: boolean;
  tonalite: string;
  customPrompt: string;
  heroBurgId?: number;
  radiusProche: number;
  lambdaParBourg: number;
}

export interface WorldForgeDraft {
  etapeCourante: WorldForgeStep;
  etapesValidees: Record<WorldForgeStep, boolean>;
  config: WorldForgeConfig;
  studio: AzgaarWorldState;
  factions: Faction[];
  hexagones: HexNode[];
  lore: WorldLoreBundle;
  pnjs: WorldNpcRecord[];
  sourceParEtape: Partial<Record<WorldForgeStep, 'GEMINI' | 'PROCEDURAL'>>;
  notesParEtape?: Partial<Record<WorldForgeStep, string>>;
}
