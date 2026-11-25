import {
  SimulationState,
  Faction,
  HexNode,
  WorldMarket,
  WorldClock,
  WorldEntity,
  WorldChronicleEntry,
  WorldSnapshotMetric,
  GraphNode,
  GraphEdge,
  SecurityLevel,
  FactionDiplomacy,
} from '../types';
import { lancerD20 } from './dice';
import { calculerDistanceHex } from './hexcrawl';
import { RESSOURCES_CATALOGUE } from './worldEconomy';
import {
  hydraterGeographieHex,
  hydraterFactionAzgaar,
  simulerClimatEtHydrologie,
  calculerItinerairePondere,
  evaluerScoreExpansionAzgaar,
  garnisonBasePourHex,
} from './worldGeography';

export interface WorldSimulationStepResult {
  nouveauTick: number;
  factionsModifiees: Faction[];
  hexagonesModifies: HexNode[];
  marcheModifie: WorldMarket;
  nouveauxEvenementsGraph: GraphNode[];
  nouvellesRelationsGraph: GraphEdge[];
  journalFactions: string[];
  entitesMonde: WorldEntity[];
  chroniqueAjouts: WorldChronicleEntry[];
  meteoModifiee?: WorldClock;
}

const SECURITE_NIVEAUX: SecurityLevel[] = ['Sûr', 'Patrouillé', 'Dangereux', 'Périlleux'];

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function securiteDepuisPression(pression: number, estBourgade: boolean): SecurityLevel {
  if (estBourgade && pression < 40) return 'Sûr';
  if (pression < 22) return 'Sûr';
  if (pression < 45) return 'Patrouillé';
  if (pression < 75) return 'Dangereux';
  return 'Périlleux';
}

function pressionBasePourHex(hex: HexNode): number {
  if (hex.pointInteret?.type === 'bourgade') return 12;
  if (hex.terrain === 'Désert Aride') return 80;
  if (hex.terrain === 'Marais Fétide') return 58;
  if (hex.terrain === 'Forêt Dense') return 50;
  if (hex.terrain === 'Montagne Escarpée') return 45;
  return 28;
}

function capaciteEauPourTerrain(terrain: HexNode['terrain']): number {
  switch (terrain) {
    case 'Marais Fétide':
      return 90;
    case 'Plaine / Route':
      return 70;
    case 'Forêt Dense':
      return 72;
    case 'Montagne Escarpée':
      return 22;
    case 'Désert Aride':
      return 6;
  }
}

function capaciteGibierPourTerrain(terrain: HexNode['terrain']): number {
  switch (terrain) {
    case 'Forêt Dense':
      return 85;
    case 'Plaine / Route':
      return 62;
    case 'Marais Fétide':
      return 28;
    case 'Montagne Escarpée':
      return 22;
    case 'Désert Aride':
      return 8;
  }
}

function initialiserMetriquesHex(hex: HexNode): HexNode {
  const clone: HexNode = hydraterGeographieHex(hex);
  if (typeof clone.pressionDanger !== 'number') {
    const idx = SECURITE_NIVEAUX.indexOf(clone.securite);
    clone.pressionDanger = idx === 0 ? 12 : idx === 1 ? 32 : idx === 2 ? 55 : 82;
  }
  if (typeof clone.prosperite !== 'number') {
    clone.prosperite =
      clone.pointInteret?.type === 'bourgade'
        ? 75
        : clone.pointInteret?.type === 'mine'
        ? 65
        : clone.pointInteret?.type === 'fort'
        ? 50
        : 22;
  }
  if (typeof clone.niveauEau !== 'number') {
    clone.niveauEau = clone.ressourcesEau
      ? Math.max(45, capaciteEauPourTerrain(clone.terrain))
      : Math.min(18, capaciteEauPourTerrain(clone.terrain));
  }
  if (typeof clone.populationGibier !== 'number') {
    clone.populationGibier = clone.ressourcesGibier
      ? Math.max(45, capaciteGibierPourTerrain(clone.terrain))
      : Math.min(18, capaciteGibierPourTerrain(clone.terrain));
  }
  return clone;
}

function ajusterPressionHex(hex: HexNode, delta: number, plancher: SecurityLevel = 'Sûr'): void {
  const actuel = typeof hex.pressionDanger === 'number' ? hex.pressionDanger : pressionBasePourHex(hex);
  const idxPlancher = SECURITE_NIVEAUX.indexOf(plancher);
  const minPression = idxPlancher === 0 ? 0 : idxPlancher === 1 ? 22 : idxPlancher === 2 ? 45 : 75;
  hex.pressionDanger = clamp(Math.round(actuel + delta), minPression, 100);
  hex.securite = securiteDepuisPression(
    hex.pressionDanger,
    hex.pointInteret?.type === 'bourgade' && Boolean(hex.factionControleId)
  );
}

export function calculerPhaseJournee(heure: number): NonNullable<WorldClock['phaseJournee']> {
  const h = ((Math.floor(heure) % 24) + 24) % 24;
  if (h >= 5 && h <= 7) return 'Aube';
  if (h >= 8 && h <= 11) return 'Matin';
  if (h >= 12 && h <= 16) return 'Midi';
  if (h >= 17 && h <= 20) return 'Soir';
  return 'Nuit';
}

export function synchroniserControleFactions(factions: Faction[], hexagones: HexNode[]): void {
  const controleParFaction = new Map<string, Set<string>>();
  for (const f of factions) {
    controleParFaction.set(f.id, new Set());
  }

  for (const hex of hexagones) {
    if (hex.factionControleId && controleParFaction.has(hex.factionControleId)) {
      controleParFaction.get(hex.factionControleId)!.add(hex.id);
    }
  }

  for (const f of factions) {
    f.noeudsControles = Array.from(controleParFaction.get(f.id) || []);
  }
}

export function evoluerMeteo(horloge: WorldClock): {
  horlogeModifiee: WorldClock;
  aChange: boolean;
  resume?: string;
} {
  const clone: WorldClock = { ...horloge };
  const saisons: Array<'Printemps' | 'Été' | 'Automne' | 'Hiver'> = ['Automne', 'Hiver', 'Printemps', 'Été'];
  const idxSaison = Math.floor((Math.max(1, clone.jour) - 1) / 30) % 4;
  clone.saison = clone.saison || saisons[idxSaison];
  if (clone.jour > 30) {
    clone.saison = saisons[idxSaison];
  }

  const de = lancerD20('normal').valeurRetenue;
  const meteoAvant = clone.meteo;

  if (de >= 14) {
    if (meteoAvant === 'Ciel dégagé') {
      if (clone.saison === 'Été') {
        clone.meteo = de >= 18 ? 'Chaleur écrasante' : 'Vents violents';
      } else if (clone.saison === 'Hiver') {
        clone.meteo = 'Brume glaciale';
      } else {
        clone.meteo = de >= 18 ? 'Pluie battante' : de >= 16 ? 'Brume glaciale' : 'Vents violents';
      }
      clone.tendanceMeteo = 'Dégradation';
    } else if (meteoAvant === 'Vents violents') {
      clone.meteo = de >= 17 ? 'Pluie battante' : 'Ciel dégagé';
      clone.tendanceMeteo = clone.meteo === 'Ciel dégagé' ? 'Éclaircie' : 'Dégradation';
    } else if (meteoAvant === 'Brume glaciale') {
      clone.meteo = de >= 18 ? 'Pluie battante' : 'Ciel dégagé';
      clone.tendanceMeteo = clone.meteo === 'Ciel dégagé' ? 'Éclaircie' : 'Dégradation';
    } else if (meteoAvant === 'Pluie battante' || meteoAvant === 'Chaleur écrasante') {
      clone.meteo = 'Ciel dégagé';
      clone.tendanceMeteo = 'Éclaircie';
    }
  } else {
    clone.tendanceMeteo = 'Stable';
  }

  if (clone.meteo === 'Brume glaciale' || clone.saison === 'Hiver') {
    clone.temperature = 'Glacial';
  } else if (clone.meteo === 'Chaleur écrasante') {
    clone.temperature = 'Torride';
  } else {
    clone.temperature = 'Tempéré';
  }

  const aChange = clone.meteo !== meteoAvant;
  return {
    horlogeModifiee: clone,
    aChange,
    resume: aChange ? `Météo : ${clone.meteo} (${clone.temperature}).` : undefined,
  };
}

function obtenirVoisinsHex(hex: HexNode, hexagones: HexNode[]): HexNode[] {
  return hexagones.filter(h => h.id !== hex.id && calculerDistanceHex(hex, h) === 1);
}

function prochaineEtapeVers(
  depart: HexNode,
  destination: HexNode,
  hexagones: HexNode[],
  typeEntite: WorldEntity['type'] = 'CARAVANE'
): { nextHex: HexNode; itineraire: string[] } {
  if (depart.id === destination.id) return { nextHex: depart, itineraire: [depart.id] };
  const route = calculerItinerairePondere(depart.id, destination.id, hexagones, typeEntite);
  if (route.chemin.length >= 2) {
    const next = hexagones.find(h => h.id === route.chemin[1]);
    if (next) return { nextHex: next, itineraire: route.chemin };
  }
  const voisins = obtenirVoisinsHex(depart, hexagones);
  if (voisins.length === 0) return { nextHex: depart, itineraire: [depart.id] };
  voisins.sort((a, b) => calculerDistanceHex(a, destination) - calculerDistanceHex(b, destination));
  return { nextHex: voisins[0], itineraire: [depart.id, voisins[0].id] };
}

function initialiserChampsFaction(f: Faction): Faction {
  const clone: Faction = hydraterFactionAzgaar(JSON.parse(JSON.stringify(f)));
  if (!clone.posture) {
    clone.posture =
      clone.id === 'faction_guilde_marchande'
        ? 'COMMERCE'
        : clone.id === 'faction_orcs'
        ? 'RAID'
        : 'EXPANSION';
  }
  if (typeof clone.moral !== 'number') {
    clone.moral = 65;
  }
  if (!clone.relationsFactions) {
    clone.relationsFactions = {};
  }
  return clone;
}

