import type { ReactNode } from 'react';

export type SetupIconId =
  | 'sex-female'
  | 'sex-male'
  | 'random'
  | 'origin-white'
  | 'origin-asian'
  | 'origin-south_asian'
  | 'origin-black'
  | 'origin-latina'
  | 'origin-middle_eastern'
  | 'origin-mixed'
  | 'hair-length-short'
  | 'hair-length-medium'
  | 'hair-length-long'
  | 'eye'
  | 'body-slim'
  | 'body-petite'
  | 'body-athletic'
  | 'body-curvy'
  | 'body-plus'
  | 'chest-small'
  | 'chest-medium'
  | 'chest-large'
  | 'occ-student'
  | 'occ-teacher'
  | 'occ-nurse'
  | 'occ-fitness'
  | 'occ-chef'
  | 'occ-lawyer'
  | 'occ-artist'
  | 'occ-pilot'
  | 'occ-doctor'
  | 'occ-model'
  | 'occ-musician';

export const ORIGIN_SWATCHES: Record<string, string> = {
  white: '#f2d6c9',
  asian: '#e8c4a8',
  south_asian: '#c68642',
  black: '#6b4423',
  latina: '#d9a066',
  middle_eastern: '#c49a6c',
  mixed: 'linear-gradient(135deg, #f2d6c9 0%, #c68642 50%, #6b4423 100%)',
};

export const HAIR_SWATCHES: Record<string, string> = {
  black: '#1a1a1a',
  'dark brown': '#3b2314',
  'light brown': '#a0724e',
  blonde: '#d4b87a',
  platinum: '#e8dcc8',
  auburn: '#6a2c1a',
  red: '#8b2500',
  silver: '#b8b8b8',
};

export const EYE_SWATCHES: Record<string, string> = {
  brown: '#6b3a2a',
  'dark brown': '#3b2314',
  blue: '#4a7ca8',
  green: '#4a7c4f',
  hazel: '#8e7540',
  amber: '#c88a2e',
};

const svgProps = {
  viewBox: '0 0 64 64',
  fill: 'none',
  xmlns: 'http://www.w3.org/2000/svg',
  'aria-hidden': true as const,
};

const RandomDice = () => (
  <svg {...svgProps}>
    <rect x="14" y="14" width="36" height="36" rx="8" stroke="currentColor" strokeWidth="2.5" />
    <circle cx="26" cy="26" r="3" fill="currentColor" />
    <circle cx="38" cy="38" r="3" fill="currentColor" />
  </svg>
);

