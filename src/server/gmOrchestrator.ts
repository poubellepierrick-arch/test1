import { GoogleGenAI, ThinkingLevel, Content } from '@google/genai';
import {
  SimulationState,
  NarrativeEvent,
  AdjudicationPayload,
  ExecutionTrace,
  CoherenceReport,
  NarrationMode,
  ThinkingDepth,
} from '../types';
import { ActionRequest, orchestrerActionDeterministe, mettreAJourMemoire } from '../engine/adjudication';
import { evaluerContexteLieu } from '../engine/context';
import { obtenirPnjsEnVue, estPnjEnVue } from '../engine/encounters';
import { traverserGraphe, filtrerParFrontiereDeConnaissance } from '../engine/graph';
import {
  GM_FUNCTION_DECLARATIONS,
  GmToolExecutionContext,
  assurerMemoireMJ,
  executerOutilMJ,
} from './gmTools';
import { compresserMemoireCampagne, validerCoherenceTour } from './gmCoherence';
import {
  rechercherCompendium,
  obtenirFicheSrd,
  formaterFicheCompactePourIA,
} from '../engine/compendium';
import { MonsterEntry } from '../types/srd';
import { formaterActionJoueur, genererTitreSceneFallback } from '../utils/journalFormatting';
import { extraireMetadataAzgaarDepuisEtat } from '../engine/azgaarGenerator';
import { calculerDistanceHex } from '../engine/hexcrawl';
import { construireVueEpistemiqueHeros } from '../engine/epistemic';
import {
  AI_TIMEOUT_MS,
  AiCancelledError,
  AiTimeoutError,
  appelerIaAvecRetry,
  creerContexteAppelIa,
  estErreurQuotaJournalier,
  RetryInfo,
} from './aiTimeout';

const MODEL_GM = 'gemini-4-hydrogen';

const SYSTEM_INSTRUCTION_MJ = `Tu es le Maître du Jeu d'une campagne D&D 5e sobre, vivante et implacable dans sa cohérence.
PRINCIPES DU MEILLEUR MAÎTRE DU JEU :
1. VOIX DIRECTE, SOBRE & DIÉGÉTIQUE : Adresse-toi au joueur au tutoiement (« tu », « te », « ton »), au présent, en respectant le mode de narration actif (ULTRA_COURT, CONCIS ou DEVELOPPE), sans adjectif décoratif ni jargon système. Ne mentionne JAMAIS l'interface, les onglets, les boutons, l'atlas du jeu, les « hexagones », ni des chiffres de fiche bruts (« PV », « CA », « XP », « DD ») dans le récit, les répliques ou les pistes.
2. ZÉRO PRÉSUMPTION D'INTENTION (RÈGLE ABSOLUE) :
   - Ne décris JAMAIS les pensées, émotions, soupçons, envies, hésitations, convictions ou motifs internes du personnage (interdiction absolue : « tu penses », « tu crains », « tu veux », « tu espères », « tu décides », « tu comptes », « tu te méfies », « tu hésites »). Décris uniquement le monde extérieur, les faits sensoriels concrets et les réactions observables.
   - N'enchaîne JAMAIS une action non demandée par le joueur (ne le fais ni partir, ni fouiller, ni frapper, ni prendre un objet sans ordre).
   - N'engage JAMAIS le héros dans une quête, promesse ou accord sans accord explicite du joueur : utilise queteAction="PROPOSER" pour toute offre d'un PNJ (jamais "CREER" sans consentement explicite).
   - Formule les 3 pistes ([[PISTE:...]]) comme des gestes neutres, immédiats et à l'infinitif, sans jamais orienter ni présumer une intention.
3. DISTINCTION SAVOIR DU HÉROS VS RÉALITÉ DU MONDE (RÈGLE ABSOLUE) :
   - Le contexte distingue strictement STRATE 1 (ce que le héros perçoit, sait, se rappelle ou a entendu par rumeur) et STRATE 2 (la réalité cachée du vaste monde, réservée à ton arbitrage causal).
   - Ne révèle JAMAIS directement un lieu encore INCONNU, un bourg ou marqueur non découvert, les statistiques chiffrées d'une faction, le secret d'un PNJ ou tes notes secrètes.
   - Révèle l'extérieur et les menaces cachées UNIQUEMENT par des indices sensoriels crédibles (fumée au loin, nervosité, traces au sol, récit d'un témoin) ou des rumeurs faillibles, sans jamais confirmer au joueur si une rumeur incertaine est vraie ou fausse.
   - Respecte scrupuleusement ce dont le héros se rappelle (Souvenirs, Rumeurs, Documents) sans inventer de faux souvenirs contraires à son vécu.
4. RÉPLIQUES DIRECTES, RÔLE & LOGIQUE CAUSALE : Dès qu'un PNJ présent interagit, donne-lui une réplique vivante sur une ligne dédiée au format « Nom : « ... » ». Chaque PNJ ne parle QUE de ce qui relève de son métier, de sa situation concrète sur place et de ce que le joueur vient de dire ou faire.
   - ZÉRO RÉPLIQUE CATALOGUE : Un PNJ ne récite JAMAIS une liste d'options ou de services du bourg (« Tu viens pour un coup de main, une réparation ou du négoce ? »).
   - LOGIQUE CAUSALE UNIQUE : Si un PNJ invoque une urgence ou dit « tu tombes à pic » / « justement », la suite de sa réplique porte EXCLUSIVEMENT sur ce besoin précis, jamais sur autre chose.
   - COHÉRENCE MATÉRIELLE : Aucune proposition ne peut contredire un manque énoncé dans la même réplique (ex : sans charbon, pas de soufflets ni de travail à chaud). Bannis toute phrase cryptique ou formule creuse.
5. ZÉRO HALLUCINATION SRD 5e : Appelle consulter_compendium_srd avant d'arbitrer un élément D&D 5e absent du briefing, et utilise les monstreId / objetId officiels.
6. UNIVERS ORIGINAL & VÉRITÉ DES DÉS : N'importe aucune intrigue ni PNJ de campagne publiée. Ne tire jamais de dé mentalement et respecte les résultats serveur.
7. RÉALISME GÉOGRAPHIQUE STRICT : Seuls les PNJ listés dans "PNJ dans le champ de vision" sont présents. Ne fais jamais agir un PNJ hors champ sans l'introduire via creerPnjItinerant ou deplacerPnjHexId.
8. CARTE & ATLAS UNIFIÉ : Appelle consulter_atlas_monde pour tout trajet ou géographie (en respectant decouvertParJoueur), et modifier_carte_monde uniquement lorsque le héros découvre réellement un secteur ou qu'un événement concret altère la carte.
9. DONJONS, ESCUADES & JETS DU JOUEUR : Utilise gerer_donjon, gerer_pnj_et_monde.declencherCombat (mon/escouade SRD) et demander_jet_joueur pour les périls demandant une réaction du joueur.
10. MÉMOIRE & COULISSES : Consigne tes plans cachés via noteSecreteMJ, gère arcs (arcAction) et secrets PNJ en coulisses sans jamais les divulguer sans cause en scène.`;

function toThinkingLevelEnum(niveau: ThinkingDepth): ThinkingLevel {
  if (niveau === 'XHIGH') return ThinkingLevel.XHIGH;
  if (niveau === 'HIGH') return ThinkingLevel.HIGH;
  if (niveau === 'MEDIUM') return ThinkingLevel.MEDIUM;
  return ThinkingLevel.LOW;
}

function downgraderThinking(niveau: ThinkingDepth, tentative: number): ThinkingDepth {
  if (tentative <= 0) return niveau;
  if (tentative === 1) {
    if (niveau === 'XHIGH') return 'HIGH';
    if (niveau === 'HIGH') return 'MEDIUM';
    return 'LOW';
  }
  return 'LOW';
}

const ACTIONS_MOTEUR_DIRECTES = new Set<ActionRequest['type']>([
  'DEPLACER_HEX',
  'FORAGER',
  'REPOS_COURT',
  'REPOS_LONG',
  'ATTAQUER',
  'TOUR_ENNEMI',
  'JETS_MORT',
  'ESQUIVER',
  'DEPLACER_COMBAT',
  'DESENGAGER_COMBAT',
  'LANCER_SORT',
  'FUIR_TACTIQUE',
  'TROQUER',
  'CORVEE_TRAVAIL',
  'ENGAGER_COMPAGNON',
  'CONGEDIER_COMPAGNON',
  'ENTRETENIR_EQUIPEMENT',
  'BOUILLIR_EAU',
  'EXPLORER_SITE',
  'DONJON_DEPLACEMENT',
  'DONJON_FOUILLER',
  'DONJON_SORTIR',
  'ENTRAINEMENT_NIVEAU',
  'PREPARER_SORT',
  'LANCER_SORT_GRIMOIRE',
  'FABRIQUER_OBJET',
  'SOIGNER_BLESSURE',
  'ANNOTER_HEX',
  'EQUIPER_OBJET',
  'UTILISER_OBJET',
  'JETER_OBJET',
  'BASCULER_LUMIERE',
  'CONFIGURER_VOYAGE',
  'IMPORTER_HEROS',
  'METTRE_A_JOUR_HEROS',
  'GERER_DOCUMENT_HEROS',
  'AJOUTER_QUETE',
  'CONFIGURER_NARRATION',
  'CONFIGURER_MODELE_IA',
  'RESOUDRE_JET_DEMANDE',
]);

