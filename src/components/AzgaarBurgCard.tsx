import React, { useState } from 'react';
import {
  AzgaarBurgDef,
  AzgaarMarkerDef,
  AzgaarMarkerIcon,
  AzgaarWorldState,
} from '../types/azgaar';
import type { WorldNpcRecord, WorldRegionLore } from '../types/lore';
import { CoatOfArmsSvg } from './CoatOfArmsSvg';
import { RESSOURCES_CATALOGUE } from '../engine/worldEconomy';
import { X, Crosshair, Trash2, Anchor, Shield, Crown, Church, Store, Castle, Users, Sparkles } from 'lucide-react';

interface AzgaarBurgCardProps {
  studio: AzgaarWorldState;
  burg?: AzgaarBurgDef | null;
  marker?: AzgaarMarkerDef | null;
  loreRegion?: WorldRegionLore | null;
  pnjs?: WorldNpcRecord[];
  showSecrets?: boolean;
  onPromoteNpc?: (npcId: string) => void;
  onUpdateBurg: (updated: AzgaarBurgDef) => void;
  onDeleteBurg: (burgId: number) => void;
  onUpdateMarker: (updated: AzgaarMarkerDef) => void;
  onDeleteMarker: (markerId: string) => void;
  onCenterOn: (x: number, y: number) => void;
  onClose: () => void;
}

const MARKER_ICONS: Array<{ id: AzgaarMarkerIcon; label: string }> = [
  { id: 'donjon', label: 'Donjon' },
  { id: 'ruine', label: 'Ruine' },
  { id: 'danger', label: 'Danger' },
  { id: 'port', label: 'Port' },
  { id: 'camp', label: 'Camp' },
  { id: 'quete', label: 'Quête' },
  { id: 'note', label: 'Note' },
];