export function evoluerEcologieHexagones(hexagones: HexNode[], horloge: WorldClock): void {
  const saison = horloge.saison || 'Automne';
  // 1. Modèle climatique et hydrologique Azgaar (ombre pluviométrique + flux descendant)
  simulerClimatEtHydrologie(hexagones, horloge);

  for (const h of hexagones) {
    const baseEau = capaciteEauPourTerrain(h.terrain);
    const apportPluie = Math.round(((h.precipitations ?? 45) - 45) * 0.22);
    const apportFlux = Math.round(((h.fluxHydro ?? 15) - 20) * 0.18);
    let eau = typeof h.niveauEau === 'number' ? h.niveauEau : baseEau;
    if (horloge.meteo === 'Pluie battante') {
      eau += h.terrain === 'Désert Aride' ? 6 : 14;
    } else if (horloge.meteo === 'Chaleur écrasante') {
      eau -= h.terrain === 'Marais Fétide' ? 4 : 11;
    } else {
      eau += Math.sign(baseEau - eau) * Math.min(4, Math.abs(baseEau - eau));
    }
    eau += Math.round((apportPluie + apportFlux) * 0.35);
    h.niveauEau = clamp(Math.round(eau), 0, 100);
    h.ressourcesEau = h.niveauEau >= 20 || h.id === 'hex_0000_bourgade';

    const baseGibier = capaciteGibierPourTerrain(h.terrain);
    let gibier = typeof h.populationGibier === 'number' ? h.populationGibier : baseGibier;
    if (saison === 'Printemps' || saison === 'Été') gibier += 4;
    else if (saison === 'Hiver') gibier -= 5;
    if ((h.temperatureC ?? 12) <= 0) gibier -= 2;
    if ((h.pressionDanger ?? 30) >= 70) gibier -= 4;
    gibier += Math.sign(baseGibier - gibier) * Math.min(3, Math.abs(baseGibier - gibier));
    h.populationGibier = clamp(Math.round(gibier), 0, 100);
    h.ressourcesGibier = h.populationGibier >= 25;

    // Équilibre progressif de la pression de danger et de la prospérité
    const ciblePression =
      h.factionControleId === 'faction_orcs'
        ? Math.max(75, pressionBasePourHex(h))
        : h.factionControleId === 'faction_guilde_marchande'
        ? Math.min(28, pressionBasePourHex(h))
        : h.pointInteret?.type === 'bourgade' && h.factionControleId
        ? Math.min(24, pressionBasePourHex(h))
        : pressionBasePourHex(h);

    const pAct = typeof h.pressionDanger === 'number' ? h.pressionDanger : ciblePression;
    const pDelta = Math.sign(ciblePression - pAct) * Math.min(3, Math.abs(ciblePression - pAct));
    h.pressionDanger = clamp(Math.round(pAct + pDelta), 0, 100);
    h.securite = securiteDepuisPression(
      h.pressionDanger,
      h.pointInteret?.type === 'bourgade' && Boolean(h.factionControleId)
    );

    const prospBase = typeof h.prosperite === 'number' ? h.prosperite : 30;
    let deltaProsp = 0;
    if ((h.factionControleId === 'faction_guilde_marchande' || h.pointInteret?.type === 'bourgade') && h.pressionDanger < 40) deltaProsp += 2;
    else if (h.pressionDanger >= 70) deltaProsp -= 3;
    if ((h.fluxHydro ?? 15) >= 40 && h.terrain !== 'Marais Fétide') deltaProsp += 1;
    if (horloge.meteo === 'Pluie battante' || horloge.meteo === 'Brume glaciale') deltaProsp -= 1;
    h.prosperite = clamp(Math.round(prospBase + deltaProsp), 5, 100);

    // Démographie et garnison locales (Azgaar cells & burgs)
    const popAct = typeof h.population === 'number' ? h.population : 50;
    const tauxCroissance =
      h.pressionDanger >= 75
        ? -0.04
        : h.prosperite >= 60 && h.niveauEau >= 35
        ? 0.02
        : h.prosperite <= 20
        ? -0.02
        : 0.005;
    const popPlancher = h.pointInteret?.type === 'bourgade' ? 600 : 12;
    const popPlafond =
      h.pointInteret?.type === 'bourgade' ? 2800 : h.pointInteret?.type === 'mine' ? 450 : 320;
    h.population = clamp(Math.round(popAct * (1 + tauxCroissance)), popPlancher, popPlafond);

    const garnisonCible = h.factionControleId ? garnisonBasePourHex(h) : 8;
    const garnisonAct = typeof h.garnison === 'number' ? h.garnison : garnisonCible;
    const gDelta = Math.sign(garnisonCible - garnisonAct) * Math.min(4, Math.abs(garnisonCible - garnisonAct));
    h.garnison = clamp(Math.round(garnisonAct + gDelta), 0, 100);
  }
}

function relationEntre(a: Faction, b: Faction): FactionDiplomacy {
  return a.relationsFactions?.[b.id] || b.relationsFactions?.[a.id] || 'NEUTRE';
}

function fixerRelation(a: Faction, b: Faction, rel: FactionDiplomacy): void {
  if (!a.relationsFactions) a.relationsFactions = {};
  if (!b.relationsFactions) b.relationsFactions = {};
  a.relationsFactions[b.id] = rel;
  b.relationsFactions[a.id] = rel;
}

function evoluerDiplomatie(
  factions: Faction[],
  hexagones: HexNode[],
  nouveauTick: number,
  jour: number,
  marche: WorldMarket,
  journalFactions: string[],
  chroniqueAjouts: WorldChronicleEntry[],
  nouveauxEvenementsGraph: GraphNode[],
  entites: WorldEntity[]
): void {
  // Mise à jour de la lassitude de guerre selon l'état des relations pour TOUTES les factions
  for (const f of factions) {
    const enGuerre = Object.values(f.relationsFactions || {}).some(r => r === 'GUERRE');
    const lass = f.lassitudeGuerre ?? 10;
    f.lassitudeGuerre = clamp(enGuerre ? lass + 3 : lass - 4, 0, 100);
  }

  const guilde = factions.find(f => f.id === 'faction_guilde_marchande');
  const iron = factions.find(f => f.id === 'faction_iron_shield');
  const orcs = factions.find(f => f.id === 'faction_orcs');

  // Mode générique Azgaar quand les factions historiques de Val-Gris ne sont pas présentes
  if (!guilde || !iron || !orcs) {
    for (let i = 0; i < factions.length; i++) {
      for (let j = i + 1; j < factions.length; j++) {
        const fa = factions[i];
        const fb = factions[j];
        const rel = relationEntre(fa, fb);
        if (rel === 'GUERRE' && (fa.lassitudeGuerre ?? 0) >= 65 && (fb.lassitudeGuerre ?? 0) >= 60) {
          fixerRelation(fa, fb, 'TENSION');
          fa.lassitudeGuerre = Math.max(20, (fa.lassitudeGuerre ?? 65) - 22);
          fb.lassitudeGuerre = Math.max(20, (fb.lassitudeGuerre ?? 60) - 22);
          const titre = `Trêve d'usure : ${fa.nom} / ${fb.nom}`;
          chroniqueAjouts.push({
            id: `chr_treve_${nouveauTick}_${fa.id}_${fb.id}`,
            tick: nouveauTick,
            jour,
            echelle: 'JOUR',
            categorie: 'DIPLOMATIE',
            titre,
            impact: 'Les deux belligérants suspendent les opérations armées.',
            causeDirecte: `Lassitude militaire mutuelle (${fa.lassitudeGuerre}% / ${fb.lassitudeGuerre}%)`,
            consequences: 'Détente sur les frontières et reprise partielle des convois',
            factionId: fa.id,
          });
          journalFactions.push(`[Tick ${nouveauTick}] ${titre}.`);
        } else if (rel === 'TENSION') {
          const ennemiCommun = factions.find(
            fc =>
              fc.id !== fa.id &&
              fc.id !== fb.id &&
              relationEntre(fa, fc) === 'GUERRE' &&
              relationEntre(fb, fc) === 'GUERRE' &&
              fc.forceMilitaire >= 65
          );
          if (ennemiCommun && fa.richesse >= 120 && fb.richesse >= 120) {
            fixerRelation(fa, fb, 'PACTE');
            const titre = `Pacte défensif : ${fa.nom} & ${fb.nom}`;
            chroniqueAjouts.push({
              id: `chr_pacte_${nouveauTick}_${fa.id}_${fb.id}`,
              tick: nouveauTick,
              jour,
              echelle: 'JOUR',
              categorie: 'DIPLOMATIE',
              titre,
              impact: `Front commun face à la pression militaire de ${ennemiCommun.nom}.`,
              causeDirecte: `Menace partagée de ${ennemiCommun.nom} (${ennemiCommun.forceMilitaire} force)`,
              consequences: 'Sécurisation des échanges entre les deux États',
              factionId: fa.id,
            });
            journalFactions.push(`[Tick ${nouveauTick}] ${titre}.`);
          } else if (fa.posture === 'RAID' && fa.forceMilitaire >= 62 && (fa.lassitudeGuerre ?? 0) < 35) {
            fixerRelation(fa, fb, 'GUERRE');
            journalFactions.push(`[Tick ${nouveauTick}] ${fa.nom} relance les hostilités contre ${fb.nom}.`);
          }
        } else if (rel === 'NEUTRE' && marche.indiceTensionCommerciale && marche.indiceTensionCommerciale >= 62) {
          if (lancerD20('normal').valeurRetenue >= 17) {
            fixerRelation(fa, fb, 'TENSION');
            chroniqueAjouts.push({
              id: `chr_tens_${nouveauTick}_${fa.id}_${fb.id}`,
              tick: nouveauTick,
              jour,
              echelle: 'JOUR',
              categorie: 'DIPLOMATIE',
              titre: `Rivalité tarifaire : ${fa.nom} / ${fb.nom}`,
              impact: 'Hausses de péages et contrôles frontaliers renforcés.',
              causeDirecte: `Tension commerciale à ${marche.indiceTensionCommerciale}/100`,
              consequences: 'Ralentissement du trafic marchand sur les axes frontaliers',
              factionId: fa.id,
            });
          }
        }
      }
    }
    return;
  }

  const relGuildeIron = relationEntre(guilde, iron);
  const menaceOrcForte = orcs.noeudsControles.length >= 2 || orcs.forceMilitaire >= 72;

  // Menace orc majeure -> rapprochement défensif Ligue <-> Bouclier de Fer
  if (menaceOrcForte && (relGuildeIron === 'TENSION' || relGuildeIron === 'GUERRE') && guilde.richesse >= 30) {
    const nouvelleRel: FactionDiplomacy = relGuildeIron === 'GUERRE' ? 'TENSION' : 'PACTE';
    fixerRelation(guilde, iron, nouvelleRel);
    if (nouvelleRel === 'PACTE') {
      guilde.richesse = Math.max(0, guilde.richesse - 12);
      iron.richesse = Math.min(300, iron.richesse + 12);
      guilde.lassitudeGuerre = Math.max(0, (guilde.lassitudeGuerre ?? 10) - 10);
      iron.lassitudeGuerre = Math.max(0, (iron.lassitudeGuerre ?? 10) - 10);
      const evtId = `event_tick_${nouveauTick}_pacte_guilde_iron`;
      const titre = 'Pacte défensif Val-Gris / Bouclier';
      nouveauxEvenementsGraph.push({
        id: evtId,
        type: 'Event',
        label: titre,
        proprietes: {
          horodatageTick: nouveauTick,
          description: 'Face aux raids du Clan Borgne, la Ligue verse un subside de trêve au Bouclier de Fer.',
        },
        connuParEntites: ['faction_guilde_marchande', 'faction_iron_shield', 'hex_0000_bourgade', 'hex_00m1_route'],
      });
      chroniqueAjouts.push({
        id: `chr_${evtId}`,
        tick: nouveauTick,
        jour,
        categorie: 'DIPLOMATIE',
        titre,
        impact: 'Trêve armée signée contre le Clan Borgne (+12 or au Bouclier).',
        factionId: guilde.id,
      });
      journalFactions.push(`[Tick ${nouveauTick}] ${titre} : trêve face à la menace orc.`);
      if (entites.filter(e => e.statut === 'EN_ROUTE').length < 6) {
        const routeMsg = calculerItinerairePondere('hex_0000_bourgade', 'hex_00m1_route', hexagones, 'MESSAGER');
        entites.push({
          id: `ent_msg_${nouveauTick}`,
          nom: 'Émissaire du pacte',
          type: 'MESSAGER',
          factionId: guilde.id,
          hexId: 'hex_0000_bourgade',
          origineHexId: 'hex_0000_bourgade',
          destinationHexId: 'hex_00m1_route',
          itineraire: routeMsg.chemin,
          force: 2,
          cargaison: 'Dépêche',
          statut: 'EN_ROUTE',
          tickCreation: nouveauTick,
          evenementId: evtId,
        });
      }
    } else {
      journalFactions.push(`[Tick ${nouveauTick}] Détente entre la Ligue et le Bouclier face au Clan Borgne.`);
    }
  } else if (!menaceOrcForte && relGuildeIron === 'PACTE' && (marche.penurieArmurerie || guilde.forceMilitaire >= 55)) {
    // Rupture de pacte si la menace retombe et les intérêts divergent
    fixerRelation(guilde, iron, 'TENSION');
    const titre = 'Rupture du pacte commercial';
    chroniqueAjouts.push({
      id: `chr_rupture_${nouveauTick}`,
      tick: nouveauTick,
      jour,
      categorie: 'DIPLOMATIE',
      titre,
      impact: 'Les désaccords sur la mine et le péage ravivent les tensions.',
      factionId: iron.id,
    });
    journalFactions.push(`[Tick ${nouveauTick}] ${titre} entre Val-Gris et le Bouclier.`);
  }

  // Trêve d'épuisement (Azgaar war exhaustion) si les orcs et un adversaire sont exsangues
  let treveSigneeCeTick = false;
  for (const partenaire of [guilde, iron]) {
    if (
      relationEntre(partenaire, orcs) === 'GUERRE' &&
      (orcs.lassitudeGuerre ?? 0) >= 65 &&
      (partenaire.lassitudeGuerre ?? 0) >= 55
    ) {
      fixerRelation(partenaire, orcs, 'TENSION');
      orcs.lassitudeGuerre = 52;
      partenaire.lassitudeGuerre = 45;
      treveSigneeCeTick = true;
      const titre = `Trêve d'usure (${partenaire.nom.split(' ')[0]} / Clan Borgne)`;
      chroniqueAjouts.push({
        id: `chr_treve_${nouveauTick}_${partenaire.id}`,
        tick: nouveauTick,
        jour,
        categorie: 'DIPLOMATIE',
        titre,
        impact: 'L’épuisement militaire suspend les raids ouverts.',
        factionId: partenaire.id,
      });
      journalFactions.push(`[Tick ${nouveauTick}] ${titre}.`);
    }
  }

  // Reprise des hostilités si le Clan Borgne reconstitue ses forces
  if (!treveSigneeCeTick && orcs.forceMilitaire >= 58 && (orcs.lassitudeGuerre ?? 0) < 40) {
    for (const partenaire of [guilde, iron]) {
      if (relationEntre(partenaire, orcs) === 'TENSION') {
        fixerRelation(partenaire, orcs, 'GUERRE');
        journalFactions.push(`[Tick ${nouveauTick}] Le Clan Borgne rompt la trêve avec ${partenaire.nom}.`);
      }
    }
  }
}

