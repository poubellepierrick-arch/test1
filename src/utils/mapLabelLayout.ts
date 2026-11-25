export type MapLabelKind =
  | 'hero'
  | 'capital'
  | 'citadel'
  | 'state'
  | 'resource'
  | 'burg'
  | 'marker'
  | 'ocean';

export type LabelPlacement = 'below' | 'above' | 'right' | 'left' | 'center';

export interface MapLabelCandidate {
  id: string;
  kind: MapLabelKind;
  text: string;
  x: number;
  y: number;
  priority: number;
  minZoom: number;
  fontSize: number;
  markerRadius?: number;
  preferredPlacements?: LabelPlacement[];
}

export interface LabelRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface PlacedMapLabel {
  id: string;
  kind: MapLabelKind;
  text: string;
  x: number;
  y: number;
  textAnchor: 'middle' | 'start' | 'end';
  fontSize: number;
  placement: LabelPlacement;
  box: LabelRect;
}

export interface LabelLayoutOptions {
  zoom: number;
  mapWidth?: number;
  mapHeight?: number;
  obstacles?: LabelRect[];
}

function boxesOverlap(a: LabelRect, b: LabelRect): boolean {
  return !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
}

/**
 * Calcule une disposition d'étiquettes sans chevauchement selon l'échelle de zoom.
 * Priorité : Héros > Capitales > Citadelles/Grands bourgs > États > Ressources majeures > Bourgs > Marqueurs > Océans.
 */
export function calculerDispositionEtiquettes(
  candidates: MapLabelCandidate[],
  options: LabelLayoutOptions
): PlacedMapLabel[] {
  const zoom = Math.max(0.5, options.zoom || 1);
  const mapWidth = options.mapWidth ?? 1200;
  const mapHeight = options.mapHeight ?? 760;
  const padSvg = 4 / zoom;

  const occupied: LabelRect[] = options.obstacles ? [...options.obstacles] : [];
  const placed: PlacedMapLabel[] = [];

  const eligible = candidates
    .filter(c => c.text && c.text.trim().length > 0 && zoom >= c.minZoom)
    .sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return a.id.localeCompare(b.id);
    });

  for (const cand of eligible) {
    // Atténuation douce de la taille SVG avec le zoom pour libérer de l'espace à mesure qu'on zoome
    const effFontSize = Number((cand.fontSize / Math.pow(Math.max(1, zoom), 0.42)).toFixed(2));
    const charW = cand.kind === 'state' || cand.kind === 'ocean' ? effFontSize * 0.66 : effFontSize * 0.56;
    const widthSvg = Math.max(effFontSize * 1.4, cand.text.length * charW + 4 / zoom);
    const heightSvg = effFontSize * 1.24;
    const radius = (cand.markerRadius ?? 6) / Math.pow(Math.max(1, zoom), 0.35);

    const placements: LabelPlacement[] =
      cand.preferredPlacements && cand.preferredPlacements.length > 0
        ? cand.preferredPlacements
        : cand.kind === 'state' || cand.kind === 'ocean'
          ? ['center', 'above', 'below']
          : ['below', 'above', 'right', 'left'];

    let chosen: PlacedMapLabel | null = null;

    for (const p of placements) {
      let tx = cand.x;
      let ty = cand.y;
      let textAnchor: 'middle' | 'start' | 'end' = 'middle';
      let left = 0;
      let top = 0;

      if (p === 'center') {
        tx = cand.x;
        ty = cand.y + effFontSize * 0.35;
        textAnchor = 'middle';
        left = tx - widthSvg / 2;
        top = ty - effFontSize * 0.9;
      } else if (p === 'below') {
        tx = cand.x;
        ty = cand.y + radius + effFontSize * 0.95 + 1.5 / zoom;
        textAnchor = 'middle';
        left = tx - widthSvg / 2;
        top = ty - effFontSize * 0.9;
      } else if (p === 'above') {
        tx = cand.x;
        ty = cand.y - radius - 3 / zoom;
        textAnchor = 'middle';
        left = tx - widthSvg / 2;
        top = ty - effFontSize * 0.9;
      } else if (p === 'right') {
        tx = cand.x + radius + 3.5 / zoom;
        ty = cand.y + effFontSize * 0.32;
        textAnchor = 'start';
        left = tx;
        top = ty - effFontSize * 0.9;
      } else {
        // left
        tx = cand.x - radius - 3.5 / zoom;
        ty = cand.y + effFontSize * 0.32;
        textAnchor = 'end';
        left = tx - widthSvg;
        top = ty - effFontSize * 0.9;
      }

      const rawBox: LabelRect = {
        left: left - padSvg,
        top: top - padSvg,
        right: left + widthSvg + padSvg,
        bottom: top + heightSvg + padSvg,
      };

      // Éviter de déborder hors de la carte
      if (
        rawBox.left < 4 ||
        rawBox.right > mapWidth - 4 ||
        rawBox.top < 4 ||
        rawBox.bottom > mapHeight - 4
      ) {
        continue;
      }

      let collides = false;
      for (const occ of occupied) {
        if (boxesOverlap(rawBox, occ)) {
          collides = true;
          break;
        }
      }

      if (!collides) {
        chosen = {
          id: cand.id,
          kind: cand.kind,
          text: cand.text,
          x: Number(tx.toFixed(1)),
          y: Number(ty.toFixed(1)),
          textAnchor,
          fontSize: effFontSize,
          placement: p,
          box: {
            left: left,
            top: top,
            right: left + widthSvg,
            bottom: top + heightSvg,
          },
        };
        occupied.push(rawBox);
        break;
      }
    }

    if (chosen) {
      placed.push(chosen);
    }
  }

  return placed;
}
