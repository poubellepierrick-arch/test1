import { SimulationState, GraphNode, HexNode, Rumor, GmPromiseQuest } from '../types';
import { ActionRequest } from './adjudication';
import { obtenirPnjsEnVue } from './encounters';
import { traverserGraphe, filtrerParFrontiereDeConnaissance } from './graph';
import { calculerDistanceHex } from './hexcrawl';
import { extraireMetadataAzgaarDepuisEtat } from './azgaarGenerator';

export interface HeroPerceivedNpc {
  id: string;
  nom: string;
  profession: string;
  disposition: string;
  humeur: string;
  seuilDD: number;
  tier?: string;
  apparence?: string;
  voixEtManies?: string;
  lienHerosNature?: string;
  historiqueDialogue: Array<{
    date: string;
    sujet: string;
    issue: string;
    repliquePnj?: string;
  }>;
  faitsPartages: string[];
}

export interface HeroPerceivedRumor {
  id: string;
  titre: string;
  texte: string;
  source: string;
  statutPerception: 'INCERTAINE' | 'CONFIRMEE' | 'DEMENTIE';
  lieuObtention?: string;
}

export interface HeroEpistemicView {
  perceptionImmediate: {
    lieuActuel: {
      id: string;
      nom: string;
      q: number;
      r: number;
      terrain: string;
      biome: string;
      securite: string;
      meteo: string;
      temperature: string;
      heure: number;
      jour: number;
      pointInteret?: string;
    };
    donjonActuel?: {
      nom: string;
      salleId: string;
      salleNom: string;
      description: string;
    };
    abordsImmediats: Array<{
      id: string;
      q: number;
      r: number;
      decouvert: boolean;
      label: string;
    }>;
    pnjsEnVue: HeroPerceivedNpc[];
    entitesEnVue: Array<{
      id: string;
      nom: string;
      type: string;
      lieu: string;
      destinationConnue?: string;
    }>;
    indicesSensoriels: string[];
  };
  savoirVerifie: {
    lieuxDecouverts: Array<{
      id: string;
      nom: string;
      q: number;
      r: number;
      terrain: string;
      brouillard: 'REPERE' | 'EXPLORE';
      pointInteret?: string;
      annotation?: string;
    }>;
    bourgsDecouverts: string[];
    marqueursDecouverts: string[];
    nouvellesLocales: Array<{ jour: number; titre: string; impact: string }>;
    engagementsAcceptes: GmPromiseQuest[];
    propositionsEnAttente: GmPromiseQuest[];
    lorePublic?: {
      genese?: string;
      eres: string[];
      etatsConnus: string[];
      religionsConnues: string[];
      lieuxLore: string[];
    };
  };
  souvenirsEtOuieDire: {
    dernieresInfos: string[];
    souvenirsContextuels: string[];
    notesPersonnelles?: string;
    documentsActifs: Array<{ titre: string; categorie: string; extrait: string }>;
    chroniqueRecente: string[];
    rumeursEntendues: HeroPerceivedRumor[];
  };
  realiteCacheeMonde: {
    lieuxInconnus: Array<{
      id: string;
      nom: string;
      q: number;
      r: number;
      terrain: string;
      pointInteret?: string;
      pressionDanger?: number;
    }>;
    bourgsEtEtatsCaches: string[];
    marqueursCaches: string[];
    factionsCompletes: string[];
    entitesHorsChamp: string[];
    pnjsSecrets: Array<{
      id: string;
      nom: string;
      lieu: string;
      enVue: boolean;
      secret?: string;
      motivation?: string;
    }>;
    pnjsMajeursEtLies?: string[];
    secretsLoreMJ?: string[];
    veraciteRumeurs: Array<{ titre: string; veracite: boolean }>;
    arcsNarratifs: Array<{
      titre: string;
      statut: string;
      progression: number;
      acteurs: string;
      prochaineEtape?: string;
    }>;
    consequencesDifferees: Array<{ declencheur: string; effetPrevu: string }>;
    notesSecretesMJ: Array<{ jour: number; titre: string; contenu: string }>;
  };
}

