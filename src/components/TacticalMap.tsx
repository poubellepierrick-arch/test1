import React, { useState } from 'react';
import { HexNode, CombatState } from '../types';
import { Swords, Compass, Crosshair, PenTool } from 'lucide-react';

interface TacticalMapProps {
  hexActuel: HexNode;
  hexagones: HexNode[];
  combat: CombatState;
  hexSelectionne?: HexNode | null;
  onSelectHex: (hex: HexNode) => void;
  onSelectCibleCombat: (cibleId: string) => void;
  onAnnoterHex?: (hexId: string, note: string) => void;
}

export const TacticalMap: React.FC<TacticalMapProps> = ({
  hexActuel,
  hexagones,
  combat,
  hexSelectionne,
  onSelectHex,
  onSelectCibleCombat,
  onAnnoterHex,
}) => {
  const [noteTexte, setNoteTexte] = useState('');
  const hexActif = hexSelectionne || hexActuel;

  // Mode Combat Actif
  if (combat.actif) {
    return (
      <div className="bg-white border border-rose-200 shadow-xs rounded-lg p-3 text-xs space-y-3">
        <div className="flex justify-between items-center border-b border-rose-100 pb-2">
          <div className="flex items-center gap-1.5 text-rose-800 font-bold">
            <Swords className="w-4 h-4 text-rose-700" />
            <span>Combat tactique (Round {combat.round})</span>
          </div>
          <span className="text-stone-400 text-[11px] font-mono">Distance & Initiative</span>
        </div>

        {/* Liste des adversaires */}
        <div className="space-y-2">
          {combat.ennemis.map(ennemi => {
            const isAlive = ennemi.statut === 'ACTIF';
            const isFled = ennemi.statut === 'FUITE';
            return (
              <div
                key={ennemi.id}
                onClick={() => isAlive && onSelectCibleCombat(ennemi.id)}
                className={`p-2.5 rounded-lg border transition-colors cursor-pointer flex items-center justify-between ${
                  isAlive
                    ? 'bg-rose-50/40 border-rose-200 hover:border-rose-400'
                    : isFled
                    ? 'bg-stone-50 border-stone-200 text-stone-400 opacity-60'
                    : 'bg-stone-50 border-stone-200 text-stone-400 line-through opacity-50'
                }`}
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 font-bold text-stone-900">
                    <Crosshair className="w-3.5 h-3.5 text-rose-600" />
                    <span>{ennemi.nom}</span>
                    <span className="text-[10px] text-stone-500 font-normal">({ennemi.type})</span>
                  </div>
                  <div className="text-[11px] text-stone-600 font-mono">
                    Distance : {ennemi.distancePieds} ft · CA : {ennemi.ca} · {ennemi.comportement}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-rose-700 font-bold font-mono">
                    {ennemi.pv} / {ennemi.pvMax} PV
                  </div>
                  <div className="text-[10px] uppercase font-semibold text-stone-500">
                    {ennemi.statut}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Rapports de mêlée */}
        <div className="bg-stone-50 border border-stone-200 p-2.5 rounded-md max-h-24 overflow-y-auto space-y-1 text-[11px] text-stone-700 font-mono">
          <div className="text-stone-500 text-[10px] font-semibold uppercase">Rapports de combat</div>
          {combat.journalCombat.slice(-4).map((entry, idx) => (
            <div key={idx}>• {entry}</div>
          ))}
        </div>
      </div>
    );
  }

  // Calcul coordonnées axiales (q, r) en pixels
  const hexSize = 52;
  const originX = 170;
  const originY = 140;

  const hexPoints = (cx: number, cy: number, r: number) => {
    const points: string[] = [];
    for (let i = 0; i < 6; i++) {
      const angleDeg = 60 * i - 30;
      const angleRad = (Math.PI / 180) * angleDeg;
      points.push(`${cx + r * Math.cos(angleRad)},${cy + r * Math.sin(angleRad)}`);
    }
    return points.join(' ');
  };

  const getTerrainStyle = (terrain: string, brouillard?: string) => {
    if (brouillard === 'INCONNU') {
      return { fill: '#f5f5f4', stroke: '#d6d3d1', label: 'Brume' };
    }
    switch (terrain) {
      case 'Plaine / Route':
        return { fill: '#f0fdf4', stroke: '#86efac', label: 'Plaine' };
      case 'Forêt Dense':
        return { fill: '#dcfce7', stroke: '#4ade80', label: 'Forêt' };
      case 'Marais Fétide':
        return { fill: '#fef3c7', stroke: '#d97706', label: 'Marais' };
      case 'Montagne Escarpée':
        return { fill: '#e2e8f0', stroke: '#94a3b8', label: 'Montagne' };
      case 'Désert Aride':
        return { fill: '#fef3c7', stroke: '#f59e0b', label: 'Désert' };
      default:
        return { fill: '#fafaf9', stroke: '#e7e5e4', label: 'Inconnu' };
    }
  };

  const handleSoumettreNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onAnnoterHex || !noteTexte.trim()) return;
    onAnnoterHex(hexActif.id, noteTexte.trim());
    setNoteTexte('');
  };

  return (
    <div className="bg-white border border-stone-200 shadow-xs rounded-lg p-3.5 text-xs space-y-2.5">
      <div className="flex justify-between items-center border-b border-stone-100 pb-2">
        <div className="flex items-center gap-1.5 text-stone-900 font-bold">
          <Compass className="w-4 h-4 text-emerald-700" />
          <span>Carte de la région</span>
        </div>
        <span className="text-[11px] text-stone-400">Cliquez pour voyager / annoter</span>
      </div>

      <div className="relative flex justify-center bg-[#fdfcfa] border border-stone-200 rounded-lg py-2 overflow-hidden shadow-2xs">
        <svg width="340" height="280" className="select-none">
          {hexagones.map(hex => {
            const x = originX + hexSize * Math.sqrt(3) * (hex.q + hex.r / 2);
            const y = originY + hexSize * (3 / 2) * hex.r;
            const isCurrent = hex.id === hexActuel.id;
            const isSelected = hex.id === hexActif.id;
            const estInconnu = hex.brouillard === 'INCONNU';
            const estRepere = hex.brouillard === 'REPERE';
            const style = getTerrainStyle(hex.terrain, hex.brouillard);

            return (
              <g
                key={hex.id}
                onClick={() => onSelectHex(hex)}
                className="cursor-pointer transition-transform hover:opacity-90"
              >
                <polygon
                  points={hexPoints(x, y, hexSize - 3)}
                  fill={style.fill}
                  stroke={isCurrent ? '#059669' : isSelected ? '#0284c7' : style.stroke}
                  strokeWidth={isCurrent ? 2.5 : isSelected ? 2 : 1}
                  strokeDasharray={estInconnu ? '3,3' : 'none'}
                />

                {/* Point d'intérêt */}
                {!estInconnu && hex.pointInteret && (
                  <circle
                    cx={x}
                    cy={y - 12}
                    r={4}
                    fill={hex.pointInteret.statut === 'OCCUPIED' ? '#dc2626' : '#0284c7'}
                  />
                )}

                {/* Nom ou état */}
                <text
                  x={x}
                  y={y + 2}
                  textAnchor="middle"
                  fill={estInconnu ? '#a8a29e' : '#1c1917'}
                  fontSize={8}
                  fontWeight={isCurrent ? 'bold' : '500'}
                  fontFamily="system-ui, sans-serif"
                >
                  {estInconnu ? 'Inexploré' : hex.nom.length > 12 ? hex.nom.substring(0, 10) + '..' : hex.nom}
                </text>

                {/* Terrain */}
                <text
                  x={x}
                  y={y + 14}
                  textAnchor="middle"
                  fill={estInconnu ? '#d6d3d1' : '#57534e'}
                  fontSize={7}
                  fontFamily="system-ui, sans-serif"
                >
                  {estInconnu ? 'Brume' : estRepere ? `${hex.terrain.split(' ')[0]} (?)` : hex.terrain.split(' ')[0]}
                </text>

                {/* Marqueur joueur */}
                {isCurrent && (
                  <circle
                    cx={x}
                    cy={y + 24}
                    r={3.5}
                    fill="#059669"
                    stroke="#ffffff"
                    strokeWidth={1}
                  />
                )}

                {/* Témoin d'annotation */}
                {hex.annotationJoueur && (
                  <circle
                    cx={x + 18}
                    cy={y - 18}
                    r={2.5}
                    fill="#0284c7"
                  />
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Détails de l'hexagone sélectionné */}
      <div className="bg-stone-50 p-2.5 rounded-lg border border-stone-200 space-y-1.5 text-[11px]">
        <div className="flex items-center justify-between text-stone-700">
          <span>
            Hex sélectionné :{' '}
            <strong className="text-stone-900 font-semibold">
              {hexActif.brouillard === 'INCONNU' ? 'Territoire inexploré (brume)' : hexActif.nom}
            </strong>
          </span>
          <span className="text-[10px] uppercase px-1.5 py-0.2 rounded border border-stone-200 bg-white text-stone-600 font-mono">
            {hexActif.brouillard || 'EXPLORE'}
          </span>
        </div>

        {hexActif.brouillard !== 'INCONNU' && (
          <div className="text-stone-600 flex justify-between">
            <span>POI : {hexActif.pointInteret ? `${hexActif.pointInteret.nom} [${hexActif.pointInteret.statut}]` : 'Aucun'}</span>
            <span>Sécurité : {hexActif.securite}</span>
          </div>
        )}

        {/* Note personnelle */}
        {hexActif.annotationJoueur && (
          <div className="text-sky-900 bg-sky-50 border border-sky-200 p-2 rounded-md">
            Repère : "{hexActif.annotationJoueur}"
          </div>
        )}

        {/* Saisie d'annotation */}
        {onAnnoterHex && (
          <form onSubmit={handleSoumettreNote} className="flex gap-1.5 pt-1.5 border-t border-stone-200">
            <input
              type="text"
              value={noteTexte}
              onChange={e => setNoteTexte(e.target.value)}
              placeholder="Annoter cet hex (source d'eau, guet, danger)..."
              className="flex-1 bg-white border border-stone-300 rounded px-2.5 py-1 text-stone-800 placeholder-stone-400 focus:outline-none focus:border-stone-500 text-[11px]"
            />
            <button
              type="submit"
              disabled={!noteTexte.trim()}
              className="px-2.5 py-1 bg-stone-800 hover:bg-stone-700 disabled:opacity-40 text-white rounded text-[10px] font-medium flex items-center gap-1 shadow-2xs transition-colors"
            >
              <PenTool className="w-2.5 h-2.5" />
              <span>Noter</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
