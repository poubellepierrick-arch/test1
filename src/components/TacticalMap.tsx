import React, { useState } from 'react';
import {
  AzgaarClimateBias,
  AzgaarReliefPreset,
  AzgaarWorldState,
  HexNode,
  SimulationState,
} from '../types';
import { calculerDistanceHex, estimerCoutTrajet } from '../engine/hexcrawl';
import { RESSOURCES_CATALOGUE } from '../engine/worldEconomy';
import { AzgaarStudioView } from './AzgaarStudioView';
import { AzgaarGeneratorPanel } from './AzgaarGeneratorPanel';
import { Swords, Compass, Crosshair, PenTool, Globe, Shield } from 'lucide-react';

type PlayerLayerPreset = 'biomes' | 'politique' | 'economie' | 'cultures' | 'climat';

interface TacticalMapProps {
  etat: SimulationState;
  chargement?: boolean;
  cibleCombatSelectionnee?: string | null;
  hexSelectionne?: HexNode | null;
  estAgrandie?: boolean;
  onToggleAgrandir?: () => void;
  onSelectHex: (hex: HexNode) => void;
  onSelectCibleCombat: (cibleId: string) => void;
  onSyncAzgaar: (studio: AzgaarWorldState) => void;
  onAnnoterHex?: (hexId: string, note: string) => void;
  onGenererMonde?: (config: {
    seed: number;
    modeleRelief: AzgaarReliefPreset;
    climatBias: AzgaarClimateBias;
    rayonAnneaux: number;
    conserverHeros: boolean;
  }) => void;
  onRestaurerValGris?: () => void;
  onOuvrirForge?: () => void;
  onPromouvoirPnjs?: (npcIds: string[]) => void;
}