function normaliserTexte(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function hexEstDecouvert(hex: HexNode, hexActuelId: string): boolean {
  return hex.id === hexActuelId || hex.brouillard === 'EXPLORE' || hex.brouillard === 'REPERE';
}

export function construireVueEpistemiqueHeros(etat: SimulationState): HeroEpistemicView {
  const hexActuel = etat.hexActuel;
  const decouvertsIds = new Set(
    etat.hexagones.filter(h => hexEstDecouvert(h, hexActuel.id)).map(h => h.id)
  );
  const pnjsEnVueBruts = etat.donjon?.actif ? [] : obtenirPnjsEnVue(etat);
  const pnjsEnVueIds = new Set(pnjsEnVueBruts.map(p => p.id));

  // 1. Abords immédiats (sans nommer les hexagones encore INCONNU)
  const abordsImmediats = etat.hexagones
    .filter(h => calculerDistanceHex(h, hexActuel) === 1)
    .map(h => {
      const decouvert = decouvertsIds.has(h.id);
      if (decouvert) {
        return {
          id: h.id,
          q: h.q,
          r: h.r,
          decouvert: true,
          label: h.estEau
            ? `${h.nom} [${h.q},${h.r}] (Mer/Eau)`
            : `${h.nom} [${h.q},${h.r}] (${h.biomeAzgaar || h.terrain}, ${h.routeNiveau || 'AUCUNE'}, ${h.securite})`,
        };
      }
      return {
        id: h.id,
        q: h.q,
        r: h.r,
        decouvert: false,
        label: h.estEau
          ? `Étendue d'eau inexplorée [${h.q},${h.r}]`
          : `Secteur inconnu [${h.q},${h.r}] (${h.terrain})`,
      };
    });

  // 2. PNJ physiquement dans le champ de vision (sans leurs secrets cachés)
  const pnjsEnVue: HeroPerceivedNpc[] = pnjsEnVueBruts.map(pnj => {
    const sub = traverserGraphe(pnj.id, etat.grapheNoeuds, etat.grapheLiens, 2);
    const filtre = filtrerParFrontiereDeConnaissance(sub, pnj.id);
    const record = etat.pnjsMonde?.find(p => p.id === pnj.id);
    return {
      id: pnj.id,
      nom: pnj.label,
      profession: pnj.proprietes?.profession || record?.profession || 'Voyageur',
      disposition: pnj.proprietes?.disposition || record?.disposition || 'NEUTRE',
      humeur: pnj.proprietes?.humeur || record?.humeur || 'Calme',
      seuilDD: pnj.proprietes?.seuilDD || record?.seuilDD || 12,
      tier: pnj.proprietes?.tier || record?.tier,
      apparence: pnj.proprietes?.apparence || record?.apparence,
      voixEtManies: pnj.proprietes?.voixEtManies || record?.voixEtManies,
      lienHerosNature: pnj.proprietes?.lienHerosNature || record?.lienHerosNature,
      historiqueDialogue: (pnj.proprietes?.historiqueDialogue || []).slice(0, 3),
      faitsPartages: filtre.faitsPertinents,
    };
  });

  // 3. Entités mobiles à portée de vue (sur hex actuel ou voisin déjà découvert)
  const visibleEntiteHexIds = new Set(
    etat.hexagones
      .filter(h => h.id === hexActuel.id || (decouvertsIds.has(h.id) && calculerDistanceHex(h, hexActuel) <= 1))
      .map(h => h.id)
  );

  const entitesEnVue = (etat.entitesMonde || [])
    .filter(e => e.statut === 'EN_ROUTE' && visibleEntiteHexIds.has(e.hexId))
    .map(e => {
      const hexPos = etat.hexagones.find(h => h.id === e.hexId)?.nom || e.hexId;
      const destHex = etat.hexagones.find(h => h.id === e.destinationHexId);
      const destConnue = destHex && decouvertsIds.has(destHex.id) ? destHex.nom : undefined;
      return {
        id: e.id,
        nom: e.nom,
        type: e.type,
        lieu: hexPos,
        destinationConnue: destConnue,
      };
    });

  // 4. Indices sensoriels indirects dérivés de la réalité proche sans révéler les secrets/noms cachés
  const indicesSensoriels: string[] = [];
  const voisinsInconnusDangereux = etat.hexagones.filter(
    h => !decouvertsIds.has(h.id) && calculerDistanceHex(h, hexActuel) === 1 && (h.pressionDanger ?? 0) >= 65
  );
  if (voisinsInconnusDangereux.length > 0) {
    indicesSensoriels.push('Signes diffus d\'activité hostile aux confins d\'un secteur inexploré voisin.');
  }
  const entiteProcheCachee = (etat.entitesMonde || []).find(
    e =>
      e.statut === 'EN_ROUTE' &&
      !visibleEntiteHexIds.has(e.hexId) &&
      (() => {
        const eh = etat.hexagones.find(h => h.id === e.hexId);
        return eh ? calculerDistanceHex(eh, hexActuel) === 1 : false;
      })()
  );
  if (entiteProcheCachee) {
    indicesSensoriels.push('Bruits de marche ou traces fraîches à la limite du champ de vision.');
  }
  if (etat.donjon?.actif) {
    const salle = etat.donjon.salles.find(s => s.id === etat.donjon!.salleActuelleId);
    const aVoisinPiege = salle?.connexions.some(cid => {
      const c = etat.donjon!.salles.find(x => x.id === cid);
      return c && c.danger !== 'AUCUN';
    });
    if (aVoisinPiege) {
      indicesSensoriels.push('Courants d\'air froids et odeur de pierre humide ou de rouille depuis les passages voisins.');
    }
  }
  if (etat.personnage.pvActuels <= 4) {
    indicesSensoriels.push('Souffle court, plaies douloureuses et vision qui vacille.');
  }

  // 5. Savoir vérifié : lieux découverts
  const lieuxDecouverts = etat.hexagones
    .filter(h => !h.estEau && hexEstDecouvert(h, hexActuel.id))
    .map(h => ({
      id: h.id,
      nom: h.nom,
      q: h.q,
      r: h.r,
      terrain: h.biomeAzgaar || h.terrain,
      brouillard: (h.id === hexActuel.id ? 'EXPLORE' : h.brouillard) as 'REPERE' | 'EXPLORE',
      pointInteret: h.pointInteret ? `${h.pointInteret.nom} (${h.pointInteret.type})` : undefined,
      annotation: h.annotationJoueur,
    }));

  // 6. Azgaar burgs & marqueurs : filtrés selon proximité aux hexagones découverts
  const studio = etat.azgaarStudio;
  const coordsDecouverts: Array<{ x: number; y: number }> = [];
  if (studio) {
    for (const h of etat.hexagones.filter(hx => hexEstDecouvert(hx, hexActuel.id))) {
      // Projection cohérente avec la grille Azgaar
      const x = 600 + h.q * 110 + h.r * 55;
      const y = 380 + h.r * 95;
      coordsDecouverts.push({ x, y });
    }
  }
  const estProcheSavoir = (x: number, y: number) =>
    coordsDecouverts.some(c => Math.hypot(c.x - x, c.y - y) <= 135);

  const bourgsDecouverts: string[] = [];
  const bourgsEtEtatsCaches: string[] = [];
  const marqueursDecouverts: string[] = [];
  const marqueursCaches: string[] = [];

  if (studio) {
    const etatsMap = new Map(studio.states.map(s => [s.id, s]));
    for (const b of studio.burgs) {
      const etatNom = etatsMap.get(b.stateId)?.name || 'Terres libres';
      const label = `${b.name}${b.port ? ' [Port]' : ''}${b.capital ? ' [Cap]' : ''} (${etatNom})`;
      if (b.id === studio.heroBurgId || estProcheSavoir(b.x, b.y)) {
        bourgsDecouverts.push(label);
      } else {
        bourgsEtEtatsCaches.push(`${label} (${Math.round(b.x)},${Math.round(b.y)})`);
      }
    }
    for (const s of studio.states) {
      const guerres = Object.entries(s.diplomacy || {})
        .filter(([, status]) => status === 'Guerre')
        .map(([id]) => studio.states.find(o => o.id === Number(id))?.name)
        .filter(Boolean);
      bourgsEtEtatsCaches.push(
        `État ${s.name} (${s.government}${guerres.length ? `, guerre: ${guerres.join('/')}` : ''})`
      );
    }
    for (const m of studio.markers) {
      const label = `[${m.icon}] ${m.title}${m.note ? ` — ${m.note}` : ''}`;
      if (m.author === 'JOUEUR' || (m.author !== 'MJ' && estProcheSavoir(m.x, m.y))) {
        marqueursDecouverts.push(label);
      } else {
        marqueursCaches.push(`[${m.author}:${m.icon}] ${m.title} (${Math.round(m.x)},${Math.round(m.y)})`);
      }
    }
  }

  // 7. Nouvelles parvenues jusqu'ici
  const nouvellesLocales = (etat.chroniqueMonde || [])
    .filter(c => {
      if (c.categorie === 'METEO') return true;
      if (c.hexId && decouvertsIds.has(c.hexId)) return true;
      return etat.grapheNoeuds.some(
        n =>
          n.type === 'Event' &&
          n.label === c.titre &&
          Array.isArray(n.connuParEntites) &&
          n.connuParEntites.includes(hexActuel.id)
      );
    })
    .slice(0, 5)
    .map(c => ({ jour: c.jour, titre: c.titre, impact: c.impact }));

  // 8. Quêtes acceptées vs Propositions en attente
  const mem = etat.memoireMJ;
  const toutesQuetes = mem?.promessesEtQuetes || [];
  const propositionsEnAttente = toutesQuetes.filter(q => q.statut === 'PROPOSEE');
  const engagementsAcceptes = toutesQuetes.filter(q => q.statut !== 'PROPOSEE' && q.statut !== 'DECLINEE');

  // 9. Souvenirs, documents et rumeurs perçues (sans jamais exposer `veracite`)
  let budgetDocs = 4000;
  const documentsActifs: Array<{ titre: string; categorie: string; extrait: string }> = [];
  for (const doc of (etat.personnage.documents || []).filter(d => d.actifPourMJ && d.contenu.trim())) {
    if (budgetDocs <= 0) break;
    const extrait = doc.contenu.slice(0, budgetDocs);
    budgetDocs -= extrait.length;
    documentsActifs.push({ titre: doc.titre, categorie: doc.categorie, extrait });
  }

  const rumeursEntendues: HeroPerceivedRumor[] = (etat.rumeurs || []).map((r: Rumor) => ({
    id: r.id,
    titre: r.titre,
    texte: r.texte,
    source: r.source,
    statutPerception: r.statutPerception || 'INCERTAINE',
    lieuObtention: r.lieuObtention,
  }));

  // 10. Réalité cachée du vaste monde (strictement réservée au MJ côté coulisses)
  const lieuxInconnus = etat.hexagones
    .filter(h => !h.estEau && !decouvertsIds.has(h.id))
    .map(h => ({
      id: h.id,
      nom: h.nom,
      q: h.q,
      r: h.r,
      terrain: h.biomeAzgaar || h.terrain,
      pointInteret: h.pointInteret ? `${h.pointInteret.nom} (${h.pointInteret.type}, ${h.pointInteret.statut})` : undefined,
      pressionDanger: h.pressionDanger,
    }));

  const factionsCompletes = etat.factions.map(
    f =>
      `${f.nom}: ${f.posture || 'NEUTRE'} (Force:${f.forceMilitaire}/${f.forceMax ?? 80}, Moral:${f.moral ?? 65}, Pop:${f.populationTotale ?? 250}, Usure:${f.lassitudeGuerre ?? 10}%, RelationJoueur:${f.relationsJoueur})`
  );

  const entitesHorsChamp = (etat.entitesMonde || [])
    .filter(e => e.statut === 'EN_ROUTE' && !visibleEntiteHexIds.has(e.hexId))
    .map(e => {
      const pos = etat.hexagones.find(h => h.id === e.hexId)?.nom || e.hexId;
      const dst = etat.hexagones.find(h => h.id === e.destinationHexId)?.nom || e.destinationHexId;
      return `${e.nom} (${e.type}) à ${pos} → ${dst}`;
    });

  const pnjsSecrets = (etat.grapheNoeuds || [])
    .filter(n => n.type === 'Actor')
    .filter(n => n.proprietes?.secret || n.proprietes?.motivation || !pnjsEnVueIds.has(n.id))
    .map(n => ({
      id: n.id,
      nom: n.label,
      lieu: n.proprietes?.hexId || 'Inconnu',
      enVue: pnjsEnVueIds.has(n.id),
      secret: n.proprietes?.secret,
      motivation: n.proprietes?.motivation,
    }));

  const salleDonjon = etat.donjon?.actif
    ? etat.donjon.salles.find(s => s.id === etat.donjon!.salleActuelleId)
    : undefined;

  const lore = etat.loreMonde;
  const lorePublic = lore
    ? {
        genese: lore.genese,
        eres: (lore.chroniqueEres || []).slice(0, 3).map(e => `${e.periode} — ${e.titre}: ${e.resume}`),
        etatsConnus: (lore.etatsLore || []).slice(0, 5).map(e => `${e.nom} (« ${e.devise} »): ${e.histoire}`),
        religionsConnues: (lore.religionsLore || []).slice(0, 4).map(r => `${r.nom}: ${r.dogme}`),
        lieuxLore: (lore.regionsLore || [])
          .filter(r =>
            r.hexId
              ? decouvertsIds.has(r.hexId)
              : bourgsDecouverts.some(b => b.toLowerCase().startsWith(r.nom.toLowerCase()))
          )
          .slice(0, 6)
          .map(r => `${r.nom}: ${r.histoireLocale} (Légende: ${r.legendePopulaire})`),
      }
    : undefined;

  const secretsLoreMJ: string[] = [];
  if (lore) {
    for (const s of lore.secretsMondeMJ || []) secretsLoreMJ.push(s);
    for (const e of lore.etatsLore || []) {
      if (e.secretEtat) secretsLoreMJ.push(`[État ${e.nom}] ${e.secretEtat}`);
    }
    for (const r of lore.religionsLore || []) {
      if (r.heresieSecrete) secretsLoreMJ.push(`[Culte ${r.nom}] ${r.heresieSecrete}`);
    }
    for (const reg of lore.regionsLore || []) {
      if (reg.secretLocal) secretsLoreMJ.push(`[Lieu ${reg.nom}] ${reg.secretLocal}`);
    }
  }

  const pnjsMajeursEtLies = (etat.pnjsMonde || [])
    .filter(p => p.tier === 'MAJEUR_MONDE' || p.tier === 'LIEN_HEROS')
    .slice(0, 10)
    .map(
      p =>
        `${p.nom} (${p.profession}, ${p.tier}${p.lienHerosNature ? `, lien: ${p.lienHerosNature}` : ''}) | Mobile: ${p.motivationImmediate}${p.secret ? ` | Secret: ${p.secret}` : ''}`
    );

  return {
    perceptionImmediate: {
      lieuActuel: {
        id: hexActuel.id,
        nom: hexActuel.nom,
        q: hexActuel.q,
        r: hexActuel.r,
        terrain: hexActuel.terrain,
        biome: hexActuel.biomeAzgaar || hexActuel.terrain,
        securite: hexActuel.securite,
        meteo: etat.horloge.meteo,
        temperature: etat.horloge.temperature,
        heure: etat.horloge.heure,
        jour: etat.horloge.jour,
        pointInteret: hexActuel.pointInteret
          ? `${hexActuel.pointInteret.nom} (${hexActuel.pointInteret.type}, ${hexActuel.pointInteret.statut})`
          : undefined,
      },
      donjonActuel: etat.donjon?.actif
        ? {
            nom: etat.donjon.nom,
            salleId: etat.donjon.salleActuelleId,
            salleNom: salleDonjon?.nom || etat.donjon.salleActuelleId,
            description: salleDonjon?.description || '',
          }
        : undefined,
      abordsImmediats,
      pnjsEnVue,
      entitesEnVue,
      indicesSensoriels,
    },
    savoirVerifie: {
      lieuxDecouverts,
      bourgsDecouverts,
      marqueursDecouverts,
      nouvellesLocales,
      engagementsAcceptes,
      propositionsEnAttente,
      lorePublic,
    },
    souvenirsEtOuieDire: {
      dernieresInfos: etat.personnage.memoire?.dernieresInfos || [],
      souvenirsContextuels: etat.personnage.memoire?.souvenirsContextuels || [],
      notesPersonnelles: etat.personnage.notesPersonnelles,
      documentsActifs,
      chroniqueRecente: etat.journalNarratif
        .slice(-5)
        .map(e => `[${e.horodatageDate}] ${e.titre}: ${e.texteNarratif}`),
      rumeursEntendues,
    },
    realiteCacheeMonde: {
      lieuxInconnus,
      bourgsEtEtatsCaches,
      marqueursCaches,
      factionsCompletes,
      entitesHorsChamp,
      pnjsSecrets,
      pnjsMajeursEtLies: pnjsMajeursEtLies.length > 0 ? pnjsMajeursEtLies : undefined,
      secretsLoreMJ: secretsLoreMJ.length > 0 ? secretsLoreMJ : undefined,
      veraciteRumeurs: (etat.rumeurs || []).map(r => ({ titre: r.titre, veracite: r.veracite })),
      arcsNarratifs: (mem?.arcsNarratifs || []).map(a => ({
        titre: a.titre,
        statut: a.statut,
        progression: a.progression,
        acteurs: (a.acteursLies || []).join(', ') || 'Monde',
        prochaineEtape: a.prochaineEtape,
      })),
      consequencesDifferees: (mem?.consequencesDifferees || [])
        .filter(c => c.actif)
        .map(c => ({ declencheur: c.declencheur, effetPrevu: c.effetPrevu })),
      notesSecretesMJ: (mem?.journalSecretMJ || [])
        .slice(-6)
        .map(n => ({ jour: n.jour, titre: n.titre, contenu: n.contenu })),
    },
  };
}

/**
 * Détermine si l'action envoyée par le joueur exprime un accord explicite ou un engagement volontaire.
 * Empêche le MJ d'inscrire une quête en EN_COURS à l'insu ou contre le gré du joueur.
 */
export function actionExprimeConsentementQuete(action?: ActionRequest): boolean {
  if (!action) return false;
  if (action.type === 'AJOUTER_QUETE') return true;
  const texte = normaliserTexte(`${action.texteLibre || ''} ${action.sujetDialogue || ''}`);
  if (!texte) return false;
  return /\b(j'?accepte|je promets|marche conclu|entendu|d'?accord|je m'?engage|je signe|compte sur moi|j'?irai|nous irons|je releve|je prends ce contrat|je prends le contrat|oui,? je le fais|je note cette quete|j'?accepte la quete)\b/i.test(
    texte
  );
}

const MOTIFS_PENSEE_OU_EMOTION: Array<{ regex: RegExp; label: string }> = [
  {
    regex: /\btu (?:penses|crois|supposes|devines|soupçonnes|doutes|hésites|crains|redoutes|espères|souhaites|veux|désires|préfères|regrettes|ressens|éprouves|te méfies|t['’]inquiètes|t['’]étonnes|te réjouis|as envie)\b/i,
    label: 'Attribution de pensée ou émotion interne au héros',
  },
  {
    regex: /\b(?:ton esprit|ton cœur|dans ta tête|au fond de toi|sans hésiter|à contrecœur|avec soulagement)\b/i,
    label: 'Interprétation subjective de l état intérieur du héros',
  },
];

const MOTIFS_DECISION_OU_ACTION_NON_DEMANDEE: Array<{ regex: RegExp; label: string }> = [
  {
    regex: /\btu (?:décides|choisis|résous|comptes|envisages|t['’]apprêtes|te prépares|entreprends|promets|donnes ta parole|t['’]engages)\b/i,
    label: 'Décision ou intention attribuée au joueur',
  },
];

/**
 * Détecte dans la prose du MJ toute présomption de pensée, émotion, motif ou décision du joueur.
 */
export function detecterPresomptionIntention(texte: string, actionOrigine?: ActionRequest): string[] {
  const anomalies: string[] = [];
  for (const m of MOTIFS_PENSEE_OU_EMOTION) {
    const hit = texte.match(m.regex);
    if (hit) {
      anomalies.push(`${m.label} (« ${hit[0]} »).`);
    }
  }
  const consentement = actionExprimeConsentementQuete(actionOrigine);
  for (const m of MOTIFS_DECISION_OU_ACTION_NON_DEMANDEE) {
    const hit = texte.match(m.regex);
    if (hit) {
      if (consentement && /promets|donnes ta parole|t['’]engages/i.test(hit[0])) continue;
      anomalies.push(`${m.label} (« ${hit[0]} »).`);
    }
  }
  return anomalies;
}

/**
 * Détecte les fuites d'informations strictement hors-champ dans la prose du MJ :
 * - Lieux encore sous brouillard INCONNU jamais mentionnés au joueur auparavant
 * - Données chiffrées internes de faction (Force: X/Y, Moral:, Usure:)
 * - Confirmation directe de véracité d'une rumeur pourtant INCERTAINE
 */
export function detecterFuitesEpistemiques(
  texte: string,
  etat: SimulationState,
  actionOrigine?: ActionRequest
): string[] {
  const anomalies: string[] = [];
  const texteNorm = normaliserTexte(texte);

  // Construire le corpus déjà connu du joueur (pour ne pas signaler un lieu déjà cité en rumeur/document/journal)
  const corpusConnu = normaliserTexte(
    [
      actionOrigine?.texteLibre || '',
      actionOrigine?.sujetDialogue || '',
      ...(etat.personnage.memoire?.dernieresInfos || []),
      ...(etat.personnage.memoire?.souvenirsContextuels || []),
      etat.personnage.notesPersonnelles || '',
      ...(etat.personnage.documents || []).map(d => `${d.titre} ${d.contenu}`),
      ...(etat.rumeurs || []).map(r => `${r.titre} ${r.texte}`),
      ...(etat.journalNarratif || []).map(j => `${j.titre} ${j.texteNarratif}`),
    ].join(' ')
  );

  for (const h of etat.hexagones) {
    if (h.estEau || hexEstDecouvert(h, etat.hexActuel.id)) continue;
    const candidats = [h.nom, h.pointInteret?.nom].filter((v): v is string => Boolean(v && v.trim().length >= 5));
    for (const nomCache of candidats) {
      const normNom = normaliserTexte(nomCache);
      if (!normNom || normNom.length < 5) continue;
      if (corpusConnu.includes(normNom)) continue;
      if (texteNorm.includes(normNom)) {
        anomalies.push(`Fuite épistémique : mention du lieu inexploré « ${nomCache} » encore inconnu du héros.`);
        break;
      }
    }
  }

  if (/\b(?:force militaire|force:\s*\d+\/\d+|moral:\s*\d+|usure:\s*\d+%|pressionDanger)\b/i.test(texte)) {
    anomalies.push('Fuite épistémique : métrique interne de faction exposée dans le récit.');
  }

  const rumeursIncertaines = (etat.rumeurs || []).filter(
    r => (r.statutPerception || 'INCERTAINE') === 'INCERTAINE'
  );
  if (
    rumeursIncertaines.length > 0 &&
    /\bcette rumeur est (?:vraie|fausse|mensongère|exacte)\b/i.test(texte)
  ) {
    anomalies.push('Fuite épistémique : révélation directe de la véracité d\'une rumeur non vérifiée.');
  }

  return anomalies;
}

/**
 * Neutralise toute formulation présomptive dans les 3 pistes d'action (doivent rester des gestes neutres).
 */
export function neutraliserPistesPresomptives(pistes: string[]): {
  pistes: string[];
  modifiees: boolean;
} {
  let modifiees = false;
  const propres = pistes.map(p => {
    let s = String(p || '').trim();
    const avant = s;
    s = s
      .replace(/^tu (?:décides|choisis|veux|comptes|vas|pars)\s+(?:de\s+|d['’]|à\s+)?/i, '')
      .replace(/^(?:décider de|accepter immédiatement de|choisir de)\s+/i, '');
    if (s.length > 0) {
      s = s.charAt(0).toUpperCase() + s.slice(1);
    }
    if (s !== avant) modifiees = true;
    return s;
  });
  return { pistes: propres, modifiees };
}

/**
 * Détecte les ruptures diégétiques dans le récit ou les pistes :
 * mentions d'interface (onglet, bouton, hexagone, tableau de bord) ou de métriques système brutes (PV, CA, XP, DD).
 */
export function detecterRuptureDiegetique(texte: string, suggestions: string[] = []): string[] {
  const anomalies: string[] = [];
  const metaMatch = texte.match(
    /\b(?:onglet|monde\s*&\s*atlas|tableau de bord|panneau latéral|barre d['’]action|interface|bouton|cliquer|hexagone|maître du jeu)\b/i
  );
  if (metaMatch) {
    anomalies.push(`Rupture diégétique : référence hors-jeu dans le récit (« ${metaMatch[0]} »).`);
  }
  const sysMatch = texte.match(/\b(?:PV|CA|XP|DD\s*\d+)\b|points de vie|classe d['’]armure/i);
  if (sysMatch) {
    anomalies.push(`Jargon système exposé dans le récit (« ${sysMatch[0]} »).`);
  }
  for (const sug of suggestions) {
    const sugMeta = String(sug).match(/\b(?:onglet|atlas|hexagone|tableau de bord|bouton|interface)\b/i);
    if (sugMeta) {
      anomalies.push(`Rupture diégétique dans une piste d action (« ${sugMeta[0]} »).`);
      break;
    }
  }
  return anomalies;
}

/**
 * Détecte les contradictions internes et répliques « catalogue de services » chez un PNJ :
 * 1) Amorcer par « tu tombes à pic / justement » puis enchaîner sur une offre multiple sans rapport.
 * 2) Contredire dans la même réplique une pénurie énoncée et une tâche qui exige cette ressource.
 */
export function detecterIncoherenceDialogue(texte: string): string[] {
  const anomalies: string[] = [];
  const repliques = Array.from(texte.matchAll(/«\s*([^»]+?)\s*»/g)).map(m => m[1]);

  for (const rep of repliques) {
    const repNorm = rep.toLowerCase();

    const aAmorceOpportune = /\b(?:tu tombes à pic|ça tombe bien|justement)\b/.test(repNorm);
    const aMenuTriple =
      /\bou\s+(?:du\s+)?négoce\b/.test(repNorm) ||
      /(?:,[^,?]+){1,}\s+ou\s+[^?]+\?/.test(repNorm);
    if (aAmorceOpportune && aMenuTriple) {
      anomalies.push(
        'Incohérence de dialogue : le PNJ invoque une urgence (« tu tombes à pic ») puis déroule un catalogue sans lien logique.'
      );
    }

    const manqueCombustible =
      /\b(?:faute de charbon|manque de charbon|plus de charbon|sans charbon|foyer éteint|foyer tire la langue)\b/.test(
        repNorm
      );
    const proposeTravailAuFeu =
      /\b(?:soufflets?|lame à entretenir|forger|chauffer|tremper)\b/.test(repNorm);
    if (manqueCombustible && proposeTravailAuFeu) {
      anomalies.push(
        'Contradiction matérielle : le PNJ déclare manquer de charbon ou de feu tout en proposant de souffler ou travailler le fer à chaud.'
      );
    }
  }

  return anomalies;
}

