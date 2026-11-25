import React, { useEffect, useState } from 'react';
import { SrdEntry } from '../types/srd';
import { formaterPrixPC } from '../engine/compendium';
import { ItemIcon } from '../utils/itemIcons';
import { ItemIllustrationInline } from './ItemIllustrationInline';
import { Image as ImageIcon } from 'lucide-react';

interface CodexEntryDetailProps {
  entry: SrdEntry;
}

const ABILITIES: Array<'FOR' | 'DEX' | 'CON' | 'INT' | 'SAG' | 'CHA'> = [
  'FOR',
  'DEX',
  'CON',
  'INT',
  'SAG',
  'CHA',
];

function formatMod(val: number): string {
  const m = Math.floor((val - 10) / 2);
  return m >= 0 ? `+${m}` : `${m}`;
}

export const CodexEntryDetail: React.FC<CodexEntryDetailProps> = ({ entry }) => {
  const [afficherIllustration, setAfficherIllustration] = useState(false);

  useEffect(() => {
    setAfficherIllustration(false);
  }, [entry.id]);

  return (
    <div className="bg-white border border-stone-200 rounded-lg p-4 space-y-3 text-xs text-stone-800">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-stone-100 pb-2.5">
        <div>
          <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
            {entry.categorie === 'objet' && (
              <ItemIcon
                item={{
                  id: entry.id,
                  nom: entry.nom,
                  sousCategorie: entry.sousCategorie,
                  motsCles: entry.motsCles,
                }}
                className="w-4 h-4 shrink-0"
              />
            )}
            <span>{entry.nom}</span>
          </h3>
          <div className="text-[11px] text-stone-500">
            {entry.nomEn} · <span className="font-mono text-stone-400">{entry.id}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {entry.categorie === 'objet' && (
            <button
              type="button"
              onClick={() => setAfficherIllustration(v => !v)}
              className={`px-2.5 py-1 rounded border text-[11px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                afficherIllustration
                  ? 'bg-[#8c6422] text-white border-[#6b4b16]'
                  : 'bg-[#f7eed8] hover:bg-[#efe1be] text-[#3b2c1e] border-[#c6ab77]'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              {afficherIllustration ? 'Masquer l\'illustration' : 'Illustration'}
            </button>
          )}
          <span className="text-[11px] font-mono px-2 py-0.5 bg-stone-100 border border-stone-200 rounded text-stone-700">
            {entry.categorie === 'monstre'
              ? `FP ${entry.fp} · ${entry.xp} XP`
              : entry.categorie === 'objet'
              ? `${formaterPrixPC(entry.valeurPC)} · ${entry.poidsLbs} lb`
              : entry.categorie === 'sort'
              ? entry.niveau === 0
                ? 'Tour de magie'
                : `Niveau ${entry.niveau}`
              : entry.categorie === 'regle'
              ? entry.domaine
              : entry.sousType}
          </span>
        </div>
      </div>

      {entry.categorie === 'monstre' && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2 bg-stone-50 border border-stone-200 rounded-md p-2.5 tabular-nums">
            <div>
              <div className="text-[10px] text-stone-500 uppercase">CA</div>
              <div className="font-bold text-stone-900 text-sm">{entry.ca}</div>
            </div>
            <div>
              <div className="text-[10px] text-stone-500 uppercase">PV</div>
              <div className="font-bold text-stone-900 text-sm">
                {entry.pv} <span className="text-[11px] font-normal text-stone-500">({entry.desVie})</span>
              </div>
            </div>
            <div>
              <div className="text-[10px] text-stone-500 uppercase">Vitesse</div>
              <div className="font-bold text-stone-900 text-sm">{entry.vitesse}</div>
            </div>
          </div>

          <div className="text-[11px] text-stone-600">
            {entry.typeCreature} ({entry.taille}) · {entry.alignement}
          </div>

          <div className="grid grid-cols-6 gap-1.5 text-center tabular-nums">
            {ABILITIES.map(ab => {
              const val = entry.caracteristiques[ab];
              return (
                <div key={ab} className="bg-stone-50 border border-stone-200 rounded p-1.5">
                  <div className="text-[10px] text-stone-500 font-semibold">{ab}</div>
                  <div className="font-bold text-stone-900">{val}</div>
                  <div className="text-[10px] text-stone-500">({formatMod(val)})</div>
                </div>
              );
            })}
          </div>

          {(entry.vulnerabilites?.length || entry.resistances?.length || entry.immunites?.length || entry.sens) && (
            <div className="space-y-1 text-[11px] bg-stone-50 border border-stone-200 rounded-md p-2.5">
              {entry.vulnerabilites?.length ? (
                <div><strong className="text-stone-700">Vulnérabilités :</strong> {entry.vulnerabilites.join(', ')}</div>
              ) : null}
              {entry.resistances?.length ? (
                <div><strong className="text-stone-700">Résistances :</strong> {entry.resistances.join(', ')}</div>
              ) : null}
              {entry.immunites?.length ? (
                <div><strong className="text-stone-700">Immunités :</strong> {entry.immunites.join(', ')}</div>
              ) : null}
              {entry.sens ? <div><strong className="text-stone-700">Sens :</strong> {entry.sens}</div> : null}
              {entry.langues ? <div><strong className="text-stone-700">Langues :</strong> {entry.langues}</div> : null}
            </div>
          )}

          {entry.traits && entry.traits.length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] font-bold uppercase text-stone-500">Traits</div>
              {entry.traits.map((t, i) => (
                <div key={i} className="text-stone-700">
                  <strong className="text-stone-900">{t.nom}.</strong> {t.desc}
                </div>
              ))}
            </div>
          )}

          <div className="space-y-1.5">
            <div className="text-[10px] font-bold uppercase text-stone-500">Actions</div>
            {entry.actions.map((a, i) => (
              <div key={i} className="bg-stone-50 border border-stone-200 rounded p-2">
                <div className="font-bold text-stone-900">
                  {a.nom}
                  {typeof a.bonusAttaque === 'number' ? ` (+${a.bonusAttaque})` : ''}
                  {a.degatsDes ? ` · ${a.degatsDes} ${a.typeDegats || ''}` : ''}
                </div>
                <div className="text-stone-600 mt-0.5">{a.desc}</div>
              </div>
            ))}
          </div>

          <div className="text-[11px] text-stone-500">
            Biomes : {entry.biomes.join(', ')}
            {entry.butinTypique?.length ? ` · Butin : ${entry.butinTypique.join(', ')}` : ''}
          </div>
        </div>
      )}

      {entry.categorie === 'objet' && (
        <div className="space-y-2.5">
          <div className="grid grid-cols-3 gap-2 bg-stone-50 border border-stone-200 rounded-md p-2.5 tabular-nums">
            <div>
              <div className="text-[10px] text-stone-500 uppercase">Prix officiel</div>
              <div className="font-bold text-amber-800">{formaterPrixPC(entry.valeurPC)}</div>
            </div>
            <div>
              <div className="text-[10px] text-stone-500 uppercase">Revente (50 %)</div>
              <div className="font-bold text-stone-900">{formaterPrixPC(Math.floor(entry.valeurPC / 2))}</div>
            </div>
            <div>
              <div className="text-[10px] text-stone-500 uppercase">Poids</div>
              <div className="font-bold text-stone-900">{entry.poidsLbs} lb</div>
            </div>
          </div>

          <div className="text-[11px] text-stone-600">
            Type : {entry.sousCategorie} · Rareté : {entry.rarete}
            {entry.categorieComptoir ? ` · Comptoir : ${entry.categorieComptoir}` : ''}
          </div>

          {(entry.degats || entry.caBase) && (
            <div className="bg-stone-50 border border-stone-200 rounded p-2 space-y-1">
              {entry.degats && (
                <div>
                  <strong>Dégâts :</strong> {entry.degats} {entry.typeDegats || ''}
                  {entry.portee ? ` · Portée ${entry.portee}` : ''}
                </div>
              )}
              {entry.proprietesArme?.length ? (
                <div><strong>Propriétés :</strong> {entry.proprietesArme.join(', ')}</div>
              ) : null}
              {entry.caBase ? (
                <div>
                  <strong>Armure ({entry.categorieArmure}) :</strong> CA {entry.caBase}
                  {typeof entry.dexMax === 'number' ? ` (DEX max +${entry.dexMax})` : ''}
                  {entry.forceRequise ? ` · FOR ${entry.forceRequise}` : ''}
                  {entry.desavantageDiscretion ? ' · Désavantage Discrétion' : ''}
                </div>
              ) : null}
            </div>
          )}

          <div className="text-stone-800 leading-relaxed">{entry.effet}</div>

          {afficherIllustration && (
            <ItemIllustrationInline
              item={{
                itemId: entry.id,
                nom: entry.nom,
                nomEn: entry.nomEn,
                sousCategorie: entry.sousCategorie,
                rarete: entry.rarete,
                effet: entry.effet,
                degats: entry.degats,
                caBase: entry.caBase,
              }}
              onClose={() => setAfficherIllustration(false)}
            />
          )}
        </div>
      )}

      {entry.categorie === 'sort' && (
        <div className="space-y-2.5">
          <div className="grid grid-cols-2 gap-2 bg-stone-50 border border-stone-200 rounded-md p-2.5 text-[11px]">
            <div><strong>École :</strong> {entry.ecole}{entry.rituel ? ' (Rituel)' : ''}</div>
            <div><strong>Incantation :</strong> {entry.tempsIncantation}</div>
            <div><strong>Portée :</strong> {entry.portee}</div>
            <div><strong>Durée :</strong> {entry.duree}{entry.concentration ? ' (Conc.)' : ''}</div>
            <div><strong>Composantes :</strong> {entry.composantes}</div>
            <div><strong>Classes :</strong> {entry.classes.join(', ')}</div>
          </div>

          {(entry.degatsOuSoin || entry.jetSauvegarde) && (
            <div className="text-[11px] font-mono bg-stone-50 border border-stone-200 rounded p-2 text-stone-800">
              {entry.degatsOuSoin ? `Effet : ${entry.degatsOuSoin} ${entry.typeDegats || ''}` : ''}
              {entry.jetSauvegarde ? ` · Sauvegarde : ${entry.jetSauvegarde}` : ''}
            </div>
          )}

          <div className="text-stone-800 leading-relaxed">{entry.description}</div>
          {entry.niveauxSuperieurs && (
            <div className="text-[11px] text-stone-600">
              <strong>Niveaux supérieurs :</strong> {entry.niveauxSuperieurs}
            </div>
          )}
        </div>
      )}

      {entry.categorie === 'regle' && (
        <div className="space-y-2.5">
          <div className="text-stone-800 leading-relaxed bg-stone-50 border border-stone-200 rounded p-3">
            {entry.regleExacte}
          </div>
          {entry.modificateurs?.length ? (
            <div className="space-y-1">
              <div className="text-[10px] font-bold uppercase text-stone-500">Modificateurs</div>
              <ul className="list-disc list-inside text-stone-700 space-y-0.5">
                {entry.modificateurs.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}

      {entry.categorie === 'classe_race' && (
        <div className="space-y-2.5">
          <div className="bg-stone-50 border border-stone-200 rounded-md p-2.5 space-y-1 text-[11px]">
            {entry.deVie && <div><strong>Dé de vie :</strong> {entry.deVie}</div>}
            {entry.caracteristiquesCles && <div><strong>Caractéristiques :</strong> {entry.caracteristiquesCles.join(', ')}</div>}
            {entry.bonusCaracteristiques && <div><strong>Bonus :</strong> {entry.bonusCaracteristiques}</div>}
            {entry.vitesse && <div><strong>Vitesse :</strong> {entry.vitesse}</div>}
            {entry.maitrises?.length ? <div><strong>Maîtrises :</strong> {entry.maitrises.join(' · ')}</div> : null}
          </div>
          <div className="space-y-1.5">
            {entry.capacites.map((c, i) => (
              <div key={i} className="bg-stone-50 border border-stone-200 rounded p-2">
                <div className="font-bold text-stone-900">
                  {c.nom}{c.niveau ? ` (Niv ${c.niveau})` : ''}
                </div>
                <div className="text-stone-700 mt-0.5">{c.desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
