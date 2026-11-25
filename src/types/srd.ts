import { Ability } from './index';

export type SrdCategory = 'monstre' | 'objet' | 'sort' | 'regle' | 'classe_race';

export type MonsterSize = 'TP' | 'P' | 'M' | 'G' | 'TG' | 'Gig';

export type CreatureType =
  | 'Aberration'
  | 'Artificiel'
  | 'Bête'
  | 'Céleste'
  | 'Dragon'
  | 'Élémentaire'
  | 'Fée'
  | 'Fiélon'
  | 'Géant'
  | 'Humanoïde'
  | 'Monstruosité'
  | 'Mort-vivant'
  | 'Plante'
  | 'Vase';

export interface MonsterAction {
  nom: string;
  bonusAttaque?: number;
  degatsDes?: string;
  typeDegats?: string;
  portee?: string;
  desc: string;
}

export interface MonsterEntry {
  id: string;
  categorie: 'monstre';
  nom: string;
  nomEn: string;
  taille: MonsterSize;
  typeCreature: CreatureType;
  alignement: string;
  ca: number;
  pv: number;
  desVie: string;
  vitesse: string;
  caracteristiques: Record<Ability, number>;
  sauvegardes?: Partial<Record<Ability, number>>;
  competences?: string[];
  vulnerabilites?: string[];
  resistances?: string[];
  immunites?: string[];
  sens?: string;
  langues?: string;
  fp: string;
  fpNum: number;
  xp: number;
  biomes: string[];
  comportement: 'RUSE_ET_FUITE' | 'AVEUGLE_CORPS_A_CORPS' | 'TACTIQUE_COORDINATION';
  traits?: Array<{ nom: string; desc: string }>;
  actions: MonsterAction[];
  butinTypique?: string[];
  motsCles: string[];
  resume: string;
}

export type ItemSubCategory =
  | 'arme'
  | 'armure'
  | 'equipement'
  | 'outil'
  | 'monture'
  | 'potion'
  | 'objet_magique'
  | 'service';

export interface ItemEntry {
  id: string;
  categorie: 'objet';
  sousCategorie: ItemSubCategory;
  nom: string;
  nomEn: string;
  valeurPC: number;
  poidsLbs: number;
  rarete: 'Commun' | 'Peu commun' | 'Rare' | 'Très rare' | 'Légendaire';
  lienRequis?: boolean;
  degats?: string;
  typeDegats?: string;
  proprietesArme?: string[];
  portee?: string;
  caBase?: number;
  categorieArmure?: 'Légère' | 'Intermédiaire' | 'Lourde' | 'Bouclier';
  dexMax?: number;
  forceRequise?: number;
  desavantageDiscretion?: boolean;
  estConsommable?: boolean;
  disponibleComptoir?: boolean;
  categorieComptoir?: 'Survie' | 'Armurerie' | 'Soins' | 'Outils' | 'Montures';
  effet: string;
  motsCles: string[];
  resume: string;
}

export interface SpellEntry {
  id: string;
  categorie: 'sort';
  nom: string;
  nomEn: string;
  niveau: number;
  ecole: string;
  rituel: boolean;
  concentration: boolean;
  tempsIncantation: string;
  portee: string;
  composantes: string;
  duree: string;
  classes: string[];
  degatsOuSoin?: string;
  typeDegats?: string;
  jetSauvegarde?: Ability;
  description: string;
  niveauxSuperieurs?: string;
  motsCles: string[];
  resume: string;
}

export type RuleDomain =
  | 'etat'
  | 'combat'
  | 'exploration'
  | 'repos'
  | 'magie'
  | 'environnement'
  | 'economie'
  | 'progression';

export interface RuleEntry {
  id: string;
  categorie: 'regle';
  domaine: RuleDomain;
  nom: string;
  nomEn: string;
  resume: string;
  regleExacte: string;
  modificateurs?: string[];
  motsCles: string[];
}

export interface OptionEntry {
  id: string;
  categorie: 'classe_race';
  sousType: 'classe' | 'race' | 'historique' | 'don';
  nom: string;
  nomEn: string;
  deVie?: string;
  caracteristiquesCles?: Ability[];
  bonusCaracteristiques?: string;
  vitesse?: string;
  maitrises?: string[];
  capacites: Array<{ niveau?: number; nom: string; desc: string }>;
  resume: string;
  motsCles: string[];
}

export type SrdEntry = MonsterEntry | ItemEntry | SpellEntry | RuleEntry | OptionEntry;

export interface SrdSearchQuery {
  requete?: string;
  idExact?: string;
  categorie?: SrdCategory | 'tout';
  sousCategorie?: string;
  biome?: string;
  fpMin?: number;
  fpMax?: number;
  niveauSort?: number;
  ecole?: string;
  domaine?: RuleDomain;
  prixMaxPC?: number;
  disponibleComptoir?: boolean;
  limite?: number;
}

export interface SrdSearchResult {
  entry: SrdEntry;
  score: number;
  correspondance: 'exact' | 'prefix' | 'bm25' | 'filtre';
}

export interface SrdManifestCategory {
  categorie: SrdCategory;
  label: string;
  actuel: number;
  cibleSrd: number;
  pourcentage: number;
  manquesSuggeres: string[];
}

export interface SrdManifest {
  totalActuel: number;
  totalCibleSrd: number;
  categories: SrdManifestCategory[];
  ajoutsPersonnalises: number;
}
