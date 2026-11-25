import React from 'react';
import { AzgaarCoatOfArms, AzgaarReliefKind, RessourceNaturelleType } from '../types/azgaar';

export type SettlementArtVariant =
  | 'capital'
  | 'citadel'
  | 'town'
  | 'village'
  | 'fort'
  | 'mine'
  | 'ruine'
  | 'donjon'
  | 'camp';

export function renderReliefArtwork(
  key: string,
  kind: AzgaarReliefKind,
  x: number,
  y: number,
  scale = 1,
  isNight = false
): React.ReactNode {
  const tr = `translate(${x}, ${y}) scale(${scale})`;
  const ink = isNight ? '#1b140d' : '#35271a';

  switch (kind) {
    case 'mountain':
      return (
        <g key={key} transform={tr}>
          <ellipse cx={1} cy={6.2} rx={12.5} ry={2.4} fill="#2d2217" opacity={0.18} />
          <path d="M -14 6 L -1 -13 L 0 6 Z" fill={isNight ? '#8c8373' : '#e6dcc5'} />
          <path d="M -1 -13 L 14 6 L 0 6 Z" fill={isNight ? '#564d41' : '#96846a'} />
          <path
            d="M 1 -8 L 6 -2 M 2 -3 L 9 4 M 1 1 L 5 5"
            stroke={isNight ? '#2c251e' : '#534535'}
            strokeWidth={0.85}
            strokeLinecap="round"
          />
          <path d="M -5 -7 L -1 -13 L 3 -7 L 0 -5 L -2 -6.5 Z" fill="#faf6ea" opacity={0.88} />
          <path
            d="M -14 6 L -1 -13 L 14 6 M -1 -13 L -2.2 -4.5 L 1.2 1 L 0 6"
            fill="none"
            stroke={ink}
            strokeWidth={1.05}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </g>
      );

    case 'peak_small':
      return (
        <g key={key} transform={tr}>
          <path d="M -9.5 4.5 L 0 -8.5 L 0 4.5 Z" fill={isNight ? '#7a7162' : '#ded2b8'} />
          <path d="M 0 -8.5 L 9.5 4.5 L 0 4.5 Z" fill={isNight ? '#4f473c' : '#9a8970'} />
          <path d="M 1.2 -4 L 5 1 M 1 0.5 L 4 3.5" stroke="#534535" strokeWidth={0.7} />
          <path
            d="M -9.5 4.5 L 0 -8.5 L 9.5 4.5 M 0 -8.5 L -0.8 -1.5 L 0.5 4.5"
            fill="none"
            stroke={ink}
            strokeWidth={0.9}
            strokeLinejoin="round"
          />
        </g>
      );

    case 'tree_round':
      return (
        <g key={key} transform={tr}>
          <ellipse cx={1.6} cy={4.2} rx={5.6} ry={2.2} fill="#26361b" opacity={0.26} />
          <line x1={0} y1={0} x2={0} y2={4.8} stroke="#4a3724" strokeWidth={1.25} strokeLinecap="round" />
          <circle cx={-2.1} cy={-1.8} r={3.4} fill="#4d6e39" stroke="#283a1d" strokeWidth={0.75} />
          <circle cx={2.1} cy={-1.6} r={3.2} fill="#446332" stroke="#283a1d" strokeWidth={0.75} />
          <circle cx={0} cy={-3.4} r={4.2} fill="#608446" stroke="#283a1d" strokeWidth={0.85} />
          <circle cx={-1.3} cy={-4.6} r={1.8} fill="#83a862" opacity={0.7} />
        </g>
      );

    case 'tree_pine':
      return (
        <g key={key} transform={tr}>
          <ellipse cx={1.5} cy={4.4} rx={4.5} ry={1.8} fill="#1f3016" opacity={0.26} />
          <line x1={0} y1={1} x2={0} y2={4.8} stroke="#423222" strokeWidth={1.1} />
          <path
            d="M -5.2 2 L 0 -5 L 5.2 2 Z"
            fill="#3d5b32"
            stroke="#203219"
            strokeWidth={0.8}
            strokeLinejoin="round"
          />
          <path
            d="M -4.2 -1.4 L 0 -8 L 4.2 -1.4 Z"
            fill="#4b6e3d"
            stroke="#203219"
            strokeWidth={0.8}
            strokeLinejoin="round"
          />
          <path
            d="M -3 -4.8 L 0 -10.6 L 3 -4.8 Z"
            fill="#5d834d"
            stroke="#203219"
            strokeWidth={0.75}
            strokeLinejoin="round"
          />
        </g>
      );

    case 'palm':
      return (
        <g key={key} transform={tr}>
          <ellipse cx={1} cy={4.5} rx={4} ry={1.3} fill="#5c4928" opacity={0.2} />
          <path d="M 0 4.5 Q -1.5 0 1 -5.5" fill="none" stroke="#6c4d2d" strokeWidth={1.3} strokeLinecap="round" />
          <path
            d="M 1 -5.5 Q -4 -7 -6 -3.5 M 1 -5.5 Q -2 -9.5 -5 -8 M 1 -5.5 Q 5 -8.5 7 -4.5 M 1 -5.5 Q 4 -3.5 5.5 -1"
            fill="none"
            stroke="#4c7435"
            strokeWidth={1.15}
            strokeLinecap="round"
          />
        </g>
      );

    case 'marsh':
      return (
        <g key={key} transform={tr}>
          <ellipse cx={0} cy={2.2} rx={7.5} ry={2.2} fill="#7e9d96" opacity={0.48} />
          <path
            d="M -4.2 2 L -5 -4 M -1.4 2.2 L -1 -5.2 M 1.6 2 L 2.5 -4.2 M 4.4 2 L 5.6 -2.2"
            stroke="#3f5740"
            strokeWidth={0.85}
            strokeLinecap="round"
          />
          <circle cx={-1} cy={-4.6} r={0.8} fill="#5c3e26" />
          <circle cx={2.4} cy={-3.6} r={0.75} fill="#5c3e26" />
        </g>
      );

    case 'dune':
      return (
        <g key={key} transform={tr}>
          <path
            d="M -10 3 Q -3.5 -3.5 3 1 Q 7.5 4.2 10.5 1"
            fill="none"
            stroke="#9a7030"
            strokeWidth={1}
            strokeLinecap="round"
          />
          <path
            d="M -6 5.2 Q 0 1 6.5 4.2"
            fill="none"
            stroke="#b88b45"
            strokeWidth={0.75}
            strokeLinecap="round"
          />
          <circle cx={-2} cy={3.5} r={0.5} fill="#9a7030" opacity={0.65} />
          <circle cx={4} cy={2.4} r={0.5} fill="#9a7030" opacity={0.65} />
        </g>
      );

    case 'grass':
    default:
      return (
        <g key={key} transform={tr}>
          <path
            d="M -3.2 2.2 L -4.2 -2 M 0 2.2 L 0 -3.2 M 3.2 2.2 L 4.2 -1.6"
            stroke="#697f40"
            strokeWidth={0.85}
            strokeLinecap="round"
            opacity={0.78}
          />
        </g>
      );
  }
}

