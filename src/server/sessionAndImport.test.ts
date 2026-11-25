import test from 'node:test';
import assert from 'node:assert/strict';
import { ThinkingLevel } from '@google/genai';
import { SessionStore } from './sessionStore';
import { extraireHerosEtDocuments } from './heroImporter';
import { evaluerComplexiteTour, executerTourMaitreDuJeu } from './gmOrchestrator';
import {
  AI_TIMEOUT_MS,
  HTTP_SERVER_TIMEOUT_MS,
  formaterDureeAttente,
} from '../utils/aiTimeoutConfig';
import { appelerIaAvecRetry, estErreurQuotaJournalier } from './aiTimeout';
import { INITIAL_SIMULATION_STATE } from '../engine/initialData';
import { creerEtatInitialAzgaar } from '../engine/azgaarVoronoi';
import { buildCampaignEnvelope, validateCampaignDocument } from '../firebase/integrity';

test('SessionStore: isole strictement les etats entre sessions distinctes', () => {
  const store = new SessionStore();

  const etatA = store.getState('session_alice');
  const etatB = store.getState('session_bob');

  assert.notEqual(etatA, etatB);
  assert.equal(etatA.personnage.nom, 'Eldrin');
  assert.equal(etatB.personnage.nom, 'Eldrin');

  etatA.personnage.nom = 'Lyra';
  etatA.personnage.pvActuels = 3;
  etatA._seq = 12;
  etatA.modeNarration = 'DEVELOPPE';
  etatA.memoireMJ = {
    filNarratif: ['A', 'B'],
    promessesEtQuetes: [{ id: 'q1', titre: 'Test', interlocuteur: 'Torvin', statut: 'EN_COURS', details: 'x' }],
    consequencesDifferees: [],
    chroniqueCondensee: 'Ancien résumé',
    arcsNarratifs: [{ id: 'a1', titre: 'Arc', statut: 'ACTIF', progression: 50, resume: 'x' }],
    journalSecretMJ: [{ id: 's1', jour: 2, titre: 'Secret', contenu: 'y', categorie: 'INTRIGUE' }],
  };
  store.setState('session_alice', etatA);

  const etatARelu = store.getState('session_alice');
  const etatBRelu = store.getState('session_bob');

  assert.equal(etatARelu.personnage.nom, 'Lyra');
  assert.equal(etatARelu.personnage.pvActuels, 3);
  assert.equal(etatBRelu.personnage.nom, 'Eldrin');
  assert.equal(etatBRelu.personnage.pvActuels, INITIAL_SIMULATION_STATE.personnage.pvActuels);

  const resetA = store.resetState('session_alice');
  assert.equal(resetA._seq, 1);
  assert.equal(resetA.personnage.nom, 'Eldrin');
  assert.equal(resetA.combat.actif, false);
  assert.equal(resetA.donjon, null);
  assert.equal(resetA.jetEnAttente ?? null, null);
  assert.equal(resetA.memoireMJ?.arcsNarratifs?.length ?? 0, 0);
  assert.equal(resetA.memoireMJ?.journalSecretMJ?.length ?? 0, 0);
  assert.equal(resetA.historiqueTraces?.length ?? 0, 0);
  assert.equal(store.getState('session_bob').personnage.nom, 'Eldrin');

  const env = buildCampaignEnvelope('uid_test', resetA, 'primary');
  assert.equal(validateCampaignDocument(env).valid, true);
});

