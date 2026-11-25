import { GoogleGenAI } from '@google/genai';
import { parserSegmentsRecit } from '../utils/journalFormatting';
import { sanitizeSvgMarkup } from './itemIllustrations';
import {
  AI_TIMEOUT_MS,
  AiCancelledError,
  AiTimeoutError,
  appelerIaAvecRetry,
  creerContexteAppelIa,
} from './aiTimeout';

export interface SceneTtsRequest {
  titre: string;
  texte: string;
  ton?: 'CHAMPETRE' | 'SOMBRE' | 'PERIL' | 'NEUTRE';
  sceneKey?: string;
}

export interface SceneTtsResult {
  audioDataUrl: string;
  mode: 'single' | 'multi';
  speakers: string[];
  source: 'cache' | 'gemini';
}

export interface SceneIllustrationRequest {
  sceneKey: string;
  titre: string;
  texte: string;
  terrain?: string;
  biomeAzgaar?: string;
  meteo?: string;
  heure?: number;
  ton?: 'CHAMPETRE' | 'SOMBRE' | 'PERIL' | 'NEUTRE';
  lieuNom?: string;
  enCombat?: boolean;
  enDonjon?: boolean;
}

export interface SceneIllustrationResult {
  svg: string;
  source: 'cache' | 'gemini' | 'fallback';
}

const audioCache = new Map<string, SceneTtsResult>();
const illustrationCache = new Map<string, string>();
const MAX_AUDIO_CACHE = 40;
const MAX_ILLUST_CACHE = 60;

function setBoundedCache<T>(map: Map<string, T>, key: string, value: T, max: number) {
  if (map.has(key)) map.delete(key);
  map.set(key, value);
  while (map.size > max) {
    const firstKey = map.keys().next().value;
    if (firstKey === undefined) break;
    map.delete(firstKey);
  }
}

