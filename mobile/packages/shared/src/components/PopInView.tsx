import React, { useEffect, useRef } from 'react';
import { Animated, Easing, ViewProps } from 'react-native';

interface PopInViewProps extends ViewProps {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  fromScale?: number;
}

// Spring-pop с лёгким overshoot — используется для подтверждающих
// модалок и success-карточек. Не для списков (там FadeInView).
export default function PopInView({
  children,
  style,
  delay = 0,
  duration = 380,
  fromScale = 0.92,
  ...rest
}: PopInViewProps): React.ReactNode {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(fromScale)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: Math.round(duration * 0.7),
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        delay,
        damping: 14,
        stiffness: 170,
        mass: 0.9,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, scale, duration, delay]);

  return (
    <Animated.View
      {...rest}
      style={[style, { opacity, transform: [{ scale }] }]}
    >
      {children}
    </Animated.View>
  );
}
