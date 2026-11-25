import {
  AzgaarClimateBias,
  AzgaarCultureDef,
  AzgaarMapMetadata,
  AzgaarReliefPreset,
  AzgaarRiverDef,
  AzgaarRoadDef,
  Faction,
  GraphEdge,
  GraphNode,
  HexNode,
  SecurityLevel,
  SimulationState,
  TerrainType,
  WorldEntity,
} from '../types';
import { createSeededRng, hashString } from '../utils/prng';
import { creerHexDepuisCelluleAzgaar, reconstruireAtlasComplet } from './azgaarVoronoi';
import { calculerDistanceHex } from './hexcrawl';
import { INITIAL_SIMULATION_STATE } from './initialData';
import {
  calculerItinerairePondere,
  evaluerScoreExpansionAzgaar,
  simulerClimatEtHydrologie,
} from './worldGeography';
import { synchroniserControleFactions } from './worldSim';

export interface AzgaarGenerationConfig {
  seed: number;
  modeleRelief: AzgaarReliefPreset;
  climatBias?: AzgaarClimateBias;
  rayonAnneaux?: number;
  nomMonde?: string;
  conserverHeros?: boolean;
}

const AXIAL_DIRECTIONS: Array<{ dq: number; dr: number }> = [
  { dq: 1, dr: 0 },
  { dq: 1, dr: -1 },
  { dq: 0, dr: -1 },
  { dq: -1, dr: 0 },
  { dq: -1, dr: 1 },
  { dq: 0, dr: 1 },
];

const NOMS_MONDES_PREFIX = ['Marches', 'Royaumes', 'Terres', 'Confins', 'Val', 'Archipel', 'Côtes'];
const NOMS_MONDES_SUFFIX = [
  'd\'Arken',
  'de Brumeval',
  'de Hauteforge',
  'des Cendres',
  'd\'Oremor',
  'de Sombreciel',
  'd\'Iverne',
  'des Sables Gris',
];

const NOMS_BOURGS = [
  'Val-Serein',
  'Hauteforge',
  'Bourg-le-Gué',
  'Port-Brume',
  'Clairval',
  'Roche-Blanche',
  'Pont-d\'Or',
  'Sombremont',
  'Vieux-Chêne',
  'Gué-du-Fer',
];

const NOMS_LIEUX_PAR_TERRAIN: Record<TerrainType, string[]> = {
  'Plaine / Route': [
    'Val d\'Orge', 'Plaine du Gué', 'Haute-Prairie', 'Croisée', 'Verger', 'Lande Claire',
    'Pré-Vert', 'Champs-Bas', 'Val-Vent', 'Sillon d\'Or', 'Gué-Clair', 'Belle-Côte',
    'Moulin-Neuf', 'Pâture Haute', 'Champ-Serein', 'Grand-Pré', 'Bas-Val', 'Côteau Doux',
    'Plein-Vent', 'Gué-Saule', 'Prés-Neufs', 'Franche-Lande', 'Tertre Clair', 'Voie Basse',
  ],
  'Forêt Dense': [
    'Bois-Loup', 'Taillis d\'Ombre', 'Futaie Sombre', 'Bosquet Ancien', 'Sous-Bois', 'Sylve Verte',
    'Chênaie', 'Bois-Biche', 'Hêtraie', 'Vert-Fourré', 'Val-Ramure', 'Sylve Grise',
    'Bois-Bruine', 'Épine Noire', 'Clairière', 'Futaie Grise', 'Bois-Cerf', 'Sylve Creuse',
    'Sombre-Bois', 'Pinède', 'Fourré Bas', 'Ronceraie', 'Val-Feuillu', 'Haut-Boisé',
  ],
  'Marais Fétide': [
    'Tourbière', 'Vasques Mortes', 'Roseaux', 'Fondrière', 'Delta Boueux', 'Vasière',
    'Sangsues', 'Saule-Mort', 'Marais Gris', 'Bourbier', 'Nappe Froide', 'Joncs Noirs',
    'Rive-Vase', 'Étang Mort', 'Bas-Fonds', 'Mares Claires', 'Fond-Noir', 'Palus',
    'Eaux Calmes', 'Vase-Basse', 'Gué-Bourbe', 'Marécage', 'Sagne Froide', 'Brume-Lac',
  ],
  'Montagne Escarpée': [
    'Pic Faucon', 'Crête d\'Ardoise', 'Col du Vent', 'Éperon de Fer', 'Dent Granite', 'Gorge Froide',
    'Mont-Aigu', 'Val-Pierre', 'Roc-Noir', 'Aiguille', 'Col-Gris', 'Pierre-Haute',
    'Cime Blanche', 'Corbeau', 'Brèche Sèche', 'Haut-Col', 'Pente Grise', 'Roc-Fendu',
    'Crête Froide', 'Val-Fer', 'Mont-Sombre', 'Passe Haute', 'Éboulis Gris', 'Dent Froide',
  ],
  'Désert Aride': [
    'Erg Rouge', 'Reg Pierres', 'Dunes Sèches', 'Oued Tari', 'Plateau Sec', 'Cuvette Sel',
    'Sables Pâles', 'Rocailles', 'Canyon Ocre', 'Terre Brûlée', 'Bas-Sable', 'Éboulis',
    'Table Sèche', 'Piste Cendre', 'Désert Gris', 'Dune Basse', 'Val-Ocre', 'Sel-Blanc',
    'Fond-Sec', 'Roc-Aride', 'Plaine Chaude', 'Crevasse', 'Cendre-Blanche', 'Sol Fendu',
  ],
};

const NOMS_RIVIERES = [
  'La Claire',
  'L\'Argente',
  'La Grise',
  'Le Torrent d\'Ocre',
  'La Sèvre',
  'La Brumeuse',
  'L\'Aigue',
  'Le Ru du Nord',
];

const NOMS_MERS = [
  'Mer des Brumes',
  'Golfe d\'Ardoise',
  'Mer Intérieure',
  'Détroit du Levant',
  'Océan Pâle',
];

const CULTURES_PALETTE: Array<{ nom: string; couleur: string; couleurBord: string }> = [
  { nom: 'Francs du Val', couleur: '#e7d9b4', couleurBord: '#8a6220' },
  { nom: 'Clans des Crêtes', couleur: '#d3dce2', couleurBord: '#3b5c73' },
  { nom: 'Gens des Brumes', couleur: '#cfe0cb', couleurBord: '#3e6b48' },
  { nom: 'Nomades de l\'Erg', couleur: '#ebd0b3', couleurBord: '#9c4a24' },
];

