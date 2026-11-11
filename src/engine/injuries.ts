import { CharacterStats, PersistentInjury, AdjudicationPayload } from '../types';
import { lancerD20, calculerModificateur } from './dice';

export interface RecetteArtisanat {
  id: string;
  nom: string;
  description: string;
  materiauxRequis: string;
  tempsHeures: number;
  objetProduit: string;
  quantiteProduite: number;
}

export const RECETTES_BIVOUAC: RecetteArtisanat[] = [
  {
    id: 'craft_bandage',
    nom: 'Bandage compressif',
    description: 'Bandes de lin taillées dans une toile pour étancher les saignements.',
    materiauxRequis: 'Toile ou vêtement usagé',
    tempsHeures: 1,
    objetProduit: 'Bandage compressif',
    quantiteProduite: 2,
  },
  {
    id: 'craft_cataplasme',
    nom: 'Cataplasme d\'herbes sauvages',
    description: 'Pâte astringente d\'écorces et de mousse pour résorber les fièvres et plaies.',
    materiauxRequis: 'Ressources de forage végétales',
    tempsHeures: 1,
    objetProduit: 'Cataplasme antiseptique',
    quantiteProduite: 1,
  },
  {
    id: 'craft_torche',
    nom: 'Torche de suif',
    description: 'Branche séchée entourée de lambeaux imprégnés de suif.',
    materiauxRequis: 'Bois mort et résine',
    tempsHeures: 1,
    objetProduit: 'Torche de bivouac',
    quantiteProduite: 2,
  },
  {
    id: 'craft_attelle',
    nom: 'Attelle de marcheur',
    description: 'Deux montants de sapin solidarisés par des lanières de cuir.',
    materiauxRequis: 'Rameaux solides et courroie',
    tempsHeures: 1,
    objetProduit: 'Attelle de bois',
    quantiteProduite: 1,
  },
];

export function infligerBlessurePersistante(
  personnage: CharacterStats,
  type: 'ENTORSE' | 'PLAIE_OUVERTE' | 'CONTUSION'
): {
  personnageModifie: CharacterStats;
  blessure: PersistentInjury;
} {
  const clone: CharacterStats = JSON.parse(JSON.stringify(personnage));
  if (!clone.blessuresPersistantes) clone.blessuresPersistantes = [];

  let blessure: PersistentInjury;
  if (type === 'ENTORSE') {
    blessure = {
      id: `injury_${Date.now()}`,
      type: 'ENTORSE',
      nom: 'Entorse à la cheville',
      description: 'Ligaments étirés lors d\'un faux pas sur la pierraille.',
      penalite: '-10 pieds de vitesse',
      joursReposRestants: 3,
    };
    clone.vitessePieds = Math.max(10, clone.vitessePieds - 10);
  } else if (type === 'PLAIE_OUVERTE') {
    blessure = {
      id: `injury_${Date.now()}`,
      type: 'PLAIE_OUVERTE',
      nom: 'Plaie infectée au flanc',
      description: 'Lacération suppurante risquant d\'engendrer la fièvre des marais.',
      penalite: 'Risque d\'épuisement au réveil',
      joursReposRestants: 4,
    };
  } else {
    blessure = {
      id: `injury_${Date.now()}`,
      type: 'CONTUSION',
      nom: 'Contusion costale sévère',
      description: 'Choc contondant rendant la respiration et les efforts de force douloureux.',
      penalite: 'Désavantage aux tests d\'Athlétisme',
      joursReposRestants: 2,
    };
  }

  clone.blessuresPersistantes.push(blessure);
  return { personnageModifie: clone, blessure };
}

export function fabriquerObjetBivouac(
  personnage: CharacterStats,
  recetteId: string
): {
  personnageModifie: CharacterStats;
  adjudication: AdjudicationPayload;
} {
  const clone: CharacterStats = JSON.parse(JSON.stringify(personnage));
  const recette = RECETTES_BIVOUAC.find(r => r.id === recetteId);
  if (!recette) throw new Error('Recette d\'artisanat inconnue.');

  // Test de Dextérité ou Sagesse (Survie DD 11)
  const modDex = calculerModificateur(clone.caracteristiques.DEX);
  const jet = lancerD20(clone.epuisement >= 1 ? 'desavantage' : 'normal');
  const score = jet.valeurRetenue + modDex;
  const dd = 11;
  const reussite = score >= dd;

  let desc = '';
  if (reussite) {
    const itemExistant = clone.inventaire.find(i => i.nom === recette.objetProduit);
    if (itemExistant) {
      itemExistant.quantite += recette.quantiteProduite;
    } else {
      clone.inventaire.push({
        id: `craft_${Date.now()}`,
        nom: recette.objetProduit,
        poidsLbs: 1,
        valeurPO: 1,
        quantite: recette.quantiteProduite,
      });
    }
    desc = `Artisanat réussi (${score} vs DD ${dd}) : +${recette.quantiteProduite} ${recette.objetProduit}.`;
  } else {
    desc = `Tentative d'artisanat manquée (${score} vs DD ${dd}) : matériaux abîmés sans résultat.`;
  }

  const adjudication: AdjudicationPayload = {
    phase: 'adjudication_resolved',
    action_type: 'WORK_CONTRACT',
    competenceOuCarac: `Artisanat de bivouac (${recette.nom})`,
    dice_roll: jet.valeurRetenue,
    modificateur: modDex,
    score_total: score,
    cible_dd_ou_ca: dd,
    issue: reussite ? 'SUCCESS' : 'FAILURE',
    mutations_etat: {
      heuresEcoulees: recette.tempsHeures,
      descriptionTechnique: desc,
    },
  };

  return { personnageModifie: clone, adjudication };
}

export function soignerBlessure(
  personnage: CharacterStats,
  blessureId: string,
  avecRemede: boolean = true
): {
  personnageModifie: CharacterStats;
  adjudication: AdjudicationPayload;
} {
  const clone: CharacterStats = JSON.parse(JSON.stringify(personnage));
  const blessure = clone.blessuresPersistantes?.find(b => b.id === blessureId);
  if (!blessure) throw new Error('Blessure introuvable.');

  let desc = '';
  if (avecRemede) {
    // Retrait de la blessure immédiatement grâce au traitement adéquat
    clone.blessuresPersistantes = clone.blessuresPersistantes.filter(b => b.id !== blessureId);
    if (blessure.type === 'ENTORSE') {
      clone.vitessePieds = Math.min(30, clone.vitessePieds + 10);
    }
    desc = `Pansement appliqué : ${blessure.nom} soignée et stabilisée avec succès.`;
  } else {
    blessure.joursReposRestants = Math.max(0, blessure.joursReposRestants - 1);
    desc = `Convalescence naturelle : 1 jour de guérison purgé pour ${blessure.nom} (${blessure.joursReposRestants}j restants).`;
    if (blessure.joursReposRestants === 0) {
      clone.blessuresPersistantes = clone.blessuresPersistantes.filter(b => b.id !== blessureId);
      if (blessure.type === 'ENTORSE') clone.vitessePieds = Math.min(30, clone.vitessePieds + 10);
      desc += ' Guérison complète atteinte !';
    }
  }

  const adjudication: AdjudicationPayload = {
    phase: 'adjudication_resolved',
    action_type: 'WORK_CONTRACT',
    dice_roll: 15,
    modificateur: 0,
    score_total: 15,
    cible_dd_ou_ca: 10,
    issue: 'SUCCESS',
    mutations_etat: {
      descriptionTechnique: desc,
    },
  };

  return { personnageModifie: clone, adjudication };
}
