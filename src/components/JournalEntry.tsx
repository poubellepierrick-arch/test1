import React, { useEffect, useRef, useState } from 'react';
import { NarrativeEvent, PendingRollRequest } from '../types';
import { ActionRequest } from '../engine/adjudication';
import { parserSegmentsRecit } from '../utils/journalFormatting';
import { DiceResultToggle } from './DiceResultToggle';
import { GameMasterSuggestions } from './GameMasterSuggestions';
import { EngravedDivider, SceneMedallion } from './DndOrnaments';
import {
  AlertCircle,
  MessageCircle,
  Volume2,
  Square,
  Image as ImageIcon,
  Eye,
  Dices,
  X,
} from 'lucide-react';
import { creerRequeteIaController, useElapsedWait } from '../hooks/useElapsedWait';
import { AI_TIMEOUT_MS, formaterDureeAttente } from '../utils/aiTimeoutConfig';

export interface SceneIllustrationContext {
  lieuNom?: string;
  terrain?: string;
  biomeAzgaar?: string;
  meteo?: string;
  heure?: number;
  enCombat?: boolean;
  enDonjon?: boolean;
}

interface JournalEntryProps {
  evt: NarrativeEvent;
  estDernier: boolean;
  masquerSuggestions: boolean;
  jetEnAttente?: PendingRollRequest | null;
  sceneContext?: SceneIllustrationContext;
  chargement: boolean;
  onExecuterAction: (action: ActionRequest) => void;
}

const LIBELLES_TON: Record<string, string> = {
  CHAMPETRE: 'Champêtre',
  SOMBRE: 'Ombres',
  PERIL: 'Péril',
};

