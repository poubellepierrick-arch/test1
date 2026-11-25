import React, { useState } from 'react';
import {
  Faction,
  WorldMarket,
  GraphNode,
  HexNode,
  WorldEntity,
  WorldChronicleEntry,
} from '../types';
import { Globe } from 'lucide-react';

interface FactionStatusProps {
  factions: Faction[];
  marche: WorldMarket;
  grapheNoeuds: GraphNode[];
  hexagones?: HexNode[];
  entitesMonde?: WorldEntity[];
  chroniqueMonde?: WorldChronicleEntry[];
  chargement?: boolean;
}

const POSTURE_LABEL: Record<string, string> = {
  EXPANSION: 'Expansion',
  DEFENSE: 'Défense',
  COMMERCE: 'Commerce',
  RAID: 'Raid',
  TREVE: 'Trêve',
};

const TYPE_ENTITE_LABEL: Record<string, string> = {
  CARAVANE: 'Convoi',
  PATROUILLE: 'Patrouille',
  RAIDER: 'Raiders',
  MESSAGER: 'Messager',
  REFUGIES: 'Réfugiés',
};

export const FactionStatus: React.FC<FactionStatusProps> = ({
  factions,
  marche,
  hexagones = [],
  entitesMonde = [],
  chroniqueMonde = [],
}) => {
  const [ouvert, setOuvert] = useState(false);

  const hexNomParId = (id: string) => hexagones.find(h => h.id === id)?.nom || id;
  const multVivres = marche.multiplicateurVivres ?? 1.0;
  const tendanceFleche =
    marche.tendanceFer === 'HAUSSE' ? ' ↑' : marche.tendanceFer === 'BAISSE' ? ' ↓' : '';
  const entitesActives = entitesMonde.filter(e => e.statut === 'EN_ROUTE');

  return (
    <div className="dnd-panel rounded-lg p-3.5 text-xs space-y-2.5 text-[#3b2c1e]">
      <div className="flex justify-between items-center cursor-pointer select-none" onClick={() => setOuvert(!ouvert)}>
        <div className="flex items-center gap-1.5 font-display text-[#2a1d13] font-semibold">
          <Globe className="w-4 h-4 text-[#9c6f21]" />
          <span>Factions & Marché</span>
        </div>
        <button type="button" className="text-[11px] text-[#78624a] hover:text-[#231a14] font-medium cursor-pointer">
          {ouvert ? 'Replier ▲' : 'Déplier ▼'}
        </button>
      </div>

      {/* Résumé permanent */}
      <div className="grid grid-cols-2 gap-2 text-xs pt-1.5 border-t border-[#d6c298]">
        <div className="bg-[#f5edd8]/80 p-2 rounded-md border border-[#cfb88c]">
          <div className="text-[#6d5742] text-[10px]">Fer{tendanceFleche}</div>
          <div className={marche.penurieArmurerie ? 'font-bold text-rose-800 font-mono tabular-nums' : 'font-bold text-[#231a14] font-mono tabular-nums'}>
            x{marche.multiplicateurFer} · {marche.penurieArmurerie ? 'Pénurie' : 'Stable'}
          </div>
        </div>
        <div className="bg-[#f5edd8]/80 p-2 rounded-md border border-[#cfb88c]">
          <div className="text-[#6d5742] text-[10px]">Vivres</div>
          <div className={marche.penurieVivres ? 'font-bold text-amber-800 font-mono tabular-nums' : 'text-[#2a1f16] font-medium font-mono tabular-nums'}>
            x{multVivres} · {marche.penurieVivres ? 'Tendus' : 'Normal'}
          </div>
        </div>
        <div className="bg-[#f5edd8]/80 p-2 rounded-md border border-[#cfb88c]">
          <div className="text-[#6d5742] text-[10px]">Routes</div>
          <div className="text-[#8c5a18] font-bold">{marche.securiteRoutes}</div>
        </div>
        <div className="bg-[#f5edd8]/80 p-2 rounded-md border border-[#cfb88c] flex flex-col justify-center">
          <div className="text-[#6d5742] text-[10px]">Circulation</div>
          <div className="text-[#231a14] font-semibold font-mono tabular-nums truncate">
            {entitesActives.length} unité(s) · Tension {marche.indiceTensionCommerciale ?? 20}%
          </div>
        </div>
      </div>

      {/* Détails complets si déplié */}
      {ouvert && (
        <div className="space-y-2.5 pt-2 border-t border-[#d6c298]">
          <div className="font-display text-[#6d5332] font-semibold text-[11px] tracking-wide uppercase">
            Factions
          </div>
          <div className="space-y-2">
            {factions.map(faction => (
              <div key={faction.id} className="bg-[#f5edd8]/75 border border-[#cfb88c] p-2.5 rounded-md space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-[#231a14]">{faction.nom}</span>
                  {faction.posture && (
                    <span className="text-[10px] font-mono text-[#6d5332]">
                      {POSTURE_LABEL[faction.posture] || faction.posture}
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-[#5c4734] flex justify-between font-mono tabular-nums">
                  <span>Force : {faction.forceMilitaire}</span>
                  <span>Moral : {faction.moral ?? 65}</span>
                  <span>Or : {faction.richesse}</span>
                </div>
                <div className="text-[11px] text-[#6d5742]">
                  Contrôle :{' '}
                  {faction.noeudsControles.length > 0
                    ? faction.noeudsControles.map(hexNomParId).join(', ')
                    : 'Aucun'}
                </div>
                <div className="text-[11px] text-[#463626] border-t border-[#decba3] pt-1">
                  {faction.effectifActif || faction.objectifs[0]}
                </div>
              </div>
            ))}
          </div>

          {entitesActives.length > 0 && (
            <div className="space-y-1.5 pt-1 border-t border-[#d6c298]">
              <div className="font-display text-[#6d5332] font-semibold text-[11px] tracking-wide uppercase">
                Mouvements
              </div>
              <div className="space-y-1">
                {entitesActives.map(ent => (
                  <div
                    key={ent.id}
                    className="bg-[#f5edd8]/75 border border-[#cfb88c] px-2.5 py-1.5 rounded text-[11px] space-y-0.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-[#231a14]">{ent.nom}</span>
                      <span className="text-[10px] font-mono text-[#6d5332] shrink-0">
                        {TYPE_ENTITE_LABEL[ent.type] || ent.type}
                      </span>
                    </div>
                    <div className="text-[#6d5742] font-mono text-[10px]">
                      {hexNomParId(ent.hexId)} → {hexNomParId(ent.destinationHexId)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {chroniqueMonde.length > 0 && (
            <div className="space-y-1.5 pt-1 border-t border-[#d6c298]">
              <div className="font-display text-[#6d5332] font-semibold text-[11px] tracking-wide uppercase">
                Chronique
              </div>
              <div className="space-y-1 max-h-32 overflow-y-auto pr-0.5">
                {chroniqueMonde.slice(0, 4).map(evt => (
                  <div
                    key={evt.id}
                    className="bg-[#f5edd8]/75 border border-[#cfb88c] px-2.5 py-1.5 rounded text-[11px]"
                  >
                    <div className="flex justify-between text-[#231a14] font-medium">
                      <span className="truncate">{evt.titre}</span>
                      <span className="text-[10px] font-mono text-[#78624a] shrink-0">J{evt.jour}</span>
                    </div>
                    <div className="text-[10px] text-[#5c4734]">{evt.impact}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
