import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
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

const MIN_HOLD_MS = 1400;
const LOCKUP_WIDTH = 220;
const MARK_HEIGHT = 138;
const HALO_SIZE = 360;
const RING_SIZE = 256;

const BRAND_ORANGE = '#FF7B1A';
const BRAND_VIOLET = '#6C2BD9';
const BRAND_TEAL = '#14B8A6';

/**
 * Brand intro — lightweight Alif lockup with assembly choreography.
 *
 * Performance budget for low-end phones is strict:
 *   • Every continuous animation runs through the native driver.
 *   • The entrance uses only translate / scale / opacity — no
 *     strokeDashoffset, no JS-thread interpolations.
 *   • No sonar pulse (one fewer loop), no per-stroke SVG mounts.
 *   • SVG renders once per element (halo, ring, A-mark) and is then
 *     transformed via wrapping Animated.Views on the GPU.
 *
 * Choreography:
 *   1. A-mark fades + scales in as a single block (300ms).
 *   2. The orange tittle pops in.
 *   3. Wordmark letters slide in from alternating directions with a
 *      70ms stagger — A↓ L↑ I↓ F↑.
 *   4. Halo + slowly rotating orbital ring fade in around the lockup.
 *   5. Continuous: gentle breath on the lockup, ring rotates linearly.
 *   6. Exit fires once auth is ready AND MIN_HOLD_MS has elapsed.
 *
 * Native splash is configured as a solid mint screen (no image) so the
 * lockup arrives via this animation — no jarring "white card" frame.
 */