export const TacticalMap: React.FC<TacticalMapProps> = ({
  etat,
  chargement = false,
  cibleCombatSelectionnee,
  hexSelectionne,
  estAgrandie = false,
  onToggleAgrandir,
  onSelectHex,
  onSelectCibleCombat,
  onSyncAzgaar,
  onAnnoterHex,
  onGenererMonde,
  onRestaurerValGris,
  onOuvrirForge,
  onPromouvoirPnjs,
}) => {
  const [noteTexte, setNoteTexte] = useState('');
  const [afficherAtlas, setAfficherAtlas] = useState(false);

  const hexActuel = etat.hexActuel;
  const hexagones = etat.hexagones;
  const combat = etat.combat;
  const allure = etat.marcheAllure || 'Normale';
  const compagnons = etat.personnage.compagnons || [];
  const factions = etat.factions || [];
  const entitesMonde = etat.entitesMonde || [];
  const carteAzgaar = etat.carteAzgaar;
  const studio = etat.azgaarStudio;

  const hexActif = (hexSelectionne && hexagones.find(h => h.id === hexSelectionne.id)) || hexActuel;

  const coucheActive: PlayerLayerPreset = studio?.layers.cultures
    ? 'cultures'
    : studio?.layers.etats
    ? 'politique'
    : studio?.layers.vents
    ? 'climat'
    : studio?.layers.fluxCommerciaux && studio?.layers.ressources && !studio?.layers.etats
    ? 'economie'
    : 'biomes';
  const afficherBlasons = studio?.layers.blasons ?? true;

  const appliquerCouche = (preset: PlayerLayerPreset) => {
    if (!studio) return;
    onSyncAzgaar({
      ...studio,
      layers: {
        ...studio.layers,
        biomes: true,
        etats: preset === 'politique',
        cultures: preset === 'cultures',
        provinces: false,
        religions: false,
        vents: preset === 'climat',
        ressources: preset === 'economie' ? true : studio.layers.ressources ?? true,
        fluxCommerciaux: preset === 'economie' ? true : studio.layers.fluxCommerciaux ?? true,
      },
    });
  };

  const basculerBlasons = () => {
    if (!studio) return;
    onSyncAzgaar({
      ...studio,
      layers: {
        ...studio.layers,
        blasons: !(studio.layers.blasons ?? true),
      },
    });
  };

  // Mode Combat Actif
  if (combat.actif) {
    const combattantActifId = combat.ordreInitiative?.[combat.combattantActifIndex];
    const mercenaires = compagnons.filter(c => c.type === 'MERCENAIRE' && c.pv > 0);
    const labelTour =
      combattantActifId === 'player'
        ? 'Votre tour'
        : combat.ennemis.find(e => e.id === combattantActifId)?.nom ||
          mercenaires.find(m => `ally:${m.id}` === combattantActifId || m.id === combattantActifId)?.nom ||
          'En cours';

    return (
      <div className="dnd-panel border-rose-800/40 rounded-lg overflow-hidden text-xs">
        <div className="dnd-wood-header px-3.5 py-2.5 flex justify-between items-center gap-2">
          <div className="flex items-center gap-1.5 text-rose-200 font-display font-semibold tracking-wide">
            <Swords className="w-4 h-4 text-rose-400" />
            <span>Combat (Round {combat.round})</span>
          </div>
          <span className="text-[#decfae] text-[11px] font-mono truncate">
            {labelTour}
          </span>
        </div>

        <div className="p-3 space-y-2.5">
          {combat.ordreInitiative && combat.ordreInitiative.length > 0 && (
            <div className="bg-[#f5edd8] border border-[#cfb88c] px-2.5 py-1.5 rounded text-[10px] text-[#463626] font-mono flex flex-wrap gap-x-2 gap-y-0.5">
              <span className="text-[#6d5332] font-semibold">Init :</span>
              {combat.ordreInitiative.map((id, idx) => {
                const actif = idx === combat.combattantActifIndex;
                const nom =
                  id === 'player'
                    ? 'Héros'
                    : combat.ennemis.find(e => e.id === id)?.nom ||
                      mercenaires.find(m => `ally:${m.id}` === id || m.id === id)?.nom ||
                      id;
                const initVal = combat.initiatives?.[id];
                return (
                  <span key={`${id}_${idx}`} className={actif ? 'font-bold text-rose-800 underline' : ''}>
                    {nom}{initVal !== undefined ? `(${initVal})` : ''}
                  </span>
                );
              })}
            </div>
          )}

          <div className="space-y-2">
            {combat.ennemis.map(ennemi => {
              const isAlive = ennemi.statut === 'ACTIF';
              const isFled = ennemi.statut === 'FUITE';
              const estSelectionne = cibleCombatSelectionnee === ennemi.id;
              return (
                <div
                  key={ennemi.id}
                  onClick={() => isAlive && onSelectCibleCombat(ennemi.id)}
                  className={`p-2.5 rounded-lg border transition-colors cursor-pointer flex items-center justify-between ${
                    isAlive
                      ? estSelectionne
                        ? 'bg-rose-100/80 border-rose-700 ring-1 ring-rose-700/40'
                        : 'bg-rose-950/[0.05] border-rose-800/30 hover:border-rose-700'
                      : isFled
                      ? 'bg-[#f4ead4] border-[#cbb58b] text-[#78624a] opacity-70'
                      : 'bg-[#f4ead4] border-[#cbb58b] text-[#78624a] line-through opacity-55'
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 font-bold text-[#231a14]">
                      <Crosshair className="w-3.5 h-3.5 text-rose-700" />
                      <span>{ennemi.nom}</span>
                      <span className="text-[10px] text-[#6d5742] font-normal">({ennemi.type})</span>
                    </div>
                    <div className="text-[11px] text-[#5c4734] font-mono tabular-nums">
                      {ennemi.distancePieds} ft · CA {ennemi.ca} · {ennemi.comportement}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-rose-800 font-bold font-mono tabular-nums">
                      {ennemi.pv} / {ennemi.pvMax} PV
                    </div>
                    <div className="text-[10px] uppercase font-semibold text-[#6d5742]">
                      {ennemi.statut}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {mercenaires.length > 0 && (
            <div className="bg-emerald-50/70 border border-emerald-200 px-2.5 py-1.5 rounded text-[11px] text-emerald-950 flex flex-wrap gap-x-3">
              <span className="font-semibold">Alliés :</span>
              {mercenaires.map(m => (
                <span key={m.id} className="font-mono tabular-nums">
                  {m.nom} ({m.pv}/{m.pvMax} PV)
                </span>
              ))}
            </div>
          )}

          <div className="bg-[#f5edd8] border border-[#cfb88c] p-2.5 rounded-md max-h-24 overflow-y-auto space-y-1 text-[11px] text-[#463626] font-mono">
            <div className="text-[#6d5332] text-[10px] font-semibold uppercase">Rapports de combat</div>
            {combat.journalCombat.slice(-4).map((entry, idx) => (
              <div key={idx}>• {entry}</div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const handleSoumettreNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onAnnoterHex || !noteTexte.trim()) return;
    onAnnoterHex(hexActif.id, noteTexte.trim());
    setNoteTexte('');
  };

  const distanceSelection = calculerDistanceHex(hexActuel, hexActif);
  const estEauSelection = Boolean(hexActif.estEau);
  const coutSelection = distanceSelection === 1 && !estEauSelection ? estimerCoutTrajet(hexActif, allure) : null;

  return (
    <div className="dnd-panel rounded-lg overflow-hidden text-xs">
      <div className="dnd-wood-header px-3.5 py-2.5 flex flex-wrap justify-between items-center gap-2">
        <div className="flex items-center gap-1.5 font-display font-semibold tracking-wide text-[#f8f0dc]">
          <Compass className="w-4 h-4 text-[#dfba68]" />
          <span>{studio?.worldName || carteAzgaar?.nomMonde || 'Carte de la région'}</span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex items-center gap-0.5 bg-[#21170f] p-0.5 rounded border border-[#7c5d2a]">
            {(
              [
                { id: 'biomes', label: 'Biomes' },
                { id: 'politique', label: 'Politique' },
                { id: 'economie', label: 'Économie' },
                { id: 'cultures', label: 'Cultures' },
                { id: 'climat', label: 'Climat' },
              ] as const
            ).map(opt => (
              <button
                key={opt.id}
                type="button"
                onClick={() => appliquerCouche(opt.id)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  coucheActive === opt.id
                    ? 'bg-[#e5be6e] text-[#231a14]'
                    : 'text-[#decfae] hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={basculerBlasons}
            aria-pressed={afficherBlasons}
            className={`px-2 py-0.5 rounded border text-[10px] font-medium flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              afficherBlasons
                ? 'bg-[#e5be6e] text-[#231a14] border-[#e5be6e]'
                : 'bg-[#21170f] text-[#f4ead2] border-[#7c5d2a] hover:bg-[#382719]'
            }`}
          >
            <Shield className="w-3 h-3" />
            <span>Blasons</span>
          </button>

          {onGenererMonde && (
            <button
              type="button"
              onClick={() => setAfficherAtlas(v => !v)}
              data-testid="btn-toggle-atlas"
              className={`px-2 py-0.5 rounded border text-[10px] font-medium flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                afficherAtlas
                  ? 'bg-[#e5be6e] text-[#231a14] border-[#e5be6e]'
                  : 'bg-[#21170f] text-[#f4ead2] border-[#7c5d2a] hover:bg-[#382719]'
              }`}
            >
              <Globe className="w-3 h-3" />
              <span>Atlas</span>
            </button>
          )}
        </div>
      </div>

      <div className="p-3 space-y-2.5">
        {afficherAtlas && onGenererMonde && (
          <AzgaarGeneratorPanel
            carteAzgaar={carteAzgaar}
            chargement={chargement}
            onGenerer={onGenererMonde}
            onRestaurerValGris={onRestaurerValGris}
            onOuvrirForge={onOuvrirForge}
          />
        )}

        <AzgaarStudioView
          mode="tactique"
          etat={etat}
          chargement={chargement}
          hexSelectionneId={hexActif.id}
          onSelectHex={onSelectHex}
          estAgrandie={estAgrandie}
          onToggleAgrandir={onToggleAgrandir}
          onSyncAzgaar={onSyncAzgaar}
          onPromoteNpc={onPromouvoirPnjs ? id => onPromouvoirPnjs([id]) : undefined}
        />

        {/* Détails de l'hexagone sélectionné */}
        <div className="bg-[#f5edd8]/80 p-2.5 rounded-lg border border-[#cfb88c] space-y-1.5 text-[11px]">
          <div className="flex items-center justify-between text-[#463626] gap-2">
            <span className="truncate">
              Hex :{' '}
              <strong className="text-[#231a14] font-semibold">
                {hexActif.brouillard === 'INCONNU' ? 'Territoire inexploré' : hexActif.nom}
              </strong>
            </span>
            <span className="text-[10px] uppercase text-[#6d5742] font-mono shrink-0">
              {hexActif.brouillard || 'EXPLORE'}
            </span>
          </div>

          <div className="text-[10px] font-mono tabular-nums flex items-center justify-between gap-2">
            {distanceSelection === 0 ? (
              <span className="text-emerald-800 font-semibold">Position actuelle</span>
            ) : estEauSelection && hexActif.brouillard !== 'INCONNU' ? (
              <span className="text-sky-800 font-semibold">Mer infranchissable</span>
            ) : distanceSelection === 1 && coutSelection ? (
              <span className="text-emerald-800 font-semibold">
                Adjacent · ~{coutSelection.heures}h · {coutSelection.eauLitres}L eau ({allure})
              </span>
            ) : (
              <span className="text-amber-800">
                Hors portée directe ({distanceSelection} cases)
              </span>
            )}
          </div>

          {hexActif.brouillard !== 'INCONNU' && !estEauSelection && (
            <div className="space-y-0.5 text-[#5c4734]">
              <div className="flex justify-between gap-2">
                <span className="truncate">
                  {hexActif.pointInteret ? `${hexActif.pointInteret.nom}` : hexActif.biomeAzgaar || 'Nature sauvage'}
                  {hexActif.culture ? ` · ${hexActif.culture}` : ''}
                </span>
                <span className="shrink-0">{hexActif.securite}</span>
              </div>
              {(hexActif.ressourcePrincipale || hexActif.specialiteEconomique) && (
                <div className="text-[10px] text-[#5c4734]">
                  {hexActif.specialiteEconomique || 'Secteur'}
                  {hexActif.ressourcePrincipale
                    ? ` · ${RESSOURCES_CATALOGUE[hexActif.ressourcePrincipale]?.label || hexActif.ressourcePrincipale}`
                    : ''}
                </div>
              )}
              {hexActif.factionControleId && (
                <div className="text-[10px] text-[#6d5742]">
                  Contrôle : {factions.find(f => f.id === hexActif.factionControleId)?.nom || hexActif.factionControleId}
                </div>
              )}
              {entitesMonde
                .filter(e => e.statut === 'EN_ROUTE' && e.hexId === hexActif.id)
                .map(ent => (
                  <div key={ent.id} className="text-[10px] text-amber-900 font-medium">
                    Présence : {ent.nom}
                  </div>
                ))}
            </div>
          )}

          {hexActif.annotationJoueur && (
            <div className="text-sky-950 bg-sky-950/[0.05] border border-sky-800/25 p-2 rounded-md">
              Repère : « {hexActif.annotationJoueur} »
            </div>
          )}

          {onAnnoterHex && (
            <form onSubmit={handleSoumettreNote} className="flex gap-1.5 pt-1.5 border-t border-[#d6c298]">
              <input
                type="text"
                value={noteTexte}
                onChange={e => setNoteTexte(e.target.value)}
                placeholder="Annoter cet hex..."
                className="flex-1 bg-[#fffdf7] border border-[#bfa574] rounded px-2.5 py-1 text-[#231a14] placeholder-[#947d61] focus:outline-none focus:border-[#8c6422] text-[11px]"
              />
              <button
                type="submit"
                disabled={!noteTexte.trim()}
                className="px-2.5 py-1 dnd-wood-bar border disabled:opacity-40 rounded text-[10px] font-medium flex items-center gap-1 transition-opacity cursor-pointer"
              >
                <PenTool className="w-2.5 h-2.5 text-[#dfba68]" />
                <span>Noter</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
