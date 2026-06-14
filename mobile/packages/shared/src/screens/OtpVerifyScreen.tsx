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
import { ClientColors } from '../theme/colors';
import OtpInput from '../components/OtpInput';
import { useAuth } from '../context/AuthContext';
import { sendOtp, verifyOtp } from '../api/auth';
import { OTP_RESEND_DELAY_SECONDS } from '../utils/constants';
import { Haptics } from '../utils/haptics';

type OtpVerifyParamList = {
  OtpVerify: { phone: string };
};

type Props = NativeStackScreenProps<OtpVerifyParamList, 'OtpVerify'>;

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
        Haptics.success();
        await login(response.token, response.user);
      } catch (err: unknown) {
        Haptics.error();
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
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>

        <View style={styles.content}>
          <View style={styles.iconCircle}>
            <Text style={styles.iconEmoji}>📩</Text>
          </View>
          <Text style={styles.title}>Код подтверждения</Text>
          <Text style={styles.subtitle}>
            Мы отправили 4-значный код на{'\n'}
            <Text style={styles.phoneText}>{phone}</Text>
          </Text>

          <View style={styles.otpContainer}>
            <OtpInput onComplete={handleOtpComplete} error={error} />
          </View>

          {errorMessage ? (
            <Text style={styles.errorText}>{errorMessage}</Text>
          ) : null}

          <View style={styles.resendContainer}>
            {timer > 0 ? (
              <Text style={styles.timerText}>
                Запросить новый код можно через{' '}
                <Text style={styles.timerNumber}>{timer} сек</Text>
              </Text>
            ) : (
              <TouchableOpacity
                onPress={handleResend}
                disabled={resending}
                accessibilityRole="button"
                style={styles.resendButton}
                activeOpacity={0.7}
              >
                <Text style={styles.resendText}>
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
    paddingHorizontal: 20,
    paddingVertical: 14,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  backText: {
    fontSize: 28,
    color: ClientColors.dark,
    fontWeight: '600' as const,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: ClientColors.primaryTint,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  iconEmoji: {
    fontSize: 40,
  },
  title: {
    fontSize: 26,
    fontWeight: '800' as const,
    color: ClientColors.dark,
    textAlign: 'center',
    letterSpacing: -0.3,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    color: ClientColors.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  phoneText: {
    color: ClientColors.dark,
    fontWeight: '700' as const,
  },
  otpContainer: {
    marginBottom: 12,
  },
  errorText: {
    color: ClientColors.danger,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
  },
  resendContainer: {
    alignItems: 'center',
    marginTop: 28,
  },
  timerText: {
    fontSize: 13,
    color: ClientColors.textMuted,
  },
  timerNumber: {
    color: ClientColors.textPrimary,
    fontWeight: '600' as const,
  },
  resendButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  resendText: {
    color: ClientColors.primary,
    fontSize: 15,
    fontWeight: '700' as const,
  },
});
