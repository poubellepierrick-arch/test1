import type { AzgaarClimateBias } from './index';

export type AzgaarTemplateId =
  | 'continent'
  | 'archipel'
  | 'peninsule'
  | 'mediterranee'
  | 'detroit'
  | 'volcan'
  | 'haute_chaine';

export type AzgaarStylePreset =
  | 'classique'
  | 'parchemin'
  | 'politique'
  | 'relief'
  | 'sombre';

export type AzgaarLayerKey =
  | 'ocean'
  | 'relief'
  | 'biomes'
  | 'etats'
  | 'provinces'
  | 'cultures'
  | 'religions'
  | 'rivieres'
  | 'routes'
  | 'routesMaritimes'
  | 'frontieres'
  | 'bourgs'
  | 'blasons'
  | 'marqueurs'
  | 'vents'
  | 'ressources'
  | 'fluxCommerciaux'
  | 'etiquettes'
  | 'grille';

export type RessourceNaturelleType =
  | 'FER'
  | 'OR'
  | 'PIERRE'
  | 'BOIS'
  | 'CEREALES'
  | 'ELEVAGE'
  | 'POISSON_SEL'
  | 'HERBES_ARCANES';

export interface AzgaarResourceNode {
  id: string;
  type: RessourceNaturelleType;
  nom: string;
  x: number;
  y: number;
  cell: number;
  hexId?: string;
  richesse: number; // 1 à 5
  reserve: number; // 0 à 100
  exploiteParStateId?: number;
}

export interface AzgaarTradeRouteFlow {
  id: string;
  routeId?: string;
  fromBurgId: number;
  toBurgId: number;
  denree: RessourceNaturelleType;
  volume: number; // 1 à 5
  kind: 'road' | 'trail' | 'sea';
  points: Array<[number, number]>;
}

export type AzgaarCoatDivision = 'uni' | 'parti' | 'coupe' | 'ecartele' | 'chevron' | 'pal';
export type AzgaarCoatCharge =
  | 'tour'
  | 'epee'
  | 'couronne'
  | 'lion'
  | 'ancre'
  | 'soleil'
  | 'lune'
  | 'arbre'
  | 'etoile'
  | 'bouclier';

export interface AzgaarCoatOfArms {
  fieldColor: string;
  secondaryColor: string;
  division: AzgaarCoatDivision;
  charge: AzgaarCoatCharge;
  chargeColor: string;
}

export type AzgaarDiplomacyStatus = 'Allie' | 'Paix' | 'Rival' | 'Guerre';

export interface AzgaarStateDef {
  id: number;
  name: string;
  color: string;
  government: string;
  cultureId: number;
  capitalBurgId: number;
  diplomacy: Record<number, AzgaarDiplomacyStatus>;
  coa: AzgaarCoatOfArms;
  factionId?: string;
}

export interface AzgaarProvinceDef {
  id: number;
  name: string;
  stateId: number;
  centerCell: number;
  color: string;
  capitalBurgId?: number;
}

export interface AzgaarCultureStudioDef {
  id: number;
  name: string;
  type: 'Urbaine' | 'Maritime' | 'Montagnarde' | 'Sylvestre' | 'Nomade';
  color: string;
  centerCell: number;
}

export interface AzgaarReligionDef {
  id: number;
  name: string;
  type: 'Pantheon' | 'Monotheisme' | 'Culte naturel' | 'Heresie';
  color: string;
  centerCell: number;
  deity: string;
}

export interface AzgaarBurgDef {
  id: number;
  name: string;
  cell: number;
  x: number;
  y: number;
  stateId: number;
  provinceId: number;
  cultureId: number;
  religionId: number;
  population: number;
  capital: boolean;
  port: boolean;
  citadel: boolean;
  walls: boolean;
  plaza: boolean;
  temple: boolean;
  garrison: number;
  coa: AzgaarCoatOfArms;
  hexId?: string;
  specialisation?: string;
  exportations?: RessourceNaturelleType[];
  importations?: RessourceNaturelleType[];
  indicePrix?: number;
  tresorerie?: number;
}

export interface AzgaarRiverStudioDef {
  id: number;
  name: string;
  cells: number[];
  points: Array<[number, number]>;
  widthFactor: number;
  discharge: number;
}

export interface AzgaarRouteStudioDef {
  id: string;
  kind: 'road' | 'trail' | 'sea';
  points: Array<[number, number]>;
  fromBurgId?: number;
  toBurgId?: number;
}

