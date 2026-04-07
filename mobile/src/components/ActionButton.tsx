import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { ClientColors } from '../theme/colors';
import { Typography } from '../theme/typography';

interface ActionButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'danger' | 'outline';
  style?: ViewStyle;
}

export default function ActionButton({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  style,
}: ActionButtonProps): React.ReactNode {
  const isDisabled = disabled || loading;

  const bgColor =
    variant === 'primary'
      ? ClientColors.primary
      : variant === 'danger'
        ? ClientColors.danger
        : 'transparent';

  const textColor =
    variant === 'primary'
      ? ClientColors.dark
      : variant === 'danger'
        ? ClientColors.white
        : ClientColors.primary;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={[
        styles.button,
        { backgroundColor: bgColor },
        variant === 'outline' && styles.outline,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={[Typography.button, { color: textColor }]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  outline: {
    borderWidth: 2,
    borderColor: ClientColors.primary,
  },
  disabled: {
    opacity: 0.5,
  },
});
