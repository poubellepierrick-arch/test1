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
import { executerDeplacementHex, executerForage } from './hexcrawl';
import {
  initialiserCombat,
  executerAttaqueJoueur,
  executerTourEnnemi,
  executerEsquiveJoueur,
  executerSortJoueur,
  executerFuiteJoueur,
} from './combat';
import { executerWorldTick } from './factions';
import { lancerD20, calculerModificateur } from './dice';
import { traverserGraphe, filtrerParFrontiereDeConnaissance } from './graph';
import { preparerSort, executerSortGrimoire } from './spells';
import { fabriquerObjetBivouac, soignerBlessure, infligerBlessurePersistante } from './injuries';

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
    | 'TROQUER'
    | 'CORVEE_TRAVAIL'
    | 'DIALOGUER_PNJ'
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
    | 'ANNOTER_HEX';
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
} {
  const etat: SimulationState = JSON.parse(JSON.stringify(etatActuel));
  etat._seq += 1;

  let adjudication: AdjudicationPayload;
  let evenementFactionTexte: string | undefined;

  switch (action.type) {
    case 'DEPLACER_HEX': {
      const cible = etat.hexagones.find(h => h.id === action.cibleId);
      if (!cible) throw new Error('Hexagone cible inconnu');
      
      const res = executerDeplacementHex(etat.hexActuel, cible, etat.personnage, etat.marcheAllure, etat.roleExploration);
      etat.hexActuel = res.hexCible;
      etat.personnage = res.personnageModifie;
      adjudication = res.adjudication;

      // Dissipation du brouillard de guerre sur la carte
      etat.hexagones = etat.hexagones.map(h => {
        if (h.id === res.hexCible.id) {
          return { ...h, visite: true, brouillard: 'EXPLORE' as const };
        }
        // Voisins immédiats (distance axiale <= 1)
        const dq = Math.abs(h.q - res.hexCible.q);
        const dr = Math.abs(h.r - res.hexCible.r);
        const ds = Math.abs((h.q + h.r) - (res.hexCible.q + res.hexCible.r));
        if (Math.max(dq, dr, ds) <= 1 && h.brouillard === 'INCONNU') {
          return { ...h, brouillard: 'REPERE' as const };
        }
        return h;
      });

      // Faire avancer l'horloge du monde
      const heures = res.adjudication.mutations_etat.heuresEcoulees || 2;
      etat.horloge.heure += Math.round(heures);
      while (etat.horloge.heure >= 24) {
        etat.horloge.heure -= 24;
        etat.horloge.jour += 1;
        // Déclencher un World Tick de faction à chaque tranche de 24 heures !
        const tickRes = executerWorldTick(etat.horloge.tick, etat.factions, etat.hexagones, etat.marche);
        etat.horloge.tick = tickRes.nouveauTick;
        etat.factions = tickRes.factionsModifiees;
        etat.hexagones = tickRes.hexagonesModifies;
        etat.marche = tickRes.marcheModifie;
        if (tickRes.journalFactions.length > 0) {
          evenementFactionTexte = tickRes.journalFactions.join(' | ');
        }
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

      // Déclenchement de combat en cas d'embuscade
      if (res.rencontreImminente && res.typeRencontre) {
        const typeEnnemi = res.typeRencontre;
        const ennemi = {
          id: `mob_${Date.now()}`,
          nom: typeEnnemi === 'GOBELIN' ? 'Éclaireur Gobelin' : typeEnnemi === 'ZOMBIE' ? 'Cadavre Putride' : 'Bandit de Grand Chemin',
          type: typeEnnemi,
          pv: typeEnnemi === 'GOBELIN' ? 7 : typeEnnemi === 'ZOMBIE' ? 14 : 11,
          pvMax: typeEnnemi === 'GOBELIN' ? 7 : typeEnnemi === 'ZOMBIE' ? 14 : 11,
          ca: typeEnnemi === 'GOBELIN' ? 15 : typeEnnemi === 'ZOMBIE' ? 8 : 12,
          initiative: 0,
          distancePieds: 30,
          statut: 'ACTIF' as const,
          bonusAttaque: typeEnnemi === 'GOBELIN' ? 4 : typeEnnemi === 'ZOMBIE' ? 3 : 3,
          degatsDes: typeEnnemi === 'GOBELIN' ? '1d6+2' : typeEnnemi === 'ZOMBIE' ? '1d6+1' : '1d6+1',
          comportement: (typeEnnemi === 'GOBELIN' ? 'RUSE_ET_FUITE' : typeEnnemi === 'ZOMBIE' ? 'AVEUGLE_CORPS_A_CORPS' : 'TACTIQUE_COORDINATION') as any,
        };
        etat.combat = initialiserCombat(etat.personnage, [ennemi]);
        adjudication.mutations_etat.descriptionTechnique += ` [Alerte : ${ennemi.nom} surgit des ombres !]`;
      }
      break;
    }

    case 'FORAGER': {
      const res = executerForage(etat.hexActuel, etat.personnage);
      etat.personnage = res.personnageModifie;
      adjudication = res.adjudication;
      etat.horloge.heure += 1;
      if (etat.horloge.heure >= 24) {
        etat.horloge.heure -= 24;
        etat.horloge.jour += 1;
      }
      break;
    }

    case 'REPOS_COURT': {
      const res = executerRepos(etat.personnage, 'court', true);
      etat.personnage = res.personnageModifie;
      adjudication = res.adjudication;
      etat.horloge.heure += 1;
      if (etat.horloge.heure >= 24) {
        etat.horloge.heure -= 24;
        etat.horloge.jour += 1;
      }
      break;
    }

    case 'REPOS_LONG': {
      const abriSecurise = etat.hexActuel.securite === 'Sûr' || etat.hexActuel.pointInteret?.type === 'bourgade';
      const res = executerRepos(etat.personnage, 'long', abriSecurise);
      etat.personnage = res.personnageModifie;
      adjudication = res.adjudication;

      // Avancement de 8 heures
      etat.horloge.heure += 8;
      if (etat.horloge.heure >= 24) {
        etat.horloge.heure -= 24;
        etat.horloge.jour += 1;
      }

      // Repos long déclenche un World Tick de faction !
      const tickRes = executerWorldTick(etat.horloge.tick, etat.factions, etat.hexagones, etat.marche);
      etat.horloge.tick = tickRes.nouveauTick;
      etat.factions = tickRes.factionsModifiees;
      etat.hexagones = tickRes.hexagonesModifies;
      etat.marche = tickRes.marcheModifie;
      if (tickRes.journalFactions.length > 0) {
        evenementFactionTexte = tickRes.journalFactions.join(' | ');
      }
      break;
    }

    case 'ATTAQUER': {
      if (!etat.combat.actif || !action.cibleId) {
        throw new Error('Aucun combat en cours ou cible non spécifiée');
      }
      const res = executerAttaqueJoueur(etat.personnage, etat.combat, action.cibleId, {
        nom: 'Épée bâtarde',
        degats: '1d8+2',
        type: 'cac',
      });
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
        const res = executerTourEnnemi(ennemiVivant, etat.personnage, etat.combat);
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
      // Analyse et résolution déterministe d'une tentative libre
      const texte = (action.texteLibre || '').toLowerCase();
      let carac: 'FOR' | 'DEX' | 'CON' | 'INT' | 'SAG' | 'CHA' = 'SAG';
      let dd = 15;
      let label = 'Test de caractéristique';

      if (texte.includes('forge') || texte.includes('arme') || texte.includes('minerai')) {
        carac = 'INT';
        dd = 13;
        label = 'Connaissance de la forge / Estimation du fer';
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
        label = 'Perception passive / Observation des lieux';
      }

      const mod = calculerModificateur(etat.personnage.caracteristiques[carac]);
      const jet = lancerD20(etat.personnage.epuisement >= 1 ? 'desavantage' : 'normal');
      const total = jet.valeurRetenue + mod;
      const reussite = total >= dd;

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
          descriptionTechnique: `Test de ${carac} : ${reussite ? 'Succès' : 'Échec'} (${total} vs DD ${dd}). ${action.texteLibre}`,
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
      // Corvées de subsistance pour s'intégrer et survivre dans un monde indifférent
      const jobId = action.jobId || 'bois_palissade';
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
        titreJob = 'Déblaiement des sentiers rocailleux';
        carac = 'FOR';
        dd = 12;
        heures = 3;
        paGagne = 7;
        rationsGagnees = 1;
      } else if (jobId === 'chasse_ravitaillement') {
        titreJob = 'Traque de subsistance pour le camp';
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

      // Appliquer les gains
      etat.personnage.monnaies.pa += paGagne;
      etat.personnage.monnaies.po += poGagne;
      etat.personnage.rationsJours = Math.min(
        etat.personnage.rationsMaxJours,
        etat.personnage.rationsJours + rationsGagnees
      );
      etat.personnage.heuresMarcheJour += heures;

      // Avancement de l'horloge
      etat.horloge.heure += heures;
      while (etat.horloge.heure >= 24) {
        etat.horloge.heure -= 24;
        etat.horloge.jour += 1;
        const tickRes = executerWorldTick(etat.horloge.tick, etat.factions, etat.hexagones, etat.marche);
        etat.horloge.tick = tickRes.nouveauTick;
        etat.factions = tickRes.factionsModifiees;
        etat.hexagones = tickRes.hexagonesModifies;
        etat.marche = tickRes.marcheModifie;
        if (tickRes.journalFactions.length > 0) {
          evenementFactionTexte = tickRes.journalFactions.join(' | ');
        }
      }

      const desc = reussite
        ? `${titreJob} menée à terme (${total} vs DD ${dd}). Rémunération reçue : ${paGagne > 0 ? `${paGagne} PA ` : ''}${poGagne > 0 ? `${poGagne} PO ` : ''}${rationsGagnees > 0 ? `+${rationsGagnees} ration(s)` : ''}. (+${heures}h)`
        : `${titreJob} pénible et contestée (${total} vs DD ${dd}). Salaire raboté : ${paGagne} PA. (+${heures}h)`;

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
      const articleId = action.articleId || 'ration';
      const quantite = Math.max(1, action.quantite || 1);

      // Calcul des prix selon l'économie locale et pénuries
      let coutTotalPC = 0;
      let labelArticle = '';

      if (articleId === 'ration') {
        labelArticle = 'Ration de subsistance séchée';
        coutTotalPC = quantite * 50; // 5 PA = 50 PC
      } else if (articleId === 'eau') {
        labelArticle = 'Eau de source purifiée (1L)';
        coutTotalPC = quantite * 2; // 2 PC le litre
      } else if (articleId === 'torche') {
        labelArticle = 'Torche de suif (6h)';
        coutTotalPC = quantite * 1; // 1 PC
      } else if (articleId === 'bandage') {
        labelArticle = 'Trousse de secours et compresses';
        coutTotalPC = quantite * 500; // 5 PO = 500 PC
      } else if (articleId === 'fleches') {
        labelArticle = 'Carquois de 20 flèches';
        const mult = etat.marche.penurieArmurerie ? etat.marche.multiplicateurFer : 1.0;
        coutTotalPC = Math.round(quantite * 100 * mult); // 1 PO de base
      } else if (articleId === 'dague') {
        labelArticle = 'Dague en fer forgé';
        const mult = etat.marche.penurieArmurerie ? etat.marche.multiplicateurFer : 1.0;
        coutTotalPC = Math.round(quantite * 200 * mult); // 2 PO de base
      }

      // Solde joueur total en PC
      const soldeJoueurPC =
        etat.personnage.monnaies.po * 100 +
        etat.personnage.monnaies.pa * 10 +
        etat.personnage.monnaies.pc;

      if (soldeJoueurPC < coutTotalPC) {
        throw new Error(`Fonds insuffisants. Requis : ${(coutTotalPC / 100).toFixed(2)} PO.`);
      }

      // Déduire déterministement
      const nouveauSoldePC = soldeJoueurPC - coutTotalPC;
      etat.personnage.monnaies.po = Math.floor(nouveauSoldePC / 100);
      etat.personnage.monnaies.pa = Math.floor((nouveauSoldePC % 100) / 10);
      etat.personnage.monnaies.pc = nouveauSoldePC % 10;

      // Ajouter l'article acheté
      let descObjet = '';
      if (articleId === 'ration') {
        const placeDispo = etat.personnage.rationsMaxJours - etat.personnage.rationsJours;
        const ajoute = Math.min(placeDispo, quantite);
        etat.personnage.rationsJours += ajoute;
        descObjet = `+${ajoute} ration(s) en sacoche`;
      } else if (articleId === 'eau') {
        const placeDispo = Number((etat.personnage.eauMaxLitres - etat.personnage.eauLitres).toFixed(1));
        const ajoute = Math.min(placeDispo, quantite);
        etat.personnage.eauLitres = Number((etat.personnage.eauLitres + ajoute).toFixed(1));
        descObjet = `+${ajoute}L d'eau potable`;
      } else {
        const itemExistant = etat.personnage.inventaire.find(i => i.id === `item_${articleId}`);
        if (itemExistant) {
          itemExistant.quantite += quantite;
        } else {
          etat.personnage.inventaire.push({
            id: `item_${articleId}_${Date.now()}`,
            nom: labelArticle,
            poidsLbs: articleId === 'dague' ? 1 : articleId === 'bandage' ? 2 : 1,
            valeurPO: Math.round(coutTotalPC / 100),
            quantite,
          });
        }
        descObjet = `+${quantite} ${labelArticle}`;
      }

      const desc = `Achat réglé au comptoir : ${descObjet} pour ${(coutTotalPC / 100).toFixed(2)} PO. ${etat.marche.penurieArmurerie ? `(Indice fer x${etat.marche.multiplicateurFer} appliqué)` : ''}`;

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
      const pnjId = action.pnjId || 'npc_forgeron_torvin';
      const pnjNoeud = etat.grapheNoeuds.find(n => n.id === pnjId);
      const nomPnj = pnjNoeud ? pnjNoeud.label : 'Habitant local';
      const sujet = action.sujetDialogue || 'Situation générale et rumeurs régionales';

      // Disposition existante ou par défaut
      const dispActuelle = pnjNoeud?.proprietes?.disposition || 'NEUTRE';
      let modDisp = dispActuelle === 'AMICAL' ? 2 : dispActuelle === 'MEFIANT' ? -2 : 0;

      // Test de Charisme (Persuasion ou Perspicacité)
      const modCha = calculerModificateur(etat.personnage.caracteristiques.CHA) + modDisp;
      const jet = lancerD20(etat.personnage.epuisement >= 1 ? 'desavantage' : 'normal');
      const ddPnj = pnjId === 'npc_capitaine_morn' ? 15 : 13;
      const total = jet.valeurRetenue + modCha;
      const reussite = total >= ddPnj;

      // Évolution de la relation
      let nouvelleDisp: 'AMICAL' | 'NEUTRE' | 'MEFIANT' = dispActuelle;
      let humeur = 'Calme et attentif';
      if (reussite) {
        nouvelleDisp = total >= ddPnj + 4 ? 'AMICAL' : 'NEUTRE';
        humeur = total >= ddPnj + 4 ? 'Chaleureux et enclin aux confidences' : 'Courtois et posé';
      } else {
        nouvelleDisp = total <= ddPnj - 4 ? 'MEFIANT' : dispActuelle;
        humeur = 'Défensif et taciturne';
      }

      if (pnjNoeud) {
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
      }

      // Extraction sous-graphe filtré par frontière de connaissance
      const sub = traverserGraphe(pnjId, etat.grapheNoeuds, etat.grapheLiens, 2);
      const filtre = filtrerParFrontiereDeConnaissance(sub, pnjId);
      const faitsConnus = filtre.faitsPertinents.join(' | ') || 'Aucun renseignement supplémentaire.';

      const desc = reussite
        ? `Échange avec ${nomPnj} constructif (${total} vs DD ${ddPnj}). Disposition : ${nouvelleDisp.toLowerCase()}. Le PNJ partage ses observations : ${faitsConnus}`
        : `${nomPnj} vous toise avec froideur (${total} vs DD ${ddPnj}). Disposition : ${nouvelleDisp.toLowerCase()}. ${humeur}.`;

      adjudication = {
        phase: 'adjudication_resolved',
        action_type: 'NPC_INTERACTION',
        competenceOuCarac: `Entretien avec ${nomPnj} (Persuasion / CHA)`,
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

    case 'ENGAGER_COMPAGNON': {
      const typeChoisi = action.payloadAction?.type || action.payloadAction?.typeCompagnon || 'MULET';
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

      // Déduction du solde
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

      const desc = `Contrat signé : ${nouveauCompagnon.nom} recruté pour ${coutPA} PA (solde de départ). Charge utile accrue de +${nouveauCompagnon.chargeMaxLbs} lbs.`;
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
      const coutPA = 4;
      const totalPA = etat.personnage.monnaies.po * 10 + etat.personnage.monnaies.pa;
      if (totalPA < coutPA) {
        throw new Error(`Entretien impossible : 4 PA requis pour la pierre d'affût et la graisse.`);
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
          descriptionTechnique: 'Entretien complet du harnois et des lames à la forge (4 PA dépensés). Usure remise à 0%.',
        },
      };
      break;
    }

    case 'BOUILLIR_EAU': {
      if (etat.personnage.eauLitres <= 0) {
        throw new Error('Aucune eau dans l\'outre à bouillir.');
      }
      etat.personnage.qualiteEau = 'Pure';
      etat.horloge.heure += 1;
      if (etat.horloge.heure >= 24) {
        etat.horloge.heure -= 24;
        etat.horloge.jour += 1;
      }

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
          descriptionTechnique: 'Eau portée à ébullition sur un feu de branchages. L\'outre contient désormais une eau pure (0% risque de fièvre).',
        },
      };
      break;
    }

    case 'EXPLORER_SITE': {
      const poi = etat.hexActuel.pointInteret;
      const nomSite = poi ? poi.nom : `Galeries sous ${etat.hexActuel.nom}`;
      
      etat.donjon = {
        actif: true,
        poiId: poi?.id || etat.hexActuel.id,
        nom: nomSite,
        salleActuelleId: 'salle_1',
        salles: [
          {
            id: 'salle_1',
            nom: 'Entrée éboulée',
            description: 'Un boyau étroit consolidé par des étais vermoulus. L\'air y est dense et saturé de salpêtre.',
            visitee: true,
            danger: 'AUCUN',
            fouillable: true,
            connexions: ['salle_2'],
          },
          {
            id: 'salle_2',
            nom: 'Galerie médiane affaissée',
            description: 'Des dalles disjointes surplombent une crevasse instable. Des pierres chutent par intermittence.',
            visitee: false,
            danger: 'PIEGE',
            fouillable: true,
            connexions: ['salle_1', 'salle_3'],
          },
          {
            id: 'salle_3',
            nom: 'Cavité terminale',
            description: 'Une ancienne excavation d\'extraction de fer. Des restes d\'outils et des gravats jonchent le sol.',
            visitee: false,
            danger: 'ENNEMI',
            tresorPO: 6,
            fouillable: true,
            connexions: ['salle_2'],
          },
        ],
        journalDonjon: [`Pénétration dans le site : ${nomSite}.`],
      };

      etat.horloge.heure += 1;
      if (etat.horloge.heure >= 24) {
        etat.horloge.heure -= 24;
        etat.horloge.jour += 1;
      }

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
          descriptionTechnique: `Exploration souterraine engagée dans ${nomSite}.`,
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
          // Sauvegarde DEX DD 12
          const modDex = calculerModificateur(etat.personnage.caracteristiques.DEX);
          const jet = lancerD20('normal');
          const total = jet.valeurRetenue + modDex;
          if (total < 12) {
            const degats = Math.floor(Math.random() * 4) + 1;
            etat.personnage.pvActuels = Math.max(0, etat.personnage.pvActuels - degats);
            technique += ` Piège déclenché ! Éboulis rocheux (${total} vs DD 12) : -${degats} PV.`;
          } else {
            technique += ` Piège esquivé de justesse (${total} vs DD 12).`;
          }
        } else if (salleCible.danger === 'ENNEMI') {
          const ennemi = {
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
          etat.combat = initialiserCombat(etat.personnage, [ennemi]);
          technique += ` Ennemi en embuscade : ${ennemi.nom} !`;
        }
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

      const modInt = calculerModificateur(etat.personnage.caracteristiques.INT);
      const jet = lancerD20('normal');
      const total = jet.valeurRetenue + modInt;
      const dd = 12;
      const reussite = total >= dd;
      salle.fouillable = false;

      let gainPO = 0;
      if (reussite) {
        gainPO = salle.tresorPO || 3;
        etat.personnage.monnaies.po += gainPO;
        etat.personnage.experience += 50;
      }

      const desc = reussite
        ? `Fouille minutieuse fructueuse (${total} vs DD ${dd}) : découverte de filons et débris de valeur (+${gainPO} PO, +50 XP).`
        : `Fouille infructueuse (${total} vs DD ${dd}) : gravats stériles.`;

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
      const coutPO = 5;
      if (etat.personnage.monnaies.po < coutPO) {
        throw new Error(`Entraînement impossible : 5 PO d'émoluments d'instructeur requis.`);
      }

      const resNiveau = evaluerMonteeNiveau(etat.personnage);
      if (!resNiveau.estMonteeNiveau) {
        throw new Error(`Expérience insuffisante pour franchir le niveau suivant (${etat.personnage.experience} / ${etat.personnage.experienceNextLevel} XP requis).`);
      }

      etat.personnage = resNiveau.personnageModifie;
      etat.personnage.monnaies.po -= coutPO;

      const desc = `Entraînement martiale auprès du maître d'armes (5 PO réglés). Passage au Niveau ${etat.personnage.niveau} ! PV max portés à ${etat.personnage.pvMax}.`;
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
      const recetteId = action.cibleId || action.payloadAction?.recetteId;
      const resCraft = fabriquerObjetBivouac(etat.personnage, recetteId);
      etat.personnage = resCraft.personnageModifie;
      adjudication = resCraft.adjudication;
      etat.horloge.heure += 1;
      if (etat.horloge.heure >= 24) {
        etat.horloge.heure -= 24;
        etat.horloge.jour += 1;
      }
      break;
    }

    case 'SOIGNER_BLESSURE': {
      const blessureId = action.cibleId || action.payloadAction?.blessureId;
      const avecRemede = action.payloadAction?.avecRemede !== false;
      const resSoin = soignerBlessure(etat.personnage, blessureId, avecRemede);
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
  }

  // Mettre à jour la mémoire du personnage de manière sobre et déterministe
  mettreAJourMemoire(
    etat.personnage,
    adjudication.mutations_etat.descriptionTechnique,
    etat.hexActuel,
    etat.horloge.meteo
  );

  return { nouvelEtat: etat, adjudication, evenementFactionTexte };
}
