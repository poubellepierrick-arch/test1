import {
  AzgaarBurgDef,
  AzgaarWorldState,
  CampaignArc,
  CharacterStats,
  Faction,
  HexNode,
  SimulationState,
  WorldForgeConfig,
  WorldLoreBundle,
  WorldLoreEra,
  WorldNpcDetailLevel,
  WorldNpcImportance,
  WorldNpcRecord,
  WorldNpcTier,
  WorldRegionLore,
  WorldReligionLore,
  WorldStateLore,
} from '../types';
import { createSeededRng, hashString } from '../utils/prng';
import { calculerDistanceHex } from './hexcrawl';

const PRENOMS_PNJ = [
  'Aldric', 'Bram', 'Céleste', 'Dorian', 'Elia', 'Faramond', 'Giselle', 'Halvor',
  'Iseult', 'Jorah', 'Kaelen', 'Lyra', 'Maël', 'Nora', 'Orin', 'Perrine',
  'Quentin', 'Rowan', 'Soren', 'Thalia', 'Ulric', 'Vesper', 'Wendel', 'Ysaline',
];

const NOMS_FAMILLE_PNJ = [
  'Vane', 'Brisefer', 'Valmont', 'Grisbois', 'du Gué', 'Rochelle', 'Sombreval', 'Clairmont',
  'Mornac', 'Fauvel', 'd’Orge', 'Terrebasse', 'Lombard', 'Karr', 'Vieuxpont', 'Sablet',
];

const APPARENCES_PNJ = [
  'cicatrice pâle sous la pommette gauche et manteau rapiécé',
  'mains tachées de suie ou d’encre et regard vif',
  'port droit, cape boutonnée de laiton et bottes boueuses',
  'barbe ou tresse soignée retenue par une agrafe d’étain',
  'silhouette noueuse marquée par les intempéries',
  'anneau d’argent terni à l’index et démarche mesurée',
  'mèche blanche précoce et besace toujours sanglée',
  'carrure large et manteau de laine brute',
];

const MANIES_PNJ = [
  'pèse chaque mot avant de répondre',
  'tapote son étui ou sa bourse en parlant',
  'jette toujours un coup d’œil vers la porte ou la route',
  'parle par phrases courtes et directes',
  'emploie volontiers de vieux proverbes locaux',
  'plisse les yeux comme pour jauger la bourse de son interlocuteur',
];

const PROFESSIONS_LAMBDA = [
  'Tisserand', 'Charpentier', 'Palefrenier', 'Fournier', 'Saunier',
  'Batelier', 'Herboriste', 'Tailleur de pierre', 'Tonnelier', 'Courrier',
  'Aubergiste', 'Chaudronnier', 'Pêcheur', 'Meunier', 'Scribe municipal',
];

const PROFESSIONS_PROCHES = [
  'Maître-forgeron', 'Bailli local', 'Sentinelle des murs', 'Tenancier du Relais',
  'Apothicaire', 'Capitaine de convoi', 'Intendant des greniers', 'Guetteur des cols',
];

const DEVISES_ETATS = [
  'Par le fer et le serment',
  'Rien ne plie sans mémoire',
  'Or, sel et frontière ferme',
  'Veiller quand l’ombre monte',
  'La route appartient à qui la paie',
  'Pierre froide, parole sûre',
];

export const TONALITES_DISPONIBLES = [
  'Low-fantasy âpre & survie frontalière',
  'Chronique politique & guerres de succession',
  'Anciens mystères & ruines oubliées',
  'Frontière maritime & routes marchandes',
];

export function obtenirTonalitesDisponibles(): string[] {
  return [...TONALITES_DISPONIBLES];
}

function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length) % arr.length];
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function projeterCoordsHex(
  hx: Pick<HexNode, 'q' | 'r'>,
  studio: Pick<AzgaarWorldState, 'width' | 'height' | 'originHexX' | 'originHexY' | 'heroBurgId' | 'burgs'>
): { x: number; y: number } {
  const originBurg =
    studio.burgs.find(b => b.hexId === 'hex_0_0') ||
    studio.burgs.find(b => b.id === studio.heroBurgId) ||
    studio.burgs.find(b => b.capital) ||
    studio.burgs[0];
  const centerX = studio.originHexX ?? originBurg?.x ?? studio.width * 0.5;
  const centerY = studio.originHexY ?? originBurg?.y ?? studio.height * 0.5;
  const hexStep = 78;
  return {
    x: clamp(centerX + (Math.sqrt(3) * hx.q + (Math.sqrt(3) / 2) * hx.r) * hexStep * 0.62, 10, studio.width - 10),
    y: clamp(centerY + 1.5 * hx.r * hexStep * 0.62, 10, studio.height - 10),
  };
}

