import React from 'react';
import { VectorPath, AppSettings } from '../types';

export type CursorState =
  | 'idle'
  | 'hover_click'
  | 'click'
  | 'hover_drag'
  | 'hover_drag_click'
  | 'drag'
  | 'release';

export interface CursorMetadataItem {
  label: string;
  refHugeIcon: string;
  description: string;
  hotspot: { x: number; y: number }; // In 24x24 reference coordinates
}

export const cursorMetadata: Record<CursorState, CursorMetadataItem> = {
  idle: {
    label: 'Repos (Idle)',
    refHugeIcon: 'hold 03',
    description: 'Curseur normal sur le canvas sans objet survolé',
    hotspot: { x: 9, y: 3 },
  },
  hover_click: {
    label: 'Survol Clic (Hover Click)',
    refHugeIcon: 'touch 09',
    description: 'Survol d’un objet cliquable uniquement',
    hotspot: { x: 12, y: 2 },
  },
  click: {
    label: 'Clic Actif (Click)',
    refHugeIcon: 'touch 07',
    description: 'Pression ou clic en cours sur un objet cliquable',
    hotspot: { x: 10, y: 2 },
  },
  hover_drag: {
    label: 'Survol Déplacement (Hover Drag)',
    refHugeIcon: 'hand 05',
    description: 'Survol d’un objet déplaçable uniquement',
    hotspot: { x: 13, y: 2 },
  },
  hover_drag_click: {
    label: 'Survol Mixte (Drag & Clic)',
    refHugeIcon: 'touch 08',
    description: 'Survol d’un objet à la fois déplaçable et cliquable',
    hotspot: { x: 11, y: 2 },
  },
  drag: {
    label: 'En Déplacement (Drag & Hold)',
    refHugeIcon: 'hold 04',
    description: 'Objet saisi / maintenu en cours de déplacement',
    hotspot: { x: 12, y: 6 },
  },
  release: {
    label: 'Relâchement (Release)',
    refHugeIcon: 'hand 05',
    description: 'Relâchement d’un objet après un déplacement',
    hotspot: { x: 13, y: 2 },
  },
};

/**
 * Official Hugeicons Vector definitions matching:
 * - idle: hold 03
 * - hover_click: touch 09
 * - click: touch 07
 * - hover_drag: hand 05
 * - hover_drag_click: touch 08
 * - drag: hold 04
 * - release: hand 05
 */
export const officialHugeIconsPaths: Record<
  CursorState,
  Array<{ d: string; stroke?: string; fill?: string; strokeWidth?: number; strokeLinecap?: 'round'; strokeLinejoin?: 'round' }>
