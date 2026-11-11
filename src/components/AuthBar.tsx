import React, { useState } from 'react';
import { AuthSession } from '../hooks/useSimulation';
import { User, Check, Edit2 } from 'lucide-react';

interface AuthBarProps {
  authSession: AuthSession;
  onUpdateSession: (session: AuthSession) => void;
}

export const AuthBar: React.FC<AuthBarProps> = ({ authSession, onUpdateSession }) => {
  const [edition, setEdition] = useState(false);
  const [nom, setNom] = useState(authSession.nomAventurier);

  const sauvegarder = (e: React.FormEvent) => {
    e.preventDefault();
    if (nom.trim()) {
      onUpdateSession({ ...authSession, nomAventurier: nom.trim() });
      setEdition(false);
    }
  };

  return (
    <div className="flex items-center gap-2 text-xs text-stone-600">
      <User className="w-3.5 h-3.5 text-stone-500" />
      {edition ? (
        <form onSubmit={sauvegarder} className="flex items-center gap-1.5">
          <input
            type="text"
            value={nom}
            onChange={e => setNom(e.target.value)}
            className="bg-white border border-stone-300 px-2 py-0.5 rounded text-stone-900 text-xs w-32 focus:outline-none focus:border-stone-500"
            placeholder="Nom joueur"
          />
          <button type="submit" className="p-1 hover:text-emerald-700" title="Enregistrer session">
            <Check className="w-3.5 h-3.5 text-emerald-700" />
          </button>
        </form>
      ) : (
        <div className="flex items-center gap-1.5">
          <span className="text-stone-800 font-semibold">{authSession.nomAventurier}</span>
          <span className="text-stone-400 text-[11px] font-mono">({authSession.playerId})</span>
          <button
            onClick={() => setEdition(true)}
            className="p-1 text-stone-400 hover:text-stone-700 transition-colors"
            title="Modifier identifiant session"
          >
            <Edit2 className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
};
