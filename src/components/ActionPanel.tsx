import React, { useState, useEffect } from 'react';
import { SimulationState, HexNode } from '../types';
import { ActionRequest } from '../engine/adjudication';
import {
  Swords,
  Moon,
  Sun,
  Search,
  Footprints,
  AlertTriangle,
  Send,
  RefreshCw,
  HeartPulse,
  Shield,
  Sparkles,
  ShoppingBag,
  Hammer,
  MessageSquare,
  Compass,
  Users,
  Radio,
  Wrench,
  Droplets,
  Castle,
  GraduationCap,
  BookOpen,
} from 'lucide-react';
import { WorkBoardPanel } from './WorkBoardPanel';
import { LocalMarketPanel } from './LocalMarketPanel';
import { NpcDialogPanel } from './NpcDialogPanel';
import { HirelingsPanel } from './HirelingsPanel';
import { RumorsFeed } from './RumorsFeed';
import { DungeonTacticalView } from './DungeonTacticalView';
import { SpellbookPanel } from './SpellbookPanel';
import { CraftingPanel } from './CraftingPanel';
import { GameMasterSuggestions } from './GameMasterSuggestions';

interface ActionPanelProps {
  etat: SimulationState;
  hexCibleSelectionne: HexNode | null;
  cibleCombatSelectionnee: string | null;
  chargement: boolean;
  onExecuterAction: (action: ActionRequest) => void;
  onReset: () => void;
}

type TabType = 'survie' | 'corvees' | 'comptoir' | 'dialogue' | 'compagnons' | 'rumeurs' | 'grimoire' | 'artisanat';

