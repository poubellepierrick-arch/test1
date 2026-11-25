# Spécification de Sécurité Firestore (Phase 0)

## 1. Invariants de données (Data Invariants)

1. **Isolation stricte par propriétaire** : Tout document sous `/users/{userId}/campaigns/{campaignId}` ou `/users/{userId}/meta/{metaId}` appartient exclusivement à `userId`. Seul l'utilisateur authentifié et vérifié (`request.auth.uid == userId && request.auth.token.email_verified == true`) peut lire ou écrire ses propres documents.
2. **Identité et immuabilité** : `ownerId` doit toujours égaler `request.auth.uid` et `userId`. `campaignId` doit égaler le segment `{campaignId}` du chemin. `ownerId`, `campaignId` et `createdAt` sont strictement immuables après création.
3. **Intégrité temporelle serveur** : `createdAt == request.time` à la création, `updatedAt == request.time` à la création et à chaque mise à jour.
4. **Validation stricte des clés et tailles** : `hasAll` + `hasOnly` à la création, `affectedKeys().hasOnly(...)` par action de mise à jour, bornes `.size()` sur chaque chaîne et carte `simulationState`.
5. **Zéro lecture globale (`allow list` sécurisé)** : Aucune liste globale non filtrée ; `allow list` impose explicitement `resource.data.ownerId == request.auth.uid`.
6. **Aucune PII stockée** : Aucun e-mail, téléphone ni adresse n'est écrit dans Firestore.

## 2. Les 12 charges hostiles (« Dirty Dozen »)

1. **Lecture anonyme** (`auth == null`) sur `/users/u1/campaigns/campagne_principale` → `PERMISSION_DENIED`.
2. **Usurpation de propriétaire** (`userId: 'u1'`, `ownerId: 'u2'`) par utilisateur `u1` → `PERMISSION_DENIED`.
3. **Accès croisé** : utilisateur `u2` lisant ou écrivant `/users/u1/campaigns/campagne_principale` → `PERMISSION_DENIED`.
4. **Compte e-mail non vérifié** (`email_verified: false`) tentant d'écrire → `PERMISSION_DENIED`.
5. **Injection de champ fantôme (Shadow Update)** : ajout d'un champ non autorisé `isAdmin: true` à la création ou mise à jour → `PERMISSION_DENIED`.
6. **Falsification d'horodatage client** (`createdAt` ou `updatedAt` différent de `request.time`) → `PERMISSION_DENIED`.
7. **Mutation de champ immortel** : modification de `ownerId`, `campaignId` ou `createdAt` lors d'un `update` → `PERMISSION_DENIED`.
8. **ID empoisonné (Resource Poisoning)** : `campaignId` contenant des caractères illégaux (`../admin`) ou > 128 caractères → `PERMISSION_DENIED`.
9. **Dépassement de taille de chaîne** : `characterName` > 80 caractères ou `checksum` > 64 caractères → `PERMISSION_DENIED`.
10. **Corruption structurelle de `simulationState`** : `simulationState` non-map ou dépourvu des clés vitales (`horloge`, `personnage`, `hexActuel`, `hexagones`, `factions`, `marche`, `journalNarratif`) → `PERMISSION_DENIED`.
11. **`sourceKind` invalide** : valeur hors de `['primary', 'backup_mirror']` → `PERMISSION_DENIED`.
12. **Écriture directe hors collections autorisées** (ex. `/admins/u1`) → `PERMISSION_DENIED` par filet de sécurité global.
