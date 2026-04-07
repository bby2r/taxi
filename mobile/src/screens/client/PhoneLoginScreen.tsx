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
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/types';
import { ClientColors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import ActionButton from '../../components/ActionButton';
import { sendOtp } from '../../api/auth';

type Props = NativeStackScreenProps<AuthStackParamList, 'PhoneLogin'>;

export default function PhoneLoginScreen({ navigation }: Props): React.ReactNode {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handlePhoneChange = (text: string) => {
    const digits = text.replace(/[^0-9]/g, '').slice(0, 9);
    setPhone(digits);
    if (error) {
      setError('');
    }
  };

  const handleSubmit = async () => {
    if (phone.length < 9) {
      return;
    }

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
          <Text style={[Typography.h1, styles.title]}>Village Taxi</Text>
          <Text style={[Typography.body, styles.subtitle]}>
            Введите номер телефона
          </Text>

          <View style={styles.phoneRow}>
            <View style={styles.prefixBox}>
              <Text style={[Typography.body, styles.prefixText]}>+996</Text>
            </View>
            <TextInput
              style={styles.phoneInput}
              value={phone}
              onChangeText={handlePhoneChange}
              placeholder="--- --- ---"
              placeholderTextColor={ClientColors.textMuted}
              keyboardType="phone-pad"
              maxLength={9}
              autoFocus
              accessibilityLabel="Номер телефона"
            />
          </View>

          {error ? (
            <Text style={[Typography.caption, styles.errorText]}>{error}</Text>
          ) : null}

          <ActionButton
            title="Получить код"
            onPress={handleSubmit}
            loading={loading}
            disabled={phone.length < 9}
            style={styles.button}
          />

          <TouchableOpacity
            onPress={() => navigation.navigate('DriverLogin')}
            style={styles.driverLink}
          >
            <Text style={[Typography.caption, { color: ClientColors.textSecondary }]}>
              Я водитель
            </Text>
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
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  prefixBox: {
    height: 52,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: ClientColors.border,
    backgroundColor: ClientColors.white,
    justifyContent: 'center',
  },
  prefixText: {
    color: ClientColors.dark,
    fontWeight: '600',
  },
  phoneInput: {
    flex: 1,
    height: 52,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: ClientColors.border,
    backgroundColor: ClientColors.white,
    paddingHorizontal: 16,
    fontSize: 16,
    color: ClientColors.dark,
  },
  errorText: {
    color: ClientColors.danger,
    textAlign: 'center',
    marginBottom: 8,
  },
  button: {
    marginTop: 8,
  },
  driverLink: {
    alignSelf: 'center',
    paddingVertical: 12,
    marginTop: 8,
  },
});
