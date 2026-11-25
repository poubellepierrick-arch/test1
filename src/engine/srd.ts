import { CharacterStats, AdjudicationPayload } from '../types';
import { calculerModificateur, lancerD20 } from './dice';

export interface ExhaustionEffects {
  desavantageCaracteristiques: boolean; // Niv 1
  vitesseDivisee: boolean; // Niv 2
  desavantageAttaqueEtSauvegardes: boolean; // Niv 3
  pvMaxDivises: boolean; // Niv 4
  vitesseNulle: boolean; // Niv 5
  estMort: boolean; // Niv 6
}

export function evaluerEpuisement(niveau: number): ExhaustionEffects {
  return {
    desavantageCaracteristiques: niveau >= 1,
    vitesseDivisee: niveau >= 2,
    desavantageAttaqueEtSauvegardes: niveau >= 3,
    pvMaxDivises: niveau >= 4,
    vitesseNulle: niveau >= 5,
    estMort: niveau >= 6,
  };
}

export function calculerPoidsTotal(personnage: CharacterStats): number {
  return personnage.inventaire.reduce((total, item) => total + (item.poidsLbs * item.quantite), 0);
}

export function evaluerEncombrement(personnage: CharacterStats): {
  poidsTotal: number;
  capaciteMax: number;
  seuilLourd: number;
  seuilSevere: number;
  statut: 'Normal' | 'Encombré' | 'Lourdement Encombré' | 'Surchargé';
  penaliteVitesse: number;
} {
  const force = personnage.caracteristiques.FOR;
  const capaciteCompagnons = (personnage.compagnons || []).reduce((acc, c) => acc + c.chargeMaxLbs, 0);
  const capaciteMax = force * 15 + capaciteCompagnons;
  const seuilLourd = force * 5 + Math.floor(capaciteCompagnons * 0.33);
  const seuilSevere = force * 10 + Math.floor(capaciteCompagnons * 0.66);
  const poidsTotal = calculerPoidsTotal(personnage);

  if (poidsTotal > capaciteMax) {
    return { poidsTotal, capaciteMax, seuilLourd, seuilSevere, statut: 'Surchargé', penaliteVitesse: 20 };
  } else if (poidsTotal > seuilSevere) {
    return { poidsTotal, capaciteMax, seuilLourd, seuilSevere, statut: 'Lourdement Encombré', penaliteVitesse: 20 };
  } else if (poidsTotal > seuilLourd) {
    return { poidsTotal, capaciteMax, seuilLourd, seuilSevere, statut: 'Encombré', penaliteVitesse: 10 };
  }
  return { poidsTotal, capaciteMax, seuilLourd, seuilSevere, statut: 'Normal', penaliteVitesse: 0 };
}

export function executerMarcheForcee(personnage: CharacterStats): {
  personnageModifie: CharacterStats;
  adjudication: AdjudicationPayload;
} {
  const heuresSup = Math.max(1, personnage.heuresMarcheJour - 8);
  const dd = 10 + heuresSup;
  const modCon = calculerModificateur(personnage.caracteristiques.CON);
  const maitrise = personnage.sauvegardesMaitrisees.includes('CON') ? personnage.bonusMaitrise : 0;
  const bonusTotal = modCon + maitrise;
  
  const jet = lancerD20('normal');
  const scoreTotal = jet.valeurRetenue + bonusTotal;
  const reussite = scoreTotal >= dd;

  const clone: CharacterStats = JSON.parse(JSON.stringify(personnage));
  let epuisementDelta = 0;
  let issue: AdjudicationPayload['issue'] = 'SUCCESS';

  if (!reussite) {
    clone.epuisement = Math.min(6, clone.epuisement + 1);
    epuisementDelta = 1;
    issue = 'FAILURE';
    if (clone.epuisement >= 6) {
      clone.estMortDefinitivement = true;
      issue = 'PERMADEATH';
    }
  }

  const adjudication: AdjudicationPayload = {
    phase: 'adjudication_resolved',
    action_type: 'SKILL_CHECK',
    competenceOuCarac: 'Sauvegarde Constitution (Marche Forcée)',
    dice_roll: jet.valeurRetenue,
    modificateur: bonusTotal,
    score_total: scoreTotal,
    cible_dd_ou_ca: dd,
    issue,
    mutations_etat: {
      epuisementDelta,
      descriptionTechnique: reussite
        ? `Sauvegarde CON réussie (${scoreTotal} vs DD ${dd}). Aucun épuisement supplémentaire.`
        : `Sauvegarde CON échouée (${scoreTotal} vs DD ${dd}). Épuisement niveau ${clone.epuisement}.`,
    },
  };

  return { personnageModifie: clone, adjudication };
}

