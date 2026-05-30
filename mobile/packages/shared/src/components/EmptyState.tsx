import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { ClientColors } from '../theme/colors';
import { Radius, Spacing } from '../theme/spacing';

interface Props {
  /** Pre-rendered icon node — caller decides the icon library and size. */
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  /** Footer slot — e.g. a retry button or action. */
  action?: React.ReactNode;
  style?: ViewStyle;
  /**
   * Tints the icon container with the primary tint background.
   * Defaults to true for happy/info empty states; pass false for a flat look.
   */
  iconBoxed?: boolean;
}

export default function EmptyState({
  icon,
  title,
  subtitle,
  action,
  style,
  iconBoxed = true,
}: Props): React.ReactNode {
  return (
    <View style={[styles.container, style]}>
      {icon && (
        <View style={iconBoxed ? styles.iconBox : styles.iconFlat}>{icon}</View>
      )}
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      {action && <View style={styles.action}>{action}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingHorizontal: Spacing.xxxl,
    paddingVertical: Spacing.huge,
  },
  iconBox: {
    width: 96,
    height: 96,
    borderRadius: Radius.xxl,
    backgroundColor: ClientColors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  iconFlat: {
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: ClientColors.dark,
    textAlign: 'center',
    marginBottom: Spacing.sm,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 14,
    color: ClientColors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  action: {
    marginTop: Spacing.lg,
  },
});
