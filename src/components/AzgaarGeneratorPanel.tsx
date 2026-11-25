import React, { useState } from 'react';
import { AzgaarClimateBias, AzgaarMapMetadata, AzgaarReliefPreset } from '../types';
import { Dices, Globe, RotateCcw, Wand2 } from 'lucide-react';

interface AzgaarGeneratorPanelProps {
  carteAzgaar?: AzgaarMapMetadata;
  chargement: boolean;
  onGenerer: (config: {
    seed: number;
    modeleRelief: AzgaarReliefPreset;
    climatBias: AzgaarClimateBias;
    rayonAnneaux: number;
    conserverHeros: boolean;
  }) => void;
  onRestaurerValGris?: () => void;
  onOuvrirForge?: () => void;
}

const RELIEFS: Array<{ id: AzgaarReliefPreset; label: string }> = [
  { id: 'continent', label: 'Continent' },
  { id: 'archipel', label: 'Archipel' },
  { id: 'peninsule', label: 'Péninsule' },
  { id: 'monts', label: 'Chaîne' },
  { id: 'vallee', label: 'Vallée' },
];

const CLIMATS: Array<{ id: AzgaarClimateBias; label: string }> = [
  { id: 'tempere', label: 'Tempéré' },
  { id: 'boreal', label: 'Boréal' },
  { id: 'aride', label: 'Aride' },
];

const TAILLES: Array<{ rayon: number; label: string }> = [
  { rayon: 2, label: '19 hex' },
  { rayon: 3, label: '37 hex' },
  { rayon: 4, label: '61 hex' },
];