const FACTIONS_PRESETS = [
  {
    id: 'faction_ligue_val',
    nom: 'Ligue des Cités Franches',
    posture: 'COMMERCE' as const,
    relationsJoueur: 'NEUTRE' as const,
    objectifs: ['Sécuriser les routes marchandes', 'Protéger les bourgs et greniers'],
  },
  {
    id: 'faction_ordre_fer',
    nom: 'Ordre du Bastion',
    posture: 'DEFENSE' as const,
    relationsJoueur: 'NEUTRE' as const,
    objectifs: ['Tenir les passes fortifiées', 'Lever l\'octroi sur les cols'],
  },
  {
    id: 'faction_clans_errants',
    nom: 'Horde des Confins',
    posture: 'RAID' as const,
    relationsJoueur: 'HOSTILE' as const,
    objectifs: ['Piller les convois isolés', 'Étendre les camps frontaliers'],
  },
  {
    id: 'faction_guilde_rivage',
    nom: 'Comptoir des Rivages',
    posture: 'EXPANSION' as const,
    relationsJoueur: 'NEUTRE' as const,
    objectifs: ['Relier les ports et bacs fluviaux', 'Contrôler les mines de piedmont'],
  },
];

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/** Bruit 2D cohérent et déterministe (Value noise multi-octaves style Azgaar) */
function noise2D(x: number, y: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;

  const smooth = (t: number) => t * t * (3 - 2 * t);
  const u = smooth(xf);
  const v = smooth(yf);

  const hashCorner = (cx: number, cy: number) => {
    const h = hashString(`${seed}:${cx}:${cy}`);
    return (h % 10000) / 10000;
  };

  const a = hashCorner(xi, yi);
  const b = hashCorner(xi + 1, yi);
  const c = hashCorner(xi, yi + 1);
  const d = hashCorner(xi + 1, yi + 1);

  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}

function fbmNoise(x: number, y: number, seed: number): number {
  const n1 = noise2D(x, y, seed);
  const n2 = noise2D(x * 2.05 + 13.7, y * 2.05 - 9.2, seed + 101) * 0.5;
  const n3 = noise2D(x * 4.1 - 5.4, y * 4.1 + 19.3, seed + 307) * 0.25;
  return (n1 + n2 + n3) / 1.75;
}

function calculerAltitudeTemplate(
  q: number,
  r: number,
  rayon: number,
  modele: AzgaarReliefPreset,
  seed: number
): number {
  // Coordonnées cartésiennes normalisées dans [-1, 1]
  const px = (Math.sqrt(3) * (q + r / 2)) / (Math.max(1, rayon) * Math.sqrt(3));
  const py = (1.5 * r) / (Math.max(1, rayon) * 1.5);
  const distNorm = Math.hypot(px, py);

  const fbm = fbmNoise(px * 1.9 + 4.2, py * 1.9 + 2.8, seed);
  const ridge = 1 - Math.abs(fbmNoise(px * 1.4 - 2.1, py * 1.4 + 6.4, seed + 77) * 2 - 1);

  let alt = 35;

  if (modele === 'continent') {
    const falloff = Math.max(0, 1 - Math.pow(distNorm / 0.96, 2.2));
    alt = 10 + falloff * 52 + fbm * 28 + ridge * 16;
    if (distNorm >= 0.92) alt -= 26;
  } else if (modele === 'archipel') {
    const baseIslands = fbm * 58 + ridge * 24 - distNorm * 20;
    alt = baseIslands;
    // Assurer un îlot central jouable autour de (0,0)
    if (distNorm < 0.36) alt = Math.max(alt, 28 + fbm * 24);
  } else if (modele === 'peninsule') {
    // Terre au nord-est s'avançant vers le centre, mer au sud et à l'ouest
    const axeterre = (px * 0.45 - py * 0.55 + 0.55);
    alt = 6 + axeterre * 36 + fbm * 30 + ridge * 18;
    if (distNorm >= 0.94 && (px < 0.2 || py > 0)) alt -= 20;
  } else if (modele === 'monts') {
    // Grande cordillère diagonale + vallées en contrebas
    const spine = Math.max(0, 1 - Math.abs(px + py * 0.6) * 1.4);
    alt = 14 + spine * 48 + ridge * 24 + fbm * 18 - (distNorm > 0.88 ? 22 : 0);
  } else {
    // 'vallee' : cuvette fertile bordée de crêtes nord/ouest et baie au sud-ouest
    const rim = distNorm > 0.45 && py < 0.35 ? 28 : 0;
    const gulf = px < -0.25 && py > 0.35 ? -30 : 0;
    alt = 24 + fbm * 26 + rim + gulf + ridge * 12;
  }

  return clamp(Math.round(alt), 2, 98);
}

function classifierBiomeAzgaar(
  terrain: TerrainType,
  alt: number,
  precip: number,
  tempC: number,
  estEau: boolean,
  estRivage: boolean
): { biome: string; terrainFinal: TerrainType } {
  if (estEau) return { biome: 'Mer', terrainFinal: 'Plaine / Route' };

  if (alt >= 66) {
    return {
      biome: tempC <= 2 ? 'Alpin enneigé' : 'Massif rocheux',
      terrainFinal: 'Montagne Escarpée',
    };
  }
  if (alt <= 24 && precip >= 62 && tempC >= 5) {
    return { biome: 'Marécage', terrainFinal: 'Marais Fétide' };
  }
  if (tempC <= 1) {
    if (precip >= 45) return { biome: 'Taïga', terrainFinal: 'Forêt Dense' };
    return { biome: 'Toundra', terrainFinal: 'Plaine / Route' };
  }
  if (precip <= 24 && tempC >= 14) {
    return { biome: 'Désert chaud', terrainFinal: 'Désert Aride' };
  }
  if (precip >= 56) {
    return {
      biome: tempC <= 7 ? 'Forêt boréale' : 'Forêt tempérée',
      terrainFinal: 'Forêt Dense',
    };
  }
  if (estRivage && precip >= 34) {
    return { biome: 'Côte tempérée', terrainFinal: 'Plaine / Route' };
  }
  if (tempC >= 18 && precip < 40) {
    return { biome: 'Savane sèche', terrainFinal: 'Plaine / Route' };
  }
  return { biome: 'Prairie', terrainFinal: 'Plaine / Route' };
}

function construireIdHex(q: number, r: number): string {
  const sq = q < 0 ? `m${Math.abs(q)}` : `${q}`;
  const sr = r < 0 ? `m${Math.abs(r)}` : `${r}`;
  return `hex_${sq}_${sr}`;
}

function securitePourHex(pression: number, estBourgade: boolean): SecurityLevel {
  if (estBourgade && pression < 40) return 'Sûr';
  if (pression < 22) return 'Sûr';
  if (pression < 45) return 'Patrouillé';
  if (pression < 75) return 'Dangereux';
  return 'Périlleux';
}

/**
 * Synthétise une métadonnée Azgaar propre pour un état existant (ex: Val-Gris initial)
 * afin que les outils Atlas du MJ et la cartographie opèrent de façon uniforme.
 */
