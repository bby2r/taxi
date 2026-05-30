import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet } from 'react-native';
import { ClientColors } from '@taxi/shared';

interface Props {
  onFinish: () => void;
}

/**
 * Cold-start brand moment. Expo's native splash (background
 * #F4FBFA + splash-icon.png centered, resizeMode contain) hands off
 * to React; this component starts in the same position with the same
 * artwork so the transition reads as one continuous moment — no
 * "second splash" jump. We then add a single subtle gesture: a
 * gentle scale breath, then slide-up + fade out into the app.
 *
 * Total ~900ms. All transforms run on the native driver.
 */
export default function BrandIntro({ onFinish }: Props): React.ReactNode {
  const containerOpacity = useRef(new Animated.Value(1)).current;
  const containerTranslate = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      // Subtle breath — confirms "we're alive", not a frozen screen.
      Animated.sequence([
        Animated.timing(logoScale, {
          toValue: 1.06,
          duration: 320,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(logoScale, {
          toValue: 1,
          duration: 260,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(150),
      // Exit — lift and fade.
      Animated.parallel([
        Animated.timing(containerOpacity, {
          toValue: 0,
          duration: 260,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(containerTranslate, {
          toValue: -32,
          duration: 260,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]).start(({ finished }) => {
      if (finished) {
        onFinish();
      }
    });
  }, [logoScale, containerOpacity, containerTranslate, onFinish]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFillObject,
        styles.container,
        {
          opacity: containerOpacity,
          transform: [{ translateY: containerTranslate }],
        },
      ]}
    >
      <Animated.Image
        source={require('../../assets/splash-icon.png')}
        style={[styles.logo, { transform: [{ scale: logoScale }] }]}
        resizeMode="contain"
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    // Match expo splash backgroundColor in app.json — keeps the
    // handoff visually identical: same colour, same image, just the
    // breath/exit animation is new.
    backgroundColor: ClientColors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 200,
    height: 200,
  },
});
