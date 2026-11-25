import {
  Ability,
  CharacterItem,
  CharacterStats,
  HeroDocument,
  HeroDocumentCategory,
  SimulationState,
  Spell,
} from '../types';
import { ItemEntry, SpellEntry } from '../types/srd';
import { calculerModificateur, interpreterJetDegats } from './dice';
import { obtenirFicheSrd } from './compendium';
import { evaluerEncombrement, evaluerEpuisement } from './srd';
import { CATALOGUE_SORTS_SRD } from './spells';

export interface ArmorProfile {
  estArmure: boolean;
  estBouclier: boolean;
  caBase: number;
  categorieArmure?: 'Légère' | 'Intermédiaire' | 'Lourde' | 'Bouclier';
  dexMax?: number;
  forceRequise?: number;
}

export interface WeaponProfile {
  estArme: boolean;
  nom: string;
  degatsBase: string;
  typeDegats: string;
  estDistance: boolean;
  estFinesse: boolean;
  estDeuxMains: boolean;
  porteeCourtePieds: number;
  porteeLonguePieds: number;
  usure: number;
  malusUsure: number;
}

function obtenirFicheObjetSrd(item: CharacterItem): ItemEntry | undefined {
  const fiche =
    (item.compendiumId ? obtenirFicheSrd(item.compendiumId) : undefined) ||
    obtenirFicheSrd(item.nom) ||
    obtenirFicheSrd(item.id);
  return fiche?.categorie === 'objet' ? fiche : undefined;
}

export function extraireProfilArmure(item: CharacterItem): ArmorProfile {
  const srd = obtenirFicheObjetSrd(item);
  const nomLow = item.nom.toLowerCase();
  const catArmure = item.categorieArmure || srd?.categorieArmure;

  const estBouclier =
    catArmure === 'Bouclier' ||
    item.categorie === 'bouclier' ||
    nomLow.includes('bouclier') ||
    nomLow.includes('écu') ||
    nomLow.includes('ecu') ||
    item.id === 'item_bouclier';

  if (estBouclier) {
    return {
      estArmure: false,
      estBouclier: true,
      caBase: item.caBase ?? srd?.caBase ?? 2,
      categorieArmure: 'Bouclier',
    };
  }

  const estArmure =
    Boolean(catArmure) ||
    item.categorie === 'armure' ||
    srd?.sousCategorie === 'armure' ||
    nomLow.includes('armure') ||
    nomLow.includes('cotte de mailles') ||
    nomLow.includes('cuirasse') ||
    nomLow.includes('broigne') ||
    nomLow.includes('harnois') ||
    nomLow.includes('clibanion') ||
    item.id === 'item_armure';

  if (!estArmure) {
    return { estArmure: false, estBouclier: false, caBase: 0 };
  }

  const caBase =
    item.caBase ??
    srd?.caBase ??
    (nomLow.includes('cotte de mailles')
      ? 16
      : nomLow.includes('harnois')
      ? 18
      : nomLow.includes('clibanion')
      ? 17
      : nomLow.includes('cuirasse') || nomLow.includes('écailles') || nomLow.includes('broigne')
      ? 14
      : nomLow.includes('chemise de mailles')
      ? 13
      : nomLow.includes('cuir clouté') || nomLow.includes('peau')
      ? 12
      : 11);

  const categorieInferred =
    catArmure ||
    (caBase >= 16 || nomLow.includes('cotte de mailles') || nomLow.includes('harnois') || nomLow.includes('clibanion') || nomLow.includes('broigne')
      ? 'Lourde'
      : caBase >= 13 || nomLow.includes('peau') || nomLow.includes('écailles') || nomLow.includes('cuirasse')
      ? 'Intermédiaire'
      : 'Légère');

  const dexMax =
    item.dexMax ??
    srd?.dexMax ??
    (categorieInferred === 'Lourde' ? 0 : categorieInferred === 'Intermédiaire' ? 2 : undefined);

  const forceRequise =
    item.forceRequise ??
    srd?.forceRequise ??
    (nomLow.includes('cotte de mailles') ? 13 : nomLow.includes('harnois') || nomLow.includes('clibanion') ? 15 : undefined);

  return {
    estArmure: true,
    estBouclier: false,
    caBase,
    categorieArmure: categorieInferred,
    dexMax,
    forceRequise,
  };
}

function parserPorteePieds(portee?: string): { courte: number; longue: number } {
  if (!portee) return { courte: 5, longue: 5 };
  const match = portee.match(/(\d+)\s*(?:\/\s*(\d+))?\s*m/i);
  if (match) {
    const metresCourte = Number(match[1]) || 6;
    const metresLongue = Number(match[2] || match[1]) || metresCourte;
    return {
      courte: Math.max(10, Math.round((metresCourte / 1.5) * 5)),
      longue: Math.max(10, Math.round((metresLongue / 1.5) * 5)),
    };
  }
  const matchFt = portee.match(/(\d+)\s*(?:\/\s*(\d+))?\s*(?:ft|pi|pieds)/i);
  if (matchFt) {
    const c = Number(matchFt[1]) || 20;
    const l = Number(matchFt[2] || matchFt[1]) || c;
    return { courte: c, longue: l };
  }
  return { courte: 5, longue: 5 };
}

