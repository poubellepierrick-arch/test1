/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useSimulation } from './hooks/useSimulation';
import { WorldHeader } from './components/WorldHeader';
import { SidebarDrawer } from './components/SidebarDrawer';
import { TacticalMap } from './components/TacticalMap';
import { NarrativeFeed } from './components/NarrativeFeed';
import { ActionPanel } from './components/ActionPanel';
import { FactionStatus } from './components/FactionStatus';
import { TelemetryInspector } from './components/TelemetryInspector';
import { AuthBar } from './components/AuthBar';
import { HexNode } from './types';
import { Terminal, Gamepad2 } from 'lucide-react';

export default function App() {
  const {
    etat,
    chargement,
    erreur,
    authSession,
    enregistrerAuth,
    executerAction,
    forcerWorldTick,
    reinitialiserPartie,
  } = useSimulation();

  const [ongletActif, setOngletActif] = useState<'jeu' | 'telemetrie'>('jeu');
  const [hexSelectionne, setHexSelectionne] = useState<HexNode | null>(null);
  const [cibleCombat, setCibleCombat] = useState<string | null>(null);

  const nbTraces = etat.historiqueTraces?.length || 0;

  return (
    <div className="min-h-screen bg-[#f8f6f0] text-stone-900 flex flex-col font-sans selection:bg-amber-200 selection:text-amber-900">
      <WorldHeader horloge={etat.horloge} hexActuel={etat.hexActuel} personnage={etat.personnage} />

      <main className="flex-1 max-w-7xl w-full mx-auto p-3 space-y-3">
        {/* Navigation supérieure sobre */}
        <div className="flex flex-wrap items-center justify-between px-1 gap-2 border-b border-stone-200 pb-2">
          <div className="flex items-center gap-1.5 p-1 bg-stone-200/60 rounded-lg">
            <button
              onClick={() => setOngletActif('jeu')}
              className={`px-3 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${
                ongletActif === 'jeu'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Gamepad2 className="w-3.5 h-3.5 text-amber-700" />
              Tableau de bord
            </button>
            <button
              onClick={() => setOngletActif('telemetrie')}
              className={`px-3 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${
                ongletActif === 'telemetrie'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Terminal className="w-3.5 h-3.5 text-emerald-700" />
              Inspection IA & Données
              <span className="text-[10px] bg-stone-100 text-stone-600 px-1.5 py-0.2 rounded font-mono">
                {nbTraces}
              </span>
            </button>
          </div>

          <AuthBar authSession={authSession} onUpdateSession={enregistrerAuth} />
        </div>

        {erreur && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 p-2.5 rounded-lg text-xs">
            Alerte système : {erreur}
          </div>
        )}

        {/* Vue active */}
        {ongletActif === 'telemetrie' ? (
          <TelemetryInspector etat={etat} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            <SidebarDrawer
              personnage={etat.personnage}
              hexNom={etat.hexActuel.nom}
              meteo={etat.horloge.meteo}
              chargement={chargement}
              onExecuterAction={executerAction}
            />

            <div className="lg:col-span-4 flex flex-col space-y-3">
              <NarrativeFeed journal={etat.journalNarratif} />
              <ActionPanel
                etat={etat}
                hexCibleSelectionne={hexSelectionne}
                cibleCombatSelectionnee={cibleCombat}
                chargement={chargement}
                onExecuterAction={executerAction}
                onReset={reinitialiserPartie}
              />
            </div>

            <div className="lg:col-span-4 space-y-3">
              <TacticalMap
                hexActuel={etat.hexActuel}
                hexagones={etat.hexagones}
                combat={etat.combat}
                hexSelectionne={hexSelectionne}
                onSelectHex={hex => setHexSelectionne(hex)}
                onSelectCibleCombat={id => setCibleCombat(id)}
                onAnnoterHex={(hexId, note) =>
                  executerAction({ type: 'ANNOTER_HEX', cibleId: hexId, texteLibre: note })
                }
              />
              <FactionStatus
                factions={etat.factions}
                marche={etat.marche}
                grapheNoeuds={etat.grapheNoeuds}
                onTickManuel={forcerWorldTick}
                chargement={chargement}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
