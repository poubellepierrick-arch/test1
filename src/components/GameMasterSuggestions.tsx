import React from 'react';
import { Compass, Sparkles, ArrowRight, ShieldAlert, Sun, Moon } from 'lucide-react';
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
  tonAmbiance = 'NEUTRE',
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

  const getAmbianceBadge = () => {
    switch (tonAmbiance) {
      case 'CHAMPETRE':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] text-amber-800 font-medium bg-amber-50/80 px-2 py-0.5 rounded border border-amber-200/60">
            <Sun className="w-3 h-3 text-amber-600" />
            Ambiance champêtre
          </span>
        );
      case 'SOMBRE':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] text-stone-700 font-medium bg-stone-100 px-2 py-0.5 rounded border border-stone-200">
            <Moon className="w-3 h-3 text-stone-600" />
            Terre hostile & ombres
          </span>
        );
      case 'PERIL':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] text-rose-800 font-medium bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
            <ShieldAlert className="w-3 h-3 text-rose-600" />
            Danger immédiat
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] text-stone-600 font-medium bg-stone-50 px-2 py-0.5 rounded border border-stone-200">
            <Compass className="w-3 h-3 text-stone-500" />
            Pistes d'action
          </span>
        );
    }
  };

  return (
    <div className="bg-[#fcfbf9] border border-stone-200 rounded-lg p-3 space-y-2 text-xs shadow-2xs">
      <div className="flex items-center justify-between border-b border-stone-200/60 pb-1.5">
        <div className="flex items-center gap-1.5 font-bold text-stone-800">
          <Sparkles className="w-3.5 h-3.5 text-amber-700" />
          <span>Suggestions du Maître du Jeu</span>
        </div>
        {getAmbianceBadge()}
      </div>

      <div className="grid grid-cols-1 gap-1.5">
        {suggestions.map((sug, idx) => (
          <button
            key={idx}
            onClick={() => handleClick(sug)}
            disabled={chargement}
            className="w-full text-left p-2 rounded-md bg-white hover:bg-stone-50 border border-stone-200/80 hover:border-amber-400 text-stone-800 transition-colors flex items-center justify-between gap-2 group cursor-pointer disabled:opacity-50"
          >
            <span className="leading-snug flex-1">{sug}</span>
            <ArrowRight className="w-3.5 h-3.5 text-stone-400 group-hover:text-amber-700 group-hover:translate-x-0.5 transition-transform shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
};
