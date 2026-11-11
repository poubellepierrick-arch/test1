import { CharacterStats, Spell, CombatState, AdjudicationPayload } from '../types';
import { calculerModificateur, lancerD20 } from './dice';

export const CATALOGUE_SORTS_SRD: Spell[] = [
  {
    id: 'spell_trait_feu',
    nom: 'Trait de feu',
    niveau: 0,
    ecole: 'Évocation',
    tempsIncantation: '1 action',
    portee: '120 pieds',
    composantes: 'V, S',
    description: 'Projette un trait incandescent sur une cible.',
    degatsOuSoin: '1d10',
    coutEmplacement: 0,
  },
  {
    id: 'spell_main_mage',
    nom: 'Main de mage',
    niveau: 0,
    ecole: 'Transmutation',
    tempsIncantation: '1 action',
    portee: '30 pieds',
    composantes: 'V, S',
    description: 'Une main spectrale manipule un objet à distance (5 lbs max).',
    coutEmplacement: 0,
    estRituel: false,
  },
  {
    id: 'spell_bouclier',
    nom: 'Bouclier arcanique',
    niveau: 1,
    ecole: 'Abjuration',
    tempsIncantation: '1 réaction',
    portee: 'Personnelle',
    composantes: 'V, S',
    description: 'Une barrière invisible octroie +5 à la CA jusqu\'au début du prochain tour.',
    coutEmplacement: 1,
  },
  {
    id: 'spell_soin_blessures',
    nom: 'Soin des blessures',
    niveau: 1,
    ecole: 'Évocation',
    tempsIncantation: '1 action',
    portee: 'Contact',
    composantes: 'V, S',
    description: 'Une onde d\'énergie régénère les chairs endommagées.',
    degatsOuSoin: '1d8',
    coutEmplacement: 1,
  },
  {
    id: 'spell_detection_magie',
    nom: 'Détection de la magie',
    niveau: 1,
    ecole: 'Divination',
    tempsIncantation: '1 action (ou rituel 10 min)',
    portee: '30 pieds',
    composantes: 'V, S',
    description: 'Révèle la présence de flux occultes ou de glyphes piégés.',
    coutEmplacement: 1,
    estRituel: true,
  },
  {
    id: 'spell_foulee_brumeuse',
    nom: 'Foulée brumeuse',
    niveau: 2,
    ecole: 'Invocation',
    tempsIncantation: '1 action bonus',
    portee: '30 pieds',
    composantes: 'V',
    description: 'Téléportation instantanée dans un tourbillon de brume argentée.',
    coutEmplacement: 2,
  },
];

export function calculerSortsPreparesMax(personnage: CharacterStats): number {
  const modInt = Math.max(0, calculerModificateur(personnage.caracteristiques.INT));
  return Math.max(1, modInt + personnage.niveau);
}

export function preparerSort(
  personnage: CharacterStats,
  sortId: string
): {
  personnageModifie: CharacterStats;
  succes: boolean;
  message: string;
} {
  const clone: CharacterStats = JSON.parse(JSON.stringify(personnage));
  if (!clone.sortsPrepares) clone.sortsPrepares = [];

  const sort = clone.sortsConnus?.find(s => s.id === sortId) || CATALOGUE_SORTS_SRD.find(s => s.id === sortId);
  if (!sort) {
    return { personnageModifie: clone, succes: false, message: 'Sortilège inconnu.' };
  }

  // Tours de magie (niveau 0) toujours disponibles
  if (sort.niveau === 0) {
    return { personnageModifie: clone, succes: true, message: `${sort.nom} est un tour de magie toujours prêt.` };
  }

  if (clone.sortsPrepares.includes(sortId)) {
    // Retirer de la préparation
    clone.sortsPrepares = clone.sortsPrepares.filter(id => id !== sortId);
    return {
      personnageModifie: clone,
      succes: true,
      message: `${sort.nom} retiré des sorts préparés.`,
    };
  }

  const max = calculerSortsPreparesMax(clone);
  if (clone.sortsPrepares.length >= max) {
    return {
      personnageModifie: clone,
      succes: false,
      message: `Capacité de concentration atteinte (${max}/${max} sorts préparés).`,
    };
  }

  clone.sortsPrepares.push(sortId);
  return {
    personnageModifie: clone,
    succes: true,
    message: `${sort.nom} mémorisé et préparé dans le grimoire (${clone.sortsPrepares.length}/${max}).`,
  };
}

