import { FunctionDeclaration, Type } from '@google/genai';
import {
  SimulationState,
  AdjudicationPayload,
  Ability,
  Combatant,
} from '../types';
import { ActionRequest, orchestrerActionDeterministe, mettreAJourMemoire } from '../engine/adjudication';
import { actionExprimeConsentementQuete, construireVueEpistemiqueHeros, hexEstDecouvert } from '../engine/epistemic';
import { calculerModificateur, lancerD20 } from '../engine/dice';
import { evaluerContexteLieu } from '../engine/context';
import { estPnjEnVue, ajouterPnjItinerant } from '../engine/encounters';
import { avancerTempsEtMonde } from '../engine/worldSim';
import { initialiserCombat, resoudreToursJusquaJoueur } from '../engine/combat';
import { infligerBlessurePersistante } from '../engine/injuries';
import {
  rechercherCompendium,
  obtenirFicheSrd,
  formaterFicheCompactePourIA,
  creerCombatantDepuisMonstre,
} from '../engine/compendium';
import { SrdCategory, ItemEntry, MonsterEntry } from '../types/srd';
import {
  etendreFrontiereAzgaar,
  extraireMetadataAzgaarDepuisEtat,
} from '../engine/azgaarGenerator';
import { createSeededRng } from '../utils/prng';
import {
  AZGAAR_BIOMES,
  calculerRouteVoronoi,
  genererBlasonDeterministe,
  genererMondeAzgaarStudio,
  obtenirCellulesDansRayon,
  projeterHexVersMondeAzgaar,
  reconstruireAtlasComplet,
  synchroniserSecteurDepuisAzgaar,
  trouverCellulePlusProche,
} from '../engine/azgaarVoronoi';
import { calculerItinerairePondere } from '../engine/worldGeography';
import { calculerDistanceHex } from '../engine/hexcrawl';
import { synchroniserControleFactions } from '../engine/worldSim';
import {
  AzgaarBurgDef,
  AzgaarClimateBias,
  AzgaarMarkerDef,
  AzgaarMarkerIcon,
  AzgaarTemplateId,
  DungeonRoom,
  HexNode,
  SecurityLevel,
  WorldEntityType,
} from '../types';

