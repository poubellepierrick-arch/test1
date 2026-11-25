import {
  AzgaarDiplomacyStatus,
  AzgaarMarkerDef,
  AzgaarMarkerIcon,
  FactionDiplomacy,
  FactionPosture,
  GraphEdge,
  GraphNode,
  HexNode,
  SecurityLevel,
  SimulationState,
  WorldChronicleEntry,
  WorldClock,
  WorldEntity,
  WorldEntityType,
} from '../types';
import {
  obtenirCellulesDansRayon,
  projeterHexVersMondeAzgaar,
  reconstruireAtlasComplet,
} from './azgaarVoronoi';
import { calculerItinerairePondere } from './worldGeography';
import { synchroniserControleFactions } from './worldSim';

export type CrisisPresetId =
  | 'RAID'
  | 'FOIRE'
  | 'DISETTE'
  | 'EPIDEMIE'
  | 'RELIQUE'
  | 'REVOLTE'
  | 'LIBRE';

export type MjWorldCommand =
  | {
      type: 'METEO_SAISON';
      meteo?: WorldClock['meteo'];
      saison?: WorldClock['saison'];
      heuresAvance?: number;
    }
  | {
      type: 'MARCHE';
      multiplicateurFer?: number;
      multiplicateurVivres?: number;
      penurieArmurerie?: boolean;
      penurieVivres?: boolean;
    }
  | {
      type: 'MODIFIER_HEX';
      hexId: string;
      factionControleId?: string | null;
      pressionDanger?: number;
      prosperite?: number;
      garnison?: number;
      niveauEau?: number;
      populationGibier?: number;
      population?: number;
      routeNiveau?: 'ROUTE' | 'PISTE' | 'AUCUNE';
      brouillard?: 'INCONNU' | 'REPERE' | 'EXPLORE';
      poiNom?: string;
      poiType?: 'mine' | 'fort' | 'ruine' | 'bourgade' | 'camp';
      poiStatut?: 'OPERATIONNEL' | 'RUINED' | 'OCCUPIED' | 'ABANDONNE';
      supprimerPoi?: boolean;
    }
  | {
      type: 'MODIFIER_FACTION';
      factionId: string;
      posture?: FactionPosture;
      forceMilitaire?: number;
      richesse?: number;
      moral?: number;
      lassitudeGuerre?: number;
      relationsJoueur?: 'HOSTILE' | 'NEUTRE' | 'ALLIE';
      objectif?: string;
    }
  | {
      type: 'MODIFIER_DIPLOMATIE';
      factionAId: string;
      factionBId: string;
      relation: FactionDiplomacy;
    }
  | {
      type: 'DECLENCHER_CRISE';
      hexId: string;
      preset: CrisisPresetId;
      titreCustom?: string;
      impactCustom?: string;
      poserMarqueur?: boolean;
    }
  | {
      type: 'DEPECHER_UNITE';
      typeEntite: WorldEntityType;
      nom?: string;
      factionId?: string;
      origineHexId: string;
      destinationHexId: string;
      force?: number;
      cargaison?: WorldEntity['cargaison'];
    }
  | {
      type: 'GERER_UNITE';
      entiteId: string;
      operation: 'AVANCER' | 'DISPERSER' | 'SUPPRIMER';
    }
  | {
      type: 'GERER_PNJ';
      operation: 'CREER' | 'MODIFIER' | 'SUPPRIMER';
      pnjId?: string;
      nom?: string;
      profession?: string;
      hexId?: string;
      disposition?: string;
      humeur?: string;
      secret?: string;
      factionId?: string;
    }
  | {
      type: 'GERER_RUMEUR';
      operation: 'CREER' | 'BASCULER_VERACITE' | 'SUPPRIMER';
      rumorId?: string;
      titre?: string;
      texte?: string;
      source?: string;
      veracite?: boolean;
    }
  | {
      type: 'GERER_INTRIGUE';
      cible: 'QUETE' | 'CONSEQUENCE' | 'FIL';
      operation: 'CREER' | 'STATUT' | 'DECLENCHER' | 'SUPPRIMER';
      id?: string;
      titre?: string;
      interlocuteur?: string;
      details?: string;
      statut?: 'EN_COURS' | 'ACCOMPLIE' | 'TRAHIE' | 'EXPIREE';
      echeanceJour?: number;
      declencheur?: string;
      effetPrevu?: string;
      noteFil?: string;
    };

