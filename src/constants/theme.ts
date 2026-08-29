import '@/global.css';

export const Colors = {
  ink: '#111827',
  muted: '#667085',
  canvas: '#F7F8FC',
  surface: '#FFFFFF',
  border: '#E4E7EC',
  brand: '#4F46E5',
  brandPressed: '#3730A3',
  brandSoft: '#EEF2FF',
  danger: '#D92D20',
  dangerSoft: '#FEF3F2',
  focus: '#A5B4FC',
  accent: '#F97316',
  accentSoft: '#FFF0E6',
  nav: '#111827',
  navMuted: '#A5B4FC',
} as const;

export const Layout = {
  contentMaxWidth: 560,
  horizontalPadding: 20,
  radius: 22,
} as const;

/**
 * The app draws its icons as Unicode glyphs rather than an icon library, so they inherit
 * the text colour and font weight around them. Picked for rendering monochrome on web;
 * checked against the alternatives (U+270F renders as a blob, U+270D as a colour emoji).
 */
export const Icons = {
  addNote: '\u271A',
  delete: '\u{1F5D1}',
  edit: '\u270E',
} as const;