export const GM_FUNCTION_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: 'consulter_compendium_srd',
    description:
      'Interroge la base officielle D&D 5e (bestiaire, objets/prix, sorts, règles, classes/races). À utiliser impérativement pour obtenir les vraies statistiques, prix exacts en PO/PA/PC, dégâts ou règles avant d\'arbitrer ou d\'invoquer un monstre/objet.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        requete: {
          type: Type.STRING,
          description: 'Mot-clé ou nom (français ou anglais, ex: "araignée géante", "épée longue", "empoisonné", "boule de feu").',
        },
        idExact: {
          type: Type.STRING,
          description: 'ID exact du compendium si déjà connu (ex: mon_gobelin, item_potion_soins).',
        },
        categorie: {
          type: Type.STRING,
          description: 'Filtre optionnel : tout, monstre, objet, sort, regle ou classe_race.',
        },
        biome: {
          type: Type.STRING,
          description: 'Filtre optionnel de biome pour le bestiaire (Forêt Dense, Marais Fétide, Montagne Escarpée, Désert Aride, Plaine / Route, Donjon).',
        },
        fpMax: {
          type: Type.NUMBER,
          description: 'Facteur de puissance maximum pour les monstres (ex: 1, 0.5, 4).',
        },
        limite: {
          type: Type.INTEGER,
          description: 'Nombre maximal de fiches retournées (défaut 6, max 12).',
        },
      },
    },
  },
  {
    name: 'executer_action_moteur',
    description:
      'Exécute une action mécanique SRD 5e officielle du moteur (déplacement, combat, troc, corvée, forage, repos, donjon, sorts, compagnon, forge, entretien). Utiliser en priorité quand l\'action correspond à une manœuvre moteur structurée.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        actionTypeOverride: {
          type: Type.STRING,
          description:
            'Optionnel : type d\'action moteur à exécuter (DEPLACER_HEX, FORAGER, REPOS_COURT, REPOS_LONG, ATTAQUER, ESQUIVER, LANCER_SORT, FUIR_TACTIQUE, TOUR_ENNEMI, TROQUER, CORVEE_TRAVAIL, BOUILLIR_EAU, EXPLORER_SITE, DONJON_DEPLACEMENT, DONJON_FOUILLER, DONJON_SORTIR, ENTRETENIR_EQUIPEMENT, ENTRAINEMENT_NIVEAU, SOIGNER_BLESSURE). Par défaut, reprend l\'action envoyée par le client.',
        },
        cibleId: {
          type: Type.STRING,
          description: 'Identifiant de cible éventuel (hexagone, ennemi, salle de donjon, blessure).',
        },
        articleId: {
          type: Type.STRING,
          description: 'Pour TROQUER : alias (ration, eau, torche, bandage, fleches, dague) ou ID officiel du compendium (ex: item_epee_longue, item_potion_soins).',
        },
        quantite: {
          type: Type.INTEGER,
          description: 'Pour TROQUER : quantité d\'articles (entier >= 1).',
        },
        jobId: {
          type: Type.STRING,
          description: 'Pour CORVEE_TRAVAIL : identifiant de corvée disponible.',
        },
      },
    },
  },
  {
    name: 'lancer_test_competence',
    description:
      'Lance un véritable d20 SRD 5e côté serveur pour arbitrer une action libre, une négociation, une ruse, une escalade, une fouille ou un test social.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        caracteristique: {
          type: Type.STRING,
          description: 'Caractéristique : FOR, DEX, CON, INT, SAG ou CHA.',
        },
        competence: {
          type: Type.STRING,
          description: 'Nom court du test (ex: Persuasion, Discrétion, Athlétisme, Survie, Perception, Intimidation, Crochetage).',
        },
        dd: {
          type: Type.INTEGER,
          description: 'Degré de difficulté (DD) entre 5 (très facile) et 25 (héroïque).',
        },
        modeJet: {
          type: Type.STRING,
          description: 'normal, avantage ou desavantage.',
        },
        raison: {
          type: Type.STRING,
          description: 'Motif factuel bref du test.',
        },
      },
      required: ['caracteristique', 'competence', 'dd', 'raison'],
    },
  },
  {
    name: 'appliquer_consequence_scene',
    description:
      'Applique des conséquences mécaniques validées par le serveur suite à une action libre ou une péripétie (dépense/gain de pièces, dégâts, soin, fatigue, temps écoulé, objet trouvé/perdu, XP, blessure).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        pvDelta: {
          type: Type.INTEGER,
          description: 'Variation de PV (négatif pour dégâts, positif pour soin).',
        },
        epuisementDelta: {
          type: Type.INTEGER,
          description: 'Variation du niveau d\'épuisement (-1 à +2).',
        },
        poDelta: {
          type: Type.INTEGER,
          description: 'Variation de pièces d\'or (PO).',
        },
        paDelta: {
          type: Type.INTEGER,
          description: 'Variation de pièces d\'argent (PA).',
        },
        pcDelta: {
          type: Type.INTEGER,
          description: 'Variation de pièces de cuivre (PC).',
        },
        rationsDelta: {
          type: Type.INTEGER,
          description: 'Variation de jours de rations.',
        },
        eauDelta: {
          type: Type.NUMBER,
          description: 'Variation de litres d\'eau.',
        },
        heuresEcoulees: {
          type: Type.INTEGER,
          description: 'Heures écoulées pendant la scène (0 à 8).',
        },
        xpGagne: {
          type: Type.INTEGER,
          description: 'Points d\'expérience octroyés (0 à 150).',
        },
        objetId: {
          type: Type.STRING,
          description: 'ID officiel du Compendium SRD (ex: item_potion_soins, item_epee_longue) pour hydrater automatiquement nom, poids, valeur et dégâts.',
        },
        ajouterObjetNom: {
          type: Type.STRING,
          description: 'Nom d\'un objet narratif libre (si absent du compendium) à ajouter à l\'inventaire.',
        },
        ajouterObjetPoids: {
          type: Type.NUMBER,
          description: 'Poids en lbs de l\'objet acquis (défaut 1).',
        },
        ajouterObjetValeurPO: {
          type: Type.INTEGER,
          description: 'Valeur en PO de l\'objet acquis (défaut 1).',
        },
        retirerObjetNom: {
          type: Type.STRING,
          description: 'Nom partiel d\'un objet consommé ou perdu à retirer.',
        },
        blessureType: {
          type: Type.STRING,
          description: 'Optionnel : ENTORSE, PLAIE_OUVERTE ou CONTUSION en cas de choc grave.',
        },
        resumeTechnique: {
          type: Type.STRING,
          description: 'Résumé technique sobre et concis des effets appliqués.',
        },
      },
      required: ['resumeTechnique'],
    },
  },
  {
    name: 'gerer_pnj_et_monde',
    description:
      'Met à jour un PNJ visible (disposition, humeur, secret, motivation, déplacement vers un hex, réplique directe), fait entrer un voyageur itinérant, enregistre une rumeur, gère promesses/quêtes/arcs narratifs/conséquences différées/notes secrètes MJ, ou déclenche un combat (mono ou escouade multi-ennemis).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        pnjId: {
          type: Type.STRING,
          description: 'ID d\'un PNJ actuellement dans le champ de vision à mettre à jour.',
        },
        nouvelleDisposition: {
          type: Type.STRING,
          description: 'AMICAL, NEUTRE ou MEFIANT.',
        },
        nouvelleHumeur: {
          type: Type.STRING,
          description: 'Courte description d\'humeur (ex: Soupçonneux, Reconnaissant).',
        },
        pnjSecret: {
          type: Type.STRING,
          description: 'Secret caché ou mobile inavoué mémorisé sur la fiche de ce PNJ.',
        },
        pnjMotivation: {
          type: Type.STRING,
          description: 'Objectif personnel actuel du PNJ.',
        },
        deplacerPnjHexId: {
          type: Type.STRING,
          description: 'ID d\'un hexagone existant vers lequel déplacer ce PNJ après la scène.',
        },
        sujetDialogue: {
          type: Type.STRING,
          description: 'Sujet résumé de l\'échange avec ce PNJ.',
        },
        repliquePnj: {
          type: Type.STRING,
          description: 'Réplique directe mémorable prononcée par le PNJ (1-2 phrases max).',
        },
        issueDialogue: {
          type: Type.STRING,
          description: 'Issue courte (ex: Accord conclu, Refus sec, Rumeur confiée).',
        },
        creerPnjItinerant: {
          type: Type.OBJECT,
          description: 'Fait entrer un PNJ itinérant dans le champ de vision (hors combat et donjon).',
          properties: {
            nom: { type: Type.STRING },
            role: { type: Type.STRING },
            disposition: { type: Type.STRING },
            motif: { type: Type.STRING },
            proposeCommerce: { type: Type.BOOLEAN },
            rumeurTitre: { type: Type.STRING },
            rumeurTexte: { type: Type.STRING },
          },
        },
        ajouterRumeur: {
          type: Type.OBJECT,
          properties: {
            titre: { type: Type.STRING },
            texte: { type: Type.STRING },
            source: { type: Type.STRING },
            veracite: {
              type: Type.BOOLEAN,
              description: 'Réalité cachée du monde (true/false), jamais révélée au joueur.',
            },
            statutPerception: {
              type: Type.STRING,
              description: 'INCERTAINE par défaut, ou CONFIRMEE / DEMENTIE uniquement si constaté sur place.',
            },
          },
        },
        queteAction: {
          type: Type.OBJECT,
          description:
            'Proposer une offre de PNJ (PROPOSER) ou enregistrer un accord déjà explicitement formulé par le joueur (CREER). Ne jamais forcer un engagement sans accord explicite du joueur.',
          properties: {
            action: {
              type: Type.STRING,
              description: 'PROPOSER | CREER | ACCOMPLIR | TRAHIR | EXPIRER | DECLINER.',
            },
            id: { type: Type.STRING, description: 'ID existant si mise à jour.' },
            titre: { type: Type.STRING },
            interlocuteur: { type: Type.STRING },
            echeanceJour: { type: Type.INTEGER },
            details: { type: Type.STRING },
          },
        },
        arcAction: {
          type: Type.OBJECT,
          description: 'Créer ou faire évoluer un arc narratif majeur de la campagne.',
          properties: {
            action: { type: Type.STRING, description: 'CREER, PROGRESSER, RESOUDRE ou ECHOUE.' },
            id: { type: Type.STRING },
            titre: { type: Type.STRING },
            progression: { type: Type.INTEGER, description: 'Progression de 0 à 100.' },
            resume: { type: Type.STRING },
            acteursLies: { type: Type.ARRAY, items: { type: Type.STRING } },
            prochaineEtape: { type: Type.STRING },
          },
        },
        consequenceAction: {
          type: Type.OBJECT,
          description: 'Enregistrer ou résoudre une conséquence différée déclenchée par les actes du joueur.',
          properties: {
            action: { type: Type.STRING, description: 'AJOUTER ou RESOUDRE.' },
            id: { type: Type.STRING },
            declencheur: { type: Type.STRING },
            effetPrevu: { type: Type.STRING },
          },
        },
        noteSecreteMJ: {
          type: Type.OBJECT,
          description: 'Consigne une note secrète en coulisses (plan d\'antagoniste, menace cachée, indice de campagne).',
          properties: {
            titre: { type: Type.STRING },
            contenu: { type: Type.STRING },
            categorie: { type: Type.STRING, description: 'INTRIGUE, PNJ, MONDE ou DONJON.' },
          },
        },
        declencherCombat: {
          type: Type.OBJECT,
          description: 'Déclenche un combat tactique contre un adversaire ou une escouade (ennemis[]). Privilégier monstreId SRD.',
          properties: {
            monstreId: { type: Type.STRING, description: 'ID officiel du bestiaire (ex: mon_loup, mon_araignee_geante, mon_orc, mon_bandit).' },
            nomEnnemi: { type: Type.STRING },
            typeEnnemi: { type: Type.STRING, description: 'GOBELIN, ZOMBIE ou BANDIT (si hors compendium).' },
            pv: { type: Type.INTEGER },
            ca: { type: Type.INTEGER },
            bonusAttaque: { type: Type.INTEGER },
            degatsDes: { type: Type.STRING, description: 'Ex: 1d6+2' },
            ennemis: {
              type: Type.ARRAY,
              description: 'Escouade multi-ennemis (jusqu\'à 5 combattants au total).',
              items: {
                type: Type.OBJECT,
                properties: {
                  monstreId: { type: Type.STRING },
                  nomEnnemi: { type: Type.STRING },
                  quantite: { type: Type.INTEGER },
                  distancePieds: { type: Type.INTEGER },
                  typeEnnemi: { type: Type.STRING },
                  pv: { type: Type.INTEGER },
                  ca: { type: Type.INTEGER },
                  bonusAttaque: { type: Type.INTEGER },
                  degatsDes: { type: Type.STRING },
                },
              },
            },
          },
        },
        factionId: {
          type: Type.STRING,
          description: 'ID de faction (faction_guilde_marchande, faction_iron_shield, faction_orcs) pour ajuster la réputation.',
        },
        reputationDelta: {
          type: Type.INTEGER,
          description: 'Variation de réputation envers la faction (-30 à +30).',
        },
      },
    },
  },
  {
    name: 'consulter_atlas_monde',
    description:
      'Interroge l\'atlas complet Azgaar (relief Voronoï, hydrographie, biomes, États, provinces, cultures, religions, bourgs/ports, marqueurs et itinéraires Dijkstra). Utiliser dès que le joueur demande un trajet, des renseignements politiques/religieux/maritimes ou scrute l\'atlas.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        mode: {
          type: Type.STRING,
          description:
            'Mode : apercu | inspecter_hex | itineraire | rechercher | etats_provinces | bourgs_ports | cultures_religions | marqueurs.',
        },
        hexIdOrNom: {
          type: Type.STRING,
          description: 'ID, nom partiel ou coordonnées "q,r" d\'un hexagone cible (défaut : hex actuel).',
        },
        departHexId: {
          type: Type.STRING,
          description: 'Pour itineraire : hex de départ (défaut : position du joueur).',
        },
        arriveeHexId: {
          type: Type.STRING,
          description: 'Pour itineraire : hex de destination (ID, nom ou "q,r").',
        },
        typeEntite: {
          type: Type.STRING,
          description: 'Pour itineraire : CARAVANE, PATROUILLE, MESSAGER ou RAIDER (influence la tolérance au danger).',
        },
        filtreBiome: {
          type: Type.STRING,
          description: 'Pour rechercher : filtre partiel sur terrain ou biome Azgaar (ex: Forêt, Montagne, Taïga, Côte).',
        },
        filtreNom: {
          type: Type.STRING,
          description: 'Pour bourgs_ports : filtre partiel sur le nom d\'un bourg ou port.',
        },
        stateId: {
          type: Type.INTEGER,
          description: 'Pour bourgs_ports : filtre optionnel par ID d\'État Azgaar.',
        },
        avecEau: {
          type: Type.BOOLEAN,
          description: 'Pour rechercher : true pour exiger une rivière ou source d\'eau douce.',
        },
        typePoi: {
          type: Type.STRING,
          description: 'Pour rechercher : bourgade, fort, mine, ruine ou camp.',
        },
        factionId: {
          type: Type.STRING,
          description: 'Pour rechercher : ID de faction contrôlant l\'hexagone.',
        },
      },
      required: ['mode'],
    },
  },
  {
    name: 'modifier_carte_monde',
    description:
      'Modifie et marque directement la carte Azgaar Voronoï et le secteur local : révéler un secteur, étendre la frontière, établir un lieu, modifier un hex, dépêcher une unité, régénérer le monde, placer/supprimer un marqueur (placer_marqueur / supprimer_marqueur), peindre relief/biomes/États/cultures/religions (peindre_cellules), créer/éditer un bourg (editer_bourg) ou tracer une route terrestre/maritime (tracer_route).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        operation: {
          type: Type.STRING,
          description:
            'reveler_secteur | etendre_frontiere | etablir_lieu | modifier_hex | depecher_unite | generer_monde | placer_marqueur | supprimer_marqueur | peindre_cellules | editer_bourg | tracer_route.',
        },
        hexId: {
          type: Type.STRING,
          description: 'ID, nom ou "q,r" de l\'hexagone cible (défaut : position actuelle).',
        },
        q: { type: Type.INTEGER, description: 'Pour etendre_frontiere : coordonnée axiale q.' },
        r: { type: Type.INTEGER, description: 'Pour etendre_frontiere : coordonnée axiale r.' },
        rayon: { type: Type.INTEGER, description: 'Pour reveler_secteur : rayon 1 ou 2 autour de hexId.' },
        nomLieu: { type: Type.STRING, description: 'Nom du lieu ou nouveau nom du bourg.' },
        typePoi: { type: Type.STRING, description: 'mine, fort, ruine, bourgade ou camp.' },
        statutPoi: { type: Type.STRING, description: 'OPERATIONNEL, RUINED, OCCUPIED ou ABANDONNE.' },
        routeNiveau: { type: Type.STRING, description: 'ROUTE, PISTE ou AUCUNE.' },
        factionControleId: { type: Type.STRING, description: 'ID de faction ou NEUTRE.' },
        pressionDelta: { type: Type.INTEGER, description: 'Variation de danger (-40 à +40).' },
        prosperiteDelta: { type: Type.INTEGER, description: 'Variation de prospérité (-30 à +30).' },
        annotation: { type: Type.STRING, description: 'Repère cartographique inscrit sur l\'hex.' },
        entiteType: { type: Type.STRING, description: 'Pour depecher_unite : CARAVANE, PATROUILLE, MESSAGER, RAIDER ou REFUGIES.' },
        entiteNom: { type: Type.STRING, description: 'Nom de l\'unité dépêchée.' },
        destinationHexId: { type: Type.STRING, description: 'Destination pour depecher_unite.' },
        modeleRelief: { type: Type.STRING, description: 'Pour generer_monde : continent, archipel, peninsule, mediterranee, detroit, volcan, haute_chaine, monts ou vallee.' },
        climatBias: { type: Type.STRING, description: 'Pour generer_monde : tempere, boreal ou aride.' },
        rayonAnneaux: { type: Type.INTEGER, description: 'Pour generer_monde : 2 (19 hex), 3 (37 hex) ou 4 (61 hex).' },
        seed: { type: Type.INTEGER, description: 'Pour generer_monde : graine numérique.' },
        nomMonde: { type: Type.STRING, description: 'Pour generer_monde : nom du monde.' },
        markerId: { type: Type.STRING, description: 'Pour supprimer_marqueur : ID du marqueur.' },
        markerIcon: { type: Type.STRING, description: 'Pour placer_marqueur : donjon, ruine, danger, port, camp, quete ou note.' },
        titre: { type: Type.STRING, description: 'Pour placer_marqueur / supprimer_marqueur : titre court.' },
        note: { type: Type.STRING, description: 'Pour placer_marqueur : légende ou note visible sur l\'atlas.' },
        x: { type: Type.NUMBER, description: 'Coordonnée X (0..1200) sur l\'atlas Azgaar.' },
        y: { type: Type.NUMBER, description: 'Coordonnée Y (0..760) sur l\'atlas Azgaar.' },
        rayonPx: { type: Type.NUMBER, description: 'Rayon en pixels pour peindre_cellules (20..120).' },
        biomeId: { type: Type.INTEGER, description: 'ID du biome (0..10) pour peindre_cellules.' },
        stateId: { type: Type.INTEGER, description: 'ID de l\'État Azgaar pour peindre_cellules ou editer_bourg.' },
        cultureId: { type: Type.INTEGER, description: 'ID de la culture Azgaar pour peindre_cellules.' },
        religionId: { type: Type.INTEGER, description: 'ID de la religion Azgaar pour peindre_cellules.' },
        heightDelta: { type: Type.INTEGER, description: 'Variation d\'altitude (-40..+40) pour peindre_cellules.' },
        bourgNom: { type: Type.STRING, description: 'Nom du bourg cible (editer_bourg, placer_marqueur, peindre_cellules ou départ de tracer_route).' },
        bourgDestNom: { type: Type.STRING, description: 'Nom du bourg de destination pour tracer_route.' },
        populationDelta: { type: Type.INTEGER, description: 'Variation de population pour editer_bourg.' },
        garnisonDelta: { type: Type.INTEGER, description: 'Variation de garnison pour editer_bourg.' },
        estPort: { type: Type.BOOLEAN, description: 'Pour editer_bourg : statut portuaire.' },
        aCitadelle: { type: Type.BOOLEAN, description: 'Pour editer_bourg : présence de citadelle.' },
        aMurailles: { type: Type.BOOLEAN, description: 'Pour editer_bourg : présence de murailles.' },
        aTemple: { type: Type.BOOLEAN, description: 'Pour editer_bourg : présence de temple.' },
        typeRoute: { type: Type.STRING, description: 'Pour tracer_route : road, trail ou sea.' },
      },
      required: ['operation'],
    },
  },
  {
    name: 'gerer_donjon',
    description:
      'Crée ou modifie dynamiquement un donjon nodal sur mesure (2 à 6 salles connectées, pièges avec DD/carac/dégâts, escouades SRD monstreIds, trésors) ou clôture un donjon.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        operation: {
          type: Type.STRING,
          description: 'CREER | MODIFIER_SALLE | SORTIR',
        },
        nomDonjon: {
          type: Type.STRING,
          description: 'Nom du lieu souterrain (ex: Crypte de Brume-Froid).',
        },
        salles: {
          type: Type.ARRAY,
          description: 'Pour CREER : 2 à 6 salles connectées. La première est l\'entrée.',
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              nom: { type: Type.STRING },
              description: { type: Type.STRING },
              danger: { type: Type.STRING, description: 'AUCUN, PIEGE, ENNEMI ou EFFONDREMENT.' },
              tresorPO: { type: Type.INTEGER },
              fouillable: { type: Type.BOOLEAN },
              connexions: { type: Type.ARRAY, items: { type: Type.STRING } },
              piegeDD: { type: Type.INTEGER },
              piegeCarac: { type: Type.STRING, description: 'FOR, DEX, CON, INT, SAG ou CHA.' },
              piegeDegats: { type: Type.STRING, description: 'Ex: 1d6+2' },
              piegeDesc: { type: Type.STRING },
              monstreIds: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
          },
        },
        salleId: { type: Type.STRING, description: 'Pour MODIFIER_SALLE : ID de la salle.' },
        description: { type: Type.STRING },
        danger: { type: Type.STRING },
        tresorPO: { type: Type.INTEGER },
        piegeDD: { type: Type.INTEGER },
        piegeCarac: { type: Type.STRING },
        piegeDegats: { type: Type.STRING },
        piegeDesc: { type: Type.STRING },
        monstreIds: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: ['operation'],
    },
  },
  {
    name: 'demander_jet_joueur',
    description:
      'Pose au joueur une demande de jet de sauvegarde ou de compétence interactive en ligne face à un péril soudain, une négociation critique ou un piège, avec enjeux explicites.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        titre: { type: Type.STRING, description: 'Titre bref du test (ex: Éviter la herse).' },
        caracteristique: { type: Type.STRING, description: 'FOR, DEX, CON, INT, SAG ou CHA.' },
        competence: { type: Type.STRING, description: 'Compétence optionnelle (ex: Acrobaties, Perception, Persuasion).' },
        dd: { type: Type.INTEGER, description: 'Degré de difficulté entre 5 et 25.' },
        typeJet: { type: Type.STRING, description: 'sauvegarde ou competence.' },
        contexte: { type: Type.STRING, description: 'Raison immédiate du jet.' },
        enjeuSucces: { type: Type.STRING, description: 'Effet bref en cas de réussite.' },
        enjeuEchec: { type: Type.STRING, description: 'Effet bref en cas d\'échec.' },
        optionAlternative: { type: Type.STRING, description: 'Option narrative sans dé si pertinente (ex: Reculer prudemment).' },
      },
      required: ['titre', 'caracteristique', 'dd', 'contexte', 'enjeuSucces', 'enjeuEchec'],
    },
  },
];

export interface GmToolExecutionContext {
  etat: SimulationState;
  actionOrigine: ActionRequest;
  adjudication?: AdjudicationPayload;
  evenementFactionTexte?: string;
  pnjApproche?: { id: string; nom: string; role: string; motif: string };
  moteurDejaExecute: boolean;
  appelsOutils: Array<{ nom: string; args: Record<string, any>; resultat: string }>;
  fichesSrdConsultees?: string[];
  notesSecretesTour?: string[];
}

export function assurerMemoireMJ(etat: SimulationState): void {
  if (!etat.memoireMJ) {
    etat.memoireMJ = {
      filNarratif: [],
      promessesEtQuetes: [],
      consequencesDifferees: [],
      chroniqueCondensee: '',
      arcsNarratifs: [],
      journalSecretMJ: [],
    };
  }
  if (!Array.isArray(etat.memoireMJ.filNarratif)) etat.memoireMJ.filNarratif = [];
  if (!Array.isArray(etat.memoireMJ.promessesEtQuetes)) etat.memoireMJ.promessesEtQuetes = [];
  if (!Array.isArray(etat.memoireMJ.consequencesDifferees)) etat.memoireMJ.consequencesDifferees = [];
  if (typeof etat.memoireMJ.chroniqueCondensee !== 'string') etat.memoireMJ.chroniqueCondensee = '';
  if (!Array.isArray(etat.memoireMJ.arcsNarratifs)) etat.memoireMJ.arcsNarratifs = [];
  if (!Array.isArray(etat.memoireMJ.journalSecretMJ)) etat.memoireMJ.journalSecretMJ = [];
}

function avancerHorlogeEtTick(etat: SimulationState, heures: number): string | undefined {
  return avancerTempsEtMonde(etat, heures);
}

