import React from 'react';
import { DungeonState } from '../types';
import { ActionRequest } from '../engine/adjudication';
import { Castle, Search, DoorOpen, LogOut } from 'lucide-react';

interface DungeonTacticalViewProps {
  donjon: DungeonState;
  chargement: boolean;
  onExecuterAction: (action: ActionRequest) => void;
}

export const DungeonTacticalView: React.FC<DungeonTacticalViewProps> = ({
  donjon,
  chargement,
  onExecuterAction,
}) => {
  const salleActuelle = donjon.salles.find(s => s.id === donjon.salleActuelleId) || donjon.salles[0];

  const avancerVers = (salleId: string) => {
    onExecuterAction({
      type: 'DONJON_DEPLACEMENT',
      payloadAction: { salleCibleId: salleId },
    });
  };

  const fouiller = () => {
    onExecuterAction({
      type: 'DONJON_FOUILLER',
      payloadAction: { salleId: salleActuelle.id },
    });
  };

  const sortir = () => {
    onExecuterAction({
      type: 'DONJON_SORTIR',
    });
  };

  return (
    <div className="space-y-3 text-xs">
      {/* En-tête Donjon */}
      <div className="flex items-center justify-between border-b border-stone-100 pb-2">
        <div className="flex items-center gap-1.5 font-bold text-stone-900">
          <Castle className="w-4 h-4 text-amber-700" />
          <span>Exploration tactique : {donjon.nom}</span>
        </div>
        <button
          onClick={sortir}
          disabled={chargement}
          className="px-2.5 py-1 bg-white hover:bg-stone-100 text-stone-700 rounded-md border border-stone-300 flex items-center gap-1.5 text-[11px] shadow-2xs transition-colors"
        >
          <LogOut className="w-3.5 h-3.5 text-rose-600" />
          <span>Sortir vers l'hexagone</span>
        </button>
      </div>

      {/* Carte nodale des salles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {donjon.salles.map(salle => {
          const estIci = salle.id === donjon.salleActuelleId;
          const accessible = salleActuelle.connexions.includes(salle.id);

          return (
            <div
              key={salle.id}
              className={`p-2.5 rounded-lg border text-xs flex flex-col justify-between space-y-1.5 transition-colors ${
                estIci
                  ? 'bg-amber-50 border-amber-300 text-stone-900 shadow-2xs'
                  : salle.visitee
                  ? 'bg-stone-50 border-stone-200 text-stone-700'
                  : 'bg-stone-100/50 border-stone-200 text-stone-400'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold flex items-center gap-1.5">
                  <DoorOpen className="w-3.5 h-3.5 shrink-0 text-amber-700" />
                  {salle.nom}
                </span>
                {estIci && (
                  <span className="text-[10px] bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.2 rounded font-bold font-mono">
                    ICI
                  </span>
                )}
              </div>

              <div className="text-[11px] text-stone-500 leading-snug">
                {salle.visitee ? salle.description : 'Salle non explorée (ombre totale)'}
              </div>

              <div className="pt-1.5 border-t border-stone-200/80 flex items-center justify-between">
                <span className="text-[10px] text-stone-400 font-mono">
                  Danger : {salle.danger}
                </span>
                {!estIci && accessible && (
                  <button
                    onClick={() => avancerVers(salle.id)}
                    disabled={chargement}
                    className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-[10px] font-medium shadow-2xs transition-colors"
                  >
                    Avancer
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Actions dans la salle actuelle */}
      <div className="bg-stone-50 border border-stone-200 p-3 rounded-lg flex flex-wrap items-center justify-between gap-2.5 shadow-2xs">
        <div className="space-y-0.5">
          <div className="font-bold text-stone-900">{salleActuelle.nom}</div>
          <p className="text-[11px] text-stone-600 leading-snug">{salleActuelle.description}</p>
        </div>

        <div className="flex items-center gap-2">
          {salleActuelle.fouillable && (
            <button
              onClick={fouiller}
              disabled={chargement}
              className="px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white font-medium rounded-md flex items-center gap-1.5 text-xs shadow-2xs transition-colors"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Fouiller les décombres (Investigation INT)</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