export const ActionPanel: React.FC<ActionPanelProps> = ({
  etat,
  hexCibleSelectionne,
  cibleCombatSelectionnee,
  chargement,
  onExecuterAction,
  onReset,
}) => {
  const [texteLibre, setTexteLibre] = useState('');
  const [ongletAction, setOngletAction] = useState<TabType>('survie');
  const [confirmationEnLigne, setConfirmationEnLigne] = useState<{
    titre: string;
    details: string;
    actionAConfirmer: () => void;
  } | null>(null);

  const estMort = etat.personnage.estMortDefinitivement;
  const enCombat = etat.combat.actif;
  const estInconscient = etat.personnage.pvActuels === 0 && !estMort;
  const aSortDispo = etat.personnage.emplacementsSorts.some(s => s.total - s.utilise > 0);
  const estEnBourgade = etat.hexActuel.pointInteret?.type === 'bourgade' || etat.hexActuel.securite === 'Sûr';
  const dernierEvt = etat.journalNarratif && etat.journalNarratif.length > 0
    ? etat.journalNarratif[etat.journalNarratif.length - 1]
    : undefined;

  // Adaptation contextuelle au changement de lieu si l'utilisateur est sur survie
  useEffect(() => {
    if (estEnBourgade && ongletAction === 'survie') {
      setOngletAction('comptoir');
    }
  }, [etat.hexActuel.id]);

  const handleDeplacement = () => {
    if (!hexCibleSelectionne) return;

    if (etat.personnage.heuresMarcheJour >= 8) {
      setConfirmationEnLigne({
        titre: 'Marche forcée',
        details: `Vous marchez depuis ${etat.personnage.heuresMarcheJour.toFixed(1)}h. Risque d'épuisement (Sauvegarde CON DD ${10 + Math.max(1, Math.round(etat.personnage.heuresMarcheJour - 7))}).`,
        actionAConfirmer: () => {
          onExecuterAction({ type: 'DEPLACER_HEX', cibleId: hexCibleSelectionne.id });
          setConfirmationEnLigne(null);
        },
      });
      return;
    }

    onExecuterAction({ type: 'DEPLACER_HEX', cibleId: hexCibleSelectionne.id });
  };

  const handleReposLong = () => {
    const estSecurise = etat.hexActuel.securite === 'Sûr' || etat.hexActuel.pointInteret?.type === 'bourgade';
    if (!estSecurise) {
      setConfirmationEnLigne({
        titre: 'Bivouac hostile',
        details: `Zone ${etat.hexActuel.securite}. Sommeil potentiellement interrompu et risque d'épuisement si le jet CON échoue.`,
        actionAConfirmer: () => {
          onExecuterAction({ type: 'REPOS_LONG' });
          setConfirmationEnLigne(null);
        },
      });
      return;
    }

    onExecuterAction({ type: 'REPOS_LONG' });
  };

  const soumettreTexteLibre = (e: React.FormEvent) => {
    e.preventDefault();
    if (!texteLibre.trim() || chargement || estMort) return;
    onExecuterAction({ type: 'ACTION_LIBRE', texteLibre: texteLibre.trim() });
    setTexteLibre('');
  };

  if (estMort) {
    return (
      <div className="bg-white border border-rose-300 shadow-xs rounded-lg p-4 text-xs space-y-3">
        <div className="text-rose-800 font-bold text-sm">
          Mort définitive : votre personnage a succombé.
        </div>
        <p className="text-stone-600 leading-relaxed">
          Trois échecs de sauvegarde contre la mort ont été enregistrés. Le monde continue son cours sans vous.
        </p>
        <div className="pt-2 border-t border-stone-200">
          <button
            onClick={onReset}
            disabled={chargement}
            className="px-3.5 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-md font-medium flex items-center gap-2 shadow-xs transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Créer un nouvel aventurier
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-stone-200 shadow-xs rounded-lg p-3.5 text-xs space-y-3">
      {/* Confirmation en ligne stricte (aucune popup) */}
      {confirmationEnLigne && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
            <div>
              <span className="font-bold text-amber-900">{confirmationEnLigne.titre}</span>
              <p className="text-[11px] text-amber-800 leading-snug">{confirmationEnLigne.details}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={confirmationEnLigne.actionAConfirmer}
              disabled={chargement}
              className="px-3 py-1 bg-amber-700 hover:bg-amber-800 text-white font-medium rounded-md shadow-xs transition-colors"
            >
              Confirmer
            </button>
            <button
              onClick={() => setConfirmationEnLigne(null)}
              className="px-2.5 py-1 bg-white hover:bg-stone-100 text-stone-700 rounded-md border border-stone-300 transition-colors"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Si Inconscient à 0 PV */}
      {estInconscient ? (
        <div className="bg-rose-50 border border-rose-200 p-3 rounded-lg flex items-center justify-between">
          <div>
            <div className="font-bold text-rose-800">Inconscient (0 PV)</div>
            <div className="text-[11px] text-stone-600">Lancez vos sauvegardes contre la mort. 3 échecs = mort définitive.</div>
          </div>
          <button
            onClick={() => onExecuterAction({ type: 'JETS_MORT' })}
            disabled={chargement}
            className="px-3 py-1.5 bg-rose-700 hover:bg-rose-800 text-white font-medium rounded-md shadow-xs flex items-center gap-1.5 transition-colors"
          >
            <HeartPulse className="w-4 h-4" />
            Sauvegarde contre la mort (d20)
          </button>
        </div>
      ) : enCombat ? (
        /* Actions de Combat Tactique */
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-rose-900 font-semibold text-xs border-b border-rose-100 pb-1.5">
            <span className="flex items-center gap-1.5">
              <Swords className="w-4 h-4 text-rose-700" />
              Actions de combat
            </span>
            <span className="text-[11px] text-stone-500 font-normal">Round {etat.combat.round}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                const cible = cibleCombatSelectionnee || etat.combat.ennemis.find(e => e.statut === 'ACTIF')?.id;
                if (cible) onExecuterAction({ type: 'ATTAQUER', cibleId: cible });
              }}
              disabled={chargement || !etat.combat.ennemis.some(e => e.statut === 'ACTIF')}
              className="px-3.5 py-1.5 bg-rose-700 hover:bg-rose-800 text-white font-medium rounded-md shadow-xs flex items-center gap-1.5 transition-colors"
            >
              <Swords className="w-3.5 h-3.5" />
              Attaquer
            </button>

            <button
              onClick={() => onExecuterAction({ type: 'ESQUIVER' })}
              disabled={chargement || !etat.combat.ennemis.some(e => e.statut === 'ACTIF')}
              className="px-3 py-1.5 bg-white hover:bg-stone-100 text-stone-800 rounded-md border border-stone-300 shadow-xs flex items-center gap-1.5 transition-colors"
              title="Posture défensive : désavantage aux attaques ennemies"
            >
              <Shield className="w-3.5 h-3.5 text-sky-700" />
              Esquiver
            </button>

            {aSortDispo && (
              <button
                onClick={() => {
                  const cible = cibleCombatSelectionnee || etat.combat.ennemis.find(e => e.statut === 'ACTIF')?.id;
                  onExecuterAction({ type: 'LANCER_SORT', sortNom: 'Trait de feu', cibleId: cible });
                }}
                disabled={chargement || !etat.combat.ennemis.some(e => e.statut === 'ACTIF')}
                className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 rounded-md border border-indigo-200 flex items-center gap-1.5 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-700" />
                Sort arcanique
              </button>
            )}

            <button
              onClick={() => onExecuterAction({ type: 'FUIR_TACTIQUE' })}
              disabled={chargement}
              className="px-3 py-1.5 bg-white hover:bg-stone-100 text-stone-700 rounded-md border border-stone-300 shadow-xs flex items-center gap-1.5 transition-colors"
              title="Se désengager et fuir"
            >
              <Footprints className="w-3.5 h-3.5 text-amber-700" />
              Fuir
            </button>

            <button
              onClick={() => onExecuterAction({ type: 'TOUR_ENNEMI' })}
              disabled={chargement || !etat.combat.ennemis.some(e => e.statut === 'ACTIF')}
              className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-md border border-stone-300 ml-auto transition-colors"
            >
              Fin du tour
            </button>
          </div>
        </div>
      ) : (
        /* Actions Hors Combat */
        <div className="space-y-3">
          {/* Bandeau d'ambiance contextuel */}
          <div className="flex items-center justify-between bg-stone-100/70 px-2.5 py-1 rounded-md text-[11px] text-stone-600">
            <span className="font-medium text-stone-800">
              {estEnBourgade ? 'Bourgade marchande' : 'Expédition en pleine nature'}
            </span>
            <span>{etat.hexActuel.nom}</span>
          </div>

          {/* Sélecteur d'onglets ergonomique */}
          <div className="flex flex-wrap items-center gap-1 border-b border-stone-200 pb-2">
            <button
              onClick={() => setOngletAction('survie')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium flex items-center gap-1 transition-colors ${
                ongletAction === 'survie'
                  ? 'bg-emerald-800 text-white shadow-2xs'
                  : 'bg-stone-100 text-stone-600 hover:text-stone-900'
              }`}
            >
              <Compass className="w-3 h-3 text-amber-300" />
              Voyage & Repos
            </button>

            <button
              onClick={() => setOngletAction('comptoir')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium flex items-center gap-1 transition-colors ${
                ongletAction === 'comptoir'
                  ? 'bg-amber-800 text-white shadow-2xs'
                  : 'bg-stone-100 text-stone-600 hover:text-stone-900'
              }`}
            >
              <ShoppingBag className="w-3 h-3" />
              Comptoir
            </button>

            <button
              onClick={() => setOngletAction('corvees')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium flex items-center gap-1 transition-colors ${
                ongletAction === 'corvees'
                  ? 'bg-stone-800 text-white shadow-2xs'
                  : 'bg-stone-100 text-stone-600 hover:text-stone-900'
              }`}
            >
              <Hammer className="w-3 h-3" />
              Corvées
            </button>

            <button
              onClick={() => setOngletAction('dialogue')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium flex items-center gap-1 transition-colors ${
                ongletAction === 'dialogue'
                  ? 'bg-sky-800 text-white shadow-2xs'
                  : 'bg-stone-100 text-stone-600 hover:text-stone-900'
              }`}
            >
              <MessageSquare className="w-3 h-3" />
              Dialogue
            </button>

            <button
              onClick={() => setOngletAction('compagnons')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium flex items-center gap-1 transition-colors ${
                ongletAction === 'compagnons'
                  ? 'bg-purple-800 text-white shadow-2xs'
                  : 'bg-stone-100 text-stone-600 hover:text-stone-900'
              }`}
            >
              <Users className="w-3 h-3" />
              Compagnons ({etat.personnage.compagnons?.length || 0})
            </button>

            <button
              onClick={() => setOngletAction('rumeurs')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium flex items-center gap-1 transition-colors ${
                ongletAction === 'rumeurs'
                  ? 'bg-amber-700 text-white shadow-2xs'
                  : 'bg-stone-100 text-stone-600 hover:text-stone-900'
              }`}
            >
              <Radio className="w-3 h-3" />
              Rumeurs ({etat.rumeurs?.length || 0})
            </button>

            <button
              onClick={() => setOngletAction('grimoire')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium flex items-center gap-1 transition-colors ${
                ongletAction === 'grimoire'
                  ? 'bg-indigo-800 text-white shadow-2xs'
                  : 'bg-stone-100 text-stone-600 hover:text-stone-900'
              }`}
            >
              <BookOpen className="w-3 h-3" />
              Grimoire ({etat.personnage.sortsPrepares?.length || 0})
            </button>

            <button
              onClick={() => setOngletAction('artisanat')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium flex items-center gap-1 transition-colors ${
                ongletAction === 'artisanat'
                  ? 'bg-emerald-900 text-white shadow-2xs'
                  : 'bg-stone-100 text-stone-600 hover:text-stone-900'
              }`}
            >
              <Hammer className="w-3 h-3" />
              Bivouac & Soins {etat.personnage.blessuresPersistantes?.length ? `(${etat.personnage.blessuresPersistantes.length})` : ''}
            </button>
          </div>

          {/* Affichage du sous-panneau actif */}
          {etat.donjon && etat.donjon.actif ? (
            <DungeonTacticalView donjon={etat.donjon} chargement={chargement} onExecuterAction={onExecuterAction} />
          ) : ongletAction === 'corvees' ? (
            <WorkBoardPanel etat={etat} chargement={chargement} onExecuterAction={onExecuterAction} />
          ) : ongletAction === 'comptoir' ? (
            <LocalMarketPanel etat={etat} chargement={chargement} onExecuterAction={onExecuterAction} />
          ) : ongletAction === 'dialogue' ? (
            <NpcDialogPanel etat={etat} chargement={chargement} onExecuterAction={onExecuterAction} />
          ) : ongletAction === 'compagnons' ? (
            <HirelingsPanel personnage={etat.personnage} chargement={chargement} onExecuterAction={onExecuterAction} />
          ) : ongletAction === 'rumeurs' ? (
            <RumorsFeed rumeurs={etat.rumeurs || []} />
          ) : ongletAction === 'grimoire' ? (
            <SpellbookPanel
              personnage={etat.personnage}
              combat={etat.combat}
              chargement={chargement}
              onExecuterAction={onExecuterAction}
            />
          ) : ongletAction === 'artisanat' ? (
            <CraftingPanel
              personnage={etat.personnage}
              chargement={chargement}
              onExecuterAction={onExecuterAction}
            />
          ) : (
            /* Mode Survie & Déplacement */
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleDeplacement}
                  disabled={chargement || !hexCibleSelectionne || hexCibleSelectionne.id === etat.hexActuel.id}
                  className={`px-3.5 py-1.5 rounded-md flex items-center gap-1.5 font-medium transition-colors ${
                    hexCibleSelectionne && hexCibleSelectionne.id !== etat.hexActuel.id
                      ? 'bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs'
                      : 'bg-stone-100 text-stone-400 border border-stone-200 cursor-not-allowed'
                  }`}
                >
                  <Footprints className="w-3.5 h-3.5" />
                  Marcher vers {hexCibleSelectionne && hexCibleSelectionne.id !== etat.hexActuel.id ? hexCibleSelectionne.nom : 'hex adjacent'}
                </button>

                <button
                  onClick={() => onExecuterAction({ type: 'FORAGER' })}
                  disabled={chargement}
                  className="px-3 py-1.5 bg-white hover:bg-stone-100 text-stone-800 rounded-md border border-stone-300 shadow-xs flex items-center gap-1.5 transition-colors"
                >
                  <Search className="w-3.5 h-3.5 text-emerald-700" />
                  Forager (1h)
                </button>

                <button
                  onClick={() => onExecuterAction({ type: 'REPOS_COURT' })}
                  disabled={chargement}
                  className="px-3 py-1.5 bg-white hover:bg-stone-100 text-stone-800 rounded-md border border-stone-300 shadow-xs flex items-center gap-1.5 transition-colors"
                >
                  <Sun className="w-3.5 h-3.5 text-amber-700" />
                  Repos court (1h)
                </button>

                <button
                  onClick={handleReposLong}
                  disabled={chargement}
                  className="px-3 py-1.5 bg-white hover:bg-stone-100 text-stone-800 rounded-md border border-stone-300 shadow-xs flex items-center gap-1.5 transition-colors"
                >
                  <Moon className="w-3.5 h-3.5 text-indigo-700" />
                  Repos long (8h)
                </button>
              </div>

              {/* Actions de terrain avancées */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-stone-200">
                {etat.hexActuel.pointInteret && (
                  <button
                    onClick={() => onExecuterAction({ type: 'EXPLORER_SITE' })}
                    disabled={chargement}
                    className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-md border border-amber-300 font-medium flex items-center gap-1.5 transition-colors"
                  >
                    <Castle className="w-3.5 h-3.5 text-amber-700" />
                    Pénétrer : {etat.hexActuel.pointInteret.nom}
                  </button>
                )}

                {etat.personnage.eauLitres > 0 && etat.personnage.qualiteEau !== 'Pure' && (
                  <button
                    onClick={() => onExecuterAction({ type: 'BOUILLIR_EAU' })}
                    disabled={chargement}
                    className="px-2.5 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-900 rounded-md border border-sky-200 flex items-center gap-1.5 transition-colors"
                  >
                    <Droplets className="w-3.5 h-3.5 text-sky-700" />
                    Bouillir l'eau (1h)
                  </button>
                )}

                <button
                  onClick={() => onExecuterAction({ type: 'ENTRETENIR_EQUIPEMENT' })}
                  disabled={chargement || (etat.personnage.monnaies.po * 10 + etat.personnage.monnaies.pa) < 4}
                  className="px-2.5 py-1.5 bg-white hover:bg-stone-100 text-stone-700 rounded-md border border-stone-300 flex items-center gap-1.5 transition-colors"
                >
                  <Wrench className="w-3.5 h-3.5 text-stone-500" />
                  Entretenir équipement (4 PA)
                </button>

                {etat.personnage.experience >= etat.personnage.experienceNextLevel && etat.personnage.niveau < 5 && (
                  <button
                    onClick={() => onExecuterAction({ type: 'ENTRAINEMENT_NIVEAU' })}
                    disabled={chargement || etat.personnage.monnaies.po < 5}
                    className="px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white font-medium rounded-md shadow-xs flex items-center gap-1.5 transition-colors"
                  >
                    <GraduationCap className="w-3.5 h-3.5" />
                    Passer niveau {etat.personnage.niveau + 1} (5 PO)
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Suggestions d'orientation du Maître du Jeu */}
      {!estMort && !estInconscient && dernierEvt?.suggestionsMJ && (
        <GameMasterSuggestions
          suggestions={dernierEvt.suggestionsMJ}
          tonAmbiance={dernierEvt.tonAmbiance}
          chargement={chargement}
          onExecuterAction={onExecuterAction}
          onSelectTexte={sug => onExecuterAction({ type: 'ACTION_LIBRE', texteLibre: sug })}
        />
      )}

      {/* Saisie d'action libre en ligne */}
      {!estMort && !estInconscient && (
        <form onSubmit={soumettreTexteLibre} className="flex gap-2 pt-2 border-t border-stone-200">
          <input
            type="text"
            value={texteLibre}
            onChange={e => setTexteLibre(e.target.value)}
            disabled={chargement}
            placeholder="Action libre : scruter la lisière, fouiller les traces, crocheter..."
            className="flex-1 bg-stone-50 border border-stone-300 rounded-md px-3 py-1.5 text-stone-900 placeholder-stone-400 focus:outline-none focus:bg-white focus:border-stone-500 text-xs transition-colors"
          />
          <button
            type="submit"
            disabled={chargement || !texteLibre.trim()}
            className="px-3 py-1.5 bg-stone-900 hover:bg-stone-800 disabled:opacity-40 text-white font-medium rounded-md flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Agir</span>
          </button>
        </form>
      )}
    </div>
  );
};