export function renderSettlementArtwork(opts: {
  variant: SettlementArtVariant;
  x: number;
  y: number;
  scale?: number;
  accentColor?: string;
  isNight?: boolean;
  hasWalls?: boolean;
  hasPort?: boolean;
  hasTemple?: boolean;
}): React.ReactNode {
  const {
    variant,
    x,
    y,
    scale = 1,
    accentColor = '#b45309',
    isNight = false,
    hasWalls = false,
    hasPort = false,
    hasTemple = false,
  } = opts;

  const tr = `translate(${x}, ${y}) scale(${scale.toFixed(2)})`;
  const wallFill = isNight ? '#d6ccb4' : '#f5ecd4';
  const wallShade = isNight ? '#a59a82' : '#d2c3a2';
  const roofFill = accentColor || '#9e3b2b';
  const ink = '#23170d';

  const portJetty = hasPort ? (
    <g transform="translate(8, 4)">
      <line x1={0} y1={0} x2={8} y2={2} stroke="#5d4226" strokeWidth={1.6} strokeLinecap="round" />
      <line x1={3} y1={-1} x2={3} y2={2.5} stroke="#5d4226" strokeWidth={0.9} />
      <line x1={6.5} y1={0} x2={6.5} y2={3.2} stroke="#5d4226" strokeWidth={0.9} />
      {/* Petit phare / voile au mouillage */}
      <path d="M 7.5 -5 L 11 -1 L 7.5 -0.5 Z" fill="#fcf6e6" stroke={ink} strokeWidth={0.65} />
    </g>
  ) : null;

  const templeSpire = hasTemple ? (
    <g transform="translate(-8.5, 0)">
      <rect x={-2} y={-4} width={4} height={6} fill={wallFill} stroke={ink} strokeWidth={0.7} />
      <polygon points="-2.5,-4 0,-9.5 2.5,-4" fill="#6f5a3f" stroke={ink} strokeWidth={0.7} />
    </g>
  ) : null;

  switch (variant) {
    case 'capital':
      return (
        <g transform={tr}>
          <ellipse cx={0} cy={5.5} rx={12.5} ry={3.6} fill="#251a10" opacity={0.22} />
          {/* Rempart et porte */}
          <rect x={-9} y={-2} width={18} height={6.5} fill={wallShade} stroke={ink} strokeWidth={0.95} />
          {/* Tours latérales */}
          <rect x={-11} y={-6} width={4.5} height={10.5} fill={wallFill} stroke={ink} strokeWidth={0.9} />
          <polygon points="-11.5,-6 -8.75,-10.5 -6,-6" fill={roofFill} stroke={ink} strokeWidth={0.85} />
          <rect x={6.5} y={-6} width={4.5} height={10.5} fill={wallFill} stroke={ink} strokeWidth={0.9} />
          <polygon points="6,-6 8.75,-10.5 11.5,-6" fill={roofFill} stroke={ink} strokeWidth={0.85} />
          {/* Donjon royal central */}
          <rect x={-3.5} y={-10} width={7} height={14.5} fill={wallFill} stroke={ink} strokeWidth={1} />
          <polygon points="-4.2,-10 0,-16 4.2,-10" fill={roofFill} stroke={ink} strokeWidth={0.9} />
          {/* Fanion */}
          <line x1={0} y1={-16} x2={0} y2={-20.5} stroke={ink} strokeWidth={0.9} />
          <polygon points="0,-20.5 5.5,-19 0,-17.5" fill={roofFill} stroke={ink} strokeWidth={0.55} />
          {/* Porte cintrée */}
          <path d="M -2 4.5 V 1 A 2 2 0 0 1 2 1 V 4.5 Z" fill={ink} />
          {portJetty}
        </g>
      );

    case 'citadel':
    case 'fort':
      return (
        <g transform={tr}>
          <ellipse cx={0} cy={4.8} rx={10} ry={3} fill="#251a10" opacity={0.2} />
          <rect x={-7.5} y={-4} width={15} height={8} fill={wallShade} stroke={ink} strokeWidth={0.95} />
          <rect x={-8.5} y={-6.5} width={4} height={10.5} fill={wallFill} stroke={ink} strokeWidth={0.85} />
          <rect x={4.5} y={-6.5} width={4} height={10.5} fill={wallFill} stroke={ink} strokeWidth={0.85} />
          <rect x={-3} y={-8.5} width={6} height={12.5} fill={wallFill} stroke={ink} strokeWidth={0.9} />
          <path d="M -8.5 -6.5 h 1.2 v -1.5 h 1.6 v 1.5 h 1.2 M 4.5 -6.5 h 1.2 v -1.5 h 1.6 v 1.5 h 1.2" fill={wallFill} stroke={ink} strokeWidth={0.75} />
          <line x1={0} y1={-8.5} x2={0} y2={-13.5} stroke={ink} strokeWidth={0.85} />
          <polygon points="0,-13.5 4.8,-12 0,-10.5" fill={roofFill} stroke={ink} strokeWidth={0.5} />
          <path d="M -1.6 4 V 1 A 1.6 1.6 0 0 1 1.6 1 V 4 Z" fill={ink} />
          {portJetty}
        </g>
      );

    case 'town':
      return (
        <g transform={tr}>
          <ellipse cx={0} cy={4.8} rx={10} ry={2.8} fill="#251a10" opacity={0.18} />
          {hasWalls && (
            <ellipse cx={0} cy={2} rx={9.5} ry={4.2} fill="none" stroke="#6c5942" strokeWidth={1.1} strokeDasharray="2.5,1" />
          )}
          {/* Trois maisons à pignons & beffroi */}
          <rect x={-6.5} y={-1.5} width={5} height={5} fill={wallFill} stroke={ink} strokeWidth={0.75} />
          <polygon points="-7.2,-1.5 -4,-5 -0.8,-1.5" fill={roofFill} stroke={ink} strokeWidth={0.75} />
          <rect x={1.5} y={-1} width={5} height={4.5} fill={wallShade} stroke={ink} strokeWidth={0.75} />
          <polygon points="0.8,-1 4,-4.5 7.2,-1" fill={roofFill} stroke={ink} strokeWidth={0.75} />
          <rect x={-2.2} y={-5.5} width={4.6} height={9.5} fill={wallFill} stroke={ink} strokeWidth={0.85} />
          <polygon points="-2.8,-5.5 0.1,-10.5 3,-5.5" fill={roofFill} stroke={ink} strokeWidth={0.8} />
          {templeSpire}
          {portJetty}
        </g>
      );

    case 'village':
      return (
        <g transform={tr}>
          <ellipse cx={0} cy={4} rx={7.5} ry={2.2} fill="#251a10" opacity={0.16} />
          <rect x={-5.2} y={-1} width={4.5} height={4} fill={wallFill} stroke={ink} strokeWidth={0.75} />
          <polygon points="-6,-1 -3,-4.4 0,-1" fill={roofFill} stroke={ink} strokeWidth={0.75} />
          <rect x={0.4} y={-2.2} width={4.8} height={5.2} fill={wallShade} stroke={ink} strokeWidth={0.75} />
          <polygon points="-0.4,-2.2 2.8,-6 6,-2.2" fill={roofFill} stroke={ink} strokeWidth={0.75} />
          {templeSpire}
          {portJetty}
        </g>
      );

    case 'mine':
      return (
        <g transform={tr}>
          <path d="M -8 4.5 Q 0 -7.5 8 4.5 Z" fill="#a8987b" stroke={ink} strokeWidth={0.95} />
          <path d="M -3 4.5 V -0.5 A 3 3 0 0 1 3 -0.5 V 4.5 Z" fill="#23170d" />
          <path d="M -3.5 4.5 V -0.5 M 3.5 4.5 V -0.5 M -4 -0.5 H 4" stroke="#6f4e2a" strokeWidth={1.1} />
          <path d="M -3 -5.5 L 3 -1.5 M 3 -5.5 L -3 -1.5" stroke="#3c2d1d" strokeWidth={1} strokeLinecap="round" />
        </g>
      );

    case 'ruine':
      return (
        <g transform={tr}>
          <ellipse cx={0} cy={4} rx={7} ry={2} fill="#251a10" opacity={0.14} />
          <rect x={-5.5} y={-3} width={2.2} height={6.5} fill={wallShade} stroke={ink} strokeWidth={0.8} />
          <rect x={3.3} y={-4.5} width={2.2} height={8} fill={wallFill} stroke={ink} strokeWidth={0.8} />
          <path d="M -5.5 -3 Q 0 -7 3.8 -3" fill="none" stroke={ink} strokeWidth={1.1} strokeDasharray="3,1.5" />
          <rect x={-1.5} y={0} width={2.4} height={3.5} fill={wallFill} stroke={ink} strokeWidth={0.7} />
        </g>
      );

    case 'donjon':
      return (
        <g transform={tr}>
          <path d="M -8 5 L -4 -6 L 0 -8 L 4 -6 L 8 5 Z" fill="#4f4338" stroke={ink} strokeWidth={1} strokeLinejoin="round" />
          <path d="M -2.6 5 V 0.5 A 2.6 2.6 0 0 1 2.6 0.5 V 5 Z" fill="#17100b" />
          <polygon points="-4,-6 -2,-10 0,-7.5 2,-10 4,-6" fill="#322820" stroke={ink} strokeWidth={0.75} />
        </g>
      );

    case 'camp':
    default:
      return (
        <g transform={tr}>
          <polygon points="-7,4 -2.5,-4.5 2,4" fill="#f2e6ca" stroke={ink} strokeWidth={0.9} strokeLinejoin="round" />
          <polygon points="0,4 3.8,-3 7.5,4" fill="#dfd0ad" stroke={ink} strokeWidth={0.85} strokeLinejoin="round" />
          <circle cx={-0.5} cy={5.2} r={1.3} fill="#d97706" stroke="#7c2d12" strokeWidth={0.5} />
        </g>
      );
  }
}

