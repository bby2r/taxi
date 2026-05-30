import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ClientColors } from '../theme/colors';
import { Radius, Spacing } from '../theme/spacing';
import { Typography } from '../theme/typography';

interface Props {
  message: string;
  leading?: React.ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
}

export default function ErrorPill({
  message,
  leading,
  onRetry,
  retryLabel = 'Повторить',
}: Props): React.ReactNode {
  return (
    <View style={styles.pill} accessibilityRole="alert">
      {leading}
      <Text style={[Typography.caption, styles.text]}>{message}</Text>
      {onRetry && (
        <TouchableOpacity onPress={onRetry} hitSlop={8} activeOpacity={0.7}>
          <Text style={styles.retry}>{retryLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ClientColors.dangerTint,
    borderColor: ClientColors.dangerBorder,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    marginBottom: Spacing.md,
    gap: 10,
  },
  text: {
    color: ClientColors.danger,
    flex: 1,
  },
  retry: {
    color: ClientColors.danger,
    fontWeight: '700',
    fontSize: 13,
  },
});
