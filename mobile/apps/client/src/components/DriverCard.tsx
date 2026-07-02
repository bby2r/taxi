import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Image,
} from 'react-native';
import {
  Driver,
  ClientColors,
  FadeInView,
  formatPlate,
  isFullPlate,
  PopInView,
  Radius,
  RatingBadge,
  Spacing,
  Haptics,
} from '@taxi/shared';
import Icon, { IconName } from './Icon';
import CarPhoto from './CarPhoto';

interface DriverCardProps {
  driver: Driver;
  status: 'accepted' | 'arrived' | 'in_progress';
}

function getStatusInfo(status: DriverCardProps['status']): {
  label: string;
  color: string;
  bg: string;
  icon: IconName;
} {
  switch (status) {
    case 'accepted':
      return {
        label: 'В пути к вам',
        color: ClientColors.primaryDark,
        bg: ClientColors.primaryTint,
        icon: 'route',
      };
    case 'arrived':
      return {
        label: 'Водитель ожидает',
        color: ClientColors.secondaryDark,
        bg: ClientColors.secondaryTint,
        icon: 'pin',
      };
    case 'in_progress':
      return {
        label: 'В поездке',
        color: ClientColors.accent,
        bg: ClientColors.accentTint,
        icon: 'car',
      };
  }
}

function DriverCardComponent({ driver, status }: DriverCardProps): React.ReactNode {
  const statusInfo = getStatusInfo(status);
  const initial = driver.name.charAt(0).toUpperCase();
  const hasFullPlate = isFullPlate(driver.car_number);

  const handleCall = (): void => {
    Haptics.light();
    Linking.openURL(`tel:${driver.phone}`);
  };

  return (
    <FadeInView style={styles.outer}>
      <View style={styles.card}>
        <FadeInView
          key={status}
          translateY={6}
          duration={280}
          style={[styles.statusPill, { backgroundColor: statusInfo.bg }]}
        >
          <Icon name={statusInfo.icon} size={13} color={statusInfo.color} strokeWidth={2.4} />
          <Text style={[styles.statusLabel, { color: statusInfo.color }]}>
            {statusInfo.label}
          </Text>
        </FadeInView>

        <View style={styles.heroRow}>
          <PopInView fromScale={0.85} duration={340}>
            <View style={styles.avatarRing}>
              {driver.photo_url ? (
                <Image
                  source={{ uri: driver.photo_url }}
                  style={styles.avatarImage}
                  accessibilityLabel={`Фото водителя ${driver.name}`}
                />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarText}>{initial}</Text>
                </View>
              )}
              {driver.photo_url && (
                <View style={styles.verifiedBadge} pointerEvents="none">
                  <Icon name="check" size={11} color={ClientColors.white} strokeWidth={3.2} />
                </View>
              )}
            </View>
          </PopInView>

          <View style={styles.info}>
            <Text style={styles.name} numberOfLines={1}>
              {driver.name}
            </Text>
            <View style={styles.ratingWrap}>
              <RatingBadge
                avg={driver.rating_avg ?? null}
                count={driver.rating_count ?? 0}
                size="compact"
                pillBackground={ClientColors.surfaceMuted}
                textColor={ClientColors.dark}
                emptyLabel="Новый"
              />
            </View>
          </View>

          <View style={styles.carPhotoWrap} pointerEvents="none">
            <CarPhoto width={108} />
          </View>
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.carModel} numberOfLines={1}>
            {driver.car_model}
          </Text>
          {hasFullPlate ? (
            <View style={styles.plate}>
              <View style={styles.plateFlag}>
                <View style={styles.plateFlagBar} />
                <Text style={styles.plateFlagText}>KG</Text>
              </View>
              <Text style={styles.plateNumber} numberOfLines={1}>
                {formatPlate(driver.car_number)}
              </Text>
            </View>
          ) : (
            <Text style={styles.plateFallback} numberOfLines={1}>
              {driver.car_number}
            </Text>
          )}
        </View>

        <TouchableOpacity
          onPress={handleCall}
          style={styles.phoneButton}
          accessibilityRole="button"
          accessibilityLabel={`Позвонить водителю ${driver.name}`}
          activeOpacity={0.88}
        >
          <Icon name="phone" size={18} color={ClientColors.white} strokeWidth={2.4} />
          <Text style={styles.phoneButtonText}>Позвонить водителю</Text>
        </TouchableOpacity>
      </View>
    </FadeInView>
  );
}

const DriverCard = React.memo(DriverCardComponent);
export default DriverCard;

const styles = StyleSheet.create({
  outer: {
    marginBottom: Spacing.sm,
  },
  card: {
    backgroundColor: ClientColors.white,
    borderRadius: 20,
    paddingTop: 12,
    paddingBottom: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: ClientColors.border,
    shadowColor: '#1a1a2e',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
    overflow: 'hidden',
  },
  statusPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: Radius.round,
    marginBottom: 10,
    gap: 5,
  },
  statusLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: 0.2,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarRing: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: ClientColors.white,
    borderWidth: 2,
    borderColor: ClientColors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    // Мягкая тень под фото — как в Uber/Yandex Go, добавляет глубину
    // без ощущения «плоской» карточки, но не перекрывает соседний
    // status pill сверху.
    shadowColor: ClientColors.primaryDark,
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  avatarImage: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  avatarFallback: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: ClientColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: ClientColors.white,
    letterSpacing: -0.5,
  },
  // Зелёная checkmark-галочка в углу фото — сигнал что водитель
  // прошёл верификацию (фото загружено = профиль подтверждён
  // модерацией). Клиент видит «настоящего» человека, а не иконку по
  // умолчанию.
  verifiedBadge: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: ClientColors.success,
    borderWidth: 2,
    borderColor: ClientColors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    gap: 4,
  },
  name: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: ClientColors.dark,
    letterSpacing: -0.3,
  },
  ratingWrap: {
    flexDirection: 'row',
  },
  carPhotoWrap: {
    marginRight: -8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 8,
    marginBottom: 12,
  },
  carModel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600' as const,
    color: ClientColors.textSecondary,
  },
  // Лицензионная плашка — белый фон, тонкая чёрная рамка, синий
  // KG-флаг слева как на реальных KG-номерах.
  plate: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: '#1a1a1a',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  plateFlag: {
    backgroundColor: '#1B4FA0',
    paddingHorizontal: 5,
    paddingTop: 4,
    paddingBottom: 3,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 22,
  },
  plateFlagBar: {
    width: 12,
    height: 2.5,
    borderRadius: 1,
    backgroundColor: '#FFD400',
    marginBottom: 1.5,
  },
  plateFlagText: {
    fontSize: 8,
    fontWeight: '800' as const,
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
  plateNumber: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 13,
    fontWeight: '800' as const,
    color: '#1a1a1a',
    letterSpacing: 1.1,
  },
  plateFallback: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: ClientColors.dark,
    letterSpacing: 0.5,
  },
  phoneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 46,
    borderRadius: 23,
    backgroundColor: ClientColors.success,
    shadowColor: ClientColors.success,
    shadowOpacity: 0.32,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },
  phoneButtonText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: ClientColors.white,
    letterSpacing: 0.2,
  },
});
