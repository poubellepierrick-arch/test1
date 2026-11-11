import React, { useState } from 'react';
import { SimulationState } from '../types';
import { ActionRequest } from '../engine/adjudication';
import { ShoppingBag, Droplets, Utensils, Flame, HeartPulse, ShieldAlert } from 'lucide-react';

interface LocalMarketPanelProps {
  etat: SimulationState;
  chargement: boolean;
  onExecuterAction: (action: ActionRequest) => void;
}

export const LocalMarketPanel: React.FC<LocalMarketPanelProps> = ({
  etat,
  chargement,
  onExecuterAction,
}) => {
  const [quantites, setQuantites] = useState<Record<string, number>>({
    ration: 1,
    eau: 1,
    torche: 1,
    bandage: 1,
    fleches: 1,
    dague: 1,
  });

  const [confirmationAchat, setConfirmationAchat] = useState<{
    articleId: string;
    nom: string;
    coutTotal: string;
    qte: number;
  } | null>(null);

  const multFer = etat.marche.penurieArmurerie ? etat.marche.multiplicateurFer : 1.0;

  const articles = [
    {
      id: 'ration',
      nom: 'Ration de voyage',
      prixPC: 50,
      labelPrix: '5 PA',
      icon: Utensils,
      desc: '1 jour de survie',
    },
    {
      id: 'eau',
      nom: 'Eau purifiée (1L)',
      prixPC: 2,
      labelPrix: '2 PC',
      icon: Droplets,
      desc: "Remplissage d'outre",
    },
    {
      id: 'torche',
      nom: 'Torche de poix',
      prixPC: 1,
      labelPrix: '1 PC',
      icon: Flame,
      desc: 'Éclairage 1h en sous-sol',
    },
    {
      id: 'bandage',
      nom: 'Bandage d\'étoffe',
      prixPC: 10,
      labelPrix: '1 PA',
      icon: HeartPulse,
      desc: 'Stabilisation de blessure',
    },
    {
      id: 'fleches',
      nom: 'Carquois de flèches (x20)',
      prixPC: Math.round(100 * multFer),
      labelPrix: `${(Math.round(100 * multFer) / 100).toFixed(1)} PO`,
      icon: ShoppingBag,
      desc: etat.marche.penurieArmurerie ? 'Prix fer affecté x' + multFer : 'Munitions de chasse',
    },
    {
      id: 'dague',
      nom: 'Dague en fer forgé',
      prixPC: Math.round(200 * multFer),
      labelPrix: `${(Math.round(200 * multFer) / 100).toFixed(1)} PO`,
      icon: ShoppingBag,
      desc: etat.marche.penurieArmurerie ? 'Prix fer affecté x' + multFer : "Arme d'appoint (1d4)",
    },
  ];

  const handleDemanderAchat = (art: (typeof articles)[0]) => {
    const qte = quantites[art.id] || 1;
    const totalPC = art.prixPC * qte;
    const coutStr = `${(totalPC / 100).toFixed(2)} PO`;

    setConfirmationAchat({
      articleId: art.id,
      nom: art.nom,
      coutTotal: coutStr,
      qte,
    });
  };

  const validerAchat = () => {
    if (!confirmationAchat) return;
    onExecuterAction({
      type: 'TROQUER',
      articleId: confirmationAchat.articleId,
      quantite: confirmationAchat.qte,
    });
    setConfirmationAchat(null);
  };

  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center justify-between text-stone-500 text-[11px]">
        <span className="font-semibold uppercase tracking-wide">Comptoir & provisions de terrain</span>
        <span className="font-mono text-stone-700 font-semibold">
          Solde : {etat.personnage.monnaies.po} PO · {etat.personnage.monnaies.pa} PA · {etat.personnage.monnaies.pc} PC
        </span>
      </div>

      {etat.marche.penurieArmurerie && (
        <div className="bg-amber-50 border border-amber-300 p-2 rounded-md flex items-center gap-2 text-[11px] text-amber-900">
          <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0" />
          <span>Blocus ou mine compromise : cours du fer indexé à x{etat.marche.multiplicateurFer}.</span>
        </div>
      )}

      {/* Confirmation en ligne */}
      {confirmationAchat && (
        <div className="bg-amber-50 border border-amber-300 p-2.5 rounded-lg flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs text-amber-900">
            Acheter {confirmationAchat.qte}x {confirmationAchat.nom} pour <strong>{confirmationAchat.coutTotal}</strong> ?
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={validerAchat}
              disabled={chargement}
              className="px-3 py-1 bg-amber-700 hover:bg-amber-800 text-white font-medium rounded-md shadow-xs transition-colors"
            >
              Confirmer
            </button>
            <button
              onClick={() => setConfirmationAchat(null)}
              className="px-2.5 py-1 bg-white hover:bg-stone-100 text-stone-700 rounded-md border border-stone-300"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Grille des articles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {articles.map(art => {
          const Icon = art.icon;
          const qte = quantites[art.id] || 1;
          return (
            <div
              key={art.id}
              className="bg-stone-50 border border-stone-200 p-2.5 rounded-lg flex flex-col justify-between space-y-2 shadow-2xs"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-stone-900 flex items-center gap-1.5">
                    <Icon className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                    {art.nom}
                  </span>
                  <span className="font-mono font-bold text-amber-800 text-[11px]">{art.labelPrix}</span>
                </div>
                <div className="text-[11px] text-stone-500 mt-0.5">{art.desc}</div>
              </div>

              <div className="flex items-center justify-between pt-1.5 border-t border-stone-200/80">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setQuantites(prev => ({ ...prev, [art.id]: Math.max(1, (prev[art.id] || 1) - 1) }))}
                    className="w-5 h-5 bg-white border border-stone-300 hover:bg-stone-100 rounded text-stone-700 flex items-center justify-center font-bold"
                  >
                    -
                  </button>
                  <span className="w-6 text-center font-mono font-semibold text-stone-800">{qte}</span>
                  <button
                    onClick={() => setQuantites(prev => ({ ...prev, [art.id]: (prev[art.id] || 1) + 1 }))}
                    className="w-5 h-5 bg-white border border-stone-300 hover:bg-stone-100 rounded text-stone-700 flex items-center justify-center font-bold"
                  >
                    +
                  </button>
                </div>

                <button
                  onClick={() => handleDemanderAchat(art)}
                  disabled={chargement}
                  className="px-2.5 py-1 bg-amber-700 hover:bg-amber-800 text-white rounded font-medium text-[11px] shadow-2xs transition-colors"
                >
                  Acheter
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
