import { SimulationState } from '../types';

export const CAMPAIGN_SCHEMA_VERSION = 1;
export const DEFAULT_CAMPAIGN_ID = 'campagne_principale';

export type SaveSourceKind = 'primary' | 'backup_mirror';

export interface CampaignSaveEnvelope {
  ownerId: string;
  campaignId: string;
  schemaVersion: number;
  seq: number;
  checksum: string;
  sourceKind: SaveSourceKind;
  characterName: string;
  day: number;
  simulationState: SimulationState;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ValidationResult {
  valid: boolean;
  reason?: string;
  state?: SimulationState;
  seq?: number;
  checksum?: string;
}

function stripUndefinedDeep<T>(value: T): T {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value
      .filter(item => item !== undefined)
      .map(item => stripUndefinedDeep(item)) as unknown as T;
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (v !== undefined) {
      out[k] = stripUndefinedDeep(v);
    }
  }
  return out as T;
}

export function sanitizeStateForFirestore(state: SimulationState): SimulationState {
  const cleaned = stripUndefinedDeep(JSON.parse(JSON.stringify(state))) as SimulationState;
  if (Array.isArray(cleaned.journalNarratif) && cleaned.journalNarratif.length > 60) {
    cleaned.journalNarratif = cleaned.journalNarratif.slice(-60);
  }
  if (Array.isArray(cleaned.historiqueTraces) && cleaned.historiqueTraces.length > 15) {
    cleaned.historiqueTraces = cleaned.historiqueTraces.slice(-15);
  }
  if (Array.isArray(cleaned.chroniqueMonde) && cleaned.chroniqueMonde.length > 24) {
    cleaned.chroniqueMonde = cleaned.chroniqueMonde.slice(0, 24);
  }
  if (Array.isArray(cleaned.entitesMonde) && cleaned.entitesMonde.length > 16) {
    cleaned.entitesMonde = cleaned.entitesMonde.slice(0, 16);
  }
  if (cleaned.personnage) {
    if (typeof cleaned.personnage.notesPersonnelles === 'string') {
      cleaned.personnage.notesPersonnelles = cleaned.personnage.notesPersonnelles.slice(0, 8000);
    }
    if (Array.isArray(cleaned.personnage.documents)) {
      cleaned.personnage.documents = cleaned.personnage.documents.slice(0, 20).map(doc => ({
        ...doc,
        titre: String(doc.titre || 'Document').slice(0, 120),
        contenu: String(doc.contenu || '').slice(0, 12000),
      }));
    }
  }
  if (cleaned.loreMonde) {
    cleaned.loreMonde = {
      ...cleaned.loreMonde,
      genese: String(cleaned.loreMonde.genese || '').slice(0, 1400),
      chroniqueEres: (cleaned.loreMonde.chroniqueEres || []).slice(0, 5).map(e => ({
        ...e,
        resume: String(e.resume || '').slice(0, 700),
        tracesActuelles: String(e.tracesActuelles || '').slice(0, 400),
      })),
      etatsLore: (cleaned.loreMonde.etatsLore || []).slice(0, 10),
      religionsLore: (cleaned.loreMonde.religionsLore || []).slice(0, 8),
      regionsLore: (cleaned.loreMonde.regionsLore || []).slice(0, 16),
      arcsInitiaux: (cleaned.loreMonde.arcsInitiaux || []).slice(0, 5),
      secretsMondeMJ: (cleaned.loreMonde.secretsMondeMJ || []).slice(0, 6).map(s => String(s).slice(0, 420)),
    };
  }
  if (Array.isArray(cleaned.pnjsMonde) && cleaned.pnjsMonde.length > 80) {
    cleaned.pnjsMonde = cleaned.pnjsMonde.slice(0, 80);
  }
  return cleaned;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(v => stableStringify(v)).join(',')}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
}

