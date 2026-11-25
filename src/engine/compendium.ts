import {
  ItemEntry,
  MonsterEntry,
  OptionEntry,
  RuleEntry,
  SpellEntry,
  SrdCategory,
  SrdEntry,
  SrdManifest,
  SrdManifestCategory,
  SrdSearchQuery,
  SrdSearchResult,
} from '../types/srd';
import { Combatant } from '../types';
import { MONSTERS_TIER1 } from '../data/srd/monsters_tier1';
import { MONSTERS_TIER2 } from '../data/srd/monsters_tier2';
import { ITEMS_GEAR } from '../data/srd/items_gear';
import { ITEMS_MAGIC } from '../data/srd/items_magic';
import { SPELLS_ALL } from '../data/srd/spells_all';
import { RULES_ALL } from '../data/srd/rules_all';
import { CLASSES_RACES } from '../data/srd/classes_races';
import customEntriesSeed from '../data/srd/custom_entries.json';

const CIBLES_SRD: Record<SrdCategory, { label: string; cible: number; poolSuggestions: string[] }> = {
  monstre: {
    label: 'Bestiaire',
    cible: 320,
    poolSuggestions: ['Goule', 'Blême', 'Gargouille', 'Spectre', 'Ogre', 'Minotaure', 'Ankheg', 'Méduse', 'Vampire', 'Dragon noir adulte'],
  },
  objet: {
    label: 'Objets & Prix',
    cible: 180,
    poolSuggestions: ['Hallebarde', 'Lance d\'arçon', 'Trident', 'Filet', 'Baguette de projectiles magiques', 'Anneau de protection', 'Sac sans fond', 'Botte elfique'],
  },
  sort: {
    label: 'Sorts',
    cible: 319,
    poolSuggestions: ['Bouclier de la foi', 'Détection du poison', 'Hâte', 'Lenteur', 'Dissipation de la magie', 'Éclair', 'Mur de feu', 'Télékinésie', 'Résurrection'],
  },
  regle: {
    label: 'Règles',
    cible: 24,
    poolSuggestions: ['Combat monté', 'Combat sous-marin', 'Chute et dégâts', 'Asphyxie', 'Pièges complexes'],
  },
  classe_race: {
    label: 'Classes & Races',
    cible: 25,
    poolSuggestions: ['Historique : Acolyte', 'Historique : Soldat', 'Don : Vigilant', 'Don : Tireur d\'élite'],
  },
};

