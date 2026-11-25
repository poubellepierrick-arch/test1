import React, { useEffect, useRef, useState } from 'react';
import { NarrativeEvent, AdjudicationPayload, NarrationMode, PendingRollRequest } from '../types';
import { ActionRequest } from '../engine/adjudication';
import { parserSegmentsRecit } from '../utils/journalFormatting';
import { JournalEntry, SceneIllustrationContext } from './JournalEntry';
import { DiceResultToggle } from './DiceResultToggle';
import { CornerFlourishes, SceneMedallion } from './DndOrnaments';
import { BookOpen, MessageCircle, Feather, X } from 'lucide-react';
import { useElapsedWait } from '../hooks/useElapsedWait';
import { formaterDureeAttente } from '../utils/aiTimeoutConfig';

interface NarrativeFeedProps {
  journal: NarrativeEvent[];
  nomMonde?: string;
  narrationEnCours?: {
    titre: string;
    actionJoueur?: string;
    texte: string;
    adjudication?: AdjudicationPayload;
  } | null;
  modeNarration?: NarrationMode;
  jetEnAttente?: PendingRollRequest | null;
  sceneContext?: SceneIllustrationContext;
  resetVersion?: number;
  chargement: boolean;
  infoRetry?: string | null;
  onExecuterAction: (action: ActionRequest) => void;
  onAnnulerAction?: () => void;
}

const BANNIERE_JOURNAL_URL = '/src/assets/images/journal_dnd_banner_1794593450443.jpg';

const MODES_NARRATION: Array<{ id: NarrationMode; label: string }> = [
  { id: 'ULTRA_COURT', label: 'Ultra-court' },
  { id: 'CONCIS', label: 'Concis' },
  { id: 'DEVELOPPE', label: 'Développé' },
];

