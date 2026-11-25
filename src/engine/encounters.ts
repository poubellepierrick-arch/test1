import { SimulationState, GraphNode, Rumor } from '../types';
import { lancerD20 } from './dice';

export interface PnjItinerantSpec {
  nom: string;
  role: string;
  disposition?: 'AMICAL' | 'NEUTRE' | 'MEFIANT';
  motif: string;
  proposeCommerce?: boolean;
  seuilDD?: number;
  suggestions?: string[];
  rumeur?: {
    titre: string;
    texte: string;
  };
}

export function obtenirPnjsEnVue(etat: SimulationState): GraphNode[] {
  const hexId = etat.hexActuel.id;
  const idsPresents = new Set(
    etat.grapheLiens
      .filter(l => l.relation === 'LOCATED_IN' && l.cible === hexId)
      .map(l => l.source)
  );

  return etat.grapheNoeuds.filter(
    n => n.type === 'Actor' && (idsPresents.has(n.id) || n.proprietes?.hexId === hexId)
  );
}

export function estPnjEnVue(etat: SimulationState, pnjId: string): boolean {
  return obtenirPnjsEnVue(etat).some(p => p.id === pnjId);
}

export function nettoyerPnjsItinerants(etat: SimulationState, ancienHexId: string): void {
  const idsASupprimer = new Set(
    etat.grapheNoeuds
      .filter(n => {
        if (n.type !== 'Actor' || !n.proprietes?.estItinerant) return false;
        const estDansAncienHex =
          n.proprietes?.hexId === ancienHexId ||
          etat.grapheLiens.some(l => l.relation === 'LOCATED_IN' && l.source === n.id && l.cible === ancienHexId);
        return estDansAncienHex;
      })
      .map(n => n.id)
  );

  if (idsASupprimer.size === 0) return;

  etat.grapheNoeuds = etat.grapheNoeuds.filter(n => !idsASupprimer.has(n.id));
  etat.grapheLiens = etat.grapheLiens.filter(
    l => !idsASupprimer.has(l.source) && !idsASupprimer.has(l.cible)
  );
}