const ACTIONS_INSTANTANEES = new Set<ActionRequest['type']>([
  'EQUIPER_OBJET',
  'UTILISER_OBJET',
  'JETER_OBJET',
  'BASCULER_LUMIERE',
  'CONFIGURER_VOYAGE',
  'IMPORTER_HEROS',
  'METTRE_A_JOUR_HEROS',
  'GERER_DOCUMENT_HEROS',
  'AJOUTER_QUETE',
  'DEPLACER_COMBAT',
  'CONFIGURER_NARRATION',
  'CONFIGURER_MODELE_IA',
]);

export function evaluerComplexiteTour(
  action: ActionRequest,
  etat: SimulationState
): { niveau: ThinkingDepth; thinkingEnum: ThinkingLevel; motif: string } {
  if (ACTIONS_INSTANTANEES.has(action.type)) {
    return { niveau: 'LOW', thinkingEnum: ThinkingLevel.LOW, motif: 'Action mécanique directe sans enjeu narratif' };
  }

  if ((etat.profilHydrogen || 'STANDARD') === 'MAX') {
    return {
      niveau: 'XHIGH',
      thinkingEnum: ThinkingLevel.XHIGH,
      motif: 'Gemini 4 Hydrogen Max (réflexion XHIGH activée)',
    };
  }

  const mem = etat.memoireMJ;
  const aArcsActifs = Boolean(mem?.arcsNarratifs?.some(a => a.statut === 'ACTIF'));
  const aArcCritique = Boolean(mem?.arcsNarratifs?.some(a => a.statut === 'ACTIF' && a.progression >= 75));
  const aConsequencesLatentes = Boolean(mem?.consequencesDifferees?.some(c => c.actif));
  const ennemisActifs = etat.combat.actif ? etat.combat.ennemis.filter(e => e.statut === 'ACTIF') : [];
  const combatComplexe =
    etat.combat.actif && (ennemisActifs.length >= 3 || ennemisActifs.some(e => e.pvMax >= 35));

  if (action.type === 'EXPLORER_SITE') {
    return {
      niveau: 'XHIGH',
      thinkingEnum: ThinkingLevel.XHIGH,
      motif: 'Exploration de site majeur / génération de donjon & enjeux multiples',
    };
  }

  if (action.type === 'RESOUDRE_JET_DEMANDE') {
    const dd = etat.jetEnAttente?.dd ?? 12;
    if (dd >= 15 || aArcCritique) {
      return {
        niveau: 'XHIGH',
        thinkingEnum: ThinkingLevel.XHIGH,
        motif: `Conséquences majeures d'un jet décisif (DD ${dd})`,
      };
    }
    return {
      niveau: 'HIGH',
      thinkingEnum: ThinkingLevel.HIGH,
      motif: 'Résolution des conséquences d\'un test de joueur',
    };
  }

  if (action.type === 'OUVERTURE_CAMPAGNE') {
    return {
      niveau: 'HIGH',
      thinkingEnum: ThinkingLevel.HIGH,
      motif: 'Prise en main du monde généré et ouverture de campagne',
    };
  }

  if (action.type === 'ACTION_LIBRE') {
    const txt = (action.texteLibre || '').toLowerCase();
    const motsLourds =
      /(donjon|crypte|guerre|traité|embuscade|boss|dragon|rituel|faction|trahison|négoc|secret|piège|carte|frontière)/i.test(
        txt
      );
    if (motsLourds || combatComplexe || aArcCritique) {
      return {
        niveau: 'XHIGH',
        thinkingEnum: ThinkingLevel.XHIGH,
        motif: 'Action libre à fort impact géopolitique, tactique ou narratif',
      };
    }
    return {
      niveau: 'HIGH',
      thinkingEnum: ThinkingLevel.HIGH,
      motif: 'Arbitrage ouvert de l\'action libre',
    };
  }

  if (action.type === 'DIALOGUER_PNJ' || action.type === 'DEMANDER_RUMEURS') {
    const pnjCible = action.pnjId ? etat.grapheNoeuds.find(n => n.id === action.pnjId) : undefined;
    const aSecret = Boolean(pnjCible?.proprietes?.secret);
    if (aSecret && aArcCritique) {
      return {
        niveau: 'XHIGH',
        thinkingEnum: ThinkingLevel.XHIGH,
        motif: 'Dialogue clé avec PNJ portant un secret d\'arc critique',
      };
    }
    return {
      niveau: 'HIGH',
      thinkingEnum: ThinkingLevel.HIGH,
      motif: 'Interaction sociale, secrets et mémoire PNJ',
    };
  }

  if (
    action.type === 'ATTAQUER' ||
    action.type === 'ESQUIVER' ||
    action.type === 'DESENGAGER_COMBAT' ||
    action.type === 'TOUR_ENNEMI' ||
    action.type === 'FUIR_TACTIQUE'
  ) {
    if (combatComplexe) {
      return {
        niveau: 'HIGH',
        thinkingEnum: ThinkingLevel.HIGH,
        motif: 'Combat multi-ennemis ou adversaire élite',
      };
    }
    return {
      niveau: 'LOW',
      thinkingEnum: ThinkingLevel.LOW,
      motif: 'Tour de combat standard rapide',
    };
  }

  if (
    action.type === 'TROQUER' ||
    action.type === 'BOUILLIR_EAU' ||
    action.type === 'ANNOTER_HEX' ||
    action.type === 'PREPARER_SORT' ||
    action.type === 'CONGEDIER_COMPAGNON'
  ) {
    return {
      niveau: 'LOW',
      thinkingEnum: ThinkingLevel.LOW,
      motif: 'Action courante à faible embranchement',
    };
  }

  if (
    action.type === 'LANCER_SORT' ||
    action.type === 'LANCER_SORT_GRIMOIRE' ||
    action.type === 'ENTRAINEMENT_NIVEAU' ||
    action.type === 'CORVEE_TRAVAIL' ||
    (action.type === 'REPOS_LONG' && etat.hexActuel.pointInteret?.type !== 'bourgade') ||
    aArcsActifs ||
    aConsequencesLatentes
  ) {
    return {
      niveau: 'HIGH',
      thinkingEnum: ThinkingLevel.HIGH,
      motif: aArcsActifs || aConsequencesLatentes
        ? 'Tour impliquant arcs narratifs ou conséquences actives'
        : 'Action à forte portée sur l\'état ou l\'environnement',
    };
  }

  return {
    niveau: 'MEDIUM',
    thinkingEnum: ThinkingLevel.MEDIUM,
    motif: 'Exploration ou progression standard',
  };
}

function construireMetadonneesNeutres(
  action: ActionRequest,
  etat: SimulationState
): { titre: string; ton: 'CHAMPETRE' | 'SOMBRE' | 'PERIL' | 'NEUTRE'; suggestions: string[] } {
  const enCombat = etat.combat.actif;
  const ctx = evaluerContexteLieu(etat);
  const estEnBourgade = ctx.estEnBourgade;
  const aDonjon = Boolean(etat.donjon && etat.donjon.actif);
  const titre = etat.personnage.estMortDefinitivement
    ? `Fin de ${etat.personnage.nom}`
    : genererTitreSceneFallback(action, etat.hexActuel.nom, estEnBourgade, enCombat, aDonjon);

  if (etat.personnage.estMortDefinitivement) {
    return {
      titre,
      ton: 'PERIL',
      suggestions: [
        'Recommencer une nouvelle expédition',
        'Relire les derniers événements',
        'Observer le dernier bilan du personnage',
      ],
    };
  }

  if (enCombat) {
    const ennemiVivant = etat.combat.ennemis.find(e => e.statut === 'ACTIF');
    const nomEnnemi = ennemiVivant ? ennemiVivant.nom : 'l’adversaire';
    return {
      titre,
      ton: 'PERIL',
      suggestions: [
        `Frapper ${nomEnnemi} au corps-à-corps`,
        'Tenir la garde et esquiver',
        'Rompre le combat et reculer',
      ],
    };
  }

  if (aDonjon) {
    return {
      titre,
      ton: 'SOMBRE',
      suggestions: [
        'Avancer vers le passage suivant',
        'Examiner les parois de la salle',
        'Regagner la sortie',
      ],
    };
  }

  const ton: 'CHAMPETRE' | 'SOMBRE' | 'NEUTRE' = estEnBourgade
    ? 'CHAMPETRE'
    : etat.hexActuel.securite === 'Dangereux' || etat.hexActuel.securite === 'Périlleux'
    ? 'SOMBRE'
    : 'NEUTRE';

  const premierPnj = ctx.pnjsEnVue[0]?.label;
  return {
    titre,
    ton,
    suggestions: estEnBourgade
      ? [
          premierPnj ? `Parler à ${premierPnj}` : 'Observer la place',
          'Vérifier les vivres et le matériel',
          'Approcher de la sortie du bourg',
        ]
      : [
          ctx.peutExplorerSite && etat.hexActuel.pointInteret?.nom
            ? `Approcher de ${etat.hexActuel.pointInteret.nom}`
            : 'Observer les environs immédiats',
          premierPnj ? `Parler à ${premierPnj}` : 'Chercher eau et vivres',
          'Installer un bivouac',
        ],
  };
}

