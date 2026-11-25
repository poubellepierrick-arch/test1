import test from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_SIMULATION_STATE } from './initialData';
import { SimulationState } from '../types';
import {
  actionExprimeConsentementQuete,
  construireVueEpistemiqueHeros,
  detecterFuitesEpistemiques,
  detecterIncoherenceDialogue,
  detecterPresomptionIntention,
  detecterRuptureDiegetique,
  neutraliserPistesPresomptives,
} from './epistemic';
import { creerEtatInitialAzgaar } from './azgaarVoronoi';
import { assurerMemoireMJ } from '../server/gmTools';
import { construireContexteScene } from '../server/gmOrchestrator';
import { validerCoherenceTour } from '../server/gmCoherence';

function creerEtatEpistemiqueTest(): SimulationState {
  const etat: SimulationState = JSON.parse(JSON.stringify(INITIAL_SIMULATION_STATE));
  assurerMemoireMJ(etat);

  // Secret PNJ en vue
  const torvin = etat.grapheNoeuds.find(n => n.id === 'npc_forgeron_torvin');
  if (torvin) {
    torvin.proprietes = {
      ...torvin.proprietes,
      secret: 'Forge secrètement des armes pour la faction des ombres',
      motivation: 'Sauver son frère captif',
    };
  }

  // Secteur strictement inconnu avec nom et POI distincts
  const hexInconnu = etat.hexagones.find(h => h.brouillard === 'INCONNU' && !h.estEau);
  if (hexInconnu) {
    hexInconnu.nom = 'Gouffre de Sombrefaille';
    hexInconnu.pointInteret = {
      id: 'poi_secret_test',
      nom: 'Sanctuaire d Obrec',
      type: 'ruine',
      statut: 'OCCUPIED',
    };
  }

  // Rumeur incertaine
  etat.rumeurs = [
    {
      id: 'rum_1',
      titre: 'Bruits sous la vieille mine',
      texte: 'Des ombres rôderaient près des galeries.',
      source: 'Elia',
      veracite: false,
      tickEmission: 1,
      statutPerception: 'INCERTAINE',
      lieuObtention: 'Val-Gris',
    },
  ];

  // Quêtes : une proposée, une acceptée, une déclinée
  etat.memoireMJ!.promessesEtQuetes = [
    {
      id: 'q_prop',
      titre: 'Inspecter la tour nord',
      interlocuteur: 'Elia',
      statut: 'PROPOSEE',
      details: 'Offre en attente.',
    },
    {
      id: 'q_acc',
      titre: 'Livrer des vivres',
      interlocuteur: 'Torvin',
      statut: 'EN_COURS',
      details: 'Engagement pris.',
    },
    {
      id: 'q_dec',
      titre: 'Pacte douteux',
      interlocuteur: 'Inconnu',
      statut: 'DECLINEE',
      details: 'Refusée.',
    },
  ];

  return etat;
}

test('epistemic: sépare strictement savoir du héros et réalité cachée du monde', () => {
  const etat = creerEtatEpistemiqueTest();
  const vue = construireVueEpistemiqueHeros(etat);

  // 1. Secrets PNJ absents de perceptionImmediate, présents dans realiteCacheeMonde
  const torvinVue = vue.perceptionImmediate.pnjsEnVue.find(p => p.id === 'npc_forgeron_torvin');
  assert.ok(torvinVue);
  assert.equal((torvinVue as any).secret, undefined);
  assert.equal((torvinVue as any).motivation, undefined);
  assert.ok(
    vue.realiteCacheeMonde.pnjsSecrets.some(
      s => s.id === 'npc_forgeron_torvin' && s.secret?.includes('faction des ombres')
    )
  );

  // 2. Hexagone INCONNU absent des lieux découverts et masqué aux abords
  assert.equal(
    vue.savoirVerifie.lieuxDecouverts.some(l => l.nom === 'Gouffre de Sombrefaille'),
    false
  );
  assert.equal(
    vue.perceptionImmediate.abordsImmediats.some(a => a.label.includes('Gouffre de Sombrefaille')),
    false
  );
  assert.ok(
    vue.realiteCacheeMonde.lieuxInconnus.some(l => l.nom === 'Gouffre de Sombrefaille')
  );

  // 3. Rumeurs perçues sans véracité exposée
  assert.equal(vue.souvenirsEtOuieDire.rumeursEntendues.length, 1);
  assert.equal((vue.souvenirsEtOuieDire.rumeursEntendues[0] as any).veracite, undefined);
  assert.equal(vue.souvenirsEtOuieDire.rumeursEntendues[0].statutPerception, 'INCERTAINE');
  assert.equal(vue.realiteCacheeMonde.veraciteRumeurs[0].veracite, false);

  // 4. Propositions vs Engagements
  assert.equal(vue.savoirVerifie.propositionsEnAttente.length, 1);
  assert.equal(vue.savoirVerifie.propositionsEnAttente[0].id, 'q_prop');
  assert.equal(vue.savoirVerifie.engagementsAcceptes.length, 1);
  assert.equal(vue.savoirVerifie.engagementsAcceptes[0].id, 'q_acc');
});

