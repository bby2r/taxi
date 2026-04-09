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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import {
  getDriverProfile,
  requestDriverChanges,
  getDriverChangeRequests,
  sendChangePhoneOtp,
  verifyChangePhone,
} from '../../api/profile';
import { DriverProfile, DriverChangeRequest } from '../../api/types';
import { DriverColors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { OTP_LENGTH } from '../../utils/constants';

type EditableField = 'name' | 'car_model' | 'car_number';

const FIELD_LABELS: Record<EditableField, string> = {
  name: 'Имя',
  car_model: 'Модель авто',
  car_number: 'Гос. номер',
};

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

        {/* Avatar */}
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
        </View>

        {/* Profile Fields */}
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

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Телефон</Text>
          <View style={styles.phoneRow}>
            <Text style={[styles.cardValue, { flex: 1 }]}>{profile?.phone ?? user?.phone ?? ''}</Text>
            {!showPhoneFlow && (
              <TouchableOpacity onPress={() => setShowPhoneFlow(true)} activeOpacity={0.7}>
                <Text style={styles.changePhoneLink}>Изменить</Text>
              </TouchableOpacity>
            )}
          </View>
          {showPhoneFlow && (
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
        </View>

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
    <View style={styles.card}>
      <View style={styles.cardHeader}>
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
        <Text style={styles.cardValue}>{value}</Text>
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
  },
  avatarText: {
    ...Typography.h1,
    color: DriverColors.background,
  },
  card: {
    backgroundColor: DriverColors.cardBackground,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardLabel: {
    ...Typography.caption,
    color: DriverColors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  cardValue: {
    ...Typography.body,
    color: DriverColors.textPrimary,
  },
  editButton: {
    ...Typography.caption,
    color: DriverColors.primary,
    fontWeight: '600',
    marginBottom: 8,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  changePhoneLink: {
    ...Typography.caption,
    color: DriverColors.textMuted,
    fontSize: 13,
  },
  phoneFlow: {
    gap: 12,
    marginTop: 12,
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
  logoutButton: {
    backgroundColor: DriverColors.danger,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  logoutButtonText: {
    ...Typography.button,
    color: DriverColors.white,
  },
});
