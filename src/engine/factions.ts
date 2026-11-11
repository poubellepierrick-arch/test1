import { Faction, HexNode, WorldMarket, GraphNode, GraphEdge } from '../types';
import { lancerD20 } from './dice';

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
  const factionsClone: Faction[] = JSON.parse(JSON.stringify(factions));
  const hexagonesClone: HexNode[] = JSON.parse(JSON.stringify(hexagones));
  const marcheClone: WorldMarket = JSON.parse(JSON.stringify(marcheActuel));

  const nouveauxEvenementsGraph: GraphNode[] = [];
  const nouvellesRelationsGraph: GraphEdge[] = [];
  const journalFactions: string[] = [];

  const nouveauTick = tickActuel + 1;

  // Parcourir les factions actives pour leurs initiatives autonomes
  for (const faction of factionsClone) {
    if (faction.id === 'faction_iron_shield' || faction.id === 'faction_orcs') {
      // Tentative d'expansion ou d'assaut sur un nœud adjacent ou stratégique
      const cibleHex = hexagonesClone.find(
        h => h.pointInteret && h.pointInteret.type === 'mine' && h.factionControleId !== faction.id
      );

      if (cibleHex && cibleHex.pointInteret) {
        // Formule de test d'opposition du cahier des charges :
        // Score = d20 + Niveau d'Actifs + Modificateur de Terrain
        const jetAttaque = lancerD20('normal').valeurRetenue;
        const actifsAttaquant = Math.floor(faction.forceMilitaire / 10);
        const scoreAttaque = jetAttaque + actifsAttaquant;

        const jetDefense = lancerD20('normal').valeurRetenue;
        const defenseNoeud = cibleHex.terrain === 'Montagne Escarpée' ? 4 : 2;
        const scoreDefense = jetDefense + defenseNoeud;

        if (scoreAttaque > scoreDefense) {
          // Prise de la mine !
          cibleHex.factionControleId = faction.id;
          cibleHex.pointInteret.statut = 'OCCUPIED';
          cibleHex.securite = 'Dangereux';

          // Impacts macro-économiques systémiques
          marcheClone.multiplicateurFer = Number((marcheClone.multiplicateurFer * 1.45).toFixed(2));
          marcheClone.prixArmesFerModif = Math.round(marcheClone.prixArmesFerModif * 1.45);
          marcheClone.penurieArmurerie = true;
          marcheClone.securiteRoutes = 'Dangereux';

          const evenementId = `event_tick_${nouveauTick}_capture_${cibleHex.id}`;
          const descriptionEvenement = `Prise d'assaut de la mine (${cibleHex.pointInteret.nom}) par ${faction.nom}. Approvisionnement coupé.`;

          nouveauxEvenementsGraph.push({
            id: evenementId,
            type: 'Event',
            label: descriptionEvenement,
            proprietes: {
              horodatageTick: nouveauTick,
              attaquant: faction.id,
              noeudCible: cibleHex.id,
              resultat: 'CAPTURE_REUSSIE',
            },
            // Seuls les membres de la faction et les survivants immédiats savent au début
            connuParEntites: [faction.id],
          });

          nouvellesRelationsGraph.push({
            source: faction.id,
            cible: cibleHex.id,
            relation: 'CONTROLLED_BY',
            horodatageTick: nouveauTick,
          });

          journalFactions.push(
            `[World Tick ${nouveauTick}] ${faction.nom} s'empare de ${cibleHex.pointInteret.nom} (Attaque ${scoreAttaque} vs Défense ${scoreDefense}). Pénurie de minerai : prix du fer x1.45.`
          );
        } else {
          journalFactions.push(
            `[World Tick ${nouveauTick}] ${faction.nom} a échoué son incursion vers ${cibleHex.nom} (${scoreAttaque} vs ${scoreDefense}).`
          );
        }
      }
    } else if (faction.id === 'faction_guilde_marchande') {
      // La guilde marchande réagit aux variations économiques
      if (marcheClone.penurieArmurerie) {
        faction.richesse = Math.max(0, faction.richesse - 50);
        journalFactions.push(
          `[World Tick ${nouveauTick}] ${faction.nom} subit des pertes logistiques suite aux blocus régionaux.`
        );
      }
    }
  }

  return {
    nouveauTick,
    factionsModifiees: factionsClone,
    hexagonesModifies: hexagonesClone,
    marcheModifie: marcheClone,
    nouveauxEvenementsGraph,
    nouvellesRelationsGraph,
    journalFactions,
  };
}
