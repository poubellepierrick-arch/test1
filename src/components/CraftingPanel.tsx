import React from 'react';
import { CharacterStats } from '../types';
import { ActionRequest } from '../engine/adjudication';
import { Hammer, AlertOctagon } from 'lucide-react';
import { RECETTES_BIVOUAC } from '../engine/injuries';

interface CraftingPanelProps {
  personnage: CharacterStats;
  chargement: boolean;
  onExecuterAction: (action: ActionRequest) => void;
}

export const CraftingPanel: React.FC<CraftingPanelProps> = ({
  personnage,
  chargement,
  onExecuterAction,
}) => {
  const blessures = personnage.blessuresPersistantes || [];

  const handleFabriquer = (recetteId: string) => {
    onExecuterAction({
      type: 'FABRIQUER_OBJET',
      payloadAction: { recetteId },
    });
  };

  const handleSoigner = (blessureId: string) => {
    onExecuterAction({
      type: 'SOIGNER_BLESSURE',
      payloadAction: { blessureId, avecRemede: true },
    });
  };

  return (
    <div className="space-y-3 text-xs">
      {/* Soins des blessures persistantes */}
      {blessures.length > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-1.5 font-bold text-rose-900 text-xs">
            <AlertOctagon className="w-4 h-4 text-rose-700" />
            <span>Traumatismes à soigner au camp</span>
          </div>

          <div className="space-y-1.5">
            {blessures.map(blessure => (
              <div
                key={blessure.id}
                className="bg-white p-2.5 rounded-md border border-rose-200 flex items-center justify-between shadow-2xs"
              >
                <div>
                  <div className="font-semibold text-rose-900">{blessure.nom}</div>
                  <div className="text-[11px] text-stone-500">
                    {blessure.description} · <span className="text-amber-800 font-medium">{blessure.penalite}</span> ({blessure.joursReposRestants}j restants)
                  </div>
                </div>

                <button
                  onClick={() => handleSoigner(blessure.id)}
                  disabled={chargement}
                  className="px-3 py-1 bg-rose-700 hover:bg-rose-800 text-white rounded font-medium text-[11px] shadow-2xs transition-colors shrink-0 ml-2"
                >
                  Appliquer remède
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Atelier de bivouac */}
      <div className="space-y-2">
        <div className="flex items-center justify-between border-b border-stone-100 pb-1.5 text-stone-500 text-[11px]">
          <div className="flex items-center gap-1.5 font-bold text-stone-900">
            <Hammer className="w-4 h-4 text-emerald-700" />
            <span>Atelier de bivouac & remèdes de terrain</span>
          </div>
          <span className="font-mono">Test Survie / DEX (1h)</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {RECETTES_BIVOUAC.map(rec => (
            <div
              key={rec.id}
              className="bg-stone-50 border border-stone-200 p-2.5 rounded-lg flex flex-col justify-between space-y-1.5 shadow-2xs"
            >
              <div>
                <div className="font-bold text-stone-900 flex items-center justify-between">
                  <span>{rec.nom}</span>
                  <span className="text-[11px] text-emerald-800 font-bold font-mono">x{rec.quantiteProduite}</span>
                </div>
                <div className="text-[11px] text-stone-600 mt-0.5">{rec.description}</div>
                <div className="text-[10px] text-stone-400 pt-1">Requis : {rec.materiauxRequis}</div>
              </div>

              <div className="flex items-center justify-between pt-1.5 border-t border-stone-200/80">
                <span className="text-[10px] text-stone-500 font-mono">{rec.tempsHeures}h d'ouvrage</span>
                <button
                  onClick={() => handleFabriquer(rec.id)}
                  disabled={chargement}
                  className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded font-medium text-[11px] shadow-2xs transition-colors"
                >
                  Fabriquer
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
