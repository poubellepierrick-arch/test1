import { Combatant, CombatState, CharacterStats, AdjudicationPayload } from '../types';
import { ItemEntry } from '../types/srd';
import { calculerModificateur, lancerD20, interpreterJetDegats } from './dice';
import { obtenirFicheSrd } from './compendium';
import { evaluerVitesseEffective, extraireProfilArme, obtenirArmeActive } from './character';
import { appliquerUsureEquipement } from './srd';

export interface CombatAttackOptions {
  verifierPorteeStricte?: boolean;
  dansObscurite?: boolean;
}

export function initialiserCombat(joueur: CharacterStats, ennemisInitiaux: Combatant[]): CombatState {
  const modDexJoueur = calculerModificateur(joueur.caracteristiques.DEX);
  const jetInitJoueur = lancerD20('normal').valeurRetenue + modDexJoueur;

  const ennemisAvecInit = ennemisInitiaux.map(e => ({
    ...e,
    initiative: lancerD20('normal').valeurRetenue + 1,
  }));

  const alliesMercenaires = (joueur.compagnons || [])
    .filter(c => c.type === 'MERCENAIRE' && c.pv > 0)
    .map(c => ({
      id: `ally:${c.id}`,
      nom: c.nom,
      initiative: lancerD20('normal').valeurRetenue + 1,
    }));

  const listeCombattants = [
    { id: 'player', nom: joueur.nom, initiative: jetInitJoueur },
    ...alliesMercenaires,
    ...ennemisAvecInit.map(e => ({
      id: e.id,
      nom: e.nom,
      initiative: e.initiative,
    })),
  ];

  // Tri décroissant d'initiative (en cas d'égalité, joueur prioritaire)
  listeCombattants.sort((a, b) => {
    if (b.initiative !== a.initiative) return b.initiative - a.initiative;
    if (a.id === 'player') return -1;
    if (b.id === 'player') return 1;
    return 0;
  });

  const ordre = listeCombattants.map(c => c.id);
  const initiatives: Record<string, number> = {};
  for (const c of listeCombattants) {
    initiatives[c.id] = c.initiative;
  }

  return {
    actif: true,
    round: 1,
    combattantActifIndex: 0,
    ordreInitiative: ordre,
    ennemis: ennemisAvecInit,
    journalCombat: [
      `Combat engagé. Initiative : ${listeCombattants.map(c => `${c.nom} (${c.initiative})`).join(', ')}.`,
    ],
    postureDefensive: false,
    actionDisponible: true,
    actionBonusDisponible: true,
    mouvementRestantPieds: evaluerVitesseEffective(joueur),
    desengage: false,
    initiatives,
  };
}

function executerAttaqueAllieMercenaire(
  allyId: string,
  persoClone: CharacterStats,
  combatClone: CombatState
): string | null {
  const hirelingId = allyId.replace(/^ally:/, '');
  const mercenaire = (persoClone.compagnons || []).find(c => c.id === hirelingId && c.pv > 0);
  const cible = combatClone.ennemis.find(e => e.statut === 'ACTIF');
  if (!mercenaire || !cible) return null;

  const bonusAtk = mercenaire.bonusAttaque ?? 3;
  const jet = lancerD20('normal');
  const total = jet.valeurRetenue + bonusAtk;

  if (jet.valeurRetenue === 20 || (jet.valeurRetenue !== 1 && total >= cible.ca)) {
    let degats = interpreterJetDegats('1d8+2');
    if (jet.valeurRetenue === 20) degats += interpreterJetDegats('1d8');
    cible.pv = Math.max(0, cible.pv - degats);
    let msg = `${mercenaire.nom} frappe ${cible.nom} (${total} vs CA ${cible.ca}) : ${degats} dégâts.`;
    if (cible.pv === 0) {
      cible.statut = 'MORT';
      const xpGain = cible.xp || 0;
      if (xpGain > 0) persoClone.experience += xpGain;
      msg += ` ${cible.nom} tombe${xpGain > 0 ? ` (+${xpGain} XP)` : ''}.`;
    }
    combatClone.journalCombat.push(msg);
    return msg;
  } else {
    const msg = `${mercenaire.nom} attaque ${cible.nom} et manque (${total} vs CA ${cible.ca}).`;
    combatClone.journalCombat.push(msg);
    return msg;
  }
}