test('heroImporter: extrait une fiche JSON directe et une fiche texte libre + documents sans cle API', async () => {
  const jsonRaw = JSON.stringify({
    nom: 'Kaelen',
    race: 'Elfe',
    classe: 'Magicien',
    niveau: 3,
    pvMax: 18,
    caracteristiques: { FOR: 8, DEX: 14, CON: 12, INT: 17, SAG: 12, CHA: 10 },
    inventaire: [{ nom: 'Bâton', estEquipe: true }],
    sortsNoms: ['Trait de feu', 'Projectile magique'],
  });

  const resJson = await extraireHerosEtDocuments(null, jsonRaw, []);
  assert.equal(resJson.sourceMode, 'json');
  assert.equal(resJson.hero.nom, 'Kaelen');
  assert.equal(resJson.hero.niveau, 3);
  assert.equal(resJson.hero.caracteristiques?.INT, 17);

  const texteLibre = `
Nom: Thorne Valcor
Race: Nain des montagnes
Classe: Guerrier
Niveau 2
PV: 22
FOR 16 DEX 12 CON 16 INT 10 SAG 13 CHA 9
Équipement: Cotte de mailles, Hache d'armes, Bouclier
`;
  const resTexte = await extraireHerosEtDocuments(null, texteLibre, [
    { nom: 'serment.md', contenu: 'Thorne cherche la clé de la forge perdue sous Mont-Brume.' },
  ]);
  assert.equal(resTexte.sourceMode, 'heuristique');
  assert.equal(resTexte.hero.nom, 'Thorne Valcor');
  assert.equal(resTexte.hero.niveau, 2);
  assert.equal(resTexte.hero.pvMax, 22);
  assert.equal(resTexte.hero.caracteristiques?.FOR, 16);
  assert.ok((resTexte.hero.documents || []).some(d => d.titre.includes('serment')));
});

test('gmOrchestrator: fast-path instantane pour config/documents, refus strict sans IA sur tour narratif et injection des documents avec IA', async () => {
  const resConfig = await executerTourMaitreDuJeu(null, INITIAL_SIMULATION_STATE, {
    type: 'CONFIGURER_VOYAGE',
    payloadAction: { allure: 'Rapide', role: 'Forager' },
  });
  assert.equal(resConfig.nouvelEtat.marcheAllure, 'Rapide');
  assert.equal(resConfig.nouvelEtat.roleExploration, 'Forager');
  assert.equal(resConfig.evenementNarratif, undefined);

  const resDoc = await executerTourMaitreDuJeu(null, resConfig.nouvelEtat, {
    type: 'GERER_DOCUMENT_HEROS',
    payloadAction: {
      mode: 'ajouter',
      titre: 'Pacte secret',
      categorie: 'Historique',
      contenu: 'Eldrin porte un médaillon gravé du sceau de Val-Gris.',
      actifPourMJ: true,
    },
  });

  // Un tour narratif sans IA doit échouer sans repli déterministe silencieux
  await assert.rejects(
    () => executerTourMaitreDuJeu(null, resDoc.nouvelEtat, { type: 'REPOS_COURT' }),
    /Le MJ IA ne répond pas/
  );

  // Une IA en erreur doit échouer sans avancer la partie
  const failingAiClient = {
    models: {
      generateContent: async () => {
        throw new Error('Panne simulée');
      },
      generateContentStream: async () => {
        throw new Error('Panne simulée');
      },
    },
  } as any;

  await assert.rejects(
    () =>
      executerTourMaitreDuJeu(failingAiClient, resDoc.nouvelEtat, {
        type: 'ACTION_LIBRE',
        texteLibre: 'Je regarde autour de moi.',
      }),
    /Le MJ IA ne répond pas/
  );

  // Une IA renvoyant un récit vide doit également être rejetée
  const emptyAiClient = {
    models: {
      generateContent: async () => ({
        candidates: [{ content: { role: 'model', parts: [{ text: 'PRETS' }] } }],
      }),
      generateContentStream: async function* () {
        yield { text: '[[TITRE:Vide]][[TON:NEUTRE]]' };
      },
    },
  } as any;

  await assert.rejects(
    () =>
      executerTourMaitreDuJeu(emptyAiClient, resDoc.nouvelEtat, {
        type: 'ACTION_LIBRE',
        texteLibre: 'Je m approche du feu.',
      }),
    /récit vide/
  );

  // Avec un client IA actif, le tour narratif aboutit et injecte les documents actifs
  const mockAiClient = {
    models: {
      generateContent: async () => ({
        candidates: [{ content: { role: 'model', parts: [{ text: 'PRETS' }] } }],
      }),
      generateContentStream: async function* () {
        yield {
          text:
            'Tu reprends ton souffle à l abri d un muret de pierre sèche, tandis que la braise rougeoyante réchauffe le foyer voisin.\n' +
            '[[TITRE:Halte près du muret]]\n' +
            '[[TON:CHAMPETRE]]\n' +
            '[[PISTE:Inspecter les environs]]\n' +
            '[[PISTE:Boire une gorgée d eau]]\n' +
            '[[PISTE:Reprendre la route]]\n' +
            '[[MEMOIRE:Courte halte prise au village.]]',
        };
      },
    },
  } as any;

  const resRepos = await executerTourMaitreDuJeu(mockAiClient, resDoc.nouvelEtat, {
    type: 'REPOS_COURT',
  });
  assert.ok(resRepos.evenementNarratif);
  assert.equal(resRepos.evenementNarratif.titre, 'Halte près du muret');
  const prompt = resRepos.traceExecution.promptUtilisateurIa || '';
  assert.ok(prompt.includes('Pacte secret'));
  assert.ok(prompt.includes('médaillon gravé'));
});