/** Génère un lore complet et cohérent de façon purement déterministe (sert de base ou de repli). */
export function genererLoreProcedural(
  studio: AzgaarWorldState,
  factions: Faction[],
  config?: Partial<WorldForgeConfig>
): WorldLoreBundle {
  const seed = studio.seed || 104729;
  const rng = createSeededRng(seed + 7919);
  const tonalite = config?.tonalite || TONALITES_DISPONIBLES[0];
  const worldName = studio.worldName || 'Terres Sans Nom';

  const cataclysme = pick(
    [
      'l’Effondrement des Digues d’Argent',
      'la Longue Gelée des Sept Hivers',
      'la Rupture du Pacte de Cendre',
      'l’Assèchement de la Mer Médiane',
    ],
    rng
  );
  const reliqueAncienne = pick(
    [
      'les bornes de basalte gravées avant les premiers royaumes',
      'les forges enfouies de l’Âge du Fer Noir',
      'les phares astronomiques d’avant la Chute',
      'les chaussées englouties des anciens arpenteurs',
    ],
    rng
  );

  const genese = `${worldName} porte encore les cicatrices de ${cataclysme}. Sur les ruines de cités plus anciennes subsistent ${reliqueAncienne}, autour desquelles les États actuels se disputent les routes, les gisements et l’allégeance des bourgs frontaliers.`;

  const chroniqueEres: WorldLoreEra[] = [
    {
      id: `era_1_${seed}`,
      periode: 'Âge Premier (-600 à -220)',
      titre: 'Le Temps des Arpenteurs',
      resume: `Des bâtisseurs aujourd’hui oubliés tracèrent les grandes chaussées et élevèrent ${reliqueAncienne} afin de relier les bassins fluviaux.`,
      tracesActuelles: 'Des bornes milliaires brisées et des caves scellées subsistent sous plusieurs places fortes.',
    },
    {
      id: `era_2_${seed}`,
      periode: 'Âge des Ruptures (-220 à -35)',
      titre: `La Crise de ${cataclysme}`,
      resume: `Guerres de succession, famines et déplacements de peuples redessinèrent les frontières et brisèrent l’ancien empire unitaire.`,
      tracesActuelles: 'De nombreuses provinces frontalières restent peuplées de lignées mixtes et de garnisons autonomes.',
    },
    {
      id: `era_3_${seed}`,
      periode: 'Temps Présent (0 à aujourd’hui)',
      titre: 'L’Équilibre Armé des Marches',
      resume: `Les puissances actuelles maintiennent une paix nerveuse faite de péages, de comptoirs marchands et d’escarmouches discrètes.`,
      tracesActuelles: 'Les caravanes exigent des escortes et chaque bourg surveille ses voisins.',
    },
  ];

  const etatsLore: WorldStateLore[] = studio.states.map((st, idx) => {
    const cap = studio.burgs.find(b => b.id === st.capitalBurgId);
    const culture = studio.cultures.find(c => c.id === st.cultureId);
    const rivaux = Object.entries(st.diplomacy || {})
      .filter(([, s]) => s === 'Guerre' || s === 'Rival')
      .map(([id]) => studio.states.find(o => o.id === Number(id))?.name)
      .filter(Boolean);
    return {
      stateId: st.id,
      nom: st.name,
      devise: DEVISES_ETATS[(idx + seed) % DEVISES_ETATS.length],
      histoire: `${st.name} s’est forgé sous l’égide d’une ${st.government.toLowerCase()} de tradition ${culture?.name || 'locale'}, rayonnant depuis ${cap?.name || 'sa capitale'}.`,
      tensionInterne:
        rivaux.length > 0
          ? `La pression exercée par ${rivaux.join(' et ')} alimente le mécontentement fiscal dans les marches.`
          : `Les guildes urbaines et les commandants provinciaux se disputent le contrôle des octrois.`,
      secretEtat: `Les coffres de ${st.name} dépendent d’un accord discret ou d’une dette cachée contractée auprès d’une maison marchande rivale.`,
    };
  });

  const religionsLore: WorldReligionLore[] = studio.religions.map((rel, idx) => ({
    religionId: rel.id,
    nom: rel.name,
    dogme: `${rel.name} (${rel.type}) enseigne la vénération de ${rel.deity} comme garant de l’ordre des saisons, des serments et des morts.`,
    rites:
      idx % 2 === 0
        ? 'Offrandes d’eau vive aux carrefours, veille des solstices et serments scellés sur le fer.'
        : 'Jeûnes mensuels, bénédiction des convois et lecture des tablettes d’argile.',
    clerge: 'Structuré autour de chapitres locaux proches des magistrats et des guildes.',
    heresieSecrete: `Un courant dissident au sein de ${rel.name} prétend que ${rel.deity} a jadis pactisé avec une entité enfouie sous les monts.`,
  }));

  const regionsLore: WorldRegionLore[] = studio.burgs.slice(0, 14).map((b, idx) => {
    const st = studio.states.find(s => s.id === b.stateId);
    const exp = (b.exportations || []).join(', ') || 'denrées locales';
    return {
      id: `reglore_${b.id}`,
      burgId: b.id,
      hexId: b.hexId,
      nom: b.name,
      histoireLocale: `${b.name} (${b.capital ? 'siège souverain' : 'bourg provincial'} de ${st?.name || 'terres franches'}) s’est bâti autour de ${b.port ? 'son mouillage abrité' : b.citadel ? 'sa vieille tour de guet' : 'son carrefour de routes'}.`,
      legendePopulaire: pick(
        [
          `On raconte qu’une cloche immergée ou enfouie sous ${b.name} sonne avant chaque hiver rigoureux.`,
          `Les anciens affirment qu’aucun serment brisé à ${b.name} ne reste impuni plus d’une lunaison.`,
          `Une galerie condamnée sous le marché de ${b.name} mènerait vers un ancien poste de péage oublié.`,
        ],
        rng
      ),
      particulariteEconomique: b.specialisation
        ? `${b.specialisation} — échanges dominés par : ${exp}.`
        : `Commerce régional de proximité (${exp}).`,
      secretLocal: `Une cache de contrebande ou un registre compromettant lié à ${b.name} intéresse vivement les factions voisines (#${idx + 1}).`,
    };
  });

  const startBurg = studio.burgs.find(b => b.id === studio.heroBurgId) || studio.burgs[0];
  const rivalState = studio.states.find(s => s.id !== startBurg?.stateId) || studio.states[1];

  const arcsInitiaux = [
    {
      id: `arc_frontiere_${seed}`,
      titre: `Les Ombres de ${startBurg?.name || worldName}`,
      resume: `Des convois disparaissent ou paient tribut entre ${startBurg?.name || 'le bourg'} et les confins${rivalState ? ` de ${rivalState.name}` : ''}.`,
      acteursNoms: [factions[0]?.nom || 'Autorités locales', factions[1]?.nom || 'Puissance rivale'],
      enjeu: 'Sécuriser les routes vitales ou négocier un nouvel équilibre local.',
      prochaineEtape: 'Recueillir les témoignages des artisans, sentinelles et voyageurs de proximité.',
    },
    {
      id: `arc_vestige_${seed}`,
      titre: `L’Héritage de ${cataclysme}`,
      resume: `Des relevés anciens pointent vers ${reliqueAncienne} dissimulées hors des murs.`,
      acteursNoms: [studio.religions[0]?.name || 'Clergé local'],
      enjeu: 'Retrouver ou sceller un site ancien avant qu’une faction hostile ne s’en empare.',
      prochaineEtape: 'Suivre les rumeurs sur les ruines et marques gravées aux alentours.',
    },
  ];

  const secretsMondeMJ = [
    `Vérité enfouie : ${cataclysme} n’était pas un accident naturel mais le prix d’un ancien rituel d’alliance.`,
    `Jeu diplomatique : ${rivalState?.name || 'une puissance voisine'} finance en sous-main des éclaireurs près de ${startBurg?.name || 'la frontière'}.`,
    `Réseau souterrain : un registre partagé entre plusieurs baillis recense les vrais détenteurs des dettes de guerre.`,
  ];

  return {
    version: 1,
    tonalite,
    generationSource: 'PROCEDURAL',
    genese,
    chroniqueEres,
    etatsLore,
    religionsLore,
    regionsLore,
    arcsInitiaux,
    secretsMondeMJ,
  };
}