function attaquerCibleAvecEnnemi(
  ennemieEnCours: Combatant,
  persoClone: CharacterStats,
  combatClone: CombatState,
  typeJetEnnemi: 'normal' | 'avantage' | 'desavantage',
  contexte?: string
): { desc: string; degatsInfliges: number; issue: AdjudicationPayload['issue']; jet: number; bonusAtk: number; total: number } {
  const attaquesDisponibles = (ennemieEnCours.attaques || []).filter(a => typeof a.bonusAttaque === 'number' && a.degatsDes);
  const attaqueChoisie = attaquesDisponibles.length > 0
    ? attaquesDisponibles[Math.floor(Math.random() * attaquesDisponibles.length)]
    : undefined;

  const bonusAtk = attaqueChoisie?.bonusAttaque ?? ennemieEnCours.bonusAttaque;
  const formDegats = attaqueChoisie?.degatsDes ?? ennemieEnCours.degatsDes;
  const nomAtk = attaqueChoisie?.nom;
  const typeDegAtk = attaqueChoisie?.typeDegats ?? ennemieEnCours.typeDegats;

  const jet = lancerD20(typeJetEnnemi);
  const scoreTouche = jet.valeurRetenue + bonusAtk;
  const caJoueur = persoClone.ca;
  let degatsInfliges = 0;
  let issue: AdjudicationPayload['issue'] = 'FAILURE';
  let desc = '';

  if (jet.valeurRetenue === 20 || (jet.valeurRetenue !== 1 && scoreTouche >= caJoueur)) {
    issue = jet.valeurRetenue === 20 ? 'CRITICAL_SUCCESS' : 'SUCCESS';
    degatsInfliges = interpreterJetDegats(formDegats);
    if (jet.valeurRetenue === 20) degatsInfliges += interpreterJetDegats(formDegats);

    persoClone.pvActuels = Math.max(0, persoClone.pvActuels - degatsInfliges);
    desc = `${ennemieEnCours.nom}${contexte ? ` (${contexte})` : ''}${nomAtk ? ` [${nomAtk}]` : ''} touche ${persoClone.nom} (${scoreTouche} vs CA ${caJoueur}) : ${degatsInfliges} dégâts${typeDegAtk ? ` (${typeDegAtk})` : ''}. (PV : ${persoClone.pvActuels}/${persoClone.pvMax})`;

    if (persoClone.pvActuels === 0) {
      desc += ` ${persoClone.nom} tombe à 0 PV (jets de mort requis).`;
      if (!persoClone.conditions.includes('Inconscient')) {
        persoClone.conditions.push('Inconscient');
      }
    }
  } else {
    desc = `${ennemieEnCours.nom}${contexte ? ` (${contexte})` : ''} rate ${persoClone.nom} (${scoreTouche} vs CA ${caJoueur}${typeJetEnnemi === 'desavantage' ? ' · désavantage' : ''}).`;
  }

  return { desc, degatsInfliges, issue, jet: jet.valeurRetenue, bonusAtk, total: scoreTouche };
}

/**
 * Résout automatiquement tous les tours des PNJ (alliés et ennemis) selon `ordreInitiative`
 * jusqu'à ce que le curseur revienne sur `'player'` (ou fin de combat).
 */