export function executerJetSauvegardeMort(personnage: CharacterStats): {
  personnageModifie: CharacterStats;
  adjudication: AdjudicationPayload;
} {
  const clone: CharacterStats = JSON.parse(JSON.stringify(personnage));
  const jet = lancerD20('normal');
  const de = jet.valeurRetenue;

  let issue: AdjudicationPayload['issue'] = 'FAILURE';
  let desc = '';

  if (de === 20) {
    // 20 naturel: regagne 1 PV immédiatement
    clone.pvActuels = 1;
    clone.deathSaves = { succes: 0, echecs: 0 };
    issue = 'CRITICAL_SUCCESS';
    desc = '20 Naturel : le personnage reprend conscience à 1 PV.';
  } else if (de >= 10) {
    clone.deathSaves.succes += 1;
    if (clone.deathSaves.succes >= 3) {
      issue = 'STABILIZED';
      desc = '3e succès : état stabilisé. Inconscient mais hors de danger immédiat.';
      clone.deathSaves = { succes: 0, echecs: 0 };
    } else {
      issue = 'SUCCESS';
      desc = `Succès (${clone.deathSaves.succes}/3).`;
    }
  } else if (de === 1) {
    // 1 naturel: 2 échecs
    clone.deathSaves.echecs += 2;
    issue = 'CRITICAL_FAILURE';
    if (clone.deathSaves.echecs >= 3) {
      clone.estMortDefinitivement = true;
      issue = 'PERMADEATH';
      desc = '1 Naturel (2 échecs) : 3 échecs atteints. Mort définitive du personnage.';
    } else {
      desc = `1 Naturel : 2 échecs subis d'un coup (${clone.deathSaves.echecs}/3).`;
    }
  } else {
    clone.deathSaves.echecs += 1;
    if (clone.deathSaves.echecs >= 3) {
      clone.estMortDefinitivement = true;
      issue = 'PERMADEATH';
      desc = '3e échec de sauvegarde contre la mort. Décès permanent.';
    } else {
      issue = 'FAILURE';
      desc = `Échec (${clone.deathSaves.echecs}/3).`;
    }
  }

  const adjudication: AdjudicationPayload = {
    phase: 'adjudication_resolved',
    action_type: 'DEATH_SAVE',
    dice_roll: de,
    modificateur: 0,
    score_total: de,
    cible_dd_ou_ca: 10,
    issue,
    mutations_etat: {
      descriptionTechnique: desc,
    },
  };

  return { personnageModifie: clone, adjudication };
}

export interface OptionsRepos {
  ddCustom?: number;
  coutPA?: number;
  mode?: 'auberge' | 'bivouac' | 'porche';
}

