import React, { useMemo, useState } from 'react';
import { SimulationState } from '../types';
import { SrdCategory, SrdEntry } from '../types/srd';
import {
  enregistrerAjoutsCompendium,
  formaterPrixPC,
  obtenirManifesteCompletude,
  rechercherCompendium,
} from '../engine/compendium';
import { CodexEntryDetail } from './CodexEntryDetail';
import { WorldLoreCodexTab } from './WorldLoreCodexTab';
import { ItemIcon } from '../utils/itemIcons';
import { BookMarked, Search, Plus, Check, X, ScrollText, Users } from 'lucide-react';

const ONGLETS: Array<{ id: SrdCategory | 'tout'; label: string }> = [
  { id: 'tout', label: 'Tout' },
  { id: 'monstre', label: 'Bestiaire' },
  { id: 'objet', label: 'Objets' },
  { id: 'sort', label: 'Sorts' },
  { id: 'regle', label: 'Règles' },
  { id: 'classe_race', label: 'Classes & Races' },
];

const MODELE_IMPORT_JSON = JSON.stringify(
  [
    {
      id: 'mon_goule',
      categorie: 'monstre',
      nom: 'Goule',
      nomEn: 'Ghoul',
      taille: 'M',
      typeCreature: 'Mort-vivant',
      alignement: 'Chaotique Mauvais',
      ca: 12,
      pv: 22,
      desVie: '5d8',
      vitesse: '9 m',
      caracteristiques: { FOR: 13, DEX: 15, CON: 10, INT: 7, SAG: 10, CHA: 6 },
      immunites: ['poison'],
      fp: '1',
      fpNum: 1,
      xp: 200,
      biomes: ['Donjon', 'Marais Fétide'],
      comportement: 'AVEUGLE_CORPS_A_CORPS',
      actions: [
        {
          nom: 'Griffes',
          bonusAttaque: 4,
          degatsDes: '2d4+2',
          typeDegats: 'tranchant',
          desc: '+4 au toucher, 2d4+2 tranchant. JDS CON DD 10 ou Paralysé 1 min.',
        },
      ],
      motsCles: ['mort-vivant', 'paralysie', 'caveau'],
      resume: 'Charognard mort-vivant paralysant ses proies.',
    },
  ],
  null,
  2
);

interface CodexPanelProps {
  etat?: SimulationState;
  chargement?: boolean;
  onPromouvoirPnj?: (npcIds: string[]) => void;
}