export function determinerDonneesMobilisees(
  action: ActionRequest,
  adjudication: AdjudicationPayload,
  etat: SimulationState,
  evenementFaction?: string,
  fichesSrdConsultees?: string[]
) {
  const reglesSrd: string[] = [];
  const attributsPersonnage: string[] = [];
  const noeudsGraphInjectes: string[] = [];
  const noeudsGraphFiltresMasques: string[] = [];
  const metaAzgaar = extraireMetadataAzgaarDepuisEtat(etat);
  const hexagonesInterroges: string[] = [
    `${etat.hexActuel.nom} [${etat.hexActuel.q},${etat.hexActuel.r}] (${etat.hexActuel.biomeAzgaar || etat.hexActuel.terrain}, Sécurité: ${etat.hexActuel.securite})`,
    `Atlas Azgaar: ${metaAzgaar.nomMonde} (#${metaAzgaar.seed}, ${metaAzgaar.modeleRelief})`,
  ];
  const factionsImpliquees: string[] = [];
  let formuleMathematique = '';

  attributsPersonnage.push(`PV: ${etat.personnage.pvActuels}/${etat.personnage.pvMax}`);
  attributsPersonnage.push(`Épuisement: Niv ${etat.personnage.epuisement}/6`);

  if (action.type === 'DEPLACER_HEX') {
    reglesSrd.push('SRD 5e Chapitre 8 : Cadence de marche et exploration par tranche de 6 miles');
    reglesSrd.push(`DD de navigation topologique : ${adjudication.cible_dd_ou_ca}`);
    attributsPersonnage.push(`Sagesse (Survie): mod ${adjudication.modificateur >= 0 ? '+' : ''}${adjudication.modificateur}`);
    formuleMathematique = `d20 (${adjudication.dice_roll}) + Modificateur (${adjudication.modificateur}) = ${adjudication.score_total} vs DD ${adjudication.cible_dd_ou_ca}`;
  } else if (action.type === 'ATTAQUER' || action.type === 'TOUR_ENNEMI') {
    reglesSrd.push('SRD 5e Chapitre 9 : Combat et Classe d\'Armure');
    formuleMathematique = `d20 (${adjudication.dice_roll}) + Mod (${adjudication.modificateur}) = ${adjudication.score_total} vs CA ${adjudication.cible_dd_ou_ca}`;
  } else if (action.type === 'DIALOGUER_PNJ' || action.type === 'DEMANDER_RUMEURS') {
    reglesSrd.push('SRD 5e Chapitre 7 : Interactions sociales et attitude PNJ');
    attributsPersonnage.push(`Charisme: ${etat.personnage.caracteristiques.CHA}`);
    formuleMathematique = `d20 (${adjudication.dice_roll}) + Mod (${adjudication.modificateur}) = ${adjudication.score_total} vs DD ${adjudication.cible_dd_ou_ca}`;
  } else {
    reglesSrd.push(`SRD 5e : ${adjudication.competenceOuCarac || adjudication.action_type}`);
    if (adjudication.cible_dd_ou_ca > 0) {
      formuleMathematique = `d20 (${adjudication.dice_roll}) + Mod (${adjudication.modificateur}) = ${adjudication.score_total} vs DD ${adjudication.cible_dd_ou_ca}`;
    } else {
      formuleMathematique = adjudication.mutations_etat.descriptionTechnique;
    }
  }

  const pnjCibleId = action.type === 'DIALOGUER_PNJ' || action.type === 'DEMANDER_RUMEURS' ? action.pnjId : undefined;
  const pnjsEnVueIds = new Set(obtenirPnjsEnVue(etat).map(p => p.id));
  for (const n of etat.grapheNoeuds) {
    if (pnjCibleId) {
      if (n.id === pnjCibleId || n.type === 'Location' || n.connuParEntites?.includes(pnjCibleId)) {
        noeudsGraphInjectes.push(`${n.label} (${n.type})`);
      } else {
        noeudsGraphFiltresMasques.push(`${n.label} (${n.type}) [Masqué - Hors frontière du PNJ]`);
      }
    } else {
      if (n.type === 'Location' || pnjsEnVueIds.has(n.id) || n.connuParEntites?.includes(etat.hexActuel.id)) {
        noeudsGraphInjectes.push(`${n.label} (${n.type})`);
      } else {
        noeudsGraphFiltresMasques.push(`${n.label} (${n.type}) [Masqué - Hors champ de vision]`);
      }
    }
  }

  for (const f of etat.factions) {
    if (f.noeudsControles.includes(etat.hexActuel.id) || (evenementFaction && evenementFaction.includes(f.nom))) {
      factionsImpliquees.push(
        `${f.nom} (${f.posture || 'ACTIF'}, Force: ${f.forceMilitaire}, Moral: ${f.moral ?? 65}, Richesse: ${f.richesse})`
      );
    }
  }

  const entitesLocales = (etat.entitesMonde || []).filter(
    e => e.statut === 'EN_ROUTE' && e.hexId === etat.hexActuel.id
  );
  for (const ent of entitesLocales) {
    noeudsGraphInjectes.push(`${ent.nom} (${ent.type})`);
  }

  return {
    reglesSrd,
    fichesSrdConsultees: fichesSrdConsultees && fichesSrdConsultees.length > 0 ? fichesSrdConsultees : undefined,
    attributsPersonnage,
    noeudsGraphInjectes,
    noeudsGraphFiltresMasques,
    hexagonesInterroges,
    factionsImpliquees,
    formuleMathematique,
  };
}

function construireBriefingSrdScene(etat: SimulationState): { texte: string; fichesInjectees: string[] } {
  const p = etat.personnage;
  const fichesInjectees: string[] = [];
  const lignes: string[] = [];

  // 1. Équipement équipé exact
  const equips = p.inventaire.filter(i => i.estEquipe);
  if (equips.length > 0) {
    const fichesEquip = equips
      .map(i => obtenirFicheSrd(i.compendiumId || i.nom))
      .filter((f): f is NonNullable<typeof f> => Boolean(f));
    if (fichesEquip.length > 0) {
      lignes.push('Équipement actif SRD :');
      for (const f of fichesEquip) {
        lignes.push(`- ${formaterFicheCompactePourIA(f)}`);
        fichesInjectees.push(`${f.nom} (${f.id})`);
      }
    }
  }

  // 2. Conditions & Épuisement actifs
  if (p.epuisement > 0) {
    const regleEp = obtenirFicheSrd('rule_epuisement');
    if (regleEp) {
      lignes.push(`Épuisement actif (Niv ${p.epuisement}) : ${formaterFicheCompactePourIA(regleEp)}`);
      fichesInjectees.push(`${regleEp.nom} (${regleEp.id})`);
    }
  }
  for (const cond of p.conditions || []) {
    const resCond = rechercherCompendium({ requete: cond, categorie: 'regle', domaine: 'etat', limite: 1 });
    if (resCond.length > 0) {
      lignes.push(`Condition active : ${formaterFicheCompactePourIA(resCond[0].entry)}`);
      fichesInjectees.push(`${resCond[0].entry.nom} (${resCond[0].entry.id})`);
    }
  }

  // 3. Ennemis en combat
  if (etat.combat.actif) {
    lignes.push('Fiches adversaires en combat :');
    for (const enn of etat.combat.ennemis.filter(e => e.statut === 'ACTIF')) {
      const fMon = enn.monstreId ? obtenirFicheSrd(enn.monstreId) : obtenirFicheSrd(enn.nom);
      if (fMon) {
        lignes.push(`- ${formaterFicheCompactePourIA(fMon)}`);
        fichesInjectees.push(`${fMon.nom} (${fMon.id})`);
      }
    }
  }

  // 4. Faune/ménagerie SRD du biome courant (hors bourgade pacifiée)
  const estBourgade = etat.hexActuel.pointInteret?.type === 'bourgade';
  if (!estBourgade) {
    const biomeQuery = etat.donjon?.actif ? 'Donjon' : etat.hexActuel.terrain;
    const creatures = rechercherCompendium({
      categorie: 'monstre',
      biome: biomeQuery,
      fpMax: Math.max(2, p.niveau + 1),
      limite: 6,
    })
      .map(r => r.entry)
      .filter((e): e is MonsterEntry => e.categorie === 'monstre');

    if (creatures.length > 0) {
      lignes.push(
        `Bestiaire compatible (${biomeQuery}) : ${creatures
          .map(m => `${m.id}:${m.nom}(FP ${m.fp}, CA ${m.ca}, PV ${m.pv})`)
          .join(' | ')}`
      );
    }
  }

  return {
    texte: lignes.length > 0 ? lignes.join('\n') : 'Aucune fiche spéciale requise ; utiliser consulter_compendium_srd au besoin.',
    fichesInjectees,
  };
}

