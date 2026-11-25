import React, { useState } from 'react';
import { CharacterStats } from '../types';
import { ActionRequest } from '../engine/adjudication';
import { RecrueType } from '../engine/context';
import { Users, Package, Trash2, Heart } from 'lucide-react';

interface HirelingsPanelProps {
  personnage: CharacterStats;
  recruesDisponiblesTypes?: RecrueType[];
  peutEmbaucher?: boolean;
  raisonCompagnons?: string;
  chargement: boolean;
  onExecuterAction: (action: ActionRequest) => void;
}

export const HirelingsPanel: React.FC<HirelingsPanelProps> = ({
  personnage,
  recruesDisponiblesTypes = ['MULET', 'PORTEUR', 'MERCENAIRE'],
  peutEmbaucher = true,
  raisonCompagnons = 'Bourgade ou fort requis',
  chargement,
  onExecuterAction,
}) => {
  const [confirmationRenvoi, setConfirmationRenvoi] = useState<string | null>(null);

  const recruesDisponibles = [
    {
      type: 'MULET' as const,
      nom: 'Mulet de bât',
      coutPA: 15,
      coutJourPA: 3,
      chargeLbs: 200,
      pv: 11,
      desc: '+200 lbs de charge. Refuse le combat.',
    },
    {
      type: 'PORTEUR' as const,
      nom: 'Porteur journalier',
      coutPA: 10,
      coutJourPA: 4,
      chargeLbs: 100,
      pv: 9,
      desc: '+100 lbs de charge. Aide au camp.',
    },
    {
      type: 'MERCENAIRE' as const,
      nom: "Mercenaire d'appoint",
      coutPA: 25,
      coutJourPA: 8,
      chargeLbs: 60,
      pv: 13,
      desc: 'Combat (+3 att) et garde nocturne.',
    },
  ].filter(r => recruesDisponiblesTypes.includes(r.type));

  const engager = (recrue: (typeof recruesDisponibles)[0]) => {
    onExecuterAction({
      type: 'ENGAGER_COMPAGNON',
      payloadAction: {
        type: recrue.type,
        nom: recrue.nom,
        coutPA: recrue.coutPA,
        chargeMaxLbs: recrue.chargeLbs,
        pv: recrue.pv,
      },
    });
  };

  const licencier = (id: string) => {
    onExecuterAction({
      type: 'CONGEDIER_COMPAGNON',
      payloadAction: { compagnonId: id },
    });
    setConfirmationRenvoi(null);
  };

  const soldePA = personnage.monnaies.po * 10 + personnage.monnaies.pa;
  const compagnonsActifs = personnage.compagnons || [];

  return (
    <div className="space-y-3 text-xs">
      <div className="flex items-center justify-between text-stone-500 text-[11px]">
        <span className="font-semibold uppercase tracking-wide">Compagnons & bêtes</span>
        <span className="font-mono text-stone-700 font-semibold">{compagnonsActifs.length} actif(s)</span>
      </div>

      {/* Confirmation de renvoi en ligne */}
      {confirmationRenvoi && (
        <div className="bg-amber-50 border border-amber-300 p-2.5 rounded-lg flex items-center justify-between">
          <span className="text-xs text-amber-900 font-medium">Congédier ce compagnon ?</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => licencier(confirmationRenvoi)}
              disabled={chargement}
              className="px-2.5 py-1 bg-amber-700 hover:bg-amber-800 text-white rounded text-[11px] font-medium transition-colors"
            >
              Confirmer
            </button>
            <button
              onClick={() => setConfirmationRenvoi(null)}
              className="px-2 py-1 bg-white hover:bg-stone-100 text-stone-700 rounded border border-stone-300 text-[11px]"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Compagnons déjà recrutés */}
      {compagnonsActifs.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[11px] text-stone-500 font-semibold uppercase">Escouade active</div>
          {compagnonsActifs.map(comp => (
            <div
              key={comp.id}
              className="bg-stone-50 border border-stone-200 p-2.5 rounded-lg flex items-center justify-between"
            >
              <div>
                <div className="font-bold text-stone-900 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-purple-700" />
                  <span>{comp.nom}</span>
                  <span className="text-[10px] text-stone-500 font-normal uppercase">({comp.type})</span>
                </div>
                <div className="text-[11px] text-stone-500 flex items-center gap-3 mt-0.5 font-mono">
                  <span className="flex items-center gap-1">
                    <Heart className="w-3 h-3 text-rose-600" />
                    {comp.pv} PV
                  </span>
                  <span className="flex items-center gap-1">
                    <Package className="w-3 h-3 text-stone-400" />
                    +{comp.chargeMaxLbs} lbs
                  </span>
                  <span>Solde : {comp.coutJournalierPA} PA/j</span>
                </div>
              </div>

              <button
                onClick={() => setConfirmationRenvoi(comp.id)}
                disabled={chargement}
                className="p-1.5 text-stone-400 hover:text-rose-700 transition-colors"
                title="Congédier"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Recrutement disponible */}
      <div className="space-y-1.5">
        <div className="text-[11px] text-stone-500 font-semibold uppercase">Embauche</div>
        {!peutEmbaucher || recruesDisponibles.length === 0 ? (
          <div className="bg-stone-50 border border-stone-200 rounded-lg p-2.5 text-stone-500">
            Recrutement indisponible : {raisonCompagnons}.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2">
            {recruesDisponibles.map(recrue => (
              <div
                key={recrue.type}
                className="bg-stone-50 border border-stone-200 p-2.5 rounded-lg flex items-center justify-between"
              >
                <div>
                  <div className="font-bold text-stone-900">{recrue.nom}</div>
                  <div className="text-[11px] text-stone-500">{recrue.desc}</div>
                  <div className="text-[10px] text-stone-400 font-mono mt-0.5">
                    Embauche : {recrue.coutPA} PA · {recrue.coutJourPA} PA/j
                  </div>
                </div>

                <button
                  onClick={() => engager(recrue)}
                  disabled={chargement || soldePA < recrue.coutPA}
                  className="px-3 py-1 bg-purple-700 hover:bg-purple-800 disabled:opacity-40 text-white rounded font-medium text-[11px] shadow-2xs transition-colors shrink-0 ml-2"
                >
                  Engager
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
