import React, { useMemo, useState } from 'react';
import { SimulationState } from '../types';
import { ActionRequest } from '../engine/adjudication';
import { construireVueEpistemiqueHeros } from '../engine/epistemic';
import { Eye, Compass, Brain, Radio, Flag, Check, X } from 'lucide-react';

interface HeroKnowledgePanelProps {
  etat: SimulationState;
  chargement?: boolean;
  onExecuterAction?: (action: ActionRequest) => void;
}

type OngletSavoir = 'percu' | 'connu' | 'souvenirs' | 'rumeurs' | 'offres';

export const HeroKnowledgePanel: React.FC<HeroKnowledgePanelProps> = ({
  etat,
  chargement = false,
  onExecuterAction,
}) => {
  const [onglet, setOnglet] = useState<OngletSavoir>('percu');
  const vue = useMemo(() => construireVueEpistemiqueHeros(etat), [etat]);

  const onglets: Array<{ id: OngletSavoir; label: string; count?: number; icon: React.ReactNode }> = [
    { id: 'percu', label: 'Perçu', icon: <Eye className="w-3 h-3" /> },
    {
      id: 'connu',
      label: 'Connu',
      count: vue.savoirVerifie.lieuxDecouverts.length,
      icon: <Compass className="w-3 h-3" />,
    },
    { id: 'souvenirs', label: 'Souvenirs', icon: <Brain className="w-3 h-3" /> },
    {
      id: 'rumeurs',
      label: 'Rumeurs',
      count: vue.souvenirsEtOuieDire.rumeursEntendues.length,
      icon: <Radio className="w-3 h-3" />,
    },
    {
      id: 'offres',
      label: 'Offres',
      count: vue.savoirVerifie.propositionsEnAttente.length,
      icon: <Flag className="w-3 h-3" />,
    },
  ];

  const libelleStatutQuete = (statut: string) => {
    if (statut === 'ACCOMPLIE') return 'Tenue';
    if (statut === 'TRAHIE') return 'Trahie';
    if (statut === 'EXPIREE') return 'Expirée';
    return 'En cours';
  };

  const libelleRumeur = (statut: 'INCERTAINE' | 'CONFIRMEE' | 'DEMENTIE') => {
    if (statut === 'CONFIRMEE') return 'Confirmée';
    if (statut === 'DEMENTIE') return 'Démentie';
    return 'Incertaine';
  };

  return (
    <div className="dnd-panel rounded-lg p-3.5 text-xs space-y-2.5 text-[#3b2c1e]">
      <div className="flex items-center justify-between border-b border-[#d6c298] pb-2 gap-2">
        <div className="flex items-center gap-1.5 font-display font-semibold text-[#2a1d13] text-xs">
          <Eye className="w-4 h-4 text-[#9c6f21] shrink-0" />
          <span>Savoir du héros</span>
        </div>
        <span className="text-[11px] text-[#78624a] truncate">
          {vue.perceptionImmediate.lieuActuel.nom} · {vue.perceptionImmediate.lieuActuel.meteo}
        </span>
      </div>

      {/* Onglets sobres sans pilules */}
      <div className="flex flex-wrap gap-1 border-b border-[#d6c298] pb-2">
        {onglets.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setOnglet(t.id)}
            className={`px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 cursor-pointer transition-colors ${
              onglet === t.id
                ? 'dnd-wood-bar border text-[#f8f0dc]'
                : 'bg-[#f5edd8] hover:bg-[#ebe0c3] border border-[#d6c298] text-[#5c4734]'
            }`}
          >
            {t.icon}
            <span>{t.label}</span>
            {typeof t.count === 'number' && t.count > 0 && (
              <span className="font-mono text-[10px] opacity-80">({t.count})</span>
            )}
          </button>
        ))}
      </div>

      {onglet === 'percu' && (
        <div className="space-y-2">
          <div className="bg-[#f5edd8]/75 border border-[#cfb88c] rounded-md p-2.5 space-y-1">
            <div className="font-semibold text-[11px] text-[#2a1d13]">Position</div>
            <div className="text-[11px] text-[#463626]">
              {vue.perceptionImmediate.lieuActuel.nom} [{vue.perceptionImmediate.lieuActuel.q},
              {vue.perceptionImmediate.lieuActuel.r}] · {vue.perceptionImmediate.lieuActuel.biome} ·{' '}
              {vue.perceptionImmediate.lieuActuel.securite}
            </div>
            {vue.perceptionImmediate.lieuActuel.pointInteret && (
              <div className="text-[11px] text-[#6d5742]">
                Site : {vue.perceptionImmediate.lieuActuel.pointInteret}
              </div>
            )}
            {vue.perceptionImmediate.donjonActuel && (
              <div className="text-[11px] text-[#5c3d19]">
                Salle : {vue.perceptionImmediate.donjonActuel.salleNom} —{' '}
                {vue.perceptionImmediate.donjonActuel.description}
              </div>
            )}
          </div>

          <div className="bg-[#f5edd8]/75 border border-[#cfb88c] rounded-md p-2.5 space-y-1">
            <div className="font-semibold text-[11px] text-[#2a1d13]">En vue</div>
            {vue.perceptionImmediate.pnjsEnVue.length === 0 &&
            vue.perceptionImmediate.entitesEnVue.length === 0 ? (
              <div className="text-[11px] text-[#8a7359]">Aucun interlocuteur ni convoi en vue.</div>
            ) : (
              <div className="space-y-1">
                {vue.perceptionImmediate.pnjsEnVue.map(p => (
                  <div key={p.id} className="text-[11px] text-[#463626]">
                    • {p.nom} ({p.profession}, {p.disposition.toLowerCase()} · {p.humeur})
                  </div>
                ))}
                {vue.perceptionImmediate.entitesEnVue.map(e => (
                  <div key={e.id} className="text-[11px] text-[#463626]">
                    • {e.nom} ({e.type}) — {e.lieu}
                    {e.destinationConnue ? ` → ${e.destinationConnue}` : ''}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-[#f5edd8]/75 border border-[#cfb88c] rounded-md p-2.5 space-y-1">
            <div className="font-semibold text-[11px] text-[#2a1d13]">Abords &amp; indices</div>
            {vue.perceptionImmediate.indicesSensoriels.map((ind, idx) => (
              <div key={idx} className="text-[11px] text-[#5c3d19]">
                • {ind}
              </div>
            ))}
            <div className="space-y-0.5 pt-0.5">
              {vue.perceptionImmediate.abordsImmediats.map(a => (
                <div key={a.id} className="text-[11px] text-[#6d5742]">
                  {a.decouvert ? '•' : '◦'} {a.label}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {onglet === 'connu' && (
        <div className="space-y-2">
          <div className="bg-[#f5edd8]/75 border border-[#cfb88c] rounded-md p-2.5 space-y-1 max-h-44 overflow-y-auto">
            <div className="font-semibold text-[11px] text-[#2a1d13]">Lieux connus</div>
            {vue.savoirVerifie.lieuxDecouverts.map(l => (
              <div key={l.id} className="text-[11px] text-[#463626] border-t border-[#decba3] first:border-t-0 pt-1 first:pt-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-[#231a14]">
                    {l.nom} [{l.q},{l.r}]
                  </span>
                  <span className="text-[10px] font-mono text-[#78624a]">
                    {l.brouillard === 'EXPLORE' ? 'Exploré' : 'Repéré'}
                  </span>
                </div>
                <div className="text-[10px] text-[#6d5742]">
                  {l.terrain}
                  {l.pointInteret ? ` · ${l.pointInteret}` : ''}
                  {l.annotation ? ` · Note : ${l.annotation}` : ''}
                </div>
              </div>
            ))}
          </div>

          {vue.savoirVerifie.bourgsDecouverts.length > 0 && (
            <div className="bg-[#f5edd8]/75 border border-[#cfb88c] rounded-md p-2.5 space-y-1">
              <div className="font-semibold text-[11px] text-[#2a1d13]">Bourgs &amp; repères</div>
              {vue.savoirVerifie.bourgsDecouverts.slice(0, 6).map((b, idx) => (
                <div key={idx} className="text-[11px] text-[#463626]">
                  • {b}
                </div>
              ))}
              {vue.savoirVerifie.marqueursDecouverts.slice(0, 4).map((m, idx) => (
                <div key={`m_${idx}`} className="text-[11px] text-[#6d5742]">
                  • {m}
                </div>
              ))}
            </div>
          )}

          {vue.savoirVerifie.nouvellesLocales.length > 0 && (
            <div className="bg-[#f5edd8]/75 border border-[#cfb88c] rounded-md p-2.5 space-y-1">
              <div className="font-semibold text-[11px] text-[#2a1d13]">Nouvelles parvenues</div>
              {vue.savoirVerifie.nouvellesLocales.map((n, idx) => (
                <div key={idx} className="text-[11px] text-[#463626]">
                  • [J{n.jour}] {n.titre} — {n.impact}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {onglet === 'souvenirs' && (
        <div className="space-y-2">
          <div className="bg-[#f5edd8]/75 border border-[#cfb88c] rounded-md p-2.5 space-y-1">
            <div className="font-semibold text-[11px] text-[#3b2b1d]">Informations apprises</div>
            {vue.souvenirsEtOuieDire.dernieresInfos.length > 0 ? (
              vue.souvenirsEtOuieDire.dernieresInfos.map((info, idx) => (
                <div key={idx} className="text-[11px] text-[#463626] leading-relaxed">
                  • {info}
                </div>
              ))
            ) : (
              <div className="text-[11px] text-[#8a7359]">Aucune information enregistrée.</div>
            )}
          </div>

          <div className="bg-[#f5edd8]/75 border border-[#cfb88c] rounded-md p-2.5 space-y-1">
            <div className="font-semibold text-[11px] text-[#5c3d19]">Réminiscences</div>
            {vue.souvenirsEtOuieDire.souvenirsContextuels.length > 0 ? (
              vue.souvenirsEtOuieDire.souvenirsContextuels.map((s, idx) => (
                <div key={idx} className="text-[11px] text-[#463626] leading-relaxed">
                  • {s}
                </div>
              ))
            ) : (
              <div className="text-[11px] text-[#8a7359]">Aucun souvenir pour ce lieu.</div>
            )}
          </div>

          {(vue.souvenirsEtOuieDire.notesPersonnelles ||
            vue.souvenirsEtOuieDire.documentsActifs.length > 0) && (
            <div className="bg-[#f5edd8]/75 border border-[#cfb88c] rounded-md p-2.5 space-y-1">
              <div className="font-semibold text-[11px] text-[#3b2b1d]">Notes &amp; documents</div>
              {vue.souvenirsEtOuieDire.notesPersonnelles && (
                <div className="text-[11px] text-[#463626] whitespace-pre-line">
                  {vue.souvenirsEtOuieDire.notesPersonnelles}
                </div>
              )}
              {vue.souvenirsEtOuieDire.documentsActifs.map((d, idx) => (
                <div key={idx} className="text-[10px] text-[#6d5742] border-t border-[#decba3] pt-1">
                  <span className="font-semibold text-[#3b2b1d]">{d.titre}</span> ({d.categorie}) :{' '}
                  {d.extrait.slice(0, 120)}
                  {d.extrait.length > 120 ? '...' : ''}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {onglet === 'rumeurs' && (
        <div className="bg-[#f5edd8]/75 border border-[#cfb88c] rounded-md p-2.5 space-y-1.5 max-h-56 overflow-y-auto">
          <div className="font-semibold text-[11px] text-[#3b2b1d]">Ouï-dire et rumeurs</div>
          {vue.souvenirsEtOuieDire.rumeursEntendues.length > 0 ? (
            vue.souvenirsEtOuieDire.rumeursEntendues.map(r => (
              <div
                key={r.id}
                className="text-[11px] text-[#463626] border-t border-[#decba3] first:border-t-0 pt-1.5 first:pt-0 space-y-0.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-[#231a14] truncate">{r.titre}</span>
                  <span className="text-[10px] font-mono text-[#78624a] shrink-0">
                    {libelleRumeur(r.statutPerception)}
                  </span>
                </div>
                <div className="text-[10px] text-[#6d5742]">
                  {r.source}
                  {r.lieuObtention ? ` · ${r.lieuObtention}` : ''}
                </div>
                <div className="text-[11px] text-[#463626] leading-snug">{r.texte}</div>
              </div>
            ))
          ) : (
            <div className="text-[11px] text-[#8a7359]">Aucune rumeur entendue.</div>
          )}
        </div>
      )}

      {onglet === 'offres' && (
        <div className="space-y-2">
          <div className="bg-[#f5edd8]/75 border border-[#cfb88c] rounded-md p-2.5 space-y-1.5">
            <div className="font-semibold text-[11px] text-[#3b2b1d]">
              Propositions en attente ({vue.savoirVerifie.propositionsEnAttente.length})
            </div>
            {vue.savoirVerifie.propositionsEnAttente.length > 0 ? (
              vue.savoirVerifie.propositionsEnAttente.map(q => (
                <div key={q.id} className="border-t border-[#decba3] first:border-t-0 pt-1.5 first:pt-0 space-y-1">
                  <div className="font-medium text-[#231a14]">{q.titre}</div>
                  <div className="text-[10px] text-[#6d5742]">
                    {q.interlocuteur}
                    {q.details ? ` — ${q.details}` : ''}
                  </div>
                  {onExecuterAction && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={chargement}
                        onClick={() =>
                          onExecuterAction({
                            type: 'AJOUTER_QUETE',
                            cibleId: q.id,
                            payloadAction: { mode: 'statut', statut: 'EN_COURS' },
                          })
                        }
                        className="px-2 py-0.5 bg-white hover:bg-emerald-50 border border-[#bfa574] rounded text-[10px] font-medium text-emerald-900 flex items-center gap-1 cursor-pointer disabled:opacity-40"
                      >
                        <Check className="w-3 h-3" />
                        Accepter
                      </button>
                      <button
                        type="button"
                        disabled={chargement}
                        onClick={() =>
                          onExecuterAction({
                            type: 'AJOUTER_QUETE',
                            cibleId: q.id,
                            payloadAction: { mode: 'statut', statut: 'DECLINEE' },
                          })
                        }
                        className="px-2 py-0.5 bg-white hover:bg-stone-100 border border-[#cfb88c] rounded text-[10px] text-[#6d5742] flex items-center gap-1 cursor-pointer disabled:opacity-40"
                      >
                        <X className="w-3 h-3" />
                        Décliner
                      </button>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-[11px] text-[#8a7359]">Aucune offre en attente.</div>
            )}
          </div>

          <div className="bg-[#f5edd8]/75 border border-[#cfb88c] rounded-md p-2.5 space-y-1.5">
            <div className="font-semibold text-[11px] text-[#3b2b1d]">
              Engagements ({vue.savoirVerifie.engagementsAcceptes.length})
            </div>
            {vue.savoirVerifie.engagementsAcceptes.length > 0 ? (
              vue.savoirVerifie.engagementsAcceptes.map(q => (
                <div
                  key={q.id}
                  className="text-[11px] text-[#463626] border-t border-[#decba3] first:border-t-0 pt-1 first:pt-0 space-y-0.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-[#231a14] truncate">{q.titre}</span>
                    <span className="text-[10px] font-mono text-[#78624a] shrink-0">
                      {libelleStatutQuete(q.statut)}
                    </span>
                  </div>
                  <div className="text-[10px] text-[#6d5742]">
                    {q.interlocuteur}
                    {q.echeanceJour ? ` · J${q.echeanceJour}` : ''}
                    {q.details ? ` — ${q.details}` : ''}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-[11px] text-[#8a7359]">Aucun engagement actif.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
