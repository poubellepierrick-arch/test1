import test from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_SIMULATION_STATE } from '../engine/initialData';
import { SimulationState } from '../types';
import { executerOutilMJ, GmToolExecutionContext, assurerMemoireMJ } from './gmTools';
import { creerEtatInitialAzgaar } from '../engine/azgaarVoronoi';

function creerContexteTest(): GmToolExecutionContext {
  const etat: SimulationState = JSON.parse(JSON.stringify(INITIAL_SIMULATION_STATE));
  assurerMemoireMJ(etat);
  return {
    etat,
    actionOrigine: { type: 'ACTION_LIBRE', texteLibre: 'Test MJ' },
    moteurDejaExecute: false,
    appelsOutils: [],
  };
}

test('gmTools: lancer_test_competence applique la maîtrise et renseigne l adjudication', () => {
  const ctx = creerContexteTest();
  // Eldrin maîtrise Athlétisme (FOR 15 => +2, maîtrise +2 => +4)
  const res = executerOutilMJ(ctx, 'lancer_test_competence', {
    caracteristique: 'FOR',
    competence: 'Athlétisme',
    dd: 12,
    raison: 'Escalader la palissade',
  });

  assert.equal(res.succes, true);
  assert.equal(res.modificateur, 4);
  assert.ok(ctx.adjudication);
  assert.equal(ctx.adjudication?.cible_dd_ou_ca, 12);
});

test('gmTools: appliquer_consequence_scene respecte strictement les bornes monétaires et PV', () => {
  const ctx = creerContexteTest();
  ctx.etat.personnage.monnaies = { po: 0, pa: 2, pc: 0 };

  const refus = executerOutilMJ(ctx, 'appliquer_consequence_scene', {
    paDelta: -5,
    resumeTechnique: 'Tentative de pot-de-vin trop coûteuse',
  });
  assert.equal(refus.succes, false);
  assert.equal(ctx.etat.personnage.monnaies.pa, 2);

  const ok = executerOutilMJ(ctx, 'appliquer_consequence_scene', {
    paDelta: -2,
    pvDelta: -4,
    xpGagne: 25,
    ajouterObjetNom: 'Clé rouillée',
    resumeTechnique: 'Passage forcé et blessure légère',
  });
  assert.equal(ok.succes, true);
  assert.equal(ctx.etat.personnage.monnaies.pa, 0);
  assert.equal(ctx.etat.personnage.pvActuels, 8);
  assert.equal(ctx.etat.personnage.experience, 25);
  assert.equal(ctx.etat.personnage.inventaire.some(i => i.nom === 'Clé rouillée'), true);
});

