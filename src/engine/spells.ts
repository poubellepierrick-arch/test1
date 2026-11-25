import { CharacterStats, Spell, CombatState, AdjudicationPayload } from '../types';
import { SpellEntry } from '../types/srd';
import { calculerModificateur, lancerD20, interpreterJetDegats } from './dice';
import { listerCompendium, obtenirFicheSrd } from './compendium';

const IDS_DEPART = [
  'spell_trait_feu',
  'spell_main_mage',
  'spell_bouclier',
  'spell_soin_blessures',
  'spell_detection_magie',
  'spell_foulee_brumeuse',
];

function mapperSpellEntry(s: SpellEntry): Spell {
  return {
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
  };
}

export const CATALOGUE_SORTS_SRD: Spell[] = IDS_DEPART
  .map(id => obtenirFicheSrd(id))
  .filter((e): e is SpellEntry => Boolean(e && e.categorie === 'sort'))
  .map(mapperSpellEntry);

export function obtenirCatalogueSortsComplet(): Spell[] {
  return listerCompendium('sort')
    .filter((e): e is SpellEntry => e.categorie === 'sort')
    .map(mapperSpellEntry);
}

export function calculerSortsPreparesMax(personnage: CharacterStats): number {
  const modInt = Math.max(0, calculerModificateur(personnage.caracteristiques.INT));
  return Math.max(1, modInt + personnage.niveau);
}

