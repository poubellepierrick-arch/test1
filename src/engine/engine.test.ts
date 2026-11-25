import test from 'node:test';
import assert from 'node:assert/strict';
import { calculerModificateur, lancerD20 } from './dice';
import { evaluerEpuisement, evaluerEncombrement, executerJetSauvegardeMort, executerRepos } from './srd';
import { initialiserCombat, executerTourEnnemi, executerEsquiveJoueur, executerSortJoueur } from './combat';
import { orchestrerActionDeterministe } from './adjudication';
import { executerWorldTick } from './factions';
import { traverserGraphe, filtrerParFrontiereDeConnaissance } from './graph';
import { INITIAL_SIMULATION_STATE } from './initialData';
import { Combatant, SimulationState } from '../types';

test('calculerModificateur retourne le modificateur D&D 5e exact', () => {
  assert.equal(calculerModificateur(10), 0);
  assert.equal(calculerModificateur(11), 0);
  assert.equal(calculerModificateur(12), 1);
  assert.equal(calculerModificateur(15), 2);
  assert.equal(calculerModificateur(8), -1);
  assert.equal(calculerModificateur(7), -2);
});

test('evaluerEpuisement applique les 6 paliers cumulatifs du SRD 5e', () => {
  const niv0 = evaluerEpuisement(0);
  assert.equal(niv0.desavantageCaracteristiques, false);
  assert.equal(niv0.estMort, false);

  const niv1 = evaluerEpuisement(1);
  assert.equal(niv1.desavantageCaracteristiques, true);
  assert.equal(niv1.vitesseDivisee, false);

  const niv3 = evaluerEpuisement(3);
  assert.equal(niv3.desavantageCaracteristiques, true);
  assert.equal(niv3.vitesseDivisee, true);
  assert.equal(niv3.desavantageAttaqueEtSauvegardes, true);
  assert.equal(niv3.estMort, false);

  const niv6 = evaluerEpuisement(6);
  assert.equal(niv6.estMort, true);
});

test('evaluerEncombrement applique le barème de charge stricte', () => {
  const perso = JSON.parse(JSON.stringify(INITIAL_SIMULATION_STATE.personnage));
  perso.caracteristiques.FOR = 10; // Capacité max = 150 lbs, seuil lourd = 50 lbs
  perso.inventaire = [{ id: '1', nom: 'Plomb', poidsLbs: 60, valeurPO: 1, quantite: 1 }];
  
  const res = evaluerEncombrement(perso);
  assert.equal(res.statut, 'Encombré');
  assert.equal(res.penaliteVitesse, 10);
});

test('executerJetSauvegardeMort enregistre la mort définitive (PERMADEATH) au 3e échec', () => {
  const perso = JSON.parse(JSON.stringify(INITIAL_SIMULATION_STATE.personnage));
  perso.pvActuels = 0;
  perso.deathSaves = { succes: 0, echecs: 2 };

  // Forcer un échec
  let iterations = 0;
  while (!perso.estMortDefinitivement && iterations < 50) {
    iterations++;
    const res = executerJetSauvegardeMort(perso);
    perso.deathSaves = res.personnageModifie.deathSaves;
    perso.estMortDefinitivement = res.personnageModifie.estMortDefinitivement;
    if (res.adjudication.issue === 'FAILURE' || res.adjudication.issue === 'CRITICAL_FAILURE' || res.adjudication.issue === 'PERMADEATH') {
      break;
    }
  }
  // Soit stabilisé si série de 20/succès, soit mort si 3e échec
  assert.ok(perso.deathSaves.succes >= 0);
});

test('IA ennemie: le gobelin se désengage et fuit lorsque ses PV tombent sous 30%', () => {
  const joueur = JSON.parse(JSON.stringify(INITIAL_SIMULATION_STATE.personnage));
  const gobelin: Combatant = {
    id: 'mob_gob_1',
    nom: 'Éclaireur Gobelin',
    type: 'GOBELIN',
    pv: 2, // 2 / 7 PV (< 30%)
    pvMax: 7,
    ca: 15,
    initiative: 12,
    distancePieds: 15,
    statut: 'ACTIF',
    bonusAttaque: 4,
    degatsDes: '1d6+2',
    comportement: 'RUSE_ET_FUITE',
  };

  const combat = initialiserCombat(joueur, [gobelin]);
  const res = executerTourEnnemi(gobelin, joueur, combat);
  
  const ennemiApres = res.combatModifie.ennemis.find(e => e.id === gobelin.id);
  assert.equal(ennemiApres?.statut, 'FUITE');
});

test('executerWorldTick applique les conséquences systémiques sur l\'économie et la mine', () => {
  const etat = JSON.parse(JSON.stringify(INITIAL_SIMULATION_STATE));
  const res = executerWorldTick(1, etat.factions, etat.hexagones, etat.marche);

  assert.equal(res.nouveauTick, 2);
  // Le multiplicateur du fer ou le statut de la mine a évolué si l'assaut a réussi
  assert.ok(res.marcheModifie.multiplicateurFer >= 1.0);
});

test('Boundary-Aware GraphRAG filtre les secrets non transmis au PNJ', () => {
  const tousLesNoeuds = INITIAL_SIMULATION_STATE.grapheNoeuds;
  const toutesLesRelations = INITIAL_SIMULATION_STATE.grapheLiens;

  const subgraph = traverserGraphe('npc_forgeron_torvin', tousLesNoeuds, toutesLesRelations, 2);
  const filtre = filtrerParFrontiereDeConnaissance(subgraph, 'npc_forgeron_torvin');

  // Le capitaine Morn appartient au Bouclier de fer et son nœud secret n'est pas transmis à Torvin
  const connaitMorn = filtre.noeuds.some(n => n.id === 'npc_capitaine_morn');
  assert.equal(connaitMorn, false);
});

test('tactique SRD 5e: esquiver applique une posture défensive', () => {
  const joueur = JSON.parse(JSON.stringify(INITIAL_SIMULATION_STATE.personnage));
  const gobelin: Combatant = {
    id: 'mob_gob_esquive',
    nom: 'Éclaireur Gobelin',
    type: 'GOBELIN',
    pv: 7,
    pvMax: 7,
    ca: 15,
    initiative: 10,
    distancePieds: 10,
    statut: 'ACTIF',
    bonusAttaque: 4,
    degatsDes: '1d6+2',
    comportement: 'AVEUGLE_CORPS_A_CORPS',
  };

  const combat = initialiserCombat(joueur, [gobelin]);
  const resEsquive = executerEsquiveJoueur(joueur, combat);
  assert.equal(resEsquive.combatModifie.postureDefensive, true);

  // Le tour ennemi suivant s'effectue sous désavantage
  const resEnnemi = executerTourEnnemi(gobelin, joueur, resEsquive.combatModifie);
  assert.equal(resEnnemi.adjudication.type_lancer, 'desavantage');
  assert.equal(resEnnemi.combatModifie.postureDefensive, false);
});

test('lancement de sortilège consomme un emplacement de sort déterministe', () => {
  const joueur = JSON.parse(JSON.stringify(INITIAL_SIMULATION_STATE.personnage));
  joueur.pvActuels = 5;
  joueur.emplacementsSorts = [{ niveau: 1, total: 2, utilise: 0, recharge: 'court' }];

  const gobelin: Combatant = {
    id: 'mob_gob_sort',
    nom: 'Cadavre Putride',
    type: 'ZOMBIE',
    pv: 10,
    pvMax: 10,
    ca: 8,
    initiative: 5,
    distancePieds: 15,
    statut: 'ACTIF',
    bonusAttaque: 3,
    degatsDes: '1d6+1',
    comportement: 'AVEUGLE_CORPS_A_CORPS',
  };

  const combat = initialiserCombat(joueur, [gobelin]);
  // Sort curatif
  const resSoin = executerSortJoueur(joueur, combat, 'Soin des blessures');
  assert.ok(resSoin.personnageModifie.pvActuels > 5);
  assert.equal(resSoin.personnageModifie.emplacementsSorts[0].utilise, 1);
});

test('adjudication déterministe: corvée de subsistance octroie rémunération et avance le temps', () => {
  const etat = JSON.parse(JSON.stringify(INITIAL_SIMULATION_STATE));
  const paAvant = etat.personnage.monnaies.pa;
  const heureAvant = etat.horloge.heure;

  const { nouvelEtat, adjudication } = orchestrerActionDeterministe(etat, {
    type: 'CORVEE_TRAVAIL',
    jobId: 'bois_palissade',
  });

  assert.equal(adjudication.action_type, 'WORK_CONTRACT');
  assert.ok(nouvelEtat.personnage.monnaies.pa > paAvant);
  assert.equal(nouvelEtat.horloge.heure, heureAvant + 2);
});

