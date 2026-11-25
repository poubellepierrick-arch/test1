import {
  AzgaarBurgDef,
  AzgaarReconstructedGeometry,
  AzgaarResourceNode,
  AzgaarTradeRouteFlow,
  AzgaarWorldState,
  HexNode,
  RessourceNaturelleType,
  WorldEntity,
} from '../types';
import { createSeededRng } from '../utils/prng';

export interface ResourceDescriptor {
  type: RessourceNaturelleType;
  label: string;
  cargoLabel: NonNullable<WorldEntity['cargaison']>;
  color: string;
  unitLabel: string;
}

export const RESSOURCES_CATALOGUE: Record<RessourceNaturelleType, ResourceDescriptor> = {
  FER: {
    type: 'FER',
    label: 'Minerai de fer',
    cargoLabel: 'Minerai',
    color: '#5a636e',
    unitLabel: 'Filon ferreux',
  },
  OR: {
    type: 'OR',
    label: 'Or & Argent',
    cargoLabel: 'Artisanat',
    color: '#c48f24',
    unitLabel: 'Veine aurifère',
  },
  PIERRE: {
    type: 'PIERRE',
    label: 'Pierre de taille',
    cargoLabel: 'Pierre',
    color: '#7e766b',
    unitLabel: 'Carrière',
  },
  BOIS: {
    type: 'BOIS',
    label: 'Bois d’œuvre',
    cargoLabel: 'Bois',
    color: '#4e6f3a',
    unitLabel: 'Scierie forestière',
  },
  CEREALES: {
    type: 'CEREALES',
    label: 'Céréales & Blé',
    cargoLabel: 'Vivres',
    color: '#b88b2e',
    unitLabel: 'Terres arables',
  },
  ELEVAGE: {
    type: 'ELEVAGE',
    label: 'Bétail & Laine',
    cargoLabel: 'Vivres',
    color: '#8f5d38',
    unitLabel: 'Pâturages',
  },
  POISSON_SEL: {
    type: 'POISSON_SEL',
    label: 'Pêche & Marais salants',
    cargoLabel: 'Sel & Poisson',
    color: '#34698a',
    unitLabel: 'Pêcherie / Salines',
  },
  HERBES_ARCANES: {
    type: 'HERBES_ARCANES',
    label: 'Herbes & Résines rares',
    cargoLabel: 'Artisanat',
    color: '#5f4b82',
    unitLabel: 'Herboristerie sauvage',
  },
};

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function nomSiteRessource(type: RessourceNaturelleType, idx: number): string {
  const prefixes: Record<RessourceNaturelleType, string[]> = {
    FER: ['Mines de Fer-Bas', 'Fosse du Pic Noir', 'Veine des Forges', 'Galeries de Ferron'],
    OR: ['Filon d’Or-Clair', 'Puits d’Argent', 'Crête Dorée', 'Ravin des Pépites'],
    PIERRE: ['Carrières de Granit', 'Coteaux d’Ardoise', 'Taille de Blanc-Roc', 'Roches du Gué'],
    BOIS: ['Coupe des Grands Chênes', 'Scierie des Pins', 'Futaie Royale', 'Sylve d’Écorce'],
    CEREALES: ['Plaines d’Épeautre', 'Greniers du Val', 'Champs d’Orge', 'Sillons Dorés'],
    ELEVAGE: ['Alpages de Laine', 'Pâtures du Ponant', 'Haras des Hauts', 'Troupeaux du Val'],
    POISSON_SEL: ['Salines d’Écume', 'Anse aux Filets', 'Pêcheries du Levant', 'Bancs de Morue'],
    HERBES_ARCANES: ['Tourbières d’Ambre', 'Herbaies de Brume', 'Sente des Simples', 'Clairière d’Aconit'],
  };
  const arr = prefixes[type];
  return arr[idx % arr.length];
}

/**
 * Répartit de façon réaliste les gisements de ressources, spécialisations de bourgs
 * et flux commerciaux pondérés sur une carte Azgaar FMG.
 */
