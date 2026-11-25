import type { RessourceNaturelleType } from './azgaar';

export type Ability = 'FOR' | 'DEX' | 'CON' | 'INT' | 'SAG' | 'CHA';

export type Condition = 'À terre' | 'Agrippé' | 'Étourdi' | 'Empoisonné' | 'Inconscient' | 'Aveuglé';

export type RestType = 'court' | 'long';

export type TerrainType = 'Plaine / Route' | 'Forêt Dense' | 'Marais Fétide' | 'Montagne Escarpée' | 'Désert Aride';

export type Pace = 'Lente' | 'Normale' | 'Rapide';

export type ExplorationRole = 'S\'orienter' | 'Forager' | 'Guetter';

export type SecurityLevel = 'Sûr' | 'Patrouillé' | 'Dangereux' | 'Périlleux';

export type HeroDocumentCategory = 'Historique' | 'Lore' | 'Notes' | 'Capacités' | 'Autre';

export interface HeroDocument {
  id: string;
  titre: string;
  categorie: HeroDocumentCategory;
  contenu: string;
  actifPourMJ: boolean;
  majDate: string;
}

export interface CharacterItem {
  id: string;
  compendiumId?: string;
  nom: string;
  poidsLbs: number;
  valeurPO: number;
  quantite: number;
  estEquipe?: boolean;
  degats?: string;
  typeDegats?: string;
  proprietesArme?: string[];
  portee?: string;
  caBase?: number;
  categorie?: string;
  categorieArmure?: 'Légère' | 'Intermédiaire' | 'Lourde' | 'Bouclier';
  dexMax?: number;
  forceRequise?: number;
  effet?: string;
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
  race?: string;
  historique?: string;
  alignement?: string;
  traits?: string;
  capacites?: string[];
  notesPersonnelles?: string;
  documents?: HeroDocument[];
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
  piegeDD?: number;
  piegeCarac?: Ability;
  piegeDegats?: string;
  piegeDesc?: string;
  monstreIds?: string[];
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
  statutPerception?: 'INCERTAINE' | 'CONFIRMEE' | 'DEMENTIE';
  lieuObtention?: string;
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
  pressionDanger?: number; // 0 à 100
  prosperite?: number; // 0 à 100
  niveauEau?: number; // 0 à 100
  populationGibier?: number; // 0 à 100
  altitude?: number; // 0 à 100 (Azgaar heightmap)
  precipitations?: number; // 0 à 100 (Azgaar precipitation / rain shadow)
  temperatureC?: number; // Température locale en °C
  fluxHydro?: number; // Accumulation hydrologique (Azgaar river flux)
  population?: number; // Population locale (Azgaar burgs/cells)
  culture?: string; // Culture dominante locale
  garnison?: number; // Force de garnison locale (0 à 100)
  routeNiveau?: 'ROUTE' | 'PISTE' | 'AUCUNE'; // Type de voie terrestre
  estEau?: boolean; // Cellule maritime ou lacustre Azgaar (infranchissable à pied)
  estRivage?: boolean; // Terre côtière bordant une cellule d'eau
  biomeAzgaar?: string; // Classification climatique Azgaar (Taïga, Forêt tempérée, etc.)
  bassinHydroId?: string; // Bassin fluvial principal
  provinceNom?: string; // Province ou marche régionale
  ressourcePrincipale?: RessourceNaturelleType;
  ressourcesDetail?: Array<{ type: RessourceNaturelleType; richesse: number; reserve: number }>;
  specialiteEconomique?: string;
  soldeVivres?: number;
  soldeMinerai?: number;
  annotationJoueur?: string;
  pointInteret?: {
    id: string;
    nom: string;
    type: 'mine' | 'fort' | 'ruine' | 'bourgade' | 'camp';
    statut: 'OPERATIONNEL' | 'RUINED' | 'OCCUPIED' | 'ABANDONNE';
  };
}

export type AzgaarReliefPreset = 'vallee' | 'continent' | 'archipel' | 'peninsule' | 'monts';
export type AzgaarClimateBias = 'tempere' | 'boreal' | 'aride';

export interface AzgaarRiverDef {
  id: string;
  nom: string;
  hexIds: string[];
  debit: number;
}

export interface AzgaarRoadDef {
  id: string;
  hexIds: string[];
  kind: 'main' | 'trail';
}

export interface AzgaarCultureDef {
  id: string;
  nom: string;
  couleur: string;
  couleurBord: string;
  centreHexId: string;
}

export interface AzgaarMapMetadata {
  seed: number;
  nomMonde: string;
  modeleRelief: AzgaarReliefPreset;
  climatBias: AzgaarClimateBias;
  rayonAnneaux: number;
  niveauMer: number;
  rivieres: AzgaarRiverDef[];
  routes: AzgaarRoadDef[];
  cultures: AzgaarCultureDef[];
  labelsMer?: Array<{ nom: string; q: number; r: number }>;
}