export interface MjWorldResult {
  etat: SimulationState;
  resume: string;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function securiteDepuisPression(pression: number, estBourgadeSure: boolean): SecurityLevel {
  if (estBourgadeSure && pression < 40) return 'Sûr';
  if (pression < 22) return 'Sûr';
  if (pression < 45) return 'Patrouillé';
  if (pression < 75) return 'Dangereux';
  return 'Périlleux';
}

function assurerStructures(etat: SimulationState): void {
  if (!etat.memoireMJ) {
    etat.memoireMJ = {
      filNarratif: [],
      promessesEtQuetes: [],
      consequencesDifferees: [],
    };
  }
  if (!etat.rumeurs) etat.rumeurs = [];
  if (!etat.entitesMonde) etat.entitesMonde = [];
  if (!etat.chroniqueMonde) etat.chroniqueMonde = [];
  if (!etat.grapheNoeuds) etat.grapheNoeuds = [];
  if (!etat.grapheLiens) etat.grapheLiens = [];
}

function pousserChronique(
  etat: SimulationState,
  entree: Omit<WorldChronicleEntry, 'id' | 'tick' | 'jour'>
): void {
  const item: WorldChronicleEntry = {
    id: `chr_mj_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    tick: etat.horloge.tick,
    jour: etat.horloge.jour,
    ...entree,
  };
  etat.chroniqueMonde = [item, ...(etat.chroniqueMonde || [])].slice(0, 32);
}

function pousserFilNarratif(etat: SimulationState, note: string): void {
  assurerStructures(etat);
  etat.memoireMJ!.filNarratif.push(
    `J${etat.horloge.jour} ${String(etat.horloge.heure).padStart(2, '0')}h — ${note}`
  );
  etat.memoireMJ!.filNarratif = etat.memoireMJ!.filNarratif.slice(-14);
}

function syncHexActuelSiCorrespond(etat: SimulationState, hex: HexNode): void {
  if (etat.hexActuel?.id === hex.id) {
    etat.hexActuel = { ...hex };
  }
}

function toAzgaarDiplomaticLabel(rel: FactionDiplomacy): AzgaarDiplomacyStatus {
  if (rel === 'GUERRE') return 'Guerre';
  if (rel === 'TENSION') return 'Rival';
  if (rel === 'PACTE') return 'Allie';
  return 'Paix';
}

function ajouterMarqueurAzgaarSurHex(
  etat: SimulationState,
  hex: HexNode,
  titre: string,
  note: string,
  icon: AzgaarMarkerIcon
): void {
  if (!etat.azgaarStudio) return;
  const pos = projeterHexVersMondeAzgaar(hex, etat.azgaarStudio);
  const marker: AzgaarMarkerDef = {
    id: `m_mj_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    icon,
    title: titre.slice(0, 48),
    note: note.slice(0, 200),
    x: Math.round(pos.x),
    y: Math.round(pos.y),
    author: 'MJ',
    createdDay: etat.horloge.jour,
  };
  etat.azgaarStudio.markers.push(marker);
}

export function appliquerCommandeMJMonde(
  etatSource: SimulationState,
  cmd: MjWorldCommand
): MjWorldResult {
  const etat: SimulationState = JSON.parse(JSON.stringify(etatSource));
  assurerStructures(etat);
  etat._seq = (etat._seq || 0) + 1;

  if (cmd.type === 'METEO_SAISON') {
    if (cmd.meteo) etat.horloge.meteo = cmd.meteo;
    if (cmd.saison) etat.horloge.saison = cmd.saison;
    if (typeof cmd.heuresAvance === 'number' && cmd.heuresAvance > 0) {
      etat.horloge.heure += Math.round(cmd.heuresAvance);
      while (etat.horloge.heure >= 24) {
        etat.horloge.heure -= 24;
        etat.horloge.jour += 1;
      }
    }
    if (etat.horloge.meteo === 'Brume glaciale' || etat.horloge.saison === 'Hiver') {
      etat.horloge.temperature = 'Glacial';
    } else if (etat.horloge.meteo === 'Chaleur écrasante') {
      etat.horloge.temperature = 'Torride';
    } else {
      etat.horloge.temperature = 'Tempéré';
    }
    const resume = `${etat.horloge.saison || 'Automne'} · ${etat.horloge.meteo} (${etat.horloge.temperature})`;
    pousserChronique(etat, {
      categorie: 'METEO',
      titre: etat.horloge.meteo,
      impact: resume,
    });
    return { etat, resume };
  }

  if (cmd.type === 'MARCHE') {
    if (typeof cmd.multiplicateurFer === 'number') {
      etat.marche.multiplicateurFer = Number(clamp(cmd.multiplicateurFer, 0.5, 3.0).toFixed(2));
      etat.marche.prixArmesFerModif = Math.round(15 * etat.marche.multiplicateurFer);
    }
    if (typeof cmd.multiplicateurVivres === 'number') {
      etat.marche.multiplicateurVivres = Number(clamp(cmd.multiplicateurVivres, 0.5, 2.5).toFixed(2));
    }
    if (typeof cmd.penurieArmurerie === 'boolean') {
      etat.marche.penurieArmurerie = cmd.penurieArmurerie;
    }
    if (typeof cmd.penurieVivres === 'boolean') {
      etat.marche.penurieVivres = cmd.penurieVivres;
    }
    const resume = `Fer x${etat.marche.multiplicateurFer} · Vivres x${etat.marche.multiplicateurVivres ?? 1}`;
    pousserChronique(etat, {
      categorie: 'ECONOMIE',
      titre: 'Cours du marché ajustés',
      impact: resume,
    });
    return { etat, resume };
  }

  if (cmd.type === 'MODIFIER_HEX') {
    const hex = etat.hexagones.find(h => h.id === cmd.hexId);
    if (!hex) throw new Error(`Hexagone introuvable : ${cmd.hexId}`);

    if (cmd.factionControleId !== undefined) {
      hex.factionControleId =
        cmd.factionControleId === null || cmd.factionControleId === '' || cmd.factionControleId === 'NEUTRE'
          ? null
          : cmd.factionControleId;
      synchroniserControleFactions(etat.factions, etat.hexagones);

      if (etat.azgaarStudio) {
        const stTarget = hex.factionControleId
          ? etat.azgaarStudio.states.find(s => s.factionId === hex.factionControleId)
          : undefined;
        const targetStateId = stTarget ? stTarget.id : 0;
        const pos = projeterHexVersMondeAzgaar(hex, etat.azgaarStudio);
        const geo = reconstruireAtlasComplet(etat.azgaarStudio);
        const cibles = obtenirCellulesDansRayon(geo.cells, pos.x, pos.y, 44);
        if (!etat.azgaarStudio.overrides.state) etat.azgaarStudio.overrides.state = {};
        for (const c of cibles) {
          if (c.isLand) etat.azgaarStudio.overrides.state[c.index] = targetStateId;
        }
      }
    }
    if (typeof cmd.pressionDanger === 'number') {
      hex.pressionDanger = clamp(Math.round(cmd.pressionDanger), 0, 100);
      hex.securite = securiteDepuisPression(
        hex.pressionDanger,
        hex.pointInteret?.type === 'bourgade' && hex.factionControleId === 'faction_guilde_marchande'
      );
    }
    if (typeof cmd.prosperite === 'number') {
      hex.prosperite = clamp(Math.round(cmd.prosperite), 0, 100);
    }
    if (typeof cmd.garnison === 'number') {
      hex.garnison = clamp(Math.round(cmd.garnison), 0, 100);
    }
    if (typeof cmd.niveauEau === 'number') {
      hex.niveauEau = clamp(Math.round(cmd.niveauEau), 0, 100);
      hex.ressourcesEau = hex.niveauEau >= 20;
    }
    if (typeof cmd.populationGibier === 'number') {
      hex.populationGibier = clamp(Math.round(cmd.populationGibier), 0, 100);
      hex.ressourcesGibier = hex.populationGibier >= 25;
    }
    if (typeof cmd.population === 'number') {
      hex.population = Math.max(0, Math.round(cmd.population));
    }
    if (cmd.routeNiveau) {
      hex.routeNiveau = cmd.routeNiveau;
    }
    if (cmd.brouillard) {
      hex.brouillard = cmd.brouillard;
      if (cmd.brouillard === 'EXPLORE') hex.visite = true;
    }
    if (cmd.supprimerPoi) {
      delete hex.pointInteret;
      if (etat.azgaarStudio) {
        etat.azgaarStudio.markers = etat.azgaarStudio.markers.filter(
          m => m.id !== `m_poi_${hex.id}`
        );
      }
    } else if (cmd.poiNom || cmd.poiType || cmd.poiStatut) {
      hex.pointInteret = {
        id: hex.pointInteret?.id || `poi_mj_${hex.id}`,
        nom: (cmd.poiNom ?? hex.pointInteret?.nom ?? hex.nom).slice(0, 60),
        type: cmd.poiType ?? hex.pointInteret?.type ?? 'camp',
        statut: cmd.poiStatut ?? hex.pointInteret?.statut ?? 'OPERATIONNEL',
      };
      if (etat.azgaarStudio) {
        const linkedBurg = etat.azgaarStudio.burgs.find(b => b.hexId === hex.id);
        if (linkedBurg && cmd.poiNom) {
          linkedBurg.name = cmd.poiNom.slice(0, 40);
        }
      }
    }

    syncHexActuelSiCorrespond(etat, hex);
    return { etat, resume: `${hex.nom} mis à jour.` };
  }

  if (cmd.type === 'MODIFIER_FACTION') {
    const faction = etat.factions.find(f => f.id === cmd.factionId);
    if (!faction) throw new Error(`Faction introuvable : ${cmd.factionId}`);

    if (cmd.posture) faction.posture = cmd.posture;
    if (typeof cmd.forceMilitaire === 'number') {
      faction.forceMilitaire = clamp(Math.round(cmd.forceMilitaire), 5, faction.forceMax ?? 100);
    }
    if (typeof cmd.richesse === 'number') {
      faction.richesse = clamp(Math.round(cmd.richesse), 0, 999);
    }
    if (typeof cmd.moral === 'number') {
      faction.moral = clamp(Math.round(cmd.moral), 0, 100);
    }
    if (typeof cmd.lassitudeGuerre === 'number') {
      faction.lassitudeGuerre = clamp(Math.round(cmd.lassitudeGuerre), 0, 100);
    }
    if (cmd.relationsJoueur) {
      faction.relationsJoueur = cmd.relationsJoueur;
      if (etat.azgaarStudio) {
        const st = etat.azgaarStudio.states.find(
          s => s.factionId === faction.id || s.name === faction.nom
        );
        if (st && st.id !== 1) {
          st.diplomacy[1] =
            cmd.relationsJoueur === 'HOSTILE'
              ? 'Guerre'
              : cmd.relationsJoueur === 'ALLIE'
              ? 'Allie'
              : 'Paix';
        }
      }
    }
    if (cmd.objectif !== undefined && cmd.objectif.trim()) {
      faction.effectifActif = cmd.objectif.trim().slice(0, 100);
    }

    return { etat, resume: `${faction.nom} actualisée.` };
  }

  if (cmd.type === 'MODIFIER_DIPLOMATIE') {
    const fA = etat.factions.find(f => f.id === cmd.factionAId);
    const fB = etat.factions.find(f => f.id === cmd.factionBId);
    if (!fA || !fB || fA.id === fB.id) {
      throw new Error('Deux factions distinctes requises.');
    }
    if (!fA.relationsFactions) fA.relationsFactions = {};
    if (!fB.relationsFactions) fB.relationsFactions = {};
    fA.relationsFactions[fB.id] = cmd.relation;
    fB.relationsFactions[fA.id] = cmd.relation;

    if (etat.azgaarStudio) {
      const stA = etat.azgaarStudio.states.find(s => s.factionId === fA.id || s.name === fA.nom);
      const stB = etat.azgaarStudio.states.find(s => s.factionId === fB.id || s.name === fB.nom);
      if (stA && stB) {
        const label = toAzgaarDiplomaticLabel(cmd.relation);
        stA.diplomacy[stB.id] = label;
        stB.diplomacy[stA.id] = label;
      }
    }

    const relLabels: Record<FactionDiplomacy, string> = {
      GUERRE: 'Guerre ouverte',
      TENSION: 'Tension frontalière',
      NEUTRE: 'Neutralité',
      PACTE: 'Pacte signé',
    };
    const titre = `${fA.nom.split(' ')[0]} / ${fB.nom.split(' ')[0]} : ${relLabels[cmd.relation]}`;
    pousserChronique(etat, {
      categorie: 'DIPLOMATIE',
      titre,
      impact: `Statut diplomatique fixé à ${cmd.relation}.`,
      factionId: fA.id,
    });
    pousserFilNarratif(etat, titre);
    return { etat, resume: titre };
  }

  if (cmd.type === 'DECLENCHER_CRISE') {
    const hex = etat.hexagones.find(h => h.id === cmd.hexId);
    if (!hex) throw new Error(`Hexagone introuvable : ${cmd.hexId}`);

    let titre = '';
    let impact = '';
    let cat: WorldChronicleEntry['categorie'] = 'FACTION';
    let icon: AzgaarMarkerIcon = 'danger';

    switch (cmd.preset) {
      case 'RAID':
        hex.pressionDanger = clamp((hex.pressionDanger ?? 30) + 28, 0, 100);
        hex.prosperite = clamp((hex.prosperite ?? 40) - 14, 5, 100);
        hex.garnison = clamp((hex.garnison ?? 25) - 12, 0, 100);
        titre = `Raid sur ${hex.nom}`;
        impact = `Danger ${hex.pressionDanger}%, garnison affaiblie.`;
        cat = 'FACTION';
        icon = 'danger';
        break;
      case 'FOIRE':
        hex.prosperite = clamp((hex.prosperite ?? 40) + 20, 5, 100);
        hex.pressionDanger = clamp((hex.pressionDanger ?? 30) - 12, 0, 100);
        hex.population = (hex.population ?? 80) + 45;
        titre = `Foire marchande à ${hex.nom}`;
        impact = `Prospérité ${hex.prosperite}%, afflux de voyageurs.`;
        cat = 'ECONOMIE';
        icon = 'quete';
        break;
      case 'DISETTE':
        hex.niveauEau = clamp((hex.niveauEau ?? 50) - 30, 0, 100);
        hex.populationGibier = clamp((hex.populationGibier ?? 50) - 30, 0, 100);
        hex.ressourcesEau = hex.niveauEau >= 20;
        hex.ressourcesGibier = hex.populationGibier >= 25;
        hex.prosperite = clamp((hex.prosperite ?? 40) - 12, 5, 100);
        etat.marche.multiplicateurVivres = Number(
          Math.min(2.2, (etat.marche.multiplicateurVivres ?? 1.0) + 0.25).toFixed(2)
        );
        etat.marche.penurieVivres = etat.marche.multiplicateurVivres >= 1.3;
        titre = `Sécheresse sur ${hex.nom}`;
        impact = `Eau ${hex.niveauEau}%, vivres x${etat.marche.multiplicateurVivres}.`;
        cat = 'ECONOMIE';
        icon = 'danger';
        break;
      case 'EPIDEMIE':
        hex.population = Math.max(10, Math.round((hex.population ?? 80) * 0.85));
        hex.prosperite = clamp((hex.prosperite ?? 40) - 18, 5, 100);
        hex.pressionDanger = clamp((hex.pressionDanger ?? 30) + 15, 0, 100);
        titre = `Fièvre des marais à ${hex.nom}`;
        impact = `Population réduite à ${hex.population} hab.`;
        cat = 'METEO';
        icon = 'danger';
        break;
      case 'RELIQUE':
        if (!hex.pointInteret) {
          hex.pointInteret = {
            id: `poi_rel_${Date.now()}`,
            nom: `Sanctuaire enfoui de ${hex.nom}`,
            type: 'ruine',
            statut: 'OPERATIONNEL',
          };
        }
        hex.pressionDanger = clamp((hex.pressionDanger ?? 30) + 12, 0, 100);
        titre = `Découverte antique à ${hex.nom}`;
        impact = `${hex.pointInteret.nom} attire pillards et érudits.`;
        cat = 'FACTION';
        icon = 'ruine';
        break;
      case 'REVOLTE':
        hex.pressionDanger = clamp((hex.pressionDanger ?? 30) + 22, 0, 100);
        hex.garnison = clamp((hex.garnison ?? 25) - 15, 0, 100);
        if (hex.pointInteret) hex.pointInteret.statut = 'OCCUPIED';
        titre = `Soulèvement à ${hex.nom}`;
        impact = `L'ordre local vacille (garnison ${hex.garnison}%).`;
        cat = 'FACTION';
        icon = 'camp';
        break;
      case 'LIBRE':
        titre = (cmd.titreCustom || `Événement à ${hex.nom}`).trim().slice(0, 70);
        impact = (cmd.impactCustom || `Situation mouvante sur ${hex.nom}.`).trim().slice(0, 140);
        cat = 'FACTION';
        icon = 'note';
        break;
    }

    hex.securite = securiteDepuisPression(
      hex.pressionDanger ?? 30,
      hex.pointInteret?.type === 'bourgade' && hex.factionControleId === 'faction_guilde_marchande'
    );
    syncHexActuelSiCorrespond(etat, hex);

    const evtId = `event_mj_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const connuInit = [hex.id];
    if (hex.factionControleId) connuInit.push(hex.factionControleId);
    const evtNode: GraphNode = {
      id: evtId,
      type: 'Event',
      label: titre,
      proprietes: {
        horodatageTick: etat.horloge.tick,
        noeudCible: hex.id,
        description: impact,
        sourceMJ: true,
      },
      connuParEntites: connuInit,
    };
    etat.grapheNoeuds.push(evtNode);

    pousserChronique(etat, {
      categorie: cat,
      titre,
      impact,
      hexId: hex.id,
      factionId: hex.factionControleId || undefined,
    });
    pousserFilNarratif(etat, `${titre} — ${impact}`);

    if (cmd.poserMarqueur !== false) {
      ajouterMarqueurAzgaarSurHex(etat, hex, titre, impact, icon);
    }

    return { etat, resume: `${titre} déclenché.` };
  }

  if (cmd.type === 'DEPECHER_UNITE') {
    const dep = etat.hexagones.find(h => h.id === cmd.origineHexId);
    const arr = etat.hexagones.find(h => h.id === cmd.destinationHexId);
    if (!dep || !arr) throw new Error('Origine et destination requises.');
    if (dep.estEau || arr.estEau) throw new Error('Les unités terrestres exigent des hexagones terrestres.');

    const route = calculerItinerairePondere(dep.id, arr.id, etat.hexagones, cmd.typeEntite);
    const entite: WorldEntity = {
      id: `ent_mj_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      nom: (cmd.nom && cmd.nom.trim() ? cmd.nom.trim() : `${cmd.typeEntite} → ${arr.nom}`).slice(0, 50),
      type: cmd.typeEntite,
      factionId: cmd.factionId || dep.factionControleId || etat.factions[0]?.id || 'faction_neutre',
      hexId: dep.id,
      origineHexId: dep.id,
      destinationHexId: arr.id,
      itineraire: route.chemin,
      force: clamp(Math.round(cmd.force ?? (cmd.typeEntite === 'PATROUILLE' ? 6 : 4)), 1, 20),
      cargaison: cmd.cargaison,
      statut: dep.id === arr.id ? 'ARRIVE' : 'EN_ROUTE',
      tickCreation: etat.horloge.tick,
    };
    etat.entitesMonde!.unshift(entite);
    pousserChronique(etat, {
      categorie: 'MOUVEMENT',
      titre: `${entite.nom} en route`,
      impact: `${dep.nom} → ${arr.nom} (${route.chemin.length} ét.)`,
      hexId: dep.id,
      factionId: entite.factionId,
    });
    return { etat, resume: `${entite.nom} dépêché.` };
  }

