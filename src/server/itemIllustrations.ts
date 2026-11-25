import fs from 'node:fs';
import path from 'node:path';
import { GoogleGenAI } from '@google/genai';
import {
  AI_TIMEOUT_MS,
  AiCancelledError,
  AiTimeoutError,
  appelerIaAvecRetry,
  creerContexteAppelIa,
} from './aiTimeout';

export interface ItemIllustrationRequest {
  itemId: string;
  nom: string;
  nomEn?: string;
  sousCategorie?: string;
  rarete?: string;
  effet?: string;
  degats?: string;
  caBase?: number;
}

export interface ItemIllustrationResult {
  itemId: string;
  svg: string;
  source: 'cache' | 'gemini' | 'fallback';
}

const CACHE_PATH = path.resolve(process.cwd(), 'src/server/item_illustrations_cache.json');
let memoryCache: Record<string, string> | null = null;

function normalizeKey(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
}

function loadCache(): Record<string, string> {
  if (memoryCache) return memoryCache;
  try {
    if (fs.existsSync(CACHE_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf-8'));
      if (parsed && typeof parsed === 'object') {
        const data = parsed as Record<string, string>;
        memoryCache = data;
        return data;
      }
    }
  } catch {
    // Cache absent ou illisible : repartir proprement
  }
  memoryCache = {};
  return memoryCache;
}

function saveCache(cache: Record<string, string>) {
  memoryCache = cache;
  try {
    fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Impossible d\'écrire le cache d\'illustrations:', err);
  }
}