export function resoudreToursJusquaJoueur(
  joueur: CharacterStats,
  combat: CombatState,
  options?: { estDebutCombat?: boolean }
): {
  combatModifie: CombatState;
  personnageModifie: CharacterStats;
  adjudication: AdjudicationPayload;
} {
  const combatClone: CombatState = JSON.parse(JSON.stringify(combat));
  let persoClone: CharacterStats = JSON.parse(JSON.stringify(joueur));
  const ordre = combatClone.ordreInitiative.length > 0 ? combatClone.ordreInitiative : ['player', ...combatClone.ennemis.map(e => e.id)];

  const resumeTours: string[] = [];
  let totalDegatsSubis = 0;
  let dernierJet = 10;
  let dernierBonus = 0;
  let dernierScore = 10;
  let caRef = persoClone.ca;

  // Si on vient de finir le tour du joueur, avancer d'un cran après 'player'
  let idx = combatClone.combattantActifIndex || 0;
  if (!options?.estDebutCombat && ordre[idx] === 'player') {
    idx += 1;
    if (idx >= ordre.length) {
      idx = 0;
      combatClone.round += 1;
    }
  }

  let securite = 0;
  const maxSteps = ordre.length * 2 + 2;

  while (combatClone.actif && securite < maxSteps) {
    securite += 1;
    const acteurId = ordre[idx];

    if (acteurId === 'player') {
      // Début du tour du joueur : réinitialisation de sa posture défensive et de son économie d'action
      combatClone.combattantActifIndex = idx;
      combatClone.postureDefensive = false;
      combatClone.actionDisponible = true;
      combatClone.actionBonusDisponible = true;
      combatClone.mouvementRestantPieds = evaluerVitesseEffective(persoClone);
      combatClone.desengage = false;
      break;
    }

    if (acteurId.startsWith('ally:')) {
      const msg = executerAttaqueAllieMercenaire(acteurId, persoClone, combatClone);
      if (msg) resumeTours.push(msg);
      if (!combatClone.ennemis.some(e => e.statut === 'ACTIF')) {
        combatClone.actif = false;
        combatClone.journalCombat.push('Victoire : tous les ennemis sont neutralisés.');
        break;
      }
    } else {
      const ennemi = combatClone.ennemis.find(e => e.id === acteurId);
      if (ennemi && ennemi.statut === 'ACTIF' && persoClone.pvActuels > 0) {
        if (ennemi.comportement === 'RUSE_ET_FUITE' && ennemi.pv <= ennemi.pvMax * 0.3) {
          ennemi.statut = 'FUITE';
          const msgFuite = `${ennemi.nom} se désengage et fuit le combat.`;
          combatClone.journalCombat.push(msgFuite);
          resumeTours.push(msgFuite);
        } else {
          // Mouvement ennemi vers le joueur s'il est hors de mêlée (30 ft/tour)
          const aAttaqueDistance = (ennemi.attaques || []).some(a => /arc|arbal|javel|fronde|distance/i.test(a.nom + ' ' + a.desc));
          if (ennemi.distancePieds > 5 && !aAttaqueDistance) {
            const avance = Math.min(30, ennemi.distancePieds - 5);
            ennemi.distancePieds -= avance;
            if (avance > 0) {
              combatClone.journalCombat.push(`${ennemi.nom} avance de ${avance} ft (distance : ${ennemi.distancePieds} ft).`);
            }
          }

          if (ennemi.distancePieds <= 5 || aAttaqueDistance) {
            const typeJet = combatClone.postureDefensive ? 'desavantage' : 'normal';
            const atk = attaquerCibleAvecEnnemi(ennemi, persoClone, combatClone, typeJet);
            combatClone.journalCombat.push(atk.desc);
            resumeTours.push(atk.desc);
            totalDegatsSubis += atk.degatsInfliges;
            dernierJet = atk.jet;
            dernierBonus = atk.bonusAtk;
            dernierScore = atk.total;
            caRef = persoClone.ca;
            if (atk.degatsInfliges > 0) {
              persoClone = appliquerUsureEquipement(persoClone, 2);
            }
          }
        }
      }
    }

    if (!combatClone.ennemis.some(e => e.statut === 'ACTIF')) {
      combatClone.actif = false;
      combatClone.journalCombat.push('Victoire : tous les adversaires sont neutralisés.');
      break;
    }

    idx += 1;
    if (idx >= ordre.length) {
      idx = 0;
      combatClone.round += 1;
    }
  }

  combatClone.combattantActifIndex = idx;

  const desc =
    resumeTours.length > 0
      ? resumeTours.join(' ')
      : `Round ${combatClone.round} : au tour de ${persoClone.nom}.`;

  const adjudication: AdjudicationPayload = {
    phase: 'adjudication_resolved',
    action_type: 'ATTACK',
    competenceOuCarac: `Initiative Round ${combatClone.round}`,
    dice_roll: dernierJet,
    modificateur: dernierBonus,
    score_total: dernierScore,
    cible_dd_ou_ca: caRef,
    issue: totalDegatsSubis > 0 ? 'SUCCESS' : 'FAILURE',
    mutations_etat: {
      pvDelta: totalDegatsSubis > 0 ? -totalDegatsSubis : undefined,
      degatsInfliges: totalDegatsSubis > 0 ? totalDegatsSubis : undefined,
      descriptionTechnique: desc,
    },
  };

  return { combatModifie: combatClone, personnageModifie: persoClone, adjudication };
}

