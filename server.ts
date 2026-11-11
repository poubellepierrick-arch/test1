import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { INITIAL_SIMULATION_STATE } from './src/engine/initialData';
import { orchestrerActionDeterministe, ActionRequest } from './src/engine/adjudication';
import { executerWorldTick } from './src/engine/factions';
import { SimulationState, NarrativeEvent } from './src/types';

dotenv.config();

const app = express();
app.use(express.json());

const PORT = 3000;

// État mémoire persistant de la simulation côté serveur
let currentWorldState: SimulationState = JSON.parse(JSON.stringify(INITIAL_SIMULATION_STATE));

// Initialisation Gemini Server-Side si clé présente
const apiKey = process.env.GEMINI_API_KEY;
let aiClient: GoogleGenAI | null = null;
if (apiKey) {
  aiClient = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

interface NarrationResultat {
  texte: string;
  tonAmbiance: 'CHAMPETRE' | 'SOMBRE' | 'PERIL' | 'NEUTRE';
  suggestionsMJ: string[];
  prompt: string;
  systemPrompt: string;
  modele: string;
  reponseBrute: string;
  latence: number;
}

function genererFallbackComplet(
  action: ActionRequest,
  adjudicationDesc: string,
  etat: SimulationState
): { texte: string; ton: 'CHAMPETRE' | 'SOMBRE' | 'PERIL' | 'NEUTRE'; suggestions: string[] } {
  const estMort = etat.personnage.estMortDefinitivement;
  const enCombat = etat.combat.actif;
  const estEnBourgade = etat.hexActuel.pointInteret?.type === 'bourgade' || etat.hexActuel.securite === 'Sûr';
  const aDonjon = etat.donjon && etat.donjon.actif;

  if (estMort) {
    return {
      texte: `Le corps d'${etat.personnage.nom} repose à jamais sous l'herbe fanée. Le monde des vivants poursuit son cours indifférent, tandis que le vent d'ouest disperse les braises éteintes.`,
      ton: 'PERIL',
      suggestions: [
        'Recommencer une nouvelle expédition',
        'Inspecter le journal des événements',
        'Consulter les archives de la simulation',
      ],
    };
  }

  if (enCombat) {
    const ennemiVivant = etat.combat.ennemis.find(e => e.statut === 'ACTIF');
    const nomEnnemi = ennemiVivant ? ennemiVivant.nom : 'l\'ennemi';
    return {
      texte: `L'acier heurte l'acier dans un éclat d'étincelles. Le souffle fétide de l'adversaire empeste la bête traquée et la poussière soulevée masque les battements du cœur. ${adjudicationDesc}`,
      ton: 'PERIL',
      suggestions: [
        `Porter une frappe directe contre ${nomEnnemi}`,
        'Adopter une posture d\'esquive défensive',
        'Tenter de se désengager et fuir vers le couvert',
      ],
    };
  }

  if (aDonjon) {
    return {
      texte: `L'obscurité des voûtes souterraines suinte l'humidité et la vieille pierre taillée. L'écho d'une goutte d'eau résonne au loin dans le silence oppressant. ${adjudicationDesc}`,
      ton: 'SOMBRE',
      suggestions: [
        'Progresser avec précaution vers la galerie suivante',
        'Fouiller minutieusement les anfractuosités de la roche',
        'Faire demi-tour vers la lumière de la surface',
      ],
    };
  }

  if (action.type === 'DIALOGUER_PNJ') {
    const pnjId = action.pnjId || 'npc_forgeron_torvin';
    const pnj = etat.grapheNoeuds.find(n => n.id === pnjId);
    const nomPnj = pnj ? pnj.label : 'l\'interlocuteur';
    return {
      texte: `${nomPnj} essuie ses mains calleuses et vous considère d'un œil scrutateur. Le calme de la bourgade n'efface pas les soucis ordinaires du gagne-pain. ${adjudicationDesc}`,
      ton: estEnBourgade ? 'CHAMPETRE' : 'SOMBRE',
      suggestions: [
        `Interroger ${nomPnj} sur les événements récents`,
        `Demander si du travail ou une prime est disponible`,
        'Prendre congé et poursuivre votre chemin dans le bourg',
      ],
    };
  }

  if (action.type === 'CORVEE_TRAVAIL') {
    return {
      texte: `Le travail manuel réchauffe les membres sous la brise rustique. L'odeur du bois fraîchement débité se mêle aux rumeurs échangées entre manœuvres. ${adjudicationDesc}`,
      ton: 'CHAMPETRE',
      suggestions: [
        'Dépenser une partie de la paye au comptoir',
        'Prendre un repos court pour soulager vos épaules',
        'Consulter la sentinelle sur l\'état des sentiers',
      ],
    };
  }

  if (action.type === 'TROQUER') {
    return {
      texte: `La transaction s'opère au tintement sec des pièces de cuivre et d'argent sur l'étal de bois ciré. Le marchand range soigneusement le change. ${adjudicationDesc}`,
      ton: 'CHAMPETRE',
      suggestions: [
        'Vérifier le poids et l\'encombrement de votre sac',
        'Écouter les rumeurs colportées par les marchands',
        'Inspecter le tableau des corvées du bourg',
      ],
    };
  }

  if (action.type === 'FORAGER') {
    return {
      texte: `Les doigts grattent l'humus humide à la recherche de tubercules et de baies sauvages. L'immensité de la nature impose sa cadence lente. ${adjudicationDesc}`,
      ton: etat.hexActuel.terrain === 'Forêt Dense' || etat.hexActuel.terrain === 'Marais Fétide' ? 'SOMBRE' : 'NEUTRE',
      suggestions: [
        'Établir un bivouac de fortune pour consommer la récolte',
        'Faire bouillir l\'eau recueillie avant de la boire',
        'Reprendre la marche vers une clairière ou une route',
      ],
    };
  }

  if (action.type === 'REPOS_LONG' || action.type === 'REPOS_COURT') {
    return {
      texte: estEnBourgade
        ? `La paille du dortoir communal et le murmure des conversations offrent un répit béni. Le corps retrouve sa vigueur dans la chaleur du bourg. ${adjudicationDesc}`
        : `Le feu de camp crépite faiblement sous la voûte glaciale. Les ombres dansent sur les troncs noueux tandis que la nuit s'étire. ${adjudicationDesc}`,
      ton: estEnBourgade ? 'CHAMPETRE' : 'SOMBRE',
      suggestions: [
        'Se lever et préparer ses paquetages pour le départ',
        'Entretenir les lames et resserrer les courroies',
        'Consulter la carte de voyage pour planifier l\'itinéraire',
      ],
    };
  }

  if (action.type === 'DEPLACER_HEX') {
    const estDangereux = etat.hexActuel.securite === 'Dangereux' || etat.hexActuel.securite === 'Périlleux';
    const ton: 'CHAMPETRE' | 'SOMBRE' | 'NEUTRE' = estEnBourgade ? 'CHAMPETRE' : estDangereux ? 'SOMBRE' : 'NEUTRE';
    return {
      texte: estEnBourgade
        ? `L'entrée de Val-Gris s'ouvre sur un dédale de ruelles paisibles où flottent des effluves de soupe paysanne et de pain d'épeautre. ${adjudicationDesc}`
        : `L'expédition aborde ${etat.hexActuel.nom}. Le paysage de ${etat.hexActuel.terrain.toLowerCase()} s'étend à perte de vue sous un ciel lourd. ${adjudicationDesc}`,
      ton,
      suggestions: estEnBourgade
        ? [
            'Aller à la forge de Torvin pour évaluer l\'équipement',
            'Chercher du travail au tableau des corvées',
            'S\'asseoir à l\'auberge pour écouter les nouvelles',
          ]
        : [
            'Chercher des traces ou des ressources (Forager)',
            'Établir un campement sécurisé avant la nuit',
            'Poursuivre la marche vers l\'hexagone suivant',
          ],
    };
  }

  return {
    texte: `${adjudicationDesc}`,
    ton: estEnBourgade ? 'CHAMPETRE' : 'NEUTRE',
    suggestions: [
      'Observer attentivement les alentours immédiats',
      'Vérifier les rations et l\'état de la troupe',
      'Poursuivre votre progression sur le terrain',
    ],
  };
}

const SYSTEM_INSTRUCTION_IA = `Tu es le Maître du Jeu d'une aventure médiévale fantastique (D&D 5e) inspirée du contraste du Seigneur des Anneaux :
- Le ton alterne entre :
  1. LA DOUCEUR RUSTIQUE & CHAMPÊTRE : La vie quotidienne des gens normaux, le travail de la terre, l'odeur du pain chaud, la chaleur de l'âtre, les commérages des villageois, les haltes sous les chênes.
  2. LA TENSION SOMBRE & OPPRESSANTE : Dans les bois profonds, les marais, les cols balayés par le blizzard et les ruines anciennes, le monde est froid, rude, hostile et menaçant.
- RÈGLE D'OR : Le moteur déterministe backend détient la VÉRITÉ ABSOLUE (Ground Truth). Tu ne tires AUCUN dé, n'inventes aucun PV perdu/gagné ou objet non consigné dans l'adjudication.
- DIALOGUES PNJ : Quand l'action est un dialogue, incarne véritablement le PNJ avec sa personnalité, sa voix terrienne ou austère et son niveau de confiance envers l'aventurier.
- INTERACTION INTUITIVE : Tu dois TOUJOURS générer 3 suggestions d'action concrètes et pertinentes adaptées à la situation actuelle du joueur pour orienter son prochain choix.
- Rédige un texte français sobre, immersif et condensé (2 à 4 phrases).
- Réponds STRICTEMENT en format JSON valide conforme au schéma.`;

async function genererNarration(
  action: ActionRequest,
  adjudication: any,
  etat: SimulationState,
  evenementFaction?: string
): Promise<NarrationResultat> {
  const debut = Date.now();
  const fallback = genererFallbackComplet(action, adjudication.mutations_etat.descriptionTechnique, etat);

  const pnjConcerne = action.pnjId ? etat.grapheNoeuds.find(n => n.id === action.pnjId) : null;
  const memoirePnj = pnjConcerne?.proprietes ? JSON.stringify(pnjConcerne.proprietes) : 'Aucun';

  const prompt = `Action du joueur: ${JSON.stringify(action)}
Adjudication déterministe (Vérité absolue): ${JSON.stringify(adjudication)}
État personnage: PV ${etat.personnage.pvActuels}/${etat.personnage.pvMax}, Épuisement Niv ${etat.personnage.epuisement}, Mort définitif: ${etat.personnage.estMortDefinitivement}
Lieu actuel: ${etat.hexActuel.nom} (${etat.hexActuel.terrain}, Sécurité: ${etat.hexActuel.securite})
Point d'intérêt: ${etat.hexActuel.pointInteret ? etat.hexActuel.pointInteret.nom : 'Nature sauvage'}
Combat actif: ${etat.combat.actif ? `Oui (Round ${etat.combat.round})` : 'Non'}
Donjon actif: ${etat.donjon?.actif ? `Oui (${etat.donjon.nom}, salle: ${etat.donjon.salleActuelleId})` : 'Non'}
PNJ concerné: ${pnjConcerne ? `${pnjConcerne.label} (Mémoire: ${memoirePnj})` : 'Aucun'}
Événement géopolitique hors-champ: ${evenementFaction || 'Aucun'}`;

  if (!aiClient) {
    const fin = Date.now();
    return {
      texte: fallback.texte,
      tonAmbiance: fallback.ton,
      suggestionsMJ: fallback.suggestions,
      prompt,
      systemPrompt: SYSTEM_INSTRUCTION_IA,
      modele: 'Moteur Déterministe Backend (Fallback sans clé)',
      reponseBrute: JSON.stringify(fallback),
      latence: fin - debut,
    };
  }

  try {
    const response = await aiClient.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION_IA,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            texte: {
              type: Type.STRING,
              description: 'Récit immersif en 2 à 4 phrases selon le ton approprié (Seigneur des Anneaux champêtre ou sombre).',
            },
            tonAmbiance: {
              type: Type.STRING,
              description: 'CHAMPETRE, SOMBRE, PERIL ou NEUTRE.',
            },
            suggestions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Exactement 3 suggestions d action concrètes et concises.',
            },
          },
          required: ['texte', 'tonAmbiance', 'suggestions'],
        },
      },
    });

    const fin = Date.now();
    const brut = response.text?.trim() || '';
    let parsed: any = null;
    try {
      parsed = JSON.parse(brut);
    } catch {
      // Échec de parsing JSON, utilisation fallback
    }

    const texteFinal = parsed?.texte || fallback.texte;
    const tonFinal: 'CHAMPETRE' | 'SOMBRE' | 'PERIL' | 'NEUTRE' =
      parsed?.tonAmbiance === 'CHAMPETRE' ||
      parsed?.tonAmbiance === 'SOMBRE' ||
      parsed?.tonAmbiance === 'PERIL' ||
      parsed?.tonAmbiance === 'NEUTRE'
        ? parsed.tonAmbiance
        : fallback.ton;
    const suggestionsFinal = Array.isArray(parsed?.suggestions) && parsed.suggestions.length >= 3
      ? parsed.suggestions.slice(0, 3)
      : fallback.suggestions;

    return {
      texte: texteFinal,
      tonAmbiance: tonFinal,
      suggestionsMJ: suggestionsFinal,
      prompt,
      systemPrompt: SYSTEM_INSTRUCTION_IA,
      modele: 'gemini-3.8-flash',
      reponseBrute: brut || JSON.stringify(fallback),
      latence: fin - debut,
    };
  } catch (err: any) {
    console.warn('Erreur lors de l\'appel narration Gemini, recours au fallback enrichi:', err);
    const fin = Date.now();
    return {
      texte: fallback.texte,
      tonAmbiance: fallback.ton,
      suggestionsMJ: fallback.suggestions,
      prompt,
      systemPrompt: SYSTEM_INSTRUCTION_IA,
      modele: 'Fallback Déterministe Enrichi (Erreur API)',
      reponseBrute: `Erreur: ${err.message || 'Échec appel API'}. Repli déterministe exécuté.`,
      latence: fin - debut,
    };
  }
}

