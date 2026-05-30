import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '@taxi/shared';
import RootNavigator from './src/navigation/RootNavigator';
import BrandIntro from './src/components/BrandIntro';

export default function App(): React.ReactNode {
  // Brand intro plays once per cold start. We mount RootNavigator
  // underneath immediately so auth/profile fetches happen in parallel
  // with the animation, then unmount the intro on finish.
  const [introVisible, setIntroVisible] = useState(true);

  return (
    <AuthProvider requiredRole="client">
      <StatusBar style="dark" />
      <RootNavigator />
      {introVisible && <BrandIntro onFinish={() => setIntroVisible(false)} />}
    </AuthProvider>
  );
}