export function genererEconomieEtRessourcesAzgaar(
  studio: AzgaarWorldState,
  geo: AzgaarReconstructedGeometry
): {
  resources: AzgaarResourceNode[];
  tradeFlows: AzgaarTradeRouteFlow[];
} {
  const rng = createSeededRng(studio.seed + 911);
  const landCells = geo.cells.filter(c => c.isLand);
  if (landCells.length === 0) {
    return { resources: [], tradeFlows: [] };
  }

  const resources: AzgaarResourceNode[] = [];
  const usedCells = new Set<number>();

  const pickSites = (
    candidates: typeof landCells,
    type: RessourceNaturelleType,
    maxCount: number,
    minDist: number
  ) => {
    let added = 0;
    for (const c of candidates) {
      if (added >= maxCount) break;
      if (usedCells.has(c.index)) continue;
      if (resources.some(r => Math.hypot(r.x - c.x, r.y - c.y) < minDist)) continue;
      if (studio.burgs.some(b => Math.hypot(b.x - c.x, b.y - c.y) < 18)) continue;

      const richesse = clamp(
        2 + Math.floor(rng() * 3) + (c.h >= 68 || c.flux >= 45 || c.isCoast ? 1 : 0),
        1,
        5
      );
      resources.push({
        id: `res_${type.toLowerCase()}_${c.index}`,
        type,
        nom: nomSiteRessource(type, resources.length),
        x: Number(c.x.toFixed(1)),
        y: Number(c.y.toFixed(1)),
        cell: c.index,
        richesse,
        reserve: 70 + Math.floor(rng() * 30),
        exploiteParStateId: c.stateId > 0 ? c.stateId : undefined,
      });
      usedCells.add(c.index);
      added++;
    }
  };

  // 1. Fer & Or & Pierre dans les reliefs / montagnes (Azgaar altitude + pente)
  const mountainCells = [...landCells]
    .filter(c => c.h >= 54 || c.biome === 10)
    .sort((a, b) => b.h - a.h);
  pickSites(mountainCells, 'FER', Math.max(3, Math.round(landCells.length / 190)), 78);
  pickSites(mountainCells.filter(c => c.h >= 66), 'OR', 2, 165);
  pickSites(
    landCells.filter(c => c.h >= 40 && c.h < 68).sort((a, b) => b.h - a.h),
    'PIERRE',
    3,
    115
  );

  // 2. Bois dans les forêts (biomes 5, 6, 7)
  const forestCells = [...landCells]
    .filter(c => c.biome === 5 || c.biome === 6 || c.biome === 7)
    .sort((a, b) => b.precip - a.precip);
  pickSites(forestCells, 'BOIS', Math.max(3, Math.round(landCells.length / 180)), 85);

  // 3. Céréales dans les plaines fertiles irriguées (faible pente, flux hydro ou précipitations modérées)
  const fertileCells = [...landCells]
    .filter(c => (c.biome === 4 || c.biome === 3) && c.h >= 21 && c.h <= 48 && c.precip >= 34)
    .sort((a, b) => b.flux + b.precip - (a.flux + a.precip));
  pickSites(fertileCells, 'CEREALES', Math.max(4, Math.round(landCells.length / 160)), 82);

  // 4. Élevage sur coteaux, savanes, toundra/piémonts
  const pastureCells = [...landCells]
    .filter(c => c.biome === 3 || c.biome === 4 || c.biome === 8)
    .sort((a, b) => Math.abs(a.h - 42) - Math.abs(b.h - 42));
  pickSites(pastureCells, 'ELEVAGE', 3, 105);

  // 5. Pêche & Sel sur le littoral et baies
  const coastCells = [...landCells]
    .filter(c => c.isCoast)
    .sort((a, b) => b.flux - a.flux);
  pickSites(coastCells, 'POISSON_SEL', Math.max(2, Math.round(coastCells.length / 26)), 92);

  // 6. Herbes & résines rares dans marais, hautes futaies humides ou déserts chauds
  const herbCells = [...landCells]
    .filter(c => c.biome === 9 || c.biome === 6 || c.biome === 2)
    .sort((a, b) => b.flux + b.temp - (a.flux + a.temp));
  pickSites(herbCells, 'HERBES_ARCANES', 3, 130);

  // Attribuer spécialisations, exportations & importations à chaque bourg selon sa géographie locale
  for (const b of studio.burgs) {
    const cell = geo.cells[b.cell];
    const nearbyRes = resources
      .filter(r => Math.hypot(r.x - b.x, r.y - b.y) <= 135)
      .sort((a, c) => Math.hypot(a.x - b.x, a.y - b.y) - Math.hypot(c.x - b.x, c.y - b.y));

    const exportsSet = new Set<RessourceNaturelleType>();
    for (const r of nearbyRes.slice(0, 2)) {
      exportsSet.add(r.type);
    }

    if (b.port) {
      exportsSet.add('POISSON_SEL');
    }
    if (cell && cell.h >= 56 && exportsSet.size < 2) {
      exportsSet.add('FER');
    }
    if (cell && (cell.biome === 5 || cell.biome === 6 || cell.biome === 7) && exportsSet.size < 2) {
      exportsSet.add('BOIS');
    }
    if (exportsSet.size === 0) {
      exportsSet.add(cell && cell.precip >= 40 ? 'CEREALES' : 'ELEVAGE');
    }

    const exportsArr = Array.from(exportsSet).slice(0, 3);
    const neededPool: RessourceNaturelleType[] = ['CEREALES', 'FER', 'BOIS', 'POISSON_SEL', 'PIERRE'];
    const importsArr = neededPool.filter(t => !exportsSet.has(t)).slice(0, b.capital ? 3 : 2);

    let spec = 'Carrefour agricole';
    if (b.port && b.capital) spec = 'Grand port souverain';
    else if (b.port) spec = 'Port franc & pêcheries';
    else if (b.citadel && (exportsArr.includes('FER') || exportsArr.includes('PIERRE'))) spec = 'Place forte & forges';
    else if (b.citadel) spec = 'Bastion de marche';
    else if (exportsArr.includes('OR') || exportsArr.includes('FER')) spec = 'Bourg minier & fonderie';
    else if (exportsArr.includes('BOIS')) spec = 'Cité forestière & charpente';
    else if (exportsArr.includes('HERBES_ARCANES')) spec = 'Comptoir d’herboristerie';
    else if (b.plaza || b.capital) spec = 'Carrefour marchand';
    else if (exportsArr.includes('CEREALES')) spec = 'Grenier fluvial';

    b.specialisation = spec;
    b.exportations = exportsArr;
    b.importations = importsArr;
    b.indicePrix = Number((0.92 + (b.capital ? 0.14 : 0) + (b.port ? -0.06 : 0.04) + rng() * 0.12).toFixed(2));
    b.tresorerie = Math.round(b.population * (b.capital ? 0.25 : b.plaza ? 0.18 : 0.1));
  }

  // Générer les flux commerciaux pondérés le long des routes reliant producteurs & consommateurs
  const tradeFlows: AzgaarTradeRouteFlow[] = [];
  const routeList = studio.routes || [];
  for (const rt of routeList) {
    if (!rt.fromBurgId || !rt.toBurgId || rt.points.length < 2) continue;
    const fromB = studio.burgs.find(b => b.id === rt.fromBurgId);
    const toB = studio.burgs.find(b => b.id === rt.toBurgId);
    if (!fromB || !toB) continue;

    // Choisir la denrée la plus complémentaire entre fromB et toB
    const fromExports = fromB.exportations || ['CEREALES'];
    const toImports = toB.importations || ['FER'];
    const toExports = toB.exportations || ['BOIS'];
    const fromImports = fromB.importations || ['CEREALES'];

    let exporter = fromB;
    let importer = toB;
    let denree = fromExports.find(e => toImports.includes(e));

    if (!denree) {
      const reverse = toExports.find(e => fromImports.includes(e));
      if (reverse) {
        exporter = toB;
        importer = fromB;
        denree = reverse;
      } else {
        denree = fromExports[0] || 'CEREALES';
      }
    }

    const volume = clamp(
      Math.round(
        (rt.kind === 'sea' ? 2.5 : rt.kind === 'road' ? 2 : 1) +
          (exporter.capital || importer.capital ? 1.5 : 0.5) +
          ((exporter.plaza || importer.plaza) ? 0.5 : 0)
      ),
      1,
      5
    );

    const pts = exporter.id === fromB.id ? rt.points : [...rt.points].reverse();
    tradeFlows.push({
      id: `flow_${rt.id}`,
      routeId: rt.id,
      fromBurgId: exporter.id,
      toBurgId: importer.id,
      denree,
      volume,
      kind: rt.kind,
      points: pts,
    });
  }

  studio.resources = resources;
  studio.tradeFlows = tradeFlows;
  return { resources, tradeFlows };
}