export function renderBridgeArtwork(
  key: string,
  x: number,
  y: number,
  angleDeg: number,
  scale = 1,
  isNight = false
): React.ReactNode {
  const fill = isNight ? '#c8b68e' : '#e6d4ad';
  const ink = '#3b2816';
  return (
    <g key={key} transform={`translate(${x}, ${y}) rotate(${angleDeg}) scale(${scale})`}>
      <rect x={-7} y={-3.6} width={14} height={7.2} rx={1.2} fill={fill} stroke={ink} strokeWidth={0.85} />
      <line x1={-6.5} y1={-2.2} x2={6.5} y2={-2.2} stroke={ink} strokeWidth={0.75} />
      <line x1={-6.5} y1={2.2} x2={6.5} y2={2.2} stroke={ink} strokeWidth={0.75} />
      <path d="M -3.5 -3.6 V -5 M 3.5 -3.6 V -5 M -3.5 3.6 V 5 M 3.5 3.6 V 5" stroke={ink} strokeWidth={0.9} strokeLinecap="round" />
    </g>
  );
}

export function renderWaterfallArtwork(
  key: string,
  x: number,
  y: number,
  scale = 1
): React.ReactNode {
  return (
    <g key={key} transform={`translate(${x}, ${y}) scale(${scale})`}>
      <path d="M -6 -2 L 6 -2" stroke="#4f4030" strokeWidth={1.6} strokeLinecap="round" />
      <path
        d="M -3.5 -2 Q -4 3 -2.5 6 M 0 -2 Q 0 3.5 0 6.5 M 3.5 -2 Q 4 3 2.5 6"
        fill="none"
        stroke="#f8fcff"
        strokeWidth={1.25}
        strokeLinecap="round"
      />
      <path d="M -5.5 6.5 Q 0 9 5.5 6.5" fill="none" stroke="#dceef5" strokeWidth={1.2} strokeLinecap="round" />
      <circle cx={-3} cy={7.5} r={0.9} fill="#ffffff" opacity={0.85} />
      <circle cx={3} cy={7.4} r={0.8} fill="#ffffff" opacity={0.85} />
    </g>
  );
}

