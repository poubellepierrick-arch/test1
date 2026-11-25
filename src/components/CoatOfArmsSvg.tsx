import React, { useId } from 'react';
import { AzgaarCoatOfArms } from '../types/azgaar';

interface CoatOfArmsSvgProps {
  coa: AzgaarCoatOfArms;
  size?: number;
  className?: string;
}

export const CoatOfArmsSvg: React.FC<CoatOfArmsSvgProps> = ({
  coa,
  size = 44,
  className = '',
}) => {
  const clipId = useId();
  const shieldPath = 'M 10,8 H 90 V 58 C 90,85 50,108 50,108 C 50,108 10,85 10,58 Z';

  const renderDivision = () => {
    switch (coa.division) {
      case 'parti':
        return <rect x="50" y="0" width="50" height="115" fill={coa.secondaryColor} />;
      case 'coupe':
        return <rect x="0" y="55" width="100" height="60" fill={coa.secondaryColor} />;
      case 'ecartele':
        return (
          <>
            <rect x="50" y="0" width="50" height="55" fill={coa.secondaryColor} />
            <rect x="0" y="55" width="50" height="60" fill={coa.secondaryColor} />
          </>
        );
      case 'chevron':
        return <polygon points="10,74 50,36 90,74 90,94 50,56 10,94" fill={coa.secondaryColor} />;
      case 'pal':
        return <rect x="37" y="0" width="26" height="115" fill={coa.secondaryColor} />;
      default:
        return null;
    }
  };

  const renderCharge = () => {
    const c = coa.chargeColor || '#f3d37a';
    switch (coa.charge) {
      case 'tour':
        return (
          <g fill={c} stroke="#1a120b" strokeWidth="2">
            <rect x="37" y="34" width="26" height="42" rx="1" />
            <rect x="34" y="26" width="8" height="10" />
            <rect x="46" y="26" width="8" height="10" />
            <rect x="58" y="26" width="8" height="10" />
            <rect x="45" y="56" width="10" height="20" fill="#1a120b" />
          </g>
        );
      case 'epee':
        return (
          <g fill={c} stroke="#1a120b" strokeWidth="1.8">
            <polygon points="50,20 55,66 45,66" />
            <rect x="35" y="64" width="30" height="6" rx="2" />
            <rect x="47" y="70" width="6" height="14" />
            <circle cx="50" cy="86" r="4" />
          </g>
        );
      case 'couronne':
        return (
          <g fill={c} stroke="#1a120b" strokeWidth="2">
            <polygon points="28,68 32,38 42,52 50,30 58,52 68,38 72,68" />
            <rect x="28" y="68" width="44" height="8" rx="1" />
          </g>
        );
      case 'ancre':
        return (
          <g fill="none" stroke={c} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="50" cy="28" r="5" />
            <line x1="50" y1="33" x2="50" y2="80" />
            <line x1="36" y1="45" x2="64" y2="45" />
            <path d="M 30,66 Q 50,90 70,66" />
          </g>
        );
      case 'soleil':
        return (
          <g fill={c} stroke="#1a120b" strokeWidth="1.5">
            <circle cx="50" cy="54" r="13" />
            {[0, 45, 90, 135, 180, 225, 270, 315].map(a => (
              <polygon
                key={a}
                points="50,24 54,37 46,37"
                transform={`rotate(${a} 50 54)`}
              />
            ))}
          </g>
        );
      case 'lune':
        return (
          <path
            d="M 58,28 A 24,24 0 1,0 58,80 A 18,18 0 1,1 58,28 Z"
            fill={c}
            stroke="#1a120b"
            strokeWidth="1.8"
          />
        );
      case 'arbre':
        return (
          <g fill={c} stroke="#1a120b" strokeWidth="1.8">
            <rect x="46" y="58" width="8" height="24" />
            <circle cx="50" cy="40" r="16" />
            <circle cx="38" cy="48" r="10" />
            <circle cx="62" cy="48" r="10" />
          </g>
        );
      case 'etoile':
        return (
          <polygon
            points="50,24 57,44 78,44 61,56 67,76 50,64 33,76 39,56 22,44 43,44"
            fill={c}
            stroke="#1a120b"
            strokeWidth="1.8"
          />
        );
      case 'lion':
        return (
          <g fill={c} stroke="#1a120b" strokeWidth="1.8">
            <circle cx="48" cy="36" r="10" />
            <path d="M 38,44 Q 58,42 62,64 L 58,82 H 49 V 66 H 41 V 82 H 34 L 36,54 Z" />
            <path d="M 62,56 Q 74,42 68,28" fill="none" stroke={c} strokeWidth="4" strokeLinecap="round" />
          </g>
        );
      default:
        return (
          <path
            d="M 34,34 H 66 V 58 C 66,74 50,84 50,84 C 50,84 34,74 34,58 Z"
            fill={c}
            stroke="#1a120b"
            strokeWidth="2"
          />
        );
    }
  };

  const height = Math.round(size * 1.15);

  return (
    <svg
      width={size}
      height={height}
      viewBox="0 0 100 115"
      className={`shrink-0 ${className}`}
      aria-label="Blason"
    >
      <defs>
        <clipPath id={clipId}>
          <path d={shieldPath} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <rect x="0" y="0" width="100" height="115" fill={coa.fieldColor} />
        {renderDivision()}
        {renderCharge()}
      </g>
      <path d={shieldPath} fill="none" stroke="#c89e45" strokeWidth="4" />
      <path d={shieldPath} fill="none" stroke="#231a14" strokeWidth="1.4" />
    </svg>
  );
};