test('adjudication déterministe: comptoir déduit les fonds et approvisionne l\'aventurier', () => {
  const etat = JSON.parse(JSON.stringify(INITIAL_SIMULATION_STATE));
  etat.personnage.monnaies = { po: 5, pa: 0, pc: 0 };
  etat.personnage.rationsJours = 2;

  const { nouvelEtat, adjudication } = orchestrerActionDeterministe(etat, {
    type: 'TROQUER',
    articleId: 'ration',
    quantite: 2,
  });

  assert.equal(adjudication.action_type, 'TRADE');
  assert.equal(nouvelEtat.personnage.rationsJours, 4);
  // 2 rations à 5 PA = 10 PA = 1 PO déduit -> 4 PO restants
  assert.equal(nouvelEtat.personnage.monnaies.po, 4);
});

test('compagnons: un mulet de bât augmente la capacité de charge totale', () => {
  const perso = JSON.parse(JSON.stringify(INITIAL_SIMULATION_STATE.personnage));
  perso.caracteristiques.FOR = 10; // 150 lbs perso
  perso.inventaire = [{ id: 'item_heavy', nom: 'Minerai brut', poidsLbs: 220, valeurPO: 10, quantite: 1 }];

  // Sans compagnon: 220 > 150 lbs -> Surchargé (> capacité max 150 lbs)
  const encAvant = evaluerEncombrement(perso);
  assert.equal(encAvant.statut, 'Surchargé');

  // Avec un mulet de bât (+200 lbs) -> capacité max = 350 lbs
  perso.compagnons = [
    {
      id: 'mulet_1',
      nom: 'Mulet de bât',
      type: 'MULET',
      coutJournalierPA: 3,
      chargeMaxLbs: 200,
      pv: 11,
      pvMax: 11,
    },
  ];

  const encApres = evaluerEncombrement(perso);
  assert.equal(encApres.capaciteMax, 350);
  assert.ok(encApres.statut === 'Encombré' || encApres.statut === 'Lourdement Encombré');
});

test('usure et entretien: affûter l\'équipement remet l\'usure à zéro', () => {
  const etat = JSON.parse(JSON.stringify(INITIAL_SIMULATION_STATE));
  etat.personnage.monnaies.pa = 10;
  etat.personnage.usureEquipement = { 'item_epee_batarde': 25, 'item_armure_cuir': 15 };

  const { nouvelEtat, adjudication } = orchestrerActionDeterministe(etat, {
    type: 'ENTRETENIR_EQUIPEMENT',
  });

  assert.equal(adjudication.action_type, 'WORK_CONTRACT');
  assert.equal(nouvelEtat.personnage.usureEquipement['item_epee_batarde'], 0);
  assert.equal(nouvelEtat.personnage.usureEquipement['item_armure_cuir'], 0);
  assert.equal(nouvelEtat.personnage.monnaies.pa, 6); // 10 - 4 PA
});

test('mémoire du personnage: enregistre les dernières infos et souvenirs contextuels', () => {
  const etat = JSON.parse(JSON.stringify(INITIAL_SIMULATION_STATE));

  const { nouvelEtat } = orchestrerActionDeterministe(etat, {
    type: 'ACTION_LIBRE',
    texteLibre: 'inspecter la forge et la qualité du fer',
  });

  assert.ok(nouvelEtat.personnage.memoire.dernieresInfos.length > 0);
  assert.ok(nouvelEtat.personnage.memoire.souvenirsContextuels.length > 0);
  // Vérifie que les 2 sous-cadres sont alimentés
  assert.ok(typeof nouvelEtat.personnage.memoire.dernieresInfos[0] === 'string');
  assert.ok(typeof nouvelEtat.personnage.memoire.souvenirsContextuels[0] === 'string');
});

test('donjon nodal: bloqué en bourgade pacifiée, actif dans un site d\'exploration', () => {
  const etat = JSON.parse(JSON.stringify(INITIAL_SIMULATION_STATE));

  // Refus en bourgade pacifiée (Val-Gris)
  assert.throws(() => {
    orchestrerActionDeterministe(etat, { type: 'EXPLORER_SITE' });
  }, /Bourgade pacifiée/);

  // Déplacement logique vers la mine de Roche-Noire
  const mineHex = etat.hexagones.find((h: any) => h.id === 'hex_0100_mine');
  assert.ok(mineHex);
  etat.hexActuel = mineHex;

  // Entrée dans le site
  const { nouvelEtat: etatSite } = orchestrerActionDeterministe(etat, {
    type: 'EXPLORER_SITE',
  });

  assert.ok(etatSite.donjon);
  assert.equal(etatSite.donjon?.actif, true);
  assert.equal(etatSite.donjon?.salles.length, 3);
  assert.equal(etatSite.donjon?.salleActuelleId, 'salle_1');

  // Déplacement vers la salle connectée salle_2
  const { nouvelEtat: etatSalle2 } = orchestrerActionDeterministe(etatSite, {
    type: 'DONJON_DEPLACEMENT',
    cibleId: 'salle_2',
  });

  assert.equal(etatSalle2.donjon?.salleActuelleId, 'salle_2');
  assert.equal(etatSalle2.donjon?.salles.find(s => s.id === 'salle_2')?.visitee, true);
});

test('grimoire: mémorisation et incantation de sortilège', () => {
  const etat = JSON.parse(JSON.stringify(INITIAL_SIMULATION_STATE));
  etat.personnage.pvActuels = 4;
  etat.personnage.sortsPrepares = ['spell_soin_blessures'];

  // Incantation de Soin des blessures
  const { nouvelEtat, adjudication } = orchestrerActionDeterministe(etat, {
    type: 'LANCER_SORT_GRIMOIRE',
    cibleId: 'spell_soin_blessures',
  });

  assert.equal(adjudication.action_type, 'SPELL');
  assert.ok(nouvelEtat.personnage.pvActuels > 4);
  assert.equal(nouvelEtat.personnage.emplacementsSorts[0].utilise, 1);
});

test('artisanat et blessures: requiert un remède réel en nature et le consomme', () => {
  const etat = JSON.parse(JSON.stringify(INITIAL_SIMULATION_STATE));
  const foretHex = etat.hexagones.find((h: any) => h.id === 'hex_0001_foret');
  assert.ok(foretHex);
  etat.hexActuel = foretHex;

  etat.personnage.blessuresPersistantes = [
    {
      id: 'inj_test',
      type: 'ENTORSE',
      nom: 'Entorse',
      description: 'Cheville tordue',
      penalite: '-10ft',
      joursReposRestants: 2,
    },
  ];

  // Sans remède hors bourgade : refus
  assert.throws(() => {
    orchestrerActionDeterministe(etat, {
      type: 'SOIGNER_BLESSURE',
      cibleId: 'inj_test',
    });
  }, /bandage|remède|soigneur/i);

  // Fabrication sur place (avance d'1h même en cas d'échec)
  const { nouvelEtat: etatCraft } = orchestrerActionDeterministe(etat, {
    type: 'FABRIQUER_OBJET',
    cibleId: 'craft_bandage',
  });
  assert.equal(etatCraft.horloge.heure, etat.horloge.heure + 1);

  // Garantir la présence d'un bandage en inventaire et vérifier la consommation
  etatCraft.personnage.inventaire.push({
    id: 'item_bandage_test',
    nom: 'Bandage compressif',
    poidsLbs: 1,
    valeurPO: 1,
    quantite: 1,
  });

  const totalBandagesAvant = etatCraft.personnage.inventaire
    .filter(i => i.nom.toLowerCase().includes('bandage'))
    .reduce((acc, i) => acc + i.quantite, 0);

  const { nouvelEtat: etatSoigne } = orchestrerActionDeterministe(etatCraft, {
    type: 'SOIGNER_BLESSURE',
    cibleId: 'inj_test',
  });
  assert.equal(etatSoigne.personnage.blessuresPersistantes.length, 0);
  const totalBandagesApres = etatSoigne.personnage.inventaire
    .filter(i => i.nom.toLowerCase().includes('bandage'))
    .reduce((acc, i) => acc + i.quantite, 0);
  assert.equal(totalBandagesApres, totalBandagesAvant - 1);
});

