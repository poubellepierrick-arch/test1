import { Faction, HexNode, WorldMarket, GraphNode, GraphEdge, SimulationState } from '../types';
import { simulerMondeComplet } from './worldSim';
import { INITIAL_SIMULATION_STATE } from './initialData';

export interface WorldTickResult {
  nouveauTick: number;
  factionsModifiees: Faction[];
  hexagonesModifies: HexNode[];
  marcheModifie: WorldMarket;
  nouveauxEvenementsGraph: GraphNode[];
  nouvellesRelationsGraph: GraphEdge[];
  journalFactions: string[];
}

export function executerWorldTick(
  tickActuel: number,
  factions: Faction[],
  hexagones: HexNode[],
  marcheActuel: WorldMarket
): WorldTickResult {
  const etatTemp: SimulationState = {
    ...INITIAL_SIMULATION_STATE,
    horloge: {
      ...INITIAL_SIMULATION_STATE.horloge,
      tick: tickActuel,
    },
    factions: JSON.parse(JSON.stringify(factions)),
    hexagones: JSON.parse(JSON.stringify(hexagones)),
    marche: JSON.parse(JSON.stringify(marcheActuel)),
    grapheNoeuds: [],
    grapheLiens: [],
    entitesMonde: [],
    chroniqueMonde: [],
  };

  const { resultat } = simulerMondeComplet(etatTemp, { evoluerTempsMeteo: false });

  return {
    nouveauTick: resultat.nouveauTick,
    factionsModifiees: resultat.factionsModifiees,
    hexagonesModifies: resultat.hexagonesModifies,
    marcheModifie: resultat.marcheModifie,
    nouveauxEvenementsGraph: resultat.nouveauxEvenementsGraph,
    nouvellesRelationsGraph: resultat.nouvellesRelationsGraph,
    journalFactions: resultat.journalFactions,
  };
}
