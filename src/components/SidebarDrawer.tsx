import React, { useState } from 'react';
import { CharacterStats } from '../types';
import { CharacterSheet } from './CharacterSheet';
import { CharacterMemory } from './CharacterMemory';
import { ActionRequest } from '../engine/adjudication';
import { ChevronLeft, ChevronRight, AlertOctagon, HeartPulse, Users } from 'lucide-react';

interface SidebarDrawerProps {
  personnage: CharacterStats;
  hexNom: string;
  meteo: string;
  chargement: boolean;
  onExecuterAction: (action: ActionRequest) => void;
}

export const SidebarDrawer: React.FC<SidebarDrawerProps> = ({
  personnage,
  hexNom,
  meteo,
  chargement,
  onExecuterAction,
}) => {
  const [estReplie, setEstReplie] = useState(false);

  const aDesBlessures = personnage.blessuresPersistantes && personnage.blessuresPersistantes.length > 0;
  const nbCompagnons = personnage.compagnons?.length || 0;

  return (
    <aside
      className={`transition-all duration-200 flex flex-col space-y-3 text-xs ${
        estReplie ? 'lg:col-span-1' : 'lg:col-span-4'
      }`}
    >
      {/* Bouton de contrôle du volet latéral */}
      <div className="flex items-center justify-between bg-white border border-stone-200 shadow-xs rounded-lg px-3 py-2">
        <button
          onClick={() => setEstReplie(!estReplie)}
          className="text-xs text-stone-700 hover:text-amber-800 flex items-center gap-1.5 transition-colors font-medium"
          title={estReplie ? 'Déplier le volet' : 'Replier le volet'}
        >
          {estReplie ? (
            <>
              <ChevronRight className="w-4 h-4 text-amber-700" />
              <span>Déplier</span>
            </>
          ) : (
            <>
              <ChevronLeft className="w-4 h-4 text-amber-700" />
              <span>Replier le volet</span>
            </>
          )}
        </button>

        {/* Indicateurs d'état quand replié */}
        {estReplie && (
          <div className="flex items-center gap-2.5 text-[11px] text-stone-600 font-mono">
            <span className="flex items-center gap-1 text-rose-700 font-semibold">
              <HeartPulse className="w-3.5 h-3.5" />
              {personnage.pvActuels}/{personnage.pvMax}
            </span>
            {aDesBlessures && (
              <span className="text-amber-700 flex items-center gap-0.5 font-semibold">
                <AlertOctagon className="w-3.5 h-3.5" />
                {personnage.blessuresPersistantes.length}
              </span>
            )}
            {nbCompagnons > 0 && (
              <span className="text-stone-500 flex items-center gap-0.5">
                <Users className="w-3.5 h-3.5" />
                {nbCompagnons}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Contenu déployé */}
      {!estReplie && (
        <div className="space-y-3">
          {/* Alerte traumatismes et blessures si présentes */}
          {aDesBlessures && (
            <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-rose-900 font-bold text-xs">
                <AlertOctagon className="w-4 h-4 text-rose-700 shrink-0" />
                <span>Blessures et traumatismes</span>
              </div>
              <div className="space-y-1.5">
                {personnage.blessuresPersistantes.map(blessure => (
                  <div
                    key={blessure.id}
                    className="bg-white border border-rose-200 p-2 rounded-md flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-semibold text-rose-900">{blessure.nom}</div>
                      <div className="text-[11px] text-stone-500">{blessure.penalite} ({blessure.joursReposRestants}j restants)</div>
                    </div>
                    <button
                      onClick={() =>
                        onExecuterAction({
                          type: 'SOIGNER_BLESSURE',
                          payloadAction: { blessureId: blessure.id, avecRemede: true },
                        })
                      }
                      disabled={chargement}
                      className="px-2.5 py-1 bg-rose-700 hover:bg-rose-800 text-white rounded text-[10px] font-medium shadow-2xs transition-colors"
                    >
                      Soigner
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Fiche de personnage */}
          <CharacterSheet personnage={personnage} />

          {/* Mémoire du personnage */}
          <CharacterMemory memoire={personnage.memoire} hexNom={hexNom} meteo={meteo} />
        </div>
      )}
    </aside>
  );
};
