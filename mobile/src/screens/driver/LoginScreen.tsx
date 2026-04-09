import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/types';
import { DriverColors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import ActionButton from '../../components/ActionButton';
import { driverLogin } from '../../api/auth';
import { useAuth } from '../../context/AuthContext';
import { formatPhoneDigits, extractDigits } from '../../utils/phone';

type Props = NativeStackScreenProps<AuthStackParamList, 'DriverLogin'>;

export default function DriverLoginScreen({ navigation }: Props): React.ReactNode {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const auth = useAuth();

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const fullPhone = '+996' + phone;
      const response = await driverLogin(fullPhone, password);
      await auth.login(response.token, response.user);
    } catch (e: any) {
      if (e.response?.status === 401 || e.response?.status === 422) {
        setError('Неверный номер или пароль');
      } else {
        setError('Ошибка подключения. Попробуйте ещё раз.');
      }
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
            Вход для водителей
          </Text>

          <View style={styles.inputGroup}>
            <Text style={[Typography.caption, styles.label]}>Номер телефона</Text>
            <View style={styles.phoneRow}>
              <View style={styles.prefixBox}>
                <Text style={[Typography.body, styles.prefixText]}>+996</Text>
              </View>
              <TextInput
                style={styles.phoneInput}
                value={formatPhoneDigits(phone)}
                onChangeText={(text) => setPhone(extractDigits(text, 9))}
                placeholder="--- --- ---"
                placeholderTextColor={DriverColors.textMuted}
                keyboardType="phone-pad"
                maxLength={11}
                autoFocus
                accessibilityLabel="Номер телефона"
              />
            </View>
          </View>

          <View style={styles.passwordGroup}>
            <Text style={[Typography.caption, styles.label]}>Пароль</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Введите пароль"
              placeholderTextColor={DriverColors.textMuted}
              secureTextEntry
              returnKeyType="go"
              onSubmitEditing={handleLogin}
              accessibilityLabel="Пароль"
            />
          </View>

          {error ? (
            <Text style={[Typography.caption, styles.errorText]}>{error}</Text>
          ) : null}

          <ActionButton
            title="Войти"
            onPress={handleLogin}
            loading={loading}
            disabled={phone.length < 9 || !password}
            style={styles.button}
          />

          <TouchableOpacity
            onPress={() => navigation.navigate('PhoneLogin')}
            style={styles.clientLink}
          >
            <Text style={[Typography.caption, { color: DriverColors.textSecondary }]}>
              Я пассажир
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
    backgroundColor: DriverColors.background,
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
    color: DriverColors.primary,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    color: DriverColors.textSecondary,
    textAlign: 'center',
    marginBottom: 40,
  },
  inputGroup: {
    marginBottom: 0,
  },
  passwordGroup: {
    marginTop: 16,
  },
  label: {
    color: DriverColors.textSecondary,
    marginBottom: 6,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  prefixBox: {
    height: 52,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: DriverColors.border,
    backgroundColor: DriverColors.cardBackground,
    justifyContent: 'center',
  },
  prefixText: {
    color: DriverColors.textPrimary,
    fontWeight: '600' as const,
  },
  phoneInput: {
    flex: 1,
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: DriverColors.border,
    backgroundColor: DriverColors.cardBackground,
    paddingHorizontal: 16,
    fontSize: 16,
    color: DriverColors.textPrimary,
  },
  input: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: DriverColors.border,
    backgroundColor: DriverColors.cardBackground,
    paddingHorizontal: 16,
    fontSize: 16,
    color: DriverColors.textPrimary,
  },
  errorText: {
    color: DriverColors.danger,
    textAlign: 'center',
    marginTop: 12,
  },
  button: {
    marginTop: 24,
  },
  clientLink: {
    alignSelf: 'center',
    paddingVertical: 12,
    marginTop: 8,
  },
});
