import { Combatant, CombatState, CharacterStats, AdjudicationPayload } from '../types';
import { calculerModificateur, lancerD20, interpreterJetDegats } from './dice';

export function initialiserCombat(joueur: CharacterStats, ennemisInitiaux: Combatant[]): CombatState {
  const modDexJoueur = calculerModificateur(joueur.caracteristiques.DEX);
  const jetInitJoueur = lancerD20('normal').valeurRetenue + modDexJoueur;

  const listeCombattants = [
    { id: 'player', nom: joueur.nom, initiative: jetInitJoueur },
    ...ennemisInitiaux.map(e => ({
      id: e.id,
      nom: e.nom,
      initiative: lancerD20('normal').valeurRetenue + 1,
    })),
  ];

  // Tri décroissant d'initiative
  listeCombattants.sort((a, b) => b.initiative - a.initiative);
  const ordre = listeCombattants.map(c => c.id);

  return {
    actif: true,
    round: 1,
    combattantActifIndex: 0,
    ordreInitiative: ordre,
    ennemis: ennemisInitiaux,
    journalCombat: [
      `Combat engagé. Initiative du joueur : ${jetInitJoueur}. Ordre : ${listeCombattants.map(c => `${c.nom} (${c.initiative})`).join(', ')}`,
    ],
  };
}

export function executerAttaqueJoueur(
  joueur: CharacterStats,
  combat: CombatState,
  cibleId: string,
  arme: { nom: string; degats: string; type: 'cac' | 'distance' }
): {
  combatModifie: CombatState;
  personnageModifie: CharacterStats;
  adjudication: AdjudicationPayload;
} {
  const combatClone: CombatState = JSON.parse(JSON.stringify(combat));
  const persoClone: CharacterStats = JSON.parse(JSON.stringify(joueur));
  const cibleIndex = combatClone.ennemis.findIndex(e => e.id === cibleId);

  if (cibleIndex === -1) {
    throw new Error('Cible introuvable dans le combat');
  }

  const cible = combatClone.ennemis[cibleIndex];
  const modAttaque = arme.type === 'distance'
    ? calculerModificateur(persoClone.caracteristiques.DEX)
    : calculerModificateur(persoClone.caracteristiques.FOR);
  const bonusTotal = modAttaque + persoClone.bonusMaitrise;

  // Épuisement niveau 3 donne désavantage aux attaques
  let typeJet: 'normal' | 'avantage' | 'desavantage' = 'normal';
  if (persoClone.epuisement >= 3) {
    typeJet = 'desavantage';
  }

  const jet = lancerD20(typeJet);
  const totalTouche = jet.valeurRetenue + bonusTotal;
  const caCible = cible.ca;

  let issue: AdjudicationPayload['issue'] = 'FAILURE';
  let degatsInfliges = 0;
  let desc = '';

  if (jet.valeurRetenue === 20 || (jet.valeurRetenue !== 1 && totalTouche >= caCible)) {
    // Touche !
    const estCritique = jet.valeurRetenue === 20;
    issue = estCritique ? 'CRITICAL_SUCCESS' : 'SUCCESS';
    degatsInfliges = interpreterJetDegats(arme.degats);
    if (estCritique) degatsInfliges += interpreterJetDegats(arme.degats);

    cible.pv = Math.max(0, cible.pv - degatsInfliges);
    desc = `${persoClone.nom} touche ${cible.nom} (${totalTouche} vs CA ${caCible}) et inflige ${degatsInfliges} dégâts. (PV restants : ${cible.pv}/${cible.pvMax})`;

    if (cible.pv === 0) {
      cible.statut = 'MORT';
      desc += ` ${cible.nom} s'effondre, sans vie.`;
    }
  } else {
    desc = `${persoClone.nom} rate ${cible.nom} (${totalTouche} vs CA ${caCible}).`;
  }

  combatClone.journalCombat.push(desc);

  // Vérifier si tous les ennemis sont morts ou en fuite
  const ennemisActifs = combatClone.ennemis.filter(e => e.statut === 'ACTIF');
  if (ennemisActifs.length === 0) {
    combatClone.actif = false;
    combatClone.journalCombat.push('Victoire tactique : tous les adversaires sont éliminés ou en fuite.');
  }

  const adjudication: AdjudicationPayload = {
    phase: 'adjudication_resolved',
    action_type: 'ATTACK',
    competenceOuCarac: `Attaque ${arme.nom}`,
    dice_roll: jet.valeurRetenue,
    type_lancer: typeJet,
    modificateur: bonusTotal,
    score_total: totalTouche,
    cible_dd_ou_ca: caCible,
    issue,
    mutations_etat: {
      degatsInfliges,
      descriptionTechnique: desc,
    },
  };

  return { combatModifie: combatClone, personnageModifie: persoClone, adjudication };
}

