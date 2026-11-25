import React, { useState } from 'react';
import { Ability, CharacterStats, HeroDocument, HeroDocumentCategory } from '../types';
import { ActionRequest } from '../engine/adjudication';
import { Upload, FileText, UserCog, Eye, EyeOff, Trash2, Plus, Check, X } from 'lucide-react';
import { useElapsedWait } from '../hooks/useElapsedWait';
import { formaterDureeAttente } from '../utils/aiTimeoutConfig';

interface HeroManagerPanelProps {
  personnage: CharacterStats;
  chargement: boolean;
  onExecuterAction: (action: ActionRequest) => void;
  onAnalyserImportHeros?: (
    rawText: string,
    files: Array<{ nom: string; contenu: string }>,
    signal?: AbortSignal
  ) => Promise<{ hero: any; sourceMode: string }>;
  onFermer: () => void;
}

type ManagerTab = 'fiche' | 'documents' | 'importer';

const CATEGORIES_DOCS: HeroDocumentCategory[] = ['Historique', 'Lore', 'Notes', 'Capacités', 'Autre'];
const ABILITIES: Ability[] = ['FOR', 'DEX', 'CON', 'INT', 'SAG', 'CHA'];

export const HeroManagerPanel: React.FC<HeroManagerPanelProps> = ({
  personnage,
  chargement,
  onExecuterAction,
  onAnalyserImportHeros,
  onFermer,
}) => {
  const [onglet, setOnglet] = useState<ManagerTab>('fiche');

  // État édition progressive de la fiche
  const [nom, setNom] = useState(personnage.nom);
  const [race, setRace] = useState(personnage.race || '');
  const [classe, setClasse] = useState(personnage.classe);
  const [historique, setHistorique] = useState(personnage.historique || '');
  const [alignement, setAlignement] = useState(personnage.alignement || '');
  const [niveau, setNiveau] = useState(personnage.niveau);
  const [pvMax, setPvMax] = useState(personnage.pvMax);
  const [vitessePieds, setVitessePieds] = useState(personnage.vitessePieds);
  const [caracs, setCaracs] = useState<Record<Ability, number>>({ ...personnage.caracteristiques });
  const [traits, setTraits] = useState(personnage.traits || '');
  const [capacitesTxt, setCapacitesTxt] = useState((personnage.capacites || []).join(', '));
  const [notesPersonnelles, setNotesPersonnelles] = useState(personnage.notesPersonnelles || '');

  // État documents
  const [docOuvertId, setDocOuvertId] = useState<string | null>(null);
  const [docEdition, setDocEdition] = useState<HeroDocument | null>(null);
  const [confirmSupprDocId, setConfirmSupprDocId] = useState<string | null>(null);
  const [nouveauDocTitre, setNouveauDocTitre] = useState('');
  const [nouveauDocCat, setNouveauDocCat] = useState<HeroDocumentCategory>('Notes');
  const [nouveauDocContenu, setNouveauDocContenu] = useState('');
  const [nouveauDocMJ, setNouveauDocMJ] = useState(true);

  // État import externe
  const [texteImport, setTexteImport] = useState('');
  const [fichiersImport, setFichiersImport] = useState<Array<{ nom: string; contenu: string }>>([]);
  const [analyseEnCours, setAnalyseEnCours] = useState(false);
  const [erreurImport, setErreurImport] = useState<string | null>(null);
  const [apercuHeros, setApercuHeros] = useState<any | null>(null);
  const [modeSourceImport, setModeSourceImport] = useState<string>('');
  const [confirmAppliquerImport, setConfirmAppliquerImport] = useState(false);
  const analyseControllerRef = React.useRef<AbortController | null>(null);
  const analyseElapsedMs = useElapsedWait(analyseEnCours);

  const sauvegarderFiche = (e: React.FormEvent) => {
    e.preventDefault();
    onExecuterAction({
      type: 'METTRE_A_JOUR_HEROS',
      payloadAction: {
        patch: {
          nom: nom.trim() || personnage.nom,
          race: race.trim(),
          classe: classe.trim() || personnage.classe,
          historique: historique.trim(),
          alignement: alignement.trim(),
          niveau: Number(niveau) || 1,
          pvMax: Number(pvMax) || 1,
          vitessePieds: Number(vitessePieds) || 30,
          caracteristiques: caracs,
          traits: traits.trim(),
          capacites: capacitesTxt
            .split(',')
            .map(s => s.trim())
            .filter(Boolean),
          notesPersonnelles: notesPersonnelles.trim(),
        },
      },
    });
  };

  const ajouterDocument = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nouveauDocContenu.trim()) return;
    onExecuterAction({
      type: 'GERER_DOCUMENT_HEROS',
      payloadAction: {
        mode: 'ajouter',
        titre: nouveauDocTitre.trim() || 'Note de campagne',
        categorie: nouveauDocCat,
        contenu: nouveauDocContenu.trim(),
        actifPourMJ: nouveauDocMJ,
      },
    });
    setNouveauDocTitre('');
    setNouveauDocContenu('');
  };

  const sauvegarderDocEdite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!docEdition) return;
    onExecuterAction({
      type: 'GERER_DOCUMENT_HEROS',
      payloadAction: {
        mode: 'modifier',
        docId: docEdition.id,
        titre: docEdition.titre,
        categorie: docEdition.categorie,
        contenu: docEdition.contenu,
        actifPourMJ: docEdition.actifPourMJ,
      },
    });
    setDocEdition(null);
  };

  const handleFichiersChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const loaded: Array<{ nom: string; contenu: string }> = [];
    for (const file of Array.from(fileList).slice(0, 10)) {
      const text = await file.text();
      loaded.push({ nom: file.name, contenu: text.slice(0, 100000) });
    }
    setFichiersImport(prev => [...prev, ...loaded].slice(0, 10));
    e.target.value = '';
  };

  const annulerAnalyse = () => {
    analyseControllerRef.current?.abort();
  };

  const lancerAnalyse = async () => {
    if (!onAnalyserImportHeros) return;
    if (!texteImport.trim() && fichiersImport.length === 0) {
      setErreurImport('Ajoutez un texte ou au moins un fichier (.txt, .md, .json).');
      return;
    }
    const controller = new AbortController();
    analyseControllerRef.current = controller;
    setAnalyseEnCours(true);
    setErreurImport(null);
    try {
      const res = await onAnalyserImportHeros(texteImport, fichiersImport, controller.signal);
      setApercuHeros(res.hero);
      setModeSourceImport(res.sourceMode);
      setConfirmAppliquerImport(false);
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        setErreurImport('Analyse annulée par le joueur.');
      } else {
        setErreurImport(err?.message || 'Analyse impossible.');
      }
    } finally {
      if (analyseControllerRef.current === controller) {
        analyseControllerRef.current = null;
      }
      setAnalyseEnCours(false);
    }
  };

  const appliquerImport = () => {
    if (!apercuHeros) return;
    onExecuterAction({
      type: 'IMPORTER_HEROS',
      payloadAction: { hero: apercuHeros },
    });
    setApercuHeros(null);
    setConfirmAppliquerImport(false);
    setTexteImport('');
    setFichiersImport([]);
    onFermer();
  };

  const docs = personnage.documents || [];

  return (
    <div className="bg-[#faf4e4] border border-[#bfa574] rounded-lg p-3 space-y-2.5 text-xs text-[#2a1f16]">
      <div className="flex items-center justify-between gap-2 border-b border-[#d6c298] pb-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setOnglet('fiche')}
            className={`px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 cursor-pointer ${
              onglet === 'fiche' ? 'dnd-wood-bar border' : 'bg-[#f2e8d0] text-[#5c4734] border border-[#d6c298]'
            }`}
          >
            <UserCog className="w-3 h-3" />
            Fiche
          </button>
          <button
            type="button"
            onClick={() => setOnglet('documents')}
            className={`px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 cursor-pointer ${
              onglet === 'documents' ? 'dnd-wood-bar border' : 'bg-[#f2e8d0] text-[#5c4734] border border-[#d6c298]'
            }`}
          >
            <FileText className="w-3 h-3" />
            Docs ({docs.length})
          </button>
          <button
            type="button"
            onClick={() => setOnglet('importer')}
            className={`px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 cursor-pointer ${
              onglet === 'importer' ? 'dnd-wood-bar border' : 'bg-[#f2e8d0] text-[#5c4734] border border-[#d6c298]'
            }`}
          >
            <Upload className="w-3 h-3" />
            Importer
          </button>
        </div>
        <button
          type="button"
          onClick={onFermer}
          className="text-[#6d5742] hover:text-[#231a14] p-1 cursor-pointer"
          title="Fermer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {onglet === 'fiche' && (
        <form onSubmit={sauvegarderFiche} className="space-y-2">
          <div className="grid grid-cols-2 gap-1.5">
            <label className="space-y-0.5">
              <span className="text-[10px] text-[#6d5742]">Nom</span>
              <input
                type="text"
                value={nom}
                onChange={e => setNom(e.target.value)}
                className="w-full bg-[#fffdf7] border border-[#bfa574] rounded px-2 py-1 text-[11px]"
              />
            </label>
            <label className="space-y-0.5">
              <span className="text-[10px] text-[#6d5742]">Race</span>
              <input
                type="text"
                value={race}
                onChange={e => setRace(e.target.value)}
                placeholder="Humain, Elfe..."
                className="w-full bg-[#fffdf7] border border-[#bfa574] rounded px-2 py-1 text-[11px]"
              />
            </label>
            <label className="space-y-0.5">
              <span className="text-[10px] text-[#6d5742]">Classe</span>
              <input
                type="text"
                value={classe}
                onChange={e => setClasse(e.target.value)}
                className="w-full bg-[#fffdf7] border border-[#bfa574] rounded px-2 py-1 text-[11px]"
              />
            </label>
            <label className="space-y-0.5">
              <span className="text-[10px] text-[#6d5742]">Historique</span>
              <input
                type="text"
                value={historique}
                onChange={e => setHistorique(e.target.value)}
                placeholder="Soldat, Érudit..."
                className="w-full bg-[#fffdf7] border border-[#bfa574] rounded px-2 py-1 text-[11px]"
              />
            </label>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            <label className="space-y-0.5">
              <span className="text-[10px] text-[#6d5742]">Niveau</span>
              <input
                type="number"
                min={1}
                max={20}
                value={niveau}
                onChange={e => setNiveau(Number(e.target.value))}
                className="w-full bg-[#fffdf7] border border-[#bfa574] rounded px-2 py-1 text-[11px] font-mono tabular-nums"
              />
            </label>
            <label className="space-y-0.5">
              <span className="text-[10px] text-[#6d5742]">PV max</span>
              <input
                type="number"
                min={1}
                max={500}
                value={pvMax}
                onChange={e => setPvMax(Number(e.target.value))}
                className="w-full bg-[#fffdf7] border border-[#bfa574] rounded px-2 py-1 text-[11px] font-mono tabular-nums"
              />
            </label>
            <label className="space-y-0.5">
              <span className="text-[10px] text-[#6d5742]">Vitesse (ft)</span>
              <input
                type="number"
                min={15}
                max={60}
                step={5}
                value={vitessePieds}
                onChange={e => setVitessePieds(Number(e.target.value))}
                className="w-full bg-[#fffdf7] border border-[#bfa574] rounded px-2 py-1 text-[11px] font-mono tabular-nums"
              />
            </label>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            {ABILITIES.map(ab => (
              <label key={ab} className="space-y-0.5">
                <span className="text-[10px] text-[#6d5742] font-mono">{ab}</span>
                <input
                  type="number"
                  min={3}
                  max={24}
                  value={caracs[ab]}
                  onChange={e => setCaracs(prev => ({ ...prev, [ab]: Number(e.target.value) }))}
                  className="w-full bg-[#fffdf7] border border-[#bfa574] rounded px-2 py-1 text-[11px] font-mono tabular-nums"
                />
              </label>
            ))}
          </div>

          <label className="block space-y-0.5">
            <span className="text-[10px] text-[#6d5742]">Alignement</span>
            <input
              type="text"
              value={alignement}
              onChange={e => setAlignement(e.target.value)}
              placeholder="Neutre Bon..."
              className="w-full bg-[#fffdf7] border border-[#bfa574] rounded px-2 py-1 text-[11px]"
            />
          </label>

          <label className="block space-y-0.5">
            <span className="text-[10px] text-[#6d5742]">Traits</span>
            <input
              type="text"
              value={traits}
              onChange={e => setTraits(e.target.value)}
              placeholder="Vision dans le noir, Sang-froid..."
              className="w-full bg-[#fffdf7] border border-[#bfa574] rounded px-2 py-1 text-[11px]"
            />
          </label>

          <label className="block space-y-0.5">
            <span className="text-[10px] text-[#6d5742]">Capacités (séparées par virgule)</span>
            <input
              type="text"
              value={capacitesTxt}
              onChange={e => setCapacitesTxt(e.target.value)}
              placeholder="Second souffle, Sursaut..."
              className="w-full bg-[#fffdf7] border border-[#bfa574] rounded px-2 py-1 text-[11px]"
            />
          </label>

          <label className="block space-y-0.5">
            <span className="text-[10px] text-[#6d5742]">Notes personnelles</span>
            <textarea
              rows={2}
              value={notesPersonnelles}
              onChange={e => setNotesPersonnelles(e.target.value)}
              placeholder="Notes libres sur le personnage..."
              className="w-full bg-[#fffdf7] border border-[#bfa574] rounded px-2 py-1 text-[11px]"
            />
          </label>

          <button
            type="submit"
            disabled={chargement}
            className="w-full py-1.5 dnd-wood-bar border rounded font-medium flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Check className="w-3.5 h-3.5 text-[#dfba68]" />
            Enregistrer la fiche
          </button>
        </form>
      )}

      {onglet === 'documents' && (
        <div className="space-y-2.5">
          <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
            {docs.length === 0 ? (
              <div className="text-[11px] text-[#78624a]">Aucun document attaché.</div>
            ) : (
              docs.map(doc => {
                const ouvert = docOuvertId === doc.id;
                const enEdition = docEdition?.id === doc.id;
                return (
                  <div key={doc.id} className="bg-[#f4ead2] border border-[#d6c298] rounded p-2 space-y-1.5">
                    <div className="flex items-center justify-between gap-1.5">
                      <button
                        type="button"
                        onClick={() => setDocOuvertId(ouvert ? null : doc.id)}
                        className="text-left font-medium text-[#231a14] truncate flex-1 cursor-pointer"
                      >
                        {doc.titre} · <span className="text-[#6d5742] font-normal">{doc.categorie}</span>
                      </button>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            onExecuterAction({
                              type: 'GERER_DOCUMENT_HEROS',
                              payloadAction: { mode: 'basculer_mj', docId: doc.id },
                            })
                          }
                          disabled={chargement}
                          title={doc.actifPourMJ ? 'Visible par le MJ' : 'Masqué au MJ'}
                          className={`px-1.5 py-0.5 rounded border text-[10px] flex items-center gap-0.5 cursor-pointer ${
                            doc.actifPourMJ
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                              : 'bg-stone-100 border-stone-300 text-stone-600'
                          }`}
                        >
                          {doc.actifPourMJ ? <Eye className="w-2.5 h-2.5" /> : <EyeOff className="w-2.5 h-2.5" />}
                          MJ
                        </button>
                        {confirmSupprDocId === doc.id ? (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                onExecuterAction({
                                  type: 'GERER_DOCUMENT_HEROS',
                                  payloadAction: { mode: 'supprimer', docId: doc.id },
                                });
                                setConfirmSupprDocId(null);
                              }}
                              className="px-1.5 py-0.5 bg-rose-700 text-white rounded text-[10px] cursor-pointer"
                            >
                              Confirmer
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmSupprDocId(null)}
                              className="px-1 py-0.5 bg-white border border-stone-300 rounded text-[10px] cursor-pointer"
                            >
                              Non
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmSupprDocId(doc.id)}
                            className="p-1 text-rose-700 hover:text-rose-900 cursor-pointer"
                            title="Supprimer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>

                    {ouvert && !enEdition && (
                      <div className="space-y-1 border-t border-[#d6c298] pt-1.5">
                        <p className="text-[11px] text-[#3b2c1e] whitespace-pre-wrap leading-snug">
                          {doc.contenu}
                        </p>
                        <button
                          type="button"
                          onClick={() => setDocEdition({ ...doc })}
                          className="text-[10px] text-[#7c5620] underline cursor-pointer"
                        >
                          Modifier
                        </button>
                      </div>
                    )}

                    {enEdition && docEdition && (
                      <form onSubmit={sauvegarderDocEdite} className="space-y-1.5 border-t border-[#d6c298] pt-1.5">
                        <div className="flex gap-1">
                          <input
                            type="text"
                            value={docEdition.titre}
                            onChange={e => setDocEdition({ ...docEdition, titre: e.target.value })}
                            className="flex-1 bg-[#fffdf7] border border-[#bfa574] rounded px-1.5 py-1 text-[11px]"
                          />
                          <select
                            value={docEdition.categorie}
                            onChange={e =>
                              setDocEdition({
                                ...docEdition,
                                categorie: e.target.value as HeroDocumentCategory,
                              })
                            }
                            className="bg-[#fffdf7] border border-[#bfa574] rounded px-1.5 py-1 text-[11px]"
                          >
                            {CATEGORIES_DOCS.map(c => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        </div>
                        <textarea
                          rows={3}
                          value={docEdition.contenu}
                          onChange={e => setDocEdition({ ...docEdition, contenu: e.target.value })}
                          className="w-full bg-[#fffdf7] border border-[#bfa574] rounded px-1.5 py-1 text-[11px]"
                        />
                        <div className="flex gap-1.5">
                          <button
                            type="submit"
                            className="px-2 py-1 dnd-wood-bar border rounded text-[10px] font-medium cursor-pointer"
                          >
                            Valider
                          </button>
                          <button
                            type="button"
                            onClick={() => setDocEdition(null)}
                            className="px-2 py-1 bg-white border border-stone-300 rounded text-[10px] cursor-pointer"
                          >
                            Annuler
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <form onSubmit={ajouterDocument} className="space-y-1.5 border-t border-[#d6c298] pt-2">
            <div className="text-[10px] font-semibold text-[#5c4734] uppercase">Ajouter un document</div>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={nouveauDocTitre}
                onChange={e => setNouveauDocTitre(e.target.value)}
                placeholder="Titre"
                className="flex-1 bg-[#fffdf7] border border-[#bfa574] rounded px-2 py-1 text-[11px]"
              />
              <select
                value={nouveauDocCat}
                onChange={e => setNouveauDocCat(e.target.value as HeroDocumentCategory)}
                className="bg-[#fffdf7] border border-[#bfa574] rounded px-2 py-1 text-[11px]"
              >
                {CATEGORIES_DOCS.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <textarea
              rows={3}
              value={nouveauDocContenu}
              onChange={e => setNouveauDocContenu(e.target.value)}
              placeholder="Historique, serment, PNJ liés, notes de campagne..."
              className="w-full bg-[#fffdf7] border border-[#bfa574] rounded px-2 py-1 text-[11px]"
            />
            <div className="flex items-center justify-between gap-2">
              <label className="flex items-center gap-1.5 text-[11px] text-[#5c4734] cursor-pointer">
                <input
                  type="checkbox"
                  checked={nouveauDocMJ}
                  onChange={e => setNouveauDocMJ(e.target.checked)}
                />
                Visible par le MJ
              </label>
              <button
                type="submit"
                disabled={chargement || !nouveauDocContenu.trim()}
                className="px-2.5 py-1 dnd-wood-bar border rounded text-[11px] font-medium flex items-center gap-1 cursor-pointer disabled:opacity-40"
              >
                <Plus className="w-3 h-3 text-[#dfba68]" />
                Ajouter
              </button>
            </div>
          </form>
        </div>
      )}

      {onglet === 'importer' && (
        <div className="space-y-2.5">
          {!apercuHeros ? (
            <>
              <label className="block space-y-1">
                <span className="text-[10px] text-[#6d5742] block">
                  Fichiers (.txt, .md, .json) — fiche + documents autour
                </span>
                <input
                  type="file"
                  multiple
                  accept=".txt,.md,.json,.csv"
                  onChange={handleFichiersChange}
                  className="block w-full text-[11px] file:mr-2 file:py-1 file:px-2 file:rounded file:border file:border-[#bfa574] file:bg-[#f2e8d0] file:text-[#2a1f16] file:cursor-pointer"
                />
              </label>

              {fichiersImport.length > 0 && (
                <div className="space-y-1">
                  {fichiersImport.map((f, idx) => (
                    <div
                      key={`${f.nom}_${idx}`}
                      className="flex items-center justify-between bg-[#f4ead2] border border-[#d6c298] rounded px-2 py-1 text-[11px]"
                    >
                      <span className="truncate">{f.nom}</span>
                      <button
                        type="button"
                        onClick={() => setFichiersImport(prev => prev.filter((_, i) => i !== idx))}
                        className="text-rose-700 hover:text-rose-900 ml-2 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <textarea
                rows={5}
                value={texteImport}
                onChange={e => setTexteImport(e.target.value)}
                placeholder="Collez ici une fiche D&D 5e (texte libre, Markdown ou JSON) et le contexte du personnage..."
                className="w-full bg-[#fffdf7] border border-[#bfa574] rounded px-2 py-1.5 text-[11px]"
              />

              {erreurImport && (
                <div className="text-[11px] text-rose-800 bg-rose-50 border border-rose-200 rounded p-2">
                  {erreurImport}
                </div>
              )}

              {analyseEnCours ? (
                <div className="flex items-center justify-between gap-2 bg-[#f2e8d0] border border-[#bfa574] rounded px-2.5 py-1.5">
                  <span className="font-mono tabular-nums text-[11px] text-[#5c4734]">
                    Analyse IA · {formaterDureeAttente(analyseElapsedMs)} / 15:00
                  </span>
                  <button
                    type="button"
                    onClick={annulerAnalyse}
                    className="px-2.5 py-1 rounded border border-[#b48a3e] bg-[#fffdf7] hover:bg-[#efe0bd] text-[#3a2817] text-[11px] font-medium flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                    <span>Annuler</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={lancerAnalyse}
                  disabled={!texteImport.trim() && fichiersImport.length === 0}
                  className="w-full py-1.5 dnd-wood-bar border rounded font-medium cursor-pointer disabled:opacity-40"
                >
                  Analyser la fiche et les documents
                </button>
              )}
            </>
          ) : (
            <div className="space-y-2 border-t border-[#d6c298] pt-2">
              <div className="flex items-center justify-between text-[11px] text-[#5c4734]">
                <span className="font-semibold text-[#231a14]">Aperçu avant import</span>
                <span className="font-mono text-[10px]">{modeSourceImport}</span>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <input
                  type="text"
                  value={apercuHeros.nom || ''}
                  onChange={e => setApercuHeros({ ...apercuHeros, nom: e.target.value })}
                  placeholder="Nom"
                  className="bg-[#fffdf7] border border-[#bfa574] rounded px-2 py-1 text-[11px]"
                />
                <input
                  type="text"
                  value={apercuHeros.race || ''}
                  onChange={e => setApercuHeros({ ...apercuHeros, race: e.target.value })}
                  placeholder="Race"
                  className="bg-[#fffdf7] border border-[#bfa574] rounded px-2 py-1 text-[11px]"
                />
                <input
                  type="text"
                  value={apercuHeros.classe || ''}
                  onChange={e => setApercuHeros({ ...apercuHeros, classe: e.target.value })}
                  placeholder="Classe"
                  className="bg-[#fffdf7] border border-[#bfa574] rounded px-2 py-1 text-[11px]"
                />
                <div className="flex gap-1">
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={apercuHeros.niveau || 1}
                    onChange={e => setApercuHeros({ ...apercuHeros, niveau: Number(e.target.value) })}
                    title="Niveau"
                    className="w-1/2 bg-[#fffdf7] border border-[#bfa574] rounded px-1.5 py-1 text-[11px] font-mono"
                  />
                  <input
                    type="number"
                    min={1}
                    value={apercuHeros.pvMax || 10}
                    onChange={e => setApercuHeros({ ...apercuHeros, pvMax: Number(e.target.value) })}
                    title="PV max"
                    className="w-1/2 bg-[#fffdf7] border border-[#bfa574] rounded px-1.5 py-1 text-[11px] font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-1">
                {ABILITIES.map(ab => (
                  <label key={ab} className="flex items-center justify-between bg-[#fffdf7] border border-[#bfa574] rounded px-1.5 py-0.5 text-[10px]">
                    <span className="font-mono text-[#6d5742]">{ab}</span>
                    <input
                      type="number"
                      min={3}
                      max={24}
                      value={apercuHeros.caracteristiques?.[ab] ?? 10}
                      onChange={e =>
                        setApercuHeros({
                          ...apercuHeros,
                          caracteristiques: {
                            ...(apercuHeros.caracteristiques || {}),
                            [ab]: Number(e.target.value),
                          },
                        })
                      }
                      className="w-10 text-right bg-transparent font-mono focus:outline-none"
                    />
                  </label>
                ))}
              </div>

              <div className="text-[11px] text-[#5c4734]">
                Objets détectés : {apercuHeros.inventaire?.length || 0} · Sorts :{' '}
                {apercuHeros.sortsNoms?.length || 0} · Documents : {apercuHeros.documents?.length || 0}
              </div>

              {Array.isArray(apercuHeros.documents) && apercuHeros.documents.length > 0 && (
                <div className="space-y-1 max-h-28 overflow-y-auto">
                  {apercuHeros.documents.map((d: any, i: number) => (
                    <div key={i} className="bg-[#f4ead2] border border-[#d6c298] rounded px-2 py-1 flex items-center justify-between gap-2 text-[11px]">
                      <span className="truncate">{d.titre} ({d.categorie || 'Historique'})</span>
                      <button
                        type="button"
                        onClick={() => {
                          const next = [...apercuHeros.documents];
                          next[i] = { ...d, actifPourMJ: d.actifPourMJ === false };
                          setApercuHeros({ ...apercuHeros, documents: next });
                        }}
                        className="text-[10px] underline shrink-0 cursor-pointer"
                      >
                        {d.actifPourMJ === false ? 'Masqué MJ' : 'Actif MJ'}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {confirmAppliquerImport ? (
                <div className="bg-amber-50 border border-amber-300 rounded p-2 space-y-1.5">
                  <div className="text-[11px] text-amber-900">
                    Remplacer {personnage.nom} par {apercuHeros.nom || 'ce héros'} ?
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={appliquerImport}
                      disabled={chargement}
                      className="px-2.5 py-1 bg-amber-700 text-white rounded text-[11px] font-medium cursor-pointer"
                    >
                      Confirmer
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmAppliquerImport(false)}
                      className="px-2.5 py-1 bg-white border border-stone-300 rounded text-[11px] cursor-pointer"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setConfirmAppliquerImport(true)}
                    className="flex-1 py-1.5 dnd-wood-bar border rounded font-medium cursor-pointer"
                  >
                    Appliquer ce héros
                  </button>
                  <button
                    type="button"
                    onClick={() => setApercuHeros(null)}
                    className="px-2.5 py-1.5 bg-white border border-stone-300 rounded text-[11px] cursor-pointer"
                  >
                    Retour
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
