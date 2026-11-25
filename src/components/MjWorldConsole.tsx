import React, { useEffect, useState } from 'react';
import {
  SimulationState,
  WorldClock,
  WorldEntityType,
} from '../types';
import { CrisisPresetId, MjWorldCommand } from '../engine/mjWorldEngine';
import {
  CloudRain,
  Compass,
  Flame,
  MessageSquare,
  Plus,
  Scroll,
  Send,
  Sparkles,
  Trash2,
  UserPlus,
  Zap,
} from 'lucide-react';

interface MjWorldConsoleProps {
  etat: SimulationState;
  hexInspecteId?: string;
  chargement?: boolean;
  onActionMJ: (cmd: MjWorldCommand) => void | Promise<void>;
}

const METEOS: WorldClock['meteo'][] = [
  'Ciel dégagé',
  'Pluie battante',
  'Brume glaciale',
  'Chaleur écrasante',
  'Vents violents',
];

const SAISONS: NonNullable<WorldClock['saison']>[] = [
  'Printemps',
  'Été',
  'Automne',
  'Hiver',
];

const CRISES: Array<{ id: CrisisPresetId; label: string }> = [
  { id: 'RAID', label: 'Raid' },
  { id: 'FOIRE', label: 'Foire' },
  { id: 'DISETTE', label: 'Sécheresse' },
  { id: 'EPIDEMIE', label: 'Fièvre' },
  { id: 'RELIQUE', label: 'Relique' },
  { id: 'REVOLTE', label: 'Révolte' },
  { id: 'LIBRE', label: 'Libre' },
];

const TYPES_UNITE: Array<{ id: WorldEntityType; label: string }> = [
  { id: 'CARAVANE', label: 'Caravane' },
  { id: 'PATROUILLE', label: 'Patrouille' },
  { id: 'RAIDER', label: 'Raider' },
  { id: 'MESSAGER', label: 'Messager' },
  { id: 'REFUGIES', label: 'Réfugiés' },
];

const DISPOSITIONS = ['AMICAL', 'NEUTRE', 'MEFIANT', 'HOSTILE'];