function choisirCibleExpansion(
  faction: Faction,
  factions: Faction[],
  hexagones: HexNode[]
): HexNode | undefined {
  const candidats = hexagones.filter(h => {
    if (h.estEau) return false;
    if (h.factionControleId === faction.id) return false;
    if ((h.id === 'hex_0000_bourgade' || h.pointInteret?.type === 'bourgade') && faction.id !== 'faction_guilde_marchande' && faction.forceMilitaire < 70) {
      return false;
    }
    if (h.factionControleId) {
      const def = factions.find(f => f.id === h.factionControleId);
      if (def && relationEntre(faction, def) === 'PACTE') return false;
    }
    const estAdjacent = faction.noeudsControles.some(cId => {
      const ch = hexagones.find(x => x.id === cId);
      return ch ? calculerDistanceHex(ch, h) <= 1 : false;
    });
    const estStrategique =
      h.id === 'hex_0100_mine' ||
      h.id === 'hex_00m1_route' ||
      h.id === 'hex_0001_foret' ||
      h.ressourcePrincipale === 'FER' ||
      h.ressourcePrincipale === 'OR' ||
      h.pointInteret?.type === 'fort';
    return estAdjacent || estStrategique;
  });

  if (candidats.length === 0) return undefined;

  candidats.sort(
    (a, b) => evaluerScoreExpansionAzgaar(faction, b, hexagones) - evaluerScoreExpansionAzgaar(faction, a, hexagones)
  );

  return candidats[0];
}