function obtenirCoordsPourPnj(
  npc: Pick<WorldNpcRecord, 'hexId' | 'burgId'>,
  hexagones: HexNode[],
  studio?: AzgaarWorldState
): { hex?: HexNode; x: number; y: number } {
  const hex = npc.hexId ? hexagones.find(h => h.id === npc.hexId) : undefined;
  if (hex && studio) {
    const pos = projeterCoordsHex(hex, studio);
    return { hex, x: pos.x, y: pos.y };
  }
  const burg = npc.burgId && studio ? studio.burgs.find(b => b.id === npc.burgId) : undefined;
  if (burg) {
    const mappedHex = burg.hexId ? hexagones.find(h => h.id === burg.hexId) : hex;
    return { hex: mappedHex, x: burg.x, y: burg.y };
  }
  return {
    hex,
    x: studio?.heroX ?? 600,
    y: studio?.heroY ?? 380,
  };
}

export function calculerProximitePnj(
  npc: WorldNpcRecord,
  hexActuel: HexNode,
  hexagones: HexNode[],
  studio?: AzgaarWorldState,
  arcsActifs: CampaignArc[] = [],
  quetesActives: Array<{ interlocuteur: string; statut: string }> = []
): { distanceHex: number; proximityScore: number; lieAuScenario: boolean } {
  let distanceHex = 6;
  const coords = obtenirCoordsPourPnj(npc, hexagones, studio);
  if (coords.hex) {
    distanceHex = calculerDistanceHex(coords.hex, hexActuel);
  } else if (studio) {
    const heroPos = projeterCoordsHex(hexActuel, studio);
    const pixelDist = Math.hypot(coords.x - heroPos.x, coords.y - heroPos.y);
    distanceHex = Math.max(1, Math.round(pixelDist / 68));
  }

  const nomLower = npc.nom.toLowerCase();
  const lieArc =
    (npc.arcIds && npc.arcIds.length > 0 && arcsActifs.some(a => a.statut === 'ACTIF' && npc.arcIds!.includes(a.id))) ||
    arcsActifs.some(
      a =>
        a.statut === 'ACTIF' &&
        ((a.acteursLies || []).some(act => act.toLowerCase().includes(nomLower)) ||
          a.resume.toLowerCase().includes(nomLower))
    );
  const lieQuete = quetesActives.some(
    q => q.statut !== 'DECLINEE' && q.interlocuteur.toLowerCase().includes(nomLower)
  );
  const lieAuScenario = Boolean(npc.estLienHeros || lieArc || lieQuete);

  let proximityScore = Math.max(0, 60 - distanceHex * 11);
  if (npc.estLienHeros) proximityScore += 100;
  if (npc.tier === 'MAJEUR_MONDE') proximityScore += 55;
  if (lieArc || lieQuete) proximityScore += 80;
  if (distanceHex === 0) proximityScore += 45;

  return { distanceHex, proximityScore, lieAuScenario };
}