test('gmTools: gerer_pnj_et_monde respecte la frontière géographique et enregistre répliques et quêtes', () => {
  const ctx = creerContexteTest();

  // Capitaine Morn est à la Passe des Ombres, pas à Val-Gris -> refusé
  const horsChamp = executerOutilMJ(ctx, 'gerer_pnj_et_monde', {
    pnjId: 'npc_capitaine_morn',
    nouvelleDisposition: 'AMICAL',
  });
  assert.equal(horsChamp.succes, false);

  // Torvin est à Val-Gris -> sans consentement explicite, CREER est converti en PROPOSEE
  const enVue = executerOutilMJ(ctx, 'gerer_pnj_et_monde', {
    pnjId: 'npc_forgeron_torvin',
    nouvelleDisposition: 'AMICAL',
    sujetDialogue: 'Livrer du charbon',
    repliquePnj: 'Rapporte-moi deux sacs de la mine, je te ferai un prix d ami.',
    issueDialogue: 'Proposition formulée',
    queteAction: {
      action: 'CREER',
      titre: 'Charbon pour la forge',
      interlocuteur: 'Torvin le Forgeron',
      echeanceJour: 3,
      details: 'Ramener du minerai ou charbon depuis Roche-Noire.',
    },
    consequenceAction: {
      action: 'AJOUTER',
      declencheur: 'Retour à Val-Gris après le Jour 3 sans charbon',
      effetPrevu: 'Torvin devient méfiant et refuse les réparations à prix réduit.',
    },
  });

  assert.equal(enVue.succes, true);
  const torvin = ctx.etat.grapheNoeuds.find(n => n.id === 'npc_forgeron_torvin');
  assert.equal(torvin?.proprietes?.disposition, 'AMICAL');
  assert.equal(
    torvin?.proprietes?.historiqueDialogue?.[0]?.repliquePnj,
    'Rapporte-moi deux sacs de la mine, je te ferai un prix d ami.'
  );
  assert.equal(ctx.etat.memoireMJ?.promessesEtQuetes.length, 1);
  assert.equal(ctx.etat.memoireMJ?.promessesEtQuetes[0].statut, 'PROPOSEE');
  assert.equal(ctx.etat.memoireMJ?.consequencesDifferees.length, 1);

  // Accord explicite du joueur -> passage en EN_COURS
  ctx.actionOrigine = {
    type: 'DIALOGUER_PNJ',
    pnjId: 'npc_forgeron_torvin',
    sujetDialogue: "J'accepte de te livrer du charbon.",
  };
  const accepte = executerOutilMJ(ctx, 'gerer_pnj_et_monde', {
    queteAction: {
      action: 'CREER',
      titre: 'Charbon pour la forge',
      interlocuteur: 'Torvin le Forgeron',
    },
  });
  assert.equal(accepte.succes, true);
  assert.equal(ctx.etat.memoireMJ?.promessesEtQuetes[0].statut, 'EN_COURS');

  // Accomplissement de la quête
  const accompli = executerOutilMJ(ctx, 'gerer_pnj_et_monde', {
    queteAction: {
      action: 'ACCOMPLIR',
      titre: 'Charbon pour la forge',
    },
    consequenceAction: {
      action: 'RESOUDRE',
      declencheur: 'Retour à Val-Gris',
    },
  });
  assert.equal(accompli.succes, true);
  assert.equal(ctx.etat.memoireMJ?.promessesEtQuetes[0].statut, 'ACCOMPLIE');
  assert.equal(ctx.etat.memoireMJ?.consequencesDifferees[0].actif, false);

  // Proposition explicite puis refus
  const prop2 = executerOutilMJ(ctx, 'gerer_pnj_et_monde', {
    queteAction: {
      action: 'PROPOSER',
      titre: 'Escorter un convoi suspect',
      interlocuteur: 'Elia',
      details: 'Offre nocturne.',
    },
  });
  assert.equal(prop2.succes, true);
  assert.equal(ctx.etat.memoireMJ?.promessesEtQuetes[0].statut, 'PROPOSEE');
  executerOutilMJ(ctx, 'gerer_pnj_et_monde', {
    queteAction: { action: 'DECLINER', titre: 'Escorter un convoi suspect' },
  });
  assert.equal(ctx.etat.memoireMJ?.promessesEtQuetes[0].statut, 'DECLINEE');
});

test('gmTools: consulter_compendium_srd et hydratation monstreId/objetId alimentent la télémétrie SRD', () => {
  const ctx = creerContexteTest();

  // Consultation Compendium
  const consult = executerOutilMJ(ctx, 'consulter_compendium_srd', {
    requete: 'empoisonné',
    categorie: 'regle',
  });
  assert.equal(consult.succes, true);
  assert.ok(consult.nombre >= 1);
  assert.ok((ctx.fichesSrdConsultees || []).some(f => f.includes('rule_etat_empoisonne')));

  // Hydratation objetId officiel
  const ajoutObj = executerOutilMJ(ctx, 'appliquer_consequence_scene', {
    objetId: 'item_potion_soins',
    resumeTechnique: 'Potion trouvée dans un coffret.',
  });
  assert.equal(ajoutObj.succes, true);
  const potion = ctx.etat.personnage.inventaire.find(i => i.compendiumId === 'item_potion_soins');
  assert.ok(potion);
  assert.equal(potion?.nom, 'Potion de soins');
  assert.equal(potion?.valeurPO, 50);
  assert.equal(potion?.poidsLbs, 0.5);

  // Hydratation monstreId officiel (Araignée géante : CA 14, PV 26, XP 200)
  const combatRes = executerOutilMJ(ctx, 'gerer_pnj_et_monde', {
    declencherCombat: {
      monstreId: 'mon_araignee_geante',
    },
  });
  assert.equal(combatRes.succes, true);
  assert.equal(ctx.etat.combat.actif, true);
  assert.equal(ctx.etat.combat.ennemis[0].monstreId, 'mon_araignee_geante');
  assert.equal(ctx.etat.combat.ennemis[0].ca, 14);
  assert.equal(ctx.etat.combat.ennemis[0].pv, 26);
  assert.equal(ctx.etat.combat.ennemis[0].xp, 200);
  assert.ok((ctx.fichesSrdConsultees || []).some(f => f.includes('mon_araignee_geante')));
});

