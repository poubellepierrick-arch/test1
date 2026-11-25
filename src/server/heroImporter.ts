import { GoogleGenAI, Type } from '@google/genai';
import { Ability, HeroDocumentCategory } from '../types';
import { HeroImportInput } from '../engine/character';
import {
  AI_TIMEOUT_MS,
  AiCancelledError,
  AiTimeoutError,
  appelerIaAvecRetry,
  creerContexteAppelIa,
} from './aiTimeout';

const MODEL_IMPORT = 'gemini-4-hydrogen';

export interface ImportedFilePayload {
  name?: string;
  content?: string;
  nom?: string;
  contenu?: string;
}

export interface HeroExtractionResult {
  hero: HeroImportInput;
  sourceMode: 'json' | 'gemini' | 'heuristique';
}

function normaliserJsonDirect(obj: Record<string, any>): HeroImportInput | null {
  if (!obj || typeof obj !== 'object') return null;
  // Supporte aussi un export de SimulationState complet contenant `.personnage`
  const src = obj.personnage && typeof obj.personnage === 'object' ? obj.personnage : obj;
  if (!src.nom && !src.name && !src.classe && !src.class && !src.caracteristiques && !src.abilities && !src.stats) {
    return null;
  }

  const rawCaracs = src.caracteristiques || src.abilities || src.stats || {};
  const mapCarac = (fr: Ability, en: string[]): number | undefined => {
    for (const k of [fr, fr.toLowerCase(), ...en]) {
      const v = rawCaracs[k];
      if (typeof v === 'number' && !Number.isNaN(v)) return v;
      if (typeof v === 'string' && /^\d+$/.test(v.trim())) return Number(v.trim());
    }
    return undefined;
  };

  const docs: HeroImportInput['documents'] = Array.isArray(src.documents)
    ? src.documents.map((d: any, i: number) => ({
        titre: String(d.titre || d.title || `Document ${i + 1}`),
        categorie: (d.categorie || 'Historique') as HeroDocumentCategory,
        contenu: String(d.contenu || d.content || ''),
        actifPourMJ: d.actifPourMJ !== false,
      }))
    : [];

  return {
    nom: src.nom || src.name,
    classe: src.classe || src.class,
    race: src.race || src.species,
    historique: src.historique || src.background,
    alignement: src.alignement || src.alignment,
    traits: src.traits || src.personalityTraits,
    capacites: Array.isArray(src.capacites) ? src.capacites : Array.isArray(src.features) ? src.features : undefined,
    notesPersonnelles: src.notesPersonnelles || src.notes,
    niveau: Number(src.niveau ?? src.level) || undefined,
    pvMax: Number(src.pvMax ?? src.maxHp ?? src.hp) || undefined,
    pvActuels: Number(src.pvActuels ?? src.currentHp) || undefined,
    ca: Number(src.ca ?? src.ac) || undefined,
    vitessePieds: Number(src.vitessePieds ?? src.speed) || undefined,
    caracteristiques: {
      FOR: mapCarac('FOR', ['STR', 'str', 'strength']),
      DEX: mapCarac('DEX', ['DEX', 'dex', 'dexterity']),
      CON: mapCarac('CON', ['CON', 'con', 'constitution']),
      INT: mapCarac('INT', ['INT', 'int', 'intelligence']),
      SAG: mapCarac('SAG', ['WIS', 'wis', 'wisdom']),
      CHA: mapCarac('CHA', ['CHA', 'cha', 'charisma']),
    },
    sauvegardesMaitrisees: Array.isArray(src.sauvegardesMaitrisees) ? src.sauvegardesMaitrisees : undefined,
    competencesMaitrisees: Array.isArray(src.competencesMaitrisees)
      ? src.competencesMaitrisees
      : Array.isArray(src.skills)
      ? src.skills
      : undefined,
    monnaies: src.monnaies,
    inventaire: Array.isArray(src.inventaire)
      ? src.inventaire
      : Array.isArray(src.inventory || src.equipment)
      ? (src.inventory || src.equipment).map((e: any) =>
          typeof e === 'string'
            ? { nom: e, quantite: 1 }
            : {
                nom: e.nom || e.name || 'Objet',
                quantite: Number(e.quantite ?? e.qty) || 1,
                poidsLbs: Number(e.poidsLbs ?? e.weight) || undefined,
                valeurPO: Number(e.valeurPO ?? e.value) || undefined,
                estEquipe: Boolean(e.estEquipe ?? e.equipped),
                degats: e.degats || e.damage,
                caBase: e.caBase ?? e.ac,
                categorie: e.categorie || e.category,
              }
        )
      : undefined,
    sortsNoms: Array.isArray(src.sortsNoms)
      ? src.sortsNoms
      : Array.isArray(src.sortsConnus)
      ? src.sortsConnus.map((s: any) => (typeof s === 'string' ? s : s.nom))
      : Array.isArray(src.spells)
      ? src.spells.map((s: any) => (typeof s === 'string' ? s : s.nom || s.name))
      : undefined,
    emplacementsSorts: Array.isArray(src.emplacementsSorts) ? src.emplacementsSorts : undefined,
    documents: docs && docs.length > 0 ? docs : undefined,
  };
}

