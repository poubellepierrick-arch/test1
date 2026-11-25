import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { INITIAL_SIMULATION_STATE } from './src/engine/initialData';
import {
  buildCampaignEnvelope,
  computeStateChecksum,
  validateCampaignDocument,
} from './src/firebase/integrity';

const RULES_PATH = path.resolve(process.cwd(), 'firestore.rules');
const rulesText = fs.readFileSync(RULES_PATH, 'utf-8');

test('Dirty Dozen - Règles Firestore durcies et invariants de sécurité', () => {
  // 1. Filet de sécurité global par défaut
  assert.match(rulesText, /match \/\{document=\*\*\} \{\s*allow read, write: if false;/);

  // 2. Email vérifié requis pour propriétaire
  assert.match(rulesText, /request\.auth\.token\.email_verified == true/);

  // 3. Validation d'identité et path variable hardening
  assert.match(rulesText, /function isValidId\(id\)/);
  assert.match(rulesText, /data\.ownerId == userId/);
  assert.match(rulesText, /data\.ownerId == request\.auth\.uid/);
  assert.match(rulesText, /data\.campaignId == campaignId/);

  // 4. Protection Shadow Update (hasAll + hasOnly + affectedKeys().hasOnly)
  assert.match(rulesText, /data\.keys\(\)\.hasAll\(/);
  assert.match(rulesText, /data\.keys\(\)\.hasOnly\(/);
  assert.match(rulesText, /incoming\(\)\.diff\(existing\(\)\)\.affectedKeys\(\)\.hasOnly\(/);

  // 5. Intégrité temporelle stricte serveur
  assert.match(rulesText, /incoming\(\)\.createdAt == request\.time/);
  assert.match(rulesText, /incoming\(\)\.updatedAt == request\.time/);

  // 6. Champs immortels sur update
  assert.match(rulesText, /incoming\(\)\.ownerId == existing\(\)\.ownerId/);
  assert.match(rulesText, /incoming\(\)\.campaignId == existing\(\)\.campaignId/);
  assert.match(rulesText, /incoming\(\)\.createdAt == existing\(\)\.createdAt/);

  // 7. List query sécurisée sans get()/exists()
  assert.match(rulesText, /allow list: if isVerifiedOwner\(userId\) && existing\(\)\.ownerId == request\.auth\.uid;/);

  // 8. Bornes de taille sur chaînes et sourceKind
  assert.match(rulesText, /data\.characterName\.size\(\) <= 80/);
  assert.match(rulesText, /data\.checksum\.size\(\) <= 64/);
  assert.match(rulesText, /data\.sourceKind in \['primary', 'backup_mirror'\]/);
});

test('Anti-corruption : enveloppe valide puis détection de toute altération', () => {
  const envelope = buildCampaignEnvelope('uid_test_1', INITIAL_SIMULATION_STATE, 'primary');
  const ok = validateCampaignDocument(envelope);
  assert.equal(ok.valid, true);
  assert.equal(ok.checksum, computeStateChecksum(envelope.simulationState));

  // Altération PV (simulation corruption silencieuse)
  const corruptedPv = structuredClone(envelope);
  corruptedPv.simulationState.personnage.pvActuels = 9999;
  assert.equal(validateCampaignDocument(corruptedPv).valid, false);

  // Suppression d'un bloc vital
  const corruptedMap = structuredClone(envelope) as any;
  delete corruptedMap.simulationState.hexagones;
  assert.equal(validateCampaignDocument(corruptedMap).valid, false);
});