export function normaliserTexte(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokeniser(texte: string): string[] {
  const norm = normaliserTexte(texte);
  if (!norm) return [];
  return norm.split(' ').map(mot => {
    if (mot.length >= 4 && (mot.endsWith('s') || mot.endsWith('x'))) {
      return mot.slice(0, -1);
    }
    return mot;
  });
}

function construireTexteSecondaire(entry: SrdEntry): string {
  if (entry.categorie === 'monstre') {
    return [
      entry.typeCreature,
      entry.fp,
      entry.biomes.join(' '),
      entry.traits?.map(t => `${t.nom} ${t.desc}`).join(' ') || '',
      entry.actions.map(a => `${a.nom} ${a.desc}`).join(' '),
    ].join(' ');
  }
  if (entry.categorie === 'objet') {
    return [
      entry.sousCategorie,
      entry.rarete,
      entry.effet,
      entry.proprietesArme?.join(' ') || '',
      entry.categorieComptoir || '',
    ].join(' ');
  }
  if (entry.categorie === 'sort') {
    return [
      entry.ecole,
      `niveau ${entry.niveau}`,
      entry.classes.join(' '),
      entry.description,
      entry.typeDegats || '',
    ].join(' ');
  }
  if (entry.categorie === 'regle') {
    return [entry.domaine, entry.regleExacte, entry.modificateurs?.join(' ') || ''].join(' ');
  }
  return [
    entry.sousType,
    entry.bonusCaracteristiques || '',
    entry.maitrises?.join(' ') || '',
    entry.capacites.map(c => `${c.nom} ${c.desc}`).join(' '),
  ].join(' ');
}

interface IndexedEntry {
  entry: SrdEntry;
  nomNorm: string;
  nomEnNorm: string;
  motsClesNorm: string[];
  resumeNorm: string;
  corpsNorm: string;
  tokensPoids: Map<string, number>;
}

const BASE_ENTRIES: SrdEntry[] = [
  ...MONSTERS_TIER1,
  ...MONSTERS_TIER2,
  ...ITEMS_GEAR,
  ...ITEMS_MAGIC,
  ...SPELLS_ALL,
  ...RULES_ALL,
  ...CLASSES_RACES,
];

let customEntriesMap = new Map<string, SrdEntry>();
let registryMap = new Map<string, IndexedEntry>();
let dfMap = new Map<string, number>();

export function validerEntreeSrd(raw: unknown): { valide: boolean; entry?: SrdEntry; erreur?: string } {
  if (!raw || typeof raw !== 'object') {
    return { valide: false, erreur: 'Entrée invalide (objet attendu).' };
  }
  const obj = raw as Record<string, any>;
  const id = typeof obj.id === 'string' ? obj.id.trim() : '';
  const nom = typeof obj.nom === 'string' ? obj.nom.trim() : '';
  const categorie = obj.categorie as SrdCategory;

  if (!id || !nom) {
    return { valide: false, erreur: 'Champs requis manquants : id et nom.' };
  }
  if (!['monstre', 'objet', 'sort', 'regle', 'classe_race'].includes(categorie)) {
    return { valide: false, erreur: `Catégorie invalide pour ${id} : ${String(categorie)}` };
  }

  const nomEn = typeof obj.nomEn === 'string' && obj.nomEn.trim() ? obj.nomEn.trim() : nom;
  const motsCles = Array.isArray(obj.motsCles) ? obj.motsCles.map(String) : [];
  const resume = typeof obj.resume === 'string' && obj.resume.trim() ? obj.resume.trim() : nom;

  if (categorie === 'monstre') {
    if (typeof obj.ca !== 'number' || typeof obj.pv !== 'number' || !Array.isArray(obj.actions)) {
      return { valide: false, erreur: `Monstre ${id} incomplet (ca, pv, actions requis).` };
    }
    const monstre: MonsterEntry = {
      id,
      categorie: 'monstre',
      nom,
      nomEn,
      taille: obj.taille || 'M',
      typeCreature: obj.typeCreature || 'Monstruosité',
      alignement: obj.alignement || 'Neutre',
      ca: obj.ca,
      pv: obj.pv,
      desVie: obj.desVie || '2d8',
      vitesse: obj.vitesse || '9 m',
      caracteristiques: obj.caracteristiques || { FOR: 10, DEX: 10, CON: 10, INT: 10, SAG: 10, CHA: 10 },
      sauvegardes: obj.sauvegardes,
      competences: obj.competences,
      vulnerabilites: obj.vulnerabilites,
      resistances: obj.resistances,
      immunites: obj.immunites,
      sens: obj.sens,
      langues: obj.langues,
      fp: String(obj.fp ?? '1'),
      fpNum: typeof obj.fpNum === 'number' ? obj.fpNum : Number(obj.fp) || 1,
      xp: typeof obj.xp === 'number' ? obj.xp : 200,
      biomes: Array.isArray(obj.biomes) ? obj.biomes : ['Donjon'],
      comportement:
        obj.comportement === 'RUSE_ET_FUITE' || obj.comportement === 'AVEUGLE_CORPS_A_CORPS'
          ? obj.comportement
          : 'TACTIQUE_COORDINATION',
      traits: Array.isArray(obj.traits) ? obj.traits : undefined,
      actions: obj.actions,
      butinTypique: Array.isArray(obj.butinTypique) ? obj.butinTypique : undefined,
      motsCles,
      resume,
    };
    return { valide: true, entry: monstre };
  }

  if (categorie === 'objet') {
    if (typeof obj.valeurPC !== 'number' || typeof obj.poidsLbs !== 'number') {
      return { valide: false, erreur: `Objet ${id} incomplet (valeurPC et poidsLbs requis).` };
    }
    const item: ItemEntry = {
      id,
      categorie: 'objet',
      sousCategorie: obj.sousCategorie || 'equipement',
      nom,
      nomEn,
      valeurPC: obj.valeurPC,
      poidsLbs: obj.poidsLbs,
      rarete: obj.rarete || 'Commun',
      lienRequis: obj.lienRequis,
      degats: obj.degats,
      typeDegats: obj.typeDegats,
      proprietesArme: obj.proprietesArme,
      portee: obj.portee,
      caBase: obj.caBase,
      categorieArmure: obj.categorieArmure,
      dexMax: obj.dexMax,
      forceRequise: obj.forceRequise,
      desavantageDiscretion: obj.desavantageDiscretion,
      estConsommable: obj.estConsommable,
      disponibleComptoir: obj.disponibleComptoir,
      categorieComptoir: obj.categorieComptoir,
      effet: typeof obj.effet === 'string' && obj.effet.trim() ? obj.effet : resume,
      motsCles,
      resume,
    };
    return { valide: true, entry: item };
  }

  if (categorie === 'sort') {
    if (typeof obj.niveau !== 'number' || typeof obj.ecole !== 'string') {
      return { valide: false, erreur: `Sort ${id} incomplet (niveau et ecole requis).` };
    }
    const sort: SpellEntry = {
      id,
      categorie: 'sort',
      nom,
      nomEn,
      niveau: obj.niveau,
      ecole: obj.ecole,
      rituel: Boolean(obj.rituel),
      concentration: Boolean(obj.concentration),
      tempsIncantation: obj.tempsIncantation || '1 action',
      portee: obj.portee || '18 m',
      composantes: obj.composantes || 'V, S',
      duree: obj.duree || 'Instantanée',
      classes: Array.isArray(obj.classes) ? obj.classes : ['Magicien'],
      degatsOuSoin: obj.degatsOuSoin,
      typeDegats: obj.typeDegats,
      jetSauvegarde: obj.jetSauvegarde,
      description: obj.description || resume,
      niveauxSuperieurs: obj.niveauxSuperieurs,
      motsCles,
      resume,
    };
    return { valide: true, entry: sort };
  }

  if (categorie === 'regle') {
    const regle: RuleEntry = {
      id,
      categorie: 'regle',
      domaine: obj.domaine || 'combat',
      nom,
      nomEn,
      resume,
      regleExacte: typeof obj.regleExacte === 'string' ? obj.regleExacte : resume,
      modificateurs: Array.isArray(obj.modificateurs) ? obj.modificateurs : undefined,
      motsCles,
    };
    return { valide: true, entry: regle };
  }

  const opt: OptionEntry = {
    id,
    categorie: 'classe_race',
    sousType: obj.sousType || 'don',
    nom,
    nomEn,
    deVie: obj.deVie,
    caracteristiquesCles: obj.caracteristiquesCles,
    bonusCaracteristiques: obj.bonusCaracteristiques,
    vitesse: obj.vitesse,
    maitrises: obj.maitrises,
    capacites: Array.isArray(obj.capacites) ? obj.capacites : [{ nom, desc: resume }],
    resume,
    motsCles,
  };
  return { valide: true, entry: opt };
}

function indexerEntree(entry: SrdEntry): IndexedEntry {
  const nomNorm = normaliserTexte(entry.nom);
  const nomEnNorm = normaliserTexte(entry.nomEn);
  const motsClesNorm = (entry.motsCles || []).map(normaliserTexte);
  const resumeNorm = normaliserTexte(entry.resume);
  const corpsNorm = normaliserTexte(construireTexteSecondaire(entry));

  const tokensPoids = new Map<string, number>();
  const ajouterPoids = (texte: string, poids: number) => {
    for (const tok of tokeniser(texte)) {
      tokensPoids.set(tok, (tokensPoids.get(tok) || 0) + poids);
    }
  };

  ajouterPoids(entry.id.replace(/_/g, ' '), 4);
  ajouterPoids(entry.nom, 5);
  ajouterPoids(entry.nomEn, 4);
  ajouterPoids((entry.motsCles || []).join(' '), 3);
  ajouterPoids(entry.resume, 2);
  ajouterPoids(construireTexteSecondaire(entry), 1);

  return {
    entry,
    nomNorm,
    nomEnNorm,
    motsClesNorm,
    resumeNorm,
    corpsNorm,
    tokensPoids,
  };
}

function reconstruireIndex(): void {
  const nouveauRegistre = new Map<string, IndexedEntry>();
  const nouveauDf = new Map<string, number>();

  for (const e of BASE_ENTRIES) {
    nouveauRegistre.set(e.id, indexerEntree(e));
  }
  for (const [id, e] of customEntriesMap.entries()) {
    nouveauRegistre.set(id, indexerEntree(e));
  }

  for (const indexed of nouveauRegistre.values()) {
    for (const tok of indexed.tokensPoids.keys()) {
      nouveauDf.set(tok, (nouveauDf.get(tok) || 0) + 1);
    }
  }

  registryMap = nouveauRegistre;
  dfMap = nouveauDf;
}

// Initialisation initiale incluant custom_entries.json
if (Array.isArray(customEntriesSeed)) {
  for (const raw of customEntriesSeed) {
    const res = validerEntreeSrd(raw);
    if (res.valide && res.entry) {
      customEntriesMap.set(res.entry.id, res.entry);
    }
  }
}
reconstruireIndex();

export function enregistrerAjoutsCompendium(entries: unknown[]): {
  ajoutes: number;
  remplaces: number;
  erreurs: string[];
} {
  let ajoutes = 0;
  let remplaces = 0;
  const erreurs: string[] = [];

  for (const raw of entries) {
    const check = validerEntreeSrd(raw);
    if (!check.valide || !check.entry) {
      erreurs.push(check.erreur || 'Entrée invalide');
      continue;
    }
    if (registryMap.has(check.entry.id)) {
      remplaces += 1;
    } else {
      ajoutes += 1;
    }
    customEntriesMap.set(check.entry.id, check.entry);
  }

  reconstruireIndex();
  return { ajoutes, remplaces, erreurs };
}

export function listerPersonnalisesCompendium(): SrdEntry[] {
  return Array.from(customEntriesMap.values());
}

function correspondAuxFiltres(entry: SrdEntry, query: SrdSearchQuery): boolean {
  if (query.categorie && query.categorie !== 'tout' && entry.categorie !== query.categorie) {
    return false;
  }

  if (query.sousCategorie) {
    const scNorm = normaliserTexte(query.sousCategorie);
    if (entry.categorie === 'objet') {
      if (normaliserTexte(entry.sousCategorie) !== scNorm && normaliserTexte(entry.categorieComptoir || '') !== scNorm) {
        return false;
      }
    } else if (entry.categorie === 'monstre') {
      if (normaliserTexte(entry.typeCreature) !== scNorm) return false;
    } else if (entry.categorie === 'classe_race') {
      if (normaliserTexte(entry.sousType) !== scNorm) return false;
    } else if (entry.categorie === 'regle') {
      if (normaliserTexte(entry.domaine) !== scNorm) return false;
    } else if (entry.categorie === 'sort') {
      if (normaliserTexte(entry.ecole) !== scNorm) return false;
    }
  }

  if (query.biome) {
    if (entry.categorie !== 'monstre') return false;
    const bNorm = normaliserTexte(query.biome);
    if (!entry.biomes.some(b => normaliserTexte(b).includes(bNorm) || bNorm.includes(normaliserTexte(b)))) {
      return false;
    }
  }

  if (typeof query.fpMin === 'number') {
    if (entry.categorie !== 'monstre' || entry.fpNum < query.fpMin) return false;
  }
  if (typeof query.fpMax === 'number') {
    if (entry.categorie !== 'monstre' || entry.fpNum > query.fpMax) return false;
  }

  if (typeof query.niveauSort === 'number') {
    if (entry.categorie !== 'sort' || entry.niveau !== query.niveauSort) return false;
  }

  if (query.ecole) {
    if (entry.categorie !== 'sort' || normaliserTexte(entry.ecole) !== normaliserTexte(query.ecole)) {
      return false;
    }
  }

  if (query.domaine) {
    if (entry.categorie !== 'regle' || entry.domaine !== query.domaine) return false;
  }

  if (typeof query.prixMaxPC === 'number') {
    if (entry.categorie !== 'objet' || entry.valeurPC > query.prixMaxPC) return false;
  }

  if (query.disponibleComptoir === true) {
    if (entry.categorie !== 'objet' || !entry.disponibleComptoir) return false;
  }

  return true;
}

export function rechercherCompendium(query: SrdSearchQuery = {}): SrdSearchResult[] {
  const limite = Math.max(1, Math.min(200, query.limite ?? 25));

  // Couche 1 : ID exact
  if (query.idExact) {
    const exact = registryMap.get(query.idExact.trim());
    if (exact && correspondAuxFiltres(exact.entry, query)) {
      return [{ entry: exact.entry, score: 1000, correspondance: 'exact' }];
    }
    return [];
  }

  const reqBrute = (query.requete || '').trim();
  const reqNorm = normaliserTexte(reqBrute);
  const reqTokens = tokeniser(reqBrute);
  const totalDocs = Math.max(1, registryMap.size);

  const resultats: SrdSearchResult[] = [];

  for (const idx of registryMap.values()) {
    if (!correspondAuxFiltres(idx.entry, query)) continue;

    if (!reqNorm) {
      resultats.push({ entry: idx.entry, score: 100, correspondance: 'filtre' });
      continue;
    }

    // Couche 2 : Exact ID / Nom FR / Nom EN
    if (idx.entry.id.toLowerCase() === reqBrute.toLowerCase() || idx.nomNorm === reqNorm || idx.nomEnNorm === reqNorm) {
      resultats.push({ entry: idx.entry, score: 500, correspondance: 'exact' });
      continue;
    }

    // Couche 3 : Préfixe sur nom FR / EN ou mot-clé exact
    if (
      idx.nomNorm.startsWith(reqNorm) ||
      idx.nomEnNorm.startsWith(reqNorm) ||
      idx.motsClesNorm.some(mc => mc === reqNorm)
    ) {
      resultats.push({ entry: idx.entry, score: 250, correspondance: 'prefix' });
      continue;
    }

    // Couche 4 : Sous-chaîne + BM25 pondéré multi-champs
    let score = 0;
    if (idx.nomNorm.includes(reqNorm) || idx.nomEnNorm.includes(reqNorm)) {
      score += 120;
    } else if (idx.resumeNorm.includes(reqNorm)) {
      score += 45;
    } else if (idx.corpsNorm.includes(reqNorm)) {
      score += 20;
    }

    let tokensMatches = 0;
    for (const tok of reqTokens) {
      let poidsDoc = idx.tokensPoids.get(tok) || 0;
      if (poidsDoc === 0 && tok.length >= 3) {
        // Recherche préfixe sur les tokens indexés
        for (const [docTok, p] of idx.tokensPoids.entries()) {
          if (docTok.startsWith(tok)) {
            poidsDoc = Math.max(poidsDoc, p * 0.7);
          }
        }
      }
      if (poidsDoc > 0) {
        tokensMatches += 1;
        const df = dfMap.get(tok) || 1;
        const idf = Math.log(1 + (totalDocs - df + 0.5) / (df + 0.5));
        score += poidsDoc * Math.max(0.5, idf) * 8;
      }
    }

    // Bonus si tous les mots de la requête sont présents
    if (reqTokens.length > 1 && tokensMatches === reqTokens.length) {
      score += 60;
    }

    if (score > 0) {
      resultats.push({ entry: idx.entry, score: Math.round(score * 10) / 10, correspondance: 'bm25' });
    }
  }

  resultats.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.entry.nom.localeCompare(b.entry.nom, 'fr');
  });

  return resultats.slice(0, limite);
}

