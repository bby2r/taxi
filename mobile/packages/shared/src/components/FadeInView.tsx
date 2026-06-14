import React, { useEffect, useRef } from 'react';
import { Animated, Easing, ViewProps } from 'react-native';

interface FadeInViewProps extends ViewProps {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  translateY?: number;
}

// Premium ease curve close to Material Standard / iOS default — мягкое
// замедление в конце, не «компьютерное» Easing.linear. Используем для всех
// маунт-анимаций в клиенте, чтобы был один визуальный почерк.
const PREMIUM_EASE = Easing.bezier(0.16, 1, 0.3, 1);

export default function FadeInView({
  children,
  style,
  delay = 0,
  duration = 340,
  translateY = 12,
  ...rest
}: FadeInViewProps): React.ReactNode {
  const opacity = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(translateY)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        delay,
        easing: PREMIUM_EASE,
        useNativeDriver: true,
      }),
      Animated.timing(ty, {
        toValue: 0,
        duration,
        delay,
        easing: PREMIUM_EASE,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, ty, duration, delay]);

  return (
    <Animated.View
      {...rest}
      style={[style, { opacity, transform: [{ translateY: ty }] }]}
    >
      {children}
    </Animated.View>
  );
}