export const AzgaarBurgCard: React.FC<AzgaarBurgCardProps> = ({
  studio,
  burg,
  marker,
  loreRegion,
  pnjs = [],
  showSecrets = false,
  onPromoteNpc,
  onUpdateBurg,
  onDeleteBurg,
  onUpdateMarker,
  onDeleteMarker,
  onCenterOn,
  onClose,
}) => {
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!burg && !marker) return null;

  if (marker) {
    return (
      <div className="dnd-panel border border-[#b69c6d] rounded-lg p-3 shadow-lg w-[300px] text-xs space-y-2.5 bg-[#f4ebd4]">
        <div className="flex items-start justify-between gap-2 border-b border-[#d5c199] pb-1.5">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#7c5c2e] font-semibold">
              Marqueur · {marker.author}
            </div>
            <input
              type="text"
              value={marker.title}
              onChange={e => onUpdateMarker({ ...marker, title: e.target.value })}
              className="mt-0.5 w-full bg-white/80 border border-[#cbb68c] rounded px-1.5 py-0.5 text-xs font-semibold text-[#231a14]"
            />
          </div>
          <button
            onClick={onClose}
            className="text-[#6d5536] hover:text-[#231a14] p-0.5 cursor-pointer"
            title="Fermer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-0.5">
            <span className="text-[10px] text-[#6d5536]">Type</span>
            <select
              value={marker.icon}
              onChange={e => onUpdateMarker({ ...marker, icon: e.target.value as AzgaarMarkerIcon })}
              className="w-full bg-white/80 border border-[#cbb68c] rounded px-1.5 py-1 text-[11px]"
            >
              {MARKER_ICONS.map(ic => (
                <option key={ic.id} value={ic.id}>
                  {ic.label}
                </option>
              ))}
            </select>
          </label>
          <div className="space-y-0.5">
            <span className="text-[10px] text-[#6d5536]">Position</span>
            <div className="px-1.5 py-1 bg-[#eadec1] rounded font-mono text-[11px] tabular-nums">
              {Math.round(marker.x)}, {Math.round(marker.y)}
            </div>
          </div>
        </div>

        <label className="block space-y-0.5">
          <span className="text-[10px] text-[#6d5536]">Note</span>
          <textarea
            rows={2}
            value={marker.note}
            onChange={e => onUpdateMarker({ ...marker, note: e.target.value })}
            className="w-full bg-white/80 border border-[#cbb68c] rounded px-1.5 py-1 text-[11px] resize-none"
          />
        </label>

        <div className="flex items-center justify-between pt-1 border-t border-[#d5c199]">
          <button
            onClick={() => onCenterOn(marker.x, marker.y)}
            className="px-2 py-1 rounded border border-[#b89f72] bg-[#efe5cb] hover:bg-[#e5d6b0] text-[11px] flex items-center gap-1 cursor-pointer"
          >
            <Crosshair className="w-3 h-3" />
            Centrer
          </button>

          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="px-2 py-1 rounded border border-rose-300 text-rose-800 hover:bg-rose-50 text-[11px] flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
              Supprimer
            </button>
          ) : (
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  setConfirmDelete(false);
                  onDeleteMarker(marker.id);
                }}
                className="px-2 py-1 rounded bg-rose-700 text-white text-[11px] cursor-pointer"
              >
                Confirmer
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-2 py-1 rounded border border-[#b89f72] text-[11px] cursor-pointer"
              >
                Non
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!burg) return null;

  const stateObj = studio.states.find(s => s.id === burg.stateId);
  const provObj = studio.provinces.find(p => p.id === burg.provinceId);
  const culObj = studio.cultures.find(c => c.id === burg.cultureId);
  const relObj = studio.religions.find(r => r.id === burg.religionId);
  const connectedRoutes = studio.routes.filter(
    r => r.fromBurgId === burg.id || r.toBurgId === burg.id
  );

  const toggleFlag = (key: 'capital' | 'port' | 'citadel' | 'walls' | 'plaza' | 'temple') => {
    onUpdateBurg({ ...burg, [key]: !burg[key] });
  };

  return (
    <div className="dnd-panel border border-[#b69c6d] rounded-lg p-3 shadow-lg w-[330px] text-xs space-y-2.5 bg-[#f4ebd4]">
      <div className="flex items-start gap-2.5 border-b border-[#d5c199] pb-2">
        <CoatOfArmsSvg coa={burg.coa} size={42} />
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] uppercase tracking-wider text-[#7c5c2e] font-semibold truncate">
              {burg.capital ? 'Capitale' : 'Bourg'} · {stateObj?.name || 'Libre'}
            </span>
            <button
              onClick={onClose}
              className="text-[#6d5536] hover:text-[#231a14] p-0.5 cursor-pointer"
              title="Fermer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <input
            type="text"
            value={burg.name}
            onChange={e => onUpdateBurg({ ...burg, name: e.target.value })}
            className="w-full bg-white/85 border border-[#cbb68c] rounded px-1.5 py-0.5 text-xs font-display font-bold text-[#231a14]"
          />
          <div className="flex items-center gap-2 text-[10px] text-[#5e4931]">
            <span className="truncate">{provObj?.name || 'Hors province'}</span>
            <span>·</span>
            <span className="truncate">{culObj?.name || 'Culture'}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-0.5">
          <span className="text-[10px] text-[#6d5536]">Population</span>
          <input
            type="number"
            min={50}
            step={100}
            value={burg.population}
            onChange={e =>
              onUpdateBurg({ ...burg, population: Math.max(50, Number(e.target.value) || 0) })
            }
            className="w-full bg-white/80 border border-[#cbb68c] rounded px-1.5 py-0.5 text-[11px] font-mono tabular-nums"
          />
        </label>
        <label className="space-y-0.5">
          <span className="text-[10px] text-[#6d5536]">Garnison</span>
          <input
            type="number"
            min={0}
            step={10}
            value={burg.garrison}
            onChange={e =>
              onUpdateBurg({ ...burg, garrison: Math.max(0, Number(e.target.value) || 0) })
            }
            className="w-full bg-white/80 border border-[#cbb68c] rounded px-1.5 py-0.5 text-[11px] font-mono tabular-nums"
          />
        </label>
      </div>

      <div className="text-[10px] text-[#5b4735] flex items-center justify-between bg-[#eadec1]/70 px-2 py-1 rounded">
        <span>Culte : {relObj?.name || 'Aucun'}</span>
        <span className="font-mono tabular-nums">
          [{Math.round(burg.x)}, {Math.round(burg.y)}]
        </span>
      </div>

      {(burg.specialisation || (burg.exportations && burg.exportations.length > 0)) && (
        <div className="bg-[#efe5cb]/75 border border-[#d5c199] px-2 py-1.5 rounded text-[10px] space-y-0.5 text-[#463626]">
          {burg.specialisation && (
            <div className="font-semibold text-[#231a14] flex justify-between gap-2">
              <span>{burg.specialisation}</span>
              {typeof burg.tresorerie === 'number' && (
                <span className="font-mono tabular-nums text-[#7c5c2e]">{burg.tresorerie} po</span>
              )}
            </div>
          )}
          {burg.exportations && burg.exportations.length > 0 && (
            <div className="text-[#4a6337] truncate">
              Exporte : {burg.exportations.map(e => RESSOURCES_CATALOGUE[e]?.label || e).join(' · ')}
            </div>
          )}
          {burg.importations && burg.importations.length > 0 && (
            <div className="text-[#7c4d2b] truncate">
              Importe : {burg.importations.map(i => RESSOURCES_CATALOGUE[i]?.label || i).join(' · ')}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-3 gap-1">
        {(
          [
            { key: 'capital', label: 'Capitale', icon: Crown },
            { key: 'port', label: 'Port', icon: Anchor },
            { key: 'citadel', label: 'Citadelle', icon: Castle },
            { key: 'walls', label: 'Muraille', icon: Shield },
            { key: 'plaza', label: 'Marché', icon: Store },
            { key: 'temple', label: 'Temple', icon: Church },
          ] as const
        ).map(item => {
          const Icon = item.icon;
          const active = burg[item.key];
          return (
            <button
              key={item.key}
              onClick={() => toggleFlag(item.key)}
              className={`px-1.5 py-1 rounded border text-[10px] flex items-center gap-1 cursor-pointer transition-colors ${
                active
                  ? 'dnd-wood-bar border-[#7e5b27]'
                  : 'bg-[#efe5cb] border-[#cbb68c] text-[#5e4931] hover:bg-[#e7d8b5]'
              }`}
            >
              <Icon className="w-3 h-3 shrink-0" />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </div>

      <div className="space-y-1">
        <div className="text-[10px] text-[#6d5536] font-semibold">
          Liaisons ({connectedRoutes.length})
        </div>
        {connectedRoutes.length === 0 ? (
          <div className="text-[10px] text-[#7a6448]">Aucune voie enregistrée.</div>
        ) : (
          <div className="max-h-20 overflow-y-auto space-y-0.5 pr-1">
            {connectedRoutes.map(rt => {
              const otherId = rt.fromBurgId === burg.id ? rt.toBurgId : rt.fromBurgId;
              const other = studio.burgs.find(b => b.id === otherId);
              return (
                <div
                  key={rt.id}
                  className="flex items-center justify-between text-[10px] bg-[#efe5cb]/75 px-1.5 py-0.5 rounded"
                >
                  <span className="truncate">{other?.name || 'Destination'}</span>
                  <span className="font-mono text-[9px] uppercase text-[#5c4730]">
                    {rt.kind === 'sea' ? 'Mer' : rt.kind === 'road' ? 'Route' : 'Piste'}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {loreRegion && (
        <div className="bg-[#efe5cb]/70 border border-[#d5c199] px-2 py-1.5 rounded text-[10px] space-y-1 text-[#463626]">
          <div className="font-semibold text-[#2a1d13]">Chronique locale</div>
          <div className="leading-snug">{loreRegion.histoireLocale}</div>
          <div className="italic text-[#5c4734]">« {loreRegion.legendePopulaire} »</div>
          {showSecrets && loreRegion.secretLocal && (
            <div className="text-amber-950 bg-amber-100/70 border border-amber-300 rounded px-1.5 py-0.5">
              Secret MJ : {loreRegion.secretLocal}
            </div>
          )}
        </div>
      )}

      {pnjs.length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] text-[#6d5536] font-semibold flex items-center gap-1">
            <Users className="w-3 h-3" />
            <span>Habitants &amp; figures ({pnjs.length})</span>
          </div>
          <div className="max-h-28 overflow-y-auto space-y-1 pr-1">
            {pnjs.map(p => (
              <div
                key={p.id}
                className="bg-[#efe5cb]/75 border border-[#d5c199] rounded px-2 py-1 text-[10px] space-y-0.5"
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="font-semibold text-[#231a14] truncate">{p.nom}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="font-mono text-[9px] text-[#6d5536]">{p.detailLevel}</span>
                    {p.detailLevel === 'LEGER' && onPromoteNpc && (
                      <button
                        type="button"
                        onClick={() => onPromoteNpc(p.id)}
                        className="px-1.5 py-0.5 rounded border border-[#b48a3e] bg-[#fffdf7] hover:bg-[#e7d8b5] text-[9px] font-medium flex items-center gap-0.5 cursor-pointer"
                        title="Promouvoir et détailler ce PNJ"
                      >
                        <Sparkles className="w-2.5 h-2.5 text-[#8c6422]" />
                        <span>Détailler</span>
                      </button>
                    )}
                  </div>
                </div>
                <div className="text-[#5e4931] truncate">
                  {p.profession}
                  {p.lienHerosNature ? ` · Lien héros` : ''}
                </div>
                {showSecrets && p.secret && (
                  <div className="text-[9px] text-amber-950 truncate">MJ : {p.secret}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-1 border-t border-[#d5c199]">
        <button
          onClick={() => onCenterOn(burg.x, burg.y)}
          className="px-2 py-1 rounded border border-[#b89f72] bg-[#efe5cb] hover:bg-[#e5d6b0] text-[11px] flex items-center gap-1 cursor-pointer"
        >
          <Crosshair className="w-3 h-3" />
          Centrer
        </button>

        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="px-2 py-1 rounded border border-rose-300 text-rose-800 hover:bg-rose-50 text-[11px] flex items-center gap-1 cursor-pointer"
          >
            <Trash2 className="w-3 h-3" />
            Supprimer
          </button>
        ) : (
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                setConfirmDelete(false);
                onDeleteBurg(burg.id);
              }}
              className="px-2 py-1 rounded bg-rose-700 text-white text-[11px] cursor-pointer"
            >
              Confirmer
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="px-2 py-1 rounded border border-[#b89f72] text-[11px] cursor-pointer"
            >
              Non
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
