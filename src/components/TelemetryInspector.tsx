import React, { useState } from 'react';
import { SimulationState } from '../types';
import { obtenirPnjsEnVue } from '../engine/encounters';
import { Terminal, Database, Cpu, Eye, EyeOff, Layers, ShieldAlert, Brain } from 'lucide-react';

interface TelemetryInspectorProps {
  etat: SimulationState;
}

export const TelemetryInspector: React.FC<TelemetryInspectorProps> = ({ etat }) => {
  const [selectedSeq, setSelectedSeq] = useState<number | null>(null);
  const [sousOnglet, setSousOnglet] = useState<'traces' | 'donnees_monde' | 'cerveau_mj'>('traces');

  const traces = etat.historiqueTraces || [];
  const derniereTrace = traces.length > 0 ? traces[traces.length - 1] : null;
  const traceActive = selectedSeq !== null
    ? traces.find(t => t.seq === selectedSeq) || derniereTrace
    : derniereTrace;

  return (
    <div className="bg-white border border-stone-200 shadow-xs rounded-lg p-4 text-xs space-y-4 text-stone-800">
      {/* En-tête */}
      <div className="flex flex-wrap items-center justify-between border-b border-stone-100 pb-3 gap-2">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-emerald-700" />
          <span className="font-bold text-stone-900 text-sm">
            Inspecteur IA & Télémétrie moteur
          </span>
          <span className="text-[11px] bg-stone-100 border border-stone-200 px-2 py-0.5 rounded text-stone-600 font-mono">
            {traces.length} opérations enregistrées
          </span>
        </div>

        {/* Sous-onglets */}
        <div className="flex flex-wrap items-center gap-1 bg-stone-100 p-1 rounded-md text-[11px]">
          <button
            onClick={() => setSousOnglet('traces')}
            className={`px-3 py-1 rounded transition-colors font-medium cursor-pointer ${
              sousOnglet === 'traces'
                ? 'bg-white text-stone-900 shadow-2xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Traces d'exécution & prompts IA
          </button>
          <button
            onClick={() => setSousOnglet('donnees_monde')}
            className={`px-3 py-1 rounded transition-colors font-medium cursor-pointer ${
              sousOnglet === 'donnees_monde'
                ? 'bg-white text-stone-900 shadow-2xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Données du monde (utilisées vs filtrées)
          </button>
          <button
            onClick={() => setSousOnglet('cerveau_mj')}
            className={`px-3 py-1 rounded transition-colors font-medium flex items-center gap-1 cursor-pointer ${
              sousOnglet === 'cerveau_mj'
                ? 'bg-white text-stone-900 shadow-2xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Brain className="w-3.5 h-3.5 text-amber-700" />
            Cerveau & Mémoire MJ
          </button>
        </div>
      </div>

      {sousOnglet === 'traces' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Liste chronologique */}
          <div className="lg:col-span-4 space-y-2">
            <div className="text-[11px] text-stone-500 font-semibold uppercase flex justify-between">
              <span>Opérations backend</span>
              <span>Séquence</span>
            </div>
            <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1">
              {traces.slice().reverse().map(trace => {
                const estSelectionne = traceActive?.seq === trace.seq;
                return (
                  <div
                    key={trace.seq}
                    onClick={() => setSelectedSeq(trace.seq)}
                    className={`p-2.5 rounded-lg border cursor-pointer transition-colors ${
                      estSelectionne
                        ? 'bg-emerald-50 border-emerald-300 text-stone-900 shadow-2xs'
                        : 'bg-stone-50 border-stone-200 text-stone-600 hover:border-stone-300'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-emerald-800 uppercase">{trace.actionType}</span>
                      <span className="text-stone-400 font-mono">Seq #{trace.seq}</span>
                    </div>
                    <div className="text-[11px] text-stone-500 mt-1 flex justify-between font-mono">
                      <span>{trace.timestamp}</span>
                      <span>{trace.latenceMs} ms</span>
                    </div>
                    <div className="text-[10px] text-stone-400 mt-0.5 truncate font-mono">
                      {trace.modeleIa}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Détails de la trace sélectionnée */}
          <div className="lg:col-span-8 space-y-3">
            {traceActive ? (
              <div className="bg-stone-50 border border-stone-200 rounded-lg p-3.5 space-y-3">
                <div className="flex flex-wrap items-center justify-between border-b border-stone-200 pb-2 gap-2">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-emerald-700" />
                    <span className="font-bold text-stone-900">
                      {traceActive.actionType} (Seq #{traceActive.seq})
                    </span>
                  </div>
                  <span className="text-[11px] text-stone-500 font-mono">
                    Modèle : <strong>{traceActive.modeleIa}</strong>
                    {traceActive.niveauReflexion ? ` · Réflexion ${traceActive.niveauReflexion}` : ''} ({traceActive.latenceMs} ms)
                  </span>
                </div>

                {(traceActive.motifReflexion || traceActive.rapportCoherence || (traceActive.notesSecretesTour && traceActive.notesSecretesTour.length > 0)) && (
                  <div className="bg-amber-50/70 border border-amber-200 p-2.5 rounded-md space-y-1 text-[11px]">
                    {traceActive.motifReflexion && (
                      <div className="text-stone-700">
                        <strong>Motif :</strong> {traceActive.motifReflexion}
                      </div>
                    )}
                    {traceActive.rapportCoherence && (
                      <div className="text-stone-700">
                        <strong>Audit cohérence :</strong> {traceActive.rapportCoherence.statut}
                        {traceActive.rapportCoherence.corrections.length > 0 && ` · Corrections : ${traceActive.rapportCoherence.corrections.join(' ; ')}`}
                        {traceActive.rapportCoherence.anomalies.length > 0 && ` · Anomalies : ${traceActive.rapportCoherence.anomalies.join(' ; ')}`}
                      </div>
                    )}
                    {traceActive.notesSecretesTour && traceActive.notesSecretesTour.length > 0 && (
                      <div className="text-stone-700">
                        <strong>Notes secrètes du tour :</strong> {traceActive.notesSecretesTour.join(' | ')}
                      </div>
                    )}
                  </div>
                )}

                {traceActive.appelsOutils && traceActive.appelsOutils.length > 0 && (
                  <div className="bg-white border border-stone-200 p-2.5 rounded-md space-y-1">
                    <span className="text-[10px] text-stone-500 uppercase font-bold block">
                      Outils orchestrés par le MJ ({traceActive.appelsOutils.length}) :
                    </span>
                    <div className="space-y-1">
                      {traceActive.appelsOutils.map((outil, idx) => (
                        <div key={idx} className="text-[11px] font-mono text-stone-700 border-t border-stone-100 pt-1">
                          <strong className="text-emerald-800">{outil.nom}</strong> → {outil.resultat}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Formule mathématique */}
                {traceActive.donneesUtilisees.formuleMathematique && (
                  <div className="bg-white border border-stone-200 p-2.5 rounded-md">
                    <span className="text-[10px] text-stone-500 uppercase font-bold">
                      Calcul déterministe backend :
                    </span>
                    <div className="text-amber-800 font-bold font-mono mt-0.5">
                      {traceActive.donneesUtilisees.formuleMathematique}
                    </div>
                  </div>
                )}

                {/* Règles & Attributs */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                  <div className="bg-white p-2.5 rounded-md border border-stone-200">
                    <span className="text-stone-500 uppercase text-[10px] font-bold block mb-1">
                      Règles SRD 5e invoquées ({traceActive.donneesUtilisees.reglesSrd.length}) :
                    </span>
                    <ul className="list-disc list-inside space-y-0.5 text-stone-700">
                      {traceActive.donneesUtilisees.reglesSrd.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-white p-2.5 rounded-md border border-stone-200">
                    <span className="text-stone-500 uppercase text-[10px] font-bold block mb-1">
                      Attributs personnage validés ({traceActive.donneesUtilisees.attributsPersonnage.length}) :
                    </span>
                    <ul className="list-disc list-inside space-y-0.5 text-stone-700">
                      {traceActive.donneesUtilisees.attributsPersonnage.map((a, i) => (
                        <li key={i}>{a}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {traceActive.donneesUtilisees.fichesSrdConsultees &&
                  traceActive.donneesUtilisees.fichesSrdConsultees.length > 0 && (
                    <div className="bg-white p-2.5 rounded-md border border-stone-200">
                      <span className="text-amber-800 uppercase text-[10px] font-bold block mb-1">
                        Fiches Compendium SRD 5e mobilisées ({traceActive.donneesUtilisees.fichesSrdConsultees.length}) :
                      </span>
                      <div className="text-[11px] font-mono text-stone-700">
                        {traceActive.donneesUtilisees.fichesSrdConsultees.join(' · ')}
                      </div>
                    </div>
                  )}

                {/* Filtrage Boundary-Aware Graphe */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                  <div className="bg-white p-2.5 rounded-md border border-stone-200">
                    <span className="text-emerald-800 uppercase text-[10px] font-bold flex items-center gap-1 mb-1">
                      <Eye className="w-3.5 h-3.5" /> Nœuds injectés au LLM ({traceActive.donneesUtilisees.noeudsGraphInjectes.length}) :
                    </span>
                    <ul className="list-disc list-inside space-y-0.5 text-stone-700">
                      {traceActive.donneesUtilisees.noeudsGraphInjectes.map((n, i) => (
                        <li key={i}>{n}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-white p-2.5 rounded-md border border-stone-200">
                    <span className="text-rose-800 uppercase text-[10px] font-bold flex items-center gap-1 mb-1">
                      <EyeOff className="w-3.5 h-3.5" /> Nœuds masqués / filtrés ({traceActive.donneesUtilisees.noeudsGraphFiltresMasques.length}) :
                    </span>
                    <ul className="list-disc list-inside space-y-0.5 text-stone-500">
                      {traceActive.donneesUtilisees.noeudsGraphFiltresMasques.map((n, i) => (
                        <li key={i}>{n}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Payload d'entrée */}
                <div>
                  <span className="text-stone-500 uppercase text-[10px] font-bold block mb-1">
                    Données d'entrée brutes (Payload Action) :
                  </span>
                  <pre className="bg-white p-2.5 rounded-md border border-stone-200 text-[10px] text-stone-800 font-mono overflow-x-auto">
                    {JSON.stringify(traceActive.donneesEntree, null, 2)}
                  </pre>
                </div>

                {/* Instructions & Prompts */}
                {traceActive.promptSystemeIa && (
                  <div>
                    <span className="text-stone-500 uppercase text-[10px] font-bold block mb-1">
                      Instructions système transmises au LLM :
                    </span>
                    <pre className="bg-white p-2.5 rounded-md border border-stone-200 text-[10px] text-stone-600 font-mono whitespace-pre-wrap">
                      {traceActive.promptSystemeIa}
                    </pre>
                  </div>
                )}

                {traceActive.promptUtilisateurIa && (
                  <div>
                    <span className="text-stone-500 uppercase text-[10px] font-bold block mb-1">
                      Prompt utilisateur injecté :
                    </span>
                    <pre className="bg-white p-2.5 rounded-md border border-stone-200 text-[10px] text-amber-900 font-mono whitespace-pre-wrap">
                      {traceActive.promptUtilisateurIa}
                    </pre>
                  </div>
                )}

                {/* Réponse brute */}
                {traceActive.reponseBruteIa && (
                  <div>
                    <span className="text-stone-500 uppercase text-[10px] font-bold block mb-1">
                      Réponse brute du modèle / moteur :
                    </span>
                    <pre className="bg-white p-2.5 rounded-md border border-stone-200 text-[10px] text-emerald-900 font-mono whitespace-pre-wrap">
                      {traceActive.reponseBruteIa}
                    </pre>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-stone-400 p-4 text-center">Aucune trace sélectionnée.</div>
            )}
          </div>
        </div>
      ) : sousOnglet === 'donnees_monde' ? (
        /* Données du monde */
        <div className="space-y-4">
          <div className="text-xs text-stone-600">
            Inventaire des données persistées dans la simulation. Les témoins indiquent si la donnée est sollicitée ou masquée.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Hexagones */}
            <div className="bg-stone-50 border border-stone-200 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-stone-900 font-bold border-b border-stone-200 pb-1.5">
                <Layers className="w-3.5 h-3.5 text-emerald-700" />
                <span>Hexagones topologiques ({etat.hexagones.length})</span>
              </div>
              <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                {etat.hexagones.map(hex => {
                  const estActuel = hex.id === etat.hexActuel.id;
                  return (
                    <div
                      key={hex.id}
                      className={`p-2 rounded-md border text-xs flex items-center justify-between ${
                        estActuel
                          ? 'bg-emerald-50 border-emerald-300 text-stone-900'
                          : 'bg-white border-stone-200 text-stone-700'
                      }`}
                    >
                      <div>
                        <div className="font-bold">{hex.nom} [{hex.q},{hex.r}]</div>
                        <div className="text-[11px] text-stone-500">
                          Terrain : {hex.terrain} · Sécurité : {hex.securite} · Visité : {hex.visite ? 'Oui' : 'Non'}
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        estActuel
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : 'bg-stone-100 text-stone-500'
                      }`}>
                        {estActuel ? 'OCCUPÉ' : 'EN MÉMOIRE'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Factions */}
            <div className="bg-stone-50 border border-stone-200 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-stone-900 font-bold border-b border-stone-200 pb-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-700" />
                <span>Factions politiques ({etat.factions.length})</span>
              </div>
              <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                {etat.factions.map(faction => {
                  const controleActuel = faction.noeudsControles.includes(etat.hexActuel.id);
                  return (
                    <div key={faction.id} className="p-2 rounded-md border border-stone-200 bg-white text-xs space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-stone-900">{faction.nom}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          controleActuel
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-stone-100 text-stone-600'
                        }`}>
                          {controleActuel ? 'AUTORITÉ LOCALE' : 'HORS-CHAMP'}
                        </span>
                      </div>
                      <div className="text-[11px] text-stone-500 font-mono">
                        Force : {faction.forceMilitaire} · Richesse : {faction.richesse} · Influence : {faction.influence}
                      </div>
                      <div className="text-[11px] text-stone-600">
                        Contrôle : {faction.noeudsControles.join(', ') || 'Aucun'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Graphe de connaissances */}
            <div className="bg-stone-50 border border-stone-200 rounded-lg p-3 space-y-2 md:col-span-2">
              <div className="flex items-center gap-1.5 text-stone-900 font-bold border-b border-stone-200 pb-1.5">
                <Database className="w-3.5 h-3.5 text-sky-700" />
                <span>Ontologie graphe GraphRAG ({etat.grapheNoeuds.length} Nœuds, {etat.grapheLiens.length} Liens)</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                {(() => {
                  const pnjsEnVueIds = new Set(obtenirPnjsEnVue(etat).map(p => p.id));
                  return etat.grapheNoeuds.map(noeud => {
                    const estInjecte =
                      noeud.type === 'Location' ||
                      pnjsEnVueIds.has(noeud.id) ||
                      noeud.connuParEntites?.includes(etat.hexActuel.id);
                    return (
                      <div
                        key={noeud.id}
                        className={`p-2 rounded-md border text-xs flex items-center justify-between ${
                          estInjecte
                            ? 'bg-white border-emerald-300 text-stone-900'
                            : 'bg-white/60 border-stone-200 text-stone-500'
                        }`}
                      >
                      <div className="space-y-0.5 max-w-[70%]">
                        <div className="font-bold flex items-center gap-1.5">
                          <span>{noeud.label}</span>
                          <span className="text-[9px] uppercase px-1 py-0.2 bg-stone-100 text-stone-600 rounded">
                            {noeud.type}
                          </span>
                        </div>
                        <div className="text-[10px] text-stone-400 truncate">
                          ID: {noeud.id} · Connu par : {noeud.connuParEntites?.join(', ') || 'Tous'}
                        </div>
                      </div>

                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        estInjecte
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : 'bg-rose-100 text-rose-800 border border-rose-200'
                      }`}>
                        {estInjecte ? 'INJECTÉ' : 'MASQUÉ'}
                      </span>
                    </div>
                  );
                });
                })()}
              </div>
            </div>

            {/* Unités & Chronique du monde */}
            <div className="bg-stone-50 border border-stone-200 rounded-lg p-3 space-y-2 md:col-span-2">
              <div className="flex items-center justify-between text-stone-900 font-bold border-b border-stone-200 pb-1.5">
                <span>Monde autonome</span>
                <span className="text-[11px] font-mono text-stone-500 font-normal">
                  {(etat.entitesMonde || []).filter(e => e.statut === 'EN_ROUTE').length} unité(s) · {(etat.chroniqueMonde || []).length} chronique(s)
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
                <div className="space-y-1">
                  {(etat.entitesMonde || []).filter(e => e.statut === 'EN_ROUTE').map(e => (
                    <div key={e.id} className="bg-white border border-stone-200 px-2.5 py-1.5 rounded flex justify-between">
                      <span className="font-semibold text-stone-800">{e.nom} ({e.type})</span>
                      <span className="font-mono text-stone-500">{e.hexId} → {e.destinationHexId}</span>
                    </div>
                  ))}
                  {(etat.entitesMonde || []).filter(e => e.statut === 'EN_ROUTE').length === 0 && (
                    <div className="text-stone-400">Aucune unité en route.</div>
                  )}
                </div>
                <div className="space-y-1">
                  {(etat.chroniqueMonde || []).slice(0, 4).map(c => (
                    <div key={c.id} className="bg-white border border-stone-200 px-2.5 py-1.5 rounded flex justify-between gap-2">
                      <span className="font-medium text-stone-800 truncate">{c.titre}</span>
                      <span className="font-mono text-stone-500 shrink-0">J{c.jour} · T{c.tick}</span>
                    </div>
                  ))}
                  {(etat.chroniqueMonde || []).length === 0 && (
                    <div className="text-stone-400">Chronique vide.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Cerveau & Mémoire MJ : Transparence complète des coulisses */
        (() => {
          const mem = etat.memoireMJ;
          const pnjs = etat.grapheNoeuds.filter(n => n.type === 'Actor');
          const dernierAudit = [...traces].reverse().find(t => t.rapportCoherence)?.rapportCoherence;

          return (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-stone-600">
                <span>État interne du Maître du Jeu : mémoire condensée, arcs, secrets PNJ et notes cachées.</span>
                <span className="font-mono text-[11px] text-stone-500">
                  Modèle : <strong>Gemini 4 Hydrogen {etat.profilHydrogen === 'MAX' ? 'Max' : 'Standard'}</strong> · Narration : <strong>{etat.modeNarration || 'CONCIS'}</strong>
                  {etat.jetEnAttente ? ` · Jet en attente : ${etat.jetEnAttente.competence || etat.jetEnAttente.caracteristique} DD ${etat.jetEnAttente.dd}` : ''}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Chronique condensée & Fil récent */}
                <div className="bg-stone-50 border border-stone-200 rounded-lg p-3 space-y-2">
                  <div className="font-bold text-stone-900 border-b border-stone-200 pb-1.5">
                    Mémoire de campagne
                  </div>
                  {mem?.chroniqueCondensee && (
                    <div className="bg-white border border-stone-200 rounded p-2 text-[11px] space-y-1">
                      <div className="font-semibold text-amber-800 text-[10px] uppercase">Chronique condensée</div>
                      <div className="whitespace-pre-wrap text-stone-700 leading-relaxed">{mem.chroniqueCondensee}</div>
                    </div>
                  )}
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {(mem?.filNarratif || []).length === 0 ? (
                      <div className="text-stone-400">Aucun événement mémorisé.</div>
                    ) : (
                      mem!.filNarratif.map((ligne, idx) => (
                        <div key={idx} className="bg-white border border-stone-200 rounded px-2 py-1 text-[11px] text-stone-700">
                          {ligne}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Journal secret du MJ */}
                <div className="bg-stone-50 border border-stone-200 rounded-lg p-3 space-y-2">
                  <div className="font-bold text-stone-900 border-b border-stone-200 pb-1.5">
                    Notes secrètes du MJ ({mem?.journalSecretMJ?.length || 0})
                  </div>
                  <div className="space-y-1.5 max-h-60 overflow-y-auto">
                    {(mem?.journalSecretMJ || []).length === 0 ? (
                      <div className="text-stone-400">Aucune note secrète enregistrée.</div>
                    ) : (
                      mem!.journalSecretMJ!.slice().reverse().map(n => (
                        <div key={n.id} className="bg-white border border-amber-200 rounded p-2 space-y-0.5 text-[11px]">
                          <div className="flex justify-between font-semibold text-stone-900">
                            <span>{n.titre}</span>
                            <span className="font-mono text-[10px] text-stone-400">J{n.jour}</span>
                          </div>
                          <div className="text-stone-700">{n.contenu}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Arcs narratifs */}
                <div className="bg-stone-50 border border-stone-200 rounded-lg p-3 space-y-2">
                  <div className="font-bold text-stone-900 border-b border-stone-200 pb-1.5">
                    Arcs narratifs ({mem?.arcsNarratifs?.length || 0})
                  </div>
                  <div className="space-y-1.5 max-h-56 overflow-y-auto">
                    {(mem?.arcsNarratifs || []).length === 0 ? (
                      <div className="text-stone-400">Aucun arc actif.</div>
                    ) : (
                      mem!.arcsNarratifs!.map(a => (
                        <div key={a.id} className="bg-white border border-stone-200 rounded p-2 space-y-1 text-[11px]">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-stone-900">{a.titre}</span>
                            <span className="font-mono text-[10px] text-amber-800">{a.statut} · {a.progression}%</span>
                          </div>
                          {a.resume && (
                            <div className="text-stone-600">{a.resume}</div>
                          )}
                          {(a.acteursLies || []).length > 0 && (
                            <div className="text-[10px] text-stone-500">Acteurs : {(a.acteursLies || []).join(', ')}</div>
                          )}
                          {a.prochaineEtape && (
                            <div className="text-stone-700">Suite : {a.prochaineEtape}</div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Conséquences différées & Dernier audit */}
                <div className="bg-stone-50 border border-stone-200 rounded-lg p-3 space-y-2">
                  <div className="font-bold text-stone-900 border-b border-stone-200 pb-1.5">
                    Conséquences différées & Cohérence
                  </div>
                  {dernierAudit && (
                    <div className="bg-white border border-stone-200 rounded p-2 text-[11px] space-y-0.5">
                      <div className="font-semibold text-stone-900">
                        Dernier audit : {dernierAudit.statut}
                      </div>
                      {dernierAudit.corrections.map((c, i) => (
                        <div key={`dc-${i}`} className="text-amber-800">Corrigé : {c}</div>
                      ))}
                      {dernierAudit.anomalies.map((a, i) => (
                        <div key={`da-${i}`} className="text-rose-800">Anomalie : {a}</div>
                      ))}
                    </div>
                  )}
                  <div className="space-y-1 max-h-44 overflow-y-auto">
                    {(mem?.consequencesDifferees || []).length === 0 ? (
                      <div className="text-stone-400">Aucune conséquence différée.</div>
                    ) : (
                      mem!.consequencesDifferees.map(c => (
                        <div key={c.id} className="bg-white border border-stone-200 rounded p-2 text-[11px]">
                          <div className="flex justify-between font-semibold text-stone-800">
                            <span>{c.declencheur}</span>
                            <span className="font-mono text-[10px] text-stone-500">{c.actif ? 'ACTIF' : 'RÉSOLU'}</span>
                          </div>
                          <div className="text-stone-600">{c.effetPrevu}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* PNJ Secrets & Dispositions */}
                <div className="bg-stone-50 border border-stone-200 rounded-lg p-3 space-y-2 md:col-span-2">
                  <div className="font-bold text-stone-900 border-b border-stone-200 pb-1.5">
                    PNJ : dispositions, motivations & secrets ({pnjs.length})
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                    {pnjs.map(p => (
                      <div key={p.id} className="bg-white border border-stone-200 rounded p-2 text-[11px] space-y-0.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-stone-900">
                            {p.label} ({p.proprietes?.profession || 'PNJ'})
                          </span>
                          <span className="font-mono text-[10px] text-stone-500">
                            {p.proprietes?.disposition || 'NEUTRE'} · {p.proprietes?.hexId || 'Secteur'}
                          </span>
                        </div>
                        {p.proprietes?.motivation && (
                          <div className="text-stone-700">Motivation : {p.proprietes.motivation}</div>
                        )}
                        {p.proprietes?.secret && (
                          <div className="text-amber-900">Secret : {p.proprietes.secret}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })()
      )}
    </div>
  );
};
