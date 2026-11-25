import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AzgaarClimateBias,
  AzgaarStylePreset,
  AzgaarTemplateId,
  SimulationState,
  WorldForgeConfig,
  WorldForgeDraft,
  WorldForgeStep,
  WorldNpcRecord,
} from '../types';
import {
  TONALITES_DISPONIBLES,
  promouvoirPnjDeterministe,
} from '../engine/worldLoreAndNpcs';
import { AzgaarStudioView } from './AzgaarStudioView';
import { useElapsedWait } from '../hooks/useElapsedWait';
import { formaterDureeAttente } from '../utils/aiTimeoutConfig';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Dices,
  Eye,
  EyeOff,
  Globe,
  ScrollText,
  Sparkles,
  Users,
  Wand2,
  X,
} from 'lucide-react';

interface WorldForgeWizardProps {
  etat: SimulationState;
  chargement: boolean;
  onInitialiserForge: (config?: Partial<WorldForgeConfig>) => Promise<WorldForgeDraft>;
  onExecuterEtape: (
    draft: WorldForgeDraft,
    step: WorldForgeStep,
    opts?: { regenererGeometrie?: boolean; signal?: AbortSignal }
  ) => Promise<{ draft: WorldForgeDraft; source: 'GEMINI' | 'PROCEDURAL'; note?: string }>;
  onAppliquerMonde: (draft: WorldForgeDraft) => Promise<void>;
  onFermer: () => void;
}

const ETAPES: Array<{ step: WorldForgeStep; numero: string; label: string; desc: string }> = [
  { step: 1, numero: '01', label: 'Cartographie', desc: 'Relief, climat, bassins & grille' },
  { step: 2, numero: '02', label: 'Peuples & États', desc: 'Royaumes, cultures, cultes & bourgs' },
  { step: 3, numero: '03', label: 'Histoire & Lore', desc: 'Genèse, ères, légendes & arcs MJ' },
  { step: 4, numero: '04', label: 'PNJ & Proximité', desc: 'Figures majeures, liens & voisinage' },
];

const TEMPLATES: Array<{ id: AzgaarTemplateId; label: string }> = [
  { id: 'continent', label: 'Continent' },
  { id: 'archipel', label: 'Archipel' },
  { id: 'peninsule', label: 'Péninsule' },
  { id: 'mediterranee', label: 'Mer intérieure' },
  { id: 'detroit', label: 'Détroit' },
  { id: 'volcan', label: 'Île volcanique' },
  { id: 'haute_chaine', label: 'Haute chaîne' },
];

const CLIMATS: Array<{ id: AzgaarClimateBias; label: string }> = [
  { id: 'tempere', label: 'Tempéré' },
  { id: 'boreal', label: 'Boréal' },
  { id: 'aride', label: 'Aride' },
];

const STYLES: Array<{ id: AzgaarStylePreset; label: string }> = [
  { id: 'parchemin', label: 'Parchemin' },
  { id: 'classique', label: 'Classique' },
  { id: 'politique', label: 'Politique' },
  { id: 'relief', label: 'Relief' },
  { id: 'sombre', label: 'Sombre' },
];

const TIER_LABELS: Record<WorldNpcRecord['tier'], string> = {
  MAJEUR_MONDE: 'Figure du monde',
  LIEN_HEROS: 'Lien du héros',
  PROCHE_PREGEN: 'Proche pré-généré',
  LAMBDA_LOINTAIN: 'Lambda lointain',
};

