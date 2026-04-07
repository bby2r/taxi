import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/types';
import { ClientColors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import OtpInput from '../../components/OtpInput';
import { useAuth } from '../../context/AuthContext';
import { sendOtp, verifyOtp } from '../../api/auth';
import { OTP_RESEND_DELAY_SECONDS } from '../../utils/constants';

type Props = NativeStackScreenProps<AuthStackParamList, 'OtpVerify'>;

export default function OtpVerifyScreen({ navigation, route }: Props): React.ReactNode {
  const { phone } = route.params;
  const { login } = useAuth();

  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [timer, setTimer] = useState(OTP_RESEND_DELAY_SECONDS);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (timer <= 0) {
      return;
    }
    const interval = setInterval(() => {
      setTimer((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [timer]);

  const handleOtpComplete = useCallback(
    async (code: string) => {
      setError(false);
      setErrorMessage('');

      try {
        const response = await verifyOtp(phone, code);
        await login(response.token, response.user);
      } catch (err: unknown) {
        setError(true);
        const message =
          err instanceof Error ? err.message : 'Неверный код';
        setErrorMessage(message);
      }
    },
    [phone, login],
  );

  const handleResend = useCallback(async () => {
    if (timer > 0 || resending) {
      return;
    }

    setResending(true);
    setError(false);
    setErrorMessage('');

    try {
      await sendOtp(phone);
      setTimer(OTP_RESEND_DELAY_SECONDS);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Не удалось отправить код';
      setErrorMessage(message);
    } finally {
      setResending(false);
    }
  }, [phone, timer, resending]);

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Назад"
        >
          <Text style={styles.backText}>{'<'}</Text>
        </TouchableOpacity>

        <View style={styles.content}>
          <Text style={[Typography.h1, styles.title]}>Введите код</Text>
          <Text style={[Typography.body, styles.subtitle]}>
            Код отправлен на {phone}
          </Text>

          <View style={styles.otpContainer}>
            <OtpInput onComplete={handleOtpComplete} error={error} />
          </View>

          {errorMessage ? (
            <Text style={[Typography.caption, styles.errorText]}>
              {errorMessage}
            </Text>
          ) : null}

          <View style={styles.resendContainer}>
            {timer > 0 ? (
              <Text style={[Typography.caption, styles.timerText]}>
                Повторная отправка через {timer} сек
              </Text>
            ) : (
              <TouchableOpacity
                onPress={handleResend}
                disabled={resending}
                accessibilityRole="button"
              >
                <Text style={[Typography.body, styles.resendText]}>
                  {resending ? 'Отправляем...' : 'Отправить код повторно'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: ClientColors.background,
  },
  container: {
    flex: 1,
  },
  backButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    alignSelf: 'flex-start',
  },
  backText: {
    fontSize: 28,
    color: ClientColors.dark,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  title: {
    color: ClientColors.dark,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    color: ClientColors.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
  },
  otpContainer: {
    marginBottom: 16,
  },
  errorText: {
    color: ClientColors.danger,
    textAlign: 'center',
    marginBottom: 8,
  },
  resendContainer: {
    alignItems: 'center',
    marginTop: 24,
  },
  timerText: {
    color: ClientColors.textMuted,
  },
  resendText: {
    color: ClientColors.primary,
    fontWeight: '600',
  },
});