function normaliserFichiers(files: ImportedFilePayload[]): Array<{ name: string; content: string }> {
  return (files || []).map((f, i) => ({
    name: String(f?.name || f?.nom || `document_${i + 1}.txt`),
    content: String(f?.content ?? f?.contenu ?? ''),
  }));
}

function extraireHeuristique(rawText: string, rawFiles: ImportedFilePayload[]): HeroImportInput {
  const files = normaliserFichiers(rawFiles);
  const combined = [
    rawText,
    ...files.map(f => `--- FICHIER: ${f.name} ---\n${f.content}`),
  ]
    .filter(Boolean)
    .join('\n\n');

  const matchChamp = (regex: RegExp): string | undefined => {
    const m = combined.match(regex);
    return m?.[1]?.trim();
  };

  const nom = matchChamp(/(?:^|\n)[ \t]*(?:#[ \t]*|Nom[ \t]*[:=][ \t]*|Name[ \t]*[:=][ \t]*)([A-ZÀ-ÖØ-Þa-zà-öø-ÿ'’\- \t]{2,45})/i);
  const race = matchChamp(/(?:^|\n)\s*(?:Race|Espèce|Species)\s*[:=]\s*([^\n,|]{2,40})/i);
  const classe = matchChamp(/(?:^|\n)\s*(?:Classe|Class)\s*[:=]\s*([^\n,|]{2,45})/i);
  const historique = matchChamp(/(?:^|\n)\s*(?:Historique|Background)\s*[:=]\s*([^\n,|]{2,45})/i);
  const nivStr = matchChamp(/(?:Niveau|Niv\.?|Level)\s*[:=]?\s*(\d{1,2})/i);
  const pvStr = matchChamp(/(?:PV(?:\s*max)?|Points de vie|HP)\s*[:=]?\s*(?:\d+\s*\/\s*)?(\d{1,3})/i);
  const caStr = matchChamp(/(?:^|\n|\s)(?:CA|AC|Classe d'armure)\s*[:=]?\s*(\d{1,2})/i);

  const lireCarac = (labels: string[]): number | undefined => {
    for (const lbl of labels) {
      const m = combined.match(new RegExp(`\\b${lbl}\\b\\s*[:=]?\\s*(\\d{1,2})`, 'i'));
      if (m) return Number(m[1]);
    }
    return undefined;
  };

  const docs: NonNullable<HeroImportInput['documents']> = [];
  for (const f of files) {
    if (f.content.trim()) {
      const n = f.name.toLowerCase();
      const cat: HeroDocumentCategory = n.includes('lore') || n.includes('monde')
        ? 'Lore'
        : n.includes('capac') || n.includes('don')
        ? 'Capacités'
        : n.includes('note')
        ? 'Notes'
        : n.includes('autre')
        ? 'Autre'
        : 'Historique';
      docs.push({
        titre: f.name.replace(/\.(txt|md|json)$/i, ''),
        categorie: cat,
        contenu: f.content.trim().slice(0, 12000),
        actifPourMJ: true,
      });
    }
  }
  if (rawText.trim() && docs.length === 0) {
    docs.push({
      titre: 'Dossier d\'origine du héros',
      categorie: 'Historique',
      contenu: rawText.trim().slice(0, 12000),
      actifPourMJ: true,
    });
  }

  return {
    nom: nom || undefined,
    race: race || undefined,
    classe: classe || undefined,
    historique: historique || undefined,
    niveau: nivStr ? Number(nivStr) : undefined,
    pvMax: pvStr ? Number(pvStr) : undefined,
    ca: caStr ? Number(caStr) : undefined,
    caracteristiques: {
      FOR: lireCarac(['FOR', 'STR', 'Force']),
      DEX: lireCarac(['DEX', 'Dextérité']),
      CON: lireCarac(['CON', 'Constitution']),
      INT: lireCarac(['INT', 'Intelligence']),
      SAG: lireCarac(['SAG', 'WIS', 'Sagesse']),
      CHA: lireCarac(['CHA', 'Charisme']),
    },
    documents: docs,
  };
}

export async function extraireHerosEtDocuments(
  aiClient: GoogleGenAI | null,
  rawText: string,
  rawFiles: ImportedFilePayload[] = [],
  options?: { signal?: AbortSignal; timeoutMs?: number }
): Promise<HeroExtractionResult> {
  const files = normaliserFichiers(rawFiles);
  const trimmed = (rawText || '').trim();

  // 1. Tentative JSON directe si texte ou unique fichier JSON valide
  const candidatJson =
    trimmed.startsWith('{')
      ? trimmed
      : files.length === 1 && files[0].content.trim().startsWith('{')
      ? files[0].content.trim()
      : null;

  if (candidatJson) {
    try {
      const parsed = JSON.parse(candidatJson);
      const norm = normaliserJsonDirect(parsed);
      if (norm) {
        // Ajouter les éventuels fichiers texte supplémentaires comme documents
        const extraDocs: NonNullable<HeroImportInput['documents']> = [...(norm.documents || [])];
        for (const f of files) {
          if (f.content.trim() !== candidatJson && f.content.trim()) {
            extraDocs.push({
              titre: f.name.replace(/\.(txt|md|json)$/i, ''),
              categorie: 'Historique',
              contenu: f.content.trim().slice(0, 12000),
              actifPourMJ: true,
            });
          }
        }
        return {
          hero: { ...norm, documents: extraDocs.length > 0 ? extraDocs : norm.documents },
          sourceMode: 'json',
        };
      }
    } catch {
      // Continuer vers Gemini ou heuristique
    }
  }

  const dossierComplet = [
    trimmed ? `=== TEXTE COLLÉ ===\n${trimmed}` : '',
    ...files.map(f => `=== FICHIER : ${f.name} ===\n${f.content.trim()}`),
  ]
    .filter(Boolean)
    .join('\n\n')
    .slice(0, 35000);

  if (!dossierComplet) {
    throw new Error('Aucun texte ni fichier fourni pour l\'importation.');
  }

  // 2. Extraction structurée via Gemini 4 Hydrogen si disponible
  if (aiClient) {
    const aiCtx = creerContexteAppelIa(options?.signal, options?.timeoutMs ?? AI_TIMEOUT_MS);
    try {
      const response = await appelerIaAvecRetry(
        ({ signal }) =>
          aiClient.models.generateContent({
            model: MODEL_IMPORT,
            contents: `Extrais la fiche D&D 5e et tous les documents narratifs/notes de ce dossier de personnage. Conserve fidèlement les documents annexes (historique, lore, serments, notes, capacités détaillées) dans "documents" afin qu'ils soient consultables en jeu et transmis au MJ.\n\n${dossierComplet}`,
            config: {
              abortSignal: signal,
              systemInstruction:
                'Tu es un extracteur strict de fiches D&D 5e en français. Tu ne dois rien inventer : extrais uniquement ce qui figure dans le dossier (ou laisse vide/omets si absent) et classe fidèlement les textes narratifs en documents.',
              responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              nom: { type: Type.STRING },
              classe: { type: Type.STRING },
              race: { type: Type.STRING },
              historique: { type: Type.STRING },
              alignement: { type: Type.STRING },
              traits: { type: Type.STRING },
              capacites: { type: Type.ARRAY, items: { type: Type.STRING } },
              notesPersonnelles: { type: Type.STRING },
              niveau: { type: Type.NUMBER },
              pvMax: { type: Type.NUMBER },
              ca: { type: Type.NUMBER },
              vitessePieds: { type: Type.NUMBER },
              caracteristiques: {
                type: Type.OBJECT,
                properties: {
                  FOR: { type: Type.NUMBER },
                  DEX: { type: Type.NUMBER },
                  CON: { type: Type.NUMBER },
                  INT: { type: Type.NUMBER },
                  SAG: { type: Type.NUMBER },
                  CHA: { type: Type.NUMBER },
                },
              },
              sauvegardesMaitrisees: { type: Type.ARRAY, items: { type: Type.STRING } },
              competencesMaitrisees: { type: Type.ARRAY, items: { type: Type.STRING } },
              monnaies: {
                type: Type.OBJECT,
                properties: {
                  po: { type: Type.NUMBER },
                  pa: { type: Type.NUMBER },
                  pc: { type: Type.NUMBER },
                },
              },
              inventaire: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    nom: { type: Type.STRING },
                    quantite: { type: Type.NUMBER },
                    estEquipe: { type: Type.BOOLEAN },
                    degats: { type: Type.STRING },
                    caBase: { type: Type.NUMBER },
                    categorie: { type: Type.STRING },
                  },
                  required: ['nom'],
                },
              },
              sortsNoms: { type: Type.ARRAY, items: { type: Type.STRING } },
              documents: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    titre: { type: Type.STRING },
                    categorie: { type: Type.STRING },
                    contenu: { type: Type.STRING },
                  },
                  required: ['titre', 'contenu'],
                },
              },
            },
          },
        },
          }),
        { signal: aiCtx.signal, deadlineMs: aiCtx.deadlineMs, timeoutMs: aiCtx.timeoutMs }
      );

      const txt = response.text;
      if (txt) {
        const parsed = JSON.parse(txt) as HeroImportInput;
        return {
          hero: {
            ...parsed,
            documents: parsed.documents?.map(d => ({
              ...d,
              categorie: (['Historique', 'Lore', 'Notes', 'Capacités', 'Autre'].includes(String(d.categorie))
                ? d.categorie
                : 'Historique') as HeroDocumentCategory,
              actifPourMJ: true,
            })),
          },
          sourceMode: 'gemini',
        };
      }
    } catch (err) {
      if (aiCtx.estAnnuleParClient() || err instanceof AiCancelledError || (err as any)?.name === 'AbortError') {
        throw new AiCancelledError('Analyse annulée par le joueur.');
      }
      if (aiCtx.estExpire() || err instanceof AiTimeoutError) {
        throw new AiTimeoutError('L\'analyse IA de la fiche a dépassé le délai maximal de 15 minutes.');
      }
      console.warn('Extraction Gemini héros en échec, bascule heuristique:', err);
    } finally {
      aiCtx.cleanup();
    }
  }

  // 3. Repli déterministe / heuristique
  return {
    hero: extraireHeuristique(rawText, files),
    sourceMode: 'heuristique',
  };
}