/**
 * Hydrate les données économiques d'un hexagone tactique depuis la géographie ou les nœuds Azgaar.
 */
export function hydraterEconomieHex(
  hex: HexNode,
  studio?: AzgaarWorldState,
  posMonde?: { x: number; y: number }
): HexNode {
  if (hex.estEau) {
    return {
      ...hex,
      ressourcePrincipale: hex.ressourcePrincipale || 'POISSON_SEL',
      specialiteEconomique: hex.specialiteEconomique || 'Eaux poissonneuses',
      soldeVivres: hex.soldeVivres ?? 20,
      soldeMinerai: hex.soldeMinerai ?? 0,
    };
  }

  // Correspondance avec des nœuds de ressource Azgaar proches
  if (studio?.resources && posMonde) {
    const proches = studio.resources
      .filter(r => Math.hypot(r.x - posMonde.x, r.y - posMonde.y) <= 58)
      .sort((a, b) => Math.hypot(a.x - posMonde.x, a.y - posMonde.y) - Math.hypot(b.x - posMonde.x, b.y - posMonde.y));
    if (proches.length > 0 && !hex.ressourcePrincipale) {
      hex.ressourcePrincipale = proches[0].type;
      hex.ressourcesDetail = proches.slice(0, 3).map(r => ({
        type: r.type,
        richesse: r.richesse,
        reserve: r.reserve,
      }));
    }
  }

  if (!hex.ressourcePrincipale) {
    if (hex.pointInteret?.type === 'mine' || hex.id.includes('mine')) {
      hex.ressourcePrincipale = 'FER';
    } else if (hex.estRivage) {
      hex.ressourcePrincipale = 'POISSON_SEL';
    } else if (hex.terrain === 'Montagne Escarpée') {
      hex.ressourcePrincipale = (hex.altitude ?? 70) >= 82 ? 'OR' : 'PIERRE';
    } else if (hex.terrain === 'Forêt Dense') {
      hex.ressourcePrincipale = 'BOIS';
    } else if (hex.terrain === 'Marais Fétide') {
      hex.ressourcePrincipale = 'HERBES_ARCANES';
    } else if (hex.terrain === 'Désert Aride') {
      hex.ressourcePrincipale = 'PIERRE';
    } else {
      hex.ressourcePrincipale = (hex.fluxHydro ?? 20) >= 24 ? 'CEREALES' : 'ELEVAGE';
    }
  }

  if (!hex.ressourcesDetail || hex.ressourcesDetail.length === 0) {
    hex.ressourcesDetail = [
      {
        type: hex.ressourcePrincipale,
        richesse: hex.pointInteret?.type === 'mine' ? 4 : hex.pointInteret?.type === 'bourgade' ? 3 : 2,
        reserve: 80,
      },
    ];
  }

  if (!hex.specialiteEconomique) {
    const bourgMatch = studio?.burgs.find(b => b.hexId === hex.id);
    hex.specialiteEconomique = bourgMatch?.specialisation || RESSOURCES_CATALOGUE[hex.ressourcePrincipale].unitLabel;
  }

  if (typeof hex.soldeVivres !== 'number') {
    const estProducteurVivres =
      hex.ressourcePrincipale === 'CEREALES' ||
      hex.ressourcePrincipale === 'ELEVAGE' ||
      hex.ressourcePrincipale === 'POISSON_SEL';
    hex.soldeVivres = hex.pointInteret?.type === 'bourgade' ? 68 : estProducteurVivres ? 72 : 42;
  }
  if (typeof hex.soldeMinerai !== 'number') {
    const estProducteurMinerai = hex.ressourcePrincipale === 'FER' || hex.ressourcePrincipale === 'OR' || hex.ressourcePrincipale === 'PIERRE';
    hex.soldeMinerai = estProducteurMinerai ? 78 : hex.pointInteret?.type === 'bourgade' ? 46 : 25;
  }

  return hex;
}
