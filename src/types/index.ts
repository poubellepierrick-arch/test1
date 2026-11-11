export type Ability = 'FOR' | 'DEX' | 'CON' | 'INT' | 'SAG' | 'CHA';

export type Condition = 'À terre' | 'Agrippé' | 'Étourdi' | 'Empoisonné' | 'Inconscient' | 'Aveuglé';

export type RestType = 'court' | 'long';

export type TerrainType = 'Plaine / Route' | 'Forêt Dense' | 'Marais Fétide' | 'Montagne Escarpée' | 'Désert Aride';

export type Pace = 'Lente' | 'Normale' | 'Rapide';

export type ExplorationRole = 'S\'orienter' | 'Forager' | 'Guetter';

export type SecurityLevel = 'Sûr' | 'Patrouillé' | 'Dangereux' | 'Périlleux';

export interface CharacterItem {
  id: string;
  nom: string;
  poidsLbs: number;
  valeurPO: number;
  quantite: number;
  estEquipe?: boolean;
}

export interface SpellSlot {
  niveau: number;
  total: number;
  utilise: number;
  recharge: RestType;
}

export interface Spell {
  id: string;
  nom: string;
  niveau: number; // 0 = Tour de magie
  ecole: string;
  tempsIncantation: string;
  portee: string;
  composantes: string;
  description: string;
  degatsOuSoin?: string;
  coutEmplacement: number;
  estRituel?: boolean;
}

export interface PersistentInjury {
  id: string;
  type: 'ENTORSE' | 'PLAIE_OUVERTE' | 'CONTUSION';
  nom: string;
  description: string;
  penalite: string;
  joursReposRestants: number;
}

export interface CharacterStats {
  id: string;
  nom: string;
  classe: string;
  niveau: number;
  pvActuels: number;
  pvMax: number;
  ca: number;
  vitessePieds: number;
  caracteristiques: Record<Ability, number>;
  sauvegardesMaitrisees: Ability[];
  competencesMaitrisees: string[];
  bonusMaitrise: number;
  epuisement: number; // 0 à 6 (6 = mort)
  deathSaves: {
    succes: number; // max 3
    echecs: number; // max 3
  };
  conditions: Condition[];
  monnaies: {
    po: number;
    pa: number;
    pc: number;
  };
  eauLitres: number;
  eauMaxLitres: number;
  rationsJours: number;
  rationsMaxJours: number;
  sourceLumiere: {
    nom: string;
    heuresRestantes: number;
    active: boolean;
  };
  inventaire: CharacterItem[];
  emplacementsSorts: SpellSlot[];
  estMortDefinitivement: boolean; // Permadeath
  heuresMarcheJour: number; // Pour marche forcée
  nuitsConsecutivesSansRepos: number; // Privation de repos
  experience: number;
  experienceNextLevel: number;
  reputationFactions: Record<string, number>; // -100 (Haine) à +100 (Allié)
  usureEquipement: Record<string, number>; // 0% (neuf) à 100% (brisé)
  compagnons: Hireling[];
  memoire: CharacterMemory;
  qualiteEau: 'Pure' | 'Douteuse' | 'Souillée';
  blessuresPersistantes: PersistentInjury[];
  sortsConnus: Spell[];
  sortsPrepares: string[];
}

export interface CharacterMemory {
  dernieresInfos: string[];
  souvenirsContextuels: string[];
}

export interface Hireling {
  id: string;
  nom: string;
  type: 'MULET' | 'PORTEUR' | 'MERCENAIRE';
  coutJournalierPA: number;
  chargeMaxLbs: number;
  pv: number;
  pvMax: number;
  bonusAttaque?: number;
}

export interface DungeonRoom {
  id: string;
  nom: string;
  description: string;
  visitee: boolean;
  danger: 'AUCUN' | 'PIEGE' | 'ENNEMI' | 'EFFONDREMENT';
  tresorPO?: number;
  fouillable: boolean;
  connexions: string[];
}

export interface DungeonState {
  actif: boolean;
  poiId: string;
  nom: string;
  salleActuelleId: string;
  salles: DungeonRoom[];
  journalDonjon: string[];
}

export interface Rumor {
  id: string;
  titre: string;
  texte: string;
  source: string;
  veracite: boolean;
  tickEmission: number;
}

export interface HexNode {
  id: string;
  q: number;
  r: number;
  nom: string;
  terrain: TerrainType;
  securite: SecurityLevel;
  factionControleId: string | null;
  visite: boolean;
  ressourcesEau: boolean;
  ressourcesGibier: boolean;
  brouillard: 'INCONNU' | 'REPERE' | 'EXPLORE';
  annotationJoueur?: string;
  pointInteret?: {
    id: string;
    nom: string;
    type: 'mine' | 'fort' | 'ruine' | 'bourgade' | 'camp';
    statut: 'OPERATIONNEL' | 'RUINED' | 'OCCUPIED' | 'ABANDONNE';
  };
}

export interface Faction {
  id: string;
  nom: string;
  richesse: number;
  forceMilitaire: number;
  influence: number;
  objectifs: string[];
  noeudsControles: string[];
  relationsJoueur: 'HOSTILE' | 'NEUTRE' | 'ALLIE';
}