export function extraireMetadataAzgaarDepuisEtat(etat: SimulationState): AzgaarMapMetadata {
  if (etat.carteAzgaar) {
    return etat.carteAzgaar;
  }
  const hexes = etat.hexagones;
  const bourg = hexes.find(h => h.id === 'hex_0000_bourgade') || hexes[0];
  const montagne = hexes.find(h => h.id === 'hex_m100_montagne');
  const mine = hexes.find(h => h.id === 'hex_0100_mine');
  const marais = hexes.find(h => h.id === 'hex_m101_marais');
  const route = hexes.find(h => h.id === 'hex_00m1_route');
  const foret = hexes.find(h => h.id === 'hex_0001_foret');

  const rivieres: AzgaarRiverDef[] = [];
  if (montagne && bourg && marais) {
    rivieres.push({
      id: 'riv_grise_amont',
      nom: 'La Grise',
      hexIds: [montagne.id, bourg.id, marais.id],
      debit: Math.max(25, Math.round(((montagne.fluxHydro ?? 28) + (bourg.fluxHydro ?? 58) + (marais.fluxHydro ?? 85)) / 3)),
    });
  }
  if (mine && bourg) {
    rivieres.push({
      id: 'riv_affluent_est',
      nom: 'Ruisseau de Roche-Noire',
      hexIds: [mine.id, bourg.id],
      debit: Math.max(15, mine.fluxHydro ?? 22),
    });
  }
  if (marais) {
    rivieres.push({
      id: 'riv_delta_bras',
      nom: 'Bras de la Sangsue',
      hexIds: [marais.id],
      debit: Math.max(20, marais.fluxHydro ?? 70),
    });
  }

  const routes: AzgaarRoadDef[] = [];
  if (bourg && mine) routes.push({ id: 'road_fer', hexIds: [bourg.id, mine.id], kind: 'main' });
  if (bourg && route) routes.push({ id: 'road_nord', hexIds: [bourg.id, route.id], kind: 'main' });
  if (bourg && foret) routes.push({ id: 'trail_foret', hexIds: [bourg.id, foret.id], kind: 'trail' });
  if (bourg && montagne) routes.push({ id: 'trail_ouest', hexIds: [bourg.id, montagne.id], kind: 'trail' });

  const culturesSet = new Map<string, string>();
  for (const h of hexes) {
    if (h.culture && !culturesSet.has(h.culture)) {
      culturesSet.set(h.culture, h.id);
    }
  }
  const paletteDefault = [
    { couleur: '#e7d9b4', couleurBord: '#8a6220' },
    { couleur: '#d3dce2', couleurBord: '#3b5c73' },
    { couleur: '#cfe0cb', couleurBord: '#3e6b48' },
    { couleur: '#ebd0b3', couleurBord: '#9c4a24' },
  ];
  const cultures: AzgaarCultureDef[] = Array.from(culturesSet.entries()).map(([nom, centreHexId], idx) => ({
    id: `cult_${idx + 1}`,
    nom,
    couleur: paletteDefault[idx % paletteDefault.length].couleur,
    couleurBord: paletteDefault[idx % paletteDefault.length].couleurBord,
    centreHexId,
  }));

  return {
    seed: 42071,
    nomMonde: 'Marches de Val-Gris',
    modeleRelief: 'vallee',
    climatBias: 'tempere',
    rayonAnneaux: 1,
    niveauMer: 20,
    rivieres,
    routes,
    cultures,
    labelsMer: [{ nom: 'Mer des Brumes', q: -1, r: 2 }],
  };
}

/**
 * Génère un monde complet style Azgaar Fantasy Map Generator prêt pour la simulation D&D 5e :
 * Heightmap + Mer/Rivage -> Climat/Pluie -> Drainage & Rivières -> Biomes -> Cultures -> Burgs/Factions -> Routes Dijkstra -> Graphe & Entités.
 */