export function construireContexteScene(
  action: ActionRequest,
  etat: SimulationState,
  adjudicationInitiale?: AdjudicationPayload,
  evenementFaction?: string,
  briefingSrd?: string
): string {
  assurerMemoireMJ(etat);
  const ctx = evaluerContexteLieu(etat);
  const p = etat.personnage;
  const vue = construireVueEpistemiqueHeros(etat);
  const mem = etat.memoireMJ!;

  const pnjsVisiblesTexte = vue.perceptionImmediate.pnjsEnVue
    .map(pnj => {
      const hist = pnj.historiqueDialogue
        .map(h => `[${h.date}] "${h.sujet}" -> ${h.issue}${h.repliquePnj ? ` | Réplique: « ${h.repliquePnj} »` : ''}`)
        .join(' ; ');
      const traits = [
        pnj.apparence ? `Apparence: ${pnj.apparence}` : '',
        pnj.voixEtManies ? `Manie: ${pnj.voixEtManies}` : '',
        pnj.lienHerosNature ? `Lien connu avec le héros: ${pnj.lienHerosNature}` : '',
      ]
        .filter(Boolean)
        .join(' | ');
      return `- ${pnj.id} (${pnj.nom}, ${pnj.profession}, Disposition: ${pnj.disposition}, Humeur: ${pnj.humeur}, DD base: ${pnj.seuilDD})
      ${traits ? `Traits perceptibles: ${traits}\n      ` : ''}Faits connus: ${pnj.faitsPartages.join(' | ') || 'Locaux'}
      Échanges passés: ${hist || 'Aucun'}`;
    })
    .join('\n');

  const combatInfos = etat.combat.actif
    ? `ACTIF (Round ${etat.combat.round}) — Ennemis: ${etat.combat.ennemis
        .map(e => `${e.id}:${e.nom}(${e.pv}/${e.pvMax} PV, CA ${e.ca}, ${e.statut})`)
        .join(', ')}`
    : 'Non';

  const donjonInfos = vue.perceptionImmediate.donjonActuel
    ? `ACTIF (${vue.perceptionImmediate.donjonActuel.nom}, Salle: ${vue.perceptionImmediate.donjonActuel.salleNom} — ${vue.perceptionImmediate.donjonActuel.description})`
    : 'Non';

  const identiteExtras = [
    p.race ? `Race: ${p.race}` : '',
    p.historique ? `Historique: ${p.historique}` : '',
    p.alignement ? `Alignement: ${p.alignement}` : '',
  ]
    .filter(Boolean)
    .join(' | ');

  const lumiereTxt = p.sourceLumiere
    ? `${p.sourceLumiere.nom} (${p.sourceLumiere.active ? 'Allumée' : 'Éteinte'}, ${p.sourceLumiere.heuresRestantes.toFixed(1)}h)`
    : 'Aucune';

  const lieuxConnusTxt = vue.savoirVerifie.lieuxDecouverts
    .map(l => `${l.nom} [${l.q},${l.r}] (${l.brouillard}${l.pointInteret ? `, ${l.pointInteret}` : ''}${l.annotation ? `, Note: ${l.annotation}` : ''})`)
    .join(' ; ');

  const offresTexte =
    vue.savoirVerifie.propositionsEnAttente.length > 0
      ? vue.savoirVerifie.propositionsEnAttente
          .map(q => `- [PROPOSEE - non acceptée] ${q.titre} (par ${q.interlocuteur}) : ${q.details}`)
          .join('\n')
      : 'Aucune';

  const quetesTexte =
    vue.savoirVerifie.engagementsAcceptes.length > 0
      ? vue.savoirVerifie.engagementsAcceptes
          .map(q => `- [${q.statut}] ${q.titre} (avec ${q.interlocuteur}${q.echeanceJour ? `, échéance J${q.echeanceJour}` : ''}) : ${q.details}`)
          .join('\n')
      : 'Aucun';

  const rumeursHeroTexte =
    vue.souvenirsEtOuieDire.rumeursEntendues.length > 0
      ? vue.souvenirsEtOuieDire.rumeursEntendues
          .map(r => `- [${r.statutPerception}] ${r.titre} (source: ${r.source}) : ${r.texte}`)
          .join('\n')
      : 'Aucune rumeur entendue.';

  const blocsDocs = vue.souvenirsEtOuieDire.documentsActifs.map(
    d => `- [${d.categorie}] ${d.titre} : ${d.extrait}`
  );

  const nouvellesTxt =
    vue.savoirVerifie.nouvellesLocales.length > 0
      ? vue.savoirVerifie.nouvellesLocales.map(n => `- [J${n.jour}] ${n.titre} (${n.impact})`).join('\n')
      : 'Aucune nouvelle parvenue.';

  const factionLocale = etat.factions.find(f => f.noeudsControles.includes(etat.hexActuel.id));

  // Strate 2 : Réalité objective hors-champ (interdit de divulguer directement)
  const lieuxInconnusTxt =
    vue.realiteCacheeMonde.lieuxInconnus.length > 0
      ? vue.realiteCacheeMonde.lieuxInconnus
          .map(l => `${l.nom} [${l.q},${l.r}] (${l.terrain}${l.pointInteret ? `, ${l.pointInteret}` : ''}, Danger:${l.pressionDanger ?? 30})`)
          .join(' ; ')
      : 'Aucun secteur encore inconnu.';

  const pnjsSecretsTxt =
    vue.realiteCacheeMonde.pnjsSecrets.length > 0
      ? vue.realiteCacheeMonde.pnjsSecrets
          .map(
            s =>
              `- ${s.id} (${s.nom}, ${s.enVue ? 'EN VUE' : `hors champ à ${s.lieu}`})${s.motivation ? ` | Mobile caché: ${s.motivation}` : ''}${s.secret ? ` | Secret: ${s.secret}` : ''}`
          )
          .join('\n')
      : 'Aucun secret PNJ actif.';

  const arcsTexte =
    vue.realiteCacheeMonde.arcsNarratifs.length > 0
      ? vue.realiteCacheeMonde.arcsNarratifs
          .map(a => `- [${a.statut} · ${a.progression}%] ${a.titre} (${a.acteurs}) — Suite latente: ${a.prochaineEtape || 'À définir'}`)
          .join('\n')
      : 'Aucun arc actif.';

  const consTexte =
    vue.realiteCacheeMonde.consequencesDifferees.length > 0
      ? vue.realiteCacheeMonde.consequencesDifferees
          .map(c => `- Déclencheur: ${c.declencheur} -> Effet prévu: ${c.effetPrevu}`)
          .join('\n')
      : 'Aucune';

  const secretsMjTexte =
    vue.realiteCacheeMonde.notesSecretesMJ.length > 0
      ? vue.realiteCacheeMonde.notesSecretesMJ.map(n => `- [J${n.jour}] ${n.titre}: ${n.contenu}`).join('\n')
      : 'Aucune note secrète.';

  const veraciteRumeursTxt =
    vue.realiteCacheeMonde.veraciteRumeurs.length > 0
      ? vue.realiteCacheeMonde.veraciteRumeurs.map(r => `${r.titre} => ${r.veracite ? 'VRAIE' : 'FAUSSE'}`).join(' | ')
      : 'Aucune';

  return `=== ACTION DU JOUEUR ===
Type: ${action.type}
Détails: ${JSON.stringify(action)}
${adjudicationInitiale ? `Résolution mécanique déjà exécutée: ${JSON.stringify(adjudicationInitiale)}` : 'Aucune résolution mécanique encore exécutée — à toi d\'arbitrer et d\'appeler les outils appropriés.'}
${evenementFaction ? `Écho perceptible d'un mouvement hors-champ: ${evenementFaction}` : ''}

=== ÉTAT DU PERSONNAGE (${p.nom}, Niv ${p.niveau} ${p.classe}${identiteExtras ? ` · ${identiteExtras}` : ''}) ===
PV: ${p.pvActuels}/${p.pvMax} | CA: ${p.ca} | Épuisement: ${p.epuisement}/6 | XP: ${p.experience}/${p.experienceNextLevel}
Caracs: FOR ${p.caracteristiques.FOR}, DEX ${p.caracteristiques.DEX}, CON ${p.caracteristiques.CON}, INT ${p.caracteristiques.INT}, SAG ${p.caracteristiques.SAG}, CHA ${p.caracteristiques.CHA}
Maîtrises: ${p.competencesMaitrisees.join(', ')} (Bonus +${p.bonusMaitrise})
${p.traits ? `Traits: ${p.traits}\n` : ''}${p.capacites && p.capacites.length > 0 ? `Capacités: ${p.capacites.join(', ')}\n` : ''}Bourse: ${p.monnaies.po} PO, ${p.monnaies.pa} PA, ${p.monnaies.pc} PC
Survie: Rations ${p.rationsJours}/${p.rationsMaxJours}j, Eau ${p.eauLitres}/${p.eauMaxLitres}L (${p.qualiteEau}), Lumière: ${lumiereTxt}, Marche: ${p.heuresMarcheJour}h (${etat.marcheAllure || 'Normale'} / ${etat.roleExploration || "S'orienter"})
Blessures: ${p.blessuresPersistantes.map(b => b.nom).join(', ') || 'Aucune'}
Inventaire: ${p.inventaire.map(i => `${i.nom}${i.estEquipe ? ' [Équipé]' : ''} x${i.quantite}`).join(', ')}
Compagnons: ${p.compagnons.map(c => `${c.nom} (${c.type})`).join(', ') || 'Aucun'}
${blocsDocs.length > 0 ? `\n=== DOSSIER & DOCUMENTS DU HÉROS ===\n${blocsDocs.join('\n')}` : ''}

=== STRATE 1 : PERCEPTION, SAVOIR & MÉMOIRE DU HÉROS (EXPOSABLE AU JOUEUR) ===
Mode narration actif : ${etat.modeNarration || 'CONCIS'}
Date: Jour ${etat.horloge.jour}, ${String(etat.horloge.heure).padStart(2, '0')}:00 (${etat.horloge.saison || 'Automne'}) | Météo perçue: ${etat.horloge.meteo} (${etat.horloge.temperature}, ${etat.horloge.tendanceMeteo || 'Stable'})
Lieu immédiatement perçu: ${etat.hexActuel.id} — ${etat.hexActuel.nom} [${etat.hexActuel.q},${etat.hexActuel.r}] (${etat.hexActuel.biomeAzgaar || etat.hexActuel.terrain}, Sécurité ressentie: ${etat.hexActuel.securite}, Alt: ${etat.hexActuel.altitude ?? 25}m, Temp: ${etat.hexActuel.temperatureC ?? 12}°C, Voie: ${etat.hexActuel.routeNiveau || 'AUCUNE'})
Point d'intérêt sur place: ${etat.hexActuel.pointInteret ? `${etat.hexActuel.pointInteret.nom} (${etat.hexActuel.pointInteret.type}, ${etat.hexActuel.pointInteret.statut})` : 'Nature sauvage'}
Autorité visible localement: ${factionLocale ? factionLocale.nom : 'Aucune bannière locale'}
Abords immédiats (respectant le brouillard): ${vue.perceptionImmediate.abordsImmediats.map(a => a.label).join(' ; ')}
Indices sensoriels observables ici: ${vue.perceptionImmediate.indicesSensoriels.join(' | ') || 'Rien d\'anormal dans l\'air immédiat.'}
Nature du lieu: ${ctx.resumeLieu}${ctx.peutExplorerSite && etat.hexActuel.pointInteret ? ` (site proche : ${etat.hexActuel.pointInteret.nom})` : ''}
Combat: ${combatInfos}
Donjon: ${donjonInfos}
Entités vues sur place / secteurs découverts proches: ${vue.perceptionImmediate.entitesEnVue.map(e => `${e.nom} (${e.type}) à ${e.lieu}${e.destinationConnue ? ` → ${e.destinationConnue}` : ''}`).join(' ; ') || 'Aucun convoi ou patrouille en vue'}

PNJ DANS LE CHAMP DE VISION (uniquement observables) :
${pnjsVisiblesTexte || 'Aucun PNJ en vue.'}

Savoir vérifié du héros (lieux découverts, bourgs/marqueurs connus, engagements) :
- Secteurs déjà découverts: ${lieuxConnusTxt}
- Bourgs Azgaar connus: ${vue.savoirVerifie.bourgsDecouverts.join(' ; ') || 'Secteur initial uniquement'}
- Marqueurs joueur visibles: ${vue.savoirVerifie.marqueursDecouverts.join(' ; ') || 'Aucun'}
- Nouvelles locales parvenues:
${nouvellesTxt}
- Engagements explicitement acceptés:
${quetesTexte}
- Propositions PNJ en attente (NE PAS considérer comme acceptées):
${offresTexte}
${vue.savoirVerifie.lorePublic ? `- Lore & histoire connus du héros: ${vue.savoirVerifie.lorePublic.genese || ''} | Lieux connus: ${vue.savoirVerifie.lorePublic.lieuxLore.slice(0, 3).join(' ; ') || 'Bourg de départ'}` : ''}

Souvenirs & Ouï-dire du héros (faillibles, à respecter sans inventer d'autres souvenirs) :
- Informations retenues: ${vue.souvenirsEtOuieDire.dernieresInfos.join(' | ') || 'Aucune'}
- Réminiscences: ${vue.souvenirsEtOuieDire.souvenirsContextuels.join(' | ') || 'Aucune'}
- Rumeurs entendues (vérité inconnue du joueur):
${rumeursHeroTexte}
${mem.chroniqueCondensee ? `- Chronique vécue condensée:\n${mem.chroniqueCondensee}` : ''}
- Fil vécu récent: ${mem.filNarratif.slice(-6).join(' | ') || 'Début de campagne.'}
- Dernières scènes vécues:
${vue.souvenirsEtOuieDire.chroniqueRecente.join('\n') || 'Aucune.'}
${etat.jetEnAttente ? `- Jet en attente du joueur: ${etat.jetEnAttente.titre} (${etat.jetEnAttente.competence || etat.jetEnAttente.caracteristique} DD ${etat.jetEnAttente.dd})` : ''}

=== STRATE 2 : RÉALITÉ OBJECTIVE HORS-CHAMP (COULISSES MJ — INTERDIT DE RÉVÉLER DIRECTEMENT) ===
(Utilise ces faits uniquement pour la cohérence causale, les réactions crédibles des PNJ et des indices indirects. N'énonce JAMAIS ces éléments comme connus du héros tant qu'il ne les a pas perçus ou découverts.)
Monde Azgaar: ${etat.azgaarStudio?.worldName || metaAzgaarNom(etat)}
Secteurs encore INCONNU du joueur: ${lieuxInconnusTxt}
Bourgs/États hors savoir joueur: ${vue.realiteCacheeMonde.bourgsEtEtatsCaches.slice(0, 10).join(' ; ') || 'Aucun'}
Marqueurs secrets/hors-champ: ${vue.realiteCacheeMonde.marqueursCaches.slice(0, 8).join(' ; ') || 'Aucun'}
État chiffré réel des factions: ${vue.realiteCacheeMonde.factionsCompletes.join(' | ')}
Mouvements d'unités hors champ: ${vue.realiteCacheeMonde.entitesHorsChamp.join(' ; ') || 'Aucun'}
Secrets & mobiles cachés des PNJ:
${pnjsSecretsTxt}
${vue.realiteCacheeMonde.pnjsMajeursEtLies?.length ? `Figures majeures du monde & liens du héros:\n${vue.realiteCacheeMonde.pnjsMajeursEtLies.join('\n')}` : ''}
${vue.realiteCacheeMonde.secretsLoreMJ?.length ? `Secrets du lore, d'État & hérésies (MJ uniquement):\n${vue.realiteCacheeMonde.secretsLoreMJ.slice(0, 10).map(s => `- ${s}`).join('\n')}` : ''}
Véracité réelle des rumeurs (NE PAS CONFIRMER AU JOUEUR): ${veraciteRumeursTxt}
Arcs narratifs latents:
${arcsTexte}
Conséquences différées actives:
${consTexte}
Journal secret du MJ:
${secretsMjTexte}
${action.type === 'OUVERTURE_CAMPAGNE' ? `\n=== MONDE GÉNÉRÉ À OUVRIR ===\nMonde: ${metaAzgaarNom(etat)} | Climat: ${etat.azgaarStudio?.climateBias || 'tempere'} | Bourg/Lieu de départ: ${etat.hexActuel.nom} (${etat.hexActuel.biomeAzgaar || etat.hexActuel.terrain}) | Factions visibles/actives: ${etat.factions.map(f => f.nom).join(', ')} | Marché: fer x${etat.marche.multiplicateurFer}, vivres x${etat.marche.multiplicateurVivres}, sécurité routes=${etat.marche.securiteRoutes}.` : ''}

=== COMPENDIUM D&D 5e (DONNÉES OFFICIELLES DE LA SCÈNE) ===
${briefingSrd || 'Consulter consulter_compendium_srd si besoin.'}`;
}

function metaAzgaarNom(etat: SimulationState): string {
  const m = extraireMetadataAzgaarDepuisEtat(etat);
  return `${m.nomMonde} (#${m.seed}, ${m.modeleRelief})`;
}

function extraireMetadonneesRecit(
  rawText: string,
  metaNeutre: { titre: string; ton: 'CHAMPETRE' | 'SOMBRE' | 'PERIL' | 'NEUTRE'; suggestions: string[] }
): {
  titre: string;
  texte: string;
  tonAmbiance: 'CHAMPETRE' | 'SOMBRE' | 'PERIL' | 'NEUTRE';
  suggestionsMJ: string[];
  memoireResume?: string;
} {
  const firstTagIdx = rawText.indexOf('[[');
  const proseBrute = (firstTagIdx >= 0 ? rawText.slice(0, firstTagIdx) : rawText).trim();
  if (proseBrute.length === 0) {
    throw new Error('Le MJ IA a renvoyé un récit vide. Le tour est annulé.');
  }

  const metaSection = firstTagIdx >= 0 ? rawText.slice(firstTagIdx) : '';
  const titreMatch = metaSection.match(/\[\[TITRE\s*:\s*([^\]]+)\]\]/i);
  const titre = titreMatch && titreMatch[1].trim() ? titreMatch[1].trim() : metaNeutre.titre;

  const tonMatch = metaSection.match(/\[\[TON\s*:\s*(CHAMPETRE|SOMBRE|PERIL|NEUTRE)\s*\]\]/i);
  const tonAmbiance = (tonMatch
    ? tonMatch[1].toUpperCase()
    : metaNeutre.ton) as 'CHAMPETRE' | 'SOMBRE' | 'PERIL' | 'NEUTRE';

  const pistes: string[] = [];
  const pisteRegex = /\[\[PISTE\s*:\s*([^\]]+)\]\]/gi;
  let m: RegExpExecArray | null;
  while ((m = pisteRegex.exec(metaSection)) !== null) {
    const val = m[1].trim();
    if (val) pistes.push(val);
  }
  const suggestionsMJ = pistes.length >= 3 ? pistes.slice(0, 3) : metaNeutre.suggestions;

  const memMatch = metaSection.match(/\[\[MEMOIRE\s*:\s*([^\]]+)\]\]/i);
  const memoireResume = memMatch ? memMatch[1].trim() : undefined;

  return { titre, texte: proseBrute, tonAmbiance, suggestionsMJ, memoireResume };
}