function construireNomUnique(rng: () => number, usedNames: Set<string>): string {
  for (let i = 0; i < 18; i++) {
    const nom = `${pick(PRENOMS_PNJ, rng)} ${pick(NOMS_FAMILLE_PNJ, rng)}`;
    if (!usedNames.has(nom)) {
      usedNames.add(nom);
      return nom;
    }
  }
  const fallback = `${pick(PRENOMS_PNJ, rng)} ${pick(NOMS_FAMILLE_PNJ, rng)}-${usedNames.size + 1}`;
  usedNames.add(fallback);
  return fallback;
}

/** Enrichit de façon déterministe un PNJ (utilisé à la création ou lors d'une promotion de proximité). */
export function promouvoirPnjDeterministe(
  npc: WorldNpcRecord,
  studio?: AzgaarWorldState,
  lore?: WorldLoreBundle,
  cibleLevel: WorldNpcDetailLevel = 'LOCAL'
): WorldNpcRecord {
  const rng = createSeededRng(hashString(`${npc.id}:${studio?.seed || 1}`));
  const burg = npc.burgId && studio ? studio.burgs.find(b => b.id === npc.burgId) : undefined;
  const state = npc.stateId && studio ? studio.states.find(s => s.id === npc.stateId) : undefined;
  const regionLore = lore?.regionsLore.find(r => r.burgId === npc.burgId || r.hexId === npc.hexId);
  const lieuLabel = burg?.name || regionLore?.nom || state?.name || 'le secteur';

  const apparence =
    npc.apparence && npc.apparence.length > 18
      ? npc.apparence
      : `Habitant au visage marqué, ${pick(APPARENCES_PNJ, rng)}.`;
  const voixEtManies =
    npc.voixEtManies && npc.voixEtManies.length > 12
      ? npc.voixEtManies
      : `${pick(MANIES_PNJ, rng)}.`;
  const biographie =
    npc.biographie && npc.biographie.length > 25
      ? npc.biographie
      : `${npc.nom} exerce comme ${npc.profession.toLowerCase()} à ${lieuLabel}${state ? ` (${state.name})` : ''}. Connaît les usages de la rue, les convois réguliers et les tensions du voisinage.`;
  const motivationImmediate =
    npc.motivationImmediate && npc.motivationImmediate.length > 12
      ? npc.motivationImmediate
      : pick(
          [
            `Préserver son gagne-pain à ${lieuLabel} malgré la hausse des péages.`,
            `Retrouver la trace d’une livraison ou d’un proche parti sur la route voisine.`,
            `Éviter d’attirer l’attention des patrouilles tout en écoulant ses informations.`,
          ],
          rng
        );
  const secret =
    npc.secret && npc.secret.length > 12
      ? npc.secret
      : pick(
          [
            `A récemment prêté abri ou vendu des vivres à un éclaireur sans le déclarer au bailliage.`,
            `Possède une vieille clé ou un bordereau prouvant un détournement d’octroi local.`,
            `Redoute qu’un incident ancien survenu hors des murs ne remonte jusqu’à ${lieuLabel}.`,
          ],
          rng
        );
  const rumeurConnue = npc.rumeurConnue || {
    titre: `Écho de ${lieuLabel}`,
    texte:
      regionLore?.legendePopulaire ||
      `Des voyageurs assurent que les patrouilles doublent de vigilance aux approches de ${lieuLabel}.`,
  };
  const suggestions =
    npc.suggestions && npc.suggestions.length >= 2
      ? npc.suggestions
      : [
          `Interroger ${npc.nom} sur son métier à ${lieuLabel}`,
          `Demander les nouvelles des routes et des bourgs voisins`,
          `Sonder son avis sur ${state?.name || 'les autorités locales'}`,
        ];

  const nextTier: WorldNpcTier = npc.tier === 'LAMBDA_LOINTAIN' ? 'PROCHE_PREGEN' : npc.tier;

  return {
    ...npc,
    tier: nextTier,
    detailLevel: npc.detailLevel === 'COMPLET' ? 'COMPLET' : cibleLevel,
    enrichmentPending: true,
    apparence,
    voixEtManies,
    resumePublic: `${npc.profession} à ${lieuLabel}. ${apparence}`,
    biographie,
    motivationImmediate,
    objectifLongTerme:
      cibleLevel === 'COMPLET'
        ? npc.objectifLongTerme || `Assurer l'avenir des siens à ${lieuLabel}.`
        : npc.objectifLongTerme,
    secret,
    rumeurConnue,
    suggestions,
  };
}

