module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Reanimated 3 — must be last in the plugins list. Without it the
    // `worklet` directives never run on the UI thread and BottomSheet
    // (and any reanimated-driven animation) silently breaks.
    plugins: ['react-native-reanimated/plugin'],
  };
};