function determinerDonneesMobilisees(
  action: ActionRequest,
  adjudication: any,
  etat: SimulationState,
  evenementFaction?: string
) {
  const reglesSrd: string[] = [];
  const attributsPersonnage: string[] = [];
  const noeudsGraphInjectes: string[] = [];
  const noeudsGraphFiltresMasques: string[] = [];
  const hexagonesInterroges: string[] = [`${etat.hexActuel.nom} [${etat.hexActuel.q},${etat.hexActuel.r}] (${etat.hexActuel.terrain}, Sécurité: ${etat.hexActuel.securite})`];
  const factionsImpliquees: string[] = [];
  let formuleMathematique = '';

  attributsPersonnage.push(`PV: ${etat.personnage.pvActuels}/${etat.personnage.pvMax}`);
  attributsPersonnage.push(`Épuisement: Niv ${etat.personnage.epuisement}/6`);

  if (action.type === 'DEPLACER_HEX') {
    reglesSrd.push('SRD 5e Chapitre 8 : Cadence de marche et exploration par tranche de 6 miles');
    reglesSrd.push(`DD de navigation topologique : ${adjudication.cible_dd_ou_ca}`);
    attributsPersonnage.push(`Sagesse (Survie): mod ${adjudication.modificateur >= 0 ? '+' : ''}${adjudication.modificateur}`);
    attributsPersonnage.push(`Eau consommée: ${adjudication.mutations_etat.eauDelta}L`);
    formuleMathematique = `d20 (${adjudication.dice_roll}) + Modificateur (${adjudication.modificateur}) = ${adjudication.score_total} vs DD ${adjudication.cible_dd_ou_ca}`;
    if (etat.personnage.heuresMarcheJour > 8) {
      reglesSrd.push('SRD 5e Chapitre 8 : Marche Forcée (DD 10 + 1 par heure sup)');
    }
  } else if (action.type === 'FORAGER') {
    reglesSrd.push('SRD 5e Chapitre 8 : Forage et Subsistance en milieu sauvage');
    reglesSrd.push(`DD de Forage selon terrain : ${adjudication.cible_dd_ou_ca}`);
    attributsPersonnage.push(`Rations actuelles: ${etat.personnage.rationsJours}j`);
    formuleMathematique = `d20 (${adjudication.dice_roll}) + Modificateur (${adjudication.modificateur}) = ${adjudication.score_total} vs DD ${adjudication.cible_dd_ou_ca}`;
  } else if (action.type === 'ATTAQUER') {
    reglesSrd.push('SRD 5e Chapitre 9 : Jet d\'attaque avec arme de corps-à-corps');
    reglesSrd.push(`Comparaison Seuil Classe d'Armure : CA ${adjudication.cible_dd_ou_ca}`);
    attributsPersonnage.push('Force / Maîtrise d\'arme');
    formuleMathematique = `d20 (${adjudication.dice_roll}) + Bonus attaque (${adjudication.modificateur}) = ${adjudication.score_total} vs CA ${adjudication.cible_dd_ou_ca}`;
  } else if (action.type === 'TOUR_ENNEMI') {
    reglesSrd.push('SRD 5e : IA Comportementale et jet d\'attaque hostile');
    attributsPersonnage.push(`Classe d'Armure Joueur: CA ${etat.personnage.ca}`);
    formuleMathematique = `d20 (${adjudication.dice_roll}) + Bonus attaque ennemie (${adjudication.modificateur}) = ${adjudication.score_total} vs CA Joueur ${adjudication.cible_dd_ou_ca}`;
  } else if (action.type === 'CORVEE_TRAVAIL') {
    reglesSrd.push('SRD 5e Chapitre 8 : Subsistance, corvées journalières et fatigue de labeur');
    reglesSrd.push(`Test de caractéristique de labeur vs Seuil DD ${adjudication.cible_dd_ou_ca}`);
    attributsPersonnage.push('Force / Sagesse / Endurance');
    formuleMathematique = `d20 (${adjudication.dice_roll}) + Modificateur (${adjudication.modificateur}) = ${adjudication.score_total} vs DD ${adjudication.cible_dd_ou_ca}`;
  } else if (action.type === 'TROQUER') {
    reglesSrd.push('SRD 5e Chapitre 5 : Économie monétaire (1 PO = 10 PA = 100 PC)');
    reglesSrd.push(`Indicateur macro-économique du fer : x${etat.marche.multiplicateurFer}`);
    attributsPersonnage.push(`Solde: ${etat.personnage.monnaies.po} PO, ${etat.personnage.monnaies.pa} PA, ${etat.personnage.monnaies.pc} PC`);
    formuleMathematique = 'Prix déterministe = Coût unitaire * Multiplicateur Pénurie';
  } else if (action.type === 'DIALOGUER_PNJ') {
    reglesSrd.push('SRD 5e Chapitre 7 : Interactions sociales et seuils d\'attitude PNJ');
    attributsPersonnage.push('Charisme (Persuasion / Perspicacité)');
    formuleMathematique = `d20 (${adjudication.dice_roll}) + Modificateur CHA (${adjudication.modificateur}) = ${adjudication.score_total} vs DD ${adjudication.cible_dd_ou_ca}`;
  } else if (action.type === 'ESQUIVER') {
    reglesSrd.push('SRD 5e Chapitre 9 : Action Esquiver (Désavantage conféré aux attaquants)');
    attributsPersonnage.push(`CA actuelle: ${etat.personnage.ca}`);
    formuleMathematique = 'Posturedéfensive active = 1 tour complet';
  } else if (action.type === 'LANCER_SORT') {
    reglesSrd.push('SRD 5e Chapitre 10 : Lancement de sorts & dépense d\'emplacements');
    attributsPersonnage.push(`Emplacement dépensé: Niveau 1`);
    formuleMathematique = `Jet magique (${adjudication.dice_roll}) vs Seuil ${adjudication.cible_dd_ou_ca || 'Effet direct'}`;
  } else if (action.type === 'FUIR_TACTIQUE') {
    reglesSrd.push('SRD 5e Chapitre 9 : Action Se désengager & Retraite sous pression');
    attributsPersonnage.push('Dextérité (Acrobaties / Vitesse)');
    formuleMathematique = `d20 (${adjudication.dice_roll}) + Mod DEX (${adjudication.modificateur}) = ${adjudication.score_total} vs DD ${adjudication.cible_dd_ou_ca}`;
  } else if (action.type === 'REPOS_LONG') {
    reglesSrd.push('SRD 5e Chapitre 8 : Repos Long (8 heures, restauration PV et emplacements de sorts)');
    reglesSrd.push('World Tick asynchrone des factions déclenché');
  } else if (action.type === 'JETS_MORT') {
    reglesSrd.push('SRD 5e Chapitre 9 : Sauvegardes contre la mort (DD 10, 3 échecs = Permadeath)');
    formuleMathematique = `d20 pur (${adjudication.dice_roll}) vs DD 10`;
  } else {
    reglesSrd.push('SRD 5e : Test de compétence libre sous contrôle arbitral backend');
    formuleMathematique = `d20 (${adjudication.dice_roll}) + Modificateur (${adjudication.modificateur}) = ${adjudication.score_total} vs DD ${adjudication.cible_dd_ou_ca}`;
  }

  // Filtrage Boundary-Aware du graphe de connaissances
  const pnjCibleId = action.type === 'DIALOGUER_PNJ' ? action.pnjId : undefined;
  for (const n of etat.grapheNoeuds) {
    if (pnjCibleId) {
      if (n.id === pnjCibleId || n.type === 'Location' || n.connuParEntites?.includes(pnjCibleId)) {
        noeudsGraphInjectes.push(`${n.label} (${n.type})`);
      } else {
        noeudsGraphFiltresMasques.push(`${n.label} (${n.type}) [Masqué - Non transmis au PNJ local]`);
      }
    } else {
      if (n.type === 'Location' || n.id === 'npc_forgeron_torvin' || n.connuParEntites?.includes('hex_0000_bourgade')) {
        noeudsGraphInjectes.push(`${n.label} (${n.type})`);
      } else {
        noeudsGraphFiltresMasques.push(`${n.label} (${n.type}) [Masqué - Non transmis au PNJ local]`);
      }
    }
  }

  for (const f of etat.factions) {
    if (f.noeudsControles.includes(etat.hexActuel.id) || (evenementFaction && evenementFaction.includes(f.nom))) {
      factionsImpliquees.push(`${f.nom} (Force: ${f.forceMilitaire}, Richesse: ${f.richesse})`);
    }
  }

  return {
    reglesSrd,
    attributsPersonnage,
    noeudsGraphInjectes,
    noeudsGraphFiltresMasques,
    hexagonesInterroges,
    factionsImpliquees,
    formuleMathematique,
  };
}