export function executerTourEnnemi(
  ennemi: Combatant,
  joueur: CharacterStats,
  combat: CombatState
): {
  combatModifie: CombatState;
  personnageModifie: CharacterStats;
  adjudication: AdjudicationPayload;
} {
  const combatClone: CombatState = JSON.parse(JSON.stringify(combat));
  const persoClone: CharacterStats = JSON.parse(JSON.stringify(joueur));
  const ennemieEnCours = combatClone.ennemis.find(e => e.id === ennemi.id);

  if (!ennemieEnCours || ennemieEnCours.statut !== 'ACTIF') {
    return {
      combatModifie: combatClone,
      personnageModifie: persoClone,
      adjudication: {
        phase: 'adjudication_resolved',
        action_type: 'ATTACK',
        dice_roll: 0,
        modificateur: 0,
        score_total: 0,
        cible_dd_ou_ca: 0,
        issue: 'SUCCESS',
        mutations_etat: { descriptionTechnique: `${ennemi.nom} n'est pas en mesure d'agir.` },
      },
    };
  }

  // IA Comportementale déterministe
  let desc = '';
  let degatsInfliges = 0;
  let issue: AdjudicationPayload['issue'] = 'FAILURE';

  if (ennemieEnCours.comportement === 'RUSE_ET_FUITE' && ennemieEnCours.pv <= ennemieEnCours.pvMax * 0.3) {
    // Gobelin fuit si blessé gravement
    ennemieEnCours.statut = 'FUITE';
    desc = `${ennemieEnCours.nom} prend panique, utilise son action bonus pour se désengager et détale dans les fourrés.`;
    issue = 'SUCCESS';
    combatClone.journalCombat.push(desc);

    const adjudication: AdjudicationPayload = {
      phase: 'adjudication_resolved',
      action_type: 'TACTICAL_FLEE',
      dice_roll: 20,
      modificateur: 0,
      score_total: 20,
      cible_dd_ou_ca: 10,
      issue: 'SUCCESS',
      mutations_etat: { descriptionTechnique: desc },
    };
    return { combatModifie: combatClone, personnageModifie: persoClone, adjudication };
  }

  // Attaque standard de l'ennemi (Désavantage si le joueur a esquivé)
  const typeJetEnnemi = combatClone.postureDefensive ? 'desavantage' : 'normal';
  const jet = lancerD20(typeJetEnnemi);
  combatClone.postureDefensive = false; // Réinitialisation de la posture après attaque
  const scoreTouche = jet.valeurRetenue + ennemieEnCours.bonusAttaque;
  const caJoueur = persoClone.ca;

  if (jet.valeurRetenue === 20 || (jet.valeurRetenue !== 1 && scoreTouche >= caJoueur)) {
    issue = jet.valeurRetenue === 20 ? 'CRITICAL_SUCCESS' : 'SUCCESS';
    degatsInfliges = interpreterJetDegats(ennemieEnCours.degatsDes);
    if (jet.valeurRetenue === 20) degatsInfliges += interpreterJetDegats(ennemieEnCours.degatsDes);

    persoClone.pvActuels = Math.max(0, persoClone.pvActuels - degatsInfliges);
    desc = `${ennemieEnCours.nom} frappe ${persoClone.nom} (${scoreTouche} vs CA ${caJoueur}) et inflige ${degatsInfliges} dégâts. (PV Joueur : ${persoClone.pvActuels}/${persoClone.pvMax})`;

    if (persoClone.pvActuels === 0) {
      desc += ` ${persoClone.nom} s'écroule à 0 PV. Début des jets de sauvegarde contre la mort.`;
      if (!persoClone.conditions.includes('Inconscient')) {
        persoClone.conditions.push('Inconscient');
      }
    }
  } else {
    desc = `${ennemieEnCours.nom} tente une frappe mais rate ${persoClone.nom} (${scoreTouche} vs CA ${caJoueur}${typeJetEnnemi === 'desavantage' ? ' sous esquive' : ''}).`;
  }

  combatClone.journalCombat.push(desc);

  const adjudication: AdjudicationPayload = {
    phase: 'adjudication_resolved',
    action_type: 'ATTACK',
    competenceOuCarac: `Attaque ennemie (${ennemi.nom})`,
    dice_roll: jet.valeurRetenue,
    type_lancer: typeJetEnnemi,
    modificateur: ennemieEnCours.bonusAttaque,
    score_total: scoreTouche,
    cible_dd_ou_ca: caJoueur,
    issue,
    mutations_etat: {
      degatsInfliges,
      pvDelta: -degatsInfliges,
      descriptionTechnique: desc,
    },
  };

  return { combatModifie: combatClone, personnageModifie: persoClone, adjudication };
}