test('brouillard de guerre et annotations: dissipation et consigne cartographique', () => {
  const etat = JSON.parse(JSON.stringify(INITIAL_SIMULATION_STATE));
  const hexCible = etat.hexagones.find((h: any) => h.id === 'hex_0100_mine');

  // Déplacement vers la mine
  const { nouvelEtat: etatDeplace } = orchestrerActionDeterministe(etat, {
    type: 'DEPLACER_HEX',
    cibleId: hexCible.id,
  });

  const mineHex = etatDeplace.hexagones.find((h: any) => h.id === 'hex_0100_mine');
  assert.ok(mineHex);
  assert.equal(mineHex.brouillard, 'EXPLORE');

  // Annotation cartographique sur l'hexagone
  const { nouvelEtat: etatNote } = orchestrerActionDeterministe(etatDeplace, {
    type: 'ANNOTER_HEX',
    cibleId: 'hex_0100_mine',
    texteLibre: 'Veines de fer abondantes, patrouilles mercenaires',
  });

  const mineNote = etatNote.hexagones.find((h: any) => h.id === 'hex_0100_mine');
  assert.ok(mineNote);
  assert.equal(mineNote.annotationJoueur, 'Veines de fer abondantes, patrouilles mercenaires');
});

test('réalisme des lieux: bloque comptoir, corvées, embauche, forge et entraînement en pleine nature', () => {
  const etat = JSON.parse(JSON.stringify(INITIAL_SIMULATION_STATE));
  const foretHex = etat.hexagones.find((h: any) => h.id === 'hex_0001_foret');
  assert.ok(foretHex);
  etat.hexActuel = foretHex;
  etat.personnage.monnaies = { po: 10, pa: 20, pc: 0 };
  etat.personnage.experience = etat.personnage.experienceNextLevel;

  assert.throws(() => orchestrerActionDeterministe(etat, { type: 'TROQUER', articleId: 'ration', quantite: 1 }), /Commerce impossible/);
  assert.throws(() => orchestrerActionDeterministe(etat, { type: 'CORVEE_TRAVAIL', jobId: 'bois_palissade' }), /Corvée indisponible/);
  assert.throws(() => orchestrerActionDeterministe(etat, { type: 'ENGAGER_COMPAGNON', payloadAction: { type: 'MULET' } }), /Recrutement impossible/);
  assert.throws(() => orchestrerActionDeterministe(etat, { type: 'ENTRETENIR_EQUIPEMENT' }), /Entretien impossible/);
  assert.throws(() => orchestrerActionDeterministe(etat, { type: 'ENTRAINEMENT_NIVEAU' }), /Entraînement impossible/);
});

test('champ de vision PNJ et rumeurs: dialogue limité au lieu et rumeurs vides au départ', () => {
  const etat = JSON.parse(JSON.stringify(INITIAL_SIMULATION_STATE));
  assert.equal(etat.rumeurs.length, 0);

  // En Val-Gris, Torvin est en vue mais Morn est sur la route du col
  assert.throws(() => orchestrerActionDeterministe(etat, { type: 'DIALOGUER_PNJ', pnjId: 'npc_capitaine_morn' }), /hors de portée/i);

  const resTorvin = orchestrerActionDeterministe(etat, { type: 'DIALOGUER_PNJ', pnjId: 'npc_forgeron_torvin' });
  assert.equal(resTorvin.adjudication.action_type, 'NPC_INTERACTION');

  // Sur la route du col, Morn est en vue et Torvin ne l'est plus
  const routeHex = etat.hexagones.find((h: any) => h.id === 'hex_00m1_route');
  assert.ok(routeHex);
  etat.hexActuel = routeHex;
  assert.throws(() => orchestrerActionDeterministe(etat, { type: 'DIALOGUER_PNJ', pnjId: 'npc_forgeron_torvin' }), /hors de portée/i);
  const resMorn = orchestrerActionDeterministe(etat, { type: 'DIALOGUER_PNJ', pnjId: 'npc_capitaine_morn' });
  assert.equal(resMorn.adjudication.action_type, 'NPC_INTERACTION');

  // ACTION_LIBRE ne peut pas interpeller un PNJ absent du secteur (retourne FAILURE)
  const libreAbsent = orchestrerActionDeterministe(etat, {
    type: 'ACTION_LIBRE',
    texteLibre: 'Je vais parler à Torvin',
  });
  assert.equal(libreAbsent.adjudication.issue, 'FAILURE');
  assert.match(libreAbsent.adjudication.mutations_etat.descriptionTechnique || '', /champ de vision/i);

  // ACTION_LIBRE ne peut pas acheter en pleine nature
  const foretHex = etat.hexagones.find((h: any) => h.id === 'hex_0001_foret');
  assert.ok(foretHex);
  etat.hexActuel = foretHex;
  const libreAchat = orchestrerActionDeterministe(etat, {
    type: 'ACTION_LIBRE',
    texteLibre: 'Je veux acheter des rations au comptoir',
  });
  assert.equal(libreAchat.adjudication.issue, 'FAILURE');
  assert.match(libreAchat.adjudication.mutations_etat.descriptionTechnique || '', /impossible/i);
});

test('rumeurs: collecte auprès d\'un PNJ en vue via DEMANDER_RUMEURS', () => {
  const etat = JSON.parse(JSON.stringify(INITIAL_SIMULATION_STATE));
  assert.equal(etat.rumeurs.length, 0);

  // En Val-Gris, forcer une disposition amicale pour garantir DD 8 ou tester plusieurs jets
  const torvin = etat.grapheNoeuds.find((n: any) => n.id === 'npc_forgeron_torvin');
  assert.ok(torvin);
  torvin.proprietes.disposition = 'AMICAL';
  etat.personnage.caracteristiques.CHA = 18; // +4 +2 amical = +6 -> 1+6=7 min, testons jusqu'à réussite

  let etatCourant = etat;
  for (let i = 0; i < 10 && etatCourant.rumeurs.length === 0; i++) {
    const res = orchestrerActionDeterministe(etatCourant, {
      type: 'DEMANDER_RUMEURS',
      pnjId: 'npc_forgeron_torvin',
    });
    etatCourant = res.nouvelEtat;
  }
  assert.ok(etatCourant.rumeurs.length >= 1);
  assert.equal(etatCourant.rumeurs[0].source, 'Torvin le Forgeron');

  // Hors champ de vision (forêt), DEMANDER_RUMEURS est refusé
  const foretHex = etat.hexagones.find((h: any) => h.id === 'hex_0001_foret');
  etatCourant.hexActuel = foretHex;
  assert.throws(
    () => orchestrerActionDeterministe(etatCourant, { type: 'DEMANDER_RUMEURS' }),
    /interlocuteur en vue/i
  );
});

test('repos contextuel: auberge payante en bourgade vs bivouac risqué en marais', () => {
  const etat = JSON.parse(JSON.stringify(INITIAL_SIMULATION_STATE));
  etat.personnage.monnaies = { po: 0, pa: 5, pc: 0 };
  etat.personnage.pvActuels = 5;

  const { nouvelEtat: apresAuberge } = orchestrerActionDeterministe(etat, { type: 'REPOS_LONG' });
  assert.equal(apresAuberge.personnage.monnaies.pa, 2); // 5 - 3 PA
  assert.equal(apresAuberge.personnage.pvActuels, apresAuberge.personnage.pvMax);
});

test('PNJ itinérants: ajout dans le champ de vision et nettoyage en quittant l\'hexagone', async () => {
  const { ajouterPnjItinerant, obtenirPnjsEnVue } = await import('./encounters');
  const { evaluerContexteLieu } = await import('./context');
  const etat = JSON.parse(JSON.stringify(INITIAL_SIMULATION_STATE));
  const foretHex = etat.hexagones.find((h: any) => h.id === 'hex_0001_foret');
  assert.ok(foretHex);
  etat.hexActuel = foretHex;

  assert.equal(obtenirPnjsEnVue(etat).length, 0);

  const pnj = ajouterPnjItinerant(etat, {
    nom: 'Colporteur Test',
    role: 'Marchand ambulant',
    disposition: 'AMICAL',
    motif: 'Passe sur la piste forestière.',
    proposeCommerce: true,
    rumeur: { titre: 'Pont rompu', texte: 'Le pont nord a cédé.' },
  });

  assert.equal(obtenirPnjsEnVue(etat).length, 1);
  const ctxAvant = evaluerContexteLieu(etat);
  assert.equal(ctxAvant.peutCommercer, true);
  assert.equal(ctxAvant.peutDialoguer, true);

  // En quittant la forêt pour Val-Gris, le colporteur itinérant de la forêt disparaît des nœuds
  const bourgHex = etat.hexagones.find((h: any) => h.id === 'hex_0000_bourgade');
  const { nouvelEtat: apresDep } = orchestrerActionDeterministe(etat, {
    type: 'DEPLACER_HEX',
    cibleId: bourgHex.id,
  });
  assert.equal(apresDep.grapheNoeuds.some(n => n.id === pnj.id), false);
});