export function renderShipArtwork(
  key: string,
  x: number,
  y: number,
  angleDeg: number,
  scale = 1,
  isNight = false
): React.ReactNode {
  const dir = Math.cos((angleDeg * Math.PI) / 180) >= 0 ? 1 : -1;
  const hull = isNight ? '#8f6943' : '#6f4826';
  const sail = isNight ? '#e9dec4' : '#fcf6e6';
  const ink = '#24180e';
  return (
    <g key={key} transform={`translate(${x}, ${y}) scale(${dir * scale}, ${scale})`}>
      {/* Sillage */}
      <path
        d="M -12 5 Q -6 7 2 5.5 Q 8 6.5 11 5"
        fill="none"
        stroke="#e6f2f6"
        strokeWidth={0.9}
        opacity={0.75}
        strokeLinecap="round"
      />
      {/* Coque */}
      <path d="M -9 1.5 L 9 1.5 L 6 5.2 L -6 5.2 Z" fill={hull} stroke={ink} strokeWidth={0.85} strokeLinejoin="round" />
      <line x1={8.5} y1={1.5} x2={12} y2={-0.5} stroke={ink} strokeWidth={0.9} />
      {/* Mâts et voiles */}
      <line x1={-1} y1={1.5} x2={-1} y2={-11.5} stroke={ink} strokeWidth={0.9} />
      <path d="M -1 -10 Q 5.5 -6.5 4.5 -1.2 L -1 -2 Z" fill={sail} stroke={ink} strokeWidth={0.75} />
      <line x1={3.5} y1={1.5} x2={3.5} y2={-8} stroke={ink} strokeWidth={0.8} />
      <path d="M 3.5 -7 Q 7.5 -4.5 7 -1 L 3.5 -1.4 Z" fill={sail} stroke={ink} strokeWidth={0.7} />
      {/* Fanion rouge */}
      <polygon points="-1,-11.5 -5,-10.5 -1,-9.5" fill="#9f1239" />
    </g>
  );
}