export function simulerMondeComplet(
  etatSource: SimulationState,
  options?: { evoluerTempsMeteo?: boolean }
): {
  etatModifie: SimulationState;
  resultat: WorldSimulationStepResult;
} {
  const etat: SimulationState = JSON.parse(JSON.stringify(etatSource));
  const nouveauTick = etat.horloge.tick + 1;
  etat.horloge.tick = nouveauTick;

  const factions = etat.factions.map(initialiserChampsFaction);
  const hexagones: HexNode[] = etat.hexagones.map(initialiserMetriquesHex);
  const marche: WorldMarket = {
    multiplicateurVivres: 1.0,
    penurieVivres: false,
    tendanceFer: 'STABLE',
    tendanceVivres: 'STABLE',
    demandeLocale: 'Fer brut',
    indiceTensionCommerciale: 20,
    volumeEchanges: 0,
    ...etat.marche,
  };

  synchroniserControleFactions(factions, hexagones);

  const nouveauxEvenementsGraph: GraphNode[] = [];
  const nouvellesRelationsGraph: GraphEdge[] = [];
  const journalFactions: string[] = [];
  const chroniqueAjouts: WorldChronicleEntry[] = [];

  // 1. Évolution météo
  let horlogeMaj = etat.horloge;
  if (options?.evoluerTempsMeteo !== false) {
    const resMeteo = evoluerMeteo(etat.horloge);
    horlogeMaj = resMeteo.horlogeModifiee;
    etat.horloge = horlogeMaj;
    if (resMeteo.aChange && resMeteo.resume) {
      journalFactions.push(resMeteo.resume);
      chroniqueAjouts.push({
        id: `chr_meteo_${nouveauTick}`,
        tick: nouveauTick,
        jour: horlogeMaj.jour,
        categorie: 'METEO',
        titre: horlogeMaj.meteo,
        impact: `${horlogeMaj.meteo} (${horlogeMaj.temperature}, ${horlogeMaj.saison || 'Automne'}).`,
      });
    }
  }

  // 2. Écologie des hexagones (eau, gibier, pression, prospérité)
  evoluerEcologieHexagones(hexagones, horlogeMaj);

  // 3. Démographie, fiscalité, plafond militaire et posture des factions (Azgaar states & military)
  for (const f of factions) {
    let revenu = 0;
    let popFaction = 0;
    for (const hId of f.noeudsControles) {
      const h = hexagones.find(x => x.id === hId);
      if (!h) continue;
      const pop = h.population ?? 50;
      popFaction += pop;
      const multProsp = 0.6 + ((h.prosperite ?? 40) / 100) * 0.8;
      const baseImpot = Math.round(pop / 110);
      if (h.pointInteret?.type === 'bourgade') revenu += Math.round((10 + baseImpot) * multProsp);
      else if (h.pointInteret?.type === 'mine') revenu += Math.round((16 + baseImpot) * multProsp);
      else if (h.pointInteret?.type === 'fort') revenu += Math.round((8 + baseImpot) * multProsp);
      else revenu += Math.round((3 + baseImpot) * multProsp);
    }

    // Bonus commercial de pacte
    const aUnPacte = Object.values(f.relationsFactions || {}).some(r => r === 'PACTE');
    if (aUnPacte) revenu += 4;

    f.populationTotale = popFaction;
    f.forceMax = clamp(
      34 + Math.round(Math.sqrt(Math.max(20, popFaction)) * 1.25) + (f.id === 'faction_iron_shield' ? 28 : f.id === 'faction_orcs' ? 18 : 0),
      35,
      98
    );

    const entretien = Math.floor(f.forceMilitaire / 13);
    f.revenuFiscal = revenu - entretien;
    const soldeAvant = f.richesse + revenu;
    if (soldeAvant < entretien) {
      f.richesse = 0;
      f.forceMilitaire = Math.max(10, f.forceMilitaire - 3);
      f.moral = Math.max(15, (f.moral ?? 65) - 5);
    } else {
      f.richesse = clamp(soldeAvant - entretien, 0, 300);
    }

    const capMilitaire = f.forceMax;

    if (f.id === 'faction_guilde_marchande') {
      const controleMine = f.noeudsControles.includes('hex_0100_mine');
      if ((!controleMine || marche.penurieArmurerie) && f.richesse >= 30 && f.forceMilitaire < Math.min(capMilitaire, 72)) {
        f.richesse -= 22;
        f.forceMilitaire = Math.min(capMilitaire, f.forceMilitaire + 8);
        f.posture = 'EXPANSION';
        f.effectifActif = 'Mercenaires engagés pour reprendre Roche-Noire';
        journalFactions.push(`${f.nom} recrute des gardes pour sécuriser les filons.`);
      } else if (controleMine && f.forceMilitaire >= 28) {
        f.posture = 'COMMERCE';
        f.effectifActif = 'Convois de fer vers Val-Gris';
      } else {
        f.posture = 'DEFENSE';
        f.effectifActif = 'Défense des palissades';
      }
    } else if (f.id === 'faction_iron_shield') {
      if (f.richesse >= 50 && f.forceMilitaire < capMilitaire) {
        f.richesse -= 18;
        f.forceMilitaire = Math.min(capMilitaire, f.forceMilitaire + 5);
      }
      if (f.forceMilitaire < 36 || (f.moral ?? 65) < 35) {
        f.posture = 'DEFENSE';
        f.effectifActif = 'Consolidation du poste de péage';
      } else {
        f.posture = 'EXPANSION';
        f.effectifActif = 'Pression sur les cols et la mine';
      }
    } else if (f.id === 'faction_orcs') {
      if (f.richesse >= 35 && f.forceMilitaire < capMilitaire) {
        f.richesse -= 14;
        f.forceMilitaire = Math.min(capMilitaire, f.forceMilitaire + 5);
      }
      if (f.forceMilitaire < 30 || (f.moral ?? 65) < 30 || (f.lassitudeGuerre ?? 0) >= 75) {
        f.posture = 'DEFENSE';
        f.effectifActif = 'Repli dans les dunes orientales';
      } else {
        f.posture = 'RAID';
        f.effectifActif = 'Incursions sur les voies et lisières';
      }
    } else {
      // Logique autonome générique pour les États Azgaar
      const enGuerre = Object.values(f.relationsFactions || {}).some(r => r === 'GUERRE');
      if (f.richesse >= 110 && f.forceMilitaire < capMilitaire) {
        f.richesse -= 28;
        f.forceMilitaire = Math.min(capMilitaire, f.forceMilitaire + 4);
      }
      if (f.forceMilitaire < 34 || (f.moral ?? 65) < 36 || (f.lassitudeGuerre ?? 0) >= 72) {
        f.posture = 'DEFENSE';
        f.effectifActif = `Garde défensive de ${f.nom}`;
      } else if (f.relationsJoueur === 'HOSTILE' || (enGuerre && f.forceMilitaire >= 52 && f.richesse < 180)) {
        f.posture = 'RAID';
        f.effectifActif = `Compagnies frontalières de ${f.nom}`;
      } else if (enGuerre && f.forceMilitaire >= 58) {
        f.posture = 'EXPANSION';
        f.effectifActif = `Ost en campagne de ${f.nom}`;
      } else {
        f.posture = 'COMMERCE';
        f.effectifActif = `Convois marchands de ${f.nom}`;
      }
    }

    const moralAct = f.moral ?? 65;
    if (moralAct < 65) f.moral = Math.min(65, moralAct + 4);
    else if (moralAct > 80) f.moral = Math.max(70, moralAct - 2);
  }

  // Entités conservées depuis le tour précédent
  let entites: WorldEntity[] = (etat.entitesMonde || [])
    .map(e => ({ ...e }))
    .filter(e => e.statut === 'EN_ROUTE' || nouveauTick - e.tickCreation <= 2);

  // 4. Diplomatie dynamique entre factions
  evoluerDiplomatie(
    factions,
    hexagones,
    nouveauTick,
    horlogeMaj.jour,
    marche,
    journalFactions,
    chroniqueAjouts,
    nouveauxEvenementsGraph,
    entites
  );

  // 5. Opérations autonomes des factions (conquêtes topologiques & raids)
  for (const faction of factions) {
    if (faction.posture === 'DEFENSE' || faction.posture === 'TREVE') continue;

    if (faction.posture === 'EXPANSION') {
      const cibleHex = choisirCibleExpansion(faction, factions, hexagones);
      if (!cibleHex) continue;

      const defenseur = factions.find(f => f.id === cibleHex.factionControleId);
      const bonusMoralAtt = Math.floor(((faction.moral ?? 65) - 50) / 15);
      const jetAtt = lancerD20('normal').valeurRetenue;
      const scoreAtt = jetAtt + Math.floor(faction.forceMilitaire / 10) + bonusMoralAtt;

      const garnisonAct = cibleHex.garnison ?? garnisonBasePourHex(cibleHex);
      const defenseTerrain =
        cibleHex.pointInteret?.type === 'bourgade'
          ? 4
          : cibleHex.terrain === 'Montagne Escarpée'
          ? 4
          : cibleHex.pointInteret?.type === 'fort'
          ? 3
          : 2;
      const bonusGarnison = Math.floor(garnisonAct / 22);
      const forceDef = defenseur ? Math.floor(defenseur.forceMilitaire / 12) : 1;
      const jetDef = lancerD20('normal').valeurRetenue;
      const scoreDef = jetDef + defenseTerrain + bonusGarnison + forceDef;

      if (scoreAtt > scoreDef) {
        const siegeRequis =
          Boolean(cibleHex.factionControleId) && garnisonAct >= 50 && scoreAtt - scoreDef < 9;

        if (siegeRequis) {
          cibleHex.garnison = Math.max(15, garnisonAct - 32);
          ajusterPressionHex(cibleHex, 10);
          cibleHex.prosperite = clamp((cibleHex.prosperite ?? 40) - 6, 5, 100);
          faction.forceMilitaire = Math.max(10, faction.forceMilitaire - 2);
          faction.lassitudeGuerre = clamp((faction.lassitudeGuerre ?? 10) + 4, 0, 100);
          if (defenseur) {
            defenseur.forceMilitaire = Math.max(10, defenseur.forceMilitaire - 4);
            defenseur.lassitudeGuerre = clamp((defenseur.lassitudeGuerre ?? 10) + 5, 0, 100);
            fixerRelation(faction, defenseur, 'GUERRE');
          }
          const titreSiege = `Siège devant ${cibleHex.nom}`;
          journalFactions.push(
            `[Tick ${nouveauTick}] ${faction.nom} entame les défenses de ${cibleHex.nom} (garnison ${cibleHex.garnison}%).`
          );
          chroniqueAjouts.push({
            id: `chr_siege_${nouveauTick}_${cibleHex.id}`,
            tick: nouveauTick,
            jour: horlogeMaj.jour,
            categorie: 'FACTION',
            titre: titreSiege,
            impact: `Garnison réduite à ${cibleHex.garnison}%.`,
            hexId: cibleHex.id,
            factionId: faction.id,
          });
          continue;
        }

        const ancienOwnerId = cibleHex.factionControleId;
        cibleHex.factionControleId = faction.id;
        cibleHex.garnison = Math.min(45, Math.max(20, Math.round(faction.forceMilitaire * 0.45)));
        if (cibleHex.pointInteret) {
          cibleHex.pointInteret.statut =
            faction.id === 'faction_guilde_marchande' ? 'OPERATIONNEL' : 'OCCUPIED';
        }
        ajusterPressionHex(
          cibleHex,
          faction.id === 'faction_guilde_marchande' ? -15 : faction.id === 'faction_orcs' ? 22 : 10,
          faction.id === 'faction_guilde_marchande' ? 'Patrouillé' : 'Dangereux'
        );
        cibleHex.prosperite = clamp((cibleHex.prosperite ?? 40) - 8, 5, 100);
        cibleHex.population = Math.max(15, Math.round((cibleHex.population ?? 60) * 0.92));

        faction.moral = Math.min(100, (faction.moral ?? 65) + 6);
        faction.forceMilitaire = Math.max(10, faction.forceMilitaire - 2);
        faction.lassitudeGuerre = clamp((faction.lassitudeGuerre ?? 10) + 3, 0, 100);
        if (defenseur) {
          defenseur.forceMilitaire = Math.max(10, defenseur.forceMilitaire - 6);
          defenseur.moral = Math.max(10, (defenseur.moral ?? 65) - 8);
          defenseur.lassitudeGuerre = clamp((defenseur.lassitudeGuerre ?? 10) + 7, 0, 100);
          if (cibleHex.id === 'hex_0100_mine' && defenseur.id === 'faction_guilde_marchande') {
            defenseur.posture = defenseur.richesse >= 30 ? 'EXPANSION' : 'DEFENSE';
            defenseur.effectifActif = 'Préparation de reprise de Roche-Noire';
          }
          fixerRelation(faction, defenseur, 'GUERRE');
        }

        synchroniserControleFactions(factions, hexagones);

        const evtId = `event_tick_${nouveauTick}_cap_${cibleHex.id}_${faction.id}`;
        const label =
          faction.id === 'faction_guilde_marchande'
            ? `${faction.nom} reprend ${cibleHex.nom}`
            : `${faction.nom} occupe ${cibleHex.nom}`;
        const connuInit = [faction.id, cibleHex.id];
        if (ancienOwnerId) connuInit.push(ancienOwnerId);

        nouveauxEvenementsGraph.push({
          id: evtId,
          type: 'Event',
          label,
          proprietes: {
            horodatageTick: nouveauTick,
            attaquant: faction.id,
            noeudCible: cibleHex.id,
            description: `${label} (${scoreAtt} vs ${scoreDef}).`,
          },
          connuParEntites: connuInit,
        });
        nouvellesRelationsGraph.push({
          source: faction.id,
          cible: cibleHex.id,
          relation: 'CONTROLLED_BY',
          horodatageTick: nouveauTick,
        });

        journalFactions.push(`[Tick ${nouveauTick}] ${label} (${scoreAtt} vs ${scoreDef}).`);
        chroniqueAjouts.push({
          id: `chr_${evtId}`,
          tick: nouveauTick,
          jour: horlogeMaj.jour,
          categorie: 'FACTION',
          titre: label,
          impact: `Contrôle transféré sur ${cibleHex.nom}.`,
          hexId: cibleHex.id,
          factionId: faction.id,
        });

        // Dépêcher un messager par route pondérée vers Val-Gris
        if (cibleHex.id !== 'hex_0000_bourgade' && entites.filter(e => e.statut === 'EN_ROUTE').length < 6) {
          const routeMsg = calculerItinerairePondere(cibleHex.id, 'hex_0000_bourgade', hexagones, 'MESSAGER');
          entites.push({
            id: `ent_msg_cap_${nouveauTick}`,
            nom: 'Courrier d’alerte',
            type: 'MESSAGER',
            factionId: ancienOwnerId || 'faction_guilde_marchande',
            hexId: cibleHex.id,
            origineHexId: cibleHex.id,
            destinationHexId: 'hex_0000_bourgade',
            itineraire: routeMsg.chemin,
            force: 2,
            cargaison: 'Dépêche',
            statut: 'EN_ROUTE',
            tickCreation: nouveauTick,
            evenementId: evtId,
          });
        }
      } else {
        faction.forceMilitaire = Math.max(10, faction.forceMilitaire - 3);
        faction.moral = Math.max(10, (faction.moral ?? 65) - 4);
        faction.lassitudeGuerre = clamp((faction.lassitudeGuerre ?? 10) + 4, 0, 100);
        journalFactions.push(
          `[Tick ${nouveauTick}] ${faction.nom} échoue devant ${cibleHex.nom} (${scoreAtt} vs ${scoreDef}).`
        );
      }
    } else if (faction.posture === 'RAID') {
      const ciblesRaid = hexagones.filter(h => {
        if (h.factionControleId === faction.id) return false;
        if (h.id === 'hex_0000_bourgade' && faction.forceMilitaire < 65) return false;
        if (h.factionControleId) {
          const def = factions.find(f => f.id === h.factionControleId);
          if (def && relationEntre(faction, def) === 'PACTE') return false;
        }
        return true;
      });
      if (ciblesRaid.length > 0) {
        const cibleRaid = ciblesRaid[(nouveauTick + faction.forceMilitaire) % ciblesRaid.length];
        const jetRaid = lancerD20('normal').valeurRetenue + Math.floor(faction.forceMilitaire / 12);
        const defBase = cibleRaid.securite === 'Sûr' ? 14 : cibleRaid.securite === 'Patrouillé' ? 13 : 10;
        if (jetRaid > defBase) {
          ajusterPressionHex(cibleRaid, 18);
          cibleRaid.prosperite = clamp((cibleRaid.prosperite ?? 30) - 10, 5, 100);
          cibleRaid.garnison = Math.max(0, (cibleRaid.garnison ?? 20) - 8);
          cibleRaid.population = Math.max(12, Math.round((cibleRaid.population ?? 50) * 0.94));
          faction.richesse = Math.min(200, faction.richesse + 10);
          const evtId = `event_tick_${nouveauTick}_raid_${cibleRaid.id}`;
          const label = `Incursion du Clan Borgne vers ${cibleRaid.nom}`;
          nouveauxEvenementsGraph.push({
            id: evtId,
            type: 'Event',
            label,
            proprietes: {
              horodatageTick: nouveauTick,
              attaquant: faction.id,
              noeudCible: cibleRaid.id,
              description: `Des éclaireurs orcs pillent les abords de ${cibleRaid.nom}. Sécurité : ${cibleRaid.securite}.`,
            },
            connuParEntites: [faction.id, cibleRaid.id],
          });
          journalFactions.push(`[Tick ${nouveauTick}] ${label} — sécurité dégradée (${cibleRaid.securite}).`);
          chroniqueAjouts.push({
            id: `chr_${evtId}`,
            tick: nouveauTick,
            jour: horlogeMaj.jour,
            categorie: 'FACTION',
            titre: label,
            impact: `Sécurité locale : ${cibleRaid.securite}.`,
            hexId: cibleRaid.id,
            factionId: faction.id,
          });

          // Fuite de réfugiés si une colonie peuplée est frappée
          if (
            cibleRaid.id !== 'hex_0000_bourgade' &&
            (cibleRaid.population ?? 0) >= 80 &&
            entites.filter(e => e.statut === 'EN_ROUTE').length < 6 &&
            !entites.some(e => e.type === 'REFUGIES' && e.statut === 'EN_ROUTE')
          ) {
            const routeRef = calculerItinerairePondere(cibleRaid.id, 'hex_0000_bourgade', hexagones, 'REFUGIES');
            entites.push({
              id: `ent_ref_${nouveauTick}`,
              nom: `Réfugiés de ${cibleRaid.nom.split(' ')[0]}`,
              type: 'REFUGIES',
              factionId: cibleRaid.factionControleId || 'faction_guilde_marchande',
              hexId: cibleRaid.id,
              origineHexId: cibleRaid.id,
              destinationHexId: 'hex_0000_bourgade',
              itineraire: routeRef.chemin,
              force: 1,
              cargaison: 'Civils',
              statut: 'EN_ROUTE',
              tickCreation: nouveauTick,
            });
          }
        }
      }
    }
  }

  // 6. Entités mobiles autonomes (Caravanes, Patrouilles, Raiders, Messagers, Réfugiés — routage Dijkstra Azgaar)
  for (const ent of entites) {
    if (ent.statut !== 'EN_ROUTE') continue;
    const hexPos = hexagones.find(h => h.id === ent.hexId);
    const hexDest = hexagones.find(h => h.id === ent.destinationHexId);
    if (!hexPos || !hexDest) {
      ent.statut = 'DISPERSE';
      continue;
    }
    if (hexPos.id !== hexDest.id) {
      const step = prochaineEtapeVers(hexPos, hexDest, hexagones, ent.type);
      ent.hexId = step.nextHex.id;
      ent.itineraire = step.itineraire;
      if (ent.type === 'PATROUILLE') {
        ajusterPressionHex(step.nextHex, -6, 'Sûr');
        if (step.nextHex.factionControleId === ent.factionId) {
          step.nextHex.garnison = clamp((step.nextHex.garnison ?? 20) + 4, 0, 100);
        }
      }
    }
  }

  // Collisions dans un même hexagone
  const enRoute = entites.filter(e => e.statut === 'EN_ROUTE');
  for (const hex of hexagones) {
    const surHex = enRoute.filter(e => e.hexId === hex.id && e.statut === 'EN_ROUTE');
    if (surHex.length < 2) continue;

    const raiders = surHex.filter(e => e.type === 'RAIDER');
    const caravanes = surHex.filter(e => e.type === 'CARAVANE');
    const patrouilles = surHex.filter(e => e.type === 'PATROUILLE');

    for (const raider of raiders) {
      if (raider.statut !== 'EN_ROUTE') continue;
      const ciblePatrouille = patrouilles.find(p => p.statut === 'EN_ROUTE');
      if (ciblePatrouille) {
        const sPat = lancerD20('normal').valeurRetenue + ciblePatrouille.force;
        const sRaid = lancerD20('normal').valeurRetenue + raider.force;
        if (sPat >= sRaid) {
          raider.statut = 'DISPERSE';
          ajusterPressionHex(hex, -10, 'Patrouillé');
          journalFactions.push(`${ciblePatrouille.nom} disperse ${raider.nom} dans ${hex.nom}.`);
        } else {
          ciblePatrouille.statut = 'DISPERSE';
          ajusterPressionHex(hex, 8);
          journalFactions.push(`${raider.nom} repousse ${ciblePatrouille.nom} vers ${hex.nom}.`);
        }
        continue;
      }

      const cibleCaravane = caravanes.find(c => c.statut === 'EN_ROUTE');
      if (cibleCaravane) {
        const sCar = lancerD20('normal').valeurRetenue + cibleCaravane.force;
        const sRaid = lancerD20('normal').valeurRetenue + raider.force;
        if (sRaid > sCar) {
          cibleCaravane.statut = 'INTERCEPTE';
          raider.cargaison = 'Butin';
          raider.origineHexId = hex.id;
          raider.destinationHexId = 'hex_01m1_desert';
          marche.multiplicateurFer = Number(Math.min(2.5, marche.multiplicateurFer + 0.25).toFixed(2));
          marche.penurieArmurerie = true;
          ajusterPressionHex(hex, 14);
          hex.prosperite = clamp((hex.prosperite ?? 30) - 8, 5, 100);

          const evtId = `event_tick_${nouveauTick}_pillage_${hex.id}`;
          nouveauxEvenementsGraph.push({
            id: evtId,
            type: 'Event',
            label: `${cibleCaravane.nom} pillé près de ${hex.nom}`,
            proprietes: {
              horodatageTick: nouveauTick,
              description: `Le convoi a été intercepté dans ${hex.nom}. Le prix du fer grimpe.`,
            },
            connuParEntites: [cibleCaravane.factionId, raider.factionId, hex.id],
          });
          journalFactions.push(`${raider.nom} pille ${cibleCaravane.nom} à ${hex.nom}.`);
          chroniqueAjouts.push({
            id: `chr_${evtId}`,
            tick: nouveauTick,
            jour: horlogeMaj.jour,
            categorie: 'MOUVEMENT',
            titre: 'Convoi pillé',
            impact: `${cibleCaravane.nom} intercepté à ${hex.nom}.`,
            hexId: hex.id,
          });
        } else {
          raider.statut = 'DISPERSE';
          journalFactions.push(`L'escorte de ${cibleCaravane.nom} met en fuite ${raider.nom}.`);
        }
      }
    }
  }

  // Arrivées à destination
  let livraisonFerReussie = false;
  let livraisonVivresReussie = false;
  for (const ent of entites) {
    if (ent.statut !== 'EN_ROUTE') continue;
    if (ent.hexId === ent.destinationHexId) {
      if (ent.type === 'CARAVANE') {
        ent.statut = 'ARRIVE';
        if (ent.cargaison === 'Vivres') livraisonVivresReussie = true;
        else livraisonFerReussie = true;
        marche.volumeEchanges = (marche.volumeEchanges ?? 0) + 1;
        const fac = factions.find(f => f.id === ent.factionId);
        if (fac) fac.richesse = Math.min(300, fac.richesse + 12);
        const destHex = hexagones.find(h => h.id === ent.destinationHexId);
        if (destHex) {
          destHex.prosperite = clamp((destHex.prosperite ?? 50) + 4, 5, 100);
          destHex.population = Math.min(2800, (destHex.population ?? 50) + 6);
        }

        for (const evtNode of [...etat.grapheNoeuds, ...nouveauxEvenementsGraph]) {
          if (evtNode.type === 'Event' && evtNode.connuParEntites) {
            if (!evtNode.connuParEntites.includes(ent.destinationHexId)) {
              evtNode.connuParEntites.push(ent.destinationHexId);
            }
          }
        }
        journalFactions.push(`${ent.nom} livre sa cargaison à ${destHex?.nom || 'destination'}.`);
      } else if (ent.type === 'REFUGIES') {
        ent.statut = 'ARRIVE';
        const destHex = hexagones.find(h => h.id === ent.destinationHexId);
        if (destHex) {
          destHex.population = Math.min(2800, (destHex.population ?? 100) + 18);
          destHex.prosperite = clamp((destHex.prosperite ?? 50) - 2, 5, 100);
        }
        journalFactions.push(`${ent.nom} rejoignent ${destHex?.nom || 'Val-Gris'}.`);
      } else if (ent.type === 'MESSAGER') {
        ent.statut = 'ARRIVE';
        for (const evtNode of [...etat.grapheNoeuds, ...nouveauxEvenementsGraph]) {
          if (
            evtNode.type === 'Event' &&
            evtNode.connuParEntites &&
            (!ent.evenementId || evtNode.id === ent.evenementId)
          ) {
            if (!evtNode.connuParEntites.includes(ent.destinationHexId)) {
              evtNode.connuParEntites.push(ent.destinationHexId);
            }
          }
        }
      } else if (ent.type === 'PATROUILLE') {
        const hexAct = hexagones.find(h => h.id === ent.hexId);
        if (hexAct) {
          ajusterPressionHex(hexAct, -12, 'Patrouillé');
        }
        const f = factions.find(x => x.id === ent.factionId);
        if (f && f.noeudsControles.length > 1) {
          const autre = f.noeudsControles.find(id => id !== ent.hexId);
          if (autre) {
            ent.origineHexId = ent.hexId;
            ent.destinationHexId = autre;
            ent.itineraire = calculerItinerairePondere(ent.hexId, autre, hexagones, 'PATROUILLE').chemin;
          }
        }
      } else if (ent.type === 'RAIDER') {
        if (ent.cargaison === 'Butin') {
          ent.statut = 'ARRIVE';
        } else {
          ent.origineHexId = ent.hexId;
          ent.destinationHexId = 'hex_01m1_desert';
          ent.itineraire = calculerItinerairePondere(ent.hexId, 'hex_01m1_desert', hexagones, 'RAIDER').chemin;
          ent.cargaison = 'Butin';
        }
      }
    }
  }

  // Création de nouvelles entités autonomes (plafonné à 6 EN_ROUTE, avec itinéraire Dijkstra)
  const actives = entites.filter(e => e.statut === 'EN_ROUTE');
  if (actives.length < 6) {
    const guilde = factions.find(f => f.id === 'faction_guilde_marchande');
    if (
      guilde &&
      guilde.noeudsControles.includes('hex_0100_mine') &&
      !actives.some(e => e.type === 'CARAVANE' && e.factionId === 'faction_guilde_marchande')
    ) {
      const routeCarav = calculerItinerairePondere('hex_0100_mine', 'hex_0000_bourgade', hexagones, 'CARAVANE');
      entites.push({
        id: `ent_carav_${nouveauTick}`,
        nom: 'Convoi de la Ligue',
        type: 'CARAVANE',
        factionId: 'faction_guilde_marchande',
        hexId: 'hex_0100_mine',
        origineHexId: 'hex_0100_mine',
        destinationHexId: 'hex_0000_bourgade',
        itineraire: routeCarav.chemin,
        force: 5,
        cargaison: 'Minerai',
        statut: 'EN_ROUTE',
        tickCreation: nouveauTick,
      });
    } else if (
      guilde &&
      guilde.richesse >= 35 &&
      !actives.some(e => e.type === 'CARAVANE' && e.cargaison === 'Vivres')
    ) {
      const iron = factions.find(f => f.id === 'faction_iron_shield');
      const cibleVivres =
        iron && relationEntre(guilde, iron) === 'PACTE'
          ? 'hex_00m1_route'
          : guilde.noeudsControles.find(id => id !== 'hex_0000_bourgade');
      if (cibleVivres) {
        const routeViv = calculerItinerairePondere('hex_0000_bourgade', cibleVivres, hexagones, 'CARAVANE');
        entites.push({
          id: `ent_vivres_${nouveauTick}`,
          nom: 'Charroi de vivres',
          type: 'CARAVANE',
          factionId: 'faction_guilde_marchande',
          hexId: 'hex_0000_bourgade',
          origineHexId: 'hex_0000_bourgade',
          destinationHexId: cibleVivres,
          itineraire: routeViv.chemin,
          force: 4,
          cargaison: 'Vivres',
          statut: 'EN_ROUTE',
          tickCreation: nouveauTick,
        });
      }
    }

    const orcs = factions.find(f => f.id === 'faction_orcs');
    if (
      orcs &&
      orcs.posture === 'RAID' &&
      !actives.some(e => e.type === 'RAIDER') &&
      lancerD20('normal').valeurRetenue >= 10
    ) {
      const dest = lancerD20('normal').valeurRetenue >= 11 ? 'hex_0100_mine' : 'hex_0001_foret';
      const routeRaid = calculerItinerairePondere('hex_01m1_desert', dest, hexagones, 'RAIDER');
      entites.push({
        id: `ent_raid_${nouveauTick}`,
        nom: 'Meute du Clan Borgne',
        type: 'RAIDER',
        factionId: 'faction_orcs',
        hexId: 'hex_01m1_desert',
        origineHexId: 'hex_01m1_desert',
        destinationHexId: dest,
        itineraire: routeRaid.chemin,
        force: 5,
        statut: 'EN_ROUTE',
        tickCreation: nouveauTick,
      });
    }

    const iron = factions.find(f => f.id === 'faction_iron_shield');
    if (
      iron &&
      iron.forceMilitaire >= 25 &&
      !actives.some(e => e.type === 'PATROUILLE' && e.factionId === 'faction_iron_shield')
    ) {
      const depart = iron.noeudsControles[0] || 'hex_00m1_route';
      const dest = iron.noeudsControles.includes('hex_0100_mine') ? 'hex_0100_mine' : 'hex_00m1_route';
      const routePat = calculerItinerairePondere(depart, dest, hexagones, 'PATROUILLE');
      entites.push({
        id: `ent_pat_${nouveauTick}`,
        nom: 'Patrouille du Bouclier',
        type: 'PATROUILLE',
        factionId: 'faction_iron_shield',
        hexId: depart,
        origineHexId: depart,
        destinationHexId: dest,
        itineraire: routePat.chemin,
        force: 6,
        statut: 'EN_ROUTE',
        tickCreation: nouveauTick,
      });
    }

    // Mode générique Azgaar : créer des caravanes de denrées, patrouilles & raiders selon ressources & postures
    const estMondeValGris = factions.some(f => f.id === 'faction_guilde_marchande');
    if (!estMondeValGris) {
      const terres = hexagones.filter(h => !h.estEau);
      const bourgDest =
        terres.find(h => h.id === etat.hexActuel.id) ||
        terres.find(h => h.pointInteret?.type === 'bourgade') ||
        terres[0];

      // Caravane de ressource entre producteur et bourg
      if (bourgDest && actives.filter(e => e.type === 'CARAVANE').length < 2) {
        const producteur = terres.find(
          h =>
            h.id !== bourgDest.id &&
            (h.ressourcePrincipale === 'FER' ||
              h.ressourcePrincipale === 'OR' ||
              h.ressourcePrincipale === 'BOIS' ||
              h.ressourcePrincipale === 'CEREALES' ||
              h.ressourcePrincipale === 'POISSON_SEL')
        );
        if (producteur) {
          const rType = producteur.ressourcePrincipale || 'CEREALES';
          const cargo = RESSOURCES_CATALOGUE[rType]?.cargoLabel || 'Vivres';
          const routeCarav = calculerItinerairePondere(producteur.id, bourgDest.id, hexagones, 'CARAVANE');
          if (routeCarav.chemin.length >= 2) {
            entites.push({
              id: `ent_az_carav_${nouveauTick}_${producteur.id}`,
              nom: `Convoi de ${producteur.nom.split(' ')[0]}`,
              type: 'CARAVANE',
              factionId: producteur.factionControleId || factions[0]?.id || 'faction_1',
              hexId: producteur.id,
              origineHexId: producteur.id,
              destinationHexId: bourgDest.id,
              itineraire: routeCarav.chemin,
              force: 5,
              cargaison: cargo,
              statut: 'EN_ROUTE',
              tickCreation: nouveauTick,
            });
          }
        }
      }

      // Patrouille d'État sur axes frontaliers
      const facPat = factions.find(f => f.posture !== 'RAID' && f.noeudsControles.length >= 2 && f.forceMilitaire >= 32);
      if (facPat && !actives.some(e => e.type === 'PATROUILLE' && e.factionId === facPat.id)) {
        const dep = facPat.noeudsControles[0];
        const dst = facPat.noeudsControles[facPat.noeudsControles.length - 1];
        if (dep && dst && dep !== dst) {
          const routePat = calculerItinerairePondere(dep, dst, hexagones, 'PATROUILLE');
          entites.push({
            id: `ent_az_pat_${nouveauTick}`,
            nom: `Patrouille (${facPat.nom.split(' ')[0]})`,
            type: 'PATROUILLE',
            factionId: facPat.id,
            hexId: dep,
            origineHexId: dep,
            destinationHexId: dst,
            itineraire: routePat.chemin,
            force: 6,
            statut: 'EN_ROUTE',
            tickCreation: nouveauTick,
          });
        }
      }

      // Raider d'une faction hostile si disponible
      const facRaid = factions.find(f => f.posture === 'RAID' && f.noeudsControles.length > 0);
      if (facRaid && !actives.some(e => e.type === 'RAIDER') && lancerD20('normal').valeurRetenue >= 12) {
        const dep = facRaid.noeudsControles[0];
        const cible = terres.find(h => h.factionControleId !== facRaid.id && h.prosperite && h.prosperite >= 35);
        if (dep && cible) {
          const routeRaid = calculerItinerairePondere(dep, cible.id, hexagones, 'RAIDER');
          entites.push({
            id: `ent_az_raid_${nouveauTick}`,
            nom: `Éclaireurs de ${facRaid.nom.split(' ')[0]}`,
            type: 'RAIDER',
            factionId: facRaid.id,
            hexId: dep,
            origineHexId: dep,
            destinationHexId: cible.id,
            itineraire: routeRaid.chemin,
            force: 5,
            statut: 'EN_ROUTE',
            tickCreation: nouveauTick,
          });
        }
      }
    }
  }

  // 7. Équilibre macro-économique du marché (Val-Gris ET cartes Azgaar génériques)
  const mineHex = hexagones.find(h => h.id === 'hex_0100_mine');
  const passeHex = hexagones.find(h => h.id === 'hex_00m1_route');
  const foretHex = hexagones.find(h => h.id === 'hex_0001_foret');

  const ferAvant = marche.multiplicateurFer;
  const vivresAvant = marche.multiplicateurVivres ?? 1.0;

  if (mineHex || passeHex) {
    const mineAuxMainsGuilde = mineHex?.factionControleId === 'faction_guilde_marchande';
    const secPasse = passeHex?.securite || 'Patrouillé';
    const secMine = mineHex?.securite || 'Patrouillé';

    if (secPasse === 'Périlleux' || secMine === 'Périlleux') {
      marche.securiteRoutes = 'Périlleux';
    } else if (secPasse === 'Dangereux' || secMine === 'Dangereux') {
      marche.securiteRoutes = 'Dangereux';
    } else if (secPasse === 'Patrouillé' || secMine === 'Patrouillé') {
      marche.securiteRoutes = 'Patrouillé';
    } else {
      marche.securiteRoutes = 'Sûr';
    }

    if (!mineAuxMainsGuilde) {
      marche.multiplicateurFer = Number(Math.min(2.5, marche.multiplicateurFer + 0.25).toFixed(2));
      marche.penurieArmurerie = true;
    } else {
      const baisse = livraisonFerReussie ? 0.25 : 0.1;
      marche.multiplicateurFer = Number(Math.max(1.0, marche.multiplicateurFer - baisse).toFixed(2));
      if (marche.multiplicateurFer <= 1.15 && marche.securiteRoutes !== 'Périlleux') {
        marche.penurieArmurerie = false;
      }
    }

    let multVivres = vivresAvant;
    const meteoDifficile =
      horlogeMaj.meteo === 'Pluie battante' ||
      horlogeMaj.meteo === 'Chaleur écrasante' ||
      horlogeMaj.meteo === 'Brume glaciale';
    if (meteoDifficile || foretHex?.securite === 'Périlleux' || !foretHex?.ressourcesGibier) {
      multVivres = Math.min(1.8, Number((multVivres + 0.1).toFixed(2)));
    } else {
      const baisseVivres = livraisonVivresReussie ? 0.15 : 0.1;
      multVivres = Math.max(1.0, Number((multVivres - baisseVivres).toFixed(2)));
    }
    marche.multiplicateurVivres = multVivres;
  } else {
    // Calcul macro-économique générique basé sur l'ensemble des hexagones et ressources
    const terres = hexagones.filter(h => !h.estEau);
    const minesSures = terres.filter(
      h => (h.ressourcePrincipale === 'FER' || h.ressourcePrincipale === 'OR' || h.ressourcePrincipale === 'PIERRE') && h.securite !== 'Périlleux'
    ).length;
    const greniersSurs = terres.filter(
      h => (h.ressourcePrincipale === 'CEREALES' || h.ressourcePrincipale === 'ELEVAGE' || h.ressourcePrincipale === 'POISSON_SEL') && h.securite !== 'Périlleux'
    ).length;
    const nbPerilleux = terres.filter(h => h.securite === 'Périlleux').length;
    const nbDangereux = terres.filter(h => h.securite === 'Dangereux').length;

    if (nbPerilleux >= Math.max(2, Math.floor(terres.length * 0.28))) marche.securiteRoutes = 'Périlleux';
    else if (nbDangereux + nbPerilleux >= Math.max(3, Math.floor(terres.length * 0.35))) marche.securiteRoutes = 'Dangereux';
    else if (terres.some(h => h.securite === 'Patrouillé')) marche.securiteRoutes = 'Patrouillé';
    else marche.securiteRoutes = 'Sûr';

    if (minesSures === 0 || (marche.securiteRoutes === 'Périlleux' && !livraisonFerReussie)) {
      marche.multiplicateurFer = Number(Math.min(2.5, ferAvant + 0.15).toFixed(2));
    } else {
      const baisse = livraisonFerReussie ? 0.18 : 0.08;
      marche.multiplicateurFer = Number(Math.max(0.9, ferAvant - baisse).toFixed(2));
    }
    marche.penurieArmurerie = marche.multiplicateurFer >= 1.38;

    const meteoDifficile =
      horlogeMaj.meteo === 'Pluie battante' ||
      horlogeMaj.meteo === 'Chaleur écrasante' ||
      horlogeMaj.meteo === 'Brume glaciale';
    if (greniersSurs === 0 || meteoDifficile) {
      marche.multiplicateurVivres = Number(Math.min(1.8, vivresAvant + 0.08).toFixed(2));
    } else {
      const baisseViv = livraisonVivresReussie ? 0.14 : 0.06;
      marche.multiplicateurVivres = Number(Math.max(0.9, vivresAvant - baisseViv).toFixed(2));
    }
  }

  const multVivres = marche.multiplicateurVivres ?? 1.0;
  marche.prixArmesFerModif = Math.round(15 * marche.multiplicateurFer);
  marche.tendanceFer =
    marche.multiplicateurFer > ferAvant + 0.02
      ? 'HAUSSE'
      : marche.multiplicateurFer < ferAvant - 0.02
      ? 'BAISSE'
      : 'STABLE';
  marche.penurieVivres = multVivres >= 1.3;
  marche.tendanceVivres =
    multVivres > vivresAvant + 0.02
      ? 'HAUSSE'
      : multVivres < vivresAvant - 0.02
      ? 'BAISSE'
      : 'STABLE';

  const pressionMoyenne = Math.round(
    hexagones.reduce((acc, h) => acc + (h.pressionDanger ?? 30), 0) / Math.max(1, hexagones.length)
  );
  const prosperiteMoyenne = Math.round(
    hexagones.reduce((acc, h) => acc + (h.prosperite ?? 30), 0) / Math.max(1, hexagones.length)
  );

  marche.indiceTensionCommerciale = clamp(
    Math.round(
      ((marche.multiplicateurFer - 1) / 1.5) * 45 +
        ((multVivres - 1) / 0.8) * 25 +
        (pressionMoyenne / 100) * 30
    ),
    0,
    100
  );

  if (marche.penurieArmurerie && marche.penurieVivres) marche.demandeLocale = 'Fer & vivres';
  else if (marche.penurieArmurerie) marche.demandeLocale = 'Fer rare';
  else if (marche.penurieVivres) marche.demandeLocale = 'Vivres tendus';
  else marche.demandeLocale = 'Marché stable';

  // 8. Intégration au graphe & propagation des connaissances (1 saut par tick le long des hexagones adjacents)
  etat.grapheNoeuds.push(...nouveauxEvenementsGraph);
  etat.grapheLiens.push(...nouvellesRelationsGraph);

  propagerConnaissancesMonde(etat);

  const eventsDyn = etat.grapheNoeuds.filter(n => n.type === 'Event' && n.id !== 'event_fondation_mine');
  if (eventsDyn.length > 18) {
    const aSupprimer = new Set(eventsDyn.slice(0, eventsDyn.length - 18).map(e => e.id));
    etat.grapheNoeuds = etat.grapheNoeuds.filter(n => !aSupprimer.has(n.id));
    etat.grapheLiens = etat.grapheLiens.filter(l => !aSupprimer.has(l.source) && !aSupprimer.has(l.cible));
  }

  // 9. Synchronisation finale et enregistrement de l'instantané métrique pour Godmode
  etat.factions = factions;
  etat.hexagones = hexagones;
  etat.marche = marche;
  etat.entitesMonde = entites;

  const hexActMaj = hexagones.find(h => h.id === etat.hexActuel.id);
  if (hexActMaj) {
    etat.hexActuel = {
      ...hexActMaj,
      visite: etat.hexActuel.visite || hexActMaj.visite,
      brouillard: etat.hexActuel.brouillard || hexActMaj.brouillard,
    };
  }

  const chroniqueExistante = etat.chroniqueMonde || [];
  etat.chroniqueMonde = [...chroniqueAjouts, ...chroniqueExistante].slice(0, 24);

  const forcesFactions: Record<string, number> = {};
  for (const f of factions) {
    forcesFactions[f.id] = f.forceMilitaire;
  }
  const snapshot: WorldSnapshotMetric = {
    tick: nouveauTick,
    jour: horlogeMaj.jour,
    meteo: horlogeMaj.meteo,
    multiplicateurFer: marche.multiplicateurFer,
    multiplicateurVivres: marche.multiplicateurVivres ?? 1.0,
    pressionMoyenne,
    prosperiteMoyenne,
    entitesActives: entites.filter(e => e.statut === 'EN_ROUTE').length,
    forcesFactions,
  };
  etat.historiqueMonde = [...(etat.historiqueMonde || []), snapshot].slice(-24);

  return {
    etatModifie: etat,
    resultat: {
      nouveauTick,
      factionsModifiees: factions,
      hexagonesModifies: hexagones,
      marcheModifie: marche,
      nouveauxEvenementsGraph,
      nouvellesRelationsGraph,
      journalFactions,
      entitesMonde: entites,
      chroniqueAjouts,
      meteoModifiee: horlogeMaj,
    },
  };
}

