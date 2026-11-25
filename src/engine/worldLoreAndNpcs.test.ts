import test from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_SIMULATION_STATE } from './initialData';
import {
  creerEtatInitialAzgaar,
  genererMondeAzgaarStudio,
} from './azgaarVoronoi';
import {
  genererLoreProcedural,
  genererPnjsProcedural,
  reconcilierProximitePnjs,
} from './worldLoreAndNpcs';
import {
  appliquerBrouillonForgeASimulation,
  creerBrouillonForgeInitial,
  regenererEtape2GeopolitiqueBrouillon,
} from './worldForgeDraft';
import { construireVueEpistemiqueHeros } from './epistemic';
import { orchestrerActionDeterministe } from './adjudication';
import { SimulationState } from '../types';

test('Génération procédurale produit lore complet et PNJ en 3 paliers dont des liens héros', () => {
  const etatBase: SimulationState = JSON.parse(JSON.stringify(INITIAL_SIMULATION_STATE));
  etatBase.personnage.historique = 'Ancien éclaireur des Marches';
  etatBase.personnage.documents = [
    {
      id: 'doc_test_1',
      titre: 'Lettre cachetée de maître Vane',
      categorie: 'Notes',
      contenu: 'Retrouve ma sœur à la frontière avant l’hiver.',
      majDate: 'Jour 1',
      actifPourMJ: true,
    },
  ];

  const monde = genererMondeAzgaarStudio(
    { seed: 74219, template: 'continent', conserverHeros: true, rayonAnneaux: 3 },
    etatBase
  );
  assert.ok(monde.loreMonde, 'loreMonde doit être généré');
  assert.ok(monde.loreMonde!.etatsLore.length > 0, 'etatsLore non vide');
  assert.ok(monde.loreMonde!.religionsLore.length > 0, 'religionsLore non vide');
  assert.ok(monde.loreMonde!.regionsLore.length > 0, 'regionsLore non vide');
  assert.ok(monde.loreMonde!.secretsMondeMJ.length > 0, 'secretsMondeMJ non vide');

  const pnjs = monde.pnjsMonde || [];
  assert.ok(pnjs.some(p => p.tier === 'MAJEUR_MONDE'), 'Au moins un PNJ MAJEUR_MONDE');
  assert.ok(pnjs.some(p => p.tier === 'LIEN_HEROS'), 'Au moins un PNJ LIEN_HEROS');
  assert.ok(
    pnjs.some(p => p.tier === 'PROCHE_PREGEN' || p.tier === 'LAMBDA_LOINTAIN'),
    'Présence de PNJ locaux ou lambda'
  );

  const pnjsLies = pnjs.filter(p => p.tier === 'LIEN_HEROS');
  assert.ok(
    pnjsLies.every(p => p.detailLevel === 'COMPLET' && Boolean(p.lienHerosNature)),
    'Les PNJ liés au héros sont détaillés dès le départ avec leur lien'
  );
  assert.ok(
    pnjsLies.some(p =>
      `${p.lienHerosNature} ${p.biographie || ''}`.toLowerCase().includes('éclaireur') ||
      `${p.lienHerosNature} ${p.biographie || ''}`.toLowerCase().includes('lettre')
    ),
    'Le lien héros reprend des éléments du background/documents du personnage'
  );
});

test('Promotion automatique d un PNJ lambda lors du rapprochement géographique et d une quête', () => {
  const etat = creerEtatInitialAzgaar();
  const lambdaLointain = etat.pnjsMonde?.find(
    p => p.tier === 'LAMBDA_LOINTAIN' && p.detailLevel === 'LEGER' && p.distanceHex > 2
  );
  assert.ok(lambdaLointain, 'Un PNJ LAMBDA_LOINTAIN léger à distance > 2 doit exister');

  // 1. Placer ce PNJ sur un hexagone du secteur et rapprocher le joueur à <= 2 hexes
  const etatCopy: SimulationState = JSON.parse(JSON.stringify(etat));
  const hexCible = etatCopy.hexagones.find(h => !h.estEau && h.id !== etatCopy.hexActuel.id) || etatCopy.hexActuel;
  const pnjCible = etatCopy.pnjsMonde!.find(p => p.id === lambdaLointain!.id)!;
  pnjCible.hexId = hexCible.id;
  etatCopy.hexActuel = { ...hexCible, brouillard: 'EXPLORE' };
  const { promotedIds } = reconcilierProximitePnjs(etatCopy, 2);
  assert.ok(promotedIds.includes(lambdaLointain!.id), 'Le PNJ lambda proche doit être promu');

  const promu = etatCopy.pnjsMonde!.find(p => p.id === lambdaLointain!.id)!;
  assert.equal(promu.detailLevel, 'LOCAL');
  assert.equal(promu.enrichmentPending, true, 'Enrichment IA marqué en attente après promotion');
  assert.ok(
    etatCopy.grapheNoeuds.some(n => n.id === promu.id && n.type === 'Actor'),
    'Le PNJ promu est synchronisé dans grapheNoeuds'
  );

  // 2. Promotion scénaristique via AJOUTER_QUETE qui cite le nom d un PNJ lambda lointain
  const etatQuete: SimulationState = JSON.parse(JSON.stringify(etat));
  const cibleQuete = etatQuete.pnjsMonde!.find(
    p => p.tier === 'LAMBDA_LOINTAIN' && p.detailLevel === 'LEGER' && p.distanceHex > 2
  )!;
  const { nouvelEtat } = orchestrerActionDeterministe(etatQuete, {
    type: 'AJOUTER_QUETE',
    payloadAction: {
      titre: `Retrouver ${cibleQuete.nom}`,
      interlocuteur: cibleQuete.nom,
      details: `On dit que ${cibleQuete.nom} détient la clef du sanctuaire.`,
    },
  });

  const cibleApresQuete = nouvelEtat.pnjsMonde!.find(p => p.id === cibleQuete.id)!;
  assert.equal(cibleApresQuete.detailLevel, 'COMPLET', 'Un PNJ cité dans une quête passe directement en COMPLET');
  assert.equal(cibleApresQuete.tier, 'PROCHE_PREGEN');
});

