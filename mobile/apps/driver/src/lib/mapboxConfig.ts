// Mapbox PUBLIC access token. Resolved at build time from the
// EXPO_PUBLIC_MAPBOX_TOKEN env var (Expo inlines any EXPO_PUBLIC_* into
// the JS bundle automatically).
//
// Why env var and not hardcoded:
//   - GitHub Push Protection treats every Mapbox token as a secret and
//     blocks the push, even for pk-tokens that are designed for shipped
//     client code. Easier to keep both pk and sk out of the repo than
//     to fight the scanner.
//   - Local dev: drop EXPO_PUBLIC_MAPBOX_TOKEN=pk.... into mobile/.env
//   - CI: set as a GitHub Actions secret of the same name; workflow
//     exposes it during expo prebuild so the value is baked into the
//     compiled JS bundle.
//
// If the var is missing, navigation map screens degrade — Mapbox tiles
// 401 — but the rest of the app still works.
export const MAPBOX_ACCESS_TOKEN =
  process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '';
