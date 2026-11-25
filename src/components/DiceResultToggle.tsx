import React, { useState } from 'react';
import { AdjudicationPayload } from '../types';
import { Dice6, ChevronDown, ChevronUp, CheckCircle2, XCircle, Skull } from 'lucide-react';

interface DiceResultToggleProps {
  adjudication: AdjudicationPayload;
}

export const DiceResultToggle: React.FC<DiceResultToggleProps> = ({ adjudication }) => {
  const [ouvert, setOuvert] = useState(false);

  const getIssueInfo = (issue: AdjudicationPayload['issue']) => {
    switch (issue) {
      case 'CRITICAL_SUCCESS':
        return {
          label: 'Succès critique',
          colorClass: 'text-emerald-800',
          icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />,
        };
      case 'SUCCESS':
      case 'STABILIZED':
        return {
          label: 'Succès',
          colorClass: 'text-emerald-800',
          icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />,
        };
      case 'CRITICAL_FAILURE':
        return {
          label: 'Échec critique',
          colorClass: 'text-rose-800',
          icon: <XCircle className="w-3.5 h-3.5 text-rose-700 shrink-0" />,
        };
      case 'FAILURE':
        return {
          label: 'Échec',
          colorClass: 'text-rose-800',
          icon: <XCircle className="w-3.5 h-3.5 text-rose-700 shrink-0" />,
        };
      case 'PERMADEATH':
        return {
          label: 'Mort définitive',
          colorClass: 'text-rose-900 font-semibold',
          icon: <Skull className="w-3.5 h-3.5 text-rose-800 shrink-0" />,
        };
      default:
        return {
          label: 'Résolu',
          colorClass: 'text-[#4a3728]',
          icon: null,
        };
    }
  };

  const info = getIssueInfo(adjudication.issue);
  const labelAction = adjudication.competenceOuCarac || adjudication.action_type.replace(/_/g, ' ');
  const aUnSeuil = adjudication.cible_dd_ou_ca > 0;

  return (
    <div className="pt-1">
      <button
        type="button"
        onClick={() => setOuvert(prev => !prev)}
        aria-expanded={ouvert}
        className="w-full flex items-center justify-between gap-2 py-1.5 px-2.5 -mx-1 rounded-md text-[11px] text-[#6d5742] hover:text-[#2c1e14] hover:bg-[#efe4ca]/70 transition-colors cursor-pointer"
      >
        <span className="flex items-center gap-1.5 min-w-0 truncate">
          <Dice6 className="w-3.5 h-3.5 text-[#9c6f21] shrink-0" />
          <span className="font-medium text-[#3b2b1d] truncate">{labelAction}</span>
          <span aria-hidden="true" className="text-[#c5b089]">·</span>
          <span className={`inline-flex items-center gap-1 font-medium shrink-0 ${info.colorClass}`}>
            {info.icon}
            {info.label}
          </span>
          {aUnSeuil && (
            <>
              <span aria-hidden="true" className="text-[#c5b089]">·</span>
              <span className="font-mono tabular-nums text-[#54402d] shrink-0">
                {adjudication.score_total}/{adjudication.cible_dd_ou_ca}
              </span>
            </>
          )}
        </span>

        <span className="inline-flex items-center gap-1 text-[#826a4f] shrink-0 whitespace-nowrap">
          <span>{ouvert ? 'Masquer' : 'Dés'}</span>
          {ouvert ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </span>
      </button>

      {ouvert && (
        <div className="mt-1.5 bg-[#f4ead2]/85 border border-[#c9b285] rounded-md p-2.5 space-y-1.5 text-[11px] text-[#4a3827]">
          <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono tabular-nums text-[#5b4735]">
            <span>
              d20 : <strong className="text-[#231a14]">{adjudication.dice_roll}</strong>
            </span>
            <span>
              Mod :{' '}
              <strong className="text-[#231a14]">
                {adjudication.modificateur >= 0 ? `+${adjudication.modificateur}` : adjudication.modificateur}
              </strong>
            </span>
            <span>
              Total : <strong className="text-[#854d0e]">{adjudication.score_total}</strong>
            </span>
            {aUnSeuil && (
              <span>
                DD/CA : <strong className="text-[#231a14]">{adjudication.cible_dd_ou_ca}</strong>
              </span>
            )}
          </div>

          {adjudication.mutations_etat?.descriptionTechnique && (
            <div className="text-[#5b4735] border-t border-[#d6c298] pt-1.5 font-mono text-[11px] leading-snug">
              {adjudication.mutations_etat.descriptionTechnique}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