function hashSimple(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function choisirStyleNarration(ton?: string): string {
  switch (ton) {
    case 'PERIL':
      return 'Grave, tendu, rythme sec et urgent, conteur de jeu de rôle en français';
    case 'SOMBRE':
      return 'Feutré, sombre, posé et inquiétant, conteur de jeu de rôle en français';
    case 'CHAMPETRE':
      return 'Chaleureux, calme et terre-à-terre, conteur de jeu de rôle en français';
    default:
      return 'Sobre, net et immersif, conteur de jeu de rôle en français';
  }
}

function choisirVoixInterlocuteur(nom: string): 'Kore' | 'Fenrir' | 'Puck' | 'Zephyr' {
  const clean = nom.toLowerCase();
  if (/(elia|elena|lyra|sylv|dame|mere|soeur|pretr|gueri|marchande)/.test(clean)) {
    return 'Kore';
  }
  if (/(torvin|morn|capitaine|forgeron|garde|orc|bandit|nain|veteran|seigneur)/.test(clean)) {
    return 'Fenrir';
  }
  const voices: Array<'Kore' | 'Fenrir' | 'Puck' | 'Zephyr'> = ['Fenrir', 'Kore', 'Puck', 'Zephyr'];
  return voices[hashSimple(clean) % voices.length];
}

export async function genererAudioScene(
  aiClient: GoogleGenAI | null,
  req: SceneTtsRequest,
  options?: { signal?: AbortSignal; timeoutMs?: number }
): Promise<SceneTtsResult> {
  if (!aiClient) {
    throw new Error('Clé Gemini absente côté serveur : lecture vocale indisponible.');
  }
  const textePropre = String(req.texte || '').trim();
  if (!textePropre) {
    throw new Error('Aucun texte à lire.');
  }

  const cacheKey = `${req.sceneKey || ''}::${req.ton || 'NEUTRE'}::${hashSimple(`${req.titre}\n${textePropre}`)}`;
  const cached = audioCache.get(cacheKey);
  if (cached) {
    return { ...cached, source: 'cache' };
  }

  const segments = parserSegmentsRecit(textePropre);
  const dialogues = segments.filter(
    (s): s is Extract<typeof s, { type: 'dialogue' }> => s.type === 'dialogue'
  );

  const aiCtx = creerContexteAppelIa(options?.signal, options?.timeoutMs ?? AI_TIMEOUT_MS);

  try {
    if (dialogues.length > 0) {
      const guestSpeaker = dialogues.find(d => d.locuteur)?.locuteur || 'Interlocuteur';
      const guestVoice = choisirVoixInterlocuteur(guestSpeaker);
      const styleNarration = choisirStyleNarration(req.ton);
      const styleGuest =
        req.ton === 'PERIL'
          ? 'Dialogue vif et tendu, prononciation française naturelle'
          : 'Dialogue incarné et réaliste, prononciation française naturelle';

      const parts: Array<{
        text: string;
        speechMetadata: { speaker: string; style: string };
      }> = [];

      for (const seg of segments) {
        if (seg.type === 'prose') {
          parts.push({
            text: `MJ: ${seg.texte}`,
            speechMetadata: { speaker: 'MJ', style: styleNarration },
          });
        } else {
          const label = seg.locuteur && seg.locuteur !== guestSpeaker ? `${seg.locuteur} dit — ` : '';
          parts.push({
            text: `${guestSpeaker}: ${label}${seg.replique}`,
            speechMetadata: { speaker: guestSpeaker, style: styleGuest },
          });
        }
      }

      const response = await appelerIaAvecRetry(
        ({ signal }) =>
          aiClient.models.generateContent({
            model: 'gemini-3.8-flash-tts',
            contents: [{ role: 'user', parts }],
            config: {
              abortSignal: signal,
              responseModalities: ['AUDIO'],
              speechConfig: {
                multiSpeakerVoiceConfig: {
                  speakerVoiceConfigs: [
                    {
                      speaker: 'MJ',
                      voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Charon' } },
                    },
                    {
                      speaker: guestSpeaker,
                      voiceConfig: { prebuiltVoiceConfig: { voiceName: guestVoice } },
                    },
                  ],
                },
              },
            },
          }),
        { signal: aiCtx.signal, deadlineMs: aiCtx.deadlineMs, timeoutMs: aiCtx.timeoutMs }
      );

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) {
        throw new Error('Flux audio vide retourné par Gemini TTS.');
      }

      const result: SceneTtsResult = {
        audioDataUrl: `data:audio/wav;base64,${base64Audio}`,
        mode: 'multi',
        speakers: ['MJ', guestSpeaker],
        source: 'gemini',
      };
      setBoundedCache(audioCache, cacheKey, result, MAX_AUDIO_CACHE);
      return result;
    }

    // Narration simple avec gemini-3.8-flash-lite-tts
    const fullText = req.titre ? `${req.titre}. ${textePropre}` : textePropre;
    const response = await appelerIaAvecRetry(
      ({ signal }) =>
        aiClient.models.generateContent({
          model: 'gemini-3.8-flash-lite-tts',
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: fullText,
                  speechMetadata: {
                    style: choisirStyleNarration(req.ton),
                  },
                },
              ],
            },
          ],
          config: {
            abortSignal: signal,
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: 'Charon' },
              },
            },
          },
        }),
      { signal: aiCtx.signal, deadlineMs: aiCtx.deadlineMs, timeoutMs: aiCtx.timeoutMs }
    );

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      throw new Error('Flux audio vide retourné par Gemini TTS.');
    }

    const result: SceneTtsResult = {
      audioDataUrl: `data:audio/wav;base64,${base64Audio}`,
      mode: 'single',
      speakers: ['MJ'],
      source: 'gemini',
    };
    setBoundedCache(audioCache, cacheKey, result, MAX_AUDIO_CACHE);
    return result;
  } catch (err: any) {
    if (aiCtx.estAnnuleParClient() || err instanceof AiCancelledError || err?.name === 'AbortError') {
      throw new AiCancelledError('Génération audio annulée par le joueur.');
    }
    if (aiCtx.estExpire() || err instanceof AiTimeoutError) {
      throw new AiTimeoutError('La lecture vocale IA a dépassé le délai maximal de 15 minutes.');
    }
    throw err;
  } finally {
    aiCtx.cleanup();
  }
}

