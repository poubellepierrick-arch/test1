import React, { useState } from 'react';
import { GmMemoryState } from '../types';
import { ActionRequest } from '../engine/adjudication';
import { Flag, Plus, Check, X, RotateCcw } from 'lucide-react';

interface QuestsPanelProps {
  memoireMJ?: GmMemoryState;
  chargement: boolean;
  onExecuterAction: (action: ActionRequest) => void;
}

export const QuestsPanel: React.FC<QuestsPanelProps> = ({
  memoireMJ,
  chargement,
  onExecuterAction,
}) => {
  const [ajoutOuvert, setAjoutOuvert] = useState(false);
  const [titre, setTitre] = useState('');
  const [details, setDetails] = useState('');

  const quetes = memoireMJ?.promessesEtQuetes || [];
  const propositions = quetes.filter(q => q.statut === 'PROPOSEE');
  const actives = quetes.filter(q => q.statut === 'EN_COURS');
  const terminees = quetes.filter(q => q.statut !== 'EN_COURS' && q.statut !== 'PROPOSEE');
  const arcs = memoireMJ?.arcsNarratifs || [];
  const arcsActifs = arcs.filter(a => a.statut === 'ACTIF');

  const soumettreQuete = (e: React.FormEvent) => {
    e.preventDefault();
    if (!titre.trim()) return;
    onExecuterAction({
      type: 'AJOUTER_QUETE',
      payloadAction: {
        mode: 'ajouter',
        titre: titre.trim(),
        details: details.trim(),
      },
    });
    setTitre('');
    setDetails('');
    setAjoutOuvert(false);
  };

  const libelleFin = (statut: string) => {
    if (statut === 'DECLINEE') return 'Déclinée';
    if (statut === 'TRAHIE') return 'Trahie';
    if (statut === 'EXPIREE') return 'Expirée';
    return 'Tenue';
  };

  return (
    <div className="dnd-panel rounded-lg overflow-hidden text-xs text-[#3b2c1e]">
      <div className="dnd-wood-header px-3.5 py-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 font-display font-semibold tracking-wide text-[#f8f0dc]">
          <Flag className="w-3.5 h-3.5 text-[#dfba68]" />
          <span>
            Quêtes · {actives.length}
            {propositions.length > 0 ? ` · Offres ${propositions.length}` : ''}
            {arcsActifs.length > 0 ? ` · Arcs ${arcsActifs.length}` : ''}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setAjoutOuvert(prev => !prev)}
          className="px-2 py-0.5 rounded bg-[#4a3623] hover:bg-[#5e452e] text-[#f5ebd6] text-[10px] flex items-center gap-1 cursor-pointer"
        >
          <Plus className="w-3 h-3 text-[#dfba68]" />
          Ajouter
        </button>
      </div>

      <div className="p-3 space-y-2">
        {ajoutOuvert && (
          <form onSubmit={soumettreQuete} className="bg-[#f5edd8] border border-[#cfb88c] rounded p-2 space-y-1.5">
            <input
              type="text"
              value={titre}
              onChange={e => setTitre(e.target.value)}
              placeholder="Objectif..."
              className="w-full bg-[#fffdf7] border border-[#bfa574] rounded px-2 py-1 text-[11px]"
            />
            <input
              type="text"
              value={details}
              onChange={e => setDetails(e.target.value)}
              placeholder="Lieu ou note (optionnel)"
              className="w-full bg-[#fffdf7] border border-[#bfa574] rounded px-2 py-1 text-[11px]"
            />
            <div className="flex gap-1.5 justify-end">
              <button
                type="button"
                onClick={() => setAjoutOuvert(false)}
                className="px-2 py-1 bg-white border border-stone-300 rounded text-[10px] cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={chargement || !titre.trim()}
                className="px-2.5 py-1 dnd-wood-bar border rounded text-[10px] font-medium cursor-pointer disabled:opacity-40"
              >
                Noter
              </button>
            </div>
          </form>
        )}

        {arcsActifs.length > 0 && (
          <div className="space-y-1.5 pb-1 border-b border-[#d6c298]">
            {arcsActifs.map(arc => (
              <div
                key={arc.id}
                className="bg-[#efe4cb]/80 border border-[#c7ab75] rounded p-2 space-y-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-[#2a1d13] truncate">{arc.titre}</span>
                  <span className="font-mono text-[10px] text-[#6d5742] shrink-0">
                    {arc.progression}%
                  </span>
                </div>
                <div className="w-full h-1 bg-[#d8c49a] rounded overflow-hidden">
                  <div
                    className="h-full bg-[#9c6f21]"
                    style={{ width: `${Math.max(4, Math.min(100, arc.progression))}%` }}
                  />
                </div>
                {arc.prochaineEtape && (
                  <div className="text-[10px] text-[#5c4734] leading-snug">
                    {arc.prochaineEtape}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {propositions.length > 0 && (
          <div className="space-y-1.5 pb-1.5 border-b border-[#d6c298]">
            <div className="text-[10px] uppercase tracking-wide text-[#78624a] font-semibold">
              Propositions
            </div>
            {propositions.map(q => (
              <div
                key={q.id}
                className="bg-[#faf3e0] border border-[#cfb88c] rounded p-2 space-y-1.5"
              >
                <div className="min-w-0 space-y-0.5">
                  <div className="font-semibold text-[#231a14] leading-snug">{q.titre}</div>
                  <div className="text-[10px] text-[#6d5742] leading-snug">
                    {q.interlocuteur}
                    {q.echeanceJour ? ` · J${q.echeanceJour}` : ''}
                    {q.details ? ` — ${q.details}` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={chargement}
                    onClick={() =>
                      onExecuterAction({
                        type: 'AJOUTER_QUETE',
                        cibleId: q.id,
                        payloadAction: { mode: 'statut', statut: 'EN_COURS' },
                      })
                    }
                    className="px-2 py-0.5 bg-white hover:bg-emerald-50 border border-[#bfa574] rounded text-[10px] font-medium text-emerald-900 flex items-center gap-1 cursor-pointer disabled:opacity-40"
                  >
                    <Check className="w-3 h-3" />
                    Accepter
                  </button>
                  <button
                    type="button"
                    disabled={chargement}
                    onClick={() =>
                      onExecuterAction({
                        type: 'AJOUTER_QUETE',
                        cibleId: q.id,
                        payloadAction: { mode: 'statut', statut: 'DECLINEE' },
                      })
                    }
                    className="px-2 py-0.5 bg-white hover:bg-stone-100 border border-[#cfb88c] rounded text-[10px] text-[#6d5742] flex items-center gap-1 cursor-pointer disabled:opacity-40"
                  >
                    <X className="w-3 h-3" />
                    Décliner
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {actives.length === 0 ? (
          <div className="text-[11px] text-[#78624a]">Aucune quête active.</div>
        ) : (
          <div className="space-y-1.5">
            {actives.map(q => (
              <div
                key={q.id}
                className="bg-[#f5edd8]/80 border border-[#cfb88c] rounded p-2 flex items-start justify-between gap-2"
              >
                <div className="min-w-0 space-y-0.5">
                  <div className="font-semibold text-[#231a14] leading-snug">{q.titre}</div>
                  <div className="text-[10px] text-[#6d5742] leading-snug">
                    {q.interlocuteur}
                    {q.echeanceJour ? ` · J${q.echeanceJour}` : ''}
                    {q.details ? ` — ${q.details}` : ''}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onExecuterAction({
                      type: 'AJOUTER_QUETE',
                      cibleId: q.id,
                      payloadAction: { mode: 'statut', statut: 'ACCOMPLIE' },
                    })
                  }
                  disabled={chargement}
                  title="Marquer tenue"
                  className="p-1 bg-white hover:bg-emerald-50 border border-[#cfb88c] rounded text-emerald-800 shrink-0 cursor-pointer"
                >
                  <Check className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {terminees.length > 0 && (
          <div className="pt-1 border-t border-[#d6c298] space-y-1">
            {terminees.slice(0, 3).map(q => (
              <div key={q.id} className="flex items-center justify-between gap-2 text-[10px] text-[#78624a]">
                <span className="truncate line-through">
                  {q.titre} · {libelleFin(q.statut)}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onExecuterAction({
                      type: 'AJOUTER_QUETE',
                      cibleId: q.id,
                      payloadAction: { mode: 'statut', statut: 'EN_COURS' },
                    })
                  }
                  disabled={chargement}
                  title="Rouvrir"
                  className="hover:text-[#231a14] shrink-0 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
