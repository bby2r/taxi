import { type MutableRefObject, useCallback, useRef } from 'react';

export type MapPlacement = {
  latitude: number;
  longitude: number;
  heading: number;
};

/**
 * Восстановление driver-маркера и камеры после ремаунта WebView
 * (MIUI/Doze убивают render-процесс в фоне → новая страница,
 * __driverMarker = null). У стоящего водителя GPS-эффекты не
 * перевызываются, и без восстановления самолётик-иконка пропадала.
 *
 * Возвращает:
 *   - `lastRef` — где экран хранит последний placement (lat/lng/heading)
 *   - `handleMapReady` — стабильный callback для MapLibreMapView.onReady;
 *     первый 'ready' пропускает (начальный плейсмент делают эффекты экрана),
 *     на 2+ срабатывает `onRemount` с сохранённым placement'ом.
 */
export function useMapRemountRestoration(
  onRemount: (p: MapPlacement) => void,
): {
  lastRef: MutableRefObject<MapPlacement | null>;
  handleMapReady: () => void;
} {
  const lastRef = useRef<MapPlacement | null>(null);
  const readyCountRef = useRef(0);
  const onRemountRef = useRef(onRemount);
  onRemountRef.current = onRemount;
  const handleMapReady = useCallback((): void => {
    readyCountRef.current += 1;
    if (readyCountRef.current === 1) {
      return;
    }
    const p = lastRef.current;
    if (!p) {
      return;
    }
    onRemountRef.current(p);
  }, []);
  return { lastRef, handleMapReady };
}