export function renderFallbackSceneSvg(req: SceneIllustrationRequest): string {
  const heure = typeof req.heure === 'number' ? req.heure : 12;
  const estNuit = heure < 6 || heure >= 20;
  const estCrepuscule = (heure >= 6 && heure < 8) || (heure >= 18 && heure < 20);
  const terrainLow = `${req.terrain || ''} ${req.biomeAzgaar || ''}`.toLowerCase();
  const meteoLow = (req.meteo || '').toLowerCase();

  let skyTop = '#8da9c4';
  let skyBot = '#f2e0bd';
  if (req.enDonjon) {
    skyTop = '#181311';
    skyBot = '#30241c';
  } else if (req.ton === 'PERIL') {
    skyTop = '#3a1b19';
    skyBot = '#a84b36';
  } else if (estNuit) {
    skyTop = '#111827';
    skyBot = '#283650';
  } else if (estCrepuscule) {
    skyTop = '#4b3b5a';
    skyBot = '#d68c58';
  } else if (req.ton === 'SOMBRE' || meteoLow.includes('brume') || meteoLow.includes('pluie')) {
    skyTop = '#4b5563';
    skyBot = '#a8a29e';
  }

  let landscapeMarkup = '';
  if (req.enDonjon) {
    landscapeMarkup = `
      <path d="M0,360 L0,70 Q160,15 320,45 Q480,15 640,70 L640,360 Z" fill="#231a14"/>
      <path d="M70,360 L70,120 Q320,45 570,120 L570,360 Z" fill="#17110d" stroke="#533d29" stroke-width="2"/>
      <ellipse cx="145" cy="170" rx="45" ry="52" fill="#f59e0b" fill-opacity="0.16"/>
      <path d="M145,154 C153,164 152,178 145,182 C138,178 137,164 145,154 Z" fill="#f59e0b"/>
      <ellipse cx="495" cy="170" rx="45" ry="52" fill="#f59e0b" fill-opacity="0.16"/>
      <path d="M495,154 C503,164 502,178 495,182 C488,178 487,164 495,154 Z" fill="#f59e0b"/>
      <path d="M235,360 L265,245 L375,245 L405,360 Z" fill="#2c221b" stroke="#473628" stroke-width="1.5"/>
    `;
  } else if (terrainLow.includes('mont')) {
    landscapeMarkup = `
      <polygon points="-20,310 140,125 290,260 440,105 660,310" fill="#524a44" opacity="0.85"/>
      <polygon points="140,125 182,172 152,168 124,182" fill="#efe6d5" opacity="0.85"/>
      <polygon points="440,105 495,165 456,158 418,172" fill="#efe6d5" opacity="0.85"/>
      <path d="M0,295 Q190,265 360,295 T640,285 L640,360 L0,360 Z" fill="#3a3228"/>
    `;
  } else if (terrainLow.includes('foret') || terrainLow.includes('taiga')) {
    const pines = [40, 95, 155, 225, 290, 365, 430, 510, 580]
      .map((x, idx) => {
        const h = 85 + (idx % 3) * 24;
        const y = 290 - h;
        return `<polygon points="${x},${y} ${x - 24},295 ${x + 24},295" fill="${idx % 2 === 0 ? '#243827' : '#2f4931'}"/>`;
      })
      .join('');
    landscapeMarkup = `
      <path d="M0,255 Q210,220 420,248 T640,235 L640,360 L0,360 Z" fill="#465944" opacity="0.6"/>
      ${pines}
      <path d="M0,292 Q320,275 640,295 L640,360 L0,360 Z" fill="#2d261d"/>
    `;
  } else if (terrainLow.includes('marais')) {
    landscapeMarkup = `
      <path d="M0,255 Q180,242 360,255 T640,248 L640,360 L0,360 Z" fill="#3f4a3c"/>
      <ellipse cx="320" cy="312" rx="280" ry="32" fill="#4e615c" opacity="0.72"/>
      <path d="M75,320 L75,230 M86,322 L92,238 M520,318 L520,224 M534,322 L542,240" stroke="#283022" stroke-width="3"/>
    `;
  } else if (terrainLow.includes('desert')) {
    landscapeMarkup = `
      <path d="M0,245 Q170,210 350,245 T640,230 L640,360 L0,360 Z" fill="#c69c5d"/>
      <path d="M0,290 Q240,255 460,295 T640,285 L640,360 L0,360 Z" fill="#a87d44"/>
    `;
  } else {
    landscapeMarkup = `
      <path d="M0,255 Q180,225 380,252 T640,240 L640,360 L0,360 Z" fill="#6b7454" opacity="0.8"/>
      <rect x="250" y="218" width="54" height="44" fill="#5b432b" stroke="#2d2015" stroke-width="1.5"/>
      <polygon points="242,218 277,192 312,218" fill="#7c3e26" stroke="#2d2015" stroke-width="1.5"/>
      <rect x="318" y="198" width="28" height="64" fill="#6b5846" stroke="#2d2015" stroke-width="1.5"/>
      <polygon points="313,198 332,175 351,198" fill="#4a3728"/>
      <path d="M0,285 Q240,275 380,305 T640,295 L640,360 L0,360 Z" fill="#4c432d"/>
    `;
  }

  const weatherOverlay = meteoLow.includes('pluie')
    ? `<g stroke="#dbeafe" stroke-width="1.2" opacity="0.35">
        <line x1="80" y1="30" x2="60" y2="110"/><line x1="180" y1="50" x2="160" y2="130"/>
        <line x1="300" y1="20" x2="280" y2="100"/><line x1="440" y1="45" x2="420" y2="125"/>
        <line x1="560" y1="25" x2="540" y2="105"/>
      </g>`
    : meteoLow.includes('brume')
    ? `<rect x="0" y="210" width="640" height="90" fill="#e5e7eb" opacity="0.24"/>`
    : estNuit && !req.enDonjon
    ? `<circle cx="515" cy="74" r="18" fill="#fef3c7" opacity="0.85"/>`
    : !req.enDonjon
    ? `<circle cx="515" cy="78" r="24" fill="#fde68a" opacity="0.72"/>`
    : '';

  const combatAccent = req.enCombat
    ? `<g transform="translate(320,185)" opacity="0.75">
        <line x1="-55" y1="40" x2="45" y2="-45" stroke="#e2e8f0" stroke-width="4" stroke-linecap="round"/>
        <line x1="55" y1="40" x2="-45" y2="-45" stroke="#e2e8f0" stroke-width="4" stroke-linecap="round"/>
        <circle cx="0" cy="-2" r="10" fill="#ef4444" fill-opacity="0.55"/>
      </g>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360" width="640" height="360">
  <defs>
    <linearGradient id="sceneSky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${skyTop}"/>
      <stop offset="100%" stop-color="${skyBot}"/>
    </linearGradient>
    <radialGradient id="parchmentVignette" cx="50%" cy="50%" r="72%">
      <stop offset="65%" stop-color="#000000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#1c120a" stop-opacity="0.38"/>
    </radialGradient>
  </defs>
  <rect width="640" height="360" fill="url(#sceneSky)"/>
  ${weatherOverlay}
  ${landscapeMarkup}
  ${combatAccent}
  <rect width="640" height="360" fill="url(#parchmentVignette)"/>
  <rect x="8" y="8" width="624" height="344" fill="none" stroke="#c8a86b" stroke-width="2" opacity="0.85"/>
  <rect x="14" y="14" width="612" height="332" fill="none" stroke="#e7d3a3" stroke-width="0.8" opacity="0.6"/>
</svg>`;
}

