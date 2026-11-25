import React, { useState } from 'react';
import { CharacterStats } from '../types';
import { ActionRequest } from '../engine/adjudication';
import { ItemIcon } from '../utils/itemIcons';
import { ItemIllustrationInline, ItemImageTrigger } from './ItemIllustrationInline';
import { Hammer, AlertOctagon } from 'lucide-react';
import { RECETTES_BIVOUAC } from '../engine/injuries';

interface CraftingPanelProps {
  personnage: CharacterStats;
  recettesDisponiblesIds?: string[];
  raisonsRecettes?: Record<string, string>;
  peutSoignerBlessure?: boolean;
  raisonSoin?: string;
  chargement: boolean;
  onExecuterAction: (action: ActionRequest) => void;
}

export const CraftingPanel: React.FC<CraftingPanelProps> = ({
  personnage,
  recettesDisponiblesIds,
  raisonsRecettes = {},
  peutSoignerBlessure = true,
  raisonSoin = 'Bandage ou cataplasme requis',
  chargement,
  onExecuterAction,
}) => {
  const [objetIllustreId, setObjetIllustreId] = useState<string | null>(null);
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
          <div className="flex items-center justify-between font-bold text-rose-900 text-xs">
            <span className="flex items-center gap-1.5">
              <AlertOctagon className="w-4 h-4 text-rose-700" />
              <span>Blessures</span>
            </span>
            {!peutSoignerBlessure && (
              <span className="text-[10px] font-normal text-rose-700">{raisonSoin}</span>
            )}
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
                    {blessure.description} · <span className="text-amber-800 font-medium">{blessure.penalite}</span> ({blessure.joursReposRestants}j)
                  </div>
                </div>

                <button
                  onClick={() => handleSoigner(blessure.id)}
                  disabled={chargement || !peutSoignerBlessure}
                  title={!peutSoignerBlessure ? raisonSoin : 'Appliquer un remède'}
                  className="px-3 py-1 bg-rose-700 hover:bg-rose-800 disabled:bg-stone-200 disabled:text-stone-400 text-white rounded font-medium text-[11px] shadow-2xs transition-colors shrink-0 ml-2"
                >
                  Soigner
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
            <span>Atelier de bivouac</span>
          </div>
          <span className="font-mono">DEX DD 11 · 1h</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {RECETTES_BIVOUAC.map(rec => {
            const disponible = !recettesDisponiblesIds || recettesDisponiblesIds.includes(rec.id);
            const motifBlocage = raisonsRecettes[rec.id];
            const estOuvert = objetIllustreId === rec.id;
            return (
              <div
                key={rec.id}
                className={`border p-2.5 rounded-lg flex flex-col justify-between space-y-1.5 shadow-2xs ${
                  disponible
                    ? 'bg-stone-50 border-stone-200'
                    : 'bg-stone-50/50 border-stone-200/70 opacity-60'
                }`}
              >
                <div>
                  <div className="font-bold text-stone-900 flex items-center justify-between gap-1.5">
                    <span className="flex items-center gap-1.5 min-w-0">
                      <ItemIcon item={{ id: rec.id, nom: rec.objetProduit }} />
                      <span className="truncate">{rec.nom}</span>
                    </span>
                    <span className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[11px] text-emerald-800 font-bold font-mono">x{rec.quantiteProduite}</span>
                      <ItemImageTrigger
                        ouvert={estOuvert}
                        onToggle={() => setObjetIllustreId(estOuvert ? null : rec.id)}
                      />
                    </span>
                  </div>
                  <div className="text-[11px] text-stone-600 mt-0.5">{rec.description}</div>
                  {estOuvert && (
                    <ItemIllustrationInline
                      item={{
                        itemId: rec.id,
                        nom: rec.objetProduit,
                        sousCategorie: 'equipement',
                        effet: rec.description,
                      }}
                      onClose={() => setObjetIllustreId(null)}
                    />
                  )}
                  <div className="text-[10px] text-stone-400 pt-1">
                    {disponible ? `Requis : ${rec.materiauxRequis}` : motifBlocage || 'Indisponible ici'}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1.5 border-t border-stone-200/80">
                  <span className="text-[10px] text-stone-500 font-mono">{rec.tempsHeures}h</span>
                  <button
                    onClick={() => handleFabriquer(rec.id)}
                    disabled={chargement || !disponible}
                    title={motifBlocage}
                    className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 disabled:bg-stone-200 disabled:text-stone-400 text-white rounded font-medium text-[11px] shadow-2xs transition-colors cursor-pointer"
                  >
                    Fabriquer
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
