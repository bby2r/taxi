import { Platform, TextStyle } from 'react-native';

const fontFamily = Platform.select({
  ios: 'System',
  android: 'Roboto',
  default: 'System',
});

export const Typography = {
  // Display sizes — for screen titles in onboarding / completion modals.
  display: { fontFamily, fontSize: 28, fontWeight: '800', lineHeight: 34, letterSpacing: -0.4 } as TextStyle,
  h1: { fontFamily, fontSize: 28, fontWeight: '700', lineHeight: 34 } as TextStyle,
  h2: { fontFamily, fontSize: 22, fontWeight: '600', lineHeight: 28 } as TextStyle,
  h3: { fontFamily, fontSize: 18, fontWeight: '600', lineHeight: 24 } as TextStyle,
  // 16/700 — section titles inside cards (e.g. route names, modal headings).
  h4: { fontFamily, fontSize: 16, fontWeight: '700', lineHeight: 22, letterSpacing: -0.2 } as TextStyle,
  body: { fontFamily, fontSize: 16, fontWeight: '400', lineHeight: 22 } as TextStyle,
  bodyBold: { fontFamily, fontSize: 16, fontWeight: '600', lineHeight: 22 } as TextStyle,
  // 15/600 — list row primaries (peek bar titles, menu rows).
  bodyMedium: { fontFamily, fontSize: 15, fontWeight: '600', lineHeight: 20 } as TextStyle,
  caption: { fontFamily, fontSize: 13, fontWeight: '400', lineHeight: 18 } as TextStyle,
  // 13/700 uppercase-ready — for section labels and chip text.
  overline: { fontFamily, fontSize: 13, fontWeight: '700', lineHeight: 18, letterSpacing: 0.6 } as TextStyle,
  button: { fontFamily, fontSize: 16, fontWeight: '600', lineHeight: 20 } as TextStyle,
  buttonLarge: { fontFamily, fontSize: 18, fontWeight: '700', lineHeight: 24 } as TextStyle,
} as const;