export function ajouterPnjItinerant(etat: SimulationState, spec: PnjItinerantSpec): GraphNode {
  // Éviter les doublons sur le même hexagone par nom
  const existant = obtenirPnjsEnVue(etat).find(
    n => n.label.toLowerCase() === spec.nom.toLowerCase()
  );
  if (existant) return existant;

  const id = `npc_itin_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const rumeursConnues = spec.rumeur
    ? [{ id: `rumor_${Date.now()}`, titre: spec.rumeur.titre, texte: spec.rumeur.texte }]
    : [
        {
          id: `rumor_${Date.now()}`,
          titre: `Nouvelles de ${etat.hexActuel.nom}`,
          texte: `${spec.nom} signale des mouvements récents aux abords de ${etat.hexActuel.nom}.`,
        },
      ];

  const suggestionsParDefaut = spec.proposeCommerce
    ? [
        'Examiner les marchandises de sa besace',
        'Demander l\'état des routes et les rumeurs',
        'Prendre des nouvelles des environs',
      ]
    : [
        'Demander ce qui l\'amène dans ce secteur',
        'S\'enquérir des dangers et rumeurs du terrain',
        'Échanger des informations sur les factions',
      ];

  const noeud: GraphNode = {
    id,
    type: 'Actor',
    label: spec.nom,
    proprietes: {
      profession: spec.role,
      alignement: 'Neutre',
      disposition: spec.disposition || 'NEUTRE',
      humeur: spec.disposition === 'AMICAL' ? 'Courtois et ouvert' : spec.disposition === 'MEFIANT' ? 'Prudent et sur ses gardes' : 'Posé et attentif',
      seuilDD: spec.seuilDD || 12,
      estItinerant: true,
      hexId: etat.hexActuel.id,
      motifRencontre: spec.motif,
      proposeCommerce: Boolean(spec.proposeCommerce),
      suggestions: spec.suggestions || suggestionsParDefaut,
      rumeursConnues,
    },
    connuParEntites: [etat.hexActuel.id],
  };

  etat.grapheNoeuds.push(noeud);
  etat.grapheLiens.push({
    source: id,
    cible: etat.hexActuel.id,
    relation: 'LOCATED_IN',
    horodatageTick: etat.horloge.tick,
  });

  return noeud;
}

const ARCHETYPES_ITINERANTS: Record<string, PnjItinerantSpec[]> = {
  'Plaine / Route': [
    {
      nom: 'Colporteur Bren',
      role: 'Marchand ambulant',
      disposition: 'AMICAL',
      motif: 'Remonte la piste avec son ballot vers Val-Gris.',
      proposeCommerce: true,
      seuilDD: 11,
      rumeur: {
        titre: 'Convoi retardé sur la route',
        texte: 'Les charrettes évitent la passe nord par crainte des taxes du Bouclier de Fer.',
      },
    },
    {
      nom: 'Messager Lorik',
      role: 'Courrier de la Ligue',
      disposition: 'NEUTRE',
      motif: 'S\'arrête reprendre son souffle en vous apercevant.',
      proposeCommerce: false,
      seuilDD: 12,
      rumeur: {
        titre: 'Renforts attendus',
        texte: 'Le Bailli Rogar cherche des bras fiables pour surveiller la route de Roche-Noire.',
      },
    },
  ],
  'Forêt Dense': [
    {
      nom: 'Trappeur Garin',
      role: 'Chasseur des sous-bois',
      disposition: 'NEUTRE',
      motif: 'Suit des traces fraîches et vous hèle depuis un fourré.',
      proposeCommerce: false,
      seuilDD: 12,
      rumeur: {
        titre: 'Éclaireurs gobelins',
        texte: 'Des patrouilles gobelines rôdent autour du campement abandonné à la tombée du soir.',
      },
    },
    {
      nom: 'Herboriste Maren',
      role: 'Cueilleuse itinérante',
      disposition: 'AMICAL',
      motif: 'S\'approche en voyant votre silhouette entre les chênes.',
      proposeCommerce: true,
      seuilDD: 11,
      rumeur: {
        titre: 'Eaux troublées',
        texte: 'Les sources en aval du marais charrient des miasmes plus épais cette semaine.',
      },
    },
  ],
  'Montagne Escarpée': [
    {
      nom: 'Mineur Horek',
      role: 'Prospecteur descendu des cols',
      disposition: 'NEUTRE',
      motif: 'Descend le sentier pierreux et s\'arrête à votre hauteur.',
      proposeCommerce: false,
      seuilDD: 12,
      rumeur: {
        titre: 'Galeries profondes',
        texte: 'Un éboulement récent a mis au jour d\'anciens étayages dans Roche-Noire.',
      },
    },
  ],
  'Marais Fétide': [
    {
      nom: 'Pèlerin Vane',
      role: 'Voyageur égaré',
      disposition: 'MEFIANT',
      motif: 'Émerge de la brume en cherchant la terre ferme.',
      proposeCommerce: false,
      seuilDD: 13,
      rumeur: {
        titre: 'Ruines noyées',
        texte: 'Des lueurs pâles dérivent entre les pierres submergées quand la nuit tombe.',
      },
    },
  ],
  'Désert Aride': [
    {
      nom: 'Éclaireur Tarik',
      role: 'Survivant de caravane',
      disposition: 'NEUTRE',
      motif: 'S\'approche à pas lents, l\'outre presque vide.',
      proposeCommerce: false,
      seuilDD: 13,
      rumeur: {
        titre: 'Raiders du Clan Borgne',
        texte: 'Les orcs guettent les voyageurs isolés depuis les dunes orientales.',
      },
    },
  ],
};

export function tenterRencontrePnjItinerant(
  etat: SimulationState,
  declencheur: 'TRAVEL' | 'REST' | 'WAIT'
): { pnj: GraphNode; description: string } | null {
  if (etat.combat.actif || etat.donjon?.actif) return null;

  const pnjsActuels = obtenirPnjsEnVue(etat);
  // Ne pas empiler de nouveaux PNJ itinérants s'il y en a déjà un en vue
  if (pnjsActuels.some(p => p.proprietes?.estItinerant)) return null;
  // En bourgade, inutile de générer un voyageur aléatoire à chaque pas sauf attente explicite
  const estEnBourgade = etat.hexActuel.pointInteret?.type === 'bourgade';
  if (estEnBourgade && declencheur !== 'WAIT') return null;

  const jet = lancerD20('normal').valeurRetenue;
  const seuil = declencheur === 'WAIT' ? 8 : declencheur === 'REST' ? 14 : 15;

  if (jet < seuil) return null;

  const pool = ARCHETYPES_ITINERANTS[etat.hexActuel.terrain] || ARCHETYPES_ITINERANTS['Plaine / Route'];
  const choix = pool[Math.floor(Math.random() * pool.length)];
  const pnj = ajouterPnjItinerant(etat, choix);

  return {
    pnj,
    description: `${pnj.label} (${choix.role}) entre dans votre champ de vision : ${choix.motif}`,
  };
}

export function extraireRumeurPnj(etat: SimulationState, pnj: GraphNode): Rumor | null {
  const existantsTitres = new Set((etat.rumeurs || []).map(r => r.titre));

  // 1. Événements récents du monde propagés jusqu'au PNJ ou à l'hexagone (les plus récents d'abord)
  const evenements = etat.grapheNoeuds
    .filter(
      n =>
        n.type === 'Event' &&
        n.id !== 'event_fondation_mine' &&
        !existantsTitres.has(n.label) &&
        (n.connuParEntites?.includes(pnj.id) ||
          n.connuParEntites?.includes(etat.hexActuel.id) ||
          (etat.hexActuel.factionControleId && n.connuParEntites?.includes(etat.hexActuel.factionControleId)))
    )
    .sort((a, b) => (b.proprietes?.horodatageTick || 0) - (a.proprietes?.horodatageTick || 0));

  if (evenements.length > 0) {
    const evt = evenements[0];
    return {
      id: `rumor_${evt.id}_${Date.now()}`,
      titre: evt.label,
      texte: evt.proprietes?.description || evt.label,
      source: pnj.label,
      veracite: true,
      tickEmission: etat.horloge.tick,
      statutPerception: 'INCERTAINE',
      lieuObtention: etat.hexActuel.nom,
    };
  }

  // 2. Rumeurs propres du PNJ
  const rumeursLocales = (pnj.proprietes?.rumeursConnues as Array<{ id: string; titre: string; texte: string }>) || [];
  for (const r of rumeursLocales) {
    if (!existantsTitres.has(r.titre)) {
      return {
        id: r.id || `rumor_${Date.now()}`,
        titre: r.titre,
        texte: r.texte,
        source: pnj.label,
        veracite: true,
        tickEmission: etat.horloge.tick,
        statutPerception: 'INCERTAINE',
        lieuObtention: etat.hexActuel.nom,
      };
    }
  }

  // 3. Observation de marché si pénurie de fer ou vivres
  if (etat.marche.penurieArmurerie && !existantsTitres.has('Pénurie de fer')) {
    return {
      id: `rumor_fer_${Date.now()}`,
      titre: 'Pénurie de fer',
      texte: `Le prix des armes en fer grimpe (x${etat.marche.multiplicateurFer}) suite aux troubles à la mine.`,
      source: pnj.label,
      veracite: true,
      tickEmission: etat.horloge.tick,
      statutPerception: 'INCERTAINE',
      lieuObtention: etat.hexActuel.nom,
    };
  }

  if (etat.marche.penurieVivres && !existantsTitres.has('Tension sur les vivres')) {
    return {
      id: `rumor_vivres_${Date.now()}`,
      titre: 'Tension sur les vivres',
      texte: `Les intempéries et l'insécurité renchérissent les rations (x${etat.marche.multiplicateurVivres}).`,
      source: pnj.label,
      veracite: true,
      tickEmission: etat.horloge.tick,
      statutPerception: 'INCERTAINE',
      lieuObtention: etat.hexActuel.nom,
    };
  }

  return null;
}
