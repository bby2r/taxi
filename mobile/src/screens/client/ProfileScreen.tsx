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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { updateClientProfile, sendChangePhoneOtp, verifyChangePhone } from '../../api/profile';
import { ClientColors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { OTP_LENGTH } from '../../utils/constants';

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

        {/* Logout */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Выйти</Text>
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
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  header: {
    ...Typography.h2,
    color: ClientColors.dark,
    paddingTop: 12,
    paddingBottom: 24,
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 32,
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
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
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
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: ClientColors.border,
    marginBottom: 12,
  },
  inputReadonly: {
    color: ClientColors.textSecondary,
    backgroundColor: ClientColors.background,
  },
  primaryButton: {
    backgroundColor: ClientColors.primary,
    borderRadius: 12,
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
    marginVertical: 20,
  },
  changePhoneButton: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  changePhoneButtonText: {
    ...Typography.caption,
    color: ClientColors.textMuted,
    fontSize: 13,
  },
  phoneFlow: {
    gap: 12,
  },
  cancelButton: {
    borderWidth: 1.5,
    borderColor: ClientColors.border,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  cancelButtonText: {
    ...Typography.caption,
    color: ClientColors.textSecondary,
    fontSize: 13,
  },
  logoutButton: {
    backgroundColor: ClientColors.danger,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  logoutButtonText: {
    ...Typography.button,
    color: ClientColors.white,
  },
});