export type AzgaarMarkerIcon =
  | 'donjon'
  | 'ruine'
  | 'danger'
  | 'port'
  | 'camp'
  | 'quete'
  | 'note';

export interface AzgaarMarkerDef {
  id: string;
  icon: AzgaarMarkerIcon;
  title: string;
  note: string;
  x: number;
  y: number;
  cell?: number;
  author: 'JOUEUR' | 'MJ';
  createdDay?: number;
}

export interface AzgaarOceanLabelDef {
  name: string;
  x: number;
  y: number;
}

export interface AzgaarCellOverrides {
  height?: Record<number, number>;
  biome?: Record<number, number>;
  state?: Record<number, number>;
  province?: Record<number, number>;
  culture?: Record<number, number>;
  religion?: Record<number, number>;
}

export interface AzgaarImportedCellSnapshot {
  x: number;
  y: number;
  h: number;
  biome: number;
  state: number;
  province: number;
  culture: number;
  religion: number;
}

export interface AzgaarWorldState {
  seed: number;
  worldName: string;
  width: number;
  height: number;
  cellsDesired: 800 | 1500 | 2400;
  template: AzgaarTemplateId;
  climateBias: AzgaarClimateBias;
  windAngle: number;
  seaLevel: number;
  stylePreset: AzgaarStylePreset;
  stateOpacity: number;
  layers: Record<AzgaarLayerKey, boolean>;
  states: AzgaarStateDef[];
  provinces: AzgaarProvinceDef[];
  cultures: AzgaarCultureStudioDef[];
  religions: AzgaarReligionDef[];
  burgs: AzgaarBurgDef[];
  rivers: AzgaarRiverStudioDef[];
  routes: AzgaarRouteStudioDef[];
  markers: AzgaarMarkerDef[];
  oceanLabels: AzgaarOceanLabelDef[];
  resources?: AzgaarResourceNode[];
  tradeFlows?: AzgaarTradeRouteFlow[];
  heroCell?: number;
  heroBurgId?: number;
  heroX?: number;
  heroY?: number;
  originHexX?: number;
  originHexY?: number;
  overrides: AzgaarCellOverrides;
  importedCells?: AzgaarImportedCellSnapshot[];
}

export interface AzgaarGenerationCounts {
  statesCount?: number;
  culturesCount?: number;
  religionsCount?: number;
  burgsCount?: number;
}

export interface AzgaarVoronoiCell {
  index: number;
  x: number;
  y: number;
  polygon: Array<[number, number]>;
  neighbors: number[];
  h: number;
  isLand: boolean;
  isCoast: boolean;
  isShallow: boolean;
  temp: number;
  precip: number;
  flux: number;
  biome: number;
  stateId: number;
  provinceId: number;
  cultureId: number;
  religionId: number;
}

export type AzgaarReliefKind =
  | 'mountain'
  | 'peak_small'
  | 'tree_round'
  | 'tree_pine'
  | 'palm'
  | 'marsh'
  | 'dune'
  | 'grass';

export interface AzgaarReliefSymbol {
  id: string;
  kind: AzgaarReliefKind;
  x: number;
  y: number;
  scale: number;
}

export interface AzgaarBridgeFeature {
  id: string;
  x: number;
  y: number;
  angle: number;
}

export interface AzgaarWaterfallFeature {
  id: string;
  x: number;
  y: number;
}

export interface AzgaarShipFeature {
  id: string;
  x: number;
  y: number;
  angle: number;
  scale: number;
}

export interface AzgaarSeaMonsterFeature {
  id: string;
  variant: 'serpent' | 'kraken';
  x: number;
  y: number;
  scale: number;
}

export interface AzgaarReconstructedGeometry {
  cells: AzgaarVoronoiCell[];
  coastSegments: Array<[[number, number], [number, number]]>;
  stateBorders: Array<{ stateId: number; segments: Array<[[number, number], [number, number]]> }>;
  provinceBorders: Array<[[number, number], [number, number]]>;
  stateLabels: Array<{ stateId: number; name: string; x: number; y: number; radius: number }>;
  windVectors: Array<{ x: number; y: number; dx: number; dy: number }>;
  reliefSymbols: AzgaarReliefSymbol[];
  bridges: AzgaarBridgeFeature[];
  waterfalls: AzgaarWaterfallFeature[];
  ships: AzgaarShipFeature[];
  seaMonsters: AzgaarSeaMonsterFeature[];
}