export function propagerConnaissancesMonde(etat: SimulationState): void {
  const liensAdj = etat.grapheLiens.filter(l => l.relation === 'ADJACENT_TO');
  const pnjsParHex = new Map<string, string[]>();

  for (const l of etat.grapheLiens) {
    if (l.relation === 'LOCATED_IN') {
      const arr = pnjsParHex.get(l.cible) || [];
      arr.push(l.source);
      pnjsParHex.set(l.cible, arr);
    }
  }
  for (const n of etat.grapheNoeuds) {
    if (n.type === 'Actor' && n.proprietes?.hexId) {
      const arr = pnjsParHex.get(n.proprietes.hexId) || [];
      if (!arr.includes(n.id)) arr.push(n.id);
      pnjsParHex.set(n.proprietes.hexId, arr);
    }
  }

  const hexSecMap = new Map(etat.hexagones.map(h => [h.id, h.securite]));

  for (const noeud of etat.grapheNoeuds) {
    if (noeud.type !== 'Event') continue;
    const connus = new Set(noeud.connuParEntites || []);
    const nouveaux = new Set<string>();

    for (const entId of connus) {
      const pnjsLocaux = pnjsParHex.get(entId);
      if (pnjsLocaux) {
        for (const pId of pnjsLocaux) nouveaux.add(pId);
      }
      for (const lien of liensAdj) {
        const voisinId = lien.source === entId ? lien.cible : lien.cible === entId ? lien.source : null;
        if (voisinId && hexSecMap.get(voisinId) !== 'Périlleux') {
          nouveaux.add(voisinId);
        }
      }
    }

    for (const id of nouveaux) connus.add(id);
    noeud.connuParEntites = Array.from(connus);
  }
}