export function extraireProfilArme(
  item: CharacterItem,
  usureEquipement?: Record<string, number>
): WeaponProfile {
  const srd = obtenirFicheObjetSrd(item);
  const nomLow = item.nom.toLowerCase();

  const estArme =
    item.categorie === 'arme' ||
    srd?.sousCategorie === 'arme' ||
    Boolean(item.degats) ||
    nomLow.includes('épée') ||
    nomLow.includes('epee') ||
    nomLow.includes('dague') ||
    nomLow.includes('hache') ||
    nomLow.includes('arc') ||
    nomLow.includes('arbalète') ||
    nomLow.includes('arbalete') ||
    nomLow.includes('lance') ||
    nomLow.includes('masse') ||
    nomLow.includes('bâton') ||
    nomLow.includes('baton') ||
    nomLow.includes('rapière') ||
    nomLow.includes('cimeterre') ||
    nomLow.includes('marteau') ||
    item.id === 'item_epee';

  if (!estArme) {
    return {
      estArme: false,
      nom: item.nom,
      degatsBase: '1d4',
      typeDegats: 'contondant',
      estDistance: false,
      estFinesse: false,
      estDeuxMains: false,
      porteeCourtePieds: 5,
      porteeLonguePieds: 5,
      usure: 0,
      malusUsure: 0,
    };
  }

  const props = (item.proprietesArme || srd?.proprietesArme || []).map(p => p.toLowerCase());
  const estDistance =
    props.some(p => p.includes('distance')) ||
    nomLow.includes('arc') ||
    nomLow.includes('arbalète') ||
    nomLow.includes('arbalete') ||
    nomLow.includes('fronde');
  const estLancer = props.some(p => p.includes('lancer'));
  const estFinesse = props.some(p => p.includes('finesse'));
  const estDeuxMains = props.some(p => p.includes('deux mains'));
  const porteeStr = item.portee || srd?.portee;
  const portees = estDistance || estLancer ? parserPorteePieds(porteeStr || '18/72 m') : { courte: 5, longue: 5 };

  const degatsBase =
    item.degats ||
    srd?.degats ||
    (nomLow.includes('bâtarde') || nomLow.includes('batarde') || nomLow.includes('longue') ? '1d8' : '1d6');
  const typeDegats = item.typeDegats || srd?.typeDegats || (estDistance ? 'perforant' : 'tranchant');

  const usure = usureEquipement?.[item.id] ?? 0;
  const malusUsure = usure >= 100 ? -2 : usure >= 75 ? -1 : 0;

  return {
    estArme: true,
    nom: item.nom,
    degatsBase,
    typeDegats,
    estDistance,
    estFinesse,
    estDeuxMains,
    porteeCourtePieds: portees.courte,
    porteeLonguePieds: portees.longue,
    usure,
    malusUsure,
  };
}

export function obtenirArmeActive(personnage: CharacterStats): WeaponProfile {
  const equipee = personnage.inventaire.find(i => i.estEquipe && extraireProfilArme(i, personnage.usureEquipement).estArme);
  if (equipee) {
    return extraireProfilArme(equipee, personnage.usureEquipement);
  }
  return {
    estArme: true,
    nom: 'Poing / Coup à mains nues',
    degatsBase: '1d4',
    typeDegats: 'contondant',
    estDistance: false,
    estFinesse: false,
    estDeuxMains: false,
    porteeCourtePieds: 5,
    porteeLonguePieds: 5,
    usure: 0,
    malusUsure: 0,
  };
}

export function estObjetConsommable(item: CharacterItem): boolean {
  const srd = obtenirFicheObjetSrd(item);
  if (srd?.estConsommable || srd?.sousCategorie === 'potion') return true;
  const n = item.nom.toLowerCase();
  return (
    n.includes('potion') ||
    n.includes('ration') ||
    n.includes('vivres') ||
    n.includes('eau') ||
    n.includes('torche') ||
    n.includes('bandage') ||
    n.includes('cataplasme') ||
    n.includes('antidote') ||
    n.includes('herbe')
  );
}

export function estObjetEquipable(item: CharacterItem): boolean {
  const arm = extraireProfilArmure(item);
  if (arm.estArmure || arm.estBouclier) return true;
  const arme = extraireProfilArme(item);
  if (arme.estArme) return true;
  const srd = obtenirFicheObjetSrd(item);
  return srd?.sousCategorie === 'objet_magique' && !srd.estConsommable;
}

