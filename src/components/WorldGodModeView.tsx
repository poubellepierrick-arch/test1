import React, { useEffect, useState } from 'react';
import {
  AzgaarClimateBias,
  AzgaarCoatOfArms,
  AzgaarReliefPreset,
  AzgaarStylePreset,
  AzgaarTemplateId,
  AzgaarWorldState,
  SimulationState,
  HexNode,
  Faction,
  FactionDiplomacy,
  FactionPosture,
  WorldChronicleEntry,
  WorldForgeConfig,
  WorldForgeDraft,
  WorldForgeStep,
  WorldNpcRecord,
} from '../types';
import {
  FastForward,
  Shield,
  Activity,
  Database,
  ScrollText,
  Users,
  Globe,
  Crown,
  ArrowRight,
  Flame,
  Wand2,
  BookOpen,
  Sparkles,
  EyeOff,
} from 'lucide-react';
import { AzgaarGeneratorPanel } from './AzgaarGeneratorPanel';
import { AzgaarGodmodeOverlay, AzgaarStudioView } from './AzgaarStudioView';
import { CoatOfArmsSvg } from './CoatOfArmsSvg';
import { MjWorldConsole } from './MjWorldConsole';
import { WorldForgeWizard } from './WorldForgeWizard';
import { MjWorldCommand } from '../engine/mjWorldEngine';
import { RESSOURCES_CATALOGUE } from '../engine/worldEconomy';

interface WorldGodModeViewProps {
  etat: SimulationState;
  chargement: boolean;
  onAvancerTemps?: (heures: number, avecSupervisionIa: boolean) => void;
  onAvancerTicks?: (ticks: number) => void;
  onGenererMonde?: (config: {
    seed: number;
    modeleRelief?: AzgaarReliefPreset;
    template?: AzgaarTemplateId;
    climatBias?: AzgaarClimateBias;
    climateBias?: AzgaarClimateBias;
    rayonAnneaux?: number;
    cellsDesired?: 800 | 1500 | 2400;
    windAngle?: number;
    worldName?: string;
    stylePreset?: AzgaarStylePreset;
    statesCount?: number;
    culturesCount?: number;
    religionsCount?: number;
    burgsCount?: number;
    conserverHeros?: boolean;
  }) => void;
  onRestaurerValGris?: () => void;
  onSyncAzgaar: (studio: AzgaarWorldState) => void;
  onImporterAzgaar: (rawText: string) => void;
  onActionMJ?: (cmd: MjWorldCommand) => void | Promise<void>;
  onInitialiserForge?: (config?: Partial<WorldForgeConfig>) => Promise<WorldForgeDraft>;
  onExecuterEtapeForge?: (
    draft: WorldForgeDraft,
    step: WorldForgeStep,
    opts?: { regenererGeometrie?: boolean; signal?: AbortSignal }
  ) => Promise<{ draft: WorldForgeDraft; source: 'GEMINI' | 'PROCEDURAL'; note?: string }>;
  onAppliquerForge?: (draft: WorldForgeDraft) => Promise<void>;
  onPromouvoirPnjs?: (npcIds?: string[]) => Promise<void>;
  ouvrirForgeInitial?: boolean;
  onConsommerOuvrirForge?: () => void;
}

type CoucheAtlasPreset =
  | 'politique'
  | 'biomes'
  | 'economie'
  | 'cultures'
  | 'religions'
  | 'danger'
  | 'ecologie'
  | 'peuplement'
  | 'trafic';

type SousOngletGodmode = 'regie' | 'economie' | 'lore_pnj' | 'unites' | 'savoir' | 'chronique';

const POSTURE_LABEL: Record<string, string> = {
  EXPANSION: 'Expansion',
  DEFENSE: 'Défense',
  COMMERCE: 'Commerce',
  RAID: 'Raid',
  TREVE: 'Trêve',
};

const DIPLO_LABEL: Record<FactionDiplomacy, string> = {
  GUERRE: 'Guerre',
  TENSION: 'Tension',
  NEUTRE: 'Neutre',
  PACTE: 'Pacte',
};

const DIPLO_TEXT_CLASS: Record<FactionDiplomacy, string> = {
  GUERRE: 'text-rose-800 font-semibold',
  TENSION: 'text-amber-800 font-semibold',
  NEUTRE: 'text-[#5c4734]',
  PACTE: 'text-emerald-800 font-semibold',
};

const BROUILLARD_JOUEUR_LABEL: Record<string, string> = {
  INCONNU: 'Inconnu joueur',
  REPERE: 'Repéré joueur',
  EXPLORE: 'Exploré joueur',
};

const BROUILLARD_TABLE_LABEL: Record<string, string> = {
  INCONNU: 'Inconnu',
  REPERE: 'Repéré',
  EXPLORE: 'Exploré',
};

const TYPE_ENTITE_LABEL: Record<string, string> = {
  CARAVANE: 'Caravane',
  PATROUILLE: 'Patrouille',
  RAIDER: 'Raider',
  MESSAGER: 'Messager',
  REFUGIES: 'Réfugiés',
};

const STATUT_ENTITE_LABEL: Record<string, string> = {
  EN_ROUTE: 'En route',
  ARRIVE: 'Arrivée',
  INTERCEPTE: 'Interceptée',
  DISPERSE: 'Dispersée',
  DETRUIT: 'Détruite',
};

const CHRONIQUE_CAT_LABEL: Record<WorldChronicleEntry['categorie'], string> = {
  FACTION: 'Faction',
  DIPLOMATIE: 'Diplomatie',
  MOUVEMENT: 'Mouvement',
  ECONOMIE: 'Économie',
  METEO: 'Météo',
  EVENEMENT: 'Événement',
  SUPERVISION_IA: 'Supervision IA',
};

function nomCourtFaction(id: string | null | undefined, factions: Faction[]): string {
  if (!id) return 'Neutre';
  if (id === 'faction_guilde_marchande') return 'Ligue';
  if (id === 'faction_iron_shield') return 'Bouclier';
  if (id === 'faction_orcs') return 'Clan Borgne';
  return factions.find(f => f.id === id)?.nom || id;
}

const FALLBACK_COAS: Record<string, AzgaarCoatOfArms> = {
  faction_guilde_marchande: {
    fieldColor: '#a16207',
    secondaryColor: '#f3d37a',
    division: 'parti',
    charge: 'couronne',
    chargeColor: '#fffbeb',
  },
  faction_iron_shield: {
    fieldColor: '#1e3a8a',
    secondaryColor: '#cbd5e1',
    division: 'pal',
    charge: 'bouclier',
    chargeColor: '#f8fafc',
  },
  faction_orcs: {
    fieldColor: '#7f1d1d',
    secondaryColor: '#292524',
    division: 'chevron',
    charge: 'epee',
    chargeColor: '#fca5a5',
  },
};

function obtenirBlasonFaction(
  faction: Faction,
  idx: number,
  studio?: AzgaarWorldState
): AzgaarCoatOfArms {
  const matchedState = studio?.states.find(
    s => s.factionId === faction.id || s.name === faction.nom
  );
  if (matchedState?.coa) return matchedState.coa;
  if (FALLBACK_COAS[faction.id]) return FALLBACK_COAS[faction.id];
  const palette = ['#2f5d7c', '#7c2f3e', '#3e6b48', '#8a6220'];
  return {
    fieldColor: palette[idx % palette.length],
    secondaryColor: '#f3d37a',
    division: 'ecartele',
    charge: idx % 2 === 0 ? 'lion' : 'tour',
    chargeColor: '#fff7ed',
  };
}