export function appliquerResultatMonde(etat: SimulationState, simState: SimulationState): void {
  etat.horloge = simState.horloge;
  etat.factions = simState.factions;
  etat.hexagones = simState.hexagones;
  etat.hexActuel = simState.hexActuel;
  etat.marche = simState.marche;
  etat.grapheNoeuds = simState.grapheNoeuds;
  etat.grapheLiens = simState.grapheLiens;
  etat.entitesMonde = simState.entitesMonde;
  etat.chroniqueMonde = simState.chroniqueMonde;
  etat.historiqueMonde = simState.historiqueMonde;
}

export interface CausalStepOutcome {
  journaux: string[];
  chroniqueAjoutee: WorldChronicleEntry[];
  jalonsDetectes: Array<'HEURE' | 'JOUR' | 'SEMAINE' | 'MOIS'>;
  resumeCausal: string;
}

function avancerEntitesParHeures(etat: SimulationState, heures: number): string[] {
  const notes: string[] = [];
  if (heures <= 0 || !etat.entitesMonde || etat.entitesMonde.length === 0) return notes;

  const estNuit = calculerPhaseJournee(etat.horloge.heure) === 'Nuit';

  for (const ent of etat.entitesMonde) {
    if (ent.statut !== 'EN_ROUTE') continue;
    ent.progresTrajetHeures = (ent.progresTrajetHeures ?? 0) + heures;
    while (ent.progresTrajetHeures >= 8 && ent.hexId !== ent.destinationHexId) {
      ent.progresTrajetHeures -= 8;
      const dep = etat.hexagones.find(h => h.id === ent.hexId);
      const dst = etat.hexagones.find(h => h.id === ent.destinationHexId);
      if (!dep || !dst) break;
      const step = prochaineEtapeVers(dep, dst, etat.hexagones, ent.type);
      ent.hexId = step.nextHex.id;
      ent.itineraire = step.itineraire;
      if (ent.type === 'PATROUILLE') {
        ajusterPressionHex(step.nextHex, -3, 'Sûr');
      } else if (ent.type === 'RAIDER' && estNuit && step.nextHex.securite !== 'Sûr') {
        ajusterPressionHex(step.nextHex, 3);
      }
      if (ent.hexId === ent.destinationHexId) {
        ent.statut = 'ARRIVE';
        notes.push(`${ent.nom} atteint ${dst.nom}.`);
      }
    }
  }
  return notes;
}