> = {
  // idle: Hold 03
  idle: [
    {
      d: 'M20.5 9.5V14.1667C20.5 16.34 20.5 17.4267 20.1689 18.2918C19.6627 19.6148 18.6207 20.6601 17.3019 21.1679C16.4395 21.5 15.3562 21.5 13.1896 21.5C12.0534 21.5 11.4853 21.5 10.9566 21.3834C10.1499 21.2056 9.40001 20.8294 8.77419 20.2888C8.36398 19.9344 8.02311 19.4785 7.34137 18.5667L4.33738 14.5487C3.8758 13.9314 3.88907 13.0789 4.36965 12.4763C4.99772 11.6888 6.16877 11.6237 6.8797 12.3369L8.5011 13.9634V10.5V6C8.5011 5.17157 9.17267 4.5 10.0011 4.5C10.8295 4.5 11.5011 5.17157 11.5011 6M11.5011 6V4C11.5011 3.17157 12.1727 2.5 13.0011 2.5C13.8295 2.5 14.5011 3.17157 14.5011 4V6M11.5011 6V10.5M14.5011 6C14.5011 5.17157 15.1727 4.5 16.0011 4.5C16.8295 4.5 17.5011 5.17157 17.5011 6V8M14.5011 6V10.5M20.5011 10.5V8C20.5011 7.17157 19.8295 6.5 19.0011 6.5C18.1727 6.5 17.5011 7.17157 17.5011 8M17.5011 8V10.5',
      stroke: 'currentColor',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      strokeWidth: 1.8,
    },
  ],

  // hover_click: Touch 09
  hover_click: [
    {
      d: 'M12.1121 8.68466L12.965 3.7607C13.1063 2.94487 12.5712 2.16689 11.7698 2.02304C10.9684 1.87919 10.2042 2.42393 10.0629 3.23976L8.35714 13.0877L8.21569 13.8509L6.30622 11.837C5.61343 11.1239 4.47226 11.1889 3.86022 11.9765C3.3919 12.5791 3.37897 13.4315 3.82877 14.0489L6.75611 18.0667C7.42045 18.9785 7.75263 19.4345 8.15236 19.7888C8.76222 20.3294 9.49302 20.7056 10.2791 20.8834C10.7943 21 11.3479 21 12.4552 21H14.7886C17.0993 21 19.0901 19.3242 19.549 16.9929L20.3921 12.7094L20.4774 12.2171C20.6187 11.4012 20.0836 10.6232 19.2822 10.4794C18.4808 10.3355 17.7166 10.8803 17.5752 11.6961L17.49 12.1885M12.1121 8.68466L11.8563 10.1618M12.1121 8.68466C12.2534 7.86883 13.0177 7.32408 13.8191 7.46794C14.6205 7.61179 15.1556 8.38977 15.0143 9.20559L14.8437 10.1904M14.8437 10.1904L14.7584 10.6828M14.8437 10.1904C14.985 9.37456 15.7492 8.82981 16.5506 8.97367C17.352 9.11752 17.8871 9.89549 17.7458 10.7113L17.6605 11.2037',
      stroke: 'currentColor',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      strokeWidth: 1.8,
    },
  ],

  // click: Touch 07
  click: [
    {
      d: 'M11.2273 7.78947V3.57895C11.2273 2.70692 10.5353 2 9.68182 2C8.82829 2 8.13636 2.70692 8.13636 3.57895V14.0655L6.46696 12.3546C5.73449 11.6039 4.52795 11.6724 3.88085 12.5014C3.38571 13.1357 3.37204 14.033 3.8476 14.6829L6.94263 18.9123C7.64502 19.8721 7.99622 20.352 8.41886 20.725C9.06365 21.2941 9.83631 21.6901 10.6674 21.8773C11.2121 22 11.7975 22 12.9681 22C15.2003 22 16.3164 22 17.205 21.6504C18.5637 21.1159 19.6373 20.0155 20.1589 18.623C20.5 17.7123 20.5 16.5684 20.5 14.2807V11.6782C20.5 10.649 19.7718 9.77073 18.7782 9.60154L18.4254 9.54147C17.8934 9.45089 17.4091 9.87003 17.4091 10.4211M11.2273 7.78947L11.8225 7.48542C12.1086 7.33925 12.4286 7.24491 12.7397 7.3211C13.6452 7.54286 14.3182 8.37534 14.3182 9.36842M11.2273 7.78947V10.4211M14.3182 9.36842V10.4211M14.3182 9.36842C14.3182 8.78707 14.7795 8.31579 15.3485 8.31579C16.4865 8.31579 17.4091 9.25835 17.4091 10.4211M17.4091 10.4211V11.4737',
      stroke: 'currentColor',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      strokeWidth: 1.8,
    },
  ],

  // hover_drag: Hand 05
  hover_drag: [
    {
      d: 'M18.5 11.5V8.75C18.5 7.7835 19.2835 7 20.25 7C21.2165 7 22 7.7835 22 8.75V14.8C22 18.7765 18.7764 22 14.8 22H12.0588M8 14L5.61507 11.2176C5.22468 10.7621 4.65476 10.5 4.05489 10.5H3.91898C2.85916 10.5 2 11.3592 2 12.419C2 12.7978 2.11214 13.1682 2.32229 13.4834L5.7812 18.6718C7.16738 20.7511 9.50102 22 12 22',
      stroke: 'currentColor',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      strokeWidth: 1.8,
    },
    {
      d: 'M18.5 8.5V5.75C18.5 4.7835 17.7165 4 16.75 4C15.7835 4 15 4.7835 15 5.75V10.5',
      stroke: 'currentColor',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      strokeWidth: 1.8,
    },
    {
      d: 'M15 10.5V3.75C15 2.7835 14.2165 2 13.25 2C12.2835 2 11.5 2.7835 11.5 3.75V10',
      stroke: 'currentColor',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      strokeWidth: 1.8,
    },
    {
      d: 'M11.5 10V5.75C11.5 4.7835 10.7165 4 9.75 4C8.7835 4 8 4.7835 8 5.75V14',
      stroke: 'currentColor',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      strokeWidth: 1.8,
    },
  ],

  // hover_drag_click: Touch 08 (Index tendu + main semi-ouverte prête à saisir ou cliquer)
  hover_drag_click: [
    {
      d: 'M12.5 9.5V4C12.5 3.17157 11.8284 2.5 11 2.5C10.1716 2.5 9.5 3.17157 9.5 4V13.5L7.5 11.5C6.8 10.8 5.7 10.8 5 11.5C4.3 12.2 4.3 13.3 5 14L8 17C9 18 10 19 12 19H15C17.2091 19 19 17.2091 19 15V11C19 10.1716 18.3284 9.5 17.5 9.5C16.6716 9.5 16 10.1716 16 11M16 11V10C16 9.17157 15.3284 8.5 14.5 8.5C13.6716 8.5 13 9.17157 13 10M13 10V11M12.5 9.5C12.5 8.67157 13.1716 8 14 8C14.8284 8 15.5 8.67157 15.5 9.5',
      stroke: 'currentColor',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      strokeWidth: 1.8,
    },
  ],

  // drag: Hold 04
  drag: [
    {
      d: 'M19.75 12.3347H20.5H20.5H19.75ZM5.81729 15.4792L6.43779 15.0579L6.43779 15.0579L5.81729 15.4792ZM6.3809 16.3093L5.7604 16.7306L5.7604 16.7306L6.3809 16.3093ZM6.2843 8.87473L5.76704 8.33164C5.75364 8.3444 5.74071 8.35766 5.72829 8.37138L6.2843 8.87473ZM8.24493 8.04309C8.54487 7.75741 8.55643 7.28268 8.27076 6.98274C7.98508 6.6828 7.51035 6.67124 7.21041 6.95691L8.24493 8.04309ZM4.25519 12.4372L5.00387 12.3927L4.25519 12.4372ZM4.30904 11.6756L3.57406 11.5262V11.5262L4.30904 11.6756ZM19.4583 16.168L20.1639 16.4223V16.4223L19.4583 16.168ZM16.3566 19.2136L16.1104 18.5051L16.3566 19.2136ZM10.197 19.3872L10.3527 18.6535H10.3527L10.197 19.3872ZM7.72767 18.0896L8.24483 17.5464V17.5464L7.72767 18.0896ZM7 12C7 12.4142 7.33579 12.75 7.75 12.75C8.16421 12.75 8.5 12.4142 8.5 12H7ZM13 8.87473C13 9.28894 13.3358 9.62473 13.75 9.62473C14.1642 9.62473 14.5 9.28894 14.5 8.87473H13ZM16 9.5C16 9.91421 16.3358 10.25 16.75 10.25C17.1642 10.25 17.5 9.91421 17.5 9.5H16ZM19.75 8H19V8L19.75 8ZM10 8.5C10 8.91421 10.3358 9.25 10.75 9.25C11.1642 9.25 11.5 8.91421 11.5 8.5H10ZM5.19679 15.9005L5.7604 16.7306L7.0014 15.888L6.43779 15.0579L5.19679 15.9005ZM6.80156 9.41781L8.24493 8.04309L7.21041 6.95691L5.76704 8.33164L6.80156 9.41781ZM6.43779 15.0579C5.92498 14.3026 5.57104 13.7799 5.33415 13.346C5.10404 12.9245 5.01895 12.6465 5.00387 12.3927L3.50651 12.4817C3.53969 13.0402 3.73104 13.54 4.01761 14.0648C4.2974 14.5773 4.70038 15.1693 5.19679 15.9005L6.43779 15.0579ZM5.72829 8.37138C5.13366 9.02823 4.65143 9.55972 4.30239 10.029C3.94502 10.5095 3.68545 10.978 3.57406 11.5262L5.04403 11.8249C5.09477 11.5751 5.21846 11.3108 5.50599 10.9242C5.80186 10.5264 6.22619 10.0564 6.84031 9.37807L5.72829 8.37138ZM5.00387 12.3927C4.99257 12.2026 5.00605 12.0118 5.04403 11.8249L3.57406 11.5262C3.5102 11.8405 3.48749 12.1616 3.50651 12.4817L5.00387 12.3927ZM19 12.3347C19 14.4151 18.9888 15.2586 18.7527 15.9137L20.1639 16.4223C20.5112 15.4586 20.5 14.2862 20.5 12.3347H19ZM12.4527 20.25C14.4432 20.25 15.6287 20.2605 16.6027 19.922L16.1104 18.5051C15.4358 18.7395 14.5682 18.75 12.4527 18.75V20.25ZM18.7527 15.9137C18.318 17.1201 17.3492 18.0747 16.1104 18.5051L16.6027 19.922C18.2621 19.3455 19.5731 18.0616 20.1639 16.4223L18.7527 15.9137ZM12.4527 18.75C11.2705 18.75 10.7891 18.7461 10.3527 18.6535L10.0414 20.1209C10.6681 20.2539 11.3361 20.25 12.4527 20.25V18.75ZM5.7604 16.7306C6.37929 17.6421 6.74816 18.1926 7.21051 18.6328L8.24483 17.5464C7.92629 17.2431 7.6576 16.8545 7.0014 15.888L5.7604 16.7306ZM10.3527 18.6535C9.55688 18.4847 8.82685 18.1005 8.24483 17.5464L7.21051 18.6328C7.99531 19.38 8.97624 19.8949 10.0414 20.1209L10.3527 18.6535ZM8.5 12V6.5H7V12H8.5ZM9.25 5.75C9.66421 5.75 10 6.08579 10 6.5H11.5C11.5 5.25736 10.4926 4.25 9.25 4.25V5.75ZM8.5 6.5C8.5 6.08579 8.83579 5.75 9.25 5.75V4.25C8.00736 4.25 7 5.25736 7 6.5H8.5ZM13 7V8.87473H14.5V7H13ZM16 7V8H17.5V7H16ZM16 8V9.5H17.5V8H16ZM15.25 6.25C15.6642 6.25 16 6.58579 16 7H17.5C17.5 5.75736 16.4926 4.75 15.25 4.75V6.25ZM14.5 7C14.5 6.58579 14.8358 6.25 15.25 6.25V4.75C14.0074 4.75 13 5.75736 13 7H14.5ZM18.25 7.25C18.6642 7.25 19 7.58579 19 8H20.5C20.5 6.75736 19.4926 5.75 18.25 5.75V7.25ZM17.5 8C17.5 7.58579 17.8358 7.25 18.25 7.25V5.75C17.0074 5.75 16 6.75736 16 8H17.5ZM10 6.5V8.5H11.5V6.5H10ZM13 6V7H14.5V6H13ZM10 6V6.5H11.5V6H10ZM12.25 5.25C12.6642 5.25 13 5.58579 13 6H14.5C14.5 4.75736 13.4926 3.75 12.25 3.75V5.25ZM12.25 3.75C11.0074 3.75 10 4.75736 10 6H11.5C11.5 5.58579 11.8358 5.25 12.25 5.25V3.75ZM19 8L19 12.3347H20.5V8L19 8Z',
      fill: 'currentColor',
    },
  ],

  // release: Hand 05
  release: [
    {
      d: 'M18.5 11.5V8.75C18.5 7.7835 19.2835 7 20.25 7C21.2165 7 22 7.7835 22 8.75V14.8C22 18.7765 18.7764 22 14.8 22H12.0588M8 14L5.61507 11.2176C5.22468 10.7621 4.65476 10.5 4.05489 10.5H3.91898C2.85916 10.5 2 11.3592 2 12.419C2 12.7978 2.11214 13.1682 2.32229 13.4834L5.7812 18.6718C7.16738 20.7511 9.50102 22 12 22',
      stroke: 'currentColor',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      strokeWidth: 1.8,
    },
    {
      d: 'M18.5 8.5V5.75C18.5 4.7835 17.7165 4 16.75 4C15.7835 4 15 4.7835 15 5.75V10.5',
      stroke: 'currentColor',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      strokeWidth: 1.8,
    },
    {
      d: 'M15 10.5V3.75C15 2.7835 14.2165 2 13.25 2C12.2835 2 11.5 2.7835 11.5 3.75V10',
      stroke: 'currentColor',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      strokeWidth: 1.8,
    },
    {
      d: 'M11.5 10V5.75C11.5 4.7835 10.7165 4 9.75 4C8.7835 4 8 4.7835 8 5.75V14',
      stroke: 'currentColor',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      strokeWidth: 1.8,
    },
  ],
};

