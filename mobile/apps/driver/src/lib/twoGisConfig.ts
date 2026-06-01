// 2GIS MapGL JS API key. Resolved at build time from
// EXPO_PUBLIC_TWOGIS_KEY (Expo inlines any EXPO_PUBLIC_* into the JS
// bundle automatically).
//
// Local dev: drop EXPO_PUBLIC_TWOGIS_KEY=... into mobile/.env (gitignored)
// CI/EAS: set as a build env in eas.json or as a GitHub Actions secret
// exposed during expo prebuild.
//
// If the var is missing, the WebView map will render a 401-style placeholder
// — the rest of the driver app still works (location, orders, calls).
export const TWOGIS_API_KEY = process.env.EXPO_PUBLIC_TWOGIS_KEY ?? '';

// Default camera for cold-start when the driver's GPS hasn't fixed yet.
// Bishkek center — most drivers in this app are KG-based.
export const TWOGIS_DEFAULT_CENTER: [number, number] = [74.5698, 42.8746];
export const TWOGIS_DEFAULT_ZOOM = 13;