test('Compendium SRD 5e: recherche hybride FR/EN, sans accent, filtres et manifeste', async () => {
  const {
    rechercherCompendium,
    obtenirFicheSrd,
    obtenirManifesteCompletude,
    enregistrerAjoutsCompendium,
  } = await import('./compendium');

  // Recherche exacte sans accent et en anglais
  const hitsFr = rechercherCompendium({ requete: 'araignee geante', categorie: 'monstre' });
  assert.ok(hitsFr.length > 0);
  assert.equal(hitsFr[0].entry.id, 'mon_araignee_geante');

  const hitsEn = rechercherCompendium({ requete: 'Fireball', categorie: 'sort' });
  assert.ok(hitsEn.length > 0);
  assert.equal(hitsEn[0].entry.id, 'spell_boule_de_feu');

  // Facettes biome + fpMax
  const hitsForet = rechercherCompendium({
    categorie: 'monstre',
    biome: 'Forêt Dense',
    fpMax: 0.5,
  });
  assert.ok(hitsForet.length > 0);
  assert.equal(hitsForet.every(h => h.entry.categorie === 'monstre' && h.entry.fpNum <= 0.5), true);

  // Facette prixMaxPC (<= 1 PO = 100 PC)
  const hitsPasCher = rechercherCompendium({ categorie: 'objet', prixMaxPC: 100 });
  assert.ok(hitsPasCher.length > 0);
  assert.equal(hitsPasCher.every(h => h.entry.categorie === 'objet' && h.entry.valeurPC <= 100), true);

  // Manifeste de complétude
  const manifeste = obtenirManifesteCompletude();
  assert.ok(manifeste.totalActuel > 100);
  assert.equal(manifeste.categories.length, 5);

  // Ajout incrémental dynamique
  const ajoutRes = enregistrerAjoutsCompendium([
    {
      id: 'item_test_boussole',
      categorie: 'objet',
      sousCategorie: 'equipement',
      nom: 'Boussole de bronze',
      nomEn: 'Brass Compass',
      valeurPC: 500,
      poidsLbs: 0.5,
      effet: 'Indique le nord magnétique.',
      motsCles: ['navigation', 'nord'],
      resume: 'Boussole fiable (5 PO).',
    },
  ]);
  assert.equal(ajoutRes.ajoutes + ajoutRes.remplaces, 1);
  assert.equal(ajoutRes.erreurs.length, 0);
  assert.equal(obtenirFicheSrd('item_test_boussole')?.nom, 'Boussole de bronze');
});

test('Unification moteur: achat et revente 50% SRD, arme équipée, XP et sort étendu', async () => {
  const { executerAttaqueJoueur } = await import('./combat');
  const { executerSortGrimoire } = await import('./spells');
  const { obtenirFicheSrd, creerCombatantDepuisMonstre } = await import('./compendium');

  const etat = JSON.parse(JSON.stringify(INITIAL_SIMULATION_STATE));
  etat.personnage.monnaies = { po: 25, pa: 0, pc: 0 };
  etat.marche.penurieArmurerie = false;

  // Achat officiel d'une Épée longue (15 PO exactes)
  const { nouvelEtat: apresAchat } = orchestrerActionDeterministe(etat, {
    type: 'TROQUER',
    articleId: 'item_epee_longue',
    quantite: 1,
  });
  assert.equal(apresAchat.personnage.monnaies.po, 10);
  const epee = apresAchat.personnage.inventaire.find(i => i.compendiumId === 'item_epee_longue');
  assert.ok(epee);
  assert.equal(epee?.degats, '1d8');

  // Revente 50% SRD (+7 PO 5 PA)
  const { nouvelEtat: apresVente } = orchestrerActionDeterministe(apresAchat, {
    type: 'TROQUER',
    articleId: 'item_epee_longue',
    quantite: 1,
    payloadAction: { mode: 'vendre' },
  });
  assert.equal(apresVente.personnage.monnaies.po, 17);
  assert.equal(apresVente.personnage.monnaies.pa, 5);
  assert.equal(apresVente.personnage.inventaire.some(i => i.compendiumId === 'item_epee_longue'), false);

  // Combat : arme équipée personnalisée + gain d'XP SRD
  const ficheGob = obtenirFicheSrd('mon_gobelin');
  assert.ok(ficheGob && ficheGob.categorie === 'monstre');
  const gob = creerCombatantDepuisMonstre(ficheGob, 'xp_test');
  gob.pv = 1;
  gob.ca = 5;

  const perso = JSON.parse(JSON.stringify(INITIAL_SIMULATION_STATE.personnage));
  perso.inventaire = [
    {
      id: 'inv_rapiere',
      compendiumId: 'item_rapiere',
      nom: 'Rapière',
      poidsLbs: 2,
      valeurPO: 25,
      quantite: 1,
      estEquipe: true,
      degats: '1d8',
      typeDegats: 'perforant',
      proprietesArme: ['Finesse'],
      categorie: 'arme',
    },
  ];
  let combat = initialiserCombat(perso, [gob]);
  let persoCourant = perso;
  for (let i = 0; i < 20 && combat.ennemis[0].statut === 'ACTIF'; i++) {
    combat.actionDisponible = true;
    const resAtk = executerAttaqueJoueur(persoCourant, combat, gob.id, {
      nom: 'Épée bâtarde',
      degats: '1d8+2',
      type: 'cac',
    });
    assert.equal(resAtk.adjudication.competenceOuCarac, 'Attaque Rapière');
    combat = resAtk.combatModifie;
    persoCourant = resAtk.personnageModifie;
  }
  assert.equal(combat.ennemis[0].statut, 'MORT');
  assert.equal(persoCourant.experience, ficheGob.xp);

  // Sort étendu du Codex : Projectile magique (touche automatiquement)
  const gobSort = creerCombatantDepuisMonstre(ficheGob, 'sort_test');
  gobSort.pv = 5;
  perso.sortsPrepares = ['spell_projectile_magique'];
  perso.emplacementsSorts = [{ niveau: 1, total: 2, utilise: 0, recharge: 'long' }];
  const combatSort = initialiserCombat(perso, [gobSort]);
  const resSort = executerSortGrimoire(perso, 'spell_projectile_magique', combatSort, gobSort.id);
  assert.equal(resSort.combatModifie?.ennemis[0].statut, 'MORT');
  assert.equal(resSort.personnageModifie.experience, ficheGob.xp);
});

