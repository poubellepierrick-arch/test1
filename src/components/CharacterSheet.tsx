import React from 'react';
import { CharacterStats } from '../types';
import { calculerModificateur } from '../engine/dice';
import { evaluerEpuisement, evaluerEncombrement } from '../engine/srd';
import { Heart, Shield, Zap, Skull, AlertTriangle, Sparkles } from 'lucide-react';

interface CharacterSheetProps {
  personnage: CharacterStats;
}

export const CharacterSheet: React.FC<CharacterSheetProps> = ({ personnage }) => {
  const epuisementInfo = evaluerEpuisement(personnage.epuisement);
  const charge = evaluerEncombrement(personnage);

  const pvRatio = Math.max(0, Math.min(1, personnage.pvActuels / personnage.pvMax));
  const getPvBarColor = () => {
    if (pvRatio <= 0.25) return 'bg-rose-600';
    if (pvRatio <= 0.5) return 'bg-amber-600';
    return 'bg-emerald-600';
  };

  const getEpuisementTexte = (niveau: number) => {
    switch (niveau) {
      case 0: return '0 (Normal)';
      case 1: return '1 (Désavantage tests caractéristiques)';
      case 2: return '2 (Vitesse réduite de moitié)';
      case 3: return '3 (Désavantage attaques et sauvegardes)';
      case 4: return '4 (PV max divisés par 2)';
      case 5: return '5 (Vitesse = 0)';
      case 6: return '6 (MORT DÉFINITIVE)';
      default: return `${niveau}`;
    }
  };

  return (
    <div className="bg-white border border-stone-200 shadow-xs rounded-lg p-3.5 text-xs space-y-4 text-stone-700">
      {/* Aventurier & Niveau */}
      <div className="border-b border-stone-100 pb-2">
        <div className="flex items-center justify-between">
          <span className="font-bold text-stone-900 text-sm">{personnage.nom}</span>
          <span className="text-[11px] bg-stone-100 text-stone-700 font-medium px-2 py-0.5 rounded border border-stone-200">
            Niv {personnage.niveau} {personnage.classe}
          </span>
        </div>
        {personnage.estMortDefinitivement && (
          <div className="mt-1.5 flex items-center gap-1.5 text-rose-900 font-bold bg-rose-100 border border-rose-300 p-1.5 rounded text-xs">
            <Skull className="w-4 h-4 text-rose-700" />
            <span>DÉCÉDÉ (PERMADEATH)</span>
          </div>
        )}
      </div>

      {/* PV, CA & Vitesse */}
      <div className="space-y-2">
        <div>
          <div className="flex justify-between items-center mb-1 text-xs">
            <span className="flex items-center gap-1 text-stone-600 font-medium">
              <Heart className="w-3.5 h-3.5 text-rose-600" />
              Points de vie
            </span>
            <span className="font-bold text-stone-900 font-mono tabular-nums">
              {personnage.pvActuels} / {personnage.pvMax}
            </span>
          </div>
          <div className="w-full bg-stone-100 h-2.5 rounded-full overflow-hidden border border-stone-200">
            <div
              className={`h-full transition-all duration-300 ${getPvBarColor()}`}
              style={{ width: `${pvRatio * 100}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-center pt-1">
          <div className="bg-stone-50 border border-stone-200 p-2 rounded-md flex items-center justify-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-sky-700" />
            <span className="text-stone-500">CA :</span>
            <span className="font-bold text-stone-900 font-mono">{personnage.ca}</span>
          </div>
          <div className="bg-stone-50 border border-stone-200 p-2 rounded-md flex items-center justify-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-600" />
            <span className="text-stone-500">Vitesse :</span>
            <span className="font-bold text-stone-900 font-mono">
              {epuisementInfo.vitesseNulle ? 0 : epuisementInfo.vitesseDivisee ? 15 : Math.max(0, personnage.vitessePieds - charge.penaliteVitesse)} ft
            </span>
          </div>
        </div>
      </div>

      {/* Sauvegardes contre la mort */}
      {personnage.pvActuels === 0 && !personnage.estMortDefinitivement && (
        <div className="bg-rose-50 border border-rose-200 p-2.5 rounded-md space-y-1">
          <div className="flex items-center gap-1 text-rose-900 font-semibold text-xs">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-700" />
            <span>Sauvegardes contre la mort</span>
          </div>
          <div className="flex justify-between text-[11px] font-mono">
            <span>Succès :</span>
            <span className="text-emerald-700 font-bold">{personnage.deathSaves.succes} / 3</span>
          </div>
          <div className="flex justify-between text-[11px] font-mono">
            <span>Échecs :</span>
            <span className="text-rose-700 font-bold">{personnage.deathSaves.echecs} / 3</span>
          </div>
        </div>
      )}

      {/* Épuisement */}
      <div className="bg-stone-50 border border-stone-200 p-2.5 rounded-md">
        <div className="flex justify-between items-center text-xs">
          <span className="text-stone-600 font-medium">Épuisement :</span>
          <span className={`font-mono font-bold ${personnage.epuisement > 0 ? 'text-amber-800' : 'text-stone-900'}`}>
            Niveau {personnage.epuisement} / 6
          </span>
        </div>
        <p className="text-[11px] text-stone-500 mt-1">
          {getEpuisementTexte(personnage.epuisement)}
        </p>
      </div>

      {/* Caractéristiques */}
      <div>
        <div className="text-stone-500 font-semibold mb-1.5 text-[11px] tracking-wide uppercase">Caractéristiques</div>
        <div className="grid grid-cols-3 gap-1.5 text-center">
          {(Object.entries(personnage.caracteristiques) as [string, number][]).map(([carac, val]) => {
            const mod = calculerModificateur(val);
            const modStr = mod >= 0 ? `+${mod}` : `${mod}`;
            return (
              <div key={carac} className="bg-stone-50 border border-stone-200 p-1.5 rounded-md">
                <div className="text-[10px] text-stone-500 uppercase font-semibold">{carac}</div>
                <div className="font-bold text-stone-900 text-sm font-mono">{val}</div>
                <div className="text-[11px] text-amber-800 font-semibold font-mono">{modStr}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Emplacements de Sorts */}
      {personnage.emplacementsSorts.length > 0 && (
        <div className="bg-stone-50 border border-stone-200 p-2.5 rounded-md space-y-1">
          <div className="flex items-center gap-1.5 text-indigo-900 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-indigo-700" />
            <span>Emplacements de sorts</span>
          </div>
          {personnage.emplacementsSorts.map(slot => (
            <div key={slot.niveau} className="flex justify-between text-[11px] font-mono">
              <span className="text-stone-600">Niveau {slot.niveau} ({slot.recharge}) :</span>
              <span className="font-bold text-stone-900">{slot.total - slot.utilise} / {slot.total}</span>
            </div>
          ))}
        </div>
      )}

      {/* Inventaire */}
      <div>
        <div className="flex justify-between items-center text-stone-500 font-semibold mb-1 text-[11px] uppercase">
          <span>Inventaire</span>
          <span className="text-[10px] text-stone-400 font-mono">{charge.statut}</span>
        </div>
        <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
          {personnage.inventaire.map(item => (
            <div key={item.id} className="flex justify-between items-center bg-stone-50 p-1.5 rounded border border-stone-200/60 text-[11px]">
              <span className="text-stone-800 truncate max-w-[140px]">
                {item.nom} {item.estEquipe ? '(Équipé)' : ''}
              </span>
              <span className="text-stone-500 font-mono shrink-0">{item.poidsLbs * item.quantite} lbs</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