export function executerOutilMJ(
  ctx: GmToolExecutionContext,
  nomOutil: string,
  args: Record<string, any>
): Record<string, any> {
  assurerMemoireMJ(ctx.etat);

  try {
    if (nomOutil === 'consulter_compendium_srd') {
      const cat = args.categorie as SrdCategory | 'tout' | undefined;
      const limite = Math.max(1, Math.min(12, Math.trunc(Number(args.limite) || 6)));
      const hits = rechercherCompendium({
        requete: args.requete ? String(args.requete) : undefined,
        idExact: args.idExact ? String(args.idExact) : undefined,
        categorie: cat && ['tout', 'monstre', 'objet', 'sort', 'regle', 'classe_race'].includes(cat) ? cat : 'tout',
        biome: args.biome ? String(args.biome) : undefined,
        fpMax: typeof args.fpMax === 'number' ? args.fpMax : undefined,
        limite,
      });

      if (!ctx.fichesSrdConsultees) ctx.fichesSrdConsultees = [];
      const fichesTexte = hits.map(h => {
        const label = `${h.entry.nom} (${h.entry.id})`;
        if (!ctx.fichesSrdConsultees!.includes(label)) {
          ctx.fichesSrdConsultees!.push(label);
        }
        return formaterFicheCompactePourIA(h.entry);
      });

      const resultatStr = `${hits.length} fiche(s) trouvée(s) : ${hits.map(h => h.entry.nom).join(', ') || 'aucune'}`;
      ctx.appelsOutils.push({ nom: nomOutil, args, resultat: resultatStr });

      return {
        succes: true,
        nombre: hits.length,
        fiches: fichesTexte,
      };
    }

    if (nomOutil === 'executer_action_moteur') {
      const actionAExecuter: ActionRequest = {
        ...ctx.actionOrigine,
        type: (args.actionTypeOverride as ActionRequest['type']) || ctx.actionOrigine.type,
        cibleId: args.cibleId ?? ctx.actionOrigine.cibleId,
        articleId: args.articleId ?? ctx.actionOrigine.articleId,
        quantite: args.quantite ?? ctx.actionOrigine.quantite,
        jobId: args.jobId ?? ctx.actionOrigine.jobId,
      };

      const res = orchestrerActionDeterministe(ctx.etat, actionAExecuter);
      ctx.etat = res.nouvelEtat;
      assurerMemoireMJ(ctx.etat);
      ctx.adjudication = res.adjudication;
      if (res.evenementFactionTexte) ctx.evenementFactionTexte = res.evenementFactionTexte;
      if (res.pnjApproche) ctx.pnjApproche = res.pnjApproche;
      ctx.moteurDejaExecute = true;

      const resultatStr = `${res.adjudication.issue}: ${res.adjudication.mutations_etat.descriptionTechnique}`;
      ctx.appelsOutils.push({ nom: nomOutil, args, resultat: resultatStr });

      return {
        succes: true,
        adjudication: res.adjudication,
        evenementFactionTexte: res.evenementFactionTexte || null,
        pnjApproche: res.pnjApproche || null,
        lieuActuel: ctx.etat.hexActuel.nom,
        pv: `${ctx.etat.personnage.pvActuels}/${ctx.etat.personnage.pvMax}`,
        combatActif: ctx.etat.combat.actif,
        donjonActif: Boolean(ctx.etat.donjon?.actif),
      };
    }

    if (nomOutil === 'lancer_test_competence') {
      const caracRaw = String(args.caracteristique || 'SAG').toUpperCase();
      const carac: Ability = (['FOR', 'DEX', 'CON', 'INT', 'SAG', 'CHA'].includes(caracRaw)
        ? caracRaw
        : 'SAG') as Ability;
      const competence = String(args.competence || 'Observation');
      const dd = Math.min(25, Math.max(5, Number(args.dd) || 12));
      const raison = String(args.raison || competence);

      const estMaitrise = ctx.etat.personnage.competencesMaitrisees.some(
        c => c.toLowerCase() === competence.toLowerCase()
      );
      const modBase = calculerModificateur(ctx.etat.personnage.caracteristiques[carac]);
      const mod = modBase + (estMaitrise ? ctx.etat.personnage.bonusMaitrise : 0);

      let modeJet: 'normal' | 'avantage' | 'desavantage' =
        args.modeJet === 'avantage' || args.modeJet === 'desavantage' ? args.modeJet : 'normal';
      if (ctx.etat.personnage.epuisement >= 1 && modeJet === 'normal') {
        modeJet = 'desavantage';
      } else if (ctx.etat.personnage.epuisement >= 1 && modeJet === 'avantage') {
        modeJet = 'normal';
      }

      const jet = lancerD20(modeJet);
      const total = jet.valeurRetenue + mod;
      let issue: AdjudicationPayload['issue'] = total >= dd ? 'SUCCESS' : 'FAILURE';
      if (jet.valeurRetenue === 20) issue = 'CRITICAL_SUCCESS';
      if (jet.valeurRetenue === 1) issue = 'CRITICAL_FAILURE';

      const desc = `Test ${competence} (${carac}) — ${raison} : ${
        issue === 'CRITICAL_SUCCESS'
          ? 'Succès critique (20)'
          : issue === 'CRITICAL_FAILURE'
          ? 'Échec critique (1)'
          : issue === 'SUCCESS'
          ? 'Succès'
          : 'Échec'
      } (${total} vs DD ${dd}).`;

      ctx.adjudication = {
        phase: 'adjudication_resolved',
        action_type: ctx.actionOrigine.type === 'DIALOGUER_PNJ' ? 'NPC_INTERACTION' : 'SKILL_CHECK',
        competenceOuCarac: `${competence} (${carac})`,
        dice_roll: jet.valeurRetenue,
        deuxieme_de: jet.de2,
        type_lancer: modeJet,
        modificateur: mod,
        score_total: total,
        cible_dd_ou_ca: dd,
        issue,
        mutations_etat: {
          descriptionTechnique: ctx.adjudication?.mutations_etat?.descriptionTechnique
            ? `${ctx.adjudication.mutations_etat.descriptionTechnique} | ${desc}`
            : desc,
        },
      };

      mettreAJourMemoire(ctx.etat.personnage, desc, ctx.etat.hexActuel, ctx.etat.horloge.meteo);
      ctx.appelsOutils.push({ nom: nomOutil, args, resultat: desc });

      return {
        succes: true,
        de: jet.valeurRetenue,
        modificateur: mod,
        total,
        dd,
        issue,
        description: desc,
      };
    }

    if (nomOutil === 'appliquer_consequence_scene') {
      const p = ctx.etat.personnage;
      const effets: string[] = [];

      // Monnaies (vérifier le solde global en PC avant toute déduction)
      const poDelta = Math.trunc(Number(args.poDelta) || 0);
      const paDelta = Math.trunc(Number(args.paDelta) || 0);
      const pcDelta = Math.trunc(Number(args.pcDelta) || 0);
      const deltaTotalPC = poDelta * 100 + paDelta * 10 + pcDelta;

      if (deltaTotalPC !== 0) {
        const soldeActuelPC = p.monnaies.po * 100 + p.monnaies.pa * 10 + p.monnaies.pc;
        if (soldeActuelPC + deltaTotalPC < 0) {
          const msg = `Fonds insuffisants (${(soldeActuelPC / 100).toFixed(2)} PO disponibles).`;
          ctx.appelsOutils.push({ nom: nomOutil, args, resultat: msg });
          return { succes: false, erreur: msg };
        }
        const nouveauSolde = soldeActuelPC + deltaTotalPC;
        p.monnaies.po = Math.floor(nouveauSolde / 100);
        p.monnaies.pa = Math.floor((nouveauSolde % 100) / 10);
        p.monnaies.pc = nouveauSolde % 10;
        effets.push(`${deltaTotalPC > 0 ? '+' : ''}${(deltaTotalPC / 100).toFixed(2)} PO`);
      }

      // PV bornés
      const pvDelta = Math.trunc(Number(args.pvDelta) || 0);
      if (pvDelta !== 0) {
        const avant = p.pvActuels;
        p.pvActuels = Math.max(0, Math.min(p.pvMax, p.pvActuels + pvDelta));
        if (p.pvActuels === 0 && !p.conditions.includes('Inconscient')) {
          p.conditions.push('Inconscient');
        } else if (p.pvActuels > 0) {
          p.conditions = p.conditions.filter(c => c !== 'Inconscient');
        }
        effets.push(`PV ${p.pvActuels - avant >= 0 ? '+' : ''}${p.pvActuels - avant} (${p.pvActuels}/${p.pvMax})`);
      }

      // Épuisement borné
      const epuisementDelta = Math.trunc(Number(args.epuisementDelta) || 0);
      if (epuisementDelta !== 0) {
        p.epuisement = Math.max(0, Math.min(6, p.epuisement + epuisementDelta));
        if (p.epuisement >= 6) {
          p.estMortDefinitivement = true;
        }
        effets.push(`Épuisement Niv ${p.epuisement}`);
      }

      // Rations & Eau bornées
      const rationsDelta = Math.trunc(Number(args.rationsDelta) || 0);
      if (rationsDelta !== 0) {
        p.rationsJours = Math.max(0, Math.min(p.rationsMaxJours, p.rationsJours + rationsDelta));
        effets.push(`Rations ${rationsDelta > 0 ? '+' : ''}${rationsDelta}j`);
      }

      const eauDelta = Number(args.eauDelta) || 0;
      if (eauDelta !== 0) {
        p.eauLitres = Number(Math.max(0, Math.min(p.eauMaxLitres, p.eauLitres + eauDelta)).toFixed(1));
        effets.push(`Eau ${eauDelta > 0 ? '+' : ''}${eauDelta}L`);
      }

      // XP
      const xpGagne = Math.max(0, Math.min(150, Math.trunc(Number(args.xpGagne) || 0)));
      if (xpGagne > 0) {
        p.experience += xpGagne;
        effets.push(`+${xpGagne} XP`);
      }

      // Inventaire (hydraté depuis le Compendium SRD si objetId fourni)
      if (args.objetId || args.ajouterObjetNom) {
        const ficheRef = args.objetId ? obtenirFicheSrd(String(args.objetId)) : obtenirFicheSrd(String(args.ajouterObjetNom));
        const itemRef: ItemEntry | undefined = ficheRef?.categorie === 'objet' ? ficheRef : undefined;
        const nomObj = itemRef ? itemRef.nom : String(args.ajouterObjetNom || args.objetId).slice(0, 60);
        if (itemRef) {
          if (!ctx.fichesSrdConsultees) ctx.fichesSrdConsultees = [];
          const label = `${itemRef.nom} (${itemRef.id})`;
          if (!ctx.fichesSrdConsultees.includes(label)) ctx.fichesSrdConsultees.push(label);
        }

        const existant = p.inventaire.find(
          i => (itemRef && i.compendiumId === itemRef.id) || i.nom.toLowerCase() === nomObj.toLowerCase()
        );
        if (existant) {
          existant.quantite += 1;
        } else {
          p.inventaire.push({
            id: itemRef ? `${itemRef.id}_${Date.now()}` : `item_mj_${Date.now()}_${Math.floor(Math.random() * 100)}`,
            compendiumId: itemRef?.id,
            nom: nomObj,
            poidsLbs: itemRef ? itemRef.poidsLbs : Math.max(0.5, Number(args.ajouterObjetPoids) || 1),
            valeurPO: itemRef ? Number((itemRef.valeurPC / 100).toFixed(2)) : Math.max(0, Math.trunc(Number(args.ajouterObjetValeurPO) || 1)),
            quantite: 1,
            degats: itemRef?.degats,
            typeDegats: itemRef?.typeDegats,
            proprietesArme: itemRef?.proprietesArme,
            caBase: itemRef?.caBase,
            categorie: itemRef?.sousCategorie,
          });
        }
        effets.push(`+${nomObj}`);
      }

      if (args.retirerObjetNom) {
        const cherche = String(args.retirerObjetNom).toLowerCase();
        const idx = p.inventaire.findIndex(i => i.nom.toLowerCase().includes(cherche));
        if (idx >= 0) {
          const obj = p.inventaire[idx];
          if (obj.quantite > 1) {
            obj.quantite -= 1;
          } else {
            p.inventaire.splice(idx, 1);
          }
          effets.push(`-${obj.nom}`);
        }
      }

      // Blessure persistante
      if (
        args.blessureType === 'ENTORSE' ||
        args.blessureType === 'PLAIE_OUVERTE' ||
        args.blessureType === 'CONTUSION'
      ) {
        const bl = infligerBlessurePersistante(p, args.blessureType);
        ctx.etat.personnage = bl.personnageModifie;
        effets.push(`Blessure : ${bl.blessure.nom}`);
      }

      // Temps écoulé
      const heures = Math.max(0, Math.min(8, Math.trunc(Number(args.heuresEcoulees) || 0)));
      if (heures > 0) {
        const evtFac = avancerHorlogeEtTick(ctx.etat, heures);
        if (evtFac) ctx.evenementFactionTexte = evtFac;
        effets.push(`+${heures}h`);
      }

      const resume = String(args.resumeTechnique || effets.join(' · ') || 'Scène résolue.');
      if (!ctx.adjudication) {
        ctx.adjudication = {
          phase: 'adjudication_resolved',
          action_type: 'SKILL_CHECK',
          competenceOuCarac: 'Arbitrage MJ',
          dice_roll: 10,
          modificateur: 0,
          score_total: 10,
          cible_dd_ou_ca: 0,
          issue: 'SUCCESS',
          mutations_etat: {
            pvDelta: pvDelta || undefined,
            epuisementDelta: epuisementDelta || undefined,
            rationsDelta: rationsDelta || undefined,
            eauDelta: eauDelta || undefined,
            heuresEcoulees: heures || undefined,
            objetObtenu: args.ajouterObjetNom ? String(args.ajouterObjetNom) : undefined,
            objetPerdu: args.retirerObjetNom ? String(args.retirerObjetNom) : undefined,
            descriptionTechnique: resume,
          },
        };
      } else {
        ctx.adjudication.mutations_etat.descriptionTechnique += ` | ${resume}`;
      }

      mettreAJourMemoire(ctx.etat.personnage, resume, ctx.etat.hexActuel, ctx.etat.horloge.meteo);
      ctx.appelsOutils.push({ nom: nomOutil, args, resultat: resume });

      return { succes: true, effetsAppliques: effets, resume };
    }

    if (nomOutil === 'gerer_pnj_et_monde') {
      const notes: string[] = [];
      const ctxLieu = evaluerContexteLieu(ctx.etat);

      // 1. Mise à jour d'un PNJ en vue
      if (args.pnjId) {
        const pnjId = String(args.pnjId);
        if (!estPnjEnVue(ctx.etat, pnjId)) {
          const err = `Refus : le PNJ ${pnjId} n'est pas dans le champ de vision actuel (${ctx.etat.hexActuel.nom}).`;
          ctx.appelsOutils.push({ nom: nomOutil, args, resultat: err });
          return { succes: false, erreur: err };
        }
        const pnj = ctx.etat.grapheNoeuds.find(n => n.id === pnjId)!;
        if (!pnj.proprietes) pnj.proprietes = {};
        if (args.nouvelleDisposition === 'AMICAL' || args.nouvelleDisposition === 'NEUTRE' || args.nouvelleDisposition === 'MEFIANT') {
          pnj.proprietes.disposition = args.nouvelleDisposition;
        }
        if (args.nouvelleHumeur) {
          pnj.proprietes.humeur = String(args.nouvelleHumeur).slice(0, 60);
        }
        if (args.pnjSecret) {
          pnj.proprietes.secret = String(args.pnjSecret).slice(0, 220);
          notes.push(`Secret mémorisé pour ${pnj.label}`);
        }
        if (args.pnjMotivation) {
          pnj.proprietes.motivation = String(args.pnjMotivation).slice(0, 180);
          notes.push(`Mobile mis à jour pour ${pnj.label}`);
        }
        if (args.deplacerPnjHexId) {
          const destHex = ctx.etat.hexagones.find(h => h.id === String(args.deplacerPnjHexId) && !h.estEau);
          if (destHex) {
            pnj.proprietes.hexId = destHex.id;
            ctx.etat.grapheLiens = ctx.etat.grapheLiens.filter(
              l => !(l.source === pnj.id && l.relation === 'LOCATED_IN')
            );
            ctx.etat.grapheLiens.push({
              source: pnj.id,
              cible: destHex.id,
              relation: 'LOCATED_IN',
              horodatageTick: ctx.etat.horloge.tick,
            });
            notes.push(`${pnj.label} part vers ${destHex.nom}`);
          }
        }
        if (args.repliquePnj || args.sujetDialogue || args.issueDialogue) {
          if (!pnj.proprietes.historiqueDialogue) pnj.proprietes.historiqueDialogue = [];
          pnj.proprietes.historiqueDialogue.unshift({
            date: `Jour ${ctx.etat.horloge.jour}, ${String(ctx.etat.horloge.heure).padStart(2, '0')}:00`,
            sujet: String(args.sujetDialogue || ctx.actionOrigine.sujetDialogue || 'Échange').slice(0, 80),
            issue: String(args.issueDialogue || 'Échange acté').slice(0, 50),
            repliquePnj: args.repliquePnj
              ? String(args.repliquePnj).replace(/^[«"\s]+|[»"\s]+$/g, '').slice(0, 220)
              : undefined,
          });
          pnj.proprietes.historiqueDialogue = pnj.proprietes.historiqueDialogue.slice(0, 6);
        }
        notes.push(`PNJ ${pnj.label} mis à jour (${pnj.proprietes.disposition || 'NEUTRE'})`);
      }

      // 2. Entrée d'un PNJ itinérant
      if (args.creerPnjItinerant && args.creerPnjItinerant.nom) {
        if (ctx.etat.combat.actif || ctx.etat.donjon?.actif) {
          notes.push('Rencontre itinérante ignorée (combat ou donjon actif)');
        } else if (!ctxLieu.pnjsEnVue.some(p => p.proprietes?.estItinerant)) {
          const spec = args.creerPnjItinerant;
          const pnjCree = ajouterPnjItinerant(ctx.etat, {
            nom: String(spec.nom).slice(0, 40),
            role: String(spec.role || 'Voyageur').slice(0, 50),
            disposition:
              spec.disposition === 'AMICAL' || spec.disposition === 'MEFIANT' ? spec.disposition : 'NEUTRE',
            motif: String(spec.motif || 'Entre dans votre champ de vision.').slice(0, 120),
            proposeCommerce: Boolean(spec.proposeCommerce),
            rumeur:
              spec.rumeurTitre && spec.rumeurTexte
                ? { titre: String(spec.rumeurTitre).slice(0, 60), texte: String(spec.rumeurTexte).slice(0, 180) }
                : undefined,
          });
          ctx.pnjApproche = {
            id: pnjCree.id,
            nom: pnjCree.label,
            role: pnjCree.proprietes?.profession || 'Voyageur',
            motif: pnjCree.proprietes?.motifRencontre || 'Entre dans votre champ de vision.',
          };
          notes.push(`Rencontre ajoutée : ${pnjCree.label}`);
        }
      }

      // 3. Rumeur
      if (args.ajouterRumeur && args.ajouterRumeur.titre && args.ajouterRumeur.texte) {
        if (!ctx.etat.rumeurs) ctx.etat.rumeurs = [];
        const titre = String(args.ajouterRumeur.titre).slice(0, 70);
        const statutPercRaw = String(args.ajouterRumeur.statutPerception || 'INCERTAINE').toUpperCase();
        const statutPerception =
          statutPercRaw === 'CONFIRMEE' || statutPercRaw === 'DEMENTIE' ? statutPercRaw : 'INCERTAINE';
        const existante = ctx.etat.rumeurs.find(r => r.titre.toLowerCase() === titre.toLowerCase());
        if (!existante) {
          ctx.etat.rumeurs.unshift({
            id: `rumor_mj_${Date.now()}`,
            titre,
            texte: String(args.ajouterRumeur.texte).slice(0, 220),
            source: String(args.ajouterRumeur.source || 'Rumeur locale').slice(0, 50),
            veracite: args.ajouterRumeur.veracite !== false,
            tickEmission: ctx.etat.horloge.tick,
            statutPerception,
            lieuObtention: ctx.etat.hexActuel.nom,
          });
          notes.push(`Rumeur enregistrée : ${titre} (${statutPerception})`);
        } else if (statutPerception !== 'INCERTAINE') {
          existante.statutPerception = statutPerception;
          notes.push(`Rumeur mise à jour côté perception : ${titre} (${statutPerception})`);
        }
      }

      // 4. Promesses, Propositions & Quêtes
      if (args.queteAction && (args.queteAction.titre || args.queteAction.id)) {
        const qa = args.queteAction;
        const mem = ctx.etat.memoireMJ!;
        const actRaw = String(qa.action || 'PROPOSER').toUpperCase();

        if (actRaw === 'PROPOSER' || actRaw === 'CREER') {
          const titreClean = String(qa.titre || 'Offre').slice(0, 70);
          const consentement = actRaw === 'CREER' && actionExprimeConsentementQuete(ctx.actionOrigine);
          const statutFinal: 'PROPOSEE' | 'EN_COURS' = consentement ? 'EN_COURS' : 'PROPOSEE';
          const exist = mem.promessesEtQuetes.find(
            q =>
              q.titre.toLowerCase() === titreClean.toLowerCase() &&
              (q.statut === 'EN_COURS' || q.statut === 'PROPOSEE')
          );
          if (!exist) {
            mem.promessesEtQuetes.unshift({
              id: qa.id || `q_${Date.now()}`,
              titre: titreClean,
              interlocuteur: String(qa.interlocuteur || 'Interlocuteur').slice(0, 40),
              statut: statutFinal,
              echeanceJour: qa.echeanceJour ? Number(qa.echeanceJour) : undefined,
              details: String(qa.details || '').slice(0, 160),
            });
            mem.promessesEtQuetes = mem.promessesEtQuetes.slice(0, 10);
            if (actRaw === 'CREER' && !consentement) {
              notes.push(`Offre « ${titreClean} » convertie en proposition (accord explicite requis)`);
            } else {
              notes.push(
                statutFinal === 'PROPOSEE'
                  ? `Proposition enregistrée : ${titreClean}`
                  : `Engagement créé : ${titreClean}`
              );
            }
          } else if (consentement && exist.statut === 'PROPOSEE') {
            exist.statut = 'EN_COURS';
            notes.push(`Proposition acceptée : ${exist.titre}`);
          }
        } else if (
          actRaw === 'ACCOMPLIR' ||
          actRaw === 'TRAHIR' ||
          actRaw === 'EXPIRER' ||
          actRaw === 'DECLINER' ||
          actRaw === 'REFUSER'
        ) {
          const cible = mem.promessesEtQuetes.find(
            q =>
              (qa.id && q.id === qa.id) ||
              (qa.titre && q.titre.toLowerCase().includes(String(qa.titre).toLowerCase()))
          );
          if (cible) {
            cible.statut =
              actRaw === 'ACCOMPLIR'
                ? 'ACCOMPLIE'
                : actRaw === 'TRAHIR'
                ? 'TRAHIE'
                : actRaw === 'EXPIRER'
                ? 'EXPIREE'
                : 'DECLINEE';
            if (qa.details) cible.details = String(qa.details).slice(0, 160);
            notes.push(`Engagement ${cible.statut.toLowerCase()} : ${cible.titre}`);
          }
        }
      }

      // 5. Conséquences différées
      if (args.consequenceAction && args.consequenceAction.declencheur) {
        const ca = args.consequenceAction;
        const mem = ctx.etat.memoireMJ!;
        if (ca.action === 'AJOUTER') {
          mem.consequencesDifferees.unshift({
            id: ca.id || `cons_${Date.now()}`,
            declencheur: String(ca.declencheur).slice(0, 100),
            effetPrevu: String(ca.effetPrevu || '').slice(0, 160),
            actif: true,
          });
          mem.consequencesDifferees = mem.consequencesDifferees.slice(0, 8);
          notes.push(`Conséquence latente notée : ${ca.declencheur}`);
        } else if (ca.action === 'RESOUDRE') {
          const cible = mem.consequencesDifferees.find(
            c =>
              (ca.id && c.id === ca.id) ||
              c.declencheur.toLowerCase().includes(String(ca.declencheur).toLowerCase())
          );
          if (cible) {
            cible.actif = false;
            notes.push(`Conséquence déclenchée/résolue : ${cible.declencheur}`);
          }
        }
      }

      // 5b. Arcs narratifs durables
      if (args.arcAction && (args.arcAction.titre || args.arcAction.id)) {
        const aa = args.arcAction;
        const mem = ctx.etat.memoireMJ!;
        if (!Array.isArray(mem.arcsNarratifs)) mem.arcsNarratifs = [];
        const existant = mem.arcsNarratifs.find(
          a =>
            (aa.id && a.id === aa.id) ||
            (aa.titre && a.titre.toLowerCase() === String(aa.titre).toLowerCase())
        );
        if (aa.action === 'CREER' && !existant && aa.titre) {
          mem.arcsNarratifs.unshift({
            id: aa.id || `arc_${Date.now()}`,
            titre: String(aa.titre).slice(0, 70),
            statut: 'ACTIF',
            progression: Math.max(0, Math.min(100, Math.trunc(Number(aa.progression) || 10))),
            resume: String(aa.resume || '').slice(0, 220),
            acteursLies: Array.isArray(aa.acteursLies) ? aa.acteursLies.map(String).slice(0, 6) : undefined,
            prochaineEtape: aa.prochaineEtape ? String(aa.prochaineEtape).slice(0, 140) : undefined,
            derniereMajJour: ctx.etat.horloge.jour,
          });
          mem.arcsNarratifs = mem.arcsNarratifs.slice(0, 8);
          notes.push(`Arc créé : ${aa.titre}`);
        } else if (existant) {
          if (aa.action === 'RESOUDRE') {
            existant.statut = 'RESOLU';
            existant.progression = 100;
          } else if (aa.action === 'ECHOUE') {
            existant.statut = 'ECHOUE';
          } else if (typeof aa.progression === 'number') {
            existant.progression = Math.max(0, Math.min(100, Math.trunc(aa.progression)));
          }
          if (aa.resume) existant.resume = String(aa.resume).slice(0, 220);
          if (aa.prochaineEtape) existant.prochaineEtape = String(aa.prochaineEtape).slice(0, 140);
          existant.derniereMajJour = ctx.etat.horloge.jour;
          notes.push(`Arc mis à jour : ${existant.titre} (${existant.progression}%)`);
        }
      }

      // 5c. Notes secrètes du MJ (coulisses)
      if (args.noteSecreteMJ && args.noteSecreteMJ.contenu) {
        const ns = args.noteSecreteMJ;
        const mem = ctx.etat.memoireMJ!;
        if (!Array.isArray(mem.journalSecretMJ)) mem.journalSecretMJ = [];
        const cat = (['INTRIGUE', 'PNJ', 'MONDE', 'DONJON'].includes(String(ns.categorie || ''))
          ? String(ns.categorie)
          : 'INTRIGUE') as 'INTRIGUE' | 'PNJ' | 'MONDE' | 'DONJON';
        const titreNote = String(ns.titre || 'Coulisse').slice(0, 70);
        const contenuNote = String(ns.contenu).slice(0, 260);
        mem.journalSecretMJ.unshift({
          id: `sec_${Date.now()}_${Math.floor(Math.random() * 100)}`,
          jour: ctx.etat.horloge.jour,
          titre: titreNote,
          contenu: contenuNote,
          categorie: cat,
        });
        mem.journalSecretMJ = mem.journalSecretMJ.slice(0, 30);
        if (!ctx.notesSecretesTour) ctx.notesSecretesTour = [];
        ctx.notesSecretesTour.push(`[${cat}] ${titreNote} : ${contenuNote}`);
        notes.push(`Note secrète consignée : ${titreNote}`);
      }

      // 6. Combat déclenché par la scène (mono ou escouade multi-ennemis SRD)
      if (
        args.declencherCombat &&
        (Array.isArray(args.declencherCombat.ennemis) ||
          args.declencherCombat.monstreId ||
          args.declencherCombat.nomEnnemi) &&
        !ctx.etat.combat.actif
      ) {
        const dc = args.declencherCombat;
        const specsBruts: Array<Record<string, any>> =
          Array.isArray(dc.ennemis) && dc.ennemis.length > 0 ? dc.ennemis : [dc];
        const combattants: Combatant[] = [];
        let indexMob = 0;

        for (const spec of specsBruts) {
          const qte = Math.max(1, Math.min(5 - combattants.length, Math.trunc(Number(spec.quantite) || 1)));
          for (let q = 0; q < qte && combattants.length < 5; q += 1) {
            indexMob += 1;
            const cleRecherche = spec.monstreId ? String(spec.monstreId) : String(spec.nomEnnemi || '');
            const ficheMonstre = cleRecherche ? obtenirFicheSrd(cleRecherche) : undefined;
            const monstreSrd: MonsterEntry | undefined =
              ficheMonstre?.categorie === 'monstre' ? ficheMonstre : undefined;
            const distCustom =
              typeof spec.distancePieds === 'number'
                ? Math.max(5, Math.min(90, Math.trunc(spec.distancePieds)))
                : undefined;

            let ennemi: Combatant;
            if (monstreSrd) {
              ennemi = creerCombatantDepuisMonstre(monstreSrd, `mj_${Date.now()}_${indexMob}`);
              if (spec.nomEnnemi && spec.monstreId) {
                ennemi.nom = String(spec.nomEnnemi).slice(0, 45);
              }
              if (qte > 1) {
                ennemi.nom = `${ennemi.nom} #${q + 1}`;
              }
              if (distCustom !== undefined) ennemi.distancePieds = distCustom;
              if (!ctx.fichesSrdConsultees) ctx.fichesSrdConsultees = [];
              const label = `${monstreSrd.nom} (${monstreSrd.id})`;
              if (!ctx.fichesSrdConsultees.includes(label)) ctx.fichesSrdConsultees.push(label);
            } else {
              const typeE: Combatant['type'] =
                spec.typeEnnemi === 'GOBELIN' || spec.typeEnnemi === 'ZOMBIE' ? spec.typeEnnemi : 'BANDIT';
              const pv = Math.max(4, Math.min(120, Math.trunc(Number(spec.pv) || 11)));
              const ca = Math.max(8, Math.min(22, Math.trunc(Number(spec.ca) || 12)));
              const baseNom = String(spec.nomEnnemi || 'Adversaire').slice(0, 40);
              ennemi = {
                id: `mob_mj_${Date.now()}_${indexMob}`,
                nom: qte > 1 ? `${baseNom} #${q + 1}` : baseNom,
                type: typeE,
                pv,
                pvMax: pv,
                ca,
                initiative: 0,
                distancePieds: distCustom ?? 20,
                statut: 'ACTIF',
                bonusAttaque: Math.max(1, Math.min(12, Math.trunc(Number(spec.bonusAttaque) || 3))),
                degatsDes: String(spec.degatsDes || '1d6+1').slice(0, 12),
                comportement:
                  typeE === 'GOBELIN'
                    ? 'RUSE_ET_FUITE'
                    : typeE === 'ZOMBIE'
                    ? 'AVEUGLE_CORPS_A_CORPS'
                    : 'TACTIQUE_COORDINATION',
              };
            }
            combattants.push(ennemi);
          }
        }

        if (combattants.length > 0) {
          const initCombat = initialiserCombat(ctx.etat.personnage, combattants);
          const tourInit = resoudreToursJusquaJoueur(ctx.etat.personnage, initCombat, { estDebutCombat: true });
          ctx.etat.combat = tourInit.combatModifie;
          ctx.etat.personnage = tourInit.personnageModifie;
          notes.push(
            `Combat engagé (${combattants.length}) : ${combattants
              .map(e => `${e.nom} (${e.pv} PV, CA ${e.ca}${e.fp ? `, FP ${e.fp}` : ''})`)
              .join(', ')}`
          );
        }
      }

      // 7. Réputation faction
      if (args.factionId && typeof args.reputationDelta === 'number') {
        const fId = String(args.factionId);
        const faction = ctx.etat.factions.find(f => f.id === fId);
        if (faction) {
          const delta = Math.max(-30, Math.min(30, Math.trunc(args.reputationDelta)));
          const repAct = ctx.etat.personnage.reputationFactions[fId] || 0;
          const nouvRep = Math.max(-100, Math.min(100, repAct + delta));
          ctx.etat.personnage.reputationFactions[fId] = nouvRep;
          faction.relationsJoueur = nouvRep <= -30 ? 'HOSTILE' : nouvRep >= 30 ? 'ALLIE' : 'NEUTRE';
          notes.push(`Réputation ${faction.nom} : ${nouvRep} (${faction.relationsJoueur})`);
        }
      }

      const resultatStr = notes.join(' | ') || 'Aucune modification monde.';
      ctx.appelsOutils.push({ nom: nomOutil, args, resultat: resultatStr });
      return { succes: true, modifications: notes };
    }

    if (nomOutil === 'consulter_atlas_monde') {
      const etat = ctx.etat;
      const meta = extraireMetadataAzgaarDepuisEtat(etat);
      const mode = String(args.mode || 'apercu');

      const resoudreHex = (ref?: string): HexNode | undefined => {
        if (!ref) return etat.hexActuel;
        const clean = String(ref).trim();
        const exact = etat.hexagones.find(h => h.id === clean);
        if (exact) return exact;
        const coordMatch = clean.match(/^(-?\d+)\s*[,;]\s*(-?\d+)$/);
        if (coordMatch) {
          const cq = Number(coordMatch[1]);
          const cr = Number(coordMatch[2]);
          const byCoord = etat.hexagones.find(h => h.q === cq && h.r === cr);
          if (byCoord) return byCoord;
        }
        const low = clean.toLowerCase();
        return etat.hexagones.find(
          h =>
            h.nom.toLowerCase().includes(low) ||
            (h.pointInteret?.nom && h.pointInteret.nom.toLowerCase().includes(low))
        );
      };

      const trouverFrontieresVides = (centre: HexNode): Array<{ q: number; r: number }> => {
        const dirs = [
          { dq: 1, dr: 0 },
          { dq: 1, dr: -1 },
          { dq: 0, dr: -1 },
          { dq: -1, dr: 0 },
          { dq: -1, dr: 1 },
          { dq: 0, dr: 1 },
        ];
        return dirs
          .map(d => ({ q: centre.q + d.dq, r: centre.r + d.dr }))
          .filter(c => !etat.hexagones.some(h => h.q === c.q && h.r === c.r));
      };

      if (mode === 'apercu') {
        const terres = etat.hexagones.filter(h => !h.estEau);
        const eaux = etat.hexagones.filter(h => h.estEau);
        const sites = terres
          .filter(h => h.pointInteret)
          .map(h => ({
            id: h.id,
            nom: h.nom,
            type: h.pointInteret!.type,
            coords: [h.q, h.r],
            distanceHex: calculerDistanceHex(etat.hexActuel, h),
            controle: h.factionControleId || 'Neutre',
            brouillard: h.brouillard,
            decouvertParJoueur: hexEstDecouvert(h, etat.hexActuel.id),
          }));
        const resume = `Atlas ${meta.nomMonde} (#${meta.seed}, ${meta.modeleRelief}) : ${terres.length} terres, ${eaux.length} mers, ${meta.rivieres.length} rivières.`;
        ctx.appelsOutils.push({ nom: nomOutil, args, resultat: resume });
        return {
          succes: true,
          monde: {
            nom: meta.nomMonde,
            seed: meta.seed,
            modeleRelief: meta.modeleRelief,
            climatBias: meta.climatBias,
            terres: terres.length,
            mers: eaux.length,
          },
          rivieres: meta.rivieres.map(r => ({
            nom: r.nom,
            debit: r.debit,
            hexagones: r.hexIds.map(id => etat.hexagones.find(h => h.id === id)?.nom || id),
          })),
          cultures: meta.cultures.map(c => c.nom),
          sites,
          frontieresVidesAutourJoueur: trouverFrontieresVides(etat.hexActuel),
        };
      }

      if (mode === 'inspecter_hex') {
        const hex = resoudreHex(args.hexIdOrNom ? String(args.hexIdOrNom) : undefined);
        if (!hex) {
          const err = `Hexagone introuvable : ${args.hexIdOrNom}`;
          ctx.appelsOutils.push({ nom: nomOutil, args, resultat: err });
          return { succes: false, erreur: err };
        }
        const voisins = etat.hexagones
          .filter(v => calculerDistanceHex(hex, v) === 1)
          .map(v => ({
            id: v.id,
            nom: v.nom,
            coords: [v.q, v.r],
            terrain: v.estEau ? 'Mer' : v.terrain,
            estEau: Boolean(v.estEau),
            route: v.routeNiveau || 'AUCUNE',
            securite: v.securite,
          }));
        const entites = (etat.entitesMonde || [])
          .filter(e => e.statut === 'EN_ROUTE' && e.hexId === hex.id)
          .map(e => `${e.nom} (${e.type})`);
        const resume = `Inspection ${hex.nom} [${hex.q},${hex.r}] : ${hex.estEau ? 'Mer' : hex.biomeAzgaar || hex.terrain}, Alt ${hex.altitude ?? 25}m, Flux ${hex.fluxHydro ?? 0}%.`;
        ctx.appelsOutils.push({ nom: nomOutil, args, resultat: resume });
        return {
          succes: true,
          decouvertParJoueur: hexEstDecouvert(hex, etat.hexActuel.id),
          hex: {
            id: hex.id,
            nom: hex.nom,
            coords: [hex.q, hex.r],
            distanceJoueur: calculerDistanceHex(etat.hexActuel, hex),
            estEau: Boolean(hex.estEau),
            estRivage: Boolean(hex.estRivage),
            terrain: hex.terrain,
            biomeAzgaar: hex.biomeAzgaar || hex.terrain,
            altitude: hex.altitude ?? 25,
            temperatureC: hex.temperatureC ?? 12,
            precipitations: hex.precipitations ?? 45,
            fluxHydro: hex.fluxHydro ?? 15,
            bassinHydroId: hex.bassinHydroId || null,
            population: hex.population ?? 60,
            culture: hex.culture || 'Locale',
            garnison: hex.garnison ?? 10,
            routeNiveau: hex.routeNiveau || 'AUCUNE',
            securite: hex.securite,
            pressionDanger: hex.pressionDanger ?? 30,
            factionControleId: hex.factionControleId,
            pointInteret: hex.pointInteret || null,
            brouillard: hex.brouillard,
          },
          voisins,
          entites,
          frontieresVidesAdjacentes: trouverFrontieresVides(hex),
        };
      }

      if (mode === 'itineraire') {
        const depart = resoudreHex(args.departHexId ? String(args.departHexId) : undefined) || etat.hexActuel;
        const arrivee = resoudreHex(args.arriveeHexId ? String(args.arriveeHexId) : args.hexIdOrNom ? String(args.hexIdOrNom) : undefined);
        if (!arrivee) {
          const err = 'Destination introuvable dans l\'atlas.';
          ctx.appelsOutils.push({ nom: nomOutil, args, resultat: err });
          return { succes: false, erreur: err };
        }
        if (arrivee.estEau) {
          const err = `${arrivee.nom} est une case maritime inaccessible à pied.`;
          ctx.appelsOutils.push({ nom: nomOutil, args, resultat: err });
          return { succes: false, erreur: err };
        }
        const typeEnt = (['CARAVANE', 'PATROUILLE', 'RAIDER', 'MESSAGER', 'REFUGIES'].includes(
          String(args.typeEntite || '')
        )
          ? String(args.typeEntite)
          : 'CARAVANE') as WorldEntityType;
        const route = calculerItinerairePondere(depart.id, arrivee.id, etat.hexagones, typeEnt);
        if (route.coutTotal >= 900 || route.chemin[route.chemin.length - 1] !== arrivee.id) {
          const err = `Aucune route terrestre continue entre ${depart.nom} et ${arrivee.nom}.`;
          ctx.appelsOutils.push({ nom: nomOutil, args, resultat: err });
          return { succes: false, erreur: err };
        }
        const etapes = route.chemin.map(id => {
          const h = etat.hexagones.find(x => x.id === id)!;
          return {
            id: h.id,
            nom: h.nom,
            terrain: h.terrain,
            route: h.routeNiveau || 'AUCUNE',
            securite: h.securite,
            fluxHydro: h.fluxHydro ?? 15,
          };
        });
        const heuresEstimees = Math.max(0, (etapes.length - 1) * 3);
        const resume = `Itinéraire ${depart.nom} → ${arrivee.nom} : ${etapes.length - 1} étape(s), coût ${route.coutTotal}, ~${heuresEstimees}h.`;
        ctx.appelsOutils.push({ nom: nomOutil, args, resultat: resume });
        return {
          succes: true,
          depart: depart.nom,
          arrivee: arrivee.nom,
          nombreEtapes: etapes.length - 1,
          coutPondereDijkstra: route.coutTotal,
          heuresMarcheEstimees: heuresEstimees,
          etapes,
        };
      }

      if (mode === 'rechercher') {
        const filtreBiome = args.filtreBiome ? String(args.filtreBiome).toLowerCase() : '';
        const typePoi = args.typePoi ? String(args.typePoi).toLowerCase() : '';
        const factionId = args.factionId ? String(args.factionId) : '';
        const avecEau = typeof args.avecEau === 'boolean' ? args.avecEau : undefined;

        const matches = etat.hexagones
          .filter(h => !h.estEau)
          .filter(h => {
            if (filtreBiome) {
              const t = `${h.terrain} ${h.biomeAzgaar || ''}`.toLowerCase();
              if (!t.includes(filtreBiome)) return false;
            }
            if (typePoi && h.pointInteret?.type !== typePoi) return false;
            if (factionId && h.factionControleId !== factionId) return false;
            if (avecEau === true && !h.ressourcesEau && (h.fluxHydro ?? 0) < 25) return false;
            return true;
          })
          .sort((a, b) => calculerDistanceHex(etat.hexActuel, a) - calculerDistanceHex(etat.hexActuel, b))
          .slice(0, 8)
          .map(h => ({
            id: h.id,
            nom: h.nom,
            coords: [h.q, h.r],
            distanceHex: calculerDistanceHex(etat.hexActuel, h),
            terrain: h.terrain,
            biomeAzgaar: h.biomeAzgaar || h.terrain,
            securite: h.securite,
            pointInteret: h.pointInteret?.nom || null,
            factionControleId: h.factionControleId,
            brouillard: h.brouillard,
            decouvertParJoueur: hexEstDecouvert(h, etat.hexActuel.id),
          }));
        const resume = `Recherche atlas : ${matches.length} secteur(s) trouvé(s).`;
        ctx.appelsOutils.push({ nom: nomOutil, args, resultat: resume });
        return { succes: true, nombre: matches.length, resultats: matches };
      }

      if (mode === 'etats_provinces') {
        const studio = etat.azgaarStudio;
        if (!studio) {
          const err = 'Atlas Azgaar complet indisponible sur cette session.';
          ctx.appelsOutils.push({ nom: nomOutil, args, resultat: err });
          return { succes: false, erreur: err };
        }
        const etatsInfo = studio.states.map(st => ({
          id: st.id,
          nom: st.name,
          gouvernement: st.government,
          capitale: studio.burgs.find(b => b.id === st.capitalBurgId)?.name || 'Aucune',
          culture: studio.cultures.find(c => c.id === st.cultureId)?.name || 'Inconnue',
          diplomatie: Object.entries(st.diplomacy || {}).map(([otherId, stat]) => {
            const other = studio.states.find(o => o.id === Number(otherId));
            return `${other?.name || otherId}: ${stat}`;
          }),
          provinces: studio.provinces.filter(p => p.stateId === st.id).map(p => ({ id: p.id, nom: p.name })),
        }));
        const resume = `${etatsInfo.length} États et ${studio.provinces.length} provinces consultés.`;
        ctx.appelsOutils.push({ nom: nomOutil, args, resultat: resume });
        return { succes: true, monde: studio.worldName, etats: etatsInfo };
      }

      if (mode === 'bourgs_ports') {
        const studio = etat.azgaarStudio;
        if (!studio) {
          const err = 'Atlas Azgaar complet indisponible sur cette session.';
          ctx.appelsOutils.push({ nom: nomOutil, args, resultat: err });
          return { succes: false, erreur: err };
        }
        const filtreNom = args.filtreNom ? String(args.filtreNom).toLowerCase() : '';
        const stId = typeof args.stateId === 'number' ? args.stateId : undefined;
        const vue = construireVueEpistemiqueHeros(etat);
        const bourgs = studio.burgs
          .filter(b => {
            if (filtreNom && !b.name.toLowerCase().includes(filtreNom)) return false;
            if (stId !== undefined && b.stateId !== stId) return false;
            return true;
          })
          .slice(0, 20)
          .map(b => ({
            id: b.id,
            nom: b.name,
            etat: studio.states.find(s => s.id === b.stateId)?.name || 'Terres libres',
            population: b.population,
            capitale: b.capital,
            port: b.port,
            citadelle: b.citadel,
            murailles: b.walls,
            temple: b.temple,
            garnison: b.garrison,
            coords: [b.x, b.y],
            routesConnectees: studio.routes.filter(r => r.fromBurgId === b.id || r.toBurgId === b.id).length,
            decouvertParJoueur:
              b.id === studio.heroBurgId ||
              (b.hexId ? etat.hexagones.some(h => h.id === b.hexId && hexEstDecouvert(h, etat.hexActuel.id)) : false) ||
              vue.savoirVerifie.bourgsDecouverts.some(lbl => lbl.startsWith(b.name)),
          }));
        const resume = `${bourgs.length} bourg(s)/port(s) listés.`;
        ctx.appelsOutils.push({ nom: nomOutil, args, resultat: resume });
        return { succes: true, nombre: bourgs.length, bourgs };
      }

      if (mode === 'cultures_religions') {
        const studio = etat.azgaarStudio;
        if (!studio) {
          const err = 'Atlas Azgaar complet indisponible sur cette session.';
          ctx.appelsOutils.push({ nom: nomOutil, args, resultat: err });
          return { succes: false, erreur: err };
        }
        const resume = `${studio.cultures.length} cultures, ${studio.religions.length} religions.`;
        ctx.appelsOutils.push({ nom: nomOutil, args, resultat: resume });
        return {
          succes: true,
          cultures: studio.cultures.map(c => ({ id: c.id, nom: c.name, type: c.type })),
          religions: studio.religions.map(r => ({ id: r.id, nom: r.name, type: r.type, divinite: r.deity })),
        };
      }

      if (mode === 'marqueurs') {
        const studio = etat.azgaarStudio;
        if (!studio) {
          const err = 'Atlas Azgaar complet indisponible sur cette session.';
          ctx.appelsOutils.push({ nom: nomOutil, args, resultat: err });
          return { succes: false, erreur: err };
        }
        const vue = construireVueEpistemiqueHeros(etat);
        const marqueurs = studio.markers.map(m => ({
          ...m,
          decouvertParJoueur:
            m.author === 'JOUEUR' ||
            (m.author !== 'MJ' && vue.savoirVerifie.marqueursDecouverts.some(lbl => lbl.includes(m.title))),
        }));
        const resume = `${studio.markers.length} marqueur(s) relevés.`;
        ctx.appelsOutils.push({ nom: nomOutil, args, resultat: resume });
        return { succes: true, marqueurs };
      }

      const errMode = `Mode atlas inconnu : ${mode}`;
      ctx.appelsOutils.push({ nom: nomOutil, args, resultat: errMode });
      return { succes: false, erreur: errMode };
    }

    if (nomOutil === 'modifier_carte_monde') {
      const etat = ctx.etat;
      const op = String(args.operation || '');

      const resoudreHex = (ref?: string): HexNode | undefined => {
        if (!ref) return etat.hexActuel;
        const clean = String(ref).trim();
        const exact = etat.hexagones.find(h => h.id === clean);
        if (exact) return exact;
        const coordMatch = clean.match(/^(-?\d+)\s*[,;]\s*(-?\d+)$/);
        if (coordMatch) {
          const cq = Number(coordMatch[1]);
          const cr = Number(coordMatch[2]);
          const byCoord = etat.hexagones.find(h => h.q === cq && h.r === cr);
          if (byCoord) return byCoord;
        }
        const low = clean.toLowerCase();
        return etat.hexagones.find(h => h.nom.toLowerCase().includes(low));
      };

      if (op === 'reveler_secteur') {
        const cible = resoudreHex(args.hexId ? String(args.hexId) : undefined) || etat.hexActuel;
        const rayon = Math.max(0, Math.min(2, Math.trunc(Number(args.rayon ?? 1))));
        const reveles: string[] = [];
        etat.hexagones = etat.hexagones.map(h => {
          const d = calculerDistanceHex(cible, h);
          if (d <= rayon && h.brouillard === 'INCONNU') {
            reveles.push(`${h.nom} [${h.q},${h.r}]`);
            return { ...h, brouillard: d === 0 ? 'EXPLORE' : 'REPERE' };
          }
          if (h.id === cible.id && h.brouillard !== 'EXPLORE' && rayon === 0) {
            reveles.push(`${h.nom} (exploré)`);
            return { ...h, brouillard: 'EXPLORE' };
          }
          return h;
        });
        const resume = reveles.length > 0 ? `Secteurs révélés : ${reveles.join(', ')}` : 'Aucun nouveau secteur à révéler.';
        ctx.appelsOutils.push({ nom: nomOutil, args, resultat: resume });
        return { succes: true, reveles, resume };
      }

      if (op === 'etendre_frontiere') {
        const ancre = resoudreHex(args.hexId ? String(args.hexId) : undefined) || etat.hexActuel;
        let q = typeof args.q === 'number' ? Math.trunc(args.q) : undefined;
        let r = typeof args.r === 'number' ? Math.trunc(args.r) : undefined;
        if (q === undefined || r === undefined) {
          const dirs = [
            { dq: 1, dr: 0 },
            { dq: 1, dr: -1 },
            { dq: 0, dr: -1 },
            { dq: -1, dr: 0 },
            { dq: -1, dr: 1 },
            { dq: 0, dr: 1 },
          ];
          const libre = dirs
            .map(d => ({ q: ancre.q + d.dq, r: ancre.r + d.dr }))
            .find(c => !etat.hexagones.some(h => h.q === c.q && h.r === c.r));
          if (!libre) {
            const err = `Toutes les cases adjacentes à ${ancre.nom} existent déjà.`;
            ctx.appelsOutils.push({ nom: nomOutil, args, resultat: err });
            return { succes: false, erreur: err };
          }
          q = libre.q;
          r = libre.r;
        }
        const typePoiVal = ['mine', 'fort', 'ruine', 'bourgade', 'camp'].includes(String(args.typePoi || ''))
          ? (String(args.typePoi) as 'mine' | 'fort' | 'ruine' | 'bourgade' | 'camp')
          : undefined;
        const { hexCree, dejaExistant } = etendreFrontiereAzgaar(etat, q, r, {
          nom: args.nomLieu ? String(args.nomLieu) : undefined,
          forceTerre: true,
          brouillard: 'REPERE',
          pointInteretType: typePoiVal,
          pointInteretNom: args.nomLieu ? String(args.nomLieu) : undefined,
        });
        const resume = dejaExistant
          ? `Hex existant révélé : ${hexCree.nom} [${hexCree.q},${hexCree.r}]`
          : `Frontière étendue : ${hexCree.nom} [${hexCree.q},${hexCree.r}] (${hexCree.biomeAzgaar || hexCree.terrain})`;
        ctx.appelsOutils.push({ nom: nomOutil, args, resultat: resume });
        return { succes: true, dejaExistant, hexCree, resume };
      }

      if (op === 'etablir_lieu') {
        const cible = resoudreHex(args.hexId ? String(args.hexId) : undefined);
        if (!cible || cible.estEau) {
          const err = 'Cible terrestre introuvable pour établir un lieu.';
          ctx.appelsOutils.push({ nom: nomOutil, args, resultat: err });
          return { succes: false, erreur: err };
        }
        const typePoi = (['mine', 'fort', 'ruine', 'bourgade', 'camp'].includes(String(args.typePoi || ''))
          ? String(args.typePoi)
          : cible.pointInteret?.type || 'camp') as 'mine' | 'fort' | 'ruine' | 'bourgade' | 'camp';
        const statutPoi = (['OPERATIONNEL', 'RUINED', 'OCCUPIED', 'ABANDONNE'].includes(
          String(args.statutPoi || '')
        )
          ? String(args.statutPoi)
          : 'OPERATIONNEL') as 'OPERATIONNEL' | 'RUINED' | 'OCCUPIED' | 'ABANDONNE';

        const nomLieu = args.nomLieu ? String(args.nomLieu).slice(0, 60) : cible.pointInteret?.nom || cible.nom;
        cible.pointInteret = {
          id: cible.pointInteret?.id || `poi_mj_${cible.id}`,
          nom: nomLieu,
          type: typePoi,
          statut: statutPoi,
        };
        if (args.routeNiveau === 'ROUTE' || args.routeNiveau === 'PISTE' || args.routeNiveau === 'AUCUNE') {
          cible.routeNiveau = args.routeNiveau;
        }
        if (typePoi === 'fort') cible.garnison = Math.max(cible.garnison ?? 20, 60);
        if (typePoi === 'bourgade') cible.population = Math.max(cible.population ?? 100, 700);
        if (etat.azgaarStudio) {
          const studioRef = etat.azgaarStudio;
          const pos = projeterHexVersMondeAzgaar(cible, studioRef);
          if (typePoi === 'bourgade' || typePoi === 'fort') {
            const linkedBurg = studioRef.burgs.find(b => b.hexId === cible.id);
            if (linkedBurg) {
              linkedBurg.name = nomLieu.slice(0, 40);
              if (typePoi === 'fort') linkedBurg.citadel = true;
            } else {
              const geo = reconstruireAtlasComplet(studioRef);
              const cell = trouverCellulePlusProche(geo.cells, pos.x, pos.y);
              if (cell.isLand) {
                const newId = studioRef.burgs.reduce((m, b) => Math.max(m, b.id), 0) + 1;
                const rng = createSeededRng(studioRef.seed + newId);
                studioRef.burgs.push({
                  id: newId,
                  name: nomLieu.slice(0, 40),
                  cell: cell.index,
                  x: Math.round(pos.x * 10) / 10,
                  y: Math.round(pos.y * 10) / 10,
                  stateId: cell.stateId || studioRef.states[0]?.id || 0,
                  provinceId: cell.provinceId || 0,
                  cultureId: cell.cultureId || 1,
                  religionId: cell.religionId || 1,
                  population: cible.population || 700,
                  capital: false,
                  port: cell.isCoast,
                  citadel: typePoi === 'fort',
                  walls: typePoi === 'fort',
                  plaza: true,
                  temple: false,
                  garrison: cible.garnison || 60,
                  coa: genererBlasonDeterministe(rng),
                  hexId: cible.id,
                });
              }
            }
          } else {
            const markerId = `m_poi_${cible.id}`;
            const icon: AzgaarMarkerIcon = typePoi === 'ruine' ? 'ruine' : typePoi === 'camp' ? 'camp' : 'donjon';
            const existant = studioRef.markers.find(m => m.id === markerId);
            if (existant) {
              existant.icon = icon;
              existant.title = nomLieu.slice(0, 48);
            } else {
              studioRef.markers.push({
                id: markerId,
                icon,
                title: nomLieu.slice(0, 48),
                note: `${typePoi} (${statutPoi})`,
                x: Math.round(pos.x),
                y: Math.round(pos.y),
                author: 'MJ',
                createdDay: etat.horloge.jour,
              });
            }
          }
        }
        if (etat.hexActuel.id === cible.id) {
          etat.hexActuel = { ...cible };
        }
        const resume = `Lieu mis à jour sur ${cible.nom} : ${nomLieu} (${typePoi}, ${statutPoi})`;
        ctx.appelsOutils.push({ nom: nomOutil, args, resultat: resume });
        return { succes: true, hex: cible, resume };
      }

      if (op === 'modifier_hex') {
        const cible = resoudreHex(args.hexId ? String(args.hexId) : undefined);
        if (!cible) {
          const err = 'Hexagone cible introuvable.';
          ctx.appelsOutils.push({ nom: nomOutil, args, resultat: err });
          return { succes: false, erreur: err };
        }
        const changes: string[] = [];
        if (typeof args.pressionDelta === 'number') {
          const delta = Math.max(-40, Math.min(40, Math.trunc(args.pressionDelta)));
          cible.pressionDanger = Math.max(0, Math.min(100, (cible.pressionDanger ?? 30) + delta));
          const p = cible.pressionDanger;
          cible.securite = (p < 22 ? 'Sûr' : p < 45 ? 'Patrouillé' : p < 75 ? 'Dangereux' : 'Périlleux') as SecurityLevel;
          changes.push(`Danger ${p}% (${cible.securite})`);
        }
        if (typeof args.prosperiteDelta === 'number') {
          const delta = Math.max(-30, Math.min(30, Math.trunc(args.prosperiteDelta)));
          cible.prosperite = Math.max(0, Math.min(100, (cible.prosperite ?? 30) + delta));
          changes.push(`Prospérité ${cible.prosperite}%`);
        }
        if (args.factionControleId !== undefined) {
          const fId = String(args.factionControleId);
          if (fId === 'NEUTRE' || fId === '') {
            cible.factionControleId = null;
            changes.push('Contrôle neutre');
          } else if (etat.factions.some(f => f.id === fId)) {
            cible.factionControleId = fId;
            changes.push(`Contrôle: ${fId}`);
          }
          synchroniserControleFactions(etat.factions, etat.hexagones);
          if (etat.azgaarStudio) {
            const studioRef = etat.azgaarStudio;
            const stTarget = cible.factionControleId
              ? studioRef.states.find(s => s.factionId === cible.factionControleId)
              : undefined;
            const targetStateId = stTarget ? stTarget.id : 0;
            const pos = projeterHexVersMondeAzgaar(cible, studioRef);
            const geo = reconstruireAtlasComplet(studioRef);
            const cellCibles = obtenirCellulesDansRayon(geo.cells, pos.x, pos.y, 44);
            if (!studioRef.overrides.state) studioRef.overrides.state = {};
            for (const c of cellCibles) {
              if (c.isLand) studioRef.overrides.state[c.index] = targetStateId;
            }
          }
        }
        if (args.routeNiveau === 'ROUTE' || args.routeNiveau === 'PISTE' || args.routeNiveau === 'AUCUNE') {
          cible.routeNiveau = args.routeNiveau;
          changes.push(`Voie: ${cible.routeNiveau}`);
        }
        if (args.annotation) {
          const noteTexte = String(args.annotation).slice(0, 140);
          cible.annotationJoueur = noteTexte;
          changes.push(`Annotation ajoutée`);
          if (etat.azgaarStudio) {
            const pos = projeterHexVersMondeAzgaar(cible, etat.azgaarStudio);
            const markerId = `m_note_${cible.id}`;
            const existant = etat.azgaarStudio.markers.find(m => m.id === markerId);
            if (existant) {
              existant.note = noteTexte;
            } else {
              etat.azgaarStudio.markers.push({
                id: markerId,
                icon: 'note',
                title: (cible.nom || cible.id).slice(0, 48),
                note: noteTexte,
                x: Math.round(pos.x),
                y: Math.round(pos.y),
                author: 'MJ',
                createdDay: etat.horloge.jour,
              });
            }
          }
        }
        if (etat.hexActuel.id === cible.id) {
          etat.hexActuel = { ...cible };
        }
        const resume = `${cible.nom} : ${changes.join(', ') || 'inchangé'}`;
        ctx.appelsOutils.push({ nom: nomOutil, args, resultat: resume });
        return { succes: true, modifications: changes, resume };
      }

      if (op === 'depecher_unite') {
        const depart = resoudreHex(args.hexId ? String(args.hexId) : undefined) || etat.hexActuel;
        const arrivee = resoudreHex(args.destinationHexId ? String(args.destinationHexId) : undefined);
        if (!arrivee || arrivee.estEau || depart.estEau) {
          const err = 'Départ et destination terrestres valides requis pour dépêcher une unité.';
          ctx.appelsOutils.push({ nom: nomOutil, args, resultat: err });
          return { succes: false, erreur: err };
        }
        const entType = (['CARAVANE', 'PATROUILLE', 'RAIDER', 'MESSAGER', 'REFUGIES'].includes(
          String(args.entiteType || '')
        )
          ? String(args.entiteType)
          : 'MESSAGER') as WorldEntityType;
        const route = calculerItinerairePondere(depart.id, arrivee.id, etat.hexagones, entType);
        const factionId = depart.factionControleId || etat.factions[0]?.id || 'faction_neutre';
        const nouvelleEntite = {
          id: `ent_mj_${Date.now()}`,
          nom: String(args.entiteNom || `${entType} vers ${arrivee.nom}`).slice(0, 50),
          type: entType,
          factionId,
          hexId: depart.id,
          origineHexId: depart.id,
          destinationHexId: arrivee.id,
          itineraire: route.chemin,
          force: entType === 'PATROUILLE' ? 6 : 4,
          cargaison: entType === 'CARAVANE' ? ('Vivres' as const) : entType === 'MESSAGER' ? ('Dépêche' as const) : undefined,
          statut: 'EN_ROUTE' as const,
          tickCreation: etat.horloge.tick,
        };
        if (!etat.entitesMonde) etat.entitesMonde = [];
        etat.entitesMonde.unshift(nouvelleEntite);
        const resume = `${nouvelleEntite.nom} dépêché (${depart.nom} → ${arrivee.nom}, ${route.chemin.length} étape(s))`;
        ctx.appelsOutils.push({ nom: nomOutil, args, resultat: resume });
        return { succes: true, entite: nouvelleEntite, resume };
      }

      if (op === 'generer_monde') {
        const validTemplates: AzgaarTemplateId[] = [
          'continent',
          'archipel',
          'peninsule',
          'mediterranee',
          'detroit',
          'volcan',
          'haute_chaine',
        ];
        let template: AzgaarTemplateId = 'continent';
        const rawTemplate = String(args.modeleRelief || '');
        if (validTemplates.includes(rawTemplate as AzgaarTemplateId)) {
          template = rawTemplate as AzgaarTemplateId;
        } else if (rawTemplate === 'monts') {
          template = 'haute_chaine';
        } else if (rawTemplate === 'vallee') {
          template = 'mediterranee';
        }
        const climateBias = (['tempere', 'boreal', 'aride'].includes(String(args.climatBias || ''))
          ? String(args.climatBias)
          : 'tempere') as AzgaarClimateBias;
        const rayonAnneaux = Math.max(2, Math.min(4, Math.trunc(Number(args.rayonAnneaux) || 2)));
        const seed = Math.max(1, Math.trunc(Number(args.seed) || Date.now() % 999999));

        const nouveauMonde = genererMondeAzgaarStudio(
          {
            seed,
            template,
            climateBias,
            rayonAnneaux,
            worldName: args.nomMonde ? String(args.nomMonde).slice(0, 60) : undefined,
            conserverHeros: true,
          },
          etat
        );
        ctx.etat = nouveauMonde;
        assurerMemoireMJ(ctx.etat);
        const resume = `Nouveau monde Azgaar généré : ${nouveauMonde.carteAzgaar?.nomMonde} (#${seed}, ${template}, ${nouveauMonde.hexagones.length} hex).`;
        ctx.appelsOutils.push({ nom: nomOutil, args, resultat: resume });
        return {
          succes: true,
          nomMonde: nouveauMonde.carteAzgaar?.nomMonde,
          seed,
          hexDepart: nouveauMonde.hexActuel.nom,
          resume,
        };
      }

      const studio = etat.azgaarStudio;
      const resoudreCoordsAzgaar = (): { x: number; y: number } => {
        if (typeof args.x === 'number' && typeof args.y === 'number') {
          return {
            x: Math.max(10, Math.min((studio?.width || 1200) - 10, args.x)),
            y: Math.max(10, Math.min((studio?.height || 760) - 10, args.y)),
          };
        }
        if (args.bourgNom && studio) {
          const low = String(args.bourgNom).toLowerCase();
          const b = studio.burgs.find(x => x.name.toLowerCase().includes(low));
          if (b) return { x: b.x, y: b.y };
        }
        if (studio?.heroX !== undefined && studio?.heroY !== undefined) {
          return { x: studio.heroX, y: studio.heroY };
        }
        const hb = studio?.burgs.find(b => b.id === studio.heroBurgId) || studio?.burgs[0];
        return hb ? { x: hb.x, y: hb.y } : { x: 600, y: 380 };
      };

      if (op === 'placer_marqueur') {
        if (!studio) {
          const err = 'Carte Azgaar non initialisée.';
          ctx.appelsOutils.push({ nom: nomOutil, args, resultat: err });
          return { succes: false, erreur: err };
        }
        const { x, y } = resoudreCoordsAzgaar();
        const validIcons: AzgaarMarkerIcon[] = ['donjon', 'ruine', 'danger', 'port', 'camp', 'quete', 'note'];
        const icon: AzgaarMarkerIcon = validIcons.includes(args.markerIcon) ? args.markerIcon : 'note';
        const marker: AzgaarMarkerDef = {
          id: `m_mj_${Date.now()}_${Math.floor(Math.random() * 100)}`,
          icon,
          title: String(args.titre || 'Repère MJ').slice(0, 50),
          note: String(args.note || 'Marqué en séance.').slice(0, 220),
          x: Math.round(x),
          y: Math.round(y),
          author: 'MJ',
          createdDay: etat.horloge.jour,
        };
        studio.markers.push(marker);
        const resume = `Marqueur posé sur Azgaar : ${marker.title} (${marker.icon}) à [${marker.x}, ${marker.y}].`;
        ctx.appelsOutils.push({ nom: nomOutil, args, resultat: resume });
        return { succes: true, marker, resume };
      }

      if (op === 'supprimer_marqueur') {
        if (!studio) {
          const err = 'Carte Azgaar non initialisée.';
          ctx.appelsOutils.push({ nom: nomOutil, args, resultat: err });
          return { succes: false, erreur: err };
        }
        const avant = studio.markers.length;
        const mId = args.markerId ? String(args.markerId) : '';
        const mTitre = args.titre ? String(args.titre).toLowerCase() : '';
        studio.markers = studio.markers.filter(m => {
          if (mId && m.id === mId) return false;
          if (mTitre && m.title.toLowerCase().includes(mTitre)) return false;
          return true;
        });
        const removed = avant - studio.markers.length;
        const resume = `${removed} marqueur(s) retiré(s).`;
        ctx.appelsOutils.push({ nom: nomOutil, args, resultat: resume });
        return { succes: true, removed, resume };
      }

      if (op === 'peindre_cellules') {
        if (!studio) {
          const err = 'Carte Azgaar non initialisée.';
          ctx.appelsOutils.push({ nom: nomOutil, args, resultat: err });
          return { succes: false, erreur: err };
        }
        const { x, y } = resoudreCoordsAzgaar();
        const rayonPx = Math.max(20, Math.min(140, Number(args.rayonPx) || 55));
        const geo = reconstruireAtlasComplet(studio);
        const cibles = obtenirCellulesDansRayon(geo.cells, x, y, rayonPx);

        if (typeof args.heightDelta === 'number' && args.heightDelta !== 0) {
          if (!studio.overrides.height) studio.overrides.height = {};
          const hd = Math.max(-45, Math.min(45, Math.trunc(args.heightDelta)));
          for (const c of cibles) {
            studio.overrides.height[c.index] = Math.max(2, Math.min(99, c.h + hd));
          }
        }
        if (typeof args.biomeId === 'number' && AZGAAR_BIOMES[args.biomeId]) {
          if (!studio.overrides.biome) studio.overrides.biome = {};
          for (const c of cibles) {
            if (c.isLand) studio.overrides.biome[c.index] = args.biomeId;
          }
        }
        if (typeof args.stateId === 'number') {
          if (!studio.overrides.state) studio.overrides.state = {};
          for (const c of cibles) {
            if (c.isLand) studio.overrides.state[c.index] = args.stateId;
          }
        }
        if (typeof args.cultureId === 'number') {
          if (!studio.overrides.culture) studio.overrides.culture = {};
          for (const c of cibles) {
            if (c.isLand) studio.overrides.culture[c.index] = args.cultureId;
          }
        }
        if (typeof args.religionId === 'number') {
          if (!studio.overrides.religion) studio.overrides.religion = {};
          for (const c of cibles) {
            if (c.isLand) studio.overrides.religion[c.index] = args.religionId;
          }
        }
        ctx.etat = synchroniserSecteurDepuisAzgaar(etat, studio);
        const resume = `${cibles.length} cellule(s) Voronoï modifiée(s) autour de [${Math.round(x)}, ${Math.round(y)}].`;
        ctx.appelsOutils.push({ nom: nomOutil, args, resultat: resume });
        return { succes: true, cellulesModifiees: cibles.length, resume };
      }

      if (op === 'editer_bourg') {
        if (!studio) {
          const err = 'Carte Azgaar non initialisée.';
          ctx.appelsOutils.push({ nom: nomOutil, args, resultat: err });
          return { succes: false, erreur: err };
        }
        const nomCherche = args.bourgNom ? String(args.bourgNom).toLowerCase() : '';
        let bourg = nomCherche
          ? studio.burgs.find(b => b.name.toLowerCase().includes(nomCherche))
          : undefined;

        if (!bourg) {
          const { x, y } = resoudreCoordsAzgaar();
          const geo = reconstruireAtlasComplet(studio);
          const cell = trouverCellulePlusProche(geo.cells, x, y);
          const newId = studio.burgs.reduce((m, b) => Math.max(m, b.id), 0) + 1;
          const rng = createSeededRng(studio.seed + newId);
          bourg = {
            id: newId,
            name: String(args.nomLieu || args.bourgNom || `Bourg-${newId}`).slice(0, 40),
            cell: cell.index,
            x: Math.round(cell.x * 10) / 10,
            y: Math.round(cell.y * 10) / 10,
            stateId: typeof args.stateId === 'number' ? args.stateId : cell.stateId,
            provinceId: cell.provinceId,
            cultureId: cell.cultureId || 1,
            religionId: cell.religionId || 1,
            population: Math.max(250, 1200 + (Number(args.populationDelta) || 0)),
            capital: false,
            port: Boolean(args.estPort ?? cell.isCoast),
            citadel: Boolean(args.aCitadelle),
            walls: Boolean(args.aMurailles),
            plaza: true,
            temple: Boolean(args.aTemple),
            garrison: Math.max(20, 80 + (Number(args.garnisonDelta) || 0)),
            coa: genererBlasonDeterministe(rng),
          };
          studio.burgs.push(bourg);
        } else {
          if (args.nomLieu) bourg.name = String(args.nomLieu).slice(0, 40);
          if (typeof args.populationDelta === 'number') {
            bourg.population = Math.max(50, Math.round(bourg.population + args.populationDelta));
          }
          if (typeof args.garnisonDelta === 'number') {
            bourg.garrison = Math.max(0, Math.round(bourg.garrison + args.garnisonDelta));
          }
          if (typeof args.estPort === 'boolean') bourg.port = args.estPort;
          if (typeof args.aCitadelle === 'boolean') bourg.citadel = args.aCitadelle;
          if (typeof args.aMurailles === 'boolean') bourg.walls = args.aMurailles;
          if (typeof args.aTemple === 'boolean') bourg.temple = args.aTemple;
          if (typeof args.stateId === 'number') bourg.stateId = args.stateId;
        }

        const synced = synchroniserSecteurDepuisAzgaar(etat, studio);
        ctx.etat = synced;
        const resume = `Bourg mis à jour : ${bourg.name} (${bourg.population} hab., garnison ${bourg.garrison}).`;
        ctx.appelsOutils.push({ nom: nomOutil, args, resultat: resume });
        return { succes: true, bourg, resume };
      }

      if (op === 'tracer_route') {
        if (!studio) {
          const err = 'Carte Azgaar non initialisée.';
          ctx.appelsOutils.push({ nom: nomOutil, args, resultat: err });
          return { succes: false, erreur: err };
        }
        const fromQ = String(args.bourgNom || '').toLowerCase();
        const toQ = String(args.bourgDestNom || '').toLowerCase();
        const fromBurg =
          (fromQ ? studio.burgs.find(b => b.name.toLowerCase().includes(fromQ)) : undefined) ||
          studio.burgs.find(b => b.id === studio.heroBurgId) ||
          studio.burgs[0];
        const toBurg = toQ ? studio.burgs.find(b => b.name.toLowerCase().includes(toQ)) : undefined;
        if (!fromBurg || !toBurg || fromBurg.id === toBurg.id) {
          const err = 'Deux bourgs distincts requis pour tracer une route Azgaar.';
          ctx.appelsOutils.push({ nom: nomOutil, args, resultat: err });
          return { succes: false, erreur: err };
        }

        const geo = reconstruireAtlasComplet(studio);
        const kind: 'road' | 'trail' | 'sea' =
          args.typeRoute === 'sea' ? 'sea' : args.typeRoute === 'trail' ? 'trail' : 'road';
        let points: Array<[number, number]> | null = null;

        if (kind === 'sea') {
          const wA = geo.cells[fromBurg.cell]?.neighbors.find(nb => !geo.cells[nb].isLand);
          const wB = geo.cells[toBurg.cell]?.neighbors.find(nb => !geo.cells[nb].isLand);
          if (wA !== undefined && wB !== undefined) {
            const seaPts = calculerRouteVoronoi(geo.cells, wA, wB, 'sea');
            if (seaPts) points = [[fromBurg.x, fromBurg.y], ...seaPts, [toBurg.x, toBurg.y]];
          }
        } else {
          points = calculerRouteVoronoi(geo.cells, fromBurg.cell, toBurg.cell, 'land');
        }

        if (!points || points.length < 2) {
          const err = `Trajet ${kind} impossible entre ${fromBurg.name} et ${toBurg.name}.`;
          ctx.appelsOutils.push({ nom: nomOutil, args, resultat: err });
          return { succes: false, erreur: err };
        }

        const route = {
          id: `route_mj_${Date.now()}`,
          kind,
          points,
          fromBurgId: fromBurg.id,
          toBurgId: toBurg.id,
        };
        studio.routes.push(route);
        if (kind !== 'sea') {
          for (const hx of etat.hexagones) {
            if (hx.estEau) continue;
            const pos = projeterHexVersMondeAzgaar(hx, studio);
            if (points.some(pt => Math.hypot(pt[0] - pos.x, pt[1] - pos.y) <= 42)) {
              hx.routeNiveau = kind === 'road' ? 'ROUTE' : hx.routeNiveau === 'AUCUNE' ? 'PISTE' : hx.routeNiveau;
              if (etat.hexActuel.id === hx.id) {
                etat.hexActuel = { ...hx };
              }
            }
          }
        }
        const resume = `Voie ${kind === 'sea' ? 'maritime' : kind === 'trail' ? 'piste' : 'route'} tracée : ${fromBurg.name} → ${toBurg.name}.`;
        ctx.appelsOutils.push({ nom: nomOutil, args, resultat: resume });
        return { succes: true, route, resume };
      }

      const errOp = `Opération cartographique inconnue : ${op}`;
      ctx.appelsOutils.push({ nom: nomOutil, args, resultat: errOp });
      return { succes: false, erreur: errOp };
    }

    if (nomOutil === 'gerer_donjon') {
      const op = String(args.operation || 'CREER').toUpperCase();
      if (op === 'SORTIR') {
        const nom = ctx.etat.donjon?.nom || 'Donjon';
        ctx.etat.donjon = null;
        const resume = `Sortie du donjon : ${nom}.`;
        ctx.appelsOutils.push({ nom: nomOutil, args, resultat: resume });
        return { succes: true, resume };
      }

      if (op === 'MODIFIER_SALLE') {
        if (!ctx.etat.donjon?.actif) {
          const err = 'Aucun donjon actif à modifier.';
          ctx.appelsOutils.push({ nom: nomOutil, args, resultat: err });
          return { succes: false, erreur: err };
        }
        const salle = ctx.etat.donjon.salles.find(s => s.id === String(args.salleId || ctx.etat.donjon!.salleActuelleId));
        if (!salle) {
          const err = 'Salle introuvable.';
          ctx.appelsOutils.push({ nom: nomOutil, args, resultat: err });
          return { succes: false, erreur: err };
        }
        if (args.description) salle.description = String(args.description).slice(0, 260);
        if (['AUCUN', 'PIEGE', 'ENNEMI', 'EFFONDREMENT'].includes(String(args.danger || ''))) {
          salle.danger = String(args.danger) as DungeonRoom['danger'];
        }
        if (typeof args.tresorPO === 'number') salle.tresorPO = Math.max(0, Math.trunc(args.tresorPO));
        if (typeof args.piegeDD === 'number') salle.piegeDD = Math.max(5, Math.min(25, Math.trunc(args.piegeDD)));
        if (['FOR', 'DEX', 'CON', 'INT', 'SAG', 'CHA'].includes(String(args.piegeCarac || '').toUpperCase())) {
          salle.piegeCarac = String(args.piegeCarac).toUpperCase() as Ability;
        }
        if (args.piegeDegats) salle.piegeDegats = String(args.piegeDegats).slice(0, 16);
        if (args.piegeDesc) salle.piegeDesc = String(args.piegeDesc).slice(0, 120);
        if (Array.isArray(args.monstreIds)) {
          salle.monstreIds = args.monstreIds.map(String).slice(0, 4);
        }
        const resume = `Salle ${salle.nom} mise à jour.`;
        ctx.appelsOutils.push({ nom: nomOutil, args, resultat: resume });
        return { succes: true, salle, resume };
      }

      // CREER un donjon nodal procédural complet (2 à 6 salles)
      const brutes: any[] = Array.isArray(args.salles) ? args.salles.slice(0, 6) : [];
      if (brutes.length < 2) {
        const err = 'Il faut au moins 2 salles pour créer un donjon.';
        ctx.appelsOutils.push({ nom: nomOutil, args, resultat: err });
        return { succes: false, erreur: err };
      }

      const sallesNormalisees: DungeonRoom[] = brutes.map((s, idx) => {
        const id = String(s.id || `salle_${idx + 1}`);
        const danger = ['AUCUN', 'PIEGE', 'ENNEMI', 'EFFONDREMENT'].includes(String(s.danger || ''))
          ? (String(s.danger) as DungeonRoom['danger'])
          : idx === brutes.length - 1
          ? 'ENNEMI'
          : 'AUCUN';
        const piegeCarac = ['FOR', 'DEX', 'CON', 'INT', 'SAG', 'CHA'].includes(String(s.piegeCarac || '').toUpperCase())
          ? (String(s.piegeCarac).toUpperCase() as Ability)
          : undefined;
        return {
          id,
          nom: String(s.nom || `Salle ${idx + 1}`).slice(0, 60),
          description: String(s.description || 'Salle de pierre froide.').slice(0, 260),
          visitee: idx === 0,
          danger,
          tresorPO: typeof s.tresorPO === 'number' ? Math.max(0, Math.trunc(s.tresorPO)) : undefined,
          fouillable: s.fouillable !== false,
          connexions: Array.isArray(s.connexions) ? s.connexions.map(String) : [],
          piegeDD: typeof s.piegeDD === 'number' ? Math.max(5, Math.min(25, Math.trunc(s.piegeDD))) : undefined,
          piegeCarac,
          piegeDegats: s.piegeDegats ? String(s.piegeDegats).slice(0, 16) : undefined,
          piegeDesc: s.piegeDesc ? String(s.piegeDesc).slice(0, 120) : undefined,
          monstreIds: Array.isArray(s.monstreIds) ? s.monstreIds.map(String).slice(0, 4) : undefined,
        };
      });

      // Normaliser les connexions (retirer invalides, rendre symétrique, chaîner si isolée)
      const idsValides = new Set(sallesNormalisees.map(s => s.id));
      for (let i = 0; i < sallesNormalisees.length; i += 1) {
        const s = sallesNormalisees[i];
        s.connexions = Array.from(new Set(s.connexions.filter(c => idsValides.has(c) && c !== s.id)));
        if (s.connexions.length === 0 && i < sallesNormalisees.length - 1) {
          s.connexions.push(sallesNormalisees[i + 1].id);
        }
      }
      for (const s of sallesNormalisees) {
        for (const cId of s.connexions) {
          const cible = sallesNormalisees.find(x => x.id === cId);
          if (cible && !cible.connexions.includes(s.id)) {
            cible.connexions.push(s.id);
          }
        }
      }

      const nomDonjon = String(args.nomDonjon || ctx.etat.hexActuel.pointInteret?.nom || 'Galeries inexplorées').slice(0, 70);
      ctx.etat.donjon = {
        actif: true,
        poiId: ctx.etat.hexActuel.pointInteret?.id || `poi_mj_${Date.now()}`,
        nom: nomDonjon,
        salleActuelleId: sallesNormalisees[0].id,
        salles: sallesNormalisees,
        journalDonjon: [`Entrée dans ${nomDonjon} (${sallesNormalisees.length} salles).`],
      };

      if (!ctx.adjudication) {
        ctx.adjudication = {
          phase: 'adjudication_resolved',
          action_type: 'DUNGEON_GENERATION',
          competenceOuCarac: nomDonjon,
          dice_roll: 12,
          modificateur: 0,
          score_total: 12,
          cible_dd_ou_ca: 10,
          issue: 'SUCCESS',
          mutations_etat: {
            descriptionTechnique: `Donjon créé : ${nomDonjon} (${sallesNormalisees.length} salles).`,
          },
        };
      }

      const resume = `Donjon généré : ${nomDonjon} (${sallesNormalisees.length} salles).`;
      ctx.appelsOutils.push({ nom: nomOutil, args, resultat: resume });
      return { succes: true, donjon: ctx.etat.donjon, resume };
    }

    if (nomOutil === 'demander_jet_joueur') {
      const caracRaw = String(args.caracteristique || 'DEX').toUpperCase();
      const caracteristique = (['FOR', 'DEX', 'CON', 'INT', 'SAG', 'CHA'].includes(caracRaw)
        ? caracRaw
        : 'DEX') as Ability;
      const dd = Math.max(5, Math.min(25, Math.trunc(Number(args.dd) || 12)));
      const typeJet = args.typeJet === 'competence' ? 'competence' : 'sauvegarde';
      const demande = {
        id: `roll_${Date.now().toString(36)}`,
        titre: String(args.titre || 'Test décisif').slice(0, 70),
        caracteristique,
        competence: args.competence ? String(args.competence).slice(0, 40) : undefined,
        dd,
        typeJet,
        contexte: String(args.contexte || 'Situation critique').slice(0, 180),
        enjeuSucces: String(args.enjeuSucces || 'Tu évites le péril.').slice(0, 140),
        enjeuEchec: String(args.enjeuEchec || 'Tu subis le contrecoup.').slice(0, 140),
        optionAlternative: args.optionAlternative ? String(args.optionAlternative).slice(0, 90) : undefined,
      } as const;
      ctx.etat.jetEnAttente = { ...demande };
      const resume = `Jet demandé : ${demande.titre} (${demande.competence || demande.caracteristique} DD ${demande.dd}).`;
      ctx.appelsOutils.push({ nom: nomOutil, args, resultat: resume });
      return { succes: true, jetDemande: ctx.etat.jetEnAttente, resume };
    }

    return { succes: false, erreur: `Outil inconnu : ${nomOutil}` };
  } catch (err: any) {
    const errMsg = err?.message || 'Erreur outil MJ';
    ctx.appelsOutils.push({ nom: nomOutil, args, resultat: `Erreur: ${errMsg}` });
    return { succes: false, erreur: errMsg };
  }
}