export function renderSeaMonsterArtwork(
  key: string,
  variant: 'serpent' | 'kraken',
  x: number,
  y: number,
  scale = 1,
  inkColor = '#2a4554'
): React.ReactNode {
  const tr = `translate(${x}, ${y}) scale(${scale})`;
  if (variant === 'kraken') {
    return (
      <g key={key} transform={tr} opacity={0.72}>
        <ellipse cx={0} cy={6} rx={15} ry={3.2} fill="none" stroke={inkColor} strokeWidth={0.75} strokeDasharray="3,2" />
        <path
          d="M -4 4 Q -5 -6 0 -8 Q 5 -6 4 4 Z"
          fill="#638391"
          stroke={inkColor}
          strokeWidth={0.9}
        />
        <path
          d="M -4 3 Q -11 -2 -12 -6 M -3 4 Q -9 2 -14 4 M 4 3 Q 11 -2 12 -6 M 3 4 Q 9 2 14 4 M -1 4 Q -3 0 -6 -3 M 1 4 Q 3 0 6 -3"
          fill="none"
          stroke={inkColor}
          strokeWidth={1.15}
          strokeLinecap="round"
        />
      </g>
    );
  }
  return (
    <g key={key} transform={tr} opacity={0.74}>
      {/* Ondes d'eau */}
      <path d="M -16 4 Q -8 6 0 4 T 16 4" fill="none" stroke={inkColor} strokeWidth={0.75} />
      {/* Anneaux du serpent de mer */}
      <path
        d="M -14 3 C -12 -5 -6 -5 -4 3 C -2 -6 4 -6 6 3 C 8 -4 11 -8 14 -7"
        fill="none"
        stroke={inkColor}
        strokeWidth={2.2}
        strokeLinecap="round"
      />
      <path d="M 12 -8 L 16.5 -6.5 L 13 -4.5 Z" fill={inkColor} />
      <path d="M -9 -2.5 L -9 -5 M 1 -3 L 1 -5.5" stroke={inkColor} strokeWidth={0.8} strokeLinecap="round" />
    </g>
  );
}

export function renderCompassRoseArtwork(
  x: number,
  y: number,
  radius = 28,
  isNight = false
): React.ReactNode {
  const s = radius / 26;
  const dark = isNight ? '#d8b467' : '#2c1e14';
  const light = isNight ? '#24303e' : '#e6d3aa';
  const bg = isNight ? '#1b2430' : '#f6edd8';
  const rim = isNight ? '#b38d52' : '#7b5f38';

  return (
    <g transform={`translate(${x}, ${y}) scale(${s.toFixed(2)})`}>
      <circle r={25} fill={bg} fillOpacity={0.86} stroke={rim} strokeWidth={1.1} />
      <circle r={21} fill="none" stroke={rim} strokeWidth={0.55} strokeDasharray="2,2" />
      <circle r={14} fill="none" stroke={rim} strokeWidth={0.45} />
      {/* 8 pointes secondaires */}
      <polygon
        points="0,-16 2.2,-2.2 16,0 2.2,2.2 0,16 -2.2,2.2 -16,0 -2.2,-2.2"
        fill="#b89861"
        stroke={dark}
        strokeWidth={0.45}
        transform="rotate(22.5)"
      />
      <polygon
        points="0,-18 2.8,-2.8 18,0 2.8,2.8 0,18 -2.8,2.8 -18,0 -2.8,-2.8"
        fill="#bfa370"
        stroke={dark}
        strokeWidth={0.5}
        transform="rotate(45)"
      />
      {/* 4 pointes cardinales bipartites */}
      <polygon points="0,-23 3.4,-3.4 0,0" fill={dark} />
      <polygon points="0,-23 -3.4,-3.4 0,0" fill={light} stroke={dark} strokeWidth={0.55} />
      <polygon points="0,23 3.4,3.4 0,0" fill={light} stroke={dark} strokeWidth={0.55} />
      <polygon points="0,23 -3.4,3.4 0,0" fill={dark} />
      <polygon points="23,0 3.4,3.4 0,0" fill={dark} />
      <polygon points="23,0 3.4,-3.4 0,0" fill={light} stroke={dark} strokeWidth={0.55} />
      <polygon points="-23,0 -3.4,-3.4 0,0" fill={dark} />
      <polygon points="-23,0 -3.4,3.4 0,0" fill={light} stroke={dark} strokeWidth={0.55} />
      <circle r={2.5} fill="#d4a74a" stroke={dark} strokeWidth={0.6} />
      <text x={0} y={-26.5} textAnchor="middle" fontSize={8.5} fontWeight="bold" fontFamily="Cinzel, serif" fill={dark}>
        N
      </text>
      <text x={28.5} y={3} textAnchor="middle" fontSize={7} fontFamily="Cinzel, serif" fill={dark}>
        E
      </text>
      <text x={0} y={31.5} textAnchor="middle" fontSize={7} fontFamily="Cinzel, serif" fill={dark}>
        S
      </text>
      <text x={-29} y={3} textAnchor="middle" fontSize={7} fontFamily="Cinzel, serif" fill={dark}>
        O
      </text>
    </g>
  );
}