export function evaluerVitesseEffective(personnage: CharacterStats): number {
  const ep = evaluerEpuisement(personnage.epuisement);
  if (ep.vitesseNulle) return 0;
  const charge = evaluerEncombrement(personnage);

  let malusForceArmure = 0;
  for (const item of personnage.inventaire) {
    if (!item.estEquipe) continue;
    const arm = extraireProfilArmure(item);
    if (arm.estArmure && arm.forceRequise && personnage.caracteristiques.FOR < arm.forceRequise) {
      malusForceArmure = Math.max(malusForceArmure, 10);
    }
  }

  const base = Math.max(0, personnage.vitessePieds - charge.penaliteVitesse - malusForceArmure);
  return ep.vitesseDivisee ? Math.max(5, Math.floor(base / 2)) : base;
}

export function aVisionDansLeNoir(personnage: CharacterStats): boolean {
  const texte = [
    personnage.race || '',
    personnage.traits || '',
    ...(personnage.capacites || []),
  ]
    .join(' ')
    .toLowerCase();

  return (
    texte.includes('vision dans le noir') ||
    texte.includes('darkvision') ||
    texte.includes('elfe') ||
    texte.includes('nain') ||
    texte.includes('gnome') ||
    texte.includes('demi-orc') ||
    texte.includes('tieffelin')
  );
}

export function estDansObscuriteSansLumiere(etat: SimulationState): boolean {
  const dansNoir = Boolean(etat.donjon?.actif) || etat.horloge.heure >= 20 || etat.horloge.heure < 6;
  if (!dansNoir) return false;
  if (etat.personnage.sourceLumiere?.active && etat.personnage.sourceLumiere.heuresRestantes > 0) {
    return false;
  }
  if (aVisionDansLeNoir(etat.personnage)) {
    return false;
  }
  return true;
}

export function recalculerStatsDerivees(personnage: CharacterStats): CharacterStats {
  const clone: CharacterStats = JSON.parse(JSON.stringify(personnage));
  const modDex = calculerModificateur(clone.caracteristiques.DEX);
  const modCon = calculerModificateur(clone.caracteristiques.CON);
  const modSag = calculerModificateur(clone.caracteristiques.SAG);

  let armureEquipee: { item: CharacterItem; profil: ArmorProfile } | null = null;
  let bouclierEquipe: { item: CharacterItem; profil: ArmorProfile } | null = null;

  for (const item of clone.inventaire) {
    if (!item.estEquipe) continue;
    const profil = extraireProfilArmure(item);
    if (profil.estArmure && !armureEquipee) {
      armureEquipee = { item, profil };
    } else if (profil.estBouclier && !bouclierEquipe) {
      bouclierEquipe = { item, profil };
    }
  }

  let baseCA = 10 + modDex;
  if (armureEquipee) {
    const { item, profil } = armureEquipee;
    const dexBonus =
      profil.dexMax === 0
        ? 0
        : profil.dexMax !== undefined
        ? Math.min(modDex, profil.dexMax)
        : modDex;
    const usureArmure = clone.usureEquipement?.[item.id] ?? 0;
    const malusArmure = usureArmure >= 100 ? -2 : usureArmure >= 75 ? -1 : 0;
    baseCA = profil.caBase + dexBonus + malusArmure;
  } else {
    const classeLow = (clone.classe || '').toLowerCase();
    if (classeLow.includes('barbare')) {
      baseCA = 10 + modDex + modCon;
    } else if (classeLow.includes('moine') && !bouclierEquipe) {
      baseCA = 10 + modDex + modSag;
    }
  }

  let bonusBouclier = 0;
  if (bouclierEquipe) {
    const usureBouclier = clone.usureEquipement?.[bouclierEquipe.item.id] ?? 0;
    const malusBouclier = usureBouclier >= 75 ? -1 : 0;
    bonusBouclier = Math.max(1, bouclierEquipe.profil.caBase + malusBouclier);
  }

  clone.ca = Math.max(8, baseCA + bonusBouclier);
  return clone;
}

