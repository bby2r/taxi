import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useAuth,
  updateClientProfile,
  sendChangePhoneOtp,
  verifyChangePhone,
  ClientColors,
  Radius,
  Spacing,
  Typography,
  OTP_LENGTH,
} from '@taxi/shared';
import Icon from '../components/Icon';

export default function ProfileScreen(): React.ReactNode {
  const { user, logout, refreshUser } = useAuth();

  const [name, setName] = useState<string>(user?.name ?? '');
  const [savingName, setSavingName] = useState(false);

  const [showPhoneFlow, setShowPhoneFlow] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [phoneLoading, setPhoneLoading] = useState(false);

  const handleSaveName = async (): Promise<void> => {
    if (!name.trim()) {
      Alert.alert('Ошибка', 'Введите имя');
      return;
    }
    setSavingName(true);
    try {
      await updateClientProfile(name.trim());
      await refreshUser();
      Alert.alert('Успешно', 'Имя обновлено');
    } catch {
      Alert.alert('Ошибка', 'Не удалось сохранить имя');
    } finally {
      setSavingName(false);
    }
  };

  const handleSendOtp = async (): Promise<void> => {
    if (!newPhone.trim()) {
      Alert.alert('Ошибка', 'Введите номер телефона');
      return;
    }
    setPhoneLoading(true);
    try {
      await sendChangePhoneOtp(newPhone.trim());
      setOtpSent(true);
    } catch {
      Alert.alert('Ошибка', 'Не удалось отправить код');
    } finally {
      setPhoneLoading(false);
    }
  };

  const handleVerifyPhone = async (): Promise<void> => {
    if (otpCode.length !== OTP_LENGTH) {
      Alert.alert('Ошибка', `Введите ${OTP_LENGTH}-значный код`);
      return;
    }
    setPhoneLoading(true);
    try {
      await verifyChangePhone(newPhone.trim(), otpCode);
      await refreshUser();
      Alert.alert('Успешно', 'Номер телефона изменён');
      resetPhoneFlow();
    } catch {
      Alert.alert('Ошибка', 'Неверный код');
    } finally {
      setPhoneLoading(false);
    }
  };

  const resetPhoneFlow = (): void => {
    setShowPhoneFlow(false);
    setNewPhone('');
    setOtpSent(false);
    setOtpCode('');
  };

  const handleLogout = (): void => {
    Alert.alert('Выйти', 'Вы уверены, что хотите выйти?', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Выйти', style: 'destructive', onPress: () => logout() },
    ]);
  };

  const initial = (user?.name ?? '?').charAt(0).toUpperCase();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.header}>Профиль</Text>

        {/* Avatar */}
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
        </View>

        {/* Form Card */}
        <View style={styles.card}>
          {/* Name */}
          <Text style={styles.fieldLabel}>Имя</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Ваше имя"
            placeholderTextColor={ClientColors.textMuted}
            autoCapitalize="words"
          />
          <TouchableOpacity
            style={[styles.primaryButton, savingName && styles.buttonDisabled]}
            onPress={handleSaveName}
            disabled={savingName}
            accessibilityRole="button"
            accessibilityLabel="Сохранить имя"
            accessibilityState={{ disabled: savingName, busy: savingName }}
          >
            {savingName ? (
              <ActivityIndicator color={ClientColors.dark} />
            ) : (
              <Text style={styles.primaryButtonText}>Сохранить</Text>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Phone (read-only) */}
          <Text style={styles.fieldLabel}>Номер телефона</Text>
          <TextInput
            style={[styles.input, styles.inputReadonly]}
            value={user?.phone ?? ''}
            editable={false}
          />

          {!showPhoneFlow ? (
            <TouchableOpacity
              style={styles.changePhoneButton}
              onPress={() => setShowPhoneFlow(true)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Изменить номер телефона"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.changePhoneButtonText}>Изменить номер телефона</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.phoneFlow}>
              <TextInput
                style={styles.input}
                value={newPhone}
                onChangeText={setNewPhone}
                placeholder="Новый номер телефона"
                placeholderTextColor={ClientColors.textMuted}
                keyboardType="phone-pad"
                editable={!otpSent}
              />

              {!otpSent ? (
                <TouchableOpacity
                  style={[styles.primaryButton, phoneLoading && styles.buttonDisabled]}
                  onPress={handleSendOtp}
                  disabled={phoneLoading}
                >
                  {phoneLoading ? (
                    <ActivityIndicator color={ClientColors.dark} />
                  ) : (
                    <Text style={styles.primaryButtonText}>Отправить код</Text>
                  )}
                </TouchableOpacity>
              ) : (
                <>
                  <TextInput
                    style={styles.input}
                    value={otpCode}
                    onChangeText={setOtpCode}
                    placeholder={`${OTP_LENGTH}-значный код`}
                    placeholderTextColor={ClientColors.textMuted}
                    keyboardType="number-pad"
                    maxLength={OTP_LENGTH}
                  />
                  <TouchableOpacity
                    style={[styles.primaryButton, phoneLoading && styles.buttonDisabled]}
                    onPress={handleVerifyPhone}
                    disabled={phoneLoading}
                  >
                    {phoneLoading ? (
                      <ActivityIndicator color={ClientColors.dark} />
                    ) : (
                      <Text style={styles.primaryButtonText}>Подтвердить</Text>
                    )}
                  </TouchableOpacity>
                </>
              )}

              <TouchableOpacity style={styles.cancelButton} onPress={resetPhoneFlow}>
                <Text style={styles.cancelButtonText}>Отмена</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Action rows — icon + label + chevron, native-app-feel
            list rather than a stack of buttons. */}
        <View style={styles.menuCard}>
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() =>
              Linking.openURL(
                'https://wa.me/996509397226?text=' +
                  encodeURIComponent(
                    'Здравствуйте, нужна помощь по приложению Alif Taxi.',
                  ),
              )
            }
            activeOpacity={0.7}
            accessibilityRole="link"
            accessibilityLabel="Открыть поддержку в WhatsApp, плюс 996 509 397 226"
          >
            <View style={[styles.menuIconBox, { backgroundColor: ClientColors.primaryTint }]}>
              <Icon name="message" size={20} color={ClientColors.primaryDark} strokeWidth={2.2} />
            </View>
            <View style={styles.menuRowText}>
              <Text style={styles.menuLabel}>Поддержка в WhatsApp</Text>
              <Text style={styles.menuMeta}>+996 509 397 226</Text>
            </View>
            <Icon name="chevron-right" size={20} color={ClientColors.textMuted} strokeWidth={2.2} />
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => Linking.openURL('https://taxi-api-cy7a.onrender.com/privacy')}
            activeOpacity={0.7}
            accessibilityRole="link"
            accessibilityLabel="Открыть политику конфиденциальности"
          >
            <View style={[styles.menuIconBox, { backgroundColor: ClientColors.surfaceMuted }]}>
              <Icon name="shield" size={20} color={ClientColors.darkSecondary} strokeWidth={2.2} />
            </View>
            <View style={styles.menuRowText}>
              <Text style={styles.menuLabel}>Политика конфиденциальности</Text>
            </View>
            <Icon name="chevron-right" size={20} color={ClientColors.textMuted} strokeWidth={2.2} />
          </TouchableOpacity>
        </View>

        {/* Logout — destructive action set apart visually */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Выйти из аккаунта"
        >
          <Icon name="logout" size={18} color={ClientColors.danger} strokeWidth={2.2} />
          <Text style={styles.logoutButtonText}>Выйти из аккаунта</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ClientColors.background,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.huge,
  },
  header: {
    ...Typography.h2,
    color: ClientColors.dark,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: Spacing.xxxl,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: ClientColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    ...Typography.h1,
    color: ClientColors.white,
  },
  card: {
    backgroundColor: ClientColors.cardBackground,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  fieldLabel: {
    ...Typography.caption,
    color: ClientColors.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    ...Typography.body,
    color: ClientColors.textPrimary,
    backgroundColor: ClientColors.background,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: ClientColors.border,
    marginBottom: Spacing.md,
  },
  inputReadonly: {
    color: ClientColors.textSecondary,
    backgroundColor: ClientColors.background,
  },
  primaryButton: {
    backgroundColor: ClientColors.primary,
    borderRadius: Radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    ...Typography.button,
    color: ClientColors.dark,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  divider: {
    height: 1,
    backgroundColor: ClientColors.border,
    marginVertical: Spacing.xl,
  },
  changePhoneButton: {
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  changePhoneButtonText: {
    ...Typography.caption,
    color: ClientColors.textMuted,
    fontSize: 13,
  },
  phoneFlow: {
    gap: Spacing.md,
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: ClientColors.border,
    borderRadius: Radius.md,
    paddingVertical: 10,
    alignItems: 'center',
  },
  cancelButtonText: {
    ...Typography.caption,
    color: ClientColors.textSecondary,
    fontSize: 13,
  },
  menuCard: {
    backgroundColor: ClientColors.cardBackground,
    borderRadius: 18,
    marginTop: Spacing.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: ClientColors.border,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 14,
  },
  menuIconBox: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuRowText: {
    flex: 1,
  },
  menuLabel: {
    ...Typography.bodyBold,
    color: ClientColors.textPrimary,
    fontSize: 15,
  },
  menuMeta: {
    fontSize: 13,
    color: ClientColors.primary,
    marginTop: 2,
  },
  menuDivider: {
    height: 1,
    backgroundColor: ClientColors.border,
    marginLeft: 68,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: ClientColors.dangerBorder,
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: Spacing.xl,
  },
  logoutButtonText: {
    color: ClientColors.danger,
    fontSize: 15,
    fontWeight: '700' as const,
  },
});
