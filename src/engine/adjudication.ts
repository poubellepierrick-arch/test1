import { SimulationState, AdjudicationPayload, HexNode, CharacterStats, DungeonState, Hireling } from '../types';
import {
  executerMarcheForcee,
  executerJetSauvegardeMort,
  executerRepos,
  evaluerMonteeNiveau,
  appliquerUsureEquipement,
  reparerEquipement,
  evaluerExpositionMeteo,
} from './srd';
import { executerDeplacementHex, executerForage, calculerDistanceHex } from './hexcrawl';
import {
  initialiserCombat,
  resoudreToursJusquaJoueur,
  executerDeplacementCombat,
  executerDesengagementJoueur,
  executerAttaqueJoueur,
  executerEsquiveJoueur,
  executerSortJoueur,
  executerFuiteJoueur,
} from './combat';
import {
  equiperObjet,
  utiliserObjet,
  jeterObjet,
  basculerSourceLumiere,
  consommerHeuresLumiere,
  estDansObscuriteSansLumiere,
  construirePersonnageDepuisImport,
  appliquerMiseAJourHeros,
  gererDocumentHeros,
} from './character';
import { avancerTempsEtMonde } from './worldSim';
import { lancerD20, calculerModificateur, interpreterJetDegats } from './dice';
import { traverserGraphe, filtrerParFrontiereDeConnaissance } from './graph';
import { preparerSort, executerSortGrimoire } from './spells';
import { fabriquerObjetBivouac, soignerBlessure } from './injuries';
import { evaluerContexteLieu } from './context';
import {
  estPnjEnVue,
  nettoyerPnjsItinerants,
  tenterRencontrePnjItinerant,
  extraireRumeurPnj,
} from './encounters';
import { reconcilierProximitePnjs } from './worldLoreAndNpcs';
import {
  obtenirFicheSrd,
  rechercherCompendium,
  creerCombatantDepuisMonstre,
  calculerValeurPC,
  formaterPrixPC,
} from './compendium';
import { ItemEntry, MonsterEntry } from '../types/srd';
import { projeterHexVersMondeAzgaar } from './azgaarVoronoi';

export interface ActionRequest {
  type:
    | 'DEPLACER_HEX'
    | 'FORAGER'
    | 'REPOS_COURT'
    | 'REPOS_LONG'
    | 'ATTAQUER'
    | 'TOUR_ENNEMI'
    | 'JETS_MORT'
    | 'ACTION_LIBRE'
    | 'ESQUIVER'
    | 'LANCER_SORT'
    | 'FUIR_TACTIQUE'
    | 'DEPLACER_COMBAT'
    | 'DESENGAGER_COMBAT'
    | 'TROQUER'
    | 'CORVEE_TRAVAIL'
    | 'DIALOGUER_PNJ'
    | 'DEMANDER_RUMEURS'
    | 'ENGAGER_COMPAGNON'
    | 'CONGEDIER_COMPAGNON'
    | 'ENTRETENIR_EQUIPEMENT'
    | 'BOUILLIR_EAU'
    | 'EXPLORER_SITE'
    | 'DONJON_DEPLACEMENT'
    | 'DONJON_FOUILLER'
    | 'DONJON_SORTIR'
    | 'ENTRAINEMENT_NIVEAU'
    | 'PREPARER_SORT'
    | 'LANCER_SORT_GRIMOIRE'
    | 'FABRIQUER_OBJET'
    | 'SOIGNER_BLESSURE'
    | 'ANNOTER_HEX'
    | 'EQUIPER_OBJET'
    | 'UTILISER_OBJET'
    | 'JETER_OBJET'
    | 'BASCULER_LUMIERE'
    | 'CONFIGURER_VOYAGE'
    | 'CONFIGURER_NARRATION'
    | 'CONFIGURER_MODELE_IA'
    | 'RESOUDRE_JET_DEMANDE'
    | 'IMPORTER_HEROS'
    | 'METTRE_A_JOUR_HEROS'
    | 'GERER_DOCUMENT_HEROS'
    | 'AJOUTER_QUETE'
    | 'OUVERTURE_CAMPAGNE';
  cibleId?: string;
  texteLibre?: string;
  jobId?: string;
  articleId?: string;
  quantite?: number;
  pnjId?: string;
  sujetDialogue?: string;
  sortNom?: string;
  payloadAction?: Record<string, any>;
}

export function mettreAJourMemoire(
  personnage: CharacterStats,
  nouvelleInfo?: string,
  hex?: HexNode,
  meteo?: string
) {
  if (!personnage.memoire) {
    personnage.memoire = { dernieresInfos: [], souvenirsContextuels: [] };
  }

  if (nouvelleInfo) {
    personnage.memoire.dernieresInfos = [
      nouvelleInfo,
      ...personnage.memoire.dernieresInfos.filter(i => i !== nouvelleInfo),
    ].slice(0, 4);
  }

  const souvenirs: string[] = [];
  if (hex) {
    if (hex.terrain === 'Montagne Escarpée') {
      souvenirs.push('Les défilés rocheux rappellent l\'embuscade où votre bataillon perdit ses provisions de sel.');
    } else if (hex.terrain === 'Marais Fétide') {
      souvenirs.push('L\'odeur fétide de vase rappelle la dysenterie qui a décimé les pionniers de la basse vallée.');
    } else if (hex.terrain === 'Forêt Dense') {
      souvenirs.push('Les frondaisons épaisses rappellent les traques de maraudeurs orcs qui évitaient la lumière.');
    } else if (hex.terrain === 'Désert Aride') {
      souvenirs.push('La poussière sèche sur les lèvres rappelle la caravane morte de déshydratation à deux lieues du puits.');
    } else {
      souvenirs.push('Les remparts de Val-Gris rappellent les cités marchandes prêtes à sacrifier leurs journaliers en cas de siège.');
    }
  }

  if (meteo && (meteo.includes('Pluie') || meteo.includes('Brume') || meteo.includes('Chaleur'))) {
    souvenirs.push(`Les rigueurs de ${meteo.toLowerCase()} rappellent la règle d'or : préserver l'amadou au sec ou périr d'hypothermie.`);
  }

  if (personnage.pvActuels <= 4) {
    souvenirs.push('La morsure du sang sur les flancs rappelle les blessures lentes à cicatriser sans médecin de garnison.');
  }

  personnage.memoire.souvenirsContextuels = souvenirs.slice(0, 3);
}