test('gmTools: consulter_atlas_monde inspecte l atlas, les hex et trace un itineraire Dijkstra', () => {
  const ctx = creerContexteTest();

  const apercu = executerOutilMJ(ctx, 'consulter_atlas_monde', { mode: 'apercu' });
  assert.equal(apercu.succes, true);
  assert.equal(apercu.monde.nom, 'Marches de Val-Gris');
  assert.ok(apercu.sites.length >= 4);

  const route = executerOutilMJ(ctx, 'consulter_atlas_monde', {
    mode: 'itineraire',
    departHexId: 'hex_0000_bourg',
    arriveeHexId: 'hex_0100_mine',
    typeEntite: 'CARAVANE',
  });
  assert.equal(route.succes, true);
  assert.ok(route.nombreEtapes >= 1);
  assert.ok(route.etapes.length >= 2);
});

test('gmTools: modifier_carte_monde revele, etend la frontiere, depeche une unite et genere un monde', () => {
  const ctx = creerContexteTest();

  const revel = executerOutilMJ(ctx, 'modifier_carte_monde', {
    operation: 'reveler_secteur',
    hexId: 'hex_01m1_desert',
    rayon: 0,
  });
  assert.equal(revel.succes, true);

  const ext = executerOutilMJ(ctx, 'modifier_carte_monde', {
    operation: 'etendre_frontiere',
    hexId: 'hex_0100_mine',
    nomLieu: 'Cols de Givrelance',
    typePoi: 'camp',
  });
  assert.equal(ext.succes, true);
  assert.equal(ext.dejaExistant, false);
  assert.equal(ext.hexCree.nom, 'Cols de Givrelance');

  const depeche = executerOutilMJ(ctx, 'modifier_carte_monde', {
    operation: 'depecher_unite',
    hexId: 'hex_0000_bourg',
    destinationHexId: 'hex_0100_mine',
    entiteType: 'MESSAGER',
    entiteNom: 'Courrier de Torvin',
  });
  assert.equal(depeche.succes, true);
  assert.equal(ctx.etat.entitesMonde?.[0].nom, 'Courrier de Torvin');

  const gen = executerOutilMJ(ctx, 'modifier_carte_monde', {
    operation: 'generer_monde',
    seed: 77123,
    modeleRelief: 'archipel',
    climatBias: 'boreal',
    rayonAnneaux: 2,
    nomMonde: 'Archipel de Glace',
  });
  assert.equal(gen.succes, true);
  assert.equal(ctx.etat.hexagones.length, 19);
  assert.equal(ctx.etat.carteAzgaar?.nomMonde, 'Archipel de Glace');
});

test('gmTools: consulter_atlas_monde lit etats, provinces, bourgs, cultures, religions et marqueurs Azgaar', () => {
  const etat = creerEtatInitialAzgaar();
  assurerMemoireMJ(etat);
  const ctx: GmToolExecutionContext = {
    etat,
    actionOrigine: { type: 'ACTION_LIBRE', texteLibre: 'Lecture Azgaar' },
    moteurDejaExecute: false,
    appelsOutils: [],
  };

  const etatsRes = executerOutilMJ(ctx, 'consulter_atlas_monde', { mode: 'etats_provinces' });
  assert.equal(etatsRes.succes, true);
  assert.ok(etatsRes.etats.length >= 4);

  const bourgsRes = executerOutilMJ(ctx, 'consulter_atlas_monde', { mode: 'bourgs_ports' });
  assert.equal(bourgsRes.succes, true);
  assert.ok(bourgsRes.bourgs.length >= 10);

  const cultRes = executerOutilMJ(ctx, 'consulter_atlas_monde', { mode: 'cultures_religions' });
  assert.equal(cultRes.succes, true);
  assert.ok(cultRes.cultures.length >= 3);
  assert.ok(cultRes.religions.length >= 2);

  const markRes = executerOutilMJ(ctx, 'consulter_atlas_monde', { mode: 'marqueurs' });
  assert.equal(markRes.succes, true);
  assert.ok(markRes.marqueurs.length >= 1);
});

