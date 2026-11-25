import React, { useEffect, useState } from 'react';
import { Image as ImageIcon, Loader2, X } from 'lucide-react';
import type { ItemIllustrationRequest } from '../server/itemIllustrations';
import { creerRequeteIaController, useElapsedWait } from '../hooks/useElapsedWait';
import { AI_TIMEOUT_MS, formaterDureeAttente } from '../utils/aiTimeoutConfig';

const clientIllustrationCache = new Map<string, { svg: string; source: string }>();

interface ItemImageTriggerProps {
  ouvert: boolean;
  onToggle: () => void;
  title?: string;
}

export const ItemImageTrigger: React.FC<ItemImageTriggerProps> = ({
  ouvert,
  onToggle,
  title = 'Voir l\'illustration',
}) => (
  <button
    type="button"
    onClick={e => {
      e.stopPropagation();
      onToggle();
    }}
    title={ouvert ? 'Masquer l\'illustration' : title}
    className={`p-1 rounded border transition-colors cursor-pointer shrink-0 ${
      ouvert
        ? 'bg-[#8c6422] text-[#fffdf7] border-[#6b4b16]'
        : 'bg-[#fffdf7] hover:bg-[#efe4ca] text-[#6d5332] border-[#cbb384]'
    }`}
  >
    <ImageIcon className="w-3 h-3" />
  </button>
);

interface ItemIllustrationInlineProps {
  item: ItemIllustrationRequest;
  onClose: () => void;
}

export const ItemIllustrationInline: React.FC<ItemIllustrationInlineProps> = ({
  item,
  onClose,
}) => {
  const cacheKey = `${item.itemId}_${item.nom}`.toLowerCase();
  const cached = clientIllustrationCache.get(cacheKey);
  const [svg, setSvg] = useState<string | null>(cached?.svg ?? null);
  const [source, setSource] = useState<string>(cached?.source ?? '');
  const [chargement, setChargement] = useState(!cached);
  const [erreur, setErreur] = useState<string | null>(null);
  const elapsedMs = useElapsedWait(chargement);

  useEffect(() => {
    const existing = clientIllustrationCache.get(cacheKey);
    if (existing) {
      setSvg(existing.svg);
      setSource(existing.source);
      setChargement(false);
      return;
    }

    let actif = true;
    const reqCtrl = creerRequeteIaController(undefined, AI_TIMEOUT_MS + 10_000);
    setChargement(true);
    setErreur(null);

    fetch('/api/items/illustration', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: reqCtrl.signal,
      body: JSON.stringify(item),
    })
      .then(async res => {
        const data = await res.json();
        if (!res.ok || !data.succes || !data.svg) {
          throw new Error(data.erreur || 'Illustration indisponible');
        }
        if (!actif) return;
        clientIllustrationCache.set(cacheKey, { svg: data.svg, source: data.source || 'cache' });
        setSvg(data.svg);
        setSource(data.source || 'cache');
      })
      .catch(err => {
        if (!actif) return;
        if (reqCtrl.estExpire()) {
          setErreur('L\'illustration IA a dépassé le délai maximal de 15 minutes.');
        } else if (err?.name !== 'AbortError') {
          setErreur(err?.message || 'Erreur de chargement');
        }
      })
      .finally(() => {
        reqCtrl.cleanup();
        if (actif) setChargement(false);
      });

    return () => {
      actif = false;
      reqCtrl.abort();
      reqCtrl.cleanup();
    };
  }, [cacheKey, item]);

  const dataUrl = svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` : null;

  return (
    <div className="mt-1.5 bg-[#f7eed8] border border-[#c6ab77] rounded-md p-2 space-y-1.5 text-[11px] text-[#3b2c1e]">
      <div className="flex items-center justify-between gap-2">
        <span className="font-display font-semibold text-[#2a1d13] truncate">
          {item.nom}
          {item.nomEn ? <span className="font-sans font-normal text-[#78624a]"> · {item.nomEn}</span> : null}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="px-1.5 py-0.5 text-[#6d5742] hover:text-[#231a14] cursor-pointer shrink-0 flex items-center gap-1"
          title={chargement ? 'Annuler et fermer' : 'Fermer'}
        >
          {chargement && <span className="text-[10px]">Annuler</span>}
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {chargement ? (
        <div className="h-32 flex items-center justify-center gap-2 text-[#6d5742] bg-[#f2e4c2]/60 rounded border border-[#d6c298]">
          <Loader2 className="w-4 h-4 animate-spin text-[#8c6422]" />
          <span>Gravure en cours ·</span>
          <span className="font-mono tabular-nums">{formaterDureeAttente(elapsedMs)}</span>
        </div>
      ) : erreur || !dataUrl ? (
        <div className="h-24 flex items-center justify-center text-rose-800 bg-rose-50/70 rounded border border-rose-200 px-2 text-center">
          {erreur || 'Illustration indisponible.'}
        </div>
      ) : (
        <div className="rounded overflow-hidden border border-[#bfa168] bg-[#f5ead0]">
          <img
            src={dataUrl}
            alt={`Illustration de ${item.nom}`}
            referrerPolicy="no-referrer"
            className="w-full h-36 object-contain block"
          />
        </div>
      )}

      {source && !chargement && !erreur && (
        <div className="text-[10px] text-[#78624a] text-right">
          Planche d'équipement · {source === 'gemini' ? 'Gravure IA' : source === 'cache' ? 'Archive' : 'Gravure D&D'}
        </div>
      )}
    </div>
  );
};
