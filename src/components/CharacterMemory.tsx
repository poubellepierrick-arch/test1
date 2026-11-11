import React from 'react';
import { CharacterMemory as MemoryType } from '../types';
import { Brain, BookOpen, Lightbulb } from 'lucide-react';

interface CharacterMemoryProps {
  memoire: MemoryType;
  hexNom: string;
  meteo: string;
}

export const CharacterMemory: React.FC<CharacterMemoryProps> = ({
  memoire,
  hexNom,
  meteo,
}) => {
  return (
    <div className="bg-white border border-stone-200 shadow-xs rounded-lg p-3.5 text-xs space-y-3 text-stone-700">
      {/* En-tête : Mémoire du Personnage */}
      <div className="flex items-center justify-between border-b border-stone-100 pb-2">
        <div className="flex items-center gap-1.5 font-bold text-stone-900 text-xs">
          <Brain className="w-4 h-4 text-amber-700" />
          <span>Mémoire du personnage</span>
        </div>
        <span className="text-[11px] text-stone-400">{hexNom} · {meteo}</span>
      </div>

      {/* Sous-cadre 1 : Dernières infos apprises */}
      <div className="bg-stone-50 border border-stone-200 rounded-md p-2.5 space-y-1.5">
        <div className="flex items-center gap-1.5 text-stone-800 font-semibold text-[11px]">
          <BookOpen className="w-3.5 h-3.5 text-sky-700" />
          <span>Dernières informations apprises</span>
        </div>
        <div className="space-y-1">
          {memoire.dernieresInfos.length > 0 ? (
            memoire.dernieresInfos.map((info, idx) => (
              <div key={idx} className="text-[11px] text-stone-700 border-l-2 border-stone-300 pl-2 py-0.5 leading-relaxed">
                • {info}
              </div>
            ))
          ) : (
            <div className="text-[11px] text-stone-400 italic pl-1">Aucune information récente enregistrée.</div>
          )}
        </div>
      </div>

      {/* Sous-cadre 2 : Ce que la situation actuelle rappelle au personnage */}
      <div className="bg-stone-50 border border-stone-200 rounded-md p-2.5 space-y-1.5">
        <div className="flex items-center gap-1.5 text-amber-900 font-semibold text-[11px]">
          <Lightbulb className="w-3.5 h-3.5 text-amber-600" />
          <span>Souvenirs et réminiscences</span>
        </div>
        <div className="space-y-1">
          {memoire.souvenirsContextuels.length > 0 ? (
            memoire.souvenirsContextuels.map((souvenir, idx) => (
              <div key={idx} className="text-[11px] text-stone-700 border-l-2 border-amber-300 pl-2 py-0.5 leading-relaxed">
                • {souvenir}
              </div>
            ))
          ) : (
            <div className="text-[11px] text-stone-400 italic pl-1">Rien de particulier en mémoire pour ce lieu.</div>
          )}
        </div>
      </div>
    </div>
  );
};
