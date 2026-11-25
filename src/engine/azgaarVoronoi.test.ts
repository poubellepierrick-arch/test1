import test from 'node:test';
import assert from 'node:assert/strict';
import {
  creerEtatInitialAzgaar,
  DEFAULT_AZGAAR_LAYERS,
  genererMondeAzgaarStudio,
  parserImportAzgaarJsonOuMap,
  projeterHexVersMondeAzgaar,
  reconstruireAtlasComplet,
  synchroniserSecteurDepuisAzgaar,
} from './azgaarVoronoi';
import { orchestrerActionDeterministe } from './adjudication';
import { AzgaarTemplateId } from '../types';

test('azgaarVoronoi: creerEtatInitialAzgaar genere un monde Voronoï complet pret au demarrage', () => {
  const etat = creerEtatInitialAzgaar();
  assert.ok(etat.azgaarStudio, 'azgaarStudio doit etre present au demarrage');
  const studio = etat.azgaarStudio!;

  assert.equal(studio.seed, 74219);
  assert.equal(DEFAULT_AZGAAR_LAYERS.blasons, true);
  assert.equal(studio.layers.blasons, true);
  assert.ok(studio.states.length >= 4);
  assert.ok(studio.provinces.length >= 4);
  assert.ok(studio.cultures.length >= 3);
  assert.ok(studio.religions.length >= 2);
  assert.ok(studio.burgs.length >= 15);
  assert.ok(studio.routes.length >= 3);
  assert.ok(studio.markers.length >= 1);

  for (const b of studio.burgs) {
    assert.ok(b.coa.fieldColor.startsWith('#'));
    assert.ok(b.coa.charge.length > 0);
  }

  assert.equal(etat.personnage.nom, 'Eldrin');
  assert.ok(etat.hexagones.length >= 19);

  const proj = projeterHexVersMondeAzgaar(etat.hexActuel, studio);
  assert.ok(proj.x >= 10 && proj.x <= studio.width - 10);
  assert.ok(proj.y >= 10 && proj.y <= studio.height - 10);
});

test('azgaarVoronoi: reconstruireAtlasComplet produit polygones, cotes, frontieres, vents et gravures cartographiques', () => {
  const etat = creerEtatInitialAzgaar();
  const studio = etat.azgaarStudio!;
  const geo = reconstruireAtlasComplet(studio);

  assert.ok(geo.cells.length >= 1200);
  const land = geo.cells.filter(c => c.isLand);
  const water = geo.cells.filter(c => !c.isLand);
  assert.ok(land.length > 50);
  assert.ok(water.length > 50);

  for (const c of geo.cells.slice(0, 50)) {
    assert.ok(c.polygon.length >= 3);
    assert.ok(c.neighbors.length >= 2);
  }

  assert.ok(geo.coastSegments.length > 10);
  assert.ok(geo.stateBorders.length >= 1);
  assert.ok(geo.windVectors.length >= 10);
  assert.ok(geo.reliefSymbols.length > 40);
  assert.ok(Array.isArray(geo.bridges));
  assert.ok(Array.isArray(geo.waterfalls));
  assert.ok(Array.isArray(geo.ships));
  assert.ok(geo.seaMonsters.length >= 1);
});

test('azgaarVoronoi: genererMondeAzgaarStudio supporte plusieurs templates et tailles', () => {
  const templates: AzgaarTemplateId[] = ['continent', 'archipel', 'mediterranee'];
  for (let i = 0; i < templates.length; i++) {
    const tpl = templates[i];
    const sim = genererMondeAzgaarStudio({
      seed: 1000 + i * 77,
      template: tpl,
      cellsDesired: 800,
      climateBias: i === 1 ? 'boreal' : 'tempere',
      rayonAnneaux: 2,
      worldName: `Monde-${tpl}`,
    });
    assert.equal(sim.azgaarStudio?.template, tpl);
    assert.equal(sim.azgaarStudio?.worldName, `Monde-${tpl}`);
    assert.equal(sim.hexagones.length, 19);
    const geo = reconstruireAtlasComplet(sim.azgaarStudio!);
    assert.ok(geo.cells.length >= 600);
  }
});

