import React from 'react';
import { SimulationState } from '../types';
import { ActionRequest } from '../engine/adjudication';
import { Hammer, Shield, Shovel, Compass } from 'lucide-react';

interface WorkBoardPanelProps {
  etat: SimulationState;
  chargement: boolean;
  onExecuterAction: (action: ActionRequest) => void;
}

export const WorkBoardPanel: React.FC<WorkBoardPanelProps> = ({
  etat,
  chargement,
  onExecuterAction,
}) => {
  const estEnBourgade = etat.hexActuel.pointInteret?.type === 'bourgade' || etat.hexActuel.securite === 'Sûr';

  const offres = [
    {
      id: 'bois_palissade',
      titre: 'Bois & Palissades',
      desc: 'Renfort du rempart',
      test: 'FOR DD 11',
      duree: '2h',
      gain: '5 PA + 1 ration',
      icon: Hammer,
    },
    {
      id: 'garde_nuit',
      titre: 'Garde de nuit',
      desc: 'Veille sur créneaux',
      test: 'SAG DD 12',
      duree: '4h',
      gain: '8 PA',
      icon: Shield,
    },
    {
      id: 'forge_assistance',
      titre: 'Aide à la forge',
      desc: 'Maniement du soufflet',
      test: 'FOR DD 13',
      duree: '2h',
      gain: etat.marche.penurieArmurerie ? '6 PA (pénurie)' : '12 PA',
      icon: Hammer,
    },
    {
      id: 'debroussaillage_sentier',
      titre: 'Déblaiement de passe',
      desc: 'Dégagement de roches',
      test: 'FOR DD 12',
      duree: '3h',
      gain: '7 PA + 1 ration',
      icon: Shovel,
    },
    {
      id: 'chasse_ravitaillement',
      titre: 'Traque de subsistance',
      desc: 'Gibier pour le camp',
      test: 'SAG DD 13',
      duree: '3h',
      gain: '1 PO + 2 rations',
      icon: Compass,
    },
  ];

  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center justify-between text-stone-500 text-[11px]">
        <span className="font-semibold uppercase tracking-wide">Offres de corvées & subsistance</span>
        <span>{estEnBourgade ? 'Bourgade marchande' : 'Campement de fortune'}</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {offres.map(offre => {
          const Icon = offre.icon;
          return (
            <button
              key={offre.id}
              onClick={() => onExecuterAction({ type: 'CORVEE_TRAVAIL', jobId: offre.id })}
              disabled={chargement}
              className="text-left bg-stone-50 hover:bg-emerald-50/60 border border-stone-200 hover:border-emerald-300 p-2.5 rounded-lg transition-colors flex flex-col justify-between space-y-1.5 shadow-2xs cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-stone-900 flex items-center gap-1.5">
                  <Icon className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                  {offre.titre}
                </span>
                <span className="text-[10px] text-stone-600 bg-white px-1.5 py-0.2 rounded border border-stone-200 font-mono">
                  {offre.test}
                </span>
              </div>
              <div className="text-[11px] text-stone-600">{offre.desc}</div>
              <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-stone-200/80 text-stone-500 font-mono">
                <span>Durée : {offre.duree}</span>
                <span className="text-emerald-800 font-bold">{offre.gain}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