test('gmOrchestrator: OUVERTURE_CAMPAGNE exige l IA, injecte MONDE GÉNÉRÉ À OUVRIR sans fuite UI et reste idempotent', async () => {
  const etatVierge = creerEtatInitialAzgaar();
  assert.equal(etatVierge.journalNarratif.length, 0);
  assert.equal(etatVierge.personnage.memoire.dernieresInfos.length, 0);

  await assert.rejects(
    () => executerTourMaitreDuJeu(null, etatVierge, { type: 'OUVERTURE_CAMPAGNE' }),
    /Le MJ IA ne répond pas/
  );

  let nbAppelsStream = 0;
  const mockAiOuverture = {
    models: {
      generateContent: async () => ({
        candidates: [{ content: { role: 'model', parts: [{ text: 'PRETS' }] } }],
      }),
      generateContentStream: async function* () {
        nbAppelsStream += 1;
        yield {
          text:
            'La pluie fine tambourine sur les toits de chaume tandis qu une charrette embourbée bloque l entrée du bourg.\n' +
            '[[TITRE:Pluie sur le seuil]]\n' +
            '[[TON:NEUTRE]]\n' +
            '[[PISTE:Observer la charrette]]\n' +
            '[[PISTE:Approcher de l auberge]]\n' +
            '[[PISTE:Prendre le chemin est]]\n' +
            '[[MEMOIRE:Arrivée sous la pluie face au bourg.]]',
        };
      },
    },
  } as any;

  const resOuv = await executerTourMaitreDuJeu(mockAiOuverture, etatVierge, {
    type: 'OUVERTURE_CAMPAGNE',
  });

  assert.equal(nbAppelsStream, 1);
  assert.equal(resOuv.nouvelEtat.journalNarratif.length, 1);
  assert.equal(resOuv.evenementNarratif?.titre, 'Pluie sur le seuil');
  const promptOuv = resOuv.traceExecution.promptUtilisateurIa || '';
  assert.ok(promptOuv.includes('=== MONDE GÉNÉRÉ À OUVRIR ==='));
  assert.equal(promptOuv.includes('Services accessibles ici'), false);

  // Idempotence : un second OUVERTURE_CAMPAGNE ne rappelle pas le modèle et ne duplique pas l entrée
  const resDup = await executerTourMaitreDuJeu(mockAiOuverture, resOuv.nouvelEtat, {
    type: 'OUVERTURE_CAMPAGNE',
  });
  assert.equal(nbAppelsStream, 1);
  assert.equal(resDup.nouvelEtat.journalNarratif.length, 1);
  assert.equal(resDup.evenementNarratif?.titre, 'Pluie sur le seuil');
});

