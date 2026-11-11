import React, { useState } from 'react';
import { SimulationState } from '../types';
import { Terminal, Database, Cpu, Eye, EyeOff, Layers, ShieldAlert } from 'lucide-react';

interface TelemetryInspectorProps {
  etat: SimulationState;
}

export const TelemetryInspector: React.FC<TelemetryInspectorProps> = ({ etat }) => {
  const [selectedSeq, setSelectedSeq] = useState<number | null>(null);
  const [sousOnglet, setSousOnglet] = useState<'traces' | 'donnees_monde'>('traces');

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
        <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-md text-[11px]">
          <button
            onClick={() => setSousOnglet('traces')}
            className={`px-3 py-1 rounded transition-colors font-medium ${
              sousOnglet === 'traces'
                ? 'bg-white text-stone-900 shadow-2xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Traces d'exécution & prompts IA
          </button>
          <button
            onClick={() => setSousOnglet('donnees_monde')}
            className={`px-3 py-1 rounded transition-colors font-medium ${
              sousOnglet === 'donnees_monde'
                ? 'bg-white text-stone-900 shadow-2xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Données du monde (utilisées vs filtrées)
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
                    Modèle : <strong>{traceActive.modeleIa}</strong> ({traceActive.latenceMs} ms)
                  </span>
                </div>

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
      ) : (
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
                {etat.grapheNoeuds.map(noeud => {
                  const estInjecte = noeud.type === 'Location' || noeud.id === 'npc_forgeron_torvin' || noeud.connuParEntites?.includes('hex_0000_bourgade');
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
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