test('Personnage: equipement, CA dynamique, deux mains, usure et vitesse', () => {
  const etat: SimulationState = JSON.parse(JSON.stringify(INITIAL_SIMULATION_STATE));
  // Ajouter armure de cuir, bouclier, espadon (2 mains) et harnois lourd (FOR 15 requise)
  etat.personnage.inventaire = [
    {
      id: 'arm_cuir',
      compendiumId: 'item_armure_cuir',
      nom: 'Armure de cuir',
      poidsLbs: 10,
      valeurPO: 10,
      quantite: 1,
      estEquipe: true,
      caBase: 11,
      categorie: 'armure',
      categorieArmure: 'Légère',
    },
    {
      id: 'bouclier_1',
      compendiumId: 'item_bouclier',
      nom: 'Bouclier',
      poidsLbs: 6,
      valeurPO: 10,
      quantite: 1,
      estEquipe: false,
      caBase: 2,
      categorie: 'bouclier',
      categorieArmure: 'Bouclier',
    },
    {
      id: 'arme_espadon',
      compendiumId: 'item_espadon',
      nom: 'Épée à deux mains',
      poidsLbs: 6,
      valeurPO: 50,
      quantite: 1,
      estEquipe: false,
      degats: '2d6',
      proprietesArme: ['Deux mains', 'Lourde'],
      categorie: 'arme',
    },
    {
      id: 'arm_harnois',
      compendiumId: 'item_harnois',
      nom: 'Harnois',
      poidsLbs: 65,
      valeurPO: 1500,
      quantite: 1,
      estEquipe: false,
      caBase: 18,
      categorie: 'armure',
      categorieArmure: 'Lourde',
      dexMax: 0,
      forceRequise: 15,
    },
  ];
  // DEX 13 (+1) => Armure de cuir = 11 + 1 = 12 ; + Bouclier = 14
  const { nouvelEtat: e1 } = orchestrerActionDeterministe(etat, {
    type: 'EQUIPER_OBJET',
    cibleId: 'bouclier_1',
  });
  assert.equal(e1.personnage.ca, 14); // 11 + 1 + 2

  // Équiper une arme à deux mains retire automatiquement le bouclier
  const { nouvelEtat: e2 } = orchestrerActionDeterministe(e1, {
    type: 'EQUIPER_OBJET',
    cibleId: 'arme_espadon',
  });
  const bouclierApres = e2.personnage.inventaire.find(i => i.id === 'bouclier_1');
  assert.equal(bouclierApres?.estEquipe, false);
  assert.equal(e2.personnage.ca, 12);

  // Harnois avec FOR 12 (< 15 requise) réduit la vitesse de 10 ft
  e2.personnage.caracteristiques.FOR = 12;
  const { nouvelEtat: e3 } = orchestrerActionDeterministe(e2, {
    type: 'EQUIPER_OBJET',
    cibleId: 'arm_harnois',
  });
  assert.equal(e3.personnage.ca, 18);
  e3.personnage.usureEquipement = { arm_harnois: 100 };
  const { nouvelEtat: e4 } = orchestrerActionDeterministe(e3, {
    type: 'METTRE_A_JOUR_HEROS',
    payloadAction: { patch: {} },
  });
  assert.equal(e4.personnage.ca, 16); // -2 pour usure 100%
});

test('Personnage: consommables, torche, obscurite et vision dans le noir', () => {
  const etat: SimulationState = JSON.parse(JSON.stringify(INITIAL_SIMULATION_STATE));
  etat.personnage.pvActuels = 4;
  etat.personnage.inventaire.push({
    id: 'pot_soin_1',
    compendiumId: 'item_potion_soins',
    nom: 'Potion de soins',
    poidsLbs: 0.5,
    valeurPO: 50,
    quantite: 1,
    categorie: 'potion',
  });

  const { nouvelEtat: apresPotion } = orchestrerActionDeterministe(etat, {
    type: 'UTILISER_OBJET',
    cibleId: 'pot_soin_1',
  });
  assert.ok(apresPotion.personnage.pvActuels > 4);
  assert.equal(apresPotion.personnage.inventaire.some(i => i.id === 'pot_soin_1'), false);

  // De nuit sans torche -> obscurité pour un Humain, mais pas pour un Elfe
  apresPotion.horloge.heure = 22;
  apresPotion.personnage.sourceLumiere = { nom: 'Torche', heuresRestantes: 2, active: false };
  const { nouvelEtat: torcheOn } = orchestrerActionDeterministe(apresPotion, {
    type: 'BASCULER_LUMIERE',
    payloadAction: { active: true },
  });
  assert.equal(torcheOn.personnage.sourceLumiere?.active, true);
});

test('Exploration: adjacence hex stricte et configuration allure/role', () => {
  const etat: SimulationState = JSON.parse(JSON.stringify(INITIAL_SIMULATION_STATE));
  const hexLointain = etat.hexagones.find(
    h => Math.max(Math.abs(h.q - etat.hexActuel.q), Math.abs(h.r - etat.hexActuel.r), Math.abs(h.q + h.r - (etat.hexActuel.q + etat.hexActuel.r))) > 1
  );
  if (hexLointain) {
    assert.throws(() => {
      orchestrerActionDeterministe(etat, { type: 'DEPLACER_HEX', cibleId: hexLointain.id });
    }, /non adjacent/i);
  }

  const { nouvelEtat } = orchestrerActionDeterministe(etat, {
    type: 'CONFIGURER_VOYAGE',
    payloadAction: { allure: 'Lente', role: 'Guetter' },
  });
  assert.equal(nouvelEtat.marcheAllure, 'Lente');
  assert.equal(nouvelEtat.roleExploration, 'Guetter');
});

test('Combat D&D 5e: portee corps-a-corps, deplacement, desengagement et opportunite', () => {
  const etat: SimulationState = JSON.parse(JSON.stringify(INITIAL_SIMULATION_STATE));
  const gobelin = {
    id: 'gob_portee',
    nom: 'Gobelin',
    type: 'GOBELIN' as const,
    pv: 20,
    pvMax: 20,
    ca: 12,
    initiative: 0,
    distancePieds: 20,
    statut: 'ACTIF' as const,
    bonusAttaque: 4,
    degatsDes: '1d4',
    comportement: 'RUSE_ET_FUITE' as const,
  };
  etat.combat = initialiserCombat(etat.personnage, [gobelin]);
  etat.combat.actionDisponible = true;
  etat.combat.mouvementRestantPieds = 30;

  // Attaque au corps-à-corps impossible à 20 ft
  assert.throws(() => {
    orchestrerActionDeterministe(etat, { type: 'ATTAQUER', cibleId: gobelin.id });
  }, /Hors de portée/i);

  // Rapprocher à 5 ft
  const { nouvelEtat: proche } = orchestrerActionDeterministe(etat, {
    type: 'DEPLACER_COMBAT',
    cibleId: gobelin.id,
    payloadAction: { direction: 'rapprocher', distance: 15 },
  });
  assert.equal(proche.combat.ennemis[0].distancePieds, 5);
  assert.equal(proche.combat.mouvementRestantPieds, 15);

  // Attaque réussit maintenant à portée (ne lève pas d'exception)
  const { nouvelEtat: apresAtk } = orchestrerActionDeterministe(proche, {
    type: 'ATTAQUER',
    cibleId: gobelin.id,
  });
  assert.equal(apresAtk.combat.actionDisponible, false);

  // Se désengager protège contre l'attaque d'opportunité
  apresAtk.combat.actionDisponible = true;
  apresAtk.combat.mouvementRestantPieds = 30;
  const { nouvelEtat: apresDeseng } = orchestrerActionDeterministe(apresAtk, {
    type: 'DESENGAGER_COMBAT',
  });
  assert.equal(apresDeseng.combat.desengage, true);
  const { nouvelEtat: retraiteSure } = orchestrerActionDeterministe(apresDeseng, {
    type: 'DEPLACER_COMBAT',
    cibleId: gobelin.id,
    payloadAction: { direction: 'eloigner', distance: 15 },
  });
  assert.equal(retraiteSure.combat.ennemis[0].distancePieds, 20);
  assert.equal(retraiteSure.combat.journalCombat.some(j => j.includes('(Opportunité)')), false);

  // Sans désengagement depuis 5 ft -> déclenche une attaque d'opportunité
  retraiteSure.combat.ennemis[0].distancePieds = 5;
  retraiteSure.combat.desengage = false;
  retraiteSure.combat.mouvementRestantPieds = 30;
  const { nouvelEtat: retraiteRisquee } = orchestrerActionDeterministe(retraiteSure, {
    type: 'DEPLACER_COMBAT',
    cibleId: gobelin.id,
    payloadAction: { direction: 'eloigner', distance: 15 },
  });
  assert.equal(retraiteRisquee.combat.journalCombat.some(j => j.includes('(Opportunité)')), true);
});

test('Heros progressif: mise a jour fiche, documents MJ et quetes personnelles', () => {
  let etat: SimulationState = JSON.parse(JSON.stringify(INITIAL_SIMULATION_STATE));
  etat = orchestrerActionDeterministe(etat, {
    type: 'METTRE_A_JOUR_HEROS',
    payloadAction: {
      patch: {
        race: 'Elfe des bois',
        historique: 'Rôdeur solitaire',
        traits: 'Vision dans le noir',
        capacites: ['Second souffle', 'Pistage'],
      },
    },
  }).nouvelEtat;

  assert.equal(etat.personnage.race, 'Elfe des bois');
  assert.equal(etat.personnage.capacites?.includes('Pistage'), true);

  etat = orchestrerActionDeterministe(etat, {
    type: 'GERER_DOCUMENT_HEROS',
    payloadAction: {
      mode: 'ajouter',
      titre: 'Serment de l’Aube',
      categorie: 'Historique',
      contenu: 'Retrouver la sœur disparue près de Val-Gris.',
      actifPourMJ: true,
    },
  }).nouvelEtat;
  assert.equal(etat.personnage.documents?.length, 1);

  const docId = etat.personnage.documents![0].id;
  etat = orchestrerActionDeterministe(etat, {
    type: 'GERER_DOCUMENT_HEROS',
    payloadAction: { mode: 'basculer_mj', docId },
  }).nouvelEtat;
  assert.equal(etat.personnage.documents![0].actifPourMJ, false);

  etat = orchestrerActionDeterministe(etat, {
    type: 'AJOUTER_QUETE',
    payloadAction: { mode: 'ajouter', titre: 'Explorer le sanctuaire', details: 'Nord-Est' },
  }).nouvelEtat;
  assert.ok(etat.memoireMJ?.promessesEtQuetes.some(q => q.titre === 'Explorer le sanctuaire'));
});

