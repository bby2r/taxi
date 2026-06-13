import { useEffect, useState } from 'react';
import * as Font from 'expo-font';
import { Feather, Ionicons } from '@expo/vector-icons';

/**
 * Загружает шрифты vector-icons.
 *
 * `@expo/vector-icons` Icon-компонент сам проверяет `Font.isLoaded(fontName)`
 * в state и держит пустой `<Text/>` пока не загружен. Если просто
 * Font.loadAsync с НАШИМ require'ом — Icon-компонент не знает что шрифт
 * это его шрифт, и продолжает рендерить пусто (или race'ит со своим
 * componentDidMount await Font.loadAsync которое promise-rejects в
 * release без правильно настроенного asset path'а).
 *
 * Используем `Feather.loadFont()` / `Ionicons.loadFont()` — это статические
 * методы которые внутри делают `Font.loadAsync({feather: <их-asset-id>})`.
 * Это гарантированно использует expoAssetId который зашит при сборке
 * библиотеки, и Icon-компонент будет в синхронизированном `fontIsLoaded`
 * state на первом рендере.
 */
export function useIconFonts(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    Promise.all([Feather.loadFont(), Ionicons.loadFont()])
      .catch((e) => console.warn('[useIconFonts] loadFont failed:', e))
      .finally(() => setReady(true));
  }, []);
  return ready;
}
