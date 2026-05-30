import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet } from 'react-native';
import { ClientColors, useAuth } from '@taxi/shared';

interface Props {
  onFinish: () => void;
}

const MIN_HOLD_MS = 1000;

/**
 * Brand intro tied to auth readiness — not a fixed timer.
 *
 * The Expo native splash hands off to React with the same artwork
 * (splash-icon.png on background #F4FBFA). We continue the moment by
 * gently "breathing" the logo until BOTH conditions are true:
 *   1. AuthProvider has finished its first profile fetch.
 *   2. At least MIN_HOLD_MS has elapsed since mount — keeps the
 *      brand visible long enough to register on fast connections.
 *
 * Only then do we slide up + fade out. This guarantees there is no
 * visible ActivityIndicator gap between the intro and the app,
 * which was the "зависание" effect in the first cut.
 */
export default function BrandIntro({ onFinish }: Props): React.ReactNode {
  const { isLoading } = useAuth();

  const containerOpacity = useRef(new Animated.Value(1)).current;
  const containerTranslate = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(1)).current;
  const mountedAtRef = useRef<number>(Date.now());
  const exitedRef = useRef<boolean>(false);

  // Continuous breath loop — runs until the auth-ready exit kicks in.
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(logoScale, {
          toValue: 1.06,
          duration: 900,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(logoScale, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [logoScale]);

  // Trigger exit when auth is ready AND minimum hold has elapsed.
  useEffect(() => {
    if (isLoading || exitedRef.current) return;
    exitedRef.current = true;
    const elapsed = Date.now() - mountedAtRef.current;
    const remaining = Math.max(0, MIN_HOLD_MS - elapsed);
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(containerOpacity, {
          toValue: 0,
          duration: 320,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(containerTranslate, {
          toValue: -32,
          duration: 320,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) {
          onFinish();
        }
      });
    }, remaining);
    return () => clearTimeout(timer);
  }, [isLoading, containerOpacity, containerTranslate, onFinish]);

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
    // Identical to expo splash backgroundColor in app.json so the
    // handoff is invisible — same colour, same logo, same position.
    backgroundColor: ClientColors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 220,
    height: 220,
  },
});