export default function BrandIntro({ onFinish }: Props): React.ReactNode {
  const { isLoading } = useAuth();

  const containerOpacity = useRef(new Animated.Value(1)).current;
  const containerTranslate = useRef(new Animated.Value(0)).current;

  const markOpacity = useRef(new Animated.Value(0)).current;
  const markScale = useRef(new Animated.Value(0.82)).current;
  const dotOpacity = useRef(new Animated.Value(0)).current;
  const dotScale = useRef(new Animated.Value(0.4)).current;

  const letterA_y = useRef(new Animated.Value(-26)).current;
  const letterA_o = useRef(new Animated.Value(0)).current;
  const letterL_y = useRef(new Animated.Value(26)).current;
  const letterL_o = useRef(new Animated.Value(0)).current;
  const letterI_y = useRef(new Animated.Value(-26)).current;
  const letterI_o = useRef(new Animated.Value(0)).current;
  const letterF_y = useRef(new Animated.Value(26)).current;
  const letterF_o = useRef(new Animated.Value(0)).current;

  const lockupScale = useRef(new Animated.Value(1)).current;
  const haloOpacity = useRef(new Animated.Value(0)).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;
  const ringScale = useRef(new Animated.Value(0.94)).current;
  const ringRotation = useRef(new Animated.Value(0)).current;

  const mountedAtRef = useRef<number>(Date.now());
  const exitedRef = useRef<boolean>(false);

  useEffect(() => {
    // A-mark enters as one block — much cheaper than 3 separate animated
    // SVG paths and still reads as "appearing" because the dot + letters
    // follow with their own choreography.
    Animated.parallel([
      Animated.timing(markOpacity, {
        toValue: 1,
        duration: 380,
        delay: 60,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(markScale, {
        toValue: 1,
        duration: 520,
        delay: 60,
        easing: Easing.out(Easing.back(1.4)),
        useNativeDriver: true,
      }),
    ]).start();

    Animated.parallel([
      Animated.timing(dotOpacity, {
        toValue: 1,
        duration: 220,
        delay: 360,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(dotScale, {
        toValue: 1,
        delay: 360,
        speed: 14,
        bounciness: 10,
        useNativeDriver: true,
      }),
    ]).start();

    // Letters assemble from alternating sides. Pure transform + opacity
    // = 100% native-driver, smooth on low-end devices.
    const slideLetter = (
      y: Animated.Value,
      o: Animated.Value,
      delay: number,
    ): void => {
      Animated.parallel([
        Animated.timing(o, {
          toValue: 1,
          duration: 300,
          delay,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(y, {
          toValue: 0,
          duration: 360,
          delay,
          easing: Easing.out(Easing.back(1.5)),
          useNativeDriver: true,
        }),
      ]).start();
    };
    slideLetter(letterA_y, letterA_o, 480);
    slideLetter(letterL_y, letterL_o, 550);
    slideLetter(letterI_y, letterI_o, 620);
    slideLetter(letterF_y, letterF_o, 690);

    // Ambient halo + ring fade in after the lockup has settled.
    Animated.parallel([
      Animated.timing(haloOpacity, {
        toValue: 1,
        duration: 480,
        delay: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(ringOpacity, {
        toValue: 1,
        duration: 480,
        delay: 460,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(ringScale, {
        toValue: 1,
        duration: 640,
        delay: 460,
        easing: Easing.out(Easing.back(1.3)),
        useNativeDriver: true,
      }),
    ]).start();

    // Two continuous loops, both on the native driver:
    //   • Ring rotation (linear, 6s) — gives "alive" feel.
    //   • Lockup breath — slow sin, 2.8s round trip.
    const ringLoop = Animated.loop(
      Animated.timing(ringRotation, {
        toValue: 1,
        duration: 6000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    ringLoop.start();

    const breathLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(lockupScale, {
          toValue: 1.035,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(lockupScale, {
          toValue: 1,
          duration: 1400,
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
          toValue: -26,
          duration: 340,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(ringOpacity, {
          toValue: 0,
          duration: 200,
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
              <Stop offset="0%" stopColor={ClientColors.primary} stopOpacity="0.28" />
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
              <Stop offset="55%" stopColor={ClientColors.primary} stopOpacity="0.5" />
              <Stop offset="100%" stopColor={ClientColors.secondary} stopOpacity="0.95" />
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

      <Animated.View
        style={[styles.lockup, { transform: [{ scale: lockupScale }] }]}
      >
        <Animated.View
          style={{
            opacity: markOpacity,
            transform: [{ scale: markScale }],
          }}
        >
          <Svg width={LOCKUP_WIDTH} height={MARK_HEIGHT} viewBox="0 0 200 138">
            <Path
              d="M 42 130 L 100 28"
              stroke={BRAND_ORANGE}
              strokeWidth={20}
              strokeLinecap="round"
              fill="none"
            />
            <Path
              d="M 100 28 L 100 130"
              stroke={BRAND_VIOLET}
              strokeWidth={20}
              strokeLinecap="round"
              fill="none"
            />
            <Path
              d="M 100 28 L 158 130"
              stroke={BRAND_TEAL}
              strokeWidth={20}
              strokeLinecap="round"
              fill="none"
            />
          </Svg>
        </Animated.View>

        <Animated.View
          style={[
            styles.dot,
            {
              opacity: dotOpacity,
              transform: [{ scale: dotScale }],
            },
          ]}
        />

        <View style={styles.wordmark}>
          <Animated.Text
            style={[
              styles.letter,
              { color: BRAND_VIOLET, opacity: letterA_o, transform: [{ translateY: letterA_y }] },
            ]}
          >
            A
          </Animated.Text>
          <Animated.Text
            style={[
              styles.letter,
              { color: BRAND_VIOLET, opacity: letterL_o, transform: [{ translateY: letterL_y }] },
            ]}
          >
            L
          </Animated.Text>
          <Animated.Text
            style={[
              styles.letter,
              { color: BRAND_TEAL, opacity: letterI_o, transform: [{ translateY: letterI_y }] },
            ]}
          >
            I
          </Animated.Text>
          <Animated.Text
            style={[
              styles.letter,
              { color: BRAND_ORANGE, opacity: letterF_o, transform: [{ translateY: letterF_y }] },
            ]}
          >
            F
          </Animated.Text>
        </View>
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
  },
  absoluteCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockup: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    position: 'absolute',
    top: MARK_HEIGHT * 0.78,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: BRAND_ORANGE,
  },
  wordmark: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  letter: {
    fontSize: 44,
    fontWeight: '900' as const,
    letterSpacing: 2,
    marginHorizontal: 2,
  },
});
