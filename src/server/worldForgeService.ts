import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import {
  CharacterStats,
  SimulationState,
  WorldForgeDraft,
  WorldForgeStep,
  WorldLoreBundle,
  WorldNpcRecord,
} from '../types';
import {
  genererLoreProcedural,
  genererPnjsProcedural,
  promouvoirPnjDeterministe,
  reconcilierProximitePnjs,
} from '../engine/worldLoreAndNpcs';
import {
  regenererEtape1CartoBrouillon,
  regenererEtape2GeopolitiqueBrouillon,
} from '../engine/worldForgeDraft';
import { appelerIaAvecRetry } from './aiTimeout';

const MODEL_FORGE = 'gemini-4-hydrogen';

export interface ForgeStepExecutionResult {
  draft: WorldForgeDraft;
  source: 'GEMINI' | 'PROCEDURAL';
  note?: string;
}

function nettoyerJson(text?: string): string {
  if (!text) return '{}';
  return text.trim().replace(/^```json\s*/i, '').replace(/```$/i, '').trim() || '{}';
}

function decrireHerosPourPrompt(hero: CharacterStats): string {
  const docs = (hero.documents || [])
    .filter(d => d.actifPourMJ && d.contenu.trim())
    .slice(0, 3)
    .map(d => `${d.titre} (${d.categorie}): ${d.contenu.slice(0, 450)}`)
    .join(' | ');
  return [
    `Nom: ${hero.nom}`,
    `Classe/Niveau: ${hero.classe} niv.${hero.niveau}`,
    hero.race ? `Race: ${hero.race}` : '',
    hero.historique ? `Historique: ${hero.historique}` : '',
    hero.traits ? `Traits: ${hero.traits}` : '',
    hero.notesPersonnelles ? `Notes: ${hero.notesPersonnelles.slice(0, 350)}` : '',
    docs ? `Documents actifs: ${docs}` : '',
  ]
    .filter(Boolean)
    .join(' ; ');
}