test('epistemic: construireContexteScene isole Strate 1 (héros) et Strate 2 (monde caché)', () => {
  const etat = creerEtatEpistemiqueTest();
  const prompt = construireContexteScene(
    { type: 'ACTION_LIBRE', texteLibre: 'Je regarde la place du village.' },
    etat
  );

  const idxStrate1 = prompt.indexOf('STRATE 1');
  const idxStrate2 = prompt.indexOf('STRATE 2');
  assert.ok(idxStrate1 >= 0 && idxStrate2 > idxStrate1);

  const strate1 = prompt.slice(idxStrate1, idxStrate2);
  const strate2 = prompt.slice(idxStrate2);

  assert.equal(strate1.includes('Gouffre de Sombrefaille'), false);
  assert.equal(strate1.includes('Sanctuaire d Obrec'), false);
  assert.equal(strate1.includes('faction des ombres'), false);
  assert.equal(strate1.includes('FAUSSE'), false);

  assert.equal(strate2.includes('Gouffre de Sombrefaille'), true);
  assert.equal(strate2.includes('faction des ombres'), true);
  assert.equal(strate2.includes('FAUSSE'), true);
});

test('epistemic & gmCoherence: détecte présomptions d intention, fuites épistémiques et neutralise les pistes', () => {
  const etat = creerEtatEpistemiqueTest();

  const presomptions = detecterPresomptionIntention(
    "Tu penses qu'il ment et tu décides de sortir ton arme sans hésiter."
  );
  assert.ok(presomptions.length >= 2);

  const fuites = detecterFuitesEpistemiques(
    'À trois lieues s élève le Sanctuaire d Obrec où la Force: 60/80 attend. Cette rumeur est fausse.',
    etat
  );
  assert.equal(fuites.length, 3);

  const norm = neutraliserPistesPresomptives([
    'Tu décides de partir vers le nord',
    'Choisir de fouiller le coffre',
    'Observer la rue',
  ]);
  assert.equal(norm.modifiees, true);
  assert.equal(norm.pistes[0], 'Partir vers le nord');
  assert.equal(norm.pistes[1], 'Fouiller le coffre');
  assert.equal(norm.pistes[2], 'Observer la rue');

  assert.equal(actionExprimeConsentementQuete({ type: 'ACTION_LIBRE', texteLibre: 'Je pose une question' }), false);
  assert.equal(
    actionExprimeConsentementQuete({ type: 'ACTION_LIBRE', texteLibre: "D'accord, j'accepte cette mission" }),
    true
  );

  const parsed = {
    titre: 'Scène test',
    texte: 'Tu crains une embuscade près de Gouffre de Sombrefaille.',
    tonAmbiance: 'SOMBRE' as const,
    suggestionsMJ: ['Tu veux fuir vers le bois', 'Observer les traces', 'Parler à Torvin'],
  };
  const rapport = validerCoherenceTour(etat, parsed, []);
  assert.equal(rapport.statut, 'CORRIGE');
  assert.ok(rapport.anomalies.some(a => a.includes('Attribution de pensée')));
  assert.ok(rapport.anomalies.some(a => a.includes('Fuite épistémique')));
  assert.equal(parsed.suggestionsMJ[0], 'Fuir vers le bois');
});

test('epistemic: détecte les ruptures diégétiques et garantit un départ sans méta-jeu ni réplique absurde', () => {
  const ruptures = detecterRuptureDiegetique(
    "Ouvre l'onglet Monde & Atlas ou clique sur l'hexagone voisin pour économiser 4 PV.",
    ["Consulter l'onglet carte"]
  );
  assert.equal(ruptures.length, 3);

  const propre = detecterRuptureDiegetique(
    "Les coups de marteau résonnent sous l'auvent de la forge tandis que la pluie tambourine sur l'ardoise.",
    ['Approcher de la forge', 'Observer la place', 'Suivre le chemin du nord']
  );
  assert.equal(propre.length, 0);

  const etatInit = creerEtatInitialAzgaar();
  assert.equal(etatInit.journalNarratif.length, 0);
});

test('epistemic & gmCoherence: détecte réplique catalogue opportuniste et contradiction matérielle, et valide un dialogue cohérent', () => {
  const repliqueAbsurde =
    'Torvin lève les yeux : « Tu tombes à pic, mon foyer tire la langue faute de charbon sec. Tu viens pour un coup de main aux soufflets, une lame à entretenir ou du négoce ? »';
  const anomalies = detecterIncoherenceDialogue(repliqueAbsurde);
  assert.equal(anomalies.length, 2);
  assert.ok(anomalies.some(a => a.includes('catalogue')));
  assert.ok(anomalies.some(a => a.includes('Contradiction matérielle')));

  const repliqueCoherente =
    'Torvin pose sa pince sur l enclume froide : « Le dernier sac de charbon sec est parti ce matin. Sans feu, je ne peux plus battre le fer tant qu une charrette de bois mort n arrive pas du sud. »';
  assert.equal(detecterIncoherenceDialogue(repliqueCoherente).length, 0);

  const etat = creerEtatEpistemiqueTest();
  const rapport = validerCoherenceTour(
    etat,
    {
      titre: 'Devant la forge',
      texte: repliqueAbsurde,
      tonAmbiance: 'NEUTRE',
      suggestionsMJ: ['Observer le foyer', 'Répondre à Torvin', 'Quitter l auvent'],
    },
    []
  );
  assert.equal(rapport.statut, 'ALERTE');
  assert.ok(rapport.anomalies.some(a => a.includes('Contradiction matérielle')));
});
