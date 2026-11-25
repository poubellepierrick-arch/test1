export interface ActionSummaryInput {
  type: string;
  cibleId?: string;
  pnjId?: string;
  texteLibre?: string;
  sujetDialogue?: string;
  sortNom?: string;
  objetId?: string;
  recetteId?: string;
  directionSalleId?: string;
}

const TITRES_EN_COURS: Record<string, string> = {
  DEPLACER_HEX: 'En chemin',
  FORAGER: 'Glanage sur le terrain',
  REPOS_COURT: 'Halte brève',
  REPOS_LONG: 'Nuit de repos',
  ATTAQUER: 'Passe d’armes',
  ESQUIVER: 'Garde défensive',
  TOUR_ENNEMI: 'Riposte adverse',
  JETS_MORT: 'Au seuil de la mort',
  LANCER_SORT: 'Incantation',
  LANCER_SORT_GRIMOIRE: 'Incantation',
  FUIR_TACTIQUE: 'Repli tactique',
  DEPLACER_COMBAT: 'Mouvement tactique',
  DESENGAGER_COMBAT: 'Désengagement',
  TROQUER: 'Échange au comptoir',
  CORVEE_TRAVAIL: 'Labeur au bourg',
  ENGAGER_COMPAGNON: 'Recrutement',
  CONGEDIER_COMPAGNON: 'Séparation',
  ENTRETENIR_EQUIPEMENT: 'Passage à la forge',
  BOUILLIR_EAU: 'Feu et eau claire',
  EXPLORER_SITE: 'Approche du site',
  DONJON_DEPLACEMENT: 'Descente dans les salles',
  DONJON_FOUILLER: 'Fouille des pierres',
  DONJON_SORTIR: 'Retour à la surface',
  ENTRAINEMENT_NIVEAU: 'Entraînement',
  PREPARER_SORT: 'Étude du grimoire',
  FABRIQUER_OBJET: 'Ouvrage au bivouac',
  SOIGNER_BLESSURE: 'Soin des plaies',
  ANNOTER_HEX: 'Note sur la carte',
  EQUIPER_OBJET: 'Équipement',
  UTILISER_OBJET: 'Usage d’objet',
  JETER_OBJET: 'Délestage',
  BASCULER_LUMIERE: 'Torche',
  CONFIGURER_VOYAGE: 'Préparation de route',
  IMPORTER_HEROS: 'Nouveau héros',
  METTRE_A_JOUR_HEROS: 'Fiche aventurier',
  GERER_DOCUMENT_HEROS: 'Dossier du héros',
  AJOUTER_QUETE: 'Journal de quêtes',
  DIALOGUER_PNJ: 'Échange de paroles',
  DEMANDER_RUMEURS: 'Bruits du pays',
  ACTION_LIBRE: 'Scène en cours',
  RESOUDRE_JET_DEMANDE: 'Jet décisif',
  CONFIGURER_NARRATION: 'Format du récit',
  CONFIGURER_MODELE_IA: 'Profil MJ IA',
  OUVERTURE_CAMPAGNE: 'Ouverture du monde',
};

const LIBELLES_ACTION_JOUEUR: Record<string, string> = {
  DEPLACER_HEX: 'Déplacement',
  FORAGER: 'Forager',
  REPOS_COURT: 'Repos court',
  REPOS_LONG: 'Repos long',
  ATTAQUER: 'Attaquer',
  ESQUIVER: 'Esquiver',
  TOUR_ENNEMI: 'Fin du tour',
  JETS_MORT: 'Jet contre la mort',
  LANCER_SORT: 'Lancer un sort',
  LANCER_SORT_GRIMOIRE: 'Lancer un sort',
  FUIR_TACTIQUE: 'Fuir le combat',
  DEPLACER_COMBAT: 'Mouvement tactique',
  DESENGAGER_COMBAT: 'Se désengager',
  TROQUER: 'Commercer au comptoir',
  CORVEE_TRAVAIL: 'Prendre une corvée',
  ENGAGER_COMPAGNON: 'Engager un compagnon',
  CONGEDIER_COMPAGNON: 'Congédier un compagnon',
  ENTRETENIR_EQUIPEMENT: 'Entretenir l’équipement',
  BOUILLIR_EAU: 'Bouillir l’eau',
  EXPLORER_SITE: 'Explorer le site',
  DONJON_DEPLACEMENT: 'Avancer dans le donjon',
  DONJON_FOUILLER: 'Fouiller la salle',
  DONJON_SORTIR: 'Sortir du donjon',
  ENTRAINEMENT_NIVEAU: 'S’entraîner',
  PREPARER_SORT: 'Préparer les sorts',
  FABRIQUER_OBJET: 'Fabriquer au bivouac',
  SOIGNER_BLESSURE: 'Soigner une blessure',
  ANNOTER_HEX: 'Annoter la carte',
  EQUIPER_OBJET: 'Équiper / Retirer',
  UTILISER_OBJET: 'Utiliser un objet',
  JETER_OBJET: 'Jeter un objet',
  BASCULER_LUMIERE: 'Allumer / Éteindre la torche',
  CONFIGURER_VOYAGE: 'Configurer le voyage',
  IMPORTER_HEROS: 'Importer un héros',
  METTRE_A_JOUR_HEROS: 'Modifier la fiche',
  GERER_DOCUMENT_HEROS: 'Gérer les documents',
  AJOUTER_QUETE: 'Ajouter une quête',
  DIALOGUER_PNJ: 'Engager la conversation',
  DEMANDER_RUMEURS: 'Demander les rumeurs',
  RESOUDRE_JET_DEMANDE: 'Répondre au jet demandé',
  CONFIGURER_NARRATION: 'Régler le style du récit',
  CONFIGURER_MODELE_IA: 'Choisir le profil Gemini 4 Hydrogen',
  OUVERTURE_CAMPAGNE: 'Ouverture de la scène',
};