export function renderIlluminatedBorderArtwork(
  width: number,
  height: number,
  isNight = false
): React.ReactNode {
  const outer = isNight ? '#b38d52' : '#463321';
  const inner = isNight ? '#876a3c' : '#6e5437';
  const light = isNight ? '#212b38' : '#f4ead2';
  const gold = '#c89b42';

  const corners: Array<[number, number, number]> = [
    [10, 10, 0],
    [width - 10, 10, 90],
    [width - 10, height - 10, 180],
    [10, height - 10, 270],
  ];

  return (
    <g className="pointer-events-none">
      <rect x={2} y={2} width={width - 4} height={height - 4} fill="none" stroke={outer} strokeWidth={2} />
      <rect x={10} y={10} width={width - 20} height={height - 20} fill="none" stroke={inner} strokeWidth={1.15} />
      {Array.from({ length: 20 }).map((_, idx) => {
        const segW = (width - 20) / 20;
        const x = 10 + idx * segW;
        const dark = idx % 2 === 0;
        return (
          <React.Fragment key={`nb_${idx}`}>
            <rect x={x} y={4} width={segW} height={4} fill={dark ? outer : light} />
            <rect x={x} y={height - 8} width={segW} height={4} fill={dark ? light : outer} />
          </React.Fragment>
        );
      })}
      {Array.from({ length: 12 }).map((_, idx) => {
        const segH = (height - 20) / 12;
        const y = 10 + idx * segH;
        const dark = idx % 2 === 0;
        return (
          <React.Fragment key={`nv_${idx}`}>
            <rect x={4} y={y} width={4} height={segH} fill={dark ? outer : light} />
            <rect x={width - 8} y={y} width={4} height={segH} fill={dark ? light : outer} />
          </React.Fragment>
        );
      })}
      {/* Fleurons d'angles enluminés */}
      {corners.map(([cx, cy, rot], idx) => (
        <g key={`cf_${idx}`} transform={`translate(${cx}, ${cy}) rotate(${rot})`}>
          <path d="M 0,0 L 18,0 L 0,18 Z" fill={light} stroke={outer} strokeWidth={0.9} />
          <path d="M 2,2 Q 11,3 14,0 M 2,2 Q 3,11 0,14" fill="none" stroke={gold} strokeWidth={1.1} />
          <circle cx={4.5} cy={4.5} r={2} fill={gold} stroke={outer} strokeWidth={0.6} />
        </g>
      ))}
    </g>
  );
}

export function renderParchmentBannerArtwork(
  key: string,
  text: string,
  x: number,
  y: number,
  opts?: { width?: number; fontSize?: number; isNight?: boolean; subtitle?: string }
): React.ReactNode {
  const w = opts?.width ?? Math.max(120, Math.min(260, text.length * 8.2 + 34));
  const half = w / 2;
  const h = opts?.subtitle ? 30 : 22;
  const isNight = Boolean(opts?.isNight);
  const bg = isNight ? '#28221b' : '#f7eed5';
  const tail = isNight ? '#1e1914' : '#e4d3aa';
  const stroke = isNight ? '#b38d52' : '#5e452a';
  const ink = isNight ? '#f4e6c8' : '#2a1c11';

  return (
    <g key={key} transform={`translate(${x}, ${y})`}>
      {/* Queue de ruban gauche et droite */}
      <polygon
        points={`${-half - 10},${-h / 2 + 4} ${-half + 4},${-h / 2 + 4} ${-half + 4},${h / 2 + 3} ${-half - 10},${h / 2 + 3} ${-half - 5},${3}`}
        fill={tail}
        stroke={stroke}
        strokeWidth={0.85}
      />
      <polygon
        points={`${half + 10},${-h / 2 + 4} ${half - 4},${-h / 2 + 4} ${half - 4},${h / 2 + 3} ${half + 10},${h / 2 + 3} ${half + 5},${3}`}
        fill={tail}
        stroke={stroke}
        strokeWidth={0.85}
      />
      {/* Corps du parchemin */}
      <rect
        x={-half}
        y={-h / 2}
        width={w}
        height={h}
        rx={2}
        fill={bg}
        stroke={stroke}
        strokeWidth={1.15}
      />
      <rect
        x={-half + 2.5}
        y={-h / 2 + 2.5}
        width={w - 5}
        height={h - 5}
        rx={1}
        fill="none"
        stroke={stroke}
        strokeWidth={0.45}
        opacity={0.55}
      />
      <text
        x={0}
        y={opts?.subtitle ? -1 : 3.5}
        textAnchor="middle"
        fontFamily="Cinzel, Lora, Georgia, serif"
        fontWeight="700"
        fontSize={opts?.fontSize ?? 10.5}
        letterSpacing="0.06em"
        fill={ink}
      >
        {text}
      </text>
      {opts?.subtitle && (
        <text
          x={0}
          y={9.5}
          textAnchor="middle"
          fontFamily="Lora, Georgia, serif"
          fontStyle="italic"
          fontSize={7.5}
          fill={ink}
          opacity={0.78}
        >
          {opts.subtitle}
        </text>
      )}
    </g>
  );
}