// Endpoints REST
app.get('/api/simulation/state', (_req: Request, res: Response) => {
  res.json(currentWorldState);
});

app.post('/api/simulation/act', async (req: Request, res: Response) => {
  try {
    const action: ActionRequest = req.body;
    const { nouvelEtat, adjudication, evenementFactionTexte } = orchestrerActionDeterministe(currentWorldState, action);
    
    // Génération narrative sobre conforme à l'adjudication avec capture de télémétrie
    const narrationRes = await genererNarration(action, adjudication, nouvelEtat, evenementFactionTexte);
    const donneesMobilisees = determinerDonneesMobilisees(action, adjudication, nouvelEtat, evenementFactionTexte);

    const traceExecution = {
      seq: nouvelEtat._seq,
      timestamp: `Jour ${nouvelEtat.horloge.jour}, ${String(nouvelEtat.horloge.heure).padStart(2, '0')}:00`,
      actionType: action.type,
      donneesEntree: action as any,
      promptSystemeIa: narrationRes.systemPrompt,
      promptUtilisateurIa: narrationRes.prompt,
      reponseBruteIa: narrationRes.reponseBrute,
      modeleIa: narrationRes.modele,
      latenceMs: narrationRes.latence,
      donneesUtilisees: donneesMobilisees,
    };

    const evenementNarratif: NarrativeEvent = {
      _seq: nouvelEtat._seq,
      horodatageTick: nouvelEtat.horloge.tick,
      horodatageDate: `Jour ${nouvelEtat.horloge.jour}, ${String(nouvelEtat.horloge.heure).padStart(2, '0')}:00`,
      titre: action.type.replace('_', ' '),
      texteNarratif: narrationRes.texte,
      tonAmbiance: narrationRes.tonAmbiance,
      suggestionsMJ: narrationRes.suggestionsMJ,
      adjudication,
      evenementFaction: evenementFactionTexte ? {
        factionNom: 'Factions du Monde',
        cibleNoeudNom: 'Géopolitique',
        action: 'World Tick',
        impact: evenementFactionTexte,
      } : undefined,
      trace: traceExecution,
    };

    nouvelEtat.journalNarratif.push(evenementNarratif);
    if (!nouvelEtat.historiqueTraces) nouvelEtat.historiqueTraces = [];
    nouvelEtat.historiqueTraces.push(traceExecution);

    currentWorldState = nouvelEtat;

    res.json({
      succes: true,
      etat: currentWorldState,
      dernierEvenement: evenementNarratif,
    });
  } catch (error: any) {
    console.error('Erreur adjudication:', error);
    res.status(400).json({ succes: false, erreur: error.message || 'Erreur inconnue' });
  }
});

