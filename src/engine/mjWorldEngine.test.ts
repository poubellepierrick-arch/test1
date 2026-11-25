import test from 'node:test';
import assert from 'node:assert/strict';
import { creerEtatInitialAzgaar } from './azgaarVoronoi';
import { appliquerCommandeMJMonde } from './mjWorldEngine';

test('MODIFIER_HEX ajuste contrôle, danger, sécurité et synchronise factions', () => {
  const etat = creerEtatInitialAzgaar();
  const cible = etat.hexagones.find(h => !h.estEau && h.id !== etat.hexActuel.id) || etat.hexActuel;
  const factionCible = etat.factions[1] || etat.factions[0];

  const { etat: next } = appliquerCommandeMJMonde(etat, {
    type: 'MODIFIER_HEX',
    hexId: cible.id,
    factionControleId: factionCible.id,
    pressionDanger: 85,
    garnison: 72,
    routeNiveau: 'ROUTE',
  });

  const maj = next.hexagones.find(h => h.id === cible.id)!;
  assert.equal(maj.factionControleId, factionCible.id);
  assert.equal(maj.pressionDanger, 85);
  assert.equal(maj.securite, 'Périlleux');
  assert.equal(maj.garnison, 72);
  assert.equal(maj.routeNiveau, 'ROUTE');
  const facMaj = next.factions.find(f => f.id === factionCible.id)!;
  assert.ok(facMaj.noeudsControles.includes(cible.id));
});

test('MODIFIER_DIPLOMATIE met à jour les deux factions, la chronique et les états Azgaar', () => {
  const etat = creerEtatInitialAzgaar();
  const [fA, fB] = etat.factions;
  assert.ok(fA && fB);

  const { etat: next } = appliquerCommandeMJMonde(etat, {
    type: 'MODIFIER_DIPLOMATIE',
    factionAId: fA.id,
    factionBId: fB.id,
    relation: 'GUERRE',
  });

  const nextA = next.factions.find(f => f.id === fA.id)!;
  const nextB = next.factions.find(f => f.id === fB.id)!;
  assert.equal(nextA.relationsFactions?.[fB.id], 'GUERRE');
  assert.equal(nextB.relationsFactions?.[fA.id], 'GUERRE');
  assert.ok((next.chroniqueMonde || []).some(c => c.categorie === 'DIPLOMATIE'));

  const stA = next.azgaarStudio?.states.find(s => s.factionId === fA.id);
  const stB = next.azgaarStudio?.states.find(s => s.factionId === fB.id);
  if (stA && stB) {
    assert.equal(stA.diplomacy[stB.id], 'Guerre');
    assert.equal(stB.diplomacy[stA.id], 'Guerre');
  }
});

test('DECLENCHER_CRISE applique effets locaux, émet un Event dans le graphe et un marqueur MJ', () => {
  const etat = creerEtatInitialAzgaar();
  const hex = etat.hexagones.find(h => !h.estEau)!;
  const nbMarkersAvant = etat.azgaarStudio?.markers.length ?? 0;

  const { etat: next } = appliquerCommandeMJMonde(etat, {
    type: 'DECLENCHER_CRISE',
    hexId: hex.id,
    preset: 'RELIQUE',
    poserMarqueur: true,
  });

  const majHex = next.hexagones.find(h => h.id === hex.id)!;
  assert.ok(majHex.pointInteret);
  assert.ok(next.grapheNoeuds.some(n => n.type === 'Event' && n.connuParEntites?.includes(hex.id)));
  assert.ok((next.memoireMJ?.filNarratif.length || 0) > (etat.memoireMJ?.filNarratif.length || 0));
  if (next.azgaarStudio) {
    assert.equal(next.azgaarStudio.markers.length, nbMarkersAvant + 1);
    assert.equal(next.azgaarStudio.markers[next.azgaarStudio.markers.length - 1].author, 'MJ');
  }
});

test('DEPECHER_UNITE et GERER_UNITE routent et font progresser une unité terrestre', () => {
  const etat = creerEtatInitialAzgaar();
  const terres = etat.hexagones.filter(h => !h.estEau);
  assert.ok(terres.length >= 2);
  const dep = terres[0];
  const arr = terres[terres.length - 1];

  const { etat: avecUnite } = appliquerCommandeMJMonde(etat, {
    type: 'DEPECHER_UNITE',
    typeEntite: 'MESSAGER',
    nom: 'Courrier spécial',
    origineHexId: dep.id,
    destinationHexId: arr.id,
  });

  const ent = avecUnite.entitesMonde!.find(e => e.nom === 'Courrier spécial');
  assert.ok(ent);
  assert.equal(ent.statut, 'EN_ROUTE');
  assert.ok((ent.itineraire?.length || 0) >= 2);

  const { etat: avancee } = appliquerCommandeMJMonde(avecUnite, {
    type: 'GERER_UNITE',
    entiteId: ent.id,
    operation: 'AVANCER',
  });
  const entAv = avancee.entitesMonde!.find(e => e.id === ent.id)!;
  assert.notEqual(entAv.hexId, dep.id);
});

test('GERER_PNJ, GERER_RUMEUR et GERER_INTRIGUE pilotent PNJ, rumeurs et conséquences différées', () => {
  const etat = creerEtatInitialAzgaar();
  const hex = etat.hexagones.find(h => !h.estEau)!;

  const r1 = appliquerCommandeMJMonde(etat, {
    type: 'GERER_PNJ',
    operation: 'CREER',
    nom: 'Varek le Guetteur',
    profession: 'Éclaireur',
    hexId: hex.id,
    disposition: 'MEFIANT',
  });
  const pnj = r1.etat.grapheNoeuds.find(n => n.label === 'Varek le Guetteur');
  assert.ok(pnj);
  assert.ok(r1.etat.grapheLiens.some(l => l.source === pnj.id && l.cible === hex.id && l.relation === 'LOCATED_IN'));

  const r2 = appliquerCommandeMJMonde(r1.etat, {
    type: 'GERER_RUMEUR',
    operation: 'CREER',
    titre: 'Convoi fantôme',
    texte: 'Des chariots sans lanterne passent le gué à minuit.',
    source: 'Taverne',
    veracite: false,
  });
  const rum = r2.etat.rumeurs.find(r => r.titre === 'Convoi fantôme');
  assert.ok(rum);
  assert.equal(rum.veracite, false);

  const r3 = appliquerCommandeMJMonde(r2.etat, {
    type: 'GERER_INTRIGUE',
    cible: 'CONSEQUENCE',
    operation: 'CREER',
    declencheur: 'Si le pont saute',
    effetPrevu: 'Isolement complet de la mine',
  });
  const cons = r3.etat.memoireMJ!.consequencesDifferees.find(c => c.declencheur === 'Si le pont saute');
  assert.ok(cons && cons.actif);

  const r4 = appliquerCommandeMJMonde(r3.etat, {
    type: 'GERER_INTRIGUE',
    cible: 'CONSEQUENCE',
    operation: 'DECLENCHER',
    id: cons.id,
  });
  const consDecl = r4.etat.memoireMJ!.consequencesDifferees.find(c => c.id === cons.id)!;
  assert.equal(consDecl.actif, false);
  assert.ok((r4.etat.chroniqueMonde || []).some(c => c.titre === 'Si le pont saute'));
});
