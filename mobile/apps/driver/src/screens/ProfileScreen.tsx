import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Linking,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import {
  useAuth,
  getDriverProfile,
  requestDriverChanges,
  getDriverChangeRequests,
  sendChangePhoneOtp,
  uploadDriverPhoto,
  verifyChangePhone,
  DriverProfile,
  DriverChangeRequest,
  DriverColors,
  RatingBadge,
  Typography,
  OTP_LENGTH,
} from '@taxi/shared';

type EditableField = 'name' | 'car_model' | 'car_number';

const FIELD_LABELS: Record<EditableField, string> = {
  name: 'Имя',
  car_model: 'Модель авто',
  car_number: 'Гос. номер',
};

function plural(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'е';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'ам';
  return 'ам';
}

const STATUS_LABELS: Record<DriverChangeRequest['status'], string> = {
  pending: 'На рассмотрении',
  approved: 'Одобрено',
  rejected: 'Отклонено',
};

const STATUS_COLORS: Record<DriverChangeRequest['status'], string> = {
  pending: '#F59E0B',
  approved: DriverColors.success,
  rejected: DriverColors.danger,
};

export default function ProfileScreen(): React.ReactNode {
  const { user, logout } = useAuth();

  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [changeRequests, setChangeRequests] = useState<DriverChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editingField, setEditingField] = useState<EditableField | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const [showPhoneFlow, setShowPhoneFlow] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);

  const handlePickPhoto = async (): Promise<void> => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('Нет доступа', 'Разрешите доступ к фото в настройках');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled || !result.assets[0]) return;
    setPhotoUploading(true);
    try {
      await uploadDriverPhoto(result.assets[0].uri);
      await fetchData(true);
      Alert.alert('Готово', 'Фото обновлено');
    } catch {
      Alert.alert('Ошибка', 'Не удалось загрузить фото');
    } finally {
      setPhotoUploading(false);
    }
  };

  const fetchData = useCallback(async (isRefresh: boolean): Promise<void> => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      const [profileData, requestsData] = await Promise.all([
        getDriverProfile(),
        getDriverChangeRequests(),
      ]);
      setProfile(profileData);
      setChangeRequests(requestsData);
    } catch {
      setError('Не удалось загрузить профиль');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData(false);
  }, [fetchData]);

  const handleEdit = (field: EditableField): void => {
    if (!profile) {
      return;
    }
    setEditingField(field);
    setEditValue(profile[field]);
  };

  const handleCancel = (): void => {
    setEditingField(null);
    setEditValue('');
  };

  const handleSubmit = async (): Promise<void> => {
    if (!editingField || !editValue.trim()) {
      Alert.alert('Ошибка', 'Поле не может быть пустым');
      return;
    }
    setSubmitting(true);
    try {
      await requestDriverChanges({ [editingField]: editValue.trim() });
      Alert.alert('Успешно', 'Заявка на изменение отправлена');
      setEditingField(null);
      setEditValue('');
      const requestsData = await getDriverChangeRequests();
      setChangeRequests(requestsData);
    } catch {
      Alert.alert('Ошибка', 'Не удалось отправить заявку');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendPhoneOtp = async (): Promise<void> => {
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
      Alert.alert('Успешно', 'Номер телефона изменён');
      setShowPhoneFlow(false);
      setNewPhone('');
      setOtpSent(false);
      setOtpCode('');
      fetchData(true);
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

  const getFieldLabel = (field: string): string => {
    return FIELD_LABELS[field as EditableField] ?? field;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={DriverColors.primary} />
      </SafeAreaView>
    );
  }

  if (error && !profile) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={[Typography.body, { color: DriverColors.textSecondary, marginBottom: 16 }]}>
          {error}
        </Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => fetchData(false)}>
          <Text style={styles.retryButtonText}>Повторить</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const initial = (profile?.name ?? user?.name ?? '?').charAt(0).toUpperCase();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchData(true)}
            tintColor={DriverColors.primary}
          />
        }
      >
        <Text style={styles.header}>Профиль</Text>

        {/* Avatar + rating */}
        <View style={styles.avatarContainer}>
          <TouchableOpacity
            style={styles.avatar}
            onPress={handlePickPhoto}
            activeOpacity={0.85}
            disabled={photoUploading}
            accessibilityRole="button"
            accessibilityLabel="Загрузить фото профиля"
          >
            {profile?.photo_url ? (
              <Image source={{ uri: profile.photo_url }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>{initial}</Text>
            )}
            <View style={styles.avatarEdit}>
              {photoUploading ? (
                <ActivityIndicator size="small" color={DriverColors.white} />
              ) : (
                <Text style={styles.avatarEditText}>✎</Text>
              )}
            </View>
          </TouchableOpacity>
          <View style={styles.ratingBlock}>
            <RatingBadge
              avg={profile?.rating_avg ?? null}
              count={profile?.rating_count ?? 0}
              size="medium"
              pillBackground={DriverColors.cardBackground}
              textColor={DriverColors.textPrimary}
              emptyLabel="Нет оценок"
            />
            {(profile?.rating_count ?? 0) > 0 && (
              <Text style={styles.ratingHelper}>
                Средняя оценка по {profile?.rating_count} поездк{plural(profile?.rating_count ?? 0)}
              </Text>
            )}
          </View>
        </View>

        {/* Unified Form Card */}
        <View style={styles.card}>
          {/* Name */}
          <ProfileField
            label="Имя"
            value={profile?.name ?? ''}
            isEditing={editingField === 'name'}
            editValue={editValue}
            onEditValue={setEditValue}
            onEdit={() => handleEdit('name')}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            submitting={submitting}
          />

          <View style={styles.divider} />

          {/* Phone (read-only input + change flow) */}
          <Text style={styles.cardLabel}>Номер телефона</Text>
          <TextInput
            style={[styles.input, styles.inputReadonly]}
            value={profile?.phone ?? user?.phone ?? ''}
            editable={false}
          />
          {!showPhoneFlow ? (
            <TouchableOpacity
              style={styles.changePhoneTouchable}
              onPress={() => setShowPhoneFlow(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.changePhoneLink}>Изменить номер телефона</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.phoneFlow}>
              <TextInput
                style={styles.input}
                value={newPhone}
                onChangeText={setNewPhone}
                placeholder="Новый номер телефона"
                placeholderTextColor={DriverColors.textMuted}
                keyboardType="phone-pad"
                editable={!otpSent}
              />
              {!otpSent ? (
                <TouchableOpacity
                  style={[styles.submitButton, phoneLoading && styles.buttonDisabled]}
                  onPress={handleSendPhoneOtp}
                  disabled={phoneLoading}
                >
                  {phoneLoading ? (
                    <ActivityIndicator size="small" color={DriverColors.background} />
                  ) : (
                    <Text style={styles.submitButtonText}>Отправить код</Text>
                  )}
                </TouchableOpacity>
              ) : (
                <>
                  <TextInput
                    style={styles.input}
                    value={otpCode}
                    onChangeText={setOtpCode}
                    placeholder={`${OTP_LENGTH}-значный код`}
                    placeholderTextColor={DriverColors.textMuted}
                    keyboardType="number-pad"
                    maxLength={OTP_LENGTH}
                  />
                  <TouchableOpacity
                    style={[styles.submitButton, phoneLoading && styles.buttonDisabled]}
                    onPress={handleVerifyPhone}
                    disabled={phoneLoading}
                  >
                    {phoneLoading ? (
                      <ActivityIndicator size="small" color={DriverColors.background} />
                    ) : (
                      <Text style={styles.submitButtonText}>Подтвердить</Text>
                    )}
                  </TouchableOpacity>
                </>
              )}
              <TouchableOpacity style={styles.cancelButton} onPress={resetPhoneFlow}>
                <Text style={styles.cancelButtonText}>Отмена</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.divider} />

          {/* Car Model */}
          <ProfileField
            label="Модель авто"
            value={profile?.car_model ?? ''}
            isEditing={editingField === 'car_model'}
            editValue={editValue}
            onEditValue={setEditValue}
            onEdit={() => handleEdit('car_model')}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            submitting={submitting}
          />

          <View style={styles.divider} />

          {/* License Plate */}
          <ProfileField
            label="Гос. номер"
            value={profile?.car_number ?? ''}
            isEditing={editingField === 'car_number'}
            editValue={editValue}
            onEditValue={setEditValue}
            onEdit={() => handleEdit('car_number')}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            submitting={submitting}
            autoCapitalize="characters"
          />
        </View>

        {/* Change Requests */}
        {changeRequests.length > 0 && (
          <View style={styles.requestsSection}>
            <Text style={styles.requestsSectionTitle}>Заявки на изменение</Text>
            {changeRequests.map((request) => (
              <View key={request.id} style={styles.requestCard}>
                <View style={styles.requestHeader}>
                  <Text style={styles.requestField}>{getFieldLabel(request.field)}</Text>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: STATUS_COLORS[request.status] + '20' },
                    ]}
                  >
                    <Text
                      style={[styles.statusBadgeText, { color: STATUS_COLORS[request.status] }]}
                    >
                      {STATUS_LABELS[request.status]}
                    </Text>
                  </View>
                </View>
                <Text style={styles.requestValues}>
                  {request.old_value} → {request.new_value}
                </Text>
                {request.status === 'rejected' && request.admin_comment && (
                  <Text style={styles.adminComment}>
                    Комментарий: {request.admin_comment}
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Support */}
        <TouchableOpacity
          style={styles.supportButton}
          onPress={() =>
            Linking.openURL(
              'https://wa.me/996509397226?text=' +
                encodeURIComponent(
                  'Здравствуйте, я водитель Alif Taxi. Нужна помощь.',
                ),
            )
          }
          activeOpacity={0.85}
        >
          <Text style={styles.supportLabel}>Поддержка в WhatsApp</Text>
          <Text style={styles.supportPhone}>+996 509 397 226</Text>
        </TouchableOpacity>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Выйти</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

interface ProfileFieldProps {
  label: string;
  value: string;
  isEditing: boolean;
  editValue: string;
  onEditValue: (value: string) => void;
  onEdit: () => void;
  onSubmit: () => void;
  onCancel: () => void;
  submitting: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}

function ProfileField({
  label,
  value,
  isEditing,
  editValue,
  onEditValue,
  onEdit,
  onSubmit,
  onCancel,
  submitting,
  autoCapitalize = 'sentences',
}: ProfileFieldProps): React.ReactNode {
  return (
    <View>
      <View style={styles.fieldHeader}>
        <Text style={styles.cardLabel}>{label}</Text>
        {!isEditing && (
          <TouchableOpacity onPress={onEdit} activeOpacity={0.7}>
            <Text style={styles.editButton}>Изменить</Text>
          </TouchableOpacity>
        )}
      </View>
      {isEditing ? (
        <View style={styles.editContainer}>
          <TextInput
            style={styles.input}
            value={editValue}
            onChangeText={onEditValue}
            placeholder={label}
            placeholderTextColor={DriverColors.textMuted}
            autoCapitalize={autoCapitalize}
            autoFocus
          />
          <View style={styles.editActions}>
            <TouchableOpacity
              style={[styles.submitButton, submitting && styles.buttonDisabled]}
              onPress={onSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color={DriverColors.background} />
              ) : (
                <Text style={styles.submitButtonText}>Отправить</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={onCancel} disabled={submitting}>
              <Text style={styles.cancelButtonText}>Отмена</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TextInput
          style={[styles.input, styles.inputReadonly]}
          value={value}
          editable={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DriverColors.background,
  },
  centered: {
    flex: 1,
    backgroundColor: DriverColors.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  header: {
    ...Typography.h2,
    color: DriverColors.textPrimary,
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
    backgroundColor: DriverColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: DriverColors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  avatarText: {
    ...Typography.h1,
    color: DriverColors.background,
  },
  avatarImage: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarEdit: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: DriverColors.primary,
    borderWidth: 2.5,
    borderColor: DriverColors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEditText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: DriverColors.background,
  },
  ratingBlock: {
    marginTop: 14,
    alignItems: 'center',
    gap: 4,
  },
  ratingHelper: {
    ...Typography.caption,
    color: DriverColors.textMuted,
    fontSize: 12,
  },
  card: {
    backgroundColor: DriverColors.cardBackground,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  fieldHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardLabel: {
    ...Typography.caption,
    color: DriverColors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  editButton: {
    ...Typography.caption,
    color: DriverColors.primary,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: DriverColors.border,
    marginVertical: 16,
  },
  inputReadonly: {
    color: DriverColors.textSecondary,
  },
  changePhoneTouchable: {
    paddingVertical: 6,
    alignItems: 'center',
  },
  changePhoneLink: {
    ...Typography.caption,
    color: DriverColors.textMuted,
    fontSize: 13,
  },
  phoneFlow: {
    gap: 12,
    marginTop: 8,
  },
  editContainer: {
    gap: 12,
  },
  input: {
    ...Typography.body,
    color: DriverColors.textPrimary,
    backgroundColor: DriverColors.background,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: DriverColors.border,
  },
  editActions: {
    flexDirection: 'row',
    gap: 12,
  },
  submitButton: {
    flex: 1,
    backgroundColor: DriverColors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  submitButtonText: {
    ...Typography.button,
    color: DriverColors.background,
  },
  cancelButton: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: DriverColors.border,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    ...Typography.button,
    color: DriverColors.textSecondary,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  retryButton: {
    backgroundColor: DriverColors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  retryButtonText: {
    ...Typography.button,
    color: DriverColors.background,
  },
  requestsSection: {
    marginTop: 12,
  },
  requestsSectionTitle: {
    ...Typography.h3,
    color: DriverColors.textPrimary,
    marginBottom: 12,
  },
  requestCard: {
    backgroundColor: DriverColors.cardBackground,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  requestField: {
    ...Typography.bodyBold,
    color: DriverColors.textPrimary,
  },
  statusBadge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusBadgeText: {
    ...Typography.caption,
    fontWeight: '600',
  },
  requestValues: {
    ...Typography.body,
    color: DriverColors.textSecondary,
  },
  adminComment: {
    ...Typography.caption,
    color: DriverColors.danger,
    marginTop: 6,
    fontStyle: 'italic',
  },
  supportButton: {
    backgroundColor: DriverColors.cardBackground,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: DriverColors.border,
  },
  supportLabel: {
    ...Typography.bodyBold,
    color: DriverColors.textPrimary,
  },
  supportPhone: {
    ...Typography.body,
    color: DriverColors.primary,
  },
  logoutButton: {
    backgroundColor: DriverColors.danger,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  logoutButtonText: {
    ...Typography.button,
    color: DriverColors.white,
  },
});