  if (cmd.type === 'GERER_UNITE') {
    const idx = etat.entitesMonde!.findIndex(e => e.id === cmd.entiteId);
    if (idx === -1) throw new Error('Unité introuvable.');
    const ent = etat.entitesMonde![idx];

    if (cmd.operation === 'SUPPRIMER') {
      etat.entitesMonde!.splice(idx, 1);
      return { etat, resume: `${ent.nom} retirée.` };
    }
    if (cmd.operation === 'DISPERSER') {
      ent.statut = 'DISPERSE';
      return { etat, resume: `${ent.nom} dispersée.` };
    }
    // AVANCER d'une étape sur son itinéraire
    if (ent.statut === 'EN_ROUTE') {
      const route =
        ent.itineraire && ent.itineraire.length >= 2
          ? ent.itineraire
          : calculerItinerairePondere(ent.hexId, ent.destinationHexId, etat.hexagones, ent.type).chemin;
      const curPos = route.indexOf(ent.hexId);
      const nextHexId =
        curPos >= 0 && curPos + 1 < route.length
          ? route[curPos + 1]
          : ent.destinationHexId;
      ent.hexId = nextHexId;
      ent.itineraire = route;
      if (ent.hexId === ent.destinationHexId) {
        ent.statut = 'ARRIVE';
      }
      return { etat, resume: `${ent.nom} → ${etat.hexagones.find(h => h.id === ent.hexId)?.nom || ent.hexId}` };
    }
    return { etat, resume: `${ent.nom} inchangée.` };
  }