export const WorldGodModeView: React.FC<WorldGodModeViewProps> = ({
  etat,
  chargement,
  onAvancerTemps,
  onAvancerTicks,
  onGenererMonde,
  onRestaurerValGris,
  onSyncAzgaar,
  onImporterAzgaar,
  onActionMJ,
  onInitialiserForge,
  onExecuterEtapeForge,
  onAppliquerForge,
  onPromouvoirPnjs,
  ouvrirForgeInitial = false,
  onConsommerOuvrirForge,
}) => {
  const [presetCouche, setPresetCouche] = useState<CoucheAtlasPreset>('politique');
  const [sousOnglet, setSousOnglet] = useState<SousOngletGodmode>('economie');
  const [carteAgrandie, setCarteAgrandie] = useState(false);
  const [afficherAtlas, setAfficherAtlas] = useState(false);
  const [forgeOuverte, setForgeOuverte] = useState(ouvrirForgeInitial);
  const [supervisionIa, setSupervisionIa] = useState(false);
  const [hexSelectionneId, setHexSelectionneId] = useState<string>(
    etat.hexActuel?.id || etat.hexagones[0]?.id || ''
  );
  const [filtreEntites, setFiltreEntites] = useState<'tout' | 'EN_ROUTE' | 'historique'>('tout');
  const [filtreChronique, setFiltreChronique] = useState<'TOUT' | WorldChronicleEntry['categorie']>('TOUT');
  const [filtreTierPnj, setFiltreTierPnj] = useState<'TOUS' | WorldNpcRecord['tier']>('TOUS');
  const [promotionEnCours, setPromotionEnCours] = useState(false);

  useEffect(() => {
    if (ouvrirForgeInitial) {
      setForgeOuverte(true);
      onConsommerOuvrirForge?.();
    }
  }, [ouvrirForgeInitial, onConsommerOuvrirForge]);

  const hexagones = etat.hexagones || [];
  const factions = etat.factions || [];
  const entites = etat.entitesMonde || [];
  const chronique = etat.chroniqueMonde || [];
  const historique = etat.historiqueMonde || [];
  const loreMonde = etat.loreMonde;
  const pnjsMonde = etat.pnjsMonde || [];

  const hexInspecte: HexNode | undefined =
    hexagones.find(h => h.id === hexSelectionneId) || hexagones[0];

  const hexNom = (id: string) => hexagones.find(h => h.id === id)?.nom || id;

  const pressionMoy = Math.round(
    hexagones.reduce((acc, h) => acc + (h.pressionDanger ?? 35), 0) / Math.max(1, hexagones.length)
  );
  const prosperiteMoy = Math.round(
    hexagones.reduce((acc, h) => acc + (h.prosperite ?? 35), 0) / Math.max(1, hexagones.length)
  );
  const entitesEnRoute = entites.filter(e => e.statut === 'EN_ROUTE');

  // Application des préréglages de couche entre l'Atlas Azgaar et l'analyse Godmode
  const appliquerPresetCouche = (nextPreset: CoucheAtlasPreset) => {
    setPresetCouche(nextPreset);
    if (!etat.azgaarStudio) return;
    if (
      nextPreset === 'politique' ||
      nextPreset === 'biomes' ||
      nextPreset === 'economie' ||
      nextPreset === 'cultures' ||
      nextPreset === 'religions'
    ) {
      const nextLayers = {
        ...etat.azgaarStudio.layers,
        etats: nextPreset === 'politique',
        provinces: false,
        biomes: nextPreset === 'biomes' || nextPreset === 'politique' || nextPreset === 'economie',
        cultures: nextPreset === 'cultures',
        religions: nextPreset === 'religions',
        ressources: nextPreset === 'economie' ? true : etat.azgaarStudio.layers.ressources ?? true,
        fluxCommerciaux: nextPreset === 'economie' ? true : etat.azgaarStudio.layers.fluxCommerciaux ?? true,
      };
      onSyncAzgaar({ ...etat.azgaarStudio, layers: nextLayers });
    }
  };

  const godmodeOverlay: AzgaarGodmodeOverlay =
    presetCouche === 'danger' ||
    presetCouche === 'ecologie' ||
    presetCouche === 'peuplement' ||
    presetCouche === 'trafic'
      ? presetCouche
      : 'aucun';

  // Paires diplomatiques uniques
  const pairesDiplo: Array<{ a: Faction; b: Faction; rel: FactionDiplomacy }> = [];
  for (let i = 0; i < factions.length; i++) {
    for (let j = i + 1; j < factions.length; j++) {
      const a = factions[i];
      const b = factions[j];
      const rel = a.relationsFactions?.[b.id] || b.relationsFactions?.[a.id] || 'NEUTRE';
      pairesDiplo.push({ a, b, rel });
    }
  }

  // Données hexagone inspecté
  const acteursSurHex = etat.grapheNoeuds.filter(
    n =>
      n.type === 'Actor' &&
      (n.proprietes?.hexId === hexInspecte?.id ||
        etat.grapheLiens.some(
          l => l.relation === 'LOCATED_IN' && l.source === n.id && l.cible === hexInspecte?.id
        ))
  );
  const entitesSurHex = entites.filter(
    e => e.statut === 'EN_ROUTE' && e.hexId === hexInspecte?.id
  );
  const evenementsConnusHex = etat.grapheNoeuds.filter(
    n => n.type === 'Event' && hexInspecte && n.connuParEntites?.includes(hexInspecte.id)
  );

  // Entités filtrées
  const entitesFiltrees = entites.filter(e => {
    if (filtreEntites === 'EN_ROUTE') return e.statut === 'EN_ROUTE';
    if (filtreEntites === 'historique') return e.statut !== 'EN_ROUTE';
    return true;
  });

  // Chronique filtrée
  const chroniqueFiltree = chronique.filter(c =>
    filtreChronique === 'TOUT' ? true : c.categorie === filtreChronique
  );

  const evenementsGraphe = etat.grapheNoeuds
    .filter(n => n.type === 'Event')
    .sort((a, b) => (b.proprietes?.horodatageTick || 0) - (a.proprietes?.horodatageTick || 0));

  const acteursGraphe = etat.grapheNoeuds.filter(n => n.type === 'Actor');

  // Préparation courbe SVG (historiqueMonde)
  const chartW = 540;
  const chartH = 156;
  const padL = 36;
  const padR = 16;
  const padY = 18;
  const serie = historique.length > 0 ? historique : [];
  const calcCoord = (idx: number, valNorm: number) => {
    const x =
      serie.length <= 1
        ? padL
        : padL + (idx / (serie.length - 1)) * (chartW - padL - padR);
    const y = chartH - padY - Math.max(0, Math.min(1, valNorm)) * (chartH - padY * 2);
    return { x, y };
  };
  const coordsFer = serie.map((s, i) => calcCoord(i, (s.multiplicateurFer - 0.8) / 1.8));
  const coordsVivres = serie.map((s, i) => calcCoord(i, (s.multiplicateurVivres - 0.8) / 1.0));
  const coordsPression = serie.map((s, i) => calcCoord(i, s.pressionMoyenne / 100));
  const toPoly = (pts: Array<{ x: number; y: number }>) =>
    pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const pointsFer = toPoly(coordsFer);
  const pointsVivres = toPoly(coordsVivres);
  const pointsPression = toPoly(coordsPression);

  return (
    <div className="space-y-3 text-xs text-[#231a14]">
      {/* Barre d'en-tête & pilotage temporel */}
      <div className="dnd-panel rounded-lg px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 font-display text-sm font-bold text-[#2a1d13]">
            <Globe className="w-4 h-4 text-[#9c6f21]" />
            <span>Monde &amp; Atlas</span>
          </div>
          <div className="text-[11px] text-[#5c4734] font-mono tabular-nums flex flex-wrap items-center gap-x-2">
            <span>Tick {etat.horloge.tick}</span>
            <span aria-hidden="true">·</span>
            <span>
              Jour {etat.horloge.jour}, {String(etat.horloge.heure).padStart(2, '0')}:00
              {etat.horloge.phaseJournee ? ` (${etat.horloge.phaseJournee})` : ''}
            </span>
            <span aria-hidden="true">·</span>
            <span>{etat.horloge.saison || 'Automne'}</span>
            <span aria-hidden="true">·</span>
            <span>{etat.horloge.meteo} ({etat.horloge.temperature})</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {onInitialiserForge && onExecuterEtapeForge && onAppliquerForge && (
            <button
              type="button"
              onClick={() => setForgeOuverte(v => !v)}
              data-testid="btn-open-world-forge"
              className={`px-2.5 py-1.5 border rounded-md text-[11px] font-medium flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                forgeOuverte
                  ? 'dnd-wood-bar border-[#b48a3e]'
                  : 'bg-[#fffdf7] hover:bg-[#efe4ca] text-[#231a14] border-[#8c6422]'
              }`}
            >
              <Wand2 className="w-3 h-3 text-[#8c6422]" />
              <span>Forge progressive</span>
            </button>
          )}
          {onGenererMonde && (
            <button
              type="button"
              onClick={() => setAfficherAtlas(v => !v)}
              className={`px-2.5 py-1.5 border rounded-md text-[11px] font-medium flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                afficherAtlas
                  ? 'dnd-wood-bar border-[#b48a3e]'
                  : 'bg-[#fffdf7] hover:bg-[#efe4ca] text-[#231a14] border-[#bfa574]'
              }`}
            >
              <Globe className="w-3 h-3 text-[#8c6422]" />
              <span>Générateur</span>
            </button>
          )}
          <button
            type="button"
            disabled={chargement}
            aria-pressed={supervisionIa}
            onClick={() => setSupervisionIa(v => !v)}
            className={`px-2.5 py-1.5 border rounded-md text-[11px] font-medium flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40 ${
              supervisionIa
                ? 'dnd-wood-bar border-[#b48a3e]'
                : 'bg-[#fffdf7] hover:bg-[#efe4ca] text-[#5c4734] border-[#bfa574]'
            }`}
            title="Activer la supervision IA Gemini 4 Hydrogen sur les jalons temporels (jours/semaines/mois)"
          >
            <span>Supervision IA : {supervisionIa ? 'Active' : 'Procédurale'}</span>
          </button>
          {(
            [
              { heures: 1, label: '+1h' },
              { heures: 24, label: '+1j' },
              { heures: 168, label: '+1 sem' },
              { heures: 720, label: '+1 mois' },
            ] as const
          ).map(btn => (
            <button
              key={btn.label}
              type="button"
              disabled={chargement}
              onClick={() => {
                if (onAvancerTemps) {
                  onAvancerTemps(btn.heures, supervisionIa);
                } else if (onAvancerTicks) {
                  onAvancerTicks(Math.max(1, Math.round(btn.heures / 24)));
                }
              }}
              className="px-2.5 py-1.5 bg-[#fffdf7] hover:bg-[#efe4ca] disabled:opacity-40 text-[#231a14] border border-[#bfa574] rounded-md text-[11px] font-medium font-mono tabular-nums flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FastForward className="w-3 h-3 text-[#8c6422]" />
              <span>{btn.label}</span>
            </button>
          ))}
        </div>
      </div>

      {forgeOuverte && onInitialiserForge && onExecuterEtapeForge && onAppliquerForge && (
        <WorldForgeWizard
          etat={etat}
          chargement={chargement}
          onInitialiserForge={onInitialiserForge}
          onExecuterEtape={onExecuterEtapeForge}
          onAppliquerMonde={async draft => {
            await onAppliquerForge(draft);
            setForgeOuverte(false);
          }}
          onFermer={() => setForgeOuverte(false)}
        />
      )}

      {afficherAtlas && onGenererMonde && (
        <AzgaarGeneratorPanel
          carteAzgaar={etat.carteAzgaar}
          chargement={chargement}
          onGenerer={onGenererMonde}
          onRestaurerValGris={onRestaurerValGris}
          onOuvrirForge={
            onInitialiserForge && onExecuterEtapeForge && onAppliquerForge
              ? () => {
                  setAfficherAtlas(false);
                  setForgeOuverte(true);
                }
              : undefined
          }
        />
      )}

      {/* 4 indicateurs synthétiques */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <div className="dnd-panel rounded-lg px-3.5 py-2.5">
          <div className="text-[11px] text-[#6d5742]">Cours du fer</div>
          <div className="text-sm font-bold font-mono tabular-nums text-[#231a14] mt-0.5">
            x{etat.marche.multiplicateurFer} · {etat.marche.tendanceFer || 'STABLE'}
          </div>
          <div className="text-[11px] text-[#5c4734] font-mono tabular-nums">
            Arme : {etat.marche.prixArmesFerModif} po · {etat.marche.penurieArmurerie ? 'Pénurie' : 'Normal'}
          </div>
        </div>

        <div className="dnd-panel rounded-lg px-3.5 py-2.5">
          <div className="text-[11px] text-[#6d5742]">Cours des vivres</div>
          <div className="text-sm font-bold font-mono tabular-nums text-[#231a14] mt-0.5">
            x{etat.marche.multiplicateurVivres ?? 1.0} · {etat.marche.tendanceVivres || 'STABLE'}
          </div>
          <div className="text-[11px] text-[#5c4734]">
            Routes : {etat.marche.securiteRoutes} · Tension {etat.marche.indiceTensionCommerciale ?? 0}%
          </div>
        </div>

        <div className="dnd-panel rounded-lg px-3.5 py-2.5">
          <div className="text-[11px] text-[#6d5742]">Risque &amp; prospérité</div>
          <div className="text-sm font-bold font-mono tabular-nums text-[#231a14] mt-0.5">
            Danger {pressionMoy}% · Prosp. {prosperiteMoy}%
          </div>
          <div className="text-[11px] text-[#5c4734]">
            Moyenne des {hexagones.length} hexagones
          </div>
        </div>

        <div className="dnd-panel rounded-lg px-3.5 py-2.5">
          <div className="text-[11px] text-[#6d5742]">Logistique &amp; graphe</div>
          <div className="text-sm font-bold font-mono tabular-nums text-[#231a14] mt-0.5">
            {entitesEnRoute.length} en route · {etat.marche.volumeEchanges ?? 0} livrés
          </div>
          <div className="text-[11px] text-[#5c4734] font-mono tabular-nums">
            {evenementsGraphe.length} événements · {etat.grapheLiens.length} liens
          </div>
        </div>
      </div>

      {/* Corps principal : Atlas Azgaar fusionné Godmode + Factions/Unités */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
        <div className={`${carteAgrandie ? 'lg:col-span-12' : 'lg:col-span-8'} space-y-2.5`}>
          {/* Préréglages rapides de lecture Godmode & Atlas */}
          <div className="dnd-panel rounded-lg px-3 py-2 flex flex-wrap items-center justify-between gap-2">
            <span className="font-display font-semibold text-xs text-[#2a1d13]">
              Vues d&apos;atlas
            </span>
            <div className="flex flex-wrap items-center gap-1 bg-[#21170f] p-0.5 rounded border border-[#7c5d2a]">
              {(
                [
                  { id: 'politique', label: 'Politique' },
                  { id: 'biomes', label: 'Biomes' },
                  { id: 'economie', label: 'Économie' },
                  { id: 'cultures', label: 'Cultures' },
                  { id: 'religions', label: 'Religions' },
                  { id: 'danger', label: 'Danger' },
                  { id: 'ecologie', label: 'Écologie' },
                  { id: 'peuplement', label: 'Peuplement' },
                  { id: 'trafic', label: 'Trafic' },
                ] as const
              ).map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => appliquerPresetCouche(opt.id)}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    presetCouche === opt.id
                      ? 'bg-[#e5be6e] text-[#231a14]'
                      : 'text-[#decfae] hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <AzgaarStudioView
            etat={etat}
            chargement={chargement}
            godmodeOverlay={godmodeOverlay}
            hexSelectionneId={hexInspecte?.id}
            onSelectHex={hex => setHexSelectionneId(hex.id)}
            estAgrandie={carteAgrandie}
            onToggleAgrandir={() => setCarteAgrandie(v => !v)}
            onSyncAzgaar={onSyncAzgaar}
            onRegenererAzgaar={opts =>
              onGenererMonde ? onGenererMonde({ ...opts, conserverHeros: true }) : undefined
            }
            onImporterAzgaar={onImporterAzgaar}
            onPromoteNpc={onPromouvoirPnjs ? id => void onPromouvoirPnjs([id]) : undefined}
          />

          {/* Inspecteur détaillé de l'hexagone sélectionné */}
          {hexInspecte && (
            <div className="dnd-panel rounded-lg p-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#decba3] pb-1.5">
                <div>
                  <span className="font-display font-bold text-sm text-[#231a14]">
                    {hexInspecte.nom}
                  </span>
                  <span className="text-[11px] font-mono text-[#6d5742] ml-2">
                    [{hexInspecte.q},{hexInspecte.r}] ·{' '}
                    {hexInspecte.estEau ? 'Mer' : hexInspecte.biomeAzgaar || hexInspecte.terrain}
                    {hexInspecte.culture ? ` · ${hexInspecte.culture}` : ''}
                  </span>
                </div>
                <div className="text-[11px] font-mono text-[#5c4734]">
                  {BROUILLARD_JOUEUR_LABEL[hexInspecte.brouillard] || hexInspecte.brouillard}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono tabular-nums text-[11px]">
                <div>
                  <div className="text-[#6d5742] text-[10px]">Contrôle</div>
                  <div className="font-semibold text-[#231a14]">
                    {nomCourtFaction(hexInspecte.factionControleId, factions)}
                  </div>
                </div>
                <div>
                  <div className="text-[#6d5742] text-[10px]">Danger</div>
                  <div className="font-semibold text-[#231a14]">
                    {hexInspecte.pressionDanger ?? 30}% ({hexInspecte.securite})
                  </div>
                </div>
                <div>
                  <div className="text-[#6d5742] text-[10px]">Eau / Gibier</div>
                  <div className="font-semibold text-[#231a14]">
                    {hexInspecte.niveauEau ?? (hexInspecte.ressourcesEau ? 70 : 10)}% /{' '}
                    {hexInspecte.populationGibier ?? (hexInspecte.ressourcesGibier ? 70 : 10)}%
                  </div>
                </div>
                <div>
                  <div className="text-[#6d5742] text-[10px]">Prospérité</div>
                  <div className="font-semibold text-[#231a14]">{hexInspecte.prosperite ?? 30}%</div>
                </div>
                <div>
                  <div className="text-[#6d5742] text-[10px]">Relief / Temp.</div>
                  <div className="font-semibold text-[#231a14]">
                    {hexInspecte.altitude ?? 25} m · {hexInspecte.temperatureC ?? 12}°C
                  </div>
                </div>
                <div>
                  <div className="text-[#6d5742] text-[10px]">Pluie / Flux</div>
                  <div className="font-semibold text-[#231a14]">
                    {hexInspecte.precipitations ?? 45}% · {hexInspecte.fluxHydro ?? 15}%
                  </div>
                </div>
                <div>
                  <div className="text-[#6d5742] text-[10px]">Population</div>
                  <div className="font-semibold text-[#231a14]">
                    {hexInspecte.population ?? 60} hab.
                  </div>
                </div>
                <div>
                  <div className="text-[#6d5742] text-[10px]">Garnison / Voie</div>
                  <div className="font-semibold text-[#231a14]">
                    {hexInspecte.garnison ?? 10}% ·{' '}
                    {hexInspecte.routeNiveau === 'ROUTE'
                      ? 'Route'
                      : hexInspecte.routeNiveau === 'PISTE'
                      ? 'Piste'
                      : 'Aucune'}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-[#decba3] text-[11px]">
                <div>
                  <span className="text-[#6d5742] font-semibold">PNJ &amp; unités : </span>
                  <span className="text-[#231a14]">
                    {acteursSurHex.length === 0 && entitesSurHex.length === 0
                      ? 'Aucun'
                      : [
                          ...acteursSurHex.map(a => a.label),
                          ...entitesSurHex.map(e => `${e.nom} → ${hexNom(e.destinationHexId)}`),
                        ].join(' · ')}
                  </span>
                </div>
                <div>
                  <span className="text-[#6d5742] font-semibold">Ressource &amp; spécialité : </span>
                  <span className="text-[#231a14]">
                    {hexInspecte.specialiteEconomique || 'Secteur'}
                    {hexInspecte.ressourcePrincipale
                      ? ` · ${RESSOURCES_CATALOGUE[hexInspecte.ressourcePrincipale]?.label || hexInspecte.ressourcePrincipale}`
                      : ''}
                  </span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-[#6d5742] font-semibold">Savoir local : </span>
                  <span className="text-[#231a14]">
                    {evenementsConnusHex.length}{' '}
                    {evenementsConnusHex.length > 1 ? 'événements connus' : 'événement connu'}
                  </span>
                </div>
              </div>

              {onActionMJ && !hexInspecte.estEau && (
                <div className="pt-2 border-t border-[#decba3] space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <label className="flex items-center gap-1">
                      <span className="text-[10px] text-[#6d5742]">Contrôle</span>
                      <select
                        value={hexInspecte.factionControleId || 'NEUTRE'}
                        onChange={e =>
                          onActionMJ({
                            type: 'MODIFIER_HEX',
                            hexId: hexInspecte.id,
                            factionControleId: e.target.value === 'NEUTRE' ? null : e.target.value,
                          })
                        }
                        className="bg-[#fffdf7] border border-[#bfa574] rounded px-1.5 py-0.5 text-[10px]"
                      >
                        <option value="NEUTRE">Neutre</option>
                        {factions.map(f => (
                          <option key={f.id} value={f.id}>
                            {nomCourtFaction(f.id, factions)}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="flex items-center gap-1">
                      <span className="text-[10px] text-[#6d5742]">Voie</span>
                      <select
                        value={hexInspecte.routeNiveau || 'AUCUNE'}
                        onChange={e =>
                          onActionMJ({
                            type: 'MODIFIER_HEX',
                            hexId: hexInspecte.id,
                            routeNiveau: e.target.value as 'ROUTE' | 'PISTE' | 'AUCUNE',
                          })
                        }
                        className="bg-[#fffdf7] border border-[#bfa574] rounded px-1.5 py-0.5 text-[10px]"
                      >
                        <option value="ROUTE">Route</option>
                        <option value="PISTE">Piste</option>
                        <option value="AUCUNE">Aucune</option>
                      </select>
                    </label>

                    <label className="flex items-center gap-1">
                      <span className="text-[10px] text-[#6d5742]">Vue</span>
                      <select
                        value={hexInspecte.brouillard}
                        onChange={e =>
                          onActionMJ({
                            type: 'MODIFIER_HEX',
                            hexId: hexInspecte.id,
                            brouillard: e.target.value as 'INCONNU' | 'REPERE' | 'EXPLORE',
                          })
                        }
                        className="bg-[#fffdf7] border border-[#bfa574] rounded px-1.5 py-0.5 text-[10px]"
                      >
                        <option value="INCONNU">Inconnu</option>
                        <option value="REPERE">Repéré</option>
                        <option value="EXPLORE">Exploré</option>
                      </select>
                    </label>

                    {hexInspecte.pointInteret ? (
                      <label className="flex items-center gap-1">
                        <span className="text-[10px] text-[#6d5742]">Lieu</span>
                        <select
                          value={hexInspecte.pointInteret.statut}
                          onChange={e =>
                            onActionMJ({
                              type: 'MODIFIER_HEX',
                              hexId: hexInspecte.id,
                              poiStatut: e.target.value as 'OPERATIONNEL' | 'RUINED' | 'OCCUPIED' | 'ABANDONNE',
                            })
                          }
                          className="bg-[#fffdf7] border border-[#bfa574] rounded px-1.5 py-0.5 text-[10px]"
                        >
                          <option value="OPERATIONNEL">Opérationnel</option>
                          <option value="OCCUPIED">Occupé</option>
                          <option value="RUINED">Ruine</option>
                          <option value="ABANDONNE">Abandonné</option>
                        </select>
                      </label>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          onActionMJ({
                            type: 'MODIFIER_HEX',
                            hexId: hexInspecte.id,
                            poiNom: `Camp de ${hexInspecte.nom}`,
                            poiType: 'camp',
                            poiStatut: 'OPERATIONNEL',
                          })
                        }
                        className="px-2 py-0.5 bg-[#fffdf7] hover:bg-[#efe4ca] border border-[#bfa574] rounded text-[10px] whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        + Avant-poste
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[#6d5742] font-sans">Danger</span>
                      <button
                        type="button"
                        onClick={() =>
                          onActionMJ({
                            type: 'MODIFIER_HEX',
                            hexId: hexInspecte.id,
                            pressionDanger: (hexInspecte.pressionDanger ?? 30) - 15,
                          })
                        }
                        className="px-1.5 py-0.5 bg-[#fffdf7] border border-[#bfa574] rounded cursor-pointer"
                      >
                        -15
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onActionMJ({
                            type: 'MODIFIER_HEX',
                            hexId: hexInspecte.id,
                            pressionDanger: (hexInspecte.pressionDanger ?? 30) + 15,
                          })
                        }
                        className="px-1.5 py-0.5 bg-[#fffdf7] border border-[#bfa574] rounded cursor-pointer"
                      >
                        +15
                      </button>
                      <span className="text-[#6d5742] font-sans ml-1">Garn.</span>
                      <button
                        type="button"
                        onClick={() =>
                          onActionMJ({
                            type: 'MODIFIER_HEX',
                            hexId: hexInspecte.id,
                            garnison: (hexInspecte.garnison ?? 20) - 15,
                          })
                        }
                        className="px-1.5 py-0.5 bg-[#fffdf7] border border-[#bfa574] rounded cursor-pointer"
                      >
                        -15
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onActionMJ({
                            type: 'MODIFIER_HEX',
                            hexId: hexInspecte.id,
                            garnison: (hexInspecte.garnison ?? 20) + 15,
                          })
                        }
                        className="px-1.5 py-0.5 bg-[#fffdf7] border border-[#bfa574] rounded cursor-pointer"
                      >
                        +15
                      </button>
                      <span className="text-[#6d5742] font-sans ml-1">Prosp.</span>
                      <button
                        type="button"
                        onClick={() =>
                          onActionMJ({
                            type: 'MODIFIER_HEX',
                            hexId: hexInspecte.id,
                            prosperite: (hexInspecte.prosperite ?? 30) - 15,
                          })
                        }
                        className="px-1.5 py-0.5 bg-[#fffdf7] border border-[#bfa574] rounded cursor-pointer"
                      >
                        -15
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onActionMJ({
                            type: 'MODIFIER_HEX',
                            hexId: hexInspecte.id,
                            prosperite: (hexInspecte.prosperite ?? 30) + 15,
                          })
                        }
                        className="px-1.5 py-0.5 bg-[#fffdf7] border border-[#bfa574] rounded cursor-pointer"
                      >
                        +15
                      </button>
                    </div>

                    <div className="flex items-center gap-1 font-sans">
                      {(
                        [
                          { id: 'RAID', label: 'Raid' },
                          { id: 'FOIRE', label: 'Foire' },
                          { id: 'RELIQUE', label: 'Relique' },
                        ] as const
                      ).map(cr => (
                        <button
                          key={cr.id}
                          type="button"
                          onClick={() =>
                            onActionMJ({
                              type: 'DECLENCHER_CRISE',
                              hexId: hexInspecte.id,
                              preset: cr.id,
                              poserMarqueur: true,
                            })
                          }
                          className="px-2 py-0.5 bg-[#312319] hover:bg-[#493424] text-[#f6eedb] border border-[#b48a3e] rounded text-[10px] flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <Flame className="w-2.5 h-2.5 text-[#e5be6e]" />
                          <span>{cr.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Colonne droite : Factions avec blasons, Diplomatie et Mouvements actifs */}
        <div
          className={`${
            carteAgrandie
              ? 'lg:col-span-12 grid grid-cols-1 lg:grid-cols-2 gap-3'
              : 'lg:col-span-4 space-y-3'
          }`}
        >
          <div className="dnd-panel rounded-lg overflow-hidden">
            <div className="dnd-wood-header px-3.5 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-display font-semibold text-[#f8f0dc]">
                <Shield className="w-4 h-4 text-[#dfba68]" />
                <span>Factions &amp; Blasons</span>
              </div>
              <span className="text-[11px] font-mono text-[#decfae]">
                {factions.length} puissances
              </span>
            </div>

            <div className="p-3 space-y-2.5">
              {factions.map((f, idx) => {
                const coa = obtenirBlasonFaction(f, idx, etat.azgaarStudio);
                return (
                  <div
                    key={f.id}
                    className="bg-[#f5edd8]/75 border border-[#cfb88c] rounded-md p-2.5 space-y-1"
                  >
                      <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <CoatOfArmsSvg coa={coa} size={26} className="shrink-0" />
                        <span className="font-semibold text-[#231a14] truncate">{f.nom}</span>
                      </div>
                      {onActionMJ ? (
                        <select
                          value={f.posture || 'DEFENSE'}
                          onChange={e =>
                            onActionMJ({
                              type: 'MODIFIER_FACTION',
                              factionId: f.id,
                              posture: e.target.value as FactionPosture,
                            })
                          }
                          className="bg-[#fffdf7] border border-[#bfa574] rounded px-1.5 py-0.5 text-[10px] font-mono text-[#231a14]"
                        >
                          {(['EXPANSION', 'DEFENSE', 'COMMERCE', 'RAID', 'TREVE'] as const).map(p => (
                            <option key={p} value={p}>
                              {POSTURE_LABEL[p]}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-[11px] font-mono text-[#6d5332] shrink-0">
                          {POSTURE_LABEL[f.posture || 'DEFENSE'] || f.posture}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2 font-mono tabular-nums text-[11px] text-[#463626]">
                      <span>
                        Force : {f.forceMilitaire}/{f.forceMax ?? 80}
                      </span>
                      <span>Moral : {f.moral ?? 65}</span>
                      <span>Or : {f.richesse}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 font-mono tabular-nums text-[10px] text-[#6d5742]">
                      <span>Pop. : {f.populationTotale ?? 250}</span>
                      <span>Usure : {f.lassitudeGuerre ?? 10}%</span>
                      <span>Revenu : +{f.revenuFiscal ?? 15}</span>
                    </div>
                    {onActionMJ && (
                      <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 text-[10px] font-mono">
                        <div className="flex items-center gap-1">
                          <span className="font-sans text-[#6d5742]">F</span>
                          <button
                            type="button"
                            onClick={() =>
                              onActionMJ({
                                type: 'MODIFIER_FACTION',
                                factionId: f.id,
                                forceMilitaire: f.forceMilitaire - 5,
                              })
                            }
                            className="px-1.5 py-0.5 bg-[#fffdf7] border border-[#bfa574] rounded cursor-pointer"
                          >
                            -5
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              onActionMJ({
                                type: 'MODIFIER_FACTION',
                                factionId: f.id,
                                forceMilitaire: f.forceMilitaire + 5,
                              })
                            }
                            className="px-1.5 py-0.5 bg-[#fffdf7] border border-[#bfa574] rounded cursor-pointer"
                          >
                            +5
                          </button>
                          <span className="font-sans text-[#6d5742] ml-1">Or</span>
                          <button
                            type="button"
                            onClick={() =>
                              onActionMJ({
                                type: 'MODIFIER_FACTION',
                                factionId: f.id,
                                richesse: f.richesse - 20,
                              })
                            }
                            className="px-1.5 py-0.5 bg-[#fffdf7] border border-[#bfa574] rounded cursor-pointer"
                          >
                            -20
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              onActionMJ({
                                type: 'MODIFIER_FACTION',
                                factionId: f.id,
                                richesse: f.richesse + 20,
                              })
                            }
                            className="px-1.5 py-0.5 bg-[#fffdf7] border border-[#bfa574] rounded cursor-pointer"
                          >
                            +20
                          </button>
                        </div>
                        <select
                          value={f.relationsJoueur}
                          onChange={e =>
                            onActionMJ({
                              type: 'MODIFIER_FACTION',
                              factionId: f.id,
                              relationsJoueur: e.target.value as 'HOSTILE' | 'NEUTRE' | 'ALLIE',
                            })
                          }
                          className="bg-[#fffdf7] border border-[#bfa574] rounded px-1 py-0.5 text-[10px] font-sans"
                        >
                          <option value="ALLIE">Héros : Allié</option>
                          <option value="NEUTRE">Héros : Neutre</option>
                          <option value="HOSTILE">Héros : Hostile</option>
                        </select>
                      </div>
                    )}
                    <div className="text-[11px] text-[#5c4734]">
                      Territoires :{' '}
                      {f.noeudsControles.length > 0
                        ? f.noeudsControles.map(hexNom).join(', ')
                        : 'Aucun'}
                    </div>
                    <div className="text-[11px] text-[#3b2c1e] border-t border-[#decba3] pt-1">
                      {f.effectifActif || f.objectifs[0]}
                    </div>
                  </div>
                );
              })}

              {/* Matrice diplomatique */}
              <div className="border-t border-[#d6c298] pt-2 space-y-1">
                <div className="text-[11px] font-display font-semibold text-[#6d5332]">
                  Relations inter-factions
                </div>
                {pairesDiplo.map(({ a, b, rel }) => {
                  const cycle: FactionDiplomacy[] = ['PACTE', 'NEUTRE', 'TENSION', 'GUERRE'];
                  const nextRel = cycle[(cycle.indexOf(rel) + 1) % cycle.length];
                  return (
                    <div
                      key={`${a.id}_${b.id}`}
                      className="flex items-center justify-between text-[11px] py-0.5 border-b border-[#efe4ca] last:border-0"
                    >
                      <span className="text-[#3b2c1e]">
                        {nomCourtFaction(a.id, factions)} ↔ {nomCourtFaction(b.id, factions)}
                      </span>
                      {onActionMJ ? (
                        <button
                          type="button"
                          onClick={() =>
                            onActionMJ({
                              type: 'MODIFIER_DIPLOMATIE',
                              factionAId: a.id,
                              factionBId: b.id,
                              relation: nextRel,
                            })
                          }
                          title="Basculer relation"
                          className={`font-mono px-1.5 py-0.5 rounded border border-[#d6c298] bg-[#fffdf7] hover:bg-[#efe4ca] cursor-pointer ${DIPLO_TEXT_CLASS[rel]}`}
                        >
                          {DIPLO_LABEL[rel]}
                        </button>
                      ) : (
                        <span className={`font-mono ${DIPLO_TEXT_CLASS[rel]}`}>
                          {DIPLO_LABEL[rel]}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Mouvements en cours */}
          <div className="dnd-panel rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between border-b border-[#d6c298] pb-1.5">
              <span className="font-display font-semibold text-[#2a1d13]">Unités en route</span>
              <span className="font-mono tabular-nums text-[11px] text-[#6d5742]">
                {entitesEnRoute.length} actives
              </span>
            </div>

            {entitesEnRoute.length === 0 ? (
              <div className="text-[11px] text-[#78624a] py-2">Aucune unité en transit.</div>
            ) : (
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-0.5">
                {entitesEnRoute.map(ent => (
                  <div
                    key={ent.id}
                    className="bg-[#f5edd8]/75 border border-[#cfb88c] rounded px-2.5 py-1.5 text-[11px] space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-[#231a14] truncate">{ent.nom}</span>
                      <span className="font-mono text-[10px] text-[#6d5332] shrink-0">
                        {ent.type} · F{ent.force}
                      </span>
                    </div>
                    <div className="font-mono text-[10px] text-[#5c4734] flex justify-between gap-2">
                      <span className="truncate">
                        {hexNom(ent.hexId)} → {hexNom(ent.destinationHexId)}
                      </span>
                      {ent.cargaison && <span className="shrink-0">{ent.cargaison}</span>}
                    </div>
                    {onActionMJ && (
                      <div className="flex items-center justify-end gap-1 pt-0.5">
                        <button
                          type="button"
                          onClick={() =>
                            onActionMJ({
                              type: 'GERER_UNITE',
                              entiteId: ent.id,
                              operation: 'AVANCER',
                            })
                          }
                          className="px-1.5 py-0.5 bg-[#fffdf7] hover:bg-[#efe4ca] border border-[#bfa574] rounded text-[10px] flex items-center gap-0.5 cursor-pointer"
                        >
                          <ArrowRight className="w-2.5 h-2.5" />
                          <span>Avancer</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onActionMJ({
                              type: 'GERER_UNITE',
                              entiteId: ent.id,
                              operation: 'DISPERSER',
                            })
                          }
                          className="px-1.5 py-0.5 bg-[#fffdf7] hover:bg-rose-50 border border-[#bfa574] rounded text-[10px] text-rose-900 cursor-pointer"
                        >
                          Disperser
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sous-onglets analytiques détaillés */}
      <div className="dnd-panel rounded-lg p-3.5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#d6c298] pb-2">
          <div className="flex flex-wrap items-center gap-1 p-1 bg-[#e3d6bc]/80 border border-[#c6b084] rounded-lg">
            {(
              [
                ...(onActionMJ ? [{ id: 'regie' as const, label: 'Régie MJ', icon: Crown }] : []),
                { id: 'economie' as const, label: 'Économie & Écologie', icon: Activity },
                { id: 'lore_pnj' as const, label: 'Lore & PNJ (MJ)', icon: BookOpen },
                { id: 'unites' as const, label: 'Unités & Trajets', icon: Users },
                { id: 'savoir' as const, label: 'Savoir & Graphe', icon: Database },
                { id: 'chronique' as const, label: 'Chronique', icon: ScrollText },
              ]
            ).map(tab => {
              const Icon = tab.icon;
              const actif = sousOnglet === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSousOnglet(tab.id)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    actif ? 'dnd-wood-bar border shadow-xs' : 'text-[#5b4735] hover:text-[#231a14]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {sousOnglet === 'regie' && onActionMJ && (
          <MjWorldConsole
            etat={etat}
            hexInspecteId={hexInspecte?.id}
            chargement={chargement}
            onActionMJ={onActionMJ}
          />
        )}

        {sousOnglet === 'lore_pnj' && (
          <div className="space-y-4">
            {/* Panneau Lore Strate 2 (MJ) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
              <div className="lg:col-span-7 bg-[#f5edd8]/80 border border-[#cfb88c] rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between gap-2 border-b border-[#decba3] pb-1.5">
                  <div className="font-display font-bold text-xs text-[#2a1d13] flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-[#8c6422]" />
                    <span>{etat.azgaarStudio?.worldName || 'Chronique du Monde'}</span>
                  </div>
                  {loreMonde?.tonalite && (
                    <span className="font-mono text-[10px] text-[#6d5332]">
                      Tonalité : {loreMonde.tonalite}
                    </span>
                  )}
                </div>
                {loreMonde ? (
                  <div className="space-y-2 text-[11px] text-[#3b2c1e]">
                    {loreMonde.genese && <p className="leading-relaxed">{loreMonde.genese}</p>}
                    {loreMonde.chroniqueEres.length > 0 && (
                      <div className="space-y-1 text-[#463626]">
                        {loreMonde.chroniqueEres.slice(0, 3).map(era => (
                          <div key={era.id}>
                            <span className="font-semibold">{era.periode} — {era.titre} :</span>{' '}
                            {era.resume}
                          </div>
                        ))}
                      </div>
                    )}
                    {loreMonde.secretsMondeMJ && loreMonde.secretsMondeMJ.length > 0 && (
                      <div className="bg-[#f7ece3] border border-rose-800/30 rounded p-2 space-y-1">
                        <div className="text-[10px] font-semibold uppercase text-rose-900 flex items-center gap-1">
                          <EyeOff className="w-3 h-3" />
                          <span>Vérités occultées (Strate 2 MJ)</span>
                        </div>
                        {loreMonde.secretsMondeMJ.map((sec, idx) => (
                          <div key={idx} className="text-[11px] text-rose-950">
                            • {sec}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-[11px] text-[#78624a]">
                    Aucun lore structuré généré pour cette campagne. Lancez la Forge progressive pour détailler l&apos;histoire et les PNJ.
                  </div>
                )}
              </div>

              <div className="lg:col-span-5 bg-[#f5edd8]/80 border border-[#cfb88c] rounded-lg p-3 space-y-2 max-h-64 overflow-y-auto">
                <div className="font-display font-bold text-xs text-[#2a1d13] border-b border-[#decba3] pb-1.5">
                  Secrets d&apos;États &amp; Cultes (MJ)
                </div>
                {loreMonde?.etatsLore?.map(st => {
                  const gov = etat.azgaarStudio?.states.find(s => s.id === st.stateId)?.government;
                  return (
                    <div key={st.stateId} className="border-b border-[#e5d5b3] pb-1.5 last:border-0 space-y-0.5">
                      <div className="font-semibold text-[#231a14] text-[11px]">
                        {st.nom} {gov ? <span className="font-normal text-[#6d5742]">({gov})</span> : null}
                      </div>
                      {st.devise && <div className="text-[10px] italic text-[#5c4734]">« {st.devise} »</div>}
                      {st.tensionInterne && (
                        <div className="text-[10px] text-[#5c4734]">Tension : {st.tensionInterne}</div>
                      )}
                      {st.secretEtat && (
                        <div className="text-[10px] text-rose-900">Secret : {st.secretEtat}</div>
                      )}
                    </div>
                  );
                })}
                {loreMonde?.religionsLore?.map(rel => (
                  <div key={rel.religionId} className="border-b border-[#e5d5b3] pb-1.5 last:border-0 space-y-0.5">
                    <div className="font-semibold text-[#231a14] text-[11px]">{rel.nom}</div>
                    {rel.heresieSecrete && (
                      <div className="text-[10px] text-rose-900">Hérésie : {rel.heresieSecrete}</div>
                    )}
                  </div>
                ))}
                {(!loreMonde || (loreMonde.etatsLore.length === 0 && loreMonde.religionsLore.length === 0)) && (
                  <div className="text-[11px] text-[#78624a]">Aucun dossier géopolitique ou religieux enregistré.</div>
                )}
              </div>
            </div>

            {/* Table 3-paliers des PNJ du monde & proximité */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1">
                  {(
                    [
                      { id: 'TOUS', label: `Tous (${pnjsMonde.length})` },
                      {
                        id: 'MAJEUR_MONDE',
                        label: `Monde (${pnjsMonde.filter(p => p.tier === 'MAJEUR_MONDE').length})`,
                      },
                      {
                        id: 'LIEN_HEROS',
                        label: `Liés héros (${pnjsMonde.filter(p => p.tier === 'LIEN_HEROS').length})`,
                      },
                      {
                        id: 'PROCHE_PREGEN',
                        label: `Proches (${pnjsMonde.filter(p => p.tier === 'PROCHE_PREGEN').length})`,
                      },
                      {
                        id: 'LAMBDA_LOINTAIN',
                        label: `Lambda (${pnjsMonde.filter(p => p.tier === 'LAMBDA_LOINTAIN').length})`,
                      },
                    ] as const
                  ).map(f => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFiltreTierPnj(f.id)}
                      className={`px-2.5 py-1 rounded text-[11px] font-medium border whitespace-nowrap shrink-0 cursor-pointer ${
                        filtreTierPnj === f.id
                          ? 'bg-[#312319] text-[#f6eedb] border-[#b48a3e]'
                          : 'bg-[#fffdf7] text-[#5b4735] border-[#cfb88c]'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                {onPromouvoirPnjs && (
                  <button
                    type="button"
                    disabled={chargement || promotionEnCours}
                    onClick={async () => {
                      setPromotionEnCours(true);
                      try {
                        await onPromouvoirPnjs();
                      } finally {
                        setPromotionEnCours(false);
                      }
                    }}
                    className="px-2.5 py-1 dnd-wood-bar border rounded text-[11px] font-medium flex items-center gap-1.5 whitespace-nowrap shrink-0 disabled:opacity-40 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#e5be6e]" />
                    <span>
                      {promotionEnCours
                        ? 'Enrichissement...'
                        : `Enrichir les proches (${pnjsMonde.filter(p => p.enrichmentPending).length} en attente)`}
                    </span>
                  </button>
                )}
              </div>

              {pnjsMonde.length === 0 ? (
                <div className="text-[11px] text-[#78624a] py-3">
                  Aucun PNJ structuré dans `pnjsMonde`. Utilisez la Forge progressive ou générez une carte.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead>
                      <tr className="border-b border-[#cfb88c] text-[#6d5332]">
                        <th className="py-1.5 pr-3 font-semibold">PNJ &amp; Rôle</th>
                        <th className="py-1.5 pr-3 font-semibold">Palier</th>
                        <th className="py-1.5 pr-3 font-semibold">Détail</th>
                        <th className="py-1.5 pr-3 font-semibold">Lieu / Dist.</th>
                        <th className="py-1.5 pr-3 font-semibold text-right">Prox.</th>
                        <th className="py-1.5 pr-3 font-semibold">Apparence / Motivation &amp; Secret (MJ)</th>
                        {onPromouvoirPnjs && <th className="py-1.5 font-semibold text-right">Action</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#efe4ca]">
                      {pnjsMonde
                        .filter(p => (filtreTierPnj === 'TOUS' ? true : p.tier === filtreTierPnj))
                        .map(p => (
                          <tr key={p.id} className="align-top">
                            <td className="py-2 pr-3">
                              <div className="font-semibold text-[#231a14]">{p.nom}</div>
                              <div className="text-[10px] text-[#6d5742]">
                                {p.importance} · {p.profession}
                              </div>
                            </td>
                            <td className="py-2 pr-3 font-mono text-[10px] text-[#463626]">
                              {p.tier}
                            </td>
                            <td className="py-2 pr-3 font-mono text-[10px] text-[#463626]">
                              {p.detailLevel}
                              {p.enrichmentPending && (
                                <div className="text-amber-800 font-semibold">IA en attente</div>
                              )}
                            </td>
                            <td className="py-2 pr-3 font-mono text-[10px] text-[#463626]">
                              <div>{p.hexId ? hexNom(p.hexId) : 'Hors secteur immédiat'}</div>
                              <div className="text-[#78624a]">d = {p.distanceHex} hex</div>
                            </td>
                            <td className="py-2 pr-3 text-right font-mono tabular-nums font-semibold">
                              {p.proximityScore}
                            </td>
                            <td className="py-2 pr-3 space-y-0.5 max-w-md">
                              {p.apparence && <div className="text-[#3b2c1e]">{p.apparence}</div>}
                              {p.motivationImmediate && (
                                <div className="text-[10px] text-[#5c4734]">
                                  Motivation : {p.motivationImmediate}
                                </div>
                              )}
                              {p.secret && (
                                <div className="text-[10px] text-rose-900">
                                  Secret : {p.secret}
                                </div>
                              )}
                              {p.lienHerosNature && (
                                <div className="text-[10px] text-amber-900 font-medium">
                                  Lien héros : {p.lienHerosNature}
                                </div>
                              )}
                            </td>
                            {onPromouvoirPnjs && (
                              <td className="py-2 text-right whitespace-nowrap">
                                <button
                                  type="button"
                                  disabled={chargement || promotionEnCours}
                                  onClick={async () => {
                                    setPromotionEnCours(true);
                                    try {
                                      await onPromouvoirPnjs([p.id]);
                                    } finally {
                                      setPromotionEnCours(false);
                                    }
                                  }}
                                  className="px-2 py-0.5 bg-[#fffdf7] hover:bg-[#efe4ca] border border-[#bfa574] rounded text-[10px] font-medium cursor-pointer disabled:opacity-40"
                                >
                                  {p.detailLevel === 'COMPLET' ? 'Ré-enrichir' : 'Promouvoir (IA)'}
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {sousOnglet === 'economie' && (
          <div className="space-y-3">
            {/* Courbe historique multi-ticks */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
              <div className="lg:col-span-8 bg-[#f4ebd4] border border-[#cfb88c] rounded-lg p-2.5">
                <div className="flex flex-wrap items-center justify-between text-[11px] mb-1.5">
                  <span className="font-semibold text-[#2a1d13]">
                    Évolution ({serie.length} {serie.length > 1 ? 'ticks' : 'tick'})
                  </span>
                  <div className="flex items-center gap-3 font-mono text-[10px]">
                    <span className="text-amber-800">— Fer</span>
                    <span className="text-emerald-800">— Vivres</span>
                    <span className="text-rose-800">┄ Danger</span>
                  </div>
                </div>
                {serie.length < 2 ? (
                  <div className="text-[11px] text-[#78624a] py-6 text-center">
                    Lancez au moins 1 tick pour tracer les courbes historiques.
                  </div>
                ) : (
                  <svg
                    viewBox={`0 0 ${chartW} ${chartH}`}
                    className="w-full h-36"
                    role="img"
                    aria-label="Courbe historique du marché et du danger"
                  >
                    {[
                      { pct: 0, label: '0%' },
                      { pct: 0.5, label: '50%' },
                      { pct: 1, label: '100%' },
                    ].map(g => {
                      const gy = chartH - padY - g.pct * (chartH - padY * 2);
                      return (
                        <g key={g.label}>
                          <line
                            x1={padL}
                            y1={gy}
                            x2={chartW - padR}
                            y2={gy}
                            stroke={g.pct === 0 ? '#bfa574' : '#e2d2b0'}
                            strokeWidth={1}
                            strokeDasharray={g.pct === 0 ? undefined : '2,3'}
                          />
                          <text
                            x={padL - 5}
                            y={gy + 3}
                            textAnchor="end"
                            fontSize={8}
                            fill="#7a6248"
                            fontFamily="monospace"
                          >
                            {g.label}
                          </text>
                        </g>
                      );
                    })}
                    <line x1={padL} y1={padY} x2={padL} y2={chartH - padY} stroke="#bfa574" strokeWidth={1} />
                    <polyline fill="none" stroke="#b45309" strokeWidth={2} points={pointsFer} />
                    <polyline fill="none" stroke="#15803d" strokeWidth={2} points={pointsVivres} />
                    <polyline fill="none" stroke="#9f1239" strokeWidth={1.8} strokeDasharray="3,2" points={pointsPression} />
                    {coordsFer.map((pt, i) => (
                      <circle key={`f_${i}`} cx={pt.x} cy={pt.y} r={2.3} fill="#b45309" />
                    ))}
                    {coordsVivres.map((pt, i) => (
                      <circle key={`v_${i}`} cx={pt.x} cy={pt.y} r={2.3} fill="#15803d" />
                    ))}
                    {coordsPression.map((pt, i) => (
                      <circle key={`p_${i}`} cx={pt.x} cy={pt.y} r={2.1} fill="#9f1239" />
                    ))}
                    <text x={padL} y={chartH - 3} fontSize={9} fill="#6d5742" fontFamily="monospace">
                      T{serie[0].tick}
                    </text>
                    <text
                      x={chartW - padR}
                      y={chartH - 3}
                      textAnchor="end"
                      fontSize={9}
                      fill="#6d5742"
                      fontFamily="monospace"
                    >
                      T{serie[serie.length - 1].tick}
                    </text>
                  </svg>
                )}
              </div>

              <div className="lg:col-span-4 space-y-1.5 text-[11px] font-mono tabular-nums">
                <div className="font-sans font-semibold text-[#2a1d13]">Dernier relevé</div>
                {serie.slice(-4).reverse().map(s => (
                  <div
                    key={s.tick}
                    className="flex justify-between border-b border-[#e5d5b3] py-1 text-[#463626]"
                  >
                    <span>T{s.tick} (J{s.jour})</span>
                    <span>Fer x{s.multiplicateurFer} · Viv x{s.multiplicateurVivres} · {s.pressionMoyenne}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Tableau complet des hexagones */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[11px]">
                <thead>
                  <tr className="border-b border-[#cfb88c] text-[#6d5332]">
                    <th className="py-1.5 pr-3 font-semibold">Hexagone</th>
                    <th className="py-1.5 pr-3 font-semibold">Biome</th>
                    <th className="py-1.5 pr-3 font-semibold">Ressource</th>
                    <th className="py-1.5 pr-3 font-semibold">Contrôle</th>
                    <th className="py-1.5 pr-3 font-semibold">Sécurité</th>
                    <th className="py-1.5 pr-2 font-semibold text-right">Alt.</th>
                    <th className="py-1.5 pr-2 font-semibold text-right">Temp.</th>
                    <th className="py-1.5 pr-2 font-semibold text-right">Flux</th>
                    <th className="py-1.5 pr-2 font-semibold text-right">Pop.</th>
                    <th className="py-1.5 pr-2 font-semibold text-right">Garn.</th>
                    <th className="py-1.5 pr-2 font-semibold text-right">Danger</th>
                    <th className="py-1.5 pr-2 font-semibold text-right">Prosp.</th>
                    <th className="py-1.5 pr-2 font-semibold text-right">Eau</th>
                    <th className="py-1.5 pr-2 font-semibold text-right">Gibier</th>
                    <th className="py-1.5 font-semibold">Vue joueur</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#efe4ca]">
                  {hexagones.map(h => (
                    <tr
                      key={h.id}
                      onClick={() => setHexSelectionneId(h.id)}
                      className={`cursor-pointer hover:bg-[#f5edd8] ${
                        h.id === hexInspecte?.id ? 'bg-[#f5edd8]' : ''
                      }`}
                    >
                      <td className="py-1.5 pr-3 font-semibold text-[#231a14]">{h.nom}</td>
                      <td className="py-1.5 pr-3 text-[#5c4734]">{h.terrain}</td>
                      <td className="py-1.5 pr-3 text-[#463626]">
                        {h.ressourcePrincipale
                          ? RESSOURCES_CATALOGUE[h.ressourcePrincipale]?.label || h.ressourcePrincipale
                          : '—'}
                      </td>
                      <td className="py-1.5 pr-3">{nomCourtFaction(h.factionControleId, factions)}</td>
                      <td className="py-1.5 pr-3">{h.securite}</td>
                      <td className="py-1.5 pr-2 text-right font-mono tabular-nums">{h.altitude ?? 25}m</td>
                      <td className="py-1.5 pr-2 text-right font-mono tabular-nums">{h.temperatureC ?? 12}°</td>
                      <td className="py-1.5 pr-2 text-right font-mono tabular-nums">{h.fluxHydro ?? 15}%</td>
                      <td className="py-1.5 pr-2 text-right font-mono tabular-nums">{h.population ?? 60}</td>
                      <td className="py-1.5 pr-2 text-right font-mono tabular-nums">{h.garnison ?? 10}%</td>
                      <td className="py-1.5 pr-2 text-right font-mono tabular-nums">{h.pressionDanger ?? 30}%</td>
                      <td className="py-1.5 pr-2 text-right font-mono tabular-nums">{h.prosperite ?? 30}%</td>
                      <td className="py-1.5 pr-2 text-right font-mono tabular-nums">
                        {h.niveauEau ?? (h.ressourcesEau ? 70 : 10)}%
                      </td>
                      <td className="py-1.5 pr-2 text-right font-mono tabular-nums">
                        {h.populationGibier ?? (h.ressourcesGibier ? 70 : 10)}%
                      </td>
                      <td className="py-1.5 font-mono text-[10px] text-[#6d5742]">
                        {BROUILLARD_TABLE_LABEL[h.brouillard] || h.brouillard}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {sousOnglet === 'unites' && (
          <div className="space-y-2.5">
            <div className="flex items-center gap-1.5">
              {(
                [
                  { id: 'tout', label: `Tout (${entites.length})` },
                  { id: 'EN_ROUTE', label: `En route (${entitesEnRoute.length})` },
                  { id: 'historique', label: `Terminées (${entites.length - entitesEnRoute.length})` },
                ] as const
              ).map(f => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFiltreEntites(f.id)}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium border whitespace-nowrap shrink-0 cursor-pointer ${
                    filtreEntites === f.id
                      ? 'bg-[#312319] text-[#f6eedb] border-[#b48a3e]'
                      : 'bg-[#fffdf7] text-[#5b4735] border-[#cfb88c]'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {entitesFiltrees.length === 0 ? (
              <div className="text-[11px] text-[#78624a] py-4">Aucune unité dans ce filtre.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="border-b border-[#cfb88c] text-[#6d5332]">
                      <th className="py-1.5 pr-3 font-semibold">Unité</th>
                      <th className="py-1.5 pr-3 font-semibold">Type</th>
                      <th className="py-1.5 pr-3 font-semibold">Faction</th>
                      <th className="py-1.5 pr-3 font-semibold">Position</th>
                      <th className="py-1.5 pr-3 font-semibold">Destination</th>
                      <th className="py-1.5 pr-3 font-semibold">Cargaison</th>
                      <th className="py-1.5 pr-3 font-semibold text-right">Force</th>
                      <th className="py-1.5 pr-3 font-semibold">Statut</th>
                      {onActionMJ && <th className="py-1.5 font-semibold text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#efe4ca]">
                    {entitesFiltrees.map(e => (
                      <tr key={e.id}>
                        <td className="py-1.5 pr-3 font-semibold text-[#231a14]">{e.nom}</td>
                        <td className="py-1.5 pr-3 font-mono">{TYPE_ENTITE_LABEL[e.type] || e.type}</td>
                        <td className="py-1.5 pr-3">{nomCourtFaction(e.factionId, factions)}</td>
                        <td className="py-1.5 pr-3">{hexNom(e.hexId)}</td>
                        <td className="py-1.5 pr-3">{hexNom(e.destinationHexId)}</td>
                        <td className="py-1.5 pr-3 text-[#5c4734]">{e.cargaison || '—'}</td>
                        <td className="py-1.5 pr-3 text-right font-mono tabular-nums">{e.force}</td>
                        <td className="py-1.5 pr-3 font-mono">{STATUT_ENTITE_LABEL[e.statut] || e.statut}</td>
                        {onActionMJ && (
                          <td className="py-1.5 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1">
                              {e.statut === 'EN_ROUTE' && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onActionMJ({
                                        type: 'GERER_UNITE',
                                        entiteId: e.id,
                                        operation: 'AVANCER',
                                      })
                                    }
                                    className="px-1.5 py-0.5 bg-[#fffdf7] hover:bg-[#efe4ca] border border-[#bfa574] rounded text-[10px] cursor-pointer"
                                  >
                                    Avancer
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onActionMJ({
                                        type: 'GERER_UNITE',
                                        entiteId: e.id,
                                        operation: 'DISPERSER',
                                      })
                                    }
                                    className="px-1.5 py-0.5 bg-[#fffdf7] hover:bg-rose-50 border border-[#bfa574] rounded text-[10px] text-rose-900 cursor-pointer"
                                  >
                                    Disperser
                                  </button>
                                </>
                              )}
                              <button
                                type="button"
                                onClick={() =>
                                  onActionMJ({
                                    type: 'GERER_UNITE',
                                    entiteId: e.id,
                                    operation: 'SUPPRIMER',
                                  })
                                }
                                className="px-1.5 py-0.5 bg-[#fffdf7] hover:bg-rose-50 border border-[#bfa574] rounded text-[10px] text-rose-900 cursor-pointer"
                                title="Retirer"
                              >
                                ×
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {sousOnglet === 'savoir' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="space-y-2">
              <div className="font-display font-semibold text-[#2a1d13]">
                Propagation des événements ({evenementsGraphe.length})
              </div>
              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                {evenementsGraphe.map(evt => {
                  const joueurLeSait = evt.connuParEntites?.includes(etat.hexActuel.id);
                  return (
                    <div
                      key={evt.id}
                      className="bg-[#f5edd8]/75 border border-[#cfb88c] rounded p-2 space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-[#231a14]">{evt.label}</span>
                        <span
                          className={`font-mono text-[10px] shrink-0 ${
                            joueurLeSait ? 'text-emerald-800' : 'text-rose-800'
                          }`}
                        >
                          {joueurLeSait ? 'Connu ici' : 'Hors vue joueur'}
                        </span>
                      </div>
                      <div className="text-[10px] font-mono text-[#5c4734]">
                        Tick {evt.proprietes?.horodatageTick ?? 0} · Informés :{' '}
                        {(evt.connuParEntites || [])
                          .map(id => hexagones.find(h => h.id === id)?.nom || etat.grapheNoeuds.find(n => n.id === id)?.label || id)
                          .join(', ') || 'Aucun'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <div className="font-display font-semibold text-[#2a1d13]">
                Acteurs du monde ({acteursGraphe.length})
              </div>
              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                {acteursGraphe.map(act => {
                  const lienLieu = etat.grapheLiens.find(
                    l => l.relation === 'LOCATED_IN' && l.source === act.id
                  );
                  const hexId = act.proprietes?.hexId || lienLieu?.cible;
                  return (
                    <div
                      key={act.id}
                      className="bg-[#f5edd8]/75 border border-[#cfb88c] rounded p-2 space-y-0.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-[#231a14]">{act.label}</span>
                        <span className="font-mono text-[10px] text-[#6d5742]">
                          {hexId ? hexNom(hexId) : 'Lieu inconnu'}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#5c4734]">
                        {act.proprietes?.profession || 'Acteur'} · Disposition :{' '}
                        {act.proprietes?.disposition || 'NEUTRE'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {sousOnglet === 'chronique' && (
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  'TOUT',
                  'SUPERVISION_IA',
                  'EVENEMENT',
                  'FACTION',
                  'DIPLOMATIE',
                  'MOUVEMENT',
                  'ECONOMIE',
                  'METEO',
                ] as const
              ).map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setFiltreChronique(cat)}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium border whitespace-nowrap shrink-0 cursor-pointer ${
                    filtreChronique === cat
                      ? 'bg-[#312319] text-[#f6eedb] border-[#b48a3e]'
                      : 'bg-[#fffdf7] text-[#5b4735] border-[#cfb88c]'
                  }`}
                >
                  {cat === 'TOUT' ? `Tout (${chronique.length})` : CHRONIQUE_CAT_LABEL[cat]}
                </button>
              ))}
            </div>

            {chroniqueFiltree.length === 0 ? (
              <div className="text-[11px] text-[#78624a] py-4">
                Aucun événement enregistré. Utilisez les sauts temporels pour observer la simulation du monde.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                {chroniqueFiltree.map(evt => (
                  <div
                    key={evt.id}
                    className="bg-[#f5edd8]/75 border border-[#cfb88c] rounded px-3 py-2 flex flex-col gap-1"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-semibold text-[#231a14]">{evt.titre}</div>
                      <div className="font-mono text-[10px] text-[#6d5742] shrink-0">
                        {CHRONIQUE_CAT_LABEL[evt.categorie] || evt.categorie}
                        {evt.echelle ? ` · ${evt.echelle}` : ''} · J{evt.jour} · T{evt.tick}
                      </div>
                    </div>
                    <div className="text-[11px] text-[#463626]">{evt.impact}</div>
                    {evt.causeDirecte && (
                      <div className="text-[10px] text-[#6d5332]">
                        Cause : {evt.causeDirecte}
                      </div>
                    )}
                    {evt.consequences && (
                      <div className="text-[10px] text-[#5c4734]">
                        Conséquences : {evt.consequences}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