export function obtenirFicheSrd(idOrName: string): SrdEntry | undefined {
  const cle = (idOrName || '').trim();
  if (!cle) return undefined;

  const direct = registryMap.get(cle);
  if (direct) return direct.entry;

  const norm = normaliserTexte(cle);
  for (const idx of registryMap.values()) {
    if (idx.nomNorm === norm || idx.nomEnNorm === norm) {
      return idx.entry;
    }
  }

  const hits = rechercherCompendium({ requete: cle, limite: 1 });
  if (hits.length > 0 && hits[0].score >= 120) {
    return hits[0].entry;
  }
  return undefined;
}

export function listerCompendium(categorie: SrdCategory | 'tout' = 'tout'): SrdEntry[] {
  const out: SrdEntry[] = [];
  for (const idx of registryMap.values()) {
    if (categorie === 'tout' || idx.entry.categorie === categorie) {
      out.push(idx.entry);
    }
  }
  return out.sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
}

export function obtenirManifesteCompletude(): SrdManifest {
  const comptes: Record<SrdCategory, number> = {
    monstre: 0,
    objet: 0,
    sort: 0,
    regle: 0,
    classe_race: 0,
  };
  const nomsPresents = new Set<string>();

  for (const idx of registryMap.values()) {
    comptes[idx.entry.categorie] += 1;
    nomsPresents.add(idx.nomNorm);
  }

  const categories: SrdManifestCategory[] = (Object.keys(CIBLES_SRD) as SrdCategory[]).map(cat => {
    const info = CIBLES_SRD[cat];
    const actuel = comptes[cat];
    const manquesSuggeres = info.poolSuggestions
      .filter(s => !nomsPresents.has(normaliserTexte(s)))
      .slice(0, 5);
    return {
      categorie: cat,
      label: info.label,
      actuel,
      cibleSrd: info.cible,
      pourcentage: Math.min(100, Math.round((actuel / info.cible) * 100)),
      manquesSuggeres,
    };
  });

  const totalActuel = Object.values(comptes).reduce((acc, n) => acc + n, 0);
  const totalCibleSrd = Object.values(CIBLES_SRD).reduce((acc, c) => acc + c.cible, 0);

  return {
    totalActuel,
    totalCibleSrd,
    categories,
    ajoutsPersonnalises: customEntriesMap.size,
  };
}