export function sanitizeSvgMarkup(raw: string): string | null {
  const match = raw.match(/<svg[\s\S]*?<\/svg>/i);
  if (!match) return null;
  let svg = match[0];

  // Supprimer toute balise ou attribut potentiellement dangereux
  svg = svg
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/https?:\/\/[^\s"'<>)]+/gi, '');

  // S'assurer que viewBox existe pour un cadrage homogène
  if (!/viewBox=/i.test(svg)) {
    svg = svg.replace(/<svg/i, '<svg viewBox="0 0 320 200"');
  }
  if (svg.length < 120 || !/<(path|rect|circle|ellipse|polygon|polyline|line)/i.test(svg)) {
    return null;
  }
  return svg;
}

function detectPlateFamily(req: ItemIllustrationRequest): string {
  const s = normalizeKey(`${req.itemId}_${req.nom}_${req.nomEn || ''}_${req.sousCategorie || ''}`);
  if (s.includes('potion') || s.includes('antipoison') || s.includes('antitoxin')) return 'potion';
  if (s.includes('bandage') || s.includes('cataplasme') || s.includes('trousse') || s.includes('healer')) return 'soin';
  if (s.includes('lanterne') || s.includes('lantern')) return 'lanterne';
  if (s.includes('torche') || s.includes('torch') || s.includes('amadou') || s.includes('huile')) return 'torche';
  if (s.includes('arc') || s.includes('bow') || s.includes('arbalete') || s.includes('crossbow') || s.includes('fleche') || s.includes('carreau')) return 'arc';
  if (s.includes('hache') || s.includes('axe')) return 'hache';
  if (s.includes('masse') || s.includes('mace') || s.includes('marteau') || s.includes('hammer') || s.includes('gourdin') || s.includes('morgenstern')) return 'masse';
  if (s.includes('bouclier') || s.includes('shield')) return 'bouclier';
  if (s.includes('armure') || s.includes('armor') || s.includes('mailles') || s.includes('cuirasse') || s.includes('harnois') || s.includes('plate') || s.includes('cape')) return 'armure';
  if (s.includes('epee') || s.includes('sword') || s.includes('dague') || s.includes('dagger') || s.includes('rapiere') || s.includes('cimeterre') || s.includes('lance') || s.includes('javeline')) return 'epee';
  if (s.includes('grimoire') || s.includes('spellbook')) return 'grimoire';
  if (s.includes('baguette') || s.includes('wand') || s.includes('baton') || s.includes('staff')) return 'baguette';
  if (s.includes('anneau') || s.includes('ring')) return 'anneau';
  if (s.includes('ration') || s.includes('eau') || s.includes('outre') || s.includes('water')) return 'vivres';
  if (s.includes('corde') || s.includes('rope') || s.includes('grappin')) return 'corde';
  if (s.includes('tente') || s.includes('couchage') || s.includes('sac')) return 'sac';
  if (s.includes('bottes') || s.includes('boots') || s.includes('gantelet')) return 'equipement';
  if (s.includes('mulet') || s.includes('cheval') || s.includes('horse') || s.includes('mule')) return 'monture';
  return 'outil';
}

export function renderFallbackPlateSvg(req: ItemIllustrationRequest): string {
  const family = detectPlateFamily(req);

  const motifs: Record<string, string> = {
    epee: `
      <g transform="translate(160,100) rotate(-32)">
        <rect x="-7" y="-76" width="14" height="106" rx="3" fill="url(#steelGrad)" stroke="#2b1e14" stroke-width="2"/>
        <line x1="0" y1="-68" x2="0" y2="20" stroke="#4b3a2b" stroke-width="1.5" opacity="0.55"/>
        <polygon points="-7,-76 0,-94 7,-76" fill="url(#steelGrad)" stroke="#2b1e14" stroke-width="2"/>
        <path d="M-28,28 Q0,22 28,28 L24,35 Q0,31 -24,35 Z" fill="url(#brassGrad)" stroke="#2b1e14" stroke-width="2"/>
        <rect x="-5" y="34" width="10" height="26" rx="2" fill="url(#leatherGrad)" stroke="#2b1e14" stroke-width="2"/>
        <circle cx="0" cy="65" r="8" fill="url(#brassGrad)" stroke="#2b1e14" stroke-width="2"/>
      </g>`,
    hache: `
      <g transform="translate(160,104) rotate(-25)">
        <rect x="-5" y="-76" width="10" height="148" rx="4" fill="url(#woodGrad)" stroke="#2b1e14" stroke-width="2"/>
        <path d="M4,-62 C36,-70 50,-42 48,-16 C38,-22 20,-24 4,-30 Z" fill="url(#steelGrad)" stroke="#2b1e14" stroke-width="2"/>
        <path d="M-4,-58 C-26,-62 -34,-40 -30,-24 C-20,-28 -10,-30 -4,-34 Z" fill="url(#steelGrad)" stroke="#2b1e14" stroke-width="1.8"/>
        <rect x="-7" y="-54" width="14" height="22" rx="2" fill="url(#brassGrad)" stroke="#2b1e14" stroke-width="1.8"/>
      </g>`,
    masse: `
      <g transform="translate(160,104) rotate(-28)">
        <rect x="-5" y="-44" width="10" height="114" rx="3" fill="url(#woodGrad)" stroke="#2b1e14" stroke-width="2"/>
        <polygon points="-18,-74 18,-74 24,-46 -24,-46" fill="url(#steelGrad)" stroke="#2b1e14" stroke-width="2"/>
        <line x1="0" y1="-82" x2="0" y2="-44" stroke="#2b1e14" stroke-width="3"/>
        <circle cx="0" cy="-78" r="5" fill="url(#brassGrad)" stroke="#2b1e14" stroke-width="1.5"/>
      </g>`,
    arc: `
      <g transform="translate(155,100)">
        <path d="M-24,-68 C32,-54 44,-18 44,0 C44,18 32,54 -24,68" fill="none" stroke="url(#woodGrad)" stroke-width="8" stroke-linecap="round"/>
        <path d="M-24,-68 C32,-54 44,-18 44,0 C44,18 32,54 -24,68" fill="none" stroke="#2b1e14" stroke-width="2"/>
        <line x1="-24" y1="-68" x2="-24" y2="68" stroke="#6c563f" stroke-width="1.5" stroke-dasharray="3 2"/>
        <line x1="-46" y1="0" x2="62" y2="0" stroke="#3c2a1b" stroke-width="2.5"/>
        <polygon points="62,-5 74,0 62,5" fill="url(#steelGrad)" stroke="#2b1e14" stroke-width="1.5"/>
        <polygon points="-46,-5 -36,0 -46,5 -54,0" fill="#a23b2a" stroke="#2b1e14" stroke-width="1.2"/>
      </g>`,
    bouclier: `
      <g transform="translate(160,100)">
        <path d="M-46,-54 L46,-54 L46,6 C46,42 18,62 0,72 C-18,62 -46,42 -46,6 Z" fill="url(#woodGrad)" stroke="#2b1e14" stroke-width="3"/>
        <path d="M-38,-46 L38,-46 L38,4 C38,34 14,50 0,59 C-14,50 -38,34 -38,4 Z" fill="none" stroke="url(#brassGrad)" stroke-width="3"/>
        <circle cx="0" cy="-6" r="16" fill="url(#steelGrad)" stroke="#2b1e14" stroke-width="2"/>
        <circle cx="0" cy="-6" r="6" fill="url(#brassGrad)" stroke="#2b1e14" stroke-width="1.5"/>
      </g>`,
    armure: `
      <g transform="translate(160,102)">
        <path d="M-38,-56 L-18,-62 C-10,-48 10,-48 18,-62 L38,-56 L54,-26 L36,-18 L34,48 L-34,48 L-36,-18 L-54,-26 Z" fill="url(#steelGrad)" stroke="#2b1e14" stroke-width="2.5"/>
        <line x1="0" y1="-48" x2="0" y2="48" stroke="#2b1e14" stroke-width="1.5" opacity="0.5"/>
        <path d="M-34,12 Q0,20 34,12" fill="none" stroke="url(#brassGrad)" stroke-width="4"/>
        <rect x="-8" y="8" width="16" height="10" rx="2" fill="url(#brassGrad)" stroke="#2b1e14" stroke-width="1.5"/>
      </g>`,
    potion: `
      <g transform="translate(160,104)">
        <rect x="-12" y="-74" width="24" height="16" rx="2" fill="url(#woodGrad)" stroke="#2b1e14" stroke-width="2"/>
        <rect x="-14" y="-58" width="28" height="16" rx="3" fill="url(#glassGrad)" stroke="#2b1e14" stroke-width="2"/>
        <path d="M-12,-42 C-42,-28 -48,18 -34,44 C-22,60 22,60 34,44 C48,18 42,-28 12,-42 Z" fill="url(#potionGrad)" stroke="#2b1e14" stroke-width="2.5"/>
        <path d="M-24,-4 C-16,-14 -8,-14 0,-4" fill="none" stroke="#fff4e0" stroke-width="2.5" opacity="0.7" stroke-linecap="round"/>
        <circle cx="0" cy="-42" r="9" fill="#9c2c24" stroke="#2b1e14" stroke-width="1.5"/>
      </g>`,
    lanterne: `
      <g transform="translate(160,102)">
        <path d="M-18,-56 C-18,-76 18,-76 18,-56" fill="none" stroke="#2b1e14" stroke-width="3"/>
        <polygon points="-24,-44 24,-44 16,-56 -16,-56" fill="url(#brassGrad)" stroke="#2b1e14" stroke-width="2"/>
        <rect x="-24" y="-44" width="48" height="68" rx="4" fill="#ffe5a3" fill-opacity="0.75" stroke="#2b1e14" stroke-width="2.5"/>
        <path d="M0,-28 C12,-14 14,4 0,14 C-14,4 -12,-14 0,-28 Z" fill="#e67e22" stroke="#9a3412" stroke-width="1.5"/>
        <line x1="-10" y1="-44" x2="-10" y2="24" stroke="#2b1e14" stroke-width="2"/>
        <line x1="10" y1="-44" x2="10" y2="24" stroke="#2b1e14" stroke-width="2"/>
        <rect x="-28" y="24" width="56" height="12" rx="3" fill="url(#brassGrad)" stroke="#2b1e14" stroke-width="2"/>
      </g>`,
    torche: `
      <g transform="translate(160,110) rotate(-18)">
        <polygon points="-7,-22 7,-22 4,62 -4,62" fill="url(#woodGrad)" stroke="#2b1e14" stroke-width="2"/>
        <rect x="-11" y="-34" width="22" height="14" rx="2" fill="#4f3722" stroke="#2b1e14" stroke-width="2"/>
        <path d="M0,-82 C20,-62 22,-40 0,-34 C-22,-40 -20,-62 0,-82 Z" fill="#e87424" stroke="#7c2d12" stroke-width="2"/>
        <path d="M0,-68 C10,-54 10,-42 0,-38 C-10,-42 -10,-54 0,-68 Z" fill="#fde047"/>
      </g>`,
    grimoire: `
      <g transform="translate(160,100)">
        <rect x="-46" y="-56" width="92" height="114" rx="6" fill="url(#leatherGrad)" stroke="#2b1e14" stroke-width="2.5"/>
        <rect x="-46" y="-56" width="16" height="114" rx="3" fill="#432818" stroke="#2b1e14" stroke-width="2"/>
        <rect x="-20" y="-42" width="54" height="86" rx="2" fill="none" stroke="url(#brassGrad)" stroke-width="2"/>
        <polygon points="7,-22 25,10 -11,10" fill="none" stroke="url(#brassGrad)" stroke-width="2"/>
        <circle cx="7" cy="-2" r="14" fill="none" stroke="url(#brassGrad)" stroke-width="1.8"/>
      </g>`,
    anneau: `
      <g transform="translate(160,104)">
        <circle cx="0" cy="4" r="40" fill="none" stroke="url(#brassGrad)" stroke-width="14"/>
        <circle cx="0" cy="4" r="47" fill="none" stroke="#2b1e14" stroke-width="2"/>
        <circle cx="0" cy="4" r="33" fill="none" stroke="#2b1e14" stroke-width="2"/>
        <polygon points="0,-54 14,-40 0,-26 -14,-40" fill="#4f46e5" stroke="#2b1e14" stroke-width="2"/>
      </g>`,
    baguette: `
      <g transform="translate(160,102) rotate(-35)">
        <rect x="-5" y="-66" width="10" height="138" rx="3" fill="url(#woodGrad)" stroke="#2b1e14" stroke-width="2"/>
        <circle cx="0" cy="-70" r="10" fill="#6366f1" stroke="#2b1e14" stroke-width="2"/>
        <line x1="-18" y1="-70" x2="18" y2="-70" stroke="url(#brassGrad)" stroke-width="2"/>
        <line x1="0" y1="-88" x2="0" y2="-52" stroke="url(#brassGrad)" stroke-width="2"/>
      </g>`,
    vivres: `
      <g transform="translate(160,102)">
        <path d="M-36,-10 C-36,-38 36,-38 36,-10 L42,40 C42,54 -42,54 -42,40 Z" fill="url(#leatherGrad)" stroke="#2b1e14" stroke-width="2.5"/>
        <rect x="-10" y="-52" width="20" height="18" rx="3" fill="url(#woodGrad)" stroke="#2b1e14" stroke-width="2"/>
        <line x1="-38" y1="6" x2="38" y2="6" stroke="#2b1e14" stroke-width="2" stroke-dasharray="5 3"/>
      </g>`,
    corde: `
      <g transform="translate(160,100)">
        <ellipse cx="0" cy="0" rx="46" ry="26" fill="none" stroke="#a6814c" stroke-width="11"/>
        <ellipse cx="0" cy="0" rx="46" ry="26" fill="none" stroke="#2b1e14" stroke-width="2"/>
        <ellipse cx="0" cy="14" rx="42" ry="22" fill="none" stroke="#c39d63" stroke-width="9"/>
        <ellipse cx="0" cy="14" rx="42" ry="22" fill="none" stroke="#2b1e14" stroke-width="1.8"/>
        <rect x="-12" y="-12" width="24" height="44" rx="4" fill="url(#leatherGrad)" stroke="#2b1e14" stroke-width="2"/>
      </g>`,
    sac: `
      <g transform="translate(160,104)">
        <path d="M-38,-36 C-38,-56 38,-56 38,-36 L46,44 C46,56 -46,56 -46,44 Z" fill="url(#leatherGrad)" stroke="#2b1e14" stroke-width="2.5"/>
        <path d="M-40,-20 L40,-20 L32,12 L-32,12 Z" fill="#9c6b3b" stroke="#2b1e14" stroke-width="2"/>
        <rect x="-8" y="6" width="16" height="14" rx="2" fill="url(#brassGrad)" stroke="#2b1e14" stroke-width="1.8"/>
      </g>`,
    soin: `
      <g transform="translate(160,102)">
        <rect x="-44" y="-34" width="88" height="68" rx="8" fill="url(#leatherGrad)" stroke="#2b1e14" stroke-width="2.5"/>
        <rect x="-10" y="-22" width="20" height="44" rx="2" fill="#f7eed8" stroke="#2b1e14" stroke-width="1.8"/>
        <rect x="-22" y="-10" width="44" height="20" rx="2" fill="#f7eed8" stroke="#2b1e14" stroke-width="1.8"/>
      </g>`,
    monture: `
      <g transform="translate(160,104)">
        <ellipse cx="0" cy="8" rx="48" ry="28" fill="url(#leatherGrad)" stroke="#2b1e14" stroke-width="2.5"/>
        <path d="M22,-10 L48,-46 L62,-36 L44,0 Z" fill="url(#leatherGrad)" stroke="#2b1e14" stroke-width="2.5"/>
        <line x1="-30" y1="28" x2="-34" y2="62" stroke="#2b1e14" stroke-width="6" stroke-linecap="round"/>
        <line x1="26" y1="28" x2="30" y2="62" stroke="#2b1e14" stroke-width="6" stroke-linecap="round"/>
      </g>`,
    equipement: `
      <g transform="translate(160,104)">
        <path d="M-42,-42 L-10,-42 L-6,18 L24,26 L24,46 L-44,46 Z" fill="url(#leatherGrad)" stroke="#2b1e14" stroke-width="2.5"/>
        <path d="M8,-42 L40,-42 L44,46 L24,46 L24,18 L8,18 Z" fill="#6f4e37" stroke="#2b1e14" stroke-width="2"/>
      </g>`,
    outil: `
      <g transform="translate(160,102) rotate(-25)">
        <rect x="-5" y="-56" width="10" height="122" rx="3" fill="url(#woodGrad)" stroke="#2b1e14" stroke-width="2"/>
        <path d="M-24,-64 L24,-64 L20,-42 L-20,-42 Z" fill="url(#steelGrad)" stroke="#2b1e14" stroke-width="2"/>
        <circle cx="0" cy="40" r="14" fill="none" stroke="url(#brassGrad)" stroke-width="5"/>
      </g>`,
  };

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200" width="320" height="200">
  <defs>
    <radialGradient id="parchmentBg" cx="50%" cy="48%" r="65%">
      <stop offset="0%" stop-color="#fbf4e2"/>
      <stop offset="70%" stop-color="#f0e1bf"/>
      <stop offset="100%" stop-color="#dfca9c"/>
    </radialGradient>
    <linearGradient id="steelGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#e7eaef"/>
      <stop offset="50%" stop-color="#9aa3b2"/>
      <stop offset="100%" stop-color="#5b6370"/>
    </linearGradient>
    <linearGradient id="brassGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f2d58a"/>
      <stop offset="50%" stop-color="#c3923d"/>
      <stop offset="100%" stop-color="#7c5319"/>
    </linearGradient>
    <linearGradient id="woodGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#9e6d3f"/>
      <stop offset="50%" stop-color="#754925"/>
      <stop offset="100%" stop-color="#4e2f16"/>
    </linearGradient>
    <linearGradient id="leatherGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#a56c43"/>
      <stop offset="100%" stop-color="#5b341b"/>
    </linearGradient>
    <linearGradient id="potionGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ef4444"/>
      <stop offset="60%" stop-color="#b91c1c"/>
      <stop offset="100%" stop-color="#7f1d1d"/>
    </linearGradient>
    <linearGradient id="glassGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#d8e9ef"/>
      <stop offset="100%" stop-color="#9ab8c5"/>
    </linearGradient>
  </defs>
  <rect width="320" height="200" fill="url(#parchmentBg)"/>
  <rect x="8" y="8" width="304" height="184" fill="none" stroke="#b9975b" stroke-width="1.5"/>
  <rect x="13" y="13" width="294" height="174" fill="none" stroke="#c9ae79" stroke-width="0.7" stroke-dasharray="4 3"/>
  <circle cx="160" cy="100" r="68" fill="#e6d3aa" fill-opacity="0.35" stroke="#b9975b" stroke-width="0.8" stroke-dasharray="2 3"/>
  ${motifs[family] || motifs.outil}
</svg>`;
}

export async function obtenirIllustrationObjet(
  aiClient: GoogleGenAI | null,
  req: ItemIllustrationRequest,
  options?: { signal?: AbortSignal; timeoutMs?: number }
): Promise<ItemIllustrationResult> {
  const key = normalizeKey(req.itemId || req.nom);
  const cache = loadCache();
  if (cache[key]) {
    return { itemId: key, svg: cache[key], source: 'cache' };
  }

  if (aiClient) {
    const aiCtx = creerContexteAppelIa(options?.signal, options?.timeoutMs ?? AI_TIMEOUT_MS);
    try {
      const prompt = [
        'Tu es un illustrateur des manuels officiels Donjons & Dragons 5e (Player\'s Handbook / Dungeon Master\'s Guide).',
        'Génère UNIQUEMENT un code SVG autonome et propre (<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200" width="320" height="200">...</svg>) représentant fidèlement cet objet officiel D&D 5e dans le style gravure encyclopédique et aquarelle sur parchemin clair (#f5ebd2 à #e5d2a7).',
        `Objet FR : ${req.nom}`,
        req.nomEn ? `Nom officiel D&D EN : ${req.nomEn}` : '',
        req.sousCategorie ? `Catégorie : ${req.sousCategorie}` : '',
        req.rarete ? `Rareté : ${req.rarete}` : '',
        req.degats ? `Dégâts : ${req.degats}` : '',
        req.caBase ? `Armure CA : ${req.caBase}` : '',
        req.effet ? `Description : ${req.effet}` : '',
        'Contraintes strictes :',
        '- AUCUN texte dans le SVG (pas de <text>), uniquement l\'illustration de l\'objet centrée avec ombrage, hachures fines et dégradés réalistes (métal, cuir, verre, bois, gemme).',
        '- Fond parchemin chaud (#f7eed8) avec bordure fine dorée/brune.',
        '- Aucun <script>, aucun attribut on*, aucun lien externe.',
        '- Réponds uniquement avec la balise <svg>...</svg>.',
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

      const sanitized = response.text ? sanitizeSvgMarkup(response.text) : null;
      if (sanitized) {
        cache[key] = sanitized;
        saveCache(cache);
        return { itemId: key, svg: sanitized, source: 'gemini' };
      }
    } catch (err: any) {
      if (aiCtx.estAnnuleParClient() || err instanceof AiCancelledError || err?.name === 'AbortError') {
        throw new AiCancelledError('Illustration d\'objet annulée par le joueur.');
      }
      if (aiCtx.estExpire() || err instanceof AiTimeoutError) {
        throw new AiTimeoutError('L\'illustration d\'objet IA a dépassé le délai maximal de 15 minutes.');
      }
      console.warn('Illustration IA repli vers gravure locale:', err);
    } finally {
      aiCtx.cleanup();
    }
  }

  const fallbackSvg = renderFallbackPlateSvg(req);
  cache[key] = fallbackSvg;
  saveCache(cache);
  return { itemId: key, svg: fallbackSvg, source: 'fallback' };
}