export const CodexPanel: React.FC<CodexPanelProps> = ({
  etat,
  chargement = false,
  onPromouvoirPnj,
}) => {
  const [modeCodex, setModeCodex] = useState<'srd' | 'lore' | 'pnjs'>('srd');
  const [categorie, setCategorie] = useState<SrdCategory | 'tout'>('tout');
  const [recherche, setRecherche] = useState('');
  const [biome, setBiome] = useState('');
  const [fpMax, setFpMax] = useState<string>('');
  const [sousCategorieObjet, setSousCategorieObjet] = useState('');
  const [niveauSort, setNiveauSort] = useState<string>('');
  const [selectionId, setSelectionId] = useState<string | null>(null);
  const [versionIndex, setVersionIndex] = useState(0);

  // Panneau inline pour compléter le Codex par lots JSON
  const [importOuvert, setImportOuvert] = useState(false);
  const [jsonBrut, setJsonBrut] = useState('');
  const [confirmationImport, setConfirmationImport] = useState<{ nb: number; parsed: unknown[] } | null>(null);
  const [statutImport, setStatutImport] = useState<{ type: 'ok' | 'err'; texte: string } | null>(null);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);

  const manifest = useMemo(() => obtenirManifesteCompletude(), [versionIndex]);

  const resultats = useMemo(() => {
    return rechercherCompendium({
      requete: recherche.trim() || undefined,
      categorie,
      biome: categorie === 'monstre' && biome ? biome : undefined,
      fpMax: categorie === 'monstre' && fpMax !== '' ? Number(fpMax) : undefined,
      sousCategorie: categorie === 'objet' && sousCategorieObjet ? sousCategorieObjet : undefined,
      niveauSort: categorie === 'sort' && niveauSort !== '' ? Number(niveauSort) : undefined,
      limite: 150,
    });
  }, [categorie, recherche, biome, fpMax, sousCategorieObjet, niveauSort, versionIndex]);

  const ficheActive: SrdEntry | undefined = useMemo(() => {
    if (selectionId) {
      const trouve = resultats.find(r => r.entry.id === selectionId);
      if (trouve) return trouve.entry;
    }
    return resultats[0]?.entry;
  }, [resultats, selectionId]);

  const preparerImport = () => {
    setStatutImport(null);
    try {
      const parsed = JSON.parse(jsonBrut);
      const liste = Array.isArray(parsed) ? parsed : [parsed];
      if (liste.length === 0) {
        setStatutImport({ type: 'err', texte: 'Tableau JSON vide.' });
        return;
      }
      setConfirmationImport({ nb: liste.length, parsed: liste });
    } catch {
      setStatutImport({ type: 'err', texte: 'Syntaxe JSON invalide.' });
    }
  };

  const confirmerImport = async () => {
    if (!confirmationImport) return;
    setEnvoiEnCours(true);
    setStatutImport(null);
    try {
      const res = await fetch('/api/codex/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries: confirmationImport.parsed }),
      });
      const data = await res.json();
      if (!res.ok || !data.succes) {
        throw new Error(data.erreur || 'Échec import.');
      }
      enregistrerAjoutsCompendium(confirmationImport.parsed);
      setVersionIndex(v => v + 1);
      setConfirmationImport(null);
      setJsonBrut('');
      setStatutImport({
        type: 'ok',
        texte: `Importé : ${data.ajoutes} ajout(s), ${data.remplaces} mise(s) à jour.${
          data.erreurs?.length ? ` (${data.erreurs.length} ignorée(s))` : ''
        }`,
      });
    } catch (err: any) {
      setStatutImport({ type: 'err', texte: err?.message || 'Erreur serveur.' });
      setConfirmationImport(null);
    } finally {
      setEnvoiEnCours(false);
    }
  };

  return (
    <div className="bg-white border border-stone-200 rounded-lg p-4 space-y-3 text-xs text-stone-800">
      {/* En-tête sobre + sélecteur SRD / Lore / PNJ */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <BookMarked className="w-4 h-4 text-amber-700" />
          <span className="font-bold text-stone-900 text-sm">Codex &amp; Chroniques</span>
          {etat && (
            <div className="flex items-center gap-1 bg-stone-100 border border-stone-200 p-0.5 rounded-md">
              <button
                type="button"
                onClick={() => setModeCodex('srd')}
                className={`px-2.5 py-1 rounded text-[11px] font-medium whitespace-nowrap shrink-0 cursor-pointer ${
                  modeCodex === 'srd' ? 'bg-white text-stone-900 shadow-2xs' : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                SRD 5e ({manifest.totalActuel})
              </button>
              <button
                type="button"
                onClick={() => setModeCodex('lore')}
                className={`px-2.5 py-1 rounded text-[11px] font-medium flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer ${
                  modeCodex === 'lore' ? 'bg-white text-stone-900 shadow-2xs' : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <ScrollText className="w-3 h-3 text-amber-700" />
                <span>Lore du Monde</span>
              </button>
              <button
                type="button"
                onClick={() => setModeCodex('pnjs')}
                className={`px-2.5 py-1 rounded text-[11px] font-medium flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer ${
                  modeCodex === 'pnjs' ? 'bg-white text-stone-900 shadow-2xs' : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <Users className="w-3 h-3 text-amber-700" />
                <span>Annuaire PNJ ({etat.pnjsMonde?.length || 0})</span>
              </button>
            </div>
          )}
        </div>

        {modeCodex === 'srd' && (
          <button
            onClick={() => {
              setImportOuvert(v => !v);
              setStatutImport(null);
              setConfirmationImport(null);
            }}
            className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 border border-stone-300 rounded text-[11px] font-medium flex items-center gap-1 text-stone-800 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-amber-700" />
            Compléter (JSON)
          </button>
        )}
      </div>

      {etat && (modeCodex === 'lore' || modeCodex === 'pnjs') ? (
        <WorldLoreCodexTab
          mode={modeCodex}
          etat={etat}
          chargement={chargement}
          onPromouvoirPnj={onPromouvoirPnj}
        />
      ) : (
        <>

      {/* Couverture par catégorie */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 tabular-nums">
        {manifest.categories.map(cat => (
          <div key={cat.categorie} className="bg-stone-50 border border-stone-200 rounded p-2 space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-medium text-stone-700">{cat.label}</span>
              <span className="font-mono text-stone-600">{cat.actuel}/{cat.cibleSrd}</span>
            </div>
            <div className="h-1 bg-stone-200 rounded overflow-hidden">
              <div
                className="h-full bg-amber-700"
                style={{ width: `${Math.max(4, cat.pourcentage)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Panneau en ligne d'import JSON (sans popup) */}
      {importOuvert && (
        <div className="bg-stone-50 border border-stone-200 rounded-lg p-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold text-stone-800">Ajout par lot JSON</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setJsonBrut(MODELE_IMPORT_JSON)}
                className="px-2 py-0.5 bg-white border border-stone-300 hover:bg-stone-100 rounded text-[11px] text-stone-700"
              >
                Modèle exemple
              </button>
              <button
                onClick={() => setImportOuvert(false)}
                className="p-1 text-stone-500 hover:text-stone-800"
                title="Fermer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <textarea
            value={jsonBrut}
            onChange={e => setJsonBrut(e.target.value)}
            rows={6}
            placeholder="Coller un tableau JSON de fiches D&D 5e (monstre, objet, sort, regle, classe_race)..."
            className="w-full p-2 bg-white border border-stone-300 rounded font-mono text-[11px] text-stone-800 focus:outline-none focus:border-amber-700"
          />

          {confirmationImport && (
            <div className="bg-amber-50 border border-amber-300 p-2 rounded flex flex-wrap items-center justify-between gap-2">
              <span className="text-amber-900">
                Enregistrer <strong>{confirmationImport.nb}</strong> fiche(s) dans le Codex ?
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={confirmerImport}
                  disabled={envoiEnCours}
                  className="px-2.5 py-1 bg-amber-700 hover:bg-amber-800 text-white rounded font-medium flex items-center gap-1"
                >
                  <Check className="w-3 h-3" /> Confirmer
                </button>
                <button
                  onClick={() => setConfirmationImport(null)}
                  className="px-2 py-1 bg-white border border-stone-300 rounded text-stone-700"
                >
                  Annuler
                </button>
              </div>
            </div>
          )}

          {statutImport && (
            <div
              className={`p-2 rounded border text-[11px] ${
                statutImport.type === 'ok'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  : 'bg-rose-50 border-rose-300 text-rose-900'
              }`}
            >
              {statutImport.texte}
            </div>
          )}

          {!confirmationImport && (
            <div className="flex justify-end">
              <button
                onClick={preparerImport}
                disabled={!jsonBrut.trim()}
                className="px-3 py-1 bg-amber-700 hover:bg-amber-800 disabled:bg-stone-300 text-white rounded font-medium text-[11px]"
              >
                Valider le lot
              </button>
            </div>
          )}
        </div>
      )}

      {/* Filtres & Recherche */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap items-center gap-1 bg-stone-100 p-1 rounded-md">
          {ONGLETS.map(o => (
            <button
              key={o.id}
              onClick={() => {
                setCategorie(o.id);
                setSelectionId(null);
              }}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                categorie === o.id
                  ? 'bg-white text-stone-900 shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>

        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={recherche}
            onChange={e => setRecherche(e.target.value)}
            placeholder="Rechercher FR / EN..."
            className="w-full pl-8 pr-2 py-1.5 bg-stone-50 border border-stone-200 rounded text-xs focus:outline-none focus:border-amber-700"
          />
        </div>

        {categorie === 'monstre' && (
          <>
            <select
              value={biome}
              onChange={e => setBiome(e.target.value)}
              className="px-2 py-1.5 bg-stone-50 border border-stone-200 rounded text-[11px]"
            >
              <option value="">Tous biomes</option>
              <option value="Forêt Dense">Forêt Dense</option>
              <option value="Marais Fétide">Marais Fétide</option>
              <option value="Montagne Escarpée">Montagne Escarpée</option>
              <option value="Désert Aride">Désert Aride</option>
              <option value="Plaine / Route">Plaine / Route</option>
              <option value="Donjon">Donjon</option>
            </select>
            <select
              value={fpMax}
              onChange={e => setFpMax(e.target.value)}
              className="px-2 py-1.5 bg-stone-50 border border-stone-200 rounded text-[11px]"
            >
              <option value="">Tout FP</option>
              <option value="0.5">FP ≤ 1/2</option>
              <option value="2">FP ≤ 2</option>
              <option value="5">FP ≤ 5</option>
              <option value="10">FP ≤ 10</option>
            </select>
          </>
        )}

        {categorie === 'objet' && (
          <select
            value={sousCategorieObjet}
            onChange={e => setSousCategorieObjet(e.target.value)}
            className="px-2 py-1.5 bg-stone-50 border border-stone-200 rounded text-[11px]"
          >
            <option value="">Tous types</option>
            <option value="arme">Armes</option>
            <option value="armure">Armures & Boucliers</option>
            <option value="equipement">Équipement</option>
            <option value="potion">Potions</option>
            <option value="objet_magique">Objets magiques</option>
            <option value="outil">Outils</option>
            <option value="monture">Montures</option>
            <option value="service">Services</option>
          </select>
        )}

        {categorie === 'sort' && (
          <select
            value={niveauSort}
            onChange={e => setNiveauSort(e.target.value)}
            className="px-2 py-1.5 bg-stone-50 border border-stone-200 rounded text-[11px]"
          >
            <option value="">Tous niveaux</option>
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
              <option key={n} value={n}>
                {n === 0 ? 'Niveau 0 (Tour)' : `Niveau ${n}`}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Liste + Détail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <div className="lg:col-span-5 space-y-1 max-h-[520px] overflow-y-auto pr-1">
          {resultats.length === 0 ? (
            <div className="bg-stone-50 border border-stone-200 rounded p-4 text-center text-stone-500">
              Aucune fiche trouvée.
            </div>
          ) : (
            resultats.map(({ entry }) => {
              const actif = ficheActive?.id === entry.id;
              return (
                <button
                  key={entry.id}
                  onClick={() => setSelectionId(entry.id)}
                  className={`w-full text-left p-2.5 rounded-md border transition-colors ${
                    actif
                      ? 'bg-amber-50/70 border-amber-400 text-stone-900'
                      : 'bg-stone-50 border-stone-200 text-stone-700 hover:border-stone-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-stone-900 truncate flex items-center gap-1.5 min-w-0">
                      {entry.categorie === 'objet' && (
                        <ItemIcon
                          item={{
                            id: entry.id,
                            nom: entry.nom,
                            sousCategorie: entry.sousCategorie,
                            motsCles: entry.motsCles,
                          }}
                        />
                      )}
                      <span className="truncate">{entry.nom}</span>
                    </span>
                    <span className="font-mono text-[10px] text-stone-500 shrink-0 tabular-nums">
                      {entry.categorie === 'monstre'
                        ? `FP ${entry.fp} · CA ${entry.ca}`
                        : entry.categorie === 'objet'
                        ? formaterPrixPC(entry.valeurPC)
                        : entry.categorie === 'sort'
                        ? `Niv ${entry.niveau}`
                        : entry.categorie === 'regle'
                        ? entry.domaine
                        : entry.sousType}
                    </span>
                  </div>
                  <div className="text-[11px] text-stone-500 truncate mt-0.5">{entry.resume}</div>
                </button>
              );
            })
          )}
        </div>

        <div className="lg:col-span-7">
          {ficheActive ? (
            <CodexEntryDetail entry={ficheActive} />
          ) : (
            <div className="bg-stone-50 border border-stone-200 rounded-lg p-6 text-center text-stone-400">
              Sélectionner une fiche.
            </div>
          )}
        </div>
      </div>
        </>
      )}
    </div>
  );
};