app.post('/api/simulation/tick', async (_req: Request, res: Response) => {
  try {
    const debut = Date.now();
    const tickRes = executerWorldTick(
      currentWorldState.horloge.tick,
      currentWorldState.factions,
      currentWorldState.hexagones,
      currentWorldState.marche
    );

    currentWorldState._seq += 1;
    currentWorldState.horloge.tick = tickRes.nouveauTick;
    currentWorldState.factions = tickRes.factionsModifiees;
    currentWorldState.hexagones = tickRes.hexagonesModifies;
    currentWorldState.marche = tickRes.marcheModifie;

    const texteFaction = tickRes.journalFactions.join(' | ') || 'Aucun mouvement majeur.';
    const fin = Date.now();

    const traceTick = {
      seq: currentWorldState._seq,
      timestamp: `Jour ${currentWorldState.horloge.jour}, ${String(currentWorldState.horloge.heure).padStart(2, '0')}:00`,
      actionType: 'WORLD_TICK_FACTIONS',
      donneesEntree: { tickPrecedent: currentWorldState.horloge.tick - 1, nouveauTick: tickRes.nouveauTick },
      promptSystemeIa: 'Moteur autonome hors-champ sans sollicitation IA (Simulation algorithmique pure).',
      promptUtilisateurIa: 'Calcul asynchrone des oppositions de factions.',
      reponseBruteIa: texteFaction,
      modeleIa: 'Algorithme Déterministe de Factions',
      latenceMs: fin - debut,
      donneesUtilisees: {
        reglesSrd: ['Algorithme de Simulation Asynchrone : Score = d20 + Actifs + Modificateur Terrain'],
        attributsPersonnage: ['Aucun (Résolution hors du champ de vision du joueur)'],
        noeudsGraphInjectes: ['Nœuds de factions et points d\'intérêt régionaux'],
        noeudsGraphFiltresMasques: ['Tous les faits tenus secrets des populations locales'],
        hexagonesInterroges: currentWorldState.hexagones.map(h => `${h.nom} (Contrôle: ${h.factionControleId || 'Aucun'}, Sécurité: ${h.securite})`),
        factionsImpliquees: currentWorldState.factions.map(f => `${f.nom} (Force: ${f.forceMilitaire}, Richesse: ${f.richesse})`),
        formuleMathematique: 'Score Attaque (d20 + Force/10) vs Score Défense (d20 + Terrain)',
      },
    };

    const evt: NarrativeEvent = {
      _seq: currentWorldState._seq,
      horodatageTick: currentWorldState.horloge.tick,
      horodatageDate: `Jour ${currentWorldState.horloge.jour}, ${String(currentWorldState.horloge.heure).padStart(2, '0')}:00`,
      titre: 'Mouvement de Faction (World Tick)',
      texteNarratif: `Les forces politiques et militaires ont agi hors de vue. ${texteFaction}`,
      tonAmbiance: 'NEUTRE',
      suggestionsMJ: [
        'Consulter l\'état des factions et des routes commerciales',
        'Observer les mouvements de patrouilles aux abords du camp',
        'Poursuivre votre expédition selon votre plan de route',
      ],
      evenementFaction: {
        factionNom: 'Système Géopolitique',
        cibleNoeudNom: 'Monde',
        action: 'Simulation Asynchrone',
        impact: texteFaction,
      },
      trace: traceTick,
    };

    currentWorldState.journalNarratif.push(evt);
    if (!currentWorldState.historiqueTraces) currentWorldState.historiqueTraces = [];
    currentWorldState.historiqueTraces.push(traceTick);

    res.json({ succes: true, etat: currentWorldState, dernierEvenement: evt });
  } catch (error: any) {
    res.status(500).json({ succes: false, erreur: error.message });
  }
});

app.post('/api/simulation/reset', (_req: Request, res: Response) => {
  currentWorldState = JSON.parse(JSON.stringify(INITIAL_SIMULATION_STATE));
  currentWorldState._seq = 1;
  res.json({ succes: true, etat: currentWorldState });
});

// Endpoint SSE avec déduplication _seq
app.get('/api/narration/stream', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sinceSeq = parseInt(req.query.since_seq as string || '0', 10);
  const eventsAEnvoyer = currentWorldState.journalNarratif.filter(e => e._seq > sinceSeq);

  for (const evt of eventsAEnvoyer) {
    res.write(`id: ${evt._seq}\n`);
    res.write(`event: narration_event\n`);
    res.write(`data: ${JSON.stringify(evt)}\n\n`);
  }

  // Interval heartbeat pour garder la connexion ouverte
  const heartbeat = setInterval(() => {
    res.write(': keepalive\n\n');
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
  });
});

async function demarrerServeur() {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });

  app.use(vite.middlewares);

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Serveur D&D 5e Monde Indifférent actif sur http://0.0.0.0:${PORT}`);
  });
}

demarrerServeur();