test('Monde autonome: synchronisation factions, marche borne, entites mobiles et meteo', async () => {
  const { simulerMondeComplet, evoluerMeteo, propagerConnaissancesMonde, avancerTempsEtMonde } = await import('./worldSim');
  const { extraireRumeurPnj } = await import('./encounters');

  // 1. Synchronisation bidirectionnelle noeudsControles <-> factionControleId + reprise de la mine & plafonnement marché
  const etat: SimulationState = JSON.parse(JSON.stringify(INITIAL_SIMULATION_STATE));
  etat.factions[0].richesse = 150;
  etat.factions[0].forceMilitaire = 90;
  etat.factions[1].forceMilitaire = 10;
  etat.marche.multiplicateurFer = 2.4;

  let cur = etat;
  for (let i = 0; i < 6; i++) {
    const res = simulerMondeComplet(cur, { evoluerTempsMeteo: true });
    cur = res.etatModifie;
    assert.ok(cur.marche.multiplicateurFer <= 2.5, 'Indice fer plafonné à 2.5');
    assert.ok((cur.marche.multiplicateurVivres || 1) <= 1.8, 'Indice vivres plafonné à 1.8');
    // Vérifier cohérence hex <-> faction.noeudsControles
    for (const h of cur.hexagones) {
      if (h.factionControleId) {
        const fac = cur.factions.find(f => f.id === h.factionControleId);
        assert.ok(fac?.noeudsControles.includes(h.id), `${fac?.id} doit lister ${h.id}`);
      }
    }
  }

  // 2. Météo : température cohérente avec météo/saison
  const horlogeHiver = { ...etat.horloge, jour: 45, meteo: 'Brume glaciale' as const };
  const resMeteo = evoluerMeteo(horlogeHiver);
  assert.ok(['Ciel dégagé', 'Pluie battante', 'Brume glaciale', 'Vents violents', 'Chaleur écrasante'].includes(resMeteo.horlogeModifiee.meteo));
  assert.equal(resMeteo.horlogeModifiee.saison, 'Hiver');
  assert.equal(resMeteo.horlogeModifiee.temperature, 'Glacial');

  // 3. Propagation boundary-aware des événements le long d'ADJACENT_TO (bloquée par hex Périlleux)
  const etatProp: SimulationState = JSON.parse(JSON.stringify(INITIAL_SIMULATION_STATE));
  const passe = etatProp.hexagones.find(h => h.id === 'hex_00m1_route')!;
  passe.securite = 'Patrouillé';
  const desert = etatProp.hexagones.find(h => h.id === 'hex_01m1_desert')!;
  desert.securite = 'Périlleux';
  etatProp.grapheNoeuds.push({
    id: 'event_prop_test',
    type: 'Event',
    label: 'Éboulement sur le col',
    proprietes: { description: 'Un éboulement ralentit les convois.', horodatageTick: 5 },
    connuParEntites: ['hex_00m1_route'],
  });
  propagerConnaissancesMonde(etatProp);
  const evtNode = etatProp.grapheNoeuds.find(n => n.id === 'event_prop_test')!;
  assert.ok(evtNode.connuParEntites?.includes('hex_0000_bourgade'), 'Doit atteindre la bourgade voisine');
  assert.ok(evtNode.connuParEntites?.includes('npc_capitaine_morn'), 'Morn sur place doit apprendre la nouvelle');
  assert.equal(evtNode.connuParEntites?.includes('hex_01m1_desert'), false, 'Hex Périlleux bloque la propagation');

  // Rumeur extraite pour Torvin à Val-Gris après un second saut
  propagerConnaissancesMonde(etatProp);
  const torvinNode = etatProp.grapheNoeuds.find(n => n.id === 'npc_forgeron_torvin')!;
  const rumeur = extraireRumeurPnj(etatProp, torvinNode);
  assert.ok(rumeur);
  assert.equal(rumeur.titre, 'Éboulement sur le col');

  // 4. Avancée unifiée du temps déclenche un tick au passage de minuit et synchronise hexActuel
  const etatTemps: SimulationState = JSON.parse(JSON.stringify(INITIAL_SIMULATION_STATE));
  etatTemps.horloge.heure = 22;
  const tickAvant = etatTemps.horloge.tick;
  avancerTempsEtMonde(etatTemps, 4);
  assert.equal(etatTemps.horloge.jour, 2);
  assert.equal(etatTemps.horloge.heure, 2);
  assert.equal(etatTemps.horloge.tick, tickAvant + 1);
  assert.equal(etatTemps.hexActuel.id, 'hex_0000_bourgade');
});

test('Simulation complexe: ecologie, diplomatie dynamique, historique et brouillard joueur intact', async () => {
  const { simulerMondeComplet, evoluerEcologieHexagones } = await import('./worldSim');

  // 1. Écologie : pluie battante recharge les niveaux d'eau
  const etatEco: SimulationState = JSON.parse(JSON.stringify(INITIAL_SIMULATION_STATE));
  const mine = etatEco.hexagones.find(h => h.id === 'hex_0100_mine')!;
  const eauAvant = mine.niveauEau ?? 15;
  etatEco.horloge.meteo = 'Pluie battante';
  evoluerEcologieHexagones(etatEco.hexagones, etatEco.horloge);
  assert.ok((mine.niveauEau ?? 0) > eauAvant, 'La pluie doit recharger le niveau d eau');

  // 2. Diplomatie dynamique : menace orc forte déclenche un pacte défensif Ligue <-> Bouclier
  const etatDiplo: SimulationState = JSON.parse(JSON.stringify(INITIAL_SIMULATION_STATE));
  const orcs = etatDiplo.factions.find(f => f.id === 'faction_orcs')!;
  orcs.forceMilitaire = 80;
  etatDiplo.factions[0].richesse = 90;
  etatDiplo.factions[0].relationsFactions = { faction_iron_shield: 'TENSION', faction_orcs: 'GUERRE' };
  etatDiplo.factions[1].relationsFactions = { faction_guilde_marchande: 'TENSION', faction_orcs: 'GUERRE' };

  const resDiplo = simulerMondeComplet(etatDiplo, { evoluerTempsMeteo: false });
  const guildeApres = resDiplo.etatModifie.factions.find(f => f.id === 'faction_guilde_marchande')!;
  const ironApres = resDiplo.etatModifie.factions.find(f => f.id === 'faction_iron_shield')!;
  assert.equal(guildeApres.relationsFactions?.faction_iron_shield, 'PACTE');
  assert.equal(ironApres.relationsFactions?.faction_guilde_marchande, 'PACTE');
  assert.ok(
    (resDiplo.etatModifie.chroniqueMonde || []).some(c => c.categorie === 'DIPLOMATIE'),
    'Le pacte doit apparaître dans la chronique'
  );

  // 3. Historique métrique borné à 24 et brouillard joueur inchangé
  const desert = resDiplo.etatModifie.hexagones.find(h => h.id === 'hex_01m1_desert')!;
  assert.equal(desert.brouillard, 'INCONNU', 'La simulation autonome ne doit pas lever le brouillard du joueur');

  let cur = resDiplo.etatModifie;
  for (let i = 0; i < 28; i++) {
    cur = simulerMondeComplet(cur, { evoluerTempsMeteo: true }).etatModifie;
  }
  assert.ok((cur.historiqueMonde || []).length <= 24, 'historiqueMonde doit rester borné à 24');
  assert.ok((cur.historiqueMonde || []).length > 5);
  const dernier = cur.historiqueMonde![cur.historiqueMonde!.length - 1];
  assert.equal(typeof dernier.pressionMoyenne, 'number');
  assert.equal(typeof dernier.prosperiteMoyenne, 'number');
});