export function executerDeplacementCombat(
  joueur: CharacterStats,
  combat: CombatState,
  direction: 'rapprocher' | 'eloigner',
  cibleId?: string
): {
  combatModifie: CombatState;
  personnageModifie: CharacterStats;
  adjudication: AdjudicationPayload;
} {
  const combatClone: CombatState = JSON.parse(JSON.stringify(combat));
  const persoClone: CharacterStats = JSON.parse(JSON.stringify(joueur));
  const mvtDispo = combatClone.mouvementRestantPieds ?? evaluerVitesseEffective(persoClone);

  if (mvtDispo < 5) {
    throw new Error('Mouvement épuisé pour ce tour.');
  }

  const cible =
    combatClone.ennemis.find(e => e.id === cibleId && e.statut === 'ACTIF') ||
    combatClone.ennemis.find(e => e.statut === 'ACTIF');

  if (!cible) {
    throw new Error('Aucun adversaire actif.');
  }

  const notes: string[] = [];
  let degatsOpportunite = 0;

  if (direction === 'rapprocher') {
    if (cible.distancePieds <= 5) {
      throw new Error(`${cible.nom} est déjà au corps-à-corps (5 ft).`);
    }
    const delta = Math.min(mvtDispo, Math.max(5, cible.distancePieds - 5));
    cible.distancePieds = Math.max(5, cible.distancePieds - delta);
    combatClone.mouvementRestantPieds = Math.max(0, mvtDispo - delta);
    notes.push(`${persoClone.nom} s'approche de ${cible.nom} (-${delta} ft → ${cible.distancePieds} ft).`);
  } else {
    // S'éloigner : vérifie l'Attaque d'Opportunité SRD 5e pour tout ennemi actif à <= 5 ft si non désengagé
    const ennemisAuContact = combatClone.ennemis.filter(e => e.statut === 'ACTIF' && e.distancePieds <= 5);
    if (ennemisAuContact.length > 0 && !combatClone.desengage) {
      for (const enn of ennemisAuContact) {
        const typeJet = combatClone.postureDefensive ? 'desavantage' : 'normal';
        const atk = attaquerCibleAvecEnnemi(enn, persoClone, combatClone, typeJet, 'Opportunité');
        notes.push(atk.desc);
        degatsOpportunite += atk.degatsInfliges;
      }
    }
    const pasRecul = Math.min(mvtDispo, 15);
    for (const enn of combatClone.ennemis.filter(e => e.statut === 'ACTIF')) {
      enn.distancePieds = Math.min(120, enn.distancePieds + pasRecul);
    }
    combatClone.mouvementRestantPieds = Math.max(0, mvtDispo - pasRecul);
    notes.push(
      `${persoClone.nom} recule de ${pasRecul} ft${combatClone.desengage ? ' (désengagé sans riposte)' : ''} → ${cible.distancePieds} ft.`
    );
  }

  const desc = notes.join(' ');
  combatClone.journalCombat.push(desc);

  const adjudication: AdjudicationPayload = {
    phase: 'adjudication_resolved',
    action_type: 'COMBAT_MOVEMENT',
    competenceOuCarac: direction === 'rapprocher' ? 'Mouvement tactique (Approche)' : 'Mouvement tactique (Repli)',
    dice_roll: 10,
    modificateur: 0,
    score_total: 10,
    cible_dd_ou_ca: 0,
    issue: 'SUCCESS',
    mutations_etat: {
      pvDelta: degatsOpportunite > 0 ? -degatsOpportunite : undefined,
      descriptionTechnique: desc,
    },
  };

  return { combatModifie: combatClone, personnageModifie: persoClone, adjudication };
}

export function executerDesengagementJoueur(
  joueur: CharacterStats,
  combat: CombatState
): {
  combatModifie: CombatState;
  personnageModifie: CharacterStats;
  adjudication: AdjudicationPayload;
} {
  if (combat.actionDisponible === false) {
    throw new Error('Action déjà dépensée ce tour.');
  }
  const combatClone: CombatState = JSON.parse(JSON.stringify(combat));
  combatClone.desengage = true;
  combatClone.actionDisponible = false;

  const desc = `${joueur.nom} se désengage (Action SRD 5e) : aucune attaque d'opportunité subie lors du repli ce tour.`;
  combatClone.journalCombat.push(desc);

  const adjudication: AdjudicationPayload = {
    phase: 'adjudication_resolved',
    action_type: 'DEFENSIVE_STANCE',
    competenceOuCarac: 'Se désengager (Action)',
    dice_roll: 20,
    modificateur: 0,
    score_total: 20,
    cible_dd_ou_ca: 0,
    issue: 'SUCCESS',
    mutations_etat: {
      descriptionTechnique: desc,
    },
  };

  return { combatModifie: combatClone, personnageModifie: JSON.parse(JSON.stringify(joueur)), adjudication };
}

