import React, { useState } from 'react';
import { RotateCcw } from 'lucide-react';

interface ResetCampaignButtonProps {
  chargement: boolean;
  onReset: () => Promise<void> | void;
}

export const ResetCampaignButton: React.FC<ResetCampaignButtonProps> = ({
  chargement,
  onReset,
}) => {
  const [confirmer, setConfirmer] = useState(false);

  if (confirmer) {
    return (
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={chargement}
          onClick={async () => {
            setConfirmer(false);
            await onReset();
          }}
          className="px-2 py-0.5 bg-rose-700 hover:bg-rose-800 disabled:opacity-50 text-white rounded text-[11px] font-medium cursor-pointer whitespace-nowrap shrink-0"
        >
          Confirmer
        </button>
        <button
          type="button"
          disabled={chargement}
          onClick={() => setConfirmer(false)}
          className="px-2 py-0.5 bg-[#fffdf7] hover:bg-[#efe4ca] border border-[#bfa574] rounded text-[11px] text-[#5b4735] cursor-pointer whitespace-nowrap shrink-0"
        >
          Annuler
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={chargement}
      onClick={() => setConfirmer(true)}
      title="Recommencer de zéro"
      className="px-2 py-0.5 bg-[#fffdf7] hover:bg-[#efe4ca] border border-[#bfa574] rounded text-[11px] font-medium text-[#3b2c1e] flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
    >
      <RotateCcw className="w-3 h-3 text-[#8c6422]" />
      <span>Recommencer</span>
    </button>
  );
};
