import React from 'react';
import { WorldClock, HexNode, CharacterStats } from '../types';
import { evaluerEncombrement } from '../engine/srd';
import { Clock, Compass, Droplets, Utensils, Coins, Package, Shield } from 'lucide-react';

interface WorldHeaderProps {
  horloge: WorldClock;
  hexActuel: HexNode;
  personnage: CharacterStats;
}

export const WorldHeader: React.FC<WorldHeaderProps> = ({ horloge, hexActuel, personnage }) => {
  const charge = evaluerEncombrement(personnage);

  const getSecuriteColor = (sec: string) => {
    switch (sec) {
      case 'Sûr':
        return 'text-emerald-300';
      case 'Patrouillé':
        return 'text-sky-300';
      case 'Dangereux':
        return 'text-amber-300';
      case 'Périlleux':
        return 'text-rose-300';
      default:
        return 'text-[#dfd1b5]';
    }
  };

  return (
    <header className="w-full dnd-wood-bar border-b-2 px-4 py-2.5 text-xs shadow-sm">
      <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Horloge & Météo */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-[#f7eedb]">
            <Clock className="w-3.5 h-3.5 text-[#dfba68]" />
            <span className="font-display font-semibold tracking-wide">Jour {horloge.jour}</span>
            <span className="text-[#decfae] font-mono tabular-nums">
              {String(horloge.heure).padStart(2, '0')}:00
            </span>
            <span className="text-[#a89578] font-mono tabular-nums text-[11px]">
              (Tick {horloge.tick})
            </span>
          </div>
          <span className="text-[#6e563e]" aria-hidden="true">·</span>
          <span className="text-[#e6d7ba]">
            {horloge.meteo} ({horloge.temperature})
          </span>
        </div>

        {/* Lieu actuel */}
        <div className="flex items-center gap-2">
          <Compass className="w-3.5 h-3.5 text-[#dfba68]" />
          <span className="font-display font-semibold tracking-wide text-[#f8f0dc]">
            {hexActuel.nom}
          </span>
          <span className="text-[#a89578] font-mono tabular-nums text-[11px]">
            [{hexActuel.q},{hexActuel.r}]
          </span>
          <span className="text-[#6e563e]" aria-hidden="true">·</span>
          <span className={`inline-flex items-center gap-1 font-medium ${getSecuriteColor(hexActuel.securite)}`}>
            <Shield className="w-3 h-3" />
            {hexActuel.securite}
          </span>
        </div>

        {/* Ressources & Charge */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-sky-200" title="Eau potable">
            <Droplets className="w-3.5 h-3.5 text-sky-300" />
            <span className="font-mono tabular-nums font-medium">
              {personnage.eauLitres}L / {personnage.eauMaxLitres}L
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-emerald-200" title="Rations">
            <Utensils className="w-3.5 h-3.5 text-emerald-300" />
            <span className="font-mono tabular-nums font-medium">{personnage.rationsJours}j</span>
          </div>

          <div className="flex items-center gap-1.5 text-[#f4d78e]" title="Bourse">
            <Coins className="w-3.5 h-3.5 text-[#dfba68]" />
            <span className="font-mono tabular-nums font-medium">{personnage.monnaies.po} PO</span>
            <span className="text-[#b8a382] font-mono tabular-nums">{personnage.monnaies.pa} PA</span>
          </div>

          <div className="flex items-center gap-1.5 text-[#e6d7ba]" title={`Poids transporté: ${charge.statut}`}>
            <Package className="w-3.5 h-3.5 text-[#b8a382]" />
            <span
              className={`font-mono tabular-nums ${
                charge.statut !== 'Normal' ? 'text-amber-300 font-bold' : ''
              }`}
            >
              {charge.poidsTotal} / {charge.capaciteMax} lbs
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