export function executerEsquiveJoueur(
  joueur: CharacterStats,
  combat: CombatState
): {
  combatModifie: CombatState;
  personnageModifie: CharacterStats;
  adjudication: AdjudicationPayload;
} {
  const combatClone: CombatState = JSON.parse(JSON.stringify(combat));
  combatClone.postureDefensive = true;
  const desc = `${joueur.nom} adopte une posture défensive (Esquive SRD 5e). Les assauts ennemis subiront un désavantage.`;
  combatClone.journalCombat.push(desc);

  const adjudication: AdjudicationPayload = {
    phase: 'adjudication_resolved',
    action_type: 'DEFENSIVE_STANCE',
    competenceOuCarac: 'Esquive active (Défense)',
    dice_roll: 20,
    modificateur: 0,
    score_total: 20,
    cible_dd_ou_ca: 0,
    issue: 'SUCCESS',
    mutations_etat: {
      descriptionTechnique: desc,
    },
  };

  return { combatModifie: combatClone, personnageModifie: JSON.parse(JSON.stringify(joueur)), adjudication };
}

export function executerSortJoueur(
  joueur: CharacterStats,
  combat: CombatState,
  sortNom: string,
  cibleId?: string
): {
  combatModifie: CombatState;
  personnageModifie: CharacterStats;
  adjudication: AdjudicationPayload;
} {
  const combatClone: CombatState = JSON.parse(JSON.stringify(combat));
  const persoClone: CharacterStats = JSON.parse(JSON.stringify(joueur));

  // Vérifier et consommer l'emplacement
  const slotDispo = persoClone.emplacementsSorts.find(s => s.total - s.utilise > 0);
  if (!slotDispo) {
    throw new Error('Aucun emplacement de sort disponible pour lancer un sort.');
  }
  slotDispo.utilise += 1;

  let desc = '';
  let degatsInfliges = 0;
  let soinDelta = 0;
  let issue: AdjudicationPayload['issue'] = 'SUCCESS';
  let jetTotal = 0;
  let cibleDdCa = 0;

  if (sortNom === 'Soin des blessures') {
    const modSag = calculerModificateur(persoClone.caracteristiques.SAG);
    const soin = Math.floor(Math.random() * 8) + 1 + Math.max(0, modSag);
    const pvAvant = persoClone.pvActuels;
    persoClone.pvActuels = Math.min(persoClone.pvMax, persoClone.pvActuels + soin);
    soinDelta = persoClone.pvActuels - pvAvant;
    desc = `${persoClone.nom} canalise une étincelle curative : +${soinDelta} PV récupérés. Emplacement de sort niveau ${slotDispo.niveau} dépensé.`;
    jetTotal = soin;
  } else {
    // Sort offensif (par ex: Trait de feu / Décharge occulte)
    const cible = combatClone.ennemis.find(e => e.id === cibleId) || combatClone.ennemis.find(e => e.statut === 'ACTIF');
    if (!cible) {
      throw new Error('Aucune cible valide pour le sort');
    }
    const modInt = Math.max(
      calculerModificateur(persoClone.caracteristiques.INT),
      calculerModificateur(persoClone.caracteristiques.SAG)
    );
    const bonusAttaqueSort = modInt + persoClone.bonusMaitrise;
    const jet = lancerD20(persoClone.epuisement >= 3 ? 'desavantage' : 'normal');
    jetTotal = jet.valeurRetenue + bonusAttaqueSort;
    cibleDdCa = cible.ca;

    if (jet.valeurRetenue === 20 || (jet.valeurRetenue !== 1 && jetTotal >= cible.ca)) {
      degatsInfliges = Math.floor(Math.random() * 10) + 1;
      if (jet.valeurRetenue === 20) degatsInfliges += Math.floor(Math.random() * 10) + 1;
      cible.pv = Math.max(0, cible.pv - degatsInfliges);
      desc = `${persoClone.nom} projette un sortilège sur ${cible.nom} (${jetTotal} vs CA ${cible.ca}) : ${degatsInfliges} dégâts arcaniques.`;
      if (cible.pv === 0) {
        cible.statut = 'MORT';
        desc += ` ${cible.nom} est anéanti.`;
      }
      issue = jet.valeurRetenue === 20 ? 'CRITICAL_SUCCESS' : 'SUCCESS';
    } else {
      desc = `${persoClone.nom} libère son énergie arcanique mais l'éclair s'écrase sur les rochers (${jetTotal} vs CA ${cible.ca}). Emplacement dépensé.`;
      issue = 'FAILURE';
    }
  }

  combatClone.journalCombat.push(desc);

  // Vérification fin de combat si tous ennemis morts
  if (!combatClone.ennemis.some(e => e.statut === 'ACTIF')) {
    combatClone.actif = false;
    combatClone.journalCombat.push('Victoire arcanique : zone pacifiée.');
  }

  const adjudication: AdjudicationPayload = {
    phase: 'adjudication_resolved',
    action_type: 'SPELL',
    competenceOuCarac: `Sortilège : ${sortNom}`,
    dice_roll: jetTotal,
    modificateur: 0,
    score_total: jetTotal,
    cible_dd_ou_ca: cibleDdCa,
    issue,
    mutations_etat: {
      degatsInfliges: degatsInfliges > 0 ? degatsInfliges : undefined,
      pvDelta: soinDelta > 0 ? soinDelta : undefined,
      emplacementConsomme: 1,
      descriptionTechnique: desc,
    },
  };

  return { combatModifie: combatClone, personnageModifie: persoClone, adjudication };
}