test('gmTools: modifier_carte_monde peint, pose/supprime marqueurs, edite bourgs et trace routes Azgaar', () => {
  const etat = creerEtatInitialAzgaar();
  assurerMemoireMJ(etat);
  const ctx: GmToolExecutionContext = {
    etat,
    actionOrigine: { type: 'ACTION_LIBRE', texteLibre: 'Edition Azgaar' },
    moteurDejaExecute: false,
    appelsOutils: [],
  };

  const bourg0 = ctx.etat.azgaarStudio!.burgs[0];
  const bourg1 = ctx.etat.azgaarStudio!.burgs[1];

  // Placer puis supprimer marqueur
  const pos = executerOutilMJ(ctx, 'modifier_carte_monde', {
    operation: 'placer_marqueur',
    markerIcon: 'danger',
    titre: 'Embuscade signalée',
    note: 'Troupe repérée sur la crête.',
    bourgNom: bourg0.name,
  });
  assert.equal(pos.succes, true);
  assert.ok(ctx.etat.azgaarStudio!.markers.some(m => m.title === 'Embuscade signalée'));

  const sup = executerOutilMJ(ctx, 'modifier_carte_monde', {
    operation: 'supprimer_marqueur',
    titre: 'Embuscade signalée',
  });
  assert.equal(sup.succes, true);
  assert.equal(sup.removed, 1);

  // Peindre cellules
  const peint = executerOutilMJ(ctx, 'modifier_carte_monde', {
    operation: 'peindre_cellules',
    x: bourg0.x,
    y: bourg0.y,
    rayonPx: 45,
    heightDelta: 6,
    stateId: 2,
  });
  assert.equal(peint.succes, true);
  assert.ok(peint.cellulesModifiees >= 1);
  assert.ok(Object.keys(ctx.etat.azgaarStudio!.overrides.height || {}).length >= 1);

  // Éditer bourg
  const edBourg = executerOutilMJ(ctx, 'modifier_carte_monde', {
    operation: 'editer_bourg',
    bourgNom: bourg0.name,
    populationDelta: 500,
    aCitadelle: true,
    aMurailles: true,
  });
  assert.equal(edBourg.succes, true);
  assert.equal(edBourg.bourg.citadel, true);

  // Tracer route
  const nbRoutesAvant = ctx.etat.azgaarStudio!.routes.length;
  const tr = executerOutilMJ(ctx, 'modifier_carte_monde', {
    operation: 'tracer_route',
    bourgNom: bourg0.name,
    bourgDestNom: bourg1.name,
    typeRoute: 'trail',
  });
  assert.equal(tr.succes, true);
  assert.equal(ctx.etat.azgaarStudio!.routes.length, nbRoutesAvant + 1);

  // Vérifier que peindre_cellules synchronise la faction/altitude sur hexagones et qu'etablir_lieu ajoute un marqueur
  const hexAutre = ctx.etat.hexagones.find(h => !h.estEau && h.id !== ctx.etat.hexActuel.id)!;
  const lieuRes = executerOutilMJ(ctx, 'modifier_carte_monde', {
    operation: 'etablir_lieu',
    hexId: hexAutre.id,
    typePoi: 'ruine',
    nomLieu: 'Sanctuaire Oublié',
  });
  assert.equal(lieuRes.succes, true);
  assert.ok(
    ctx.etat.azgaarStudio!.markers.some(
      m => m.id === `m_poi_${hexAutre.id}` && m.title === 'Sanctuaire Oublié'
    )
  );
});