export const MjWorldConsole: React.FC<MjWorldConsoleProps> = ({
  etat,
  hexInspecteId,
  chargement = false,
  onActionMJ,
}) => {
  const terres = etat.hexagones.filter(h => !h.estEau);
  const hexDefautId =
    (hexInspecteId && terres.some(h => h.id === hexInspecteId) ? hexInspecteId : undefined) ||
    terres[0]?.id ||
    etat.hexActuel.id;

  // Crise
  const [criseHexId, setCriseHexId] = useState(hexDefautId);
  const [crisePreset, setCrisePreset] = useState<CrisisPresetId>('RAID');
  const [criseTitre, setCriseTitre] = useState('');
  const [criseImpact, setCriseImpact] = useState('');
  const [criseMarqueur, setCriseMarqueur] = useState(true);

  // Unité
  const [unitType, setUnitType] = useState<WorldEntityType>('CARAVANE');
  const [unitOrigine, setUnitOrigine] = useState(hexDefautId);
  const [unitDest, setUnitDest] = useState(terres[1]?.id || hexDefautId);
  const [unitFaction, setUnitFaction] = useState(etat.factions[0]?.id || '');
  const [unitNom, setUnitNom] = useState('');

  // PNJ
  const [pnjNom, setPnjNom] = useState('');
  const [pnjRole, setPnjRole] = useState('');
  const [pnjHex, setPnjHex] = useState(hexDefautId);
  const [pnjDisp, setPnjDisp] = useState('NEUTRE');
  const [pnjSecret, setPnjSecret] = useState('');
  const [confirmDelPnj, setConfirmDelPnj] = useState<string | null>(null);

  // Rumeur
  const [rumTitre, setRumTitre] = useState('');
  const [rumSource, setRumSource] = useState('');
  const [rumTexte, setRumTexte] = useState('');
  const [rumVraie, setRumVraie] = useState(true);

  // Conséquence / Quête / Fil
  const [consDecl, setConsDecl] = useState('');
  const [consEffet, setConsEffet] = useState('');
  const [queteTitre, setQueteTitre] = useState('');
  const [queteInter, setQueteInter] = useState('');
  const [queteDetails, setQueteDetails] = useState('');
  const [noteFil, setNoteFil] = useState('');

  useEffect(() => {
    if (hexInspecteId && terres.some(h => h.id === hexInspecteId)) {
      setCriseHexId(hexInspecteId);
      setUnitOrigine(hexInspecteId);
      setPnjHex(hexInspecteId);
    }
  }, [hexInspecteId]);

  const hexNom = (id: string) => etat.hexagones.find(h => h.id === id)?.nom || id;
  const acteurs = etat.grapheNoeuds.filter(n => n.type === 'Actor');
  const rumeurs = etat.rumeurs || [];
  const quetes = etat.memoireMJ?.promessesEtQuetes || [];
  const consequences = etat.memoireMJ?.consequencesDifferees || [];
  const fil = etat.memoireMJ?.filNarratif || [];

  return (
    <div className="space-y-3 text-xs text-[#231a14]">
      {/* Ligne 1 : Climat/Horloge, Marché, Crise, Unité */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Climat & Marché */}
        <div className="bg-[#f5edd8]/80 border border-[#cfb88c] rounded-lg p-3 space-y-2.5">
          <div className="flex items-center justify-between border-b border-[#decba3] pb-1.5">
            <div className="flex items-center gap-1.5 font-display font-semibold text-[#2a1d13]">
              <CloudRain className="w-3.5 h-3.5 text-[#9c6f21]" />
              <span>Climat, Heure &amp; Marché</span>
            </div>
            <div className="flex items-center gap-1">
              {[2, 6, 12].map(h => (
                <button
                  key={h}
                  type="button"
                  disabled={chargement}
                  onClick={() => onActionMJ({ type: 'METEO_SAISON', heuresAvance: h })}
                  className="px-2 py-0.5 bg-[#fffdf7] hover:bg-[#efe4ca] border border-[#bfa574] rounded text-[10px] font-mono tabular-nums whitespace-nowrap shrink-0 cursor-pointer"
                >
                  +{h}h
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-0.5">
              <span className="text-[10px] text-[#6d5742]">Saison</span>
              <select
                value={etat.horloge.saison || 'Automne'}
                disabled={chargement}
                onChange={e =>
                  onActionMJ({
                    type: 'METEO_SAISON',
                    saison: e.target.value as NonNullable<WorldClock['saison']>,
                  })
                }
                className="w-full bg-[#fffdf7] border border-[#bfa574] rounded px-2 py-1 text-[11px]"
              >
                {SAISONS.map(s => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-0.5">
              <span className="text-[10px] text-[#6d5742]">Météo</span>
              <select
                value={etat.horloge.meteo}
                disabled={chargement}
                onChange={e =>
                  onActionMJ({
                    type: 'METEO_SAISON',
                    meteo: e.target.value as WorldClock['meteo'],
                  })
                }
                className="w-full bg-[#fffdf7] border border-[#bfa574] rounded px-2 py-1 text-[11px]"
              >
                {METEOS.map(m => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#decba3] font-mono tabular-nums text-[11px]">
            <div className="flex items-center justify-between gap-1 bg-[#fffdf7]/80 border border-[#d6c298] rounded px-2 py-1">
              <span>Fer x{etat.marche.multiplicateurFer}</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() =>
                    onActionMJ({
                      type: 'MARCHE',
                      multiplicateurFer: Number((etat.marche.multiplicateurFer - 0.2).toFixed(2)),
                    })
                  }
                  className="px-1.5 py-0.5 bg-[#efe4ca] rounded text-[10px] cursor-pointer"
                >
                  -
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onActionMJ({
                      type: 'MARCHE',
                      multiplicateurFer: Number((etat.marche.multiplicateurFer + 0.2).toFixed(2)),
                    })
                  }
                  className="px-1.5 py-0.5 bg-[#efe4ca] rounded text-[10px] cursor-pointer"
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onActionMJ({
                      type: 'MARCHE',
                      penurieArmurerie: !etat.marche.penurieArmurerie,
                    })
                  }
                  className={`px-1.5 py-0.5 rounded text-[10px] whitespace-nowrap shrink-0 cursor-pointer ${
                    etat.marche.penurieArmurerie
                      ? 'bg-rose-800 text-white'
                      : 'bg-[#e7d9ba] text-[#463626]'
                  }`}
                >
                  Pénurie
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-1 bg-[#fffdf7]/80 border border-[#d6c298] rounded px-2 py-1">
              <span>Vivres x{etat.marche.multiplicateurVivres ?? 1}</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() =>
                    onActionMJ({
                      type: 'MARCHE',
                      multiplicateurVivres: Number(
                        ((etat.marche.multiplicateurVivres ?? 1) - 0.2).toFixed(2)
                      ),
                    })
                  }
                  className="px-1.5 py-0.5 bg-[#efe4ca] rounded text-[10px] cursor-pointer"
                >
                  -
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onActionMJ({
                      type: 'MARCHE',
                      multiplicateurVivres: Number(
                        ((etat.marche.multiplicateurVivres ?? 1) + 0.2).toFixed(2)
                      ),
                    })
                  }
                  className="px-1.5 py-0.5 bg-[#efe4ca] rounded text-[10px] cursor-pointer"
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onActionMJ({
                      type: 'MARCHE',
                      penurieVivres: !etat.marche.penurieVivres,
                    })
                  }
                  className={`px-1.5 py-0.5 rounded text-[10px] whitespace-nowrap shrink-0 cursor-pointer ${
                    etat.marche.penurieVivres
                      ? 'bg-amber-800 text-white'
                      : 'bg-[#e7d9ba] text-[#463626]'
                  }`}
                >
                  Pénurie
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Crise ou Événement Régional */}
        <div className="bg-[#f5edd8]/80 border border-[#cfb88c] rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between border-b border-[#decba3] pb-1.5">
            <div className="flex items-center gap-1.5 font-display font-semibold text-[#2a1d13]">
              <Flame className="w-3.5 h-3.5 text-rose-700" />
              <span>Crise &amp; Événement</span>
            </div>
            <label className="flex items-center gap-1.5 text-[10px] text-[#5c4734] cursor-pointer">
              <input
                type="checkbox"
                checked={criseMarqueur}
                onChange={e => setCriseMarqueur(e.target.checked)}
              />
              <span>Repère atlas</span>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-0.5">
              <span className="text-[10px] text-[#6d5742]">Secteur</span>
              <select
                value={criseHexId}
                onChange={e => setCriseHexId(e.target.value)}
                className="w-full bg-[#fffdf7] border border-[#bfa574] rounded px-2 py-1 text-[11px]"
              >
                {terres.map(h => (
                  <option key={h.id} value={h.id}>
                    {h.nom} [{h.q},{h.r}]
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-0.5">
              <span className="text-[10px] text-[#6d5742]">Type</span>
              <select
                value={crisePreset}
                onChange={e => setCrisePreset(e.target.value as CrisisPresetId)}
                className="w-full bg-[#fffdf7] border border-[#bfa574] rounded px-2 py-1 text-[11px]"
              >
                {CRISES.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {crisePreset === 'LIBRE' && (
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={criseTitre}
                onChange={e => setCriseTitre(e.target.value)}
                placeholder="Titre événement..."
                className="bg-[#fffdf7] border border-[#bfa574] rounded px-2 py-1 text-[11px]"
              />
              <input
                type="text"
                value={criseImpact}
                onChange={e => setCriseImpact(e.target.value)}
                placeholder="Impact..."
                className="bg-[#fffdf7] border border-[#bfa574] rounded px-2 py-1 text-[11px]"
              />
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              disabled={chargement || !criseHexId}
              onClick={() => {
                onActionMJ({
                  type: 'DECLENCHER_CRISE',
                  hexId: criseHexId,
                  preset: crisePreset,
                  titreCustom: criseTitre || undefined,
                  impactCustom: criseImpact || undefined,
                  poserMarqueur: criseMarqueur,
                });
                if (crisePreset === 'LIBRE') {
                  setCriseTitre('');
                  setCriseImpact('');
                }
              }}
              className="px-3 py-1 dnd-wood-bar border border-[#7e5b27] rounded text-[11px] font-medium flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40"
            >
              <Zap className="w-3 h-3 text-[#e5be6e]" />
              <span>Déclencher</span>
            </button>
          </div>
        </div>
      </div>

      {/* Ligne 2 : Dépêcher une Unité + PNJ du Monde */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Dépêcher une unité */}
        <div className="bg-[#f5edd8]/80 border border-[#cfb88c] rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-1.5 font-display font-semibold text-[#2a1d13] border-b border-[#decba3] pb-1.5">
            <Compass className="w-3.5 h-3.5 text-[#9c6f21]" />
            <span>Dépêcher une unité</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <label className="space-y-0.5">
              <span className="text-[10px] text-[#6d5742]">Type</span>
              <select
                value={unitType}
                onChange={e => setUnitType(e.target.value as WorldEntityType)}
                className="w-full bg-[#fffdf7] border border-[#bfa574] rounded px-2 py-1 text-[11px]"
              >
                {TYPES_UNITE.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-0.5">
              <span className="text-[10px] text-[#6d5742]">Origine</span>
              <select
                value={unitOrigine}
                onChange={e => setUnitOrigine(e.target.value)}
                className="w-full bg-[#fffdf7] border border-[#bfa574] rounded px-2 py-1 text-[11px]"
              >
                {terres.map(h => (
                  <option key={h.id} value={h.id}>
                    {h.nom}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-0.5">
              <span className="text-[10px] text-[#6d5742]">Destination</span>
              <select
                value={unitDest}
                onChange={e => setUnitDest(e.target.value)}
                className="w-full bg-[#fffdf7] border border-[#bfa574] rounded px-2 py-1 text-[11px]"
              >
                {terres.map(h => (
                  <option key={h.id} value={h.id}>
                    {h.nom}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={unitFaction}
              onChange={e => setUnitFaction(e.target.value)}
              className="bg-[#fffdf7] border border-[#bfa574] rounded px-2 py-1 text-[11px] flex-1 min-w-[120px]"
            >
              {etat.factions.map(f => (
                <option key={f.id} value={f.id}>
                  {f.nom}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={unitNom}
              onChange={e => setUnitNom(e.target.value)}
              placeholder="Nom unité (optionnel)"
              className="bg-[#fffdf7] border border-[#bfa574] rounded px-2 py-1 text-[11px] flex-1 min-w-[120px]"
            />
            <button
              type="button"
              disabled={chargement || !unitOrigine || !unitDest}
              onClick={() => {
                onActionMJ({
                  type: 'DEPECHER_UNITE',
                  typeEntite: unitType,
                  origineHexId: unitOrigine,
                  destinationHexId: unitDest,
                  factionId: unitFaction || undefined,
                  nom: unitNom.trim() || undefined,
                });
                setUnitNom('');
              }}
              className="px-3 py-1 dnd-wood-bar border border-[#7e5b27] rounded text-[11px] font-medium flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40"
            >
              <Send className="w-3 h-3 text-[#e5be6e]" />
              <span>Dépêcher</span>
            </button>
          </div>
        </div>

        {/* PNJ du monde */}
        <div className="bg-[#f5edd8]/80 border border-[#cfb88c] rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between border-b border-[#decba3] pb-1.5">
            <div className="flex items-center gap-1.5 font-display font-semibold text-[#2a1d13]">
              <UserPlus className="w-3.5 h-3.5 text-[#9c6f21]" />
              <span>PNJ du monde ({acteurs.length})</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            <input
              type="text"
              value={pnjNom}
              onChange={e => setPnjNom(e.target.value)}
              placeholder="Nom PNJ..."
              className="bg-[#fffdf7] border border-[#bfa574] rounded px-2 py-1 text-[11px]"
            />
            <input
              type="text"
              value={pnjRole}
              onChange={e => setPnjRole(e.target.value)}
              placeholder="Rôle..."
              className="bg-[#fffdf7] border border-[#bfa574] rounded px-2 py-1 text-[11px]"
            />
            <select
              value={pnjHex}
              onChange={e => setPnjHex(e.target.value)}
              className="bg-[#fffdf7] border border-[#bfa574] rounded px-2 py-1 text-[11px]"
            >
              {terres.map(h => (
                <option key={h.id} value={h.id}>
                  {h.nom}
                </option>
              ))}
            </select>
            <select
              value={pnjDisp}
              onChange={e => setPnjDisp(e.target.value)}
              className="bg-[#fffdf7] border border-[#bfa574] rounded px-2 py-1 text-[11px]"
            >
              {DISPOSITIONS.map(d => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={pnjSecret}
              onChange={e => setPnjSecret(e.target.value)}
              placeholder="Secret ou mobile (optionnel)"
              className="bg-[#fffdf7] border border-[#bfa574] rounded px-2 py-1 text-[11px] flex-1"
            />
            <button
              type="button"
              disabled={chargement || !pnjNom.trim()}
              onClick={() => {
                onActionMJ({
                  type: 'GERER_PNJ',
                  operation: 'CREER',
                  nom: pnjNom.trim(),
                  profession: pnjRole.trim() || 'Voyageur',
                  hexId: pnjHex,
                  disposition: pnjDisp,
                  secret: pnjSecret.trim(),
                });
                setPnjNom('');
                setPnjRole('');
                setPnjSecret('');
              }}
              className="px-2.5 py-1 dnd-wood-bar border border-[#7e5b27] rounded text-[11px] font-medium flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40"
            >
              <Plus className="w-3 h-3 text-[#e5be6e]" />
              <span>Créer PNJ</span>
            </button>
          </div>

          <div className="max-h-36 overflow-y-auto space-y-1 pr-0.5">
            {acteurs.map(act => {
              const curHexId =
                act.proprietes?.hexId ||
                etat.grapheLiens.find(l => l.relation === 'LOCATED_IN' && l.source === act.id)
                  ?.cible ||
                terres[0]?.id ||
                '';
              const isConfirm = confirmDelPnj === act.id;
              return (
                <div
                  key={act.id}
                  className="bg-[#fffdf7]/80 border border-[#d6c298] rounded px-2 py-1 flex flex-wrap items-center justify-between gap-1.5"
                >
                  <div className="min-w-0">
                    <span className="font-semibold text-[#231a14]">{act.label}</span>
                    <span className="text-[10px] text-[#6d5742] ml-1.5">
                      {act.proprietes?.profession || 'PNJ'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <select
                      value={curHexId}
                      onChange={e =>
                        onActionMJ({
                          type: 'GERER_PNJ',
                          operation: 'MODIFIER',
                          pnjId: act.id,
                          hexId: e.target.value,
                        })
                      }
                      className="bg-[#f5edd8] border border-[#cfb88c] rounded px-1 py-0.5 text-[10px] max-w-[115px]"
                    >
                      {terres.map(h => (
                        <option key={h.id} value={h.id}>
                          {h.nom}
                        </option>
                      ))}
                    </select>
                    <select
                      value={act.proprietes?.disposition || 'NEUTRE'}
                      onChange={e =>
                        onActionMJ({
                          type: 'GERER_PNJ',
                          operation: 'MODIFIER',
                          pnjId: act.id,
                          disposition: e.target.value,
                        })
                      }
                      className="bg-[#f5edd8] border border-[#cfb88c] rounded px-1 py-0.5 text-[10px]"
                    >
                      {DISPOSITIONS.map(d => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                    {!isConfirm ? (
                      <button
                        type="button"
                        onClick={() => setConfirmDelPnj(act.id)}
                        title="Retirer PNJ"
                        className="p-1 text-rose-800 hover:bg-rose-50 rounded cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    ) : (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setConfirmDelPnj(null);
                            onActionMJ({
                              type: 'GERER_PNJ',
                              operation: 'SUPPRIMER',
                              pnjId: act.id,
                            });
                          }}
                          className="px-1.5 py-0.5 bg-rose-700 text-white rounded text-[10px] cursor-pointer"
                        >
                          Oui
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDelPnj(null)}
                          className="px-1.5 py-0.5 border border-[#cfb88c] rounded text-[10px] cursor-pointer"
                        >
                          Non
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Ligne 3 : Rumeurs + Quêtes & Conséquences différées */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Rumeurs */}
        <div className="bg-[#f5edd8]/80 border border-[#cfb88c] rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between border-b border-[#decba3] pb-1.5">
            <div className="flex items-center gap-1.5 font-display font-semibold text-[#2a1d13]">
              <MessageSquare className="w-3.5 h-3.5 text-[#9c6f21]" />
              <span>Rumeurs ({rumeurs.length})</span>
            </div>
            <label className="flex items-center gap-1.5 text-[10px] text-[#5c4734] cursor-pointer">
              <input
                type="checkbox"
                checked={rumVraie}
                onChange={e => setRumVraie(e.target.checked)}
              />
              <span>Fondée</span>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <input
              type="text"
              value={rumTitre}
              onChange={e => setRumTitre(e.target.value)}
              placeholder="Titre rumeur..."
              className="bg-[#fffdf7] border border-[#bfa574] rounded px-2 py-1 text-[11px]"
            />
            <input
              type="text"
              value={rumSource}
              onChange={e => setRumSource(e.target.value)}
              placeholder="Source (Taverne, Garde...)"
              className="bg-[#fffdf7] border border-[#bfa574] rounded px-2 py-1 text-[11px]"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={rumTexte}
              onChange={e => setRumTexte(e.target.value)}
              placeholder="Contenu de la rumeur..."
              className="bg-[#fffdf7] border border-[#bfa574] rounded px-2 py-1 text-[11px] flex-1"
            />
            <button
              type="button"
              disabled={chargement || !rumTitre.trim() || !rumTexte.trim()}
              onClick={() => {
                onActionMJ({
                  type: 'GERER_RUMEUR',
                  operation: 'CREER',
                  titre: rumTitre.trim(),
                  source: rumSource.trim() || 'Rumeur',
                  texte: rumTexte.trim(),
                  veracite: rumVraie,
                });
                setRumTitre('');
                setRumSource('');
                setRumTexte('');
              }}
              className="px-2.5 py-1 dnd-wood-bar border border-[#7e5b27] rounded text-[11px] font-medium whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40"
            >
              Publier
            </button>
          </div>

          <div className="max-h-36 overflow-y-auto space-y-1 pr-0.5">
            {rumeurs.map(r => (
              <div
                key={r.id}
                className="bg-[#fffdf7]/80 border border-[#d6c298] rounded px-2 py-1 flex items-start justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-[#231a14] truncate">{r.titre}</div>
                  <div className="text-[10px] text-[#5c4734] truncate">{r.texte}</div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      onActionMJ({
                        type: 'GERER_RUMEUR',
                        operation: 'BASCULER_VERACITE',
                        rumorId: r.id,
                      })
                    }
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono cursor-pointer ${
                      r.veracite
                        ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                        : 'bg-rose-100 text-rose-900 border border-rose-300'
                    }`}
                  >
                    {r.veracite ? 'Vraie' : 'Fausse'}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onActionMJ({
                        type: 'GERER_RUMEUR',
                        operation: 'SUPPRIMER',
                        rumorId: r.id,
                      })
                    }
                    className="p-1 text-rose-800 hover:bg-rose-50 rounded cursor-pointer"
                    title="Supprimer"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Conséquences différées, Quêtes & Fil MJ */}
        <div className="bg-[#f5edd8]/80 border border-[#cfb88c] rounded-lg p-3 space-y-2.5">
          <div className="flex items-center gap-1.5 font-display font-semibold text-[#2a1d13] border-b border-[#decba3] pb-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#9c6f21]" />
            <span>Conséquences, Quêtes &amp; Fil MJ</span>
          </div>

          {/* Conséquences différées */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={consDecl}
                onChange={e => setConsDecl(e.target.value)}
                placeholder="Déclencheur..."
                className="bg-[#fffdf7] border border-[#bfa574] rounded px-2 py-1 text-[11px] flex-1"
              />
              <input
                type="text"
                value={consEffet}
                onChange={e => setConsEffet(e.target.value)}
                placeholder="Effet prévu..."
                className="bg-[#fffdf7] border border-[#bfa574] rounded px-2 py-1 text-[11px] flex-1"
              />
              <button
                type="button"
                disabled={chargement || !consDecl.trim() || !consEffet.trim()}
                onClick={() => {
                  onActionMJ({
                    type: 'GERER_INTRIGUE',
                    cible: 'CONSEQUENCE',
                    operation: 'CREER',
                    declencheur: consDecl.trim(),
                    effetPrevu: consEffet.trim(),
                  });
                  setConsDecl('');
                  setConsEffet('');
                }}
                className="px-2 py-1 bg-[#fffdf7] hover:bg-[#efe4ca] border border-[#bfa574] rounded text-[11px] font-medium whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40"
              >
                + Armer
              </button>
            </div>

            {consequences.length > 0 && (
              <div className="max-h-24 overflow-y-auto space-y-1 pr-0.5">
                {consequences.map(c => (
                  <div
                    key={c.id}
                    className="bg-[#fffdf7]/80 border border-[#d6c298] rounded px-2 py-1 flex items-center justify-between gap-1.5"
                  >
                    <div className={`min-w-0 ${!c.actif ? 'opacity-55 line-through' : ''}`}>
                      <span className="font-semibold">{c.declencheur}</span>
                      <span className="text-[#5c4734]"> → {c.effetPrevu}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {c.actif && (
                        <button
                          type="button"
                          onClick={() =>
                            onActionMJ({
                              type: 'GERER_INTRIGUE',
                              cible: 'CONSEQUENCE',
                              operation: 'DECLENCHER',
                              id: c.id,
                            })
                          }
                          className="px-1.5 py-0.5 bg-amber-100 hover:bg-amber-200 border border-amber-400 rounded text-[10px] font-medium text-amber-950 whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          Déclencher
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          onActionMJ({
                            type: 'GERER_INTRIGUE',
                            cible: 'CONSEQUENCE',
                            operation: 'SUPPRIMER',
                            id: c.id,
                          })
                        }
                        className="p-0.5 text-rose-800 hover:bg-rose-50 rounded cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quêtes */}
          <div className="space-y-1.5 border-t border-[#decba3] pt-2">
            <div className="grid grid-cols-3 gap-1.5">
              <input
                type="text"
                value={queteTitre}
                onChange={e => setQueteTitre(e.target.value)}
                placeholder="Quête..."
                className="bg-[#fffdf7] border border-[#bfa574] rounded px-2 py-1 text-[11px]"
              />
              <input
                type="text"
                value={queteInter}
                onChange={e => setQueteInter(e.target.value)}
                placeholder="Commanditaire..."
                className="bg-[#fffdf7] border border-[#bfa574] rounded px-2 py-1 text-[11px]"
              />
              <div className="flex gap-1">
                <input
                  type="text"
                  value={queteDetails}
                  onChange={e => setQueteDetails(e.target.value)}
                  placeholder="Détails..."
                  className="bg-[#fffdf7] border border-[#bfa574] rounded px-2 py-1 text-[11px] flex-1 min-w-0"
                />
                <button
                  type="button"
                  disabled={chargement || !queteTitre.trim()}
                  onClick={() => {
                    onActionMJ({
                      type: 'GERER_INTRIGUE',
                      cible: 'QUETE',
                      operation: 'CREER',
                      titre: queteTitre.trim(),
                      interlocuteur: queteInter.trim() || 'Commanditaire',
                      details: queteDetails.trim(),
                    });
                    setQueteTitre('');
                    setQueteInter('');
                    setQueteDetails('');
                  }}
                  className="px-2 py-1 bg-[#fffdf7] hover:bg-[#efe4ca] border border-[#bfa574] rounded text-[11px] whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40"
                >
                  +
                </button>
              </div>
            </div>
            {quetes.length > 0 && (
              <div className="max-h-24 overflow-y-auto space-y-1 pr-0.5">
                {quetes.map(q => (
                  <div
                    key={q.id}
                    className="bg-[#fffdf7]/80 border border-[#d6c298] rounded px-2 py-1 flex items-center justify-between gap-1.5"
                  >
                    <span className="truncate font-medium">{q.titre}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      <select
                        value={q.statut}
                        onChange={e =>
                          onActionMJ({
                            type: 'GERER_INTRIGUE',
                            cible: 'QUETE',
                            operation: 'STATUT',
                            id: q.id,
                            statut: e.target.value as 'EN_COURS' | 'ACCOMPLIE' | 'TRAHIE' | 'EXPIREE',
                          })
                        }
                        className="bg-[#f5edd8] border border-[#cfb88c] rounded px-1 py-0.5 text-[10px]"
                      >
                        <option value="EN_COURS">En cours</option>
                        <option value="ACCOMPLIE">Accomplie</option>
                        <option value="TRAHIE">Trahie</option>
                        <option value="EXPIREE">Expirée</option>
                      </select>
                      <button
                        type="button"
                        onClick={() =>
                          onActionMJ({
                            type: 'GERER_INTRIGUE',
                            cible: 'QUETE',
                            operation: 'SUPPRIMER',
                            id: q.id,
                          })
                        }
                        className="p-0.5 text-rose-800 hover:bg-rose-50 rounded cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Fil MJ */}
          <div className="space-y-1.5 border-t border-[#decba3] pt-2">
            <div className="flex items-center gap-1.5">
              <Scroll className="w-3.5 h-3.5 text-[#9c6f21] shrink-0" />
              <input
                type="text"
                value={noteFil}
                onChange={e => setNoteFil(e.target.value)}
                placeholder="Directive secrète pour le MJ IA..."
                className="bg-[#fffdf7] border border-[#bfa574] rounded px-2 py-1 text-[11px] flex-1"
              />
              <button
                type="button"
                disabled={chargement || !noteFil.trim()}
                onClick={() => {
                  onActionMJ({
                    type: 'GERER_INTRIGUE',
                    cible: 'FIL',
                    operation: 'CREER',
                    noteFil: noteFil.trim(),
                  });
                  setNoteFil('');
                }}
                className="px-2 py-1 bg-[#fffdf7] hover:bg-[#efe4ca] border border-[#bfa574] rounded text-[11px] whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40"
              >
                Noter
              </button>
            </div>
            {fil.length > 0 && (
              <div className="max-h-20 overflow-y-auto space-y-0.5 text-[10px] text-[#463626] pr-0.5">
                {fil
                  .slice()
                  .reverse()
                  .slice(0, 5)
                  .map((ligne, revIdx) => {
                    const origIdx = fil.length - 1 - revIdx;
                    return (
                      <div
                        key={origIdx}
                        className="flex items-center justify-between gap-2 bg-[#fffdf7]/60 px-2 py-0.5 rounded"
                      >
                        <span className="truncate">{ligne}</span>
                        <button
                          type="button"
                          onClick={() =>
                            onActionMJ({
                              type: 'GERER_INTRIGUE',
                              cible: 'FIL',
                              operation: 'SUPPRIMER',
                              id: String(origIdx),
                            })
                          }
                          className="text-rose-800 hover:text-rose-950 shrink-0 cursor-pointer"
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Note compacte sur secteur cible courant */}
      <div className="text-[10px] text-[#6d5742] font-mono">
        Secteur ciblé : {hexNom(criseHexId)} · {acteurs.length} PNJ · {rumeurs.length} rumeurs ·{' '}
        {consequences.filter(c => c.actif).length} conséquences armées
      </div>
    </div>
  );
};
