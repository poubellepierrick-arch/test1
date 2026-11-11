import React, { useEffect, useRef } from 'react';
import { NarrativeEvent } from '../types';
import { ScrollText, Dice6, CheckCircle2, XCircle, Skull, AlertCircle } from 'lucide-react';

interface NarrativeFeedProps {
  journal: NarrativeEvent[];
}

export const NarrativeFeed: React.FC<NarrativeFeedProps> = ({ journal }) => {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [journal]);

  const renderBadgeIssue = (issue: string) => {
    switch (issue) {
      case 'SUCCESS':
      case 'STABILIZED':
        return (
          <span className="inline-flex items-center gap-1 text-emerald-800 font-medium bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-[11px]">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Succès
          </span>
        );
      case 'CRITICAL_SUCCESS':
        return (
          <span className="inline-flex items-center gap-1 text-emerald-900 font-bold bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded text-[11px]">
            <CheckCircle2 className="w-3 h-3 text-emerald-700" /> Succès critique (20)
          </span>
        );
      case 'FAILURE':
        return (
          <span className="inline-flex items-center gap-1 text-rose-800 font-medium bg-rose-50 border border-rose-200 px-2 py-0.5 rounded text-[11px]">
            <XCircle className="w-3 h-3 text-rose-600" /> Échec
          </span>
        );
      case 'CRITICAL_FAILURE':
        return (
          <span className="inline-flex items-center gap-1 text-rose-900 font-bold bg-rose-100 border border-rose-300 px-2 py-0.5 rounded text-[11px]">
            <XCircle className="w-3 h-3 text-rose-700" /> Échec critique (1)
          </span>
        );
      case 'PERMADEATH':
        return (
          <span className="inline-flex items-center gap-1 text-rose-950 font-bold bg-rose-200 border border-rose-400 px-2 py-0.5 rounded text-[11px]">
            <Skull className="w-3 h-3 text-rose-800" /> Mort définitive
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-white border border-stone-200 shadow-xs rounded-lg p-4 text-xs flex flex-col h-[520px]">
      <div className="flex justify-between items-center border-b border-stone-100 pb-2.5 mb-3">
        <div className="flex items-center gap-2 text-stone-900 font-bold text-sm">
          <ScrollText className="w-4 h-4 text-amber-700" />
          <span>Journal d'aventure</span>
        </div>
        <span className="text-stone-400 text-[11px] font-mono">{journal.length} entrées</span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pr-1.5">
        {journal.map((evt) => (
          <div
            key={evt._seq}
            className="border-l-2 border-stone-200 hover:border-emerald-500 pl-3.5 space-y-2 py-1 transition-colors"
          >
            {/* Horodatage & Titre & Ambiance */}
            <div className="flex items-center justify-between text-[11px] text-stone-500">
              <div className="flex items-center gap-2">
                <span className="text-amber-800 font-semibold">{evt.titre}</span>
                {evt.tonAmbiance === 'CHAMPETRE' && (
                  <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200/60 font-medium">
                    Champêtre
                  </span>
                )}
                {evt.tonAmbiance === 'SOMBRE' && (
                  <span className="text-[10px] text-stone-600 bg-stone-100 px-1.5 py-0.2 rounded border border-stone-200 font-medium">
                    Ombres
                  </span>
                )}
                {evt.tonAmbiance === 'PERIL' && (
                  <span className="text-[10px] text-rose-800 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200 font-medium">
                    Péril
                  </span>
                )}
              </div>
              <span className="font-mono text-stone-400">{evt.horodatageDate}</span>
            </div>

            {/* Récit immersif et aéré avec nuance d'ambiance */}
            <div
              className={`leading-relaxed p-3 rounded-md border text-sm shadow-2xs ${
                evt.tonAmbiance === 'CHAMPETRE'
                  ? 'bg-[#fffdf9] border-amber-200/60 text-stone-900'
                  : evt.tonAmbiance === 'SOMBRE'
                  ? 'bg-[#f8f7f5] border-stone-300 text-stone-900'
                  : evt.tonAmbiance === 'PERIL'
                  ? 'bg-[#fffbfa] border-rose-200 text-stone-900'
                  : 'bg-[#fcfbfa] border-stone-200/70 text-stone-800'
              }`}
            >
              {evt.texteNarratif}
            </div>

            {/* Résolution déterministe SRD 5e */}
            {evt.adjudication && (
              <div className="bg-stone-50 border border-stone-200 rounded-md p-2.5 space-y-1.5 text-xs text-stone-700">
                <div className="flex items-center justify-between flex-wrap gap-1.5">
                  <div className="flex items-center gap-1.5 font-semibold text-stone-900">
                    <Dice6 className="w-3.5 h-3.5 text-amber-700" />
                    <span>{evt.adjudication.competenceOuCarac || evt.adjudication.action_type}</span>
                  </div>
                  {renderBadgeIssue(evt.adjudication.issue)}
                </div>

                <div className="text-stone-600 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-mono tabular-nums">
                  <span>
                    d20 : <strong className="text-stone-900">{evt.adjudication.dice_roll}</strong>
                  </span>
                  <span>
                    Modificateur :{' '}
                    <strong className="text-stone-900">
                      {evt.adjudication.modificateur >= 0 ? `+${evt.adjudication.modificateur}` : evt.adjudication.modificateur}
                    </strong>
                  </span>
                  <span>
                    Total : <strong className="text-amber-800 font-bold">{evt.adjudication.score_total}</strong>
                  </span>
                  {evt.adjudication.cible_dd_ou_ca > 0 && (
                    <span>
                      DD/CA : <strong className="text-stone-900">{evt.adjudication.cible_dd_ou_ca}</strong>
                    </span>
                  )}
                </div>

                {evt.adjudication.mutations_etat.descriptionTechnique && (
                  <div className="text-[11px] text-stone-600 border-t border-stone-200/80 pt-1 font-mono">
                    {evt.adjudication.mutations_etat.descriptionTechnique}
                  </div>
                )}
              </div>
            )}

            {/* Événement du monde hors-champ */}
            {evt.evenementFaction && (
              <div className="bg-amber-50 border border-amber-200 p-2 rounded-md flex items-start gap-2 text-xs text-amber-900">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-700 mt-0.5" />
                <div>
                  <span className="font-semibold">{evt.evenementFaction.factionNom} : </span>
                  <span>{evt.evenementFaction.impact}</span>
                </div>
              </div>
            )}
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
};
