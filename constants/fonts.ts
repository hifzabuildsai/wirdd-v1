export const Fonts = {
  arabic: 'Amiri-Regular',
  displayLight: 'CormorantGaramond-Light',
  display: 'CormorantGaramond-Regular',
  ui: 'DMSans-Regular',
  uiMedium: 'DMSans-Medium',
} as const;

export type FontKey = keyof typeof Fonts;
