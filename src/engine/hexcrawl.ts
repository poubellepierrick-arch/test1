import { HexNode, CharacterStats, AdjudicationPayload, Pace, ExplorationRole } from '../types';
import { calculerModificateur, lancerD20 } from './dice';

export interface TravelResult {
  hexCible: HexNode;
  personnageModifie: CharacterStats;
  adjudication: AdjudicationPayload;
  rencontreImminente: boolean;
  typeRencontre?: 'GOBELIN' | 'ZOMBIE' | 'BANDIT';
}

export function obtenirDDNavigation(hex: HexNode): number {
  switch (hex.terrain) {
    case 'Plaine / Route': return 10;
    case 'Forêt Dense': return 15;
    case 'Marais Fétide': return 15;
    case 'Montagne Escarpée': return 15;
    case 'Désert Aride': return 10;
  }
}

export function obtenirDDForage(hex: HexNode): number {
  switch (hex.terrain) {
    case 'Plaine / Route': return 15;
    case 'Forêt Dense': return 10;
    case 'Marais Fétide': return 10;
    case 'Montagne Escarpée': return 20;
    case 'Désert Aride': return 20;
  }
}

export function executerDeplacementHex(
  hexDepart: HexNode,
  hexCible: HexNode,
  joueur: CharacterStats,
  allure: Pace,
  role: ExplorationRole
): TravelResult {
  const persoClone: CharacterStats = JSON.parse(JSON.stringify(joueur));
  const hexCibleClone: HexNode = JSON.parse(JSON.stringify(hexCible));
  hexCibleClone.visite = true;
  hexCibleClone.brouillard = 'EXPLORE';

  // Calcul du temps de trajet (en heures) pour franchir 1 hex de 6 miles
  // Plaine: ~1.6h. Forêt/Désert: ~2h. Montagne/Marais: ~3h.
  let heures = 2;
  if (hexCible.terrain === 'Plaine / Route') heures = 1.6;
  if (hexCible.terrain === 'Marais Fétide' || hexCible.terrain === 'Montagne Escarpée') heures = 3;

  if (allure === 'Lente') heures *= 1.25;
  if (allure === 'Rapide') heures *= 0.8;

  persoClone.heuresMarcheJour += heures;

  // Test de navigation si le rôle est S'orienter ou par défaut
  const modSag = calculerModificateur(persoClone.caracteristiques.SAG);
  const bonusSurvie = persoClone.competencesMaitrisees.includes('Survie')
    ? modSag + persoClone.bonusMaitrise
    : modSag;

  // Niveau 1 d'épuisement confère désavantage
  const typeJet = persoClone.epuisement >= 1 ? 'desavantage' : 'normal';
  const ddNav = obtenirDDNavigation(hexCible);

  const jetNav = lancerD20(typeJet);
  const scoreNav = jetNav.valeurRetenue + bonusSurvie;
  const reussiteNav = scoreNav >= ddNav;

  // Consommation d'eau pendant la marche
  const besoinEauHeure = hexCible.terrain === 'Désert Aride' ? 0.5 : 0.25;
  const eauConsommee = Math.min(persoClone.eauLitres, Number((heures * besoinEauHeure).toFixed(1)));
  persoClone.eauLitres = Number(Math.max(0, persoClone.eauLitres - eauConsommee).toFixed(1));

  // Effet Marais Fétide: eau polluée / risque de maladie
  let descTechnique = '';
  if (hexCible.terrain === 'Marais Fétide') {
    const jetMaladie = lancerD20('normal');
    const modCon = calculerModificateur(persoClone.caracteristiques.CON);
    if (jetMaladie.valeurRetenue + modCon < 12) {
      if (!persoClone.conditions.includes('Empoisonné')) {
        persoClone.conditions.push('Empoisonné');
      }
      descTechnique += ' [Marais Fétide : échec JDS Constitution DD 12, statut Empoisonné contracté]';
    }
  }

  // Risque de rencontre aléatoire selon terrain et sécurité
  let rencontre = false;
  let typeRencontre: 'GOBELIN' | 'ZOMBIE' | 'BANDIT' | undefined = undefined;
  const seuilRencontre = hexCible.securite === 'Dangereux' ? 12 : hexCible.securite === 'Périlleux' ? 8 : 17;
  const tirageRencontre = lancerD20('normal').valeurRetenue;

  if (tirageRencontre >= seuilRencontre) {
    rencontre = true;
    if (hexCible.terrain === 'Forêt Dense') typeRencontre = 'GOBELIN';
    else if (hexCible.terrain === 'Marais Fétide') typeRencontre = 'ZOMBIE';
    else typeRencontre = 'BANDIT';
  }

  descTechnique = `Navigation ${reussiteNav ? 'réussie' : 'égarée avec détour'} (${scoreNav} vs DD ${ddNav}). Déplacement de 6 miles vers ${hexCible.nom} (${heures.toFixed(1)}h). Eau consommée: -${eauConsommee}L.` + descTechnique;

  const adjudication: AdjudicationPayload = {
    phase: 'adjudication_resolved',
    action_type: 'TRAVEL',
    competenceOuCarac: 'Navigation (Survie / Sagesse)',
    dice_roll: jetNav.valeurRetenue,
    type_lancer: typeJet,
    modificateur: bonusSurvie,
    score_total: scoreNav,
    cible_dd_ou_ca: ddNav,
    issue: reussiteNav ? 'SUCCESS' : 'FAILURE',
    mutations_etat: {
      eauDelta: -eauConsommee,
      heuresEcoulees: heures,
      descriptionTechnique: descTechnique,
    },
  };

  return {
    hexCible: hexCibleClone,
    personnageModifie: persoClone,
    adjudication,
    rencontreImminente: rencontre,
    typeRencontre,
  };
}