export function equiperObjet(
  personnage: CharacterStats,
  itemId: string
): { personnageModifie: CharacterStats; message: string; equipe: boolean } {
  const clone: CharacterStats = JSON.parse(JSON.stringify(personnage));
  const cible = clone.inventaire.find(i => i.id === itemId);
  if (!cible) {
    throw new Error('Objet introuvable dans la besace.');
  }
  if (!estObjetEquipable(cible)) {
    throw new Error(`${cible.nom} ne peut pas être équipé.`);
  }

  const etaitEquipe = Boolean(cible.estEquipe);
  if (etaitEquipe) {
    cible.estEquipe = false;
    const recalcule = recalculerStatsDerivees(clone);
    return {
      personnageModifie: recalcule,
      equipe: false,
      message: `${cible.nom} retiré. CA actuelle : ${recalcule.ca}.`,
    };
  }

  const profilArmure = extraireProfilArmure(cible);
  const profilArme = extraireProfilArme(cible, clone.usureEquipement);
  const notes: string[] = [];

  if (profilArmure.estArmure) {
    for (const i of clone.inventaire) {
      if (i.id !== cible.id && i.estEquipe && extraireProfilArmure(i).estArmure) {
        i.estEquipe = false;
        notes.push(`${i.nom} retiré`);
      }
    }
  } else if (profilArmure.estBouclier) {
    for (const i of clone.inventaire) {
      if (i.id === cible.id || !i.estEquipe) continue;
      if (extraireProfilArmure(i).estBouclier) {
        i.estEquipe = false;
        notes.push(`${i.nom} retiré`);
      }
      const pArme = extraireProfilArme(i, clone.usureEquipement);
      if (pArme.estArme && pArme.estDeuxMains) {
        i.estEquipe = false;
        notes.push(`${i.nom} rangé (deux mains)`);
      }
    }
  } else if (profilArme.estArme) {
    for (const i of clone.inventaire) {
      if (i.id === cible.id || !i.estEquipe) continue;
      if (extraireProfilArme(i, clone.usureEquipement).estArme) {
        i.estEquipe = false;
        notes.push(`${i.nom} rengainé`);
      }
      if (profilArme.estDeuxMains && extraireProfilArmure(i).estBouclier) {
        i.estEquipe = false;
        notes.push(`${i.nom} retiré (arme à deux mains)`);
      }
    }
  }

  cible.estEquipe = true;
  const recalcule = recalculerStatsDerivees(clone);
  const details = notes.length > 0 ? ` (${notes.join(', ')})` : '';
  return {
    personnageModifie: recalcule,
    equipe: true,
    message: `${cible.nom} équipé${details}. CA : ${recalcule.ca}.`,
  };
}

export function utiliserObjet(
  personnage: CharacterStats,
  itemId: string
): {
  personnageModifie: CharacterStats;
  message: string;
  pvDelta: number;
} {
  const clone: CharacterStats = JSON.parse(JSON.stringify(personnage));
  const idx = clone.inventaire.findIndex(i => i.id === itemId);
  if (idx === -1) {
    throw new Error('Objet introuvable dans la besace.');
  }

  const item = clone.inventaire[idx];
  const srd = obtenirFicheObjetSrd(item);
  const nomLow = item.nom.toLowerCase();
  let message = '';
  let pvDelta = 0;

  if (nomLow.includes('potion') && nomLow.includes('soin')) {
    const soin = interpreterJetDegats('2d4+2');
    const avant = clone.pvActuels;
    clone.pvActuels = Math.min(clone.pvMax, clone.pvActuels + soin);
    pvDelta = clone.pvActuels - avant;
    if (clone.pvActuels > 0) {
      clone.conditions = clone.conditions.filter(c => c !== 'Inconscient');
      clone.deathSaves = { succes: 0, echecs: 0 };
    }
    message = `Potion bue (${item.nom}) : +${pvDelta} PV (${clone.pvActuels}/${clone.pvMax}).`;
  } else if (nomLow.includes('antidote') || nomLow.includes('contrepoison')) {
    clone.conditions = clone.conditions.filter(c => c !== 'Empoisonné');
    message = `${item.nom} ingéré : toxines neutralisées.`;
  } else if (nomLow.includes('ration') || nomLow.includes('vivres')) {
    clone.rationsJours = Math.min(clone.rationsMaxJours, clone.rationsJours + 1);
    message = `${item.nom} ajouté aux vivres (${clone.rationsJours}/${clone.rationsMaxJours} j).`;
  } else if (nomLow.includes('eau')) {
    clone.eauLitres = Number(Math.min(clone.eauMaxLitres, clone.eauLitres + 1).toFixed(1));
    clone.qualiteEau = 'Pure';
    message = `Outre remplie (${clone.eauLitres}/${clone.eauMaxLitres} L).`;
  } else if (nomLow.includes('torche')) {
    clone.sourceLumiere = {
      nom: item.nom,
      heuresRestantes: (clone.sourceLumiere?.heuresRestantes || 0) + 1,
      active: true,
    };
    message = `Torche allumée (${clone.sourceLumiere.heuresRestantes} h disponibles).`;
  } else if (nomLow.includes('bandage') || nomLow.includes('cataplasme') || nomLow.includes('herbe')) {
    const soin = 2;
    const avant = clone.pvActuels;
    clone.pvActuels = Math.min(clone.pvMax, clone.pvActuels + soin);
    pvDelta = clone.pvActuels - avant;
    if (clone.blessuresPersistantes.length > 0) {
      const bl = clone.blessuresPersistantes[0];
      bl.joursReposRestants = Math.max(0, bl.joursReposRestants - 1);
      if (bl.joursReposRestants === 0) {
        clone.blessuresPersistantes.shift();
        message = `${item.nom} appliqué : ${bl.nom} guérie.`;
      } else {
        message = `${item.nom} appliqué sur ${bl.nom} (${bl.joursReposRestants} j restants).`;
      }
    } else {
      message = `${item.nom} appliqué : +${pvDelta} PV.`;
    }
  } else if (srd?.estConsommable) {
    message = `${item.nom} utilisé : ${srd.effet}`;
  } else {
    throw new Error(`${item.nom} n'est pas consommable directement.`);
  }

  if (item.quantite > 1) {
    item.quantite -= 1;
  } else {
    clone.inventaire.splice(idx, 1);
  }

  return { personnageModifie: clone, message, pvDelta };
}