export function executerAttaqueJoueur(
  joueur: CharacterStats,
  combat: CombatState,
  cibleId: string,
  arme: { nom: string; degats: string; type: 'cac' | 'distance' },
  options?: CombatAttackOptions
): {
  combatModifie: CombatState;
  personnageModifie: CharacterStats;
  adjudication: AdjudicationPayload;
} {
  if (combat.actionDisponible === false) {
    throw new Error('Action déjà dépensée ce tour. Terminez votre tour ou utilisez votre mouvement.');
  }

  const combatClone: CombatState = JSON.parse(JSON.stringify(combat));
  let persoClone: CharacterStats = JSON.parse(JSON.stringify(joueur));
  const cibleIndex = combatClone.ennemis.findIndex(e => e.id === cibleId);

  if (cibleIndex === -1) {
    throw new Error('Cible introuvable dans le combat');
  }

  const cible = combatClone.ennemis[cibleIndex];

  // Résolution de l'arme équipée réelle du personnage
  let nomArme = arme.nom;
  let degatsArme = arme.degats;
  let typeDegatsArme: string | undefined = arme.type === 'distance' ? 'perforant' : 'tranchant';
  let estDistance = arme.type === 'distance';
  let estFinesse = false;
  let porteeMaxPieds = estDistance ? 80 : 5;
  let malusUsure = 0;

  const armeEquipee = persoClone.inventaire.find(i => {
    if (!i.estEquipe) return false;
    if (i.degats || i.categorie === 'arme') return true;
    const profil = extraireProfilArme(i, persoClone.usureEquipement);
    if (profil.estArme) return true;
    if (i.compendiumId) {
      const f = obtenirFicheSrd(i.compendiumId);
      return f?.categorie === 'objet' && f.sousCategorie === 'arme';
    }
    const fParNom = obtenirFicheSrd(i.nom);
    return fParNom?.categorie === 'objet' && fParNom.sousCategorie === 'arme';
  });

  if (armeEquipee && arme.nom === 'Épée bâtarde') {
    const profil = obtenirArmeActive(persoClone);
    const ficheArme = (armeEquipee.compendiumId ? obtenirFicheSrd(armeEquipee.compendiumId) : obtenirFicheSrd(armeEquipee.nom)) as ItemEntry | undefined;
    nomArme = armeEquipee.nom;
    const baseDegats = armeEquipee.degats || ficheArme?.degats || profil.degatsBase;
    const props = armeEquipee.proprietesArme || ficheArme?.proprietesArme || [];
    typeDegatsArme = armeEquipee.typeDegats || ficheArme?.typeDegats || profil.typeDegats || typeDegatsArme;
    estDistance = profil.estDistance || props.some(p => p.toLowerCase().includes('distance'));
    estFinesse = profil.estFinesse || props.some(p => p.toLowerCase().includes('finesse'));
    porteeMaxPieds = estDistance ? profil.porteeLonguePieds : 5;
    malusUsure = profil.malusUsure;

    if (baseDegats) {
      const modCaracDeg = estDistance
        ? calculerModificateur(persoClone.caracteristiques.DEX)
        : estFinesse
        ? Math.max(calculerModificateur(persoClone.caracteristiques.FOR), calculerModificateur(persoClone.caracteristiques.DEX))
        : calculerModificateur(persoClone.caracteristiques.FOR);
      const totalModDeg = modCaracDeg + malusUsure;
      degatsArme = totalModDeg >= 0 ? `${baseDegats}+${totalModDeg}` : `${baseDegats}${totalModDeg}`;
    }
  }

  // Vérification stricte de portée en jeu D&D 5e
  if (options?.verifierPorteeStricte) {
    if (!estDistance && cible.distancePieds > 5) {
      throw new Error(
        `${cible.nom} est à ${cible.distancePieds} ft : hors de portée de mêlée (5 ft). Approchez-vous d'abord.`
      );
    }
    if (estDistance && cible.distancePieds > porteeMaxPieds) {
      throw new Error(`${cible.nom} est à ${cible.distancePieds} ft (portée max ${porteeMaxPieds} ft).`);
    }
  }

  const modFor = calculerModificateur(persoClone.caracteristiques.FOR);
  const modDex = calculerModificateur(persoClone.caracteristiques.DEX);
  const modAttaque = estDistance ? modDex : estFinesse ? Math.max(modFor, modDex) : modFor;
  const bonusTotal = modAttaque + persoClone.bonusMaitrise + malusUsure;

  // Désavantage : épuisement >= 3, obscurité sans vision/lumière, ou tir à distance au contact (5 ft)
  const ennemiAuContact = combatClone.ennemis.some(e => e.statut === 'ACTIF' && e.distancePieds <= 5);
  let typeJet: 'normal' | 'avantage' | 'desavantage' = 'normal';
  const raisonsDesavantage: string[] = [];
  if (persoClone.epuisement >= 3) {
    typeJet = 'desavantage';
    raisonsDesavantage.push('épuisement');
  }
  if (options?.dansObscurite) {
    typeJet = 'desavantage';
    raisonsDesavantage.push('obscurité');
  }
  if (estDistance && ennemiAuContact) {
    typeJet = 'desavantage';
    raisonsDesavantage.push('tir au contact');
  }

  const jet = lancerD20(typeJet);
  const totalTouche = jet.valeurRetenue + bonusTotal;
  const caCible = cible.ca;

  let issue: AdjudicationPayload['issue'] = 'FAILURE';
  let degatsInfliges = 0;
  let desc = '';

  if (jet.valeurRetenue === 20 || (jet.valeurRetenue !== 1 && totalTouche >= caCible)) {
    const estCritique = jet.valeurRetenue === 20;
    issue = estCritique ? 'CRITICAL_SUCCESS' : 'SUCCESS';
    degatsInfliges = Math.max(1, interpreterJetDegats(degatsArme));
    if (estCritique) degatsInfliges += Math.max(1, interpreterJetDegats(degatsArme));

    if (typeDegatsArme && cible.vulnerabilites?.some(v => v.toLowerCase().includes(typeDegatsArme!.toLowerCase()))) {
      degatsInfliges *= 2;
    } else if (typeDegatsArme && cible.resistances?.some(r => r.toLowerCase().includes(typeDegatsArme!.toLowerCase()))) {
      degatsInfliges = Math.max(1, Math.floor(degatsInfliges / 2));
    }

    cible.pv = Math.max(0, cible.pv - degatsInfliges);
    desc = `${persoClone.nom} touche ${cible.nom} avec ${nomArme} (${totalTouche} vs CA ${caCible}${malusUsure < 0 ? `, usure ${malusUsure}` : ''}${raisonsDesavantage.length ? `, désavantage: ${raisonsDesavantage.join('/')}` : ''}) et inflige ${degatsInfliges} dégâts${typeDegatsArme ? ` (${typeDegatsArme})` : ''}. (PV : ${cible.pv}/${cible.pvMax})`;

    if (cible.pv === 0) {
      cible.statut = 'MORT';
      const xpGain = cible.xp || 0;
      if (xpGain > 0) {
        persoClone.experience += xpGain;
        desc += ` ${cible.nom} s'effondre (+${xpGain} XP).`;
      } else {
        desc += ` ${cible.nom} s'effondre, sans vie.`;
      }
    }
  } else {
    desc = `${persoClone.nom} rate ${cible.nom} avec ${nomArme} (${totalTouche} vs CA ${caCible}${raisonsDesavantage.length ? `, désavantage: ${raisonsDesavantage.join('/')}` : ''}).`;
  }

  combatClone.actionDisponible = false;
  combatClone.journalCombat.push(desc);
  persoClone = appliquerUsureEquipement(persoClone, 2);

  // Vérifier si tous les ennemis sont morts ou en fuite
  const ennemisActifs = combatClone.ennemis.filter(e => e.statut === 'ACTIF');
  if (ennemisActifs.length === 0) {
    combatClone.actif = false;
    combatClone.journalCombat.push('Victoire tactique : tous les adversaires sont éliminés ou en fuite.');
  }

  const adjudication: AdjudicationPayload = {
    phase: 'adjudication_resolved',
    action_type: 'ATTACK',
    competenceOuCarac: `Attaque ${nomArme}`,
    dice_roll: jet.valeurRetenue,
    type_lancer: typeJet,
    modificateur: bonusTotal,
    score_total: totalTouche,
    cible_dd_ou_ca: caCible,
    issue,
    mutations_etat: {
      degatsInfliges,
      descriptionTechnique: desc,
    },
  };

  return { combatModifie: combatClone, personnageModifie: persoClone, adjudication };
}