test('gmOrchestrator: CONFIGURER_MODELE_IA bascule instantanement entre Gemini 4 Hydrogen Standard et Max (XHIGH)', async () => {
  const etatVierge = creerEtatInitialAzgaar();

  // Standard par défaut -> REPOS_COURT reste MEDIUM
  assert.equal(evaluerComplexiteTour({ type: 'REPOS_COURT' }, etatVierge).niveau, 'MEDIUM');

  // Bascule instantanée vers Max sans appel IA et sans polluer le journal
  const resMax = await executerTourMaitreDuJeu(null, etatVierge, {
    type: 'CONFIGURER_MODELE_IA',
    payloadAction: { profil: 'MAX' },
  });
  assert.equal(resMax.nouvelEtat.profilHydrogen, 'MAX');
  assert.equal(resMax.nouvelEtat.journalNarratif.length, 0);

  const compMax = evaluerComplexiteTour({ type: 'REPOS_COURT' }, resMax.nouvelEtat);
  assert.equal(compMax.niveau, 'XHIGH');
  assert.equal(compMax.thinkingEnum, ThinkingLevel.XHIGH);

  const thinkingCapture: { phase1?: ThinkingLevel; phase2?: ThinkingLevel } = {};
  const mockAiMax = {
    models: {
      generateContent: async (req: any) => {
        thinkingCapture.phase1 = req?.config?.thinkingConfig?.thinkingLevel;
        return { candidates: [{ content: { role: 'model', parts: [{ text: 'PRETS' }] } }] };
      },
      generateContentStream: async function* (req: any) {
        thinkingCapture.phase2 = req?.config?.thinkingConfig?.thinkingLevel;
        yield {
          text:
            'La brume s effiloche sur la place pavée devant les remparts.\n' +
            '[[TITRE:Seuil du bourg]]\n' +
            '[[TON:NEUTRE]]\n' +
            '[[PISTE:Observer la place]]\n' +
            '[[PISTE:Approcher de la porte]]\n' +
            '[[PISTE:Inspecter son équipement]]\n' +
            '[[MEMOIRE:Arrivée devant les remparts.]]',
        };
      },
    },
  } as any;

  const resOuvMax = await executerTourMaitreDuJeu(mockAiMax, resMax.nouvelEtat, {
    type: 'OUVERTURE_CAMPAGNE',
  });
  assert.equal(thinkingCapture.phase1, ThinkingLevel.XHIGH);
  assert.equal(thinkingCapture.phase2, ThinkingLevel.HIGH);
  assert.equal(resOuvMax.traceExecution.modeleIa, 'gemini-4-hydrogen (Max)');
  assert.equal(resOuvMax.traceExecution.niveauReflexion, 'XHIGH');

  // Retour vers Standard
  const resStd = await executerTourMaitreDuJeu(null, resOuvMax.nouvelEtat, {
    type: 'CONFIGURER_MODELE_IA',
    payloadAction: { profil: 'STANDARD' },
  });
  assert.equal(resStd.nouvelEtat.profilHydrogen, 'STANDARD');
  assert.equal(evaluerComplexiteTour({ type: 'REPOS_COURT' }, resStd.nouvelEtat).niveau, 'MEDIUM');
});

