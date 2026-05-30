import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { ClientColors, Spacing } from '@taxi/shared';

interface Props {
  onFinish: () => void;
}

/**
 * Brand intro shown once per cold start. Native splash hands off
 * to React, this component fades over the first frame so there is
 * no visible "ActivityIndicator" gap between the launch image and
 * the app. ~1.3s total: scale-in badge → glow pulse → fade out up.
 *
 * Lives in client/components rather than shared because the Driver
 * app gets its own brand moment in a darker treatment.
 */
export default function BrandIntro({ onFinish }: Props): React.ReactNode {
  const containerOpacity = useRef(new Animated.Value(1)).current;
  const containerTranslate = useRef(new Animated.Value(0)).current;

  // Badge: scale + opacity for the entry pop.
  const badgeScale = useRef(new Animated.Value(0.6)).current;
  const badgeOpacity = useRef(new Animated.Value(0)).current;

  // Glow halo: independent pulse behind the badge.
  const glowScale = useRef(new Animated.Value(0.6)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;

  // Wordmark slides up and fades in slightly after the badge lands —
  // the eye reads the badge first, then the wordmark anchors the brand.
  const wordmarkOpacity = useRef(new Animated.Value(0)).current;
  const wordmarkTranslate = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(badgeScale, {
          toValue: 1,
          damping: 12,
          stiffness: 180,
          mass: 0.9,
          useNativeDriver: true,
        }),
        Animated.timing(badgeOpacity, {
          toValue: 1,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(120),
          Animated.parallel([
            Animated.timing(glowScale, {
              toValue: 1.6,
              duration: 700,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.sequence([
              Animated.timing(glowOpacity, {
                toValue: 0.55,
                duration: 220,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
              }),
              Animated.timing(glowOpacity, {
                toValue: 0,
                duration: 500,
                easing: Easing.in(Easing.cubic),
                useNativeDriver: true,
              }),
            ]),
          ]),
        ]),
        Animated.sequence([
          Animated.delay(220),
          Animated.parallel([
            Animated.timing(wordmarkOpacity, {
              toValue: 1,
              duration: 320,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.timing(wordmarkTranslate, {
              toValue: 0,
              duration: 320,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
          ]),
        ]),
      ]),
      Animated.delay(280),
      Animated.parallel([
        Animated.timing(containerOpacity, {
          toValue: 0,
          duration: 280,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(containerTranslate, {
          toValue: -24,
          duration: 280,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]).start(({ finished }) => {
      if (finished) {
        onFinish();
      }
    });
  }, [
    badgeScale,
    badgeOpacity,
    glowScale,
    glowOpacity,
    wordmarkOpacity,
    wordmarkTranslate,
    containerOpacity,
    containerTranslate,
    onFinish,
  ]);

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
      <View style={styles.badgeStack}>
        <Animated.View
          style={[
            styles.glow,
            {
              opacity: glowOpacity,
              transform: [{ scale: glowScale }],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.badge,
            {
              opacity: badgeOpacity,
              transform: [{ scale: badgeScale }],
            },
          ]}
        >
          <Text style={styles.badgeLetter}>A</Text>
        </Animated.View>
      </View>

      <Animated.Text
        style={[
          styles.wordmark,
          {
            opacity: wordmarkOpacity,
            transform: [{ translateY: wordmarkTranslate }],
          },
        ]}
      >
        Alif Taxi
      </Animated.Text>
      <Animated.Text
        style={[
          styles.tagline,
          {
            opacity: wordmarkOpacity,
            transform: [{ translateY: wordmarkTranslate }],
          },
        ]}
      >
        В село и до города за пару минут
      </Animated.Text>
    </Animated.View>
  );
}

const BADGE_SIZE = 104;

const styles = StyleSheet.create({
  container: {
    backgroundColor: ClientColors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeStack: {
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  glow: {
    position: 'absolute',
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: BADGE_SIZE / 2,
    backgroundColor: ClientColors.primary,
  },
  badge: {
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: 30,
    backgroundColor: ClientColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: ClientColors.primary,
    shadowOpacity: 0.45,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 14,
    transform: [{ rotate: '-6deg' }],
  },
  badgeLetter: {
    color: ClientColors.white,
    fontSize: 56,
    fontWeight: '800',
    letterSpacing: -2,
    // Visual centring: the optical centre of "A" sits slightly above
    // its bounding box centre, so nudge it down a hair.
    marginTop: 4,
    transform: [{ rotate: '6deg' }],
  },
  wordmark: {
    fontSize: 32,
    fontWeight: '700',
    color: ClientColors.dark,
    letterSpacing: -0.6,
  },
  tagline: {
    fontSize: 14,
    color: ClientColors.textSecondary,
    marginTop: Spacing.sm,
    textAlign: 'center',
    paddingHorizontal: Spacing.xxl,
  },
});