export const WorldForgeWizard: React.FC<WorldForgeWizardProps> = ({
  etat,
  chargement,
  onInitialiserForge,
  onExecuterEtape,
  onAppliquerMonde,
  onFermer,
}) => {
  const [draft, setDraft] = useState<WorldForgeDraft | null>(null);
  const [initEnCours, setInitEnCours] = useState(true);
  const [stepEnCours, setStepEnCours] = useState(false);
  const [erreurForge, setErreurForge] = useState<string | null>(null);
  const [noteEtape, setNoteEtape] = useState<string | null>(null);
  const [afficherSecretsMJ, setAfficherSecretsMJ] = useState(true);
  const [filtreTier, setFiltreTier] = useState<'TOUT' | WorldNpcRecord['tier']>('TOUT');
  const [selectedNpcId, setSelectedNpcId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const elapsedMs = useElapsedWait(stepEnCours);

  useEffect(() => {
    let mounted = true;
    setInitEnCours(true);
    setErreurForge(null);
    onInitialiserForge()
      .then(initial => {
        if (!mounted) return;
        setDraft(initial);
        setSelectedNpcId(initial.pnjs[0]?.id || null);
      })
      .catch(err => {
        if (!mounted) return;
        setErreurForge(err?.message || 'Initialisation de la forge impossible.');
      })
      .finally(() => {
        if (mounted) setInitEnCours(false);
      });
    return () => {
      mounted = false;
      abortRef.current?.abort();
    };
  }, [onInitialiserForge]);

  const previewState: SimulationState | null = useMemo(() => {
    if (!draft) return null;
    return {
      ...etat,
      azgaarStudio: draft.studio,
      factions: draft.factions,
      hexagones: draft.hexagones,
      hexActuel: draft.hexagones[0] || etat.hexActuel,
      loreMonde: draft.lore,
      pnjsMonde: draft.pnjs,
    };
  }, [draft, etat]);

  const updateConfig = <K extends keyof WorldForgeConfig>(key: K, val: WorldForgeConfig[K]) => {
    setDraft(prev => (prev ? { ...prev, config: { ...prev.config, [key]: val } } : prev));
  };

  const lancerEtape = async (
    step: WorldForgeStep,
    options?: { regenererGeometrie?: boolean; validerCourante?: boolean }
  ) => {
    if (!draft || stepEnCours) return;
    setErreurForge(null);
    setNoteEtape(null);

    const draftCourant: WorldForgeDraft = options?.validerCourante
      ? {
          ...draft,
          etapesValidees: { ...draft.etapesValidees, [draft.etapeCourante]: true },
        }
      : draft;

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setStepEnCours(true);
    try {
      const res = await onExecuterEtape(draftCourant, step, {
        regenererGeometrie: options?.regenererGeometrie,
        signal: ctrl.signal,
      });
      setDraft({
        ...res.draft,
        etapeCourante: step,
        etapesValidees: draftCourant.etapesValidees,
      });
      if (res.note) setNoteEtape(res.note);
      if (step === 4 && res.draft.pnjs.length > 0) {
        setSelectedNpcId(res.draft.pnjs[0].id);
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        setErreurForge(err?.message || 'Erreur lors de la génération de cette étape.');
      } else {
        setNoteEtape('Opération annulée — le brouillon précédent est conservé.');
      }
    } finally {
      abortRef.current = null;
      setStepEnCours(false);
    }
  };

  const validerEtAvancer = async (nextStep: WorldForgeStep) => {
    if (!draft) return;
    const dejaGenereeParIa = draft.sourceParEtape[nextStep] === 'GEMINI';
    if (dejaGenereeParIa) {
      setDraft(prev =>
        prev
          ? {
              ...prev,
              etapeCourante: nextStep,
              etapesValidees: { ...prev.etapesValidees, [prev.etapeCourante]: true },
            }
          : prev
      );
      return;
    }
    await lancerEtape(nextStep, { regenererGeometrie: false, validerCourante: true });
  };

  const updateNpcField = (npcId: string, patch: Partial<WorldNpcRecord>) => {
    setDraft(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        pnjs: prev.pnjs.map(p =>
          p.id === npcId ? { ...p, ...patch, generationSource: 'MANUEL' } : p
        ),
      };
    });
  };

  const promouvoirLambdaLocal = (npc: WorldNpcRecord) => {
    if (!draft) return;
    const promoted = promouvoirPnjDeterministe(npc, draft.studio, draft.lore, 'LOCAL');
    promoted.enrichmentPending = false;
    promoted.generationSource = 'MANUEL';
    setDraft(prev =>
      prev
        ? {
            ...prev,
            pnjs: prev.pnjs.map(p => (p.id === npc.id ? promoted : p)),
          }
        : prev
    );
  };

  if (initEnCours || !draft || !previewState) {
    return (
      <div className="dnd-panel rounded-lg p-6 text-xs text-[#231a14] space-y-2">
        <div className="flex items-center justify-between">
          <div className="font-display font-bold text-sm flex items-center gap-2">
            <Wand2 className="w-4 h-4 text-[#8c6422]" />
            <span>Forge progressive du monde</span>
          </div>
          <button
            type="button"
            onClick={onFermer}
            className="px-2.5 py-1 rounded border border-[#bfa574] bg-[#fffdf7] text-[11px] cursor-pointer"
          >
            Fermer
          </button>
        </div>
        {erreurForge ? (
          <div className="bg-rose-50 border border-rose-300 text-rose-900 p-3 rounded">
            {erreurForge}
          </div>
        ) : (
          <div className="text-[#5c4734]">Préparation de l’atelier cartographique et narratif...</div>
        )}
      </div>
    );
  }

  const pnjsFiltres = draft.pnjs.filter(p =>
    filtreTier === 'TOUT' ? true : p.tier === filtreTier
  );
  const npcActif =
    pnjsFiltres.find(p => p.id === selectedNpcId) || pnjsFiltres[0] || draft.pnjs[0];

  return (
    <div
      className="dnd-parchment-sheet border border-[#b48a3e] rounded-lg overflow-hidden text-xs text-[#231a14] shadow-md"
      data-testid="world-forge-wizard"
    >
      {/* En-tête de la forge */}
      <div className="dnd-wood-header px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="font-display font-bold text-sm text-[#f8f0dc] flex items-center gap-2">
            <Wand2 className="w-4 h-4 text-[#e5be6e]" />
            <span>Forge progressive du monde · {draft.studio.worldName}</span>
          </div>
          <div className="text-[11px] text-[#d9c7a3] font-mono tabular-nums">
            Graine #{draft.config.seed} · {draft.studio.states.length} États ·{' '}
            {draft.studio.burgs.length} bourgs · {draft.pnjs.length} PNJ
          </div>
        </div>

        <button
          type="button"
          disabled={stepEnCours || chargement}
          onClick={onFermer}
          className="px-2.5 py-1 rounded border border-[#9b773c] bg-[#21170f] hover:bg-[#3a2819] text-[#f4ead2] text-[11px] flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40"
        >
          <X className="w-3.5 h-3.5" />
          <span>Fermer la forge</span>
        </button>
      </div>

      {/* Barre de progression en 4 paliers */}
      <div className="grid grid-cols-2 lg:grid-cols-4 border-b border-[#cfb88c] bg-[#efe5cb]">
        {ETAPES.map(item => {
          const actif = draft.etapeCourante === item.step;
          const valide = draft.etapesValidees[item.step];
          const src = draft.sourceParEtape[item.step];
          return (
            <button
              key={item.step}
              type="button"
              disabled={stepEnCours}
              onClick={() => setDraft(prev => (prev ? { ...prev, etapeCourante: item.step } : prev))}
              className={`text-left px-3.5 py-2.5 border-r last:border-r-0 border-[#d6c298] transition-colors cursor-pointer disabled:opacity-60 ${
                actif
                  ? 'bg-[#fbf5e6] text-[#231a14]'
                  : 'text-[#5c4734] hover:bg-[#f5edd8]'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[10px] font-bold text-[#8c6422]">
                  {item.numero} · {item.label}
                </span>
                <span className="text-[10px] font-mono text-[#6d5742] flex items-center gap-1 shrink-0">
                  {src && <span>{src === 'GEMINI' ? 'IA' : 'Proc.'}</span>}
                  {valide && <Check className="w-3 h-3 text-emerald-700" />}
                </span>
              </div>
              <div className="text-[10px] text-[#6d5742] truncate mt-0.5">{item.desc}</div>
            </button>
          );
        })}
      </div>

      {/* Statut en cours / erreur / note */}
      {(stepEnCours || erreurForge || noteEtape) && (
        <div className="px-4 py-2 border-b border-[#d6c298] bg-[#f7eed8] flex flex-wrap items-center justify-between gap-2 text-[11px]">
          {stepEnCours ? (
            <>
              <div className="flex items-center gap-2 font-medium text-[#2a1d13]">
                <Sparkles className="w-3.5 h-3.5 text-[#9c6f21]" />
                <span>Élaboration de l’étape {draft.etapeCourante} en cours...</span>
                <span className="font-mono tabular-nums text-[#6d5742]">
                  {formaterDureeAttente(elapsedMs)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => abortRef.current?.abort()}
                className="px-2.5 py-1 rounded border border-[#b48a3e] bg-white hover:bg-[#efe0bd] text-[#3a2817] text-[11px] font-medium whitespace-nowrap shrink-0 cursor-pointer"
              >
                Annuler
              </button>
            </>
          ) : erreurForge ? (
            <div className="text-rose-900 font-medium">{erreurForge}</div>
          ) : (
            <div className="text-[#463626]">{noteEtape}</div>
          )}
        </div>
      )}

      {/* Corps en 2 colonnes */}
      <div className="p-4">
        {draft.etapeCourante === 1 && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            <div className="lg:col-span-5 bg-[#f5edd8] border border-[#cfb88c] rounded-lg p-3.5 space-y-3">
              <div className="font-display font-bold text-sm text-[#2a1d13] flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-[#8c6422]" />
                <span>1. Socle cartographique &amp; physique</span>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <label className="space-y-1 col-span-2">
                  <span className="block text-[10px] text-[#6d5742] font-semibold">Nom du monde</span>
                  <input
                    type="text"
                    value={draft.config.worldName}
                    onChange={e => {
                      const val = e.target.value;
                      setDraft(prev =>
                        prev
                          ? {
                              ...prev,
                              config: { ...prev.config, worldName: val },
                              studio: { ...prev.studio, worldName: val },
                            }
                          : prev
                      );
                    }}
                    className="w-full bg-[#fffdf7] border border-[#bfa574] rounded px-2.5 py-1 text-xs"
                  />
                </label>

                <label className="space-y-1">
                  <span className="block text-[10px] text-[#6d5742] font-semibold">Graine</span>
                  <div className="flex gap-1">
                    <input
                      type="number"
                      min={1}
                      value={draft.config.seed}
                      onChange={e => updateConfig('seed', Math.max(1, Number(e.target.value) || 1))}
                      className="w-full bg-[#fffdf7] border border-[#bfa574] rounded px-2 py-1 font-mono text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => updateConfig('seed', Math.floor(Math.random() * 899999) + 100000)}
                      title="Nouvelle graine"
                      className="px-2 py-1 bg-[#fffdf7] hover:bg-[#efe4ca] border border-[#bfa574] rounded cursor-pointer"
                    >
                      <Dices className="w-3.5 h-3.5 text-[#6d5332]" />
                    </button>
                  </div>
                </label>

                <label className="space-y-1">
                  <span className="block text-[10px] text-[#6d5742] font-semibold">Gabarit relief</span>
                  <select
                    value={draft.config.template}
                    onChange={e => updateConfig('template', e.target.value as AzgaarTemplateId)}
                    className="w-full bg-[#fffdf7] border border-[#bfa574] rounded px-2 py-1 text-xs"
                  >
                    {TEMPLATES.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="block text-[10px] text-[#6d5742] font-semibold">Climat</span>
                  <select
                    value={draft.config.climateBias}
                    onChange={e => updateConfig('climateBias', e.target.value as AzgaarClimateBias)}
                    className="w-full bg-[#fffdf7] border border-[#bfa574] rounded px-2 py-1 text-xs"
                  >
                    {CLIMATS.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="block text-[10px] text-[#6d5742] font-semibold">Rendu</span>
                  <select
                    value={draft.config.stylePreset}
                    onChange={e => {
                      const preset = e.target.value as AzgaarStylePreset;
                      setDraft(prev =>
                        prev
                          ? {
                              ...prev,
                              config: { ...prev.config, stylePreset: preset },
                              studio: { ...prev.studio, stylePreset: preset },
                            }
                          : prev
                      );
                    }}
                    className="w-full bg-[#fffdf7] border border-[#bfa574] rounded px-2 py-1 text-xs"
                  >
                    {STYLES.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="block text-[10px] text-[#6d5742] font-semibold">Résolution Voronoï</span>
                  <select
                    value={draft.config.cellsDesired}
                    onChange={e => updateConfig('cellsDesired', Number(e.target.value) as 800 | 1500 | 2400)}
                    className="w-full bg-[#fffdf7] border border-[#bfa574] rounded px-2 py-1 text-xs"
                  >
                    <option value={800}>800 cellules (rapide)</option>
                    <option value={1500}>1500 cellules (standard)</option>
                    <option value={2400}>2400 cellules (fin)</option>
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="block text-[10px] text-[#6d5742] font-semibold">Échelle tactique</span>
                  <select
                    value={draft.config.rayonAnneaux}
                    onChange={e => updateConfig('rayonAnneaux', Number(e.target.value))}
                    className="w-full bg-[#fffdf7] border border-[#bfa574] rounded px-2 py-1 text-xs"
                  >
                    <option value={2}>19 hexagones (2 anneaux)</option>
                    <option value={3}>37 hexagones (3 anneaux)</option>
                    <option value={4}>61 hexagones (4 anneaux)</option>
                  </select>
                </label>
              </div>

              <label className="flex items-center gap-2 text-[11px] text-[#463626] cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.config.conserverHeros}
                  onChange={e => updateConfig('conserverHeros', e.target.checked)}
                  className="accent-[#8c6422]"
                />
                <span>Conserver le personnage joueur actuel ({etat.personnage.nom})</span>
              </label>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#d6c298]">
                <button
                  type="button"
                  disabled={stepEnCours}
                  onClick={() => lancerEtape(1, { regenererGeometrie: true })}
                  className="px-3 py-1.5 rounded border border-[#b89f72] bg-[#fffdf7] hover:bg-[#efe4ca] text-[11px] font-medium whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40"
                >
                  Recalculer le relief
                </button>
                <button
                  type="button"
                  disabled={stepEnCours}
                  onClick={() => validerEtAvancer(2)}
                  className="px-3.5 py-1.5 dnd-wood-bar border rounded text-[11px] font-medium flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40"
                >
                  <span>Valider &amp; Peuples</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="lg:col-span-7 space-y-2">
              <AzgaarStudioView
                etat={previewState}
                mode="atelier"
                chargement={stepEnCours}
                onSyncAzgaar={studio =>
                  setDraft(prev => (prev ? { ...prev, studio } : prev))
                }
              />
            </div>
          </div>
        )}

        {draft.etapeCourante === 2 && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            <div className="lg:col-span-5 bg-[#f5edd8] border border-[#cfb88c] rounded-lg p-3.5 space-y-3">
              <div className="font-display font-bold text-sm text-[#2a1d13] flex items-center gap-1.5">
                <Users className="w-4 h-4 text-[#8c6422]" />
                <span>2. Peuples, États &amp; Cultes</span>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <label className="space-y-1">
                  <span className="block text-[10px] text-[#6d5742] font-semibold">États ({draft.config.statesCount})</span>
                  <input
                    type="number"
                    min={2}
                    max={7}
                    value={draft.config.statesCount}
                    onChange={e => updateConfig('statesCount', Math.max(2, Math.min(7, Number(e.target.value) || 4)))}
                    className="w-full bg-[#fffdf7] border border-[#bfa574] rounded px-2 py-1 font-mono text-xs"
                  />
                </label>
                <label className="space-y-1">
                  <span className="block text-[10px] text-[#6d5742] font-semibold">Cultures ({draft.config.culturesCount})</span>
                  <input
                    type="number"
                    min={2}
                    max={6}
                    value={draft.config.culturesCount}
                    onChange={e => updateConfig('culturesCount', Math.max(2, Math.min(6, Number(e.target.value) || 4)))}
                    className="w-full bg-[#fffdf7] border border-[#bfa574] rounded px-2 py-1 font-mono text-xs"
                  />
                </label>
                <label className="space-y-1">
                  <span className="block text-[10px] text-[#6d5742] font-semibold">Religions ({draft.config.religionsCount})</span>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={draft.config.religionsCount}
                    onChange={e => updateConfig('religionsCount', Math.max(1, Math.min(5, Number(e.target.value) || 3)))}
                    className="w-full bg-[#fffdf7] border border-[#bfa574] rounded px-2 py-1 font-mono text-xs"
                  />
                </label>
                <label className="space-y-1">
                  <span className="block text-[10px] text-[#6d5742] font-semibold">Bourgs ({draft.config.burgsCount})</span>
                  <input
                    type="number"
                    min={8}
                    max={34}
                    value={draft.config.burgsCount}
                    onChange={e => updateConfig('burgsCount', Math.max(8, Math.min(34, Number(e.target.value) || 18)))}
                    className="w-full bg-[#fffdf7] border border-[#bfa574] rounded px-2 py-1 font-mono text-xs"
                  />
                </label>
              </div>

              <label className="block space-y-1">
                <span className="block text-[10px] text-[#6d5742] font-semibold">Tonalité de la campagne</span>
                <select
                  value={draft.config.tonalite}
                  onChange={e => updateConfig('tonalite', e.target.value)}
                  className="w-full bg-[#fffdf7] border border-[#bfa574] rounded px-2 py-1 text-xs"
                >
                  {TONALITES_DISPONIBLES.map(t => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1">
                <span className="block text-[10px] text-[#6d5742] font-semibold">
                  Directive créative pour l’IA (optionnel)
                </span>
                <textarea
                  rows={3}
                  value={draft.config.customPrompt}
                  onChange={e => updateConfig('customPrompt', e.target.value)}
                  placeholder="Ex. : Marches minières disputées par deux guildes rivales, peu de magie ouverte, hiver précoce..."
                  className="w-full bg-[#fffdf7] border border-[#bfa574] rounded px-2.5 py-1.5 text-xs resize-none"
                />
              </label>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#d6c298]">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={stepEnCours}
                    onClick={() => lancerEtape(2, { regenererGeometrie: true })}
                    className="px-2.5 py-1.5 rounded border border-[#b89f72] bg-[#fffdf7] hover:bg-[#efe4ca] text-[11px] whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40"
                  >
                    Rebâtir frontières
                  </button>
                  <button
                    type="button"
                    disabled={stepEnCours}
                    onClick={() => lancerEtape(2, { regenererGeometrie: false })}
                    className="px-2.5 py-1.5 rounded border border-[#b48a3e] bg-[#efe5cb] hover:bg-[#e7d8b5] text-[11px] font-medium flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40"
                  >
                    <Sparkles className="w-3 h-3 text-[#8c6422]" />
                    <span>Enrichir IA</span>
                  </button>
                </div>

                <button
                  type="button"
                  disabled={stepEnCours}
                  onClick={() => validerEtAvancer(3)}
                  className="px-3.5 py-1.5 dnd-wood-bar border rounded text-[11px] font-medium flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40"
                >
                  <span>Valider &amp; Lore</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="lg:col-span-7 space-y-3 max-h-[540px] overflow-y-auto pr-1">
              <div className="bg-[#f5edd8] border border-[#cfb88c] rounded-lg p-3 space-y-2">
                <div className="font-semibold text-[#2a1d13]">États &amp; Régimes ({draft.studio.states.length})</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {draft.studio.states.map(st => (
                    <div key={st.id} className="bg-[#fffdf7] border border-[#d6c298] rounded p-2 space-y-1">
                      <input
                        type="text"
                        value={st.name}
                        onChange={e => {
                          const val = e.target.value;
                          setDraft(prev =>
                            prev
                              ? {
                                  ...prev,
                                  studio: {
                                    ...prev.studio,
                                    states: prev.studio.states.map(s =>
                                      s.id === st.id ? { ...s, name: val } : s
                                    ),
                                  },
                                  factions: prev.factions.map(f =>
                                    f.id === st.factionId ? { ...f, nom: val } : f
                                  ),
                                }
                              : prev
                          );
                        }}
                        className="w-full font-semibold bg-transparent border-b border-[#e4d5b4] pb-0.5 text-xs focus:outline-none focus:border-[#8c6422]"
                      />
                      <input
                        type="text"
                        value={st.government}
                        onChange={e => {
                          const val = e.target.value;
                          setDraft(prev =>
                            prev
                              ? {
                                  ...prev,
                                  studio: {
                                    ...prev.studio,
                                    states: prev.studio.states.map(s =>
                                      s.id === st.id ? { ...s, government: val } : s
                                    ),
                                  },
                                }
                              : prev
                          );
                        }}
                        className="w-full text-[11px] text-[#5c4734] bg-transparent focus:outline-none"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-[#f5edd8] border border-[#cfb88c] rounded-lg p-3 space-y-2">
                  <div className="font-semibold text-[#2a1d13]">Cultures ({draft.studio.cultures.length})</div>
                  {draft.studio.cultures.map(cul => (
                    <div key={cul.id} className="flex items-center gap-2 bg-[#fffdf7] border border-[#d6c298] rounded px-2 py-1">
                      <span
                        className="w-2.5 h-2.5 rounded-xs shrink-0"
                        style={{ backgroundColor: cul.color }}
                      />
                      <input
                        type="text"
                        value={cul.name}
                        onChange={e => {
                          const val = e.target.value;
                          setDraft(prev =>
                            prev
                              ? {
                                  ...prev,
                                  studio: {
                                    ...prev.studio,
                                    cultures: prev.studio.cultures.map(c =>
                                      c.id === cul.id ? { ...c, name: val } : c
                                    ),
                                  },
                                }
                              : prev
                          );
                        }}
                        className="w-full text-xs bg-transparent focus:outline-none"
                      />
                    </div>
                  ))}
                </div>

                <div className="bg-[#f5edd8] border border-[#cfb88c] rounded-lg p-3 space-y-2">
                  <div className="font-semibold text-[#2a1d13]">Cultes &amp; Déités ({draft.studio.religions.length})</div>
                  {draft.studio.religions.map(rel => (
                    <div key={rel.id} className="bg-[#fffdf7] border border-[#d6c298] rounded px-2 py-1.5 space-y-0.5">
                      <input
                        type="text"
                        value={rel.name}
                        onChange={e => {
                          const val = e.target.value;
                          setDraft(prev =>
                            prev
                              ? {
                                  ...prev,
                                  studio: {
                                    ...prev.studio,
                                    religions: prev.studio.religions.map(r =>
                                      r.id === rel.id ? { ...r, name: val } : r
                                    ),
                                  },
                                }
                              : prev
                          );
                        }}
                        className="w-full text-xs font-semibold bg-transparent focus:outline-none"
                      />
                      <input
                        type="text"
                        value={rel.deity}
                        onChange={e => {
                          const val = e.target.value;
                          setDraft(prev =>
                            prev
                              ? {
                                  ...prev,
                                  studio: {
                                    ...prev.studio,
                                    religions: prev.studio.religions.map(r =>
                                      r.id === rel.id ? { ...r, deity: val } : r
                                    ),
                                  },
                                }
                              : prev
                          );
                        }}
                        className="w-full text-[11px] text-[#5c4734] bg-transparent focus:outline-none"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-[#f5edd8] border border-[#cfb88c] rounded-lg p-3 space-y-2">
                <div className="font-semibold text-[#2a1d13]">Principaux bourgs (éditables)</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {draft.studio.burgs.slice(0, 10).map(b => (
                    <div key={b.id} className="bg-[#fffdf7] border border-[#d6c298] rounded px-2 py-1.5 space-y-0.5">
                      <input
                        type="text"
                        value={b.name}
                        onChange={e => {
                          const val = e.target.value;
                          setDraft(prev =>
                            prev
                              ? {
                                  ...prev,
                                  studio: {
                                    ...prev.studio,
                                    burgs: prev.studio.burgs.map(item =>
                                      item.id === b.id ? { ...item, name: val } : item
                                    ),
                                  },
                                }
                              : prev
                          );
                        }}
                        className="w-full text-xs font-semibold bg-transparent focus:outline-none"
                      />
                      <input
                        type="text"
                        value={b.specialisation || ''}
                        placeholder="Spécialisation locale"
                        onChange={e => {
                          const val = e.target.value;
                          setDraft(prev =>
                            prev
                              ? {
                                  ...prev,
                                  studio: {
                                    ...prev.studio,
                                    burgs: prev.studio.burgs.map(item =>
                                      item.id === b.id ? { ...item, specialisation: val } : item
                                    ),
                                  },
                                }
                              : prev
                          );
                        }}
                        className="w-full text-[10px] text-[#5c4734] bg-transparent focus:outline-none"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {draft.etapeCourante === 3 && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            <div className="lg:col-span-4 bg-[#f5edd8] border border-[#cfb88c] rounded-lg p-3.5 space-y-3">
              <div className="font-display font-bold text-sm text-[#2a1d13] flex items-center gap-1.5">
                <ScrollText className="w-4 h-4 text-[#8c6422]" />
                <span>3. Histoire, Religions &amp; Lore</span>
              </div>

              <p className="text-[11px] text-[#463626] leading-relaxed">
                Définissez la genèse, les grandes ères, l’histoire des États, les dogmes et les légendes régionales. Les secrets marqués MJ restent strictement cachés au joueur tant qu’il ne les découvre pas.
              </p>

              <button
                type="button"
                onClick={() => setAfficherSecretsMJ(v => !v)}
                className="w-full px-2.5 py-1.5 rounded border border-[#bfa574] bg-[#fffdf7] hover:bg-[#efe4ca] text-[11px] font-medium flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {afficherSecretsMJ ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{afficherSecretsMJ ? 'Masquer secrets MJ' : 'Afficher secrets MJ'}</span>
              </button>

              <div className="space-y-2 pt-2 border-t border-[#d6c298]">
                <button
                  type="button"
                  disabled={stepEnCours}
                  onClick={() => lancerEtape(3)}
                  className="w-full px-3 py-1.5 rounded border border-[#b48a3e] bg-[#efe5cb] hover:bg-[#e7d8b5] text-[11px] font-medium flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#8c6422]" />
                  <span>Réécrire le Lore (Gemini)</span>
                </button>

                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    disabled={stepEnCours}
                    onClick={() => setDraft(prev => (prev ? { ...prev, etapeCourante: 2 } : prev))}
                    className="px-2.5 py-1.5 rounded border border-[#bfa574] bg-[#fffdf7] text-[11px] flex items-center gap-1 cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Peuples</span>
                  </button>
                  <button
                    type="button"
                    disabled={stepEnCours}
                    onClick={() => validerEtAvancer(4)}
                    className="px-3.5 py-1.5 dnd-wood-bar border rounded text-[11px] font-medium flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40"
                  >
                    <span>Valider &amp; PNJ</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="lg:col-span-8 space-y-3 max-h-[560px] overflow-y-auto pr-1">
              <div className="bg-[#f5edd8] border border-[#cfb88c] rounded-lg p-3 space-y-1.5">
                <div className="font-semibold text-[#2a1d13]">Genèse &amp; situation actuelle</div>
                <textarea
                  rows={3}
                  value={draft.lore.genese}
                  onChange={e => {
                    const val = e.target.value;
                    setDraft(prev =>
                      prev
                        ? { ...prev, lore: { ...prev.lore, genese: val, generationSource: 'MANUEL' } }
                        : prev
                    );
                  }}
                  className="w-full bg-[#fffdf7] border border-[#d6c298] rounded p-2 text-xs font-journal leading-relaxed"
                />
              </div>

              <div className="bg-[#f5edd8] border border-[#cfb88c] rounded-lg p-3 space-y-2">
                <div className="font-semibold text-[#2a1d13]">Chronique des Ères</div>
                {draft.lore.chroniqueEres.map((era, idx) => (
                  <div key={era.id} className="bg-[#fffdf7] border border-[#d6c298] rounded p-2.5 space-y-1.5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={era.periode}
                        onChange={e => {
                          const val = e.target.value;
                          setDraft(prev =>
                            prev
                              ? {
                                  ...prev,
                                  lore: {
                                    ...prev.lore,
                                    chroniqueEres: prev.lore.chroniqueEres.map((it, i) =>
                                      i === idx ? { ...it, periode: val } : it
                                    ),
                                  },
                                }
                              : prev
                          );
                        }}
                        className="font-mono text-[11px] bg-[#f7eed8] border border-[#e4d5b4] rounded px-2 py-0.5"
                      />
                      <input
                        type="text"
                        value={era.titre}
                        onChange={e => {
                          const val = e.target.value;
                          setDraft(prev =>
                            prev
                              ? {
                                  ...prev,
                                  lore: {
                                    ...prev.lore,
                                    chroniqueEres: prev.lore.chroniqueEres.map((it, i) =>
                                      i === idx ? { ...it, titre: val } : it
                                    ),
                                  },
                                }
                              : prev
                          );
                        }}
                        className="font-semibold text-xs bg-[#f7eed8] border border-[#e4d5b4] rounded px-2 py-0.5"
                      />
                    </div>
                    <textarea
                      rows={2}
                      value={era.resume}
                      onChange={e => {
                        const val = e.target.value;
                        setDraft(prev =>
                          prev
                            ? {
                                ...prev,
                                lore: {
                                  ...prev.lore,
                                  chroniqueEres: prev.lore.chroniqueEres.map((it, i) =>
                                    i === idx ? { ...it, resume: val } : it
                                  ),
                                },
                              }
                            : prev
                        );
                      }}
                      className="w-full text-[11px] bg-white border border-[#e4d5b4] rounded p-1.5"
                    />
                  </div>
                ))}
              </div>

              <div className="bg-[#f5edd8] border border-[#cfb88c] rounded-lg p-3 space-y-2">
                <div className="font-semibold text-[#2a1d13]">États &amp; Secrets politiques</div>
                {draft.lore.etatsLore.map((st, idx) => (
                  <div key={st.stateId} className="bg-[#fffdf7] border border-[#d6c298] rounded p-2.5 space-y-1">
                    <div className="flex items-center justify-between gap-2 font-semibold">
                      <span>{st.nom}</span>
                      <span className="font-journal italic text-[11px] text-[#6d5742]">« {st.devise} »</span>
                    </div>
                    <textarea
                      rows={2}
                      value={st.histoire}
                      onChange={e => {
                        const val = e.target.value;
                        setDraft(prev =>
                          prev
                            ? {
                                ...prev,
                                lore: {
                                  ...prev.lore,
                                  etatsLore: prev.lore.etatsLore.map((it, i) =>
                                    i === idx ? { ...it, histoire: val } : it
                                  ),
                                },
                              }
                            : prev
                        );
                      }}
                      className="w-full text-[11px] bg-white border border-[#e4d5b4] rounded p-1.5"
                    />
                    {afficherSecretsMJ && (
                      <input
                        type="text"
                        value={st.secretEtat || ''}
                        placeholder="Secret d'État (MJ uniquement)"
                        onChange={e => {
                          const val = e.target.value;
                          setDraft(prev =>
                            prev
                              ? {
                                  ...prev,
                                  lore: {
                                    ...prev.lore,
                                    etatsLore: prev.lore.etatsLore.map((it, i) =>
                                      i === idx ? { ...it, secretEtat: val } : it
                                    ),
                                  },
                                }
                              : prev
                          );
                        }}
                        className="w-full text-[11px] bg-amber-50/70 border border-amber-300 rounded px-2 py-1 text-amber-950"
                      />
                    )}
                  </div>
                ))}
              </div>

              {afficherSecretsMJ && (
                <div className="bg-[#faf0d7] border border-[#b48a3e] rounded-lg p-3 space-y-2">
                  <div className="font-semibold text-[#5b3d14]">Secrets généraux du Monde (MJ uniquement)</div>
                  {draft.lore.secretsMondeMJ.map((sec, idx) => (
                    <input
                      key={idx}
                      type="text"
                      value={sec}
                      onChange={e => {
                        const val = e.target.value;
                        setDraft(prev =>
                          prev
                            ? {
                                ...prev,
                                lore: {
                                  ...prev.lore,
                                  secretsMondeMJ: prev.lore.secretsMondeMJ.map((s, i) =>
                                    i === idx ? val : s
                                  ),
                                },
                              }
                            : prev
                        );
                      }}
                      className="w-full text-[11px] bg-white border border-[#d6c298] rounded px-2 py-1"
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {draft.etapeCourante === 4 && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            <div className="lg:col-span-4 bg-[#f5edd8] border border-[#cfb88c] rounded-lg p-3.5 space-y-3">
              <div className="font-display font-bold text-sm text-[#2a1d13] flex items-center gap-1.5">
                <Users className="w-4 h-4 text-[#8c6422]" />
                <span>4. PNJ &amp; Proximité</span>
              </div>

              <label className="block space-y-1">
                <span className="block text-[10px] text-[#6d5742] font-semibold">Bourg de départ du héros</span>
                <select
                  value={draft.config.heroBurgId || draft.studio.heroBurgId || ''}
                  onChange={e => updateConfig('heroBurgId', Number(e.target.value))}
                  className="w-full bg-[#fffdf7] border border-[#bfa574] rounded px-2 py-1 text-xs"
                >
                  {draft.studio.burgs.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name} {b.capital ? '(Capitale)' : ''}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1">
                  <span className="block text-[10px] text-[#6d5742] font-semibold">
                    Rayon proche ({draft.config.radiusProche} hex)
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={4}
                    value={draft.config.radiusProche}
                    onChange={e => updateConfig('radiusProche', Math.max(1, Math.min(4, Number(e.target.value) || 2)))}
                    className="w-full bg-[#fffdf7] border border-[#bfa574] rounded px-2 py-1 font-mono text-xs"
                  />
                </label>

                <label className="space-y-1">
                  <span className="block text-[10px] text-[#6d5742] font-semibold">
                    Lambda / bourg ({draft.config.lambdaParBourg})
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={4}
                    value={draft.config.lambdaParBourg}
                    onChange={e => updateConfig('lambdaParBourg', Math.max(1, Math.min(4, Number(e.target.value) || 2)))}
                    className="w-full bg-[#fffdf7] border border-[#bfa574] rounded px-2 py-1 font-mono text-xs"
                  />
                </label>
              </div>

              <button
                type="button"
                disabled={stepEnCours}
                onClick={() => lancerEtape(4)}
                className="w-full px-3 py-1.5 rounded border border-[#b48a3e] bg-[#efe5cb] hover:bg-[#e7d8b5] text-[11px] font-medium flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#8c6422]" />
                <span>Incarner les PNJ (Gemini)</span>
              </button>

              <div className="pt-2 border-t border-[#d6c298] space-y-2">
                <button
                  type="button"
                  disabled={stepEnCours || chargement}
                  onClick={() => onAppliquerMonde(draft)}
                  data-testid="btn-appliquer-forge"
                  className="w-full px-3.5 py-2 dnd-wood-bar border border-[#b48a3e] rounded text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40"
                >
                  <Check className="w-4 h-4 text-[#e5be6e]" />
                  <span>Appliquer ce monde à la campagne</span>
                </button>
                <button
                  type="button"
                  disabled={stepEnCours}
                  onClick={() => setDraft(prev => (prev ? { ...prev, etapeCourante: 3 } : prev))}
                  className="w-full px-2.5 py-1 rounded border border-[#bfa574] bg-[#fffdf7] text-[11px] flex items-center justify-center gap-1 cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Revenir au Lore</span>
                </button>
              </div>
            </div>

            <div className="lg:col-span-8 space-y-3">
              <div className="flex flex-wrap items-center gap-1 bg-[#efe5cb] border border-[#cfb88c] p-1 rounded-lg">
                {(
                  [
                    { id: 'TOUT', label: `Tous (${draft.pnjs.length})` },
                    {
                      id: 'MAJEUR_MONDE',
                      label: `Figures (${draft.pnjs.filter(p => p.tier === 'MAJEUR_MONDE').length})`,
                    },
                    {
                      id: 'LIEN_HEROS',
                      label: `Liens héros (${draft.pnjs.filter(p => p.tier === 'LIEN_HEROS').length})`,
                    },
                    {
                      id: 'PROCHE_PREGEN',
                      label: `Voisins (${draft.pnjs.filter(p => p.tier === 'PROCHE_PREGEN').length})`,
                    },
                    {
                      id: 'LAMBDA_LOINTAIN',
                      label: `Lambda (${draft.pnjs.filter(p => p.tier === 'LAMBDA_LOINTAIN').length})`,
                    },
                  ] as const
                ).map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setFiltreTier(t.id)}
                    className={`px-2.5 py-1 rounded text-[11px] font-medium whitespace-nowrap shrink-0 cursor-pointer ${
                      filtreTier === t.id
                        ? 'dnd-wood-bar'
                        : 'text-[#5c4734] hover:text-[#231a14]'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                <div className="md:col-span-5 space-y-1.5 max-h-[430px] overflow-y-auto pr-1">
                  {pnjsFiltres.map(p => {
                    const actif = npcActif?.id === p.id;
                    const burgName = draft.studio.burgs.find(b => b.id === p.burgId)?.name;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setSelectedNpcId(p.id)}
                        className={`w-full text-left p-2 rounded border transition-colors cursor-pointer ${
                          actif
                            ? 'bg-[#fbf5e6] border-[#b48a3e] text-[#231a14]'
                            : 'bg-[#f5edd8] border-[#d6c298] text-[#463626] hover:border-[#b48a3e]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold truncate">{p.nom}</span>
                          <span className="font-mono text-[10px] text-[#6d5742] shrink-0">
                            {p.detailLevel}
                          </span>
                        </div>
                        <div className="text-[10px] text-[#6d5742] truncate">
                          {p.profession} · {TIER_LABELS[p.tier]}
                          {burgName ? ` · ${burgName}` : ''}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="md:col-span-7 bg-[#f5edd8] border border-[#cfb88c] rounded-lg p-3 space-y-2.5">
                  {npcActif ? (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#d6c298] pb-2">
                        <div>
                          <div className="font-display font-bold text-sm text-[#2a1d13]">
                            {npcActif.nom}
                          </div>
                          <div className="text-[10px] text-[#6d5742] font-mono">
                            {TIER_LABELS[npcActif.tier]} · Détail {npcActif.detailLevel} ·{' '}
                            {npcActif.generationSource}
                          </div>
                        </div>
                        {npcActif.tier === 'LAMBDA_LOINTAIN' && (
                          <button
                            type="button"
                            onClick={() => promouvoirLambdaLocal(npcActif)}
                            className="px-2.5 py-1 rounded border border-[#b48a3e] bg-[#fffdf7] hover:bg-[#efe4ca] text-[11px] font-medium whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            Promouvoir en local
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <label className="space-y-0.5">
                          <span className="text-[10px] text-[#6d5742]">Nom</span>
                          <input
                            type="text"
                            value={npcActif.nom}
                            onChange={e => updateNpcField(npcActif.id, { nom: e.target.value })}
                            className="w-full bg-[#fffdf7] border border-[#d6c298] rounded px-2 py-1 text-xs"
                          />
                        </label>
                        <label className="space-y-0.5">
                          <span className="text-[10px] text-[#6d5742]">Profession</span>
                          <input
                            type="text"
                            value={npcActif.profession}
                            onChange={e => updateNpcField(npcActif.id, { profession: e.target.value })}
                            className="w-full bg-[#fffdf7] border border-[#d6c298] rounded px-2 py-1 text-xs"
                          />
                        </label>
                      </div>

                      {npcActif.estLienHeros && (
                        <label className="block space-y-0.5">
                          <span className="text-[10px] text-[#6d5742]">Lien avec le héros</span>
                          <input
                            type="text"
                            value={npcActif.lienHerosNature || ''}
                            onChange={e =>
                              updateNpcField(npcActif.id, { lienHerosNature: e.target.value })
                            }
                            className="w-full bg-[#fffdf7] border border-[#d6c298] rounded px-2 py-1 text-[11px]"
                          />
                        </label>
                      )}

                      <label className="block space-y-0.5">
                        <span className="text-[10px] text-[#6d5742]">Apparence</span>
                        <input
                          type="text"
                          value={npcActif.apparence}
                          onChange={e => updateNpcField(npcActif.id, { apparence: e.target.value })}
                          className="w-full bg-[#fffdf7] border border-[#d6c298] rounded px-2 py-1 text-[11px]"
                        />
                      </label>

                      <label className="block space-y-0.5">
                        <span className="text-[10px] text-[#6d5742]">Voix &amp; manie</span>
                        <input
                          type="text"
                          value={npcActif.voixEtManies}
                          onChange={e =>
                            updateNpcField(npcActif.id, { voixEtManies: e.target.value })
                          }
                          className="w-full bg-[#fffdf7] border border-[#d6c298] rounded px-2 py-1 text-[11px]"
                        />
                      </label>

                      <label className="block space-y-0.5">
                        <span className="text-[10px] text-[#6d5742]">Biographie</span>
                        <textarea
                          rows={2}
                          value={npcActif.biographie}
                          onChange={e =>
                            updateNpcField(npcActif.id, { biographie: e.target.value })
                          }
                          className="w-full bg-[#fffdf7] border border-[#d6c298] rounded px-2 py-1 text-[11px]"
                        />
                      </label>

                      <label className="block space-y-0.5">
                        <span className="text-[10px] text-[#6d5742]">Motivation immédiate (MJ)</span>
                        <input
                          type="text"
                          value={npcActif.motivationImmediate}
                          onChange={e =>
                            updateNpcField(npcActif.id, { motivationImmediate: e.target.value })
                          }
                          className="w-full bg-amber-50/70 border border-amber-300 rounded px-2 py-1 text-[11px]"
                        />
                      </label>

                      <label className="block space-y-0.5">
                        <span className="text-[10px] text-[#6d5742]">Secret caché (MJ)</span>
                        <input
                          type="text"
                          value={npcActif.secret || ''}
                          onChange={e => updateNpcField(npcActif.id, { secret: e.target.value })}
                          className="w-full bg-amber-50/70 border border-amber-300 rounded px-2 py-1 text-[11px]"
                        />
                      </label>
                    </>
                  ) : (
                    <div className="text-[#6d5742]">Aucun PNJ sélectionné.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