export interface StreamCallbacks {
  onAdjudication?: (adjudication: AdjudicationPayload, etatIntermediaire: SimulationState) => void;
  onChunk?: (deltaText: string) => void;
  onRetryStatus?: (info: RetryInfo) => void;
}

export interface GmExecutionRuntimeOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface GmTurnResult {
  nouvelEtat: SimulationState;
  evenementNarratif?: NarrativeEvent;
  traceExecution: ExecutionTrace;
}

export async function executerTourMaitreDuJeu(
  aiClient: GoogleGenAI | null,
  etatActuel: SimulationState,
  action: ActionRequest,
  callbacks?: StreamCallbacks,
  runtimeOptions?: GmExecutionRuntimeOptions
): Promise<GmTurnResult> {
  const debut = Date.now();
  const etatClone: SimulationState = JSON.parse(JSON.stringify(etatActuel));
  assurerMemoireMJ(etatClone);

  const {
    niveau: niveauReflexion,
    thinkingEnum: thinkingLevelEnum,
    motif: motifReflexion,
  } = evaluerComplexiteTour(action, etatClone);
  const modeNarration: NarrationMode = etatClone.modeNarration || 'CONCIS';

  const toolCtx: GmToolExecutionContext = {
    etat: etatClone,
    actionOrigine: action,
    moteurDejaExecute: false,
    appelsOutils: [],
    notesSecretesTour: [],
  };

  // Validation précoce pour DIALOGUER_PNJ / DEMANDER_RUMEURS si interlocuteur hors de vue
  if (action.type === 'DIALOGUER_PNJ' && (!action.pnjId || !estPnjEnVue(etatClone, action.pnjId))) {
    throw new Error('Interlocuteur hors de portée : aucun PNJ correspondant dans votre champ de vision.');
  }
  if (action.type === 'DEMANDER_RUMEURS') {
    const ctxLieu = evaluerContexteLieu(etatClone);
    if (!ctxLieu.peutDemanderRumeurs) {
      throw new Error('Aucun interlocuteur en vue pour recueillir des rumeurs.');
    }
  }

  if (action.type === 'OUVERTURE_CAMPAGNE' && etatClone.journalNarratif.length > 0) {
    const deja = etatClone.journalNarratif[0];
    return {
      nouvelEtat: etatClone,
      evenementNarratif: deja,
      traceExecution:
        etatClone.historiqueTraces?.[0] || {
          seq: deja._seq,
          timestamp: deja.horodatageDate,
          actionType: 'OUVERTURE_CAMPAGNE',
          donneesEntree: action as any,
          promptSystemeIa: SYSTEM_INSTRUCTION_MJ,
          promptUtilisateurIa: 'Ouverture déjà initialisée.',
          reponseBruteIa: deja.texteNarratif,
          modeleIa: MODEL_GM,
          latenceMs: 0,
          donneesUtilisees: {
            reglesSrd: [],
            attributsPersonnage: [],
            noeudsGraphInjectes: [],
            noeudsGraphFiltresMasques: [],
            hexagonesInterroges: [],
            factionsImpliquees: [],
            formuleMathematique: 'Ouverture déjà effectuée',
          },
        },
    };
  }

  const estActionInstant = ACTIONS_INSTANTANEES.has(action.type);
  if (!estActionInstant && !aiClient) {
    throw new Error(
      'Le MJ IA ne répond pas (service IA indisponible). La partie ne peut pas continuer sans sa supervision.'
    );
  }

  const estActionMoteurDirecte = ACTIONS_MOTEUR_DIRECTES.has(action.type);
  if (estActionMoteurDirecte) {
    const resMoteur = orchestrerActionDeterministe(toolCtx.etat, action);
    toolCtx.etat = resMoteur.nouvelEtat;
    assurerMemoireMJ(toolCtx.etat);
    toolCtx.adjudication = resMoteur.adjudication;
    toolCtx.evenementFactionTexte = resMoteur.evenementFactionTexte;
    toolCtx.pnjApproche = resMoteur.pnjApproche;
    toolCtx.moteurDejaExecute = true;
    callbacks?.onAdjudication?.(resMoteur.adjudication, toolCtx.etat);
  } else if (action.type === 'OUVERTURE_CAMPAGNE') {
    toolCtx.etat._seq = Math.max(1, toolCtx.etat._seq);
  } else {
    toolCtx.etat._seq += 1;
  }

  // Fast-path déterministe instantané (sans appel LLM ni attente) pour la gestion de fiche, inventaire, quêtes et micro-déplacements
  if (estActionInstant) {
    const adj = toolCtx.adjudication!;
    const ajouterAuJournal =
      action.type === 'IMPORTER_HEROS' ||
      action.type === 'DEPLACER_COMBAT' ||
      (action.type === 'UTILISER_OBJET' && toolCtx.etat.combat.actif);
    const metaInstant = construireMetadonneesNeutres(action, toolCtx.etat);
    const fin = Date.now();
    return finaliserResultatTour(
      toolCtx,
      action,
      metaInstant.titre,
      adj.mutations_etat.descriptionTechnique,
      metaInstant.ton,
      metaInstant.suggestions,
      'Action directe du moteur (sans appel IA)',
      'Moteur Déterministe Direct',
      'LOW',
      motifReflexion,
      adj.mutations_etat.descriptionTechnique,
      fin - debut,
      ajouterAuJournal
    );
  }

  const briefingSrd = construireBriefingSrdScene(toolCtx.etat);
  toolCtx.fichesSrdConsultees = [...briefingSrd.fichesInjectees];

  const promptContexte = construireContexteScene(
    action,
    toolCtx.etat,
    toolCtx.adjudication,
    toolCtx.evenementFactionTexte,
    briefingSrd.texte
  );

  if (!aiClient) {
    throw new Error(
      'Le MJ IA ne répond pas (service IA indisponible). La partie ne peut pas continuer sans sa supervision.'
    );
  }
  const clientIa = aiClient;

  let niveauEffectif: ThinkingDepth = niveauReflexion;
  const aiCtx = creerContexteAppelIa(
    runtimeOptions?.signal,
    runtimeOptions?.timeoutMs ?? AI_TIMEOUT_MS
  );

  try {
    const contents: Content[] = [{ role: 'user', parts: [{ text: promptContexte }] }];

    // Phase 1 : Boucle d'arbitrage et d'appels d'outils par Gemini 4 Hydrogen
    const mem = toolCtx.etat.memoireMJ!;
    const aEnjeuxNarratifsActifs =
      !estActionMoteurDirecte ||
      action.type === 'RESOUDRE_JET_DEMANDE' ||
      niveauReflexion !== 'LOW' ||
      mem.consequencesDifferees.some(c => c.actif) ||
      mem.promessesEtQuetes.some(q => q.statut === 'EN_COURS' || q.statut === 'PROPOSEE') ||
      (mem.arcsNarratifs || []).some(a => a.statut === 'ACTIF');

    if (aEnjeuxNarratifsActifs) {
      const instructionPhase1 = `${SYSTEM_INSTRUCTION_MJ}

PHASE 1 — ARBITRAGE & OUTILS (Profondeur: ${niveauReflexion} — ${motifReflexion}) :
Analyse l'action et la scène. Appelle immédiatement les outils nécessaires (consulter_compendium_srd, consulter_atlas_monde, modifier_carte_monde, lancer_test_competence, appliquer_consequence_scene, gerer_pnj_et_monde, gerer_donjon, demander_jet_joueur, executer_action_moteur).
- Si tu as besoin de statistiques d'un monstre, d'un prix d'objet, d'un sort ou d'une règle exacte absente du briefing : appelle d'abord consulter_compendium_srd.
- Si le joueur demande un trajet, des directions, cherche un lieu/rivière/biome, ou observe l'horizon : appelle consulter_atlas_monde.
- Si la scène révèle une portion de carte, découvre une terre au-delà des frontières connues, ou fonde/altère un camp, une ruine ou une patrouille : appelle modifier_carte_monde.
- Si un souterrain/ruine comporte plusieurs salles, pièges ou gardiens SRD : appelle gerer_donjon.
- Si l'action est OUVERTURE_CAMPAGNE : tu ouvres un monde tout juste généré avant le tout premier message du joueur. Lis attentivement la géographie, le climat, le bourg de départ, les factions, les convois et la fiche/documents du héros. Appelle gerer_pnj_et_monde pour consigner tes notes secrètes initiales (noteSecreteMJ) et créer au moins un arc narratif initial (arcAction="CREER") en coulisses, sans déclencher ni combat ni quête acceptée.
- Si l'action est ACTION_LIBRE et nécessite un jet de compétence ou sauvegarde interactif du joueur : appelle demander_jet_joueur (ou lancer_test_competence si jet immédiat PNJ/savoir), applique les conséquences réelles (appliquer_consequence_scene avec objetId si objet SRD) et mets à jour PNJ/arcs/notes secrètes (gerer_pnj_et_monde).
- Si l'action est RESOUDRE_JET_DEMANDE : le résultat du jet du joueur est déjà dans adjudicationInitiale ; applique maintenant les vraies conséquences (appliquer_consequence_scene pour dégâts/soin/gain, gerer_pnj_et_monde pour combat/arc/PNJ, ou gerer_donjon).
- Si l'action est DIALOGUER_PNJ ou DEMANDER_RUMEURS : appelle lancer_test_competence si nécessaire, puis gerer_pnj_et_monde pour enregistrer la réplique du PNJ, son secret/disposition, les arcs et notes secrètes.
- Si l'action moteur a déjà été exécutée ci-dessus : n'appelle gerer_pnj_et_monde, gerer_donjon, modifier_carte_monde ou appliquer_consequence_scene QUE si une promesse, un arc, un secret, une conséquence différée ou une révélation pertinente se déclenche.
Dès que tous les outils nécessaires ont été exécutés (ou si aucun outil supplémentaire n'est requis), réponds UNIQUEMENT par le mot PRETS.`;

      for (let round = 0; round < 5; round++) {
        const resArbitrage = await appelerIaAvecRetry(
          ({ tentative, signal }) => {
            const niveauTent = downgraderThinking(niveauReflexion, tentative);
            niveauEffectif = niveauTent;
            return clientIa.models.generateContent({
              model: MODEL_GM,
              contents,
              config: {
                systemInstruction: instructionPhase1,
                thinkingConfig: { thinkingLevel: toThinkingLevelEnum(niveauTent) },
                tools: [{ functionDeclarations: GM_FUNCTION_DECLARATIONS }],
                abortSignal: signal,
              },
            });
          },
          {
            signal: aiCtx.signal,
            deadlineMs: aiCtx.deadlineMs,
            timeoutMs: aiCtx.timeoutMs,
            onRetry: callbacks?.onRetryStatus,
          }
        );

        const calls = resArbitrage.functionCalls;
        const modelContent = resArbitrage.candidates?.[0]?.content;
        if (modelContent) {
          contents.push(modelContent);
        }

        if (!calls || calls.length === 0) {
          break;
        }

        const responseParts = calls.map(call => {
          const out = executerOutilMJ(toolCtx, call.name || '', (call.args as Record<string, any>) || {});
          return {
            functionResponse: {
              id: call.id,
              name: call.name,
              response: out,
            },
          };
        });

        contents.push({ role: 'user', parts: responseParts });

        // Émettre immédiatement la dernière adjudication au client pendant le streaming
        if (toolCtx.adjudication) {
          callbacks?.onAdjudication?.(toolCtx.adjudication, toolCtx.etat);
        }
      }
    }

    // Garantie d'adjudication minimale pour les actions libres sans jet de dé explicite
    if (!toolCtx.adjudication) {
      toolCtx.adjudication = {
        phase: 'adjudication_resolved',
        action_type:
          action.type === 'OUVERTURE_CAMPAGNE'
            ? 'TRAVEL'
            : action.type === 'DIALOGUER_PNJ'
            ? 'NPC_INTERACTION'
            : 'SKILL_CHECK',
        competenceOuCarac:
          action.type === 'OUVERTURE_CAMPAGNE' ? 'Ouverture de campagne' : 'Scène arbitrée par le MJ',
        dice_roll: 10,
        modificateur: 0,
        score_total: 10,
        cible_dd_ou_ca: 0,
        issue: 'SUCCESS',
        mutations_etat: {
          descriptionTechnique:
            action.type === 'OUVERTURE_CAMPAGNE'
              ? `Entrée en scène à ${toolCtx.etat.hexActuel.nom} (${metaAzgaarNom(toolCtx.etat)}).`
              : action.texteLibre || action.sujetDialogue || 'Scène narrative résolue.',
        },
      };
      mettreAJourMemoire(
        toolCtx.etat.personnage,
        toolCtx.adjudication.mutations_etat.descriptionTechnique,
        toolCtx.etat.hexActuel,
        toolCtx.etat.horloge.meteo
      );
      callbacks?.onAdjudication?.(toolCtx.adjudication, toolCtx.etat);
    }

    const regleLongueurNarration =
      modeNarration === 'ULTRA_COURT'
        ? 'MODE ULTRA_COURT : Rédige 1 à 2 phrases très courtes et sèches (max 260 caractères hors dialogue), zéro adjectif superflu.'
        : modeNarration === 'DEVELOPPE'
        ? 'MODE DEVELOPPE : Rédige 4 à 7 phrases immersives, concrètes et sensorielles, sans jargon système.'
        : 'MODE CONCIS : Rédige 2 à 4 phrases nettes, concrètes et incarnées.';

    // Phase 2 : Récit en streaming temps réel + balises structurées en fin de flux
    const promptPhase2 = `État final validé après arbitrage :
Adjudication : ${JSON.stringify(toolCtx.adjudication)}
Personnage : PV ${toolCtx.etat.personnage.pvActuels}/${toolCtx.etat.personnage.pvMax}, Épuisement ${toolCtx.etat.personnage.epuisement}/6, Mort=${toolCtx.etat.personnage.estMortDefinitivement}
Lieu : ${toolCtx.etat.hexActuel.nom} (${toolCtx.etat.hexActuel.terrain}, Sécurité: ${toolCtx.etat.hexActuel.securite})
PNJ en vue : ${obtenirPnjsEnVue(toolCtx.etat).map(p => `${p.label} (${p.proprietes?.disposition || 'NEUTRE'})`).join(', ') || 'Aucun'}
${toolCtx.etat.jetEnAttente ? `JET EN ATTENTE DU JOUEUR : ${toolCtx.etat.jetEnAttente.titre} (${toolCtx.etat.jetEnAttente.competence || toolCtx.etat.jetEnAttente.caracteristique} DD ${toolCtx.etat.jetEnAttente.dd}) — Pose la situation sans résoudre le jet.` : ''}
Outils exécutés ce tour : ${toolCtx.appelsOutils.map(a => `${a.nom} -> ${a.resultat}`).join(' ; ') || 'Action moteur directe'}

Rédige maintenant le récit final en tutoyant directement le joueur (« tu », « te », « ton ») au présent. ${regleLongueurNarration}
RAPPELS IMPÉRATIFS :
- ZÉRO pensée, émotion, soupçon ou décision attribuée au héros ; ZÉRO action enchaînée non demandée.
- ZÉRO divulgation directe d'un élément de STRATE 2 (lieu INCONNU, secret PNJ, force chiffrée de faction, véracité d'une rumeur). Uniquement des faits observables ou indices sensoriels.
- ZÉRO terme d'interface ou mécanique brute (onglet, bouton, atlas, hexagone, PV, CA, XP, DD) dans le récit, les dialogues ou les pistes.
- ZÉRO dialogue catalogue : un PNJ ne propose jamais une liste artificielle d'actions ou de services. S'il énonce un problème (« tu tombes à pic… »), toute la réplique reste fidèle à ce seul problème et matériellement cohérente. Place chaque réplique sur sa propre ligne au format « Nom : « ... » ».
${action.type === 'OUVERTURE_CAMPAGNE' ? '- OUVERTURE DE CAMPAGNE : Ancres le premier instant dans le bourg/biome, le climat et l\'heure du monde généré ; reste concret, sobre et sans réplique superflue.' : ''}
- Les 3 pistes doivent être des gestes neutres à l'infinitif sans présumer d'une décision.
Termine EXACTEMENT par ces 6 lignes :
[[TITRE:Titre court et évocateur de la scène (3 à 6 mots)]]
[[TON:CHAMPETRE|SOMBRE|PERIL|NEUTRE]]
[[PISTE:Suggestion concrète 1]]
[[PISTE:Suggestion concrète 2]]
[[PISTE:Suggestion concrète 3]]
[[MEMOIRE:Une phrase factuelle résumant le tournant de la scène]]`;

    const streamContents: Content[] = [...contents];
    if (streamContents.length > 0 && streamContents[streamContents.length - 1].role === 'user') {
      streamContents[streamContents.length - 1] = {
        role: 'user',
        parts: [...(streamContents[streamContents.length - 1].parts || []), { text: promptPhase2 }],
      };
    } else {
      streamContents.push({ role: 'user', parts: [{ text: promptPhase2 }] });
    }

    const stream = await appelerIaAvecRetry(
      ({ signal }) =>
        clientIa.models.generateContentStream({
          model: MODEL_GM,
          contents: streamContents,
          config: {
            systemInstruction: SYSTEM_INSTRUCTION_MJ,
            thinkingConfig: {
              thinkingLevel:
                (toolCtx.etat.profilHydrogen || 'STANDARD') === 'MAX'
                  ? ThinkingLevel.HIGH
                  : ThinkingLevel.LOW,
            },
            abortSignal: signal,
          },
        }),
      {
        signal: aiCtx.signal,
        deadlineMs: aiCtx.deadlineMs,
        timeoutMs: aiCtx.timeoutMs,
        onRetry: callbacks?.onRetryStatus,
      }
    );

    let rawBuffer = '';
    let emittedLen = 0;

    for await (const chunk of stream) {
      if (aiCtx.signal.aborted) {
        throw aiCtx.signal.reason instanceof Error ? aiCtx.signal.reason : new AiCancelledError();
      }
      const piece = chunk.text || '';
      if (!piece) continue;
      rawBuffer += piece;

      // Ne jamais streamer les balises [[...]] vers l'interface
      const markerIdx = rawBuffer.indexOf('[[');
      let safeEnd = markerIdx >= 0 ? markerIdx : rawBuffer.length;
      if (markerIdx < 0 && rawBuffer.endsWith('[')) {
        safeEnd = rawBuffer.length - 1;
      }

      if (safeEnd > emittedLen) {
        const delta = rawBuffer.slice(emittedLen, safeEnd);
        emittedLen = safeEnd;
        callbacks?.onChunk?.(delta);
      }
    }

    const finalMarkerIdx = rawBuffer.indexOf('[[');
    const finalSafeEnd = finalMarkerIdx >= 0 ? finalMarkerIdx : rawBuffer.length;
    if (finalSafeEnd > emittedLen) {
      callbacks?.onChunk?.(rawBuffer.slice(emittedLen, finalSafeEnd));
    }

    const metaNeutres = construireMetadonneesNeutres(action, toolCtx.etat);
    const parsed = extraireMetadonneesRecit(rawBuffer, metaNeutres);

    if (parsed.memoireResume) {
      const dateStr = `Jour ${toolCtx.etat.horloge.jour}, ${String(toolCtx.etat.horloge.heure).padStart(2, '0')}:00`;
      toolCtx.etat.memoireMJ!.filNarratif.push(`${dateStr} — ${parsed.memoireResume}`);
      compresserMemoireCampagne(toolCtx.etat, 8);
    }

    const rapportCoherence = validerCoherenceTour(toolCtx.etat, parsed, toolCtx.appelsOutils, action);

    const libelleModele =
      (toolCtx.etat.profilHydrogen || 'STANDARD') === 'MAX'
        ? `${MODEL_GM} (Max)`
        : `${MODEL_GM} (Standard)`;

    const fin = Date.now();
    return finaliserResultatTour(
      toolCtx,
      action,
      parsed.titre,
      parsed.texte,
      parsed.tonAmbiance,
      parsed.suggestionsMJ,
      promptContexte,
      libelleModele,
      niveauEffectif,
      motifReflexion,
      rawBuffer,
      fin - debut,
      true,
      rapportCoherence
    );
  } catch (err: any) {
    if (aiCtx.estAnnuleParClient() || err instanceof AiCancelledError || err?.name === 'AbortError') {
      throw new AiCancelledError('Tour annulé par le joueur.');
    }
    if (aiCtx.estExpire() || err instanceof AiTimeoutError) {
      throw new AiTimeoutError(
        'Le MJ IA n\'a pas répondu dans le délai maximal de 15 minutes. Le tour est annulé.'
      );
    }
    const detailBrut = String(err?.message || 'Service IA indisponible');
    if (detailBrut.startsWith('Le MJ IA')) {
      console.warn('Échec du MJ IA — tour annulé sans repli:', detailBrut);
      throw err;
    }
    let detailLisible = detailBrut;
    if (estErreurQuotaJournalier(err)) {
      detailLisible =
        'quota journalier gratuit Gemini atteint — sélectionnez une clé API avec facturation dans Settings > Secrets ou réessayez après réinitialisation';
      console.warn('Échec du MJ IA — quota journalier atteint (tour annulé sans repli).');
    } else if (/RESOURCE_EXHAUSTED|429/i.test(detailBrut)) {
      detailLisible = 'quota de requêtes IA momentanément atteint';
      console.warn('Échec du MJ IA — limite de requêtes atteinte:', detailLisible);
    } else if (/503|UNAVAILABLE|overloaded|high demand/i.test(detailBrut)) {
      detailLisible = 'service IA temporairement saturé';
      console.warn('Échec du MJ IA — service saturé.');
    } else if (/API key|PERMISSION_DENIED|401|403/i.test(detailBrut)) {
      detailLisible = 'clé ou autorisation IA invalide — vérifiez Settings > Secrets';
      console.warn('Échec du MJ IA — autorisation invalide.');
    } else {
      if (detailBrut.trim().startsWith('{')) {
        try {
          const parsedErr = JSON.parse(detailBrut);
          detailLisible = parsedErr?.error?.message || 'service IA indisponible';
        } catch {
          detailLisible = 'service IA indisponible';
        }
      }
      console.error('Échec du MJ IA — tour annulé sans repli:', detailLisible);
    }
    throw new Error(`Le MJ IA ne répond pas (${detailLisible}). La partie ne peut pas continuer sans sa supervision.`);
  } finally {
    aiCtx.cleanup();
  }
}

