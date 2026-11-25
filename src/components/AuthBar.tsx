import React, { useState } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { AuthSession } from '../hooks/useSimulation';
import { DualSaveStatus } from '../firebase/saveService';
import { User, Check, Edit2, Cloud, CloudUpload, RotateCcw, LogOut } from 'lucide-react';

interface AuthBarProps {
  authSession: AuthSession;
  onUpdateSession: (session: AuthSession) => void;
  firebaseUser?: FirebaseUser | null;
  statutSauvegarde?: DualSaveStatus | null;
  syncEnCours?: boolean;
  onConnexionGoogle?: () => Promise<void>;
  onDeconnexionGoogle?: () => Promise<void>;
  onCopierSecours?: () => Promise<void>;
  onRestaurerSecours?: () => Promise<void>;
}

export const AuthBar: React.FC<AuthBarProps> = ({
  authSession,
  onUpdateSession,
  firebaseUser = null,
  statutSauvegarde = null,
  syncEnCours = false,
  onConnexionGoogle,
  onDeconnexionGoogle,
  onCopierSecours,
  onRestaurerSecours,
}) => {
  const [edition, setEdition] = useState(false);
  const [nom, setNom] = useState(authSession.nomAventurier);
  const [confirmerRestauration, setConfirmerRestauration] = useState(false);

  const sauvegarder = (e: React.FormEvent) => {
    e.preventDefault();
    if (nom.trim()) {
      onUpdateSession({ ...authSession, nomAventurier: nom.trim() });
      setEdition(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-[#5b4735]">
      <User className="w-3.5 h-3.5 text-[#8c6422] shrink-0" />
      {edition ? (
        <form onSubmit={sauvegarder} className="flex items-center gap-1.5">
          <input
            type="text"
            value={nom}
            onChange={e => setNom(e.target.value)}
            className="bg-[#fffdf7] border border-[#bfa574] px-2 py-0.5 rounded text-[#231a14] text-xs w-32 focus:outline-none focus:border-[#8c6422]"
            placeholder="Nom joueur"
          />
          <button type="submit" className="p-1 hover:text-emerald-800 cursor-pointer" title="Enregistrer session">
            <Check className="w-3.5 h-3.5 text-emerald-700" />
          </button>
        </form>
      ) : (
        <div className="flex items-center gap-1.5">
          <span className="text-[#231a14] font-semibold whitespace-nowrap">{authSession.nomAventurier}</span>
          <span className="text-[#8a7359] text-[11px] font-mono hidden sm:inline">({authSession.playerId})</span>
          <button
            onClick={() => setEdition(true)}
            className="p-1 text-[#8a7359] hover:text-[#231a14] transition-colors cursor-pointer"
            title="Modifier identifiant session"
          >
            <Edit2 className="w-3 h-3" />
          </button>
        </div>
      )}

      <span aria-hidden="true" className="text-[#bfa574]">·</span>

      {firebaseUser ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-[#3b2c1e] flex items-center gap-1 whitespace-nowrap">
            <Cloud className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
            <span>
              {statutSauvegarde?.primarySeq !== null && statutSauvegarde?.primarySeq !== undefined
                ? `Base #${statutSauvegarde.primarySeq}`
                : 'Base active'}
            </span>
            {statutSauvegarde?.backupSeq !== null && statutSauvegarde?.backupSeq !== undefined && (
              <span className="text-[#78624a] font-mono tabular-nums">
                · Secours #{statutSauvegarde.backupSeq}
              </span>
            )}
          </span>

          {onCopierSecours && (
            <button
              type="button"
              onClick={onCopierSecours}
              disabled={syncEnCours}
              title="Copier vers la base Firebase de secours"
              className="px-2 py-0.5 bg-[#fffdf7] hover:bg-[#efe4ca] border border-[#bfa574] rounded text-[11px] text-[#231a14] flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
            >
              <CloudUpload className="w-3 h-3 text-[#8c6422]" />
              Copier secours
            </button>
          )}

          {onRestaurerSecours && statutSauvegarde?.backupAvailable && (
            confirmerRestauration ? (
              <span className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={syncEnCours}
                  onClick={async () => {
                    await onRestaurerSecours();
                    setConfirmerRestauration(false);
                  }}
                  className="px-2 py-0.5 bg-amber-800 hover:bg-amber-900 text-white rounded text-[11px] cursor-pointer whitespace-nowrap"
                >
                  Confirmer
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmerRestauration(false)}
                  className="px-1.5 py-0.5 bg-white border border-[#bfa574] rounded text-[11px] cursor-pointer"
                >
                  Annuler
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmerRestauration(true)}
                disabled={syncEnCours}
                title="Restaurer depuis la base de secours"
                className="px-2 py-0.5 bg-[#fffdf7] hover:bg-[#efe4ca] border border-[#bfa574] rounded text-[11px] text-[#231a14] flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
              >
                <RotateCcw className="w-3 h-3 text-[#8c6422]" />
                Restaurer
              </button>
            )
          )}

          {onDeconnexionGoogle && (
            <button
              type="button"
              onClick={onDeconnexionGoogle}
              title={`Déconnecter ${firebaseUser.displayName || 'compte'}`}
              className="p-1 text-[#78624a] hover:text-rose-800 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ) : (
        onConnexionGoogle && (
          <button
            type="button"
            onClick={onConnexionGoogle}
            disabled={syncEnCours}
            className="px-2.5 py-0.5 bg-[#fffdf7] hover:bg-[#efe4ca] border border-[#bfa574] rounded text-[11px] font-medium text-[#231a14] flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
          >
            <Cloud className="w-3 h-3 text-[#8c6422]" />
            Sauvegarde Firebase
          </button>
        )
      )}
    </div>
  );
};