function trouverSort(personnage: CharacterStats, sortId: string): { sort?: Spell; ficheSrd?: SpellEntry } {
  const fiche = obtenirFicheSrd(sortId);
  const ficheSrd = fiche?.categorie === 'sort' ? fiche : undefined;
  const sortConnu = personnage.sortsConnus?.find(s => s.id === sortId);
  const sortCat = CATALOGUE_SORTS_SRD.find(s => s.id === sortId);
  const sort = sortConnu || sortCat || (ficheSrd ? mapperSpellEntry(ficheSrd) : undefined);
  return { sort, ficheSrd };
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

  const { sort } = trouverSort(clone, sortId);
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

  const { sort, ficheSrd } = trouverSort(clonePerso, sortId);
  if (!sort) {
    throw new Error('Sortilège non répertorié dans le grimoire.');
  }

  // Vérification de préparation pour sorts de niveau >= 1
  if (sort.niveau > 0 && !clonePerso.sortsPrepares?.includes(sort.id) && !clonePerso.sortsPrepares?.includes(sortId)) {
    throw new Error(`${sort.nom} n'est pas préparé dans votre mémoire.`);
  }

  const estActionBonus = sort.tempsIncantation.toLowerCase().includes('action bonus');
  if (cloneCombat && cloneCombat.actif) {
    if (estActionBonus && cloneCombat.actionBonusDisponible === false) {
      throw new Error('Action bonus déjà utilisée ce tour.');
    }
    if (!estActionBonus && cloneCombat.actionDisponible === false) {
      throw new Error('Action déjà dépensée ce tour.');
    }
  }

  // Consommation de l'emplacement de sort
  if (sort.coutEmplacement > 0) {
    const slotDispo = clonePerso.emplacementsSorts.find(
      s => s.niveau >= sort.niveau && s.total - s.utilise > 0
    );
    if (!slotDispo) {
      throw new Error(`Aucun emplacement de niveau ${sort.niveau} disponible.`);
    }
    slotDispo.utilise += 1;
  }

  if (cloneCombat && cloneCombat.actif) {
    if (estActionBonus) {
      cloneCombat.actionBonusDisponible = false;
    } else {
      cloneCombat.actionDisponible = false;
    }
  }

  let desc = '';
  let degatsInfliges = 0;
  let pvDelta = 0;
  const modIncant = Math.max(
    calculerModificateur(clonePerso.caracteristiques.INT),
    calculerModificateur(clonePerso.caracteristiques.SAG)
  );
  const ddSorts = 8 + clonePerso.bonusMaitrise + modIncant;

  if (sort.id === 'spell_soin_blessures' || sort.id === 'spell_mot_guerison') {
    const baseSoin = interpreterJetDegats(sort.degatsOuSoin || '1d8');
    const soin = baseSoin + Math.max(1, modIncant);
    pvDelta = Math.min(clonePerso.pvMax - clonePerso.pvActuels, soin);
    clonePerso.pvActuels += pvDelta;
    if (clonePerso.pvActuels > 0) {
      clonePerso.conditions = clonePerso.conditions.filter(c => c !== 'Inconscient');
    }
    desc = `Incantation de ${sort.nom} : +${pvDelta} PV régénérés (${clonePerso.pvActuels}/${clonePerso.pvMax} PV).`;
  } else if (sort.id === 'spell_bouclier') {
    clonePerso.ca += 5;
    desc = `Barrière arcanique déployée : CA temporairement portée à ${clonePerso.ca} (+5).`;
  } else if (sort.id === 'spell_detection_magie') {
    desc = 'Flux mystiques scrutés : Aucune aura arcanique hostile détectée dans le périmètre immédiat.';
  } else if (sort.id === 'spell_foulee_brumeuse') {
    if (cloneCombat && cloneCombat.actif) {
      cloneCombat.ennemis.forEach(e => {
        if (e.statut === 'ACTIF') {
          e.distancePieds = Math.min(120, e.distancePieds + 30);
        }
      });
      cloneCombat.journalCombat.push('Foulée brumeuse : téléportation à 30 ft sans attaque d\'opportunité.');
    }
    desc = 'Foulée brumeuse : Téléportation instantanée à 9 m (30 ft). Rupture de corps-à-corps.';
  } else if (sort.degatsOuSoin) {
    const cible =
      cloneCombat && cloneCombat.actif
        ? cloneCombat.ennemis.find(e => e.id === cibleId) || cloneCombat.ennemis.find(e => e.statut === 'ACTIF')
        : undefined;

    if (ficheSrd?.jetSauvegarde) {
      degatsInfliges = interpreterJetDegats(sort.degatsOuSoin);
      if (cible) {
        const jetSave = lancerD20('normal').valeurRetenue;
        const reussiSave = jetSave >= ddSorts;
        const degFinal = reussiSave ? Math.floor(degatsInfliges / 2) : degatsInfliges;
        cible.pv = Math.max(0, cible.pv - degFinal);
        if (cible.pv === 0) {
          cible.statut = 'MORT';
          if (cible.xp) clonePerso.experience += cible.xp;
        }
        degatsInfliges = degFinal;
        desc = `${sort.nom} (JDS ${ficheSrd.jetSauvegarde} DD ${ddSorts}, jet ${jetSave}) sur ${cible.nom} : ${degFinal} dégâts ${ficheSrd.typeDegats || ''}.`;
      } else {
        desc = `${sort.nom} libéré (${degatsInfliges} dégâts potentiels ${ficheSrd.typeDegats || ''}).`;
      }
    } else {
      const jetD20 = lancerD20(clonePerso.epuisement >= 3 ? 'desavantage' : 'normal');
      const score = jetD20.valeurRetenue + modIncant + clonePerso.bonusMaitrise;
      degatsInfliges = interpreterJetDegats(sort.degatsOuSoin);
      if (jetD20.valeurRetenue === 20) degatsInfliges += interpreterJetDegats(sort.degatsOuSoin);

      if (cible) {
        if (sort.id === 'spell_projectile_magique' || jetD20.valeurRetenue === 20 || (jetD20.valeurRetenue !== 1 && score >= cible.ca)) {
          cible.pv = Math.max(0, cible.pv - degatsInfliges);
          if (cible.pv === 0) {
            cible.statut = 'MORT';
            if (cible.xp) clonePerso.experience += cible.xp;
          }
          desc = `${sort.nom} touche ${cible.nom} (${sort.id === 'spell_projectile_magique' ? 'automatique' : `${score} vs CA ${cible.ca}`}) : ${degatsInfliges} dégâts ${ficheSrd?.typeDegats || 'arcaniques'}.`;
        } else {
          desc = `${sort.nom} dévie contre ${cible.nom} (${score} vs CA ${cible.ca}) : Tir manqué.`;
          degatsInfliges = 0;
        }
      } else {
        desc = `${sort.nom} projeté dans le vide (${degatsInfliges} dégâts potentiels).`;
      }
    }
  } else {
    desc = `Incantation réussie : ${sort.nom}. ${sort.description}`;
  }

  if (cloneCombat && cloneCombat.actif && !cloneCombat.ennemis.some(e => e.statut === 'ACTIF')) {
    cloneCombat.actif = false;
    cloneCombat.journalCombat.push('Victoire arcanique : zone pacifiée.');
  }

  const adjudication: AdjudicationPayload = {
    phase: 'adjudication_resolved',
    action_type: 'SPELL',
    competenceOuCarac: `${sort.nom} (${sort.ecole})`,
    dice_roll: 15,
    modificateur: modIncant,
    score_total: 15 + modIncant,
    cible_dd_ou_ca: ddSorts,
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