test('aiTimeout: budget 15 minutes (900_000 ms), formatage duree, retries multiples dans le budget et arret sur quota/abort', async () => {
  assert.equal(AI_TIMEOUT_MS, 15 * 60 * 1000);
  assert.ok(HTTP_SERVER_TIMEOUT_MS > AI_TIMEOUT_MS);
  assert.equal(formaterDureeAttente(0), '00:00');
  assert.equal(formaterDureeAttente(84_000), '01:24');
  assert.equal(formaterDureeAttente(AI_TIMEOUT_MS), '15:00');

  // Plus de 3 erreurs transitoires 503 sont bien réessayées tant que le budget de temps reste ouvert
  let essais = 0;
  const retriesNotifies: number[] = [];
  const res = await appelerIaAvecRetry(
    async () => {
      essais += 1;
      if (essais < 5) {
        const err: any = new Error('503 Service Unavailable');
        err.status = 503;
        throw err;
      }
      return 'OK_APRES_5_ESSAIS';
    },
    {
      deadlineMs: Date.now() + 10_000,
      maxDelaiBackoffMs: 10,
      onRetry: info => retriesNotifies.push(info.tentative),
    }
  );
  assert.equal(res, 'OK_APRES_5_ESSAIS');
  assert.equal(essais, 5);
  assert.deepEqual(retriesNotifies, [1, 2, 3, 4]);

  // Quota journalier ne doit pas attendre 15 minutes
  let essaisQuota = 0;
  await assert.rejects(
    () =>
      appelerIaAvecRetry(
        async () => {
          essaisQuota += 1;
          throw new Error('429 GenerateRequestsPerDayPerProjectPerModel exceeded');
        },
        { deadlineMs: Date.now() + 10_000, maxDelaiBackoffMs: 10 }
      ),
    /GenerateRequestsPerDay/
  );
  assert.equal(essaisQuota, 1);

  // Expiration explicite 15 minutes sur executerTourMaitreDuJeu et annulation manuelle via AbortSignal
  const etatVierge = creerEtatInitialAzgaar();
  const slowAi = {
    models: {
      generateContent: ({ config }: any) =>
        new Promise((_resolve, reject) => {
          config?.abortSignal?.addEventListener('abort', () => {
            const e = new Error('aborted');
            e.name = 'AbortError';
            reject(e);
          });
        }),
      generateContentStream: async function* () {},
    },
  } as any;

  await assert.rejects(
    () =>
      executerTourMaitreDuJeu(
        slowAi,
        etatVierge,
        { type: 'OUVERTURE_CAMPAGNE' },
        undefined,
        { timeoutMs: 40 }
      ),
    /délai maximal de 15 minutes/
  );

  const ac = new AbortController();
  setTimeout(() => ac.abort(), 25);
  await assert.rejects(
    () =>
      executerTourMaitreDuJeu(
        slowAi,
        etatVierge,
        { type: 'OUVERTURE_CAMPAGNE' },
        undefined,
        { signal: ac.signal, timeoutMs: AI_TIMEOUT_MS }
      ),
    /Tour annulé par le joueur/
  );

  const acImport = new AbortController();
  setTimeout(() => acImport.abort(), 25);
  await assert.rejects(
    () =>
      extraireHerosEtDocuments(slowAi, 'Nom: Testos', [], {
        signal: acImport.signal,
        timeoutMs: AI_TIMEOUT_MS,
      }),
    /Analyse annulée/
  );
});

test('quota journalier Free Tier: detection immediate sans retry et message explicite Settings > Secrets', async () => {
  const payloadFreeTier =
    '{"error":{"code":429,"message":"You exceeded your current quota, please check your plan and billing details. Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 20, model: gemini-4-hydrogen, description: Generate content requests per day limit exceeded on Free Tier.","status":"RESOURCE_EXHAUSTED","details":[{"@type":"type.googleapis.com/google.rpc.QuotaFailure","violations":[{"quotaId":"GenerateRequestsPerDayPerProjectPerModel-FreeTier"}]}]}}';

  const apiErr: any = new Error(payloadFreeTier);
  apiErr.status = 429;

  assert.equal(estErreurQuotaJournalier(apiErr), true);
  assert.equal(estErreurQuotaJournalier(new Error('503 Service Unavailable')), false);

  let nbEssaisRetry = 0;
  await assert.rejects(
    () =>
      appelerIaAvecRetry(
        async () => {
          nbEssaisRetry += 1;
          throw apiErr;
        },
        { deadlineMs: Date.now() + 10_000, maxDelaiBackoffMs: 10 }
      ),
    /GenerateRequestsPerDayPerProjectPerModel-FreeTier/
  );
  assert.equal(nbEssaisRetry, 1);

  const etatVierge = creerEtatInitialAzgaar();
  let nbAppelsGm = 0;
  const quotaAi = {
    models: {
      generateContent: async () => {
        nbAppelsGm += 1;
        throw apiErr;
      },
      generateContentStream: async function* () {},
    },
  } as any;

  await assert.rejects(
    () => executerTourMaitreDuJeu(quotaAi, etatVierge, { type: 'OUVERTURE_CAMPAGNE' }),
    (err: any) => {
      assert.match(String(err?.message || ''), /Le MJ IA ne répond pas/);
      assert.match(String(err?.message || ''), /quota journalier gratuit Gemini atteint/);
      assert.match(String(err?.message || ''), /Settings > Secrets/);
      return true;
    }
  );
  assert.equal(nbAppelsGm, 1);
});

