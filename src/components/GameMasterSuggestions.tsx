import React from 'react';
import { ArrowRight } from 'lucide-react';
import { ActionRequest } from '../engine/adjudication';

interface GameMasterSuggestionsProps {
  suggestions?: string[];
  tonAmbiance?: 'CHAMPETRE' | 'SOMBRE' | 'PERIL' | 'NEUTRE';
  chargement: boolean;
  onExecuterAction: (action: ActionRequest) => void;
  onSelectTexte?: (texte: string) => void;
}

export const GameMasterSuggestions: React.FC<GameMasterSuggestionsProps> = ({
  suggestions,
  chargement,
  onExecuterAction,
  onSelectTexte,
}) => {
  if (!suggestions || suggestions.length === 0) return null;

  const handleClick = (sug: string) => {
    if (chargement) return;
    if (onSelectTexte) {
      onSelectTexte(sug);
    } else {
      onExecuterAction({ type: 'ACTION_LIBRE', texteLibre: sug });
    }
  };

  return (
    <div className="pt-3.5 mt-3.5 border-t border-[#d2be96] space-y-2">
      <div className="font-display text-[11px] font-semibold tracking-wider uppercase text-[#7a5a2b]">
        Pistes d’action
      </div>

      <div className="space-y-1.5">
        {suggestions.map((sug, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleClick(sug)}
            disabled={chargement}
            className="w-full text-left px-3.5 py-2.5 rounded-md bg-[#fffdf7] hover:bg-[#f5ebd2] border border-[#cbb486] hover:border-[#9e742b] text-[#281c13] text-[13px] transition-colors flex items-center justify-between gap-2.5 group cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs"
          >
            <span className="font-journal leading-snug flex-1">{sug}</span>
            <ArrowRight className="w-3.5 h-3.5 text-[#9c7a44] group-hover:text-[#7c4a12] group-hover:translate-x-0.5 transition-transform shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
};