export function jeterObjet(
  personnage: CharacterStats,
  itemId: string,
  quantite = 1
): { personnageModifie: CharacterStats; message: string } {
  const clone: CharacterStats = JSON.parse(JSON.stringify(personnage));
  const idx = clone.inventaire.findIndex(i => i.id === itemId);
  if (idx === -1) {
    throw new Error('Objet introuvable dans la besace.');
  }

  const item = clone.inventaire[idx];
  const qte = Math.max(1, Math.min(item.quantite, quantite));
  if (item.quantite > qte) {
    item.quantite -= qte;
  } else {
    clone.inventaire.splice(idx, 1);
  }

  const recalcule = recalculerStatsDerivees(clone);
  return {
    personnageModifie: recalcule,
    message: `${qte}x ${item.nom} abandonné.`,
  };
}

export function basculerSourceLumiere(
  personnage: CharacterStats,
  forcer?: boolean
): { personnageModifie: CharacterStats; message: string } {
  const clone: CharacterStats = JSON.parse(JSON.stringify(personnage));
  if (!clone.sourceLumiere) {
    clone.sourceLumiere = { nom: 'Torche de poix', heuresRestantes: 0, active: false };
  }

  const cibleActive = forcer !== undefined ? forcer : !clone.sourceLumiere.active;

  if (!cibleActive) {
    clone.sourceLumiere.active = false;
    return {
      personnageModifie: clone,
      message: `${clone.sourceLumiere.nom} éteinte (${clone.sourceLumiere.heuresRestantes.toFixed(1)} h restantes).`,
    };
  }

  if (clone.sourceLumiere.heuresRestantes <= 0) {
    const idxTorche = clone.inventaire.findIndex(i => i.nom.toLowerCase().includes('torche'));
    if (idxTorche === -1) {
      throw new Error('Aucune heure de lumière restante ni torche de rechange.');
    }
    const torche = clone.inventaire[idxTorche];
    clone.sourceLumiere.nom = torche.nom;
    clone.sourceLumiere.heuresRestantes = 1;
    if (torche.quantite > 1) torche.quantite -= 1;
    else clone.inventaire.splice(idxTorche, 1);
  }

  clone.sourceLumiere.active = true;
  return {
    personnageModifie: clone,
    message: `${clone.sourceLumiere.nom} allumée (${clone.sourceLumiere.heuresRestantes.toFixed(1)} h restantes).`,
  };
}

export function consommerHeuresLumiere(personnage: CharacterStats, heures: number): {
  personnageModifie: CharacterStats;
  message?: string;
} {
  const clone: CharacterStats = JSON.parse(JSON.stringify(personnage));
  if (!clone.sourceLumiere?.active || heures <= 0) {
    return { personnageModifie: clone };
  }
  const avant = clone.sourceLumiere.heuresRestantes;
  clone.sourceLumiere.heuresRestantes = Number(Math.max(0, avant - heures).toFixed(1));
  if (clone.sourceLumiere.heuresRestantes === 0) {
    clone.sourceLumiere.active = false;
    return {
      personnageModifie: clone,
      message: `${clone.sourceLumiere.nom} s'épuise et s'éteint.`,
    };
  }
  return { personnageModifie: clone };
}

const SEUILS_XP_NIV: Record<number, number> = {
  1: 300,
  2: 900,
  3: 2700,
  4: 6500,
  5: 14000,
  6: 23000,
  7: 34000,
  8: 48000,
  9: 64000,
  10: 85000,
};

export interface HeroImportInput {
  nom?: string;
  classe?: string;
  race?: string;
  historique?: string;
  alignement?: string;
  traits?: string;
  capacites?: string[];
  notesPersonnelles?: string;
  niveau?: number;
  pvMax?: number;
  pvActuels?: number;
  ca?: number;
  vitessePieds?: number;
  caracteristiques?: Partial<Record<Ability, number>>;
  sauvegardesMaitrisees?: Ability[];
  competencesMaitrisees?: string[];
  monnaies?: { po?: number; pa?: number; pc?: number };
  inventaire?: Array<{
    nom: string;
    quantite?: number;
    poidsLbs?: number;
    valeurPO?: number;
    estEquipe?: boolean;
    degats?: string;
    caBase?: number;
    categorie?: string;
  }>;
  sortsNoms?: string[];
  emplacementsSorts?: Array<{ niveau: number; total: number; recharge?: 'court' | 'long' }>;
  documents?: Array<{
    titre: string;
    categorie?: HeroDocumentCategory;
    contenu: string;
    actifPourMJ?: boolean;
  }>;
}

