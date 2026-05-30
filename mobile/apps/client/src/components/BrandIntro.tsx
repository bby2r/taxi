import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Dimensions, Easing, StyleSheet } from 'react-native';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import { ClientColors, useAuth } from '@taxi/shared';

interface Props {
  onFinish: () => void;
}

const MIN_HOLD_MS = 1500;
const LOCKUP_WIDTH = 230;
const LOCKUP_HEIGHT = 205;
const HALO_SIZE = 380;
const RING_SIZE = 280;
const SHINE_WIDTH = 70;

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

/**
 * Brand intro — the real Alif lockup, presented with confidence.
 *
 * Lockup is the actual brand PNG (white card removed via floodfill at
 * build time, saved as alif-lockup.png), so the mark and wordmark
 * geometry match the brand exactly — no hand-rolled approximation.
 *
 * Choreography is deliberately restrained — premium brands don't
 * cartwheel:
 *   1. Halo + orbital ring fade in around centre.
 *   2. Lockup arrives as one cohesive block — fade + scale + slight
 *      rise from below.
 *   3. After the lockup settles, a single soft light glint sweeps
 *      across the screen at a diagonal — a "polish" pass.
 *   4. Continuous: gentle lockup breath, slow ring rotation, halo
 *      breath. No sonar pulse, no per-letter assembly (the PNG is
 *      one cohesive lockup, animating letters would distort it).
 *   5. Exit fires once auth is ready AND MIN_HOLD_MS has elapsed.
 *
 * Every ongoing animation uses the native driver — no JS-thread
 * interpolations, so the screen stays smooth on low-end phones.
 */
export default function BrandIntro({ onFinish }: Props): React.ReactNode {
  const { isLoading } = useAuth();

  const containerOpacity = useRef(new Animated.Value(1)).current;
  const containerTranslate = useRef(new Animated.Value(0)).current;

  const lockupOpacity = useRef(new Animated.Value(0)).current;
  const lockupScale = useRef(new Animated.Value(0.84)).current;
  const lockupTranslate = useRef(new Animated.Value(16)).current;
  const lockupBreath = useRef(new Animated.Value(1)).current;

  const haloOpacity = useRef(new Animated.Value(0)).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;
  const ringScale = useRef(new Animated.Value(0.94)).current;
  const ringRotation = useRef(new Animated.Value(0)).current;

  const shineTranslate = useRef(new Animated.Value(-SCREEN_W * 0.7)).current;

  const mountedAtRef = useRef<number>(Date.now());
  const exitedRef = useRef<boolean>(false);

  useEffect(() => {
    // Halo + ring fade in first, framing the centre before the lockup
    // arrives — feels like a stage being set.
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
        delay: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(ringScale, {
        toValue: 1,
        duration: 680,
        delay: 220,
        easing: Easing.out(Easing.back(1.3)),
        useNativeDriver: true,
      }),
    ]).start();

    // Lockup confident entrance — one block, no fake per-letter.
    Animated.parallel([
      Animated.timing(lockupOpacity, {
        toValue: 1,
        duration: 460,
        delay: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(lockupScale, {
        toValue: 1,
        duration: 640,
        delay: 280,
        easing: Easing.out(Easing.back(1.4)),
        useNativeDriver: true,
      }),
      Animated.timing(lockupTranslate, {
        toValue: 0,
        duration: 640,
        delay: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    // Single light glint sweeps across once after the lockup settles —
    // the "polish pass". Native driver, runs once, no loop.
    Animated.timing(shineTranslate, {
      toValue: SCREEN_W + SHINE_WIDTH,
      duration: 1100,
      delay: 900,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start();

    // Continuous loops, all native-driver:
    //   • Ring rotation — slow, linear.
    //   • Lockup breath — slow sin.
    const ringLoop = Animated.loop(
      Animated.timing(ringRotation, {
        toValue: 1,
        duration: 6800,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    ringLoop.start();

    const breathLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(lockupBreath, {
          toValue: 1.03,
          duration: 1500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(lockupBreath, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    breathLoop.start();

    return () => {
      ringLoop.stop();
      breathLoop.stop();
    };
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
          duration: 340,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(containerTranslate, {
          toValue: -28,
          duration: 340,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(ringOpacity, {
          toValue: 0,
          duration: 220,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(haloOpacity, {
          toValue: 0,
          duration: 260,
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
  }, [isLoading, containerOpacity, containerTranslate, haloOpacity, ringOpacity, onFinish]);

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
              <Stop offset="0%" stopColor={ClientColors.primary} stopOpacity="0.3" />
              <Stop offset="55%" stopColor={ClientColors.primary} stopOpacity="0.08" />
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
              <Stop offset="55%" stopColor={ClientColors.primary} stopOpacity="0.45" />
              <Stop offset="100%" stopColor={ClientColors.secondary} stopOpacity="0.9" />
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

      <Animated.Image
        source={require('../../assets/alif-lockup.png')}
        resizeMode="contain"
        style={[
          styles.lockup,
          {
            opacity: lockupOpacity,
            transform: [
              { translateY: lockupTranslate },
              { scale: Animated.multiply(lockupScale, lockupBreath) },
            ],
          },
        ]}
      />

      {/* Single "polish" glint — soft white diagonal gradient bar
          sweeps across the screen once, then disappears. */}
      <Animated.View
        style={[
          styles.shine,
          {
            transform: [{ translateX: shineTranslate }, { rotate: '18deg' }],
          },
        ]}
      >
        <Svg width={SHINE_WIDTH} height={SCREEN_H * 1.6}>
          <Defs>
            <LinearGradient id="shineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0" />
              <Stop offset="50%" stopColor="#FFFFFF" stopOpacity="0.55" />
              <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
            </LinearGradient>
          </Defs>
          <Rect
            width={SHINE_WIDTH}
            height={SCREEN_H * 1.6}
            fill="url(#shineGrad)"
          />
        </Svg>
      </Animated.View>
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
    overflow: 'hidden',
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
  shine: {
    position: 'absolute',
    top: -SCREEN_H * 0.3,
    width: SHINE_WIDTH,
    height: SCREEN_H * 1.6,
  },
});