export function renderMiniShieldSvg(
  clipId: string,
  coa: AzgaarCoatOfArms,
  x: number,
  y: number,
  size = 18
): React.ReactNode {
  const s = size / 100;
  const shieldPath = 'M 10,8 H 90 V 58 C 90,85 50,108 50,108 C 50,108 10,85 10,58 Z';
  const c = coa.chargeColor || '#f3d37a';

  return (
    <g transform={`translate(${(x - size / 2).toFixed(1)}, ${(y - size * 0.575).toFixed(1)}) scale(${s.toFixed(3)})`}>
      <defs>
        <clipPath id={clipId}>
          <path d={shieldPath} />
        </clipPath>
      </defs>
      {/* Ombre portée douce */}
      <path d={shieldPath} fill="#1a120b" opacity={0.28} transform="translate(3, 4)" />
      <g clipPath={`url(#${clipId})`}>
        <rect x="0" y="0" width="100" height="115" fill={coa.fieldColor} />
        {coa.division === 'parti' && (
          <rect x="50" y="0" width="50" height="115" fill={coa.secondaryColor} />
        )}
        {coa.division === 'coupe' && (
          <rect x="0" y="55" width="100" height="60" fill={coa.secondaryColor} />
        )}
        {coa.division === 'ecartele' && (
          <>
            <rect x="50" y="0" width="50" height="55" fill={coa.secondaryColor} />
            <rect x="0" y="55" width="50" height="60" fill={coa.secondaryColor} />
          </>
        )}
        {coa.division === 'chevron' && (
          <polygon points="10,74 50,36 90,74 90,94 50,56 10,94" fill={coa.secondaryColor} />
        )}
        {coa.division === 'pal' && (
          <rect x="37" y="0" width="26" height="115" fill={coa.secondaryColor} />
        )}

        {coa.charge === 'tour' && (
          <g fill={c} stroke="#1a120b" strokeWidth="2.5">
            <rect x="37" y="34" width="26" height="42" rx="1" />
            <rect x="34" y="26" width="8" height="10" />
            <rect x="46" y="26" width="8" height="10" />
            <rect x="58" y="26" width="8" height="10" />
          </g>
        )}
        {coa.charge === 'epee' && (
          <g fill={c} stroke="#1a120b" strokeWidth="2">
            <polygon points="50,20 55,66 45,66" />
            <rect x="35" y="64" width="30" height="6" rx="2" />
            <rect x="47" y="70" width="6" height="14" />
          </g>
        )}
        {coa.charge === 'couronne' && (
          <g fill={c} stroke="#1a120b" strokeWidth="2.2">
            <polygon points="28,68 32,38 42,52 50,30 58,52 68,38 72,68" />
            <rect x="28" y="68" width="44" height="8" rx="1" />
          </g>
        )}
        {coa.charge === 'ancre' && (
          <g fill="none" stroke={c} strokeWidth="6" strokeLinecap="round">
            <circle cx="50" cy="28" r="5" />
            <line x1="50" y1="33" x2="50" y2="80" />
            <line x1="36" y1="45" x2="64" y2="45" />
            <path d="M 30,66 Q 50,90 70,66" />
          </g>
        )}
        {coa.charge === 'soleil' && (
          <g fill={c} stroke="#1a120b" strokeWidth="1.8">
            <circle cx="50" cy="54" r="14" />
            {[0, 45, 90, 135, 180, 225, 270, 315].map(a => (
              <polygon key={a} points="50,24 54,37 46,37" transform={`rotate(${a} 50 54)`} />
            ))}
          </g>
        )}
        {coa.charge === 'lune' && (
          <path d="M 58,28 A 24,24 0 1,0 58,80 A 18,18 0 1,1 58,28 Z" fill={c} stroke="#1a120b" strokeWidth="2" />
        )}
        {coa.charge === 'arbre' && (
          <g fill={c} stroke="#1a120b" strokeWidth="2">
            <rect x="46" y="58" width="8" height="24" />
            <circle cx="50" cy="40" r="16" />
            <circle cx="38" cy="48" r="10" />
            <circle cx="62" cy="48" r="10" />
          </g>
        )}
        {coa.charge === 'etoile' && (
          <polygon
            points="50,24 57,44 78,44 61,56 67,76 50,64 33,76 39,56 22,44 43,44"
            fill={c}
            stroke="#1a120b"
            strokeWidth="2"
          />
        )}
        {coa.charge === 'lion' && (
          <g fill={c} stroke="#1a120b" strokeWidth="2">
            <circle cx="48" cy="36" r="10" />
            <path d="M 38,44 Q 58,42 62,64 L 58,82 H 49 V 66 H 41 V 82 H 34 L 36,54 Z" />
          </g>
        )}
        {coa.charge === 'bouclier' && (
          <path
            d="M 34,34 H 66 V 58 C 66,74 50,84 50,84 C 50,84 34,74 34,58 Z"
            fill={c}
            stroke="#1a120b"
            strokeWidth="2.2"
          />
        )}
      </g>
      <path d={shieldPath} fill="none" stroke="#d4a74a" strokeWidth="4.5" />
      <path d={shieldPath} fill="none" stroke="#231a14" strokeWidth="1.8" />
    </g>
  );
}

