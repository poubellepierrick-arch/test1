import React from 'react';
import { Sun, Moon, Swords, Feather } from 'lucide-react';

export const EngravedDivider: React.FC = () => (
  <div className="flex items-center gap-3 py-1 select-none" aria-hidden="true">
    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[#bfa574] to-[#bfa574]/80" />
    <svg width="14" height="14" viewBox="0 0 14 14" className="text-[#9e7833] shrink-0">
      <path
        d="M7 1 L13 7 L7 13 L1 7 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <circle cx="7" cy="7" r="1.6" fill="currentColor" />
    </svg>
    <div className="flex-1 h-px bg-gradient-to-l from-transparent via-[#bfa574] to-[#bfa574]/80" />
  </div>
);

interface SceneMedallionProps {
  ton?: 'CHAMPETRE' | 'SOMBRE' | 'PERIL' | 'NEUTRE';
}

export const SceneMedallion: React.FC<SceneMedallionProps> = ({ ton = 'NEUTRE' }) => {
  const styles =
    ton === 'PERIL'
      ? 'border-rose-700/60 bg-rose-950/10 text-rose-800'
      : ton === 'SOMBRE'
      ? 'border-stone-500/60 bg-stone-800/10 text-stone-700'
      : ton === 'CHAMPETRE'
      ? 'border-amber-700/60 bg-amber-700/10 text-amber-800'
      : 'border-[#9e7833]/60 bg-[#b48a3e]/10 text-[#6e4e1c]';

  const Icon =
    ton === 'PERIL' ? Swords : ton === 'SOMBRE' ? Moon : ton === 'CHAMPETRE' ? Sun : Feather;

  return (
    <span
      className={`inline-flex items-center justify-center w-6 h-6 rounded-full border shrink-0 ${styles}`}
      aria-hidden="true"
    >
      <Icon className="w-3.5 h-3.5" />
    </span>
  );
};

export const CornerFlourishes: React.FC = () => (
  <>
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      className="pointer-events-none absolute top-1.5 left-1.5 text-[#a67f38]/55 z-10"
      aria-hidden="true"
    >
      <path d="M1 19 L1 3 Q1 1 3 1 L19 1" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="4" cy="4" r="1.2" fill="currentColor" />
    </svg>
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      className="pointer-events-none absolute top-1.5 right-1.5 text-[#a67f38]/55 z-10"
      aria-hidden="true"
    >
      <path d="M1 1 L17 1 Q19 1 19 3 L19 19" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="16" cy="4" r="1.2" fill="currentColor" />
    </svg>
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      className="pointer-events-none absolute bottom-1.5 left-1.5 text-[#a67f38]/55 z-10"
      aria-hidden="true"
    >
      <path d="M1 1 L1 17 Q1 19 3 19 L19 19" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="4" cy="16" r="1.2" fill="currentColor" />
    </svg>
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      className="pointer-events-none absolute bottom-1.5 right-1.5 text-[#a67f38]/55 z-10"
      aria-hidden="true"
    >
      <path d="M1 19 L17 19 Q19 19 19 17 L19 1" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="16" cy="16" r="1.2" fill="currentColor" />
    </svg>
  </>
);