export type FactionPosture = 'EXPANSION' | 'DEFENSE' | 'COMMERCE' | 'RAID' | 'TREVE';
export type FactionDiplomacy = 'GUERRE' | 'TENSION' | 'NEUTRE' | 'PACTE';

export interface Faction {
  id: string;
  nom: string;
  richesse: number;
  forceMilitaire: number;
  influence: number;
  objectifs: string[];
  noeudsControles: string[];
  relationsJoueur: 'HOSTILE' | 'NEUTRE' | 'ALLIE';
  posture?: FactionPosture;
  moral?: number; // 0 à 100
  effectifActif?: string;
  relationsFactions?: Record<string, FactionDiplomacy>;
  capitaleHexId?: string;
  cultureDominante?: string;
  populationTotale?: number;
  forceMax?: number; // Plafond militaire dérivé de la population (Azgaar)
  lassitudeGuerre?: number; // 0 à 100 (War exhaustion)
  revenuFiscal?: number; // Revenu net au dernier tick
}

export interface WorldMarket {
  multiplicateurFer: number;
  prixArmesFerModif: number;
  penurieArmurerie: boolean;
  securiteRoutes: SecurityLevel;
  multiplicateurVivres?: number;
  penurieVivres?: boolean;
  demandeLocale?: string;
  tendanceFer?: 'HAUSSE' | 'BAISSE' | 'STABLE';
  tendanceVivres?: 'HAUSSE' | 'BAISSE' | 'STABLE';
  indiceTensionCommerciale?: number; // 0 à 100
  volumeEchanges?: number;
}

export interface WorldClock {
  tick: number;
  jour: number;
  heure: number;
  phaseJournee?: 'Aube' | 'Matin' | 'Midi' | 'Soir' | 'Nuit';
  meteo: 'Ciel dégagé' | 'Pluie battante' | 'Brume glaciale' | 'Chaleur écrasante' | 'Vents violents';
  temperature: 'Tempéré' | 'Glacial' | 'Torride';
  saison?: 'Printemps' | 'Été' | 'Automne' | 'Hiver';
  tendanceMeteo?: 'Stable' | 'Dégradation' | 'Éclaircie';
}

export type WorldEntityType = 'CARAVANE' | 'PATROUILLE' | 'RAIDER' | 'MESSAGER' | 'REFUGIES';

export interface WorldEntity {
  id: string;
  nom: string;
  type: WorldEntityType;
  factionId: string;
  hexId: string;
  origineHexId?: string;
  destinationHexId: string;
  itineraire?: string[]; // Itinéraire pondéré A*/Dijkstra (Azgaar routes)
  progresTrajetHeures?: number;
  force: number;
  cargaison?: 'Minerai' | 'Vivres' | 'Dépêche' | 'Butin' | 'Civils' | 'Bois' | 'Sel & Poisson' | 'Pierre' | 'Artisanat';
  statut: 'EN_ROUTE' | 'ARRIVE' | 'INTERCEPTE' | 'DISPERSE';
  tickCreation: number;
  evenementId?: string;
}

export interface WorldChronicleEntry {
  id: string;
  tick: number;
  jour: number;
  echelle?: 'HEURE' | 'JOUR' | 'SEMAINE' | 'MOIS';
  categorie: 'FACTION' | 'ECONOMIE' | 'METEO' | 'MOUVEMENT' | 'DIPLOMATIE' | 'EVENEMENT' | 'SUPERVISION_IA';
  titre: string;
  impact: string;
  causeDirecte?: string;
  consequences?: string;
  superviseParIa?: boolean;
  hexId?: string;
  factionId?: string;
}

