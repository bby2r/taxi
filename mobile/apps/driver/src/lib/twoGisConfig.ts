// 2GIS MapGL JS API key. Resolved at build time from
// EXPO_PUBLIC_TWOGIS_KEY (Expo inlines any EXPO_PUBLIC_* into the JS
// bundle automatically).
//
// Local dev: ключ лежит в mobile/.env. Expo читает .env только из
// директории приложения (mobile/apps/driver/.env), поэтому в репо
// стоит симлинк apps/driver/.env -> ../../.env. Если симлинк потерян
// (npm install на чистом клоне, Windows), пересоздать:
//   ln -sf ../../.env mobile/apps/driver/.env
// CI/EAS: задан как GitHub Actions secret EXPO_PUBLIC_TWOGIS_KEY,
// пробрасывается через env: в .github/workflows/mobile-android-apk.yml.
//
// Если ключ пустой — TwoGisMapView показывает видимое сообщение
// «карта не настроена» вместо чёрного экрана (раньше это превращалось
// в немой баг типа «у меня карта чёрная»).
export const TWOGIS_API_KEY = process.env.EXPO_PUBLIC_TWOGIS_KEY ?? '';

// Default camera for cold-start when the driver's GPS hasn't fixed yet.
// Bishkek center — most drivers in this app are KG-based.
export const TWOGIS_DEFAULT_CENTER: [number, number] = [74.5698, 42.8746];
export const TWOGIS_DEFAULT_ZOOM = 13;
