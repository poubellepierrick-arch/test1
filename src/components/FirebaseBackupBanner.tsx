import React, { useState } from 'react';
import { DualSaveStatus } from '../firebase/saveService';
import { AlertTriangle, Check, RefreshCw, ShieldCheck, X } from 'lucide-react';

interface FirebaseBackupBannerProps {
  connecte: boolean;
  statutSauvegarde: DualSaveStatus | null;
  syncEnCours: boolean;
  messageSync: string | null;
  onRestaurerSecours: () => Promise<void>;
  onCopierSecours: () => Promise<void>;
  onFermerMessage: () => void;
}

export const FirebaseBackupBanner: React.FC<FirebaseBackupBannerProps> = ({
  connecte,
  statutSauvegarde,
  syncEnCours,
  messageSync,
  onRestaurerSecours,
  onCopierSecours,
  onFermerMessage,
}) => {
  const [confirmerRestauration, setConfirmerRestauration] = useState(false);

  if (!connecte) return null;

  const alerteCorruption =
    statutSauvegarde && (!statutSauvegarde.primaryHealthy || statutSauvegarde.restoredFromBackup);

  if (!alerteCorruption && !messageSync) return null;

  return (
    <div className="space-y-2">
      {alerteCorruption && (
        <div className="bg-amber-50 border border-amber-400 text-amber-950 px-3 py-2 rounded-lg text-xs flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
            <span className="truncate">
              {statutSauvegarde.primaryCorruptionReason
                ? `Base principale altérée (${statutSauvegarde.primaryCorruptionReason}) · Secours chargé.`
                : 'Partie chargée depuis la base de secours.'}
            </span>
          </div>

          {statutSauvegarde.backupAvailable && (
            <div className="flex items-center gap-1.5 shrink-0">
              {confirmerRestauration ? (
                <>
                  <button
                    type="button"
                    disabled={syncEnCours}
                    onClick={async () => {
                      await onRestaurerSecours();
                      setConfirmerRestauration(false);
                    }}
                    className="px-2.5 py-1 bg-amber-800 hover:bg-amber-900 text-white rounded text-[11px] font-medium flex items-center gap-1 cursor-pointer"
                  >
                    <Check className="w-3 h-3" />
                    Confirmer
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmerRestauration(false)}
                    className="px-2 py-1 bg-white border border-amber-300 text-amber-900 rounded text-[11px] cursor-pointer"
                  >
                    Annuler
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  disabled={syncEnCours}
                  onClick={() => setConfirmerRestauration(true)}
                  className="px-2.5 py-1 bg-amber-800 hover:bg-amber-900 text-white rounded text-[11px] font-medium flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${syncEnCours ? 'animate-spin' : ''}`} />
                  Réparer base principale
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {messageSync && (
        <div className="bg-[#f5edd8] border border-[#c6ab77] text-[#3b2c1e] px-3 py-1.5 rounded-lg text-xs flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-800 shrink-0" />
            <span>{messageSync}</span>
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={syncEnCours}
              onClick={onCopierSecours}
              className="text-[11px] text-[#7c5319] hover:text-[#231a14] underline cursor-pointer"
            >
              Actualiser secours
            </button>
            <button
              type="button"
              onClick={onFermerMessage}
              className="p-0.5 text-[#78624a] hover:text-[#231a14] cursor-pointer"
              title="Fermer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
