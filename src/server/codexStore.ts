import fs from 'node:fs';
import path from 'node:path';
import {
  enregistrerAjoutsCompendium,
  listerPersonnalisesCompendium,
  obtenirManifesteCompletude,
} from '../engine/compendium';
import { SrdManifest } from '../types/srd';

const CUSTOM_ENTRIES_PATH = path.resolve(process.cwd(), 'src/data/srd/custom_entries.json');

export function chargerAjoutsCodex(): { chargees: number; erreurs: string[] } {
  try {
    if (!fs.existsSync(CUSTOM_ENTRIES_PATH)) {
      return { chargees: 0, erreurs: [] };
    }
    const rawText = fs.readFileSync(CUSTOM_ENTRIES_PATH, 'utf-8').trim();
    if (!rawText) return { chargees: 0, erreurs: [] };
    const parsed = JSON.parse(rawText);
    if (!Array.isArray(parsed)) {
      return { chargees: 0, erreurs: ['custom_entries.json doit contenir un tableau JSON.'] };
    }
    const res = enregistrerAjoutsCompendium(parsed);
    return { chargees: res.ajoutes + res.remplaces, erreurs: res.erreurs };
  } catch (err: any) {
    return { chargees: 0, erreurs: [err?.message || 'Erreur lecture custom_entries.json'] };
  }
}

export function sauvegarderAjoutsCodex(entries: unknown[]): {
  ajoutes: number;
  remplaces: number;
  erreurs: string[];
  manifest: SrdManifest;
} {
  const res = enregistrerAjoutsCompendium(entries);
  const toutesPersonnalisees = listerPersonnalisesCompendium();

  fs.mkdirSync(path.dirname(CUSTOM_ENTRIES_PATH), { recursive: true });
  fs.writeFileSync(CUSTOM_ENTRIES_PATH, JSON.stringify(toutesPersonnalisees, null, 2) + '\n', 'utf-8');

  return {
    ajoutes: res.ajoutes,
    remplaces: res.remplaces,
    erreurs: res.erreurs,
    manifest: obtenirManifesteCompletude(),
  };
}