/**
 * Calculates pixel hotspot translation for the 36x36 custom floating cursor.
 */
export function calculateCursorOffsetPx(
  state: CursorState,
  settings?: AppSettings
): { x: number; y: number } {
  const sourceMode = settings?.cursorSourceMode || 'hugeicons';
  const meta = cursorMetadata[state] || cursorMetadata.idle;

  if (sourceMode === 'custom_drawn') {
    // Check if custom hotspot was defined in 200x200 canvas
    const customHotspot = settings?.customCursorHotspots?.[state];
    if (customHotspot) {
      return {
        x: Math.round((customHotspot.x / 200) * 36),
        y: Math.round((customHotspot.y / 200) * 36),
      };
    }
    // Fallback: scale metadata hotspot from 24x24
    return {
      x: Math.round((meta.hotspot.x / 24) * 36),
      y: Math.round((meta.hotspot.y / 24) * 36),
    };
  }

  // Official Hugeicons: 24x24 mapped to 36x36
  return {
    x: Math.round((meta.hotspot.x / 24) * 36),
    y: Math.round((meta.hotspot.y / 24) * 36),
  };
}

export function renderCursorSvg(
  state: CursorState,
  options?: {
    customVectorPaths?: VectorPath[];
    sourceMode?: 'hugeicons' | 'custom_drawn';
    color?: string;
  }
): React.ReactElement {
  const sourceMode = options?.sourceMode || 'hugeicons';
  const customPaths = options?.customVectorPaths;

  // Render Custom Drawn Vector Paths if present and in custom mode
  if (sourceMode === 'custom_drawn' && customPaths && customPaths.length > 0) {
    return (
      <svg
        viewBox="0 0 200 200"
        className="w-full h-full overflow-visible"
        xmlns="http://www.w3.org/2000/svg"
      >
        {customPaths.map((p, idx) => (
          <path
            key={idx}
            d={p.d}
            transform={p.transform}
            fill={p.fill || 'none'}
            stroke={p.stroke || '#0f172a'}
            strokeWidth={p.strokeWidth || 6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </svg>
    );
  }

  // Official Hugeicons Rendering (viewBox 0 0 24 24)
  const paths = officialHugeIconsPaths[state] || officialHugeIconsPaths.idle;
  const strokeColor = options?.color || '#0f172a';

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="w-full h-full overflow-visible"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* White background silhouette for maximum high-contrast legibility */}
      <g stroke="#ffffff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.95">
        {paths.map((p, i) => (
          <path key={`outline-${i}`} d={p.d} fill={p.fill ? '#ffffff' : 'none'} />
        ))}
      </g>

      {/* Main crisp Hugeicon stroke */}
      <g stroke={strokeColor} fill="none">
        {paths.map((p, i) => (
          <path
            key={`main-${i}`}
            d={p.d}
            fill={p.fill ? strokeColor : 'none'}
            stroke={p.stroke ? strokeColor : 'none'}
            strokeWidth={p.strokeWidth || 1.8}
            strokeLinecap={p.strokeLinecap || 'round'}
            strokeLinejoin={p.strokeLinejoin || 'round'}
          />
        ))}
      </g>

      {/* Subtle indicator for click */}
      {state === 'click' && (
        <circle cx="9.68" cy="2" r="1.2" fill="#6366f1" stroke="#ffffff" strokeWidth="0.8" />
      )}
    </svg>
  );
}

/**
 * Returns VectorPath[] scaled into the 200x200 canvas space for use as a reference guide.
 */
export function getHugeIconGuidePaths(state: CursorState): VectorPath[] {
  const paths = officialHugeIconsPaths[state] || officialHugeIconsPaths.idle;
  // Scaled by 7 and offset by (16, 16) to comfortably occupy the 200x200 drawing canvas
  return paths.map((p, idx) => ({
    id: `guide-${state}-${idx}`,
    d: p.d,
    stroke: '#64748b',
    strokeWidth: 2,
    fill: p.fill ? '#64748b' : undefined,
    transform: 'translate(16, 16) scale(7)',
  }));
}

/**
 * Returns default hotspot in 200x200 canvas space for a given cursor state.
 */
export function getDefaultCursorHotspot(state: CursorState): { x: number; y: number } {
  const meta = cursorMetadata[state] || cursorMetadata.idle;
  return {
    x: Math.round(16 + meta.hotspot.x * 7),
    y: Math.round(16 + meta.hotspot.y * 7),
  };
}

