import React from 'react';
import { Rumor, GraphNode } from '../types';
import { ActionRequest } from '../engine/adjudication';
import { Radio } from 'lucide-react';

interface RumorsFeedProps {
  rumeurs: Rumor[];
  pnjsEnVue?: GraphNode[];
  chargement?: boolean;
  onExecuterAction?: (action: ActionRequest) => void;
}

export const RumorsFeed: React.FC<RumorsFeedProps> = ({
  rumeurs,
  pnjsEnVue = [],
  chargement = false,
  onExecuterAction,
}) => {
  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center justify-between text-stone-500 text-[11px]">
        <div className="flex items-center gap-1.5 font-semibold text-stone-800">
          <Radio className="w-3.5 h-3.5 text-amber-700" />
          <span>Rumeurs connues</span>
        </div>
        <span className="font-mono text-stone-400">{rumeurs.length}</span>
      </div>

      {onExecuterAction && pnjsEnVue.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 bg-stone-50 border border-stone-200 p-2 rounded-lg">
          <span className="text-[11px] text-stone-600">Interroger :</span>
          {pnjsEnVue.map(pnj => (
            <button
              key={pnj.id}
              onClick={() => onExecuterAction({ type: 'DEMANDER_RUMEURS', pnjId: pnj.id })}
              disabled={chargement}
              className="px-2 py-0.5 bg-white hover:bg-amber-50 border border-stone-300 hover:border-amber-300 text-stone-800 rounded text-[11px] transition-colors cursor-pointer disabled:opacity-50"
            >
              {pnj.label}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
        {rumeurs.length > 0 ? (
          rumeurs.map(r => {
            const statutLabel =
              r.statutPerception === 'CONFIRMEE'
                ? 'Confirmée'
                : r.statutPerception === 'DEMENTIE'
                ? 'Démentie'
                : 'Incertaine';
            return (
              <div key={r.id} className="bg-stone-50 p-2.5 rounded-lg border border-stone-200 text-xs space-y-0.5 shadow-2xs">
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="font-bold text-stone-900 truncate">{r.titre}</span>
                  <span className="text-stone-500 font-mono text-[10px] shrink-0">
                    {statutLabel}
                  </span>
                </div>
                <div className="text-[10px] text-stone-400">
                  {r.source}{r.lieuObtention ? ` · ${r.lieuObtention}` : ''}
                </div>
                <p className="text-stone-600 leading-relaxed text-xs">{r.texte}</p>
              </div>
            );
          })
        ) : (
          <div className="text-stone-400 text-xs italic p-2 bg-stone-50 rounded-lg border border-stone-200">
            {pnjsEnVue.length > 0
              ? 'Aucune rumeur notée. Interrogez un PNJ en vue.'
              : 'Aucune rumeur notée. PNJ en vue requis.'}
          </div>
        )}
      </div>
    </div>
  );
};
