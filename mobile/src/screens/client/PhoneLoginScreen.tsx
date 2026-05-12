import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/types';
import { ClientColors } from '../../theme/colors';
import { sendOtp } from '../../api/auth';
import { formatPhoneDigits, extractDigits } from '../../utils/phone';

type Props = NativeStackScreenProps<AuthStackParamList, 'PhoneLogin'>;

export default function PhoneLoginScreen({ navigation }: Props): React.ReactNode {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handlePhoneChange = (text: string) => {
    setPhone(extractDigits(text, 9));
    if (error) setError('');
  };

  const handleSubmit = async () => {
    if (phone.length < 9) return;
    setLoading(true);
    setError('');
    const fullPhone = '+996' + phone;
    try {
      await sendOtp(fullPhone);
      navigation.navigate('OtpVerify', { phone: fullPhone });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Не удалось отправить код';
      setError(message);
      Alert.alert('Ошибка', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.content}>
          <View style={styles.heroBlock}>
            <Text style={styles.brandEmoji}>🚕</Text>
            <Text style={styles.title}>Village Taxi</Text>
            <Text style={styles.subtitle}>
              Такси в селе и до города{'\n'}за пару минут
            </Text>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.label}>Ваш номер</Text>
            <View style={styles.phoneRow}>
              <View style={styles.prefixBox}>
                <Text style={styles.prefixText}>+996</Text>
              </View>
              <TextInput
                style={styles.phoneInput}
                value={formatPhoneDigits(phone)}
                onChangeText={handlePhoneChange}
                placeholder="--- --- ---"
                placeholderTextColor={ClientColors.textMuted}
                keyboardType="phone-pad"
                maxLength={11}
                autoFocus
                accessibilityLabel="Номер телефона"
              />
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity
              onPress={handleSubmit}
              disabled={phone.length < 9 || loading}
              activeOpacity={0.9}
              style={[
                styles.button,
                (phone.length < 9 || loading) && styles.buttonDisabled,
              ]}
            >
              {loading ? (
                <ActivityIndicator color={ClientColors.white} />
              ) : (
                <Text style={styles.buttonText}>Получить код</Text>
              )}
            </TouchableOpacity>

            <Text style={styles.hint}>
              На номер придёт SMS с 4-значным кодом
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => navigation.navigate('DriverLogin')}
            style={styles.driverLink}
            activeOpacity={0.7}
          >
            <Text style={styles.driverLinkText}>Я водитель →</Text>
          </TouchableOpacity>
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
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  heroBlock: {
    alignItems: 'center',
    marginBottom: 36,
  },
  brandEmoji: {
    fontSize: 56,
    marginBottom: 14,
  },
  title: {
    fontSize: 30,
    fontWeight: '800' as const,
    color: ClientColors.dark,
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: ClientColors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  formCard: {
    backgroundColor: ClientColors.white,
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 22,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: ClientColors.textSecondary,
    marginBottom: 10,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.6,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  prefixBox: {
    height: 56,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: ClientColors.primaryTint,
    justifyContent: 'center',
  },
  prefixText: {
    color: ClientColors.primaryDark,
    fontWeight: '700' as const,
    fontSize: 16,
  },
  phoneInput: {
    flex: 1,
    height: 56,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: ClientColors.border,
    backgroundColor: ClientColors.background,
    paddingHorizontal: 16,
    fontSize: 18,
    fontWeight: '600' as const,
    color: ClientColors.dark,
    letterSpacing: 0.5,
  },
  errorText: {
    color: ClientColors.danger,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 10,
  },
  button: {
    marginTop: 18,
    backgroundColor: ClientColors.primary,
    borderRadius: 28,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: ClientColors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  buttonDisabled: {
    opacity: 0.5,
    shadowOpacity: 0,
  },
  buttonText: {
    color: ClientColors.white,
    fontSize: 16,
    fontWeight: '700' as const,
    letterSpacing: 0.3,
  },
  hint: {
    fontSize: 12,
    color: ClientColors.textMuted,
    textAlign: 'center',
    marginTop: 14,
  },
  driverLink: {
    alignSelf: 'center',
    marginTop: 24,
    paddingVertical: 12,
  },
  driverLinkText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: ClientColors.accent,
  },
});
