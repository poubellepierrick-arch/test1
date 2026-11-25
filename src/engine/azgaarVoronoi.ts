import Delaunator from 'delaunator';
import {
  AzgaarBridgeFeature,
  AzgaarBurgDef,
  AzgaarClimateBias,
  AzgaarCoatCharge,
  AzgaarCoatDivision,
  AzgaarCoatOfArms,
  AzgaarCultureStudioDef,
  AzgaarDiplomacyStatus,
  AzgaarGenerationCounts,
  AzgaarLayerKey,
  AzgaarMarkerDef,
  AzgaarOceanLabelDef,
  AzgaarProvinceDef,
  AzgaarReconstructedGeometry,
  AzgaarReliefPreset,
  AzgaarReliefSymbol,
  AzgaarReligionDef,
  AzgaarRiverStudioDef,
  AzgaarRouteStudioDef,
  AzgaarSeaMonsterFeature,
  AzgaarShipFeature,
  AzgaarStateDef,
  AzgaarStylePreset,
  AzgaarTemplateId,
  AzgaarVoronoiCell,
  AzgaarWaterfallFeature,
  AzgaarWorldState,
  CampaignArc,
  Faction,
  GmSecretNote,
  GraphEdge,
  GraphNode,
  HexNode,
  SecurityLevel,
  SimulationState,
  TerrainType,
  WorldEntity,
} from '../types';
import { createSeededRng } from '../utils/prng';
import { calculerDistanceHex } from './hexcrawl';
import { INITIAL_SIMULATION_STATE } from './initialData';
import { genererEconomieEtRessourcesAzgaar, hydraterEconomieHex } from './worldEconomy';
import { calculerItinerairePondere } from './worldGeography';
import { synchroniserControleFactions } from './worldSim';
import {
  genererLoreProcedural,
  genererPnjsProcedural,
  reconcilierProximitePnjs,
} from './worldLoreAndNpcs';

export interface BiomeDefinition {
  id: number;
  name: string;
  color: string;
  terrain: TerrainType;
}

export const AZGAAR_BIOMES: BiomeDefinition[] = [
  { id: 0, name: 'Océan', color: '#537391', terrain: 'Plaine / Route' },
  { id: 1, name: 'Mer côtière', color: '#7fa1bc', terrain: 'Plaine / Route' },
  { id: 2, name: 'Désert chaud', color: '#e6c88a', terrain: 'Désert Aride' },
  { id: 3, name: 'Savane', color: '#d7cf7f', terrain: 'Plaine / Route' },
  { id: 4, name: 'Prairie tempérée', color: '#b7cf86', terrain: 'Plaine / Route' },
  { id: 5, name: 'Forêt tempérée', color: '#769f62', terrain: 'Forêt Dense' },
  { id: 6, name: 'Forêt humide', color: '#4d7c49', terrain: 'Forêt Dense' },
  { id: 7, name: 'Taïga boréale', color: '#5c7e6c', terrain: 'Forêt Dense' },
  { id: 8, name: 'Toundra', color: '#aeb9a6', terrain: 'Montagne Escarpée' },
  { id: 9, name: 'Marécages', color: '#7a8c72', terrain: 'Marais Fétide' },
  { id: 10, name: 'Haute montagne', color: '#9c968d', terrain: 'Montagne Escarpée' },
];

export const AZGAAR_TEMPLATES: Array<{ id: AzgaarTemplateId; label: string }> = [
  { id: 'continent', label: 'Continent' },
  { id: 'archipel', label: 'Archipel' },
  { id: 'peninsule', label: 'Péninsule' },
  { id: 'mediterranee', label: 'Mer intérieure' },
  { id: 'detroit', label: 'Détroit' },
  { id: 'volcan', label: 'Île volcanique' },
  { id: 'haute_chaine', label: 'Haute chaîne' },
];

export const AZGAAR_STYLE_PRESETS: Record<
  AzgaarStylePreset,
  {
    label: string;
    oceanDeep: string;
    oceanShallow: string;
    coastStroke: string;
    coastGlow: string;
    landTint: string;
    riverColor: string;
    roadColor: string;
    seaLaneColor: string;
    textColor: string;
    bgPaper: string;
    borderDark: string;
  }
> = {
  classique: {
    label: 'Azgaar Classique',
    oceanDeep: '#486886',
    oceanShallow: '#7195b0',
    coastStroke: '#293a4a',
    coastGlow: '#9ec0d6',
    landTint: '#d8cfa9',
    riverColor: '#3a72a8',
    roadColor: '#6f4222',
    seaLaneColor: '#255078',
    textColor: '#1f1712',
    bgPaper: '#dfe7ee',
    borderDark: '#3f2e21',
  },
  parchemin: {
    label: 'Parchemin Ancien',
    oceanDeep: '#c8be9f',
    oceanShallow: '#d8cfB5',
    coastStroke: '#574229',
    coastGlow: '#e7dec4',
    landTint: '#e9dfc2',
    riverColor: '#647d86',
    roadColor: '#754325',
    seaLaneColor: '#695c48',
    textColor: '#2b1d10',
    bgPaper: '#e7dec5',
    borderDark: '#4f3a21',
  },
  politique: {
    label: 'Atlas Politique',
    oceanDeep: '#6a86a1',
    oceanShallow: '#8ea8bf',
    coastStroke: '#24313f',
    coastGlow: '#b8cde0',
    landTint: '#ece7d8',
    riverColor: '#487aa1',
    roadColor: '#5c3c28',
    seaLaneColor: '#234366',
    textColor: '#141210',
    bgPaper: '#dde5ec',
    borderDark: '#261e18',
  },
  relief: {
    label: 'Relief Hypsométrique',
    oceanDeep: '#395775',
    oceanShallow: '#688ead',
    coastStroke: '#1d2d3d',
    coastGlow: '#96bad1',
    landTint: '#c9bf93',
    riverColor: '#2b67a1',
    roadColor: '#5e3418',
    seaLaneColor: '#1c446b',
    textColor: '#1a1510',
    bgPaper: '#ccd8e3',
    borderDark: '#2c2219',
  },
  sombre: {
    label: 'Encre Nocturne',
    oceanDeep: '#1d2836',
    oceanShallow: '#2b3b4e',
    coastStroke: '#8fa9bf',
    coastGlow: '#3b5069',
    landTint: '#363b33',
    riverColor: '#6aa4d6',
    roadColor: '#c99c63',
    seaLaneColor: '#7eb2de',
    textColor: '#f0e6d2',
    bgPaper: '#18202b',
    borderDark: '#b38d52',
  },
};

export const DEFAULT_AZGAAR_LAYERS: Record<AzgaarLayerKey, boolean> = {
  ocean: true,
  relief: true,
  biomes: true,
  etats: true,
  provinces: false,
  cultures: false,
  religions: false,
  rivieres: true,
  routes: true,
  routesMaritimes: true,
  frontieres: true,
  bourgs: true,
  blasons: true,
  marqueurs: true,
  vents: false,
  ressources: true,
  fluxCommerciaux: true,
  etiquettes: true,
  grille: false,
};

const STATE_PALETTE = [
  '#b84a39',
  '#3f6e9c',
  '#56854c',
  '#9e7331',
  '#7b5294',
  '#2f827c',
  '#a64d6d',
];

const CULTURE_PALETTE = [
  '#c9964c',
  '#5e8b7e',
  '#8c5f7c',
  '#6a7da8',
  '#9c7458',
  '#6d9452',
];

const RELIGION_PALETTE = [
  '#d19a38',
  '#4f86b8',
  '#4e8f61',
  '#a64b67',
  '#8162a8',
];

const NOMS_MONDES = [
  'Terres d\'Eldoria',
  'Royaumes de Valenor',
  'Confins d\'Oremor',
  'Archipel de Brumeval',
  'Empire d\'Arken',
  'Côtes d\'Iverne',
  'Marches de Solombre',
];

const NOMS_ETATS = [
  'Royaume de Valmont',
  'Ligue de Port-Clair',
  'Principauté d\'Arken',
  'Duché de Brumeval',
  'Confédération du Levant',
  'Margrave d\'Iverne',
  'République des Isles',
];

const GOUVERNEMENTS = [
  'Monarchie féodale',
  'Ligue marchande',
  'Principauté élective',
  'Duché souverain',
  'République maritime',
  'Théocratie militaire',
];

const NOMS_PROVINCES = [
  'Haute-Marche',
  'Val-Serein',
  'Côte d\'Écume',
  'Comté du Gué',
  'Terres Grises',
  'Baie d\'Or',
  'Monts Froids',
  'Plaine Royale',
  'Bassin d\'Argent',
  'Marche du Ponant',
  'Cap des Brumes',
  'Val d\'Émeraude',
  'Duché Bas',
  'Passe du Nord',
  'Fief des Chênes',
  'Portes du Couchant',
];

const NOMS_CULTURES: Array<{ name: string; type: AzgaarCultureStudioDef['type'] }> = [
  { name: 'Valmoriens', type: 'Urbaine' },
  { name: 'Havreois', type: 'Maritime' },
  { name: 'Crêtois', type: 'Montagnarde' },
  { name: 'Sylvains', type: 'Sylvestre' },
  { name: 'Sablons', type: 'Nomade' },
  { name: 'Brumois', type: 'Maritime' },
];

const NOMS_RELIGIONS: Array<{ name: string; type: AzgaarReligionDef['type']; deity: string }> = [
  { name: 'Église du Soleil d\'Or', type: 'Monotheisme', deity: 'Aureon' },
  { name: 'Panthéon des Quatre Vents', type: 'Pantheon', deity: 'Les Quatre Sœurs' },
  { name: 'Cercle des Vieux Chênes', type: 'Culte naturel', deity: 'Sylvara' },
  { name: 'Ordre de l\'Ancre Sainte', type: 'Pantheon', deity: 'Thalassor' },
  { name: 'Veille des Cendres', type: 'Heresie', deity: 'Le Veilleur' },
];

const NOMS_BOURGS = [
  'Val-Clair',
  'Port-Royal',
  'Hauteforge',
  'Sombremont',
  'Bourg-le-Gué',
  'Roche-Blanche',
  'Havre-Gris',
  'Pont-d\'Or',
  'Vieux-Chêne',
  'Cap-Brume',
  'Mont-Faucon',
  'Beaupré',
  'Castel-Fer',
  'Gué-du-Roi',
  'Rive-Neuve',
  'Éperon',
  'Val-d\'Orge',
  'Tour-Blanche',
  'Bastion-Vert',
  'Anse-Sèche',
  'Clairbois',
  'Croisée-Haute',
  'Port-du-Sel',
  'Col-du-Vent',
  'Moulin-Bas',
  'Roc-Noir',
  'Saint-Aube',
  'Terre-Douce',
  'Fort-Lointain',
  'Gué-d\'Argent',
];

const NOMS_RIVIERES = [
  'La Claire',
  'L\'Argente',
  'La Grise',
  'La Sèvre',
  'La Brumeuse',
  'L\'Aigue',
  'Le Torrent d\'Ocre',
  'Le Ru du Nord',
  'La Dorée',
  'La Froidure',
];

const NOMS_MERS = [
  'Mer des Brumes',
  'Océan du Couchant',
  'Golfe d\'Ardoise',
  'Mer Intérieure',
  'Détroit du Levant',
];