export function executerTourEnnemi(
  ennemi: Combatant,
  joueur: CharacterStats,
  combat: CombatState
): {
  combatModifie: CombatState;
  personnageModifie: CharacterStats;
  adjudication: AdjudicationPayload;
} {
  const combatClone: CombatState = JSON.parse(JSON.stringify(combat));
  const persoClone: CharacterStats = JSON.parse(JSON.stringify(joueur));
  const ennemieEnCours = combatClone.ennemis.find(e => e.id === ennemi.id);

  if (!ennemieEnCours || ennemieEnCours.statut !== 'ACTIF') {
    return {
      combatModifie: combatClone,
      personnageModifie: persoClone,
      adjudication: {
        phase: 'adjudication_resolved',
        action_type: 'ATTACK',
        dice_roll: 0,
        modificateur: 0,
        score_total: 0,
        cible_dd_ou_ca: 0,
        issue: 'SUCCESS',
        mutations_etat: { descriptionTechnique: `${ennemi.nom} n'est pas en mesure d'agir.` },
      },
    };
  }

  if (ennemieEnCours.comportement === 'RUSE_ET_FUITE' && ennemieEnCours.pv <= ennemieEnCours.pvMax * 0.3) {
    ennemieEnCours.statut = 'FUITE';
    const desc = `${ennemieEnCours.nom} prend panique, utilise son action bonus pour se désengager et détale dans les fourrés.`;
    combatClone.journalCombat.push(desc);

    const adjudication: AdjudicationPayload = {
      phase: 'adjudication_resolved',
      action_type: 'TACTICAL_FLEE',
      dice_roll: 20,
      modificateur: 0,
      score_total: 20,
      cible_dd_ou_ca: 10,
      issue: 'SUCCESS',
      mutations_etat: { descriptionTechnique: desc },
    };
    return { combatModifie: combatClone, personnageModifie: persoClone, adjudication };
  }

  const typeJetEnnemi = combatClone.postureDefensive ? 'desavantage' : 'normal';
  combatClone.postureDefensive = false;
  const atk = attaquerCibleAvecEnnemi(ennemieEnCours, persoClone, combatClone, typeJetEnnemi);
  combatClone.journalCombat.push(atk.desc);

  const adjudication: AdjudicationPayload = {
    phase: 'adjudication_resolved',
    action_type: 'ATTACK',
    competenceOuCarac: `Attaque ennemie (${ennemi.nom})`,
    dice_roll: atk.jet,
    type_lancer: typeJetEnnemi,
    modificateur: atk.bonusAtk,
    score_total: atk.total,
    cible_dd_ou_ca: persoClone.ca,
    issue: atk.issue,
    mutations_etat: {
      degatsInfliges: atk.degatsInfliges,
      pvDelta: -atk.degatsInfliges,
      descriptionTechnique: atk.desc,
    },
  };

  return { combatModifie: combatClone, personnageModifie: persoClone, adjudication };
}