export function construirePersonnageDepuisImport(
  input: HeroImportInput,
  base: CharacterStats,
  dateLabel = 'Jour 1'
): CharacterStats {
  const niveau = Math.max(1, Math.min(20, Math.round(Number(input.niveau) || base.niveau || 1)));
  const bonusMaitrise = 1 + Math.ceil(niveau / 4);
  const caracs: Record<Ability, number> = {
    FOR: Math.max(3, Math.min(24, Math.round(Number(input.caracteristiques?.FOR) || base.caracteristiques.FOR))),
    DEX: Math.max(3, Math.min(24, Math.round(Number(input.caracteristiques?.DEX) || base.caracteristiques.DEX))),
    CON: Math.max(3, Math.min(24, Math.round(Number(input.caracteristiques?.CON) || base.caracteristiques.CON))),
    INT: Math.max(3, Math.min(24, Math.round(Number(input.caracteristiques?.INT) || base.caracteristiques.INT))),
    SAG: Math.max(3, Math.min(24, Math.round(Number(input.caracteristiques?.SAG) || base.caracteristiques.SAG))),
    CHA: Math.max(3, Math.min(24, Math.round(Number(input.caracteristiques?.CHA) || base.caracteristiques.CHA))),
  };

  const pvMax = Math.max(1, Math.round(Number(input.pvMax) || 10 + calculerModificateur(caracs.CON) + (niveau - 1) * 6));
  const pvActuels = Math.max(0, Math.min(pvMax, Math.round(Number(input.pvActuels ?? pvMax))));

  const inventaire: CharacterItem[] = Array.isArray(input.inventaire) && input.inventaire.length > 0
    ? input.inventaire.map((it, idx) => {
        const fiche = obtenirFicheSrd(it.nom);
        const srdObj = fiche?.categorie === 'objet' ? fiche : undefined;
        return {
          id: `imp_${idx}_${Date.now().toString(36)}`,
          compendiumId: srdObj?.id,
          nom: (srdObj?.nom || it.nom || 'Objet').trim(),
          poidsLbs: Number(it.poidsLbs ?? srdObj?.poidsLbs ?? 1),
          valeurPO: Number(it.valeurPO ?? (srdObj ? Number((srdObj.valeurPC / 100).toFixed(2)) : 1)),
          quantite: Math.max(1, Math.round(Number(it.quantite) || 1)),
          estEquipe: Boolean(it.estEquipe),
          degats: it.degats || srdObj?.degats,
          typeDegats: srdObj?.typeDegats,
          proprietesArme: srdObj?.proprietesArme,
          portee: srdObj?.portee,
          caBase: it.caBase ?? srdObj?.caBase,
          categorie: it.categorie || srdObj?.sousCategorie,
          categorieArmure: srdObj?.categorieArmure,
          dexMax: srdObj?.dexMax,
          forceRequise: srdObj?.forceRequise,
          effet: srdObj?.effet,
        };
      })
    : JSON.parse(JSON.stringify(base.inventaire));

  const sortsConnus: Spell[] = [];
  const sortsPrepares: string[] = [];
  if (Array.isArray(input.sortsNoms) && input.sortsNoms.length > 0) {
    for (const nomSort of input.sortsNoms) {
      const f = obtenirFicheSrd(nomSort);
      if (f?.categorie === 'sort') {
        const s: SpellEntry = f;
        sortsConnus.push({
          id: s.id,
          nom: s.nom,
          niveau: s.niveau,
          ecole: s.ecole,
          tempsIncantation: s.tempsIncantation,
          portee: s.portee,
          composantes: s.composantes,
          description: s.description,
          degatsOuSoin: s.degatsOuSoin,
          coutEmplacement: s.niveau,
          estRituel: s.rituel,
        });
        if (s.niveau > 0) sortsPrepares.push(s.id);
      }
    }
  }
  if (sortsConnus.length === 0) {
    sortsConnus.push(...CATALOGUE_SORTS_SRD);
    sortsPrepares.push(...base.sortsPrepares);
  }

  const documents: HeroDocument[] = Array.isArray(input.documents)
    ? input.documents
        .filter(d => d && (d.titre?.trim() || d.contenu?.trim()))
        .slice(0, 20)
        .map((d, i) => ({
          id: `doc_${Date.now().toString(36)}_${i}`,
          titre: String(d.titre || `Document ${i + 1}`).trim().slice(0, 120),
          categorie: d.categorie || 'Historique',
          contenu: String(d.contenu || '').trim().slice(0, 12000),
          actifPourMJ: d.actifPourMJ !== false,
          majDate: dateLabel,
        }))
    : [];

  const emplacements = Array.isArray(input.emplacementsSorts) && input.emplacementsSorts.length > 0
    ? input.emplacementsSorts.map(s => ({
        niveau: Math.max(1, Math.min(9, s.niveau)),
        total: Math.max(0, s.total),
        utilise: 0,
        recharge: s.recharge || 'long',
      }))
    : JSON.parse(JSON.stringify(base.emplacementsSorts));

  const nouveau: CharacterStats = {
    ...JSON.parse(JSON.stringify(base)),
    id: `char_${Date.now().toString(36)}`,
    nom: (input.nom || base.nom).trim().slice(0, 80) || base.nom,
    classe: (input.classe || base.classe).trim().slice(0, 80) || base.classe,
    race: input.race?.trim() || base.race || 'Humain',
    historique: input.historique?.trim() || base.historique,
    alignement: input.alignement?.trim() || base.alignement,
    traits: input.traits?.trim() || base.traits,
    capacites: Array.isArray(input.capacites) ? input.capacites.map(c => String(c).trim()).filter(Boolean) : base.capacites || [],
    notesPersonnelles: input.notesPersonnelles?.trim() || base.notesPersonnelles,
    documents,
    niveau,
    pvActuels,
    pvMax,
    vitessePieds: Math.max(15, Math.min(60, Math.round(Number(input.vitessePieds) || 30))),
    caracteristiques: caracs,
    sauvegardesMaitrisees:
      Array.isArray(input.sauvegardesMaitrisees) && input.sauvegardesMaitrisees.length > 0
        ? input.sauvegardesMaitrisees
        : base.sauvegardesMaitrisees,
    competencesMaitrisees:
      Array.isArray(input.competencesMaitrisees) && input.competencesMaitrisees.length > 0
        ? input.competencesMaitrisees
        : base.competencesMaitrisees,
    bonusMaitrise,
    monnaies: {
      po: Math.max(0, Math.round(Number(input.monnaies?.po ?? base.monnaies.po))),
      pa: Math.max(0, Math.round(Number(input.monnaies?.pa ?? base.monnaies.pa))),
      pc: Math.max(0, Math.round(Number(input.monnaies?.pc ?? base.monnaies.pc))),
    },
    inventaire,
    usureEquipement: {},
    emplacementsSorts: emplacements,
    sortsConnus,
    sortsPrepares,
    experience: niveau > 1 ? SEUILS_XP_NIV[niveau - 1] || 0 : 0,
    experienceNextLevel: SEUILS_XP_NIV[niveau] || 300,
    estMortDefinitivement: false,
    deathSaves: { succes: 0, echecs: 0 },
    conditions: [],
    blessuresPersistantes: [],
  };

  const recalcule = recalculerStatsDerivees(nouveau);
  if (typeof input.ca === 'number' && input.ca >= 8 && !inventaire.some(i => i.estEquipe && (extraireProfilArmure(i).estArmure || extraireProfilArmure(i).estBouclier))) {
    recalcule.ca = Math.round(input.ca);
  }
  return recalcule;
}