const COAT_DIVISIONS: AzgaarCoatDivision[] = ['uni', 'parti', 'coupe', 'ecartele', 'chevron', 'pal'];
const COAT_CHARGES: AzgaarCoatCharge[] = [
  'tour',
  'epee',
  'couronne',
  'lion',
  'ancre',
  'soleil',
  'lune',
  'arbre',
  'etoile',
  'bouclier',
];
const COAT_TINCTURES = ['#9e2a2b', '#1d3557', '#2d6a4f', '#5a189a', '#2b2d42', '#8c5a18'];
const COAT_METALS = ['#f3d37a', '#f5f1e6'];

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function hashCoord(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function smoothNoise2D(x: number, y: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hashCoord(xi, yi, seed);
  const b = hashCoord(xi + 1, yi, seed);
  const c = hashCoord(xi, yi + 1, seed);
  const d = hashCoord(xi + 1, yi + 1, seed);
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}

function fbmNoise(x: number, y: number, seed: number): number {
  return (
    smoothNoise2D(x, y, seed) * 0.56 +
    smoothNoise2D(x * 2.1, y * 2.1, seed + 101) * 0.28 +
    smoothNoise2D(x * 4.3, y * 4.3, seed + 202) * 0.16
  );
}

export function genererBlasonDeterministe(
  rng: () => number,
  preferredColor?: string
): AzgaarCoatOfArms {
  const fieldColor = preferredColor || COAT_TINCTURES[Math.floor(rng() * COAT_TINCTURES.length)];
  const secondaryColor =
    rng() < 0.5
      ? COAT_METALS[Math.floor(rng() * COAT_METALS.length)]
      : COAT_TINCTURES[Math.floor(rng() * COAT_TINCTURES.length)];
  const division = COAT_DIVISIONS[Math.floor(rng() * COAT_DIVISIONS.length)];
  const charge = COAT_CHARGES[Math.floor(rng() * COAT_CHARGES.length)];
  const chargeColor = COAT_METALS[Math.floor(rng() * COAT_METALS.length)];
  return { fieldColor, secondaryColor, division, charge, chargeColor };
}

/** Clipping Sutherland-Hodgman sur le rectangle [0..w, 0..h] */
function clipPolygonRect(poly: Array<[number, number]>, w: number, h: number): Array<[number, number]> {
  const clipEdge = (
    pts: Array<[number, number]>,
    inside: (p: [number, number]) => boolean,
    intersect: (a: [number, number], b: [number, number]) => [number, number]
  ): Array<[number, number]> => {
    if (pts.length === 0) return [];
    const out: Array<[number, number]> = [];
    for (let i = 0; i < pts.length; i++) {
      const curr = pts[i];
      const prev = pts[(i + pts.length - 1) % pts.length];
      const currIn = inside(curr);
      const prevIn = inside(prev);
      if (currIn) {
        if (!prevIn) out.push(intersect(prev, curr));
        out.push(curr);
      } else if (prevIn) {
        out.push(intersect(prev, curr));
      }
    }
    return out;
  };

  let res = poly;
  res = clipEdge(
    res,
    p => p[0] >= 0,
    (a, b) => {
      const t = (0 - a[0]) / (b[0] - a[0] || 1e-9);
      return [0, a[1] + t * (b[1] - a[1])];
    }
  );
  res = clipEdge(
    res,
    p => p[0] <= w,
    (a, b) => {
      const t = (w - a[0]) / (b[0] - a[0] || 1e-9);
      return [w, a[1] + t * (b[1] - a[1])];
    }
  );
  res = clipEdge(
    res,
    p => p[1] >= 0,
    (a, b) => {
      const t = (0 - a[1]) / (b[1] - a[1] || 1e-9);
      return [a[0] + t * (b[0] - a[0]), 0];
    }
  );
  res = clipEdge(
    res,
    p => p[1] <= h,
    (a, b) => {
      const t = (h - a[1]) / (b[1] - a[1] || 1e-9);
      return [a[0] + t * (b[0] - a[0]), h];
    }
  );
  return res;
}

function circumcenter(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number
): [number, number] {
  const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
  if (Math.abs(d) < 1e-6) {
    return [(ax + bx + cx) / 3, (ay + by + cy) / 3];
  }
  const a2 = ax * ax + ay * ay;
  const b2 = bx * bx + by * by;
  const c2 = cx * cx + cy * cy;
  const ux = (a2 * (by - cy) + b2 * (cy - ay) + c2 * (ay - by)) / d;
  const uy = (a2 * (cx - bx) + b2 * (ax - cx) + c2 * (bx - ax)) / d;
  return [ux, uy];
}

interface RawVoronoiMesh {
  interiorCount: number;
  points: Array<[number, number]>;
  polygons: Array<Array<[number, number]>>;
  neighbors: number[][];
  sharedEdges: Map<string, [[number, number], [number, number]]>;
}

function construireMaillageVoronoi(
  width: number,
  height: number,
  cellsDesired: number,
  seed: number,
  customPoints?: Array<[number, number]>
): RawVoronoiMesh {
  const rng = createSeededRng(seed);
  let interiorPoints: Array<[number, number]>;
  const spacing = Math.sqrt((width * height) / Math.max(200, cellsDesired));

  if (customPoints && customPoints.length > 20) {
    interiorPoints = customPoints.map(p => [clamp(p[0], 1, width - 1), clamp(p[1], 1, height - 1)]);
  } else {
    interiorPoints = [];
    for (let y = spacing * 0.5; y < height; y += spacing) {
      for (let x = spacing * 0.5; x < width; x += spacing) {
        const jx = clamp(x + (rng() - 0.5) * spacing * 0.78, 2, width - 2);
        const jy = clamp(y + (rng() - 0.5) * spacing * 0.78, 2, height - 2);
        interiorPoints.push([jx, jy]);
      }
    }
  }

  // Anneau de points fantômes extérieurs pour garantir des cellules fermées sans arêtes infinies
  const margin = Math.max(36, spacing * 1.4);
  const ghostPoints: Array<[number, number]> = [];
  for (let x = -margin; x <= width + margin; x += spacing * 1.1) {
    ghostPoints.push([x, -margin]);
    ghostPoints.push([x, height + margin]);
  }
  for (let y = 0; y <= height; y += spacing * 1.1) {
    ghostPoints.push([-margin, y]);
    ghostPoints.push([width + margin, y]);
  }

  const buildMesh = (pts: Array<[number, number]>): RawVoronoiMesh => {
    const interiorCount = pts.length;
    const allPts = [...pts, ...ghostPoints];
    const flat = new Float64Array(allPts.length * 2);
    for (let i = 0; i < allPts.length; i++) {
      flat[i * 2] = allPts[i][0];
      flat[i * 2 + 1] = allPts[i][1];
    }
    const del = new Delaunator(flat);
    const numTri = del.triangles.length / 3;
    const triCenters: Array<[number, number]> = new Array(numTri);
    for (let t = 0; t < numTri; t++) {
      const i0 = del.triangles[t * 3];
      const i1 = del.triangles[t * 3 + 1];
      const i2 = del.triangles[t * 3 + 2];
      triCenters[t] = circumcenter(
        allPts[i0][0],
        allPts[i0][1],
        allPts[i1][0],
        allPts[i1][1],
        allPts[i2][0],
        allPts[i2][1]
      );
    }

    // Indexer une arête entrante par point intérieur
    const edgeByPoint = new Int32Array(interiorCount).fill(-1);
    for (let e = 0; e < del.triangles.length; e++) {
      const p = del.triangles[e];
      if (p < interiorCount && edgeByPoint[p] === -1) {
        edgeByPoint[p] = e;
      }
    }

    const polygons: Array<Array<[number, number]>> = new Array(interiorCount);
    const neighbors: number[][] = new Array(interiorCount);
    const sharedEdges = new Map<string, [[number, number], [number, number]]>();

    const nextHalfedge = (e: number) => (e % 3 === 2 ? e - 2 : e + 1);
    const prevHalfedge = (e: number) => (e % 3 === 0 ? e + 2 : e - 1);

    for (let p = 0; p < interiorCount; p++) {
      const startEdge = edgeByPoint[p];
      if (startEdge === -1) {
        polygons[p] = [];
        neighbors[p] = [];
        continue;
      }

      const rawPoly: Array<[number, number]> = [];
      const neighList: number[] = [];
      let e = startEdge;
      let guard = 0;

      do {
        const tri = Math.floor(e / 3);
        const oppTriEdge = del.halfedges[e];
        const nextVert = del.triangles[nextHalfedge(e)];
        if (nextVert < interiorCount) {
          neighList.push(nextVert);
          if (oppTriEdge !== -1) {
            const triB = Math.floor(oppTriEdge / 3);
            const key = p < nextVert ? `${p}_${nextVert}` : `${nextVert}_${p}`;
            if (!sharedEdges.has(key)) {
              const aPt: [number, number] = [
                clamp(triCenters[tri][0], 0, width),
                clamp(triCenters[tri][1], 0, height),
              ];
              const bPt: [number, number] = [
                clamp(triCenters[triB][0], 0, width),
                clamp(triCenters[triB][1], 0, height),
              ];
              sharedEdges.set(key, [aPt, bPt]);
            }
          }
        }
        rawPoly.push(triCenters[tri]);
        const prev = prevHalfedge(e);
        const twin = del.halfedges[prev];
        if (twin === -1) break;
        e = twin;
        guard++;
      } while (e !== startEdge && guard < 24);

      polygons[p] = clipPolygonRect(rawPoly, width, height);
      neighbors[p] = Array.from(new Set(neighList));
    }

    return {
      interiorCount,
      points: pts,
      polygons,
      neighbors,
      sharedEdges,
    };
  };

  // Une passe de relaxation de Lloyd pour des cellules organiques régulières (signature Azgaar FMG)
  const pass1 = buildMesh(interiorPoints);
  if (!customPoints) {
    const relaxed: Array<[number, number]> = pass1.points.map((pt, i) => {
      const poly = pass1.polygons[i];
      if (!poly || poly.length < 3) return pt;
      let sx = 0;
      let sy = 0;
      for (const v of poly) {
        sx += v[0];
        sy += v[1];
      }
      return [
        clamp(sx / poly.length, 2, width - 2),
        clamp(sy / poly.length, 2, height - 2),
      ];
    });
    return buildMesh(relaxed);
  }

  return pass1;
}

function calculerAltitudeCellule(
  nx: number,
  ny: number,
  seed: number,
  template: AzgaarTemplateId
): number {
  const dx = nx - 0.5;
  const dy = ny - 0.5;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const fbm = fbmNoise(nx * 5.2, ny * 3.8, seed);
  const detail = fbmNoise(nx * 10.5, ny * 7.8, seed + 555) * 0.25;

  let base = 0;
  switch (template) {
    case 'continent': {
      const falloff = Math.max(0, 1 - Math.pow(dist / 0.52, 2.2));
      base = 12 + falloff * 52 + (fbm - 0.45) * 58 + detail * 28;
      break;
    }
    case 'archipel': {
      const isl = fbmNoise(nx * 7.6, ny * 5.8, seed + 77);
      const falloff = Math.max(0, 1 - Math.pow(dist / 0.58, 2.6));
      base = 4 + falloff * 24 + (isl - 0.48) * 92 + detail * 26;
      break;
    }
    case 'peninsule': {
      const westAttach = Math.max(0, 1 - nx * 1.15);
      const northSouth = Math.max(0, 1 - Math.abs(dy) * 2.1);
      base = 10 + westAttach * 44 + northSouth * 20 + (fbm - 0.46) * 56 + detail * 24;
      break;
    }
    case 'mediterranee': {
      const ring = 1 - Math.abs(dist - 0.34) / 0.24;
      base = 12 + Math.max(-0.5, ring) * 48 + (fbm - 0.46) * 50 + detail * 22;
      break;
    }
    case 'detroit': {
      const canal = Math.exp(-Math.pow((nx - 0.5 + (fbm - 0.5) * 0.22) / 0.14, 2));
      const edgeFalloff = Math.max(0, 1 - Math.pow(dist / 0.62, 2.8));
      base = 24 + edgeFalloff * 38 - canal * 46 + (fbm - 0.45) * 44 + detail * 22;
      break;
    }
    case 'volcan': {
      const peak = Math.exp(-Math.pow(dist / 0.24, 2)) * 84;
      base = 5 + peak + (fbm - 0.48) * 34 + detail * 20;
      break;
    }
    case 'haute_chaine': {
      const ridge = Math.exp(-Math.pow((dy - (fbm - 0.5) * 0.32) / 0.19, 2)) * 68;
      const edgeDrop = Math.max(0, 1 - Math.pow(Math.abs(dx) / 0.52, 2.5));
      base = 10 + ridge * edgeDrop + (fbm - 0.45) * 48 + detail * 28;
      break;
    }
  }

  // Pousser les bords extrêmes sous l'eau sauf pour péninsule/détroit
  if (template !== 'peninsule' && template !== 'detroit') {
    const borderDist = Math.min(nx, 1 - nx, ny, 1 - ny);
    if (borderDist < 0.08) {
      base -= (0.08 - borderDist) * 220;
    }
  }

  return clamp(Math.round(base), 2, 99);
}

function classifierBiome(
  h: number,
  seaLevel: number,
  isShallow: boolean,
  temp: number,
  precip: number
): number {
  if (h < seaLevel) {
    return isShallow ? 1 : 0;
  }
  if (h >= 76) return 10; // Haute montagne
  if (temp <= 1) return 8; // Toundra
  if (temp <= 6) {
    return precip >= 42 ? 7 : 8; // Taïga ou Toundra
  }
  if (h < seaLevel + 5 && precip >= 62 && temp >= 8) {
    return 9; // Marécages côtiers / delta
  }
  if (temp >= 20) {
    if (precip < 28) return 2; // Désert chaud
    if (precip < 52) return 3; // Savane
    return 6; // Forêt humide
  }
  if (precip < 32) return 2; // Désert / Aride
  if (precip < 50) return 4; // Prairie tempérée
  if (precip < 74) return 5; // Forêt tempérée
  return 6; // Forêt humide
}

/**
 * Reconstruit déterministement toute la géométrie Voronoï, le climat, les côtes
 * et les frontières politiques à partir d'un AzgaarWorldState compact.
 */
export function reconstruireAtlasComplet(world: AzgaarWorldState): AzgaarReconstructedGeometry {
  const customPts =
    world.importedCells && world.importedCells.length > 20
      ? world.importedCells.map(c => [c.x, c.y] as [number, number])
      : undefined;

  const mesh = construireMaillageVoronoi(
    world.width,
    world.height,
    world.cellsDesired,
    world.seed,
    customPts
  );

  const n = mesh.interiorCount;
  const rad = (world.windAngle * Math.PI) / 180;
  const wx = Math.cos(rad);
  const wy = Math.sin(rad);

  const cells: AzgaarVoronoiCell[] = new Array(n);

  // Passe 1 : Altitude & Terre/Mer
  for (let i = 0; i < n; i++) {
    const [x, y] = mesh.points[i];
    const nx = x / world.width;
    const ny = y / world.height;
    const imported = world.importedCells?.[i];
    const hRaw = imported
      ? imported.h
      : calculerAltitudeCellule(nx, ny, world.seed, world.template);
    const hOverride = world.overrides.height?.[i];
    const h = hOverride !== undefined ? clamp(hOverride, 1, 99) : hRaw;

    cells[i] = {
      index: i,
      x,
      y,
      polygon: mesh.polygons[i],
      neighbors: mesh.neighbors[i],
      h,
      isLand: h >= world.seaLevel,
      isCoast: false,
      isShallow: false,
      temp: 12,
      precip: 48,
      flux: 0,
      biome: 0,
      stateId: imported ? imported.state : 0,
      provinceId: imported ? imported.province : 0,
      cultureId: imported ? imported.culture : 0,
      religionId: imported ? imported.religion : 0,
    };
  }

  // Passe 2 : Côtes, Hauts-fonds, Climat (Vents + Ombre pluviométrique) & Biomes
  const biasTemp = world.climateBias === 'boreal' ? -7 : world.climateBias === 'aride' ? 7 : 0;
  const biasPrecip = world.climateBias === 'aride' ? -18 : world.climateBias === 'boreal' ? -4 : 6;

  for (let i = 0; i < n; i++) {
    const c = cells[i];
    if (c.isLand) {
      c.isCoast = c.neighbors.some(nb => !cells[nb].isLand);
    } else {
      c.isShallow = c.neighbors.some(nb => cells[nb].isLand);
    }

    const latNorm = Math.abs(c.y / world.height - 0.5) * 2; // 0 équateur, 1 pôles
    const altDrop = c.isLand ? Math.max(0, c.h - world.seaLevel) * 0.19 : 0;
    const tempBase = 23 - latNorm * 18 + biasTemp - altDrop;
    c.temp = Math.round(clamp(tempBase, -10, 38));

    // Échantillonnage amont le long du vecteur de vent pour ombre pluviométrique
    let rainShadow = 0;
    const backX = c.x - wx * 48;
    const backY = c.y - wy * 48;
    if (backX >= 0 && backX <= world.width && backY >= 0 && backY <= world.height) {
      const hAmont = calculerAltitudeCellule(
        backX / world.width,
        backY / world.height,
        world.seed,
        world.template
      );
      if (hAmont > 64) {
        rainShadow = (hAmont - 64) * 0.65;
      }
    }

    const coastBonus = c.isCoast ? 16 : c.neighbors.some(nb => cells[nb].isCoast) ? 8 : 0;
    const precipNoise = (fbmNoise((c.x / world.width) * 4, (c.y / world.height) * 4, world.seed + 303) - 0.45) * 38;
    c.precip = Math.round(clamp(46 + biasPrecip + coastBonus + precipNoise - rainShadow, 5, 98));
    c.flux = c.isLand ? Math.max(4, Math.round(c.precip * 0.35 + (c.h > 55 ? 12 : 0))) : 0;

    const biomeAuto = classifierBiome(c.h, world.seaLevel, c.isShallow, c.temp, c.precip);
    const biomeOver = world.overrides.biome?.[i];
    c.biome =
      biomeOver !== undefined
        ? biomeOver
        : world.importedCells?.[i]
          ? world.importedCells[i].biome
          : biomeAuto;
  }

  // Passe 3 : Assignation Voronoï des Cultures, Religions, États & Provinces si carte procédurale
  if (!world.importedCells || world.importedCells.length === 0) {
    // 3a. Cultures par distance au foyer culturel (Voronoï pondéré par biome/mer)
    if (world.cultures.length > 0) {
      for (let i = 0; i < n; i++) {
        const c = cells[i];
        if (!c.isLand) continue;
        let bestId = world.cultures[0].id;
        let bestDist = Infinity;
        for (const cul of world.cultures) {
          const origin = cells[clamp(cul.centerCell, 0, n - 1)];
          const d = Math.hypot(c.x - origin.x, c.y - origin.y) * (c.h > 68 ? 1.25 : 1);
          if (d < bestDist) {
            bestDist = d;
            bestId = cul.id;
          }
        }
        c.cultureId = bestId;
      }
    }

    // 3b. Religions
    if (world.religions.length > 0) {
      for (let i = 0; i < n; i++) {
        const c = cells[i];
        if (!c.isLand) continue;
        let bestId = world.religions[0].id;
        let bestDist = Infinity;
        for (const rel of world.religions) {
          const origin = cells[clamp(rel.centerCell, 0, n - 1)];
          const d = Math.hypot(c.x - origin.x, c.y - origin.y);
          if (d < bestDist) {
            bestDist = d;
            bestId = rel.id;
          }
        }
        c.religionId = bestId;
      }
    }

    // 3c. États (centre = capitale de l'État, distance pondérée par montagnes & mers)
    const stateCapCells = world.states.map(s => {
      const capBurg = world.burgs.find(b => b.id === s.capitalBurgId);
      const cellIdx = capBurg ? clamp(capBurg.cell, 0, n - 1) : 0;
      return { state: s, origin: cells[cellIdx] };
    });

    if (stateCapCells.length > 0) {
      for (let i = 0; i < n; i++) {
        const c = cells[i];
        if (!c.isLand) continue;
        let bestStateId = 0;
        let bestDist = Infinity;
        for (const sc of stateCapCells) {
          const rawDist = Math.hypot(c.x - sc.origin.x, c.y - sc.origin.y);
          const penalty = (c.h > 70 ? 1.38 : 1.0) * (c.cultureId === sc.state.cultureId ? 0.88 : 1.08);
          const d = rawDist * penalty;
          if (d < bestDist) {
            bestDist = d;
            bestStateId = sc.state.id;
          }
        }
        // Petites îles très isolées peuvent rester neutres si loin de toute capitale
        c.stateId = bestDist < world.width * 0.42 ? bestStateId : 0;
      }
    }

    // 3d. Provinces à l'intérieur de chaque État
    if (world.provinces.length > 0) {
      for (let i = 0; i < n; i++) {
        const c = cells[i];
        if (!c.isLand || c.stateId === 0) continue;
        const stateProvs = world.provinces.filter(p => p.stateId === c.stateId);
        if (stateProvs.length === 0) continue;
        let bestProvId = stateProvs[0].id;
        let bestDist = Infinity;
        for (const p of stateProvs) {
          const origin = cells[clamp(p.centerCell, 0, n - 1)];
          const d = Math.hypot(c.x - origin.x, c.y - origin.y);
          if (d < bestDist) {
            bestDist = d;
            bestProvId = p.id;
          }
        }
        c.provinceId = bestProvId;
      }
    }
  }

  // Appliquer les overrides utilisateur & IA MJ par-dessus
  for (let i = 0; i < n; i++) {
    const c = cells[i];
    if (world.overrides.state?.[i] !== undefined) c.stateId = world.overrides.state[i];
    if (world.overrides.province?.[i] !== undefined) c.provinceId = world.overrides.province[i];
    if (world.overrides.culture?.[i] !== undefined) c.cultureId = world.overrides.culture[i];
    if (world.overrides.religion?.[i] !== undefined) c.religionId = world.overrides.religion[i];
    if (!c.isLand) {
      c.stateId = 0;
      c.provinceId = 0;
    }
  }

  // Passe 4 : Extraction exacte des segments partagés (côtes & frontières d'États/provinces)
  const coastSegments: Array<[[number, number], [number, number]]> = [];
  const stateBordersMap = new Map<number, Array<[[number, number], [number, number]]>>();
  const provinceBorders: Array<[[number, number], [number, number]]> = [];

  for (const [key, seg] of mesh.sharedEdges.entries()) {
    const [aStr, bStr] = key.split('_');
    const ia = Number(aStr);
    const ib = Number(bStr);
    if (ia >= n || ib >= n) continue;
    const ca = cells[ia];
    const cb = cells[ib];

    if (ca.isLand !== cb.isLand) {
      coastSegments.push(seg);
    }
    if (ca.isLand && cb.isLand) {
      if (ca.stateId !== cb.stateId) {
        if (ca.stateId > 0) {
          if (!stateBordersMap.has(ca.stateId)) stateBordersMap.set(ca.stateId, []);
          stateBordersMap.get(ca.stateId)!.push(seg);
        }
        if (cb.stateId > 0) {
          if (!stateBordersMap.has(cb.stateId)) stateBordersMap.set(cb.stateId, []);
          stateBordersMap.get(cb.stateId)!.push(seg);
        }
      } else if (ca.provinceId !== cb.provinceId && (ca.provinceId > 0 || cb.provinceId > 0)) {
        provinceBorders.push(seg);
      }
    }
  }

  const stateBorders = Array.from(stateBordersMap.entries()).map(([stateId, segments]) => ({
    stateId,
    segments,
  }));

  // Centroïdes d'étiquettes d'États
  const stateLabels: Array<{ stateId: number; name: string; x: number; y: number; radius: number }> = [];
  for (const st of world.states) {
    const owned = cells.filter(c => c.isLand && c.stateId === st.id);
    if (owned.length === 0) continue;
    const sx = owned.reduce((acc, c) => acc + c.x, 0) / owned.length;
    const sy = owned.reduce((acc, c) => acc + c.y, 0) / owned.length;
    stateLabels.push({
      stateId: st.id,
      name: st.name,
      x: sx,
      y: sy,
      radius: Math.sqrt(owned.length) * 16,
    });
  }

  // Grille éparse de vecteurs de vent pour la couche Vents & Précipitations
  const windVectors: Array<{ x: number; y: number; dx: number; dy: number }> = [];
  for (let y = 90; y < world.height - 60; y += 130) {
    for (let x = 90; x < world.width - 60; x += 150) {
      windVectors.push({ x, y, dx: wx * 28, dy: wy * 28 });
    }
  }

  // Passe 5 : Décors dessinés à la main (Forêts, Montagnes, Marais, Dunes, Ponts, Cascades, Navires, Monstres marins)
  const decoRng = createSeededRng(world.seed ^ 0x9e3779b9);
  const reliefSymbols: AzgaarReliefSymbol[] = [];
  const burgClearance2 = 24 * 24;

  const isNearBurg = (px: number, py: number) =>
    world.burgs.some(b => (b.x - px) * (b.x - px) + (b.y - py) * (b.y - py) < burgClearance2);

  for (let i = 0; i < n; i++) {
    const c = cells[i];
    if (!c.isLand) continue;

    // Montagnes & pics ombrés
    if (c.h >= 62) {
      if (!isNearBurg(c.x, c.y)) {
        const count = c.h >= 78 ? 2 : 1;
        for (let k = 0; k < count; k++) {
          const ox = k === 0 ? (decoRng() - 0.5) * 6 : (decoRng() - 0.5) * 18;
          const oy = k === 0 ? (decoRng() - 0.5) * 6 : (decoRng() - 0.5) * 14;
          reliefSymbols.push({
            id: `az_m_${i}_${k}`,
            kind: c.h >= 73 && k === 0 ? 'mountain' : 'peak_small',
            x: Number(clamp(c.x + ox, 16, world.width - 16).toFixed(1)),
            y: Number(clamp(c.y + oy, 16, world.height - 16).toFixed(1)),
            scale: Number((0.68 + ((c.h - 60) / 40) * 0.42 + decoRng() * 0.14).toFixed(2)),
          });
        }
      }
      continue;
    }

    // Forêts denses (tempérée, humide, taïga)
    if (c.biome === 5 || c.biome === 6 || c.biome === 7) {
      const treesPerCell = c.biome === 6 ? 4 : 3;
      const spread = world.cellsDesired >= 2000 ? 11 : world.cellsDesired <= 900 ? 18 : 14;
      for (let k = 0; k < treesPerCell; k++) {
        const px = clamp(c.x + (decoRng() - 0.5) * spread * 1.8, 14, world.width - 14);
        const py = clamp(c.y + (decoRng() - 0.5) * spread * 1.6, 14, world.height - 14);
        if (isNearBurg(px, py)) continue;
        const kind =
          c.biome === 7 || (c.biome === 5 && decoRng() < 0.35) ? 'tree_pine' : 'tree_round';
        reliefSymbols.push({
          id: `az_f_${i}_${k}`,
          kind,
          x: Number(px.toFixed(1)),
          y: Number(py.toFixed(1)),
          scale: Number((0.64 + decoRng() * 0.34).toFixed(2)),
        });
      }
    } else if (c.biome === 9) {
      // Marais
      if (!isNearBurg(c.x, c.y) && decoRng() < 0.8) {
        reliefSymbols.push({
          id: `az_w_${i}`,
          kind: 'marsh',
          x: Number((c.x + (decoRng() - 0.5) * 10).toFixed(1)),
          y: Number((c.y + (decoRng() - 0.5) * 8).toFixed(1)),
          scale: Number((0.72 + decoRng() * 0.28).toFixed(2)),
        });
      }
    } else if (c.biome === 2) {
      // Désert : dunes & palmiers rares
      if (!isNearBurg(c.x, c.y) && decoRng() < 0.65) {
        reliefSymbols.push({
          id: `az_d_${i}`,
          kind: decoRng() < 0.14 ? 'palm' : 'dune',
          x: Number((c.x + (decoRng() - 0.5) * 12).toFixed(1)),
          y: Number((c.y + (decoRng() - 0.5) * 10).toFixed(1)),
          scale: Number((0.7 + decoRng() * 0.3).toFixed(2)),
        });
      }
    } else if (c.biome === 3) {
      // Savane : herbes hautes & arbres épars
      if (!isNearBurg(c.x, c.y) && decoRng() < 0.42) {
        reliefSymbols.push({
          id: `az_s_${i}`,
          kind: decoRng() < 0.35 ? 'palm' : 'grass',
          x: Number((c.x + (decoRng() - 0.5) * 12).toFixed(1)),
          y: Number((c.y + (decoRng() - 0.5) * 10).toFixed(1)),
          scale: Number((0.72 + decoRng() * 0.25).toFixed(2)),
        });
      }
    } else if (c.biome === 4 && decoRng() < 0.28 && !isNearBurg(c.x, c.y)) {
      // Prairie tempérée : bosquets rares et touffes d'herbe
      reliefSymbols.push({
        id: `az_p_${i}`,
        kind: decoRng() < 0.3 ? 'tree_round' : 'grass',
        x: Number((c.x + (decoRng() - 0.5) * 10).toFixed(1)),
        y: Number((c.y + (decoRng() - 0.5) * 10).toFixed(1)),
        scale: Number((0.68 + decoRng() * 0.24).toFixed(2)),
      });
    }
  }
  reliefSymbols.sort((a, b) => a.y - b.y);

  // Ponts aux croisements routes terrestres <-> rivières
  const bridges: AzgaarBridgeFeature[] = [];
  const segIntersect = (
    p1: [number, number],
    p2: [number, number],
    p3: [number, number],
    p4: [number, number]
  ): [number, number] | null => {
    const den = (p1[0] - p2[0]) * (p3[1] - p4[1]) - (p1[1] - p2[1]) * (p3[0] - p4[0]);
    if (Math.abs(den) < 1e-4) return null;
    const t = ((p1[0] - p3[0]) * (p3[1] - p4[1]) - (p1[1] - p3[1]) * (p3[0] - p4[0])) / den;
    const u = -((p1[0] - p2[0]) * (p1[1] - p3[1]) - (p1[1] - p2[1]) * (p1[0] - p3[0])) / den;
    if (t >= 0.05 && t <= 0.95 && u >= 0.05 && u <= 0.95) {
      return [p1[0] + t * (p2[0] - p1[0]), p1[1] + t * (p2[1] - p1[1])];
    }
    return null;
  };

  for (const rt of world.routes) {
    if (rt.kind === 'sea' || rt.points.length < 2) continue;
    for (let i = 0; i < rt.points.length - 1; i++) {
      const a = rt.points[i];
      const b = rt.points[i + 1];
      for (const rv of world.rivers) {
        for (let j = 0; j < rv.points.length - 1; j++) {
          const hit = segIntersect(a, b, rv.points[j], rv.points[j + 1]);
          if (hit) {
            const tooClose =
              isNearBurg(hit[0], hit[1]) ||
              bridges.some(br => Math.hypot(br.x - hit[0], br.y - hit[1]) < 26);
            if (!tooClose) {
              const angle = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
              bridges.push({
                id: `br_${rt.id}_${i}_${rv.id}_${j}`,
                x: Number(hit[0].toFixed(1)),
                y: Number(hit[1].toFixed(1)),
                angle: Number(angle.toFixed(1)),
              });
            }
          }
        }
      }
    }
  }

  // Cascades sur les ruptures de pente fluviales
  const waterfalls: AzgaarWaterfallFeature[] = [];
  for (const rv of world.rivers) {
    for (let i = 0; i < rv.cells.length - 1; i++) {
      const cA = cells[rv.cells[i]];
      const cB = cells[rv.cells[i + 1]];
      if (!cA || !cB) continue;
      if (cA.h - cB.h >= 10 || (cA.h >= 58 && cB.h <= 46)) {
        const mx = (cA.x + cB.x) / 2;
        const my = (cA.y + cB.y) / 2;
        if (!waterfalls.some(wf => Math.hypot(wf.x - mx, wf.y - my) < 38)) {
          waterfalls.push({
            id: `wf_${rv.id}_${i}`,
            x: Number(mx.toFixed(1)),
            y: Number(my.toFixed(1)),
          });
        }
      }
    }
  }

  // Navires le long des routes maritimes
  const ships: AzgaarShipFeature[] = [];
  const seaRoutes = world.routes.filter(r => r.kind === 'sea' && r.points.length >= 4);
  for (let i = 0; i < seaRoutes.length && ships.length < 5; i++) {
    const sr = seaRoutes[i];
    const midIdx = Math.floor(sr.points.length * 0.5);
    const pA = sr.points[Math.max(1, midIdx - 1)];
    const pB = sr.points[Math.min(sr.points.length - 2, midIdx)];
    if (!pA || !pB) continue;
    const sx = (pA[0] + pB[0]) / 2;
    const sy = (pA[1] + pB[1]) / 2;
    if (!ships.some(s => Math.hypot(s.x - sx, s.y - sy) < 95)) {
      const angle = (Math.atan2(pB[1] - pA[1], pB[0] - pA[0]) * 180) / Math.PI;
      ships.push({
        id: `ship_${sr.id}`,
        x: Number(sx.toFixed(1)),
        y: Number(sy.toFixed(1)),
        angle: Number(angle.toFixed(1)),
        scale: 0.9,
      });
    }
  }

  // Monstres marins gravés dans les eaux profondes
  const seaMonsters: AzgaarSeaMonsterFeature[] = [];
  const deepWater = cells.filter(
    c =>
      !c.isLand &&
      !c.isShallow &&
      c.x > 110 &&
      c.x < world.width - 110 &&
      c.y > 90 &&
      c.y < world.height - 90 &&
      !world.oceanLabels.some(ol => Math.hypot(ol.x - c.x, ol.y - c.y) < 95) &&
      !ships.some(sh => Math.hypot(sh.x - c.x, sh.y - c.y) < 85)
  );
  if (deepWater.length > 0) {
    const candidates = [
      deepWater[Math.floor(deepWater.length * 0.22)],
      deepWater[Math.floor(deepWater.length * 0.78)],
    ];
    candidates.forEach((cell, idx) => {
      if (!cell) return;
      if (seaMonsters.some(sm => Math.hypot(sm.x - cell.x, sm.y - cell.y) < 220)) return;
      seaMonsters.push({
        id: `sm_${idx}`,
        variant: idx % 2 === 0 ? 'serpent' : 'kraken',
        x: Number(cell.x.toFixed(1)),
        y: Number(cell.y.toFixed(1)),
        scale: 0.95,
      });
    });
  }

  return {
    cells,
    coastSegments,
    stateBorders,
    provinceBorders,
    stateLabels,
    windVectors,
    reliefSymbols,
    bridges,
    waterfalls,
    ships,
    seaMonsters,
  };
}

/** Routage A* / Dijkstra sur cellules Voronoï (terrestre ou maritime) */
export function calculerRouteVoronoi(
  cells: AzgaarVoronoiCell[],
  startIdx: number,
  endIdx: number,
  mode: 'land' | 'sea'
): Array<[number, number]> | null {
  const n = cells.length;
  if (startIdx < 0 || endIdx < 0 || startIdx >= n || endIdx >= n) return null;
  if (startIdx === endIdx) return [[cells[startIdx].x, cells[startIdx].y]];

  const dist = new Float64Array(n).fill(Infinity);
  const prev = new Int32Array(n).fill(-1);
  const visited = new Uint8Array(n);
  dist[startIdx] = 0;

  // File de priorité simple (N <= 2400 -> rapide < 3ms)
  const queue: Array<{ idx: number; f: number }> = [{ idx: startIdx, f: 0 }];
  const target = cells[endIdx];

  while (queue.length > 0) {
    let minPos = 0;
    for (let i = 1; i < queue.length; i++) {
      if (queue[i].f < queue[minPos].f) minPos = i;
    }
    const cur = queue.splice(minPos, 1)[0].idx;
    if (cur === endIdx) break;
    if (visited[cur]) continue;
    visited[cur] = 1;

    const cc = cells[cur];
    for (const nb of cc.neighbors) {
      if (visited[nb]) continue;
      const nc = cells[nb];
      if (mode === 'land' && !nc.isLand) continue;
      if (mode === 'sea' && nc.isLand && nb !== endIdx) continue;

      const stepDist = Math.hypot(nc.x - cc.x, nc.y - cc.y);
      const slopePenalty = mode === 'land' ? Math.max(0, nc.h - cc.h) * 1.4 + (nc.h > 70 ? 45 : 0) : 0;
      const shallowBonus = mode === 'sea' ? (nc.isShallow ? 0.85 : 1.15) : 1;
      const alt = dist[cur] + stepDist * shallowBonus + slopePenalty;
      if (alt < dist[nb]) {
        dist[nb] = alt;
        prev[nb] = cur;
        const hCost = Math.hypot(target.x - nc.x, target.y - nc.y);
        queue.push({ idx: nb, f: alt + hCost });
      }
    }
  }

  if (prev[endIdx] === -1) return null;
  const pts: Array<[number, number]> = [];
  let cur: number | undefined = endIdx;
  while (cur !== -1 && cur !== undefined) {
    pts.push([Math.round(cells[cur].x * 10) / 10, Math.round(cells[cur].y * 10) / 10]);
    cur = prev[cur];
  }
  return pts.reverse();
}

export interface AzgaarStudioGenerationOptions extends AzgaarGenerationCounts {
  seed: number;
  template: AzgaarTemplateId;
  climateBias?: AzgaarClimateBias;
  cellsDesired?: 800 | 1500 | 2400;
  windAngle?: number;
  worldName?: string;
  stylePreset?: AzgaarStylePreset;
  rayonAnneaux?: number;
  conserverHeros?: boolean;
}

/**
 * Génère un monde Azgaar FMG complet (Voronoï haute résolution + États/Provinces/Cultures/Religions/Bourgs/Blasons/Rivières/Routes maritimes/Marqueurs)
 * ET construit l'état de simulation D&D 5e synchronisé autour du bourg de départ.
 */
export function genererMondeAzgaarStudio(
  options: AzgaarStudioGenerationOptions,
  baseState?: SimulationState
): SimulationState {
  const seed = Math.max(1, Math.trunc(options.seed || 74219));
  const rng = createSeededRng(seed);
  const width = 1200;
  const height = 760;
  const cellsDesired: 800 | 1500 | 2400 = options.cellsDesired || 1500;
  const template: AzgaarTemplateId = options.template || 'continent';
  const climateBias: AzgaarClimateBias = options.climateBias || 'tempere';
  const windAngle = options.windAngle ?? Math.round(rng() * 70 - 20);
  const seaLevel = 20;
  const worldName = options.worldName?.trim() || NOMS_MONDES[seed % NOMS_MONDES.length];

  const worldBase: AzgaarWorldState = {
    seed,
    worldName,
    width,
    height,
    cellsDesired,
    template,
    climateBias,
    windAngle,
    seaLevel,
    stylePreset: options.stylePreset || 'classique',
    stateOpacity: 0.42,
    layers: { ...DEFAULT_AZGAAR_LAYERS },
    states: [],
    provinces: [],
    cultures: [],
    religions: [],
    burgs: [],
    rivers: [],
    routes: [],
    markers: [],
    oceanLabels: [],
    overrides: {},
  };

  // 1. Géométrie & climat initiaux
  const geo0 = reconstruireAtlasComplet(worldBase);
  const cells = geo0.cells;
  const landCells = cells.filter(c => c.isLand);
  // Fallback sécurité si template très océanique a peu de terres
  const effectiveLand =
    landCells.length >= 25
      ? landCells
      : cells.slice(0, 60).map(c => {
          c.isLand = true;
          c.h = 34;
          return c;
        });

  // 2. Cultures
  const targetCultures = clamp(options.culturesCount ?? 4, 2, 6);
  const cultures: AzgaarCultureStudioDef[] = [];
  const chosenCultureCenters: number[] = [];
  for (let i = 0; i < targetCultures; i++) {
    let bestCell = effectiveLand[Math.floor(rng() * effectiveLand.length)];
    let bestMinD = -1;
    for (let sample = 0; sample < 24; sample++) {
      const cand = effectiveLand[Math.floor(rng() * effectiveLand.length)];
      const minD =
        chosenCultureCenters.length === 0
          ? 999
          : Math.min(...chosenCultureCenters.map(idx => Math.hypot(cand.x - cells[idx].x, cand.y - cells[idx].y)));
      if (minD > bestMinD) {
        bestMinD = minD;
        bestCell = cand;
      }
    }
    chosenCultureCenters.push(bestCell.index);
    const preset = NOMS_CULTURES[i % NOMS_CULTURES.length];
    cultures.push({
      id: i + 1,
      name: preset.name,
      type: preset.type,
      color: CULTURE_PALETTE[i % CULTURE_PALETTE.length],
      centerCell: bestCell.index,
    });
  }

  // 3. Religions
  const targetReligions = clamp(options.religionsCount ?? 3, 1, 5);
  const religions: AzgaarReligionDef[] = [];
  for (let i = 0; i < targetReligions; i++) {
    const center = effectiveLand[Math.floor(rng() * effectiveLand.length)];
    const preset = NOMS_RELIGIONS[i % NOMS_RELIGIONS.length];
    religions.push({
      id: i + 1,
      name: preset.name,
      type: preset.type,
      deity: preset.deity,
      color: RELIGION_PALETTE[i % RELIGION_PALETTE.length],
      centerCell: center.index,
    });
  }

  // 4. Rivières descendantes (des sommets humides vers la mer)
  const flowTo = new Int32Array(cells.length).fill(-1);
  const accFlux = new Float32Array(cells.length);
  for (const c of effectiveLand) {
    accFlux[c.index] = c.precip * 0.4;
  }
  const landSorted = [...effectiveLand].sort((a, b) => b.h - a.h);
  for (const c of landSorted) {
    const seaNb = c.neighbors.find(nb => !cells[nb].isLand);
    if (seaNb !== undefined) {
      flowTo[c.index] = seaNb;
      continue;
    }
    const lowerNbs = c.neighbors
      .filter(nb => cells[nb].h < c.h)
      .sort((a, b) => cells[a].h - cells[b].h);
    if (lowerNbs.length > 0) {
      flowTo[c.index] = lowerNbs[0];
      accFlux[lowerNbs[0]] += accFlux[c.index] * 0.85;
    }
  }

  const rivers: AzgaarRiverStudioDef[] = [];
  const usedRiverCells = new Set<number>();
  const riverSources = [...effectiveLand]
    .filter(c => c.h >= 46 && accFlux[c.index] >= 24)
    .sort((a, b) => b.h - a.h);

  for (const src of riverSources) {
    if (rivers.length >= 9) break;
    if (usedRiverCells.has(src.index)) continue;
    const chain: number[] = [src.index];
    const seen = new Set<number>([src.index]);
    let cur = flowTo[src.index];
    while (cur !== -1 && !seen.has(cur) && chain.length < 35) {
      seen.add(cur);
      chain.push(cur);
      if (!cells[cur].isLand || usedRiverCells.has(cur)) break;
      cur = flowTo[cur];
    }
    const touchesSeaOrConfluence =
      chain.length >= 4 && (!cells[chain[chain.length - 1]].isLand || usedRiverCells.has(chain[chain.length - 1]));
    if (touchesSeaOrConfluence) {
      chain.forEach(idx => usedRiverCells.add(idx));
      const pts: Array<[number, number]> = chain.map(idx => [
        Math.round(cells[idx].x * 10) / 10,
        Math.round(cells[idx].y * 10) / 10,
      ]);
      const discharge = Math.round(accFlux[chain[chain.length - 1]] || 60);
      rivers.push({
        id: rivers.length + 1,
        name: NOMS_RIVIERES[rivers.length % NOMS_RIVIERES.length],
        cells: chain,
        points: pts,
        widthFactor: clamp(1 + discharge / 120, 1.1, 3.2),
        discharge,
      });
    }
  }

  // 5. Bourgs & Capitales d'États
  const targetStates = clamp(options.statesCount ?? 5, 2, 7);
  const targetBurgs = clamp(options.burgsCount ?? 22, targetStates + 4, 34);
  const candidateCells = [...effectiveLand]
    .filter(c => c.h < 70)
    .sort((a, b) => {
      const scoreA = (a.isCoast ? 22 : 0) + (usedRiverCells.has(a.index) ? 18 : 0) + a.precip * 0.2;
      const scoreB = (b.isCoast ? 22 : 0) + (usedRiverCells.has(b.index) ? 18 : 0) + b.precip * 0.2;
      return scoreB - scoreA;
    });

  const burgs: AzgaarBurgDef[] = [];
  const usedBurgNames = new Set<string>();
  const takeBurgName = (idx: number): string => {
    const base = NOMS_BOURGS[idx % NOMS_BOURGS.length];
    if (!usedBurgNames.has(base)) {
      usedBurgNames.add(base);
      return base;
    }
    const alt = `${base}-sur-Val`;
    usedBurgNames.add(alt);
    return alt;
  };

  // Placer d'abord les capitales bien espacées
  const minCapDist = Math.min(width, height) / (targetStates * 0.58);
  for (let s = 0; s < targetStates; s++) {
    let pick = candidateCells[0];
    for (const cand of candidateCells) {
      if (burgs.every(b => Math.hypot(b.x - cand.x, b.y - cand.y) >= minCapDist)) {
        pick = cand;
        break;
      }
    }
    if (!pick) pick = effectiveLand[Math.floor(rng() * effectiveLand.length)];
    const stateId = s + 1;
    const color = STATE_PALETTE[s % STATE_PALETTE.length];
    burgs.push({
      id: burgs.length + 1,
      name: takeBurgName(s),
      cell: pick.index,
      x: Math.round(pick.x * 10) / 10,
      y: Math.round(pick.y * 10) / 10,
      stateId,
      provinceId: 0,
      cultureId: 1,
      religionId: 1,
      population: Math.round(9500 + rng() * 18000),
      capital: true,
      port: pick.isCoast,
      citadel: true,
      walls: true,
      plaza: true,
      temple: true,
      garrison: Math.round(350 + rng() * 550),
      coa: genererBlasonDeterministe(rng, color),
    });
  }

  // Placer les bourgs secondaires espacés
  const minBurgDist = 64;
  for (const cand of candidateCells) {
    if (burgs.length >= targetBurgs) break;
    if (burgs.some(b => Math.hypot(b.x - cand.x, b.y - cand.y) < minBurgDist)) continue;
    const idx = burgs.length;
    burgs.push({
      id: idx + 1,
      name: takeBurgName(idx),
      cell: cand.index,
      x: Math.round(cand.x * 10) / 10,
      y: Math.round(cand.y * 10) / 10,
      stateId: 1,
      provinceId: 0,
      cultureId: 1,
      religionId: 1,
      population: Math.round(850 + rng() * 4800),
      capital: false,
      port: cand.isCoast,
      citadel: rng() < 0.25,
      walls: rng() < 0.45,
      plaza: rng() < 0.65,
      temple: rng() < 0.4,
      garrison: Math.round(45 + rng() * 140),
      coa: genererBlasonDeterministe(rng),
    });
  }

  // 6. États & Relations diplomatiques
  const states: AzgaarStateDef[] = [];
  for (let s = 0; s < targetStates; s++) {
    const cap = burgs[s];
    const sid = s + 1;
    const diplomacy: Record<number, AzgaarDiplomacyStatus> = {};
    for (let o = 1; o <= targetStates; o++) {
      if (o === sid) continue;
      const roll = rng();
      diplomacy[o] = roll < 0.18 ? 'Guerre' : roll < 0.42 ? 'Rival' : roll < 0.72 ? 'Paix' : 'Allie';
    }
    const color = STATE_PALETTE[s % STATE_PALETTE.length];
    states.push({
      id: sid,
      name: NOMS_ETATS[s % NOMS_ETATS.length],
      color,
      government: GOUVERNEMENTS[s % GOUVERNEMENTS.length],
      cultureId: (s % cultures.length) + 1,
      capitalBurgId: cap.id,
      diplomacy,
      coa: cap.coa,
    });
  }

  // Symétriser la diplomatie
  for (const st of states) {
    for (const other of states) {
      if (st.id < other.id) {
        other.diplomacy[st.id] = st.diplomacy[other.id];
      }
    }
  }

  // 7. Provinces (2 à 3 provinces par État)
  const provinces: AzgaarProvinceDef[] = [];
  let provCounter = 1;
  for (const st of states) {
    const cap = burgs.find(b => b.id === st.capitalBurgId)!;
    provinces.push({
      id: provCounter,
      name: `${NOMS_PROVINCES[(provCounter - 1) % NOMS_PROVINCES.length]}`,
      stateId: st.id,
      centerCell: cap.cell,
      color: st.color,
      capitalBurgId: cap.id,
    });
    provCounter++;

    // Chercher 1 ou 2 centres provinciaux éloignés de la capitale
    const nearbyBurgs = burgs
      .filter(b => !b.capital && Math.hypot(b.x - cap.x, b.y - cap.y) < 320)
      .slice(0, 2);
    for (const nb of nearbyBurgs) {
      provinces.push({
        id: provCounter,
        name: NOMS_PROVINCES[(provCounter - 1) % NOMS_PROVINCES.length],
        stateId: st.id,
        centerCell: nb.cell,
        color: st.color,
        capitalBurgId: nb.id,
      });
      provCounter++;
    }
  }

  // Assigner les tables temporaires dans worldBase puis reconstruire la répartition exacte des cellules
  worldBase.states = states;
  worldBase.provinces = provinces;
  worldBase.cultures = cultures;
  worldBase.religions = religions;
  worldBase.burgs = burgs;
  worldBase.rivers = rivers;

  const geoFinal = reconstruireAtlasComplet(worldBase);
  for (const b of burgs) {
    const cell = geoFinal.cells[b.cell];
    if (cell) {
      if (!b.capital) b.stateId = cell.stateId;
      b.provinceId = cell.provinceId;
      b.cultureId = cell.cultureId || 1;
      b.religionId = cell.religionId || 1;
    }
  }

  // 8. Routes terrestres (A*) et Routes maritimes entre ports
  const routes: AzgaarRouteStudioDef[] = [];
  const capitals = burgs.filter(b => b.capital);
  for (let i = 0; i < capitals.length; i++) {
    const a = capitals[i];
    const b = capitals[(i + 1) % capitals.length];
    if (a.id === b.id) continue;
    const pts = calculerRouteVoronoi(geoFinal.cells, a.cell, b.cell, 'land');
    if (pts && pts.length >= 2) {
      routes.push({
        id: `route_land_${i}`,
        kind: 'road',
        points: pts,
        fromBurgId: a.id,
        toBurgId: b.id,
      });
    }
  }

  // Routes secondaires reliant les bourgs à leur capitale
  for (const b of burgs) {
    if (b.capital) continue;
    const cap = burgs.find(x => x.capital && x.stateId === b.stateId) || burgs[0];
    if (!cap || cap.id === b.id) continue;
    if (Math.hypot(b.x - cap.x, b.y - cap.y) > 290) continue;
    const pts = calculerRouteVoronoi(geoFinal.cells, b.cell, cap.cell, 'land');
    if (pts && pts.length >= 2) {
      routes.push({
        id: `route_trail_${b.id}`,
        kind: 'trail',
        points: pts,
        fromBurgId: b.id,
        toBurgId: cap.id,
      });
    }
  }

  // Routes maritimes entre bourgs portuaires
  const portBurgs = burgs.filter(b => b.port);
  for (let i = 0; i < portBurgs.length && i < 6; i++) {
    const p1 = portBurgs[i];
    const p2 = portBurgs[(i + 1) % portBurgs.length];
    if (p1.id === p2.id) continue;
    const waterA = geoFinal.cells[p1.cell]?.neighbors.find(nb => !geoFinal.cells[nb].isLand);
    const waterB = geoFinal.cells[p2.cell]?.neighbors.find(nb => !geoFinal.cells[nb].isLand);
    if (waterA !== undefined && waterB !== undefined) {
      const seaPts = calculerRouteVoronoi(geoFinal.cells, waterA, waterB, 'sea');
      if (seaPts && seaPts.length >= 2) {
        routes.push({
          id: `route_sea_${p1.id}_${p2.id}`,
          kind: 'sea',
          points: [[p1.x, p1.y], ...seaPts, [p2.x, p2.y]],
          fromBurgId: p1.id,
          toBurgId: p2.id,
        });
      }
    }
  }

  // 9. Marqueurs initiaux & Étiquettes d'océans
  const markers: AzgaarMarkerDef[] = [];
  const highPeak = [...effectiveLand].sort((a, b) => b.h - a.h)[0];
  if (highPeak) {
    markers.push({
      id: `m_peak_${seed}`,
      icon: 'donjon',
      title: 'Citadelle des Cimes',
      note: 'Ancien observatoire nain surplombant la crête.',
      x: Math.round(highPeak.x),
      y: Math.round(highPeak.y),
      cell: highPeak.index,
      author: 'MJ',
      createdDay: 1,
    });
  }
  const distantLand = effectiveLand.find(
    c => c.stateId === 0 || (burgs[0] && Math.hypot(c.x - burgs[0].x, c.y - burgs[0].y) > 220)
  );
  if (distantLand) {
    markers.push({
      id: `m_ruin_${seed}`,
      icon: 'ruine',
      title: 'Vestiges oubliés',
      note: 'Piliers effondrés mentionnés dans les archives.',
      x: Math.round(distantLand.x),
      y: Math.round(distantLand.y),
      cell: distantLand.index,
      author: 'MJ',
      createdDay: 1,
    });
  }
  if (portBurgs[0]) {
    markers.push({
      id: `m_port_${seed}`,
      icon: 'port',
      title: `Phare de ${portBurgs[0].name}`,
      note: 'Mouillage franc ouvrant les routes maritimes.',
      x: Math.round(portBurgs[0].x + 12),
      y: Math.round(portBurgs[0].y - 10),
      cell: portBurgs[0].cell,
      author: 'MJ',
      createdDay: 1,
    });
  }

  const waterCells = geoFinal.cells.filter(c => !c.isLand && !c.isShallow);
  const oceanLabels: AzgaarOceanLabelDef[] = [];
  if (waterCells.length > 0) {
    const wOuest = [...waterCells].sort((a, b) => a.x - b.x)[Math.floor(waterCells.length * 0.15)] || waterCells[0];
    const wEst = [...waterCells].sort((a, b) => b.x - a.x)[Math.floor(waterCells.length * 0.15)] || waterCells[waterCells.length - 1];
    oceanLabels.push({ name: NOMS_MERS[seed % NOMS_MERS.length], x: Math.round(wOuest.x), y: Math.round(wOuest.y) });
    if (Math.hypot(wEst.x - wOuest.x, wEst.y - wOuest.y) > 350) {
      oceanLabels.push({ name: NOMS_MERS[(seed + 2) % NOMS_MERS.length], x: Math.round(wEst.x), y: Math.round(wEst.y) });
    }
  }

  const startBurg = burgs[0];
  worldBase.routes = routes;
  worldBase.markers = markers;
  worldBase.oceanLabels = oceanLabels;
  worldBase.heroCell = startBurg?.cell;
  worldBase.heroBurgId = startBurg?.id;
  worldBase.heroX = startBurg?.x ?? width * 0.5;
  worldBase.heroY = startBurg?.y ?? height * 0.5;
  worldBase.originHexX = worldBase.heroX;
  worldBase.originHexY = worldBase.heroY;

  genererEconomieEtRessourcesAzgaar(worldBase, geoFinal);

  // 10. Projection vers le secteur de jeu D&D 5e autour du bourg de départ
  const rayonProj = clamp(Math.trunc(Number(options.rayonAnneaux) || 2), 2, 4);
  return projeterSimulationDepuisAzgaarStudio(worldBase, geoFinal, options.conserverHeros !== false ? baseState : undefined, rayonProj);
}

function construireHexId(q: number, r: number): string {
  const qs = q < 0 ? `m${Math.abs(q)}` : `${q}`;
  const rs = r < 0 ? `m${Math.abs(r)}` : `${r}`;
  return `hex_${qs}_${rs}`;
}

export function projeterHexVersMondeAzgaar(
  hx: Pick<HexNode, 'q' | 'r'>,
  studio: Pick<AzgaarWorldState, 'width' | 'height' | 'originHexX' | 'originHexY' | 'heroBurgId' | 'burgs'>
): { x: number; y: number } {
  const originBurg =
    studio.burgs.find(b => b.hexId === 'hex_0_0') ||
    studio.burgs.find(b => b.id === studio.heroBurgId) ||
    studio.burgs.find(b => b.capital) ||
    studio.burgs[0];
  const centerX = studio.originHexX ?? originBurg?.x ?? studio.width * 0.5;
  const centerY = studio.originHexY ?? originBurg?.y ?? studio.height * 0.5;
  const hexStep = 78;
  return {
    x: clamp(centerX + (Math.sqrt(3) * hx.q + (Math.sqrt(3) / 2) * hx.r) * hexStep * 0.62, 10, studio.width - 10),
    y: clamp(centerY + 1.5 * hx.r * hexStep * 0.62, 10, studio.height - 10),
  };
}

export function creerHexDepuisCelluleAzgaar(
  q: number,
  r: number,
  studio: AzgaarWorldState,
  geo: AzgaarReconstructedGeometry,
  options?: {
    nom?: string;
    forceTerre?: boolean;
    brouillard?: 'INCONNU' | 'REPERE' | 'EXPLORE';
    pointInteretType?: 'mine' | 'fort' | 'ruine' | 'bourgade' | 'camp';
    pointInteretNom?: string;
    factionControleId?: string | null;
  }
): HexNode {
  const pos = projeterHexVersMondeAzgaar({ q, r }, studio);
  const cell = trouverCellulePlusProche(geo.cells, pos.x, pos.y);
  const estEau = !options?.forceTerre && !cell.isLand;
  const biomeDef =
    AZGAAR_BIOMES[estEau ? cell.biome : Math.max(2, cell.biome)] || AZGAAR_BIOMES[4];
  const hexId = construireHexId(q, r);
  const nearestBurg = !estEau
    ? studio.burgs.find(b => Math.hypot(b.x - pos.x, b.y - pos.y) < 35)
    : undefined;
  if (nearestBurg && !nearestBurg.hexId) {
    nearestBurg.hexId = hexId;
  }

  const stateObj = studio.states.find(s => s.id === cell.stateId);
  const cultureObj = studio.cultures.find(c => c.id === cell.cultureId);
  const provObj = studio.provinces.find(p => p.id === cell.provinceId);

  const pressure = estEau
    ? 0
    : nearestBurg
      ? 14
      : stateObj && stateObj.diplomacy[1] === 'Guerre'
        ? 72
        : stateObj
          ? 30
          : 48;
  const securite: SecurityLevel = estEau
    ? 'Sûr'
    : pressure < 22
      ? 'Sûr'
      : pressure < 45
        ? 'Patrouillé'
        : pressure < 72
          ? 'Dangereux'
          : 'Périlleux';

  const nomHex = options?.nom?.trim()
    ? options.nom.trim()
    : estEau
      ? studio.oceanLabels[0]?.name || 'Eaux côtières'
      : nearestBurg
        ? nearestBurg.name
        : provObj
          ? `${provObj.name} (${q},${r})`
          : `${biomeDef.name} (${q},${r})`;

  const hx: HexNode = {
    id: hexId,
    q,
    r,
    nom: nomHex,
    terrain: estEau ? 'Plaine / Route' : biomeDef.terrain,
    biomeAzgaar: estEau ? 'Mer' : biomeDef.name,
    securite,
    factionControleId: estEau
      ? null
      : options?.factionControleId !== undefined
        ? options.factionControleId
        : stateObj?.factionId || null,
    visite: options?.brouillard === 'EXPLORE',
    ressourcesEau: !estEau && (cell.flux >= 22 || cell.precip >= 52),
    ressourcesGibier:
      !estEau && (biomeDef.terrain === 'Forêt Dense' || biomeDef.terrain === 'Plaine / Route'),
    brouillard: options?.brouillard || 'REPERE',
    altitude: estEau ? cell.h : Math.max(studio.seaLevel + 2, cell.h),
    precipitations: cell.precip,
    temperatureC: cell.temp,
    fluxHydro: estEau ? 0 : cell.flux,
    estEau,
    estRivage: !estEau && cell.isCoast,
    pressionDanger: pressure,
    prosperite: estEau ? 0 : nearestBurg ? 72 : stateObj ? 42 : 20,
    niveauEau: estEau ? 100 : clamp(cell.flux + 15, 5, 95),
    populationGibier: estEau ? 0 : biomeDef.terrain === 'Forêt Dense' ? 75 : 46,
    population: estEau ? 0 : nearestBurg ? nearestBurg.population : stateObj ? 120 : 35,
    culture: estEau ? undefined : cultureObj?.name || 'Locale',
    provinceNom: provObj?.name || stateObj?.name || 'Confins',
    garnison: estEau ? 0 : nearestBurg ? Math.min(100, Math.round(nearestBurg.garrison / 6)) : stateObj ? 22 : 8,
    routeNiveau: estEau ? 'AUCUNE' : nearestBurg ? 'ROUTE' : 'AUCUNE',
  };

  if (!estEau && (options?.pointInteretType || nearestBurg)) {
    const poiType = options?.pointInteretType || (nearestBurg?.citadel ? 'fort' : 'bourgade');
    hx.pointInteret = {
      id: `poi_az_${hexId}`,
      nom: options?.pointInteretNom?.trim() || (nearestBurg ? nearestBurg.name : `Site de ${nomHex}`),
      type: poiType,
      statut: poiType === 'ruine' ? 'RUINED' : 'OPERATIONNEL',
    };
  }

  return hx;
}

export function projeterSimulationDepuisAzgaarStudio(
  studio: AzgaarWorldState,
  geoPrecalc?: AzgaarReconstructedGeometry,
  baseState?: SimulationState,
  rayonAnneaux: number = 2
): SimulationState {
  const geo = geoPrecalc || reconstruireAtlasComplet(studio);
  const heroBurg =
    studio.burgs.find(b => b.id === studio.heroBurgId) ||
    studio.burgs.find(b => b.capital) ||
    studio.burgs[0];
  const centerX = studio.originHexX ?? (heroBurg ? heroBurg.x : studio.width * 0.5);
  const centerY = studio.originHexY ?? (heroBurg ? heroBurg.y : studio.height * 0.5);
  studio.originHexX = centerX;
  studio.originHexY = centerY;

  const rayon = clamp(Math.trunc(rayonAnneaux || 2), 2, 4);
  const hexStep = 78;
  const hexes: HexNode[] = [];

  const factions: Faction[] = studio.states.slice(0, 4).map((st, idx) => {
    const fId = st.factionId || `faction_az_state_${st.id}`;
    st.factionId = fId;
    return {
      id: fId,
      nom: st.name,
      richesse: 520 + (idx === 0 ? 180 : 0),
      forceMilitaire: 55 + idx * 5,
      influence: idx === 0 ? 68 : 44,
      objectifs: [
        `Protéger les frontières de ${st.name}`,
        idx === 2 ? 'Étendre l\'influence sur les marches' : 'Sécuriser les routes commerciales',
      ],
      noeudsControles: [],
      relationsJoueur: idx === 0 ? 'ALLIE' : st.diplomacy[1] === 'Guerre' ? 'HOSTILE' : 'NEUTRE',
      posture: st.diplomacy[1] === 'Guerre' ? 'RAID' : idx === 0 ? 'COMMERCE' : 'DEFENSE',
      moral: 74,
      effectifActif: `Garde de ${st.name}`,
      cultureDominante: studio.cultures.find(c => c.id === st.cultureId)?.name || 'Locale',
      populationTotale: 1200,
      forceMax: 95,
      lassitudeGuerre: 10,
      revenuFiscal: 45,
      relationsFactions: {},
    };
  });

  // Relations inter-factions synchronisées avec la diplomatie Azgaar
  for (let i = 0; i < factions.length; i++) {
    const stA = studio.states[i];
    if (!stA) continue;
    for (let j = 0; j < factions.length; j++) {
      if (i === j) continue;
      const stB = studio.states[j];
      if (!stB) continue;
      const dip = stA.diplomacy[stB.id] || 'Paix';
      factions[i].relationsFactions![factions[j].id] =
        dip === 'Guerre' ? 'GUERRE' : dip === 'Rival' ? 'TENSION' : dip === 'Allie' ? 'PACTE' : 'NEUTRE';
    }
  }

  for (let q = -rayon; q <= rayon; q++) {
    const rMin = Math.max(-rayon, -q - rayon);
    const rMax = Math.min(rayon, -q + rayon);
    for (let r = rMin; r <= rMax; r++) {
      const px = clamp(centerX + (Math.sqrt(3) * q + (Math.sqrt(3) / 2) * r) * hexStep * 0.62, 10, studio.width - 10);
      const py = clamp(centerY + (1.5 * r) * hexStep * 0.62, 10, studio.height - 10);
      const cell = trouverCellulePlusProche(geo.cells, px, py);
      const biomeDef = AZGAAR_BIOMES[cell.biome] || AZGAAR_BIOMES[4];
      const nearestBurg = studio.burgs.find(
        b => Math.hypot(b.x - px, b.y - py) < hexStep * 0.45 && cell.isLand
      );
      if (nearestBurg) {
        nearestBurg.hexId = construireHexId(q, r);
      }

      const stateObj = studio.states.find(s => s.id === cell.stateId);
      const cultureObj = studio.cultures.find(c => c.id === cell.cultureId);
      const provObj = studio.provinces.find(p => p.id === cell.provinceId);
      const estCentre = q === 0 && r === 0;
      const d = Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r));

      const fMatch = factions.find(f => f.id === stateObj?.factionId);
      const pressure = !cell.isLand
        ? 0
        : estCentre || nearestBurg
          ? 12
          : fMatch?.relationsJoueur === 'HOSTILE'
            ? 74
            : fMatch
              ? 28
              : 46;
      const sec: SecurityLevel = !cell.isLand
        ? 'Sûr'
        : pressure < 22
          ? 'Sûr'
          : pressure < 45
            ? 'Patrouillé'
            : pressure < 72
              ? 'Dangereux'
              : 'Périlleux';

      const hexId = construireHexId(q, r);
      const nomHex = estCentre
        ? heroBurg?.name || 'Bourg de départ'
        : !cell.isLand
          ? studio.oceanLabels[0]?.name || 'Eaux côtières'
          : nearestBurg
            ? nearestBurg.name
            : provObj
              ? `${provObj.name} (${q},${r})`
              : `${biomeDef.name} (${q},${r})`;

      const hx: HexNode = {
        id: hexId,
        q,
        r,
        nom: nomHex,
        terrain: biomeDef.terrain,
        biomeAzgaar: biomeDef.name,
        securite: sec,
        factionControleId: cell.isLand ? fMatch?.id || null : null,
        visite: estCentre,
        ressourcesEau: cell.isLand && (cell.flux >= 22 || cell.precip >= 52),
        ressourcesGibier: cell.isLand && (biomeDef.terrain === 'Forêt Dense' || biomeDef.terrain === 'Plaine / Route'),
        brouillard: estCentre ? 'EXPLORE' : d === 1 ? 'REPERE' : 'INCONNU',
        pressionDanger: pressure,
        prosperite: !cell.isLand ? 0 : nearestBurg ? 74 : fMatch ? 44 : 20,
        niveauEau: cell.isLand ? clamp(cell.flux + 15, 5, 95) : 100,
        populationGibier: cell.isLand ? (biomeDef.terrain === 'Forêt Dense' ? 75 : 48) : 0,
        altitude: cell.h,
        precipitations: cell.precip,
        temperatureC: cell.temp,
        fluxHydro: cell.flux,
        population: !cell.isLand ? 0 : nearestBurg ? nearestBurg.population : fMatch ? 140 : 35,
        culture: cultureObj?.name || 'Locale',
        provinceNom: provObj?.name || stateObj?.name || 'Confins',
        garnison: !cell.isLand ? 0 : nearestBurg ? Math.min(100, Math.round(nearestBurg.garrison / 6)) : fMatch ? 24 : 8,
        routeNiveau: !cell.isLand ? 'AUCUNE' : estCentre || nearestBurg ? 'ROUTE' : d === 1 ? 'PISTE' : 'AUCUNE',
        estEau: !cell.isLand,
        estRivage: cell.isCoast,
      };

      if (cell.isLand && (estCentre || nearestBurg)) {
        hx.pointInteret = {
          id: `poi_az_${hexId}`,
          nom: estCentre
            ? `Cité de ${hx.nom}`
            : nearestBurg?.citadel
              ? `Citadelle de ${hx.nom}`
              : `Bourg de ${hx.nom}`,
          type: estCentre || !nearestBurg?.citadel ? 'bourgade' : 'fort',
          statut: 'OPERATIONNEL',
        };
      }

      hydraterEconomieHex(hx, studio, { x: px, y: py });
      if (studio.resources) {
        for (const r of studio.resources) {
          if (!r.hexId && Math.hypot(r.x - px, r.y - py) < hexStep * 0.48) {
            r.hexId = hx.id;
          }
        }
      }

      if (hx.factionControleId && fMatch) {
        fMatch.noeudsControles.push(hx.id);
      }
      hexes.push(hx);
    }
  }

  synchroniserControleFactions(factions, hexes);
  const hexDepart = hexes.find(h => h.q === 0 && h.r === 0) || hexes[0];

  const grapheNoeuds: GraphNode[] = [];
  const grapheLiens: GraphEdge[] = [];
  for (const h of hexes) {
    grapheNoeuds.push({
      id: h.id,
      type: 'Location',
      label: h.nom,
      proprietes: { q: h.q, r: h.r, terrain: h.terrain, estEau: Boolean(h.estEau), biomeAzgaar: h.biomeAzgaar },
    });
  }
  for (let i = 0; i < hexes.length; i++) {
    for (let j = i + 1; j < hexes.length; j++) {
      if (!hexes[i].estEau && !hexes[j].estEau && calculerDistanceHex(hexes[i], hexes[j]) === 1) {
        grapheLiens.push({ source: hexes[i].id, cible: hexes[j].id, relation: 'ADJACENT_TO' });
      }
    }
  }

  const nomCap = heroBurg?.name || hexDepart.nom;
  const startState = studio.states.find(s => s.id === heroBurg?.stateId) || studio.states[0];

  const autresTerres = hexes.filter(h => !h.estEau && h.id !== hexDepart.id && h.pointInteret);
  const entitesMonde: WorldEntity[] = [];
  if (autresTerres[0]) {
    const it = calculerItinerairePondere(autresTerres[0].id, hexDepart.id, hexes, 'CARAVANE');
    entitesMonde.push({
      id: `ent_car_${studio.seed}`,
      nom: `Convoi de ${nomCap}`,
      type: 'CARAVANE',
      factionId: factions[0]?.id || 'faction_1',
      hexId: autresTerres[0].id,
      origineHexId: autresTerres[0].id,
      destinationHexId: hexDepart.id,
      itineraire: it.chemin,
      force: 5,
      cargaison: 'Minerai',
      statut: 'EN_ROUTE',
      tickCreation: 1,
    });
  }

  const personnage =
    baseState?.personnage
      ? JSON.parse(JSON.stringify(baseState.personnage))
      : JSON.parse(JSON.stringify(INITIAL_SIMULATION_STATE.personnage));
  if (!baseState?.personnage) {
    personnage.memoire = { dernieresInfos: [], souvenirsContextuels: [] };
  }
  personnage.reputationFactions = {};
  for (const f of factions) {
    personnage.reputationFactions[f.id] = f.relationsJoueur === 'HOSTILE' ? -45 : 10;
  }

  const loreMonde = genererLoreProcedural(studio, factions);
  const pnjsMonde = genererPnjsProcedural(studio, factions, hexes, loreMonde, personnage, {
    heroBurgId: studio.heroBurgId,
    radiusProche: 2,
    lambdaParBourg: 2,
  });

  const arcsNarratifs: CampaignArc[] = baseState?.memoireMJ?.arcsNarratifs
    ? JSON.parse(JSON.stringify(baseState.memoireMJ.arcsNarratifs))
    : [];

  const journalSecretMJ: GmSecretNote[] = baseState?.memoireMJ?.journalSecretMJ
    ? JSON.parse(JSON.stringify(baseState.memoireMJ.journalSecretMJ))
    : [];

  const carteAzgaar = {
    seed: studio.seed,
    nomMonde: studio.worldName,
    modeleRelief: (studio.template === 'archipel'
      ? 'archipel'
      : studio.template === 'peninsule'
        ? 'peninsule'
        : studio.template === 'haute_chaine' || studio.template === 'volcan'
          ? 'monts'
          : 'continent') as AzgaarReliefPreset,
    climatBias: studio.climateBias,
    rayonAnneaux: 2,
    niveauMer: studio.seaLevel,
    rivieres: studio.rivers.slice(0, 3).map((rv, idx) => ({
      id: `rv_proj_${idx}`,
      nom: rv.name,
      hexIds: hexes.filter(h => !h.estEau).slice(0, 3).map(h => h.id),
      debit: rv.discharge,
    })),
    routes: [],
    cultures: studio.cultures.slice(0, 4).map(c => ({
      id: `cul_${c.id}`,
      nom: c.name,
      couleur: '#e7d9b4',
      couleurBord: c.color,
      centreHexId: hexDepart.id,
    })),
    labelsMer: studio.oceanLabels.slice(0, 1).map(m => ({ nom: m.name, q: -2, r: 2 })),
  };

  const simOut: SimulationState = {
    _seq: 1,
    horloge: baseState?.horloge || { ...INITIAL_SIMULATION_STATE.horloge },
    personnage,
    hexActuel: hexDepart,
    hexagones: hexes,
    marcheAllure: baseState?.marcheAllure || 'Normale',
    roleExploration: baseState?.roleExploration || "S'orienter",
    factions,
    marche: baseState?.marche || { ...INITIAL_SIMULATION_STATE.marche },
    combat: {
      actif: false,
      round: 0,
      combattantActifIndex: 0,
      ordreInitiative: [],
      ennemis: [],
      journalCombat: [],
    },
    grapheNoeuds,
    grapheLiens,
    journalNarratif: [],
    historiqueTraces: [],
    rumeurs: [],
    donjon: null,
    memoireMJ: {
      filNarratif: [
        `Jour 1, 08:00 — Arrivée à ${nomCap} (${startState?.name || studio.worldName}, #${studio.seed}).`,
      ],
      promessesEtQuetes: [],
      consequencesDifferees: [],
      arcsNarratifs,
      journalSecretMJ,
    },
    entitesMonde,
    chroniqueMonde: [],
    historiqueMonde: [
      {
        tick: 1,
        jour: 1,
        meteo: 'Ciel dégagé',
        multiplicateurFer: 1.0,
        multiplicateurVivres: 1.0,
        pressionMoyenne: 30,
        prosperiteMoyenne: 45,
        entitesActives: entitesMonde.length,
        forcesFactions: Object.fromEntries(factions.map(f => [f.id, f.forceMilitaire])),
      },
    ],
    carteAzgaar,
    azgaarStudio: studio,
    loreMonde,
    pnjsMonde,
  };

  reconcilierProximitePnjs(simOut, 2);
  return simOut;
}

