import React from 'react';
import { Rumor } from '../types';
import { Radio } from 'lucide-react';

interface RumorsFeedProps {
  rumeurs: Rumor[];
}

export const RumorsFeed: React.FC<RumorsFeedProps> = ({ rumeurs }) => {
  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center justify-between text-stone-500 text-[11px]">
        <div className="flex items-center gap-1.5 font-semibold text-stone-800">
          <Radio className="w-3.5 h-3.5 text-amber-700" />
          <span>Rumeurs & nouvelles des messagers</span>
        </div>
        <span className="font-mono text-stone-400">{rumeurs.length} bruits</span>
      </div>

      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
        {rumeurs.length > 0 ? (
          rumeurs.map(r => (
            <div key={r.id} className="bg-stone-50 p-2.5 rounded-lg border border-stone-200 text-xs space-y-0.5 shadow-2xs">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-stone-900">{r.titre}</span>
                <span className="text-stone-400 font-mono text-[10px]">Source : {r.source}</span>
              </div>
              <p className="text-stone-600 leading-relaxed text-xs">{r.texte}</p>
            </div>
          ))
        ) : (
          <div className="text-stone-400 text-xs italic p-2 bg-stone-50 rounded-lg border border-stone-200">
            Aucun bruit de couloir récent.
          </div>
        )}
      </div>
    </div>
  );
};