export function calculerValeurPC(monnaies: { po: number; pa: number; pc: number }): number {
  return (monnaies.po || 0) * 100 + (monnaies.pa || 0) * 10 + (monnaies.pc || 0);
}

export function formaterPrixPC(pcTotal: number): string {
  const pc = Math.max(0, Math.round(pcTotal));
  if (pc === 0) return '0 PC';
  if (pc % 100 === 0) return `${pc / 100} PO`;
  if (pc < 100 && pc % 10 === 0) return `${pc / 10} PA`;
  if (pc < 10) return `${pc} PC`;
  const po = Math.floor(pc / 100);
  const reste = pc % 100;
  const pa = Math.floor(reste / 10);
  const cu = reste % 10;
  const parts: string[] = [];
  if (po > 0) parts.push(`${po} PO`);
  if (pa > 0) parts.push(`${pa} PA`);
  if (cu > 0) parts.push(`${cu} PC`);
  return parts.join(' ');
}

export function obtenirArticlesComptoirSRD(): ItemEntry[] {
  return listerCompendium('objet').filter(
    (e): e is ItemEntry => e.categorie === 'objet' && Boolean(e.disponibleComptoir)
  );
}

export function creerCombatantDepuisMonstre(monstre: MonsterEntry, suffixId?: string): Combatant {
  const attaquePrincipale = monstre.actions.find(a => typeof a.bonusAttaque === 'number' && a.degatsDes) || monstre.actions[0];
  const typeTag = monstre.id.replace(/^mon_/, '').toUpperCase();

  return {
    id: `mob_${monstre.id}_${suffixId || Date.now()}`,
    monstreId: monstre.id,
    nom: monstre.nom,
    type: typeTag,
    pv: monstre.pv,
    pvMax: monstre.pv,
    ca: monstre.ca,
    initiative: 0,
    distancePieds: 25,
    statut: 'ACTIF',
    bonusAttaque: attaquePrincipale?.bonusAttaque ?? 3,
    degatsDes: attaquePrincipale?.degatsDes ?? '1d6+1',
    typeDegats: attaquePrincipale?.typeDegats,
    fp: monstre.fp,
    xp: monstre.xp,
    resistances: monstre.resistances,
    immunites: monstre.immunites,
    vulnerabilites: monstre.vulnerabilites,
    traits: monstre.traits,
    attaques: monstre.actions.map(a => ({
      nom: a.nom,
      bonusAttaque: a.bonusAttaque,
      degatsDes: a.degatsDes,
      typeDegats: a.typeDegats,
      desc: a.desc,
    })),
    butinTypique: monstre.butinTypique,
    comportement: monstre.comportement,
  };
}