export const JournalEntry: React.FC<JournalEntryProps> = ({
  evt,
  estDernier,
  masquerSuggestions,
  jetEnAttente,
  sceneContext,
  chargement,
  onExecuterAction,
}) => {
  const [audioChargement, setAudioChargement] = useState(false);
  const [audioLecture, setAudioLecture] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [mediaErreur, setMediaErreur] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [svgChargement, setSvgChargement] = useState(false);
  const [svgMarkup, setSvgMarkup] = useState<string | null>(null);
  const [svgVisible, setSvgVisible] = useState(false);

  const [coulissesOuvertes, setCoulissesOuvertes] = useState(false);
  const audioControllerRef = useRef<ReturnType<typeof creerRequeteIaController> | null>(null);
  const svgControllerRef = useRef<ReturnType<typeof creerRequeteIaController> | null>(null);

  const audioElapsedMs = useElapsedWait(audioChargement);
  const svgElapsedMs = useElapsedWait(svgChargement);

  useEffect(() => {
    return () => {
      audioControllerRef.current?.abort();
      svgControllerRef.current?.abort();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const segments = parserSegmentsRecit(evt.texteNarratif);
  const ton = evt.tonAmbiance || 'NEUTRE';
  const tonLabel = LIBELLES_TON[ton];
  const premierIndexProse = segments.findIndex(s => s.type === 'prose');

  const handleToggleAudio = async () => {
    setMediaErreur(null);
    if (audioChargement && audioControllerRef.current) {
      audioControllerRef.current.abort();
      return;
    }
    if (audioLecture && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setAudioLecture(false);
      return;
    }

    const reqCtrl = creerRequeteIaController(undefined, AI_TIMEOUT_MS + 10_000);
    audioControllerRef.current = reqCtrl;

    try {
      let url = audioUrl;
      if (!url) {
        setAudioChargement(true);
        const res = await fetch('/api/narration/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: reqCtrl.signal,
          body: JSON.stringify({
            sceneId: String(evt._seq),
            titre: evt.titre,
            texte: evt.texteNarratif,
            tonAmbiance: evt.tonAmbiance,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.succes || !data.audioDataUrl) {
          throw new Error(data.erreur || 'Audio indisponible.');
        }
        url = data.audioDataUrl as string;
        setAudioUrl(url);
      }

      if (audioRef.current) {
        audioRef.current.pause();
      }
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => setAudioLecture(false);
      audio.onerror = () => {
        setAudioLecture(false);
        setMediaErreur('Lecture audio impossible.');
      };
      await audio.play();
      setAudioLecture(true);
    } catch (err: any) {
      if (reqCtrl.estAnnule() || err?.name === 'AbortError') {
        setMediaErreur('Génération audio annulée.');
      } else if (reqCtrl.estExpire()) {
        setMediaErreur('La lecture vocale IA a dépassé le délai maximal de 15 minutes.');
      } else {
        setMediaErreur(err?.message || 'Audio indisponible.');
      }
      setAudioLecture(false);
    } finally {
      reqCtrl.cleanup();
      if (audioControllerRef.current === reqCtrl) {
        audioControllerRef.current = null;
      }
      setAudioChargement(false);
    }
  };

  const handleToggleIllustration = async () => {
    setMediaErreur(null);
    if (svgChargement && svgControllerRef.current) {
      svgControllerRef.current.abort();
      return;
    }
    if (svgMarkup) {
      setSvgVisible(prev => !prev);
      return;
    }

    const reqCtrl = creerRequeteIaController(undefined, AI_TIMEOUT_MS + 10_000);
    svgControllerRef.current = reqCtrl;

    try {
      setSvgChargement(true);
      const res = await fetch('/api/narration/illustrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: reqCtrl.signal,
        body: JSON.stringify({
          sceneId: String(evt._seq),
          titre: evt.titre,
          texte: evt.texteNarratif,
          tonAmbiance: evt.tonAmbiance,
          ...(estDernier && sceneContext ? sceneContext : {}),
        }),
      });
      const data = await res.json();
      const svgOut = data.svgMarkup || data.svg;
      if (!res.ok || !data.succes || !svgOut) {
        throw new Error(data.erreur || 'Illustration indisponible.');
      }
      setSvgMarkup(svgOut);
      setSvgVisible(true);
    } catch (err: any) {
      if (reqCtrl.estAnnule() || err?.name === 'AbortError') {
        setMediaErreur('Illustration annulée.');
      } else if (reqCtrl.estExpire()) {
        setMediaErreur('L\'illustration IA a dépassé le délai maximal de 15 minutes.');
      } else {
        setMediaErreur(err?.message || 'Illustration indisponible.');
      }
    } finally {
      reqCtrl.cleanup();
      if (svgControllerRef.current === reqCtrl) {
        svgControllerRef.current = null;
      }
      setSvgChargement(false);
    }
  };

  const surfaceConteneur = estDernier
    ? ton === 'PERIL'
      ? 'bg-[#fcf2ef]/90 border border-rose-800/35 rounded-lg p-5 shadow-xs'
      : ton === 'SOMBRE'
      ? 'bg-[#f4efe4]/95 border border-[#a89474] rounded-lg p-5 shadow-xs'
      : 'bg-[#fffdf6]/90 border border-[#c3a56b] rounded-lg p-5 shadow-xs'
    : 'pb-2';

  const styleDialogue =
    ton === 'PERIL'
      ? 'bg-rose-950/[0.04] border-rose-800/25'
      : ton === 'SOMBRE'
      ? 'bg-stone-900/[0.04] border-stone-500/30'
      : 'bg-[#f3e8ce]/65 border-[#c7ab75]';

  const tonCouleurTexte =
    ton === 'PERIL'
      ? 'text-rose-800'
      : ton === 'SOMBRE'
      ? 'text-[#5b4d3e]'
      : ton === 'CHAMPETRE'
      ? 'text-[#8c5a18]'
      : 'text-[#745e47]';

  const rollActif = estDernier && !masquerSuggestions ? jetEnAttente : undefined;

  return (
    <div className="space-y-4">
      <article className={`space-y-3 ${surfaceConteneur}`}>
        {/* En-tête de scène */}
        <header className="space-y-1.5">
          <div className="flex items-center justify-between gap-2 text-[11px] text-[#78624a]">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-mono tabular-nums">{evt.horodatageDate}</span>
              {tonLabel && (
                <>
                  <span aria-hidden="true" className="text-[#c5b089]">·</span>
                  <span className={`font-medium ${tonCouleurTexte}`}>{tonLabel}</span>
                </>
              )}
            </div>
            {evt.actionJoueur && (
              <span className="text-[#8a7359] truncate max-w-[55%]" title={evt.actionJoueur}>
                {evt.actionJoueur}
              </span>
            )}
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <SceneMedallion ton={ton} />
              <h3 className="font-display text-[17px] font-semibold tracking-wide text-[#2a1d13] leading-snug text-balance">
                {evt.titre}
              </h3>
            </div>

            <div className="flex items-center gap-1 shrink-0 text-[10px]">
              <button
                type="button"
                onClick={handleToggleAudio}
                title={audioChargement ? 'Annuler la génération audio' : undefined}
                className="px-2 py-1 rounded border border-[#ccb68a] bg-[#f7efdc] hover:bg-[#efe1c2] text-[#4a3723] flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
              >
                {audioChargement ? (
                  <X className="w-3 h-3" />
                ) : audioLecture ? (
                  <Square className="w-3 h-3" />
                ) : (
                  <Volume2 className="w-3 h-3" />
                )}
                <span className={audioChargement ? 'font-mono tabular-nums' : undefined}>
                  {audioChargement
                    ? `Annuler · ${formaterDureeAttente(audioElapsedMs)}`
                    : audioLecture
                    ? 'Stop'
                    : 'Écouter'}
                </span>
              </button>

              <button
                type="button"
                onClick={handleToggleIllustration}
                title={svgChargement ? 'Annuler l’illustration' : undefined}
                className="px-2 py-1 rounded border border-[#ccb68a] bg-[#f7efdc] hover:bg-[#efe1c2] text-[#4a3723] flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
              >
                {svgChargement ? <X className="w-3 h-3" /> : <ImageIcon className="w-3 h-3" />}
                <span className={svgChargement ? 'font-mono tabular-nums' : undefined}>
                  {svgChargement
                    ? `Annuler · ${formaterDureeAttente(svgElapsedMs)}`
                    : svgVisible
                    ? 'Masquer'
                    : 'Illustrer'}
                </span>
              </button>

              {evt.trace && (
                <button
                  type="button"
                  onClick={() => setCoulissesOuvertes(prev => !prev)}
                  className={`px-2 py-1 rounded border flex items-center gap-1 cursor-pointer ${
                    coulissesOuvertes
                      ? 'bg-[#3b2b1d] border-[#3b2b1d] text-[#f5ebd6]'
                      : 'border-[#ccb68a] bg-[#f7efdc] hover:bg-[#efe1c2] text-[#4a3723]'
                  }`}
                >
                  <Eye className="w-3 h-3" />
                  <span>Coulisses</span>
                </button>
              )}
            </div>
          </div>
        </header>

        {mediaErreur && (
          <div className="text-[11px] text-rose-800 bg-rose-50 border border-rose-200 rounded px-2.5 py-1">
            {mediaErreur}
          </div>
        )}

        {/* Illustration 16:9 en ligne */}
        {svgVisible && svgMarkup && (
          <div
            className="rounded-md overflow-hidden border border-[#b48a3e] bg-[#1b140f] [&>svg]:w-full [&>svg]:h-auto [&>svg]:block"
            dangerouslySetInnerHTML={{ __html: svgMarkup }}
          />
        )}

        {/* Corps narratif */}
        <div className="space-y-3">
          {segments.map((seg, i) => {
            if (seg.type === 'dialogue') {
              return (
                <div
                  key={i}
                  className={`border rounded-md px-3.5 py-2.5 space-y-0.5 ${styleDialogue}`}
                >
                  {seg.locuteur && (
                    <div className="flex items-center gap-1.5 font-display text-[11px] font-semibold tracking-wide text-[#5c3d19]">
                      <MessageCircle className="w-3 h-3 text-[#9c6f21] shrink-0" />
                      <span>{seg.locuteur}</span>
                    </div>
                  )}
                  <p className="font-journal italic text-[15px] leading-[1.65] text-[#241911]">
                    « {seg.replique} »
                  </p>
                </div>
              );
            }

            const appliquerLettrine = i === premierIndexProse && seg.texte.length > 24;
            return (
              <p
                key={i}
                className={`font-journal text-[15px] leading-[1.72] text-[#2a2018] ${
                  appliquerLettrine ? 'dnd-dropcap' : ''
                }`}
              >
                {seg.texte}
              </p>
            );
          })}
        </div>

        {/* Événement de faction hors-champ */}
        {evt.evenementFaction && (
          <div className="bg-[#f6ead0]/80 border border-[#c8a86b] px-3 py-2 rounded-md flex items-start gap-2 text-xs text-[#4b3314]">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 text-[#9c6f21] mt-0.5" />
            <div>
              <span className="font-semibold">{evt.evenementFaction.factionNom} : </span>
              <span>{evt.evenementFaction.impact}</span>
            </div>
          </div>
        )}

        {/* Rencontre PNJ entrant dans le champ de vision */}
        {evt.pnjApproche && (
          <div className="bg-sky-950/[0.04] border border-sky-800/25 px-3 py-2 rounded-md flex items-start gap-2 text-xs text-sky-950">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 text-sky-800 mt-0.5" />
            <div>
              <span className="font-semibold">
                {evt.pnjApproche.nom} ({evt.pnjApproche.role}) :{' '}
              </span>
              <span>{evt.pnjApproche.motif}</span>
            </div>
          </div>
        )}

        {/* Jet demandé par le MJ */}
        {rollActif && (
          <div className="bg-amber-50/90 border border-amber-500/50 rounded-md p-3 space-y-2 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 font-semibold text-[#3a250d]">
                <Dices className="w-4 h-4 text-amber-800 shrink-0" />
                <span>{rollActif.titre}</span>
              </div>
              <span className="font-mono text-[11px] text-amber-900">
                {rollActif.competence || rollActif.caracteristique} · DD {rollActif.dd}
              </span>
            </div>

            {rollActif.contexte && (
              <div className="text-[11px] text-[#4a3723]">{rollActif.contexte}</div>
            )}

            <div className="text-[11px] text-[#5c4428] space-y-0.5">
              <div>Succès : {rollActif.enjeuSucces}</div>
              <div>Échec : {rollActif.enjeuEchec}</div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                disabled={chargement}
                onClick={() =>
                  onExecuterAction({
                    type: 'RESOUDRE_JET_DEMANDE',
                    payloadAction: { jetId: rollActif.id, choix: 'lancer' },
                  })
                }
                className="px-3 py-1.5 dnd-wood-bar border rounded font-medium flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Dices className="w-3.5 h-3.5 text-[#e5be6e]" />
                <span>Lancer d20</span>
              </button>

              {rollActif.optionAlternative && (
                <button
                  type="button"
                  disabled={chargement}
                  onClick={() =>
                    onExecuterAction({
                      type: 'RESOUDRE_JET_DEMANDE',
                      payloadAction: { jetId: rollActif.id, choix: 'alternatif' },
                    })
                  }
                  className="px-2.5 py-1.5 bg-white hover:bg-stone-100 border border-[#bfa574] rounded text-[#3b2c1e] cursor-pointer disabled:opacity-50"
                >
                  {rollActif.optionAlternative}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Résumé mécanique discret, dépliable au clic */}
        {evt.adjudication && <DiceResultToggle adjudication={evt.adjudication} />}

        {/* Coulisses du MJ en ligne */}
        {coulissesOuvertes && evt.trace && (
          <div className="bg-[#f2e9d5]/90 border border-[#c7b084] rounded-md p-3 text-[11px] text-[#3a2c1e] space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[10px] text-[#6d5742]">
              <span>
                {evt.trace.modeleIa}
                {evt.trace.niveauReflexion ? ` · ${evt.trace.niveauReflexion}` : ''}
                {evt.trace.latenceMs ? ` · ${evt.trace.latenceMs} ms` : ''}
              </span>
              {evt.trace.rapportCoherence && (
                <span className="font-semibold">
                  Cohérence : {evt.trace.rapportCoherence.statut}
                </span>
              )}
            </div>

            {evt.trace.motifReflexion && (
              <div className="text-[#4d3b29]">Motif : {evt.trace.motifReflexion}</div>
            )}

            {evt.trace.appelsOutils && evt.trace.appelsOutils.length > 0 && (
              <div className="space-y-0.5">
                <div className="font-semibold text-[10px] text-[#5c4734]">Outils ({evt.trace.appelsOutils.length}) :</div>
                {evt.trace.appelsOutils.map((a, idx) => (
                  <div key={idx} className="font-mono text-[10px] text-[#4d3b29]">
                    {a.nom} → {a.resultat}
                  </div>
                ))}
              </div>
            )}

            {evt.trace.notesSecretesTour && evt.trace.notesSecretesTour.length > 0 && (
              <div className="space-y-0.5">
                <div className="font-semibold text-[10px] text-[#5c4734]">Notes secrètes :</div>
                {evt.trace.notesSecretesTour.map((n, idx) => (
                  <div key={idx} className="text-[10px] text-[#4d3b29]">• {n}</div>
                ))}
              </div>
            )}

            {evt.trace.rapportCoherence &&
              (evt.trace.rapportCoherence.anomalies.length > 0 ||
                evt.trace.rapportCoherence.corrections.length > 0) && (
                <div className="space-y-0.5 text-[10px] text-amber-900">
                  {evt.trace.rapportCoherence.corrections.map((c, idx) => (
                    <div key={`c-${idx}`}>Corrigé : {c}</div>
                  ))}
                  {evt.trace.rapportCoherence.anomalies.map((a, idx) => (
                    <div key={`a-${idx}`}>Note : {a}</div>
                  ))}
                </div>
              )}
          </div>
        )}

        {/* Pistes d'action */}
        {estDernier && !masquerSuggestions && !rollActif && evt.suggestionsMJ && evt.suggestionsMJ.length > 0 && (
          <GameMasterSuggestions
            suggestions={evt.suggestionsMJ}
            tonAmbiance={evt.tonAmbiance}
            chargement={chargement}
            onExecuterAction={onExecuterAction}
            onSelectTexte={sug => onExecuterAction({ type: 'ACTION_LIBRE', texteLibre: sug })}
          />
        )}
      </article>

      {!estDernier && <EngravedDivider />}
    </div>
  );
};
