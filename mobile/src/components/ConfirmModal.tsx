import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { DriverColors } from '../theme/colors';
import { Typography } from '../theme/typography';

interface ConfirmModalProps {
  visible: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
  variant?: 'primary' | 'danger';
}

export default function ConfirmModal({
  visible,
  title,
  message,
  confirmLabel = 'Подтвердить',
  cancelLabel = 'Отмена',
  onConfirm,
  onCancel,
  loading = false,
  variant = 'primary',
}: ConfirmModalProps): React.ReactNode {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={loading ? undefined : onCancel}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {title ? (
            <Text style={[Typography.h3, styles.title]}>{title}</Text>
          ) : null}
          <Text style={[Typography.body, styles.message]}>{message}</Text>

          <View style={styles.buttonsRow}>
            <TouchableOpacity
              onPress={onCancel}
              disabled={loading}
              style={[styles.button, styles.cancelButton]}
              activeOpacity={0.7}
              accessibilityLabel={cancelLabel}
            >
              <Text style={[Typography.button, { color: DriverColors.textSecondary }]}>
                {cancelLabel}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onConfirm}
              disabled={loading}
              style={[
                styles.button,
                styles.confirmButton,
                variant === 'danger' && styles.confirmButtonDanger,
              ]}
              activeOpacity={0.85}
              accessibilityLabel={confirmLabel}
              testID="confirm-modal-confirm"
            >
              {loading ? (
                <ActivityIndicator
                  color={
                    variant === 'danger'
                      ? DriverColors.white
                      : DriverColors.background
                  }
                />
              ) : (
                <Text
                  style={[
                    Typography.button,
                    {
                      color:
                        variant === 'danger'
                          ? DriverColors.white
                          : DriverColors.background,
                    },
                  ]}
                >
                  {confirmLabel}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: DriverColors.cardBackground,
    borderRadius: 18,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 16,
  },
  title: {
    color: DriverColors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    color: DriverColors.textSecondary,
    textAlign: 'center',
    marginBottom: 22,
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    flex: 1,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: DriverColors.border,
  },
  confirmButton: {
    backgroundColor: DriverColors.primary,
  },
  confirmButtonDanger: {
    backgroundColor: DriverColors.danger,
  },
});