export function formaterFicheCompactePourIA(entry: SrdEntry): string {
  if (entry.categorie === 'monstre') {
    const acts = entry.actions
      .map(a => `${a.nom}${typeof a.bonusAttaque === 'number' ? ` (+${a.bonusAttaque})` : ''}${a.degatsDes ? ` ${a.degatsDes} ${a.typeDegats || ''}` : ''}`)
      .join(' ; ');
    const def = [
      entry.vulnerabilites?.length ? `Vuln: ${entry.vulnerabilites.join(', ')}` : '',
      entry.resistances?.length ? `Rés: ${entry.resistances.join(', ')}` : '',
      entry.immunites?.length ? `Imm: ${entry.immunites.join(', ')}` : '',
    ]
      .filter(Boolean)
      .join(' | ');
    return `[${entry.id}] ${entry.nom} (${entry.typeCreature}, FP ${entry.fp}, ${entry.xp} XP) | CA ${entry.ca} | PV ${entry.pv} (${entry.desVie}) | Vit ${entry.vitesse} | Actions: ${acts}${def ? ` | ${def}` : ''}`;
  }

  if (entry.categorie === 'objet') {
    const stats = [
      entry.degats ? `${entry.degats} ${entry.typeDegats || ''}`.trim() : '',
      entry.caBase ? `CA ${entry.caBase}${entry.categorieArmure === 'Bouclier' ? ' (bouclier)' : ''}` : '',
      entry.proprietesArme?.join(', ') || '',
    ]
      .filter(Boolean)
      .join(', ');
    return `[${entry.id}] ${entry.nom} (${entry.sousCategorie}) | Prix ${formaterPrixPC(entry.valeurPC)} | Poids ${entry.poidsLbs} lb${stats ? ` | ${stats}` : ''} | ${entry.effet}`;
  }

  if (entry.categorie === 'sort') {
    return `[${entry.id}] ${entry.nom} (Niv ${entry.niveau}, ${entry.ecole}${entry.rituel ? ', Rituel' : ''}${entry.concentration ? ', Conc.' : ''}) | ${entry.tempsIncantation} | Portée ${entry.portee}${entry.degatsOuSoin ? ` | Effet ${entry.degatsOuSoin} ${entry.typeDegats || ''}` : ''}${entry.jetSauvegarde ? ` | JDS ${entry.jetSauvegarde}` : ''} | ${entry.description}`;
  }

  if (entry.categorie === 'regle') {
    return `[${entry.id}] ${entry.nom} (${entry.domaine}) | ${entry.regleExacte}`;
  }

  return `[${entry.id}] ${entry.nom} (${entry.sousType}) | ${entry.resume} | ${entry.capacites.map(c => `${c.nom}: ${c.desc}`).join(' ; ')}`;
}
