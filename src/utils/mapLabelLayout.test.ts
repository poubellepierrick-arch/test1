import test from 'node:test';
import assert from 'node:assert/strict';
import { calculerDispositionEtiquettes, MapLabelCandidate } from './mapLabelLayout';

function overlap(a: { left: number; top: number; right: number; bottom: number }, b: { left: number; top: number; right: number; bottom: number }) {
  return !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
}

test('mapLabelLayout: zero chevauchement sur grappe dense et conservation des priorites', () => {
  const candidates: MapLabelCandidate[] = [];
  for (let i = 0; i < 30; i++) {
    const isCap = i === 0;
    const isCitadel = i === 1 || i === 2;
    candidates.push({
      id: `burg_${i}`,
      kind: isCap ? 'capital' : isCitadel ? 'citadel' : 'burg',
      text: isCap ? 'Cité Capitale' : `Bourgade-${i}`,
      x: 420 + (i % 6) * 28,
      y: 300 + Math.floor(i / 6) * 18,
      priority: isCap ? 92 : isCitadel ? 76 : 50 - (i % 10),
      minZoom: isCap ? 1 : isCitadel ? 1.3 : 1.7,
      fontSize: isCap ? 11 : 9,
      markerRadius: isCap ? 12 : 8,
    });
  }

  // Au zoom 1.0, seules les étiquettes minZoom <= 1 s'affichent sans collision
  const z1 = calculerDispositionEtiquettes(candidates, { zoom: 1.0 });
  assert.equal(z1.length, 1);
  assert.equal(z1[0].id, 'burg_0');

  // Au zoom 1.8, davantage d'étiquettes apparaissent sans aucun chevauchement mutuel
  const z18 = calculerDispositionEtiquettes(candidates, { zoom: 1.8 });
  assert.ok(z18.length > 1, 'Doit révéler plus d étiquettes à zoom 1.8');
  assert.ok(z18.some(l => l.id === 'burg_0'), 'La capitale prioritaire doit être conservée');
  for (let i = 0; i < z18.length; i++) {
    for (let j = i + 1; j < z18.length; j++) {
      assert.equal(
        overlap(z18[i].box, z18[j].box),
        false,
        `Collision entre ${z18[i].id} et ${z18[j].id}`
      );
    }
  }

  // Au zoom 3.0, presque toutes les étiquettes de la grappe peuvent être disposées autour des ancres
  const z30 = calculerDispositionEtiquettes(candidates, { zoom: 3.0 });
  assert.ok(z30.length >= z18.length);
  for (let i = 0; i < z30.length; i++) {
    for (let j = i + 1; j < z30.length; j++) {
      assert.equal(overlap(z30[i].box, z30[j].box), false);
    }
  }
});

test('mapLabelLayout: bascule sur ancre alternative si below est bloque par un obstacle', () => {
  const candidates: MapLabelCandidate[] = [
    {
      id: 'hero',
      kind: 'hero',
      text: 'Eldrin',
      x: 500,
      y: 300,
      priority: 100,
      minZoom: 1,
      fontSize: 10,
      markerRadius: 10,
      preferredPlacements: ['below', 'above', 'right', 'left'],
    },
  ];

  // Obstacle qui recouvre la zone 'below' sous (500, 300)
  const placed = calculerDispositionEtiquettes(candidates, {
    zoom: 1.5,
    obstacles: [{ left: 450, top: 305, right: 550, bottom: 345 }],
  });
  assert.equal(placed.length, 1);
  assert.equal(placed[0].placement, 'above');
});
