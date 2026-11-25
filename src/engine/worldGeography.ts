import { Faction, HexNode, WorldClock, WorldEntityType } from '../types';
import { calculerDistanceHex } from './hexcrawl';
import { hydraterEconomieHex } from './worldEconomy';

export interface RouteResult {
  chemin: string[];
  coutTotal: number;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function altitudeBasePourHex(hex: Pick<HexNode, 'id' | 'terrain' | 'pointInteret'>): number {
  if (hex.id === 'hex_m100_montagne') return 88;
  if (hex.id === 'hex_0100_mine') return 76;
  if (hex.id === 'hex_00m1_route') return 38;
  if (hex.id === 'hex_01m1_desert') return 34;
  if (hex.id === 'hex_0001_foret') return 30;
  if (hex.id === 'hex_0000_bourgade') return 22;
  if (hex.id === 'hex_m101_marais') return 8;

  switch (hex.terrain) {
    case 'Montagne Escarpée':
      return 80;
    case 'Marais Fétide':
      return 10;
    case 'Désert Aride':
      return 35;
    case 'Forêt Dense':
      return 30;
    case 'Plaine / Route':
    default:
      return 25;
  }
}

export function cultureBasePourHex(hex: Pick<HexNode, 'id' | 'terrain' | 'factionControleId'>): string {
  if (hex.id === 'hex_01m1_desert' || hex.factionControleId === 'faction_orcs') return 'Horde Borgne';
  if (hex.id === 'hex_0100_mine' || hex.id === 'hex_m100_montagne') return 'Clans du Roc';
  if (hex.id === 'hex_m101_marais' || hex.id === 'hex_0001_foret') return 'Gens des Brumes';
  return 'Marches de Val-Gris';
}

export function populationBasePourHex(hex: Pick<HexNode, 'id' | 'terrain' | 'pointInteret'>): number {
  if (hex.pointInteret?.type === 'bourgade') return 1250;
  if (hex.pointInteret?.type === 'mine') return 240;
  if (hex.pointInteret?.type === 'fort') return 190;
  if (hex.pointInteret?.type === 'camp') return 45;
  if (hex.pointInteret?.type === 'ruine') return 24;
  if (hex.terrain === 'Désert Aride') return 95;
  if (hex.terrain === 'Montagne Escarpée') return 40;
  return 60;
}

export function routeNiveauBasePourHex(hex: Pick<HexNode, 'id' | 'terrain' | 'pointInteret'>): 'ROUTE' | 'PISTE' | 'AUCUNE' {
  if (hex.terrain === 'Plaine / Route' || hex.pointInteret?.type === 'mine' || hex.pointInteret?.type === 'fort') {
    return 'ROUTE';
  }
  if (hex.terrain === 'Forêt Dense' || hex.terrain === 'Montagne Escarpée') {
    return 'PISTE';
  }
  return 'AUCUNE';
}

export function garnisonBasePourHex(hex: Pick<HexNode, 'factionControleId' | 'pointInteret'>): number {
  if (!hex.factionControleId) return 10;
  if (hex.pointInteret?.type === 'bourgade') return 65;
  if (hex.pointInteret?.type === 'fort') return 70;
  if (hex.pointInteret?.type === 'mine') return 42;
  return 35;
}

export function hydraterGeographieHex(hex: HexNode): HexNode {
  const clone: HexNode = { ...hex };
  if (typeof clone.altitude !== 'number') {
    clone.altitude = altitudeBasePourHex(clone);
  }
  if (typeof clone.precipitations !== 'number') {
    clone.precipitations =
      clone.terrain === 'Marais Fétide'
        ? 78
        : clone.terrain === 'Forêt Dense'
        ? 68
        : clone.terrain === 'Montagne Escarpée'
        ? 62
        : clone.terrain === 'Désert Aride'
        ? 12
        : 48;
  }
  if (typeof clone.temperatureC !== 'number') {
    clone.temperatureC = clone.terrain === 'Désert Aride' ? 21 : Math.round(14 - clone.altitude * 0.08);
  }
  if (typeof clone.fluxHydro !== 'number') {
    clone.fluxHydro =
      clone.id === 'hex_m101_marais'
        ? 85
        : clone.id === 'hex_0000_bourgade'
        ? 58
        : clone.id === 'hex_m100_montagne'
        ? 28
        : clone.id === 'hex_0100_mine'
        ? 22
        : clone.terrain === 'Désert Aride'
        ? 3
        : 16;
  }
  if (typeof clone.population !== 'number') {
    clone.population = populationBasePourHex(clone);
  }
  if (!clone.culture) {
    clone.culture = cultureBasePourHex(clone);
  }
  if (typeof clone.garnison !== 'number') {
    clone.garnison = garnisonBasePourHex(clone);
  }
  if (!clone.routeNiveau) {
    clone.routeNiveau = routeNiveauBasePourHex(clone);
  }
  return hydraterEconomieHex(clone);
}

export function hydraterFactionAzgaar(f: Faction): Faction {
  const clone: Faction = { ...f };
  if (!clone.capitaleHexId) {
    clone.capitaleHexId =
      clone.id === 'faction_guilde_marchande'
        ? 'hex_0000_bourgade'
        : clone.id === 'faction_iron_shield'
        ? 'hex_00m1_route'
        : clone.id === 'faction_orcs'
        ? 'hex_01m1_desert'
        : clone.noeudsControles[0];
  }
  if (!clone.cultureDominante) {
    clone.cultureDominante =
      clone.id === 'faction_orcs'
        ? 'Horde Borgne'
        : clone.id === 'faction_iron_shield'
        ? 'Marches de Val-Gris'
        : 'Marches de Val-Gris';
  }
  if (typeof clone.lassitudeGuerre !== 'number') {
    clone.lassitudeGuerre = 10;
  }
  if (typeof clone.populationTotale !== 'number') {
    clone.populationTotale = 250;
  }
  if (typeof clone.forceMax !== 'number') {
    clone.forceMax = 80;
  }
  if (typeof clone.revenuFiscal !== 'number') {
    clone.revenuFiscal = 15;
  }
  return clone;
}

/**
 * Chaîne climatique & hydrologique inspirée d'Azgaar Fantasy Map Generator :
 * 1. Température selon saison, météo, latitude (r) et altitude.
 * 2. Précipitations avec vent humide d'ouest (Mer des Brumes) et ombre pluviométrique des montagnes.
 * 3. Accumulation hydrologique (fluxHydro) des hexagones élevés vers les hexagones plus bas.
 */
export function simulerClimatEtHydrologie(hexagones: HexNode[], horloge: WorldClock): void {
  const saison = horloge.saison || 'Automne';
  const tempSaison =
    saison === 'Été' ? 24 : saison === 'Printemps' ? 14 : saison === 'Automne' ? 11 : -1;
  const deltaMeteoTemp =
    horloge.meteo === 'Chaleur écrasante'
      ? 9
      : horloge.meteo === 'Brume glaciale'
      ? -7
      : horloge.meteo === 'Pluie battante'
      ? -3
      : horloge.meteo === 'Vents violents'
      ? -2
      : 1;

  const humiditeAtmosphere =
    horloge.meteo === 'Pluie battante'
      ? 30
      : horloge.meteo === 'Brume glaciale'
      ? 10
      : horloge.meteo === 'Chaleur écrasante'
      ? -24
      : horloge.meteo === 'Vents violents'
      ? -4
      : 0;

  // Ombre pluviométrique (Azgaar wind/precipitation model : flux d'ouest en est)
  const parQ = [...hexagones].sort((a, b) => a.q - b.q);
  const humiditeParHex = new Map<string, number>();

  for (const h of parQ) {
    const voisinsOuest = hexagones.filter(
      o => o.id !== h.id && calculerDistanceHex(o, h) === 1 && o.q < h.q
    );

    let apportHumide = 52 + humiditeAtmosphere;
    // Proximité de la Mer des Brumes au sud-ouest (r > 0 ou q < 0)
    if (h.r >= 1 || h.q <= -1) apportHumide += 14;

    if (voisinsOuest.length > 0) {
      let blocageMontagne = 0;
      for (const vo of voisinsOuest) {
        const altO = vo.altitude ?? altitudeBasePourHex(vo);
        if (altO >= 65) blocageMontagne += 22;
        else if (altO >= 45) blocageMontagne += 8;
      }
      apportHumide -= blocageMontagne;
    }

    const alt = h.altitude ?? altitudeBasePourHex(h);
    // Effet orographique sur le versant ouest des massifs
    const orographie = alt >= 65 && h.q <= 0 ? 18 : alt >= 65 ? 8 : 0;
    const desertSec = h.terrain === 'Désert Aride' ? -18 : 0;

    const precipCible = clamp(Math.round(apportHumide + orographie + desertSec), 4, 98);
    const precipAct = typeof h.precipitations === 'number' ? h.precipitations : precipCible;
    h.precipitations = clamp(Math.round(precipAct + (precipCible - precipAct) * 0.45), 3, 100);
    humiditeParHex.set(h.id, h.precipitations);

    const bonusDesert = h.terrain === 'Désert Aride' ? 7 : h.terrain === 'Marais Fétide' ? 1 : 0;
    const effetLat = -h.r * 1.2;
    const effetAlt = -(alt * 0.08);
    h.temperatureC = Math.round(tempSaison + deltaMeteoTemp + bonusDesert + effetLat + effetAlt);
  }

  // Accumulation hydrologique descendante (Azgaar river flux)
  const fluxCourant = new Map<string, number>();
  for (const h of hexagones) {
    if (h.estEau) {
      fluxCourant.set(h.id, 0);
      continue;
    }
    const p = humiditeParHex.get(h.id) ?? 40;
    const baseRuissellement = Math.round(p * (h.terrain === 'Désert Aride' ? 0.12 : 0.36));
    fluxCourant.set(h.id, baseRuissellement);
  }

  const triesParAltitude = [...hexagones]
    .filter(h => !h.estEau)
    .sort(
      (a, b) => (b.altitude ?? altitudeBasePourHex(b)) - (a.altitude ?? altitudeBasePourHex(a))
    );

  for (const h of triesParAltitude) {
    const altH = h.altitude ?? altitudeBasePourHex(h);
    const voisinsPlusBas = hexagones
      .filter(v => {
        if (v.id === h.id || calculerDistanceHex(h, v) !== 1) return false;
        const altV = v.altitude ?? altitudeBasePourHex(v);
        return altV < altH;
      })
      .sort((a, b) => (a.altitude ?? 50) - (b.altitude ?? 50));

    if (voisinsPlusBas.length > 0) {
      const cible = voisinsPlusBas[0];
      const fluxTransfert = Math.round((fluxCourant.get(h.id) || 0) * 0.65);
      fluxCourant.set(cible.id, (fluxCourant.get(cible.id) || 0) + fluxTransfert);
    }
  }

  for (const h of hexagones) {
    if (h.estEau) {
      h.fluxHydro = 0;
      continue;
    }
    const brut = fluxCourant.get(h.id) ?? 10;
    const prev = typeof h.fluxHydro === 'number' ? h.fluxHydro : brut;
    h.fluxHydro = clamp(Math.round(prev * 0.35 + brut * 0.65), 1, 100);
  }
}

/**
 * Pathfinding pondéré Dijkstra inspiré du générateur de routes d'Azgaar FMG.
 */
export function calculerItinerairePondere(
  departId: string,
  destinationId: string,
  hexagones: HexNode[],
  typeEntite: WorldEntityType = 'CARAVANE'
): RouteResult {
  if (departId === destinationId) {
    return { chemin: [departId], coutTotal: 0 };
  }
  const mapHex = new Map(hexagones.map(h => [h.id, h]));
  if (!mapHex.has(departId) || !mapHex.has(destinationId)) {
    return { chemin: [departId], coutTotal: 999 };
  }

  const dist = new Map<string, number>();
  const prev = new Map<string, string | null>();
  const nonVisites = new Set<string>();

  for (const h of hexagones) {
    dist.set(h.id, Infinity);
    prev.set(h.id, null);
    nonVisites.add(h.id);
  }
  dist.set(departId, 0);

  const destHex = mapHex.get(destinationId);
  if (!destHex || destHex.estEau) {
    return { chemin: [departId], coutTotal: 999 };
  }

  const coutEntree = (from: HexNode, to: HexNode): number => {
    if (to.estEau) {
      return 9999;
    }
    let base = 4;
    if (to.terrain === 'Montagne Escarpée') base = 9;
    else if (to.terrain === 'Marais Fétide') base = 8;
    else if (to.terrain === 'Désert Aride') base = 7;
    else if (to.terrain === 'Forêt Dense') base = 5.5;
    else if (to.terrain === 'Plaine / Route') base = 3;

    // Pénalité de dénivelé positif (Azgaar slope cost)
    const altFrom = from.altitude ?? altitudeBasePourHex(from);
    const altTo = to.altitude ?? altitudeBasePourHex(to);
    if (altTo > altFrom) {
      base += (altTo - altFrom) * 0.08;
    }

    // Bonus voie construite
    const route = to.routeNiveau || routeNiveauBasePourHex(to);
    if (route === 'ROUTE') base *= 0.65;
    else if (route === 'PISTE') base *= 0.85;

    const pression = to.pressionDanger ?? 30;
    const garnison = to.garnison ?? 10;

    if (typeEntite === 'CARAVANE' || typeEntite === 'REFUGIES' || typeEntite === 'MESSAGER') {
      if (to.securite === 'Périlleux') base += 14;
      else if (to.securite === 'Dangereux') base += 5;
      base += pression * 0.1;
      if (to.pointInteret?.type === 'bourgade' || to.pointInteret?.type === 'fort') {
        base *= 0.85;
      }
    } else if (typeEntite === 'RAIDER') {
      // Les raiders privilégient le couvert et évitent les garnisons sauf cible finale
      if (to.id !== destinationId && (to.pointInteret?.type === 'bourgade' || to.pointInteret?.type === 'fort')) {
        base += 8 + garnison * 0.1;
      }
      if (to.terrain === 'Forêt Dense' || to.terrain === 'Désert Aride') {
        base *= 0.78;
      }
    } else if (typeEntite === 'PATROUILLE') {
      if (route === 'ROUTE') base *= 0.8;
    }

    return Math.max(1, Number(base.toFixed(2)));
  };

  while (nonVisites.size > 0) {
    let uId: string | null = null;
    let minD = Infinity;
    for (const id of nonVisites) {
      const d = dist.get(id) ?? Infinity;
      if (d < minD) {
        minD = d;
        uId = id;
      }
    }
    if (!uId || minD === Infinity) break;
    if (uId === destinationId) break;
    nonVisites.delete(uId);

    const uHex = mapHex.get(uId)!;
    const voisins = hexagones.filter(
      h =>
        nonVisites.has(h.id) &&
        !h.estEau &&
        calculerDistanceHex(uHex, h) === 1
    );

    for (const vHex of voisins) {
      const altDist = minD + coutEntree(uHex, vHex);
      if (altDist < (dist.get(vHex.id) ?? Infinity)) {
        dist.set(vHex.id, altDist);
        prev.set(vHex.id, uHex.id);
      }
    }
  }

  const chemin: string[] = [];
  let cur: string | null = destinationId;
  while (cur) {
    chemin.unshift(cur);
    cur = prev.get(cur) || null;
  }

  if (chemin[0] !== departId) {
    return { chemin: [departId], coutTotal: 999 };
  }

  return {
    chemin,
    coutTotal: Number((dist.get(destinationId) ?? 999).toFixed(2)),
  };
}

/**
 * Modèle d'expansion territoriale inspiré d'Azgaar `burgs-and-states` :
 * pondère valeur stratégique/économique contre distance à la capitale, relief, culture et garnison.
 */
export function evaluerScoreExpansionAzgaar(
  faction: Faction,
  hexCible: HexNode,
  hexagones: HexNode[]
): number {
  const capitale =
    hexagones.find(h => h.id === (faction.capitaleHexId || faction.noeudsControles[0])) || hexCible;
  const distCapitale = calculerDistanceHex(capitale, hexCible);

  let valeur = (hexCible.prosperite ?? 25) * 0.25 + Math.min(8, (hexCible.population ?? 50) / 160);
  if (hexCible.id === 'hex_0100_mine') valeur += 22;
  if (hexCible.id === 'hex_00m1_route') valeur += 15;
  if (hexCible.pointInteret?.type === 'bourgade') valeur += 12;
  if (hexCible.pointInteret?.type === 'fort') valeur += 11;
  if (!hexCible.factionControleId) valeur += 7;
  if ((hexCible.fluxHydro ?? 15) >= 45) valeur += 4;

  // Coût d'expansion Azgaar : distance, altitude, culture différente, garnison et murailles
  let cout = distCapitale * 5.5;
  const alt = hexCible.altitude ?? altitudeBasePourHex(hexCible);
  if (alt >= 70) cout += 7;
  if (hexCible.terrain === 'Marais Fétide') cout += 6;
  if (hexCible.terrain === 'Désert Aride' && faction.id !== 'faction_orcs') cout += 8;
  if (hexCible.pointInteret?.type === 'bourgade' && hexCible.factionControleId) cout += 18;

  const cultureHex = hexCible.culture || cultureBasePourHex(hexCible);
  if (faction.cultureDominante && cultureHex === faction.cultureDominante) {
    cout -= 5;
  }

  const garnison = hexCible.garnison ?? garnisonBasePourHex(hexCible);
  if (hexCible.factionControleId && hexCible.factionControleId !== faction.id) {
    cout += garnison * 0.25;
  }

  return Number((valeur - cout).toFixed(2));
}