  if (cmd.type === 'GERER_PNJ') {
    if (cmd.operation === 'CREER') {
      const nom = (cmd.nom || '').trim().slice(0, 50);
      if (!nom) throw new Error('Nom du PNJ requis.');
      const hexId = cmd.hexId || etat.hexActuel.id;
      const pnjId = `npc_mj_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const node: GraphNode = {
        id: pnjId,
        type: 'Actor',
        label: nom,
        proprietes: {
          profession: (cmd.profession || 'Voyageur').trim().slice(0, 50),
          disposition: cmd.disposition || 'NEUTRE',
          humeur: cmd.humeur || 'Attentif',
          secret: (cmd.secret || '').trim().slice(0, 160),
          hexId,
          estItinerant: false,
          seuilDD: 12,
        },
        connuParEntites: [hexId],
      };
      etat.grapheNoeuds.push(node);
      const edgeLoc: GraphEdge = {
        source: pnjId,
        cible: hexId,
        relation: 'LOCATED_IN',
        horodatageTick: etat.horloge.tick,
      };
      etat.grapheLiens.push(edgeLoc);
      if (cmd.factionId) {
        etat.grapheLiens.push({
          source: pnjId,
          cible: cmd.factionId,
          relation: 'BELONGS_TO',
          horodatageTick: etat.horloge.tick,
        });
      }
      return { etat, resume: `PNJ ${nom} ajouté.` };
    }

    const nodeIdx = etat.grapheNoeuds.findIndex(n => n.id === cmd.pnjId && n.type === 'Actor');
    if (nodeIdx === -1) throw new Error('PNJ introuvable.');
    const node = etat.grapheNoeuds[nodeIdx];

    if (cmd.operation === 'SUPPRIMER') {
      etat.grapheNoeuds.splice(nodeIdx, 1);
      etat.grapheLiens = etat.grapheLiens.filter(
        l => l.source !== node.id && l.cible !== node.id
      );
      return { etat, resume: `PNJ ${node.label} retiré.` };
    }

    if (cmd.nom && cmd.nom.trim()) node.label = cmd.nom.trim().slice(0, 50);
    if (cmd.profession !== undefined) node.proprietes.profession = cmd.profession.trim().slice(0, 50);
    if (cmd.disposition !== undefined) node.proprietes.disposition = cmd.disposition;
    if (cmd.humeur !== undefined) node.proprietes.humeur = cmd.humeur;
    if (cmd.secret !== undefined) node.proprietes.secret = cmd.secret.trim().slice(0, 160);
    if (cmd.hexId) {
      node.proprietes.hexId = cmd.hexId;
      etat.grapheLiens = etat.grapheLiens.filter(
        l => !(l.source === node.id && l.relation === 'LOCATED_IN')
      );
      etat.grapheLiens.push({
        source: node.id,
        cible: cmd.hexId,
        relation: 'LOCATED_IN',
        horodatageTick: etat.horloge.tick,
      });
      if (!node.connuParEntites) node.connuParEntites = [];
      if (!node.connuParEntites.includes(cmd.hexId)) node.connuParEntites.push(cmd.hexId);
    }
    return { etat, resume: `PNJ ${node.label} mis à jour.` };
  }

  if (cmd.type === 'GERER_RUMEUR') {
    if (cmd.operation === 'CREER') {
      const titre = (cmd.titre || '').trim().slice(0, 70);
      const texte = (cmd.texte || '').trim().slice(0, 220);
      if (!titre || !texte) throw new Error('Titre et texte requis.');
      etat.rumeurs.unshift({
        id: `rum_mj_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        titre,
        texte,
        source: (cmd.source || 'Rumeur locale').trim().slice(0, 50),
        veracite: cmd.veracite ?? true,
        tickEmission: etat.horloge.tick,
      });
      return { etat, resume: `Rumeur ajoutée : ${titre}` };
    }
    const rIdx = etat.rumeurs.findIndex(r => r.id === cmd.rumorId);
    if (rIdx === -1) throw new Error('Rumeur introuvable.');
    if (cmd.operation === 'SUPPRIMER') {
      const [removed] = etat.rumeurs.splice(rIdx, 1);
      return { etat, resume: `Rumeur retirée : ${removed.titre}` };
    }
    etat.rumeurs[rIdx].veracite = !etat.rumeurs[rIdx].veracite;
    return {
      etat,
      resume: `${etat.rumeurs[rIdx].titre} : ${etat.rumeurs[rIdx].veracite ? 'Vraie' : 'Fausse'}`,
    };
  }

  if (cmd.type === 'GERER_INTRIGUE') {
    const mem = etat.memoireMJ!;
    if (cmd.cible === 'FIL') {
      if (cmd.operation === 'CREER' && cmd.noteFil?.trim()) {
        pousserFilNarratif(etat, cmd.noteFil.trim().slice(0, 160));
        return { etat, resume: 'Note ajoutée au fil MJ.' };
      }
      if (cmd.operation === 'SUPPRIMER' && cmd.id !== undefined) {
        const idx = Number(cmd.id);
        if (Number.isInteger(idx) && idx >= 0 && idx < mem.filNarratif.length) {
          mem.filNarratif.splice(idx, 1);
        }
        return { etat, resume: 'Note retirée du fil.' };
      }
      return { etat, resume: 'Fil inchangé.' };
    }

    if (cmd.cible === 'QUETE') {
      if (cmd.operation === 'CREER') {
        const titre = (cmd.titre || '').trim().slice(0, 80);
        if (!titre) throw new Error('Titre de quête requis.');
        mem.promessesEtQuetes.unshift({
          id: `q_mj_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          titre,
          interlocuteur: (cmd.interlocuteur || 'Commanditaire').trim().slice(0, 50),
          statut: 'EN_COURS',
          echeanceJour: cmd.echeanceJour,
          details: (cmd.details || '').trim().slice(0, 180),
        });
        return { etat, resume: `Quête créée : ${titre}` };
      }
      const qIdx = mem.promessesEtQuetes.findIndex(q => q.id === cmd.id);
      if (qIdx === -1) throw new Error('Quête introuvable.');
      if (cmd.operation === 'SUPPRIMER') {
        mem.promessesEtQuetes.splice(qIdx, 1);
        return { etat, resume: 'Quête supprimée.' };
      }
      if (cmd.operation === 'STATUT' && cmd.statut) {
        mem.promessesEtQuetes[qIdx].statut = cmd.statut;
        return { etat, resume: `${mem.promessesEtQuetes[qIdx].titre} : ${cmd.statut}` };
      }
    }

    if (cmd.cible === 'CONSEQUENCE') {
      if (cmd.operation === 'CREER') {
        const decl = (cmd.declencheur || '').trim().slice(0, 90);
        const eff = (cmd.effetPrevu || '').trim().slice(0, 180);
        if (!decl || !eff) throw new Error('Déclencheur et effet requis.');
        mem.consequencesDifferees.unshift({
          id: `cons_mj_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          declencheur: decl,
          effetPrevu: eff,
          actif: true,
        });
        return { etat, resume: `Conséquence armée : ${decl}` };
      }
      const cIdx = mem.consequencesDifferees.findIndex(c => c.id === cmd.id);
      if (cIdx === -1) throw new Error('Conséquence introuvable.');
      if (cmd.operation === 'SUPPRIMER') {
        mem.consequencesDifferees.splice(cIdx, 1);
        return { etat, resume: 'Conséquence retirée.' };
      }
      if (cmd.operation === 'DECLENCHER') {
        const cons = mem.consequencesDifferees[cIdx];
        cons.actif = false;
        pousserFilNarratif(etat, `[CONSÉQUENCE] ${cons.declencheur} → ${cons.effetPrevu}`);
        pousserChronique(etat, {
          categorie: 'FACTION',
          titre: cons.declencheur,
          impact: cons.effetPrevu,
          hexId: etat.hexActuel.id,
        });
        etat.grapheNoeuds.push({
          id: `event_cons_${Date.now()}`,
          type: 'Event',
          label: cons.declencheur,
          proprietes: {
            horodatageTick: etat.horloge.tick,
            description: cons.effetPrevu,
          },
          connuParEntites: [etat.hexActuel.id],
        });
        return { etat, resume: `Conséquence déclenchée : ${cons.declencheur}` };
      }
      if (cmd.operation === 'STATUT') {
        mem.consequencesDifferees[cIdx].actif = !mem.consequencesDifferees[cIdx].actif;
        return { etat, resume: 'Statut conséquence basculé.' };
      }
    }
  }

  return { etat, resume: 'Commande exécutée.' };
}
