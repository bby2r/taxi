import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  RadialGradient,
  Stop,
} from 'react-native-svg';
import { ClientColors, useAuth } from '@taxi/shared';

interface Props {
  onFinish: () => void;
}

const MIN_HOLD_MS = 1300;
const LOCKUP_WIDTH = 230;
const LOCKUP_HEIGHT = 205;
const HALO_SIZE = 320;
const RING_SIZE = 264;

/**
 * Brand intro — optimised for low-end Android phones.
 *
 * Seamless handoff with the native Expo splash: app.json points the
 * native splash to alif-lockup.png on a mint background, so the lockup
 * is already in its final position when JS takes over. The lockup is
 * therefore rendered immediately at opacity 1 / scale 1 — no fade or
 * scale on the lockup itself. Only the ambient decorations (halo +
 * orbital ring) fade in around it, which keeps the entrance feeling
 * "alive" without the heavy first-frame work of the previous cut.
 *
 * Performance choices:
 *   • No light-glint sweep — that was a screen-height-tall SVG layer.
 *   • Lockup is a static Image — no per-frame transform on the hero.
 *   • Only one continuous loop: the orbital ring rotates. The breath
 *     is gone (it didn't add much next to the ring's motion).
 *   • Halo is mounted once and fades in; never animated again.
 *
 * Exit fires once auth is ready AND MIN_HOLD_MS has elapsed.
 */
export default function BrandIntro({ onFinish }: Props): React.ReactNode {
  const { isLoading } = useAuth();

  const containerOpacity = useRef(new Animated.Value(1)).current;
  const containerTranslate = useRef(new Animated.Value(0)).current;

  const haloOpacity = useRef(new Animated.Value(0)).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;
  const ringScale = useRef(new Animated.Value(0.94)).current;
  const ringRotation = useRef(new Animated.Value(0)).current;

  const mountedAtRef = useRef<number>(Date.now());
  const exitedRef = useRef<boolean>(false);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(haloOpacity, {
        toValue: 1,
        duration: 540,
        delay: 60,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(ringOpacity, {
        toValue: 1,
        duration: 480,
        delay: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(ringScale, {
        toValue: 1,
        duration: 640,
        delay: 240,
        easing: Easing.out(Easing.back(1.3)),
        useNativeDriver: true,
      }),
    ]).start();

    const ringLoop = Animated.loop(
      Animated.timing(ringRotation, {
        toValue: 1,
        duration: 7000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    ringLoop.start();
    return () => ringLoop.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isLoading || exitedRef.current) {
      return;
    }
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
          toValue: -24,
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

  const spin = ringRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const ringPath = useMemo(() => {
    const cx = RING_SIZE / 2;
    const cy = RING_SIZE / 2;
    const r = RING_SIZE / 2 - 6;
    return describeArc(cx, cy, r, -130, 130);
  }, []);
  const dotPosition = useMemo(() => {
    const cx = RING_SIZE / 2;
    const cy = RING_SIZE / 2;
    const r = RING_SIZE / 2 - 6;
    return polarToCartesian(cx, cy, r, 130);
  }, []);

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
      <Animated.View
        style={[
          styles.absoluteCenter,
          {
            width: HALO_SIZE,
            height: HALO_SIZE,
            opacity: haloOpacity,
          },
        ]}
      >
        <Svg width={HALO_SIZE} height={HALO_SIZE}>
          <Defs>
            <RadialGradient id="haloGrad" cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0%" stopColor={ClientColors.primary} stopOpacity="0.26" />
              <Stop offset="55%" stopColor={ClientColors.primary} stopOpacity="0.07" />
              <Stop offset="100%" stopColor={ClientColors.primary} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle
            cx={HALO_SIZE / 2}
            cy={HALO_SIZE / 2}
            r={HALO_SIZE / 2}
            fill="url(#haloGrad)"
          />
        </Svg>
      </Animated.View>

      <Animated.View
        style={[
          styles.absoluteCenter,
          {
            width: RING_SIZE,
            height: RING_SIZE,
            opacity: ringOpacity,
            transform: [{ scale: ringScale }, { rotate: spin }],
          },
        ]}
      >
        <Svg width={RING_SIZE} height={RING_SIZE}>
          <Defs>
            <LinearGradient id="ringGrad" x1="0%" y1="50%" x2="100%" y2="50%">
              <Stop offset="0%" stopColor={ClientColors.primary} stopOpacity="0" />
              <Stop offset="55%" stopColor={ClientColors.primary} stopOpacity="0.4" />
              <Stop offset="100%" stopColor={ClientColors.secondary} stopOpacity="0.85" />
            </LinearGradient>
          </Defs>
          <Path
            d={ringPath}
            stroke="url(#ringGrad)"
            strokeWidth={2.5}
            strokeLinecap="round"
            fill="none"
          />
          <Circle
            cx={dotPosition.x}
            cy={dotPosition.y}
            r={5}
            fill={ClientColors.secondary}
          />
        </Svg>
      </Animated.View>

      {/* The lockup is rendered at its final position from frame zero —
          identical to the native Expo splash. No fade, no scale, no
          per-frame work on the hero. */}
      <Animated.Image
        source={require('../../assets/alif-lockup.png')}
        resizeMode="contain"
        style={styles.lockup}
      />
    </Animated.View>
  );
}

interface CartesianPoint {
  x: number;
  y: number;
}

function polarToCartesian(
  cx: number,
  cy: number,
  r: number,
  angleDeg: number,
): CartesianPoint {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(angleRad), y: cy + r * Math.sin(angleRad) };
}

function describeArc(
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number,
): string {
  const start = polarToCartesian(cx, cy, r, endDeg);
  const end = polarToCartesian(cx, cy, r, startDeg);
  const largeArc = endDeg - startDeg <= 180 ? '0' : '1';
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: ClientColors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  absoluteCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockup: {
    width: LOCKUP_WIDTH,
    height: LOCKUP_HEIGHT,
  },
});