test('gmTools: escouade multi-ennemis SRD, gerer_donjon, demander_jet_joueur, arcs et notes secretes', () => {
  const ctx = creerContexteTest();
  ctx.notesSecretesTour = [];

  // 1. Arc narratif + note secrète + secret PNJ + déplacement PNJ
  const resMeta = executerOutilMJ(ctx, 'gerer_pnj_et_monde', {
    pnjId: 'npc_forgeron_torvin',
    pnjSecret: 'Cache un lingot marqué du sceau ducal',
    pnjMotivation: 'Protéger sa famille des pillards',
    arcAction: {
      action: 'CREER',
      titre: 'Le Fer Volé',
      resume: 'Un chargement de fer marqué du sceau ducal a disparu.',
      acteursLies: ['Torvin le Forgeron', 'Ligue Marchande'],
      prochaineEtape: 'Retrouver la cargaison près de la mine',
      progression: 25,
    },
    noteSecreteMJ: {
      titre: 'Complot à la mine',
      contenu: 'Les bandits paient un éclaireur de Val-Gris.',
      categorie: 'INTRIGUE',
    },
  });
  assert.equal(resMeta.succes, true);
  const torvin = ctx.etat.grapheNoeuds.find(n => n.id === 'npc_forgeron_torvin');
  assert.equal(torvin?.proprietes?.secret, 'Cache un lingot marqué du sceau ducal');
  assert.equal(ctx.etat.memoireMJ?.arcsNarratifs?.length, 1);
  assert.equal(ctx.etat.memoireMJ?.arcsNarratifs?.[0].progression, 25);
  assert.equal(ctx.etat.memoireMJ?.journalSecretMJ?.length, 1);
  assert.equal(ctx.notesSecretesTour?.length, 1);

  const hexVoisin = ctx.etat.hexagones.find(h => h.id === 'hex_0100_mine')!;
  const resMovePnj = executerOutilMJ(ctx, 'gerer_pnj_et_monde', {
    pnjId: 'npc_forgeron_torvin',
    deplacerPnjHexId: hexVoisin.id,
  });
  assert.equal(resMovePnj.succes, true);
  assert.equal(torvin?.proprietes?.hexId, hexVoisin.id);

  // 2. Escouade multi-ennemis SRD
  const resSquad = executerOutilMJ(ctx, 'gerer_pnj_et_monde', {
    declencherCombat: {
      ennemis: [
        { monstreId: 'mon_gobelin', distancePieds: 20 },
        { monstreId: 'mon_gobelin', distancePieds: 30 },
        { monstreId: 'mon_loup', distancePieds: 15 },
      ],
    },
  });
  assert.equal(resSquad.succes, true);
  assert.equal(ctx.etat.combat.actif, true);
  assert.equal(ctx.etat.combat.ennemis.length, 3);
  assert.ok(ctx.etat.combat.ordreInitiative.length >= 4);

  // 3. Donjon multi-salles sur mesure via gerer_donjon
  const resDonjon = executerOutilMJ(ctx, 'gerer_donjon', {
    operation: 'CREER',
    nomDonjon: 'Caveaux de Basalte',
    salles: [
      { id: 'salle_entree', nom: 'Porche fendu', description: 'Marches humides.', connexions: ['salle_crypte'], danger: 'AUCUN' },
      {
        id: 'salle_crypte',
        nom: 'Crypte noyée',
        description: 'Colonnes brisées.',
        connexions: ['salle_entree', 'salle_secret'],
        danger: 'PIEGE',
        piegeCarac: 'DEX',
        piegeDD: 13,
        piegeDegats: '1d6',
        piegeDesc: 'Dalle basculante',
      },
      {
        id: 'salle_secret',
        nom: 'Sanctuaire scellé',
        description: 'Ossements anciens.',
        connexions: ['salle_crypte'],
        danger: 'ENNEMI',
        monstreIds: ['mon_squelette', 'mon_squelette'],
      },
    ],
  });
  assert.equal(resDonjon.succes, true);
  assert.equal(ctx.etat.donjon?.actif, true);
  assert.equal(ctx.etat.donjon?.salles.length, 3);

  const resModSalle = executerOutilMJ(ctx, 'gerer_donjon', {
    operation: 'MODIFIER_SALLE',
    salleId: 'salle_crypte',
    description: 'Un passage secret s ouvre derrière l autel.',
    tresorPO: 25,
  });
  assert.equal(resModSalle.succes, true);
  assert.equal(ctx.etat.donjon?.salles.find(s => s.id === 'salle_crypte')?.tresorPO, 25);

  // 4. Demande de jet interactif au joueur
  const resJet = executerOutilMJ(ctx, 'demander_jet_joueur', {
    titre: 'Éviter le plafond instable',
    caracteristique: 'DEX',
    typeJet: 'sauvegarde',
    dd: 14,
    contexte: 'Les poutres cèdent au-dessus de toi.',
    enjeuSucces: 'Tu roules hors de la zone d\'effondrement.',
    enjeuEchec: 'Les gravats te blessent (1d6 contondant).',
    optionAlternative: 'Bloquer l\'étai avec ton bouclier',
  });
  assert.equal(resJet.succes, true);
  assert.equal(ctx.etat.jetEnAttente?.dd, 14);
  assert.equal(ctx.etat.jetEnAttente?.optionAlternative, 'Bloquer l\'étai avec ton bouclier');
});