export function genererMondeAzgaar(
  config: AzgaarGenerationConfig,
  baseState: SimulationState = INITIAL_SIMULATION_STATE
): SimulationState {
  const seed = Math.max(1, Math.trunc(Number(config.seed) || 104729));
  const rng = createSeededRng(seed);
  const modeleRelief: AzgaarReliefPreset = config.modeleRelief || 'continent';
  const climatBias: AzgaarClimateBias = config.climatBias || 'tempere';
  const rayon = clamp(Math.trunc(Number(config.rayonAnneaux) || 3), 2, 4);
  const niveauMer = modeleRelief === 'archipel' ? 26 : modeleRelief === 'monts' ? 18 : 20;

  const nomMonde =
    (config.nomMonde || '').trim() ||
    `${NOMS_MONDES_PREFIX[Math.floor(rng() * NOMS_MONDES_PREFIX.length)]} ${
      NOMS_MONDES_SUFFIX[Math.floor(rng() * NOMS_MONDES_SUFFIX.length)]
    }`;

  // 1. Grille axiale de hexagones + Heightmap
  const hexes: HexNode[] = [];
  const parCoord = new Map<string, HexNode>();

  for (let q = -rayon; q <= rayon; q++) {
    const r1 = Math.max(-rayon, -q - rayon);
    const r2 = Math.min(rayon, -q + rayon);
    for (let r = r1; r <= r2; r++) {
      const id = construireIdHex(q, r);
      const altitude = calculerAltitudeTemplate(q, r, rayon, modeleRelief, seed);
      const estEau = altitude <= niveauMer;
      const hex: HexNode = {
        id,
        q,
        r,
        nom: estEau ? 'Eaux côtières' : `Secteur [${q},${r}]`,
        terrain: 'Plaine / Route',
        securite: estEau ? 'Sûr' : 'Dangereux',
        factionControleId: null,
        visite: false,
        ressourcesEau: false,
        ressourcesGibier: !estEau,
        brouillard: 'INCONNU',
        altitude,
        estEau,
        estRivage: false,
        pressionDanger: estEau ? 0 : 42,
        prosperite: estEau ? 0 : 25,
        niveauEau: estEau ? 100 : 40,
        populationGibier: estEau ? 0 : 45,
        population: 0,
        garnison: 0,
        routeNiveau: 'AUCUNE',
      };
      hexes.push(hex);
      parCoord.set(`${q},${r}`, hex);
    }
  }

  // Garantir un noyau de départ jouable (terre émergée + au moins 3 voisins terrestres) autour de (0,0)
  const origine = parCoord.get('0,0')!;
  if (origine.estEau) {
    origine.altitude = 28;
    origine.estEau = false;
  }
  const voisinsOrigine = AXIAL_DIRECTIONS.map(d => parCoord.get(`${d.dq},${d.dr}`)).filter(
    (h): h is HexNode => Boolean(h)
  );
  let nbTerresAutour = voisinsOrigine.filter(v => !v.estEau).length;
  for (const v of voisinsOrigine) {
    if (nbTerresAutour >= 3) break;
    if (v.estEau) {
      v.estEau = false;
      v.altitude = 26 + Math.round(rng() * 14);
      nbTerresAutour++;
    }
  }

  // Marquer les rivages (terre adjacente à une cellule d'eau)
  for (const h of hexes) {
    if (h.estEau) continue;
    const voisins = AXIAL_DIRECTIONS.map(d => parCoord.get(`${h.q + d.dq},${h.r + d.dr}`)).filter(
      (v): v is HexNode => Boolean(v)
    );
    h.estRivage = voisins.some(v => v.estEau);
  }

  // 2. Climat (vents d'ouest + ombre pluviométrique + biais climatique)
  const horlogeSimulee = {
    ...baseState.horloge,
    tick: 1,
    jour: 1,
    heure: 8,
    meteo: 'Ciel dégagé' as const,
    temperature: (climatBias === 'boreal' ? 'Glacial' : climatBias === 'aride' ? 'Torride' : 'Tempéré') as
      | 'Tempéré'
      | 'Glacial'
      | 'Torride',
    saison: 'Automne' as const,
  };
  simulerClimatEtHydrologie(hexes, horlogeSimulee);

  for (const h of hexes) {
    const tempMod = climatBias === 'boreal' ? -9 : climatBias === 'aride' ? +8 : 0;
    const precipMod = climatBias === 'aride' ? -22 : climatBias === 'boreal' ? -4 : +4;
    h.temperatureC = (h.temperatureC ?? 12) + tempMod;
    h.precipitations = clamp((h.precipitations ?? 45) + precipMod, 4, 98);
    if (h.estEau) {
      h.fluxHydro = 0;
      h.precipitations = 70;
    }
  }

  // 3. Hydrologie Azgaar : tracé descendant des cours d'eau vers la mer ou les bas-fonds
  const terres = hexes.filter(h => !h.estEau);
  const flowTarget = new Map<string, string | null>();
  const fluxBrut = new Map<string, number>();

  for (const h of terres) {
    const precip = h.precipitations ?? 45;
    fluxBrut.set(h.id, Math.max(4, Math.round(precip * 0.34)));
  }

  const terresDesc = [...terres].sort((a, b) => (b.altitude ?? 30) - (a.altitude ?? 30));
  for (const h of terresDesc) {
    const voisins = AXIAL_DIRECTIONS.map(d => parCoord.get(`${h.q + d.dq},${h.r + d.dr}`)).filter(
      (v): v is HexNode => Boolean(v)
    );
    // Privilégier l'eau côtière en premier ou le voisin d'altitude inférieure
    const merVoisine = voisins.find(v => v.estEau);
    if (merVoisine) {
      flowTarget.set(h.id, merVoisine.id);
      continue;
    }
    const plusBas = voisins
      .filter(v => (v.altitude ?? 30) < (h.altitude ?? 30))
      .sort((a, b) => (a.altitude ?? 30) - (b.altitude ?? 30));
    if (plusBas.length > 0) {
      const cible = plusBas[0];
      flowTarget.set(h.id, cible.id);
      fluxBrut.set(cible.id, (fluxBrut.get(cible.id) || 0) + Math.round((fluxBrut.get(h.id) || 0) * 0.72));
    } else {
      // Dépression : combler légèrement ou diriger vers le voisin le moins haut s'il ne boucle pas
      const minVoisin = [...voisins].sort((a, b) => (a.altitude ?? 30) - (b.altitude ?? 30))[0];
      if (minVoisin && flowTarget.get(minVoisin.id) !== h.id) {
        flowTarget.set(h.id, minVoisin.id);
        fluxBrut.set(
          minVoisin.id,
          (fluxBrut.get(minVoisin.id) || 0) + Math.round((fluxBrut.get(h.id) || 0) * 0.55)
        );
      } else {
        flowTarget.set(h.id, null);
      }
    }
  }

  for (const h of terres) {
    h.fluxHydro = clamp(fluxBrut.get(h.id) ?? 12, 2, 100);
    h.ressourcesEau = (h.fluxHydro >= 28 || (h.precipitations ?? 40) >= 52);
  }

  // Extraire les rivières principales (chaines continues jusqu'à l'embouchure)
  const dejaEnRiviere = new Set<string>();
  const rivieres: AzgaarRiverDef[] = [];
  const sourcesPotentielles = [...terres]
    .filter(h => (h.fluxHydro ?? 0) >= 24 && (h.altitude ?? 30) >= 34)
    .sort((a, b) => (b.altitude ?? 30) - (a.altitude ?? 30));

  let riverIdx = 0;
  for (const src of sourcesPotentielles) {
    if (rivieres.length >= 4) break;
    if (dejaEnRiviere.has(src.id)) continue;

    const chaine: string[] = [src.id];
    const visites = new Set<string>([src.id]);
    let curId: string | null = flowTarget.get(src.id) || null;

    while (curId && !visites.has(curId)) {
      visites.add(curId);
      const cell = hexes.find(x => x.id === curId);
      if (!cell) break;
      if (cell.estEau) {
        // S'arrêter sur la dernière terre ou inclure embouchure côtière
        break;
      }
      chaine.push(cell.id);
      if (dejaEnRiviere.has(cell.id)) break; // Confluence avec rivière existante
      curId = flowTarget.get(cell.id) || null;
    }

    if (chaine.length >= 2) {
      const nomRiv = NOMS_RIVIERES[riverIdx % NOMS_RIVIERES.length];
      const rId = `riv_az_${seed}_${riverIdx + 1}`;
      const debitMax = Math.max(
        22,
        ...chaine.map(cid => hexes.find(x => x.id === cid)?.fluxHydro ?? 25)
      );
      rivieres.push({
        id: rId,
        nom: nomRiv,
        hexIds: chaine,
        debit: debitMax,
      });
      for (const cid of chaine) {
        dejaEnRiviere.add(cid);
        const cx = hexes.find(x => x.id === cid);
        if (cx && !cx.bassinHydroId) cx.bassinHydroId = rId;
        if (cx) cx.ressourcesEau = true;
      }
      riverIdx++;
    }
  }

  // Fallback si archipel ou plateau plat sans grande source : assurer au moins 1 ruisseau sur la plus grande vallée
  if (rivieres.length === 0 && terres.length >= 3) {
    const plusHaut = [...terres].sort((a, b) => (b.altitude ?? 0) - (a.altitude ?? 0))[0];
    const voisinBas = AXIAL_DIRECTIONS.map(d => parCoord.get(`${plusHaut.q + d.dq},${plusHaut.r + d.dr}`))
      .filter((v): v is HexNode => Boolean(v && !v.estEau))
      .sort((a, b) => (a.altitude ?? 0) - (b.altitude ?? 0))[0];
    if (voisinBas) {
      rivieres.push({
        id: `riv_az_${seed}_1`,
        nom: NOMS_RIVIERES[0],
        hexIds: [plusHaut.id, voisinBas.id],
        debit: Math.max(28, voisinBas.fluxHydro ?? 34),
      });
      plusHaut.fluxHydro = Math.max(plusHaut.fluxHydro ?? 20, 26);
      voisinBas.fluxHydro = Math.max(voisinBas.fluxHydro ?? 25, 42);
      voisinBas.ressourcesEau = true;
    }
  }

  // 4. Classification des biomes Whittaker + nommage topographique initial
  const terrainCounters: Record<TerrainType, number> = {
    'Plaine / Route': 0,
    'Forêt Dense': 0,
    'Marais Fétide': 0,
    'Montagne Escarpée': 0,
    'Désert Aride': 0,
  };

  for (const h of hexes) {
    const cls = classifierBiomeAzgaar(
      h.terrain,
      h.altitude ?? 30,
      h.precipitations ?? 45,
      h.temperatureC ?? 12,
      Boolean(h.estEau),
      Boolean(h.estRivage)
    );
    h.biomeAzgaar = cls.biome;
    h.terrain = cls.terrainFinal;
    if (!h.estEau) {
      const pool = NOMS_LIEUX_PAR_TERRAIN[h.terrain];
      const idx = terrainCounters[h.terrain]++;
      const suffixe = idx >= pool.length ? ` ${Math.floor(idx / pool.length) + 1}` : '';
      h.nom = `${pool[idx % pool.length]}${suffixe}`;
      h.ressourcesGibier = h.terrain === 'Forêt Dense' || h.terrain === 'Plaine / Route';
      h.niveauEau = clamp((h.fluxHydro ?? 20) + (h.ressourcesEau ? 25 : 0), 5, 95);
      h.populationGibier = h.terrain === 'Forêt Dense' ? 78 : h.terrain === 'Plaine / Route' ? 58 : 20;
    }
  }

  // 5. Cultures (Voronoi sur 3 ou 4 foyers culturels)
  const nbCultures = rayon >= 3 ? 4 : 3;
  const foyersCulture: AzgaarCultureDef[] = [];
  const candidatsFoyer = [...terres].sort((a, b) => calculerDistanceHex(b, origine) - calculerDistanceHex(a, origine));
  const centresChoisis: HexNode[] = [origine];

  for (let i = 1; i < nbCultures; i++) {
    let meilleur: HexNode | null = null;
    let meilleurScore = -1;
    for (const cand of candidatsFoyer) {
      if (centresChoisis.some(c => c.id === cand.id)) continue;
      const minDist = Math.min(...centresChoisis.map(c => calculerDistanceHex(cand, c)));
      if (minDist > meilleurScore) {
        meilleurScore = minDist;
        meilleur = cand;
      }
    }
    if (meilleur) centresChoisis.push(meilleur);
  }

  centresChoisis.forEach((centre, idx) => {
    const preset = CULTURES_PALETTE[idx % CULTURES_PALETTE.length];
    foyersCulture.push({
      id: `cult_${idx + 1}`,
      nom: preset.nom,
      couleur: preset.couleur,
      couleurBord: preset.couleurBord,
      centreHexId: centre.id,
    });
  });

  for (const h of terres) {
    let bestCult = foyersCulture[0];
    let bestDist = Infinity;
    for (const c of foyersCulture) {
      const centre = terres.find(t => t.id === c.centreHexId);
      if (!centre) continue;
      const d = calculerDistanceHex(h, centre) + (h.terrain === 'Montagne Escarpée' ? 0.4 : 0);
      if (d < bestDist) {
        bestDist = d;
        bestCult = c;
      }
    }
    h.culture = bestCult.nom;
  }

  // 6. Scoring d'habitabilité -> Capitale de départ, Bourgs, Forts, Mines, Ruines, Camps
  const scoreHabitabilite = (h: HexNode): number => {
    if (h.estEau) return -999;
    let s = 30;
    if (h.terrain === 'Plaine / Route') s += 26;
    else if (h.terrain === 'Forêt Dense') s += 10;
    else if (h.terrain === 'Marais Fétide') s -= 16;
    else if (h.terrain === 'Désert Aride') s -= 18;
    else if (h.terrain === 'Montagne Escarpée') s -= 14;
    if (h.estRivage) s += 14;
    s += Math.round((h.fluxHydro ?? 15) * 0.4);
    const alt = h.altitude ?? 30;
    if (alt >= 22 && alt <= 45) s += 10;
    return s;
  };

  // Capitale de départ : préférer (0,0) ou meilleur hex habitable au centre
  const candidatsDepart = [origine, ...voisinsOrigine.filter(v => !v.estEau)].sort(
    (a, b) => scoreHabitabilite(b) - scoreHabitabilite(a)
  );
  const hexDepart = candidatsDepart[0] || origine;
  hexDepart.terrain = 'Plaine / Route';
  hexDepart.biomeAzgaar = hexDepart.estRivage ? 'Côte tempérée' : 'Prairie';

  const nomsUtilises = new Set<string>();
  const prendreNomBourg = () => {
    for (let i = 0; i < NOMS_BOURGS.length * 2; i++) {
      const cand = NOMS_BOURGS[(Math.floor(rng() * NOMS_BOURGS.length) + i) % NOMS_BOURGS.length];
      if (!nomsUtilises.has(cand)) {
        nomsUtilises.add(cand);
        return cand;
      }
    }
    return `Bourg-${nomsUtilises.size + 1}`;
  };

  const nomCapitale = prendreNomBourg();
  hexDepart.nom = nomCapitale;
  hexDepart.pointInteret = {
    id: `poi_cap_${hexDepart.id}`,
    nom: `Bourgade de ${nomCapitale}`,
    type: 'bourgade',
    statut: 'OPERATIONNEL',
  };
  hexDepart.population = 1150 + Math.round(rng() * 450);
  hexDepart.garnison = 68;
  hexDepart.prosperite = 76;
  hexDepart.pressionDanger = 10;
  hexDepart.routeNiveau = 'ROUTE';

  // Factions & autres capitales / sites
  const nbFactions = rayon >= 3 ? 4 : 3;
  const factions: Faction[] = [];
  const capitalesFactions: HexNode[] = [hexDepart];

  for (let i = 1; i < nbFactions; i++) {
    const candidats = terres
      .filter(
        t =>
          !t.pointInteret &&
          capitalesFactions.every(c => calculerDistanceHex(t, c) >= 2)
      )
      .sort((a, b) => scoreHabitabilite(b) - scoreHabitabilite(a));
    if (candidats.length > 0) {
      const cap = candidats[0];
      capitalesFactions.push(cap);
      const isRaider = i === 2;
      const isBastion = i === 1;
      const nomSite = prendreNomBourg();
      if (isRaider) {
        cap.nom = `Camp ${nomSite}`;
        cap.pointInteret = {
          id: `poi_camp_${cap.id}`,
          nom: `Campement fortifié de ${nomSite}`,
          type: 'camp',
          statut: 'OCCUPIED',
        };
        cap.population = 210 + Math.round(rng() * 90);
        cap.garnison = 58;
        cap.pressionDanger = 78;
      } else if (isBastion) {
        cap.nom = `Fort ${nomSite}`;
        cap.pointInteret = {
          id: `poi_fort_${cap.id}`,
          nom: `Citadelle de ${nomSite}`,
          type: 'fort',
          statut: 'OPERATIONNEL',
        };
        cap.population = 320 + Math.round(rng() * 140);
        cap.garnison = 74;
        cap.pressionDanger = 28;
      } else {
        cap.nom = nomSite;
        cap.pointInteret = {
          id: `poi_bourg_${cap.id}`,
          nom: `Comptoir de ${nomSite}`,
          type: 'bourgade',
          statut: 'OPERATIONNEL',
        };
        cap.population = 780 + Math.round(rng() * 320);
        cap.garnison = 56;
        cap.pressionDanger = 18;
      }
      cap.prosperite = isRaider ? 22 : 64;
      cap.routeNiveau = isRaider ? 'PISTE' : 'ROUTE';
    }
  }

  // Ajouter 1-2 mines sur les plus hauts monts + 1-2 ruines/camps sur les terres reculées
  const montagnesLibres = terres
    .filter(t => !t.pointInteret && t.terrain === 'Montagne Escarpée')
    .sort((a, b) => (b.altitude ?? 0) - (a.altitude ?? 0));
  if (montagnesLibres[0]) {
    const mHex = montagnesLibres[0];
    mHex.nom = `Mine de ${mHex.nom}`;
    mHex.pointInteret = {
      id: `poi_mine_${mHex.id}`,
      nom: 'Filon de fer actif',
      type: 'mine',
      statut: 'OPERATIONNEL',
    };
    mHex.population = 220;
    mHex.garnison = 40;
    mHex.prosperite = 65;
    mHex.routeNiveau = 'ROUTE';
  }

  const terresReculees = terres
    .filter(t => !t.pointInteret && calculerDistanceHex(t, hexDepart) >= 2)
    .sort((a, b) => calculerDistanceHex(b, hexDepart) - calculerDistanceHex(a, hexDepart));
  if (terresReculees[0]) {
    const rHex = terresReculees[0];
    rHex.pointInteret = {
      id: `poi_ruine_${rHex.id}`,
      nom: `Ruines de ${rHex.nom}`,
      type: 'ruine',
      statut: 'RUINED',
    };
    rHex.pressionDanger = 64;
    rHex.population = 18;
  }
  if (terresReculees[1]) {
    const cHex = terresReculees[1];
    cHex.pointInteret = {
      id: `poi_camp_${cHex.id}`,
      nom: `Avant-poste de ${cHex.nom}`,
      type: 'camp',
      statut: 'ABANDONNE',
    };
    cHex.pressionDanger = 54;
    cHex.population = 32;
  }

  // Instancier les Factions et étendre leur contrôle initial (Azgaar Voronoi + expansion score)
  for (let i = 0; i < capitalesFactions.length; i++) {
    const preset = FACTIONS_PRESETS[i % FACTIONS_PRESETS.length];
    const cap = capitalesFactions[i];
    cap.factionControleId = preset.id;

    const f: Faction = {
      id: preset.id,
      nom: preset.nom,
      richesse: i === 0 ? 90 : i === 2 ? 25 : 60,
      forceMilitaire: i === 1 ? 70 : i === 2 ? 62 : 45,
      influence: i === 0 ? 75 : 48,
      objectifs: [...preset.objectifs],
      noeudsControles: [cap.id],
      relationsJoueur: preset.relationsJoueur,
      posture: preset.posture,
      moral: 70,
      effectifActif: `Garnison de ${cap.nom}`,
      capitaleHexId: cap.id,
      cultureDominante: cap.culture || foyersCulture[0].nom,
      populationTotale: cap.population || 300,
      forceMax: 85,
      lassitudeGuerre: 10,
      revenuFiscal: 24,
      relationsFactions: {},
    };
    factions.push(f);
  }

  for (const f of factions) {
    for (const other of factions) {
      if (f.id === other.id) continue;
      if (f.id === 'faction_clans_errants' || other.id === 'faction_clans_errants') {
        f.relationsFactions![other.id] = 'GUERRE';
      } else if (f.id === 'faction_ligue_val' && other.id === 'faction_ordre_fer') {
        f.relationsFactions![other.id] = 'TENSION';
      } else {
        f.relationsFactions![other.id] = 'NEUTRE';
      }
    }
  }

  // Expansion territoriale initiale d'un anneau autour de chaque capitale selon evaluerScoreExpansionAzgaar
  for (const h of terres) {
    if (h.factionControleId) continue;
    let bestFaction: Faction | null = null;
    let bestScore = -10;
    for (const f of factions) {
      const cap = terres.find(t => t.id === f.capitaleHexId);
      if (!cap || calculerDistanceHex(cap, h) > 2) continue;
      const sc = evaluerScoreExpansionAzgaar(f, h, hexes);
      if (sc > bestScore) {
        bestScore = sc;
        bestFaction = f;
      }
    }
    if (bestFaction && bestScore >= 0) {
      h.factionControleId = bestFaction.id;
    }
  }
  synchroniserControleFactions(factions, hexes);

  // Peuplement & Sécurité finaux des hexagones terrestres
  for (const h of terres) {
    if (!h.pointInteret) {
      h.population = h.factionControleId
        ? 55 + Math.round(rng() * 65)
        : 18 + Math.round(rng() * 35);
      h.garnison = h.factionControleId ? 24 : 8;
      if (h.factionControleId === 'faction_clans_errants') {
        h.pressionDanger = Math.max(h.pressionDanger ?? 45, 72);
      } else if (h.factionControleId) {
        h.pressionDanger = Math.min(h.pressionDanger ?? 30, 28);
      } else {
        h.pressionDanger = clamp((h.terrain === 'Désert Aride' ? 62 : 42) + Math.round(rng() * 18), 20, 82);
      }
    }
    h.securite = securitePourHex(h.pressionDanger ?? 35, h.pointInteret?.type === 'bourgade');
    h.provinceNom = h.culture;
  }

  for (const f of factions) {
    const popF = hexes
      .filter(h => h.factionControleId === f.id)
      .reduce((acc, h) => acc + (h.population ?? 60), 0);
    f.populationTotale = Math.max(120, popF);
    f.forceMax = clamp(Math.round(45 + Math.sqrt(f.populationTotale) * 1.4), 50, 120);
  }

  // 7. Réseau routier procédural par Dijkstra entre les sites majeurs
  const routes: AzgaarRoadDef[] = [];
  const sitesMajeurs = terres.filter(
    h => h.id !== hexDepart.id && h.pointInteret && h.pointInteret.type !== 'ruine'
  );
  sitesMajeurs.forEach((dest, idx) => {
    const resRoute = calculerItinerairePondere(hexDepart.id, dest.id, hexes, 'CARAVANE');
    if (resRoute.chemin.length >= 2 && resRoute.coutTotal < 900) {
      const kind: 'main' | 'trail' =
        dest.pointInteret?.type === 'bourgade' ||
        dest.pointInteret?.type === 'fort' ||
        dest.pointInteret?.type === 'mine'
          ? 'main'
          : 'trail';
      routes.push({
        id: `road_az_${seed}_${idx + 1}`,
        hexIds: resRoute.chemin,
        kind,
      });
      for (const hid of resRoute.chemin) {
        const hx = hexes.find(x => x.id === hid);
        if (hx && !hx.estEau) {
          if (kind === 'main') {
            hx.routeNiveau = 'ROUTE';
          } else if (hx.routeNiveau === 'AUCUNE') {
            hx.routeNiveau = 'PISTE';
          }
        }
      }
    }
  });

  // 8. Brouillard de guerre initial (départ EXPLORE, adjacents REPERE, reste INCONNU)
  for (const h of hexes) {
    const d = calculerDistanceHex(hexDepart, h);
    if (d === 0) {
      h.visite = true;
      h.brouillard = 'EXPLORE';
    } else if (d === 1) {
      h.brouillard = 'REPERE';
    } else {
      h.brouillard = 'INCONNU';
    }
  }

  // 9. Graphe GraphRAG : Lieux, Liens ADJACENT_TO, PNJ locaux & régionaux
  const grapheNoeuds: GraphNode[] = [];
  const grapheLiens: GraphEdge[] = [];

  for (const h of hexes) {
    grapheNoeuds.push({
      id: h.id,
      type: 'Location',
      label: h.nom,
      proprietes: {
        q: h.q,
        r: h.r,
        terrain: h.terrain,
        estEau: Boolean(h.estEau),
        biomeAzgaar: h.biomeAzgaar,
      },
    });
  }

  for (let i = 0; i < hexes.length; i++) {
    for (let j = i + 1; j < hexes.length; j++) {
      if (!hexes[i].estEau && !hexes[j].estEau && calculerDistanceHex(hexes[i], hexes[j]) === 1) {
        grapheLiens.push({
          source: hexes[i].id,
          cible: hexes[j].id,
          relation: 'ADJACENT_TO',
        });
      }
    }
  }

  const pnjsDepart: Array<{ id: string; label: string; prof: string; align: string; dd: number; rumeurTitre: string; rumeurTexte: string; suggestions: string[] }> = [
    {
      id: `npc_forgeron_${seed}`,
      label: 'Torvin le Forgeron',
      prof: `Maître-forgeron de ${nomCapitale}`,
      align: 'Neutre Bon',
      dd: 13,
      rumeurTitre: 'Voies et minerai',
      rumeurTexte: `Les convois arrivant à ${nomCapitale} rapportent des escarmouches près des passes extérieures.`,
      suggestions: ['Parler de son travail à la forge', 'Demander d où vient le minerai', 'Prendre des nouvelles du bourg'],
    },
    {
      id: `npc_bailli_${seed}`,
      label: 'Bailli Rogar',
      prof: `Magistrat de ${nomCapitale}`,
      align: 'Loyal Neutre',
      dd: 13,
      rumeurTitre: 'Pistes des environs',
      rumeurTexte: `Le bailliage paie quiconque relève des passages praticables autour de ${nomCapitale}.`,
      suggestions: ['Consulter les contrats du bourg', 'Demander un sauf-conduit', 'Signaler une menace'],
    },
    {
      id: `npc_guetteur_${seed}`,
      label: 'Sentinelle Elia',
      prof: 'Éclaireuse des remparts',
      align: 'Neutre',
      dd: 12,
      rumeurTitre: 'Mouvements aux frontières',
      rumeurTexte: `Des colonnes de fumée ont été vues au-delà des premières lieues de ${nomCapitale}.`,
      suggestions: ['Demander l\'état des routes', 'Repérer les cours d\'eau voisins', 'Se renseigner sur les patrouilles'],
    },
  ];

  for (const pnj of pnjsDepart) {
    grapheNoeuds.push({
      id: pnj.id,
      type: 'Actor',
      label: pnj.label,
      proprietes: {
        profession: pnj.prof,
        alignement: pnj.align,
        seuilTolerance: 45,
        seuilDD: pnj.dd,
        hexId: hexDepart.id,
        suggestions: pnj.suggestions,
        rumeursConnues: [
          {
            id: `rum_${pnj.id}`,
            titre: pnj.rumeurTitre,
            texte: pnj.rumeurTexte,
          },
        ],
      },
      connuParEntites: [hexDepart.id],
    });
    grapheLiens.push({ source: pnj.id, cible: hexDepart.id, relation: 'LOCATED_IN' });
  }

  // Ajouter 1 PNJ notable dans le second site (Fort ou autre Bourg)
  if (capitalesFactions[1]) {
    const fortHex = capitalesFactions[1];
    const cmdId = `npc_cmd_${seed}`;
    grapheNoeuds.push({
      id: cmdId,
      type: 'Actor',
      label: 'Capitaine Morn',
      proprietes: {
        profession: `Commandant de ${fortHex.nom}`,
        alignement: 'Loyal Neutre',
        seuilTolerance: 35,
        seuilDD: 14,
        hexId: fortHex.id,
        suggestions: ['Négocier le passage', 'Proposer une escorte', 'Sonder les tensions'],
        rumeursConnues: [],
      },
      connuParEntites: [fortHex.id],
    });
    grapheLiens.push({ source: cmdId, cible: fortHex.id, relation: 'LOCATED_IN' });
  }

  const evtFondationId = `event_atlas_${seed}`;
  grapheNoeuds.push({
    id: evtFondationId,
    type: 'Event',
    label: `Cartographie de ${nomMonde}`,
    proprietes: { horodatageTick: 0, description: `Relevé initial (${modeleRelief})` },
    connuParEntites: [hexDepart.id],
  });

  // 10. Entités autonomes sur les vraies routes Dijkstra
  const entitesMonde: WorldEntity[] = [];
  const cibleCaravane = sitesMajeurs[0] || capitalesFactions[1];
  if (cibleCaravane) {
    const routeC = calculerItinerairePondere(cibleCaravane.id, hexDepart.id, hexes, 'CARAVANE');
    entitesMonde.push({
      id: `ent_caravane_${seed}`,
      nom: `Convoi de ${nomCapitale}`,
      type: 'CARAVANE',
      factionId: factions[0].id,
      hexId: cibleCaravane.id,
      origineHexId: cibleCaravane.id,
      destinationHexId: hexDepart.id,
      itineraire: routeC.chemin,
      force: 5,
      cargaison: 'Minerai',
      statut: 'EN_ROUTE',
      tickCreation: 1,
    });
  }
  if (capitalesFactions[1]) {
    const cap1 = capitalesFactions[1];
    entitesMonde.push({
      id: `ent_patrouille_${seed}`,
      nom: `Patrouille de ${cap1.nom}`,
      type: 'PATROUILLE',
      factionId: factions[1]?.id || factions[0].id,
      hexId: cap1.id,
      origineHexId: cap1.id,
      destinationHexId: hexDepart.id,
      itineraire: calculerItinerairePondere(cap1.id, hexDepart.id, hexes, 'PATROUILLE').chemin,
      force: 6,
      statut: 'EN_ROUTE',
      tickCreation: 1,
    });
  }

  // Labels de mers placés sur un centre d'eau réel s'il existe
  const eauCells = hexes.filter(h => h.estEau);
  const labelsMer: Array<{ nom: string; q: number; r: number }> = [];
  if (eauCells.length > 0) {
    const eauSudOuest = [...eauCells].sort((a, b) => b.r - b.q - (a.r - a.q))[0];
    labelsMer.push({
      nom: NOMS_MERS[seed % NOMS_MERS.length],
      q: eauSudOuest.q,
      r: eauSudOuest.r,
    });
  }

  const carteAzgaar: AzgaarMapMetadata = {
    seed,
    nomMonde,
    modeleRelief,
    climatBias,
    rayonAnneaux: rayon,
    niveauMer,
    rivieres,
    routes,
    cultures: foyersCulture,
    labelsMer,
  };

  const personnage = config.conserverHeros
    ? JSON.parse(JSON.stringify(baseState.personnage))
    : JSON.parse(JSON.stringify(INITIAL_SIMULATION_STATE.personnage));
  if (!config.conserverHeros) {
    personnage.memoire = { dernieresInfos: [], souvenirsContextuels: [] };
  }

  personnage.reputationFactions = {};
  for (const f of factions) {
    personnage.reputationFactions[f.id] = f.relationsJoueur === 'HOSTILE' ? -50 : 5;
  }

  const merInfo = labelsMer[0]?.nom || 'la côte';
  const rivInfo = rivieres[0]?.nom ? ` le long de ${rivieres[0].nom}` : '';

  const etatGenere: SimulationState = {
    _seq: 1,
    horloge: horlogeSimulee,
    personnage,
    hexActuel: hexDepart,
    hexagones: hexes,
    marcheAllure: baseState.marcheAllure || 'Normale',
    roleExploration: baseState.roleExploration || "S'orienter",
    factions,
    marche: {
      multiplicateurFer: 1.0,
      prixArmesFerModif: 15,
      penurieArmurerie: false,
      securiteRoutes: 'Sûr',
      multiplicateurVivres: 1.0,
      penurieVivres: false,
      demandeLocale: 'Fer brut',
      tendanceFer: 'STABLE',
      tendanceVivres: 'STABLE',
      indiceTensionCommerciale: 20,
      volumeEchanges: 0,
    },
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
        `Jour 1, 08:00 — Arrivée à ${nomCapitale} (${nomMonde}, graine #${seed}, relief ${modeleRelief}).`,
      ],
      promessesEtQuetes: [],
      consequencesDifferees: [],
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
        pressionMoyenne: Math.round(
          terres.reduce((acc, h) => acc + (h.pressionDanger ?? 35), 0) / Math.max(1, terres.length)
        ),
        prosperiteMoyenne: Math.round(
          terres.reduce((acc, h) => acc + (h.prosperite ?? 30), 0) / Math.max(1, terres.length)
        ),
        entitesActives: entitesMonde.length,
        forcesFactions: Object.fromEntries(factions.map(f => [f.id, f.forceMilitaire])),
      },
    ],
    carteAzgaar,
  };

  return etatGenere;
}

