import React from 'react';
import { CharacterMemory as MemoryType, GmMemoryState } from '../types';
import { Brain, BookOpen, Lightbulb, Flag } from 'lucide-react';

interface CharacterMemoryProps {
  memoire: MemoryType;
  memoireMJ?: GmMemoryState;
  hexNom: string;
  meteo: string;
}

export const CharacterMemory: React.FC<CharacterMemoryProps> = ({
  memoire,
  memoireMJ,
  hexNom,
  meteo,
}) => {
  const quetes = memoireMJ?.promessesEtQuetes || [];

  const libelleStatut = (statut: string) => {
    switch (statut) {
      case 'ACCOMPLIE':
        return 'Tenue';
      case 'TRAHIE':
        return 'Trahie';
      case 'EXPIREE':
        return 'Expirée';
      default:
        return 'En cours';
    }
  };

  return (
    <div className="dnd-panel rounded-lg p-3.5 text-xs space-y-3 text-[#3b2c1e]">
      {/* En-tête */}
      <div className="flex items-center justify-between border-b border-[#d6c298] pb-2 gap-2">
        <div className="flex items-center gap-1.5 font-display font-semibold text-[#2a1d13] text-xs">
          <Brain className="w-4 h-4 text-[#9c6f21] shrink-0" />
          <span>Mémoire</span>
        </div>
        <span className="text-[11px] text-[#78624a] truncate">{hexNom} · {meteo}</span>
      </div>

      {/* Dernières infos apprises */}
      <div className="bg-[#f5edd8]/75 border border-[#cfb88c] rounded-md p-2.5 space-y-1.5">
        <div className="flex items-center gap-1.5 text-[#3b2b1d] font-semibold text-[11px]">
          <BookOpen className="w-3.5 h-3.5 text-[#7c5620]" />
          <span>Informations apprises</span>
        </div>
        <div className="space-y-1">
          {memoire.dernieresInfos.length > 0 ? (
            memoire.dernieresInfos.map((info, idx) => (
              <div key={idx} className="text-[11px] text-[#463626] py-0.5 leading-relaxed">
                • {info}
              </div>
            ))
          ) : (
            <div className="text-[11px] text-[#8a7359] italic">Aucune information récente enregistrée.</div>
          )}
        </div>
      </div>

      {/* Souvenirs contextuels */}
      <div className="bg-[#f5edd8]/75 border border-[#cfb88c] rounded-md p-2.5 space-y-1.5">
        <div className="flex items-center gap-1.5 text-[#5c3d19] font-semibold text-[11px]">
          <Lightbulb className="w-3.5 h-3.5 text-[#9c6f21]" />
          <span>Réminiscences</span>
        </div>
        <div className="space-y-1">
          {memoire.souvenirsContextuels.length > 0 ? (
            memoire.souvenirsContextuels.map((souvenir, idx) => (
              <div key={idx} className="text-[11px] text-[#463626] py-0.5 leading-relaxed">
                • {souvenir}
              </div>
            ))
          ) : (
            <div className="text-[11px] text-[#8a7359] italic">Rien de particulier en mémoire pour ce lieu.</div>
          )}
        </div>
      </div>

      {/* Engagements & Quêtes */}
      <div className="bg-[#f5edd8]/75 border border-[#cfb88c] rounded-md p-2.5 space-y-1.5">
        <div className="flex items-center gap-1.5 text-[#3b2b1d] font-semibold text-[11px]">
          <Flag className="w-3.5 h-3.5 text-emerald-800" />
          <span>Engagements et quêtes</span>
        </div>
        <div className="space-y-1.5">
          {quetes.length > 0 ? (
            quetes.map(q => (
              <div key={q.id} className="text-[11px] text-[#463626] border-t border-[#decba3] first:border-t-0 pt-1 first:pt-0 space-y-0.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-[#231a14] truncate">{q.titre}</span>
                  <span className="text-[10px] font-mono text-[#78624a] shrink-0">
                    {libelleStatut(q.statut)}
                  </span>
                </div>
                <div className="text-[10px] text-[#6d5742]">
                  {q.interlocuteur}
                  {q.echeanceJour ? ` · Jour ${q.echeanceJour}` : ''}
                  {q.details ? ` — ${q.details}` : ''}
                </div>
              </div>
            ))
          ) : (
            <div className="text-[11px] text-[#8a7359] italic">Aucun engagement actif.</div>
          )}
        </div>
      </div>
    </div>
  );
};
