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
  const [savingName, setSavingName] = useState<boolean>(false);

  const [showPhoneFlow, setShowPhoneFlow] = useState<boolean>(false);
  const [newPhone, setNewPhone] = useState<string>('');
  const [otpSent, setOtpSent] = useState<boolean>(false);
  const [otpCode, setOtpCode] = useState<string>('');
  const [sendingOtp, setSendingOtp] = useState<boolean>(false);
  const [verifyingPhone, setVerifyingPhone] = useState<boolean>(false);

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
    setSendingOtp(true);
    try {
      await sendChangePhoneOtp(newPhone.trim());
      setOtpSent(true);
    } catch {
      Alert.alert('Ошибка', 'Не удалось отправить код');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyPhone = async (): Promise<void> => {
    if (otpCode.length !== OTP_LENGTH) {
      Alert.alert('Ошибка', `Введите ${OTP_LENGTH}-значный код`);
      return;
    }
    setVerifyingPhone(true);
    try {
      await verifyChangePhone(newPhone.trim(), otpCode);
      await refreshUser();
      Alert.alert('Успешно', 'Номер телефона изменён');
      setShowPhoneFlow(false);
      setNewPhone('');
      setOtpSent(false);
      setOtpCode('');
    } catch {
      Alert.alert('Ошибка', 'Неверный код');
    } finally {
      setVerifyingPhone(false);
    }
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

        {/* Name Section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Имя</Text>
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
        </View>

        {/* Phone Section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Телефон</Text>
          <Text style={[Typography.body, { color: ClientColors.textPrimary, marginBottom: 12 }]}>
            {user?.phone ?? ''}
          </Text>

          {!showPhoneFlow ? (
            <TouchableOpacity
              style={styles.outlineButton}
              onPress={() => setShowPhoneFlow(true)}
            >
              <Text style={styles.outlineButtonText}>Изменить номер</Text>
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
                  style={[styles.primaryButton, sendingOtp && styles.buttonDisabled]}
                  onPress={handleSendOtp}
                  disabled={sendingOtp}
                >
                  {sendingOtp ? (
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
                    style={[styles.primaryButton, verifyingPhone && styles.buttonDisabled]}
                    onPress={handleVerifyPhone}
                    disabled={verifyingPhone}
                  >
                    {verifyingPhone ? (
                      <ActivityIndicator color={ClientColors.dark} />
                    ) : (
                      <Text style={styles.primaryButtonText}>Подтвердить</Text>
                    )}
                  </TouchableOpacity>
                </>
              )}

              <TouchableOpacity
                style={styles.outlineButton}
                onPress={() => {
                  setShowPhoneFlow(false);
                  setNewPhone('');
                  setOtpSent(false);
                  setOtpCode('');
                }}
              >
                <Text style={styles.outlineButtonText}>Отмена</Text>
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
  section: {
    backgroundColor: ClientColors.cardBackground,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  sectionLabel: {
    ...Typography.caption,
    color: ClientColors.textSecondary,
    marginBottom: 8,
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
  outlineButton: {
    borderWidth: 1.5,
    borderColor: ClientColors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  outlineButtonText: {
    ...Typography.button,
    color: ClientColors.primaryDark,
  },
  phoneFlow: {
    gap: 12,
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