/** Génère la population complète en 3 paliers (Majeurs/Héros, Proches pré-générés, Lambda lointains). */
export function genererPnjsProcedural(
  studio: AzgaarWorldState,
  factions: Faction[],
  hexagones: HexNode[],
  lore: WorldLoreBundle,
  hero: CharacterStats,
  config?: Partial<WorldForgeConfig>
): WorldNpcRecord[] {
  const seed = studio.seed || 104729;
  const rng = createSeededRng(seed + 4211);
  const radiusProche = Math.max(1, Math.min(4, config?.radiusProche ?? 2));
  const lambdaParBourg = Math.max(1, Math.min(4, config?.lambdaParBourg ?? 2));
  const usedNames = new Set<string>();
  const pnjs: WorldNpcRecord[] = [];

  const heroBurg =
    studio.burgs.find(b => b.id === (config?.heroBurgId || studio.heroBurgId)) ||
    studio.burgs.find(b => b.hexId === 'hex_0_0') ||
    studio.burgs[0];
  const hexDepart =
    hexagones.find(h => h.id === heroBurg?.hexId) ||
    hexagones.find(h => h.q === 0 && h.r === 0) ||
    hexagones[0];

  // 1. TIER 1A : Figures majeures du monde (1 souverain/dirigeant par État + autorités religieuses)
  studio.states.forEach((st, idx) => {
    const capBurg =
      studio.burgs.find(b => b.id === st.capitalBurgId) ||
      studio.burgs[idx % Math.max(1, studio.burgs.length)];
    const faction = factions.find(f => f.id === st.factionId);
    const nom = construireNomUnique(rng, usedNames);
    const titre =
      st.government.includes('Royaume')
        ? 'Souverain'
        : st.government.includes('Duché')
          ? 'Grand-Duc'
          : st.government.includes('République')
            ? 'Premier Syndic'
            : st.government.includes('Théocratie')
              ? 'Hiérarque'
              : 'Commandeur';

    pnjs.push({
      id: `npc_majeur_state_${st.id}_${seed}`,
      nom,
      profession: `${titre} de ${st.name}`,
      tier: 'MAJEUR_MONDE',
      detailLevel: 'COMPLET',
      importance: idx === 0 ? 'SOUVERAIN' : 'CHEF_FACTION',
      generationSource: 'PROCEDURAL',
      burgId: capBurg?.id,
      hexId: capBurg?.hexId,
      stateId: st.id,
      factionId: faction?.id,
      cultureId: st.cultureId,
      arcIds: lore.arcsInitiaux[0] ? [lore.arcsInitiaux[0].id] : [],
      distanceHex: 0,
      proximityScore: 0,
      alignement: idx % 2 === 0 ? 'Loyal Neutre' : 'Neutre Strict',
      disposition:
        faction?.relationsJoueur === 'HOSTILE'
          ? 'HOSTILE'
          : faction?.relationsJoueur === 'ALLIE'
            ? 'AMICAL'
            : 'NEUTRE',
      humeur: 'Calculateur et souverain',
      seuilDD: 16,
      apparence: `Sceau de ${st.name} au col, ${pick(APPARENCES_PNJ, rng)}.`,
      voixEtManies: `${pick(MANIES_PNJ, rng)}.`,
      resumePublic: `Figure dirigeante de ${st.name}, siège à ${capBurg?.name || 'la capitale'}.`,
      biographie: `Tient les rênes politiques et militaires de ${st.name} depuis la dernière crise frontalière. Arbitre les octrois, les garnisons et les traités.`,
      motivationImmediate: `Consolidation des frontières et loyauté des bailliages de ${st.name}.`,
      objectifLongTerme: `Imposer l’hégémonie de ${st.name} sur les routes marchandes du continent.`,
      secret:
        lore.etatsLore.find(e => e.stateId === st.id)?.secretEtat ||
        `Négocie un pacte discret en marge du conseil.`,
      rumeurConnue: {
        titre: `Conseil de ${st.name}`,
        texte: `Des dépêches scellées quittent ${capBurg?.name || st.name} à l’aube vers les garnisons avancées.`,
      },
      suggestions: [
        `Solliciter une audience ou une lettre de créance de ${st.name}`,
        `Interroger sur les tensions avec les États voisins`,
        `Proposer des services d’éclaireur ou d’escorte`,
      ],
      decouvertParJoueur: Boolean(capBurg && capBurg.id === heroBurg?.id),
    });
  });

  studio.religions.slice(0, 3).forEach((rel, idx) => {
    const relBurg =
      studio.burgs.find(b => b.religionId === rel.id && b.temple) ||
      studio.burgs[idx % Math.max(1, studio.burgs.length)];
    const nom = construireNomUnique(rng, usedNames);
    pnjs.push({
      id: `npc_majeur_rel_${rel.id}_${seed}`,
      nom,
      profession: `Primat de ${rel.name}`,
      tier: 'MAJEUR_MONDE',
      detailLevel: 'COMPLET',
      importance: 'AUTORITE_CULTE',
      generationSource: 'PROCEDURAL',
      burgId: relBurg?.id,
      hexId: relBurg?.hexId,
      stateId: relBurg?.stateId,
      religionId: rel.id,
      arcIds: lore.arcsInitiaux[1] ? [lore.arcsInitiaux[1].id] : [],
      distanceHex: 0,
      proximityScore: 0,
      alignement: 'Neutre Bon',
      disposition: 'NEUTRE',
      humeur: 'Solennel et attentif',
      seuilDD: 15,
      apparence: `Étole rituelle de ${rel.deity}, ${pick(APPARENCES_PNJ, rng)}.`,
      voixEtManies: `${pick(MANIES_PNJ, rng)}.`,
      resumePublic: `Autorité spirituelle de ${rel.name}, gardien des archives du temple à ${relBurg?.name || 'la cité'}.`,
      biographie: `Interprète les dogmes de ${rel.deity} et supervise les aumôneries et sanctuaires de la région.`,
      motivationImmediate: `Préserver l’unité du culte face aux rumeurs d’hérésie.`,
      objectifLongTerme: `Retrouver les reliques de l’Âge Premier mentionnées dans le canon de ${rel.name}.`,
      secret:
        lore.religionsLore.find(r => r.religionId === rel.id)?.heresieSecrete ||
        `Dissimule des tablettes contredisant la doctrine officielle.`,
      rumeurConnue: {
        titre: `Archives de ${rel.name}`,
        texte: `Le clergé surveille de près toute expédition s’approchant des ruines de l’ancien âge.`,
      },
      suggestions: [
        `Questionner sur les dogmes de ${rel.deity}`,
        `Demander accès aux chroniques anciennes`,
        `Évoquer les phénomènes étranges des confins`,
      ],
      decouvertParJoueur: Boolean(relBurg && relBurg.id === heroBurg?.id),
    });
  });

  // 2. TIER 1B : PNJ importants spécifiquement liés au personnage joueur (Mentor, Contact, Rival)
  const heroHist = hero.historique || hero.classe || 'aventurier';
  const heroDocRef = hero.documents?.find(d => d.actifPourMJ && d.contenu.trim())?.titre;
  const voisinBurg = studio.burgs.find(b => b.id !== heroBurg?.id) || heroBurg;

  const liensHerosSpecs: Array<{
    suffix: string;
    importance: WorldNpcImportance;
    nature: string;
    prof: string;
    burg?: AzgaarBurgDef;
    disp: WorldNpcRecord['disposition'];
    bio: string;
    motiv: string;
    secret: string;
  }> = [
    {
      suffix: 'mentor',
      importance: 'MENTOR',
      nature: `Ancien compagnon ou maître d’armes lié au passé de ${hero.nom} (${heroHist})`,
      prof: `Vétéran instructeur à ${heroBurg?.name || 'Val-Serein'}`,
      burg: heroBurg,
      disp: 'AMICAL',
      bio: `A connu ${hero.nom} avant son arrivée à ${heroBurg?.name || 'Val-Serein'}${heroDocRef ? ` (évoqué dans « ${heroDocRef} »)` : ''}. Sert de repère pragmatique dans une région rude.`,
      motiv: `Veiller à ce que ${hero.nom} ne commette pas les erreurs fatales de leur ancienne compagnie.`,
      secret: `Conserve une lettre ou dette d’honneur qui explique pourquoi ${hero.nom} a dû quitter ses terres d’origine.`,
    },
    {
      suffix: 'contact',
      importance: 'CONTACT',
      nature: `Correspondant informel et passeur d’informations pour ${hero.nom}`,
      prof: `Courtière de renseignements à ${heroBurg?.name || 'Val-Serein'}`,
      burg: heroBurg,
      disp: 'NEUTRE',
      bio: `Tient registre des caravanes, dettes et visiteurs discrets pour le compte de quelques commanditaires dont ${hero.nom} a croisé la route.`,
      motiv: `Monnayer des renseignements fiables sans se compromettre auprès du bailliage.`,
      secret: `Travaille en parallèle pour une faction concurrente afin de couvrir ses arrières.`,
    },
    {
      suffix: 'rival',
      importance: 'RIVAL',
      nature: `Rival ou créancier poursuivant un contentieux avec ${hero.nom}`,
      prof: `Mercenaire mandaté près de ${voisinBurg?.name || 'la frontière'}`,
      burg: voisinBurg,
      disp: 'MEFIANT',
      bio: `A croisé ${hero.nom} par le passé autour d’un contrat contesté ou d’une affaire de ${heroHist.toLowerCase()}. Surveille sa progression dans les marches.`,
      motiv: `Devancer ${hero.nom} sur les contrats lucratifs ou récupérer ce qui lui revient.`,
      secret: `A reçu pour consigne de ne pas abattre ${hero.nom} tant qu’il peut mener ses commanditaires vers un ancien site.`,
    },
  ];

  for (const spec of liensHerosSpecs) {
    const nom = construireNomUnique(rng, usedNames);
    const hexId = spec.burg?.hexId || (spec.burg?.id === heroBurg?.id ? hexDepart?.id : undefined);
    pnjs.push({
      id: `npc_hero_${spec.suffix}_${seed}`,
      nom,
      profession: spec.prof,
      tier: 'LIEN_HEROS',
      detailLevel: 'COMPLET',
      importance: spec.importance,
      generationSource: 'PROCEDURAL',
      burgId: spec.burg?.id,
      hexId,
      stateId: spec.burg?.stateId,
      arcIds: lore.arcsInitiaux[0] ? [lore.arcsInitiaux[0].id] : [],
      distanceHex: spec.burg?.id === heroBurg?.id ? 0 : 2,
      proximityScore: 150,
      estLienHeros: true,
      lienHerosNature: spec.nature,
      alignement: spec.disp === 'AMICAL' ? 'Neutre Bon' : 'Neutre',
      disposition: spec.disp,
      humeur:
        spec.disp === 'AMICAL'
          ? 'Franc et prévenant'
          : spec.disp === 'MEFIANT'
            ? 'Froid et ironique'
            : 'Discret et alerte',
      seuilDD: spec.disp === 'AMICAL' ? 10 : 14,
      apparence: `${pick(APPARENCES_PNJ, rng)}.`,
      voixEtManies: `${pick(MANIES_PNJ, rng)}.`,
      resumePublic: `${spec.prof}. Entretenait déjà un lien avec ${hero.nom} avant cette campagne.`,
      biographie: spec.bio,
      motivationImmediate: spec.motiv,
      objectifLongTerme: `Régler définitivement ce qui le lie à ${hero.nom}.`,
      secret: spec.secret,
      rumeurConnue: {
        titre: `Piste personnelle de ${nom}`,
        texte: `On a repéré des émissaires s’informant discrètement sur les allées et venues de ${hero.nom}.`,
      },
      suggestions: [
        `Évoquer votre passé commun avec ${nom}`,
        `Demander ce qu’il sait de la situation locale`,
        `Sonder ses intentions actuelles`,
      ],
      decouvertParJoueur: spec.burg?.id === heroBurg?.id,
    });
  }

  // 3. TIER 2 : PNJ locaux pré-générés dans le rayon géographique proche (<= radiusProche)
  const hexProches = hexDepart
    ? hexagones.filter(h => !h.estEau && calculerDistanceHex(h, hexDepart) <= radiusProche)
    : [];
  for (const hx of hexProches) {
    const dist = hexDepart ? calculerDistanceHex(hx, hexDepart) : 0;
    const burgLocal = studio.burgs.find(b => b.hexId === hx.id);
    if (!burgLocal && !hx.pointInteret && dist > 1) continue;

    const nbLocaux = hx.id === hexDepart?.id ? 3 : burgLocal || hx.pointInteret ? 2 : 1;
    for (let i = 0; i < nbLocaux; i++) {
      const nom = construireNomUnique(rng, usedNames);
      const prof =
        hx.id === hexDepart?.id
          ? i === 0
            ? `Maître-forgeron de ${hx.nom}`
            : i === 1
              ? `Bailli de ${hx.nom}`
              : `Sentinelle de ${hx.nom}`
          : pick(PROFESSIONS_PROCHES, rng);

      const basePnj: WorldNpcRecord = {
        id: `npc_local_${hx.id}_${i}_${seed}`,
        nom,
        profession: prof,
        tier: 'PROCHE_PREGEN',
        detailLevel: 'LOCAL',
        importance: 'CITOYEN',
        generationSource: 'PROCEDURAL',
        burgId: burgLocal?.id,
        hexId: hx.id,
        stateId: burgLocal?.stateId,
        factionId: hx.factionControleId || undefined,
        distanceHex: dist,
        proximityScore: 60 - dist * 10,
        alignement: 'Neutre',
        disposition: i === 0 ? 'AMICAL' : 'NEUTRE',
        humeur: 'Vigilant et pragmatique',
        seuilDD: 12,
        apparence: '',
        voixEtManies: '',
        resumePublic: '',
        biographie: '',
        motivationImmediate: '',
        suggestions: [],
        decouvertParJoueur: dist === 0,
      };
      const enrichi = promouvoirPnjDeterministe(basePnj, studio, lore, 'LOCAL');
      enrichi.enrichmentPending = false;
      pnjs.push(enrichi);
    }
  }

  // 4. TIER 3 : PNJ lambda lointains sur tous les autres bourgs de la carte (légers, prêts à promouvoir)
  const hexIdsProches = new Set(hexProches.map(h => h.id));
  for (const b of studio.burgs) {
    if (b.hexId && hexIdsProches.has(b.hexId)) continue;
    const pixelDist = Math.hypot(b.x - (heroBurg?.x ?? 600), b.y - (heroBurg?.y ?? 380));
    const estProchePx = pixelDist <= radiusProche * 72;
    const distApprox = Math.max(1, Math.round(pixelDist / 68));

    for (let k = 0; k < lambdaParBourg; k++) {
      const nom = construireNomUnique(rng, usedNames);
      const prof = pick(PROFESSIONS_LAMBDA, rng);
      const base: WorldNpcRecord = {
        id: `npc_lambda_${b.id}_${k}_${seed}`,
        nom,
        profession: prof,
        tier: estProchePx ? 'PROCHE_PREGEN' : 'LAMBDA_LOINTAIN',
        detailLevel: estProchePx ? 'LOCAL' : 'LEGER',
        importance: 'CITOYEN',
        generationSource: 'PROCEDURAL',
        burgId: b.id,
        hexId: b.hexId,
        stateId: b.stateId,
        cultureId: b.cultureId,
        religionId: b.religionId,
        distanceHex: distApprox,
        proximityScore: Math.max(5, 50 - distApprox * 8),
        alignement: 'Neutre',
        disposition: 'NEUTRE',
        humeur: 'Ordinaire',
        seuilDD: 11,
        apparence: pick(APPARENCES_PNJ, rng),
        voixEtManies: pick(MANIES_PNJ, rng),
        resumePublic: `${prof} ordinaire établi à ${b.name}.`,
        biographie: `Habitant de ${b.name} vivant au rythme des récoltes et des passages de caravanes.`,
        motivationImmediate: `Assurer son quotidien à ${b.name}.`,
        suggestions: [`Demander son quotidien à ${b.name}`, `S'enquérir des nouvelles du bourg`],
        decouvertParJoueur: false,
      };
      if (estProchePx) {
        const promo = promouvoirPnjDeterministe(base, studio, lore, 'LOCAL');
        promo.enrichmentPending = false;
        pnjs.push(promo);
      } else {
        pnjs.push(base);
      }
    }
  }

  return pnjs;
}