export function trouverCellulePlusProche(
  cells: AzgaarVoronoiCell[],
  x: number,
  y: number
): AzgaarVoronoiCell {
  let best = cells[0];
  let bestD = Infinity;
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    const d = (c.x - x) * (c.x - x) + (c.y - y) * (c.y - y);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

export function obtenirCellulesDansRayon(
  cells: AzgaarVoronoiCell[],
  x: number,
  y: number,
  radiusPx: number
): AzgaarVoronoiCell[] {
  const r2 = radiusPx * radiusPx;
  return cells.filter(c => (c.x - x) * (c.x - x) + (c.y - y) * (c.y - y) <= r2);
}

/**
 * Importe un fichier .json (export studio ou Azgaar FMG) ou .map Azgaar natif.
 */
export function parserImportAzgaarJsonOuMap(
  rawText: string,
  baseState: SimulationState
): AzgaarWorldState {
  const trimmed = rawText.trim();
  if (!trimmed) {
    throw new Error('Fichier vide.');
  }

  // Cas 1 : JSON direct (soit notre format AzgaarWorldState, soit JSON pack Azgaar FMG)
  if (trimmed.startsWith('{')) {
    const parsed = JSON.parse(trimmed);
    if (parsed && Array.isArray(parsed.states) && Array.isArray(parsed.burgs) && parsed.cellsDesired) {
      return parsed as AzgaarWorldState;
    }
    if (parsed && parsed.pack && Array.isArray(parsed.pack.cells)) {
      return convertirPackAzgaarVersStudio(parsed, baseState);
    }
    throw new Error('Structure JSON Azgaar non reconnue.');
  }

  // Cas 2 : Fichier texte .map d'Azgaar FMG (lignes structurées par bloc : info, settings, coords, biomes, ..., JSON pack)
  const lines = trimmed.split(/\r?\n/);
  const jsonLines = lines.filter(l => l.trim().startsWith('{') || l.trim().startsWith('['));
  const infoParts = lines[0]?.split('|') || [];
  const seedParsed = parseInt(infoParts[3] || '', 10) || Date.now() % 900000;

  // Chercher les tableaux JSON intégrés dans un export .map d'Azgaar FMG
  let statesRaw: any[] | null = null;
  let burgsRaw: any[] | null = null;
  let culturesRaw: any[] | null = null;
  let religionsRaw: any[] | null = null;
  let provincesRaw: any[] | null = null;
  let riversRaw: any[] | null = null;
  let markersRaw: any[] | null = null;

  for (const jl of jsonLines) {
    try {
      const obj = JSON.parse(jl);
      if (Array.isArray(obj) && obj.length > 0) {
        const sample = obj.find((x: any) => x && typeof x === 'object');
        if (!sample) continue;
        if ('diplomacy' in sample && 'capital' in sample && !statesRaw) statesRaw = obj;
        else if ('population' in sample && 'citadel' in sample && !burgsRaw) burgsRaw = obj;
        else if ('origins' in sample && 'code' in sample && !culturesRaw) culturesRaw = obj;
        else if ('deity' in sample && !religionsRaw) religionsRaw = obj;
        else if ('state' in sample && 'burg' in sample && 'fullName' in sample && !provincesRaw) provincesRaw = obj;
        else if ('discharge' in sample && 'mouth' in sample && !riversRaw) riversRaw = obj;
        else if ('icon' in sample && 'dx' in sample && !markersRaw) markersRaw = obj;
      }
    } catch {
      // ignorer les lignes SVG/non-JSON du .map
    }
  }

  if (statesRaw || burgsRaw || culturesRaw) {
    return convertirPackAzgaarVersStudio(
      {
        info: { seed: seedParsed, mapName: infoParts[1] || undefined },
        pack: {
          states: statesRaw || [],
          burgs: burgsRaw || [],
          cultures: culturesRaw || [],
          religions: religionsRaw || [],
          provinces: provincesRaw || [],
          rivers: riversRaw || [],
          markers: markersRaw || [],
        },
      },
      baseState
    );
  }

  // Si c'est un .map v1 binaire/ancien minimal avec juste la graine dans l'en-tête
  if (infoParts.length >= 4) {
    const gen = genererMondeAzgaarStudio(
      {
        seed: seedParsed,
        template: 'continent',
        worldName: infoParts[1]?.trim() || undefined,
      },
      baseState
    );
    return gen.azgaarStudio!;
  }

  throw new Error('Format .map ou .json Azgaar invalide.');
}

function convertirPackAzgaarVersStudio(raw: any, baseState: SimulationState): AzgaarWorldState {
  const seed = Number(raw?.info?.seed) || 74219;
  const srcW = Number(raw?.info?.width) || 1200;
  const srcH = Number(raw?.info?.height) || 760;
  const sx = 1200 / Math.max(100, srcW);
  const sy = 760 / Math.max(100, srcH);

  const generated = genererMondeAzgaarStudio(
    {
      seed,
      template: 'continent',
      worldName: raw?.info?.mapName || baseState.azgaarStudio?.worldName,
    },
    baseState
  ).azgaarStudio!;

  const rng = createSeededRng(seed);
  const pack = raw.pack || {};

  if (Array.isArray(pack.cultures)) {
    const cList = pack.cultures
      .filter((c: any) => c && c.i > 0 && !c.removed)
      .slice(0, 8)
      .map((c: any, idx: number): AzgaarCultureStudioDef => ({
        id: Number(c.i) || idx + 1,
        name: String(c.name || `Culture ${idx + 1}`).slice(0, 40),
        type: 'Urbaine',
        color: String(c.color || CULTURE_PALETTE[idx % CULTURE_PALETTE.length]),
        centerCell: Math.min(generated.cellsDesired - 1, Number(c.center) || idx * 50),
      }));
    if (cList.length > 0) generated.cultures = cList;
  }

  if (Array.isArray(pack.religions)) {
    const rList = pack.religions
      .filter((r: any) => r && r.i > 0 && !r.removed)
      .slice(0, 6)
      .map((r: any, idx: number): AzgaarReligionDef => ({
        id: Number(r.i) || idx + 1,
        name: String(r.name || `Culte ${idx + 1}`).slice(0, 40),
        type: 'Pantheon',
        deity: String(r.deity || 'Divinité ancienne').slice(0, 40),
        color: String(r.color || RELIGION_PALETTE[idx % RELIGION_PALETTE.length]),
        centerCell: Math.min(generated.cellsDesired - 1, Number(r.center) || idx * 60),
      }));
    if (rList.length > 0) generated.religions = rList;
  }

  if (Array.isArray(pack.states)) {
    const sList = pack.states
      .filter((s: any) => s && s.i > 0 && !s.removed)
      .slice(0, 10)
      .map((s: any, idx: number): AzgaarStateDef => ({
        id: Number(s.i) || idx + 1,
        name: String(s.name || s.fullName || `État ${idx + 1}`).slice(0, 45),
        color: String(s.color || STATE_PALETTE[idx % STATE_PALETTE.length]),
        government: String(s.formName || s.type || 'Monarchie'),
        cultureId: Number(s.culture) || 1,
        capitalBurgId: Number(s.capital) || idx + 1,
        diplomacy: {},
        coa: genererBlasonDeterministe(rng, String(s.color || STATE_PALETTE[idx % STATE_PALETTE.length])),
      }));
    if (sList.length > 0) generated.states = sList;
  }

  if (Array.isArray(pack.burgs)) {
    const bList = pack.burgs
      .filter((b: any) => b && b.i > 0 && !b.removed && typeof b.x === 'number')
      .slice(0, 45)
      .map((b: any, idx: number): AzgaarBurgDef => ({
        id: Number(b.i) || idx + 1,
        name: String(b.name || `Bourg ${idx + 1}`).slice(0, 40),
        cell: clamp(Number(b.cell) || idx * 10, 0, 700),
        x: clamp(Number(b.x) * sx, 20, 1180),
        y: clamp(Number(b.y) * sy, 20, 740),
        stateId: Number(b.state) || 1,
        provinceId: Number(b.province) || 1,
        cultureId: Number(b.culture) || 1,
        religionId: 1,
        population: Math.round((Number(b.population) || 2) * 1000),
        capital: Boolean(b.capital),
        port: Boolean(b.port),
        citadel: Boolean(b.citadel),
        walls: Boolean(b.walls),
        plaza: Boolean(b.plaza),
        temple: Boolean(b.temple),
        garrison: 120,
        coa: genererBlasonDeterministe(rng),
      }));
    if (bList.length > 0) {
      generated.burgs = bList;
      generated.heroBurgId = bList[0].id;
      generated.heroCell = bList[0].cell;
    }
  }

  if (Array.isArray(pack.markers)) {
    const mList = pack.markers
      .filter((m: any) => m && typeof m.x === 'number')
      .slice(0, 25)
      .map((m: any, idx: number): AzgaarMarkerDef => ({
        id: `m_imp_${idx}`,
        icon: 'note',
        title: String(m.note || m.icon || `Site ${idx + 1}`).slice(0, 40),
        note: String(m.legend || m.note || '').slice(0, 200),
        x: clamp(Number(m.x) * sx, 20, 1180),
        y: clamp(Number(m.y) * sy, 20, 740),
        author: 'JOUEUR',
      }));
    if (mList.length > 0) generated.markers = mList;
  }

  const geoImp = reconstruireAtlasComplet(generated);
  genererEconomieEtRessourcesAzgaar(generated, geoImp);

  return generated;
}

let cachedAzgaarInitialState: SimulationState | null = null;

/**
 * Construit et retourne l'état initial par défaut démarrant directement
 * sur un monde Azgaar Voronoï complet (1500 cellules, 5 États, ports, blasons, rivières, routes maritimes).
 */
export function creerEtatInitialAzgaar(): SimulationState {
  if (!cachedAzgaarInitialState) {
    cachedAzgaarInitialState = genererMondeAzgaarStudio(
      {
        seed: 74219,
        template: 'continent',
        climateBias: 'tempere',
        cellsDesired: 1500,
        statesCount: 5,
        culturesCount: 4,
        religionsCount: 3,
        burgsCount: 22,
        stylePreset: 'classique',
        conserverHeros: false,
      },
      INITIAL_SIMULATION_STATE
    );
  }
  return JSON.parse(JSON.stringify(cachedAzgaarInitialState));
}

/**
 * Synchronise la simulation (métadonnées carteAzgaar, factions, noms de bourgs liés)
 * après une modification directe dans le Studio Azgaar.
 */
export function synchroniserSecteurDepuisAzgaar(
  etat: SimulationState,
  studio: AzgaarWorldState
): SimulationState {
  const clone: SimulationState = JSON.parse(JSON.stringify(etat));
  clone.azgaarStudio = JSON.parse(JSON.stringify(studio));
  clone._seq = (clone._seq || 1) + 1;

  if (clone.carteAzgaar) {
    clone.carteAzgaar.nomMonde = studio.worldName;
    clone.carteAzgaar.seed = studio.seed;
    clone.carteAzgaar.cultures = studio.cultures.slice(0, 4).map(c => ({
      id: `cul_${c.id}`,
      nom: c.name,
      couleur: '#e7d9b4',
      couleurBord: c.color,
      centreHexId: clone.hexActuel.id,
    }));
  }

  for (const st of studio.states) {
    if (!st.factionId) continue;
    const f = clone.factions.find(fac => fac.id === st.factionId);
    if (f) {
      f.nom = st.name;
      const dip = st.diplomacy[1];
      if (dip && st.id !== 1) {
        f.relationsJoueur = dip === 'Guerre' ? 'HOSTILE' : dip === 'Allie' ? 'ALLIE' : 'NEUTRE';
      }
    }
  }

  // Propager les peintures / overrides Voronoï (altitude, biome, État, culture) sur les hexagones du secteur
  const hasCellOverrides =
    Boolean(studio.overrides?.height && Object.keys(studio.overrides.height).length > 0) ||
    Boolean(studio.overrides?.biome && Object.keys(studio.overrides.biome).length > 0) ||
    Boolean(studio.overrides?.state && Object.keys(studio.overrides.state).length > 0) ||
    Boolean(studio.overrides?.culture && Object.keys(studio.overrides.culture).length > 0);

  if (hasCellOverrides) {
    const geo = reconstruireAtlasComplet(studio);
    for (const hx of clone.hexagones) {
      const pos = projeterHexVersMondeAzgaar(hx, studio);
      const cell = trouverCellulePlusProche(geo.cells, pos.x, pos.y);

      if (studio.overrides.height?.[cell.index] !== undefined) {
        hx.altitude = cell.h;
        hx.estEau = !cell.isLand;
        hx.estRivage = cell.isLand && cell.isCoast;
        hx.temperatureC = cell.temp;
        hx.precipitations = cell.precip;
        hx.fluxHydro = cell.isLand ? cell.flux : 0;
        const bDef = AZGAAR_BIOMES[cell.biome] || AZGAAR_BIOMES[4];
        hx.biomeAzgaar = cell.isLand ? bDef.name : 'Mer';
        hx.terrain = bDef.terrain;
      }
      if (studio.overrides.biome?.[cell.index] !== undefined && cell.isLand) {
        const bDef = AZGAAR_BIOMES[cell.biome] || AZGAAR_BIOMES[4];
        hx.biomeAzgaar = bDef.name;
        hx.terrain = bDef.terrain;
      }
      if (studio.overrides.culture?.[cell.index] !== undefined && cell.isLand) {
        const cul = studio.cultures.find(c => c.id === cell.cultureId);
        if (cul) hx.culture = cul.name;
      }
      if (studio.overrides.state?.[cell.index] !== undefined) {
        if (!cell.isLand || cell.stateId === 0) {
          hx.factionControleId = null;
        } else {
          const st = studio.states.find(s => s.id === cell.stateId);
          if (st?.factionId && clone.factions.some(f => f.id === st.factionId)) {
            hx.factionControleId = st.factionId;
          }
        }
      }
      if (clone.hexActuel.id === hx.id) {
        clone.hexActuel = { ...hx };
      }
    }
    synchroniserControleFactions(clone.factions, clone.hexagones);
  }

  for (const b of studio.burgs) {
    if (!b.hexId) continue;
    const hx = clone.hexagones.find(h => h.id === b.hexId);
    if (hx) {
      hx.nom = b.name;
      hx.population = b.population;
      hx.garnison = Math.min(100, Math.round(b.garrison / 6));
      if (hx.pointInteret) {
        hx.pointInteret.nom = b.citadel ? `Citadelle de ${b.name}` : `Bourg de ${b.name}`;
      }
      if (clone.hexActuel.id === hx.id) {
        clone.hexActuel = { ...hx };
      }
    }
  }

  if (clone.pnjsMonde && clone.pnjsMonde.length > 0) {
    reconcilierProximitePnjs(clone, 2);
  }

  return clone;
}
