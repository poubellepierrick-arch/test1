import React from 'react';
import { WorldClock, HexNode, CharacterStats } from '../types';
import { evaluerEncombrement } from '../engine/srd';
import { Clock, Compass, Droplets, Utensils, Coins, Package } from 'lucide-react';

interface WorldHeaderProps {
  horloge: WorldClock;
  hexActuel: HexNode;
  personnage: CharacterStats;
}

export const WorldHeader: React.FC<WorldHeaderProps> = ({ horloge, hexActuel, personnage }) => {
  const charge = evaluerEncombrement(personnage);

  const getSecuriteStyle = (sec: string) => {
    switch (sec) {
      case 'Sûr':
        return 'text-emerald-800 border-emerald-200 bg-emerald-50';
      case 'Patrouillé':
        return 'text-sky-800 border-sky-200 bg-sky-50';
      case 'Dangereux':
        return 'text-amber-800 border-amber-200 bg-amber-50';
      case 'Périlleux':
        return 'text-rose-800 border-rose-200 bg-rose-50';
      default:
        return 'text-stone-700 border-stone-200 bg-stone-100';
    }
  };

  return (
    <header className="w-full bg-white border-b border-stone-200 text-stone-700 px-4 py-2.5 text-xs shadow-xs">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Horloge & Météo */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-stone-900">
            <Clock className="w-3.5 h-3.5 text-amber-700" />
            <span className="font-semibold">Jour {horloge.jour}</span>
            <span className="text-stone-600 font-mono">{String(horloge.heure).padStart(2, '0')}:00</span>
            <span className="text-stone-400 font-mono text-[11px]">(Tick {horloge.tick})</span>
          </div>
          <span className="text-stone-300">·</span>
          <span className="text-stone-600 font-medium">
            {horloge.meteo} ({horloge.temperature})
          </span>
        </div>

        {/* Lieu actuel */}
        <div className="flex items-center gap-2">
          <Compass className="w-3.5 h-3.5 text-emerald-700" />
          <span className="text-stone-900 font-semibold">{hexActuel.nom}</span>
          <span className="text-stone-400 font-mono text-[11px]">[{hexActuel.q},{hexActuel.r}]</span>
          <span className={`px-2 py-0.5 rounded border text-[10px] font-medium ${getSecuriteStyle(hexActuel.securite)}`}>
            {hexActuel.securite}
          </span>
        </div>

        {/* Ressources & Charge */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-sky-700" title="Eau potable">
            <Droplets className="w-3.5 h-3.5" />
            <span className="font-mono tabular-nums font-medium">
              {personnage.eauLitres}L / {personnage.eauMaxLitres}L
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-emerald-700" title="Rations">
            <Utensils className="w-3.5 h-3.5" />
            <span className="font-mono tabular-nums font-medium">{personnage.rationsJours}j</span>
          </div>

          <div className="flex items-center gap-1.5 text-amber-800" title="Bourse">
            <Coins className="w-3.5 h-3.5 text-amber-600" />
            <span className="font-mono tabular-nums font-medium">{personnage.monnaies.po} PO</span>
            <span className="text-stone-400 font-mono tabular-nums">{personnage.monnaies.pa} PA</span>
          </div>

          <div className="flex items-center gap-1.5 text-stone-600" title={`Poids transporté: ${charge.statut}`}>
            <Package className="w-3.5 h-3.5 text-stone-500" />
            <span className={`font-mono tabular-nums ${charge.statut !== 'Normal' ? 'text-amber-800 font-bold' : ''}`}>
              {charge.poidsTotal} / {charge.capaciteMax} lbs
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