export function executerRepos(
  personnage: CharacterStats,
  type: 'court' | 'long',
  abriSecurise: boolean = true,
  options?: OptionsRepos
): {
  personnageModifie: CharacterStats;
  adjudication: AdjudicationPayload;
} {
  const clone: CharacterStats = JSON.parse(JSON.stringify(personnage));
  let desc = '';
  let pvRecup = 0;
  let epuisementRecup = 0;

  if (type === 'court') {
    // Repos court: 1 heure, dépense de dés de vie (simulé: 1d8 + mod CON)
    const modCon = Math.max(0, calculerModificateur(clone.caracteristiques.CON));
    const soin = Math.floor(Math.random() * 8) + 1 + modCon;
    pvRecup = Math.min(clone.pvMax - clone.pvActuels, soin);
    clone.pvActuels += pvRecup;

    // Recharge sorts Occultiste (pacte)
    clone.emplacementsSorts = clone.emplacementsSorts.map(slot => {
      if (slot.recharge === 'court') {
        return { ...slot, utilise: 0 };
      }
      return slot;
    });

    desc = `Repos court (1h) : +${pvRecup} PV récupérés. Emplacements de pacte rechargés.`;
  } else {
    // Repos long: 8 heures
    const coutPA = options?.coutPA || 0;
    if (coutPA > 0) {
      const totalPA = clone.monnaies.po * 10 + clone.monnaies.pa;
      if (totalPA < coutPA) {
        throw new Error(`Fonds insuffisants pour l'auberge (${coutPA} PA requis).`);
      }
      if (clone.monnaies.pa >= coutPA) {
        clone.monnaies.pa -= coutPA;
      } else {
        const reste = coutPA - clone.monnaies.pa;
        clone.monnaies.pa = 0;
        const poNecessaires = Math.ceil(reste / 10);
        clone.monnaies.po -= poNecessaires;
        clone.monnaies.pa += poNecessaires * 10 - reste;
      }
    }

    if (!abriSecurise) {
      clone.nuitsConsecutivesSansRepos += 1;
      const ddBase = options?.ddCustom ?? 10;
      const ddSommeil = ddBase + (clone.nuitsConsecutivesSansRepos - 1) * 3;
      const jet = lancerD20('normal');
      const modCon = calculerModificateur(clone.caracteristiques.CON);
      const total = jet.valeurRetenue + modCon;

      if (total < ddSommeil) {
        clone.epuisement = Math.min(6, clone.epuisement + 1);
        if (clone.epuisement >= 6) {
          clone.estMortDefinitivement = true;
        }
        desc = `Bivouac rude (${total} vs DD ${ddSommeil}) : sommeil agité, +1 niveau d'épuisement.`;
      } else {
        pvRecup = clone.pvMax - clone.pvActuels;
        clone.pvActuels = clone.pvMax;
        if (clone.epuisement > 0) {
          clone.epuisement -= 1;
          epuisementRecup = 1;
        }
        clone.emplacementsSorts = clone.emplacementsSorts.map(s => ({ ...s, utilise: 0 }));
        clone.heuresMarcheJour = 0;
        desc = `Bivouac maîtrisé (${total} vs DD ${ddSommeil}) : PV restaurés et sorts rechargés.`;
      }
    } else {
      clone.nuitsConsecutivesSansRepos = 0;
      pvRecup = clone.pvMax - clone.pvActuels;
      clone.pvActuels = clone.pvMax;
      if (clone.epuisement > 0) {
        clone.epuisement -= 1;
        epuisementRecup = 1;
      }
      // En auberge, convalescence accélérée des blessures persistantes
      if (options?.mode === 'auberge' && clone.blessuresPersistantes?.length) {
        clone.blessuresPersistantes = clone.blessuresPersistantes
          .map(b => ({ ...b, joursReposRestants: Math.max(0, b.joursReposRestants - 1) }))
          .filter(b => {
            if (b.joursReposRestants === 0 && b.type === 'ENTORSE') {
              clone.vitessePieds = Math.min(30, clone.vitessePieds + 10);
            }
            return b.joursReposRestants > 0;
          });
      }
      // Rechargement complet de tous les sorts
      clone.emplacementsSorts = clone.emplacementsSorts.map(s => ({ ...s, utilise: 0 }));
      clone.heuresMarcheJour = 0;
      desc =
        options?.mode === 'auberge'
          ? `Nuit à l'auberge (${coutPA} PA) : repos sûr, PV au maximum, sorts restaurés.`
          : `Repos long (8h) complet : PV au maximum, -1 niveau d'épuisement, tous les emplacements de sorts restaurés.`;
    }
  }

  const adjudication: AdjudicationPayload = {
    phase: 'adjudication_resolved',
    action_type: 'REST',
    dice_roll: 20,
    modificateur: 0,
    score_total: 20,
    cible_dd_ou_ca: 0,
    issue: 'SUCCESS',
    mutations_etat: {
      pvDelta: pvRecup,
      epuisementDelta: -epuisementRecup,
      heuresEcoulees: type === 'court' ? 1 : 8,
      descriptionTechnique: desc,
    },
  };

  return { personnageModifie: clone, adjudication };
}

