import React, { useMemo, useState } from 'react';
import { SimulationState, WorldNpcRecord } from '../types';
import { hexEstDecouvert } from '../engine/epistemic';
import { Search, ScrollText, Users, Sparkles } from 'lucide-react';

interface WorldLoreCodexTabProps {
  mode: 'lore' | 'pnjs';
  etat: SimulationState;
  chargement?: boolean;
  onPromouvoirPnj?: (npcIds: string[]) => void;
}

const TIER_LABEL: Record<WorldNpcRecord['tier'], string> = {
  MAJEUR_MONDE: 'Figure du monde',
  LIEN_HEROS: 'Lien du héros',
  PROCHE_PREGEN: 'Voisinage',
  LAMBDA_LOINTAIN: 'Habitant lointain',
};

export const WorldLoreCodexTab: React.FC<WorldLoreCodexTabProps> = ({
  mode,
  etat,
  chargement = false,
  onPromouvoirPnj,
}) => {
  const [recherche, setRecherche] = useState('');
  const [filtreTier, setFiltreTier] = useState<'TOUT' | WorldNpcRecord['tier']>('TOUT');
  const [npcIdActif, setNpcIdActif] = useState<string | null>(null);

  const decouvertsIds = useMemo(
    () =>
      new Set(
        (etat.hexagones || [])
          .filter(h => hexEstDecouvert(h, etat.hexActuel.id))
          .map(h => h.id)
      ),
    [etat.hexagones, etat.hexActuel.id]
  );

  const lore = etat.loreMonde;
  const regionsVisibles = useMemo(() => {
    if (!lore) return [];
    return (lore.regionsLore || []).filter(reg => {
      if (reg.hexId && decouvertsIds.has(reg.hexId)) return true;
      if (reg.burgId && reg.burgId === etat.azgaarStudio?.heroBurgId) return true;
      return false;
    });
  }, [lore, decouvertsIds, etat.azgaarStudio?.heroBurgId]);

  const pnjsVisibles = useMemo(() => {
    const list = (etat.pnjsMonde || []).filter(p => {
      if (
        p.tier === 'MAJEUR_MONDE' ||
        p.tier === 'LIEN_HEROS' ||
        p.tier === 'PROCHE_PREGEN' ||
        p.decouvertParJoueur
      ) {
        return true;
      }
      return Boolean(p.hexId && decouvertsIds.has(p.hexId));
    });
    const q = recherche.trim().toLowerCase();
    return list
      .filter(p => (filtreTier === 'TOUT' ? true : p.tier === filtreTier))
      .filter(p =>
        !q
          ? true
          : p.nom.toLowerCase().includes(q) ||
            p.profession.toLowerCase().includes(q) ||
            (p.lienHerosNature || '').toLowerCase().includes(q)
      )
      .sort((a, b) => b.proximityScore - a.proximityScore);
  }, [etat.pnjsMonde, decouvertsIds, recherche, filtreTier]);

  const npcSelectionne =
    pnjsVisibles.find(p => p.id === npcIdActif) || pnjsVisibles[0] || null;

  if (mode === 'lore') {
    if (!lore) {
      return (
        <div className="bg-[#f5edd8] border border-[#cfb88c] rounded-lg p-4 text-xs text-[#5c4734]">
          Aucune chronique de monde enregistrée pour cette campagne. Lancez la forge du monde pour en composer une.
        </div>
      );
    }

    return (
      <div className="space-y-3 text-xs text-[#231a14]">
        <div className="bg-[#f5edd8] border border-[#cfb88c] rounded-lg p-3.5 space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-display font-bold text-sm text-[#2a1d13] flex items-center gap-1.5">
              <ScrollText className="w-4 h-4 text-[#8c6422]" />
              <span>Genèse de {etat.azgaarStudio?.worldName || 'ce monde'}</span>
            </div>
            <span className="font-mono text-[10px] text-[#6d5742]">
              {lore.tonalite}
            </span>
          </div>
          <p className="font-journal text-[13px] leading-relaxed text-[#2c2017]">{lore.genese}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="bg-[#f5edd8] border border-[#cfb88c] rounded-lg p-3.5 space-y-2">
            <div className="font-display font-bold text-xs text-[#2a1d13]">Grandes Ères</div>
            {lore.chroniqueEres.map(era => (
              <div key={era.id} className="bg-[#fffdf7] border border-[#d6c298] rounded p-2.5 space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-[#231a14]">{era.titre}</span>
                  <span className="font-mono text-[10px] text-[#6d5742]">{era.periode}</span>
                </div>
                <p className="text-[11px] text-[#463626] leading-snug">{era.resume}</p>
                <div className="text-[10px] text-[#6d5742]">Traces : {era.tracesActuelles}</div>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <div className="bg-[#f5edd8] border border-[#cfb88c] rounded-lg p-3.5 space-y-2">
              <div className="font-display font-bold text-xs text-[#2a1d13]">États &amp; Royaumes connus</div>
              {lore.etatsLore.map(st => (
                <div key={st.stateId} className="bg-[#fffdf7] border border-[#d6c298] rounded p-2.5 space-y-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{st.nom}</span>
                    <span className="font-journal italic text-[11px] text-[#6d5742]">« {st.devise} »</span>
                  </div>
                  <p className="text-[11px] text-[#463626]">{st.histoire}</p>
                </div>
              ))}
            </div>

            <div className="bg-[#f5edd8] border border-[#cfb88c] rounded-lg p-3.5 space-y-2">
              <div className="font-display font-bold text-xs text-[#2a1d13]">Cultes &amp; Traditions</div>
              {lore.religionsLore.map(rel => (
                <div key={rel.religionId} className="bg-[#fffdf7] border border-[#d6c298] rounded p-2.5 space-y-0.5">
                  <div className="font-semibold">{rel.nom}</div>
                  <p className="text-[11px] text-[#463626]">{rel.dogme}</p>
                  <div className="text-[10px] text-[#6d5742]">Rites : {rel.rites}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-[#f5edd8] border border-[#cfb88c] rounded-lg p-3.5 space-y-2">
          <div className="font-display font-bold text-xs text-[#2a1d13]">
            Lieux découverts &amp; traditions locales ({regionsVisibles.length})
          </div>
          {regionsVisibles.length === 0 ? (
            <div className="text-[11px] text-[#6d5742]">
              Explorez les alentours pour consigner les légendes et coutumes de chaque bourgade.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {regionsVisibles.map(reg => (
                <div key={reg.id} className="bg-[#fffdf7] border border-[#d6c298] rounded p-2.5 space-y-1">
                  <div className="font-semibold text-[#231a14]">{reg.nom}</div>
                  <p className="text-[11px] text-[#463626]">{reg.histoireLocale}</p>
                  <div className="text-[11px] text-[#5c4734] italic">« {reg.legendePopulaire} »</div>
                  <div className="text-[10px] text-[#6d5742]">{reg.particulariteEconomique}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Mode 'pnjs' (strictement sans secrets Strate 2)
  return (
    <div className="space-y-3 text-xs text-[#231a14]">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap items-center gap-1 bg-[#efe5cb] border border-[#cfb88c] p-1 rounded-md">
          {(
            [
              { id: 'TOUT', label: 'Tous' },
              { id: 'MAJEUR_MONDE', label: 'Figures du monde' },
              { id: 'LIEN_HEROS', label: 'Liens du héros' },
              { id: 'PROCHE_PREGEN', label: 'Voisinage' },
              { id: 'LAMBDA_LOINTAIN', label: 'Rencontrés' },
            ] as const
          ).map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFiltreTier(tab.id)}
              className={`px-2.5 py-1 rounded text-[11px] font-medium whitespace-nowrap shrink-0 cursor-pointer ${
                filtreTier === tab.id ? 'dnd-wood-bar' : 'text-[#5c4734] hover:text-[#231a14]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-3.5 h-3.5 text-[#7a6448] absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={recherche}
            onChange={e => setRecherche(e.target.value)}
            placeholder="Nom, métier ou lien..."
            className="w-full pl-8 pr-2 py-1.5 bg-[#fffdf7] border border-[#bfa574] rounded text-xs focus:outline-none focus:border-[#8c6422]"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <div className="lg:col-span-5 space-y-1.5 max-h-[500px] overflow-y-auto pr-1">
          {pnjsVisibles.length === 0 ? (
            <div className="bg-[#f5edd8] border border-[#cfb88c] rounded p-4 text-center text-[#6d5742]">
              Aucun PNJ répertorié dans ce filtre.
            </div>
          ) : (
            pnjsVisibles.map(p => {
              const actif = npcSelectionne?.id === p.id;
              const lieu =
                etat.azgaarStudio?.burgs.find(b => b.id === p.burgId)?.name ||
                etat.hexagones.find(h => h.id === p.hexId)?.nom ||
                'Secteur extérieur';
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setNpcIdActif(p.id)}
                  className={`w-full text-left p-2.5 rounded-md border transition-colors cursor-pointer ${
                    actif
                      ? 'bg-[#fbf5e6] border-[#b48a3e] text-[#231a14]'
                      : 'bg-[#f5edd8] border-[#d6c298] text-[#463626] hover:border-[#b48a3e]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold truncate">{p.nom}</span>
                    <span className="font-mono text-[10px] text-[#6d5742] shrink-0 tabular-nums">
                      {p.distanceHex} hex
                    </span>
                  </div>
                  <div className="text-[11px] text-[#5c4734] truncate">
                    {p.profession} · {lieu} · {TIER_LABEL[p.tier]}
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="lg:col-span-7 bg-[#f5edd8] border border-[#cfb88c] rounded-lg p-4">
          {npcSelectionne ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[#d6c298] pb-2.5">
                <div>
                  <div className="font-display font-bold text-base text-[#2a1d13] flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-[#8c6422]" />
                    <span>{npcSelectionne.nom}</span>
                  </div>
                  <div className="text-[11px] text-[#5c4734]">
                    {npcSelectionne.profession} · {TIER_LABEL[npcSelectionne.tier]} · Attitude :{' '}
                    {npcSelectionne.disposition}
                  </div>
                </div>
                {npcSelectionne.detailLevel === 'LEGER' && onPromouvoirPnj && (
                  <button
                    type="button"
                    disabled={chargement}
                    onClick={() => onPromouvoirPnj([npcSelectionne.id])}
                    className="px-2.5 py-1 rounded border border-[#b48a3e] bg-[#fffdf7] hover:bg-[#efe4ca] text-[11px] font-medium flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40"
                  >
                    <Sparkles className="w-3 h-3 text-[#8c6422]" />
                    <span>Détailler ce PNJ</span>
                  </button>
                )}
              </div>

              {npcSelectionne.lienHerosNature && (
                <div className="bg-[#fffdf7] border border-[#d6c298] rounded px-3 py-2 text-[11px] text-[#3a2817]">
                  <strong>Lien connu :</strong> {npcSelectionne.lienHerosNature}
                </div>
              )}

              <div className="space-y-1.5 text-[12px] text-[#3a2817]">
                <div>
                  <strong>Apparence :</strong> {npcSelectionne.apparence}
                </div>
                <div>
                  <strong>Voix &amp; manie :</strong> {npcSelectionne.voixEtManies}
                </div>
                <div>
                  <strong>Ce que l’on sait :</strong> {npcSelectionne.biographie}
                </div>
              </div>

              {npcSelectionne.rumeurConnue && (
                <div className="bg-[#fffdf7] border border-[#d6c298] rounded p-2.5 space-y-0.5 text-[11px]">
                  <div className="font-semibold text-[#2a1d13]">
                    Écho local : {npcSelectionne.rumeurConnue.titre}
                  </div>
                  <div className="text-[#463626]">{npcSelectionne.rumeurConnue.texte}</div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-[#6d5742] text-center py-6">
              Sélectionnez un personnage pour consulter sa fiche publique.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
