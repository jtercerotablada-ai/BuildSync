/**
 * Home background palette — mirrors Asana's "Personalize > Background"
 * row of 8 color swatches. The swatch is the saturated dot the user
 * clicks; `bg` is the lighter tint actually applied behind the widget
 * grid so widget cards stay readable.
 */

export type HomeBackgroundId =
  | 'default'
  | 'burgundy'
  | 'amber'
  | 'emerald'
  | 'teal'
  | 'sky'
  | 'violet'
  | 'pink';

export interface HomeBackgroundDef {
  id: HomeBackgroundId;
  label: string;
  swatch: string;
  bg: string | null;
  checkColor: string;
}

export const HOME_BACKGROUND_PALETTE: HomeBackgroundDef[] = [
  { id: 'default', label: 'Default', swatch: '#ffffff', bg: null, checkColor: '#111827' },
  { id: 'burgundy', label: 'Burgundy', swatch: '#9f1239', bg: '#fff1f2', checkColor: '#ffffff' },
  { id: 'amber', label: 'Amber', swatch: '#d97706', bg: '#fffbeb', checkColor: '#ffffff' },
  { id: 'emerald', label: 'Emerald', swatch: '#059669', bg: '#ecfdf5', checkColor: '#ffffff' },
  { id: 'teal', label: 'Teal', swatch: '#0d9488', bg: '#f0fdfa', checkColor: '#ffffff' },
  { id: 'sky', label: 'Sky', swatch: '#0284c7', bg: '#f0f9ff', checkColor: '#ffffff' },
  { id: 'violet', label: 'Violet', swatch: '#7c3aed', bg: '#f5f3ff', checkColor: '#ffffff' },
  { id: 'pink', label: 'Pink', swatch: '#db2777', bg: '#fdf2f8', checkColor: '#ffffff' },
];

export function getHomeBackground(id: HomeBackgroundId): HomeBackgroundDef {
  return HOME_BACKGROUND_PALETTE.find((b) => b.id === id) ?? HOME_BACKGROUND_PALETTE[0];
}

export const HOME_BACKGROUND_UI_STATE_KEY = 'home.background-color';
