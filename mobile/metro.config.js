const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

const webStubs = {
  'react-native-maps': path.resolve(__dirname, 'src/stubs/react-native-maps.tsx'),
  'pusher-js': require.resolve('pusher-js/dist/web/pusher.js'),
};

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && webStubs[moduleName]) {
    return {
      filePath: webStubs[moduleName],
      type: 'sourceFile',
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
