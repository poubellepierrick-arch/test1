import React from 'react';
import { CharacterStats, CombatState } from '../types';
import { ActionRequest } from '../engine/adjudication';
import { BookOpen, Sparkles, Flame, Shield, Heart, Eye, Wind } from 'lucide-react';
import { calculerSortsPreparesMax } from '../engine/spells';

interface SpellbookPanelProps {
  personnage: CharacterStats;
  combat: CombatState;
  chargement: boolean;
  onExecuterAction: (action: ActionRequest) => void;
}

export const SpellbookPanel: React.FC<SpellbookPanelProps> = ({
  personnage,
  combat,
  chargement,
  onExecuterAction,
}) => {
  const sortsConnus = personnage.sortsConnus || [];
  const sortsPrepares = personnage.sortsPrepares || [];
  const maxPrepares = calculerSortsPreparesMax(personnage);

  const getIconeSort = (id: string) => {
    switch (id) {
      case 'spell_trait_feu': return <Flame className="w-3.5 h-3.5 text-amber-600" />;
      case 'spell_bouclier': return <Shield className="w-3.5 h-3.5 text-sky-700" />;
      case 'spell_soin_blessures': return <Heart className="w-3.5 h-3.5 text-rose-600" />;
      case 'spell_detection_magie': return <Eye className="w-3.5 h-3.5 text-indigo-700" />;
      case 'spell_foulee_brumeuse': return <Wind className="w-3.5 h-3.5 text-emerald-700" />;
      default: return <Sparkles className="w-3.5 h-3.5 text-purple-700" />;
    }
  };

  const handlePreparer = (sortId: string) => {
    onExecuterAction({
      type: 'PREPARER_SORT',
      payloadAction: { sortId },
    });
  };

  const handleLancer = (sortId: string) => {
    const cibleId = combat.actif ? combat.ennemis.find(e => e.statut === 'ACTIF')?.id : undefined;
    onExecuterAction({
      type: 'LANCER_SORT_GRIMOIRE',
      payloadAction: { sortId, cibleCombatId: cibleId },
    });
  };

  return (
    <div className="space-y-2.5 text-xs">
      {/* En-tête Grimoire */}
      <div className="flex items-center justify-between border-b border-stone-100 pb-1.5 text-stone-700">
        <div className="flex items-center gap-1.5 font-bold text-stone-900">
          <BookOpen className="w-4 h-4 text-indigo-700" />
          <span>Grimoire de terrain & rituels</span>
        </div>
        <div className="text-[11px] text-stone-500 font-mono">
          Préparés : <strong className="text-indigo-900">{sortsPrepares.length}</strong> / {maxPrepares} max
        </div>
      </div>

      {/* Emplacements de sorts disponibles */}
      <div className="flex items-center gap-2 text-xs bg-stone-50 p-2 rounded-lg border border-stone-200">
        <span className="text-stone-500 font-semibold text-[11px]">Emplacements :</span>
        {personnage.emplacementsSorts.map((slot, idx) => {
          const restants = slot.total - slot.utilise;
          return (
            <span
              key={idx}
              className={`px-2 py-0.5 rounded border text-[11px] font-mono ${
                restants > 0
                  ? 'border-indigo-300 bg-indigo-50 text-indigo-900 font-semibold'
                  : 'border-stone-200 bg-white text-stone-400'
              }`}
            >
              Niv {slot.niveau} : {restants}/{slot.total}
            </span>
          );
        })}
      </div>

      {/* Liste des sorts */}
      <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
        {sortsConnus.map(sort => {
          const estCantrip = sort.niveau === 0;
          const estPrepare = estCantrip || sortsPrepares.includes(sort.id);
          const aEmplacementDispo = estCantrip || personnage.emplacementsSorts.some(
            s => s.niveau === sort.niveau && s.total - s.utilise > 0
          );
          const peutLancer = estPrepare && aEmplacementDispo;

          return (
            <div
              key={sort.id}
              className="bg-stone-50 border border-stone-200 p-2.5 rounded-lg flex flex-col justify-between space-y-1.5 shadow-2xs"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-stone-900 text-xs">
                  {getIconeSort(sort.id)}
                  <span>{sort.nom}</span>
                  <span className="text-[10px] bg-white text-stone-600 px-1.5 py-0.2 rounded border border-stone-200 font-normal">
                    {estCantrip ? 'Tour de magie' : `Niv ${sort.niveau}`}
                  </span>
                  {sort.estRituel && (
                    <span className="text-[10px] text-indigo-700 font-medium">Rituel</span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  {!estCantrip && (
                    <button
                      onClick={() => handlePreparer(sort.id)}
                      disabled={chargement || (!estPrepare && sortsPrepares.length >= maxPrepares)}
                      className={`px-2 py-1 rounded text-[11px] font-medium border transition-colors ${
                        estPrepare
                          ? 'bg-indigo-100 text-indigo-900 border-indigo-300'
                          : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-100'
                      }`}
                      title={estPrepare ? 'Retirer de la mémoire' : 'Mémoriser ce sort'}
                    >
                      {estPrepare ? 'Préparé ✓' : 'Mémoriser'}
                    </button>
                  )}

                  <button
                    onClick={() => handleLancer(sort.id)}
                    disabled={chargement || !peutLancer}
                    className={`px-2.5 py-1 rounded text-[11px] font-medium border shadow-2xs transition-colors ${
                      peutLancer
                        ? 'bg-indigo-700 hover:bg-indigo-800 text-white border-indigo-700'
                        : 'bg-stone-100 text-stone-400 border-stone-200 cursor-not-allowed'
                    }`}
                  >
                    Incanter
                  </button>
                </div>
              </div>

              <div className="text-[11px] text-stone-500 flex items-center justify-between">
                <span>{sort.description}</span>
                <span className="text-stone-400 shrink-0 ml-2 font-mono text-[10px]">Portée : {sort.portee}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