export interface WorldSnapshotMetric {
  tick: number;
  jour: number;
  meteo: string;
  multiplicateurFer: number;
  multiplicateurVivres: number;
  pressionMoyenne: number;
  prosperiteMoyenne: number;
  entitesActives: number;
  forcesFactions: Record<string, number>;
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
  action_type:
    | 'SKILL_CHECK'
    | 'ATTACK'
    | 'SPELL'
    | 'TRAVEL'
    | 'REST'
    | 'FORAGE'
    | 'DEATH_SAVE'
    | 'TACTICAL_FLEE'
    | 'TRADE'
    | 'WORK_CONTRACT'
    | 'NPC_INTERACTION'
    | 'DEFENSIVE_STANCE'
    | 'EQUIPMENT'
    | 'CHARACTER_UPDATE'
    | 'COMBAT_MOVEMENT'
    | 'SAVING_THROW'
    | 'NARRATION_CONFIG'
    | 'DUNGEON_GENERATION';
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
  monstreId?: string;
  nom: string;
  type: string;
  pv: number;
  pvMax: number;
  ca: number;
  initiative: number;
  distancePieds: number; // distance relative au joueur
  statut: 'ACTIF' | 'A_TERRE' | 'FUITE' | 'MORT';
  bonusAttaque: number;
  degatsDes: string; // ex: '1d6+2'
  typeDegats?: string;
  fp?: string;
  xp?: number;
  resistances?: string[];
  immunites?: string[];
  vulnerabilites?: string[];
  traits?: Array<{ nom: string; desc: string }>;
  attaques?: Array<{ nom: string; bonusAttaque?: number; degatsDes?: string; typeDegats?: string; desc: string }>;
  butinTypique?: string[];
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
  actionDisponible?: boolean;
  actionBonusDisponible?: boolean;
  mouvementRestantPieds?: number;
  desengage?: boolean;
  initiatives?: Record<string, number>;
}

export type NarrationMode = 'ULTRA_COURT' | 'CONCIS' | 'DEVELOPPE';

export type ThinkingDepth = 'LOW' | 'MEDIUM' | 'HIGH' | 'XHIGH';

export type HydrogenModelProfile = 'STANDARD' | 'MAX';

export interface CampaignArc {
  id: string;
  titre: string;
  statut: 'ACTIF' | 'RESOLU' | 'ECHOUE';
  progression: number; // 0 à 100
  resume: string;
  acteursLies?: string[];
  prochaineEtape?: string;
  derniereMajJour?: number;
}

export interface GmSecretNote {
  id: string;
  jour: number;
  titre: string;
  contenu: string;
  categorie: 'INTRIGUE' | 'PNJ' | 'MONDE' | 'DONJON';
  resolu?: boolean;
}

export interface PendingRollRequest {
  id: string;
  titre: string;
  caracteristique: Ability;
  competence?: string;
  dd: number;
  typeJet?: 'sauvegarde' | 'competence';
  contexte: string;
  enjeuSucces: string;
  enjeuEchec: string;
  optionAlternative?: string;
}

export interface CoherenceReport {
  statut: 'VALIDE' | 'CORRIGE' | 'ALERTE';
  controlesPasses: string[];
  anomalies: string[];
  corrections: string[];
}

export interface GmPromiseQuest {
  id: string;
  titre: string;
  interlocuteur: string;
  statut: 'PROPOSEE' | 'EN_COURS' | 'ACCOMPLIE' | 'TRAHIE' | 'EXPIREE' | 'DECLINEE';
  echeanceJour?: number;
  details: string;
}

export interface DeferredConsequence {
  id: string;
  declencheur: string;
  effetPrevu: string;
  actif: boolean;
}

export interface GmMemoryState {
  filNarratif: string[];
  promessesEtQuetes: GmPromiseQuest[];
  consequencesDifferees: DeferredConsequence[];
  chroniqueCondensee?: string;
  arcsNarratifs?: CampaignArc[];
  journalSecretMJ?: GmSecretNote[];
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
  niveauReflexion?: ThinkingDepth;
  motifReflexion?: string;
  appelsOutils?: Array<{ nom: string; args: Record<string, any>; resultat: string }>;
  notesSecretesTour?: string[];
  rapportCoherence?: CoherenceReport;
  latenceMs: number;
  donneesUtilisees: {
    reglesSrd: string[];
    fichesSrdConsultees?: string[];
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
  actionJoueur?: string;
  texteNarratif: string;
  tonAmbiance?: 'CHAMPETRE' | 'SOMBRE' | 'PERIL' | 'NEUTRE';
  suggestionsMJ?: string[];
  jetDemande?: PendingRollRequest;
  adjudication?: AdjudicationPayload;
  evenementFaction?: {
    factionNom: string;
    cibleNoeudNom: string;
    action: string;
    impact: string;
  };
  pnjApproche?: {
    id: string;
    nom: string;
    role: string;
    motif: string;
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
  memoireMJ?: GmMemoryState;
  modeNarration?: NarrationMode;
  profilHydrogen?: HydrogenModelProfile;
  jetEnAttente?: PendingRollRequest | null;
  entitesMonde?: WorldEntity[];
  chroniqueMonde?: WorldChronicleEntry[];
  historiqueMonde?: WorldSnapshotMetric[];
  carteAzgaar?: AzgaarMapMetadata;
  azgaarStudio?: import('./azgaar').AzgaarWorldState;
  loreMonde?: import('./lore').WorldLoreBundle;
  pnjsMonde?: import('./lore').WorldNpcRecord[];
}

export * from './azgaar';
export * from './lore';
