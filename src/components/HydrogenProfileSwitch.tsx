import React from 'react';
import { HydrogenModelProfile } from '../types';
import { Cpu } from 'lucide-react';

interface HydrogenProfileSwitchProps {
  profil: HydrogenModelProfile;
  chargement: boolean;
  onChange: (profil: HydrogenModelProfile) => void;
}

export const HydrogenProfileSwitch: React.FC<HydrogenProfileSwitchProps> = ({
  profil,
  chargement,
  onChange,
}) => {
  const estMax = profil === 'MAX';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={estMax}
      aria-label={`Gemini 4 Hydrogen : mode ${estMax ? 'Max' : 'Standard'}`}
      disabled={chargement}
      onClick={() => onChange(estMax ? 'STANDARD' : 'MAX')}
      title={
        estMax
          ? 'Gemini 4 Hydrogen Max actif (réflexion XHIGH) — cliquer pour passer en Standard'
          : 'Gemini 4 Hydrogen Standard actif — cliquer pour passer en Max (réflexion XHIGH)'
      }
      className="px-2 py-0.5 bg-[#fffdf7] hover:bg-[#efe4ca] border border-[#bfa574] rounded text-[11px] font-medium text-[#3b2c1e] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50 transition-colors"
    >
      <Cpu className={`w-3 h-3 shrink-0 ${estMax ? 'text-amber-700' : 'text-[#8c6422]'}`} />
      <span className="text-[#5b4735]">Hydrogen</span>
      <span
        className={`text-[10px] font-semibold ${
          !estMax ? 'text-[#231a14]' : 'text-[#8a755d]'
        }`}
      >
        Standard
      </span>
      <span
        aria-hidden="true"
        className={`relative inline-flex items-center w-7 h-3.5 rounded-full transition-colors border ${
          estMax
            ? 'bg-[#8c5a18] border-[#6d440e]'
            : 'bg-[#dfd1b5] border-[#bfa574]'
        }`}
      >
        <span
          className={`inline-block w-2.5 h-2.5 rounded-full bg-[#fffdf7] shadow-xs transition-transform ${
            estMax ? 'translate-x-3.5' : 'translate-x-0.5'
          }`}
        />
      </span>
      <span
        className={`text-[10px] font-semibold ${
          estMax ? 'text-[#8c5a18]' : 'text-[#8a755d]'
        }`}
      >
        Max
      </span>
    </button>
  );
};
