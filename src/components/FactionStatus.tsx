import React, { useState } from 'react';
import { Faction, WorldMarket, GraphNode } from '../types';
import { Globe } from 'lucide-react';

interface FactionStatusProps {
  factions: Faction[];
  marche: WorldMarket;
  grapheNoeuds: GraphNode[];
  onTickManuel: () => void;
  chargement: boolean;
}

export const FactionStatus: React.FC<FactionStatusProps> = ({
  factions,
  marche,
  grapheNoeuds,
  onTickManuel,
  chargement,
}) => {
  const [ouvert, setOuvert] = useState(false);

  return (
    <div className="bg-white border border-stone-200 shadow-xs rounded-lg p-3.5 text-xs space-y-2.5 text-stone-700">
      <div className="flex justify-between items-center cursor-pointer select-none" onClick={() => setOuvert(!ouvert)}>
        <div className="flex items-center gap-1.5 text-stone-900 font-bold">
          <Globe className="w-4 h-4 text-emerald-700" />
          <span>Géopolitique et économie du monde</span>
        </div>
        <button className="text-[11px] text-stone-400 hover:text-stone-700 font-medium">
          {ouvert ? 'Replier ▲' : 'Déplier ▼'}
        </button>
      </div>

      {/* Résumé permanent */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs pt-1 border-t border-stone-100">
        <div className="bg-stone-50 p-2 rounded-md border border-stone-200">
          <div className="text-stone-500 text-[10px]">Indice du fer</div>
          <div className="font-bold text-stone-900 font-mono">x{marche.multiplicateurFer}</div>
        </div>
        <div className="bg-stone-50 p-2 rounded-md border border-stone-200">
          <div className="text-stone-500 text-[10px]">Armurerie</div>
          <div className={marche.penurieArmurerie ? 'font-bold text-rose-700' : 'text-stone-700 font-medium'}>
            {marche.penurieArmurerie ? 'Pénurie active' : 'Normal'}
          </div>
        </div>
        <div className="bg-stone-50 p-2 rounded-md border border-stone-200">
          <div className="text-stone-500 text-[10px]">Sécurité des routes</div>
          <div className="text-amber-800 font-bold">{marche.securiteRoutes}</div>
        </div>
        <div className="bg-stone-50 p-2 rounded-md border border-stone-200 flex items-center justify-between">
          <span className="text-stone-500 text-[10px]">Tick Faction</span>
          <button
            onClick={e => {
              e.stopPropagation();
              onTickManuel();
            }}
            disabled={chargement}
            className="px-2 py-1 bg-white hover:bg-stone-100 text-stone-800 rounded border border-stone-300 text-[10px] font-medium shadow-2xs transition-colors"
          >
            Avancer Tick
          </button>
        </div>
      </div>

      {/* Détails complets si déplié */}
      {ouvert && (
        <div className="space-y-3 pt-2 border-t border-stone-100">
          <div className="text-stone-600 font-semibold text-[11px] uppercase tracking-wide">Factions actives :</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {factions.map(faction => (
              <div key={faction.id} className="bg-stone-50 border border-stone-200 p-2.5 rounded-md space-y-1">
                <div className="font-bold text-stone-900">{faction.nom}</div>
                <div className="text-[11px] text-stone-600 flex justify-between font-mono">
                  <span>Force : {faction.forceMilitaire}</span>
                  <span>Richesse : {faction.richesse}</span>
                </div>
                <div className="text-[11px] text-stone-500">
                  Contrôle : {faction.noeudsControles.length > 0 ? faction.noeudsControles.join(', ') : 'Aucun'}
                </div>
                <div className="text-[11px] text-stone-600 border-t border-stone-200/80 pt-1">
                  Objectif : {faction.objectifs[0]}
                </div>
              </div>
            ))}
          </div>

          <div className="bg-stone-50 border border-stone-200 p-2.5 rounded-md text-[11px] text-stone-500">
            <span className="text-stone-700 font-semibold">Simulation autonome : </span>
            Ce module calcule les guerres, blocus et conquêtes minières indépendamment du joueur. Les prix en ville évoluent selon ces dynamiques.
          </div>
        </div>
      )}
    </div>
  );
};
