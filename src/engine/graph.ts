import { GraphNode, GraphEdge } from '../types';

export interface SubgraphContext {
  noeuds: GraphNode[];
  relations: GraphEdge[];
  faitsPertinents: string[];
}

export function traverserGraphe(
  noeudDepartId: string,
  tousLesNoeuds: GraphNode[],
  toutesLesRelations: GraphEdge[],
  rayonSauts: number = 2
): { noeuds: GraphNode[]; relations: GraphEdge[] } {
  const noeudsTrouvesIds = new Set<string>([noeudDepartId]);
  let frontiere = new Set<string>([noeudDepartId]);
  const relationsTrouvees: GraphEdge[] = [];

  for (let hop = 0; hop < rayonSauts; hop++) {
    const nouvelleFrontiere = new Set<string>();
    for (const id of frontiere) {
      for (const rel of toutesLesRelations) {
        if (rel.source === id && !noeudsTrouvesIds.has(rel.cible)) {
          noeudsTrouvesIds.add(rel.cible);
          nouvelleFrontiere.add(rel.cible);
          relationsTrouvees.push(rel);
        } else if (rel.cible === id && !noeudsTrouvesIds.has(rel.source)) {
          noeudsTrouvesIds.add(rel.source);
          nouvelleFrontiere.add(rel.source);
          relationsTrouvees.push(rel);
        } else if (noeudsTrouvesIds.has(rel.source) && noeudsTrouvesIds.has(rel.cible)) {
          if (!relationsTrouvees.includes(rel)) {
            relationsTrouvees.push(rel);
          }
        }
      }
    }
    frontiere = nouvelleFrontiere;
  }

  const noeuds = tousLesNoeuds.filter(n => noeudsTrouvesIds.has(n.id));
  return { noeuds, relations: relationsTrouvees };
}

/**
 * Boundary-Aware Filter : Ne conserve que les nœuds et faits connus de l'entité spécifiée (PNJ),
 * interdisant toute omniscience du modèle de langage.
 */
export function filtrerParFrontiereDeConnaissance(
  subgraph: { noeuds: GraphNode[]; relations: GraphEdge[] },
  pnjId: string
): SubgraphContext {
  const noeudsVisibles = subgraph.noeuds.filter(noeud => {
    // Si c'est un lieu public ou l'acteur lui-même, c'est visible
    if (noeud.id === pnjId) return true;
    if (noeud.type === 'Location') return true;
    // Si c'est un événement ou un secret, vérifier si le PNJ est expressément dans la liste des entités informées
    if (noeud.type === 'Event' || (noeud.proprietes && noeud.proprietes.secret)) {
      return noeud.connuParEntites?.includes(pnjId) ?? false;
    }
    return true;
  });

  const noeudsIds = new Set(noeudsVisibles.map(n => n.id));
  const relationsVisibles = subgraph.relations.filter(
    r => noeudsIds.has(r.source) && noeudsIds.has(r.cible)
  );

  const faitsPertinents: string[] = [];
  for (const n of noeudsVisibles) {
    if (n.type === 'Actor' && n.id !== pnjId) {
      faitsPertinents.push(`Acteur connu : ${n.label} (Alignement : ${n.proprietes.alignement || 'Inconnu'}).`);
    } else if (n.type === 'Event') {
      faitsPertinents.push(`Événement historique appris : ${n.label} (Tick: ${n.proprietes.horodatageTick}).`);
    } else if (n.type === 'Item') {
      faitsPertinents.push(`Objet répertorié : ${n.label} (${n.proprietes.poidsLbs || 1} lbs).`);
    }
  }

  return {
    noeuds: noeudsVisibles,
    relations: relationsVisibles,
    faitsPertinents,
  };
}