export async function executerEtapeForgeServeur(
  aiClient: GoogleGenAI | null,
  draftInput: WorldForgeDraft,
  step: WorldForgeStep,
  hero: CharacterStats,
  opts: {
    signal?: AbortSignal;
    timeoutMs?: number;
    regenererGeometrie?: boolean;
  } = {}
): Promise<ForgeStepExecutionResult> {
  const draft: WorldForgeDraft = JSON.parse(JSON.stringify(draftInput));
  draft.etapeCourante = step;

  if (step === 1) {
    const nextDraft = opts.regenererGeometrie
      ? regenererEtape1CartoBrouillon(draft, hero)
      : draft;
    nextDraft.etapeCourante = 1;
    nextDraft.sourceParEtape = { ...nextDraft.sourceParEtape, 1: 'PROCEDURAL' };
    return {
      draft: nextDraft,
      source: 'PROCEDURAL',
      note: 'Relief, climat, bassins fluviaux et côtes calculés sur la grille Voronoï.',
    };
  }

  if (step === 2) {
    const baseDraft = opts.regenererGeometrie
      ? regenererEtape2GeopolitiqueBrouillon(draft, hero)
      : draft;

    if (!aiClient) {
      baseDraft.sourceParEtape = { ...baseDraft.sourceParEtape, 2: 'PROCEDURAL' };
      return {
        draft: baseDraft,
        source: 'PROCEDURAL',
        note: 'Peuples, États et factions générés par le moteur déterministe.',
      };
    }

    try {
      const prompt = `Tu es un architecte d'univers D&D 5e sobre et cohérent (en français).
À partir de cette carte physique et géopolitique brute, affine les noms, régimes, cultures, religions et spécialisations des bourgs pour créer un ensemble crédible et original.
Monde: ${baseDraft.config.worldName} (climat ${baseDraft.config.climateBias}, gabarit ${baseDraft.config.template})
Tonalité: ${baseDraft.config.tonalite}
Directive utilisateur: ${baseDraft.config.customPrompt || 'Aucune directive particulière'}

États actuels: ${baseDraft.studio.states.map(s => `[id=${s.id}] ${s.name} (${s.government})`).join(' | ')}
Cultures actuelles: ${baseDraft.studio.cultures.map(c => `[id=${c.id}] ${c.name} (${c.type})`).join(' | ')}
Religions actuelles: ${baseDraft.studio.religions.map(r => `[id=${r.id}] ${r.name} / déité ${r.deity} (${r.type})`).join(' | ')}
Principaux bourgs: ${baseDraft.studio.burgs.slice(0, 10).map(b => `[id=${b.id}] ${b.name}${b.capital ? ' (Cap)' : ''}${b.port ? ' (Port)' : ''}`).join(' | ')}

Conserve strictement les mêmes identifiants numériques (id). Ne recycle aucun nom d'univers publié.`;

      const resp = await appelerIaAvecRetry(
        ({ signal }) =>
          aiClient.models.generateContent({
            model: MODEL_FORGE,
            contents: prompt,
            config: {
              abortSignal: signal,
              thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  worldName: { type: Type.STRING },
                  states: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        id: { type: Type.INTEGER },
                        name: { type: Type.STRING },
                        government: { type: Type.STRING },
                      },
                      required: ['id', 'name', 'government'],
                    },
                  },
                  cultures: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        id: { type: Type.INTEGER },
                        name: { type: Type.STRING },
                      },
                      required: ['id', 'name'],
                    },
                  },
                  religions: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        id: { type: Type.INTEGER },
                        name: { type: Type.STRING },
                        deity: { type: Type.STRING },
                      },
                      required: ['id', 'name', 'deity'],
                    },
                  },
                  burgs: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        id: { type: Type.INTEGER },
                        name: { type: Type.STRING },
                        specialisation: { type: Type.STRING },
                      },
                      required: ['id', 'name'],
                    },
                  },
                },
                required: ['states', 'cultures', 'religions', 'burgs'],
              },
            },
          }),
        { signal: opts.signal, timeoutMs: opts.timeoutMs }
      );

      const parsed = JSON.parse(nettoyerJson(resp.text));
      if (parsed.worldName && typeof parsed.worldName === 'string') {
        baseDraft.config.worldName = parsed.worldName.slice(0, 60);
        baseDraft.studio.worldName = baseDraft.config.worldName;
      }
      if (Array.isArray(parsed.states)) {
        for (const item of parsed.states) {
          const st = baseDraft.studio.states.find(s => s.id === Number(item.id));
          if (st) {
            st.name = String(item.name || st.name).slice(0, 48);
            st.government = String(item.government || st.government).slice(0, 48);
            const fac = baseDraft.factions.find(f => f.id === st.factionId);
            if (fac) fac.nom = st.name;
          }
        }
      }
      if (Array.isArray(parsed.cultures)) {
        for (const item of parsed.cultures) {
          const cul = baseDraft.studio.cultures.find(c => c.id === Number(item.id));
          if (cul) cul.name = String(item.name || cul.name).slice(0, 48);
        }
      }
      if (Array.isArray(parsed.religions)) {
        for (const item of parsed.religions) {
          const rel = baseDraft.studio.religions.find(r => r.id === Number(item.id));
          if (rel) {
            rel.name = String(item.name || rel.name).slice(0, 48);
            rel.deity = String(item.deity || rel.deity).slice(0, 48);
          }
        }
      }
      if (Array.isArray(parsed.burgs)) {
        for (const item of parsed.burgs) {
          const burg = baseDraft.studio.burgs.find(b => b.id === Number(item.id));
          if (burg) {
            burg.name = String(item.name || burg.name).slice(0, 48);
            if (item.specialisation) {
              burg.specialisation = String(item.specialisation).slice(0, 72);
            }
          }
        }
      }

      baseDraft.etapeCourante = 2;
      baseDraft.sourceParEtape = { ...baseDraft.sourceParEtape, 2: 'GEMINI' };
      return {
        draft: baseDraft,
        source: 'GEMINI',
        note: 'Peuples, États et bourgs nommés et caractérisés par Gemini.',
      };
    } catch (err: any) {
      if (err?.name === 'AbortError') throw err;
      baseDraft.etapeCourante = 2;
      baseDraft.sourceParEtape = { ...baseDraft.sourceParEtape, 2: 'PROCEDURAL' };
      return {
        draft: baseDraft,
        source: 'PROCEDURAL',
        note: 'Repli procédural utilisé pour la géopolitique (service IA indisponible).',
      };
    }
  }

  if (step === 3) {
    const procLore = genererLoreProcedural(draft.studio, draft.factions, draft.config);

    if (!aiClient) {
      draft.lore = procLore;
      draft.etapeCourante = 3;
      draft.sourceParEtape = { ...draft.sourceParEtape, 3: 'PROCEDURAL' };
      return {
        draft,
        source: 'PROCEDURAL',
        note: 'Chronique, religions et légendes locales générées de manière déterministe.',
      };
    }

    try {
      const burgsCibles = draft.studio.burgs.slice(0, 8);
      const prompt = `Tu es le bâtisseur d'univers d'une campagne D&D 5e sombre, réaliste et sans clichés (en français).
Génère le lore complet de ce monde en respectant strictement la géographie et les entités ci-dessous :
Monde : ${draft.studio.worldName} | Tonalité : ${draft.config.tonalite} | Climat : ${draft.config.climateBias}
Directive utilisateur : ${draft.config.customPrompt || 'Aucune'}

États :
${draft.studio.states.map(s => `- [stateId=${s.id}] ${s.name} (${s.government}), diplomatie: ${JSON.stringify(s.diplomacy)}`).join('\n')}

Religions :
${draft.studio.religions.map(r => `- [religionId=${r.id}] ${r.name} (${r.type}, déité ${r.deity})`).join('\n')}

Bourgs principaux :
${burgsCibles.map(b => `- [burgId=${b.id}] ${b.name}${b.capital ? ' [Capitale]' : ''}${b.port ? ' [Port]' : ''}, pop ${b.population}, spé: ${b.specialisation || 'négoce'}`).join('\n')}

Consignes :
- 3 ères historiques concrètes laissant des traces physiques exploitables en jeu.
- Pour chaque État, une devise, une histoire brève, une tension interne et un secret d'État pour le MJ.
- Pour chaque Religion, un dogme, des rites concrets, le rôle du clergé et une hérésie secrète pour le MJ.
- Pour les bourgs listés, une histoire locale, une légende populaire, une particularité économique et un secret local.
- 2 à 3 arcs narratifs initiaux ancrés dans cette carte et 3 secrets généraux pour le MJ.`;

      const resp = await appelerIaAvecRetry(
        ({ signal }) =>
          aiClient.models.generateContent({
            model: MODEL_FORGE,
            contents: prompt,
            config: {
              abortSignal: signal,
              thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  genese: { type: Type.STRING },
                  chroniqueEres: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        periode: { type: Type.STRING },
                        titre: { type: Type.STRING },
                        resume: { type: Type.STRING },
                        tracesActuelles: { type: Type.STRING },
                      },
                      required: ['periode', 'titre', 'resume', 'tracesActuelles'],
                    },
                  },
                  etatsLore: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        stateId: { type: Type.INTEGER },
                        devise: { type: Type.STRING },
                        histoire: { type: Type.STRING },
                        tensionInterne: { type: Type.STRING },
                        secretEtat: { type: Type.STRING },
                      },
                      required: ['stateId', 'devise', 'histoire', 'tensionInterne', 'secretEtat'],
                    },
                  },
                  religionsLore: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        religionId: { type: Type.INTEGER },
                        dogme: { type: Type.STRING },
                        rites: { type: Type.STRING },
                        clerge: { type: Type.STRING },
                        heresieSecrete: { type: Type.STRING },
                      },
                      required: ['religionId', 'dogme', 'rites', 'clerge', 'heresieSecrete'],
                    },
                  },
                  regionsLore: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        burgId: { type: Type.INTEGER },
                        histoireLocale: { type: Type.STRING },
                        legendePopulaire: { type: Type.STRING },
                        particulariteEconomique: { type: Type.STRING },
                        secretLocal: { type: Type.STRING },
                      },
                      required: ['burgId', 'histoireLocale', 'legendePopulaire', 'particulariteEconomique'],
                    },
                  },
                  arcsInitiaux: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        titre: { type: Type.STRING },
                        resume: { type: Type.STRING },
                        acteursNoms: { type: Type.ARRAY, items: { type: Type.STRING } },
                        enjeu: { type: Type.STRING },
                        prochaineEtape: { type: Type.STRING },
                      },
                      required: ['titre', 'resume', 'acteursNoms', 'enjeu', 'prochaineEtape'],
                    },
                  },
                  secretsMondeMJ: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                },
                required: ['genese', 'chroniqueEres', 'etatsLore', 'religionsLore', 'regionsLore', 'arcsInitiaux', 'secretsMondeMJ'],
              },
            },
          }),
        { signal: opts.signal, timeoutMs: opts.timeoutMs }
      );

      const parsed = JSON.parse(nettoyerJson(resp.text));
      const lore: WorldLoreBundle = {
        ...procLore,
        generationSource: 'GEMINI',
        genese: String(parsed.genese || procLore.genese).slice(0, 1200),
        chroniqueEres: Array.isArray(parsed.chroniqueEres) && parsed.chroniqueEres.length > 0
          ? parsed.chroniqueEres.slice(0, 4).map((e: any, i: number) => ({
              id: `era_ai_${i}_${draft.studio.seed}`,
              periode: String(e.periode || `Ère ${i + 1}`).slice(0, 60),
              titre: String(e.titre || 'Période').slice(0, 90),
              resume: String(e.resume || '').slice(0, 600),
              tracesActuelles: String(e.tracesActuelles || '').slice(0, 350),
            }))
          : procLore.chroniqueEres,
        etatsLore: procLore.etatsLore.map(baseSt => {
          const match = Array.isArray(parsed.etatsLore)
            ? parsed.etatsLore.find((x: any) => Number(x.stateId) === baseSt.stateId)
            : undefined;
          if (!match) return baseSt;
          return {
            ...baseSt,
            devise: String(match.devise || baseSt.devise).slice(0, 90),
            histoire: String(match.histoire || baseSt.histoire).slice(0, 650),
            tensionInterne: String(match.tensionInterne || baseSt.tensionInterne).slice(0, 450),
            secretEtat: String(match.secretEtat || baseSt.secretEtat || '').slice(0, 450),
          };
        }),
        religionsLore: procLore.religionsLore.map(baseRel => {
          const match = Array.isArray(parsed.religionsLore)
            ? parsed.religionsLore.find((x: any) => Number(x.religionId) === baseRel.religionId)
            : undefined;
          if (!match) return baseRel;
          return {
            ...baseRel,
            dogme: String(match.dogme || baseRel.dogme).slice(0, 450),
            rites: String(match.rites || baseRel.rites).slice(0, 350),
            clerge: String(match.clerge || baseRel.clerge).slice(0, 350),
            heresieSecrete: String(match.heresieSecrete || baseRel.heresieSecrete || '').slice(0, 450),
          };
        }),
        regionsLore: procLore.regionsLore.map(baseReg => {
          const match = Array.isArray(parsed.regionsLore)
            ? parsed.regionsLore.find((x: any) => Number(x.burgId) === baseReg.burgId)
            : undefined;
          if (!match) return baseReg;
          return {
            ...baseReg,
            histoireLocale: String(match.histoireLocale || baseReg.histoireLocale).slice(0, 500),
            legendePopulaire: String(match.legendePopulaire || baseReg.legendePopulaire).slice(0, 380),
            particulariteEconomique: String(match.particulariteEconomique || baseReg.particulariteEconomique).slice(0, 320),
            secretLocal: String(match.secretLocal || baseReg.secretLocal || '').slice(0, 380),
          };
        }),
        arcsInitiaux: Array.isArray(parsed.arcsInitiaux) && parsed.arcsInitiaux.length > 0
          ? parsed.arcsInitiaux.slice(0, 3).map((a: any, i: number) => ({
              id: `arc_ai_${i}_${draft.studio.seed}`,
              titre: String(a.titre || `Arc ${i + 1}`).slice(0, 90),
              resume: String(a.resume || '').slice(0, 500),
              acteursNoms: Array.isArray(a.acteursNoms) ? a.acteursNoms.map(String).slice(0, 4) : [],
              enjeu: String(a.enjeu || '').slice(0, 280),
              prochaineEtape: String(a.prochaineEtape || '').slice(0, 280),
            }))
          : procLore.arcsInitiaux,
        secretsMondeMJ: Array.isArray(parsed.secretsMondeMJ) && parsed.secretsMondeMJ.length > 0
          ? parsed.secretsMondeMJ.slice(0, 4).map((s: any) => String(s).slice(0, 380))
          : procLore.secretsMondeMJ,
      };

      draft.lore = lore;
      draft.etapeCourante = 3;
      draft.sourceParEtape = { ...draft.sourceParEtape, 3: 'GEMINI' };
      return {
        draft,
        source: 'GEMINI',
        note: 'Genèse, ères, légendes locales, arcs et secrets du MJ générés par Gemini.',
      };
    } catch (err: any) {
      if (err?.name === 'AbortError') throw err;
      draft.lore = procLore;
      draft.etapeCourante = 3;
      draft.sourceParEtape = { ...draft.sourceParEtape, 3: 'PROCEDURAL' };
      return {
        draft,
        source: 'PROCEDURAL',
        note: 'Repli procédural utilisé pour le lore complet (service IA indisponible).',
      };
    }
  }

  // ÉTAPE 4 : PNJ importants (Monde + Héros) + Proches pré-générés + Lambda lointains
  const procPnjs = genererPnjsProcedural(
    draft.studio,
    draft.factions,
    draft.hexagones,
    draft.lore,
    hero,
    draft.config
  );

  if (!aiClient) {
    draft.pnjs = procPnjs;
    draft.etapeCourante = 4;
    draft.sourceParEtape = { ...draft.sourceParEtape, 4: 'PROCEDURAL' };
    return {
      draft,
      source: 'PROCEDURAL',
      note: 'PNJ majeurs, liens du héros, voisins pré-générés et habitants lambda créés de manière déterministe.',
    };
  }

  try {
    const cibleEnrichissement = procPnjs.filter(
      p => p.tier === 'MAJEUR_MONDE' || p.tier === 'LIEN_HEROS' || p.tier === 'PROCHE_PREGEN'
    ).slice(0, 14);

    const prompt = `Tu es le créateur de personnages d'une campagne D&D 5e vivante (en français).
Enrichis les PNJ suivants pour qu'ils soient incarnés, distincts, ancrés dans le lore du monde et dans l'historique du héros.
Monde : ${draft.studio.worldName} | Tonalité : ${draft.config.tonalite}
Genèse : ${draft.lore.genese}
Arcs initiaux : ${draft.lore.arcsInitiaux.map(a => `${a.titre} (${a.resume})`).join(' | ')}
Personnage joueur : ${decrireHerosPourPrompt(hero)}

PNJ à incarner (conserve strictement chaque "id") :
${cibleEnrichissement
  .map(
    p =>
      `- id=${p.id} | tier=${p.tier} | role=${p.profession} | bourgId=${p.burgId ?? 'aucun'} | lienHeros=${p.lienHerosNature || 'aucun'}`
  )
  .join('\n')}

Pour chacun : donne un nom crédible et non cliché, une profession précise, une apparence courte, une façon de parler/manie, une biographie brève, une motivation immédiate, un secret caché pour le MJ, et une rumeur locale réaliste.`;

    const resp = await appelerIaAvecRetry(
      ({ signal }) =>
        aiClient.models.generateContent({
          model: MODEL_FORGE,
          contents: prompt,
          config: {
            abortSignal: signal,
            thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                npcs: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      nom: { type: Type.STRING },
                      profession: { type: Type.STRING },
                      disposition: { type: Type.STRING },
                      apparence: { type: Type.STRING },
                      voixEtManies: { type: Type.STRING },
                      biographie: { type: Type.STRING },
                      motivationImmediate: { type: Type.STRING },
                      secret: { type: Type.STRING },
                      lienHerosNature: { type: Type.STRING },
                      rumeurTitre: { type: Type.STRING },
                      rumeurTexte: { type: Type.STRING },
                    },
                    required: ['id', 'nom', 'profession', 'apparence', 'voixEtManies', 'biographie', 'motivationImmediate', 'secret'],
                  },
                },
              },
              required: ['npcs'],
            },
          },
        }),
      { signal: opts.signal, timeoutMs: opts.timeoutMs }
    );

    const parsed = JSON.parse(nettoyerJson(resp.text));
    const updates = Array.isArray(parsed.npcs) ? parsed.npcs : [];
    const byId = new Map<string, any>(updates.map((u: any) => [String(u.id), u]));

    draft.pnjs = procPnjs.map(p => {
      const u = byId.get(p.id);
      if (!u) return p;
      const disp = (['AMICAL', 'NEUTRE', 'MEFIANT', 'HOSTILE'].includes(String(u.disposition))
        ? String(u.disposition)
        : p.disposition) as WorldNpcRecord['disposition'];
      const nom = String(u.nom || p.nom).slice(0, 60);
      const prof = String(u.profession || p.profession).slice(0, 80);
      const app = String(u.apparence || p.apparence).slice(0, 220);
      return {
        ...p,
        nom,
        profession: prof,
        disposition: disp,
        generationSource: 'GEMINI',
        enrichmentPending: false,
        apparence: app,
        voixEtManies: String(u.voixEtManies || p.voixEtManies).slice(0, 200),
        resumePublic: `${prof}. ${app}`.slice(0, 260),
        biographie: String(u.biographie || p.biographie).slice(0, 500),
        motivationImmediate: String(u.motivationImmediate || p.motivationImmediate).slice(0, 280),
        secret: String(u.secret || p.secret || '').slice(0, 320),
        lienHerosNature: p.estLienHeros
          ? String(u.lienHerosNature || p.lienHerosNature || '').slice(0, 240)
          : p.lienHerosNature,
        rumeurConnue: u.rumeurTitre && u.rumeurTexte
          ? {
              titre: String(u.rumeurTitre).slice(0, 80),
              texte: String(u.rumeurTexte).slice(0, 280),
            }
          : p.rumeurConnue,
      };
    });

    draft.etapeCourante = 4;
    draft.sourceParEtape = { ...draft.sourceParEtape, 4: 'GEMINI' };
    return {
      draft,
      source: 'GEMINI',
      note: 'Figures du monde, liens du héros et entourage proche incarnés par Gemini ; habitants lambda prêts à promouvoir.',
    };
  } catch (err: any) {
    if (err?.name === 'AbortError') throw err;
    draft.pnjs = procPnjs;
    draft.etapeCourante = 4;
    draft.sourceParEtape = { ...draft.sourceParEtape, 4: 'PROCEDURAL' };
    return {
      draft,
      source: 'PROCEDURAL',
      note: 'Repli procédural utilisé pour les PNJ (service IA indisponible).',
    };
  }
}

