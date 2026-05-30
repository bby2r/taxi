import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { ClientColors } from '../theme/colors';
import { Radius } from '../theme/spacing';
import { Typography } from '../theme/typography';

type Variant = 'primary' | 'secondary' | 'danger' | 'outline' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

interface ActionButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: Variant;
  size?: Size;
  /** Optional leading element (e.g. icon). Rendered inside the button left of the label. */
  leading?: React.ReactNode;
  style?: ViewStyle;
}

const SIZE_HEIGHT: Record<Size, number> = {
  sm: 44,
  md: 54,
  lg: 60,
};

export default function ActionButton({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  size = 'md',
  leading,
  style,
}: ActionButtonProps): React.ReactNode {
  const isDisabled = disabled || loading;

  const bgColor =
    variant === 'primary'
      ? ClientColors.primary
      : variant === 'secondary'
        ? ClientColors.secondaryTint
        : variant === 'danger'
          ? ClientColors.danger
          : 'transparent';

  const textColor =
    variant === 'primary' || variant === 'danger'
      ? ClientColors.white
      : variant === 'secondary'
        ? ClientColors.secondaryDark
        : ClientColors.primary;

  const labelStyle = size === 'lg' ? Typography.buttonLarge : Typography.button;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={[
        styles.button,
        { height: SIZE_HEIGHT[size], backgroundColor: bgColor },
        variant === 'outline' && styles.outline,
        variant === 'primary' && styles.primaryShadow,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <>
          {leading}
          <Text style={[labelStyle, { color: textColor }]}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: Radius.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 24,
  },
  outline: {
    borderWidth: 1.5,
    borderColor: ClientColors.primary,
  },
  primaryShadow: {
    shadowColor: ClientColors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  disabled: {
    opacity: 0.5,
    shadowOpacity: 0,
  },
});
