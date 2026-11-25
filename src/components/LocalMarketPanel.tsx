import React, { useMemo, useState } from 'react';
import { SimulationState } from '../types';
import { ActionRequest } from '../engine/adjudication';
import { evaluerContexteLieu } from '../engine/context';
import {
  formaterPrixPC,
  obtenirArticlesComptoirSRD,
  obtenirFicheSrd,
} from '../engine/compendium';
import { ItemIcon } from '../utils/itemIcons';
import { ItemIllustrationInline, ItemImageTrigger } from './ItemIllustrationInline';
import { ShieldAlert } from 'lucide-react';

interface LocalMarketPanelProps {
  etat: SimulationState;
  chargement: boolean;
  onExecuterAction: (action: ActionRequest) => void;
}

type FiltreComptoir = 'Essentiels' | 'Survie' | 'Armurerie' | 'Soins' | 'Outils' | 'Revente';

const IDS_ESSENTIELS = new Set([
  'item_ration',
  'item_eau',
  'item_torche',
  'item_bandage',
  'item_fleches',
  'item_dague',
]);

export const LocalMarketPanel: React.FC<LocalMarketPanelProps> = ({
  etat,
  chargement,
  onExecuterAction,
}) => {
  const ctx = evaluerContexteLieu(etat);
  const colporteur = ctx.pnjsEnVue.find(p => p.proprietes?.proposeCommerce);
  const caravane = ctx.entitesSurHex.find(e => e.type === 'CARAVANE');
  const titreComptoir =
    ctx.aColporteurEnVue && !ctx.estEnBourgade && colporteur
      ? `Besace · ${colporteur.label}`
      : !ctx.estEnBourgade && caravane
      ? `Convoi · ${caravane.nom}`
      : 'Comptoir de Val-Gris';

  const [filtre, setFiltre] = useState<FiltreComptoir>('Essentiels');
  const [quantites, setQuantites] = useState<Record<string, number>>({});
  const [objetIllustreId, setObjetIllustreId] = useState<string | null>(null);
  const [confirmationAchat, setConfirmationAchat] = useState<{
    mode: 'acheter' | 'vendre';
    articleId: string;
    nom: string;
    coutTotal: string;
    qte: number;
  } | null>(null);

  const multFer = etat.marche.penurieArmurerie ? etat.marche.multiplicateurFer : 1.0;
  const multVivres = etat.marche.penurieVivres ? (etat.marche.multiplicateurVivres || 1.0) : 1.0;

  const articles = useMemo(() => {
    const srdArticles = obtenirArticlesComptoirSRD();
    const filtres =
      filtre === 'Essentiels'
        ? srdArticles.filter(a => IDS_ESSENTIELS.has(a.id))
        : srdArticles.filter(a => a.categorieComptoir === filtre);

    return filtres.map(a => {
      const estFer = a.categorieComptoir === 'Armurerie' || a.motsCles.includes('fer');
      const estVivres = a.id === 'item_ration' || a.id === 'item_eau' || a.categorieComptoir === 'Survie';
      const multActif =
        estFer && etat.marche.penurieArmurerie
          ? multFer
          : estVivres && etat.marche.penurieVivres
          ? multVivres
          : 1.0;
      const prixUnitairePC = Math.round(a.valeurPC * multActif);

      return {
        id: a.id,
        nom: a.nom,
        nomEn: a.nomEn,
        sousCategorie: a.sousCategorie,
        rarete: a.rarete,
        effet: a.effet,
        degats: a.degats,
        caBase: a.caBase,
        motsCles: a.motsCles,
        prixPC: prixUnitairePC,
        labelPrix: formaterPrixPC(prixUnitairePC),
        desc:
          estFer && etat.marche.penurieArmurerie
            ? `Fer x${multFer} · ${a.resume}`
            : estVivres && etat.marche.penurieVivres
            ? `Vivres x${multVivres} · ${a.resume}`
            : a.resume,
      };
    });
  }, [filtre, etat.marche.penurieArmurerie, etat.marche.penurieVivres, multFer, multVivres]);

  const handleDemanderAchat = (art: (typeof articles)[0]) => {
    const qte = quantites[art.id] || 1;
    const totalPC = art.prixPC * qte;
    setConfirmationAchat({
      mode: 'acheter',
      articleId: art.id,
      nom: art.nom,
      coutTotal: formaterPrixPC(totalPC),
      qte,
    });
  };

  const handleDemanderVente = (item: SimulationState['personnage']['inventaire'][0]) => {
    const fiche = item.compendiumId ? obtenirFicheSrd(item.compendiumId) : obtenirFicheSrd(item.nom);
    const prixBasePC =
      fiche?.categorie === 'objet' ? fiche.valeurPC : Math.max(10, Math.round((item.valeurPO || 1) * 100));
    const gainPC = Math.max(1, Math.floor(prixBasePC / 2));
    setConfirmationAchat({
      mode: 'vendre',
      articleId: item.id,
      nom: item.nom,
      coutTotal: `+${formaterPrixPC(gainPC)}`,
      qte: 1,
    });
  };

  const validerOperation = () => {
    if (!confirmationAchat) return;
    if (confirmationAchat.mode === 'vendre') {
      onExecuterAction({
        type: 'TROQUER',
        articleId: confirmationAchat.articleId,
        quantite: confirmationAchat.qte,
        payloadAction: { mode: 'vendre' },
      });
    } else {
      onExecuterAction({
        type: 'TROQUER',
        articleId: confirmationAchat.articleId,
        quantite: confirmationAchat.qte,
      });
    }
    setConfirmationAchat(null);
  };

  if (!ctx.peutCommercer) {
    return (
      <div className="bg-stone-50 border border-stone-200 rounded-lg p-3 text-xs text-stone-500">
        {ctx.raisonCommerce}
      </div>
    );
  }

  return (
    <div className="space-y-2 text-xs">
      <div className="flex flex-wrap items-center justify-between text-stone-500 text-[11px] gap-1">
        <span className="font-semibold uppercase tracking-wide">{titreComptoir}</span>
        <span className="font-mono text-stone-700 font-semibold tabular-nums">
          Solde : {etat.personnage.monnaies.po} PO · {etat.personnage.monnaies.pa} PA · {etat.personnage.monnaies.pc} PC
        </span>
      </div>

      {/* Onglets catégories du comptoir SRD */}
      <div className="flex flex-wrap items-center gap-1 bg-stone-100 p-1 rounded-md text-[11px]">
        {(['Essentiels', 'Survie', 'Armurerie', 'Soins', 'Outils', 'Revente'] as FiltreComptoir[]).map(tab => (
          <button
            key={tab}
            onClick={() => {
              setFiltre(tab);
              setConfirmationAchat(null);
            }}
            className={`px-2 py-0.5 rounded font-medium transition-colors ${
              filtre === tab ? 'bg-white text-stone-900 shadow-2xs' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            {tab === 'Revente' ? 'Revente 50 %' : tab}
          </button>
        ))}
      </div>

      {(etat.marche.penurieArmurerie || etat.marche.penurieVivres) && (
        <div className="bg-amber-50 border border-amber-300 p-2 rounded-md flex items-center gap-2 text-[11px] text-amber-900">
          <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0" />
          <span>
            {etat.marche.penurieArmurerie ? `Fer x${etat.marche.multiplicateurFer}` : ''}
            {etat.marche.penurieArmurerie && etat.marche.penurieVivres ? ' · ' : ''}
            {etat.marche.penurieVivres ? `Vivres x${multVivres}` : ''}
          </span>
        </div>
      )}

      {/* Confirmation en ligne */}
      {confirmationAchat && (
        <div className="bg-amber-50 border border-amber-300 p-2.5 rounded-lg flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs text-amber-900">
            {confirmationAchat.mode === 'vendre'
              ? `Vendre ${confirmationAchat.qte}x ${confirmationAchat.nom} pour `
              : `Acheter ${confirmationAchat.qte}x ${confirmationAchat.nom} pour `}
            <strong>{confirmationAchat.coutTotal}</strong> ?
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={validerOperation}
              disabled={chargement}
              className="px-3 py-1 bg-amber-700 hover:bg-amber-800 text-white font-medium rounded-md shadow-xs transition-colors"
            >
              Confirmer
            </button>
            <button
              onClick={() => setConfirmationAchat(null)}
              className="px-2.5 py-1 bg-white hover:bg-stone-100 text-stone-700 rounded-md border border-stone-300"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {filtre === 'Revente' ? (
        <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
          {etat.personnage.inventaire.length === 0 ? (
            <div className="text-stone-500 text-center py-3">Paquetage vide.</div>
          ) : (
            etat.personnage.inventaire.map(item => {
              const fiche = item.compendiumId ? obtenirFicheSrd(item.compendiumId) : obtenirFicheSrd(item.nom);
              const srdObj = fiche?.categorie === 'objet' ? fiche : undefined;
              const prixBasePC =
                srdObj ? srdObj.valeurPC : Math.max(10, Math.round((item.valeurPO || 1) * 100));
              const valeurVente = formaterPrixPC(Math.max(1, Math.floor(prixBasePC / 2)));
              const estOuvert = objetIllustreId === `sell_${item.id}`;
              return (
                <div
                  key={item.id}
                  className="bg-stone-50 border border-stone-200 p-2 rounded-md space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex items-center gap-2">
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
                      <div className="min-w-0">
                        <div className="font-semibold text-stone-900 truncate">
                          {item.nom} <span className="font-mono text-stone-500">x{item.quantite}</span>
                        </div>
                        <div className="text-[10px] text-stone-500 tabular-nums">
                          Reprise 50 % : {valeurVente}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <ItemImageTrigger
                        ouvert={estOuvert}
                        onToggle={() => setObjetIllustreId(estOuvert ? null : `sell_${item.id}`)}
                      />
                      <button
                        onClick={() => handleDemanderVente(item)}
                        disabled={chargement}
                        className="px-2.5 py-1 bg-white hover:bg-stone-100 border border-stone-300 text-stone-800 rounded font-medium text-[11px] shrink-0 cursor-pointer"
                      >
                        Vendre
                      </button>
                    </div>
                  </div>
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
            })
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-80 overflow-y-auto pr-1">
          {articles.map(art => {
            const qte = quantites[art.id] || 1;
            const estOuvert = objetIllustreId === art.id;
            return (
              <div
                key={art.id}
                className="bg-stone-50 border border-stone-200 p-2.5 rounded-lg flex flex-col justify-between space-y-2 shadow-2xs"
              >
                <div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-bold text-stone-900 flex items-center gap-1.5 min-w-0">
                      <ItemIcon
                        item={{
                          id: art.id,
                          nom: art.nom,
                          sousCategorie: art.sousCategorie,
                          motsCles: art.motsCles,
                        }}
                      />
                      <span className="truncate">{art.nom}</span>
                    </span>
                    <span className="flex items-center gap-1 shrink-0">
                      <span className="font-mono font-bold text-amber-800 text-[11px] tabular-nums">
                        {art.labelPrix}
                      </span>
                      <ItemImageTrigger
                        ouvert={estOuvert}
                        onToggle={() => setObjetIllustreId(estOuvert ? null : art.id)}
                      />
                    </span>
                  </div>
                  <div className="text-[11px] text-stone-500 mt-0.5 line-clamp-2">{art.desc}</div>
                  {estOuvert && (
                    <ItemIllustrationInline
                      item={{
                        itemId: art.id,
                        nom: art.nom,
                        nomEn: art.nomEn,
                        sousCategorie: art.sousCategorie,
                        rarete: art.rarete,
                        effet: art.effet,
                        degats: art.degats,
                        caBase: art.caBase,
                      }}
                      onClose={() => setObjetIllustreId(null)}
                    />
                  )}
                </div>

                <div className="flex items-center justify-between pt-1.5 border-t border-stone-200/80">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setQuantites(prev => ({ ...prev, [art.id]: Math.max(1, (prev[art.id] || 1) - 1) }))}
                      className="w-5 h-5 bg-white border border-stone-300 hover:bg-stone-100 rounded text-stone-700 flex items-center justify-center font-bold cursor-pointer"
                    >
                      -
                    </button>
                    <span className="w-6 text-center font-mono font-semibold text-stone-800 tabular-nums">{qte}</span>
                    <button
                      onClick={() => setQuantites(prev => ({ ...prev, [art.id]: (prev[art.id] || 1) + 1 }))}
                      className="w-5 h-5 bg-white border border-stone-300 hover:bg-stone-100 rounded text-stone-700 flex items-center justify-center font-bold cursor-pointer"
                    >
                      +
                    </button>
                  </div>

                  <button
                    onClick={() => handleDemanderAchat(art)}
                    disabled={chargement}
                    className="px-2.5 py-1 bg-amber-700 hover:bg-amber-800 text-white rounded font-medium text-[11px] shadow-2xs transition-colors cursor-pointer"
                  >
                    Acheter
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
