import {
  Ability,
  CoherenceReport,
  SimulationState,
} from '../types';
import { obtenirPnjsEnVue } from '../engine/encounters';
import { parserSegmentsRecit } from '../utils/journalFormatting';
import { ActionRequest } from '../engine/adjudication';
import {
  detecterFuitesEpistemiques,
  detecterIncoherenceDialogue,
  detecterPresomptionIntention,
  detecterRuptureDiegetique,
  neutraliserPistesPresomptives,
} from '../engine/epistemic';

const ABILITIES_VALIDES: Ability[] = ['FOR', 'DEX', 'CON', 'INT', 'SAG', 'CHA'];

function normaliserTexte(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Compresse progressivement l'historique narratif de la campagne sans perdre les jalons clés.
 * Les entrées au-delà de `maxRecents` sont condensées dans `chroniqueCondensee`.
 */
export function compresserMemoireCampagne(
  etat: SimulationState,
  maxRecents = 8
): void {
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
  const mem = etat.memoireMJ;
  if (!Array.isArray(mem.filNarratif)) mem.filNarratif = [];
  if (!Array.isArray(mem.promessesEtQuetes)) mem.promessesEtQuetes = [];
  if (!Array.isArray(mem.consequencesDifferees)) mem.consequencesDifferees = [];
  if (!Array.isArray(mem.arcsNarratifs)) mem.arcsNarratifs = [];
  if (!Array.isArray(mem.journalSecretMJ)) mem.journalSecretMJ = [];
  if (typeof mem.chroniqueCondensee !== 'string') mem.chroniqueCondensee = '';

  if (mem.filNarratif.length <= maxRecents) {
    return;
  }

  const surplusCount = mem.filNarratif.length - maxRecents;
  const aArchiver = mem.filNarratif.slice(0, surplusCount);
  mem.filNarratif = mem.filNarratif.slice(surplusCount);

  const lignesExistantes = mem.chroniqueCondensee
    ? mem.chroniqueCondensee.split('\n').map(l => l.trim()).filter(Boolean)
    : [];
  const existantSet = new Set(lignesExistantes.map(normaliserTexte));

  for (const item of aArchiver) {
    const propre = String(item).trim().replace(/\s+/g, ' ').slice(0, 180);
    if (!propre) continue;
    const cle = normaliserTexte(propre);
    if (!existantSet.has(cle)) {
      lignesExistantes.push(propre);
      existantSet.add(cle);
    }
  }

  // Conserver les premiers jalons fondateurs + les jalons les plus récents dans un budget ~3000 caractères
  let texte = lignesExistantes.join('\n');
  if (texte.length > 3000 && lignesExistantes.length > 6) {
    const ancrages = lignesExistantes.slice(0, 3);
    const recents: string[] = [];
    let budget = 2900 - ancrages.join('\n').length;
    for (let i = lignesExistantes.length - 1; i >= 3; i -= 1) {
      const ligne = lignesExistantes[i];
      if (budget - ligne.length - 1 < 0) break;
      recents.unshift(ligne);
      budget -= ligne.length + 1;
    }
    texte = [...ancrages, '...', ...recents].join('\n');
  }

  mem.chroniqueCondensee = texte;
}

/**
 * Audit déterministe post-tour : vérifie et répare les invariants mécaniques,
 * géographiques (PNJ hors champ de vision) et de cohérence narrative.
 */
export function validerCoherenceTour(
  etat: SimulationState,
  parsed: {
    titre: string;
    texte: string;
    tonAmbiance: string;
    suggestionsMJ: string[];
  },
  appelsOutils: Array<{ nom: string; args: Record<string, any>; resultat: string }>,
  actionOrigine?: ActionRequest
): CoherenceReport {
  const controlesPasses: string[] = [];
  const anomalies: string[] = [];
  const corrections: string[] = [];

  const p = etat.personnage;

  // 1. Invariants personnage (PV, Épuisement, Ressources, Monnaies)
  if (p.pvActuels < 0 || p.pvActuels > p.pvMax) {
    p.pvActuels = Math.max(0, Math.min(p.pvMax, Math.trunc(p.pvActuels)));
    corrections.push(`PV recadrés dans [0..${p.pvMax}].`);
  }
  if (p.pvActuels === 0 && !p.estMortDefinitivement && !p.conditions.includes('Inconscient')) {
    p.conditions.push('Inconscient');
    corrections.push('Condition Inconscient ajoutée à 0 PV.');
  } else if (p.pvActuels > 0 && p.conditions.includes('Inconscient')) {
    p.conditions = p.conditions.filter(c => c !== 'Inconscient');
    corrections.push('Condition Inconscient retirée (PV > 0).');
  }

  if (p.epuisement < 0 || p.epuisement > 6) {
    p.epuisement = Math.max(0, Math.min(6, Math.trunc(p.epuisement)));
    corrections.push('Épuisement recadré dans [0..6].');
  }
  if (p.epuisement >= 6 && !p.estMortDefinitivement) {
    p.estMortDefinitivement = true;
    corrections.push('Mort par épuisement palier 6 appliquée.');
  }

  if (p.monnaies.po < 0 || p.monnaies.pa < 0 || p.monnaies.pc < 0) {
    p.monnaies.po = Math.max(0, Math.trunc(p.monnaies.po));
    p.monnaies.pa = Math.max(0, Math.trunc(p.monnaies.pa));
    p.monnaies.pc = Math.max(0, Math.trunc(p.monnaies.pc));
    corrections.push('Monnaies négatives ramenées à 0.');
  }

  if (p.rationsJours < 0 || p.rationsJours > p.rationsMaxJours) {
    p.rationsJours = Math.max(0, Math.min(p.rationsMaxJours, p.rationsJours));
    corrections.push('Rations recadrées.');
  }
  if (p.eauLitres < 0 || p.eauLitres > p.eauMaxLitres) {
    p.eauLitres = Number(Math.max(0, Math.min(p.eauMaxLitres, p.eauLitres)).toFixed(1));
    corrections.push('Eau recadrée.');
  }
  controlesPasses.push('Bornes PV / épuisement / bourse / survie');

  // 2. Cohérence Combat
  if (etat.combat.actif) {
    const actifs = etat.combat.ennemis.filter(e => e.statut === 'ACTIF');
    if (actifs.length === 0) {
      etat.combat.actif = false;
      corrections.push('Combat clos automatiquement (aucun ennemi actif restant).');
    }
  }
  controlesPasses.push('État tactique combat');

  // 3. Cohérence Donjon
  if (etat.donjon?.actif) {
    const salles = etat.donjon.salles || [];
    if (salles.length === 0) {
      etat.donjon = null;
      corrections.push('Donjon vide fermé.');
    } else {
      const ids = new Set(salles.map(s => s.id));
      if (!ids.has(etat.donjon.salleActuelleId)) {
        etat.donjon.salleActuelleId = salles[0].id;
        corrections.push('Salle actuelle du donjon réalignée sur l\'entrée.');
      }
      for (const s of salles) {
        const cleanConn = (s.connexions || []).filter(c => ids.has(c) && c !== s.id);
        if (cleanConn.length !== (s.connexions || []).length) {
          s.connexions = cleanConn;
          corrections.push(`Connexions nettoyées sur ${s.nom}.`);
        }
      }
    }
  }
  controlesPasses.push('Topologie du donjon');

  // 4. Cohérence Jet en attente
  if (etat.jetEnAttente) {
    const j = etat.jetEnAttente;
    if (!ABILITIES_VALIDES.includes(j.caracteristique)) {
      j.caracteristique = 'DEX';
      corrections.push('Caractéristique du jet en attente normalisée sur DEX.');
    }
    if (j.dd < 5 || j.dd > 25) {
      j.dd = Math.max(5, Math.min(25, Math.trunc(j.dd || 12)));
      corrections.push('DD du jet en attente recadré dans [5..25].');
    }
    controlesPasses.push('Jet demandé au joueur valide');
  }

  // 5. Frontière de vue PNJ sur les répliques du récit
  const pnjsEnVue = obtenirPnjsEnVue(etat);
  const nomsEnVue = new Set(pnjsEnVue.map(n => normaliserTexte(n.label)));
  const tousActors = (etat.grapheNoeuds || []).filter(n => n.type === 'Actor');
  const segments = parserSegmentsRecit(parsed.texte);

  for (const seg of segments) {
    if (seg.type !== 'dialogue' || !seg.locuteur) continue;
    const locNorm = normaliserTexte(seg.locuteur);
    const acteurConnu = tousActors.find(a => {
      const lab = normaliserTexte(a.label);
      return lab === locNorm || lab.includes(locNorm) || locNorm.includes(lab.split(' ')[0]);
    });
    if (acteurConnu) {
      const visible = nomsEnVue.has(normaliserTexte(acteurConnu.label));
      if (!visible) {
        anomalies.push(`Réplique attribuée à « ${acteurConnu.label} » alors que ce PNJ est hors champ de vision.`);
      }
    }
  }
  controlesPasses.push('Frontière géographique des PNJ parlants');

  // 6. Contrôle longueur selon modeNarration
  const mode = etat.modeNarration || 'CONCIS';
  const len = parsed.texte.trim().length;
  if (mode === 'ULTRA_COURT' && len > 420) {
    anomalies.push(`Récit long (${len} car.) pour le mode Ultra-court.`);
  } else if (mode === 'CONCIS' && len > 900) {
    anomalies.push(`Récit verbeux (${len} car.) pour le mode Concis.`);
  }
  controlesPasses.push(`Respect du mode narration (${mode})`);

  // 7. Traçabilité des outils
  if (appelsOutils.some(a => a.resultat.startsWith('Erreur:') || a.resultat.startsWith('Refus'))) {
    anomalies.push('Au moins un appel outil a été refusé ou a échoué pendant le tour.');
  }
  controlesPasses.push('Intégrité des appels outils MJ');

  // 8. Frontière épistémique (savoir/perception du héros vs réalité cachée du monde)
  const fuites = detecterFuitesEpistemiques(parsed.texte, etat, actionOrigine);
  if (fuites.length > 0) {
    anomalies.push(...fuites);
  }
  controlesPasses.push('Frontière épistémique (savoir vs monde)');

  // 9. Non-présomption des intentions, pensées ou décisions du joueur
  const presomptions = detecterPresomptionIntention(parsed.texte, actionOrigine);
  if (presomptions.length > 0) {
    anomalies.push(...presomptions);
  }
  if (Array.isArray(parsed.suggestionsMJ) && parsed.suggestionsMJ.length > 0) {
    const net = neutraliserPistesPresomptives(parsed.suggestionsMJ);
    if (net.modifiees) {
      parsed.suggestionsMJ.splice(0, parsed.suggestionsMJ.length, ...net.pistes);
      corrections.push('Pistes d action reformulées de manière neutre sans présumer du choix.');
    }
  }
  if (appelsOutils.some(a => a.resultat.includes('convertie en proposition'))) {
    corrections.push('Offre PNJ conservée en proposition en attente d accord explicite du joueur.');
  }
  controlesPasses.push('Non-présomption des intentions du joueur');

  // 10. Immersion diégétique (aucune référence UI, mécanique brute ou jargon hors-rôle)
  const ruptures = detecterRuptureDiegetique(parsed.texte, parsed.suggestionsMJ);
  if (ruptures.length > 0) {
    anomalies.push(...ruptures);
  }
  controlesPasses.push('Immersion diégétique et cohérence des rôles');

  // 11. Cohérence logique et matérielle des répliques PNJ
  const incoherencesDialogue = detecterIncoherenceDialogue(parsed.texte);
  if (incoherencesDialogue.length > 0) {
    anomalies.push(...incoherencesDialogue);
  }
  controlesPasses.push('Logique causale et matérielle des répliques PNJ');

  const statut: CoherenceReport['statut'] =
    corrections.length > 0 ? 'CORRIGE' : anomalies.length > 0 ? 'ALERTE' : 'VALIDE';

  return {
    statut,
    controlesPasses,
    anomalies,
    corrections,
  };
}