test('azgaarVoronoi: parserImportAzgaarJsonOuMap charge JSON Studio, pack FMG et .map texte', () => {
  const base = creerEtatInitialAzgaar();
  const jsonExport = JSON.stringify(base.azgaarStudio);
  const parsedJson = parserImportAzgaarJsonOuMap(jsonExport, base);
  assert.equal(parsedJson.seed, base.azgaarStudio!.seed);
  assert.equal(parsedJson.burgs.length, base.azgaarStudio!.burgs.length);

  const fmgPackJson = JSON.stringify({
    info: { seed: 91234, mapName: 'Valenoria', width: 1200, height: 760 },
    pack: {
      cells: [{ i: 0 }],
      states: [{ i: 1, name: 'Royaume Test', color: '#8f4f4f', capital: 1, diplomacy: [] }],
      burgs: [{ i: 1, name: 'Port-Test', x: 500, y: 350, cell: 100, state: 1, population: 12, capital: true, port: true, citadel: true }],
      cultures: [{ i: 1, name: 'Valen', code: 'Va', origins: [0] }],
      religions: [{ i: 1, name: 'Solaires', deity: 'Solinor' }],
      markers: [{ icon: 'ruine', x: 400, y: 300, dx: 0, note: 'Tour brisée' }],
    },
  });
  const parsedPack = parserImportAzgaarJsonOuMap(fmgPackJson, base);
  assert.equal(parsedPack.worldName, 'Valenoria');
  assert.equal(parsedPack.burgs[0].name, 'Port-Test');

  const rawMapText = [
    '2.0.0|Osteria|1200x760|55443|12',
    JSON.stringify([{ i: 1, name: 'Duché Nord', color: '#4f7a8f', capital: 1, diplomacy: [] }]),
    JSON.stringify([{ i: 1, name: 'Norden', x: 480, y: 320, cell: 80, state: 1, population: 8, capital: true, citadel: false }]),
  ].join('\n');
  const parsedMap = parserImportAzgaarJsonOuMap(rawMapText, base);
  assert.equal(parsedMap.seed, 55443);
  assert.equal(parsedMap.burgs[0].name, 'Norden');
});

test('azgaarVoronoi: synchroniserSecteurDepuisAzgaar propage les noms de bourgs et Etats', () => {
  const base = creerEtatInitialAzgaar();
  const studio = JSON.parse(JSON.stringify(base.azgaarStudio!));
  studio.states[0].name = 'Empire Renommé';
  const linkedBurg = studio.burgs.find((b: { hexId?: string }) => Boolean(b.hexId)) || studio.burgs[0];
  linkedBurg.name = 'Cité Nouvelle';

  const synced = synchroniserSecteurDepuisAzgaar(base, studio);
  assert.equal(synced.factions[0].nom, 'Empire Renommé');
  if (linkedBurg.hexId) {
    const hx = synced.hexagones.find(h => h.id === linkedBurg.hexId);
    assert.equal(hx?.nom, 'Cité Nouvelle');
  }
});

test('azgaarVoronoi: la grille hexagonale reste ancrée même quand le héros se déplace et ANNOTER_HEX crée un marqueur', () => {
  const base = creerEtatInitialAzgaar();
  const studio = base.azgaarStudio!;
  const posInit = projeterHexVersMondeAzgaar({ q: 1, r: -1 }, studio);

  // Simuler un déplacement du héros sur les coordonnées Azgaar
  studio.heroX = (studio.heroX ?? 600) + 120;
  studio.heroY = (studio.heroY ?? 380) - 65;
  const posApres = projeterHexVersMondeAzgaar({ q: 1, r: -1 }, studio);

  assert.equal(posApres.x, posInit.x);
  assert.equal(posApres.y, posInit.y);

  // Annoter l'hexagone actuel crée un marqueur synchronisé dans azgaarStudio.markers
  const resNote = orchestrerActionDeterministe(base, {
    type: 'ANNOTER_HEX',
    cibleId: base.hexActuel.id,
    texteLibre: 'Passage sûr vérifié',
  });
  assert.equal(resNote.nouvelEtat.hexActuel.annotationJoueur, 'Passage sûr vérifié');
  const marker = resNote.nouvelEtat.azgaarStudio?.markers.find(
    m => m.id === `m_note_${base.hexActuel.id}`
  );
  assert.ok(marker);
  assert.equal(marker?.note, 'Passage sûr vérifié');
});