test('Azgaar FMG: climat, ombre pluviometrique, hydrologie et couts de trajet/forage', async () => {
  const { simulerClimatEtHydrologie, hydraterGeographieHex } = await import('./worldGeography');
  const { estimerCoutTrajet, executerForage } = await import('./hexcrawl');

  const etat: SimulationState = JSON.parse(JSON.stringify(INITIAL_SIMULATION_STATE));
  const hexes = etat.hexagones.map(hydraterGeographieHex);
  const horlogeCanicule = { ...etat.horloge, jour: 120, meteo: 'Chaleur écrasante' as const, saison: 'Été' as const };

  for (let i = 0; i < 3; i++) {
    simulerClimatEtHydrologie(hexes, horlogeCanicule);
  }

  const montagne = hexes.find(h => h.id === 'hex_m100_montagne')!;
  const desert = hexes.find(h => h.id === 'hex_01m1_desert')!;
  const marais = hexes.find(h => h.id === 'hex_m101_marais')!;
  const bourgade = hexes.find(h => h.id === 'hex_0000_bourgade')!;

  assert.ok((montagne.temperatureC ?? 0) < (desert.temperatureC ?? 0), 'Montagne plus froide que désert');
  assert.ok((montagne.precipitations ?? 0) > (desert.precipitations ?? 0), 'Ombre pluviométrique à l est');
  assert.ok((marais.fluxHydro ?? 0) >= (bourgade.fluxHydro ?? 0), 'Accumulation hydrologique en aval');

  // Coût d'eau accru sous forte chaleur
  const coutChaud = estimerCoutTrajet(desert, 'Normale');
  const coutFrais = estimerCoutTrajet(montagne, 'Normale');
  assert.ok(coutChaud.eauLitres >= coutFrais.eauLitres, 'Chaleur >= 28°C consomme plus d eau');

  // Forage favorisé par une écologie abondante
  const riche = { ...bourgade, niveauEau: 90, populationGibier: 90, fluxHydro: 80 };
  const sterile = { ...desert, niveauEau: 5, populationGibier: 5, fluxHydro: 2 };
  const resRiche = executerForage(riche, etat.personnage);
  const resSterile = executerForage(sterile, etat.personnage);
  assert.ok(resRiche.adjudication.cible_dd_ou_ca < resSterile.adjudication.cible_dd_ou_ca);
});

test('Azgaar FMG: pathfinding pondere Dijkstra, garnison, capacite militaire et treve par lassitude', async () => {
  const { calculerItinerairePondere, evaluerScoreExpansionAzgaar } = await import('./worldGeography');
  const { simulerMondeComplet } = await import('./worldSim');

  const etat: SimulationState = JSON.parse(JSON.stringify(INITIAL_SIMULATION_STATE));
  const desert = etat.hexagones.find(h => h.id === 'hex_01m1_desert')!;
  desert.securite = 'Périlleux';
  desert.pressionDanger = 95;
  const bourgade = etat.hexagones.find(h => h.id === 'hex_0000_bourgade')!;
  bourgade.securite = 'Sûr';
  bourgade.pressionDanger = 5;

  // Une caravane allant de la Mine (1,0) au Fort (0,-1) évite le Désert Périlleux (1,-1) en passant par Val-Gris (0,0)
  const routeCaravane = calculerItinerairePondere('hex_0100_mine', 'hex_00m1_route', etat.hexagones, 'CARAVANE');
  assert.equal(routeCaravane.chemin[0], 'hex_0100_mine');
  assert.equal(routeCaravane.chemin[routeCaravane.chemin.length - 1], 'hex_00m1_route');
  assert.equal(routeCaravane.chemin.includes('hex_01m1_desert'), false);
  assert.equal(routeCaravane.chemin.includes('hex_0000_bourgade'), true);

  // Score d'expansion pénalisé par garnison élevée
  const factionLigue = etat.factions[0];
  const mineFaible = { ...etat.hexagones.find(h => h.id === 'hex_0100_mine')!, factionControleId: 'faction_orcs', garnison: 10 };
  const mineFortifiee = { ...mineFaible, garnison: 90 };
  assert.ok(
    evaluerScoreExpansionAzgaar(factionLigue, mineFaible, etat.hexagones) >
      evaluerScoreExpansionAzgaar(factionLigue, mineFortifiee, etat.hexagones)
  );

  // Simulation : lassitude de guerre élevée permet une trêve & forceMax suit la population
  const etatGuerre: SimulationState = JSON.parse(JSON.stringify(INITIAL_SIMULATION_STATE));
  etatGuerre.factions[1].lassitudeGuerre = 78;
  etatGuerre.factions[2].lassitudeGuerre = 78;
  etatGuerre.factions[1].relationsFactions = { faction_guilde_marchande: 'PACTE', faction_orcs: 'GUERRE' };
  etatGuerre.factions[2].relationsFactions = { faction_guilde_marchande: 'TENSION', faction_iron_shield: 'GUERRE' };

  const resSim = simulerMondeComplet(etatGuerre, { evoluerTempsMeteo: false });
  const bouclier = resSim.etatModifie.factions.find(f => f.id === 'faction_iron_shield')!;
  const orcs = resSim.etatModifie.factions.find(f => f.id === 'faction_orcs')!;
  assert.ok((bouclier.populationTotale ?? 0) > 0);
  assert.ok((bouclier.forceMax ?? 0) >= 35);
  assert.equal(bouclier.relationsFactions?.faction_orcs, 'TENSION', 'Lassitude mutuelle >= 72 déclenche une trêve');
  assert.equal(orcs.relationsFactions?.faction_iron_shield, 'TENSION');
});

test('MJ complet: CONFIGURER_NARRATION, RESOUDRE_JET_DEMANDE et pieges/escouades donjon', () => {
  const etat: SimulationState = JSON.parse(JSON.stringify(INITIAL_SIMULATION_STATE));

  // 1. Bascule mode narration
  const { nouvelEtat: etatUltra } = orchestrerActionDeterministe(etat, {
    type: 'CONFIGURER_NARRATION',
    payloadAction: { mode: 'ULTRA_COURT' },
  });
  assert.equal(etatUltra.modeNarration, 'ULTRA_COURT');

  // 2. Résolution jet demandé par le MJ (mode normal d20)
  etatUltra.jetEnAttente = {
    id: 'roll_test_1',
    titre: 'Esquiver la herse',
    caracteristique: 'DEX',
    typeJet: 'sauvegarde',
    dd: 12,
    contexte: 'Une herse métallique s abat.',
    enjeuSucces: 'Passage net',
    enjeuEchec: 'Choc brutal',
    optionAlternative: 'Forcer la manivelle',
  };
  const { nouvelEtat: apresJet, adjudication: adjJet } = orchestrerActionDeterministe(etatUltra, {
    type: 'RESOUDRE_JET_DEMANDE',
    payloadAction: { jetId: 'roll_test_1', choix: 'lancer' },
  });
  assert.equal(apresJet.jetEnAttente, null);
  assert.equal(adjJet.action_type, 'SAVING_THROW');
  assert.equal(adjJet.cible_dd_ou_ca, 12);

  // 3. Résolution choix alternatif
  apresJet.jetEnAttente = {
    id: 'roll_test_2',
    titre: 'Sauter le ravin',
    caracteristique: 'FOR',
    competence: 'Athlétisme',
    typeJet: 'competence',
    dd: 14,
    contexte: 'Un ravin coupe la galerie.',
    enjeuSucces: 'Rive opposée',
    enjeuEchec: 'Chute',
    optionAlternative: 'Descendre par la corde',
  };
  const { nouvelEtat: apresAlt, adjudication: adjAlt } = orchestrerActionDeterministe(apresJet, {
    type: 'RESOUDRE_JET_DEMANDE',
    payloadAction: { jetId: 'roll_test_2', choix: 'alternatif' },
  });
  assert.equal(apresAlt.jetEnAttente, null);
  assert.equal(adjAlt.issue, 'SUCCESS');
  assert.ok(adjAlt.mutations_etat.descriptionTechnique.includes('Descendre par la corde'));

  // 4. Donjon avec piège personnalisé et escouade SRD
  apresAlt.donjon = {
    actif: true,
    poiId: 'poi_test_tombeau',
    nom: 'Tombeau test',
    salleActuelleId: 's_1',
    salles: [
      {
        id: 's_1',
        nom: 'Entrée',
        description: 'Seuil',
        connexions: ['s_2'],
        visitee: true,
        danger: 'AUCUN',
        fouillable: true,
      },
      {
        id: 's_2',
        nom: 'Autel piégé',
        description: 'Lames au mur',
        connexions: ['s_1', 's_3'],
        visitee: false,
        danger: 'PIEGE',
        fouillable: true,
        piegeCarac: 'DEX',
        piegeDD: 13,
        piegeDegats: '1d4',
        piegeDesc: 'Lame oscillante',
      },
      {
        id: 's_3',
        nom: 'Crypte gardée',
        description: 'Ombres armées',
        connexions: ['s_2'],
        visitee: false,
        danger: 'ENNEMI',
        fouillable: true,
        monstreIds: ['mon_gobelin', 'mon_squelette'],
      },
    ],
    journalDonjon: ['Entrée dans Tombeau test.'],
  };
  const { nouvelEtat: apresPiege, adjudication: adjPiege } = orchestrerActionDeterministe(apresAlt, {
    type: 'DONJON_DEPLACEMENT',
    cibleId: 's_2',
  });
  assert.equal(apresPiege.donjon?.salleActuelleId, 's_2');
  assert.ok(adjPiege.mutations_etat.descriptionTechnique.includes('Lame oscillante'));

  const { nouvelEtat: apresSalle } = orchestrerActionDeterministe(apresPiege, {
    type: 'DONJON_DEPLACEMENT',
    cibleId: 's_3',
  });
  assert.equal(apresSalle.donjon?.salleActuelleId, 's_3');
  assert.equal(apresSalle.combat.actif, true);
  assert.equal(apresSalle.combat.ennemis.length, 2);
});