export function executerForage(hex: HexNode, joueur: CharacterStats): {
  personnageModifie: CharacterStats;
  adjudication: AdjudicationPayload;
} {
  const persoClone: CharacterStats = JSON.parse(JSON.stringify(joueur));
  const modSag = calculerModificateur(persoClone.caracteristiques.SAG);
  const bonusSurvie = persoClone.competencesMaitrisees.includes('Survie')
    ? modSag + persoClone.bonusMaitrise
    : modSag;

  const ddForage = obtenirDDForage(hex);
  const typeJet = persoClone.epuisement >= 1 ? 'desavantage' : 'normal';
  const jet = lancerD20(typeJet);
  const score = jet.valeurRetenue + bonusSurvie;
  const reussite = score >= ddForage;

  let rationsObtenues = 0;
  let eauObtenue = 0;
  let desc = '';

  if (reussite) {
    // SRD 5e: 1d6 + modificateur SAG en livres de nourriture + eau
    rationsObtenues = Math.min(2, Math.floor(Math.random() * 2) + 1);
    eauObtenue = Math.min(persoClone.eauMaxLitres - persoClone.eauLitres, 2);

    persoClone.rationsJours = Math.min(persoClone.rationsMaxJours, persoClone.rationsJours + rationsObtenues);
    persoClone.eauLitres = Number(Math.min(persoClone.eauMaxLitres, persoClone.eauLitres + eauObtenue).toFixed(1));

    desc = `Forage fructueux (${score} vs DD ${ddForage}) : +${rationsObtenues} ration(s), +${eauObtenue}L d'eau douce récoltés.`;
  } else {
    desc = `Forage infructueux (${score} vs DD ${ddForage}) : flore stérile et sources taries.`;
  }

  // 1 heure passée à forager
  persoClone.heuresMarcheJour += 1;

  const adjudication: AdjudicationPayload = {
    phase: 'adjudication_resolved',
    action_type: 'FORAGE',
    competenceOuCarac: 'Forage (Survie / Sagesse)',
    dice_roll: jet.valeurRetenue,
    type_lancer: typeJet,
    modificateur: bonusSurvie,
    score_total: score,
    cible_dd_ou_ca: ddForage,
    issue: reussite ? 'SUCCESS' : 'FAILURE',
    mutations_etat: {
      rationsDelta: rationsObtenues,
      eauDelta: eauObtenue,
      heuresEcoulees: 1,
      descriptionTechnique: desc,
    },
  };

  return { personnageModifie: persoClone, adjudication };
}
