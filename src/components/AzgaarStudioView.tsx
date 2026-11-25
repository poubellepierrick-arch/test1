import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AzgaarBurgDef,
  AzgaarClimateBias,
  AzgaarCoatOfArms,
  AzgaarLayerKey,
  AzgaarMarkerDef,
  AzgaarResourceNode,
  AzgaarStylePreset,
  AzgaarTemplateId,
  AzgaarTradeRouteFlow,
  AzgaarWorldState,
  HexNode,
  SimulationState,
  WorldEntity,
} from '../types';
import {
  AZGAAR_BIOMES,
  AZGAAR_STYLE_PRESETS,
  obtenirCellulesDansRayon,
  projeterHexVersMondeAzgaar,
  reconstruireAtlasComplet,
  trouverCellulePlusProche,
} from '../engine/azgaarVoronoi';
import { calculerDistanceHex } from '../engine/hexcrawl';
import { RESSOURCES_CATALOGUE } from '../engine/worldEconomy';
import {
  calculerDispositionEtiquettes,
  MapLabelCandidate,
  PlacedMapLabel,
} from '../utils/mapLabelLayout';
import {
  AzgaarBrushConfig,
  AzgaarMenuDrawer,
  AzgaarMenuTab,
} from './AzgaarMenuDrawer';
import { AzgaarBurgCard } from './AzgaarBurgCard';
import {
  renderBridgeArtwork,
  renderCompassRoseArtwork,
  renderIlluminatedBorderArtwork,
  renderMiniShieldSvg,
  renderParchmentBannerArtwork,
  renderReliefArtwork,
  renderResourceArtwork,
  renderSeaMonsterArtwork,
  renderSettlementArtwork,
  renderShipArtwork,
  renderWaterfallArtwork,
  SettlementArtVariant,
} from './CartoArtworkSvg';
import {
  Layers,
  Wrench,
  SlidersHorizontal,
  Palette,
  ZoomIn,
  ZoomOut,
  Compass,
  Square,
  Shield,
  Grid,
  Maximize2,
  Minimize2,
} from 'lucide-react';

export type AzgaarGodmodeOverlay =
  | 'aucun'
  | 'danger'
  | 'ecologie'
  | 'peuplement'
  | 'trafic';

type HoveredMapTarget =
  | { kind: 'burg'; burg: AzgaarBurgDef }
  | { kind: 'resource'; resource: AzgaarResourceNode }
  | { kind: 'marker'; marker: AzgaarMarkerDef }
  | { kind: 'entity'; entity: WorldEntity }
  | { kind: 'tradeFlow'; flow: AzgaarTradeRouteFlow }
  | { kind: 'hex'; hex: HexNode };

interface AzgaarStudioViewProps {
  etat: SimulationState;
  mode?: 'tactique' | 'atelier';
  chargement?: boolean;
  godmodeOverlay?: AzgaarGodmodeOverlay;
  hexSelectionneId?: string;
  onSelectHex?: (hex: HexNode) => void;
  estAgrandie?: boolean;
  onToggleAgrandir?: () => void;
  onSyncAzgaar: (studio: AzgaarWorldState) => void;
  onRegenererAzgaar?: (opts: {
    seed: number;
    template: AzgaarTemplateId;
    climateBias: AzgaarClimateBias;
    cellsDesired: 800 | 1500 | 2400;
    windAngle: number;
    worldName: string;
    stylePreset: AzgaarStylePreset;
    statesCount: number;
    culturesCount: number;
    religionsCount: number;
    burgsCount: number;
  }) => void;
  onImporterAzgaar?: (rawText: string) => void;
  onPromoteNpc?: (npcId: string) => void;
}

function downloadBlob(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function hexPolygonString(cx: number, cy: number, radius: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    const px = cx + radius * Math.cos(angle);
    const py = cy + radius * Math.sin(angle);
    pts.push(`${px.toFixed(1)},${py.toFixed(1)}`);
  }
  return pts.join(' ');
}

function couleurDanger(pression: number): string {
  if (pression >= 75) return '#b91c1c';
  if (pression >= 45) return '#d97706';
  if (pression >= 22) return '#65a30d';
  return '#15803d';
}

function couleurEcologie(eau: number, gibier: number): string {
  const score = (eau + gibier) / 2;
  if (score >= 60) return '#15803d';
  if (score >= 35) return '#65a30d';
  if (score >= 18) return '#b45309';
  return '#9a3412';
}

function couleurPeuplement(pop: number): string {
  if (pop >= 800) return '#92400e';
  if (pop >= 180) return '#b45309';
  if (pop >= 70) return '#ca8a04';
  return '#78716c';
}