test('gmCoherence, gmOrchestrator & sceneMedia: condensation memoire, audit, thinking adaptatif et fallback media', async () => {
  const { compresserMemoireCampagne, validerCoherenceTour } = await import('./gmCoherence');
  const { evaluerComplexiteTour } = await import('./gmOrchestrator');
  const { genererIllustrationScene, genererAudioScene } = await import('./sceneMedia');

  const etat: SimulationState = JSON.parse(JSON.stringify(INITIAL_SIMULATION_STATE));
  assurerMemoireMJ(etat);
  for (let i = 1; i <= 15; i++) {
    etat.memoireMJ!.filNarratif.push(`Jour ${i}, 10:00 — Étape ${i} de l'expédition.`);
  }
  compresserMemoireCampagne(etat, 8);
  assert.equal(etat.memoireMJ!.filNarratif.length, 8);
  assert.ok((etat.memoireMJ!.chroniqueCondensee || '').includes('Étape 1'));
  assert.ok((etat.memoireMJ!.chroniqueCondensee || '').includes('Étape 7'));

  // Test validateur de cohérence (répare PV hors bornes + détecte PNJ absent)
  etat.personnage.pvActuels = 999;
  const rapport = validerCoherenceTour(
    etat,
    {
      titre: 'Rencontre impossible',
      texte: 'Capitaine Morn : « Je te parle depuis l autre bout du pays ! »',
      tonAmbiance: 'NEUTRE',
      suggestionsMJ: ['Piste 1', 'Piste 2'],
    },
    []
  );
  assert.equal(etat.personnage.pvActuels, etat.personnage.pvMax);
  assert.equal(rapport.statut, 'CORRIGE');
  assert.ok(rapport.corrections.length >= 1);
  assert.ok(rapport.anomalies.some(a => a.includes('Capitaine Morn')));

  // Test complexité adaptative
  assert.equal(evaluerComplexiteTour({ type: 'CONFIGURER_NARRATION', payloadAction: { mode: 'ULTRA_COURT' } }, etat).niveau, 'LOW');
  assert.equal(evaluerComplexiteTour({ type: 'FORAGER' }, etat).niveau, 'MEDIUM');
  assert.equal(evaluerComplexiteTour({ type: 'EXPLORER_SITE' }, etat).niveau, 'XHIGH');

  // Test sceneMedia sans clé API
  const svgRes = await genererIllustrationScene(null, {
    sceneKey: 'test_1',
    titre: 'Brume sur le gué',
    texte: 'La pluie fouette la forêt dense.',
    ton: 'SOMBRE',
    terrain: 'Forêt',
  });
  assert.equal(svgRes.source, 'fallback');
  assert.ok(svgRes.svg.startsWith('<svg'));
  assert.ok(svgRes.svg.includes('viewBox="0 0 640 360"'));

  await assert.rejects(
    () =>
      genererAudioScene(null, {
        sceneKey: 'test_1',
        titre: 'Test',
        texte: 'Tu observes la vallée.',
      }),
    /Clé Gemini absente/
  );
});




