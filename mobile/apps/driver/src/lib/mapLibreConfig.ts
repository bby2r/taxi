// MapTiler key. Резолвится в build-time из EXPO_PUBLIC_MAPTILER_KEY
// (Expo инлайнит все EXPO_PUBLIC_* в JS-бандл).
//
// Local dev: ключ лежит в mobile/.env. Expo читает .env только из
// директории приложения (mobile/apps/driver/.env), поэтому в репо
// стоит симлинк apps/driver/.env -> ../../.env. Если симлинк потерян
// (npm install на чистом клоне, Windows), пересоздать:
//   ln -sf ../../.env mobile/apps/driver/.env
// CI/EAS: задан как GitHub Actions secret EXPO_PUBLIC_MAPTILER_KEY,
// пробрасывается через env: в .github/workflows/mobile-android-apk.yml.
//
// Получить бесплатный ключ: https://cloud.maptiler.com/account/keys/
// (free tier — 100k загрузок карты/месяц, без карточки).
//
// Если ключ пустой — MapLibreMapView показывает видимое сообщение
// «карта не настроена» вместо чёрного экрана.
export const MAPTILER_KEY = process.env.EXPO_PUBLIC_MAPTILER_KEY ?? '';

// Стиль карты MapTiler. streets-v2 — векторный стиль с 3D-зданиями на
// zoom 15+, нормальной читаемостью на тёмном фоне и поддержкой
// pitch/bearing. Альтернативы: 'basic-v2', 'streets-v2-dark', 'hybrid'.
export const MAPTILER_STYLE = 'streets-v2';

// Default camera для cold-start, пока GPS водителя не зафиксился.
// Bishkek центр — большинство водителей этого приложения в KG.
export const MAP_DEFAULT_CENTER: [number, number] = [74.5698, 42.8746];
export const MAP_DEFAULT_ZOOM = 13;