export interface WorldMarket {
  multiplicateurFer: number;
  prixArmesFerModif: number;
  penurieArmurerie: boolean;
  securiteRoutes: SecurityLevel;
}

export interface WorldClock {
  tick: number;
  jour: number;
  heure: number;
  meteo: 'Ciel dégagé' | 'Pluie battante' | 'Brume glaciale' | 'Chaleur écrasante' | 'Vents violents';
  temperature: 'Tempéré' | 'Glacial' | 'Torride';
}

export type GraphNodeType = 'Actor' | 'Location' | 'Event' | 'Item';

export interface GraphNode {
  id: string;
  type: GraphNodeType;
  label: string;
  proprietes: Record<string, any>;
  connuParEntites?: string[]; // Boundary-aware propagation
}

export interface GraphEdge {
  source: string;
  cible: string;
  relation: 'BELONGS_TO' | 'ENEMIES_WITH' | 'KNOWS_SECRET' | 'LOCATED_IN' | 'ADJACENT_TO' | 'CONTROLLED_BY' | 'PRODUCES_RESOURCE' | 'CAUSED_BY' | 'AFFECTS_FACTION' | 'POSSESSED_BY';
  horodatageTick?: number;
}

export interface AdjudicationPayload {
  phase: 'adjudication_resolved';
  action_type: 'SKILL_CHECK' | 'ATTACK' | 'SPELL' | 'TRAVEL' | 'REST' | 'FORAGE' | 'DEATH_SAVE' | 'TACTICAL_FLEE' | 'TRADE' | 'WORK_CONTRACT' | 'NPC_INTERACTION' | 'DEFENSIVE_STANCE';
  competenceOuCarac?: string;
  dice_roll: number;
  deuxieme_de?: number;
  type_lancer?: 'normal' | 'avantage' | 'desavantage';
  modificateur: number;
  score_total: number;
  cible_dd_ou_ca: number;
  issue: 'SUCCESS' | 'FAILURE' | 'CRITICAL_SUCCESS' | 'CRITICAL_FAILURE' | 'PERMADEATH' | 'STABILIZED';
  mutations_etat: {
    pvDelta?: number;
    epuisementDelta?: number;
    eauDelta?: number;
    rationsDelta?: number;
    heuresEcoulees?: number;
    objetObtenu?: string;
    objetPerdu?: string;
    degatsInfliges?: number;
    emplacementConsomme?: number;
    statutHexModifie?: string;
    descriptionTechnique: string;
  };
}

export interface Combatant {
  id: string;
  nom: string;
  type: 'JOUEUR' | 'GOBELIN' | 'ZOMBIE' | 'BANDIT';
  pv: number;
  pvMax: number;
  ca: number;
  initiative: number;
  distancePieds: number; // distance relative au joueur
  statut: 'ACTIF' | 'A_TERRE' | 'FUITE' | 'MORT';
  bonusAttaque: number;
  degatsDes: string; // ex: '1d6+2'
  comportement: 'RUSE_ET_FUITE' | 'AVEUGLE_CORPS_A_CORPS' | 'TACTIQUE_COORDINATION';
}

export interface CombatState {
  actif: boolean;
  round: number;
  combattantActifIndex: number;
  ordreInitiative: string[];
  ennemis: Combatant[];
  journalCombat: string[];
  postureDefensive?: boolean;
}

export interface ExecutionTrace {
  seq: number;
  timestamp: string;
  actionType: string;
  donneesEntree: Record<string, any>;
  promptSystemeIa?: string;
  promptUtilisateurIa?: string;
  reponseBruteIa?: string;
  modeleIa?: string;
  latenceMs: number;
  donneesUtilisees: {
    reglesSrd: string[];
    attributsPersonnage: string[];
    noeudsGraphInjectes: string[];
    noeudsGraphFiltresMasques: string[];
    hexagonesInterroges: string[];
    factionsImpliquees: string[];
    formuleMathematique?: string;
  };
}

export interface NarrativeEvent {
  _seq: number;
  horodatageTick: number;
  horodatageDate: string;
  titre: string;
  texteNarratif: string;
  tonAmbiance?: 'CHAMPETRE' | 'SOMBRE' | 'PERIL' | 'NEUTRE';
  suggestionsMJ?: string[];
  adjudication?: AdjudicationPayload;
  evenementFaction?: {
    factionNom: string;
    cibleNoeudNom: string;
    action: string;
    impact: string;
  };
  trace?: ExecutionTrace;
}

export interface SimulationState {
  _seq: number;
  horloge: WorldClock;
  personnage: CharacterStats;
  hexActuel: HexNode;
  hexagones: HexNode[];
  marcheAllure: Pace;
  roleExploration: ExplorationRole;
  factions: Faction[];
  marche: WorldMarket;
  combat: CombatState;
  grapheNoeuds: GraphNode[];
  grapheLiens: GraphEdge[];
  journalNarratif: NarrativeEvent[];
  historiqueTraces?: ExecutionTrace[];
  rumeurs: Rumor[];
  donjon?: DungeonState | null;
}
