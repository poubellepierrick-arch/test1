import React, { useState } from 'react';
import { CharacterStats, GmMemoryState, SimulationState } from '../types';
import { CharacterSheet } from './CharacterSheet';
import { CharacterMemory } from './CharacterMemory';
import { HeroKnowledgePanel } from './HeroKnowledgePanel';
import { ActionRequest } from '../engine/adjudication';
import { inventaireAUnRemede } from '../engine/context';
import { ChevronDown, ChevronUp, AlertOctagon, HeartPulse, Users } from 'lucide-react';

interface SidebarDrawerProps {
  etat?: SimulationState;
  personnage: CharacterStats;
  memoireMJ?: GmMemoryState;
  hexNom?: string;
  meteo?: string;
  estEnBourgade?: boolean;
  chargement: boolean;
  estReplie?: boolean;
  onToggleReplie?: () => void;
  onExecuterAction: (action: ActionRequest) => void;
  onAnalyserImportHeros?: (
    rawText: string,
    files: Array<{ nom: string; contenu: string }>,
    signal?: AbortSignal
  ) => Promise<{ hero: any; sourceMode: string }>;
}

export const SidebarDrawer: React.FC<SidebarDrawerProps> = ({
  etat,
  personnage,
  memoireMJ,
  hexNom = '',
  meteo = '',
  estEnBourgade = false,
  chargement,
  estReplie: estReplieProp,
  onToggleReplie,
  onExecuterAction,
  onAnalyserImportHeros,
}) => {
  const [estReplieLocal, setEstReplieLocal] = useState(false);
  const estReplie = estReplieProp !== undefined ? estReplieProp : estReplieLocal;
  const toggleReplie = () => {
    if (onToggleReplie) {
      onToggleReplie();
    } else {
      setEstReplieLocal(prev => !prev);
    }
  };

  const aDesBlessures = personnage.blessuresPersistantes && personnage.blessuresPersistantes.length > 0;
  const nbCompagnons = personnage.compagnons?.length || 0;
  const soldePA = personnage.monnaies.po * 10 + personnage.monnaies.pa;
  const aRemede = inventaireAUnRemede(personnage.inventaire);
  const peutSoigner = aRemede || (estEnBourgade && soldePA >= 5);
  const infoSoin = estEnBourgade ? 'Remède ou 5 PA requis' : 'Remède requis';

  return (
    <aside className="min-w-0 flex flex-col space-y-3 text-xs">
      {/* Barre accordéon Aventurier intégrée dans la colonne de droite */}
      <button
        type="button"
        onClick={toggleReplie}
        className="w-full flex items-center justify-between dnd-wood-bar border rounded-lg px-3 py-2 shadow-xs text-xs text-[#f6eedb] hover:text-[#e5be6e] transition-colors font-medium cursor-pointer"
        title={estReplie ? 'Déplier la fiche et la mémoire' : 'Replier la fiche et la mémoire'}
      >
        <span className="flex items-center gap-1.5">
          {estReplie ? (
            <ChevronDown className="w-4 h-4 text-[#dfba68]" />
          ) : (
            <ChevronUp className="w-4 h-4 text-[#dfba68]" />
          )}
          <span className="font-display tracking-wide">Aventurier</span>
        </span>

        <span className="flex items-center gap-2 text-[11px] text-[#f5ebd6] font-mono tabular-nums">
          <span className="flex items-center gap-1 text-rose-300 font-semibold">
            <HeartPulse className="w-3 h-3" />
            {personnage.pvActuels}/{personnage.pvMax}
          </span>
          {aDesBlessures && (
            <span className="text-amber-300 flex items-center gap-0.5 font-semibold">
              <AlertOctagon className="w-3 h-3" />
              {personnage.blessuresPersistantes.length}
            </span>
          )}
          {nbCompagnons > 0 && (
            <span className="text-[#d6c298] flex items-center gap-0.5">
              <Users className="w-3 h-3" />
              {nbCompagnons}
            </span>
          )}
        </span>
      </button>

      {/* Contenu déployé */}
      {!estReplie && (
        <div className="space-y-3">
          {/* Alerte traumatismes et blessures si présentes */}
          {aDesBlessures && (
            <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between text-rose-900 font-bold text-xs">
                <span className="flex items-center gap-1.5">
                  <AlertOctagon className="w-4 h-4 text-rose-700 shrink-0" />
                  <span>Blessures et traumatismes</span>
                </span>
                {!peutSoigner && (
                  <span className="text-[10px] font-normal text-rose-700">{infoSoin}</span>
                )}
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
                      disabled={chargement || !peutSoigner}
                      title={!peutSoigner ? infoSoin : 'Appliquer un remède'}
                      className="px-2.5 py-1 bg-rose-700 hover:bg-rose-800 disabled:bg-stone-200 disabled:text-stone-400 text-white rounded text-[10px] font-medium shadow-2xs transition-colors"
                    >
                      Soigner
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Fiche de personnage */}
          <CharacterSheet
            personnage={personnage}
            chargement={chargement}
            onExecuterAction={onExecuterAction}
            onAnalyserImportHeros={onAnalyserImportHeros}
          />

          {/* Savoir du héros (perception, connu, souvenirs, rumeurs, offres) */}
          {etat ? (
            <HeroKnowledgePanel
              etat={etat}
              chargement={chargement}
              onExecuterAction={onExecuterAction}
            />
          ) : (
            <CharacterMemory memoire={personnage.memoire} memoireMJ={memoireMJ} hexNom={hexNom} meteo={meteo} />
          )}
        </div>
      )}
    </aside>
  );
};
