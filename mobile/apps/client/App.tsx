import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { AuthProvider, ClientColors } from '@taxi/shared';
import RootNavigator from './src/navigation/RootNavigator';
import BrandIntro from './src/components/BrandIntro';

export default function App(): React.ReactNode {
  // Brand intro plays once per cold start. We mount RootNavigator
  // underneath immediately so auth/profile fetches happen in parallel
  // with the animation, then unmount the intro on finish.
  const [introVisible, setIntroVisible] = useState(true);

  return (
    // Root View pinned to the brand mint so the very first JS frame
    // paints the right colour — otherwise the activity's default
    // window background flashes grey between native splash hide and
    // the first React Native render.
    <View style={styles.root}>
      <AuthProvider requiredRole="client">
        <StatusBar style="dark" />
        <RootNavigator />
        {introVisible && <BrandIntro onFinish={() => setIntroVisible(false)} />}
      </AuthProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: ClientColors.background,
  },
});
