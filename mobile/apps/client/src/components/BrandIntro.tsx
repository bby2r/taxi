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

const MIN_HOLD_MS = 1200;
const LOGO_SIZE = 220;
const HALO_SIZE = 380;
const RING_SIZE = 268;
const PULSE_SIZE = 200;

/**
 * Brand intro choreographed around the Alif lockup.
 *
 * Layers (back → front): solid background, soft radial halo, slowly
 * rotating orbital arc with a leading dot, a sonar-style pulse ring,
 * and the lockup itself with a gentle breath. Decorations start at
 * opacity 0 so frame zero is pixel-identical to the Expo native
 * splash — the handoff stays invisible, the life arrives a beat later.
 *
 * Exit fires once AuthProvider's first profile fetch is done AND
 * MIN_HOLD_MS has elapsed since mount. No visible loading gap.
 */
export default function BrandIntro({ onFinish }: Props): React.ReactNode {
  const { isLoading } = useAuth();

  const containerOpacity = useRef(new Animated.Value(1)).current;
  const containerTranslate = useRef(new Animated.Value(0)).current;

  const logoScale = useRef(new Animated.Value(1)).current;
  const haloOpacity = useRef(new Animated.Value(0)).current;
  const haloScale = useRef(new Animated.Value(0.86)).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;
  const ringScale = useRef(new Animated.Value(0.92)).current;
  const ringRotation = useRef(new Animated.Value(0)).current;
  const pulseProgress = useRef(new Animated.Value(0)).current;

  const mountedAtRef = useRef<number>(Date.now());
  const exitedRef = useRef<boolean>(false);

  useEffect(() => {
    // Entrance: halo and ring fade in over the lockup, slightly staggered.
    const entrance = Animated.parallel([
      Animated.timing(haloOpacity, {
        toValue: 1,
        duration: 560,
        delay: 80,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(haloScale, {
        toValue: 1,
        duration: 760,
        delay: 80,
        easing: Easing.out(Easing.back(1.2)),
        useNativeDriver: true,
      }),
      Animated.timing(ringOpacity, {
        toValue: 1,
        duration: 520,
        delay: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(ringScale, {
        toValue: 1,
        duration: 760,
        delay: 220,
        easing: Easing.out(Easing.back(1.4)),
        useNativeDriver: true,
      }),
    ]);
    entrance.start();

    // Orbital ring: continuous rotation reads as "alive, working".
    const ringLoop = Animated.loop(
      Animated.timing(ringRotation, {
        toValue: 1,
        duration: 5200,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    ringLoop.start();

    // Gentle breath on the lockup — slow sine for "calm", not "anxious".
    const breathLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(logoScale, {
          toValue: 1.045,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(logoScale, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    breathLoop.start();

    // Sonar pulse — single phase, slow cadence, emanates from logo center.
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseProgress, {
          toValue: 1,
          duration: 1800,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(pulseProgress, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );
    pulseLoop.start();

    return () => {
      ringLoop.stop();
      breathLoop.stop();
      pulseLoop.stop();
    };
    // Animated.Value refs are stable — no deps needed.
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
          duration: 360,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(containerTranslate, {
          toValue: -28,
          duration: 360,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        // Decorations dim a touch earlier than the lockup so the
        // logo is the last thing the eye sees before the home screen.
        Animated.timing(ringOpacity, {
          toValue: 0,
          duration: 220,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(haloOpacity, {
          toValue: 0,
          duration: 280,
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
  const pulseScale = pulseProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.6, 1.55],
  });
  const pulseOpacity = pulseProgress.interpolate({
    inputRange: [0, 0.15, 1],
    outputRange: [0, 0.45, 0],
  });
  const haloBreath = pulseProgress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 1.04, 1],
  });

  // Orbital ring geometry — arc spans 260° leaving a 100° gap; the
  // gap rotating around the logo is what reads as the "sweep".
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
      {/* Soft radial halo — gives the lockup a warm "lit-from-behind" feel. */}
      <Animated.View
        style={[
          styles.absoluteCenter,
          {
            width: HALO_SIZE,
            height: HALO_SIZE,
            opacity: haloOpacity,
            transform: [{ scale: Animated.multiply(haloScale, haloBreath) }],
          },
        ]}
      >
        <Svg width={HALO_SIZE} height={HALO_SIZE}>
          <Defs>
            <RadialGradient id="haloGrad" cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0%" stopColor={ClientColors.primary} stopOpacity="0.32" />
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

      {/* Sonar pulse — expanding ring, single phase, slow cadence. */}
      <Animated.View
        style={[
          styles.absoluteCenter,
          styles.pulse,
          {
            width: PULSE_SIZE,
            height: PULSE_SIZE,
            borderRadius: PULSE_SIZE / 2,
            opacity: pulseOpacity,
            transform: [{ scale: pulseScale }],
          },
        ]}
      />

      {/* Orbital ring with gradient stroke + leading dot. Rotation
          continues until the exit dims it out. */}
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
              <Stop offset="55%" stopColor={ClientColors.primary} stopOpacity="0.55" />
              <Stop offset="100%" stopColor={ClientColors.secondary} stopOpacity="1" />
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

      {/* The lockup itself — same artwork and position as the native
          Expo splash, so frame zero is a pixel-identical handoff. */}
      <Animated.Image
        source={require('../../assets/splash-icon.png')}
        style={[styles.logo, { transform: [{ scale: logoScale }] }]}
        resizeMode="contain"
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
  pulse: {
    borderWidth: 1.5,
    borderColor: ClientColors.primary,
  },
  logo: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
  },
});
