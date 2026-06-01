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
// Native splash на Android 12+ принудительно вписывает картинку в
// круглую маску 192dp. Поэтому в app.json `imageWidth: 130` — лого на
// native splash рендерится 130dp шириной без обрезки. BrandIntro
// стартует лого в том же размере (scale = 130/230 ≈ 0.565) и плавно
// масштабирует до полного 230dp — handoff без «прыжка» по размеру.
const LOCKUP_INITIAL_SCALE = 130 / LOCKUP_WIDTH;

/**
 * Brand intro — optimised for low-end Android phones.
 *
 * Seamless handoff with the native Expo splash: native splash renders
 * the lockup at 130dp (the max that fits inside Android 12+'s circular
 * splash mask without clipping), and BrandIntro starts the lockup at
 * that same scale, then animates up to full 230dp width. Halo + ring
 * fade in around it.
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
  const lockupScale = useRef(new Animated.Value(LOCKUP_INITIAL_SCALE)).current;

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
      // Лого «вырастает» с native-splash размера (130dp) до полного
      // 230dp — handoff без видимого прыжка по размеру.
      Animated.timing(lockupScale, {
        toValue: 1,
        duration: 700,
        delay: 80,
        easing: Easing.out(Easing.cubic),
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

      {/* Лого стартует в размере native splash (130dp ≈ scale 0.565) и
          плавно растёт до полного 230dp. Это превращает обязательный
          размерный gap Android 12+ в полированную «бренд-распаковку». */}
      <Animated.Image
        source={require('../../assets/alif-lockup.png')}
        resizeMode="contain"
        style={[styles.lockup, { transform: [{ scale: lockupScale }] }]}
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