export function orchestrerActionDeterministe(
  etatActuel: SimulationState,
  action: ActionRequest
): {
  nouvelEtat: SimulationState;
  adjudication: AdjudicationPayload;
  evenementFactionTexte?: string;
  pnjApproche?: { id: string; nom: string; role: string; motif: string };
} {
  const etat: SimulationState = JSON.parse(JSON.stringify(etatActuel));
  etat._seq += 1;

  let adjudication: AdjudicationPayload;
  let evenementFactionTexte: string | undefined;
  let pnjApproche: { id: string; nom: string; role: string; motif: string } | undefined;

  switch (action.type) {
    case 'DEPLACER_HEX': {
      const cible = etat.hexagones.find(h => h.id === action.cibleId);
      if (!cible) throw new Error('Hexagone cible inconnu');
      const distHex = calculerDistanceHex(etat.hexActuel, cible);
      if (distHex === 0) {
        throw new Error('Vous êtes déjà sur cet hexagone.');
      }
      if (distHex > 1) {
        throw new Error(`Hexagone hors de portée directe (distance ${distHex}). Déplacez-vous case par case.`);
      }
      if (cible.estEau) {
        throw new Error('Mer infranchissable à pied : choisissez une terre adjacente.');
      }

      const ancienHexId = etat.hexActuel.id;
      if (ancienHexId !== cible.id) {
        nettoyerPnjsItinerants(etat, ancienHexId);
      }

      const res = executerDeplacementHex(etat.hexActuel, cible, etat.personnage, etat.marcheAllure, etat.roleExploration);
      etat.hexActuel = res.hexCible;
      etat.personnage = res.personnageModifie;
      adjudication = res.adjudication;

      if (etat.personnage.sourceLumiere?.active && (etat.horloge.heure >= 20 || etat.horloge.heure < 6)) {
        const lum = consommerHeuresLumiere(etat.personnage, res.adjudication.mutations_etat.heuresEcoulees || 2);
        etat.personnage = lum.personnageModifie;
        if (lum.message) {
          adjudication.mutations_etat.descriptionTechnique += ` [${lum.message}]`;
        }
      }

      // Dissipation du brouillard de guerre sur la carte
      etat.hexagones = etat.hexagones.map(h => {
        if (h.id === res.hexCible.id) {
          return { ...h, visite: true, brouillard: 'EXPLORE' as const };
        }
        const dq = Math.abs(h.q - res.hexCible.q);
        const dr = Math.abs(h.r - res.hexCible.r);
        const ds = Math.abs((h.q + h.r) - (res.hexCible.q + res.hexCible.r));
        if (Math.max(dq, dr, ds) <= 1 && h.brouillard === 'INCONNU') {
          return { ...h, brouillard: 'REPERE' as const };
        }
        return h;
      });

      // Synchroniser la position du héros sur le canvas Azgaar Voronoï
      if (etat.azgaarStudio) {
        const bourgCible = etat.azgaarStudio.burgs.find(b => b.hexId === res.hexCible.id);
        if (bourgCible) {
          etat.azgaarStudio.heroBurgId = bourgCible.id;
          etat.azgaarStudio.heroCell = bourgCible.cell;
          etat.azgaarStudio.heroX = bourgCible.x;
          etat.azgaarStudio.heroY = bourgCible.y;
        } else {
          const pos = projeterHexVersMondeAzgaar(res.hexCible, etat.azgaarStudio);
          etat.azgaarStudio.heroBurgId = undefined;
          etat.azgaarStudio.heroX = Math.round(pos.x * 10) / 10;
          etat.azgaarStudio.heroY = Math.round(pos.y * 10) / 10;
        }
      }

      reconcilierProximitePnjs(etat, 2);

      // Faire avancer l'horloge du monde (et déclencher la simulation autonome à chaque changement de jour)
      const heures = res.adjudication.mutations_etat.heuresEcoulees || 2;
      const evtMonde = avancerTempsEtMonde(etat, heures);
      if (evtMonde) {
        evenementFactionTexte = evtMonde;
      }

      // Marche forcée si > 8h
      if (etat.personnage.heuresMarcheJour > 8) {
        const forceRes = executerMarcheForcee(etat.personnage);
        etat.personnage = forceRes.personnageModifie;
        adjudication.mutations_etat.descriptionTechnique += ` [Marche forcée : ${forceRes.adjudication.mutations_etat.descriptionTechnique}]`;
      }

      // Évaluation de l'exposition météo
      const meteoRes = evaluerExpositionMeteo(etat.horloge.meteo, etat.personnage);
      etat.personnage = meteoRes.personnageModifie;
      if (meteoRes.affecte) {
        adjudication.mutations_etat.descriptionTechnique += ` [${meteoRes.description}]`;
      }

      // Usure de l'équipement lors de la marche
      etat.personnage = appliquerUsureEquipement(etat.personnage, 5);

      // Signaler les entités mobiles actives présentes sur l'hexagone atteint
      const entitesLocales = (etat.entitesMonde || []).filter(
        e => e.statut === 'EN_ROUTE' && e.hexId === etat.hexActuel.id
      );
      const raiderLocal = entitesLocales.find(e => e.type === 'RAIDER');
      const caravaneLocale = entitesLocales.find(e => e.type === 'CARAVANE');
      const patrouilleLocale = entitesLocales.find(e => e.type === 'PATROUILLE');

      // Déclenchement de combat en cas d'embuscade ou de meute raider présente sur l'hexagone
      if ((res.rencontreImminente && res.typeRencontre) || (raiderLocal && lancerD20('normal').valeurRetenue >= 12)) {
        const typeEnnemi = raiderLocal ? 'BANDIT' : res.typeRencontre!;
        const idPreferentiel = raiderLocal
          ? 'mon_orc'
          : typeEnnemi === 'GOBELIN'
          ? 'mon_gobelin'
          : typeEnnemi === 'ZOMBIE'
          ? 'mon_zombi'
          : 'mon_bandit';
        const candidatsBiome = rechercherCompendium({
          categorie: 'monstre',
          biome: etat.hexActuel.terrain,
          fpMax: Math.max(1, etat.personnage.niveau),
          limite: 8,
        })
          .map(r => r.entry)
          .filter((e): e is MonsterEntry => e.categorie === 'monstre');

        const fichePref = obtenirFicheSrd(idPreferentiel);
        const monstreChoisi: MonsterEntry | undefined =
          !raiderLocal && candidatsBiome.length > 0 && Math.random() < 0.45
            ? candidatsBiome[Math.floor(Math.random() * candidatsBiome.length)]
            : fichePref?.categorie === 'monstre'
            ? fichePref
            : undefined;

        const ennemi = monstreChoisi
          ? creerCombatantDepuisMonstre(monstreChoisi)
          : {
              id: `mob_${Date.now()}`,
              nom: raiderLocal
                ? 'Éclaireur du Clan Borgne'
                : typeEnnemi === 'GOBELIN'
                ? 'Éclaireur Gobelin'
                : typeEnnemi === 'ZOMBIE'
                ? 'Cadavre Putride'
                : 'Bandit de Grand Chemin',
              type: typeEnnemi,
              pv: typeEnnemi === 'GOBELIN' ? 7 : typeEnnemi === 'ZOMBIE' ? 14 : 11,
              pvMax: typeEnnemi === 'GOBELIN' ? 7 : typeEnnemi === 'ZOMBIE' ? 14 : 11,
              ca: typeEnnemi === 'GOBELIN' ? 15 : typeEnnemi === 'ZOMBIE' ? 8 : 12,
              initiative: 0,
              distancePieds: 30,
              statut: 'ACTIF' as const,
              bonusAttaque: typeEnnemi === 'GOBELIN' ? 4 : 3,
              degatsDes: '1d6+2',
              comportement: (typeEnnemi === 'GOBELIN' ? 'RUSE_ET_FUITE' : typeEnnemi === 'ZOMBIE' ? 'AVEUGLE_CORPS_A_CORPS' : 'TACTIQUE_COORDINATION') as any,
            };
        if (raiderLocal) {
          raiderLocal.statut = 'DISPERSE';
        }
        const initCombat = initialiserCombat(etat.personnage, [ennemi]);
        const tourInit = resoudreToursJusquaJoueur(etat.personnage, initCombat, { estDebutCombat: true });
        etat.combat = tourInit.combatModifie;
        etat.personnage = tourInit.personnageModifie;
        adjudication.mutations_etat.descriptionTechnique += ` [Alerte : ${ennemi.nom} surgit sur votre route !]`;
      } else {
        if (caravaneLocale) {
          adjudication.mutations_etat.descriptionTechnique += ` [${caravaneLocale.nom} fait halte ici : négoce possible.]`;
        } else if (patrouilleLocale) {
          adjudication.mutations_etat.descriptionTechnique += ` [${patrouilleLocale.nom} tient le secteur.]`;
        }
        // Rencontre pacifique possible d'un PNJ itinérant entrant dans le champ de vision
        const enc = tenterRencontrePnjItinerant(etat, 'TRAVEL');
        if (enc) {
          adjudication.mutations_etat.descriptionTechnique += ` [${enc.description}]`;
          pnjApproche = {
            id: enc.pnj.id,
            nom: enc.pnj.label,
            role: enc.pnj.proprietes?.profession || 'Voyageur',
            motif: enc.pnj.proprietes?.motifRencontre || 'Croise votre route.',
          };
        }
      }
      break;
    }

    case 'FORAGER': {
      const res = executerForage(etat.hexActuel, etat.personnage);
      etat.personnage = res.personnageModifie;
      adjudication = res.adjudication;
      const evtMonde = avancerTempsEtMonde(etat, 1);
      if (evtMonde) evenementFactionTexte = evtMonde;
      break;
    }

    case 'REPOS_COURT': {
      const res = executerRepos(etat.personnage, 'court', true);
      etat.personnage = res.personnageModifie;
      adjudication = res.adjudication;
      const evtMonde = avancerTempsEtMonde(etat, 1);
      if (evtMonde) evenementFactionTexte = evtMonde;
      break;
    }

    case 'REPOS_LONG': {
      const ctx = evaluerContexteLieu(etat);
      const repoCtx = ctx.contexteRepos;
      const modeChoisi = action.payloadAction?.mode as 'auberge' | 'porche' | 'bivouac' | undefined;

      let abriSecurise = false;
      let coutPA = 0;
      let mode: 'auberge' | 'porche' | 'bivouac' = 'bivouac';

      if (repoCtx.estEnBourgade) {
        if (modeChoisi !== 'porche' && repoCtx.peutPayerAuberge) {
          abriSecurise = true;
          coutPA = repoCtx.coutAubergePA;
          mode = 'auberge';
        } else {
          abriSecurise = false;
          coutPA = 0;
          mode = 'porche';
        }
      } else {
        abriSecurise = false;
        coutPA = 0;
        mode = 'bivouac';
      }

      const res = executerRepos(etat.personnage, 'long', abriSecurise, {
        ddCustom: repoCtx.ddBivouac,
        coutPA,
        mode,
      });
      etat.personnage = res.personnageModifie;
      adjudication = res.adjudication;

      // Avancement de 8 heures + déclenchement du World Tick autonome
      const evtMonde = avancerTempsEtMonde(etat, 8, { forcerTick: true });
      if (evtMonde) {
        evenementFactionTexte = evtMonde;
      }

      // Risque d'embuscade nocturne en bivouac dangereux sans garde mercenaire
      if (repoCtx.risqueEmbuscade && !repoCtx.avecGardeMercenaire) {
        const jetVeille = lancerD20('normal').valeurRetenue;
        const seuilEmbuscade = etat.hexActuel.securite === 'Périlleux' ? 14 : 17;
        if (jetVeille >= seuilEmbuscade) {
          const ennemi = {
            id: `mob_nuit_${Date.now()}`,
            nom: etat.hexActuel.terrain === 'Marais Fétide' ? 'Rôdeur des vases' : 'Pillard nocturne',
            type: 'BANDIT' as const,
            pv: 10,
            pvMax: 10,
            ca: 12,
            initiative: 0,
            distancePieds: 20,
            statut: 'ACTIF' as const,
            bonusAttaque: 3,
            degatsDes: '1d6+1',
            comportement: 'TACTIQUE_COORDINATION' as const,
          };
          const initCombat = initialiserCombat(etat.personnage, [ennemi]);
          const tourInit = resoudreToursJusquaJoueur(etat.personnage, initCombat, { estDebutCombat: true });
          etat.combat = tourInit.combatModifie;
          etat.personnage = tourInit.personnageModifie;
          adjudication.mutations_etat.descriptionTechnique += ` [Veille rompue : ${ennemi.nom} approche du feu de camp !]`;
        }
      } else if (!repoCtx.estEnBourgade && !etat.combat.actif) {
        const enc = tenterRencontrePnjItinerant(etat, 'REST');
        if (enc) {
          adjudication.mutations_etat.descriptionTechnique += ` [${enc.description}]`;
          pnjApproche = {
            id: enc.pnj.id,
            nom: enc.pnj.label,
            role: enc.pnj.proprietes?.profession || 'Voyageur',
            motif: enc.pnj.proprietes?.motifRencontre || 'Rejoint votre feu de camp.',
          };
        }
      }
      break;
    }

    case 'ATTAQUER': {
      if (!etat.combat.actif || !action.cibleId) {
        throw new Error('Aucun combat en cours ou cible non spécifiée');
      }
      const res = executerAttaqueJoueur(
        etat.personnage,
        etat.combat,
        action.cibleId,
        {
          nom: 'Épée bâtarde',
          degats: '1d8+2',
          type: 'cac',
        },
        {
          verifierPorteeStricte: true,
          dansObscurite: estDansObscuriteSansLumiere(etat),
        }
      );
      etat.combat = res.combatModifie;
      etat.personnage = res.personnageModifie;
      adjudication = res.adjudication;
      break;
    }

    case 'DEPLACER_COMBAT': {
      if (!etat.combat.actif) throw new Error('Aucun combat actif');
      const dir = action.payloadAction?.direction === 'eloigner' ? 'eloigner' : 'rapprocher';
      const res = executerDeplacementCombat(etat.personnage, etat.combat, dir, action.cibleId);
      etat.combat = res.combatModifie;
      etat.personnage = res.personnageModifie;
      adjudication = res.adjudication;
      break;
    }

    case 'DESENGAGER_COMBAT': {
      if (!etat.combat.actif) throw new Error('Aucun combat actif');
      const res = executerDesengagementJoueur(etat.personnage, etat.combat);
      etat.combat = res.combatModifie;
      etat.personnage = res.personnageModifie;
      adjudication = res.adjudication;
      break;
    }

    case 'TOUR_ENNEMI': {
      if (!etat.combat.actif) throw new Error('Aucun combat actif');
      const ennemiVivant = etat.combat.ennemis.find(e => e.statut === 'ACTIF');
      if (!ennemiVivant) {
        etat.combat.actif = false;
        adjudication = {
          phase: 'adjudication_resolved',
          action_type: 'TACTICAL_FLEE',
          dice_roll: 0,
          modificateur: 0,
          score_total: 0,
          cible_dd_ou_ca: 0,
          issue: 'SUCCESS',
          mutations_etat: { descriptionTechnique: 'Fin des hostilités.' },
        };
      } else {
        const res = resoudreToursJusquaJoueur(etat.personnage, etat.combat, { estDebutCombat: false });
        etat.combat = res.combatModifie;
        etat.personnage = res.personnageModifie;
        adjudication = res.adjudication;
      }
      break;
    }

    case 'JETS_MORT': {
      const res = executerJetSauvegardeMort(etat.personnage);
      etat.personnage = res.personnageModifie;
      adjudication = res.adjudication;
      break;
    }

    case 'ACTION_LIBRE': {
      const texte = (action.texteLibre || '').toLowerCase();
      const ctx = evaluerContexteLieu(etat);

      // Garde-fous réalistes : bloquer les actions impossibles hors lieu ou sans PNJ en vue
      const mentionneAchat =
        texte.includes('acheter') ||
        texte.includes('troc') ||
        texte.includes('marchand') ||
        texte.includes('comptoir') ||
        texte.includes('vendre');
      if (mentionneAchat && !ctx.peutCommercer) {
        adjudication = {
          phase: 'adjudication_resolved',
          action_type: 'SKILL_CHECK',
          competenceOuCarac: 'Commerce impossible',
          dice_roll: 0,
          modificateur: 0,
          score_total: 0,
          cible_dd_ou_ca: 0,
          issue: 'FAILURE',
          mutations_etat: {
            descriptionTechnique: `Action impossible ici (${etat.hexActuel.nom}) : ${ctx.raisonCommerce}.`,
          },
        };
        break;
      }

      const pnjNommeAbsent = [
        { mot: 'torvin', id: 'npc_forgeron_torvin', nom: 'Torvin le Forgeron' },
        { mot: 'rogar', id: 'npc_bailli_valgris', nom: 'Bailli Rogar' },
        { mot: 'bailli', id: 'npc_bailli_valgris', nom: 'Bailli Rogar' },
        { mot: 'elia', id: 'npc_sentinelle_porte', nom: 'Sentinelle Elia' },
        { mot: 'morn', id: 'npc_capitaine_morn', nom: 'Capitaine Morn' },
      ].find(p => texte.includes(p.mot) && !ctx.pnjsEnVue.some(v => v.id === p.id));

      if (pnjNommeAbsent) {
        adjudication = {
          phase: 'adjudication_resolved',
          action_type: 'NPC_INTERACTION',
          competenceOuCarac: 'Interlocuteur absent',
          dice_roll: 0,
          modificateur: 0,
          score_total: 0,
          cible_dd_ou_ca: 0,
          issue: 'FAILURE',
          mutations_etat: {
            descriptionTechnique: `Impossible : ${pnjNommeAbsent.nom} n'est pas dans votre champ de vision à ${etat.hexActuel.nom}.`,
          },
        };
        break;
      }

      if ((texte.includes('parler') || texte.includes('interroger') || texte.includes('demander')) && !ctx.peutDialoguer) {
        // Si le joueur appelle ou attend quelqu'un dehors, une rencontre peut survenir, sinon personne n'est là
        const enc = tenterRencontrePnjItinerant(etat, 'WAIT');
        if (enc) {
          pnjApproche = {
            id: enc.pnj.id,
            nom: enc.pnj.label,
            role: enc.pnj.proprietes?.profession || 'Voyageur',
            motif: enc.pnj.proprietes?.motifRencontre || 'S\'approche à portée de voix.',
          };
          adjudication = {
            phase: 'adjudication_resolved',
            action_type: 'NPC_INTERACTION',
            competenceOuCarac: 'Rencontre sur place',
            dice_roll: 12,
            modificateur: 0,
            score_total: 12,
            cible_dd_ou_ca: 10,
            issue: 'SUCCESS',
            mutations_etat: {
              descriptionTechnique: `À votre appel, ${enc.description}`,
            },
          };
          break;
        }

        adjudication = {
          phase: 'adjudication_resolved',
          action_type: 'NPC_INTERACTION',
          competenceOuCarac: 'Champ de vision vide',
          dice_roll: 0,
          modificateur: 0,
          score_total: 0,
          cible_dd_ou_ca: 0,
          issue: 'FAILURE',
          mutations_etat: {
            descriptionTechnique: `Personne en vue à ${etat.hexActuel.nom}. Aucun interlocuteur ne répond.`,
          },
        };
        break;
      }

      let carac: 'FOR' | 'DEX' | 'CON' | 'INT' | 'SAG' | 'CHA' = 'SAG';
      let dd = 15;
      let label = 'Test de caractéristique';

      if (texte.includes('forge') || texte.includes('arme') || texte.includes('minerai')) {
        carac = 'INT';
        dd = 13;
        label = 'Connaissance du fer / Estimation';
      } else if (texte.includes('discret') || texte.includes('cacher') || texte.includes('faufiler')) {
        carac = 'DEX';
        dd = 14;
        label = 'Discrétion';
      } else if (texte.includes('forcer') || texte.includes('briser') || texte.includes('grimper')) {
        carac = 'FOR';
        dd = 15;
        label = 'Athlétisme';
      } else if (texte.includes('parler') || texte.includes('négocier') || texte.includes('convaincre')) {
        carac = 'CHA';
        dd = 15;
        label = 'Persuasion';
      } else {
        carac = 'SAG';
        dd = 12;
        label = 'Observation des lieux';
      }

      const mod = calculerModificateur(etat.personnage.caracteristiques[carac]);
      const jet = lancerD20(etat.personnage.epuisement >= 1 ? 'desavantage' : 'normal');
      const total = jet.valeurRetenue + mod;
      const reussite = total >= dd;

      let extraRencontre = '';
      if (texte.includes('attendre') || texte.includes('guetter') || texte.includes('observer')) {
        const enc = tenterRencontrePnjItinerant(etat, 'WAIT');
        if (enc) {
          extraRencontre = ` [${enc.description}]`;
          pnjApproche = {
            id: enc.pnj.id,
            nom: enc.pnj.label,
            role: enc.pnj.proprietes?.profession || 'Voyageur',
            motif: enc.pnj.proprietes?.motifRencontre || 'Entre dans votre champ de vision.',
          };
        }
      }

      adjudication = {
        phase: 'adjudication_resolved',
        action_type: 'SKILL_CHECK',
        competenceOuCarac: `${label} (${carac})`,
        dice_roll: jet.valeurRetenue,
        modificateur: mod,
        score_total: total,
        cible_dd_ou_ca: dd,
        issue: reussite ? 'SUCCESS' : 'FAILURE',
        mutations_etat: {
          descriptionTechnique: `Test de ${carac} : ${reussite ? 'Succès' : 'Échec'} (${total} vs DD ${dd}). ${action.texteLibre}${extraRencontre}`,
        },
      };
      break;
    }

    case 'ESQUIVER': {
      if (!etat.combat.actif) throw new Error('Aucun combat actif pour esquiver');
      const res = executerEsquiveJoueur(etat.personnage, etat.combat);
      etat.combat = res.combatModifie;
      etat.personnage = res.personnageModifie;
      adjudication = res.adjudication;
      break;
    }

    case 'LANCER_SORT': {
      if (!etat.combat.actif && !action.sortNom?.includes('Soin')) {
        throw new Error('Sortilège offensif utilisable uniquement lors d\'un engagement');
      }
      const res = executerSortJoueur(
        etat.personnage,
        etat.combat,
        action.sortNom || 'Trait de feu',
        action.cibleId
      );
      etat.combat = res.combatModifie;
      etat.personnage = res.personnageModifie;
      adjudication = res.adjudication;
      break;
    }

    case 'FUIR_TACTIQUE': {
      if (!etat.combat.actif) throw new Error('Aucun combat actif duquel fuir');
      const res = executerFuiteJoueur(etat.personnage, etat.combat);
      etat.combat = res.combatModifie;
      etat.personnage = res.personnageModifie;
      adjudication = res.adjudication;
      break;
    }

    case 'CORVEE_TRAVAIL': {
      const ctx = evaluerContexteLieu(etat);
      const jobId = action.jobId || 'bois_palissade';
      if (!ctx.offresCorveesIds.includes(jobId)) {
        throw new Error(`Corvée indisponible ici : ${ctx.raisonCorvees}.`);
      }

      let heures = 2;
      let carac: 'FOR' | 'SAG' | 'DEX' = 'FOR';
      let dd = 11;
      let paGagne = 0;
      let poGagne = 0;
      let rationsGagnees = 0;
      let titreJob = 'Corvée de bois et palissade';

      if (jobId === 'bois_palissade') {
        titreJob = 'Corvée de bois et palissades';
        carac = 'FOR';
        dd = 11;
        heures = 2;
        paGagne = 5;
        rationsGagnees = 1;
      } else if (jobId === 'garde_nuit') {
        titreJob = 'Garde de nuit au bastion';
        carac = 'SAG';
        dd = 12;
        heures = 4;
        paGagne = 8;
      } else if (jobId === 'forge_assistance') {
        titreJob = 'Manœuvre à la forge de Torvin';
        carac = 'FOR';
        dd = 13;
        heures = 2;
        paGagne = etat.marche.penurieArmurerie ? 6 : 12;
      } else if (jobId === 'debroussaillage_sentier') {
        titreJob = 'Déblaiement des accès';
        carac = 'FOR';
        dd = 12;
        heures = 3;
        paGagne = 7;
        rationsGagnees = 1;
      } else if (jobId === 'chasse_ravitaillement') {
        titreJob = 'Approvisionnement en gibier';
        carac = 'SAG';
        dd = 13;
        heures = 3;
        poGagne = 1;
        rationsGagnees = 2;
      }

      const mod = calculerModificateur(etat.personnage.caracteristiques[carac]);
      const jet = lancerD20(etat.personnage.epuisement >= 1 ? 'desavantage' : 'normal');
      const total = jet.valeurRetenue + mod;
      const reussite = total >= dd;

      if (!reussite) {
        paGagne = Math.max(1, Math.floor(paGagne / 2));
        rationsGagnees = 0;
        poGagne = 0;
      }

      etat.personnage.monnaies.pa += paGagne;
      etat.personnage.monnaies.po += poGagne;
      etat.personnage.rationsJours = Math.min(
        etat.personnage.rationsMaxJours,
        etat.personnage.rationsJours + rationsGagnees
      );
      etat.personnage.heuresMarcheJour += heures;

      const evtMonde = avancerTempsEtMonde(etat, heures);
      if (evtMonde) {
        evenementFactionTexte = evtMonde;
      }

      const desc = reussite
        ? `${titreJob} menée à terme (${total} vs DD ${dd}). Paye : ${paGagne > 0 ? `${paGagne} PA ` : ''}${poGagne > 0 ? `${poGagne} PO ` : ''}${rationsGagnees > 0 ? `+${rationsGagnees} ration(s)` : ''}. (+${heures}h)`
        : `${titreJob} pénible (${total} vs DD ${dd}). Paye réduite : ${paGagne} PA. (+${heures}h)`;

      adjudication = {
        phase: 'adjudication_resolved',
        action_type: 'WORK_CONTRACT',
        competenceOuCarac: `${titreJob} (${carac})`,
        dice_roll: jet.valeurRetenue,
        modificateur: mod,
        score_total: total,
        cible_dd_ou_ca: dd,
        issue: reussite ? 'SUCCESS' : 'FAILURE',
        mutations_etat: {
          rationsDelta: rationsGagnees > 0 ? rationsGagnees : undefined,
          heuresEcoulees: heures,
          descriptionTechnique: desc,
        },
      };
      break;
    }

    case 'TROQUER': {
      const ctx = evaluerContexteLieu(etat);
      if (!ctx.peutCommercer) {
        throw new Error(`Commerce impossible ici : ${ctx.raisonCommerce}.`);
      }

      const modeCommerce = action.payloadAction?.mode as 'acheter' | 'vendre' | undefined;
      const quantite = Math.max(1, action.quantite || 1);

      // Revente SRD 5e à 50 % de la valeur catalogue
      if (modeCommerce === 'vendre') {
        const cibleVente = action.articleId || action.cibleId || '';
        const idxInv = etat.personnage.inventaire.findIndex(
          i => i.id === cibleVente || i.compendiumId === cibleVente || i.nom.toLowerCase() === cibleVente.toLowerCase()
        );
        if (idxInv === -1) {
          throw new Error('Objet introuvable dans le paquetage.');
        }
        const obj = etat.personnage.inventaire[idxInv];
        const qteVendue = Math.min(obj.quantite, quantite);
        const ficheSrd = obj.compendiumId ? obtenirFicheSrd(obj.compendiumId) : obtenirFicheSrd(obj.nom);
        const prixBaseUnitairePC =
          ficheSrd?.categorie === 'objet' ? ficheSrd.valeurPC : Math.max(10, Math.round((obj.valeurPO || 1) * 100));
        const gainTotalPC = Math.max(1, Math.floor((prixBaseUnitairePC * qteVendue) / 2));

        const soldeActuelPC = calculerValeurPC(etat.personnage.monnaies);
        const nouveauSoldePC = soldeActuelPC + gainTotalPC;
        etat.personnage.monnaies.po = Math.floor(nouveauSoldePC / 100);
        etat.personnage.monnaies.pa = Math.floor((nouveauSoldePC % 100) / 10);
        etat.personnage.monnaies.pc = nouveauSoldePC % 10;

        if (obj.quantite > qteVendue) {
          obj.quantite -= qteVendue;
        } else {
          etat.personnage.inventaire.splice(idxInv, 1);
        }

        const desc = `Revente (50 % SRD) : ${qteVendue}x ${obj.nom} cédé pour +${formaterPrixPC(gainTotalPC)}.`;
        adjudication = {
          phase: 'adjudication_resolved',
          action_type: 'TRADE',
          dice_roll: 20,
          modificateur: 0,
          score_total: 20,
          cible_dd_ou_ca: 0,
          issue: 'SUCCESS',
          mutations_etat: {
            objetPerdu: `${qteVendue}x ${obj.nom}`,
            descriptionTechnique: desc,
          },
        };
        break;
      }

      // Achat : alias historiques + IDs complets du Compendium SRD
      const ALIAS_COMPTOIR: Record<string, string> = {
        ration: 'item_ration',
        eau: 'item_eau',
        torche: 'item_torche',
        bandage: 'item_bandage',
        fleches: 'item_fleches',
        dague: 'item_dague',
      };

      const rawId = action.articleId || 'ration';
      const srdId = ALIAS_COMPTOIR[rawId] || rawId;
      const ficheObjet = obtenirFicheSrd(srdId);
      const itemSrd: ItemEntry | undefined = ficheObjet?.categorie === 'objet' ? ficheObjet : undefined;

      if (!itemSrd) {
        throw new Error(`Article inconnu au comptoir : ${rawId}.`);
      }

      const estFerTaxe =
        itemSrd.categorieComptoir === 'Armurerie' ||
        itemSrd.motsCles.includes('fer') ||
        rawId === 'fleches' ||
        rawId === 'dague';
      const estVivreTaxe =
        itemSrd.id === 'item_ration' ||
        itemSrd.id === 'item_eau' ||
        itemSrd.categorieComptoir === 'Survie';
      const mult =
        etat.marche.penurieArmurerie && estFerTaxe
          ? etat.marche.multiplicateurFer
          : etat.marche.penurieVivres && estVivreTaxe
          ? etat.marche.multiplicateurVivres || 1.0
          : 1.0;
      const coutTotalPC = Math.round(quantite * itemSrd.valeurPC * mult);
      const labelArticle = itemSrd.nom;

      const soldeJoueurPC = calculerValeurPC(etat.personnage.monnaies);

      if (soldeJoueurPC < coutTotalPC) {
        throw new Error(`Fonds insuffisants. Requis : ${formaterPrixPC(coutTotalPC)}.`);
      }

      const nouveauSoldePC = soldeJoueurPC - coutTotalPC;
      etat.personnage.monnaies.po = Math.floor(nouveauSoldePC / 100);
      etat.personnage.monnaies.pa = Math.floor((nouveauSoldePC % 100) / 10);
      etat.personnage.monnaies.pc = nouveauSoldePC % 10;

      let descObjet = '';
      if (rawId === 'ration' || itemSrd.id === 'item_ration') {
        const placeDispo = etat.personnage.rationsMaxJours - etat.personnage.rationsJours;
        const ajoute = Math.min(placeDispo, quantite);
        etat.personnage.rationsJours += ajoute;
        descObjet = `+${ajoute} ration(s)`;
      } else if (rawId === 'eau' || itemSrd.id === 'item_eau') {
        const placeDispo = Number((etat.personnage.eauMaxLitres - etat.personnage.eauLitres).toFixed(1));
        const ajoute = Math.min(placeDispo, quantite);
        etat.personnage.eauLitres = Number((etat.personnage.eauLitres + ajoute).toFixed(1));
        descObjet = `+${ajoute}L d'eau`;
      } else {
        const itemExistant = etat.personnage.inventaire.find(
          i => i.compendiumId === itemSrd.id || i.id === `item_${rawId}` || i.id === itemSrd.id
        );
        if (itemExistant) {
          itemExistant.quantite += quantite;
        } else {
          etat.personnage.inventaire.push({
            id: `${itemSrd.id}_${Date.now()}`,
            compendiumId: itemSrd.id,
            nom: labelArticle,
            poidsLbs: itemSrd.poidsLbs,
            valeurPO: Number((itemSrd.valeurPC / 100).toFixed(2)),
            quantite,
            degats: itemSrd.degats,
            typeDegats: itemSrd.typeDegats,
            proprietesArme: itemSrd.proprietesArme,
            caBase: itemSrd.caBase,
            categorie: itemSrd.sousCategorie,
          });
        }
        descObjet = `+${quantite} ${labelArticle}`;
      }

      const lieuAchat = ctx.aColporteurEnVue && !ctx.estEnBourgade
        ? 'auprès du colporteur'
        : ctx.aCaravaneSurPlace && !ctx.estEnBourgade
        ? 'auprès du convoi'
        : 'au comptoir';
      const noteMarche =
        etat.marche.penurieArmurerie && estFerTaxe
          ? ` (Fer x${etat.marche.multiplicateurFer})`
          : etat.marche.penurieVivres && estVivreTaxe
          ? ` (Vivres x${etat.marche.multiplicateurVivres})`
          : '';
      const desc = `Achat ${lieuAchat} : ${descObjet} pour ${formaterPrixPC(coutTotalPC)}.${noteMarche}`;

      adjudication = {
        phase: 'adjudication_resolved',
        action_type: 'TRADE',
        dice_roll: 20,
        modificateur: 0,
        score_total: 20,
        cible_dd_ou_ca: 0,
        issue: 'SUCCESS',
        mutations_etat: {
          objetObtenu: descObjet,
          descriptionTechnique: desc,
        },
      };
      break;
    }

    case 'DIALOGUER_PNJ': {
      const pnjId = action.pnjId;
      if (!pnjId || !estPnjEnVue(etat, pnjId)) {
        throw new Error('Interlocuteur hors de portée : aucun PNJ correspondant dans votre champ de vision.');
      }

      const pnjNoeud = etat.grapheNoeuds.find(n => n.id === pnjId)!;
      const nomPnj = pnjNoeud.label;
      const sujet = action.sujetDialogue || 'Situation locale et rumeurs';

      const dispActuelle = pnjNoeud.proprietes?.disposition || 'NEUTRE';
      const modDisp = dispActuelle === 'AMICAL' ? 2 : dispActuelle === 'MEFIANT' ? -2 : 0;

      const modCha = calculerModificateur(etat.personnage.caracteristiques.CHA) + modDisp;
      const jet = lancerD20(etat.personnage.epuisement >= 1 ? 'desavantage' : 'normal');
      const ddPnj = pnjNoeud.proprietes?.seuilDD || (pnjId === 'npc_capitaine_morn' ? 15 : 13);
      const total = jet.valeurRetenue + modCha;
      const reussite = total >= ddPnj;

      let nouvelleDisp: 'AMICAL' | 'NEUTRE' | 'MEFIANT' = dispActuelle;
      let humeur = 'Calme et attentif';
      if (reussite) {
        nouvelleDisp = total >= ddPnj + 4 ? 'AMICAL' : 'NEUTRE';
        humeur = total >= ddPnj + 4 ? 'Chaleureux et enclin aux confidences' : 'Courtois et posé';
      } else {
        nouvelleDisp = total <= ddPnj - 4 ? 'MEFIANT' : dispActuelle;
        humeur = 'Défensif et taciturne';
      }

      if (!pnjNoeud.proprietes) pnjNoeud.proprietes = {};
      pnjNoeud.proprietes.disposition = nouvelleDisp;
      pnjNoeud.proprietes.humeur = humeur;
      if (!pnjNoeud.proprietes.historiqueDialogue) pnjNoeud.proprietes.historiqueDialogue = [];
      pnjNoeud.proprietes.historiqueDialogue.unshift({
        date: `Jour ${etat.horloge.jour}, ${String(etat.horloge.heure).padStart(2, '0')}:00`,
        sujet,
        issue: reussite ? 'Échange constructif' : 'Réserve et retenue',
      });
      pnjNoeud.proprietes.historiqueDialogue = pnjNoeud.proprietes.historiqueDialogue.slice(0, 5);

      const sub = traverserGraphe(pnjId, etat.grapheNoeuds, etat.grapheLiens, 2);
      const filtre = filtrerParFrontiereDeConnaissance(sub, pnjId);
      const faitsConnus = filtre.faitsPertinents.join(' | ') || 'Aucun renseignement supplémentaire.';

      let rumeurAjoutee = '';
      if (reussite) {
        const rumeur = extraireRumeurPnj(etat, pnjNoeud);
        if (rumeur) {
          if (!etat.rumeurs) etat.rumeurs = [];
          etat.rumeurs.unshift(rumeur);
          rumeurAjoutee = ` Rumeur apprise : « ${rumeur.titre} ».`;
        }
      }

      const desc = reussite
        ? `Échange avec ${nomPnj} constructif (${total} vs DD ${ddPnj}). Disposition : ${nouvelleDisp.toLowerCase()}. ${faitsConnus}${rumeurAjoutee}`
        : `${nomPnj} reste sur la réserve (${total} vs DD ${ddPnj}). Disposition : ${nouvelleDisp.toLowerCase()}. ${humeur}.`;

      adjudication = {
        phase: 'adjudication_resolved',
        action_type: 'NPC_INTERACTION',
        competenceOuCarac: `Entretien avec ${nomPnj} (CHA)`,
        dice_roll: jet.valeurRetenue,
        modificateur: modCha,
        score_total: total,
        cible_dd_ou_ca: ddPnj,
        issue: reussite ? 'SUCCESS' : 'FAILURE',
        mutations_etat: {
          descriptionTechnique: desc,
        },
      };
      break;
    }

    case 'DEMANDER_RUMEURS': {
      const ctx = evaluerContexteLieu(etat);
      if (!ctx.peutDemanderRumeurs) {
        throw new Error('Aucun interlocuteur en vue pour recueillir des rumeurs.');
      }

      const pnj =
        (action.pnjId ? ctx.pnjsEnVue.find(p => p.id === action.pnjId) : undefined) ||
        ctx.pnjsEnVue[0];
      if (!pnj) {
        throw new Error('Interlocuteur hors champ de vision.');
      }

      const disp = pnj.proprietes?.disposition || 'NEUTRE';
      const modDisp = disp === 'AMICAL' ? 2 : disp === 'MEFIANT' ? -2 : 0;
      const modCha = calculerModificateur(etat.personnage.caracteristiques.CHA) + modDisp;
      const jet = lancerD20(etat.personnage.epuisement >= 1 ? 'desavantage' : 'normal');
      const dd = disp === 'AMICAL' ? 8 : disp === 'MEFIANT' ? 14 : 10;
      const total = jet.valeurRetenue + modCha;
      const reussite = total >= dd;

      let desc = '';
      if (reussite) {
        const rumeur = extraireRumeurPnj(etat, pnj);
        if (rumeur) {
          if (!etat.rumeurs) etat.rumeurs = [];
          etat.rumeurs.unshift(rumeur);
          desc = `${pnj.label} vous confie une nouvelle (${total} vs DD ${dd}) : « ${rumeur.titre} » — ${rumeur.texte}`;
        } else {
          desc = `${pnj.label} n'a rien entendu de nouveau depuis votre dernier échange.`;
        }
      } else {
        desc = `${pnj.label} élude vos questions (${total} vs DD ${dd}) et ne livre aucun bruit.`;
      }

      adjudication = {
        phase: 'adjudication_resolved',
        action_type: 'NPC_INTERACTION',
        competenceOuCarac: `Nouvelles auprès de ${pnj.label} (CHA)`,
        dice_roll: jet.valeurRetenue,
        modificateur: modCha,
        score_total: total,
        cible_dd_ou_ca: dd,
        issue: reussite ? 'SUCCESS' : 'FAILURE',
        mutations_etat: {
          descriptionTechnique: desc,
        },
      };
      break;
    }

    case 'ENGAGER_COMPAGNON': {
      const ctx = evaluerContexteLieu(etat);
      const typeChoisi = (action.payloadAction?.type || action.payloadAction?.typeCompagnon || 'MULET') as 'MULET' | 'PORTEUR' | 'MERCENAIRE';

      if (!ctx.recruesDisponiblesTypes.includes(typeChoisi)) {
        throw new Error(`Recrutement impossible ici : ${ctx.raisonCompagnons}.`);
      }

      let coutPA = 15;
      let nouveauCompagnon: Hireling = {
        id: `comp_${Date.now()}`,
        nom: 'Mulet de bât',
        type: 'MULET',
        coutJournalierPA: 3,
        chargeMaxLbs: 200,
        pv: 11,
        pvMax: 11,
      };

      if (typeChoisi === 'PORTEUR') {
        coutPA = 10;
        nouveauCompagnon = {
          id: `comp_${Date.now()}`,
          nom: 'Porteur journalier',
          type: 'PORTEUR' as const,
          coutJournalierPA: 4,
          chargeMaxLbs: 100,
          pv: 9,
          pvMax: 9,
        };
      } else if (typeChoisi === 'MERCENAIRE') {
        coutPA = 25;
        nouveauCompagnon = {
          id: `comp_${Date.now()}`,
          nom: 'Mercenaire d\'appoint',
          type: 'MERCENAIRE' as const,
          coutJournalierPA: 8,
          chargeMaxLbs: 60,
          pv: 13,
          pvMax: 13,
          bonusAttaque: 3,
        };
      }

      const totalPAJoueur = etat.personnage.monnaies.po * 10 + etat.personnage.monnaies.pa;
      if (totalPAJoueur < coutPA) {
        throw new Error(`Fonds insuffisants. Requis : ${coutPA} PA.`);
      }

      if (etat.personnage.monnaies.pa >= coutPA) {
        etat.personnage.monnaies.pa -= coutPA;
      } else {
        const reste = coutPA - etat.personnage.monnaies.pa;
        etat.personnage.monnaies.pa = 0;
        const poNecessaires = Math.ceil(reste / 10);
        etat.personnage.monnaies.po -= poNecessaires;
        etat.personnage.monnaies.pa += poNecessaires * 10 - reste;
      }

      if (!etat.personnage.compagnons) etat.personnage.compagnons = [];
      etat.personnage.compagnons.push(nouveauCompagnon);

      const desc = `Contrat signé : ${nouveauCompagnon.nom} recruté pour ${coutPA} PA. Charge utile +${nouveauCompagnon.chargeMaxLbs} lbs.`;
      adjudication = {
        phase: 'adjudication_resolved',
        action_type: 'WORK_CONTRACT',
        dice_roll: 20,
        modificateur: 0,
        score_total: 20,
        cible_dd_ou_ca: 0,
        issue: 'SUCCESS',
        mutations_etat: {
          descriptionTechnique: desc,
        },
      };
      break;
    }

    case 'CONGEDIER_COMPAGNON': {
      const idComp = action.cibleId || action.payloadAction?.compagnonId;
      const comp = etat.personnage.compagnons?.find(c => c.id === idComp);
      const nomComp = comp ? comp.nom : 'Compagnon';
      etat.personnage.compagnons = (etat.personnage.compagnons || []).filter(c => c.id !== idComp);

      adjudication = {
        phase: 'adjudication_resolved',
        action_type: 'WORK_CONTRACT',
        dice_roll: 0,
        modificateur: 0,
        score_total: 0,
        cible_dd_ou_ca: 0,
        issue: 'SUCCESS',
        mutations_etat: {
          descriptionTechnique: `${nomComp} remercié et congédié du groupe.`,
        },
      };
      break;
    }

    case 'ENTRETENIR_EQUIPEMENT': {
      const ctx = evaluerContexteLieu(etat);
      if (!ctx.peutEntretenirForge) {
        throw new Error(`Entretien impossible ici : ${ctx.raisonForge}.`);
      }

      const coutPA = 4;
      const totalPA = etat.personnage.monnaies.po * 10 + etat.personnage.monnaies.pa;
      if (totalPA < coutPA) {
        throw new Error(`Entretien impossible : 4 PA requis à la forge.`);
      }

      if (etat.personnage.monnaies.pa >= coutPA) {
        etat.personnage.monnaies.pa -= coutPA;
      } else {
        etat.personnage.monnaies.po -= 1;
        etat.personnage.monnaies.pa += 10 - coutPA;
      }

      etat.personnage = reparerEquipement(etat.personnage);
      adjudication = {
        phase: 'adjudication_resolved',
        action_type: 'WORK_CONTRACT',
        dice_roll: 15,
        modificateur: 0,
        score_total: 15,
        cible_dd_ou_ca: 10,
        issue: 'SUCCESS',
        mutations_etat: {
          descriptionTechnique: 'Entretien complet du harnois et des lames à la forge (4 PA). Usure remise à 0%.',
        },
      };
      break;
    }

    case 'BOUILLIR_EAU': {
      if (etat.personnage.eauLitres <= 0) {
        throw new Error('Aucune eau dans l\'outre à bouillir.');
      }
      if (etat.donjon?.actif) {
        throw new Error('Impossible d\'allumer un feu de camp dans ces galeries.');
      }
      etat.personnage.qualiteEau = 'Pure';
      const evtEau = avancerTempsEtMonde(etat, 1);
      if (evtEau) evenementFactionTexte = evtEau;

      adjudication = {
        phase: 'adjudication_resolved',
        action_type: 'FORAGE',
        dice_roll: 12,
        modificateur: 0,
        score_total: 12,
        cible_dd_ou_ca: 10,
        issue: 'SUCCESS',
        mutations_etat: {
          heuresEcoulees: 1,
          descriptionTechnique: 'Eau portée à ébullition. L\'outre contient désormais une eau pure.',
        },
      };
      break;
    }

    case 'EXPLORER_SITE': {
      const ctx = evaluerContexteLieu(etat);
      const poi = etat.hexActuel.pointInteret;
      if (!ctx.peutExplorerSite || !poi) {
        throw new Error(`Exploration impossible : ${ctx.raisonExplorerSite}.`);
      }

      const nomSite = poi.nom;
      let salles: DungeonState['salles'];

      if (poi.type === 'ruine') {
        salles = [
          {
            id: 'salle_1',
            nom: 'Parvis effondré',
            description: 'Des colonnes moussues émergent d\'une eau stagnante et sombre.',
            visitee: true,
            danger: 'AUCUN',
            fouillable: true,
            connexions: ['salle_2'],
          },
          {
            id: 'salle_2',
            nom: 'Nef submergée',
            description: 'Dalles glissantes et fresques rongées par le salpêtre.',
            visitee: false,
            danger: 'PIEGE',
            fouillable: true,
            connexions: ['salle_1', 'salle_3'],
          },
          {
            id: 'salle_3',
            nom: 'Caveau scellé',
            description: 'Sarcophage brisé entouré d\'offrandes oxydées.',
            visitee: false,
            danger: 'ENNEMI',
            tresorPO: 7,
            fouillable: true,
            connexions: ['salle_2'],
          },
        ];
      } else if (poi.type === 'camp') {
        salles = [
          {
            id: 'salle_1',
            nom: 'Abords du foyer éteint',
            description: 'Cendres froides et toiles lacérées sous la futaie.',
            visitee: true,
            danger: 'AUCUN',
            fouillable: true,
            connexions: ['salle_2'],
          },
          {
            id: 'salle_2',
            nom: 'Cache de ravitaillement',
            description: 'Fosse dissimulée sous des branchages piégés.',
            visitee: false,
            danger: 'PIEGE',
            tresorPO: 4,
            fouillable: true,
            connexions: ['salle_1', 'salle_3'],
          },
          {
            id: 'salle_3',
            nom: 'Abri sous roche',
            description: 'Refuge étroit où guette un rôdeur.',
            visitee: false,
            danger: 'ENNEMI',
            tresorPO: 5,
            fouillable: true,
            connexions: ['salle_2'],
          },
        ];
      } else if (poi.type === 'fort') {
        salles = [
          {
            id: 'salle_1',
            nom: 'Avant-cour palissadée',
            description: 'Râteliers d\'armes et barrières de bois ferré.',
            visitee: true,
            danger: 'AUCUN',
            fouillable: true,
            connexions: ['salle_2'],
          },
          {
            id: 'salle_2',
            nom: 'Chemin de ronde',
            description: 'Meurtrières étroites donnant sur la passe.',
            visitee: false,
            danger: 'PIEGE',
            fouillable: true,
            connexions: ['salle_1', 'salle_3'],
          },
          {
            id: 'salle_3',
            nom: 'Salle de garde',
            description: 'Coffre de péage et cartes militaires étalées.',
            visitee: false,
            danger: 'ENNEMI',
            tresorPO: 8,
            fouillable: true,
            connexions: ['salle_2'],
          },
        ];
      } else {
        salles = [
          {
            id: 'salle_1',
            nom: 'Entrée éboulée',
            description: 'Boyau étroit consolidé par des étais vermoulus.',
            visitee: true,
            danger: 'AUCUN',
            fouillable: true,
            connexions: ['salle_2'],
          },
          {
            id: 'salle_2',
            nom: 'Galerie médiane affaissée',
            description: 'Dalles disjointes surplombant une crevasse instable.',
            visitee: false,
            danger: 'PIEGE',
            fouillable: true,
            connexions: ['salle_1', 'salle_3'],
          },
          {
            id: 'salle_3',
            nom: 'Cavité terminale',
            description: 'Ancienne excavation d\'extraction de fer et gravats.',
            visitee: false,
            danger: 'ENNEMI',
            tresorPO: 6,
            fouillable: true,
            connexions: ['salle_2'],
          },
        ];
      }

      etat.donjon = {
        actif: true,
        poiId: poi.id,
        nom: nomSite,
        salleActuelleId: 'salle_1',
        salles,
        journalDonjon: [`Pénétration dans le site : ${nomSite}.`],
      };

      const evtSite = avancerTempsEtMonde(etat, 1);
      if (evtSite) evenementFactionTexte = evtSite;

      adjudication = {
        phase: 'adjudication_resolved',
        action_type: 'TRAVEL',
        dice_roll: 14,
        modificateur: 0,
        score_total: 14,
        cible_dd_ou_ca: 10,
        issue: 'SUCCESS',
        mutations_etat: {
          heuresEcoulees: 1,
          descriptionTechnique: `Exploration engagée dans ${nomSite}.`,
        },
      };
      break;
    }

    case 'DONJON_DEPLACEMENT': {
      if (!etat.donjon || !etat.donjon.actif) throw new Error('Aucun donjon actif');
      const cibleSalleId = action.cibleId || action.payloadAction?.salleCibleId;
      const salleActuelle = etat.donjon.salles.find(s => s.id === etat.donjon!.salleActuelleId);
      const salleCible = etat.donjon.salles.find(s => s.id === cibleSalleId);

      if (!salleActuelle || !salleCible || !salleActuelle.connexions.includes(cibleSalleId || '')) {
        throw new Error('Déplacement impossible : issue non connectée.');
      }

      etat.donjon.salleActuelleId = salleCible.id;
      let technique = `Progression vers : ${salleCible.nom}.`;

      if (!salleCible.visitee) {
        salleCible.visitee = true;
        if (salleCible.danger === 'PIEGE') {
          const caracPiege = salleCible.piegeCarac || 'DEX';
          const ddPiege = salleCible.piegeDD || 12;
          const degatsFormule = salleCible.piegeDegats || '1d4';
          const descPiege = salleCible.piegeDesc || 'Éboulis rocheux';
          const estMaitriseSave = (etat.personnage.sauvegardesMaitrisees || []).includes(caracPiege);
          const modSave =
            calculerModificateur(etat.personnage.caracteristiques[caracPiege]) +
            (estMaitriseSave ? etat.personnage.bonusMaitrise : 0);
          const jet = lancerD20(etat.personnage.epuisement >= 3 ? 'desavantage' : 'normal');
          const total = jet.valeurRetenue + modSave;
          if (total < ddPiege) {
            const degats = Math.max(1, interpreterJetDegats(degatsFormule));
            etat.personnage.pvActuels = Math.max(0, etat.personnage.pvActuels - degats);
            if (etat.personnage.pvActuels === 0 && !etat.personnage.conditions.includes('Inconscient')) {
              etat.personnage.conditions.push('Inconscient');
            }
            technique += ` Piège déclenché ! ${descPiege} (Sauv. ${caracPiege} ${total} vs DD ${ddPiege}) : -${degats} PV.`;
          } else {
            technique += ` Piège évité : ${descPiege} (Sauv. ${caracPiege} ${total} vs DD ${ddPiege}).`;
          }
        } else if (salleCible.danger === 'ENNEMI') {
          const ennemisSalle: ReturnType<typeof creerCombatantDepuisMonstre>[] = [];
          if (Array.isArray(salleCible.monstreIds) && salleCible.monstreIds.length > 0) {
            for (let idx = 0; idx < Math.min(4, salleCible.monstreIds.length); idx += 1) {
              const fiche = obtenirFicheSrd(salleCible.monstreIds[idx]);
              if (fiche?.categorie === 'monstre') {
                const mob = creerCombatantDepuisMonstre(fiche, `dungeon_${Date.now()}_${idx}`);
                if (salleCible.monstreIds.length > 1) {
                  mob.nom = `${mob.nom} #${idx + 1}`;
                }
                ennemisSalle.push(mob);
              }
            }
          }

          if (ennemisSalle.length === 0) {
            const monstresDonjon = rechercherCompendium({
              categorie: 'monstre',
              biome: 'Donjon',
              fpMax: Math.max(1, etat.personnage.niveau),
              limite: 8,
            })
              .map(r => r.entry)
              .filter((e): e is MonsterEntry => e.categorie === 'monstre');
            const monstreChoisi =
              monstresDonjon.length > 0
                ? monstresDonjon[Math.floor(Math.random() * monstresDonjon.length)]
                : (obtenirFicheSrd('mon_gobelin') as MonsterEntry | undefined);

            const ennemi = monstreChoisi
              ? creerCombatantDepuisMonstre(monstreChoisi, `dungeon_${Date.now()}`)
              : {
                  id: `mob_dungeon_${Date.now()}`,
                  nom: 'Garde Gobelin Tapi',
                  type: 'GOBELIN' as const,
                  pv: 7,
                  pvMax: 7,
                  ca: 15,
                  initiative: 0,
                  distancePieds: 20,
                  statut: 'ACTIF' as const,
                  bonusAttaque: 4,
                  degatsDes: '1d6+2',
                  comportement: 'RUSE_ET_FUITE' as const,
                };
            ennemisSalle.push(ennemi);
          }

          const initCombat = initialiserCombat(etat.personnage, ennemisSalle);
          const tourInit = resoudreToursJusquaJoueur(etat.personnage, initCombat, { estDebutCombat: true });
          etat.combat = tourInit.combatModifie;
          etat.personnage = tourInit.personnageModifie;
          technique += ` Embuscade : ${ennemisSalle.map(e => `${e.nom} (FP ${e.fp || '1/4'})`).join(', ')} !`;
        }
      }

      if (etat.personnage.sourceLumiere?.active) {
        const lum = consommerHeuresLumiere(etat.personnage, 0.5);
        etat.personnage = lum.personnageModifie;
        if (lum.message) technique += ` ${lum.message}`;
      }

      etat.donjon.journalDonjon.push(technique);

      adjudication = {
        phase: 'adjudication_resolved',
        action_type: 'TRAVEL',
        dice_roll: 12,
        modificateur: 0,
        score_total: 12,
        cible_dd_ou_ca: 10,
        issue: 'SUCCESS',
        mutations_etat: {
          descriptionTechnique: technique,
        },
      };
      break;
    }

    case 'DONJON_FOUILLER': {
      if (!etat.donjon || !etat.donjon.actif) throw new Error('Aucun donjon actif');
      const salle = etat.donjon.salles.find(s => s.id === etat.donjon!.salleActuelleId);
      if (!salle) throw new Error('Salle introuvable');
      if (!salle.fouillable) throw new Error('Cette salle a déjà été minutieusement fouillée.');

      const sansLumiere = estDansObscuriteSansLumiere(etat);
      const modInt = calculerModificateur(etat.personnage.caracteristiques.INT);
      const jet = lancerD20(sansLumiere ? 'desavantage' : 'normal');
      const total = jet.valeurRetenue + modInt;
      const dd = 12;
      const reussite = total >= dd;
      salle.fouillable = false;

      if (etat.personnage.sourceLumiere?.active) {
        const lum = consommerHeuresLumiere(etat.personnage, 0.5);
        etat.personnage = lum.personnageModifie;
      }

      let gainPO = 0;
      if (reussite) {
        gainPO = salle.tresorPO || 3;
        etat.personnage.monnaies.po += gainPO;
        etat.personnage.experience += 50;
      }

      const desc = reussite
        ? `Fouille minutieuse fructueuse (${total} vs DD ${dd}${sansLumiere ? ', obscurité' : ''}) : découverte de filons et débris de valeur (+${gainPO} PO, +50 XP).`
        : `Fouille infructueuse (${total} vs DD ${dd}${sansLumiere ? ', obscurité' : ''}) : gravats stériles.`;

      etat.donjon.journalDonjon.push(desc);

      adjudication = {
        phase: 'adjudication_resolved',
        action_type: 'SKILL_CHECK',
        competenceOuCarac: 'Investigation (INT)',
        dice_roll: jet.valeurRetenue,
        modificateur: modInt,
        score_total: total,
        cible_dd_ou_ca: dd,
        issue: reussite ? 'SUCCESS' : 'FAILURE',
        mutations_etat: {
          descriptionTechnique: desc,
        },
      };
      break;
    }

    case 'DONJON_SORTIR': {
      if (!etat.donjon) throw new Error('Aucun donjon actif');
      const nom = etat.donjon.nom;
      etat.donjon = null;

      adjudication = {
        phase: 'adjudication_resolved',
        action_type: 'TRAVEL',
        dice_roll: 10,
        modificateur: 0,
        score_total: 10,
        cible_dd_ou_ca: 0,
        issue: 'SUCCESS',
        mutations_etat: {
          descriptionTechnique: `Sortie sécurisée du site ${nom}. Retour à la surface.`,
        },
      };
      break;
    }

    case 'ENTRAINEMENT_NIVEAU': {
      const ctx = evaluerContexteLieu(etat);
      if (!ctx.peutEntrainerNiveau) {
        throw new Error(`Entraînement impossible ici : ${ctx.raisonEntrainement}.`);
      }

      const coutPO = 5;
      if (etat.personnage.monnaies.po < coutPO) {
        throw new Error(`Entraînement impossible : 5 PO requis pour l'instructeur.`);
      }

      const resNiveau = evaluerMonteeNiveau(etat.personnage);
      if (!resNiveau.estMonteeNiveau) {
        throw new Error(`Expérience insuffisante (${etat.personnage.experience} / ${etat.personnage.experienceNextLevel} XP requis).`);
      }

      etat.personnage = resNiveau.personnageModifie;
      etat.personnage.monnaies.po -= coutPO;

      const desc = `Entraînement auprès du maître d'armes (5 PO). Passage au Niveau ${etat.personnage.niveau} (PV max : ${etat.personnage.pvMax}).`;
      adjudication = {
        phase: 'adjudication_resolved',
        action_type: 'WORK_CONTRACT',
        dice_roll: 20,
        modificateur: 0,
        score_total: 20,
        cible_dd_ou_ca: 0,
        issue: 'SUCCESS',
        mutations_etat: {
          descriptionTechnique: desc,
        },
      };
      break;
    }

    case 'PREPARER_SORT': {
      const sortId = action.cibleId || action.payloadAction?.sortId;
      const resPrep = preparerSort(etat.personnage, sortId);
      etat.personnage = resPrep.personnageModifie;

      adjudication = {
        phase: 'adjudication_resolved',
        action_type: 'SPELL',
        dice_roll: 10,
        modificateur: 0,
        score_total: 10,
        cible_dd_ou_ca: 0,
        issue: resPrep.succes ? 'SUCCESS' : 'FAILURE',
        mutations_etat: {
          descriptionTechnique: resPrep.message,
        },
      };
      break;
    }

    case 'LANCER_SORT_GRIMOIRE': {
      const sortId = action.cibleId || action.payloadAction?.sortId;
      const cibleCombatId = action.payloadAction?.cibleCombatId;
      const resSort = executerSortGrimoire(etat.personnage, sortId, etat.combat, cibleCombatId);
      etat.personnage = resSort.personnageModifie;
      if (resSort.combatModifie) etat.combat = resSort.combatModifie;
      adjudication = resSort.adjudication;
      break;
    }

    case 'FABRIQUER_OBJET': {
      const ctx = evaluerContexteLieu(etat);
      const recetteId = action.cibleId || action.payloadAction?.recetteId;
      if (!ctx.recettesDisponiblesIds.includes(recetteId)) {
        throw new Error(ctx.raisonsRecettes[recetteId] || 'Fabrication impossible dans ce lieu.');
      }

      const resCraft = fabriquerObjetBivouac(etat.personnage, recetteId);
      etat.personnage = resCraft.personnageModifie;
      adjudication = resCraft.adjudication;
      const evtCraft = avancerTempsEtMonde(etat, 1);
      if (evtCraft) evenementFactionTexte = evtCraft;
      break;
    }

    case 'SOIGNER_BLESSURE': {
      const ctx = evaluerContexteLieu(etat);
      const blessureId = action.cibleId || action.payloadAction?.blessureId;
      const avecRemede = action.payloadAction?.avecRemede !== false;
      const resSoin = soignerBlessure(etat.personnage, blessureId, avecRemede, ctx.estEnBourgade);
      etat.personnage = resSoin.personnageModifie;
      adjudication = resSoin.adjudication;
      break;
    }

    case 'ANNOTER_HEX': {
      const hexId = action.cibleId || etat.hexActuel.id;
      const note = action.texteLibre || action.payloadAction?.note || '';
      etat.hexagones = etat.hexagones.map(h => {
        if (h.id === hexId) {
          return { ...h, annotationJoueur: note };
        }
        return h;
      });
      if (etat.hexActuel.id === hexId) {
        etat.hexActuel.annotationJoueur = note;
      }

      if (etat.azgaarStudio) {
        const hxTarget = etat.hexagones.find(h => h.id === hexId);
        const markerId = `m_note_${hexId}`;
        if (!note.trim()) {
          etat.azgaarStudio.markers = etat.azgaarStudio.markers.filter(m => m.id !== markerId);
        } else if (hxTarget) {
          const pos = projeterHexVersMondeAzgaar(hxTarget, etat.azgaarStudio);
          const titre = (hxTarget.nom || hexId).slice(0, 48);
          const existant = etat.azgaarStudio.markers.find(m => m.id === markerId);
          if (existant) {
            existant.title = titre;
            existant.note = note.trim().slice(0, 200);
          } else {
            etat.azgaarStudio.markers.push({
              id: markerId,
              icon: 'note',
              title: titre,
              note: note.trim().slice(0, 200),
              x: Math.round(pos.x),
              y: Math.round(pos.y),
              author: 'JOUEUR',
              createdDay: etat.horloge.jour,
            });
          }
        }
      }

      adjudication = {
        phase: 'adjudication_resolved',
        action_type: 'TRAVEL',
        dice_roll: 10,
        modificateur: 0,
        score_total: 10,
        cible_dd_ou_ca: 0,
        issue: 'SUCCESS',
        mutations_etat: {
          descriptionTechnique: `Carnet cartographique annoté : "${note || '(repère effacé)'}".`,
        },
      };
      break;
    }

    case 'EQUIPER_OBJET': {
      const itemId = action.cibleId || action.payloadAction?.itemId;
      if (!itemId) throw new Error('Objet à équiper non spécifié.');
      const res = equiperObjet(etat.personnage, itemId);
      etat.personnage = res.personnageModifie;
      adjudication = {
        phase: 'adjudication_resolved',
        action_type: 'EQUIPMENT',
        competenceOuCarac: res.equipe ? 'Équipement porté' : 'Équipement retiré',
        dice_roll: 10,
        modificateur: 0,
        score_total: 10,
        cible_dd_ou_ca: 0,
        issue: 'SUCCESS',
        mutations_etat: {
          descriptionTechnique: res.message,
        },
      };
      break;
    }

    case 'UTILISER_OBJET': {
      const itemId = action.cibleId || action.payloadAction?.itemId;
      if (!itemId) throw new Error('Objet à utiliser non spécifié.');
      const res = utiliserObjet(etat.personnage, itemId);
      etat.personnage = res.personnageModifie;
      if (etat.combat.actif) {
        if (etat.combat.actionDisponible === false) {
          throw new Error('Action déjà dépensée ce tour.');
        }
        etat.combat.actionDisponible = false;
        etat.combat.journalCombat.push(res.message);
      }
      adjudication = {
        phase: 'adjudication_resolved',
        action_type: 'EQUIPMENT',
        competenceOuCarac: 'Objet consommé',
        dice_roll: 10,
        modificateur: 0,
        score_total: 10,
        cible_dd_ou_ca: 0,
        issue: 'SUCCESS',
        mutations_etat: {
          pvDelta: res.pvDelta > 0 ? res.pvDelta : undefined,
          descriptionTechnique: res.message,
        },
      };
      break;
    }

    case 'JETER_OBJET': {
      const itemId = action.cibleId || action.payloadAction?.itemId;
      if (!itemId) throw new Error('Objet à abandonner non spécifié.');
      const res = jeterObjet(etat.personnage, itemId, action.quantite || 1);
      etat.personnage = res.personnageModifie;
      adjudication = {
        phase: 'adjudication_resolved',
        action_type: 'EQUIPMENT',
        competenceOuCarac: 'Délestage',
        dice_roll: 10,
        modificateur: 0,
        score_total: 10,
        cible_dd_ou_ca: 0,
        issue: 'SUCCESS',
        mutations_etat: {
          descriptionTechnique: res.message,
        },
      };
      break;
    }

    case 'BASCULER_LUMIERE': {
      const forcer = typeof action.payloadAction?.active === 'boolean' ? action.payloadAction.active : undefined;
      const res = basculerSourceLumiere(etat.personnage, forcer);
      etat.personnage = res.personnageModifie;
      adjudication = {
        phase: 'adjudication_resolved',
        action_type: 'EQUIPMENT',
        competenceOuCarac: 'Source de lumière',
        dice_roll: 10,
        modificateur: 0,
        score_total: 10,
        cible_dd_ou_ca: 0,
        issue: 'SUCCESS',
        mutations_etat: {
          descriptionTechnique: res.message,
        },
      };
      break;
    }

    case 'CONFIGURER_VOYAGE': {
      const allure = action.payloadAction?.allure;
      const role = action.payloadAction?.role;
      if (allure === 'Lente' || allure === 'Normale' || allure === 'Rapide') {
        etat.marcheAllure = allure;
      }
      if (role === 'S\'orienter' || role === 'Forager' || role === 'Guetter') {
        etat.roleExploration = role;
      }
      adjudication = {
        phase: 'adjudication_resolved',
        action_type: 'TRAVEL',
        competenceOuCarac: 'Préparation de marche',
        dice_roll: 10,
        modificateur: 0,
        score_total: 10,
        cible_dd_ou_ca: 0,
        issue: 'SUCCESS',
        mutations_etat: {
          descriptionTechnique: `Allure : ${etat.marcheAllure} · Rôle : ${etat.roleExploration}.`,
        },
      };
      break;
    }

    case 'IMPORTER_HEROS': {
      const heroInput = action.payloadAction?.hero || action.payloadAction;
      if (!heroInput || typeof heroInput !== 'object') {
        throw new Error('Données du héros à importer manquantes.');
      }
      const dateStr = `Jour ${etat.horloge.jour}, ${String(etat.horloge.heure).padStart(2, '0')}:00`;
      etat.personnage = construirePersonnageDepuisImport(heroInput, etat.personnage, dateStr);
      const nbDocs = etat.personnage.documents?.length || 0;
      const desc = `Héros importé : ${etat.personnage.nom} (${etat.personnage.race || 'Humain'} · ${etat.personnage.classe} Niv ${etat.personnage.niveau}, CA ${etat.personnage.ca}, PV ${etat.personnage.pvMax})${nbDocs > 0 ? ` avec ${nbDocs} document(s)` : ''}.`;
      adjudication = {
        phase: 'adjudication_resolved',
        action_type: 'CHARACTER_UPDATE',
        competenceOuCarac: 'Importation de héros',
        dice_roll: 20,
        modificateur: 0,
        score_total: 20,
        cible_dd_ou_ca: 0,
        issue: 'SUCCESS',
        mutations_etat: {
          descriptionTechnique: desc,
        },
      };
      break;
    }

    case 'METTRE_A_JOUR_HEROS': {
      const patch = action.payloadAction?.patch || action.payloadAction || {};
      const res = appliquerMiseAJourHeros(etat.personnage, patch);
      etat.personnage = res.personnageModifie;
      adjudication = {
        phase: 'adjudication_resolved',
        action_type: 'CHARACTER_UPDATE',
        competenceOuCarac: 'Mise à jour de fiche',
        dice_roll: 10,
        modificateur: 0,
        score_total: 10,
        cible_dd_ou_ca: 0,
        issue: 'SUCCESS',
        mutations_etat: {
          descriptionTechnique: res.message,
        },
      };
      break;
    }

    case 'GERER_DOCUMENT_HEROS': {
      const op = action.payloadAction as any;
      if (!op || !op.mode) {
        throw new Error('Opération documentaire invalide.');
      }
      const dateStr = `Jour ${etat.horloge.jour}`;
      const res = gererDocumentHeros(etat.personnage, op, dateStr);
      etat.personnage = res.personnageModifie;
      adjudication = {
        phase: 'adjudication_resolved',
        action_type: 'CHARACTER_UPDATE',
        competenceOuCarac: 'Dossier du héros',
        dice_roll: 10,
        modificateur: 0,
        score_total: 10,
        cible_dd_ou_ca: 0,
        issue: 'SUCCESS',
        mutations_etat: {
          descriptionTechnique: res.message,
        },
      };
      break;
    }

    case 'CONFIGURER_NARRATION': {
      const mode = action.payloadAction?.mode;
      if (mode === 'ULTRA_COURT' || mode === 'CONCIS' || mode === 'DEVELOPPE') {
        etat.modeNarration = mode;
      }
      const libMode =
        etat.modeNarration === 'ULTRA_COURT'
          ? 'Ultra-court'
          : etat.modeNarration === 'DEVELOPPE'
          ? 'Développé'
          : 'Concis';
      adjudication = {
        phase: 'adjudication_resolved',
        action_type: 'NARRATION_CONFIG',
        competenceOuCarac: 'Style du récit',
        dice_roll: 10,
        modificateur: 0,
        score_total: 10,
        cible_dd_ou_ca: 0,
        issue: 'SUCCESS',
        mutations_etat: {
          descriptionTechnique: `Narration réglée sur : ${libMode}.`,
        },
      };
      break;
    }

    case 'CONFIGURER_MODELE_IA': {
      const profil = action.payloadAction?.profil === 'MAX' ? 'MAX' : 'STANDARD';
      etat.profilHydrogen = profil;
      adjudication = {
        phase: 'adjudication_resolved',
        action_type: 'CHARACTER_UPDATE',
        competenceOuCarac: 'Profil Gemini 4 Hydrogen',
        dice_roll: 10,
        modificateur: 0,
        score_total: 10,
        cible_dd_ou_ca: 0,
        issue: 'SUCCESS',
        mutations_etat: {
          descriptionTechnique: `MJ IA réglé sur Gemini 4 Hydrogen ${profil === 'MAX' ? 'Max' : 'Standard'}.`,
        },
      };
      break;
    }

    case 'RESOUDRE_JET_DEMANDE': {
      const jetReq = etat.jetEnAttente;
      if (!jetReq) {
        throw new Error('Aucun jet en attente.');
      }
      const choix = action.payloadAction?.choix === 'alternatif' ? 'alternatif' : 'lancer';
      etat.jetEnAttente = null;

      if (choix === 'alternatif' && jetReq.optionAlternative) {
        adjudication = {
          phase: 'adjudication_resolved',
          action_type: jetReq.typeJet === 'sauvegarde' ? 'SAVING_THROW' : 'SKILL_CHECK',
          competenceOuCarac: `Alternative : ${jetReq.optionAlternative}`,
          dice_roll: 10,
          modificateur: 0,
          score_total: 10,
          cible_dd_ou_ca: jetReq.dd,
          issue: 'SUCCESS',
          mutations_etat: {
            descriptionTechnique: `Choix alternatif retenu face à « ${jetReq.titre} » : ${jetReq.optionAlternative}.`,
          },
        };
        break;
      }

      const carac = jetReq.caracteristique || 'DEX';
      const estSave = jetReq.typeJet === 'sauvegarde';
      const estMaitrise = estSave
        ? (etat.personnage.sauvegardesMaitrisees || []).includes(carac)
        : Boolean(
            jetReq.competence &&
              (etat.personnage.competencesMaitrisees || []).some(
                c => c.toLowerCase() === jetReq.competence!.toLowerCase()
              )
          );
      const modBase = calculerModificateur(etat.personnage.caracteristiques[carac]);
      const modTotal = modBase + (estMaitrise ? etat.personnage.bonusMaitrise : 0);
      const aDesavantage = estSave ? etat.personnage.epuisement >= 3 : etat.personnage.epuisement >= 1;
      const typeLancer = aDesavantage ? 'desavantage' : 'normal';
      const lancer = lancerD20(typeLancer);
      const total = lancer.valeurRetenue + modTotal;
      let issue: AdjudicationPayload['issue'] = total >= jetReq.dd ? 'SUCCESS' : 'FAILURE';
      if (lancer.valeurRetenue === 20) issue = 'CRITICAL_SUCCESS';
      if (lancer.valeurRetenue === 1) issue = 'CRITICAL_FAILURE';

      const reussite = issue === 'SUCCESS' || issue === 'CRITICAL_SUCCESS';
      const libTest = estSave
        ? `Sauvegarde ${carac}`
        : `${jetReq.competence || 'Test'} (${carac})`;
      const enjeuRetenu = reussite ? jetReq.enjeuSucces : jetReq.enjeuEchec;
      const desc = `${jetReq.titre} — ${libTest} : ${
        issue === 'CRITICAL_SUCCESS'
          ? 'Succès critique (20)'
          : issue === 'CRITICAL_FAILURE'
          ? 'Échec critique (1)'
          : reussite
          ? 'Succès'
          : 'Échec'
      } (${total} vs DD ${jetReq.dd}). Conséquence prévue : ${enjeuRetenu}`;

      adjudication = {
        phase: 'adjudication_resolved',
        action_type: estSave ? 'SAVING_THROW' : 'SKILL_CHECK',
        competenceOuCarac: `${libTest} · ${jetReq.titre}`,
        dice_roll: lancer.valeurRetenue,
        deuxieme_de: lancer.de2,
        type_lancer: typeLancer,
        modificateur: modTotal,
        score_total: total,
        cible_dd_ou_ca: jetReq.dd,
        issue,
        mutations_etat: {
          descriptionTechnique: desc,
        },
      };
      break;
    }

    case 'AJOUTER_QUETE': {
      if (!etat.memoireMJ) {
        etat.memoireMJ = { filNarratif: [], promessesEtQuetes: [], consequencesDifferees: [] };
      }
      const mode = action.payloadAction?.mode || 'ajouter';
      if (mode === 'statut' && action.cibleId) {
        const q = etat.memoireMJ.promessesEtQuetes.find(item => item.id === action.cibleId);
        if (!q) throw new Error('Quête introuvable.');
        q.statut = (action.payloadAction?.statut || 'ACCOMPLIE') as any;
        adjudication = {
          phase: 'adjudication_resolved',
          action_type: 'CHARACTER_UPDATE',
          competenceOuCarac: 'Suivi de quête',
          dice_roll: 10,
          modificateur: 0,
          score_total: 10,
          cible_dd_ou_ca: 0,
          issue: 'SUCCESS',
          mutations_etat: {
            descriptionTechnique: `Objectif « ${q.titre} » marqué : ${q.statut}.`,
          },
        };
        break;
      }

      const titre = String(action.payloadAction?.titre || action.texteLibre || '').trim().slice(0, 100);
      if (!titre) throw new Error('Titre de quête requis.');
      const details = String(action.payloadAction?.details || '').trim().slice(0, 300);
      const interlocuteur = String(action.payloadAction?.interlocuteur || 'Objectif personnel').trim().slice(0, 60);
      etat.memoireMJ.promessesEtQuetes.unshift({
        id: `q_perso_${Date.now().toString(36)}`,
        titre,
        interlocuteur,
        statut: 'EN_COURS',
        details: details || 'Objectif noté par l\'aventurier.',
      });
      reconcilierProximitePnjs(etat, 2);
      adjudication = {
        phase: 'adjudication_resolved',
        action_type: 'CHARACTER_UPDATE',
        competenceOuCarac: 'Journal des quêtes',
        dice_roll: 10,
        modificateur: 0,
        score_total: 10,
        cible_dd_ou_ca: 0,
        issue: 'SUCCESS',
        mutations_etat: {
          descriptionTechnique: `Quête ajoutée : « ${titre} ».`,
        },
      };
      break;
    }

    case 'OUVERTURE_CAMPAGNE': {
      etat._seq = Math.max(1, etat._seq);
      adjudication = {
        phase: 'adjudication_resolved',
        action_type: 'TRAVEL',
        competenceOuCarac: 'Ouverture de campagne',
        dice_roll: 10,
        modificateur: 0,
        score_total: 10,
        cible_dd_ou_ca: 0,
        issue: 'SUCCESS',
        mutations_etat: {
          descriptionTechnique: `Entrée en scène à ${etat.hexActuel.nom}.`,
        },
      };
      break;
    }
  }

  // Mettre à jour la mémoire du personnage de manière sobre et déterministe
  mettreAJourMemoire(
    etat.personnage,
    adjudication.mutations_etat.descriptionTechnique,
    etat.hexActuel,
    etat.horloge.meteo
  );

  return { nouvelEtat: etat, adjudication, evenementFactionTexte, pnjApproche };
}
