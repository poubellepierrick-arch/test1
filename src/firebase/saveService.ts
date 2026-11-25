import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  Firestore,
} from 'firebase/firestore';
import { auth, dbBackup, dbPrimary } from './config';
import {
  buildCampaignEnvelope,
  DEFAULT_CAMPAIGN_ID,
  SaveSourceKind,
  validateCampaignDocument,
} from './integrity';
import { SimulationState } from '../types';

export const BACKUP_SYNC_INTERVAL_TURNS = 5;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map(provider => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export interface DualSaveStatus {
  primaryHealthy: boolean;
  primaryCorruptionReason?: string;
  backupAvailable: boolean;
  backupSeq: number | null;
  primarySeq: number | null;
  restoredFromBackup: boolean;
}

export interface DualLoadResult {
  stateToLoad: SimulationState | null;
  status: DualSaveStatus;
}

function getCampaignRef(database: Firestore, uid: string) {
  return doc(database, 'users', uid, 'campaigns', DEFAULT_CAMPAIGN_ID);
}

function getMetaRef(database: Firestore, uid: string) {
  return doc(database, 'users', uid, 'meta', 'sync');
}

async function upsertCampaign(
  database: Firestore,
  uid: string,
  state: SimulationState,
  sourceKind: SaveSourceKind
): Promise<number> {
  const path = `users/${uid}/campaigns/${DEFAULT_CAMPAIGN_ID}`;
  const ref = getCampaignRef(database, uid);
  const envelope = buildCampaignEnvelope(uid, state, sourceKind);

  // Vérification locale stricte avant d'écrire (garantit de ne jamais propager un état corrompu vers le secours)
  const check = validateCampaignDocument(envelope);
  if (!check.valid) {
    throw new Error(`Sauvegarde bloquée : ${check.reason}`);
  }

  let existsSnap = false;
  let existingCreatedAt: unknown = null;
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      existsSnap = true;
      existingCreatedAt = snap.data()?.createdAt ?? null;
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }

  try {
    if (existsSnap && existingCreatedAt) {
      await setDoc(
        ref,
        {
          ...envelope,
          createdAt: existingCreatedAt,
          updatedAt: serverTimestamp(),
        },
        { merge: false }
      );
    } else {
      await setDoc(ref, {
        ...envelope,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, existsSnap ? OperationType.UPDATE : OperationType.CREATE, path);
  }

  return envelope.seq;
}

async function upsertUserMeta(
  database: Firestore,
  uid: string,
  displayName: string,
  lastBackupSeq: number
) {
  const path = `users/${uid}/meta/sync`;
  const ref = getMetaRef(database, uid);
  const safeName = (displayName || 'Aventurier').trim().slice(0, 80) || 'Aventurier';

  let existsSnap = false;
  let existingCreatedAt: unknown = null;
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      existsSnap = true;
      existingCreatedAt = snap.data()?.createdAt ?? null;
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }

  try {
    if (existsSnap && existingCreatedAt) {
      await setDoc(ref, {
        ownerId: uid,
        displayName: safeName,
        lastBackupSeq,
        createdAt: existingCreatedAt,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        ownerId: uid,
        displayName: safeName,
        lastBackupSeq,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, existsSnap ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

export async function saveToPrimary(uid: string, state: SimulationState): Promise<number> {
  return upsertCampaign(dbPrimary, uid, state, 'primary');
}

export async function saveToBackupMirror(
  uid: string,
  state: SimulationState,
  displayName: string
): Promise<number> {
  const seq = await upsertCampaign(dbBackup, uid, state, 'backup_mirror');
  await upsertUserMeta(dbBackup, uid, displayName, seq);
  return seq;
}

export async function loadDualSaves(uid: string): Promise<DualLoadResult> {
  const path = `users/${uid}/campaigns/${DEFAULT_CAMPAIGN_ID}`;

  let primaryRaw: unknown = null;
  let primaryExists = false;
  let primaryReadError: string | undefined;

  try {
    const primarySnap = await getDoc(getCampaignRef(dbPrimary, uid));
    primaryExists = primarySnap.exists();
    primaryRaw = primaryExists ? primarySnap.data() : null;
  } catch (err: any) {
    if (err?.message?.includes('permission') || err?.code === 'permission-denied') {
      handleFirestoreError(err, OperationType.GET, path);
    }
    primaryReadError = err?.message || 'Lecture base principale impossible.';
  }

  let backupRaw: unknown = null;
  let backupExists = false;
  try {
    const backupSnap = await getDoc(getCampaignRef(dbBackup, uid));
    backupExists = backupSnap.exists();
    backupRaw = backupExists ? backupSnap.data() : null;
  } catch (err: any) {
    if (err?.message?.includes('permission') || err?.code === 'permission-denied') {
      handleFirestoreError(err, OperationType.GET, path);
    }
  }

  const primaryValidation = primaryExists
    ? validateCampaignDocument(primaryRaw)
    : { valid: false, reason: primaryReadError || 'Aucune sauvegarde principale.' };

  const backupValidation = backupExists
    ? validateCampaignDocument(backupRaw)
    : { valid: false, reason: 'Aucune copie de secours.' };

  if (primaryExists && primaryValidation.valid && primaryValidation.state) {
    return {
      stateToLoad: primaryValidation.state,
      status: {
        primaryHealthy: true,
        backupAvailable: backupValidation.valid,
        backupSeq: backupValidation.valid ? backupValidation.seq ?? null : null,
        primarySeq: primaryValidation.seq ?? null,
        restoredFromBackup: false,
      },
    };
  }

  if (backupExists && backupValidation.valid && backupValidation.state) {
    return {
      stateToLoad: backupValidation.state,
      status: {
        primaryHealthy: !primaryExists && !primaryReadError,
        primaryCorruptionReason: primaryExists || primaryReadError ? primaryValidation.reason : undefined,
        backupAvailable: true,
        backupSeq: backupValidation.seq ?? null,
        primarySeq: null,
        restoredFromBackup: true,
      },
    };
  }

  return {
    stateToLoad: null,
    status: {
      primaryHealthy: !primaryExists && !primaryReadError,
      primaryCorruptionReason: primaryExists || primaryReadError ? primaryValidation.reason : undefined,
      backupAvailable: false,
      backupSeq: null,
      primarySeq: null,
      restoredFromBackup: false,
    },
  };
}

export async function restoreBackupIntoPrimary(uid: string): Promise<{
  restoredState: SimulationState | null;
  seq: number | null;
}> {
  const path = `users/${uid}/campaigns/${DEFAULT_CAMPAIGN_ID}`;
  let snap;
  try {
    snap = await getDoc(getCampaignRef(dbBackup, uid));
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
  if (!snap.exists()) {
    return { restoredState: null, seq: null };
  }
  const validation = validateCampaignDocument(snap.data());
  if (!validation.valid || !validation.state) {
    throw new Error(validation.reason || 'La base de secours est invalide.');
  }
  const seq = await saveToPrimary(uid, validation.state);
  return { restoredState: validation.state, seq };
}
