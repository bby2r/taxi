import React, { useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  Animated,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { DriverColors, Typography } from '@taxi/shared';

interface OnlineToggleProps {
  isOnline: boolean;
  onToggle: () => void;
  loading?: boolean;
}

export default function OnlineToggle({
  isOnline,
  onToggle,
  loading = false,
}: OnlineToggleProps): React.ReactNode {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = (): void => {
    Animated.timing(scaleAnim, {
      toValue: 0.95,
      duration: 100,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = (): void => {
    Animated.timing(scaleAnim, {
      toValue: 1,
      duration: 100,
      useNativeDriver: true,
    }).start();
  };

  return (
    <View style={styles.wrapper}>
      <Pressable
        onPress={onToggle}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={loading}
        accessibilityRole="switch"
        accessibilityState={{ checked: isOnline }}
        accessibilityLabel={isOnline ? 'На линии' : 'Не на линии'}
      >
        <Animated.View
          style={[
            styles.circle,
            isOnline ? styles.circleOnline : styles.circleOffline,
            { transform: [{ scale: scaleAnim }] },
          ]}
        >
          {loading ? (
            <ActivityIndicator
              size="large"
              color={isOnline ? DriverColors.background : DriverColors.textMuted}
            />
          ) : (
            <Text
              style={[
                Typography.h1,
                isOnline
                  ? { color: DriverColors.background }
                  : { color: DriverColors.textMuted },
              ]}
            >
              {isOnline ? 'ON' : 'OFF'}
            </Text>
          )}
        </Animated.View>
      </Pressable>
      <Text
        style={[
          Typography.body,
          styles.label,
          { color: isOnline ? DriverColors.primary : DriverColors.textMuted },
        ]}
      >
        {isOnline ? 'На линии' : 'Не на линии'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
  },
  circle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  circleOnline: {
    backgroundColor: DriverColors.primary,
  },
  circleOffline: {
    backgroundColor: DriverColors.cardBackground,
    borderWidth: 2,
    borderColor: DriverColors.border,
  },
  label: {
    marginTop: 16,
  },
});
