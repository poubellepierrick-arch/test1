import test from 'node:test';
import assert from 'node:assert/strict';
import {
  etendreFrontiereAzgaar,
  extraireMetadataAzgaarDepuisEtat,
  genererMondeAzgaar,
} from './azgaarGenerator';
import { creerEtatInitialAzgaar } from './azgaarVoronoi';
import { INITIAL_SIMULATION_STATE } from './initialData';
import { orchestrerActionDeterministe } from './adjudication';
import { calculerItinerairePondere } from './worldGeography';

test('genererMondeAzgaar est déterministe par graine et varie selon le relief et la taille', () => {
  const mondeA = genererMondeAzgaar({
    seed: 104729,
    modeleRelief: 'continent',
    climatBias: 'tempere',
    rayonAnneaux: 3,
  });
  const mondeB = genererMondeAzgaar({
    seed: 104729,
    modeleRelief: 'continent',
    climatBias: 'tempere',
    rayonAnneaux: 3,
  });

  assert.equal(mondeA.hexagones.length, 37);
  assert.equal(mondeA.carteAzgaar?.nomMonde, mondeB.carteAzgaar?.nomMonde);
  assert.deepEqual(
    mondeA.hexagones.map(h => `${h.id}:${h.terrain}:${h.altitude}:${h.estEau}`),
    mondeB.hexagones.map(h => `${h.id}:${h.terrain}:${h.altitude}:${h.estEau}`)
  );

  const petit = genererMondeAzgaar({
    seed: 104729,
    modeleRelief: 'vallee',
    climatBias: 'tempere',
    rayonAnneaux: 2,
  });
  assert.equal(petit.hexagones.length, 19);

  const grandArchipel = genererMondeAzgaar({
    seed: 204811,
    modeleRelief: 'archipel',
    climatBias: 'boreal',
    rayonAnneaux: 4,
  });
  assert.equal(grandArchipel.hexagones.length, 61);
  assert.ok(grandArchipel.hexagones.some(h => h.estEau));
  assert.ok(grandArchipel.hexagones.some(h => !h.estEau && h.estRivage));
});

test('genererMondeAzgaar génère cultures, rivières, factions, routes Dijkstra et graphe complet', () => {
  const monde = genererMondeAzgaar({
    seed: 55109,
    modeleRelief: 'continent',
    climatBias: 'tempere',
    rayonAnneaux: 3,
    conserverHeros: true,
  });

  const terres = monde.hexagones.filter(h => !h.estEau);
  assert.ok(terres.length >= 10);
  assert.ok(terres.every(h => Boolean(h.biomeAzgaar)));
  assert.ok(terres.every(h => Boolean(h.culture)));
  assert.ok(monde.factions.length >= 3);
  assert.ok(monde.carteAzgaar && monde.carteAzgaar.cultures.length >= 2);
  assert.ok(monde.carteAzgaar && monde.carteAzgaar.rivieres.length >= 1);
  assert.ok(monde.carteAzgaar && monde.carteAzgaar.routes.length >= 1);
  assert.equal(monde.hexActuel.estEau, false);
  assert.equal(monde.hexActuel.pointInteret?.type, 'bourgade');

  // Vérifier les arêtes ADJACENT_TO uniquement entre cases terrestres
  const edgesAdj = monde.grapheLiens.filter(l => l.relation === 'ADJACENT_TO');
  assert.ok(edgesAdj.length > 0);
  for (const e of edgesAdj) {
    const src = monde.hexagones.find(h => h.id === e.source);
    const dst = monde.hexagones.find(h => h.id === e.cible);
    assert.equal(src?.estEau, false);
    assert.equal(dst?.estEau, false);
  }

  // Vérifier l'extension sur monde unifié avec azgaarStudio actif
  const mondeVoronoi = creerEtatInitialAzgaar();
  const extVor = etendreFrontiereAzgaar(mondeVoronoi, 3, -1, {
    forceTerre: true,
    brouillard: 'REPERE',
    pointInteretType: 'camp',
    pointInteretNom: 'Avant-poste Voronoï',
  });
  assert.equal(extVor.dejaExistant, false);
  assert.equal(extVor.hexCree.pointInteret?.nom, 'Avant-poste Voronoï');
});

test('etendreFrontiereAzgaar ajoute un secteur adjacent sans doublon et lie le graphe', () => {
  const etat = JSON.parse(JSON.stringify(INITIAL_SIMULATION_STATE));
  const initialCount = etat.hexagones.length;

  const res = etendreFrontiereAzgaar(etat, 2, 0, {
    nom: 'Passe d\'Oremor',
    forceTerre: true,
    brouillard: 'REPERE',
    pointInteretType: 'ruine',
    pointInteretNom: 'Ruines d\'Oremor',
  });

  assert.equal(res.dejaExistant, false);
  assert.equal(etat.hexagones.length, initialCount + 1);
  assert.equal(res.hexCree.nom, 'Passe d\'Oremor');
  assert.equal(res.hexCree.pointInteret?.type, 'ruine');
  assert.ok(etat.grapheNoeuds.some((n: any) => n.id === res.hexCree.id && n.type === 'Location'));
  assert.ok(etat.grapheLiens.some((l: any) => l.relation === 'ADJACENT_TO' && l.source === res.hexCree.id));

  // Appel idempotent sur mêmes coordonnées
  const dup = etendreFrontiereAzgaar(etat, 2, 0);
  assert.equal(dup.dejaExistant, true);
  assert.equal(etat.hexagones.length, initialCount + 1);
});

test('DEPLACER_HEX et calculerItinerairePondere bloquent les cases maritimes estEau', () => {
  const monde = genererMondeAzgaar({
    seed: 91234,
    modeleRelief: 'archipel',
    climatBias: 'tempere',
    rayonAnneaux: 3,
  });

  // Trouver une case eau adjacente à hexActuel ou créer un cas déterministe
  const voisinEau = monde.hexagones.find(
    h => h.estEau && Math.max(Math.abs(h.q - monde.hexActuel.q), Math.abs(h.r - monde.hexActuel.r), Math.abs((h.q + h.r) - (monde.hexActuel.q + monde.hexActuel.r))) === 1
  ) || {
    ...monde.hexagones[1],
    id: 'hex_mer_test',
    q: monde.hexActuel.q + 1,
    r: monde.hexActuel.r,
    estEau: true,
  };

  if (!monde.hexagones.some(h => h.id === voisinEau.id)) {
    monde.hexagones.push(voisinEau);
  }

  assert.throws(
    () => orchestrerActionDeterministe(monde, { type: 'DEPLACER_HEX', cibleId: voisinEau.id }),
    /infranchissable/i
  );

  const routeEau = calculerItinerairePondere(monde.hexActuel.id, voisinEau.id, monde.hexagones, 'CARAVANE');
  assert.ok(routeEau.coutTotal >= 900);

  // extraireMetadataAzgaarDepuisEtat fonctionne aussi sur Val-Gris
  const metaValGris = extraireMetadataAzgaarDepuisEtat(INITIAL_SIMULATION_STATE);
  assert.equal(metaValGris.nomMonde, 'Marches de Val-Gris');
  assert.ok(metaValGris.rivieres.length >= 1);
});