export function appliquerMiseAJourHeros(
  personnage: CharacterStats,
  patch: Partial<HeroImportInput>
): { personnageModifie: CharacterStats; message: string } {
  const clone: CharacterStats = JSON.parse(JSON.stringify(personnage));
  const champsModifies: string[] = [];

  if (typeof patch.nom === 'string' && patch.nom.trim()) {
    clone.nom = patch.nom.trim().slice(0, 80);
    champsModifies.push('nom');
  }
  if (typeof patch.classe === 'string' && patch.classe.trim()) {
    clone.classe = patch.classe.trim().slice(0, 80);
    champsModifies.push('classe');
  }
  if (typeof patch.race === 'string') {
    clone.race = patch.race.trim().slice(0, 60) || undefined;
    champsModifies.push('race');
  }
  if (typeof patch.historique === 'string') {
    clone.historique = patch.historique.trim().slice(0, 80) || undefined;
    champsModifies.push('historique');
  }
  if (typeof patch.alignement === 'string') {
    clone.alignement = patch.alignement.trim().slice(0, 60) || undefined;
    champsModifies.push('alignement');
  }
  if (typeof patch.traits === 'string') {
    clone.traits = patch.traits.trim().slice(0, 600) || undefined;
    champsModifies.push('traits');
  }
  if (Array.isArray(patch.capacites)) {
    clone.capacites = patch.capacites.map(c => String(c).trim()).filter(Boolean).slice(0, 30);
    champsModifies.push('capacités');
  }
  if (typeof patch.notesPersonnelles === 'string') {
    clone.notesPersonnelles = patch.notesPersonnelles.trim().slice(0, 8000) || undefined;
    champsModifies.push('notes');
  }
  if (typeof patch.niveau === 'number' && patch.niveau >= 1 && patch.niveau <= 20) {
    clone.niveau = Math.round(patch.niveau);
    clone.bonusMaitrise = 1 + Math.ceil(clone.niveau / 4);
    clone.experienceNextLevel = SEUILS_XP_NIV[clone.niveau] || clone.experienceNextLevel;
    champsModifies.push('niveau');
  }
  if (typeof patch.pvMax === 'number' && patch.pvMax >= 1) {
    clone.pvMax = Math.round(patch.pvMax);
    clone.pvActuels = Math.min(clone.pvMax, clone.pvActuels);
    champsModifies.push('PV max');
  }
  if (typeof patch.vitessePieds === 'number' && patch.vitessePieds >= 0) {
    clone.vitessePieds = Math.round(patch.vitessePieds);
    champsModifies.push('vitesse');
  }
  if (patch.caracteristiques) {
    for (const k of ['FOR', 'DEX', 'CON', 'INT', 'SAG', 'CHA'] as Ability[]) {
      const val = patch.caracteristiques[k];
      if (typeof val === 'number' && val >= 1 && val <= 30) {
        clone.caracteristiques[k] = Math.round(val);
      }
    }
    champsModifies.push('caractéristiques');
  }
  if (Array.isArray(patch.sauvegardesMaitrisees)) {
    clone.sauvegardesMaitrisees = patch.sauvegardesMaitrisees;
    champsModifies.push('sauvegardes');
  }
  if (Array.isArray(patch.competencesMaitrisees)) {
    clone.competencesMaitrisees = patch.competencesMaitrisees;
    champsModifies.push('compétences');
  }

  const recalcule = recalculerStatsDerivees(clone);
  return {
    personnageModifie: recalcule,
    message:
      champsModifies.length > 0
        ? `Fiche enrichie (${champsModifies.join(', ')}). CA : ${recalcule.ca}.`
        : `Fiche de ${recalcule.nom} vérifiée.`,
  };
}