export function executerFuiteJoueur(
  joueur: CharacterStats,
  combat: CombatState
): {
  combatModifie: CombatState;
  personnageModifie: CharacterStats;
  adjudication: AdjudicationPayload;
  fuiteReussie: boolean;
} {
  const combatClone: CombatState = JSON.parse(JSON.stringify(combat));
  const persoClone: CharacterStats = JSON.parse(JSON.stringify(joueur));

  const modDex = calculerModificateur(persoClone.caracteristiques.DEX);
  const typeJet = persoClone.epuisement >= 1 ? 'desavantage' : 'normal';
  const jet = lancerD20(typeJet);
  const total = jet.valeurRetenue + modDex;
  const ddFuite = 12;
  const fuiteReussie = total >= ddFuite;

  let desc = '';
  if (fuiteReussie) {
    combatClone.actif = false;
    desc = `${persoClone.nom} se désengage habilement (${total} vs DD ${ddFuite}) et rompt le combat pour se replier.`;
  } else {
    desc = `${persoClone.nom} tente de fuir mais trébuche dans les décombres (${total} vs DD ${ddFuite}). L'ennemi bloque la retraite.`;
  }
  combatClone.journalCombat.push(desc);

  const adjudication: AdjudicationPayload = {
    phase: 'adjudication_resolved',
    action_type: 'TACTICAL_FLEE',
    competenceOuCarac: 'Désengagement et fuite tactique (DEX)',
    dice_roll: jet.valeurRetenue,
    type_lancer: typeJet,
    modificateur: modDex,
    score_total: total,
    cible_dd_ou_ca: ddFuite,
    issue: fuiteReussie ? 'SUCCESS' : 'FAILURE',
    mutations_etat: {
      descriptionTechnique: desc,
    },
  };

  return { combatModifie: combatClone, personnageModifie: persoClone, adjudication, fuiteReussie };
}
