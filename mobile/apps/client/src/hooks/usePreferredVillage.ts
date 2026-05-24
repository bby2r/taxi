import { useEffect, useState, useCallback } from 'react';
import { getPreferredVillageId, savePreferredVillageId, Region } from '@taxi/shared';

/**
 * «Моё село» — id района, который клиент указал как место своего
 * проживания. Используется как from для one-tap «Заказ внутри села»
 * и дефолт «Откуда» в межсёлами-модалке.
 *
 * Хранится в SecureStore — выживает перезапуск приложения. Если в
 * SecureStore ничего нет (первый запуск) — берём первый район из
 * `regions` как разумный дефолт; пользователь сразу видит цену, при
 * необходимости меняет через chip над кнопкой.
 *
 * Возвращает [id, setId, ready]: ready=false пока не подгрузили из
 * хранилища, чтобы UI не мигал значением «по умолчанию» и потом
 * перепрыгивал на сохранённое.
 */
export function usePreferredVillage(regions: Region[]): {
  id: number | null;
  setId: (id: number) => void;
  ready: boolean;
} {
  const [id, setIdState] = useState<number | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getPreferredVillageId()
      .then((stored) => {
        if (cancelled) return;
        // Если сохранённый id не входит в актуальный список (район
        // удалили в админке) — игнорируем сохранённое.
        const valid =
          stored !== null && regions.some((r) => r.id === stored);
        if (valid) {
          setIdState(stored);
        } else if (regions[0]) {
          setIdState(regions[0].id);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [regions]);

  const setId = useCallback((newId: number) => {
    setIdState(newId);
    savePreferredVillageId(newId).catch(() => undefined);
  }, []);

  return { id, setId, ready };
}