export async function genererIllustrationScene(
  aiClient: GoogleGenAI | null,
  req: SceneIllustrationRequest,
  options?: { signal?: AbortSignal; timeoutMs?: number }
): Promise<SceneIllustrationResult> {
  const key = req.sceneKey || `${hashSimple(`${req.titre}::${req.texte}`)}`;
  const cached = illustrationCache.get(key);
  if (cached) {
    return { svg: cached, source: 'cache' };
  }

  if (aiClient) {
    const aiCtx = creerContexteAppelIa(options?.signal, options?.timeoutMs ?? AI_TIMEOUT_MS);
    try {
      const prompt = [
        'Tu es illustrateur des manuels officiels Donjons & Dragons 5e (gravure et aquarelle sur parchemin).',
        'Génère UNIQUEMENT un code SVG autonome et propre (<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360" width="640" height="360">...</svg>) illustrant fidèlement cette scène en format panoramique 16:9.',
        `Titre : ${req.titre}`,
        `Lieu : ${req.lieuNom || 'Secteur'} (${req.biomeAzgaar || req.terrain || 'Plaine'})`,
        `Heure : ${req.heure ?? 12}h | Météo : ${req.meteo || 'Ciel dégagé'} | Ambiance : ${req.ton || 'NEUTRE'}`,
        req.enDonjon ? 'Contexte : Intérieur de donjon / galerie souterraine.' : '',
        req.enCombat ? 'Contexte : Affrontement actif / tension martiale.' : '',
        `Extrait scène : ${req.texte.slice(0, 420)}`,
        'Contraintes strictes :',
        '- AUCUNE balise <text> dans le SVG : uniquement de l\'illustration (reliefs, ombres, silhouettes, bâtiments, lumière, dégradés SVG).',
        '- Bordure parchemin dorée fine autour du cadre 640x360.',
        '- Aucun <script>, aucun attribut on*, aucun lien externe.',
        '- Réponds uniquement par <svg ...>...</svg>.',
      ]
        .filter(Boolean)
        .join('\n');

      const response = await appelerIaAvecRetry(
        ({ signal }) =>
          aiClient.models.generateContent({
            model: 'gemini-4-hydrogen',
            contents: prompt,
            config: { abortSignal: signal },
          }),
        { signal: aiCtx.signal, deadlineMs: aiCtx.deadlineMs, timeoutMs: aiCtx.timeoutMs }
      );

      const raw = response.text || '';
      let sanitized = sanitizeSvgMarkup(raw);
      if (sanitized) {
        if (!/viewBox="0 0 640 360"/i.test(sanitized)) {
          sanitized = sanitized.replace(/viewBox="[^"]*"/i, 'viewBox="0 0 640 360"');
        }
        setBoundedCache(illustrationCache, key, sanitized, MAX_ILLUST_CACHE);
        return { svg: sanitized, source: 'gemini' };
      }
    } catch (err: any) {
      if (aiCtx.estAnnuleParClient() || err instanceof AiCancelledError || err?.name === 'AbortError') {
        throw new AiCancelledError('Illustration annulée par le joueur.');
      }
      if (aiCtx.estExpire() || err instanceof AiTimeoutError) {
        throw new AiTimeoutError('L\'illustration de scène IA a dépassé le délai maximal de 15 minutes.');
      }
      console.warn('Illustration scène IA repli vers gravure locale:', err);
    } finally {
      aiCtx.cleanup();
    }
  }

  const fallback = renderFallbackSceneSvg(req);
  setBoundedCache(illustrationCache, key, fallback, MAX_ILLUST_CACHE);
  return { svg: fallback, source: 'fallback' };
}
