import React, { useRef, useState } from 'react';
import {
  AzgaarBurgDef,
  AzgaarClimateBias,
  AzgaarDiplomacyStatus,
  AzgaarLayerKey,
  AzgaarMarkerDef,
  AzgaarMarkerIcon,
  AzgaarStylePreset,
  AzgaarTemplateId,
  AzgaarWorldState,
} from '../types';
import {
  AZGAAR_BIOMES,
  AZGAAR_STYLE_PRESETS,
  AZGAAR_TEMPLATES,
} from '../engine/azgaarVoronoi';
import { CoatOfArmsSvg } from './CoatOfArmsSvg';
import { Dices, Download, Upload, RefreshCw, X } from 'lucide-react';

export type AzgaarMenuTab = 'couches' | 'outils' | 'options' | 'style';

export type AzgaarBrushMode =
  | 'none'
  | 'elevate'
  | 'lower'
  | 'smooth'
  | 'sea'
  | 'biome'
  | 'state'
  | 'culture'
  | 'religion'
  | 'burg'
  | 'marker';

export interface AzgaarBrushConfig {
  mode: AzgaarBrushMode;
  radius: number;
  biomeId: number;
  stateId: number;
  cultureId: number;
  religionId: number;
  markerIcon: AzgaarMarkerIcon;
}

