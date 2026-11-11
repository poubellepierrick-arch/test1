import React, { useState } from 'react';
import { SimulationState } from '../types';
import { ActionRequest } from '../engine/adjudication';
import { MessageSquare, User, Send, HeartHandshake, History, Sparkles } from 'lucide-react';

interface NpcDialogPanelProps {
  etat: SimulationState;
  chargement: boolean;
  onExecuterAction: (action: ActionRequest) => void;
}

export const NpcDialogPanel: React.FC<NpcDialogPanelProps> = ({
  etat,
  chargement,
  onExecuterAction,
}) => {
  const [pnjSelectionne, setPnjSelectionne] = useState<string>('npc_forgeron_torvin');
  const [sujetLibre, setSujetLibre] = useState('');

  const pnjs = [
    {
      id: 'npc_forgeron_torvin',
      nom: 'Torvin le Forgeron',
      role: 'Artisan forge de Val-Gris',
      alignement: 'Neutre Bon',
      seuil: 'DD 13',
      suggestions: [
        'Demander du labeur d\'appoint à la forge',
        'S\'enquérir de l\'état des filons de Roche-Noire',
        'Faire expertiser l\'armure et les fers',
      ],
    },
    {
      id: 'npc_bailli_valgris',
      nom: 'Bailli Rogar',
      role: 'Magistrat civil de la Ligue',
      alignement: 'Loyal Neutre',
      seuil: 'DD 13',
      suggestions: [
        'Consulter les ordonnances et primes de la Ligue',
        'Signaler les mouvements de patrouilles suspectes',
        'Demander un sauf-conduit pour les cols marchands',
      ],
    },
    {
      id: 'npc_sentinelle_porte',
      nom: 'Sentinelle Elia',
      role: 'Garde des palissades',
      alignement: 'Neutre',
      seuil: 'DD 12',
      suggestions: [
        'Demander des nouvelles des sentiers du nord',
        'Partager les observations sur la forêt des Tertres',
        'Savoir si des caravanes sont attendues sous peu',
      ],
    },
    {
      id: 'npc_capitaine_morn',
      nom: 'Capitaine Morn',
      role: 'Commandant mercenaire',
      alignement: 'Loyal Mauvais',
      seuil: 'DD 15',
      suggestions: [
        'Négocier les tarifs de passage de la passe',
        'Sonder les intentions du Bouclier de fer',
        'Proposer vos bras pour un contrat d\'armes',
      ],
    },
  ];

  const pnjActif = pnjs.find(p => p.id === pnjSelectionne) || pnjs[0];
  const pnjNoeud = etat.grapheNoeuds.find(n => n.id === pnjActif.id);
  const disposition = pnjNoeud?.proprietes?.disposition || 'NEUTRE';
  const humeur = pnjNoeud?.proprietes?.humeur || 'Attentif et réservé';
  const historique = (pnjNoeud?.proprietes?.historiqueDialogue as any[]) || [];

  const handleParler = (sujetParam?: string) => {
    const texte = (sujetParam || sujetLibre).trim() || 'Situation générale et rumeurs régionales';
    if (chargement) return;
    onExecuterAction({
      type: 'DIALOGUER_PNJ',
      pnjId: pnjSelectionne,
      sujetDialogue: texte,
    });
    setSujetLibre('');
  };

  const getDispositionBadge = (disp: string) => {
    switch (disp) {
      case 'AMICAL':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded font-medium">
            <HeartHandshake className="w-3 h-3 text-emerald-600" /> Amical
          </span>
        );
      case 'MEFIANT':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] text-rose-800 bg-rose-50 border border-rose-200 px-1.5 py-0.2 rounded font-medium">
            Méfiance
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[10px] text-stone-600 bg-stone-100 border border-stone-200 px-1.5 py-0.2 rounded font-medium">
            Neutre
          </span>
        );
    }
  };

  return (
    <div className="space-y-3 text-xs">
      <div className="flex items-center justify-between text-stone-500 text-[11px]">
        <span className="font-semibold uppercase tracking-wide">Rencontres & interlocuteurs locaux</span>
        <span>{pnjs.length} PNJ accessibles</span>
      </div>

      {/* Sélecteur de PNJ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {pnjs.map(pnj => {
          const estActif = pnj.id === pnjSelectionne;
          const noeud = etat.grapheNoeuds.find(n => n.id === pnj.id);
          const disp = noeud?.proprietes?.disposition || 'NEUTRE';
          return (
            <button
              key={pnj.id}
              onClick={() => setPnjSelectionne(pnj.id)}
              className={`text-left p-2.5 rounded-lg border transition-colors flex items-start gap-2 cursor-pointer ${
                estActif
                  ? 'bg-sky-50/80 border-sky-300 text-stone-900 shadow-2xs'
                  : 'bg-stone-50 border-stone-200 text-stone-600 hover:border-stone-300'
              }`}
            >
              <User className={`w-4 h-4 mt-0.5 shrink-0 ${estActif ? 'text-sky-700' : 'text-stone-400'}`} />
              <div className="space-y-0.5 flex-1 min-w-0">
                <div className="font-bold flex items-center justify-between gap-1">
                  <span className="truncate">{pnj.nom}</span>
                  {getDispositionBadge(disp)}
                </div>
                <div className="text-[11px] text-stone-500 truncate">{pnj.role}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Cadre de dialogue approfondi */}
      <div className="bg-stone-50 border border-stone-200 p-3 rounded-lg space-y-2.5">
        <div className="flex items-center justify-between border-b border-stone-200 pb-1.5 flex-wrap gap-1">
          <div className="flex items-center gap-1.5 font-bold text-stone-900">
            <MessageSquare className="w-3.5 h-3.5 text-sky-700" />
            <span>Entretien avec {pnjActif.nom}</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-stone-500">
            <span>Humeur : <strong className="text-stone-700 font-medium">{humeur}</strong></span>
            <span>·</span>
            <span className="font-mono">{pnjActif.seuil} Persuasion</span>
          </div>
        </div>

        {/* Pistes de conversation rapides */}
        <div className="space-y-1">
          <div className="flex items-center gap-1 text-[11px] text-stone-600 font-medium">
            <Sparkles className="w-3 h-3 text-amber-600" />
            <span>Sujets d'échange recommandés :</span>
          </div>
          <div className="grid grid-cols-1 gap-1">
            {pnjActif.suggestions.map((sug, i) => (
              <button
                key={i}
                onClick={() => handleParler(sug)}
                disabled={chargement}
                className="text-left p-1.5 px-2 bg-white hover:bg-stone-100 border border-stone-200 rounded text-[11px] text-stone-800 transition-colors flex items-center justify-between group cursor-pointer disabled:opacity-50"
              >
                <span className="truncate">{sug}</span>
                <span className="text-stone-400 group-hover:text-sky-700 font-mono text-[10px]">Parler →</span>
              </button>
            ))}
          </div>
        </div>

        {/* Formulaire de question libre */}
        <form
          onSubmit={e => {
            e.preventDefault();
            handleParler();
          }}
          className="flex gap-2 pt-1 border-t border-stone-200"
        >
          <input
            type="text"
            value={sujetLibre}
            onChange={e => setSujetLibre(e.target.value)}
            disabled={chargement}
            placeholder={`Poser une question spécifique à ${pnjActif.nom}...`}
            className="flex-1 bg-white border border-stone-300 rounded-md px-3 py-1.5 text-stone-900 placeholder-stone-400 focus:outline-none focus:border-stone-500 text-xs"
          />
          <button
            type="submit"
            disabled={chargement}
            className="px-3.5 py-1.5 bg-sky-700 hover:bg-sky-800 disabled:opacity-50 text-white rounded-md font-medium flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Questionner</span>
          </button>
        </form>

        {/* Historique des échanges récents avec ce PNJ */}
        {historique.length > 0 && (
          <div className="pt-2 border-t border-stone-200 space-y-1">
            <div className="flex items-center gap-1 text-[10px] text-stone-500 font-medium uppercase tracking-wider">
              <History className="w-3 h-3 text-stone-400" />
              <span>Mémoire des échanges précédents :</span>
            </div>
            <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
              {historique.map((h, idx) => (
                <div key={idx} className="bg-white p-1.5 rounded border border-stone-200/70 text-[11px] flex justify-between gap-2">
                  <span className="text-stone-800 italic truncate">« {h.sujet} »</span>
                  <span className="text-stone-400 shrink-0 font-mono text-[10px]">{h.issue}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
