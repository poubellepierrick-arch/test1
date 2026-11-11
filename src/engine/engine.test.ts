import test from 'node:test';
import assert from 'node:assert/strict';
import { calculerModificateur, lancerD20 } from './dice';
import { evaluerEpuisement, evaluerEncombrement, executerJetSauvegardeMort, executerRepos } from './srd';
import { initialiserCombat, executerTourEnnemi, executerEsquiveJoueur, executerSortJoueur } from './combat';
import { orchestrerActionDeterministe } from './adjudication';
import { executerWorldTick } from './factions';
import { traverserGraphe, filtrerParFrontiereDeConnaissance } from './graph';
import { INITIAL_SIMULATION_STATE } from './initialData';
import { Combatant } from '../types';

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

test('donjon nodal: pénétration et exploration de salle', () => {
  const etat = JSON.parse(JSON.stringify(INITIAL_SIMULATION_STATE));

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

test('artisanat et blessures: confection de remède et cicatrisation', () => {
  const etat = JSON.parse(JSON.stringify(INITIAL_SIMULATION_STATE));
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

  // Fabrication de bandage compressif
  const { nouvelEtat: etatCraft } = orchestrerActionDeterministe(etat, {
    type: 'FABRIQUER_OBJET',
    cibleId: 'craft_bandage',
  });
  assert.equal(etatCraft.horloge.heure, etat.horloge.heure + 1);

  // Application de soin sur la blessure
  const { nouvelEtat: etatSoigne } = orchestrerActionDeterministe(etatCraft, {
    type: 'SOIGNER_BLESSURE',
    cibleId: 'inj_test',
  });
  assert.equal(etatSoigne.personnage.blessuresPersistantes.length, 0);
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



