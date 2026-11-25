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
import { QuestsPanel } from './components/QuestsPanel';
import { TelemetryInspector } from './components/TelemetryInspector';
import { CodexPanel } from './components/CodexPanel';
import { WorldGodModeView } from './components/WorldGodModeView';
import { AuthBar } from './components/AuthBar';
import { FirebaseBackupBanner } from './components/FirebaseBackupBanner';
import { ResetCampaignButton } from './components/ResetCampaignButton';
import { HydrogenProfileSwitch } from './components/HydrogenProfileSwitch';
import { HexNode } from './types';
import { Terminal, Gamepad2, BookMarked, Globe, X } from 'lucide-react';
import { useElapsedWait } from './hooks/useElapsedWait';
import { formaterDureeAttente } from './utils/aiTimeoutConfig';

export default function App() {
  const {
    etat,
    chargement,
    erreur,
    avisAnnulation,
    infoRetry,
    effacerErreur,
    effacerAvisAnnulation,
    narrationEnCours,
    resetVersion,
    authSession,
    enregistrerAuth,
    firebaseUser,
    statutSauvegarde,
    syncEnCours,
    messageSync,
    effacerMessageSync,
    connexionGoogle,
    deconnexionGoogle,
    copierVersSecours,
    restaurerDepuisSecours,
    executerAction,
    reessayerDerniereAction,
    aActionAReessayer,
    annulerActionEnCours,
    avancerTempsAdmin,
    reinitialiserPartie,
    analyserImportHeros,
    genererMonde,
    synchroniserAzgaar,
    importerCarteAzgaar,
    executerActionMJMonde,
    initialiserForgeMonde,
    executerEtapeForgeMonde,
    appliquerForgeMonde,
    promouvoirPnjsProches,
  } = useSimulation();

  const [ongletActif, setOngletActif] = useState<'jeu' | 'codex' | 'godmode' | 'telemetrie'>('jeu');
  const [hexSelectionne, setHexSelectionne] = useState<HexNode | null>(null);
  const [cibleCombat, setCibleCombat] = useState<string | null>(null);
  const [voletReplie, setVoletReplie] = useState(false);
  const [carteAgrandie, setCarteAgrandie] = useState(false);
  const [ouvrirForgeAuSwitch, setOuvrirForgeAuSwitch] = useState(false);

  const nbTraces = etat.historiqueTraces?.length || 0;
  const afficherCartePleineLargeur = carteAgrandie && !etat.combat.actif;
  const elapsedGlobalMs = useElapsedWait(chargement && ongletActif !== 'jeu');

  const handleRecommencer = async () => {
    setHexSelectionne(null);
    setCibleCombat(null);
    await reinitialiserPartie();
  };

  const noeudCarteTactique = (
    <TacticalMap
      etat={etat}
      chargement={chargement}
      cibleCombatSelectionnee={cibleCombat}
      hexSelectionne={hexSelectionne}
      estAgrandie={carteAgrandie}
      onToggleAgrandir={() => setCarteAgrandie(prev => !prev)}
      onSelectHex={hex => setHexSelectionne(hex)}
      onSelectCibleCombat={id => setCibleCombat(id)}
      onSyncAzgaar={synchroniserAzgaar}
      onAnnoterHex={(hexId, note) =>
        executerAction({ type: 'ANNOTER_HEX', cibleId: hexId, texteLibre: note })
      }
      onGenererMonde={genererMonde}
      onRestaurerValGris={handleRecommencer}
      onOuvrirForge={() => {
        setOuvrirForgeAuSwitch(true);
        setOngletActif('godmode');
      }}
      onPromouvoirPnjs={ids => void promouvoirPnjsProches(ids)}
    />
  );

  return (
    <div className="min-h-screen dnd-table-bg text-[#231a14] flex flex-col font-sans selection:bg-amber-200 selection:text-amber-950">
      <WorldHeader horloge={etat.horloge} hexActuel={etat.hexActuel} personnage={etat.personnage} />

      <main className="flex-1 max-w-[1440px] w-full mx-auto px-3 sm:px-5 py-3 space-y-3">
        {/* Barre de navigation parchemin & laiton */}
        <div className="flex flex-wrap items-center justify-between px-1 gap-2 border-b border-[#cab58b] pb-2">
          <div className="flex items-center gap-1 p-1 bg-[#e3d6bc]/80 border border-[#c6b084] rounded-lg">
            <button
              onClick={() => setOngletActif('jeu')}
              className={`px-3 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                ongletActif === 'jeu'
                  ? 'dnd-wood-bar border shadow-xs'
                  : 'text-[#5b4735] hover:text-[#231a14]'
              }`}
            >
              <Gamepad2 className={`w-3.5 h-3.5 ${ongletActif === 'jeu' ? 'text-[#e5be6e]' : 'text-[#8c6422]'}`} />
              Tableau de bord
            </button>
            <button
              onClick={() => setOngletActif('godmode')}
              className={`px-3 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                ongletActif === 'godmode'
                  ? 'dnd-wood-bar border shadow-xs'
                  : 'text-[#5b4735] hover:text-[#231a14]'
              }`}
            >
              <Globe className={`w-3.5 h-3.5 ${ongletActif === 'godmode' ? 'text-[#e5be6e]' : 'text-[#8c6422]'}`} />
              Monde &amp; Atlas
            </button>
            <button
              onClick={() => setOngletActif('codex')}
              className={`px-3 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                ongletActif === 'codex'
                  ? 'dnd-wood-bar border shadow-xs'
                  : 'text-[#5b4735] hover:text-[#231a14]'
              }`}
            >
              <BookMarked className={`w-3.5 h-3.5 ${ongletActif === 'codex' ? 'text-[#e5be6e]' : 'text-[#8c6422]'}`} />
              Codex 5e
            </button>
            <button
              onClick={() => setOngletActif('telemetrie')}
              className={`px-3 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                ongletActif === 'telemetrie'
                  ? 'dnd-wood-bar border shadow-xs'
                  : 'text-[#5b4735] hover:text-[#231a14]'
              }`}
            >
              <Terminal className={`w-3.5 h-3.5 ${ongletActif === 'telemetrie' ? 'text-emerald-300' : 'text-emerald-800'}`} />
              Inspection IA & Données
              <span className="text-[10px] opacity-80 font-mono tabular-nums">
                · {nbTraces}
              </span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <HydrogenProfileSwitch
              profil={etat.profilHydrogen || 'STANDARD'}
              chargement={chargement}
              onChange={profil =>
                executerAction({
                  type: 'CONFIGURER_MODELE_IA',
                  payloadAction: { profil },
                })
              }
            />
            <AuthBar
              authSession={authSession}
              onUpdateSession={enregistrerAuth}
              firebaseUser={firebaseUser}
              statutSauvegarde={statutSauvegarde}
              syncEnCours={syncEnCours}
              onConnexionGoogle={connexionGoogle}
              onDeconnexionGoogle={deconnexionGoogle}
              onCopierSecours={copierVersSecours}
              onRestaurerSecours={restaurerDepuisSecours}
            />
            <ResetCampaignButton
              chargement={chargement || syncEnCours}
              onReset={handleRecommencer}
            />
          </div>
        </div>

        <FirebaseBackupBanner
          connecte={Boolean(firebaseUser)}
          statutSauvegarde={statutSauvegarde}
          syncEnCours={syncEnCours}
          messageSync={messageSync}
          onRestaurerSecours={restaurerDepuisSecours}
          onCopierSecours={copierVersSecours}
          onFermerMessage={effacerMessageSync}
        />

        {chargement && ongletActif !== 'jeu' && (
          <div className="bg-[#faf2de] border border-[#b48a3e] text-[#2a1d13] px-3 py-2 rounded-lg text-xs flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-medium">En attente du MJ IA</span>
              <span aria-hidden="true" className="text-[#b48a3e]">·</span>
              <span className="font-mono tabular-nums text-[#5b4735]">
                {formaterDureeAttente(elapsedGlobalMs)} / 15:00
              </span>
              {infoRetry && (
                <span className="text-[11px] text-[#8c5a18] truncate">{infoRetry}</span>
              )}
            </div>
            <button
              type="button"
              onClick={annulerActionEnCours}
              className="px-2.5 py-1 rounded border border-[#b48a3e] bg-[#f7eed8] hover:bg-[#efe0bd] text-[#3a2817] text-xs font-medium flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Annuler</span>
            </button>
          </div>
        )}

        {avisAnnulation && (
          <div className="bg-[#f6ebd3] border border-[#b48a3e] text-[#3a2817] px-3 py-2 rounded-lg text-xs flex items-center justify-between gap-2">
            <span>{avisAnnulation}</span>
            <button
              type="button"
              onClick={effacerAvisAnnulation}
              className="text-[11px] underline shrink-0 cursor-pointer"
            >
              Fermer
            </button>
          </div>
        )}

        {erreur && (
          <div className="bg-rose-50 border border-rose-300 text-rose-900 p-2.5 rounded-lg text-xs flex flex-wrap items-center justify-between gap-2">
            <span className="min-w-0 flex-1">Alerte système : {erreur}</span>
            <div className="flex items-center gap-2 shrink-0">
              {aActionAReessayer && !chargement && (
                <button
                  type="button"
                  onClick={reessayerDerniereAction}
                  className="px-2.5 py-1 rounded border border-rose-300 bg-white hover:bg-rose-100 text-rose-900 text-[11px] font-medium whitespace-nowrap cursor-pointer"
                >
                  Réessayer
                </button>
              )}
              <button
                type="button"
                onClick={effacerErreur}
                className="text-[11px] underline shrink-0 cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        )}

        {/* Vue active : strictement deux colonnes sur bureau */}
        {ongletActif === 'telemetrie' ? (
          <TelemetryInspector etat={etat} />
        ) : ongletActif === 'codex' ? (
          <CodexPanel
            etat={etat}
            chargement={chargement}
            onPromouvoirPnj={ids => void promouvoirPnjsProches(ids)}
          />
        ) : ongletActif === 'godmode' ? (
          <WorldGodModeView
            etat={etat}
            chargement={chargement}
            onAvancerTemps={avancerTempsAdmin}
            onGenererMonde={genererMonde}
            onRestaurerValGris={handleRecommencer}
            onSyncAzgaar={synchroniserAzgaar}
            onImporterAzgaar={importerCarteAzgaar}
            onActionMJ={executerActionMJMonde}
            onInitialiserForge={initialiserForgeMonde}
            onExecuterEtapeForge={executerEtapeForgeMonde}
            onAppliquerForge={async draft => {
              await appliquerForgeMonde(draft);
              setOuvrirForgeAuSwitch(false);
            }}
            onPromouvoirPnjs={ids => promouvoirPnjsProches(ids)}
            ouvrirForgeInitial={ouvrirForgeAuSwitch}
            onConsommerOuvrirForge={() => setOuvrirForgeAuSwitch(false)}
          />
        ) : (
          <div className="space-y-3">
            {afficherCartePleineLargeur && noeudCarteTactique}
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_440px] xl:grid-cols-[minmax(0,1fr)_510px] gap-4 items-start">
              <div className="min-w-0 flex flex-col space-y-3">
                <NarrativeFeed
                  journal={etat.journalNarratif}
                  nomMonde={etat.azgaarStudio?.worldName || etat.carteAzgaar?.nomMonde || etat.hexActuel.nom}
                  narrationEnCours={narrationEnCours}
                  modeNarration={etat.modeNarration}
                  jetEnAttente={etat.jetEnAttente}
                  resetVersion={resetVersion}
                  sceneContext={{
                    lieuNom: etat.hexActuel.nom,
                    terrain: etat.hexActuel.terrain,
                    biomeAzgaar: etat.hexActuel.biomeAzgaar,
                    meteo: etat.horloge.meteo,
                    heure: etat.horloge.heure,
                    enCombat: etat.combat.actif,
                    enDonjon: Boolean(etat.donjon?.actif),
                  }}
                  chargement={chargement}
                  infoRetry={infoRetry}
                  onExecuterAction={executerAction}
                  onAnnulerAction={annulerActionEnCours}
                />
                <ActionPanel
                  etat={etat}
                  hexCibleSelectionne={hexSelectionne}
                  cibleCombatSelectionnee={cibleCombat}
                  chargement={chargement}
                  onExecuterAction={executerAction}
                  onReset={handleRecommencer}
                />
              </div>

              <div className="min-w-0 flex flex-col space-y-3">
                {!afficherCartePleineLargeur && noeudCarteTactique}
              <QuestsPanel
                memoireMJ={etat.memoireMJ}
                chargement={chargement}
                onExecuterAction={executerAction}
              />
              <FactionStatus
                factions={etat.factions}
                marche={etat.marche}
                grapheNoeuds={etat.grapheNoeuds}
                hexagones={etat.hexagones}
                entitesMonde={etat.entitesMonde}
                chroniqueMonde={etat.chroniqueMonde}
                chargement={chargement}
              />
              <SidebarDrawer
                etat={etat}
                personnage={etat.personnage}
                estEnBourgade={
                  etat.hexActuel.pointInteret?.type === 'bourgade' &&
                  etat.hexActuel.pointInteret?.statut === 'OPERATIONNEL'
                }
                chargement={chargement}
                estReplie={voletReplie}
                onToggleReplie={() => setVoletReplie(prev => !prev)}
                onExecuterAction={executerAction}
                onAnalyserImportHeros={analyserImportHeros}
              />
            </div>
          </div>
        </div>
        )}
      </main>
    </div>
  );
}