export function gererDocumentHeros(
  personnage: CharacterStats,
  op: {
    mode: 'ajouter' | 'modifier' | 'supprimer' | 'basculer_mj';
    docId?: string;
    titre?: string;
    categorie?: HeroDocumentCategory;
    contenu?: string;
    actifPourMJ?: boolean;
  },
  dateLabel = 'Campagne'
): { personnageModifie: CharacterStats; message: string } {
  const clone: CharacterStats = JSON.parse(JSON.stringify(personnage));
  if (!Array.isArray(clone.documents)) clone.documents = [];

  if (op.mode === 'ajouter') {
    const titre = (op.titre || 'Note de campagne').trim().slice(0, 120);
    const contenu = (op.contenu || '').trim().slice(0, 12000);
    if (!contenu) {
      throw new Error('Contenu du document requis.');
    }
    if (clone.documents.length >= 20) {
      throw new Error('Limite de 20 documents atteinte.');
    }
    const nouveau: HeroDocument = {
      id: `doc_${Date.now().toString(36)}_${Math.floor(Math.random() * 1000)}`,
      titre,
      categorie: op.categorie || 'Notes',
      contenu,
      actifPourMJ: op.actifPourMJ !== false,
      majDate: dateLabel,
    };
    clone.documents.unshift(nouveau);
    return { personnageModifie: clone, message: `Document ajouté : ${nouveau.titre}.` };
  }

  const idx = clone.documents.findIndex(d => d.id === op.docId);
  if (idx === -1) {
    throw new Error('Document introuvable.');
  }

  if (op.mode === 'supprimer') {
    const titre = clone.documents[idx].titre;
    clone.documents.splice(idx, 1);
    return { personnageModifie: clone, message: `Document supprimé : ${titre}.` };
  }

  if (op.mode === 'basculer_mj') {
    clone.documents[idx].actifPourMJ = !clone.documents[idx].actifPourMJ;
    return {
      personnageModifie: clone,
      message: `${clone.documents[idx].titre} : ${clone.documents[idx].actifPourMJ ? 'partagé au MJ' : 'privé'}.`,
    };
  }

  // modifier
  if (typeof op.titre === 'string' && op.titre.trim()) {
    clone.documents[idx].titre = op.titre.trim().slice(0, 120);
  }
  if (op.categorie) {
    clone.documents[idx].categorie = op.categorie;
  }
  if (typeof op.contenu === 'string') {
    clone.documents[idx].contenu = op.contenu.trim().slice(0, 12000);
  }
  if (typeof op.actifPourMJ === 'boolean') {
    clone.documents[idx].actifPourMJ = op.actifPourMJ;
  }
  clone.documents[idx].majDate = dateLabel;

  return {
    personnageModifie: clone,
    message: `Document mis à jour : ${clone.documents[idx].titre}.`,
  };
}
