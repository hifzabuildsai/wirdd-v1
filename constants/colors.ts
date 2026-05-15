export const Colors = {
  // Core backgrounds
  background: '#080910',
  surface: '#0D0F1A',
  surfaceElevated: '#141627',

  // Brand gold
  gold: '#C8A84B',
  goldDim: '#9E7E35',
  goldSubtle: 'rgba(200, 168, 75, 0.10)',

  // Text hierarchy
  textPrimary: '#F0EDE8',
  textSecondary: '#7C7A8E',
  textMuted: '#3D3C50',

  // Borders
  border: '#1A1C2E',
  borderSubtle: '#0F1120',

  // Tab bar
  tabActive: '#C8A84B',
  tabInactive: '#3D3C50',
  tabBar: '#0A0C18',
  tabBarBorder: '#12142A',

  // Semantic
  success: '#4CAF82',
  error: '#E05252',
  warning: '#E8A23C',

  // Overlay
  overlay: 'rgba(8, 9, 16, 0.85)',
} as const;

export type ColorKey = keyof typeof Colors;
