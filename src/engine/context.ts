import { SimulationState, GraphNode, WorldEntity } from '../types';
import { obtenirPnjsEnVue } from './encounters';
import { RECETTES_BIVOUAC } from './injuries';

export type RecrueType = 'MULET' | 'PORTEUR' | 'MERCENAIRE';

export interface ContexteRepos {
  estEnBourgade: boolean;
  coutAubergePA: number;
  peutPayerAuberge: boolean;
  labelRepos: string;
  ddBivouac: number;
  risqueEmbuscade: boolean;
  avecToile: boolean;
  avecGardeMercenaire: boolean;
  detailsRisque: string;
}

export interface ContexteLieu {
  estEnBourgade: boolean;
  estEnFort: boolean;
  estEnMineActive: boolean;
  enDonjon: boolean;
  resumeLieu: string;
  pnjsEnVue: GraphNode[];
  entitesSurHex: WorldEntity[];
  aCaravaneSurPlace: boolean;
  aColporteurEnVue: boolean;
  peutCommercer: boolean;
  raisonCommerce: string;
  offresCorveesIds: string[];
  peutCorvees: boolean;
  raisonCorvees: string;
  recruesDisponiblesTypes: RecrueType[];
  peutEmbaucher: boolean;
  ongletCompagnonsActif: boolean;
  raisonCompagnons: string;
  peutDialoguer: boolean;
  raisonDialogue: string;
  peutDemanderRumeurs: boolean;
  ongletRumeursActif: boolean;
  raisonRumeurs: string;
  peutEntretenirForge: boolean;
  raisonForge: string;
  peutEntrainerNiveau: boolean;
  raisonEntrainement: string;
  peutExplorerSite: boolean;
  raisonExplorerSite: string;
  recettesDisponiblesIds: string[];
  raisonsRecettes: Record<string, string>;
  aRemedeSoin: boolean;
  peutSoigneurBourgade: boolean;
  peutSoignerBlessure: boolean;
  raisonSoin: string;
  contexteRepos: ContexteRepos;
}

export function inventaireAUnRemede(inventaire: SimulationState['personnage']['inventaire']): boolean {
  const motsCles = ['bandage', 'cataplasme', 'trousse', 'compresse', 'attelle'];
  return inventaire.some(
    item => item.quantite > 0 && motsCles.some(mot => item.nom.toLowerCase().includes(mot))
  );
}

export function aUnRemedeDansInventaire(etat: SimulationState): boolean {
  return inventaireAUnRemede(etat.personnage.inventaire);
}