export function computeStateChecksum(state: SimulationState): string {
  const payload = stableStringify({
    _seq: state._seq,
    horloge: state.horloge,
    personnage: {
      id: state.personnage?.id,
      nom: state.personnage?.nom,
      pvActuels: state.personnage?.pvActuels,
      pvMax: state.personnage?.pvMax,
      ca: state.personnage?.ca,
      monnaies: state.personnage?.monnaies,
      inventaire: state.personnage?.inventaire,
      experience: state.personnage?.experience,
      epuisement: state.personnage?.epuisement,
    },
    hexActuelId: state.hexActuel?.id,
    journalLen: Array.isArray(state.journalNarratif) ? state.journalNarratif.length : 0,
    dernierSeqJournal: Array.isArray(state.journalNarratif) && state.journalNarratif.length > 0
      ? state.journalNarratif[state.journalNarratif.length - 1]._seq
      : 0,
  });

  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < payload.length; i += 1) {
    const c = payload.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193) >>> 0;
    h2 ^= c + i;
    h2 = Math.imul(h2, 0x85ebca6b) >>> 0;
  }
  return `fnv_${h1.toString(16).padStart(8, '0')}_${h2.toString(16).padStart(8, '0')}`;
}

export function buildCampaignEnvelope(
  ownerId: string,
  state: SimulationState,
  sourceKind: SaveSourceKind,
  campaignId: string = DEFAULT_CAMPAIGN_ID
): Omit<CampaignSaveEnvelope, 'createdAt' | 'updatedAt'> {
  const sanitized = sanitizeStateForFirestore(state);
  const checksum = computeStateChecksum(sanitized);
  const charName = (sanitized.personnage?.nom || 'Aventurier').trim().slice(0, 80) || 'Aventurier';
  const day = Math.max(1, Math.floor(Number(sanitized.horloge?.jour) || 1));
  const seq = Math.max(0, Math.floor(Number(sanitized._seq) || 0));

  return {
    ownerId,
    campaignId,
    schemaVersion: CAMPAIGN_SCHEMA_VERSION,
    seq,
    checksum,
    sourceKind,
    characterName: charName,
    day,
    simulationState: sanitized,
  };
}

export function validateCampaignDocument(docData: unknown): ValidationResult {
  if (!docData || typeof docData !== 'object') {
    return { valid: false, reason: 'Document vide ou illisible.' };
  }
  const d = docData as Record<string, unknown>;
  if (typeof d.schemaVersion !== 'number' || d.schemaVersion < 1) {
    return { valid: false, reason: 'Version de schéma invalide.' };
  }
  if (typeof d.checksum !== 'string' || d.checksum.length < 4) {
    return { valid: false, reason: 'Empreinte manquante.' };
  }
  const sim = d.simulationState as Partial<SimulationState> | undefined;
  if (!sim || typeof sim !== 'object') {
    return { valid: false, reason: 'État de simulation absent.' };
  }
  if (!sim.horloge || typeof sim.horloge.jour !== 'number' || typeof sim.horloge.heure !== 'number') {
    return { valid: false, reason: 'Horloge du monde corrompue.' };
  }
  if (
    !sim.personnage ||
    typeof sim.personnage.nom !== 'string' ||
    typeof sim.personnage.pvActuels !== 'number' ||
    typeof sim.personnage.pvMax !== 'number' ||
    !Array.isArray(sim.personnage.inventaire) ||
    !sim.personnage.caracteristiques
  ) {
    return { valid: false, reason: 'Fiche personnage corrompue.' };
  }
  if (!sim.hexActuel || !Array.isArray(sim.hexagones) || sim.hexagones.length === 0) {
    return { valid: false, reason: 'Carte tactique corrompue.' };
  }
  if (!Array.isArray(sim.factions) || !sim.marche || !Array.isArray(sim.journalNarratif)) {
    return { valid: false, reason: 'Données de campagne incomplètes.' };
  }

  const fullState = sim as SimulationState;
  const expectedChecksum = computeStateChecksum(fullState);
  if (expectedChecksum !== d.checksum) {
    return { valid: false, reason: 'Empreinte d\'intégrité invalide (données altérées).' };
  }

  return {
    valid: true,
    state: fullState,
    seq: typeof d.seq === 'number' ? d.seq : fullState._seq,
    checksum: d.checksum,
  };
}
