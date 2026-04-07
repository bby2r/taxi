const expoPreset = require('jest-expo/jest-preset');

module.exports = {
  ...expoPreset,
  // Remove jest-expo setup that causes runtime issues; keep react-native setup
  setupFiles: expoPreset.setupFiles.filter(
    (f) => !f.includes('jest-expo')
  ),
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|react-native-maps|pusher-js|axios)',
  ],
  moduleNameMapper: {
    ...expoPreset.moduleNameMapper,
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