export function executerSortGrimoire(
  personnage: CharacterStats,
  sortId: string,
  combat?: CombatState,
  cibleId?: string
): {
  personnageModifie: CharacterStats;
  combatModifie?: CombatState;
  adjudication: AdjudicationPayload;
} {
  const clonePerso: CharacterStats = JSON.parse(JSON.stringify(personnage));
  const cloneCombat: CombatState | undefined = combat ? JSON.parse(JSON.stringify(combat)) : undefined;

  const sort = clonePerso.sortsConnus?.find(s => s.id === sortId) || CATALOGUE_SORTS_SRD.find(s => s.id === sortId);
  if (!sort) {
    throw new Error('Sortilège non répertorié dans le grimoire.');
  }

  // Vérification de préparation pour sorts de niveau >= 1
  if (sort.niveau > 0 && !clonePerso.sortsPrepares?.includes(sortId)) {
    throw new Error(`${sort.nom} n'est pas préparé dans votre mémoire.`);
  }

  // Consommation de l'emplacement de sort
  if (sort.coutEmplacement > 0) {
    const slotDispo = clonePerso.emplacementsSorts.find(
      s => s.niveau === sort.niveau && s.total - s.utilise > 0
    );
    if (!slotDispo) {
      throw new Error(`Aucun emplacement de niveau ${sort.niveau} disponible.`);
    }
    slotDispo.utilise += 1;
  }

  let desc = '';
  let degatsInfliges = 0;
  let pvDelta = 0;

  if (sort.id === 'spell_soin_blessures') {
    const modCon = Math.max(1, calculerModificateur(clonePerso.caracteristiques.SAG));
    const soin = Math.floor(Math.random() * 8) + 1 + modCon;
    pvDelta = Math.min(clonePerso.pvMax - clonePerso.pvActuels, soin);
    clonePerso.pvActuels += pvDelta;
    desc = `Incantation de Soin des blessures : +${pvDelta} PV régénérés (${clonePerso.pvActuels}/${clonePerso.pvMax} PV).`;
  } else if (sort.id === 'spell_bouclier') {
    clonePerso.ca += 5;
    desc = `Barrière arcanique déployée : CA temporairement portée à ${clonePerso.ca} (+5).`;
  } else if (sort.id === 'spell_trait_feu') {
    const jetD20 = lancerD20(clonePerso.epuisement >= 3 ? 'desavantage' : 'normal');
    const modInt = calculerModificateur(clonePerso.caracteristiques.INT);
    const score = jetD20.valeurRetenue + modInt + clonePerso.bonusMaitrise;
    degatsInfliges = Math.floor(Math.random() * 10) + 1;

    if (cloneCombat && cloneCombat.actif && cibleId) {
      const cible = cloneCombat.ennemis.find(e => e.id === cibleId);
      if (cible) {
        if (score >= cible.ca) {
          cible.pv = Math.max(0, cible.pv - degatsInfliges);
          if (cible.pv === 0) cible.statut = 'MORT';
          desc = `Trait de feu touche ${cible.nom} (${score} vs CA ${cible.ca}) : ${degatsInfliges} dégâts de feu.`;
        } else {
          desc = `Trait de feu dévie contre ${cible.nom} (${score} vs CA ${cible.ca}) : Tir manqué.`;
          degatsInfliges = 0;
        }
      }
    } else {
      desc = `Trait de feu projeté dans le vide (${degatsInfliges} dégâts potentiels).`;
    }
  } else if (sort.id === 'spell_detection_magie') {
    desc = 'Flux mystiques scrutés : Aucune aura arcanique hostile détectée dans le périmètre immédiat.';
  } else if (sort.id === 'spell_foulee_brumeuse') {
    if (cloneCombat && cloneCombat.actif) {
      cloneCombat.journalCombat.push('Téléportation tactique : désengagement immédiat à 30 pieds.');
    }
    desc = 'Foulée brumeuse : Téléportation instantanée à 30 pieds. Rupture de corps-à-corps.';
  } else {
    desc = `Incantation réussie : ${sort.nom}. Effet manifesté.`;
  }

  const adjudication: AdjudicationPayload = {
    phase: 'adjudication_resolved',
    action_type: 'SPELL',
    competenceOuCarac: `${sort.nom} (${sort.ecole})`,
    dice_roll: 15,
    modificateur: 0,
    score_total: 15,
    cible_dd_ou_ca: 10,
    issue: 'SUCCESS',
    mutations_etat: {
      pvDelta: pvDelta > 0 ? pvDelta : undefined,
      degatsInfliges: degatsInfliges > 0 ? degatsInfliges : undefined,
      emplacementConsomme: sort.coutEmplacement > 0 ? sort.niveau : undefined,
      descriptionTechnique: desc,
    },
  };

  return {
    personnageModifie: clonePerso,
    combatModifie: cloneCombat,
    adjudication,
  };
}