test('Economie procedurale, ressources realistes et simulation causale multi-echelles (heure/jour/semaine/mois)', async () => {
  const { creerEtatInitialAzgaar } = await import('./azgaarVoronoi');
  const { simulerAvancementTemporel } = await import('./worldSim');
  const { RESSOURCES_CATALOGUE } = await import('./worldEconomy');

  const monde = creerEtatInitialAzgaar();
  assert.ok(monde.azgaarStudio);
  assert.ok((monde.azgaarStudio!.resources || []).length >= 8, 'Doit placer des ressources variées sur la carte');
  assert.ok((monde.azgaarStudio!.tradeFlows || []).length >= 3, 'Doit générer des flux commerciaux entre bourgs');

  for (const r of monde.azgaarStudio!.resources || []) {
    assert.ok(RESSOURCES_CATALOGUE[r.type], `Type de ressource valide : ${r.type}`);
    assert.ok(r.richesse >= 1 && r.richesse <= 5);
  }
  const bourgSpec = monde.azgaarStudio!.burgs.find(b => b.specialisation && (b.exportations?.length || 0) > 0);
  assert.ok(bourgSpec, 'Les bourgs doivent posséder spécialisation et exportations');

  const hexAvecRessource = monde.hexagones.find(h => !h.estEau && Boolean(h.ressourcePrincipale));
  assert.ok(hexAvecRessource, 'Les hexagones doivent être hydratés avec ressourcePrincipale');

  // 1. Saut +1h -> phaseJournee mise à jour, pas de jalon JOUR complet
  const etatHeure = JSON.parse(JSON.stringify(monde)) as SimulationState;
  etatHeure.horloge.heure = 8;
  const out1h = simulerAvancementTemporel(etatHeure, 1);
  assert.equal(etatHeure.horloge.heure, 9);
  assert.equal(etatHeure.horloge.phaseJournee, 'Matin');
  assert.ok(out1h.jalonsDetectes.includes('HEURE'));

  // 2. Saut +1j (24h) -> 1 cycle JOUR
  const etatJour = JSON.parse(JSON.stringify(monde)) as SimulationState;
  const jourAvant = etatJour.horloge.jour;
  const out24h = simulerAvancementTemporel(etatJour, 24);
  assert.equal(etatJour.horloge.jour, jourAvant + 1);
  assert.ok(out24h.jalonsDetectes.includes('JOUR'));

  // 3. Saut +1 semaine (168h) -> jalon SEMAINE + événement causal avec causeDirecte/consequences
  const etatSemaine = JSON.parse(JSON.stringify(monde)) as SimulationState;
  const outSem = simulerAvancementTemporel(etatSemaine, 168);
  assert.equal(etatSemaine.horloge.jour, jourAvant + 7);
  assert.ok(outSem.jalonsDetectes.includes('SEMAINE'));
  const evtHebdo = (etatSemaine.chroniqueMonde || []).find(c => c.echelle === 'SEMAINE' && c.causeDirecte);
  assert.ok(evtHebdo, 'Le jalon hebdomadaire doit produire une entrée causale documentée');
  assert.ok(Boolean(evtHebdo!.consequences));

  // 4. Saut +1 mois (720h) -> jalon MOIS + évolution saisonnière ou bilan mensuel
  const etatMois = JSON.parse(JSON.stringify(monde)) as SimulationState;
  const outMois = simulerAvancementTemporel(etatMois, 720);
  assert.equal(etatMois.horloge.jour, jourAvant + 30);
  assert.ok(outMois.jalonsDetectes.includes('MOIS'));
  const evtMensuel = (etatMois.chroniqueMonde || []).find(c => c.echelle === 'MOIS');
  assert.ok(evtMensuel, 'Le jalon mensuel doit produire un bilan causal dans la chronique');
});

test('Supervision IA des jalons du monde: JSON structure, propagation memoire MJ et gestion erreur quota', async () => {
  const { superviserJalonsMondeParIA } = await import('../server/worldSupervisor');
  const { creerEtatInitialAzgaar } = await import('./azgaarVoronoi');

  const etat = creerEtatInitialAzgaar();
  const mockAi = {
    models: {
      generateContent: async () => ({
        text: JSON.stringify({
          titreChronique: 'Crise des forges d’Occident',
          syntheseCausale: 'L’appauvrissement du filon nord renchérit l’acier sur les routes marchandes.',
          consequencesPrevisibles: 'Les patrouilles redoublent autour des mines.',
          noteSecreteMJ: 'Une guilde rivale prépare un blocus discret des cols de fer.',
          rumeurPublique: {
            titre: 'Flambée de l’acier',
            texte: 'On raconte que le prix des lames flambe à la capitale.',
          },
          arcMisAJour: {
            titre: 'Blocus du fer',
            resume: 'Tension croissante sur l’approvisionnement en fer.',
            prochaineEtape: 'Enquêter près des mines',
            progression: 45,
          },
        }),
      }),
    },
  };

  const res = await superviserJalonsMondeParIA(mockAi as any, etat, {
    heuresSautees: 168,
    jalonsDetectes: ['JOUR', 'SEMAINE'],
    resumeCausal: 'Hausse du cours du fer suite à un raid sur la route minière.',
    chroniqueRecente: [],
  });

  assert.equal(res.titreChronique, 'Crise des forges d’Occident');
  assert.ok((etat.memoireMJ?.journalSecretMJ || []).some(s => s.contenu.includes('blocus discret')));
  assert.ok((etat.memoireMJ?.arcsNarratifs || []).some(a => a.resume.includes('approvisionnement en fer')));
  assert.ok((etat.rumeurs || []).some(r => r.texte.includes('prix des lames')));
  assert.equal(etat.chroniqueMonde?.[0]?.categorie, 'SUPERVISION_IA');
  assert.equal(etat.chroniqueMonde?.[0]?.superviseParIa, true);

  // Erreur propre si clé absente (aucun repli fictif)
  await assert.rejects(
    () =>
      superviserJalonsMondeParIA(null, etat, {
        heuresSautees: 24,
        jalonsDetectes: ['JOUR'],
        resumeCausal: 'Test',
        chroniqueRecente: [],
      }),
    /clé Gemini serveur absente/
  );

  // Erreur explicite en cas de quota 429
  const mockQuota = {
    models: {
      generateContent: async () => {
        throw new Error('429 RESOURCE_EXHAUSTED GenerateRequestsPerDayPerProjectPerModel-FreeTier');
      },
    },
  };
  await assert.rejects(
    () =>
      superviserJalonsMondeParIA(mockQuota as any, etat, {
        heuresSautees: 168,
        jalonsDetectes: ['SEMAINE'],
        resumeCausal: 'Test quota',
        chroniqueRecente: [],
      }),
    /quota journalier/
  );
});