function finaliserResultatTour(
  toolCtx: GmToolExecutionContext,
  action: ActionRequest,
  titre: string,
  texte: string,
  tonAmbiance: 'CHAMPETRE' | 'SOMBRE' | 'PERIL' | 'NEUTRE',
  suggestionsMJ: string[],
  prompt: string,
  modeleIa: string,
  niveauReflexion: ThinkingDepth,
  motifReflexion: string,
  reponseBruteIa: string,
  latenceMs: number,
  ajouterAuJournal = true,
  rapportCoherence?: CoherenceReport
): GmTurnResult {
  const etat = toolCtx.etat;
  const adjudication = toolCtx.adjudication!;
  const donneesMobilisees = determinerDonneesMobilisees(
    action,
    adjudication,
    etat,
    toolCtx.evenementFactionTexte,
    toolCtx.fichesSrdConsultees
  );
  const dateLabel = `Jour ${etat.horloge.jour}, ${String(etat.horloge.heure).padStart(2, '0')}:00`;

  const traceExecution: ExecutionTrace = {
    seq: etat._seq,
    timestamp: dateLabel,
    actionType: action.type,
    donneesEntree: action as any,
    promptSystemeIa: SYSTEM_INSTRUCTION_MJ,
    promptUtilisateurIa: prompt,
    reponseBruteIa,
    modeleIa,
    niveauReflexion,
    motifReflexion,
    appelsOutils: toolCtx.appelsOutils,
    notesSecretesTour: toolCtx.notesSecretesTour && toolCtx.notesSecretesTour.length > 0 ? toolCtx.notesSecretesTour : undefined,
    rapportCoherence,
    latenceMs,
    donneesUtilisees: donneesMobilisees,
  };

  if (!etat.historiqueTraces) etat.historiqueTraces = [];
  etat.historiqueTraces.push(traceExecution);

  if (!ajouterAuJournal) {
    return {
      nouvelEtat: etat,
      traceExecution,
    };
  }

  const evenementNarratif: NarrativeEvent = {
    _seq: etat._seq,
    horodatageTick: etat.horloge.tick,
    horodatageDate: dateLabel,
    titre,
    actionJoueur: formaterActionJoueur(action),
    texteNarratif: texte,
    tonAmbiance,
    suggestionsMJ,
    adjudication,
    evenementFaction: toolCtx.evenementFactionTexte
      ? {
          factionNom: 'Factions du Monde',
          cibleNoeudNom: 'Géopolitique',
          action: 'World Tick',
          impact: toolCtx.evenementFactionTexte,
        }
      : undefined,
    pnjApproche: toolCtx.pnjApproche,
    jetDemande: etat.jetEnAttente ? { ...etat.jetEnAttente } : undefined,
    trace: traceExecution,
  };

  etat.journalNarratif.push(evenementNarratif);

  return {
    nouvelEtat: etat,
    evenementNarratif,
    traceExecution,
  };
}