export function evaluerMonteeNiveau(personnage: CharacterStats): {
  personnageModifie: CharacterStats;
  estMonteeNiveau: boolean;
  nouveauNiveau?: number;
} {
  const clone: CharacterStats = JSON.parse(JSON.stringify(personnage));
  const paliers = [
    { niveau: 1, seuilXP: 0, nextXP: 300 },
    { niveau: 2, seuilXP: 300, nextXP: 900 },
    { niveau: 3, seuilXP: 900, nextXP: 2700 },
    { niveau: 4, seuilXP: 2700, nextXP: 6500 },
    { niveau: 5, seuilXP: 6500, nextXP: 14000 },
  ];

  const niveauActuel = clone.niveau;
  const palierSuivant = paliers.find(p => p.niveau === niveauActuel + 1);

  if (palierSuivant && clone.experience >= palierSuivant.seuilXP && clone.niveau < 5) {
    clone.niveau += 1;
    clone.pvMax += 8;
    clone.pvActuels = clone.pvMax;
    clone.experienceNextLevel = palierSuivant.nextXP;

    if (clone.niveau >= 5) {
      clone.bonusMaitrise = 3;
    }

    if (clone.niveau === 3) {
      clone.emplacementsSorts.push({ niveau: 2, total: 1, utilise: 0, recharge: 'court' });
    }

    return { personnageModifie: clone, estMonteeNiveau: true, nouveauNiveau: clone.niveau };
  }

  return { personnageModifie: clone, estMonteeNiveau: false };
}

export function appliquerUsureEquipement(
  personnage: CharacterStats,
  pourcentageUsure: number = 5
): CharacterStats {
  const clone: CharacterStats = JSON.parse(JSON.stringify(personnage));
  if (!clone.usureEquipement) clone.usureEquipement = {};

  for (const item of clone.inventaire) {
    if (item.estEquipe) {
      const usureActuelle = clone.usureEquipement[item.id] || 0;
      clone.usureEquipement[item.id] = Math.min(100, usureActuelle + pourcentageUsure);
    }
  }

  return clone;
}

export function reparerEquipement(
  personnage: CharacterStats,
  itemId?: string
): CharacterStats {
  const clone: CharacterStats = JSON.parse(JSON.stringify(personnage));
  if (!clone.usureEquipement) clone.usureEquipement = {};

  if (itemId) {
    clone.usureEquipement[itemId] = 0;
  } else {
    for (const key of Object.keys(clone.usureEquipement)) {
      clone.usureEquipement[key] = 0;
    }
  }

  return clone;
}

export function evaluerExpositionMeteo(
  meteo: string,
  personnage: CharacterStats
): {
  personnageModifie: CharacterStats;
  affecte: boolean;
  description: string;
} {
  const clone: CharacterStats = JSON.parse(JSON.stringify(personnage));
  const meteoSevere = meteo.includes('Pluie') || meteo.includes('Brume') || meteo.includes('Chaleur');

  if (!meteoSevere) {
    return { personnageModifie: clone, affecte: false, description: 'Conditions climatiques stables.' };
  }

  const modCon = calculerModificateur(clone.caracteristiques.CON);
  const jet = lancerD20('normal');
  const score = jet.valeurRetenue + modCon;
  const dd = 10;
  const reussite = score >= dd;

  if (!reussite) {
    clone.epuisement = Math.min(6, clone.epuisement + 1);
    if (clone.epuisement >= 6) clone.estMortDefinitivement = true;
    return {
      personnageModifie: clone,
      affecte: true,
      description: `Échec JDS Constitution (${score} vs DD ${dd}) sous ${meteo} : engourdissement et gain d'épuisement.`,
    };
  }

  return {
    personnageModifie: clone,
    affecte: false,
    description: `Sauvegarde Constitution réussie (${score} vs DD ${dd}) face à ${meteo}.`,
  };
}