export function formaterTitreEnCours(action: ActionSummaryInput): string {
  return TITRES_EN_COURS[action.type] || 'Scène en cours';
}

export function formaterActionJoueur(action: ActionSummaryInput): string | undefined {
  if (action.type === 'ACTION_LIBRE' && action.texteLibre?.trim()) {
    return action.texteLibre.trim();
  }
  if (action.type === 'DIALOGUER_PNJ' && action.sujetDialogue?.trim()) {
    return action.sujetDialogue.trim();
  }
  if ((action.type === 'LANCER_SORT' || action.type === 'LANCER_SORT_GRIMOIRE') && action.sortNom) {
    return `Sort : ${action.sortNom}`;
  }
  return LIBELLES_ACTION_JOUEUR[action.type];
}

export function genererTitreSceneFallback(
  action: ActionSummaryInput,
  lieuNom: string,
  estEnBourgade: boolean,
  enCombat: boolean,
  enDonjon: boolean
): string {
  if (enCombat) {
    if (action.type === 'FUIR_TACTIQUE') return 'Retraite précipitée';
    if (action.type === 'ESQUIVER') return 'Sous les coups';
    return 'L’acier contre l’acier';
  }
  if (enDonjon) {
    if (action.type === 'DONJON_FOUILLER') return 'Sous les pierres froides';
    if (action.type === 'DONJON_SORTIR') return 'Retour au grand air';
    return 'Au fond des voûtes';
  }
  switch (action.type) {
    case 'DEPLACER_HEX':
      return estEnBourgade ? `Arrivée à ${lieuNom}` : `Sur les terres de ${lieuNom}`;
    case 'FORAGER':
      return `Glanage à ${lieuNom}`;
    case 'REPOS_COURT':
      return 'Une heure de répit';
    case 'REPOS_LONG':
      return estEnBourgade ? 'Nuit à l’abri du bourg' : 'Veille au bivouac';
    case 'DIALOGUER_PNJ':
      return 'Paroles échangées';
    case 'DEMANDER_RUMEURS':
      return 'Échos de la route';
    case 'CORVEE_TRAVAIL':
      return 'Gagner son pain';
    case 'TROQUER':
      return 'Affaires au comptoir';
    case 'ENTRETENIR_EQUIPEMENT':
      return 'Au feu de la forge';
    case 'EXPLORER_SITE':
      return `Devant ${lieuNom}`;
    case 'OUVERTURE_CAMPAGNE':
      return `Arrivée à ${lieuNom}`;
    default:
      return TITRES_EN_COURS[action.type] || lieuNom;
  }
}

export type SegmentRecit =
  | { type: 'prose'; texte: string }
  | { type: 'dialogue'; locuteur?: string; replique: string };

/**
 * Découpe un récit en paragraphes narratifs et répliques PNJ (« ... »)
 * pour leur offrir une mise en scène distincte sans altérer le texte d'origine.
 */
export function parserSegmentsRecit(texte: string): SegmentRecit[] {
  const lignes = texte
    .split(/\n+/)
    .map(l => l.trim())
    .filter(Boolean);

  const segments: SegmentRecit[] = [];

  for (const ligne of lignes) {
    // Cas 1 : Ligne dédiée à une réplique (ex. `Torvin : « Le fer manque. »` ou `« Partons. »`)
    const matchLigneDialogue = ligne.match(
      /^(?:([A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ'’\-\s]{1,36}?)\s*:\s*)?«\s*([^»]+?)\s*»(?:\s*(.*))?$/
    );

    if (matchLigneDialogue) {
      const locuteur = matchLigneDialogue[1]?.trim() || undefined;
      const replique = matchLigneDialogue[2].trim();
      const suite = matchLigneDialogue[3]?.trim();

      segments.push({ type: 'dialogue', locuteur, replique });
      if (suite) {
        segments.push({ type: 'prose', texte: suite });
      }
      continue;
    }

    // Cas 2 : Réplique insérée dans une phrase (ex. `Torvin pose son marteau. « Tu cherches du travail ? »`)
    const indexGuillemet = ligne.indexOf('«');
    const indexFinGuillemet = indexGuillemet >= 0 ? ligne.indexOf('»', indexGuillemet + 1) : -1;

    if (indexGuillemet >= 0 && indexFinGuillemet > indexGuillemet) {
      const avant = ligne.slice(0, indexGuillemet).trim();
      const replique = ligne.slice(indexGuillemet + 1, indexFinGuillemet).trim();
      const apres = ligne.slice(indexFinGuillemet + 1).trim();

      let locuteur: string | undefined;
      let proseAvant = avant;

      const matchLocuteurFin = avant.match(/^(.*?)(?:([A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ'’\-\s]{1,32}?)\s*:\s*)$/);
      if (matchLocuteurFin) {
        proseAvant = matchLocuteurFin[1].trim();
        locuteur = matchLocuteurFin[2].trim();
      } else if (avant.endsWith(':')) {
        proseAvant = avant.slice(0, -1).trim();
      }

      if (proseAvant) {
        segments.push({ type: 'prose', texte: proseAvant });
      }
      if (replique) {
        segments.push({ type: 'dialogue', locuteur, replique });
      }
      if (apres) {
        segments.push({ type: 'prose', texte: apres });
      }
      continue;
    }

    segments.push({ type: 'prose', texte: ligne });
  }

  return segments;
}
