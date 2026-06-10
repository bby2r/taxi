import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Easing,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Svg, {
  Circle,
  Defs,
  RadialGradient,
  Stop,
} from 'react-native-svg';
import { ClientColors, Radius, Spacing, sendOtp, formatPhoneDigits, extractDigits } from '@taxi/shared';
import { AuthStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'PhoneLogin'>;

const HALO_SIZE = 320;
const LOCKUP_WIDTH = 150;
const LOCKUP_HEIGHT = 134;

export default function PhoneLoginScreen({ navigation }: Props): React.ReactNode {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Brand backdrop is fully static after the entrance fade — no
  // continuous loops on this screen. Auth is persistent, and burning
  // a render thread on a rotating ring while someone types their phone
  // number is bad value on weak devices.
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(backdropOpacity, {
      toValue: 1,
      duration: 460,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [backdropOpacity]);

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
            {/* Ambient halo — soft teal radial glow behind the lockup. */}
            <Animated.View
              style={[
                styles.halo,
                { width: HALO_SIZE, height: HALO_SIZE, opacity: backdropOpacity },
              ]}
            >
              <Svg width={HALO_SIZE} height={HALO_SIZE}>
                <Defs>
                  <RadialGradient id="haloGrad" cx="50%" cy="50%" rx="50%" ry="50%">
                    <Stop offset="0%" stopColor={ClientColors.primary} stopOpacity="0.22" />
                    <Stop offset="55%" stopColor={ClientColors.primary} stopOpacity="0.06" />
                    <Stop offset="100%" stopColor={ClientColors.primary} stopOpacity="0" />
                  </RadialGradient>
                </Defs>
                <Circle
                  cx={HALO_SIZE / 2}
                  cy={HALO_SIZE / 2}
                  r={HALO_SIZE / 2}
                  fill="url(#haloGrad)"
                />
              </Svg>
            </Animated.View>

            <Animated.View style={{ opacity: backdropOpacity }}>
              <Image
                source={require('../../assets/alif-lockup.png')}
                style={styles.lockup}
                resizeMode="contain"
              />
            </Animated.View>
          </View>

          <Text style={styles.tagline}>
            Такси в селе и до города{'\n'}за пару минут
          </Text>

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
    paddingHorizontal: Spacing.xxl,
  },
  heroBlock: {
    alignItems: 'center',
    justifyContent: 'center',
    height: HALO_SIZE * 0.78,
    marginBottom: 4,
  },
  halo: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockup: {
    width: LOCKUP_WIDTH,
    height: LOCKUP_HEIGHT,
  },
  tagline: {
    fontSize: 15,
    color: ClientColors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  formCard: {
    backgroundColor: ClientColors.white,
    borderRadius: Radius.xxl,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
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
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.lg,
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
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: ClientColors.border,
    backgroundColor: ClientColors.background,
    paddingHorizontal: Spacing.lg,
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
});
