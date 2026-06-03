// MapTiler API key. Шарится между driver и client app — оба читают
// EXPO_PUBLIC_MAPTILER_KEY из mobile/.env (через симлинк
// apps/<app>/.env -> ../../.env). Если симлинк потерян — пересоздать:
//   ln -sf ../../.env mobile/apps/client/.env
// CI: задан как GitHub Actions secret EXPO_PUBLIC_MAPTILER_KEY.
//
// Free tier MapTiler: 100k загрузок карты/мес без карточки.
// Получить ключ: https://cloud.maptiler.com/account/keys/
export const MAPTILER_KEY = process.env.EXPO_PUBLIC_MAPTILER_KEY ?? '';

// streets-v2-dark — тёмная карта в тон ночного режима Yandex Go.
// Раньше клиент использовал customMapStyle с ~10 правилами поверх
// Google Maps; MapTiler даёт готовый стиль с лучшей читаемостью
// надписей на тёмном фоне.
export const MAPTILER_STYLE = 'streets-v2-dark';

// Default camera для cold-start, пока GPS клиента не зафиксился —
// Бишкек центр.
export const MAP_DEFAULT_CENTER: [number, number] = [74.5698, 42.8746];
export const MAP_DEFAULT_ZOOM = 14;
