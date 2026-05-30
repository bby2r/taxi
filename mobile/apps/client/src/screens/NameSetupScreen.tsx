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
import {
  ClientColors,
  Radius,
  Spacing,
  updateClientProfile,
  useAuth,
} from '@taxi/shared';
import Icon from '../components/Icon';

/**
 * One-time name capture. New clients are firstOrCreate'd on the
 * server with name = '' (just phone + role + verified_at), so the
 * very first time the driver sees their offer, the client name slot
 * is empty. We gate the app behind this screen until the user types
 * SOMETHING — even "Иван" is better than nothing for the driver.
 *
 * Driven entirely from RootNavigator: if isAuthenticated && !user.name,
 * this screen renders instead of ClientTabs. Once updateClientProfile +
 * refreshUser land, user.name is set and RootNavigator naturally
 * flips to the main app on the next render.
 */
export default function NameSetupScreen(): React.ReactNode {
  const { refreshUser } = useAuth();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) return;
    setLoading(true);
    try {
      await updateClientProfile(trimmed);
      await refreshUser();
      // RootNavigator's conditional will flip on next render — no
      // explicit navigation needed.
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Не удалось сохранить имя';
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
            <View style={styles.brandMark}>
              <Icon name="user" size={36} color={ClientColors.white} strokeWidth={2} />
            </View>
            <Text style={styles.title}>Как вас зовут?</Text>
            <Text style={styles.subtitle}>
              Водитель увидит ваше имя{'\n'}когда примет заказ
            </Text>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.label}>Имя</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Иван"
              placeholderTextColor={ClientColors.textMuted}
              maxLength={50}
              autoFocus
              autoCapitalize="words"
              accessibilityLabel="Имя"
            />

            <TouchableOpacity
              onPress={handleSubmit}
              disabled={name.trim().length < 2 || loading}
              activeOpacity={0.9}
              style={[
                styles.button,
                (name.trim().length < 2 || loading) && styles.buttonDisabled,
              ]}
            >
              {loading ? (
                <ActivityIndicator color={ClientColors.white} />
              ) : (
                <Text style={styles.buttonText}>Готово</Text>
              )}
            </TouchableOpacity>

            <Text style={styles.hint}>
              Можно изменить позже в настройках
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: ClientColors.background },
  container: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: Spacing.xxl },
  heroBlock: { alignItems: 'center', marginBottom: 36 },
  brandMark: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: ClientColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    shadowColor: ClientColors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
    transform: [{ rotate: '-6deg' }],
  },
  title: {
    fontSize: 26,
    fontWeight: '800' as const,
    color: ClientColors.dark,
    letterSpacing: -0.5,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: 15,
    color: ClientColors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
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
  input: {
    height: 56,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: ClientColors.border,
    backgroundColor: ClientColors.background,
    paddingHorizontal: Spacing.lg,
    fontSize: 18,
    fontWeight: '600' as const,
    color: ClientColors.dark,
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
  buttonDisabled: { opacity: 0.5, shadowOpacity: 0 },
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