export const AzgaarStudioView: React.FC<AzgaarStudioViewProps> = ({
  etat,
  mode = 'atelier',
  chargement = false,
  godmodeOverlay = 'aucun',
  hexSelectionneId,
  onSelectHex,
  estAgrandie = false,
  onToggleAgrandir,
  onSyncAzgaar,
  onRegenererAzgaar,
  onImporterAzgaar,
  onPromoteNpc,
}) => {
  const isTactique = mode === 'tactique';
  const studioProp = etat.azgaarStudio;
  const [studioDraft, setStudioDraft] = useState<AzgaarWorldState | null>(studioProp || null);

  useEffect(() => {
    setStudioDraft(studioProp || null);
  }, [studioProp]);

  const [activeMenu, setActiveMenu] = useState<AzgaarMenuTab | null>(null);
  const [brush, setBrush] = useState<AzgaarBrushConfig>({
    mode: 'none',
    radius: 52,
    biomeId: 5,
    stateId: 1,
    cultureId: 1,
    religionId: 1,
    markerIcon: 'donjon',
  });

  const heroInitX =
    studioProp?.heroX ??
    studioProp?.burgs.find(b => b.id === studioProp.heroBurgId)?.x ??
    600;
  const heroInitY =
    studioProp?.heroY ??
    studioProp?.burgs.find(b => b.id === studioProp.heroBurgId)?.y ??
    380;

  const clampPan = (px: number, py: number, z: number): { x: number; y: number } => {
    if (z <= 1) return { x: 0, y: 0 };
    const maxX = 600 * (z - 1);
    const maxY = 380 * (z - 1);
    return {
      x: Math.max(-maxX, Math.min(maxX, px)),
      y: Math.max(-maxY, Math.min(maxY, py)),
    };
  };

  const [selectedBurgId, setSelectedBurgId] = useState<number | null>(null);
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);
  const [hoveredTarget, setHoveredTarget] = useState<HoveredMapTarget | null>(null);
  const [zoom, setZoom] = useState(() => (isTactique ? 1.9 : 1));
  const [pan, setPan] = useState<{ x: number; y: number }>(() =>
    isTactique
      ? clampPan((600 - heroInitX) * 1.9, (380 - heroInitY) * 1.9, 1.9)
      : { x: 0, y: 0 }
  );
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
  const [hoverCellIdx, setHoverCellIdx] = useState<number | null>(null);

  const applyZoom = (updater: (cur: number) => number) => {
    setZoom(prev => {
      const next = Math.max(1, Math.min(4.5, Number(updater(prev).toFixed(2))));
      setPan(curPan => clampPan(curPan.x, curPan.y, next));
      return next;
    });
  };

  const lastCenteredHeroRef = useRef<string>('');
  useEffect(() => {
    if (!isTactique || !studioDraft) {
      lastCenteredHeroRef.current = '';
      return;
    }
    const hx =
      studioDraft.heroX ??
      studioDraft.burgs.find(b => b.id === studioDraft.heroBurgId)?.x ??
      600;
    const hy =
      studioDraft.heroY ??
      studioDraft.burgs.find(b => b.id === studioDraft.heroBurgId)?.y ??
      380;
    const sig = `${etat.hexActuel.id}:${Math.round(hx)}:${Math.round(hy)}:${studioDraft.seed}`;
    if (lastCenteredHeroRef.current === sig) return;
    lastCenteredHeroRef.current = sig;
    setZoom(prev => {
      const z = Math.max(prev, 1.85);
      setPan(clampPan((600 - hx) * z, (380 - hy) * z, z));
      return z;
    });
  }, [
    isTactique,
    etat.hexActuel.id,
    studioDraft?.seed,
    studioDraft?.heroX,
    studioDraft?.heroY,
    studioDraft?.heroBurgId,
  ]);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const worldGroupRef = useRef<SVGGElement | null>(null);
  const isDraggingRef = useRef(false);
  const isPaintingRef = useRef(false);
  const panStartRef = useRef<{ cx: number; cy: number; px: number; py: number } | null>(null);
  const latestDraftRef = useRef<AzgaarWorldState | null>(studioDraft);
  latestDraftRef.current = studioDraft;

  const geo = useMemo(() => {
    if (!studioDraft) return null;
    return reconstruireAtlasComplet(studioDraft);
  }, [studioDraft]);

  const cellPolyStrings = useMemo(() => {
    if (!geo) return [];
    return geo.cells.map(c =>
      c.polygon.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
    );
  }, [geo]);

  const style = studioDraft
    ? AZGAAR_STYLE_PRESETS[studioDraft.stylePreset] || AZGAAR_STYLE_PRESETS.classique
    : AZGAAR_STYLE_PRESETS.classique;

  const isNight = studioDraft?.stylePreset === 'sombre';

  const stateColorMap = useMemo(() => {
    const m = new Map<number, string>();
    studioDraft?.states.forEach(s => m.set(s.id, s.color));
    return m;
  }, [studioDraft?.states]);

  const stateCoaMap = useMemo(() => {
    const m = new Map<number, AzgaarCoatOfArms>();
    studioDraft?.states.forEach(s => m.set(s.id, s.coa));
    return m;
  }, [studioDraft?.states]);

  const cultureColorMap = useMemo(() => {
    const m = new Map<number, string>();
    studioDraft?.cultures.forEach(c => m.set(c.id, c.color));
    return m;
  }, [studioDraft?.cultures]);

  const religionColorMap = useMemo(() => {
    const m = new Map<number, string>();
    studioDraft?.religions.forEach(r => m.set(r.id, r.color));
    return m;
  }, [studioDraft?.religions]);

  const provinceColorMap = useMemo(() => {
    const m = new Map<number, string>();
    studioDraft?.provinces.forEach((p, idx) => {
      const hue = (idx * 53) % 360;
      m.set(p.id, `hsl(${hue}, 44%, 64%)`);
    });
    return m;
  }, [studioDraft?.provinces]);

  // Projection des hexagones D&D jouables sur la carte 1200x760
  const projectedHexes = useMemo(() => {
    if (!studioDraft) return [];
    return etat.hexagones.map(hx => {
      const pos = projeterHexVersMondeAzgaar(hx, studioDraft);
      return {
        hex: hx,
        x: pos.x,
        y: pos.y,
        poly: hexPolygonString(pos.x, pos.y, 46),
      };
    });
  }, [etat.hexagones, studioDraft]);

  const projectedHexMap = useMemo(() => {
    const m = new Map<string, (typeof projectedHexes)[number]>();
    for (const p of projectedHexes) m.set(p.hex.id, p);
    return m;
  }, [projectedHexes]);

  // Brouillard de guerre partagé entre Tableau de bord et Monde & Atlas
  const cellFogStatus = useMemo<Array<'EXPLORE' | 'REPERE' | 'INCONNU'>>(() => {
    if (!geo) return [];
    return geo.cells.map(c => {
      let best: 'EXPLORE' | 'REPERE' | 'INCONNU' = 'INCONNU';
      let bestD = 50;
      for (const ph of projectedHexes) {
        const d = Math.hypot(c.x - ph.x, c.y - ph.y);
        if (d < bestD) {
          bestD = d;
          best = ph.hex.brouillard || 'INCONNU';
        }
      }
      return best;
    });
  }, [geo, projectedHexes]);

  const getPointFog = (x: number, y: number): 'EXPLORE' | 'REPERE' | 'INCONNU' => {
    if (!geo || cellFogStatus.length === 0) return 'EXPLORE';
    const c = trouverCellulePlusProche(geo.cells, x, y);
    return cellFogStatus[c.index] ?? 'INCONNU';
  };

  const isPointMasked = (x: number, y: number): boolean => {
    return isTactique && getPointFog(x, y) === 'INCONNU';
  };

  // Pré-calcul des teintes analytiques Godmode sur les cellules Voronoï
  const godmodeCellColors = useMemo(() => {
    if (!geo || godmodeOverlay === 'aucun' || godmodeOverlay === 'trafic') {
      return null;
    }
    return geo.cells.map(c => {
      if (!c.isLand) return null;
      let nearest: (typeof projectedHexes)[number] | null = null;
      let bestD = 52;
      for (const ph of projectedHexes) {
        const d = Math.hypot(c.x - ph.x, c.y - ph.y);
        if (d < bestD) {
          bestD = d;
          nearest = ph;
        }
      }
      if (godmodeOverlay === 'danger') {
        const val = nearest
          ? (nearest.hex.pressionDanger ?? 30)
          : c.h > 65
          ? 70
          : c.stateId === 0
          ? 52
          : 22;
        return couleurDanger(val);
      }
      if (godmodeOverlay === 'ecologie') {
        const eau = nearest ? (nearest.hex.niveauEau ?? (nearest.hex.ressourcesEau ? 70 : 18)) : c.precip;
        const gib = nearest
          ? (nearest.hex.populationGibier ?? (nearest.hex.ressourcesGibier ? 70 : 18))
          : Math.max(12, 85 - Math.abs(c.temp - 14) * 2.5);
        return couleurEcologie(eau, gib);
      }
      if (godmodeOverlay === 'peuplement') {
        const pop = nearest
          ? (nearest.hex.population ?? 60)
          : c.stateId > 0
          ? 240 - c.h * 1.8
          : 30;
        return couleurPeuplement(pop);
      }
      return null;
    });
  }, [geo, godmodeOverlay, projectedHexes]);

  const toWorldCoords = (clientX: number, clientY: number): { x: number; y: number } => {
    const svg = svgRef.current;
    const grp = worldGroupRef.current;
    if (svg && grp) {
      const ctm = grp.getScreenCTM();
      if (ctm) {
        const pt = svg.createSVGPoint();
        pt.x = clientX;
        pt.y = clientY;
        const transformed = pt.matrixTransform(ctm.inverse());
        return {
          x: Math.max(0, Math.min(1200, transformed.x)),
          y: Math.max(0, Math.min(760, transformed.y)),
        };
      }
      const rect = svg.getBoundingClientRect();
      return {
        x: Math.max(0, Math.min(1200, ((clientX - rect.left) / rect.width) * 1200)),
        y: Math.max(0, Math.min(760, ((clientY - rect.top) / rect.height) * 760)),
      };
    }
    return { x: 600, y: 380 };
  };

  const applyStudioUpdate = (next: AzgaarWorldState, persist = true) => {
    setStudioDraft(next);
    latestDraftRef.current = next;
    if (persist) {
      onSyncAzgaar(next);
    }
  };

  const toggleQuickLayer = (key: AzgaarLayerKey, fallback = true) => {
    if (!studioDraft) return;
    const cur = studioDraft.layers[key] ?? fallback;
    applyStudioUpdate(
      {
        ...studioDraft,
        layers: { ...studioDraft.layers, [key]: !cur },
      },
      true
    );
  };

  const paintAt = (wx: number, wy: number) => {
    if (!studioDraft || !geo) return;
    if (brush.mode === 'none' || brush.mode === 'burg' || brush.mode === 'marker') {
      return;
    }

    const targets = obtenirCellulesDansRayon(geo.cells, wx, wy, brush.radius);
    if (targets.length === 0) return;

    const nextOverrides = {
      height: { ...(studioDraft.overrides.height || {}) },
      biome: { ...(studioDraft.overrides.biome || {}) },
      state: { ...(studioDraft.overrides.state || {}) },
      province: { ...(studioDraft.overrides.province || {}) },
      culture: { ...(studioDraft.overrides.culture || {}) },
      religion: { ...(studioDraft.overrides.religion || {}) },
    };

    if (brush.mode === 'elevate' || brush.mode === 'lower' || brush.mode === 'sea' || brush.mode === 'smooth') {
      for (const c of targets) {
        const dRatio = 1 - Math.hypot(c.x - wx, c.y - wy) / Math.max(1, brush.radius);
        const factor = Math.max(0.25, dRatio);
        if (brush.mode === 'elevate') {
          nextOverrides.height[c.index] = Math.min(99, Math.round(c.h + 12 * factor));
        } else if (brush.mode === 'lower') {
          nextOverrides.height[c.index] = Math.max(2, Math.round(c.h - 12 * factor));
        } else if (brush.mode === 'sea') {
          nextOverrides.height[c.index] = Math.min(c.h, 12);
        } else {
          const avgNb =
            c.neighbors.reduce((acc, nb) => acc + geo.cells[nb].h, c.h) /
            (c.neighbors.length + 1);
          nextOverrides.height[c.index] = Math.round(c.h * 0.5 + avgNb * 0.5);
        }
      }
    } else if (brush.mode === 'biome') {
      for (const c of targets) {
        if (c.isLand) nextOverrides.biome[c.index] = brush.biomeId;
      }
    } else if (brush.mode === 'state') {
      for (const c of targets) {
        if (c.isLand) nextOverrides.state[c.index] = brush.stateId;
      }
    } else if (brush.mode === 'culture') {
      for (const c of targets) {
        if (c.isLand) nextOverrides.culture[c.index] = brush.cultureId;
      }
    } else if (brush.mode === 'religion') {
      for (const c of targets) {
        if (c.isLand) nextOverrides.religion[c.index] = brush.religionId;
      }
    }

    const updated: AzgaarWorldState = { ...studioDraft, overrides: nextOverrides };
    setStudioDraft(updated);
    latestDraftRef.current = updated;
  };

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!studioDraft || !geo) return;
    const worldPt = toWorldCoords(e.clientX, e.clientY);

    if (brush.mode === 'burg') {
      const cell = trouverCellulePlusProche(geo.cells, worldPt.x, worldPt.y);
      if (!cell.isLand) return;
      const newId = studioDraft.burgs.reduce((m, b) => Math.max(m, b.id), 0) + 1;
      const newBurg: AzgaarBurgDef = {
        id: newId,
        name: `Bourg-${newId}`,
        cell: cell.index,
        x: Math.round(cell.x * 10) / 10,
        y: Math.round(cell.y * 10) / 10,
        stateId: cell.stateId || studioDraft.states[0]?.id || 0,
        provinceId: cell.provinceId || 0,
        cultureId: cell.cultureId || 1,
        religionId: cell.religionId || 1,
        population: 1400,
        capital: false,
        port: cell.isCoast,
        citadel: false,
        walls: false,
        plaza: true,
        temple: false,
        garrison: 80,
        coa: {
          fieldColor: studioDraft.states.find(s => s.id === cell.stateId)?.color || '#3f6e9c',
          secondaryColor: '#f3d37a',
          division: 'parti',
          charge: cell.isCoast ? 'ancre' : 'tour',
          chargeColor: '#f5f1e6',
        },
      };
      const updated = { ...studioDraft, burgs: [...studioDraft.burgs, newBurg] };
      applyStudioUpdate(updated, true);
      setSelectedBurgId(newBurg.id);
      setSelectedMarkerId(null);
      return;
    }

    if (brush.mode === 'marker') {
      const newMarker: AzgaarMarkerDef = {
        id: `m_plr_${Date.now()}`,
        icon: brush.markerIcon,
        title: `Repère ${studioDraft.markers.length + 1}`,
        note: 'Note du joueur.',
        x: Math.round(worldPt.x),
        y: Math.round(worldPt.y),
        author: 'JOUEUR',
        createdDay: etat.horloge.jour,
      };
      const updated = { ...studioDraft, markers: [...studioDraft.markers, newMarker] };
      applyStudioUpdate(updated, true);
      setSelectedMarkerId(newMarker.id);
      setSelectedBurgId(null);
      return;
    }

    if (brush.mode !== 'none') {
      isPaintingRef.current = true;
      paintAt(worldPt.x, worldPt.y);
      return;
    }

    isDraggingRef.current = true;
    panStartRef.current = {
      cx: e.clientX,
      cy: e.clientY,
      px: pan.x,
      py: pan.y,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!geo) return;
    const worldPt = toWorldCoords(e.clientX, e.clientY);
    setHoverPos(worldPt);
    const cell = trouverCellulePlusProche(geo.cells, worldPt.x, worldPt.y);
    setHoverCellIdx(cell.index);

    if (isPaintingRef.current) {
      paintAt(worldPt.x, worldPt.y);
      return;
    }

    if (isDraggingRef.current && panStartRef.current && svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect();
      const dxSvg = ((e.clientX - panStartRef.current.cx) / rect.width) * 1200;
      const dySvg = ((e.clientY - panStartRef.current.cy) / rect.height) * 760;
      setPan(
        clampPan(
          panStartRef.current.px + dxSvg,
          panStartRef.current.py + dySvg,
          zoom
        )
      );
      return;
    }

    // Repli sur l'hexagone le plus proche si aucun élément prioritaire n'est survolé
    if (projectedHexes.length > 0) {
      let nearestHex: HexNode | null = null;
      let bestDist = 52;
      for (const ph of projectedHexes) {
        const d = Math.hypot(ph.x - worldPt.x, ph.y - worldPt.y);
        if (d < bestDist) {
          bestDist = d;
          nearestHex = ph.hex;
        }
      }
      setHoveredTarget(prev => {
        if (prev && prev.kind !== 'hex') return prev;
        return nearestHex ? { kind: 'hex', hex: nearestHex } : null;
      });
    }
  };

  const handlePointerUp = () => {
    if (isPaintingRef.current && latestDraftRef.current) {
      onSyncAzgaar(latestDraftRef.current);
    }
    isPaintingRef.current = false;
    isDraggingRef.current = false;
    panStartRef.current = null;
  };

  const centerOn = (x: number, y: number) => {
    const z = Math.max(zoom, 1.45);
    setZoom(z);
    setPan(clampPan((600 - x) * z, (380 - y) * z, z));
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  if (!studioDraft || !geo) {
    return (
      <div className="dnd-panel rounded-lg p-6 text-center space-y-3">
        <div className="font-display text-base font-bold text-[#231a14]">
          Atlas Azgaar non généré sur cette session
        </div>
        {onRegenererAzgaar && (
          <button
            disabled={chargement}
            onClick={() =>
              onRegenererAzgaar({
                seed: 74219,
                template: 'continent',
                climateBias: 'tempere',
                cellsDesired: 1500,
                windAngle: 12,
                worldName: "Terres d'Eldoria",
                stylePreset: 'classique',
                statesCount: 5,
                culturesCount: 4,
                religionsCount: 3,
                burgsCount: 22,
              })
            }
            className="px-4 py-2 rounded dnd-wood-bar border text-xs font-medium cursor-pointer"
          >
            Générer l&apos;atlas
          </button>
        )}
      </div>
    );
  }

  const blasonsActifs = studioDraft.layers.blasons ?? true;
  const selectedBurg = studioDraft.burgs.find(b => b.id === selectedBurgId) || null;
  const selectedMarker = studioDraft.markers.find(m => m.id === selectedMarkerId) || null;
  const hoverCell = hoverCellIdx !== null ? geo.cells[hoverCellIdx] : null;
  const heroX =
    studioDraft.heroX ??
    studioDraft.burgs.find(b => b.id === studioDraft.heroBurgId)?.x ??
    600;
  const heroY =
    studioDraft.heroY ??
    studioDraft.burgs.find(b => b.id === studioDraft.heroBurgId)?.y ??
    380;

  const hoverBiome = hoverCell ? AZGAAR_BIOMES[hoverCell.biome]?.name || 'Terre' : '—';
  const hoverState =
    hoverCell && hoverCell.stateId
      ? studioDraft.states.find(s => s.id === hoverCell.stateId)?.name || 'Libre'
      : 'Libre';
  const hoverProv =
    hoverCell && hoverCell.provinceId
      ? studioDraft.provinces.find(p => p.id === hoverCell.provinceId)?.name || '—'
      : '—';
  const hoverCul =
    hoverCell && hoverCell.cultureId
      ? studioDraft.cultures.find(c => c.id === hoverCell.cultureId)?.name || '—'
      : '—';
  const hoverRel =
    hoverCell && hoverCell.religionId
      ? studioDraft.religions.find(r => r.id === hoverCell.religionId)?.name || '—'
      : '—';

  const getCellFill = (cellIndex: number): string => {
    const c = geo.cells[cellIndex];
    if (!c.isLand) {
      return c.isShallow ? style.oceanShallow : style.oceanDeep;
    }
    if (studioDraft.layers.biomes) {
      return AZGAAR_BIOMES[c.biome]?.color || style.landTint;
    }
    return style.landTint;
  };

  const getOverlayFill = (cellIndex: number): { color: string; opacity: number } | null => {
    const c = geo.cells[cellIndex];
    if (!c.isLand) return null;
    if (godmodeCellColors && godmodeCellColors[cellIndex]) {
      return { color: godmodeCellColors[cellIndex]!, opacity: 0.44 };
    }
    if (studioDraft.layers.religions && c.religionId > 0) {
      return { color: religionColorMap.get(c.religionId) || '#999', opacity: 0.54 };
    }
    if (studioDraft.layers.cultures && c.cultureId > 0) {
      return { color: cultureColorMap.get(c.cultureId) || '#999', opacity: 0.52 };
    }
    if (studioDraft.layers.provinces && c.provinceId > 0) {
      return { color: provinceColorMap.get(c.provinceId) || '#999', opacity: 0.5 };
    }
    if (studioDraft.layers.etats && c.stateId > 0) {
      return {
        color: stateColorMap.get(c.stateId) || '#999',
        opacity: studioDraft.stateOpacity,
      };
    }
    return null;
  };

  const entitesEnRoute = (etat.entitesMonde || []).filter(e => e.statut === 'EN_ROUTE');
  const lieuesEchelle = (24 / zoom).toFixed(zoom === 1 ? 0 : 1);

  const placedLabels = useMemo<PlacedMapLabel[]>(() => {
    if (!studioDraft || !geo || !studioDraft.layers.etiquettes) return [];
    const candidates: MapLabelCandidate[] = [];

    // 1. Héros
    candidates.push({
      id: 'hero',
      kind: 'hero',
      text: etat.personnage.nom || 'Héros',
      x: heroX,
      y: heroY,
      priority: 100,
      minZoom: 1,
      fontSize: 9.8,
      markerRadius: 10,
      preferredPlacements: ['above', 'below', 'right', 'left'],
    });

    // 2. Bourgs selon hiérarchie démographique & zoom
    if (studioDraft.layers.bourgs) {
      for (const b of studioDraft.burgs) {
        if (b.id !== studioDraft.heroBurgId && isPointMasked(b.x, b.y)) {
          continue;
        }
        const isSel = b.id === selectedBurgId;
        const isMajor = Boolean(b.citadel || b.port || b.population >= 4500);
        const isMedium = Boolean(b.walls || b.population >= 2200);
        candidates.push({
          id: `burg_${b.id}`,
          kind: b.capital ? 'capital' : isMajor ? 'citadel' : 'burg',
          text: b.name,
          x: b.x,
          y: b.y,
          priority: isSel ? 96 : b.capital ? 92 : isMajor ? 76 : isMedium ? 54 : 46,
          minZoom: isSel || b.capital ? 1 : isMajor ? 1.35 : isMedium ? 1.75 : 2.15,
          fontSize: b.capital ? 11 : isMajor ? 9.8 : 9,
          markerRadius: b.capital ? 12 : isMajor ? 10 : 8,
        });
      }
    }

    // 3. États
    for (const sl of geo.stateLabels) {
      if (isPointMasked(sl.x, sl.y)) continue;
      candidates.push({
        id: `state_${sl.stateId}`,
        kind: 'state',
        text: sl.name.toUpperCase(),
        x: sl.x,
        y: sl.y,
        priority: 70,
        minZoom: 1,
        fontSize: Math.max(10.5, Math.min(16, Math.round(sl.radius * 0.13))),
        preferredPlacements: ['center', 'above', 'below'],
      });
    }

    // 4. Gisements & ressources
    if (studioDraft.layers.ressources !== false && studioDraft.resources) {
      for (const res of studioDraft.resources) {
        if (isPointMasked(res.x, res.y)) continue;
        candidates.push({
          id: `res_${res.id}`,
          kind: 'resource',
          text: res.nom,
          x: res.x,
          y: res.y,
          priority: res.richesse >= 4 ? 58 : 38,
          minZoom: res.richesse >= 4 ? 1.55 : 2.2,
          fontSize: 8.3,
          markerRadius: 9,
        });
      }
    }

    // 5. Marqueurs
    if (studioDraft.layers.marqueurs) {
      for (const m of studioDraft.markers) {
        if (m.author !== 'JOUEUR' && isPointMasked(m.x, m.y)) continue;
        const isSel = m.id === selectedMarkerId;
        candidates.push({
          id: `marker_${m.id}`,
          kind: 'marker',
          text: m.title,
          x: m.x,
          y: m.y,
          priority: isSel ? 95 : 44,
          minZoom: isSel ? 1 : 1.75,
          fontSize: 8.6,
          markerRadius: 9,
        });
      }
    }

    // 6. Océans & Mers
    studioDraft.oceanLabels.forEach((ol, i) => {
      if (isPointMasked(ol.x, ol.y)) return;
      candidates.push({
        id: `ocean_${i}`,
        kind: 'ocean',
        text: ol.name,
        x: ol.x,
        y: ol.y,
        priority: 34,
        minZoom: 1,
        fontSize: 14.5,
        preferredPlacements: ['center', 'above', 'below'],
      });
    });

    const obstacles =
      zoom <= 1.15
        ? [
            { left: 10, top: 10, right: 292, bottom: 62 },
            { left: 14, top: 702, right: 152, bottom: 750 },
            { left: 1106, top: 668, right: 1188, bottom: 748 },
          ]
        : [];

    return calculerDispositionEtiquettes(candidates, {
      zoom,
      mapWidth: 1200,
      mapHeight: 760,
      obstacles,
    });
  }, [
    studioDraft,
    geo,
    zoom,
    heroX,
    heroY,
    etat.personnage.nom,
    selectedBurgId,
    selectedMarkerId,
    cellFogStatus,
  ]);

  return (
    <div
      className={
        isTactique
          ? 'rounded-lg overflow-hidden border border-[#9e8459] flex flex-col'
          : 'dnd-panel border border-[#b99f72] rounded-lg overflow-hidden flex flex-col'
      }
    >
      {/* Barre d'outils Studio en une ligne (uniquement en mode Atelier / Monde & Atlas) */}
      {!isTactique && (
        <div className="dnd-wood-bar px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 border-b border-[#5b411e]">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-display font-bold text-xs text-[#f5e3be] mr-1.5">
              {studioDraft.worldName}
            </span>
            {(
              [
                ['couches', 'Couches', Layers],
                ['outils', 'Outils', Wrench],
                ['options', 'Options', SlidersHorizontal],
                ['style', 'Style', Palette],
              ] as Array<[AzgaarMenuTab, string, React.FC<{ className?: string }>]>
            ).map(([id, label, Icon]) => {
              const active = activeMenu === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveMenu(prev => (prev === id ? null : id))}
                  className={`px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                    active
                      ? 'bg-[#e5be6e] text-[#231a14]'
                      : 'bg-black/20 text-[#efe0be] hover:bg-black/35 border border-[#7c5d30]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{label}</span>
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => toggleQuickLayer('blasons', true)}
              aria-pressed={blasonsActifs}
              className={`px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                blasonsActifs
                  ? 'bg-[#e5be6e] text-[#231a14]'
                  : 'bg-black/20 text-[#efe0be] hover:bg-black/35 border border-[#7c5d30]'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Blasons</span>
            </button>

            <button
              type="button"
              onClick={() => toggleQuickLayer('grille', true)}
              aria-pressed={studioDraft.layers.grille}
              className={`px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                studioDraft.layers.grille
                  ? 'bg-[#e5be6e] text-[#231a14]'
                  : 'bg-black/20 text-[#efe0be] hover:bg-black/35 border border-[#7c5d30]'
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
              <span>Secteur</span>
            </button>

            {brush.mode !== 'none' && (
              <button
                type="button"
                onClick={() => setBrush(prev => ({ ...prev, mode: 'none' }))}
                className="px-2 py-1 rounded bg-amber-300 text-[#231a14] text-[11px] font-semibold flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer ml-1"
              >
                <Square className="w-3 h-3" />
                <span>Arrêter ({brush.mode})</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-1 text-[11px] text-[#efe0be]">
            <button
              type="button"
              onClick={() => applyZoom(z => z - 0.25)}
              className="p-1 rounded bg-black/20 hover:bg-black/35 cursor-pointer"
              title="Dézoomer"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono tabular-nums w-11 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => applyZoom(z => z + 0.25)}
              className="p-1 rounded bg-black/20 hover:bg-black/35 cursor-pointer"
              title="Zoomer"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={resetView}
              className="px-2 py-1 rounded bg-black/20 hover:bg-black/35 whitespace-nowrap shrink-0 cursor-pointer"
            >
              1:1
            </button>
            <button
              type="button"
              onClick={() => centerOn(heroX, heroY)}
              className="px-2 py-1 rounded bg-black/20 hover:bg-black/35 flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Compass className="w-3.5 h-3.5 text-[#e5be6e]" />
              <span>Héros</span>
            </button>
            {onToggleAgrandir && (
              <button
                type="button"
                onClick={onToggleAgrandir}
                aria-pressed={estAgrandie}
                className={`px-2 py-1 rounded flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer ${
                  estAgrandie
                    ? 'bg-[#e5be6e] text-[#231a14]'
                    : 'bg-black/20 hover:bg-black/35 text-[#efe0be]'
                }`}
              >
                {estAgrandie ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                <span>{estAgrandie ? 'Réduire' : 'Agrandir'}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Corps principal : Tiroir menu inline + Canvas Voronoï */}
      <div className={isTactique ? 'relative bg-[#2b3b4e]' : 'flex gap-2 p-2 bg-[#dfd2b6] relative min-h-[600px]'}>
        {!isTactique && activeMenu && onRegenererAzgaar && onImporterAzgaar && (
          <AzgaarMenuDrawer
            activeMenu={activeMenu}
            studio={studioDraft}
            brush={brush}
            chargement={chargement}
            onClose={() => setActiveMenu(null)}
            onChangeBrush={setBrush}
            onUpdateStudio={applyStudioUpdate}
            onSelectBurg={b => {
              setSelectedBurgId(b.id);
              setSelectedMarkerId(null);
            }}
            onSelectMarker={m => {
              setSelectedMarkerId(m.id);
              setSelectedBurgId(null);
            }}
            onCenterOn={centerOn}
            onRegenerate={onRegenererAzgaar}
            onImportRaw={onImporterAzgaar}
            onExportJson={() =>
              downloadBlob(
                `azgaar-${studioDraft.seed}.json`,
                JSON.stringify(studioDraft, null, 2),
                'application/json'
              )
            }
            onExportSvg={() => {
              if (!svgRef.current) return;
              downloadBlob(
                `azgaar-${studioDraft.seed}.svg`,
                svgRef.current.outerHTML,
                'image/svg+xml'
              );
            }}
          />
        )}

        <div className={isTactique ? 'relative overflow-hidden bg-[#2b3b4e]' : 'flex-1 relative rounded border border-[#9e8459] overflow-hidden bg-[#2b3b4e]'}>
          {isTactique && (
            <div className="absolute top-2 right-2 z-10 flex items-center gap-1 px-1.5 py-1 rounded bg-[#21170f]/88 border border-[#7c5d2a] text-[10px] text-[#efe0be] shadow-sm">
              <button
                type="button"
                onClick={() => applyZoom(z => z - 0.25)}
                className="p-0.5 rounded hover:bg-black/35 cursor-pointer"
                title="Dézoomer"
              >
                <ZoomOut className="w-3 h-3" />
              </button>
              <span className="font-mono tabular-nums w-9 text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                onClick={() => applyZoom(z => z + 0.25)}
                className="p-0.5 rounded hover:bg-black/35 cursor-pointer"
                title="Zoomer"
              >
                <ZoomIn className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => centerOn(heroX, heroY)}
                className="px-1.5 py-0.5 rounded hover:bg-black/35 flex items-center gap-0.5 cursor-pointer"
                title="Recentrer sur le héros"
              >
                <Compass className="w-3 h-3 text-[#e5be6e]" />
                <span>Héros</span>
              </button>
              {onToggleAgrandir && (
                <button
                  type="button"
                  onClick={onToggleAgrandir}
                  aria-pressed={estAgrandie}
                  className="p-0.5 rounded hover:bg-black/35 cursor-pointer"
                  title={estAgrandie ? 'Réduire' : 'Agrandir'}
                >
                  {estAgrandie ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
                </button>
              )}
            </div>
          )}

          <svg
            ref={svgRef}
            viewBox="0 0 1200 760"
            className={`w-full ${
              isTactique
                ? estAgrandie
                  ? 'aspect-[1200/760] max-h-[600px]'
                  : 'aspect-[1200/760]'
                : estAgrandie
                ? 'h-[690px]'
                : 'h-[600px]'
            } select-none block ${
              brush.mode !== 'none' ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'
            }`}
            style={{ backgroundColor: style.bgPaper }}
            onWheel={e => {
              e.preventDefault();
              const delta = e.deltaY < 0 ? 0.18 : -0.18;
              applyZoom(z => z + delta);
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={() => {
              handlePointerUp();
              setHoverPos(null);
              setHoverCellIdx(null);
              setHoveredTarget(null);
            }}
          >
            <defs>
              <clipPath id="azgaar-atlas-clip">
                <rect x="10" y="10" width="1180" height="740" />
              </clipPath>
              <pattern id="azgaar-ocean-waves" width="32" height="16" patternUnits="userSpaceOnUse">
                <rect width="32" height="16" fill={style.oceanDeep} />
                <path
                  d="M 2 8 Q 8 4 14 8 T 26 8"
                  fill="none"
                  stroke={style.coastGlow}
                  strokeWidth="0.7"
                  opacity="0.24"
                />
              </pattern>
              <pattern id="azgaar-fog-pattern" width="14" height="14" patternUnits="userSpaceOnUse">
                <rect width="14" height="14" fill={isNight ? '#161e28' : '#d8cbb0'} />
                <path
                  d="M 0 14 L 14 0 M -3 3 L 3 -3 M 11 17 L 17 11"
                  stroke={isNight ? '#273445' : '#baa47d'}
                  strokeWidth="0.75"
                  opacity="0.45"
                />
                <circle cx="4" cy="4" r="0.6" fill={isNight ? '#334257' : '#a8926a'} opacity="0.45" />
                <circle cx="11" cy="10" r="0.6" fill={isNight ? '#334257' : '#a8926a'} opacity="0.45" />
              </pattern>
              <radialGradient id="azgaar-vignette" cx="50%" cy="50%" r="72%">
                <stop offset="68%" stopColor="#000000" stopOpacity="0" />
                <stop offset="100%" stopColor="#26190d" stopOpacity={isNight ? '0.32' : '0.16'} />
              </radialGradient>
            </defs>

            <g clipPath="url(#azgaar-atlas-clip)">
              <g
                ref={worldGroupRef}
                transform={`translate(${600 + pan.x}, ${380 + pan.y}) scale(${zoom}) translate(-600, -380)`}
              >
                {/* Fond océan texturé */}
                <rect
                  x="-200"
                  y="-200"
                  width="1600"
                  height="1160"
                  fill={studioDraft.layers.ocean ? 'url(#azgaar-ocean-waves)' : style.bgPaper}
                />

                {/* Lignes de rumb marines discrètes */}
                {studioDraft.layers.ocean && (
                  <g stroke={style.coastGlow} strokeWidth={0.6} opacity={0.16} pointerEvents="none">
                    <line x1={0} y1={140} x2={1200} y2={620} />
                    <line x1={0} y1={660} x2={1200} y2={180} />
                    <line x1={260} y1={0} x2={940} y2={760} />
                    <line x1={960} y1={0} x2={240} y2={760} />
                  </g>
                )}

                {/* Cellules Voronoï : Base terrain/biome/océan */}
                <g>
                  {geo.cells.map((c, idx) => {
                    const pts = cellPolyStrings[idx];
                    if (!pts) return null;
                    if (!c.isLand && !studioDraft.layers.ocean) return null;
                    const fill = !c.isLand && !c.isShallow && studioDraft.layers.ocean
                      ? 'transparent'
                      : getCellFill(idx);
                    const overlay = getOverlayFill(idx);
                    const reliefShade =
                      studioDraft.layers.relief && c.isLand
                        ? Math.max(0, (c.h - 45) / 140)
                        : 0;
                    return (
                      <React.Fragment key={c.index}>
                        {fill !== 'transparent' && (
                          <polygon
                            points={pts}
                            fill={fill}
                            stroke={fill}
                            strokeWidth={0.5}
                          />
                        )}
                        {reliefShade > 0.02 && (
                          <polygon
                            points={pts}
                            fill={c.h >= 72 ? '#ffffff' : '#24180d'}
                            fillOpacity={
                              c.h >= 72 ? Math.min(0.38, (c.h - 70) / 70) : reliefShade * 0.26
                            }
                          />
                        )}
                        {overlay && (
                          <polygon
                            points={pts}
                            fill={overlay.color}
                            fillOpacity={overlay.opacity}
                          />
                        )}
                      </React.Fragment>
                    );
                  })}
                </g>

                {/* Côtes double trait Azgaar + hachures côtières */}
                {studioDraft.layers.ocean && (
                  <g pointerEvents="none">
                    {geo.coastSegments.map((seg, i) => (
                      <line
                        key={`cg_${i}`}
                        x1={seg[0][0]}
                        y1={seg[0][1]}
                        x2={seg[1][0]}
                        y2={seg[1][1]}
                        stroke={style.coastGlow}
                        strokeWidth={3.8}
                        strokeLinecap="round"
                        opacity={0.58}
                      />
                    ))}
                    {geo.coastSegments.map((seg, i) => (
                      <line
                        key={`cs_${i}`}
                        x1={seg[0][0]}
                        y1={seg[0][1]}
                        x2={seg[1][0]}
                        y2={seg[1][1]}
                        stroke={style.coastStroke}
                        strokeWidth={1.35}
                        strokeLinecap="round"
                      />
                    ))}
                    {geo.coastSegments.map((seg, i) => {
                      if (i % 3 !== 0) return null;
                      const mx = (seg[0][0] + seg[1][0]) / 2;
                      const my = (seg[0][1] + seg[1][1]) / 2;
                      const dx = seg[1][0] - seg[0][0];
                      const dy = seg[1][1] - seg[0][1];
                      const len = Math.max(1, Math.hypot(dx, dy));
                      const nx = -dy / len;
                      const ny = dx / len;
                      return (
                        <line
                          key={`ct_${i}`}
                          x1={mx - nx * 2.2}
                          y1={my - ny * 2.2}
                          x2={mx + nx * 2.2}
                          y2={my + ny * 2.2}
                          stroke={style.coastStroke}
                          strokeWidth={0.65}
                          opacity={0.4}
                        />
                      );
                    })}
                  </g>
                )}

                {/* Rivières & Cascades */}
                {studioDraft.layers.rivieres && (
                  <g pointerEvents="none">
                    {studioDraft.rivers.map(rv => (
                      <React.Fragment key={rv.id}>
                        <polyline
                          fill="none"
                          stroke={style.bgPaper}
                          strokeWidth={rv.widthFactor + 1.8}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          opacity={0.45}
                          points={rv.points.map(p => `${p[0]},${p[1]}`).join(' ')}
                        />
                        <polyline
                          fill="none"
                          stroke={style.riverColor}
                          strokeWidth={rv.widthFactor}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          points={rv.points.map(p => `${p[0]},${p[1]}`).join(' ')}
                        />
                      </React.Fragment>
                    ))}
                    {geo.waterfalls.map(wf =>
                      renderWaterfallArtwork(wf.id, wf.x, wf.y, 0.9)
                    )}
                  </g>
                )}

                {/* Flux commerciaux directionnels par denrée (hors brouillard inconnu) */}
                {(studioDraft.layers.fluxCommerciaux ?? true) &&
                  studioDraft.tradeFlows &&
                  studioDraft.tradeFlows.length > 0 && (
                    <g>
                      {studioDraft.tradeFlows.map(flow => {
                        if (flow.points.length < 2) return null;
                        const midPt = flow.points[Math.floor(flow.points.length / 2)];
                        if (
                          isPointMasked(midPt[0], midPt[1]) &&
                          isPointMasked(flow.points[0][0], flow.points[0][1])
                        ) {
                          return null;
                        }
                        const desc = RESSOURCES_CATALOGUE[flow.denree];
                        const isFlowHover =
                          hoveredTarget?.kind === 'tradeFlow' && hoveredTarget.flow.id === flow.id;
                        return (
                          <polyline
                            key={flow.id}
                            fill="none"
                            stroke={desc?.color || '#b45309'}
                            strokeWidth={(1.1 + flow.volume * 0.55) * (isFlowHover ? 1.5 : 1)}
                            strokeDasharray={flow.kind === 'sea' ? '6 4' : '8 3'}
                            strokeLinecap="round"
                            opacity={isFlowHover ? 0.92 : 0.58}
                            className="cursor-pointer"
                            points={flow.points.map(p => `${p[0]},${p[1]}`).join(' ')}
                            onPointerEnter={() => setHoveredTarget({ kind: 'tradeFlow', flow })}
                            onPointerLeave={() =>
                              setHoveredTarget(prev =>
                                prev?.kind === 'tradeFlow' && prev.flow.id === flow.id ? null : prev
                              )
                            }
                          />
                        );
                      })}
                    </g>
                  )}

                {/* Routes terrestres, routes maritimes & Ponts */}
                <g pointerEvents="none">
                  {studioDraft.routes.map(rt => {
                    if (rt.kind === 'sea' && !studioDraft.layers.routesMaritimes) return null;
                    if (rt.kind !== 'sea' && !studioDraft.layers.routes) return null;
                    return (
                      <polyline
                        key={rt.id}
                        fill="none"
                        stroke={rt.kind === 'sea' ? style.seaLaneColor : style.roadColor}
                        strokeWidth={rt.kind === 'road' ? 1.9 : rt.kind === 'sea' ? 1.4 : 1.15}
                        strokeDasharray={
                          rt.kind === 'sea' ? '5 4' : rt.kind === 'trail' ? '2 3' : '6 2'
                        }
                        opacity={rt.kind === 'sea' ? 0.85 : 0.92}
                        points={rt.points.map(p => `${p[0]},${p[1]}`).join(' ')}
                      />
                    );
                  })}
                  {studioDraft.layers.routes &&
                    geo.bridges.map(br =>
                      renderBridgeArtwork(br.id, br.x, br.y, br.angle, 0.82, isNight)
                    )}
                </g>

                {/* Reliefs & Forêts denses dessinés à la main (hors brouillard inconnu) */}
                {(studioDraft.layers.relief || studioDraft.layers.biomes) && (
                  <g pointerEvents="none">
                    {geo.reliefSymbols.map(sym => {
                      const isMountain = sym.kind === 'mountain' || sym.kind === 'peak_small';
                      if (isMountain && !studioDraft.layers.relief) return null;
                      if (!isMountain && !studioDraft.layers.biomes && !studioDraft.layers.relief) {
                        return null;
                      }
                      if (isPointMasked(sym.x, sym.y)) return null;
                      return renderReliefArtwork(sym.id, sym.kind, sym.x, sym.y, sym.scale, isNight);
                    })}
                  </g>
                )}

                {/* Navires & Monstres marins */}
                {studioDraft.layers.ocean && (
                  <g pointerEvents="none">
                    {studioDraft.layers.routesMaritimes &&
                      geo.ships
                        .filter(sh => !isPointMasked(sh.x, sh.y))
                        .map(sh =>
                          renderShipArtwork(sh.id, sh.x, sh.y, sh.angle, sh.scale, isNight)
                        )}
                    {geo.seaMonsters
                      .filter(sm => !isPointMasked(sm.x, sm.y))
                      .map(sm =>
                        renderSeaMonsterArtwork(
                          sm.id,
                          sm.variant,
                          sm.x,
                          sm.y,
                          sm.scale,
                          isNight ? '#5d8396' : '#2c4a58'
                        )
                      )}
                  </g>
                )}

                {/* Frontières Provinces & États */}
                {studioDraft.layers.frontieres && (
                  <g pointerEvents="none">
                    {studioDraft.layers.provinces &&
                      geo.provinceBorders.map((seg, i) => (
                        <line
                          key={`pb_${i}`}
                          x1={seg[0][0]}
                          y1={seg[0][1]}
                          x2={seg[1][0]}
                          y2={seg[1][1]}
                          stroke="#2e231a"
                          strokeWidth={0.8}
                          strokeDasharray="2 2"
                          opacity={0.55}
                        />
                      ))}
                    {geo.stateBorders.map(sb => (
                      <g key={`sb_${sb.stateId}`}>
                        {sb.segments.map((seg, i) => (
                          <line
                            key={i}
                            x1={seg[0][0]}
                            y1={seg[0][1]}
                            x2={seg[1][0]}
                            y2={seg[1][1]}
                            stroke={style.borderDark}
                            strokeWidth={1.85}
                            strokeDasharray="4 2"
                            opacity={0.85}
                          />
                        ))}
                      </g>
                    ))}
                  </g>
                )}

                {/* Brouillard de guerre partagé (INCONNU = Terra Incognita, REPERE = voile léger) */}
                <g pointerEvents="none">
                  {geo.cells.map((c, idx) => {
                    const fog = cellFogStatus[idx];
                    if (fog === 'EXPLORE') return null;
                    const pts = cellPolyStrings[idx];
                    if (!pts) return null;
                    if (fog === 'INCONNU') {
                      return (
                        <polygon
                          key={`fog_${c.index}`}
                          points={pts}
                          fill="url(#azgaar-fog-pattern)"
                          fillOpacity={isTactique ? 0.9 : 0.16}
                          stroke="url(#azgaar-fog-pattern)"
                          strokeWidth={isTactique ? 0.7 : 0.25}
                        />
                      );
                    }
                    return (
                      <polygon
                        key={`fog_${c.index}`}
                        points={pts}
                        fill={isNight ? '#1b2430' : '#e2d5b7'}
                        fillOpacity={isTactique ? 0.34 : 0.08}
                      />
                    );
                  })}
                </g>

                {/* Grille secteur D&D actif (cliquable en Tactique & Atlas) */}
                {(isTactique || studioDraft.layers.grille || godmodeOverlay !== 'aucun') && (
                  <g>
                    {projectedHexes.map(({ hex: hx, x: cx, y: cy, poly }) => {
                      const isSel = hexSelectionneId ? hx.id === hexSelectionneId : false;
                      const isCur = hx.id === etat.hexActuel.id;
                      const isReachable =
                        !isCur && !hx.estEau && calculerDistanceHex(etat.hexActuel, hx) === 1;
                      const showDefaultGrid = studioDraft.layers.grille || godmodeOverlay !== 'aucun';
                      return (
                        <g
                          key={hx.id}
                          className={onSelectHex && brush.mode === 'none' ? 'cursor-pointer' : ''}
                          onPointerDown={e => {
                            if (brush.mode !== 'none' || !onSelectHex) return;
                            e.stopPropagation();
                            onSelectHex(hx);
                          }}
                        >
                          <title>
                            {hx.brouillard === 'INCONNU'
                              ? `Territoire inexploré [${hx.q},${hx.r}]`
                              : `${hx.nom} [${hx.q},${hx.r}]`}
                          </title>
                          <polygon
                            points={poly}
                            fill={isSel ? '#f59e0b' : 'transparent'}
                            fillOpacity={isSel ? 0.14 : 0}
                            stroke={
                              isSel
                                ? '#d97706'
                                : isCur
                                ? '#15803d'
                                : isReachable && isTactique
                                ? '#16a34a'
                                : !showDefaultGrid
                                ? 'transparent'
                                : isNight
                                ? '#e5cf9d'
                                : '#3c2a18'
                            }
                            strokeWidth={
                              isSel ? 2.2 : isCur ? 1.9 : isReachable && isTactique ? 1.2 : 0.85
                            }
                            strokeDasharray={
                              isSel || isCur ? undefined : isReachable || showDefaultGrid ? '4 3' : undefined
                            }
                            strokeOpacity={
                              isSel || isCur ? 0.95 : isReachable && isTactique ? 0.7 : 0.45
                            }
                          />
                          {godmodeOverlay !== 'aucun' && (
                            <text
                              x={cx}
                              y={cy + 24}
                              textAnchor="middle"
                              fontSize={7.2}
                              fontFamily="monospace"
                              fill={isNight ? '#f6ecd4' : '#2d2013'}
                              stroke={style.bgPaper}
                              strokeWidth={2}
                              paintOrder="stroke"
                              opacity={0.85}
                            >
                              [{hx.q},{hx.r}]
                            </text>
                          )}
                        </g>
                      );
                    })}
                  </g>
                )}

                {/* Vents dominants */}
                {studioDraft.layers.vents && (
                  <g pointerEvents="none" opacity={0.65}>
                    {geo.windVectors.map((v, idx) => (
                      <g key={idx}>
                        <line
                          x1={v.x}
                          y1={v.y}
                          x2={v.x + v.dx}
                          y2={v.y + v.dy}
                          stroke="#ffffff"
                          strokeWidth={1.6}
                        />
                        <circle cx={v.x + v.dx} cy={v.y + v.dy} r={2.2} fill="#f5e6c4" />
                      </g>
                    ))}
                  </g>
                )}

                {/* Ressources naturelles & Gisements réalistes (hors brouillard inconnu) */}
                {(studioDraft.layers.ressources ?? true) &&
                  studioDraft.resources &&
                  studioDraft.resources.length > 0 && (
                    <g>
                      {studioDraft.resources
                        .filter(res => !isPointMasked(res.x, res.y))
                        .map(res => {
                          const isResHover =
                            hoveredTarget?.kind === 'resource' &&
                            hoveredTarget.resource.id === res.id;
                          return (
                            <g
                              key={res.id}
                              className="cursor-pointer"
                              onPointerEnter={() =>
                                setHoveredTarget({ kind: 'resource', resource: res })
                              }
                              onPointerLeave={() =>
                                setHoveredTarget(prev =>
                                  prev?.kind === 'resource' && prev.resource.id === res.id
                                    ? null
                                    : prev
                                )
                              }
                            >
                              {renderResourceArtwork(
                                res.type,
                                res.x,
                                res.y,
                                isResHover ? 1.15 : 0.92,
                                isNight
                              )}
                            </g>
                          );
                        })}
                    </g>
                  )}

                {/* Unités en route (hors brouillard inconnu en mode tactique) */}
                {(godmodeOverlay === 'trafic' || studioDraft.layers.grille || isTactique) &&
                  entitesEnRoute.length > 0 && (
                    <g>
                      {entitesEnRoute.map((ent, idx) => {
                        const pos = projectedHexMap.get(ent.hexId);
                        const dest = projectedHexMap.get(ent.destinationHexId);
                        if (!pos || (isTactique && pos.hex.brouillard === 'INCONNU')) return null;
                        const offset = (idx % 3) * 14 - 14;
                        const ex = pos.x + offset;
                        const ey = pos.y - 16;
                        const badgeFill =
                          ent.type === 'CARAVANE'
                            ? '#b45309'
                            : ent.type === 'RAIDER'
                            ? '#9f1239'
                            : ent.type === 'PATROUILLE'
                            ? '#1d4ed8'
                            : ent.type === 'REFUGIES'
                            ? '#6d28d9'
                            : '#15803d';
                        const badgeCode = ent.type === 'REFUGIES' ? 'Rf' : ent.type.charAt(0);
                        const routePts = (ent.itineraire || [])
                          .map(id => projectedHexMap.get(id))
                          .filter((n): n is (typeof projectedHexes)[number] => Boolean(n));
                        return (
                          <g
                            key={`az_unit_${ent.id}`}
                            className="cursor-pointer"
                            onPointerEnter={() => setHoveredTarget({ kind: 'entity', entity: ent })}
                            onPointerLeave={() =>
                              setHoveredTarget(prev =>
                                prev?.kind === 'entity' && prev.entity.id === ent.id ? null : prev
                              )
                            }
                          >
                            {godmodeOverlay === 'trafic' && dest && dest.hex.id !== pos.hex.id && (
                              <>
                                {routePts.length >= 2 ? (
                                  <polyline
                                    points={routePts
                                      .map((p, rIdx) =>
                                        rIdx === 0 ? `${ex},${ey}` : `${p.x},${p.y - 16}`
                                      )
                                      .join(' ')}
                                    fill="none"
                                    stroke={badgeFill}
                                    strokeWidth={2}
                                    strokeDasharray="5,3"
                                    opacity={0.85}
                                  />
                                ) : (
                                  <line
                                    x1={ex}
                                    y1={ey}
                                    x2={dest.x}
                                    y2={dest.y - 16}
                                    stroke={badgeFill}
                                    strokeWidth={2}
                                    strokeDasharray="5,3"
                                    opacity={0.85}
                                  />
                                )}
                                <circle cx={dest.x} cy={dest.y - 16} r={3} fill={badgeFill} />
                              </>
                            )}
                            <circle
                              cx={ex}
                              cy={ey}
                              r={6.8}
                              fill={badgeFill}
                              stroke="#fcf7eb"
                              strokeWidth={1.3}
                            />
                            <text
                              x={ex}
                              y={ey + 2.4}
                              textAnchor="middle"
                              fill="#ffffff"
                              fontSize={badgeCode.length > 1 ? 6.5 : 7.8}
                              fontWeight="bold"
                              fontFamily="Plus Jakarta Sans, sans-serif"
                            >
                              {badgeCode}
                            </text>
                          </g>
                        );
                      })}
                    </g>
                  )}

                {/* Bourgs & Capitales dessinés à la main + Blasons activables (hors brouillard inconnu) */}
                {studioDraft.layers.bourgs && (
                  <g>
                    {studioDraft.burgs
                      .filter(b => b.id === studioDraft.heroBurgId || !isPointMasked(b.x, b.y))
                      .map(b => {
                      const isSelected = b.id === selectedBurgId;
                      const variant: SettlementArtVariant = b.capital
                        ? 'capital'
                        : b.citadel
                        ? 'citadel'
                        : b.population >= 2500 || b.walls
                        ? 'town'
                        : 'village';
                      const artScale = b.capital
                        ? 1.12
                        : b.citadel
                        ? 1.02
                        : b.population >= 2500
                        ? 0.94
                        : 0.86;
                      const stateCol = stateColorMap.get(b.stateId) || '#9e3b2b';
                      const showBlason =
                        blasonsActifs &&
                        (b.capital ||
                          b.citadel ||
                          b.walls ||
                          b.port ||
                          b.population >= 1900 ||
                          isSelected);
                      const coa = b.coa || stateCoaMap.get(b.stateId);

                      return (
                        <g
                          key={b.id}
                          transform={`translate(${b.x}, ${b.y})`}
                          className="cursor-pointer"
                          onPointerEnter={() => setHoveredTarget({ kind: 'burg', burg: b })}
                          onPointerLeave={() =>
                            setHoveredTarget(prev =>
                              prev?.kind === 'burg' && prev.burg.id === b.id ? null : prev
                            )
                          }
                          onPointerDown={e => {
                            if (brush.mode !== 'none') return;
                            e.stopPropagation();
                            setSelectedBurgId(b.id);
                            setSelectedMarkerId(null);
                            if (b.hexId && onSelectHex) {
                              const linkedHex = etat.hexagones.find(h => h.id === b.hexId);
                              if (linkedHex) onSelectHex(linkedHex);
                            }
                          }}
                        >
                          {isSelected && (
                            <circle
                              cx={0}
                              cy={0}
                              r={14}
                              fill="#f59e0b"
                              fillOpacity={0.18}
                              stroke="#d97706"
                              strokeWidth={2}
                            />
                          )}
                          {renderSettlementArtwork({
                            variant,
                            x: 0,
                            y: 0,
                            scale: artScale,
                            accentColor: stateCol,
                            isNight,
                            hasWalls: b.walls,
                            hasPort: b.port,
                            hasTemple: b.temple,
                          })}
                          {showBlason &&
                            coa &&
                            renderMiniShieldSvg(
                              `az_coa_${b.id}`,
                              coa,
                              0,
                              b.capital ? -29 : -21,
                              b.capital ? 18 : 14
                            )}
                        </g>
                      );
                    })}
                  </g>
                )}

                {/* Marqueurs Joueur & IA MJ dessinés à la main */}
                {studioDraft.layers.marqueurs && (
                  <g>
                    {studioDraft.markers
                      .filter(m => m.author === 'JOUEUR' || !isPointMasked(m.x, m.y))
                      .map(m => {
                      const isMj = m.author === 'MJ';
                      const isSel = m.id === selectedMarkerId;
                      const artVariant: SettlementArtVariant | null =
                        m.icon === 'donjon'
                          ? 'donjon'
                          : m.icon === 'ruine'
                          ? 'ruine'
                          : m.icon === 'camp'
                          ? 'camp'
                          : m.icon === 'port'
                          ? 'town'
                          : null;
                      return (
                        <g
                          key={m.id}
                          transform={`translate(${m.x}, ${m.y})`}
                          className="cursor-pointer"
                          onPointerEnter={() => setHoveredTarget({ kind: 'marker', marker: m })}
                          onPointerLeave={() =>
                            setHoveredTarget(prev =>
                              prev?.kind === 'marker' && prev.marker.id === m.id ? null : prev
                            )
                          }
                          onPointerDown={e => {
                            if (brush.mode !== 'none') return;
                            e.stopPropagation();
                            setSelectedMarkerId(m.id);
                            setSelectedBurgId(null);
                          }}
                        >
                          {isSel && (
                            <circle
                              cx={0}
                              cy={-2}
                              r={12}
                              fill="none"
                              stroke="#fbbf24"
                              strokeWidth={2}
                            />
                          )}
                          {artVariant ? (
                            renderSettlementArtwork({
                              variant: artVariant,
                              x: 0,
                              y: 0,
                              scale: 0.95,
                              accentColor: isMj ? '#9f1239' : '#1d4ed8',
                              isNight,
                              hasPort: m.icon === 'port',
                            })
                          ) : (
                            <>
                              <path
                                d="M 0,0 L -6,-13 A 7,7 0 1,1 6,-13 Z"
                                fill={isMj ? '#b42318' : '#1d4ed8'}
                                stroke={isSel ? '#fbbf24' : '#ffffff'}
                                strokeWidth={isSel ? 2.2 : 1.2}
                              />
                              <circle cx={0} cy={-14} r={2.3} fill="#fff7ed" />
                            </>
                          )}
                        </g>
                      );
                    })}
                  </g>
                )}

                {/* Jeton Héros */}
                <g transform={`translate(${heroX}, ${heroY})`} pointerEvents="none">
                  <circle cx={0} cy={0} r={11} fill="#f59e0b" fillOpacity={0.25} />
                  <circle
                    cx={0}
                    cy={0}
                    r={6.2}
                    fill="#f59e0b"
                    stroke="#1c140e"
                    strokeWidth={1.6}
                  />
                  <circle cx={0} cy={0} r={2.2} fill="#fffbeb" />
                </g>

                {/* Couche d'étiquettes anti-collision pondérées par échelle de zoom */}
                {studioDraft.layers.etiquettes && placedLabels.length > 0 && (
                  <g pointerEvents="none" data-testid="azgaar-labels-layer">
                    {placedLabels.map(lbl => {
                      if (lbl.kind === 'ocean') {
                        return (
                          <text
                            key={lbl.id}
                            x={lbl.x}
                            y={lbl.y}
                            textAnchor={lbl.textAnchor}
                            fontFamily="Cinzel, serif"
                            fontStyle="italic"
                            fontSize={lbl.fontSize}
                            letterSpacing="2"
                            fill={style.textColor}
                            opacity={0.62}
                          >
                            {lbl.text}
                          </text>
                        );
                      }
                      if (lbl.kind === 'state') {
                        return (
                          <text
                            key={lbl.id}
                            x={lbl.x}
                            y={lbl.y}
                            textAnchor={lbl.textAnchor}
                            fontFamily="Cinzel, serif"
                            fontWeight="700"
                            fontSize={lbl.fontSize}
                            letterSpacing="1.2"
                            fill={style.textColor}
                            stroke={style.bgPaper}
                            strokeWidth={2.8 / Math.pow(zoom, 0.3)}
                            paintOrder="stroke"
                            opacity={0.86}
                          >
                            {lbl.text}
                          </text>
                        );
                      }
                      if (lbl.kind === 'resource') {
                        return (
                          <text
                            key={lbl.id}
                            x={lbl.x}
                            y={lbl.y}
                            textAnchor={lbl.textAnchor}
                            fontFamily="Lora, serif"
                            fontStyle="italic"
                            fontSize={lbl.fontSize}
                            fill={isNight ? '#d9c59a' : '#4a351e'}
                            stroke={style.bgPaper}
                            strokeWidth={2 / Math.pow(zoom, 0.35)}
                            paintOrder="stroke"
                            opacity={0.92}
                          >
                            {lbl.text}
                          </text>
                        );
                      }
                      if (lbl.kind === 'marker') {
                        return (
                          <text
                            key={lbl.id}
                            x={lbl.x}
                            y={lbl.y}
                            textAnchor={lbl.textAnchor}
                            fontFamily="Lora, serif"
                            fontSize={lbl.fontSize}
                            fontWeight="600"
                            fill={isNight ? '#fcd34d' : '#7f1d1d'}
                            stroke={style.bgPaper}
                            strokeWidth={2.1 / Math.pow(zoom, 0.35)}
                            paintOrder="stroke"
                          >
                            {lbl.text}
                          </text>
                        );
                      }
                      if (lbl.kind === 'hero') {
                        return (
                          <text
                            key={lbl.id}
                            x={lbl.x}
                            y={lbl.y}
                            textAnchor={lbl.textAnchor}
                            fontFamily="Cinzel, Lora, serif"
                            fontSize={lbl.fontSize}
                            fontWeight="700"
                            fill="#92400e"
                            stroke="#fffbeb"
                            strokeWidth={2.5 / Math.pow(zoom, 0.35)}
                            paintOrder="stroke"
                          >
                            {lbl.text}
                          </text>
                        );
                      }
                      const isCapitalOrCitadel = lbl.kind === 'capital' || lbl.kind === 'citadel';
                      return (
                        <text
                          key={lbl.id}
                          x={lbl.x}
                          y={lbl.y}
                          textAnchor={lbl.textAnchor}
                          fontFamily={isCapitalOrCitadel ? 'Cinzel, Lora, serif' : 'Lora, Georgia, serif'}
                          fontSize={lbl.fontSize}
                          fontWeight={isCapitalOrCitadel ? '700' : '600'}
                          fill={style.textColor}
                          stroke={style.bgPaper}
                          strokeWidth={2.4 / Math.pow(zoom, 0.35)}
                          paintOrder="stroke"
                        >
                          {lbl.text}
                        </text>
                      );
                    })}
                  </g>
                )}

                {/* Curseur Pinceau */}
                {brush.mode !== 'none' &&
                  brush.mode !== 'burg' &&
                  brush.mode !== 'marker' &&
                  hoverPos && (
                    <circle
                      cx={hoverPos.x}
                      cy={hoverPos.y}
                      r={brush.radius}
                      fill="#fbbf24"
                      fillOpacity={0.14}
                      stroke="#fbbf24"
                      strokeWidth={1.5}
                      strokeDasharray="4 3"
                      pointerEvents="none"
                    />
                  )}
              </g>
            </g>

            {/* Vignette parchemin */}
            <rect
              x="10"
              y="10"
              width="1180"
              height="740"
              fill="url(#azgaar-vignette)"
              pointerEvents="none"
            />

            {/* Cartouche titre calligraphié sur ruban parchemin (haut gauche) */}
            <g pointerEvents="none">
              {renderParchmentBannerArtwork('world_banner', studioDraft.worldName, 146, 36, {
                width: Math.max(170, Math.min(250, studioDraft.worldName.length * 9 + 46)),
                fontSize: 11.5,
                isNight,
                subtitle: `${studioDraft.states.length} royaumes · ${studioDraft.burgs.length} cités`,
              })}
            </g>

            {/* Échelle graphique (bas gauche) */}
            <g transform="translate(26, 722)" pointerEvents="none">
              <rect
                x={-4}
                y={-12}
                width={120}
                height={24}
                rx={3}
                fill={isNight ? '#1f2630' : '#f6edd8'}
                fillOpacity={0.86}
                stroke={isNight ? '#967643' : '#a88c5d'}
                strokeWidth={0.85}
              />
              <rect x={4} y={-2} width={46} height={4} fill="#36271c" stroke="#36271c" strokeWidth={0.6} />
              <rect x={50} y={-2} width={46} height={4} fill="#fcf6e6" stroke="#36271c" strokeWidth={0.6} />
              <text x={4} y={-4} fontSize={7.8} fontFamily="monospace" fill={isNight ? '#e8d7b4' : '#36271c'}>
                0
              </text>
              <text
                x={96}
                y={-4}
                textAnchor="end"
                fontSize={7.8}
                fontFamily="monospace"
                fill={isNight ? '#e8d7b4' : '#36271c'}
              >
                {lieuesEchelle} lieues
              </text>
            </g>

            {/* Rose des vents enluminée 16 branches (bas droite) */}
            <g pointerEvents="none">
              {renderCompassRoseArtwork(1144, 704, 28, isNight)}
            </g>

            {/* Bordure cartographique enluminée */}
            {renderIlluminatedBorderArtwork(1200, 760, isNight)}
          </svg>

          {/* Carte d'information détaillée au survol (respecte le brouillard en mode tactique) */}
          {hoveredTarget && (
            <div
              data-testid="map-hover-card"
              className={`pointer-events-none absolute ${
                isTactique ? 'top-11 right-2.5' : 'top-3 right-3'
              } z-20 max-w-[270px] rounded-md border border-[#8e6d36] bg-[#faf2dc]/95 shadow-md px-3 py-2 text-[11px] text-[#231a14] space-y-1`}
            >
              {hoveredTarget.kind === 'burg' && (
                <>
                  <div className="flex items-center justify-between gap-2 border-b border-[#dcc79a] pb-1">
                    <span className="font-display font-bold text-[#2a1d13] truncate">
                      {hoveredTarget.burg.name}
                    </span>
                    <span className="font-mono text-[10px] text-[#7c5821] shrink-0">
                      {hoveredTarget.burg.capital
                        ? 'Capitale'
                        : hoveredTarget.burg.citadel
                        ? 'Citadelle'
                        : hoveredTarget.burg.port
                        ? 'Port'
                        : 'Bourg'}
                    </span>
                  </div>
                  <div className="text-[10px] text-[#5c4734]">
                    {studioDraft.states.find(s => s.id === hoveredTarget.burg.stateId)?.name ||
                      'Territoire libre'}
                    {hoveredTarget.burg.specialisation
                      ? ` · ${hoveredTarget.burg.specialisation}`
                      : ''}
                  </div>
                  <div className="font-mono tabular-nums text-[10px] text-[#3a2a1b]">
                    Pop. {hoveredTarget.burg.population} · Garnison {hoveredTarget.burg.garrison}
                    {hoveredTarget.burg.tresorerie !== undefined
                      ? ` · Trésor ${hoveredTarget.burg.tresorerie} po`
                      : ''}
                  </div>
                  {hoveredTarget.burg.exportations && hoveredTarget.burg.exportations.length > 0 && (
                    <div className="text-[10px] text-emerald-900">
                      Exp. :{' '}
                      {hoveredTarget.burg.exportations
                        .map(t => RESSOURCES_CATALOGUE[t]?.label || t)
                        .join(', ')}
                    </div>
                  )}
                  {hoveredTarget.burg.importations && hoveredTarget.burg.importations.length > 0 && (
                    <div className="text-[10px] text-amber-900">
                      Imp. :{' '}
                      {hoveredTarget.burg.importations
                        .map(t => RESSOURCES_CATALOGUE[t]?.label || t)
                        .join(', ')}
                    </div>
                  )}
                </>
              )}

              {hoveredTarget.kind === 'resource' && (
                <>
                  <div className="flex items-center justify-between gap-2 border-b border-[#dcc79a] pb-1">
                    <span className="font-display font-bold text-[#2a1d13] truncate">
                      {hoveredTarget.resource.nom}
                    </span>
                    <span className="font-mono text-[10px] text-[#7c5821] shrink-0">
                      {'★'.repeat(hoveredTarget.resource.richesse)}
                    </span>
                  </div>
                  <div className="text-[10px] text-[#5c4734]">
                    {RESSOURCES_CATALOGUE[hoveredTarget.resource.type]?.label ||
                      hoveredTarget.resource.type}{' '}
                    · Réserve {hoveredTarget.resource.reserve}%
                  </div>
                  {hoveredTarget.resource.exploiteParStateId && (
                    <div className="text-[10px] text-[#463626]">
                      Exploité par :{' '}
                      {studioDraft.states.find(
                        s => s.id === hoveredTarget.resource.exploiteParStateId
                      )?.name || 'État local'}
                    </div>
                  )}
                </>
              )}

              {hoveredTarget.kind === 'marker' && (
                <>
                  <div className="flex items-center justify-between gap-2 border-b border-[#dcc79a] pb-1">
                    <span className="font-display font-bold text-[#2a1d13] truncate">
                      {hoveredTarget.marker.title}
                    </span>
                    <span className="font-mono text-[10px] text-[#7c5821] shrink-0">
                      {hoveredTarget.marker.author === 'MJ' ? 'Repère MJ' : 'Note'}
                    </span>
                  </div>
                  <div className="text-[10px] text-[#5c4734]">{hoveredTarget.marker.note}</div>
                </>
              )}

              {hoveredTarget.kind === 'entity' && (
                <>
                  <div className="flex items-center justify-between gap-2 border-b border-[#dcc79a] pb-1">
                    <span className="font-display font-bold text-[#2a1d13] truncate">
                      {hoveredTarget.entity.nom}
                    </span>
                    <span className="font-mono text-[10px] text-[#7c5821] shrink-0">
                      F{hoveredTarget.entity.force}
                    </span>
                  </div>
                  <div className="text-[10px] text-[#5c4734]">
                    {etat.hexagones.find(h => h.id === hoveredTarget.entity.hexId)?.nom ||
                      hoveredTarget.entity.hexId}{' '}
                    →{' '}
                    {etat.hexagones.find(
                      h => h.id === hoveredTarget.entity.destinationHexId
                    )?.nom || hoveredTarget.entity.destinationHexId}
                  </div>
                  {hoveredTarget.entity.cargaison && (
                    <div className="text-[10px] text-amber-900">
                      Cargaison : {hoveredTarget.entity.cargaison}
                    </div>
                  )}
                </>
              )}

              {hoveredTarget.kind === 'tradeFlow' && (
                <>
                  <div className="flex items-center justify-between gap-2 border-b border-[#dcc79a] pb-1">
                    <span className="font-display font-bold text-[#2a1d13] truncate">
                      Flux :{' '}
                      {RESSOURCES_CATALOGUE[hoveredTarget.flow.denree]?.label ||
                        hoveredTarget.flow.denree}
                    </span>
                    <span className="font-mono text-[10px] text-[#7c5821] shrink-0">
                      Vol. {hoveredTarget.flow.volume}/5
                    </span>
                  </div>
                  <div className="text-[10px] text-[#5c4734]">
                    {studioDraft.burgs.find(b => b.id === hoveredTarget.flow.fromBurgId)?.name ||
                      'Origine'}{' '}
                    →{' '}
                    {studioDraft.burgs.find(b => b.id === hoveredTarget.flow.toBurgId)?.name ||
                      'Destination'}{' '}
                    ({hoveredTarget.flow.kind === 'sea' ? 'Voie maritime' : 'Voie terrestre'})
                  </div>
                </>
              )}

              {hoveredTarget.kind === 'hex' && (
                isTactique && hoveredTarget.hex.brouillard === 'INCONNU' ? (
                  <>
                    <div className="font-display font-bold text-[#2a1d13]">
                      Territoire inexploré [{hoveredTarget.hex.q},{hoveredTarget.hex.r}]
                    </div>
                    <div className="text-[10px] text-[#6d5742]">
                      Explorez ce secteur pour révéler ses ressources, routes et périls.
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-2 border-b border-[#dcc79a] pb-1">
                      <span className="font-display font-bold text-[#2a1d13] truncate">
                        {hoveredTarget.hex.nom} [{hoveredTarget.hex.q},{hoveredTarget.hex.r}]
                      </span>
                      <span className="font-mono text-[10px] text-[#7c5821] shrink-0">
                        {hoveredTarget.hex.securite}
                      </span>
                    </div>
                    <div className="text-[10px] text-[#5c4734]">
                      {hoveredTarget.hex.estEau
                        ? 'Mer ouverte'
                        : hoveredTarget.hex.biomeAzgaar || hoveredTarget.hex.terrain}
                      {hoveredTarget.hex.specialiteEconomique
                        ? ` · ${hoveredTarget.hex.specialiteEconomique}`
                        : ''}
                    </div>
                    {!hoveredTarget.hex.estEau && (
                      <div className="font-mono tabular-nums text-[10px] text-[#3a2a1b]">
                        Danger {hoveredTarget.hex.pressionDanger ?? 30}% · Prosp.{' '}
                        {hoveredTarget.hex.prosperite ?? 30}% · Pop.{' '}
                        {hoveredTarget.hex.population ?? 60}
                      </div>
                    )}
                    {hoveredTarget.hex.ressourcePrincipale && (
                      <div className="text-[10px] text-emerald-900">
                        Ressource :{' '}
                        {RESSOURCES_CATALOGUE[hoveredTarget.hex.ressourcePrincipale]?.label ||
                          hoveredTarget.hex.ressourcePrincipale}
                      </div>
                    )}
                  </>
                )
              )}
            </div>
          )}

          {/* Fiche inline bourg ou marqueur (sans aucune popup) */}
          {(selectedBurg || selectedMarker) && (
            <div className="absolute bottom-3 left-3 z-10">
              <AzgaarBurgCard
                studio={studioDraft}
                burg={selectedBurg}
                marker={selectedMarker}
                loreRegion={
                  selectedBurg
                    ? etat.loreMonde?.regionsLore.find(
                        r =>
                          r.burgId === selectedBurg.id ||
                          (selectedBurg.hexId && r.hexId === selectedBurg.hexId)
                      )
                    : undefined
                }
                pnjs={
                  selectedBurg
                    ? (etat.pnjsMonde || []).filter(
                        p =>
                          p.burgId === selectedBurg.id ||
                          (selectedBurg.hexId && p.hexId === selectedBurg.hexId)
                      )
                    : []
                }
                showSecrets={!isTactique}
                onPromoteNpc={onPromoteNpc}
                onUpdateBurg={updated => {
                  const nextBurgs = studioDraft.burgs.map(b =>
                    b.id === updated.id ? updated : b
                  );
                  applyStudioUpdate({ ...studioDraft, burgs: nextBurgs }, true);
                }}
                onDeleteBurg={burgId => {
                  const nextBurgs = studioDraft.burgs.filter(b => b.id !== burgId);
                  const nextRoutes = studioDraft.routes.filter(
                    r => r.fromBurgId !== burgId && r.toBurgId !== burgId
                  );
                  applyStudioUpdate(
                    { ...studioDraft, burgs: nextBurgs, routes: nextRoutes },
                    true
                  );
                  setSelectedBurgId(null);
                }}
                onUpdateMarker={updated => {
                  const nextMarkers = studioDraft.markers.map(m =>
                    m.id === updated.id ? updated : m
                  );
                  applyStudioUpdate({ ...studioDraft, markers: nextMarkers }, true);
                }}
                onDeleteMarker={markerId => {
                  const nextMarkers = studioDraft.markers.filter(m => m.id !== markerId);
                  applyStudioUpdate({ ...studioDraft, markers: nextMarkers }, true);
                  setSelectedMarkerId(null);
                }}
                onCenterOn={centerOn}
                onClose={() => {
                  setSelectedBurgId(null);
                  setSelectedMarkerId(null);
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Barre d'état cartographique en bas (Atelier uniquement) */}
      {!isTactique && (
        <div className="px-3 py-1.5 bg-[#e6dac0] border-t border-[#cab58b] text-[11px] text-[#3a2c1e] flex flex-wrap items-center justify-between gap-2 font-mono tabular-nums">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
            <span>
              {hoverCell ? `${Math.round(hoverCell.x)}, ${Math.round(hoverCell.y)}` : '—'}
            </span>
            <span>Alt {hoverCell ? `${hoverCell.h}` : '—'}</span>
            <span>{hoverCell ? `${hoverCell.temp}°C` : '—'}</span>
            <span>Pluie {hoverCell ? `${hoverCell.precip}%` : '—'}</span>
            <span className="font-sans font-medium">{hoverBiome}</span>
            <span className="font-sans">État : {hoverState}</span>
            <span className="font-sans">Province : {hoverProv}</span>
            <span className="font-sans">Culture : {hoverCul}</span>
            <span className="font-sans">Culte : {hoverRel}</span>
          </div>
          <div className="text-[10px] text-[#6d5536]">
            {studioDraft.cellsDesired} cell. · {studioDraft.states.length} États ·{' '}
            {studioDraft.burgs.length} bourgs · {studioDraft.markers.length} repères
          </div>
        </div>
      )}
    </div>
  );
};