function executerJalonHebdomadaire(etat: SimulationState): {
  note: string;
  chronique: WorldChronicleEntry[];
} {
  const chronique: WorldChronicleEntry[] = [];
  const terres = etat.hexagones.filter(h => !h.estEau);
  const jour = etat.horloge.jour;
  const tick = etat.horloge.tick;

  // 1. Extraction & bilans vivres / minerais par hexagone + trésorerie des bourgs Azgaar
  for (const h of terres) {
    const r = h.ressourcePrincipale || 'CEREALES';
    const prod = h.securite === 'Périlleux' ? 2 : h.securite === 'Dangereux' ? 4 : 7;
    if (r === 'CEREALES' || r === 'ELEVAGE' || r === 'POISSON_SEL') {
      h.soldeVivres = clamp((h.soldeVivres ?? 50) + prod - 3, 5, 100);
    } else if (r === 'FER' || r === 'OR' || r === 'PIERRE') {
      h.soldeMinerai = clamp((h.soldeMinerai ?? 40) + prod - 2, 5, 100);
    }
  }

  if (etat.azgaarStudio) {
    for (const b of etat.azgaarStudio.burgs) {
      const impots = Math.round(b.population * 0.015);
      const entretien = Math.round(b.garrison * 0.08);
      b.tresorerie = Math.max(0, (b.tresorerie ?? 120) + impots - entretien);
    }
    if (etat.azgaarStudio.resources) {
      for (const resNode of etat.azgaarStudio.resources) {
        resNode.reserve = clamp(resNode.reserve - 1 + (resNode.richesse >= 4 ? 1 : 0), 15, 100);
      }
    }
  }

  // 2. Événement aléatoire contextuel cohérent avec les conditions réelles du monde
  const roll = lancerD20('normal').valeurRetenue;
  const meteo = etat.horloge.meteo;
  const hauteMontagne = terres.find(h => h.terrain === 'Montagne Escarpée' || h.ressourcePrincipale === 'FER');
  const cote = terres.find(h => h.estRivage || h.ressourcePrincipale === 'POISSON_SEL');
  const bourgRiche = terres.find(h => h.pointInteret?.type === 'bourgade' && (h.prosperite ?? 0) >= 55);
  const factionLasse = etat.factions.find(f => (f.lassitudeGuerre ?? 0) >= 48);

  let titreEvt = 'Semaine d’échanges réguliers';
  let causeDirecte = 'Rotation hebdomadaire des caravanes et récoltes locales';
  let consequences = 'Maintien des prix et des stocks régionaux';
  let hexImpact: HexNode | undefined = bourgRiche || terres[0];

  if (meteo === 'Pluie battante' && hauteMontagne && roll >= 10) {
    hexImpact = hauteMontagne;
    ajusterPressionHex(hauteMontagne, 8);
    hauteMontagne.soldeMinerai = clamp((hauteMontagne.soldeMinerai ?? 50) - 14, 5, 100);
    etat.marche.multiplicateurFer = Number(Math.min(2.5, etat.marche.multiplicateurFer + 0.12).toFixed(2));
    titreEvt = `Éboulement sur ${hauteMontagne.nom}`;
    causeDirecte = `Pluie battante prolongée saturant les versants de ${hauteMontagne.nom}`;
    consequences = 'Ralentissement des extractions et légère hausse du fer';
  } else if (meteo === 'Vents violents' && cote && roll >= 9) {
    hexImpact = cote;
    cote.prosperite = clamp((cote.prosperite ?? 45) - 6, 5, 100);
    etat.marche.multiplicateurVivres = Number(Math.min(1.8, (etat.marche.multiplicateurVivres ?? 1) + 0.08).toFixed(2));
    titreEvt = `Bourrasques côtières près de ${cote.nom}`;
    causeDirecte = `Vents violents perturbant les caboteurs devant ${cote.nom}`;
    consequences = 'Retard des cargaisons de sel et de poisson';
  } else if (factionLasse && roll >= 12) {
    hexImpact = terres.find(h => h.factionControleId === factionLasse.id) || terres[0];
    if (hexImpact) ajusterPressionHex(hexImpact, 10);
    factionLasse.moral = Math.max(20, (factionLasse.moral ?? 60) - 6);
    titreEvt = `Désertions chez ${factionLasse.nom}`;
    causeDirecte = `Lassitude de guerre à ${factionLasse.lassitudeGuerre}% et soldes tendues`;
    consequences = 'Bandes errantes en marge des routes et baisse du moral militaire';
  } else if (bourgRiche && etat.marche.securiteRoutes !== 'Périlleux' && roll >= 8) {
    hexImpact = bourgRiche;
    bourgRiche.prosperite = clamp((bourgRiche.prosperite ?? 50) + 6, 5, 100);
    const facB = etat.factions.find(f => f.id === bourgRiche.factionControleId);
    if (facB) facB.richesse = Math.min(800, facB.richesse + 20);
    titreEvt = `Grande foire marchande de ${bourgRiche.nom}`;
    causeDirecte = `Routes ${etat.marche.securiteRoutes.toLowerCase()} et prospérité locale (${bourgRiche.prosperite}%)`;
    consequences = 'Afflux de marchands, +20 or fiscal et hausse de prospérité';
  } else if (hauteMontagne && roll >= 15) {
    hexImpact = hauteMontagne;
    hauteMontagne.soldeMinerai = clamp((hauteMontagne.soldeMinerai ?? 50) + 18, 5, 100);
    etat.marche.multiplicateurFer = Number(Math.max(0.95, etat.marche.multiplicateurFer - 0.1).toFixed(2));
    titreEvt = `Nouveau filon mis au jour à ${hauteMontagne.nom}`;
    causeDirecte = 'Prospection minière hebdomadaire dans les galeries profondes';
    consequences = 'Détente sur le cours du fer et relance des forges';
  } else if (etat.horloge.saison === 'Été' && meteo === 'Chaleur écrasante') {
    const plaine = terres.find(h => h.ressourcePrincipale === 'CEREALES') || terres[0];
    hexImpact = plaine;
    if (plaine) plaine.soldeVivres = clamp((plaine.soldeVivres ?? 50) - 10, 5, 100);
    etat.marche.multiplicateurVivres = Number(Math.min(1.8, (etat.marche.multiplicateurVivres ?? 1) + 0.1).toFixed(2));
    titreEvt = 'Sécheresse sur les terres à blé';
    causeDirecte = 'Chaleur écrasante estivale asséchant les cultures';
    consequences = 'Tension sur les greniers et hausse modérée des vivres';
  }

  chronique.push({
    id: `chr_hebdo_${jour}_${tick}`,
    tick,
    jour,
    echelle: 'SEMAINE',
    categorie: 'EVENEMENT',
    titre: titreEvt,
    impact: consequences,
    causeDirecte,
    consequences,
    hexId: hexImpact?.id,
  });

  return { note: `${titreEvt} (${causeDirecte})`, chronique };
}