/**
 * Étend dynamiquement l'atlas Azgaar d'un nouvel hexagone frontalier aux coordonnées (q, r),
 * utilisable par l'IA MJ lors de l'exploration au-delà des frontières connues.
 */
export function etendreFrontiereAzgaar(
  etat: SimulationState,
  q: number,
  r: number,
  options?: {
    nom?: string;
    forceTerre?: boolean;
    brouillard?: 'INCONNU' | 'REPERE' | 'EXPLORE';
    pointInteretType?: 'mine' | 'fort' | 'ruine' | 'bourgade' | 'camp';
    pointInteretNom?: string;
  }
): { hexCree: HexNode; dejaExistant: boolean } {
  const existant = etat.hexagones.find(h => h.q === q && h.r === r);
  if (existant) {
    return { hexCree: existant, dejaExistant: true };
  }

  const voisins = etat.hexagones.filter(h => {
    const dq = Math.abs(h.q - q);
    const dr = Math.abs(h.r - r);
    const ds = Math.abs(h.q + h.r - (q + r));
    return Math.max(dq, dr, ds) === 1;
  });

  let hexCree: HexNode;
  if (etat.azgaarStudio) {
    const geo = reconstruireAtlasComplet(etat.azgaarStudio);
    hexCree = creerHexDepuisCelluleAzgaar(q, r, etat.azgaarStudio, geo, options);
    if (!hexCree.estEau && hexCree.routeNiveau === 'AUCUNE' && voisins.some(v => v.routeNiveau === 'ROUTE')) {
      hexCree.routeNiveau = 'PISTE';
    }
  } else {
    const meta = extraireMetadataAzgaarDepuisEtat(etat);
    const seed = meta.seed || 42071;
    const rng = createSeededRng(hashString(`${seed}:frontier:${q}:${r}`));

    const altMoy =
      voisins.length > 0
        ? voisins.reduce((acc, v) => acc + (v.altitude ?? 30), 0) / voisins.length
        : 32;
    const alt = clamp(Math.round(altMoy + (rng() - 0.45) * 34), options?.forceTerre ? 24 : 5, 96);
    const estEau = !options?.forceTerre && alt <= meta.niveauMer;
    const estRivage = !estEau && voisins.some(v => v.estEau);

    const precipMoy =
      voisins.length > 0
        ? voisins.reduce((acc, v) => acc + (v.precipitations ?? 45), 0) / voisins.length
        : 48;
    const precip = clamp(Math.round(precipMoy + (rng() - 0.5) * 18), 5, 95);
    const temp = Math.round(13 - alt * 0.08 - r * 1.1);
    const flux = estEau ? 0 : clamp(Math.round(precip * 0.42 + rng() * 18), 4, 80);

    const cls = classifierBiomeAzgaar('Plaine / Route', alt, precip, temp, estEau, estRivage);
    const pool = NOMS_LIEUX_PAR_TERRAIN[cls.terrainFinal];
    const nomAuto = estEau
      ? 'Eaux lointaines'
      : options?.nom?.trim() || `${pool[Math.floor(rng() * pool.length)]} (${q},${r})`;

    const cultureVoisine = voisins.find(v => !v.estEau && v.culture)?.culture || meta.cultures[0]?.nom || 'Confins';

    hexCree = {
      id: construireIdHex(q, r),
      q,
      r,
      nom: nomAuto,
      terrain: cls.terrainFinal,
      biomeAzgaar: cls.biome,
      securite: estEau ? 'Sûr' : 'Dangereux',
      factionControleId: null,
      visite: options?.brouillard === 'EXPLORE',
      ressourcesEau: !estEau && (flux >= 25 || precip >= 52),
      ressourcesGibier: !estEau && (cls.terrainFinal === 'Forêt Dense' || cls.terrainFinal === 'Plaine / Route'),
      brouillard: options?.brouillard || 'REPERE',
      altitude: alt,
      precipitations: precip,
      temperatureC: temp,
      fluxHydro: flux,
      estEau,
      estRivage,
      pressionDanger: estEau ? 0 : 48,
      prosperite: estEau ? 0 : 22,
      niveauEau: estEau ? 100 : clamp(flux + 15, 5, 90),
      populationGibier: estEau ? 0 : 42,
      population: estEau ? 0 : 30 + Math.round(rng() * 40),
      culture: estEau ? undefined : cultureVoisine,
      garnison: estEau ? 0 : 10,
      routeNiveau: !estEau && voisins.some(v => v.routeNiveau === 'ROUTE') ? 'PISTE' : 'AUCUNE',
    };

    if (!estEau && options?.pointInteretType) {
      hexCree.pointInteret = {
        id: `poi_ext_${q}_${r}`,
        nom: options.pointInteretNom?.trim() || `Site de ${nomAuto}`,
        type: options.pointInteretType,
        statut: options.pointInteretType === 'ruine' ? 'RUINED' : 'OPERATIONNEL',
      };
    }
  }

  etat.hexagones.push(hexCree);

  // Enregistrer le noeud Location & les arêtes ADJACENT_TO dans le graphe GraphRAG
  etat.grapheNoeuds.push({
    id: hexCree.id,
    type: 'Location',
    label: hexCree.nom,
    proprietes: {
      q: hexCree.q,
      r: hexCree.r,
      terrain: hexCree.terrain,
      estEau: Boolean(hexCree.estEau),
      biomeAzgaar: hexCree.biomeAzgaar,
    },
  });

  if (!hexCree.estEau) {
    for (const v of voisins) {
      if (!v.estEau) {
        etat.grapheLiens.push({
          source: hexCree.id,
          cible: v.id,
          relation: 'ADJACENT_TO',
        });
      }
    }
  }

  if (etat.carteAzgaar && hexCree.routeNiveau === 'PISTE') {
    const voisinRoute = voisins.find(v => !v.estEau && (v.routeNiveau === 'ROUTE' || v.routeNiveau === 'PISTE'));
    if (voisinRoute) {
      etat.carteAzgaar.routes.push({
        id: `road_ext_${hexCree.id}`,
        hexIds: [voisinRoute.id, hexCree.id],
        kind: 'trail',
      });
    }
  }

  return { hexCree, dejaExistant: false };
}