export const NarrativeFeed: React.FC<NarrativeFeedProps> = ({
  journal,
  nomMonde,
  narrationEnCours,
  modeNarration = 'CONCIS',
  jetEnAttente,
  sceneContext,
  resetVersion = 0,
  chargement,
  infoRetry,
  onExecuterAction,
  onAnnulerAction,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [erreurBanniere, setErreurBanniere] = useState(false);
  const enAttenteMj = chargement || Boolean(narrationEnCours);
  const elapsedMs = useElapsedWait(enAttenteMj);
  const dureeTexte = formaterDureeAttente(elapsedMs);

  useEffect(() => {
    if (journal.length === 0 && !narrationEnCours?.texte) return;
    const el = scrollContainerRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }
  }, [journal.length, narrationEnCours?.texte]);

  const segmentsEnCours = narrationEnCours?.texte
    ? parserSegmentsRecit(narrationEnCours.texte)
    : [];

  return (
    <section className="relative dnd-parchment-sheet rounded-lg overflow-hidden flex flex-col h-[620px] lg:h-[68vh] lg:min-h-[600px]">
      <CornerFlourishes />

      {/* Bannière illustrée D&D sur mesure en tête du grimoire */}
      <div className="relative h-28 sm:h-32 shrink-0 border-b border-[#b48a3e] bg-[#2a1d14] overflow-hidden">
        {!erreurBanniere ? (
          <img
            src={BANNIERE_JOURNAL_URL}
            alt="Illustration de tour de guet et lanterne sur table de campagne"
            referrerPolicy="no-referrer"
            onError={() => setErreurBanniere(true)}
            className="w-full h-full object-cover object-[center_42%]"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#35251a] via-[#4a3321] to-[#231810] flex items-center justify-center">
            <Feather className="w-8 h-8 text-[#d4ad5d]/60" />
          </div>
        )}

        <div
          className="absolute inset-0 bg-gradient-to-t from-[#1f150e]/92 via-[#1f150e]/45 to-transparent"
          aria-hidden="true"
        />

        <div className="absolute inset-x-0 bottom-0 px-4 sm:px-5 py-2.5 flex flex-wrap items-end justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <BookOpen className="w-4 h-4 text-[#e5be6e] shrink-0" />
            <h2 className="font-display text-sm sm:text-base font-semibold tracking-wider text-[#f8f0dc] truncate">
              {nomMonde ? `Chronique · ${nomMonde}` : 'Chronique du monde'}
            </h2>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <div
              className="flex items-center bg-[#1b120b]/85 border border-[#8d6b34]/70 rounded p-0.5 text-[10px]"
              role="group"
              aria-label="Format de narration"
            >
              {MODES_NARRATION.map(m => {
                const actif = modeNarration === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    disabled={chargement}
                    onClick={() =>
                      onExecuterAction({
                        type: 'CONFIGURER_NARRATION',
                        payloadAction: { mode: m.id },
                      })
                    }
                    className={`px-2 py-0.5 rounded transition-colors cursor-pointer whitespace-nowrap ${
                      actif
                        ? 'bg-[#b48a3e] text-[#1a1109] font-semibold'
                        : 'text-[#dfd0b1] hover:text-white'
                    }`}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>

            <span className="text-[11px] font-mono tabular-nums text-[#e4cfa3]">
              {journal.length} {journal.length > 1 ? 'scènes' : 'scène'}
            </span>
          </div>
        </div>
      </div>

      {/* Corps du parchemin : lecture confortable et aérée */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-5 sm:px-7 py-5">
        <div className="max-w-[68ch] mx-auto space-y-5">
          {journal.length === 0 && !narrationEnCours && (
            <div className="bg-[#fffdf6]/95 border border-[#b48a3e] rounded-lg p-5 space-y-3 shadow-xs">
              <p className="font-journal text-[15px] leading-[1.65] text-[#2a2018]">
                {chargement
                  ? 'Le Maître du Jeu prend connaissance du monde généré...'
                  : 'La scène d’ouverture attend la réponse du Maître du Jeu IA.'}
              </p>
              {chargement ? (
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[#e5d5b3]">
                  <div className="text-xs text-[#6e563b] space-y-0.5">
                    <div className="font-mono tabular-nums">
                      En attente du MJ · {dureeTexte} / 15:00
                    </div>
                    {infoRetry && (
                      <div className="text-[11px] text-[#8c5a18]">{infoRetry}</div>
                    )}
                  </div>
                  {onAnnulerAction && (
                    <button
                      type="button"
                      onClick={onAnnulerAction}
                      className="px-3 py-1.5 rounded border border-[#b48a3e] bg-[#f7eed8] hover:bg-[#efe0bd] text-[#3a2817] text-xs font-medium flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Annuler</span>
                    </button>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => onExecuterAction({ type: 'OUVERTURE_CAMPAGNE' })}
                  className="px-3.5 py-1.5 dnd-wood-bar border rounded-md text-xs font-medium cursor-pointer whitespace-nowrap shrink-0"
                >
                  Ouvrir la scène avec le MJ IA
                </button>
              )}
            </div>
          )}

          {journal.map((evt, idx) => (
            <JournalEntry
              key={`${resetVersion}_${evt._seq}`}
              evt={evt}
              estDernier={idx === journal.length - 1}
              masquerSuggestions={Boolean(narrationEnCours)}
              jetEnAttente={idx === journal.length - 1 ? jetEnAttente : undefined}
              sceneContext={sceneContext}
              chargement={chargement}
              onExecuterAction={onExecuterAction}
            />
          ))}

          {/* Flux en direct du Maître du Jeu */}
          {narrationEnCours && (
            <article className="bg-[#fffdf6]/95 border border-[#b48a3e] rounded-lg p-5 space-y-3 shadow-xs">
              <header className="space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#78624a]">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[#8c5a18] font-semibold">En direct</span>
                    <span aria-hidden="true" className="text-[#c5b089]">·</span>
                    <span className="font-mono tabular-nums text-[#5b4735]">
                      {dureeTexte} / 15:00
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5 min-w-0">
                    {narrationEnCours.actionJoueur && (
                      <span className="text-[#8a7359] truncate max-w-[240px]">
                        {narrationEnCours.actionJoueur}
                      </span>
                    )}
                    {onAnnulerAction && (
                      <button
                        type="button"
                        onClick={onAnnulerAction}
                        className="px-2.5 py-1 rounded border border-[#b48a3e] bg-[#f7eed8] hover:bg-[#efe0bd] text-[#3a2817] text-[11px] font-medium flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                        <span>Annuler</span>
                      </button>
                    )}
                  </div>
                </div>
                {infoRetry && (
                  <div className="text-[11px] text-[#8c5a18] bg-[#f8efd9] border border-[#d6b980] rounded px-2.5 py-1">
                    {infoRetry}
                  </div>
                )}
                <div className="flex items-center gap-2.5">
                  <SceneMedallion ton="NEUTRE" />
                  <h3 className="font-display text-[17px] font-semibold tracking-wide text-[#2a1d13] leading-snug">
                    {narrationEnCours.titre}
                  </h3>
                </div>
              </header>

              {segmentsEnCours.length > 0 ? (
                <div className="space-y-3">
                  {segmentsEnCours.map((seg, i) => {
                    const estDernierSegment = i === segmentsEnCours.length - 1;
                    if (seg.type === 'dialogue') {
                      return (
                        <div
                          key={i}
                          className="bg-[#f3e8ce]/65 border border-[#c7ab75] rounded-md px-3.5 py-2.5 space-y-0.5"
                        >
                          {seg.locuteur && (
                            <div className="flex items-center gap-1.5 font-display text-[11px] font-semibold tracking-wide text-[#5c3d19]">
                              <MessageCircle className="w-3 h-3 text-[#9c6f21] shrink-0" />
                              <span>{seg.locuteur}</span>
                            </div>
                          )}
                          <p className="font-journal italic text-[15px] leading-[1.65] text-[#241911]">
                            « {seg.replique} »
                            {estDernierSegment && (
                              <span className="inline-block w-1.5 h-3.5 bg-[#8c5a18] ml-1 align-middle animate-pulse" />
                            )}
                          </p>
                        </div>
                      );
                    }
                    return (
                      <p
                        key={i}
                        className="font-journal text-[15px] leading-[1.72] text-[#2a2018]"
                      >
                        {seg.texte}
                        {estDernierSegment && (
                          <span className="inline-block w-1.5 h-3.5 bg-[#8c5a18] ml-1 align-middle animate-pulse" />
                        )}
                      </p>
                    );
                  })}
                </div>
              ) : (
                <p className="font-journal italic text-[#7d674f] text-[14.5px]">
                  Le Maître du Jeu observe la scène...
                </p>
              )}

              {narrationEnCours.adjudication && (
                <DiceResultToggle adjudication={narrationEnCours.adjudication} />
              )}
            </article>
          )}

        </div>
      </div>
    </section>
  );
};