/**
 * Icônes cartographiques gravées pour les gisements et ressources naturelles.
 */
export function renderResourceArtwork(
  type: RessourceNaturelleType,
  x: number,
  y: number,
  scale = 1,
  isNight = false
): React.ReactNode {
  const ink = isNight ? '#e8dcc0' : '#2b1e12';
  const badgeBg = isNight ? 'rgba(28, 22, 16, 0.88)' : 'rgba(246, 237, 214, 0.92)';
  const ringStroke = isNight ? '#a78548' : '#70522c';

  return (
    <g transform={`translate(${x}, ${y}) scale(${scale})`}>
      <circle cx={0} cy={0} r={8.2} fill={badgeBg} stroke={ringStroke} strokeWidth={1.1} />
      {type === 'FER' && (
        <g stroke={ink} strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round">
          <polygon points="-4,4 -1,-3 3,-2 5,4" fill="#6b7480" />
          <path d="M -4 -3 L 3 4 M 2 -4 L -3 1" strokeWidth={1.1} />
        </g>
      )}
      {type === 'OR' && (
        <g stroke="#523508" strokeWidth={1.1}>
          <polygon points="-4,3 -2,-2 1,-3 4,2 1,4" fill="#e8b838" />
          <circle cx={-1} cy={0.5} r={1.3} fill="#fff3b0" stroke="none" />
        </g>
      )}
      {type === 'PIERRE' && (
        <g stroke={ink} strokeWidth={1.1}>
          <rect x={-4.5} y={-2.5} width={5.5} height={5} rx={0.6} fill="#a39b8e" />
          <rect x={0.2} y={-0.5} width={4.5} height={4} rx={0.6} fill="#7e766b" />
        </g>
      )}
      {type === 'BOIS' && (
        <g stroke={ink} strokeWidth={1}>
          <polygon points="0,-5 -4,2 4,2" fill="#4f7a3d" />
          <rect x={-1} y={2} width={2} height={3} fill="#6b4423" />
        </g>
      )}
      {type === 'CEREALES' && (
        <g stroke="#6b4b12" strokeWidth={1.1} strokeLinecap="round">
          <line x1={0} y1={4.5} x2={0} y2={-4.5} />
          <ellipse cx={-2} cy={-2} rx={1.3} ry={0.8} fill="#d9a938" />
          <ellipse cx={2} cy={-1} rx={1.3} ry={0.8} fill="#d9a938" />
          <ellipse cx={-2} cy={1} rx={1.3} ry={0.8} fill="#d9a938" />
          <ellipse cx={2} cy={2} rx={1.3} ry={0.8} fill="#d9a938" />
        </g>
      )}
      {type === 'ELEVAGE' && (
        <g stroke={ink} strokeWidth={1} strokeLinecap="round" strokeLinejoin="round">
          <ellipse cx={0} cy={1} rx={4} ry={2.8} fill="#efe5cc" />
          <circle cx={-3.8} cy={-0.5} r={1.6} fill="#5c422c" />
          <line x1={-2} y1={3.5} x2={-2} y2={5} />
          <line x1={2} y1={3.5} x2={2} y2={5} />
        </g>
      )}
      {type === 'POISSON_SEL' && (
        <g stroke="#1b435e" strokeWidth={1.1}>
          <path d="M -4,0 Q 0,-3.5 3.5,0 Q 0,3.5 -4,0 Z" fill="#5e9ec4" />
          <polygon points="3.2,0 5.4,-2 5.4,2" fill="#3b7496" />
        </g>
      )}
      {type === 'HERBES_ARCANES' && (
        <g stroke="#3d2b5c" strokeWidth={1.1} strokeLinecap="round">
          <path d="M 0,4.5 C -1,1 -3,-1 -3.5,-3.5 C -1,-2.5 0,-1 0,1 C 0,-1 1.5,-2.5 3.5,-3.5 C 3,-1 1,1 0,4.5 Z" fill="#7c5ca8" />
          <circle cx={0} cy={-3.5} r={1.1} fill="#d6b8ff" stroke="none" />
        </g>
      )}
    </g>
  );
}
