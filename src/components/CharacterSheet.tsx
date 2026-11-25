import React, { useState } from 'react';
import { CharacterStats } from '../types';
import { calculerModificateur } from '../engine/dice';
import { evaluerEncombrement } from '../engine/srd';
import {
  estObjetConsommable,
  estObjetEquipable,
  evaluerVitesseEffective,
} from '../engine/character';
import { ActionRequest } from '../engine/adjudication';
import { ItemIcon } from '../utils/itemIcons';
import { ItemIllustrationInline, ItemImageTrigger } from './ItemIllustrationInline';
import { HeroManagerPanel } from './HeroManagerPanel';
import { obtenirFicheSrd } from '../engine/compendium';
import { Heart, Shield, Zap, Skull, AlertTriangle, Sparkles, Flame, UserCog } from 'lucide-react';

interface CharacterSheetProps {
  personnage: CharacterStats;
  chargement?: boolean;
  onExecuterAction?: (action: ActionRequest) => void;
  onAnalyserImportHeros?: (
    rawText: string,
    files: Array<{ nom: string; contenu: string }>,
    signal?: AbortSignal
  ) => Promise<{ hero: any; sourceMode: string }>;
}

export const CharacterSheet: React.FC<CharacterSheetProps> = ({
  personnage,
  chargement = false,
  onExecuterAction,
  onAnalyserImportHeros,
}) => {
  const [objetIllustreId, setObjetIllustreId] = useState<string | null>(null);
  const [gestionOuverte, setGestionOuverte] = useState(false);
  const [confirmJeterId, setConfirmJeterId] = useState<string | null>(null);

  const charge = evaluerEncombrement(personnage);
  const vitesseEffective = evaluerVitesseEffective(personnage);

  const pvRatio = Math.max(0, Math.min(1, personnage.pvActuels / personnage.pvMax));
  const getPvBarColor = () => {
    if (pvRatio <= 0.25) return 'bg-rose-700';
    if (pvRatio <= 0.5) return 'bg-amber-600';
    return 'bg-emerald-700';
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

  const lumiere = personnage.sourceLumiere;
  const aTorcheInventaire = personnage.inventaire.some(i => i.nom.toLowerCase().includes('torche'));

  return (
    <div className="dnd-panel rounded-lg overflow-hidden text-xs text-[#3b2c1e]">
      {/* En-tête Aventurier façon bois & laiton */}
      <div className="dnd-wood-header px-3.5 py-2.5 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="font-display font-semibold tracking-wide text-[#f8f0dc] text-sm truncate">
            {personnage.nom}
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[11px] text-[#e4cfa3] font-medium">
              Niv {personnage.niveau} · {personnage.race ? `${personnage.race} · ` : ''}{personnage.classe}
            </span>
            {onExecuterAction && (
              <button
                type="button"
                onClick={() => setGestionOuverte(prev => !prev)}
                className="px-1.5 py-0.5 rounded bg-[#4a3623] hover:bg-[#5e452e] text-[#f5ebd6] text-[10px] flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                title="Fiche, documents et import"
              >
                <UserCog className="w-3 h-3 text-[#dfba68]" />
                <span>Héros</span>
              </button>
            )}
          </div>
        </div>
        {(personnage.historique || (personnage.capacites && personnage.capacites.length > 0)) && (
          <div className="text-[10px] text-[#d6c298] truncate">
            {[personnage.historique, ...(personnage.capacites || []).slice(0, 3)].filter(Boolean).join(' · ')}
          </div>
        )}
        {personnage.estMortDefinitivement && (
          <div className="mt-2 flex items-center gap-1.5 text-rose-200 font-bold bg-rose-950/60 border border-rose-500/40 p-1.5 rounded text-xs">
            <Skull className="w-4 h-4 text-rose-300" />
            <span>DÉCÉDÉ (PERMADEATH)</span>
          </div>
        )}
      </div>

      <div className="p-3.5 space-y-3.5">
        {gestionOuverte && onExecuterAction && (
          <HeroManagerPanel
            personnage={personnage}
            chargement={chargement}
            onExecuterAction={onExecuterAction}
            onAnalyserImportHeros={onAnalyserImportHeros}
            onFermer={() => setGestionOuverte(false)}
          />
        )}

        {/* PV, CA & Vitesse */}
        <div className="space-y-2">
          <div>
            <div className="flex justify-between items-center mb-1 text-xs">
              <span className="flex items-center gap-1 text-[#5c4734] font-medium">
                <Heart className="w-3.5 h-3.5 text-rose-700" />
                Points de vie
              </span>
              <span className="font-bold text-[#231a14] font-mono tabular-nums">
                {personnage.pvActuels} / {personnage.pvMax}
              </span>
            </div>
            <div className="w-full bg-[#e6dac0] h-2.5 rounded-full overflow-hidden border border-[#c3aa7a]">
              <div
                className={`h-full transition-all duration-300 ${getPvBarColor()}`}
                style={{ width: `${pvRatio * 100}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-center pt-0.5">
            <div className="bg-[#f5edd8] border border-[#cfb88c] p-2 rounded-md flex items-center justify-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-[#7c5620]" />
              <span className="text-[#6d5742]">CA</span>
              <span className="font-bold text-[#231a14] font-mono tabular-nums">{personnage.ca}</span>
            </div>
            <div className="bg-[#f5edd8] border border-[#cfb88c] p-2 rounded-md flex items-center justify-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-[#9c6f21]" />
              <span className="text-[#6d5742]">Vit.</span>
              <span className="font-bold text-[#231a14] font-mono tabular-nums">
                {vitesseEffective} ft
              </span>
            </div>
          </div>
        </div>

        {/* Source de lumière */}
        <div className="bg-[#f5edd8]/75 border border-[#cfb88c] p-2 rounded-md flex items-center justify-between gap-2 text-[11px]">
          <span className="flex items-center gap-1.5 min-w-0 truncate">
            <Flame className={`w-3.5 h-3.5 shrink-0 ${lumiere?.active ? 'text-amber-600' : 'text-[#8a7359]'}`} />
            <span className="truncate">
              {lumiere ? `${lumiere.nom} · ${lumiere.heuresRestantes.toFixed(1)}h` : 'Aucune torche'}
              {lumiere?.active ? ' · Allumée' : ''}
            </span>
          </span>
          {onExecuterAction && (lumiere?.heuresRestantes || aTorcheInventaire) ? (
            <button
              type="button"
              onClick={() => onExecuterAction({ type: 'BASCULER_LUMIERE' })}
              disabled={chargement}
              className="px-2 py-0.5 bg-white hover:bg-amber-50 border border-[#bfa574] rounded text-[10px] font-medium whitespace-nowrap shrink-0 cursor-pointer"
            >
              {lumiere?.active ? 'Éteindre' : 'Allumer'}
            </button>
          ) : null}
        </div>

        {/* Sauvegardes contre la mort */}
        {personnage.pvActuels === 0 && !personnage.estMortDefinitivement && (
          <div className="bg-rose-50/90 border border-rose-300 p-2.5 rounded-md space-y-1">
            <div className="flex items-center gap-1 text-rose-900 font-semibold text-xs">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-700" />
              <span>Sauvegardes contre la mort</span>
            </div>
            <div className="flex justify-between text-[11px] font-mono tabular-nums">
              <span>Succès :</span>
              <span className="text-emerald-800 font-bold">{personnage.deathSaves.succes} / 3</span>
            </div>
            <div className="flex justify-between text-[11px] font-mono tabular-nums">
              <span>Échecs :</span>
              <span className="text-rose-800 font-bold">{personnage.deathSaves.echecs} / 3</span>
            </div>
          </div>
        )}

        {/* Épuisement */}
        <div className="bg-[#f5edd8]/75 border border-[#cfb88c] p-2.5 rounded-md">
          <div className="flex justify-between items-center text-xs">
            <span className="text-[#5c4734] font-medium">Épuisement</span>
            <span className={`font-mono tabular-nums font-bold ${personnage.epuisement > 0 ? 'text-amber-800' : 'text-[#231a14]'}`}>
              {personnage.epuisement} / 6
            </span>
          </div>
          <p className="text-[11px] text-[#6d5742] mt-1 leading-snug">
            {getEpuisementTexte(personnage.epuisement)}
          </p>
        </div>

        {/* Caractéristiques façon blasons */}
        <div>
          <div className="font-display text-[#6d5332] font-semibold mb-1.5 text-[11px] tracking-wider uppercase">
            Caractéristiques
          </div>
          <div className="grid grid-cols-3 gap-1.5 text-center">
            {(Object.entries(personnage.caracteristiques) as [string, number][]).map(([carac, val]) => {
              const mod = calculerModificateur(val);
              const modStr = mod >= 0 ? `+${mod}` : `${mod}`;
              return (
                <div key={carac} className="bg-[#f5edd8] border border-[#cbb384] p-1.5 rounded-md">
                  <div className="font-display text-[10px] text-[#6d5332] font-semibold">{carac}</div>
                  <div className="font-bold text-[#231a14] text-sm font-mono tabular-nums">{val}</div>
                  <div className="text-[11px] text-[#8c5a18] font-semibold font-mono tabular-nums">{modStr}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Emplacements de Sorts */}
        {personnage.emplacementsSorts.length > 0 && (
          <div className="bg-[#f5edd8]/75 border border-[#cfb88c] p-2.5 rounded-md space-y-1">
            <div className="flex items-center gap-1.5 text-[#42325d] text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-indigo-800" />
              <span>Emplacements de sorts</span>
            </div>
            {personnage.emplacementsSorts.map(slot => (
              <div key={slot.niveau} className="flex justify-between text-[11px] font-mono tabular-nums">
                <span className="text-[#5c4734]">Niv {slot.niveau} ({slot.recharge})</span>
                <span className="font-bold text-[#231a14]">{slot.total - slot.utilise} / {slot.total}</span>
              </div>
            ))}
          </div>
        )}

        {/* Inventaire */}
        <div>
          <div className="flex justify-between items-center font-display text-[#6d5332] font-semibold mb-1 text-[11px] tracking-wider uppercase">
            <span>Besace</span>
            <span className="font-sans text-[10px] text-[#78624a] font-mono normal-case">{charge.statut}</span>
          </div>
          <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
            {personnage.inventaire.map(item => {
              const estOuvert = objetIllustreId === item.id;
              const ficheSrd = item.compendiumId ? obtenirFicheSrd(item.compendiumId) : obtenirFicheSrd(item.nom);
              const srdObj = ficheSrd?.categorie === 'objet' ? ficheSrd : undefined;
              const usure = personnage.usureEquipement?.[item.id] ?? 0;
              const equipable = estObjetEquipable(item);
              const consommable = estObjetConsommable(item);
              const demandeConfirmJeter = Boolean(item.estEquipe || item.valeurPO >= 5);

              return (
                <div key={item.id} className="bg-[#f6efe0] px-2 py-1.5 rounded border border-[#d6c298] text-[11px] space-y-1">
                  <div className="flex justify-between items-center gap-1.5">
                    <span className="flex items-center gap-1.5 text-[#2a1f16] min-w-0">
                      <ItemIcon
                        item={{
                          id: item.id,
                          compendiumId: item.compendiumId,
                          nom: item.nom,
                          categorie: item.categorie,
                          sousCategorie: srdObj?.sousCategorie,
                          motsCles: srdObj?.motsCles,
                        }}
                      />
                      <span className="truncate">
                        {item.nom}
                        {item.quantite > 1 ? ` x${item.quantite}` : ''}
                        {item.estEquipe ? ' · Équipé' : ''}
                        {usure >= 100 ? ' · Brisé' : usure >= 75 ? ` · Usé ${usure}%` : ''}
                      </span>
                    </span>
                    <span className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[#6d5742] font-mono tabular-nums">
                        {item.poidsLbs * item.quantite} lbs
                      </span>
                      <ItemImageTrigger
                        ouvert={estOuvert}
                        onToggle={() => setObjetIllustreId(estOuvert ? null : item.id)}
                      />
                    </span>
                  </div>

                  {onExecuterAction && (
                    <div className="flex items-center justify-end gap-1 flex-wrap">
                      {equipable && (
                        <button
                          type="button"
                          onClick={() => onExecuterAction({ type: 'EQUIPER_OBJET', cibleId: item.id })}
                          disabled={chargement}
                          className="px-1.5 py-0.5 bg-white hover:bg-amber-50 border border-[#cbb384] rounded text-[10px] text-[#3b2c1e] whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          {item.estEquipe ? 'Retirer' : 'Équiper'}
                        </button>
                      )}
                      {consommable && (
                        <button
                          type="button"
                          onClick={() => onExecuterAction({ type: 'UTILISER_OBJET', cibleId: item.id })}
                          disabled={chargement}
                          className="px-1.5 py-0.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded text-[10px] text-emerald-900 whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          Utiliser
                        </button>
                      )}
                      {confirmJeterId === item.id ? (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              onExecuterAction({ type: 'JETER_OBJET', cibleId: item.id, quantite: 1 });
                              setConfirmJeterId(null);
                            }}
                            disabled={chargement}
                            className="px-1.5 py-0.5 bg-rose-700 text-white rounded text-[10px] whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            Confirmer ?
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmJeterId(null)}
                            className="px-1.5 py-0.5 bg-white border border-stone-300 rounded text-[10px] whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            Non
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            if (demandeConfirmJeter) {
                              setConfirmJeterId(item.id);
                            } else {
                              onExecuterAction({ type: 'JETER_OBJET', cibleId: item.id, quantite: 1 });
                            }
                          }}
                          disabled={chargement}
                          className="px-1.5 py-0.5 bg-white hover:bg-rose-50 border border-[#d6c298] rounded text-[10px] text-[#6d5742] hover:text-rose-800 whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          Jeter
                        </button>
                      )}
                    </div>
                  )}

                  {estOuvert && (
                    <ItemIllustrationInline
                      item={{
                        itemId: item.compendiumId || item.id,
                        nom: item.nom,
                        nomEn: srdObj?.nomEn,
                        sousCategorie: srdObj?.sousCategorie || item.categorie,
                        rarete: srdObj?.rarete,
                        effet: srdObj?.effet,
                        degats: item.degats || srdObj?.degats,
                        caBase: item.caBase || srdObj?.caBase,
                      }}
                      onClose={() => setObjetIllustreId(null)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

