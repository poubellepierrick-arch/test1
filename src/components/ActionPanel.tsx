import React, { useState, useEffect } from 'react';
import { SimulationState, HexNode, Pace, ExplorationRole } from '../types';
import { ActionRequest } from '../engine/adjudication';
import { evaluerContexteLieu } from '../engine/context';
import { calculerDistanceHex } from '../engine/hexcrawl';
import { obtenirArmeActive, estDansObscuriteSansLumiere, evaluerVitesseEffective } from '../engine/character';
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
  Flame,
  Dices,
} from 'lucide-react';
import { WorkBoardPanel } from './WorkBoardPanel';
import { LocalMarketPanel } from './LocalMarketPanel';
import { NpcDialogPanel } from './NpcDialogPanel';
import { HirelingsPanel } from './HirelingsPanel';
import { RumorsFeed } from './RumorsFeed';
import { DungeonTacticalView } from './DungeonTacticalView';
import { SpellbookPanel } from './SpellbookPanel';
import { CraftingPanel } from './CraftingPanel';

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
  const [sortCombatId, setSortCombatId] = useState<string>('');
  const [confirmationEnLigne, setConfirmationEnLigne] = useState<{
    titre: string;
    details: string;
    actionAConfirmer: () => void;
  } | null>(null);

  const estMort = etat.personnage.estMortDefinitivement;
  const enCombat = etat.combat.actif;
  const estInconscient = etat.personnage.pvActuels === 0 && !estMort;
  const ctx = evaluerContexteLieu(etat);
  const soldePA = etat.personnage.monnaies.po * 10 + etat.personnage.monnaies.pa;
  const dernierEvt = etat.journalNarratif && etat.journalNarratif.length > 0
    ? etat.journalNarratif[etat.journalNarratif.length - 1]
    : undefined;
  const pnjApprocheVisible =
    dernierEvt?.pnjApproche && ctx.pnjsEnVue.some(p => p.id === dernierEvt.pnjApproche!.id)
      ? dernierEvt.pnjApproche
      : undefined;

  const sortsDisponiblesCombat = (etat.personnage.sortsConnus || []).filter(s => {
    if (s.niveau === 0) return true;
    const estPrepare = (etat.personnage.sortsPrepares || []).includes(s.id);
    if (!estPrepare) return false;
    const slot = etat.personnage.emplacementsSorts.find(e => e.niveau === s.niveau);
    return Boolean(slot && slot.total - slot.utilise > 0);
  });

  useEffect(() => {
    if (sortsDisponiblesCombat.length > 0 && !sortsDisponiblesCombat.some(s => s.id === sortCombatId)) {
      setSortCombatId(sortsDisponiblesCombat[0].id);
    }
  }, [sortsDisponiblesCombat, sortCombatId]);

  const dansNoir = estDansObscuriteSansLumiere(etat);
  const distHexSelectionne = hexCibleSelectionne ? calculerDistanceHex(etat.hexActuel, hexCibleSelectionne) : 0;
  const estHexCibleEau = Boolean(hexCibleSelectionne?.estEau);
  const estHexAdjacent = Boolean(hexCibleSelectionne && distHexSelectionne === 1 && !estHexCibleEau);

  // Repli vers Voyage si l'onglet actif devient indisponible après déplacement ou entrée en site
  useEffect(() => {
    const ongletInvalide =
      (ongletAction === 'comptoir' && !ctx.peutCommercer) ||
      (ongletAction === 'corvees' && !ctx.peutCorvees) ||
      (ongletAction === 'dialogue' && !ctx.peutDialoguer) ||
      (ongletAction === 'compagnons' && !ctx.ongletCompagnonsActif) ||
      (ongletAction === 'rumeurs' && !ctx.ongletRumeursActif) ||
      (ongletAction === 'artisanat' && ctx.enDonjon);

    if (ongletInvalide) {
      setOngletAction('survie');
    }
  }, [
    etat.hexActuel.id,
    ctx.peutCommercer,
    ctx.peutCorvees,
    ctx.peutDialoguer,
    ctx.ongletCompagnonsActif,
    ctx.ongletRumeursActif,
    ctx.enDonjon,
    ongletAction,
  ]);

  const handleDeplacement = () => {
    if (!hexCibleSelectionne) return;

    if (etat.personnage.heuresMarcheJour >= 8) {
      setConfirmationEnLigne({
        titre: 'Marche forcée',
        details: `${etat.personnage.heuresMarcheJour.toFixed(1)}h de marche. Risque d'épuisement (CON DD ${10 + Math.max(1, Math.round(etat.personnage.heuresMarcheJour - 7))}).`,
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
    const { contexteRepos } = ctx;
    if (contexteRepos.estEnBourgade && contexteRepos.peutPayerAuberge) {
      onExecuterAction({ type: 'REPOS_LONG' });
      return;
    }

    setConfirmationEnLigne({
      titre: contexteRepos.estEnBourgade ? 'Nuit sans auberge' : `Bivouac · ${etat.hexActuel.nom}`,
      details: contexteRepos.detailsRisque,
      actionAConfirmer: () => {
        onExecuterAction({ type: 'REPOS_LONG' });
        setConfirmationEnLigne(null);
      },
    });
  };

  const soumettreTexteLibre = (e: React.FormEvent) => {
    e.preventDefault();
    if (!texteLibre.trim() || chargement || estMort) return;
    onExecuterAction({ type: 'ACTION_LIBRE', texteLibre: texteLibre.trim() });
    setTexteLibre('');
  };

  if (estMort) {
    return (
      <div className="dnd-panel border-rose-800/40 rounded-lg p-4 text-xs space-y-3">
        <div className="font-display text-rose-900 font-bold text-sm">
          Mort définitive : personnage décédé.
        </div>
        <p className="text-[#5c4734] leading-relaxed">
          Trois échecs de sauvegarde contre la mort enregistrés.
        </p>
        <div className="pt-2 border-t border-[#d6c298]">
          <button
            onClick={onReset}
            disabled={chargement}
            className="px-3.5 py-2 dnd-wood-bar border rounded-md font-medium flex items-center gap-2 shadow-xs transition-opacity hover:opacity-95 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#dfba68]" />
            Nouveau personnage
          </button>
        </div>
      </div>
    );
  }

  if (etat.journalNarratif.length === 0) {
    return (
      <div className="dnd-panel rounded-lg p-3.5 text-xs flex flex-wrap items-center justify-between gap-2">
        <span className="text-[#5c4734]">
          {chargement
            ? 'Le Maître du Jeu prépare la scène d’ouverture...'
            : 'Ouverture du monde requise avant d’agir.'}
        </span>
        {!chargement && (
          <button
            type="button"
            onClick={() => onExecuterAction({ type: 'OUVERTURE_CAMPAGNE' })}
            className="px-3 py-1.5 dnd-wood-bar border rounded-md font-medium flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#dfba68]" />
            <span>Ouvrir la scène</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="dnd-panel rounded-lg p-3.5 text-xs space-y-3">
      {/* Jet demandé en attente (en ligne) */}
      {etat.jetEnAttente && (
        <div className="bg-amber-50 border border-amber-400 rounded-md px-3 py-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Dices className="w-4 h-4 text-amber-800 shrink-0" />
            <div className="min-w-0">
              <div className="font-semibold text-[#3a250d] truncate">
                {etat.jetEnAttente.titre}
              </div>
              <div className="text-[11px] text-[#6d4f28] font-mono">
                {etat.jetEnAttente.competence || etat.jetEnAttente.caracteristique} · DD {etat.jetEnAttente.dd}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              disabled={chargement}
              onClick={() =>
                onExecuterAction({
                  type: 'RESOUDRE_JET_DEMANDE',
                  payloadAction: { jetId: etat.jetEnAttente!.id, choix: 'lancer' },
                })
              }
              className="px-3 py-1 dnd-wood-bar border rounded font-medium cursor-pointer disabled:opacity-50"
            >
              Lancer d20
            </button>
            {etat.jetEnAttente.optionAlternative && (
              <button
                type="button"
                disabled={chargement}
                onClick={() =>
                  onExecuterAction({
                    type: 'RESOUDRE_JET_DEMANDE',
                    payloadAction: { jetId: etat.jetEnAttente!.id, choix: 'alternatif' },
                  })
                }
                className="px-2.5 py-1 bg-white hover:bg-stone-100 border border-[#bfa574] rounded text-[#3b2c1e] cursor-pointer disabled:opacity-50"
              >
                {etat.jetEnAttente.optionAlternative}
              </button>
            )}
          </div>
        </div>
      )}

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
            <div className="text-[11px] text-stone-600">Sauvegarde contre la mort requise (3 échecs = mort).</div>
          </div>
          <button
            onClick={() => onExecuterAction({ type: 'JETS_MORT' })}
            disabled={chargement}
            className="px-3 py-1.5 bg-rose-700 hover:bg-rose-800 text-white font-medium rounded-md shadow-xs flex items-center gap-1.5 transition-colors"
          >
            <HeartPulse className="w-4 h-4" />
            Jet de mort (d20)
          </button>
        </div>
      ) : enCombat ? (
        /* Actions de Combat Tactique D&D 5e */
        (() => {
          const ennemisActifs = etat.combat.ennemis.filter(e => e.statut === 'ACTIF');
          const cibleObj =
            (cibleCombatSelectionnee && ennemisActifs.find(e => e.id === cibleCombatSelectionnee)) ||
            ennemisActifs[0];
          const armeActive = obtenirArmeActive(etat.personnage);
          const actionDispo = etat.combat.actionDisponible !== false;
          const bonusDispo = etat.combat.actionBonusDisponible !== false;
          const mouvementRestant = etat.combat.mouvementRestantPieds ?? evaluerVitesseEffective(etat.personnage);
          const horsPorteeMelee = Boolean(!armeActive.estDistance && cibleObj && cibleObj.distancePieds > 5);
          const horsPorteeDistance = Boolean(
            armeActive.estDistance && cibleObj && cibleObj.distancePieds > armeActive.porteeLonguePieds
          );
          const potionSoin = etat.personnage.inventaire.find(i => {
            const n = i.nom.toLowerCase();
            return n.includes('potion') && n.includes('soin');
          });
          const sortActuel = sortsDisponiblesCombat.find(s => s.id === sortCombatId) || sortsDisponiblesCombat[0];
          const sortEstBonus = Boolean(sortActuel?.tempsIncantation.toLowerCase().includes('action bonus'));
          const peutLancerSort = Boolean(sortActuel && (sortEstBonus ? bonusDispo : actionDispo));

          return (
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-rose-900 font-semibold text-xs border-b border-rose-100 pb-1.5">
                <span className="flex items-center gap-1.5">
                  <Swords className="w-4 h-4 text-rose-700" />
                  Combat · Round {etat.combat.round}
                </span>
                <span className="text-[11px] text-[#5c4734] font-mono tabular-nums font-normal">
                  Action: {actionDispo ? 'Prête' : 'Usée'} · Mvt: {mouvementRestant} ft · Bonus: {bonusDispo ? 'Prête' : 'Usée'}
                </span>
              </div>

              {dansNoir && (
                <div className="bg-amber-50 border border-amber-300 rounded px-2.5 py-1.5 flex items-center justify-between gap-2 text-[11px] text-amber-900">
                  <span>Obscurité : désavantage sans lumière.</span>
                  <button
                    type="button"
                    onClick={() => onExecuterAction({ type: 'BASCULER_LUMIERE', payloadAction: { active: true } })}
                    disabled={chargement}
                    className="px-2 py-0.5 bg-amber-700 text-white rounded text-[10px] font-medium cursor-pointer"
                  >
                    Allumer torche
                  </button>
                </div>
              )}

              {/* Mouvement tactique */}
              {cibleObj && (
                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  <span className="text-[#5c4734] font-mono tabular-nums">
                    Cible : <strong>{cibleObj.nom}</strong> ({cibleObj.distancePieds} ft)
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      onExecuterAction({
                        type: 'DEPLACER_COMBAT',
                        cibleId: cibleObj.id,
                        payloadAction: { direction: 'rapprocher', distance: 15 },
                      })
                    }
                    disabled={chargement || mouvementRestant < 5 || cibleObj.distancePieds <= 5}
                    className="px-2 py-1 bg-[#f5edd8] hover:bg-[#ebe0c4] disabled:opacity-40 border border-[#cbb384] rounded text-[11px] cursor-pointer"
                  >
                    Approcher (-15 ft)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onExecuterAction({
                        type: 'DEPLACER_COMBAT',
                        cibleId: cibleObj.id,
                        payloadAction: { direction: 'eloigner', distance: 15 },
                      })
                    }
                    disabled={chargement || mouvementRestant < 5}
                    title={cibleObj.distancePieds <= 5 && !etat.combat.desengage ? 'Déclenche une attaque d’opportunité sans Désengagement' : 'Reculer de 15 ft'}
                    className="px-2 py-1 bg-[#f5edd8] hover:bg-[#ebe0c4] disabled:opacity-40 border border-[#cbb384] rounded text-[11px] cursor-pointer"
                  >
                    Reculer (+15 ft)
                  </button>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => {
                    if (cibleObj) onExecuterAction({ type: 'ATTAQUER', cibleId: cibleObj.id });
                  }}
                  disabled={chargement || !cibleObj || !actionDispo || horsPorteeMelee || horsPorteeDistance}
                  title={
                    horsPorteeMelee
                      ? `Hors de portée (${cibleObj?.distancePieds} ft). Approchez à 5 ft.`
                      : horsPorteeDistance
                      ? `Hors de portée (${armeActive.porteeLonguePieds} ft max).`
                      : armeActive.nom
                  }
                  className="px-3 py-1.5 bg-rose-700 hover:bg-rose-800 disabled:bg-stone-200 disabled:text-stone-400 text-white font-medium rounded-md shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Swords className="w-3.5 h-3.5" />
                  <span>Attaquer ({armeActive.nom})</span>
                </button>

                <button
                  onClick={() => onExecuterAction({ type: 'ESQUIVER' })}
                  disabled={chargement || !cibleObj || !actionDispo}
                  className="px-2.5 py-1.5 bg-white hover:bg-stone-100 disabled:opacity-40 text-stone-800 rounded-md border border-stone-300 shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Désavantage aux attaques ennemies"
                >
                  <Shield className="w-3.5 h-3.5 text-sky-700" />
                  Esquiver
                </button>

                <button
                  onClick={() => onExecuterAction({ type: 'DESENGAGER_COMBAT' })}
                  disabled={chargement || !cibleObj || !actionDispo}
                  className="px-2.5 py-1.5 bg-white hover:bg-stone-100 disabled:opacity-40 text-stone-800 rounded-md border border-stone-300 shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Quitter le corps-à-corps sans attaque d'opportunité"
                >
                  <Footprints className="w-3.5 h-3.5 text-emerald-700" />
                  Désengager
                </button>

                {sortsDisponiblesCombat.length > 0 && (
                  <div className="flex items-center gap-1">
                    <select
                      value={sortActuel?.id || ''}
                      onChange={e => setSortCombatId(e.target.value)}
                      className="bg-[#fffdf7] border border-indigo-200 rounded px-2 py-1.5 text-[11px] text-indigo-950"
                    >
                      {sortsDisponiblesCombat.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.nom} ({s.niveau === 0 ? 'Tour' : `Niv ${s.niveau}`})
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => {
                        if (!sortActuel) return;
                        onExecuterAction({
                          type: 'LANCER_SORT_GRIMOIRE',
                          cibleId: sortActuel.id,
                          payloadAction: { sortId: sortActuel.id, cibleCombatId: cibleObj?.id },
                        });
                      }}
                      disabled={chargement || !cibleObj || !peutLancerSort}
                      className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-40 text-indigo-900 rounded-md border border-indigo-200 flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-indigo-700" />
                      Lancer
                    </button>
                  </div>
                )}

                {potionSoin && (
                  <button
                    onClick={() => onExecuterAction({ type: 'UTILISER_OBJET', cibleId: potionSoin.id })}
                    disabled={chargement || !actionDispo}
                    className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-40 text-emerald-900 rounded-md border border-emerald-300 flex items-center gap-1 cursor-pointer"
                  >
                    <HeartPulse className="w-3.5 h-3.5" />
                    Potion
                  </button>
                )}

                <button
                  onClick={() => onExecuterAction({ type: 'FUIR_TACTIQUE' })}
                  disabled={chargement}
                  className="px-2.5 py-1.5 bg-white hover:bg-stone-100 text-stone-700 rounded-md border border-stone-300 shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Footprints className="w-3.5 h-3.5 text-amber-700" />
                  Fuir
                </button>

                <button
                  onClick={() => onExecuterAction({ type: 'TOUR_ENNEMI' })}
                  disabled={chargement || ennemisActifs.length === 0}
                  className={`px-3 py-1.5 rounded-md border ml-auto transition-colors cursor-pointer ${
                    !actionDispo
                      ? 'dnd-wood-bar font-medium'
                      : 'bg-stone-100 hover:bg-stone-200 text-stone-800 border-stone-300'
                  }`}
                >
                  Fin du tour
                </button>
              </div>
              {horsPorteeMelee && (
                <div className="text-[11px] text-amber-800">
                  Adversaire à {cibleObj?.distancePieds} ft : approchez à 5 ft pour frapper au corps-à-corps.
                </div>
              )}
            </div>
          );
        })()
      ) : (
        /* Actions Hors Combat */
        <div className="space-y-3">
          {/* Bandeau contextuel */}
          <div className="flex items-center justify-between bg-[#f4ead2]/80 border border-[#d6c298] px-2.5 py-1.5 rounded-md text-[11px] text-[#5c4734] gap-2">
            <span className="font-medium text-[#2a1d13] truncate">{ctx.resumeLieu}</span>
            <span className="truncate">
              {etat.hexActuel.nom}
              {ctx.pnjsEnVue.length > 0 ? ` · ${ctx.pnjsEnVue.length} PNJ en vue` : ''}
            </span>
          </div>

          {/* Avis en ligne lorsqu'un PNJ itinérant approche */}
          {pnjApprocheVisible && (
            <div className="bg-sky-950/[0.05] border border-sky-800/30 rounded-md px-2.5 py-1.5 flex items-center justify-between gap-2 text-[11px] text-sky-950">
              <span className="truncate">
                <strong>{pnjApprocheVisible.nom}</strong> ({pnjApprocheVisible.role}) : {pnjApprocheVisible.motif}
              </span>
              <button
                onClick={() => setOngletAction('dialogue')}
                className="px-2 py-0.5 bg-sky-800 hover:bg-sky-900 text-white rounded font-medium shrink-0 cursor-pointer"
              >
                Parler
              </button>
            </div>
          )}

          {/* Sélecteur d'onglets avec grisement et lieu requis */}
          <div className="flex flex-wrap items-center gap-1.5 border-b border-[#d6c298] pb-2.5">
            <button
              onClick={() => setOngletAction('survie')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer ${
                ongletAction === 'survie'
                  ? 'dnd-wood-bar border shadow-2xs'
                  : 'bg-[#f3e9d2] text-[#4d3b29] hover:text-[#231a14] border border-[#d4be94]'
              }`}
            >
              <Compass className={`w-3 h-3 ${ongletAction === 'survie' ? 'text-[#e5be6e]' : 'text-[#8c6422]'}`} />
              Voyage & Repos
            </button>

            <button
              onClick={() => ctx.peutCommercer && setOngletAction('comptoir')}
              disabled={!ctx.peutCommercer}
              title={!ctx.peutCommercer ? ctx.raisonCommerce : 'Comptoir'}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium flex items-center gap-1 transition-colors ${
                !ctx.peutCommercer
                  ? 'bg-[#f6efe0]/60 text-[#9c876c] border border-dashed border-[#d4be94] cursor-not-allowed'
                  : ongletAction === 'comptoir'
                  ? 'dnd-wood-bar border shadow-2xs cursor-pointer'
                  : 'bg-[#f3e9d2] text-[#4d3b29] hover:text-[#231a14] border border-[#d4be94] cursor-pointer'
              }`}
            >
              <ShoppingBag className={`w-3 h-3 ${ongletAction === 'comptoir' ? 'text-[#e5be6e]' : ''}`} />
              <span>Comptoir</span>
              {!ctx.peutCommercer && <span className="text-[10px] opacity-80">· Bourgade</span>}
            </button>

            <button
              onClick={() => ctx.peutCorvees && setOngletAction('corvees')}
              disabled={!ctx.peutCorvees}
              title={!ctx.peutCorvees ? ctx.raisonCorvees : 'Corvées'}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium flex items-center gap-1 transition-colors ${
                !ctx.peutCorvees
                  ? 'bg-[#f6efe0]/60 text-[#9c876c] border border-dashed border-[#d4be94] cursor-not-allowed'
                  : ongletAction === 'corvees'
                  ? 'dnd-wood-bar border shadow-2xs cursor-pointer'
                  : 'bg-[#f3e9d2] text-[#4d3b29] hover:text-[#231a14] border border-[#d4be94] cursor-pointer'
              }`}
            >
              <Hammer className={`w-3 h-3 ${ongletAction === 'corvees' ? 'text-[#e5be6e]' : ''}`} />
              <span>Corvées</span>
              {!ctx.peutCorvees && <span className="text-[10px] opacity-80">· Bourgade/Fort</span>}
            </button>

            <button
              onClick={() => ctx.peutDialoguer && setOngletAction('dialogue')}
              disabled={!ctx.peutDialoguer}
              title={!ctx.peutDialoguer ? ctx.raisonDialogue : 'Dialogue'}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium flex items-center gap-1 transition-colors ${
                !ctx.peutDialoguer
                  ? 'bg-[#f6efe0]/60 text-[#9c876c] border border-dashed border-[#d4be94] cursor-not-allowed'
                  : ongletAction === 'dialogue'
                  ? 'dnd-wood-bar border shadow-2xs cursor-pointer'
                  : 'bg-[#f3e9d2] text-[#4d3b29] hover:text-[#231a14] border border-[#d4be94] cursor-pointer'
              }`}
            >
              <MessageSquare className={`w-3 h-3 ${ongletAction === 'dialogue' ? 'text-[#e5be6e]' : ''}`} />
              <span>Dialogue</span>
              {!ctx.peutDialoguer && <span className="text-[10px] opacity-80">· PNJ en vue</span>}
            </button>

            <button
              onClick={() => ctx.ongletCompagnonsActif && setOngletAction('compagnons')}
              disabled={!ctx.ongletCompagnonsActif}
              title={!ctx.ongletCompagnonsActif ? ctx.raisonCompagnons : 'Compagnons'}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium flex items-center gap-1 transition-colors ${
                !ctx.ongletCompagnonsActif
                  ? 'bg-[#f6efe0]/60 text-[#9c876c] border border-dashed border-[#d4be94] cursor-not-allowed'
                  : ongletAction === 'compagnons'
                  ? 'dnd-wood-bar border shadow-2xs cursor-pointer'
                  : 'bg-[#f3e9d2] text-[#4d3b29] hover:text-[#231a14] border border-[#d4be94] cursor-pointer'
              }`}
            >
              <Users className={`w-3 h-3 ${ongletAction === 'compagnons' ? 'text-[#e5be6e]' : ''}`} />
              <span>Compagnons ({etat.personnage.compagnons?.length || 0})</span>
              {!ctx.ongletCompagnonsActif && <span className="text-[10px] opacity-80">· Bourgade/Fort</span>}
            </button>

            <button
              onClick={() => ctx.ongletRumeursActif && setOngletAction('rumeurs')}
              disabled={!ctx.ongletRumeursActif}
              title={!ctx.ongletRumeursActif ? ctx.raisonRumeurs : 'Rumeurs'}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium flex items-center gap-1 transition-colors ${
                !ctx.ongletRumeursActif
                  ? 'bg-[#f6efe0]/60 text-[#9c876c] border border-dashed border-[#d4be94] cursor-not-allowed'
                  : ongletAction === 'rumeurs'
                  ? 'dnd-wood-bar border shadow-2xs cursor-pointer'
                  : 'bg-[#f3e9d2] text-[#4d3b29] hover:text-[#231a14] border border-[#d4be94] cursor-pointer'
              }`}
            >
              <Radio className={`w-3 h-3 ${ongletAction === 'rumeurs' ? 'text-[#e5be6e]' : ''}`} />
              <span>Rumeurs ({etat.rumeurs?.length || 0})</span>
              {!ctx.ongletRumeursActif && <span className="text-[10px] opacity-80">· PNJ en vue</span>}
            </button>

            <button
              onClick={() => setOngletAction('grimoire')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer ${
                ongletAction === 'grimoire'
                  ? 'dnd-wood-bar border shadow-2xs'
                  : 'bg-[#f3e9d2] text-[#4d3b29] hover:text-[#231a14] border border-[#d4be94]'
              }`}
            >
              <BookOpen className={`w-3 h-3 ${ongletAction === 'grimoire' ? 'text-[#e5be6e]' : ''}`} />
              Grimoire ({etat.personnage.sortsPrepares?.length || 0})
            </button>

            <button
              onClick={() => !ctx.enDonjon && setOngletAction('artisanat')}
              disabled={ctx.enDonjon}
              title={ctx.enDonjon ? 'Impossible sous terre' : 'Bivouac & Soins'}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium flex items-center gap-1 transition-colors ${
                ctx.enDonjon
                  ? 'bg-[#f6efe0]/60 text-[#9c876c] border border-dashed border-[#d4be94] cursor-not-allowed'
                  : ongletAction === 'artisanat'
                  ? 'dnd-wood-bar border shadow-2xs cursor-pointer'
                  : 'bg-[#f3e9d2] text-[#4d3b29] hover:text-[#231a14] border border-[#d4be94] cursor-pointer'
              }`}
            >
              <Hammer className={`w-3 h-3 ${ongletAction === 'artisanat' ? 'text-[#e5be6e]' : ''}`} />
              <span>Bivouac & Soins {etat.personnage.blessuresPersistantes?.length ? `(${etat.personnage.blessuresPersistantes.length})` : ''}</span>
              {ctx.enDonjon && <span className="text-[10px] opacity-80">· Surface</span>}
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
            <HirelingsPanel
              personnage={etat.personnage}
              recruesDisponiblesTypes={ctx.recruesDisponiblesTypes}
              peutEmbaucher={ctx.peutEmbaucher}
              raisonCompagnons={ctx.raisonCompagnons}
              chargement={chargement}
              onExecuterAction={onExecuterAction}
            />
          ) : ongletAction === 'rumeurs' ? (
            <RumorsFeed
              rumeurs={etat.rumeurs || []}
              pnjsEnVue={ctx.pnjsEnVue}
              chargement={chargement}
              onExecuterAction={onExecuterAction}
            />
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
              recettesDisponiblesIds={ctx.recettesDisponiblesIds}
              raisonsRecettes={ctx.raisonsRecettes}
              peutSoignerBlessure={ctx.peutSoignerBlessure}
              raisonSoin={ctx.raisonSoin}
              chargement={chargement}
              onExecuterAction={onExecuterAction}
            />
          ) : (
            /* Mode Survie & Déplacement */
            <div className="space-y-2.5">
              {/* Configuration Allure & Rôle de voyage */}
              <div className="flex flex-wrap items-center gap-2 bg-[#f5edd8]/70 border border-[#d6c298] px-2.5 py-1.5 rounded-md text-[11px]">
                <label className="flex items-center gap-1 text-[#5c4734]">
                  <span>Allure</span>
                  <select
                    value={etat.marcheAllure || 'Normale'}
                    disabled={chargement}
                    onChange={e =>
                      onExecuterAction({
                        type: 'CONFIGURER_VOYAGE',
                        payloadAction: { allure: e.target.value as Pace },
                      })
                    }
                    className="bg-[#fffdf7] border border-[#bfa574] rounded px-1.5 py-0.5 text-[#231a14]"
                  >
                    <option value="Lente">Lente (+2 nav)</option>
                    <option value="Normale">Normale</option>
                    <option value="Rapide">Rapide (-2 nav)</option>
                  </select>
                </label>

                <label className="flex items-center gap-1 text-[#5c4734]">
                  <span>Rôle</span>
                  <select
                    value={etat.roleExploration || "S'orienter"}
                    disabled={chargement}
                    onChange={e =>
                      onExecuterAction({
                        type: 'CONFIGURER_VOYAGE',
                        payloadAction: { role: e.target.value as ExplorationRole },
                      })
                    }
                    className="bg-[#fffdf7] border border-[#bfa574] rounded px-1.5 py-0.5 text-[#231a14]"
                  >
                    <option value="S'orienter">S&apos;orienter (+2 nav)</option>
                    <option value="Forager">Forager (vivres)</option>
                    <option value="Guetter">Guetter (+2 vig)</option>
                  </select>
                </label>

                {dansNoir && (
                  <button
                    type="button"
                    onClick={() => onExecuterAction({ type: 'BASCULER_LUMIERE', payloadAction: { active: true } })}
                    disabled={chargement}
                    className="ml-auto px-2 py-0.5 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded text-[10px] text-amber-950 flex items-center gap-1 cursor-pointer"
                  >
                    <Flame className="w-3 h-3 text-amber-700" />
                    Allumer torche
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleDeplacement}
                  disabled={chargement || !estHexAdjacent}
                  title={
                    !hexCibleSelectionne
                      ? 'Sélectionner un hex sur la carte'
                      : estHexCibleEau
                      ? 'Mer infranchissable à pied'
                      : distHexSelectionne === 0
                      ? 'Vous êtes déjà sur cet hex'
                      : !estHexAdjacent
                      ? `Hors portée directe (${distHexSelectionne} cases)`
                      : `Marcher vers ${hexCibleSelectionne.nom}`
                  }
                  className={`px-3.5 py-1.5 rounded-md flex items-center gap-1.5 font-medium transition-colors ${
                    estHexAdjacent
                      ? 'bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs cursor-pointer'
                      : 'bg-stone-100 text-stone-400 border border-stone-200 cursor-not-allowed'
                  }`}
                >
                  <Footprints className="w-3.5 h-3.5" />
                  {estHexAdjacent && hexCibleSelectionne
                    ? `Marcher vers ${hexCibleSelectionne.nom}`
                    : estHexCibleEau
                    ? 'Mer infranchissable'
                    : hexCibleSelectionne && distHexSelectionne > 1
                    ? `Hors portée (${distHexSelectionne} hex)`
                    : 'Marcher vers hex adjacent'}
                </button>

                <button
                  onClick={() => onExecuterAction({ type: 'FORAGER' })}
                  disabled={chargement}
                  className="px-3 py-1.5 bg-white hover:bg-stone-100 text-stone-800 rounded-md border border-stone-300 shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Search className="w-3.5 h-3.5 text-emerald-700" />
                  Forager (1h)
                </button>

                <button
                  onClick={() => onExecuterAction({ type: 'REPOS_COURT' })}
                  disabled={chargement}
                  className="px-3 py-1.5 bg-white hover:bg-stone-100 text-stone-800 rounded-md border border-stone-300 shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Sun className="w-3.5 h-3.5 text-amber-700" />
                  Repos court (1h)
                </button>

                <button
                  onClick={handleReposLong}
                  disabled={chargement}
                  title={ctx.contexteRepos.detailsRisque}
                  className="px-3 py-1.5 bg-white hover:bg-stone-100 text-stone-800 rounded-md border border-stone-300 shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Moon className="w-3.5 h-3.5 text-indigo-700" />
                  {ctx.contexteRepos.labelRepos}
                </button>
              </div>

              {/* Actions de terrain et de lieu */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-stone-200">
                {ctx.peutExplorerSite && etat.hexActuel.pointInteret && (
                  <button
                    onClick={() => onExecuterAction({ type: 'EXPLORER_SITE' })}
                    disabled={chargement}
                    className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-md border border-amber-300 font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Castle className="w-3.5 h-3.5 text-amber-700" />
                    Explorer : {etat.hexActuel.pointInteret.nom}
                  </button>
                )}

                {etat.personnage.eauLitres > 0 && etat.personnage.qualiteEau !== 'Pure' && (
                  <button
                    onClick={() => onExecuterAction({ type: 'BOUILLIR_EAU' })}
                    disabled={chargement}
                    className="px-2.5 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-900 rounded-md border border-sky-200 flex items-center gap-1.5 transition-colors"
                  >
                    <Droplets className="w-3.5 h-3.5 text-sky-700" />
                    Bouillir eau (1h)
                  </button>
                )}

                <button
                  onClick={() => onExecuterAction({ type: 'ENTRETENIR_EQUIPEMENT' })}
                  disabled={chargement || !ctx.peutEntretenirForge || soldePA < 4}
                  title={!ctx.peutEntretenirForge ? ctx.raisonForge : 'Réparer à la forge (4 PA)'}
                  className={`px-2.5 py-1.5 rounded-md border flex items-center gap-1.5 transition-colors ${
                    ctx.peutEntretenirForge && soldePA >= 4
                      ? 'bg-white hover:bg-stone-100 text-stone-700 border-stone-300'
                      : 'bg-stone-50 text-stone-400 border-dashed border-stone-200 cursor-not-allowed'
                  }`}
                >
                  <Wrench className="w-3.5 h-3.5" />
                  <span>Forge (4 PA)</span>
                  {!ctx.peutEntretenirForge && <span className="text-[10px] opacity-80">· Bourgade</span>}
                </button>

                {etat.personnage.experience >= etat.personnage.experienceNextLevel && etat.personnage.niveau < 5 && (
                  <button
                    onClick={() => onExecuterAction({ type: 'ENTRAINEMENT_NIVEAU' })}
                    disabled={chargement || !ctx.peutEntrainerNiveau || etat.personnage.monnaies.po < 5}
                    title={!ctx.peutEntrainerNiveau ? ctx.raisonEntrainement : 'Instructeur requis (5 PO)'}
                    className={`px-3 py-1.5 font-medium rounded-md shadow-xs flex items-center gap-1.5 transition-colors ${
                      ctx.peutEntrainerNiveau && etat.personnage.monnaies.po >= 5
                        ? 'bg-amber-700 hover:bg-amber-800 text-white'
                        : 'bg-stone-50 text-stone-400 border border-dashed border-stone-200 cursor-not-allowed shadow-none'
                    }`}
                  >
                    <GraduationCap className="w-3.5 h-3.5" />
                    <span>Niveau {etat.personnage.niveau + 1} (5 PO)</span>
                    {!ctx.peutEntrainerNiveau && <span className="text-[10px] opacity-80">· Bourgade/Fort</span>}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Saisie d'action libre en ligne */}
      {!estMort && !estInconscient && (
        <form onSubmit={soumettreTexteLibre} className="flex gap-2 pt-2.5 border-t border-[#d6c298]">
          <input
            type="text"
            value={texteLibre}
            onChange={e => setTexteLibre(e.target.value)}
            disabled={chargement}
            placeholder="Action libre : scruter la lisière, fouiller les traces, crocheter..."
            className="flex-1 bg-[#fffdf7] border border-[#bfa574] rounded-md px-3 py-1.5 text-[#231a14] placeholder-[#947d61] focus:outline-none focus:border-[#8c6422] text-xs transition-colors"
          />
          <button
            type="submit"
            disabled={chargement || !texteLibre.trim()}
            className="px-3.5 py-1.5 dnd-wood-bar border disabled:opacity-40 font-medium rounded-md flex items-center gap-1.5 shadow-xs transition-opacity cursor-pointer"
          >
            <Send className="w-3.5 h-3.5 text-[#dfba68]" />
            <span>Agir</span>
          </button>
        </form>
      )}
    </div>
  );
};