test('Separation epistemique Strate 1 vs Strate 2 sur le lore et les PNJ', () => {
  const etat = creerEtatInitialAzgaar();
  assert.ok(etat.loreMonde && etat.pnjsMonde);

  // Injecter des marqueurs secrets très spécifiques en Strate 2
  etat.loreMonde.secretsMondeMJ = ['SECRET_GLOBAL_OBSIDIENNE'];
  etat.loreMonde.etatsLore[0].secretEtat = 'SECRET_ETAT_TRAHISON';
  etat.loreMonde.religionsLore[0].heresieSecrete = 'HERESIE_CULTE_NUIT';
  const regionDecouverte = etat.loreMonde.regionsLore[0];
  regionDecouverte.secretLocal = 'SECRET_REGIONAL_CRYPTE';
  const hexDecouvert = etat.hexagones.find(h => h.id === regionDecouverte.hexId);
  if (hexDecouvert) hexDecouvert.brouillard = 'EXPLORE';

  const npcLocal = etat.pnjsMonde.find(p => p.hexId === etat.hexActuel.id) || etat.pnjsMonde[0];
  npcLocal.hexId = etat.hexActuel.id;
  npcLocal.secret = 'SECRET_PNJ_POIGNARD';
  npcLocal.motivationImmediate = 'MOTIVATION_PNJ_FUITE';
  reconcilierProximitePnjs(etat, 2);

  const vue = construireVueEpistemiqueHeros(etat);
  const strate1Json = JSON.stringify({
    perceptionImmediate: vue.perceptionImmediate,
    savoirVerifie: vue.savoirVerifie,
    souvenirsEtOuieDire: vue.souvenirsEtOuieDire,
  });

  assert.ok(!strate1Json.includes('SECRET_GLOBAL_OBSIDIENNE'), 'Pas de secret global en Strate 1');
  assert.ok(!strate1Json.includes('SECRET_ETAT_TRAHISON'), 'Pas de secret Etat en Strate 1');
  assert.ok(!strate1Json.includes('HERESIE_CULTE_NUIT'), 'Pas d heresie en Strate 1');
  assert.ok(!strate1Json.includes('SECRET_REGIONAL_CRYPTE'), 'Pas de secret local en Strate 1');
  assert.ok(!strate1Json.includes('SECRET_PNJ_POIGNARD'), 'Pas de secret PNJ en Strate 1');
  assert.ok(!strate1Json.includes('MOTIVATION_PNJ_FUITE'), 'Pas de motivation cachee PNJ en Strate 1');

  const strate2Json = JSON.stringify(vue.realiteCacheeMonde);
  assert.ok(strate2Json.includes('SECRET_GLOBAL_OBSIDIENNE'), 'Secrets globaux visibles en Strate 2 MJ');
  assert.ok(strate2Json.includes('SECRET_ETAT_TRAHISON'), 'Secrets Etat visibles en Strate 2 MJ');
  assert.ok(strate2Json.includes('SECRET_PNJ_POIGNARD'), 'Secrets PNJ visibles en Strate 2 MJ');
});

test('Cycle Forge 4 etapes : creation brouillon, retouche et application campagne', () => {
  const draft = creerBrouillonForgeInitial(INITIAL_SIMULATION_STATE, {
    seed: 424242,
    worldName: 'Archipel d Azur',
    template: 'archipel',
    statesCount: 3,
  });

  assert.equal(draft.studio.worldName, 'Archipel d Azur');
  assert.ok(draft.lore.etatsLore.length >= 1);
  assert.ok(draft.pnjs.length >= 4);

  // Retouche manuelle de la chronique & d un PNJ
  draft.lore.genese = 'Genèse des Cendres Bleues';
  draft.pnjs[0].nom = 'Dame Isolde Test';

  const regenStep2 = regenererEtape2GeopolitiqueBrouillon(draft, INITIAL_SIMULATION_STATE.personnage);
  assert.ok(regenStep2.studio.states.length >= 1);

  const simAppliquee = appliquerBrouillonForgeASimulation(draft, INITIAL_SIMULATION_STATE);
  assert.equal(simAppliquee.loreMonde?.genese, 'Genèse des Cendres Bleues');
  assert.ok(simAppliquee.pnjsMonde?.some(p => p.nom === 'Dame Isolde Test'));
  assert.ok(simAppliquee.grapheNoeuds.some(n => n.label === 'Dame Isolde Test'));
  assert.ok((simAppliquee.memoireMJ?.arcsNarratifs?.length || 0) >= 1);
});