export function executerEsquiveJoueur(
  joueur: CharacterStats,
  combat: CombatState
): {
  combatModifie: CombatState;
  personnageModifie: CharacterStats;
  adjudication: AdjudicationPayload;
} {
  if (combat.actionDisponible === false) {
    throw new Error('Action déjà dépensée ce tour.');
  }
  const combatClone: CombatState = JSON.parse(JSON.stringify(combat));
  combatClone.postureDefensive = true;
  combatClone.actionDisponible = false;
  const desc = `${joueur.nom} adopte une posture défensive (Esquive SRD 5e). Les assauts ennemis subiront un désavantage.`;
  combatClone.journalCombat.push(desc);

  const adjudication: AdjudicationPayload = {
    phase: 'adjudication_resolved',
    action_type: 'DEFENSIVE_STANCE',
    competenceOuCarac: 'Esquive active (Défense)',
    dice_roll: 20,
    modificateur: 0,
    score_total: 20,
    cible_dd_ou_ca: 0,
    issue: 'SUCCESS',
    mutations_etat: {
      descriptionTechnique: desc,
    },
  };

  return { combatModifie: combatClone, personnageModifie: JSON.parse(JSON.stringify(joueur)), adjudication };
}

export function executerSortJoueur(
  joueur: CharacterStats,
  combat: CombatState,
  sortNom: string,
  cibleId?: string
): {
  combatModifie: CombatState;
  personnageModifie: CharacterStats;
  adjudication: AdjudicationPayload;
} {
  const combatClone: CombatState = JSON.parse(JSON.stringify(combat));
  const persoClone: CharacterStats = JSON.parse(JSON.stringify(joueur));

  const slotDispo = persoClone.emplacementsSorts.find(s => s.total - s.utilise > 0);
  if (!slotDispo) {
    throw new Error('Aucun emplacement de sort disponible pour lancer un sort.');
  }
  slotDispo.utilise += 1;

  let desc = '';
  let degatsInfliges = 0;
  let soinDelta = 0;
  let issue: AdjudicationPayload['issue'] = 'SUCCESS';
  let jetTotal = 0;
  let cibleDdCa = 0;

  if (sortNom === 'Soin des blessures') {
    const modSag = calculerModificateur(persoClone.caracteristiques.SAG);
    const soin = Math.floor(Math.random() * 8) + 1 + Math.max(0, modSag);
    const pvAvant = persoClone.pvActuels;
    persoClone.pvActuels = Math.min(persoClone.pvMax, persoClone.pvActuels + soin);
    soinDelta = persoClone.pvActuels - pvAvant;
    desc = `${persoClone.nom} canalise une étincelle curative : +${soinDelta} PV récupérés. Emplacement de sort niveau ${slotDispo.niveau} dépensé.`;
    jetTotal = soin;
  } else {
    const cible = combatClone.ennemis.find(e => e.id === cibleId) || combatClone.ennemis.find(e => e.statut === 'ACTIF');
    if (!cible) {
      throw new Error('Aucune cible valide pour le sort');
    }
    const modInt = Math.max(
      calculerModificateur(persoClone.caracteristiques.INT),
      calculerModificateur(persoClone.caracteristiques.SAG)
    );
    const bonusAttaqueSort = modInt + persoClone.bonusMaitrise;
    const jet = lancerD20(persoClone.epuisement >= 3 ? 'desavantage' : 'normal');
    jetTotal = jet.valeurRetenue + bonusAttaqueSort;
    cibleDdCa = cible.ca;

    if (jet.valeurRetenue === 20 || (jet.valeurRetenue !== 1 && jetTotal >= cible.ca)) {
      degatsInfliges = Math.floor(Math.random() * 10) + 1;
      if (jet.valeurRetenue === 20) degatsInfliges += Math.floor(Math.random() * 10) + 1;
      cible.pv = Math.max(0, cible.pv - degatsInfliges);
      desc = `${persoClone.nom} projette un sortilège sur ${cible.nom} (${jetTotal} vs CA ${cible.ca}) : ${degatsInfliges} dégâts arcaniques.`;
      if (cible.pv === 0) {
        cible.statut = 'MORT';
        const xpGain = cible.xp || 0;
        if (xpGain > 0) persoClone.experience += xpGain;
        desc += xpGain > 0 ? ` ${cible.nom} est anéanti (+${xpGain} XP).` : ` ${cible.nom} est anéanti.`;
      }
      issue = jet.valeurRetenue === 20 ? 'CRITICAL_SUCCESS' : 'SUCCESS';
    } else {
      desc = `${persoClone.nom} libère son énergie arcanique mais l'éclair s'écrase sur les rochers (${jetTotal} vs CA ${cible.ca}). Emplacement dépensé.`;
      issue = 'FAILURE';
    }
  }

  combatClone.actionDisponible = false;
  combatClone.journalCombat.push(desc);

  if (!combatClone.ennemis.some(e => e.statut === 'ACTIF')) {
    combatClone.actif = false;
    combatClone.journalCombat.push('Victoire arcanique : zone pacifiée.');
  }

  const adjudication: AdjudicationPayload = {
    phase: 'adjudication_resolved',
    action_type: 'SPELL',
    competenceOuCarac: `Sortilège : ${sortNom}`,
    dice_roll: jetTotal,
    modificateur: 0,
    score_total: jetTotal,
    cible_dd_ou_ca: cibleDdCa,
    issue,
    mutations_etat: {
      degatsInfliges: degatsInfliges > 0 ? degatsInfliges : undefined,
      pvDelta: soinDelta > 0 ? soinDelta : undefined,
      emplacementConsomme: 1,
      descriptionTechnique: desc,
    },
  };

  return { combatModifie: combatClone, personnageModifie: persoClone, adjudication };
}

