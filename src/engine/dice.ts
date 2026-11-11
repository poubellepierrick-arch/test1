import { Ability } from '../types';

export function calculerModificateur(valeurCarac: number): number {
  return Math.floor((valeurCarac - 10) / 2);
}

export function lancerDe(faces: number): number {
  return Math.floor(Math.random() * faces) + 1;
}

export interface JetD20Result {
  de1: number;
  de2?: number;
  type: 'normal' | 'avantage' | 'desavantage';
  valeurRetenue: number;
}

export function lancerD20(type: 'normal' | 'avantage' | 'desavantage' = 'normal'): JetD20Result {
  const de1 = lancerDe(20);
  if (type === 'normal') {
    return { de1, type, valeurRetenue: de1 };
  }
  const de2 = lancerDe(20);
  const valeurRetenue = type === 'avantage' ? Math.max(de1, de2) : Math.min(de1, de2);
  return { de1, de2, type, valeurRetenue };
}

export function interpreterJetDegats(formule: string): number {
  // Ex: "1d6+2" ou "2d6" ou "1d8"
  const match = formule.match(/^(\d+)d(\d+)(?:\+|-)?(\d+)?$/i);
  if (!match) return lancerDe(6);
  const nbDes = parseInt(match[1], 10);
  const faces = parseInt(match[2], 10);
  const bonus = match[3] ? parseInt(match[3], 10) * (formule.includes('-') ? -1 : 1) : 0;
  
  let total = 0;
  for (let i = 0; i < nbDes; i++) {
    total += lancerDe(faces);
  }
  return Math.max(1, total + bonus);
}