export function evaluerContexteLieu(etat: SimulationState): ContexteLieu {
  const hex = etat.hexActuel;
  const poi = hex.pointInteret;
  const enDonjon = Boolean(etat.donjon && etat.donjon.actif);

  const estEnBourgade = Boolean(poi?.type === 'bourgade' && poi?.statut === 'OPERATIONNEL');
  const estEnFort = Boolean(poi?.type === 'fort');
  const estEnMineActive = Boolean(poi?.type === 'mine' && poi?.statut === 'OPERATIONNEL');
  const factionHex = hex.factionControleId
    ? etat.factions.find(f => f.id === hex.factionControleId)
    : undefined;
  const factionHostile = factionHex?.relationsJoueur === 'HOSTILE';

  const pnjsEnVue = enDonjon ? [] : obtenirPnjsEnVue(etat);
  const entitesSurHex = enDonjon
    ? []
    : (etat.entitesMonde || []).filter(e => e.statut === 'EN_ROUTE' && e.hexId === hex.id);
  const aCaravaneSurPlace = entitesSurHex.some(e => e.type === 'CARAVANE');
  const aColporteurEnVue = pnjsEnVue.some(p => Boolean(p.proprietes?.proposeCommerce));

  // 1. Commerce
  const peutCommercer = !enDonjon && (estEnBourgade || aColporteurEnVue || aCaravaneSurPlace);
  const raisonCommerce = enDonjon
    ? 'Impossible sous terre'
    : 'Bourgade, caravane ou colporteur requis';

  // 2. Corvées rémunérées (exigent un employeur présent et non hostile)
  let offresCorveesIds: string[] = [];
  if (!enDonjon && !factionHostile) {
    if (estEnBourgade) {
      offresCorveesIds = ['bois_palissade', 'garde_nuit', 'forge_assistance', 'chasse_ravitaillement'];
    } else if (estEnFort) {
      offresCorveesIds = ['garde_nuit', 'debroussaillage_sentier'];
    } else if (estEnMineActive) {
      offresCorveesIds = ['debroussaillage_sentier'];
    }
  }
  const peutCorvees = offresCorveesIds.length > 0;
  const raisonCorvees = factionHostile
    ? 'Lieu hostile'
    : 'Bourgade, fort ou mine active requis';

  // 3. Compagnons & Embauche
  let recruesDisponiblesTypes: RecrueType[] = [];
  if (!enDonjon && !factionHostile) {
    if (estEnBourgade) {
      recruesDisponiblesTypes = ['MULET', 'PORTEUR', 'MERCENAIRE'];
    } else if (estEnFort) {
      recruesDisponiblesTypes = ['MERCENAIRE'];
    }
  }
  const peutEmbaucher = recruesDisponiblesTypes.length > 0;
  const aCompagnons = (etat.personnage.compagnons?.length || 0) > 0;
  const ongletCompagnonsActif = peutEmbaucher || aCompagnons;
  const raisonCompagnons = 'Bourgade ou fort requis';

  // 4. Dialogue PNJ (champ de vision uniquement)
  const peutDialoguer = pnjsEnVue.length > 0;
  const raisonDialogue = 'Aucun PNJ en vue';

  // 5. Rumeurs (doivent être demandées à un PNJ en vue, mais les rumeurs déjà apprises restent consultables)
  const peutDemanderRumeurs = pnjsEnVue.length > 0;
  const aRumeursApprises = (etat.rumeurs?.length || 0) > 0;
  const ongletRumeursActif = peutDemanderRumeurs || aRumeursApprises;
  const raisonRumeurs = 'PNJ en vue requis';

  // 6. Forge & Maître d'armes
  const peutEntretenirForge = !enDonjon && estEnBourgade;
  const raisonForge = 'Forge de Val-Gris requise';
  const peutEntrainerNiveau = !enDonjon && (estEnBourgade || (estEnFort && !factionHostile));
  const raisonEntrainement = 'Bourgade ou fort requis';

  // 7. Exploration de site (jamais sur une bourgade pacifiée)
  const peutExplorerSite = Boolean(!enDonjon && poi && poi.type !== 'bourgade');
  const raisonExplorerSite = estEnBourgade
    ? 'Bourgade pacifiée'
    : 'Aucun site à explorer';

  // 8. Atelier de bivouac selon les ressources du terrain
  const recettesDisponiblesIds: string[] = [];
  const raisonsRecettes: Record<string, string> = {};
  if (!enDonjon) {
    for (const rec of RECETTES_BIVOUAC) {
      if (rec.id === 'craft_bandage') {
        recettesDisponiblesIds.push(rec.id);
      } else if (rec.id === 'craft_cataplasme') {
        if (['Forêt Dense', 'Marais Fétide', 'Plaine / Route'].includes(hex.terrain)) {
          recettesDisponiblesIds.push(rec.id);
        } else {
          raisonsRecettes[rec.id] = 'Plantes absentes sur ce terrain';
        }
      } else if (rec.id === 'craft_torche') {
        if (['Forêt Dense', 'Marais Fétide', 'Plaine / Route'].includes(hex.terrain) || estEnBourgade) {
          recettesDisponiblesIds.push(rec.id);
        } else {
          raisonsRecettes[rec.id] = 'Bois sec introuvable ici';
        }
      } else if (rec.id === 'craft_attelle') {
        if (['Forêt Dense', 'Plaine / Route'].includes(hex.terrain) || estEnBourgade) {
          recettesDisponiblesIds.push(rec.id);
        } else {
          raisonsRecettes[rec.id] = 'Rameaux adaptés absents ici';
        }
      }
    }
  }

  // 9. Soin des blessures
  const soldePA = etat.personnage.monnaies.po * 10 + etat.personnage.monnaies.pa;
  const aRemedeSoin = aUnRemedeDansInventaire(etat);
  const peutSoigneurBourgade = estEnBourgade && soldePA >= 5;
  const peutSoignerBlessure = aRemedeSoin || peutSoigneurBourgade;
  const raisonSoin = estEnBourgade
    ? 'Remède ou 5 PA (soigneur) requis'
    : 'Bandage ou cataplasme requis';

  // 10. Repos long (coût en bourgade, risque modulé dehors)
  const coutAubergePA = 3;
  const peutPayerAuberge = soldePA >= coutAubergePA;
  const avecToile = etat.personnage.inventaire.some(
    i => i.quantite > 0 && i.nom.toLowerCase().includes('toile')
  );
  const avecGardeMercenaire = (etat.personnage.compagnons || []).some(c => c.type === 'MERCENAIRE');
  const meteoSevere =
    etat.horloge.meteo.includes('Pluie') ||
    etat.horloge.meteo.includes('Brume') ||
    etat.horloge.meteo.includes('Chaleur') ||
    etat.horloge.meteo.includes('Vents');

  let ddBivouac = 10;
  const facteurs: string[] = [];

  if (estEnBourgade) {
    ddBivouac = peutPayerAuberge ? 0 : 11;
    if (peutPayerAuberge) {
      facteurs.push('Auberge sûre (3 PA)');
    } else {
      facteurs.push('Bourse insuffisante : porche froid (JDS CON DD 11)');
    }
  } else {
    if (hex.terrain === 'Marais Fétide') {
      ddBivouac += 3;
      facteurs.push('Marais (+3 DD)');
    } else if (hex.terrain === 'Désert Aride' || hex.terrain === 'Montagne Escarpée') {
      ddBivouac += 2;
      facteurs.push(`${hex.terrain.split(' ')[0]} (+2 DD)`);
    }

    if (meteoSevere && !avecToile) {
      ddBivouac += 3;
      facteurs.push(`${etat.horloge.meteo} sans abri (+3 DD)`);
    } else if (avecToile) {
      ddBivouac = Math.max(8, ddBivouac - 2);
      facteurs.push('Toile de bivouac (-2 DD)');
    }

    if (etat.personnage.rationsJours <= 0 || etat.personnage.eauLitres <= 0) {
      ddBivouac += 2;
      facteurs.push('Manque d\'eau ou ration (+2 DD)');
    }

    if (avecGardeMercenaire) {
      ddBivouac = Math.max(8, ddBivouac - 1);
      facteurs.push('Veille mercenaire');
    }
  }

  const risqueEmbuscade =
    !estEnBourgade && (hex.securite === 'Dangereux' || hex.securite === 'Périlleux');
  if (risqueEmbuscade) {
    facteurs.push(avecGardeMercenaire ? 'Guet assuré' : 'Risque d\'intrusion nocturne');
  }

  const labelRepos = estEnBourgade
    ? peutPayerAuberge
      ? `Auberge (8h · ${coutAubergePA} PA)`
      : 'Porche de nuit (8h · risqué)'
    : `Bivouac (8h · DD ${ddBivouac})`;

  const resumeLieu = enDonjon
    ? `Site souterrain · ${etat.donjon?.nom}`
    : estEnBourgade
    ? 'Bourgade'
    : estEnFort
    ? 'Poste fortifié'
    : estEnMineActive
    ? 'Mine active'
    : poi
    ? `Site (${poi.type})`
    : 'Pleine nature';

  return {
    estEnBourgade,
    estEnFort,
    estEnMineActive,
    enDonjon,
    resumeLieu,
    pnjsEnVue,
    entitesSurHex,
    aCaravaneSurPlace,
    aColporteurEnVue,
    peutCommercer,
    raisonCommerce,
    offresCorveesIds,
    peutCorvees,
    raisonCorvees,
    recruesDisponiblesTypes,
    peutEmbaucher,
    ongletCompagnonsActif,
    raisonCompagnons,
    peutDialoguer,
    raisonDialogue,
    peutDemanderRumeurs,
    ongletRumeursActif,
    raisonRumeurs,
    peutEntretenirForge,
    raisonForge,
    peutEntrainerNiveau,
    raisonEntrainement,
    peutExplorerSite,
    raisonExplorerSite,
    recettesDisponiblesIds,
    raisonsRecettes,
    aRemedeSoin,
    peutSoigneurBourgade,
    peutSoignerBlessure,
    raisonSoin,
    contexteRepos: {
      estEnBourgade,
      coutAubergePA,
      peutPayerAuberge,
      labelRepos,
      ddBivouac,
      risqueEmbuscade,
      avecToile,
      avecGardeMercenaire,
      detailsRisque: facteurs.join(' · ') || 'Conditions stables',
    },
  };
}
