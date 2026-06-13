import { useEffect, useState } from 'react';
import * as Font from 'expo-font';

/**
 * Регистрирует шрифты иконок (vector-icons) через ReactFontManager.
 *
 * С New Architecture автоматический lookup `assets/fonts/` через
 * Typeface.createFromAsset перестал работать — шрифты копируются в
 * APK (через expo-font config plugin), но `<Text fontFamily="feather">`
 * остаётся unmatched, иконки рендерятся пустыми. `Font.loadAsync` явно
 * регистрирует family в ReactFontManager.
 *
 * Имя family должно совпадать с тем, что использует @expo/vector-icons
 * внутри `createIconSet` — это СТРОЧНОЕ (`'feather'`, `'ionicons'`),
 * Android case-sensitive.
 *
 * Возвращает `true` когда шрифты загружены ИЛИ загрузка упала — апп
 * никогда не блокируется навсегда из-за шрифтов.
 */
export function useIconFonts(fontMap: Record<string, number>): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    Font.loadAsync(fontMap)
      .catch((e) => console.warn('[useIconFonts] load failed:', e))
      .finally(() => setReady(true));
  }, []);
  return ready;
}