export function executerFuiteJoueur(
  joueur: CharacterStats,
  combat: CombatState
): {
  combatModifie: CombatState;
  personnageModifie: CharacterStats;
  adjudication: AdjudicationPayload;
  fuiteReussie: boolean;
} {
  const combatClone: CombatState = JSON.parse(JSON.stringify(combat));
  const persoClone: CharacterStats = JSON.parse(JSON.stringify(joueur));

  const modDex = calculerModificateur(persoClone.caracteristiques.DEX);
  const typeJet = persoClone.epuisement >= 1 ? 'desavantage' : 'normal';
  const jet = lancerD20(typeJet);
  const total = jet.valeurRetenue + modDex;
  const ddFuite = 12;
  const fuiteReussie = total >= ddFuite;

  let desc = '';
  if (fuiteReussie) {
    combatClone.actif = false;
    desc = `${persoClone.nom} se désengage habilement (${total} vs DD ${ddFuite}) et rompt le combat pour se replier.`;
  } else {
    combatClone.actionDisponible = false;
    desc = `${persoClone.nom} tente de fuir mais trébuche dans les décombres (${total} vs DD ${ddFuite}). L'ennemi bloque la retraite.`;
  }
  combatClone.journalCombat.push(desc);

  const adjudication: AdjudicationPayload = {
    phase: 'adjudication_resolved',
    action_type: 'TACTICAL_FLEE',
    competenceOuCarac: 'Désengagement et fuite tactique (DEX)',
    dice_roll: jet.valeurRetenue,
    type_lancer: typeJet,
    modificateur: modDex,
    score_total: total,
    cible_dd_ou_ca: ddFuite,
    issue: fuiteReussie ? 'SUCCESS' : 'FAILURE',
    mutations_etat: {
      descriptionTechnique: desc,
    },
  };

  return { combatModifie: combatClone, personnageModifie: persoClone, adjudication, fuiteReussie };
}