const SexFemale = () => (
  <svg {...svgProps}>
    <circle cx="32" cy="18" r="9" stroke="currentColor" strokeWidth="2.5" />
    <path d="M18 58c0-12 6-20 14-20s14 8 14 20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    <path d="M24 36c4 6 12 6 16 0" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

const SexMale = () => (
  <svg {...svgProps}>
    <circle cx="28" cy="18" r="9" stroke="currentColor" strokeWidth="2.5" />
    <path d="M16 58c0-12 5-20 12-20s12 8 12 20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    <path d="M38 12h12v12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    <path d="M38 24l14-14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

const HairLengthIcon = ({ length }: { length: 'short' | 'medium' | 'long' }) => (
  <svg {...svgProps}>
    <circle cx="32" cy="24" r="11" stroke="currentColor" strokeWidth="2.5" />
    {length === 'short' ? (
      <path d="M20 24c0-8 5-14 12-14s12 6 12 14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    ) : null}
    {length === 'medium' ? (
      <path d="M18 26c0-10 6-18 14-18s14 8 14 18v6c-4-4-8-6-14-6s-10 2-14 6v-6z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
    ) : null}
    {length === 'long' ? (
      <path d="M16 28c0-12 7-20 16-20s16 8 16 20v18c-5-6-10-9-16-9s-11 3-16 9V28z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
    ) : null}
    <path d="M24 52h16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

const EyeIcon = ({ iris }: { iris: string }) => (
  <svg {...svgProps}>
    <path d="M8 32c8-12 20-18 24-18s16 6 24 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    <circle cx="32" cy="32" r="10" stroke="currentColor" strokeWidth="2.5" />
    <circle cx="32" cy="32" r="5" fill={iris} />
    <circle cx="34" cy="30" r="1.5" fill="#fff" opacity="0.9" />
  </svg>
);

const BodyIcon = ({ variant }: { variant: 'slim' | 'petite' | 'athletic' | 'curvy' | 'plus' }) => {
  const shoulders =
    variant === 'slim' ? '22,14 42,14' :
    variant === 'petite' ? '24,16 40,16' :
    variant === 'athletic' ? '20,12 44,12' :
    variant === 'curvy' ? '20,14 44,14' :
    '18,14 46,14';
  const waist =
    variant === 'slim' ? '26,34 38,34' :
    variant === 'petite' ? '27,32 37,32' :
    variant === 'athletic' ? '25,34 39,34' :
    variant === 'curvy' ? '24,34 40,34' :
    '23,34 41,34';
  const hips =
    variant === 'slim' ? '24,48 40,48' :
    variant === 'petite' ? '25,46 39,46' :
    variant === 'athletic' ? '24,48 40,48' :
    variant === 'curvy' ? '20,50 44,50' :
    '18,50 46,50';
  const height = variant === 'petite' ? 52 : 58;

  return (
    <svg {...svgProps}>
      <circle cx="32" cy="10" r="6" stroke="currentColor" strokeWidth="2.5" />
      <polyline points={shoulders} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d={`M32 20 L32 ${height}`} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <polyline points={waist} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <polyline points={hips} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      {variant === 'athletic' ? (
        <path d="M20 24 L14 34 M44 24 L50 34" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      ) : null}
    </svg>
  );
};

const ChestIcon = ({ size }: { size: 'small' | 'medium' | 'large' }) => (
  <svg {...svgProps}>
    <circle cx="32" cy="12" r="6" stroke="currentColor" strokeWidth="2.5" />
    <path d="M22 20h20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    {size === 'small' ? (
      <path d="M26 24c2 2 4 2 6 0s4-2 6 0" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    ) : null}
    {size === 'medium' ? (
      <path d="M24 24c3 3 6 3 8 0s5-3 8 0" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    ) : null}
    {size === 'large' ? (
      <path d="M22 24c4 4 8 4 10 0s6-4 10 0" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    ) : null}
    <path d="M32 30v22" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    <path d="M24 52h16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

const OccIcon = ({ kind }: { kind: SetupIconId }) => {
  switch (kind) {
    case 'occ-student':
      return (
        <svg {...svgProps}>
          <path d="M10 26l22-10 22 10-22 10-22-10z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M18 30v10c0 4 8 8 14 8s14-4 14-8V30" stroke="currentColor" strokeWidth="2.5" />
        </svg>
      );
    case 'occ-teacher':
      return (
        <svg {...svgProps}>
          <rect x="16" y="18" width="32" height="24" rx="3" stroke="currentColor" strokeWidth="2.5" />
          <path d="M22 26h20M22 34h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      );
    case 'occ-nurse':
      return (
        <svg {...svgProps}>
          <rect x="22" y="16" width="20" height="32" rx="4" stroke="currentColor" strokeWidth="2.5" />
          <path d="M32 24v16M26 32h12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      );
    case 'occ-fitness':
      return (
        <svg {...svgProps}>
          <path d="M14 40h8l4-16 4 32 4-20 4 12h8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'occ-chef':
      return (
        <svg {...svgProps}>
          <path d="M20 30c0-8 4-12 12-12s12 4 12 12" stroke="currentColor" strokeWidth="2.5" />
          <path d="M18 30h28v8c0 6-6 10-14 10s-14-4-14-10v-8z" stroke="currentColor" strokeWidth="2.5" />
        </svg>
      );
    case 'occ-lawyer':
      return (
        <svg {...svgProps}>
          <path d="M32 14v28" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M18 20h28M20 46h24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="32" cy="20" r="4" stroke="currentColor" strokeWidth="2.5" />
        </svg>
      );
    case 'occ-artist':
      return (
        <svg {...svgProps}>
          <path d="M16 46l8-24 8 10 8-16 8 30" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="48" cy="18" r="5" stroke="currentColor" strokeWidth="2.5" />
        </svg>
      );
    case 'occ-pilot':
      return (
        <svg {...svgProps}>
          <path d="M10 32h44" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M32 18l10 14H22l10-14z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M24 46h16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      );
    case 'occ-doctor':
      return (
        <svg {...svgProps}>
          <circle cx="32" cy="32" r="16" stroke="currentColor" strokeWidth="2.5" />
          <path d="M32 24v16M24 32h16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      );
    case 'occ-model':
      return (
        <svg {...svgProps}>
          <circle cx="32" cy="14" r="6" stroke="currentColor" strokeWidth="2.5" />
          <path d="M22 24c6 2 14 2 20 0v24H22V24z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M26 52h12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      );
    case 'occ-musician':
      return (
        <svg {...svgProps}>
          <path d="M26 44V24l18-6v20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="22" cy="44" r="5" stroke="currentColor" strokeWidth="2.5" />
          <circle cx="40" cy="38" r="5" stroke="currentColor" strokeWidth="2.5" />
        </svg>
      );
    default:
      return null;
  }
};

export const SetupOptionVisual = ({
  icon,
  swatch,
  swatchGradient,
  eyeColor,
  age,
}: {
  icon?: SetupIconId;
  swatch?: string;
  swatchGradient?: string;
  eyeColor?: string;
  age?: string;
}) => {
  if (age) {
    return <span>{age}</span>;
  }

  if (swatch || swatchGradient) {
    return (
      <span
        style={{
          background: swatchGradient ?? swatch,
        }}
      />
    );
  }

  if (!icon) return null;

  const icons: Record<string, ReactNode> = {
    'sex-female': <SexFemale />,
    'sex-male': <SexMale />,
    random: <RandomDice />,
    'hair-length-short': <HairLengthIcon length="short" />,
    'hair-length-medium': <HairLengthIcon length="medium" />,
    'hair-length-long': <HairLengthIcon length="long" />,
    eye: <EyeIcon iris={eyeColor ?? '#6b3a2a'} />,
    'body-slim': <BodyIcon variant="slim" />,
    'body-petite': <BodyIcon variant="petite" />,
    'body-athletic': <BodyIcon variant="athletic" />,
    'body-curvy': <BodyIcon variant="curvy" />,
    'body-plus': <BodyIcon variant="plus" />,
    'chest-small': <ChestIcon size="small" />,
    'chest-medium': <ChestIcon size="medium" />,
    'chest-large': <ChestIcon size="large" />,
  };

  if (icon.startsWith('occ-')) {
    return <OccIcon kind={icon} />;
  }

  return icons[icon] ?? <RandomDice />;
};