/**
 * Synchronise `pnjsMonde` avec le graphe épistémique (`grapheNoeuds` / `grapheLiens`)
 * et promeut automatiquement tout PNJ lambda entrant dans le rayon géographique ou scénaristique.
 */
export function reconcilierProximitePnjs(
  etat: SimulationState,
  radiusProche: number = 2
): { promotedIds: string[] } {
  if (!etat.pnjsMonde || etat.pnjsMonde.length === 0) {
    return { promotedIds: [] };
  }

  const promotedIds: string[] = [];
  const arcsActifs = etat.memoireMJ?.arcsNarratifs || [];
  const quetesActives = etat.memoireMJ?.promessesEtQuetes || [];

  etat.pnjsMonde = etat.pnjsMonde.map(npc => {
    const prox = calculerProximitePnj(
      npc,
      etat.hexActuel,
      etat.hexagones,
      etat.azgaarStudio,
      arcsActifs,
      quetesActives
    );
    let updated: WorldNpcRecord = {
      ...npc,
      distanceHex: prox.distanceHex,
      proximityScore: prox.proximityScore,
      decouvertParJoueur:
        npc.decouvertParJoueur || (prox.distanceHex === 0 && !etat.donjon?.actif),
    };

    const doitPromouvoir =
      updated.detailLevel === 'LEGER' &&
      (prox.distanceHex <= radiusProche || prox.lieAuScenario);

    if (doitPromouvoir) {
      updated = promouvoirPnjDeterministe(
        updated,
        etat.azgaarStudio,
        etat.loreMonde,
        prox.lieAuScenario ? 'COMPLET' : 'LOCAL'
      );
      promotedIds.push(updated.id);
    }

    return updated;
  });

  // Réconcilier les nœuds Actor dans grapheNoeuds / grapheLiens pour les PNJ présents ou dans le secteur hexagone
  const hexIdsConnus = new Set(etat.hexagones.map(h => h.id));
  if (!Array.isArray(etat.grapheNoeuds)) etat.grapheNoeuds = [];
  if (!Array.isArray(etat.grapheLiens)) etat.grapheLiens = [];

  for (const npc of etat.pnjsMonde) {
    if (!npc.hexId && npc.burgId && etat.azgaarStudio) {
      const b = etat.azgaarStudio.burgs.find(x => x.id === npc.burgId);
      if (b?.hexId) npc.hexId = b.hexId;
    }

    const estSurCarteHex = Boolean(npc.hexId && hexIdsConnus.has(npc.hexId));
    const estPertinentPourGraphe =
      estSurCarteHex ||
      npc.tier === 'MAJEUR_MONDE' ||
      npc.tier === 'LIEN_HEROS' ||
      npc.detailLevel !== 'LEGER';

    if (!estPertinentPourGraphe) continue;

    const existingIdx = etat.grapheNoeuds.findIndex(n => n.id === npc.id);
    const propsNode = {
      profession: npc.profession,
      alignement: npc.alignement,
      disposition: npc.disposition,
      humeur: npc.humeur,
      seuilDD: npc.seuilDD,
      seuilTolerance: 45,
      hexId: npc.hexId,
      burgId: npc.burgId,
      factionId: npc.factionId,
      tier: npc.tier,
      detailLevel: npc.detailLevel,
      importance: npc.importance,
      apparence: npc.apparence,
      voixEtManies: npc.voixEtManies,
      biographie: npc.biographie,
      motivation: npc.motivationImmediate,
      secret: npc.secret,
      lienHerosNature: npc.lienHerosNature,
      suggestions: npc.suggestions,
      rumeursConnues: npc.rumeurConnue
        ? [{ id: `rum_${npc.id}`, titre: npc.rumeurConnue.titre, texte: npc.rumeurConnue.texte }]
        : [],
    };

    if (existingIdx >= 0) {
      const prev = etat.grapheNoeuds[existingIdx];
      etat.grapheNoeuds[existingIdx] = {
        ...prev,
        label: npc.nom,
        proprietes: {
          ...prev.proprietes,
          ...propsNode,
          historiqueDialogue: prev.proprietes?.historiqueDialogue || [],
        },
        connuParEntites: npc.hexId
          ? Array.from(new Set([...(prev.connuParEntites || []), npc.hexId]))
          : prev.connuParEntites,
      };
    } else {
      etat.grapheNoeuds.push({
        id: npc.id,
        type: 'Actor',
        label: npc.nom,
        proprietes: propsNode,
        connuParEntites: npc.hexId ? [npc.hexId] : [],
      });
    }

    if (npc.hexId) {
      const aLienLieu = etat.grapheLiens.some(
        l => l.source === npc.id && l.cible === npc.hexId && l.relation === 'LOCATED_IN'
      );
      if (!aLienLieu) {
        etat.grapheLiens.push({
          source: npc.id,
          cible: npc.hexId,
          relation: 'LOCATED_IN',
          horodatageTick: etat.horloge.tick,
        });
      }
    }
  }

  return { promotedIds };
}