/**
 * Enrichit à la volée (via Gemini puis repli déterministe) un ou plusieurs PNJ promus
 * par proximité géographique ou scénaristique, et réconcilie le graphe d'état.
 */
export async function enrichirPnjsPromusServeur(
  aiClient: GoogleGenAI | null,
  etatSource: SimulationState,
  targetIds?: string[],
  opts: { signal?: AbortSignal; timeoutMs?: number } = {}
): Promise<{ etat: SimulationState; promotedOrEnrichedIds: string[]; source: 'GEMINI' | 'PROCEDURAL' }> {
  const etat: SimulationState = JSON.parse(JSON.stringify(etatSource));
  if (!etat.pnjsMonde || etat.pnjsMonde.length === 0) {
    return { etat, promotedOrEnrichedIds: [], source: 'PROCEDURAL' };
  }

  // 1. Si des IDs précis sont demandés (ex: promotion manuelle d'un lambda depuis la carte/Codex)
  if (Array.isArray(targetIds) && targetIds.length > 0) {
    const targetSet = new Set(targetIds);
    etat.pnjsMonde = etat.pnjsMonde.map(p =>
      targetSet.has(p.id)
        ? promouvoirPnjDeterministe(p, etat.azgaarStudio, etat.loreMonde, 'LOCAL')
        : p
    );
  }

  // 2. Réconciliation géographique & scénaristique
  const rec = reconcilierProximitePnjs(etat, 2);
  const candidates = etat.pnjsMonde.filter(
    p =>
      (Array.isArray(targetIds) && targetIds.includes(p.id)) ||
      rec.promotedIds.includes(p.id) ||
      p.enrichmentPending
  ).slice(0, 6);

  if (candidates.length === 0) {
    return { etat, promotedOrEnrichedIds: [], source: 'PROCEDURAL' };
  }

  if (!aiClient) {
    const ids = candidates.map(c => c.id);
    etat.pnjsMonde = etat.pnjsMonde.map(p =>
      ids.includes(p.id) ? { ...p, enrichmentPending: false } : p
    );
    reconcilierProximitePnjs(etat, 2);
    return { etat, promotedOrEnrichedIds: ids, source: 'PROCEDURAL' };
  }

  try {
    const prompt = `Tu enrichis des habitants locaux d'un monde D&D 5e parce que le héros ou l'intrigue vient de s'en approcher.
Monde : ${etat.azgaarStudio?.worldName || 'Marches'} | Lieu actuel du héros : ${etat.hexActuel.nom}
Héros : ${decrireHerosPourPrompt(etat.personnage)}

PNJ approchés (conserve chaque id) :
${candidates
  .map(c => {
    const burg = etat.azgaarStudio?.burgs.find(b => b.id === c.burgId)?.name || c.hexId || 'secteur';
    return `- id=${c.id} | nom=${c.nom} | profession=${c.profession} | lieu=${burg} | distance=${c.distanceHex} hex`;
  })
  .join('\n')}

Pour chaque PNJ, fournis des détails concrets, réalistes et immédiatement jouables en scène (apparence, voix/manie, biographie brève, motivation immédiate, secret local, rumeur locale).`;

    const resp = await appelerIaAvecRetry(
      ({ signal }) =>
        aiClient.models.generateContent({
          model: MODEL_FORGE,
          contents: prompt,
          config: {
            abortSignal: signal,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                npcs: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      apparence: { type: Type.STRING },
                      voixEtManies: { type: Type.STRING },
                      biographie: { type: Type.STRING },
                      motivationImmediate: { type: Type.STRING },
                      secret: { type: Type.STRING },
                      rumeurTitre: { type: Type.STRING },
                      rumeurTexte: { type: Type.STRING },
                    },
                    required: ['id', 'apparence', 'voixEtManies', 'biographie', 'motivationImmediate', 'secret'],
                  },
                },
              },
              required: ['npcs'],
            },
          },
        }),
      { signal: opts.signal, timeoutMs: opts.timeoutMs }
    );

    const parsed = JSON.parse(nettoyerJson(resp.text));
    const byId = new Map<string, any>((parsed.npcs || []).map((u: any) => [String(u.id), u]));
    const enrichedIds: string[] = [];

    etat.pnjsMonde = etat.pnjsMonde.map(p => {
      const u = byId.get(p.id);
      if (!u) {
        return candidates.some(c => c.id === p.id) ? { ...p, enrichmentPending: false } : p;
      }
      enrichedIds.push(p.id);
      const app = String(u.apparence || p.apparence).slice(0, 220);
      return {
        ...p,
        generationSource: 'GEMINI',
        enrichmentPending: false,
        apparence: app,
        voixEtManies: String(u.voixEtManies || p.voixEtManies).slice(0, 200),
        resumePublic: `${p.profession}. ${app}`.slice(0, 260),
        biographie: String(u.biographie || p.biographie).slice(0, 480),
        motivationImmediate: String(u.motivationImmediate || p.motivationImmediate).slice(0, 260),
        secret: String(u.secret || p.secret || '').slice(0, 300),
        rumeurConnue: u.rumeurTitre && u.rumeurTexte
          ? {
              titre: String(u.rumeurTitre).slice(0, 80),
              texte: String(u.rumeurTexte).slice(0, 260),
            }
          : p.rumeurConnue,
      };
    });

    reconcilierProximitePnjs(etat, 2);
    return { etat, promotedOrEnrichedIds: enrichedIds, source: 'GEMINI' };
  } catch (err: any) {
    if (err?.name === 'AbortError') throw err;
    const ids = candidates.map(c => c.id);
    etat.pnjsMonde = etat.pnjsMonde.map(p =>
      ids.includes(p.id) ? { ...p, enrichmentPending: false } : p
    );
    reconcilierProximitePnjs(etat, 2);
    return { etat, promotedOrEnrichedIds: ids, source: 'PROCEDURAL' };
  }
}