interface AzgaarMenuDrawerProps {
  activeMenu: AzgaarMenuTab;
  studio: AzgaarWorldState;
  brush: AzgaarBrushConfig;
  chargement?: boolean;
  onClose: () => void;
  onChangeBrush: (next: AzgaarBrushConfig) => void;
  onUpdateStudio: (next: AzgaarWorldState, persistServer?: boolean) => void;
  onSelectBurg: (burg: AzgaarBurgDef) => void;
  onSelectMarker: (marker: AzgaarMarkerDef) => void;
  onCenterOn: (x: number, y: number) => void;
  onRegenerate: (opts: {
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
  onImportRaw: (rawText: string) => void;
  onExportJson: () => void;
  onExportSvg: () => void;
}

const LAYER_LABELS: Array<{ key: AzgaarLayerKey; label: string }> = [
  { key: 'ocean', label: 'Océan' },
  { key: 'relief', label: 'Relief' },
  { key: 'biomes', label: 'Biomes' },
  { key: 'etats', label: 'États' },
  { key: 'provinces', label: 'Provinces' },
  { key: 'cultures', label: 'Cultures' },
  { key: 'religions', label: 'Religions' },
  { key: 'rivieres', label: 'Rivières' },
  { key: 'routes', label: 'Routes' },
  { key: 'routesMaritimes', label: 'Mer' },
  { key: 'frontieres', label: 'Frontières' },
  { key: 'bourgs', label: 'Bourgs' },
  { key: 'blasons', label: 'Blasons' },
  { key: 'marqueurs', label: 'Marqueurs' },
  { key: 'ressources', label: 'Ressources' },
  { key: 'fluxCommerciaux', label: 'Flux éco.' },
  { key: 'vents', label: 'Vents' },
  { key: 'etiquettes', label: 'Étiquettes' },
  { key: 'grille', label: 'Secteur D&D' },
];

const DIPLO_CYCLE: AzgaarDiplomacyStatus[] = ['Allie', 'Paix', 'Rival', 'Guerre'];

export const AzgaarMenuDrawer: React.FC<AzgaarMenuDrawerProps> = ({
  activeMenu,
  studio,
  brush,
  chargement = false,
  onClose,
  onChangeBrush,
  onUpdateStudio,
  onSelectBurg,
  onSelectMarker,
  onCenterOn,
  onRegenerate,
  onImportRaw,
  onExportJson,
  onExportSvg,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [tableTab, setTableTab] = useState<'bourgs' | 'etats' | 'cultures' | 'religions' | 'marqueurs'>('bourgs');

  // Options form state initialized from current world
  const [optSeed, setOptSeed] = useState(studio.seed);
  const [optName, setOptName] = useState(studio.worldName);
  const [optTemplate, setOptTemplate] = useState<AzgaarTemplateId>(studio.template);
  const [optCells, setOptCells] = useState<800 | 1500 | 2400>(studio.cellsDesired);
  const [optClimate, setOptClimate] = useState<AzgaarClimateBias>(studio.climateBias);
  const [optWind, setOptWind] = useState(studio.windAngle);
  const [optStates, setOptStates] = useState(studio.states.length || 5);
  const [optCultures, setOptCultures] = useState(studio.cultures.length || 4);
  const [optReligions, setOptReligions] = useState(studio.religions.length || 3);
  const [optBurgs, setOptBurgs] = useState(studio.burgs.length || 22);

  const toggleLayer = (key: AzgaarLayerKey) => {
    const curVal = key === 'blasons' ? (studio.layers[key] ?? true) : Boolean(studio.layers[key]);
    onUpdateStudio(
      {
        ...studio,
        layers: { ...studio.layers, [key]: !curVal },
      },
      true
    );
  };

  const applyLayerPreset = (preset: 'politique' | 'biomes' | 'economie' | 'cultures' | 'religions' | 'provinces' | 'relief') => {
    const base = { ...studio.layers };
    base.etats = preset === 'politique';
    base.provinces = preset === 'provinces';
    base.cultures = preset === 'cultures';
    base.religions = preset === 'religions';
    base.biomes = preset === 'biomes' || preset === 'relief' || preset === 'economie';
    base.relief = true;
    base.frontieres = preset === 'politique' || preset === 'provinces';
    if (preset === 'economie') {
      base.ressources = true;
      base.fluxCommerciaux = true;
      base.routes = true;
      base.routesMaritimes = true;
    }
    onUpdateStudio({ ...studio, layers: base }, true);
  };

  const cycleDiplomacy = (sAId: number, sBId: number) => {
    const nextStates = studio.states.map(s => {
      if (s.id === sAId) {
        const cur = s.diplomacy[sBId] || 'Paix';
        const nextVal = DIPLO_CYCLE[(DIPLO_CYCLE.indexOf(cur) + 1) % DIPLO_CYCLE.length];
        return { ...s, diplomacy: { ...s.diplomacy, [sBId]: nextVal } };
      }
      if (s.id === sBId) {
        const cur = studio.states.find(x => x.id === sAId)?.diplomacy[sBId] || 'Paix';
        const nextVal = DIPLO_CYCLE[(DIPLO_CYCLE.indexOf(cur) + 1) % DIPLO_CYCLE.length];
        return { ...s, diplomacy: { ...s.diplomacy, [sAId]: nextVal } };
      }
      return s;
    });
    onUpdateStudio({ ...studio, states: nextStates }, true);
  };

  return (
    <aside className="w-[330px] shrink-0 dnd-panel border border-[#b99f72] rounded-lg flex flex-col max-h-[680px] overflow-hidden text-xs">
      <div className="dnd-wood-header px-3 py-2 flex items-center justify-between">
        <span className="font-display font-semibold tracking-wide text-[#f2dfba] capitalize">
          {activeMenu}
        </span>
        <button onClick={onClose} className="text-[#decfae] hover:text-white cursor-pointer" title="Fermer">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="p-3 overflow-y-auto space-y-3 flex-1">
        {activeMenu === 'couches' && (
          <>
            <div className="space-y-1">
              <div className="text-[10px] uppercase tracking-wider text-[#6e5637] font-semibold">
                Préréglages
              </div>
              <div className="grid grid-cols-3 gap-1">
                {(
                  [
                    ['politique', 'Politique'],
                    ['economie', 'Économie'],
                    ['biomes', 'Biomes'],
                    ['cultures', 'Cultures'],
                    ['religions', 'Religions'],
                    ['provinces', 'Provinces'],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    onClick={() => applyLayerPreset(id)}
                    className="px-2 py-1 rounded border border-[#cbb68c] bg-[#f4ebd4] hover:bg-[#e8d9b4] text-[11px] font-medium cursor-pointer"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-[10px] uppercase tracking-wider text-[#6e5637] font-semibold">
                Calques actifs
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {LAYER_LABELS.map(l => (
                  <label
                    key={l.key}
                    className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#f4ebd4]/80 border border-[#d6c39c] cursor-pointer select-none"
                  >
                    <input
                      type="checkbox"
                      checked={l.key === 'blasons' ? (studio.layers[l.key] ?? true) : Boolean(studio.layers[l.key])}
                      onChange={() => toggleLayer(l.key)}
                      className="accent-[#7a521c]"
                    />
                    <span className="text-[11px] truncate">{l.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <label className="block space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-[#6e5637] font-semibold">Opacité États</span>
                <span className="font-mono tabular-nums">{Math.round(studio.stateOpacity * 100)}%</span>
              </div>
              <input
                type="range"
                min={10}
                max={85}
                value={Math.round(studio.stateOpacity * 100)}
                onChange={e =>
                  onUpdateStudio({ ...studio, stateOpacity: Number(e.target.value) / 100 }, true)
                }
                className="w-full accent-[#7a521c]"
              />
            </label>
          </>
        )}

        {activeMenu === 'outils' && (
          <>
            <div className="space-y-1.5">
              <div className="text-[10px] uppercase tracking-wider text-[#6e5637] font-semibold">
                Pinceaux & Édition
              </div>
              <div className="grid grid-cols-3 gap-1">
                {(
                  [
                    ['none', 'Inspecter'],
                    ['elevate', 'Élever'],
                    ['lower', 'Creuser'],
                    ['smooth', 'Lisser'],
                    ['sea', 'Mer'],
                    ['biome', 'Biome'],
                    ['state', 'État'],
                    ['culture', 'Culture'],
                    ['religion', 'Religion'],
                    ['burg', '+ Bourg'],
                    ['marker', '+ Marqueur'],
                  ] as Array<[AzgaarBrushMode, string]>
                ).map(([mode, label]) => (
                  <button
                    key={mode}
                    onClick={() => onChangeBrush({ ...brush, mode })}
                    className={`px-1.5 py-1 rounded border text-[11px] cursor-pointer transition-colors ${
                      brush.mode === mode
                        ? 'dnd-wood-bar border-[#7e5b27]'
                        : 'bg-[#f4ebd4] border-[#cbb68c] hover:bg-[#e8d9b4]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {brush.mode !== 'none' && brush.mode !== 'burg' && brush.mode !== 'marker' && (
                <label className="block space-y-0.5 pt-1">
                  <div className="flex justify-between text-[10px] text-[#6e5637]">
                    <span>Rayon pinceau</span>
                    <span className="font-mono tabular-nums">{brush.radius} px</span>
                  </div>
                  <input
                    type="range"
                    min={25}
                    max={110}
                    value={brush.radius}
                    onChange={e => onChangeBrush({ ...brush, radius: Number(e.target.value) })}
                    className="w-full accent-[#7a521c]"
                  />
                </label>
              )}

              {brush.mode === 'biome' && (
                <select
                  value={brush.biomeId}
                  onChange={e => onChangeBrush({ ...brush, biomeId: Number(e.target.value) })}
                  className="w-full bg-white/85 border border-[#cbb68c] rounded px-2 py-1 text-[11px]"
                >
                  {AZGAAR_BIOMES.filter(b => b.id >= 2).map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              )}

              {brush.mode === 'state' && (
                <select
                  value={brush.stateId}
                  onChange={e => onChangeBrush({ ...brush, stateId: Number(e.target.value) })}
                  className="w-full bg-white/85 border border-[#cbb68c] rounded px-2 py-1 text-[11px]"
                >
                  <option value={0}>Terres neutres</option>
                  {studio.states.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              )}

              {brush.mode === 'culture' && (
                <select
                  value={brush.cultureId}
                  onChange={e => onChangeBrush({ ...brush, cultureId: Number(e.target.value) })}
                  className="w-full bg-white/85 border border-[#cbb68c] rounded px-2 py-1 text-[11px]"
                >
                  {studio.cultures.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}

              {brush.mode === 'religion' && (
                <select
                  value={brush.religionId}
                  onChange={e => onChangeBrush({ ...brush, religionId: Number(e.target.value) })}
                  className="w-full bg-white/85 border border-[#cbb68c] rounded px-2 py-1 text-[11px]"
                >
                  {studio.religions.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              )}

              {brush.mode === 'marker' && (
                <select
                  value={brush.markerIcon}
                  onChange={e =>
                    onChangeBrush({ ...brush, markerIcon: e.target.value as AzgaarMarkerIcon })
                  }
                  className="w-full bg-white/85 border border-[#cbb68c] rounded px-2 py-1 text-[11px]"
                >
                  <option value="donjon">Donjon</option>
                  <option value="ruine">Ruine</option>
                  <option value="danger">Danger</option>
                  <option value="port">Port</option>
                  <option value="camp">Camp</option>
                  <option value="quete">Quête</option>
                  <option value="note">Note</option>
                </select>
              )}
            </div>

            <div className="border-t border-[#d6c39c] pt-2 space-y-2">
              <div className="flex gap-1 overflow-x-auto pb-0.5">
                {(
                  [
                    ['bourgs', 'Bourgs'],
                    ['etats', 'États'],
                    ['cultures', 'Cultures'],
                    ['religions', 'Cultes'],
                    ['marqueurs', 'Repères'],
                  ] as const
                ).map(([tId, lbl]) => (
                  <button
                    key={tId}
                    onClick={() => setTableTab(tId)}
                    className={`px-2 py-0.5 rounded text-[10px] font-medium cursor-pointer shrink-0 ${
                      tableTab === tId
                        ? 'dnd-wood-bar'
                        : 'bg-[#efe5cb] border border-[#cbb68c] text-[#5c4730]'
                    }`}
                  >
                    {lbl}
                  </button>
                ))}
              </div>

              <div className="max-h-52 overflow-y-auto space-y-1 pr-1">
                {tableTab === 'bourgs' &&
                  studio.burgs.map(b => (
                    <button
                      key={b.id}
                      onClick={() => {
                        onSelectBurg(b);
                        onCenterOn(b.x, b.y);
                      }}
                      className="w-full text-left flex items-center gap-2 px-2 py-1 rounded bg-[#f4ebd4]/80 hover:bg-[#e9dbb9] border border-[#d6c39c] cursor-pointer"
                    >
                      <CoatOfArmsSvg coa={b.coa} size={18} />
                      <span className="font-medium truncate flex-1">{b.name}</span>
                      {b.port && <span className="text-[9px] text-sky-800">Port</span>}
                      <span className="font-mono text-[10px] tabular-nums text-[#6d5536]">
                        {b.population.toLocaleString('fr-FR')}
                      </span>
                    </button>
                  ))}

                {tableTab === 'etats' &&
                  studio.states.map(st => (
                    <div
                      key={st.id}
                      className="p-2 rounded bg-[#f4ebd4]/80 border border-[#d6c39c] space-y-1.5"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-sm shrink-0 border border-black/30"
                          style={{ backgroundColor: st.color }}
                        />
                        <input
                          type="text"
                          value={st.name}
                          onChange={e => {
                            const nextStates = studio.states.map(x =>
                              x.id === st.id ? { ...x, name: e.target.value } : x
                            );
                            onUpdateStudio({ ...studio, states: nextStates }, true);
                          }}
                          className="flex-1 bg-white/80 border border-[#cbb68c] rounded px-1.5 py-0.5 text-[11px] font-semibold"
                        />
                      </div>
                      <div className="text-[10px] text-[#6d5536]">{st.government}</div>
                      <div className="flex flex-wrap gap-1">
                        {studio.states
                          .filter(o => o.id !== st.id)
                          .map(other => {
                            const status = st.diplomacy[other.id] || 'Paix';
                            return (
                              <button
                                key={other.id}
                                onClick={() => cycleDiplomacy(st.id, other.id)}
                                className="px-1.5 py-0.5 rounded border border-[#cbb68c] bg-white/70 hover:bg-[#ead9b3] text-[9px] cursor-pointer"
                                title="Cliquer pour changer"
                              >
                                {other.name.split(' ').slice(-1)[0]} : <strong>{status}</strong>
                              </button>
                            );
                          })}
                      </div>
                    </div>
                  ))}

                {tableTab === 'cultures' &&
                  studio.cultures.map(c => (
                    <div
                      key={c.id}
                      className="flex items-center gap-2 px-2 py-1 rounded bg-[#f4ebd4]/80 border border-[#d6c39c]"
                    >
                      <span
                        className="w-3 h-3 rounded-sm shrink-0 border border-black/30"
                        style={{ backgroundColor: c.color }}
                      />
                      <input
                        type="text"
                        value={c.name}
                        onChange={e => {
                          const next = studio.cultures.map(x =>
                            x.id === c.id ? { ...x, name: e.target.value } : x
                          );
                          onUpdateStudio({ ...studio, cultures: next }, true);
                        }}
                        className="flex-1 bg-white/80 border border-[#cbb68c] rounded px-1.5 py-0.5 text-[11px]"
                      />
                      <span className="text-[10px] text-[#6d5536]">{c.type}</span>
                    </div>
                  ))}

                {tableTab === 'religions' &&
                  studio.religions.map(r => (
                    <div
                      key={r.id}
                      className="flex items-center gap-2 px-2 py-1 rounded bg-[#f4ebd4]/80 border border-[#d6c39c]"
                    >
                      <span
                        className="w-3 h-3 rounded-sm shrink-0 border border-black/30"
                        style={{ backgroundColor: r.color }}
                      />
                      <input
                        type="text"
                        value={r.name}
                        onChange={e => {
                          const next = studio.religions.map(x =>
                            x.id === r.id ? { ...x, name: e.target.value } : x
                          );
                          onUpdateStudio({ ...studio, religions: next }, true);
                        }}
                        className="flex-1 bg-white/80 border border-[#cbb68c] rounded px-1.5 py-0.5 text-[11px]"
                      />
                      <span className="text-[10px] text-[#6d5536] truncate max-w-[70px]">{r.deity}</span>
                    </div>
                  ))}

                {tableTab === 'marqueurs' &&
                  studio.markers.map(m => (
                    <button
                      key={m.id}
                      onClick={() => {
                        onSelectMarker(m);
                        onCenterOn(m.x, m.y);
                      }}
                      className="w-full text-left flex items-center justify-between gap-2 px-2 py-1 rounded bg-[#f4ebd4]/80 hover:bg-[#e9dbb9] border border-[#d6c39c] cursor-pointer"
                    >
                      <span className="truncate font-medium">{m.title}</span>
                      <span className="text-[9px] font-mono text-[#6d5536] uppercase">{m.author}</span>
                    </button>
                  ))}
              </div>
            </div>

            <div className="border-t border-[#d6c39c] pt-2 grid grid-cols-3 gap-1">
              <input
                ref={fileInputRef}
                type="file"
                accept=".map,.json,.txt"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => {
                    if (typeof reader.result === 'string') {
                      onImportRaw(reader.result);
                    }
                  };
                  reader.readAsText(file);
                  e.target.value = '';
                }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-2 py-1 rounded border border-[#cbb68c] bg-[#f4ebd4] hover:bg-[#e8d9b4] text-[10px] flex items-center justify-center gap-1 cursor-pointer"
              >
                <Upload className="w-3 h-3" />
                Importer
              </button>
              <button
                onClick={onExportJson}
                className="px-2 py-1 rounded border border-[#cbb68c] bg-[#f4ebd4] hover:bg-[#e8d9b4] text-[10px] flex items-center justify-center gap-1 cursor-pointer"
              >
                <Download className="w-3 h-3" />
                JSON
              </button>
              <button
                onClick={onExportSvg}
                className="px-2 py-1 rounded border border-[#cbb68c] bg-[#f4ebd4] hover:bg-[#e8d9b4] text-[10px] flex items-center justify-center gap-1 cursor-pointer"
              >
                <Download className="w-3 h-3" />
                SVG
              </button>
            </div>
          </>
        )}

        {activeMenu === 'options' && (
          <div className="space-y-2.5">
            <label className="block space-y-0.5">
              <span className="text-[10px] text-[#6e5637] font-semibold">Nom du monde</span>
              <input
                type="text"
                value={optName}
                onChange={e => setOptName(e.target.value)}
                className="w-full bg-white/85 border border-[#cbb68c] rounded px-2 py-1 text-xs"
              />
            </label>

            <div className="grid grid-cols-[1fr_auto] gap-1.5 items-end">
              <label className="space-y-0.5">
                <span className="text-[10px] text-[#6e5637] font-semibold">Graine</span>
                <input
                  type="number"
                  value={optSeed}
                  onChange={e => setOptSeed(Math.max(1, Number(e.target.value) || 1))}
                  className="w-full bg-white/85 border border-[#cbb68c] rounded px-2 py-1 text-xs font-mono tabular-nums"
                />
              </label>
              <button
                onClick={() => setOptSeed(Math.floor(Math.random() * 900000) + 10000)}
                className="px-2.5 py-1.5 rounded border border-[#cbb68c] bg-[#f4ebd4] hover:bg-[#e8d9b4] cursor-pointer"
                title="Graine aléatoire"
              >
                <Dices className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-0.5">
                <span className="text-[10px] text-[#6e5637] font-semibold">Relief</span>
                <select
                  value={optTemplate}
                  onChange={e => setOptTemplate(e.target.value as AzgaarTemplateId)}
                  className="w-full bg-white/85 border border-[#cbb68c] rounded px-1.5 py-1 text-[11px]"
                >
                  {AZGAAR_TEMPLATES.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-0.5">
                <span className="text-[10px] text-[#6e5637] font-semibold">Cellules</span>
                <select
                  value={optCells}
                  onChange={e => setOptCells(Number(e.target.value) as 800 | 1500 | 2400)}
                  className="w-full bg-white/85 border border-[#cbb68c] rounded px-1.5 py-1 text-[11px] font-mono"
                >
                  <option value={800}>800</option>
                  <option value={1500}>1500</option>
                  <option value={2400}>2400</option>
                </select>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-0.5">
                <span className="text-[10px] text-[#6e5637] font-semibold">Climat</span>
                <select
                  value={optClimate}
                  onChange={e => setOptClimate(e.target.value as AzgaarClimateBias)}
                  className="w-full bg-white/85 border border-[#cbb68c] rounded px-1.5 py-1 text-[11px]"
                >
                  <option value="tempere">Tempéré</option>
                  <option value="boreal">Boréal</option>
                  <option value="aride">Aride</option>
                </select>
              </label>

              <label className="space-y-0.5">
                <span className="text-[10px] text-[#6e5637] font-semibold">Vent (°)</span>
                <input
                  type="number"
                  min={-180}
                  max={180}
                  value={optWind}
                  onChange={e => setOptWind(Number(e.target.value) || 0)}
                  className="w-full bg-white/85 border border-[#cbb68c] rounded px-2 py-1 text-[11px] font-mono tabular-nums"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-0.5">
                <span className="text-[10px] text-[#6e5637]">États ({optStates})</span>
                <input
                  type="range"
                  min={2}
                  max={7}
                  value={optStates}
                  onChange={e => setOptStates(Number(e.target.value))}
                  className="w-full accent-[#7a521c]"
                />
              </label>
              <label className="space-y-0.5">
                <span className="text-[10px] text-[#6e5637]">Bourgs ({optBurgs})</span>
                <input
                  type="range"
                  min={8}
                  max={34}
                  value={optBurgs}
                  onChange={e => setOptBurgs(Number(e.target.value))}
                  className="w-full accent-[#7a521c]"
                />
              </label>
              <label className="space-y-0.5">
                <span className="text-[10px] text-[#6e5637]">Cultures ({optCultures})</span>
                <input
                  type="range"
                  min={2}
                  max={6}
                  value={optCultures}
                  onChange={e => setOptCultures(Number(e.target.value))}
                  className="w-full accent-[#7a521c]"
                />
              </label>
              <label className="space-y-0.5">
                <span className="text-[10px] text-[#6e5637]">Religions ({optReligions})</span>
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={optReligions}
                  onChange={e => setOptReligions(Number(e.target.value))}
                  className="w-full accent-[#7a521c]"
                />
              </label>
            </div>

            <button
              disabled={chargement}
              onClick={() =>
                onRegenerate({
                  seed: optSeed,
                  template: optTemplate,
                  climateBias: optClimate,
                  cellsDesired: optCells,
                  windAngle: optWind,
                  worldName: optName,
                  stylePreset: studio.stylePreset,
                  statesCount: optStates,
                  culturesCount: optCultures,
                  religionsCount: optReligions,
                  burgsCount: optBurgs,
                })
              }
              className="w-full py-1.5 rounded dnd-wood-bar border font-medium flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${chargement ? 'animate-spin' : ''}`} />
              Régénérer le monde
            </button>
          </div>
        )}

        {activeMenu === 'style' && (
          <div className="space-y-2">
            {(Object.keys(AZGAAR_STYLE_PRESETS) as AzgaarStylePreset[]).map(presetKey => {
              const st = AZGAAR_STYLE_PRESETS[presetKey];
              const actif = studio.stylePreset === presetKey;
              return (
                <button
                  key={presetKey}
                  onClick={() => onUpdateStudio({ ...studio, stylePreset: presetKey }, true)}
                  className={`w-full text-left p-2 rounded border flex items-center justify-between cursor-pointer transition-colors ${
                    actif
                      ? 'dnd-wood-bar border-[#7e5b27]'
                      : 'bg-[#f4ebd4] border-[#cbb68c] hover:bg-[#e8d9b4]'
                  }`}
                >
                  <span className="font-medium">{st.label}</span>
                  <div className="flex items-center gap-1">
                    <span
                      className="w-4 h-4 rounded-xs border border-black/20"
                      style={{ backgroundColor: st.oceanDeep }}
                    />
                    <span
                      className="w-4 h-4 rounded-xs border border-black/20"
                      style={{ backgroundColor: st.landTint }}
                    />
                    <span
                      className="w-4 h-4 rounded-xs border border-black/20"
                      style={{ backgroundColor: st.riverColor }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
};