function executerJalonMensuel(etat: SimulationState): {
  note: string;
  chronique: WorldChronicleEntry[];
} {
  const chronique: WorldChronicleEntry[] = [];
  const jour = etat.horloge.jour;
  const tick = etat.horloge.tick;
  const saisons: Array<'Printemps' | 'Été' | 'Automne' | 'Hiver'> = ['Automne', 'Hiver', 'Printemps', 'Été'];
  const nouvelleSaison = saisons[Math.floor((Math.max(1, jour) - 1) / 30) % 4];
  etat.horloge.saison = nouvelleSaison;

  let totalPop = 0;
  for (const h of etat.hexagones) {
    if (h.estEau) continue;
    const croiss = (h.pressionDanger ?? 30) < 40 && (h.prosperite ?? 40) >= 50 ? 1.03 : 0.99;
    h.population = clamp(Math.round((h.population ?? 60) * croiss), 15, 45000);
    totalPop += h.population;
  }

  if (etat.azgaarStudio) {
    for (const b of etat.azgaarStudio.burgs) {
      b.population = Math.max(250, Math.round(b.population * 1.015));
    }
  }

  const titre = `Bilan mensuel : entrée en ${nouvelleSaison}`;
  const causeDirecte = `Cycle de 30 jours révolu (Jour ${jour}) et recomposition démographique`;
  const consequences = `Population régionale recensée : ${totalPop} habitants ; indice fer ×${etat.marche.multiplicateurFer.toFixed(2)}`;

  chronique.push({
    id: `chr_mois_${jour}_${tick}`,
    tick,
    jour,
    echelle: 'MOIS',
    categorie: 'ECONOMIE',
    titre,
    impact: consequences,
    causeDirecte,
    consequences,
  });

  return { note: `${titre} — ${consequences}`, chronique };
}

export function simulerAvancementTemporel(
  etat: SimulationState,
  heuresDelta: number,
  options?: { forcerTick?: boolean }
): CausalStepOutcome {
  const journaux: string[] = [];
  const chroniqueAjoutee: WorldChronicleEntry[] = [];
  const jalonsSet = new Set<'HEURE' | 'JOUR' | 'SEMAINE' | 'MOIS'>();
  let ticksExecutes = 0;

  const heures = Math.max(0, Math.round(heuresDelta));
  if (heures > 0) {
    jalonsSet.add('HEURE');
    // Pour les sauts infra-journaliers, simuler la progression horaire des convois et patrouilles
    if (heures < 24) {
      const notesH = avancerEntitesParHeures(etat, heures);
      journaux.push(...notesH);
    }

    etat.horloge.heure += heures;
    while (etat.horloge.heure >= 24) {
      etat.horloge.heure -= 24;
      etat.horloge.jour += 1;
      jalonsSet.add('JOUR');

      const { etatModifie, resultat } = simulerMondeComplet(etat, { evoluerTempsMeteo: true });
      appliquerResultatMonde(etat, etatModifie);
      ticksExecutes += 1;

      for (const ch of resultat.chroniqueAjouts) {
        ch.echelle = ch.echelle || 'JOUR';
        chroniqueAjoutee.push(ch);
      }
      if (resultat.journalFactions.length > 0) {
        journaux.push(...resultat.journalFactions);
      }

      if (etat.horloge.jour % 7 === 0) {
        jalonsSet.add('SEMAINE');
        const hebdo = executerJalonHebdomadaire(etat);
        journaux.push(hebdo.note);
        chroniqueAjoutee.push(...hebdo.chronique);
        etat.chroniqueMonde = [...hebdo.chronique, ...(etat.chroniqueMonde || [])].slice(0, 24);
      }

      if (etat.horloge.jour % 30 === 0) {
        jalonsSet.add('MOIS');
        const mensuel = executerJalonMensuel(etat);
        journaux.push(mensuel.note);
        chroniqueAjoutee.push(...mensuel.chronique);
        etat.chroniqueMonde = [...mensuel.chronique, ...(etat.chroniqueMonde || [])].slice(0, 24);
      }
    }
  }

  if (options?.forcerTick && ticksExecutes === 0) {
    jalonsSet.add('JOUR');
    const { etatModifie, resultat } = simulerMondeComplet(etat, { evoluerTempsMeteo: true });
    appliquerResultatMonde(etat, etatModifie);
    chroniqueAjoutee.push(...resultat.chroniqueAjouts);
    if (resultat.journalFactions.length > 0) {
      journaux.push(...resultat.journalFactions);
    }
  }

  etat.horloge.phaseJournee = calculerPhaseJournee(etat.horloge.heure);

  const jalonsDetectes = Array.from(jalonsSet);
  const resumeCausal =
    chroniqueAjoutee.length > 0
      ? chroniqueAjoutee
          .slice(0, 4)
          .map(c => `${c.titre} (${c.causeDirecte || c.impact})`)
          .join(' ; ')
      : journaux.slice(0, 3).join(' | ') ||
        `Jour ${etat.horloge.jour}, ${String(etat.horloge.heure).padStart(2, '0')}:00 (${etat.horloge.phaseJournee})`;

  return {
    journaux,
    chroniqueAjoutee,
    jalonsDetectes,
    resumeCausal,
  };
}

export function avancerTempsEtMonde(
  etat: SimulationState,
  heuresDelta: number,
  options?: { forcerTick?: boolean }
): string | undefined {
  const { journaux } = simulerAvancementTemporel(etat, heuresDelta, options);
  return journaux.length > 0 ? journaux.join(' | ') : undefined;
}