export const AzgaarGeneratorPanel: React.FC<AzgaarGeneratorPanelProps> = ({
  carteAzgaar,
  chargement,
  onGenerer,
  onRestaurerValGris,
  onOuvrirForge,
}) => {
  const [seed, setSeed] = useState<number>(carteAzgaar?.seed || 104729);
  const [modeleRelief, setModeleRelief] = useState<AzgaarReliefPreset>(
    carteAzgaar?.modeleRelief || 'continent'
  );
  const [climatBias, setClimatBias] = useState<AzgaarClimateBias>(
    carteAzgaar?.climatBias || 'tempere'
  );
  const [rayonAnneaux, setRayonAnneaux] = useState<number>(
    carteAzgaar?.rayonAnneaux && carteAzgaar.rayonAnneaux >= 2 ? carteAzgaar.rayonAnneaux : 3
  );
  const [conserverHeros, setConserverHeros] = useState<boolean>(true);
  const [confirmValGris, setConfirmValGris] = useState<boolean>(false);

  const tirerGraine = () => {
    setSeed(Math.floor(Math.random() * 899999) + 100000);
  };

  return (
    <div
      className="bg-[#f5edd8] border border-[#b49968] rounded-lg p-3 space-y-2.5 text-[11px] text-[#231a14]"
      data-testid="azgaar-generator-panel"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#decba3] pb-1.5">
        <div className="flex items-center gap-1.5 font-display font-semibold text-[#2a1d13]">
          <Globe className="w-3.5 h-3.5 text-[#8c6422]" />
          <span>Atlas Azgaar</span>
        </div>
        {carteAzgaar && (
          <span className="font-mono text-[10px] text-[#6d5742]">
            {carteAzgaar.nomMonde} · #{carteAzgaar.seed}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <label className="space-y-1">
          <span className="block text-[10px] text-[#6d5742]">Graine</span>
          <div className="flex gap-1">
            <input
              type="number"
              min={1}
              max={9999999}
              value={seed}
              onChange={e => setSeed(Math.max(1, Number(e.target.value) || 1))}
              className="w-full bg-[#fffdf7] border border-[#bfa574] rounded px-2 py-1 font-mono text-[11px] text-[#231a14] focus:outline-none focus:border-[#8c6422]"
            />
            <button
              type="button"
              onClick={tirerGraine}
              title="Graine aléatoire"
              aria-label="Graine aléatoire"
              className="px-2 py-1 bg-[#fffdf7] hover:bg-[#efe4ca] border border-[#bfa574] rounded text-[#6d5332] cursor-pointer shrink-0"
            >
              <Dices className="w-3.5 h-3.5" />
            </button>
          </div>
        </label>

        <label className="space-y-1">
          <span className="block text-[10px] text-[#6d5742]">Relief</span>
          <select
            value={modeleRelief}
            onChange={e => setModeleRelief(e.target.value as AzgaarReliefPreset)}
            className="w-full bg-[#fffdf7] border border-[#bfa574] rounded px-2 py-1 text-[11px] text-[#231a14] focus:outline-none focus:border-[#8c6422]"
          >
            {RELIEFS.map(r => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="block text-[10px] text-[#6d5742]">Climat</span>
          <select
            value={climatBias}
            onChange={e => setClimatBias(e.target.value as AzgaarClimateBias)}
            className="w-full bg-[#fffdf7] border border-[#bfa574] rounded px-2 py-1 text-[11px] text-[#231a14] focus:outline-none focus:border-[#8c6422]"
          >
            {CLIMATS.map(c => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="block text-[10px] text-[#6d5742]">Échelle</span>
          <select
            value={rayonAnneaux}
            onChange={e => setRayonAnneaux(Number(e.target.value))}
            className="w-full bg-[#fffdf7] border border-[#bfa574] rounded px-2 py-1 text-[11px] text-[#231a14] focus:outline-none focus:border-[#8c6422]"
          >
            {TAILLES.map(t => (
              <option key={t.rayon} value={t.rayon}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <label className="flex items-center gap-1.5 text-[11px] text-[#463626] cursor-pointer select-none">
          <input
            type="checkbox"
            checked={conserverHeros}
            onChange={e => setConserverHeros(e.target.checked)}
            className="accent-[#8c6422]"
          />
          <span>Conserver le héros</span>
        </label>

        <div className="flex items-center gap-1.5">
          {onRestaurerValGris && (
            confirmValGris ? (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={chargement}
                  onClick={() => {
                    setConfirmValGris(false);
                    onRestaurerValGris();
                  }}
                  className="px-2 py-1 bg-rose-700 text-white rounded text-[10px] font-medium cursor-pointer whitespace-nowrap shrink-0"
                >
                  Confirmer Val-Gris
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmValGris(false)}
                  className="px-2 py-1 bg-[#fffdf7] border border-[#bfa574] rounded text-[10px] text-[#5c4734] cursor-pointer whitespace-nowrap shrink-0"
                >
                  Annuler
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={chargement}
                onClick={() => setConfirmValGris(true)}
                className="px-2.5 py-1 bg-[#fffdf7] hover:bg-[#efe4ca] disabled:opacity-40 border border-[#bfa574] rounded text-[10px] font-medium text-[#5c4734] flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Val-Gris</span>
              </button>
            )
          )}

          {onOuvrirForge && (
            <button
              type="button"
              disabled={chargement}
              onClick={onOuvrirForge}
              data-testid="btn-ouvrir-forge-progressive"
              className="px-2.5 py-1 bg-[#efe5cb] hover:bg-[#e7d8b5] disabled:opacity-40 border border-[#b48a3e] rounded text-[11px] font-medium text-[#2a1d13] flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Wand2 className="w-3 h-3 text-[#8c6422]" />
              <span>Forge 4 étapes</span>
            </button>
          )}

          <button
            type="button"
            disabled={chargement}
            onClick={() =>
              onGenerer({
                seed,
                modeleRelief,
                climatBias,
                rayonAnneaux,
                conserverHeros,
              })
            }
            data-testid="btn-generer-monde"
            className="px-3 py-1 dnd-wood-bar border disabled:opacity-40 rounded text-[11px] font-medium cursor-pointer whitespace-nowrap shrink-0"
          >
            {chargement ? 'Calcul...' : 'Générer'}
          </button>
        </div>
      </div>
    </div>
  );
};
