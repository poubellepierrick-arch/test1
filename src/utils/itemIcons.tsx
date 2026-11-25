import React from 'react';
import {
  Anchor,
  Axe,
  Backpack,
  Bandage,
  BedDouble,
  BookOpen,
  Coins,
  Compass,
  Droplets,
  Flame,
  FlaskConical,
  Footprints,
  Gem,
  Hammer,
  Hand,
  HeartPulse,
  KeyRound,
  Lamp,
  LucideIcon,
  Package,
  Shield,
  Shirt,
  Sparkles,
  Sword,
  Target,
  Tent,
  Utensils,
  Wand2,
  Wrench,
} from 'lucide-react';

export interface ItemIconDescriptor {
  id?: string;
  compendiumId?: string;
  nom: string;
  sousCategorie?: string;
  categorie?: string;
  motsCles?: string[];
}

export interface ItemIconMeta {
  Icon: LucideIcon;
  colorClass: string;
  famille: string;
}

function normaliserTexte(val?: string): string {
  return (val || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function getItemIconMeta(item: ItemIconDescriptor): ItemIconMeta {
  const id = normaliserTexte(item.compendiumId || item.id);
  const nom = normaliserTexte(item.nom);
  const sousCat = normaliserTexte(item.sousCategorie || item.categorie);
  const tags = normaliserTexte(item.motsCles?.join(' '));
  const full = `${id} ${nom} ${sousCat} ${tags}`;

  // Potions & alchimie
  if (
    id.includes('potion') ||
    id.includes('antipoison') ||
    sousCat === 'potion' ||
    nom.includes('potion') ||
    nom.includes('fiole') ||
    nom.includes('antipoison')
  ) {
    return { Icon: FlaskConical, colorClass: 'text-rose-700', famille: 'Potion' };
  }

  // Soins, bandages, cataplasmes, trousses, attelles
  if (
    id.includes('bandage') ||
    id.includes('cataplasme') ||
    id.includes('attelle') ||
    nom.includes('bandage') ||
    nom.includes('cataplasme') ||
    nom.includes('attelle')
  ) {
    return { Icon: Bandage, colorClass: 'text-emerald-700', famille: 'Soin' };
  }
  if (id.includes('trousse') || nom.includes('trousse de soins')) {
    return { Icon: HeartPulse, colorClass: 'text-rose-700', famille: 'Soin' };
  }

  // Vivres & eau
  if (id.includes('ration') || nom.includes('ration') || tags.includes('nourriture')) {
    return { Icon: Utensils, colorClass: 'text-amber-800', famille: 'Vivres' };
  }
  if (id.includes('eau') || id.includes('outre') || nom.includes('eau') || nom.includes('outre')) {
    return { Icon: Droplets, colorClass: 'text-sky-700', famille: 'Eau' };
  }

  // Lumière & feu
  if (id.includes('lanterne') || nom.includes('lanterne')) {
    return { Icon: Lamp, colorClass: 'text-amber-700', famille: 'Éclairage' };
  }
  if (
    id.includes('torche') ||
    id.includes('amadou') ||
    id.includes('huile') ||
    nom.includes('torche') ||
    nom.includes('amadou') ||
    nom.includes('huile')
  ) {
    return { Icon: Flame, colorClass: 'text-orange-700', famille: 'Feu' };
  }

  // Boucliers & armures
  if (id.includes('bouclier') || nom.includes('bouclier')) {
    return { Icon: Shield, colorClass: 'text-slate-700', famille: 'Bouclier' };
  }
  if (
    sousCat === 'armure' ||
    id.includes('armure') ||
    id.includes('mailles') ||
    id.includes('cuirasse') ||
    id.includes('broigne') ||
    id.includes('clibanion') ||
    id.includes('harnois') ||
    id.includes('cape') ||
    nom.includes('armure') ||
    nom.includes('mailles') ||
    nom.includes('cuirasse') ||
    nom.includes('cape')
  ) {
    return { Icon: Shirt, colorClass: 'text-stone-700', famille: 'Armure' };
  }

  // Armes par famille précise
  if (id.includes('hache') || nom.includes('hache')) {
    return { Icon: Axe, colorClass: 'text-slate-800', famille: 'Hache' };
  }
  if (
    id.includes('masse') ||
    id.includes('massue') ||
    id.includes('marteau') ||
    id.includes('gourdin') ||
    id.includes('morgenstern') ||
    nom.includes('masse') ||
    nom.includes('massue') ||
    nom.includes('marteau') ||
    nom.includes('gourdin') ||
    nom.includes('morgenstern')
  ) {
    return { Icon: Hammer, colorClass: 'text-stone-700', famille: 'Contondant' };
  }
  if (
    id.includes('arc') ||
    id.includes('arbalete') ||
    id.includes('fronde') ||
    id.includes('fleche') ||
    id.includes('carreau') ||
    nom.includes('arc') ||
    nom.includes('arbalete') ||
    nom.includes('fronde') ||
    nom.includes('fleche') ||
    nom.includes('carreau') ||
    nom.includes('carquois')
  ) {
    return { Icon: Target, colorClass: 'text-amber-800', famille: 'Distance' };
  }
  if (id.includes('baton') || id.includes('baguette') || nom.includes('baton') || nom.includes('baguette')) {
    return { Icon: Wand2, colorClass: 'text-indigo-800', famille: 'Bâton' };
  }
  if (
    id.includes('epee') ||
    id.includes('dague') ||
    id.includes('rapiere') ||
    id.includes('cimeterre') ||
    id.includes('lance') ||
    id.includes('javeline') ||
    id.includes('arme') ||
    sousCat === 'arme' ||
    nom.includes('epee') ||
    nom.includes('dague') ||
    nom.includes('rapiere') ||
    nom.includes('cimeterre') ||
    nom.includes('lance') ||
    nom.includes('javeline')
  ) {
    return { Icon: Sword, colorClass: 'text-slate-800', famille: 'Lame' };
  }

  // Bivouac, exploration & contenants
  if (id.includes('tente') || nom.includes('tente')) {
    return { Icon: Tent, colorClass: 'text-emerald-800', famille: 'Campement' };
  }
  if (id.includes('couchage') || nom.includes('couchage')) {
    return { Icon: BedDouble, colorClass: 'text-amber-900', famille: 'Campement' };
  }
  if (id.includes('corde') || id.includes('grappin') || nom.includes('corde') || nom.includes('grappin')) {
    return { Icon: Anchor, colorClass: 'text-stone-700', famille: 'Escalade' };
  }
  if (id.includes('sac') || nom.includes('sac')) {
    return { Icon: Backpack, colorClass: 'text-amber-800', famille: 'Contenant' };
  }
  if (id.includes('bottes') || nom.includes('bottes')) {
    return { Icon: Footprints, colorClass: 'text-emerald-800', famille: 'Chaussures' };
  }
  if (id.includes('anneau') || nom.includes('anneau')) {
    return { Icon: Gem, colorClass: 'text-indigo-700', famille: 'Bijou' };
  }
  if (id.includes('gantelet') || nom.includes('gantelet')) {
    return { Icon: Hand, colorClass: 'text-stone-700', famille: 'Gants' };
  }
  if (id.includes('grimoire') || nom.includes('grimoire') || nom.includes('parchemin')) {
    return { Icon: BookOpen, colorClass: 'text-indigo-900', famille: 'Grimoire' };
  }

  // Outils
  if (id.includes('voleur') || nom.includes('voleur')) {
    return { Icon: KeyRound, colorClass: 'text-stone-800', famille: 'Crochetage' };
  }
  if (sousCat === 'outil' || id.includes('outil') || id.includes('pied_biche') || id.includes('herboriste')) {
    return { Icon: Wrench, colorClass: 'text-stone-700', famille: 'Outil' };
  }

  // Montures & Services
  if (sousCat === 'monture' || full.includes('mulet') || full.includes('cheval')) {
    return { Icon: Compass, colorClass: 'text-amber-900', famille: 'Monture' };
  }
  if (sousCat === 'service' || nom.includes('auberge') || nom.includes('salaire')) {
    return { Icon: Coins, colorClass: 'text-amber-700', famille: 'Service' };
  }

  // Objets magiques génériques
  if (sousCat === 'objet_magique' || full.includes('magique')) {
    return { Icon: Sparkles, colorClass: 'text-indigo-700', famille: 'Magique' };
  }

  return { Icon: Package, colorClass: 'text-amber-800', famille: 'Équipement' };
}

interface ItemIconProps {
  item: ItemIconDescriptor;
  className?: string;
}

export const ItemIcon: React.FC<ItemIconProps> = ({ item, className = 'w-3.5 h-3.5 shrink-0' }) => {
  const { Icon, colorClass } = getItemIconMeta(item);
  return <Icon className={`${colorClass} ${className}`} aria-hidden="true" />;
};
