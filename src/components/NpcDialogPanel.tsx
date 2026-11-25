import React, { useState, useEffect } from 'react';
import { SimulationState } from '../types';
import { ActionRequest } from '../engine/adjudication';
import { evaluerContexteLieu } from '../engine/context';
import { MessageSquare, User, Send, HeartHandshake, History, Sparkles, Radio } from 'lucide-react';

interface NpcDialogPanelProps {
  etat: SimulationState;
  chargement: boolean;
  onExecuterAction: (action: ActionRequest) => void;
}

export const NpcDialogPanel: React.FC<NpcDialogPanelProps> = ({
  etat,
  chargement,
  onExecuterAction,
}) => {
  const ctx = evaluerContexteLieu(etat);
  const pnjs = ctx.pnjsEnVue;

  const [pnjSelectionne, setPnjSelectionne] = useState<string>(pnjs[0]?.id || '');
  const [sujetLibre, setSujetLibre] = useState('');

  useEffect(() => {
    if (pnjs.length > 0 && !pnjs.some(p => p.id === pnjSelectionne)) {
      setPnjSelectionne(pnjs[0].id);
    } else if (pnjs.length === 0 && pnjSelectionne !== '') {
      setPnjSelectionne('');
    }
  }, [pnjs, pnjSelectionne]);

  if (pnjs.length === 0) {
    return (
      <div className="bg-stone-50 border border-stone-200 rounded-lg p-3 text-xs text-stone-500">
        Aucun PNJ dans votre champ de vision.
      </div>
    );
  }

  const pnjActif = pnjs.find(p => p.id === pnjSelectionne) || pnjs[0];
  const pnjRecord = etat.pnjsMonde?.find(p => p.id === pnjActif.id);
  const disposition = pnjActif.proprietes?.disposition || 'NEUTRE';
  const humeur = pnjActif.proprietes?.humeur || 'Attentif';
  const seuilDD = pnjActif.proprietes?.seuilDD || 12;
  const role = pnjActif.proprietes?.profession || 'Voyageur';
  const apparence = (pnjActif.proprietes?.apparence as string | undefined) || pnjRecord?.apparence;
  const voixEtManies = (pnjActif.proprietes?.voixEtManies as string | undefined) || pnjRecord?.voixEtManies;
  const lienHerosNature =
    (pnjActif.proprietes?.lienHerosNature as string | undefined) || pnjRecord?.lienHerosNature;
  const motifRencontre = pnjActif.proprietes?.motifRencontre as string | undefined;
  const suggestions = (pnjActif.proprietes?.suggestions as string[]) || [
    'Demander des nouvelles des environs',
    'S\'enquérir des rumeurs locales',
  ];
  const historique = (pnjActif.proprietes?.historiqueDialogue as any[]) || [];

  const handleParler = (sujetParam?: string) => {
    const texte = (sujetParam || sujetLibre).trim() || 'Situation et rumeurs';
    if (chargement || !pnjActif) return;
    onExecuterAction({
      type: 'DIALOGUER_PNJ',
      pnjId: pnjActif.id,
      sujetDialogue: texte,
    });
    setSujetLibre('');
  };

  const getDispositionBadge = (disp: string) => {
    switch (disp) {
      case 'AMICAL':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-800 font-medium">
            <HeartHandshake className="w-3 h-3 text-emerald-600" /> Amical
          </span>
        );
      case 'MEFIANT':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] text-rose-800 font-medium">
            Méfiant
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[10px] text-stone-600 font-medium">
            Neutre
          </span>
        );
    }
  };

  return (
    <div className="space-y-3 text-xs">
      <div className="flex items-center justify-between text-stone-500 text-[11px]">
        <span className="font-semibold uppercase tracking-wide">Interlocuteurs en vue</span>
        <span>{pnjs.length} présent(s)</span>
      </div>

      {/* Sélecteur de PNJ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {pnjs.map(pnj => {
          const estActif = pnj.id === pnjActif.id;
          const disp = pnj.proprietes?.disposition || 'NEUTRE';
          const pnjRole = pnj.proprietes?.profession || 'Voyageur';
          return (
            <button
              key={pnj.id}
              onClick={() => setPnjSelectionne(pnj.id)}
              className={`text-left p-2.5 rounded-lg border transition-colors flex items-start gap-2 cursor-pointer ${
                estActif
                  ? 'bg-sky-50/80 border-sky-300 text-stone-900 shadow-2xs'
                  : 'bg-stone-50 border-stone-200 text-stone-600 hover:border-stone-300'
              }`}
            >
              <User className={`w-4 h-4 mt-0.5 shrink-0 ${estActif ? 'text-sky-700' : 'text-stone-400'}`} />
              <div className="space-y-0.5 flex-1 min-w-0">
                <div className="font-bold flex items-center justify-between gap-1">
                  <span className="truncate">{pnj.label}</span>
                  {getDispositionBadge(disp)}
                </div>
                <div className="text-[11px] text-stone-500 truncate">
                  {pnjRole}
                  {pnj.proprietes?.estItinerant ? ' · En route' : ''}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Cadre de dialogue */}
      <div className="bg-stone-50 border border-stone-200 p-3 rounded-lg space-y-2.5">
        <div className="flex items-center justify-between border-b border-stone-200 pb-1.5 flex-wrap gap-1">
          <div className="flex items-center gap-1.5 font-bold text-stone-900">
            <MessageSquare className="w-3.5 h-3.5 text-sky-700" />
            <span>{pnjActif.label}</span>
            <span className="text-[11px] font-normal text-stone-500">· {role}</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-stone-500">
            <span>{humeur}</span>
            <span>·</span>
            <span className="font-mono">DD {seuilDD}</span>
          </div>
        </div>

        {(apparence || voixEtManies || lienHerosNature) && (
          <div className="text-[11px] text-stone-700 bg-white border border-stone-200 rounded px-2.5 py-1.5 space-y-0.5">
            {lienHerosNature && (
              <div className="text-amber-900 font-medium">{lienHerosNature}</div>
            )}
            {apparence && <div>{apparence}</div>}
            {voixEtManies && <div className="text-stone-500 italic">{voixEtManies}</div>}
          </div>
        )}

        {motifRencontre && (
          <div className="text-[11px] text-sky-900 bg-sky-50/70 border border-sky-200/70 rounded px-2 py-1">
            {motifRencontre}
          </div>
        )}

        {/* Sujets rapides + demande directe de rumeurs */}
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 text-[11px] text-stone-600 font-medium">
              <Sparkles className="w-3 h-3 text-amber-600" />
              <span>Sujets</span>
            </div>
            <button
              onClick={() => onExecuterAction({ type: 'DEMANDER_RUMEURS', pnjId: pnjActif.id })}
              disabled={chargement}
              className="px-2 py-0.5 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 rounded text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
            >
              <Radio className="w-3 h-3" />
              Demander rumeurs
            </button>
          </div>
          <div className="grid grid-cols-1 gap-1">
            {suggestions.map((sug, i) => (
              <button
                key={i}
                onClick={() => handleParler(sug)}
                disabled={chargement}
                className="text-left p-1.5 px-2 bg-white hover:bg-stone-100 border border-stone-200 rounded text-[11px] text-stone-800 transition-colors flex items-center justify-between group cursor-pointer disabled:opacity-50"
              >
                <span className="truncate">{sug}</span>
                <span className="text-stone-400 group-hover:text-sky-700 font-mono text-[10px]">Parler →</span>
              </button>
            ))}
          </div>
        </div>

        {/* Question libre */}
        <form
          onSubmit={e => {
            e.preventDefault();
            handleParler();
          }}
          className="flex gap-2 pt-1 border-t border-stone-200"
        >
          <input
            type="text"
            value={sujetLibre}
            onChange={e => setSujetLibre(e.target.value)}
            disabled={chargement}
            placeholder={`Question à ${pnjActif.label}...`}
            className="flex-1 bg-white border border-stone-300 rounded-md px-3 py-1.5 text-stone-900 placeholder-stone-400 focus:outline-none focus:border-stone-500 text-xs"
          />
          <button
            type="submit"
            disabled={chargement}
            className="px-3.5 py-1.5 bg-sky-700 hover:bg-sky-800 disabled:opacity-50 text-white rounded-md font-medium flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Parler</span>
          </button>
        </form>

        {/* Historique des échanges */}
        {historique.length > 0 && (
          <div className="pt-2 border-t border-stone-200 space-y-1">
            <div className="flex items-center gap-1 text-[10px] text-stone-500 font-medium uppercase tracking-wider">
              <History className="w-3 h-3 text-stone-400" />
              <span>Échanges récents</span>
            </div>
            <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
              {historique.map((h, idx) => (
                <div key={idx} className="bg-white p-1.5 rounded border border-stone-200/70 text-[11px] space-y-0.5">
                  <div className="flex justify-between gap-2">
                    <span className="text-stone-800 italic truncate">« {h.sujet} »</span>
                    <span className="text-stone-400 shrink-0 font-mono text-[10px]">{h.issue}</span>
                  </div>
                  {h.repliquePnj && (
                    <div className="text-stone-700 leading-snug">
                      → « {h.repliquePnj} »
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
