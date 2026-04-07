import { Platform, TextStyle } from 'react-native';

const fontFamily = Platform.select({
  ios: 'System',
  android: 'Roboto',
  default: 'System',
});

export const Typography = {
  h1: { fontFamily, fontSize: 28, fontWeight: '700', lineHeight: 34 } as TextStyle,
  h2: { fontFamily, fontSize: 22, fontWeight: '600', lineHeight: 28 } as TextStyle,
  h3: { fontFamily, fontSize: 18, fontWeight: '600', lineHeight: 24 } as TextStyle,
  body: { fontFamily, fontSize: 16, fontWeight: '400', lineHeight: 22 } as TextStyle,
  bodyBold: { fontFamily, fontSize: 16, fontWeight: '600', lineHeight: 22 } as TextStyle,
  caption: { fontFamily, fontSize: 13, fontWeight: '400', lineHeight: 18 } as TextStyle,
  button: { fontFamily, fontSize: 16, fontWeight: '600', lineHeight: 20 } as TextStyle,
  buttonLarge: { fontFamily, fontSize: 18, fontWeight: '700', lineHeight: 24 } as TextStyle,
} as const;
