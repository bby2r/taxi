import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  StatusBar,
} from 'react-native';
import { ClientColors, Region } from '@taxi/shared';
import Icon from './Icon';
import CollapsiblePicker from './CollapsiblePicker';
import { priceFor, type TariffRoute } from '../api/regions';

interface Props {
  visible: boolean;
  onClose: () => void;
  regions: Region[];
  tariffs: TariffRoute[];
  roundTripPct: number;
  defaultFromId: number | null;
  loading: boolean;
  /** Возвращает true при успехе — модалка тогда закрывается сама. */
  onOrder: (
    fromId: number,
    toId: number,
    isRoundTrip: boolean,
  ) => Promise<boolean>;
}

/**
 * Полноэкранная модалка «Межсёлами». Два свёрнутых пикера:
 * Откуда (дефолтится из «Я в:») и Куда. Только один может быть
 * раскрыт одновременно — тап на закрытый сворачивает соседний,
 * чтобы не было лесенки из открытых списков.
 *
 * Слайдит снизу — ощущается как отдельный экран, но без
 * добавления маршрута в навигационный стек (легче для бэка
 * приложения и кнопки «Назад» Android).
 */
export default function IntervillageModal({
  visible,
  onClose,
  regions,
  tariffs,
  roundTripPct,
  defaultFromId,
  loading,
  onOrder,
}: Props): React.ReactNode {
  // Откуда залочено = defaultFromId (сервер определил по GPS).
  // Только «Куда» меняется пользователем.
  const fromId = defaultFromId;
  const [toId, setToId] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<'to' | null>(null);
  const [isRoundTrip, setIsRoundTrip] = useState(false);

  useEffect(() => {
    if (visible) {
      // Сбрасываем «Куда» каждый раз при открытии — клиент должен
      // явно выбрать, а не отправить заказ с залипшим прошлым
      // направлением.
      setToId(null);
      setExpanded(null);
      setIsRoundTrip(false);
    }
  }, [visible]);

  const togglePicker = useCallback(() => {
    setExpanded((prev) => (prev === 'to' ? null : 'to'));
  }, []);

  const basePrice =
    fromId !== null && toId !== null ? priceFor(tariffs, fromId, toId) : 0;
  const displayedPrice = isRoundTrip
    ? Math.round(basePrice * (1 + roundTripPct / 100))
    : basePrice;
  const tariffMissing = basePrice <= 0 && fromId !== null && toId !== null;

  const fromName = regions.find((r) => r.id === fromId)?.name ?? '';
  const toName = regions.find((r) => r.id === toId)?.name ?? '';

  const confirmRoundTripIfNeeded = (): Promise<boolean> => {
    if (!isRoundTrip) return Promise.resolve(true);
    return new Promise((resolve) => {
      Alert.alert(
        'Туда и обратно',
        'Водитель довозит вас до места, ждёт и привозит обратно.\n\n' +
          'Постарайтесь уложиться в 15-20 минут на месте — водитель не может ждать 2-3 часа.\n\n' +
          'Если задержитесь дольше — водитель уедет на другие заказы.',
        [
          { text: 'Отмена', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Понятно, заказать', style: 'default', onPress: () => resolve(true) },
        ],
        { cancelable: false },
      );
    });
  };

  const handleOrder = async (): Promise<void> => {
    if (fromId === null || toId === null) return;
    if (!(await confirmRoundTripIfNeeded())) return;
    const ok = await onOrder(fromId, toId, isRoundTrip);
    if (ok) onClose();
  };

  const canOrder =
    fromId !== null &&
    toId !== null &&
    fromId !== toId &&
    !tariffMissing &&
    !loading;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={onClose}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Закрыть"
          >
            <Icon name="arrow-right" size={22} color={ClientColors.dark} strokeWidth={2.4} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Межсёлами</Text>
          <View style={styles.backButton} />
        </View>

        <View style={styles.body}>
          <Text style={styles.subtitle}>Выберите направление</Text>

          <View style={{ gap: 12 }}>
            {/* Откуда залочено — определяется по GPS сервером. Меняется
                только если клиент физически переместится в другое село. */}
            <View style={styles.fromLocked}>
              <Text style={styles.fromLockedLabel}>Откуда</Text>
              <View style={styles.fromLockedValueRow}>
                <Icon name="pin" size={14} color={ClientColors.primaryDark} strokeWidth={2.4} />
                <Text style={styles.fromLockedValue}>{fromName || '—'}</Text>
              </View>
            </View>

            <CollapsiblePicker
              label="Куда"
              regions={regions}
              selectedId={toId}
              expanded={expanded === 'to'}
              onToggle={togglePicker}
              onSelect={setToId}
              excludeId={fromId}
            />
          </View>

          {fromId !== null && toId !== null && (
            <View style={[styles.priceCard, tariffMissing && styles.priceCardError]}>
              <Text style={styles.priceCardLabel}>
                {fromName} → {toName}
              </Text>
              {tariffMissing ? (
                <Text style={styles.priceCardMissing}>Тариф не настроен</Text>
              ) : (
                <Text style={styles.priceCardValue}>{displayedPrice} сом</Text>
              )}
            </View>
          )}

          {fromId !== null && toId !== null && !tariffMissing && (
            <>
              <TouchableOpacity
                style={[styles.roundTripRow, isRoundTrip && styles.roundTripRowActive]}
                onPress={() => setIsRoundTrip((v) => !v)}
                activeOpacity={0.7}
              >
                <View style={[styles.checkbox, isRoundTrip && styles.checkboxActive]}>
                  {isRoundTrip && (
                    <Icon name="check" size={16} color={ClientColors.white} strokeWidth={3} />
                  )}
                </View>
                <Text style={styles.roundTripLabel}>Туда и обратно</Text>
                {isRoundTrip && (
                  <View style={styles.roundTripBadge}>
                    <Text style={styles.roundTripBadgeText}>+{roundTripPct}%</Text>
                  </View>
                )}
              </TouchableOpacity>
              {isRoundTrip && (
                <Text style={styles.roundTripHint}>
                  Водитель ждёт 15-20 минут на месте и везёт обратно
                </Text>
              )}
            </>
          )}
        </View>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.heroButton, !canOrder && styles.heroButtonDisabled]}
            onPress={handleOrder}
            disabled={!canOrder}
            activeOpacity={0.9}
          >
            {loading ? (
              <ActivityIndicator color={ClientColors.white} />
            ) : (
              <>
                <Icon name="car" size={22} color={ClientColors.white} strokeWidth={2} />
                <Text style={styles.heroButtonText}>Заказать</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ClientColors.background,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: ClientColors.border,
    backgroundColor: ClientColors.cardBackground,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    transform: [{ rotate: '180deg' }],
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: ClientColors.dark,
    letterSpacing: -0.2,
  },
  body: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  subtitle: {
    fontSize: 14,
    color: ClientColors.textSecondary,
    marginBottom: 16,
  },
  fromLocked: {
    borderWidth: 1.5,
    borderColor: ClientColors.primaryTint,
    backgroundColor: ClientColors.primaryTint,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  fromLockedLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: ClientColors.primaryDark,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  fromLockedValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  fromLockedValue: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: ClientColors.primaryDark,
  },
  priceCard: {
    backgroundColor: ClientColors.primaryTint,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 16,
    marginTop: 18,
  },
  priceCardError: {
    backgroundColor: '#FFF1F1',
  },
  priceCardLabel: {
    fontSize: 13,
    color: ClientColors.primaryDark,
    fontWeight: '600' as const,
  },
  priceCardValue: {
    fontSize: 32,
    fontWeight: '800' as const,
    color: ClientColors.primaryDark,
    marginTop: 4,
    letterSpacing: -0.5,
  },
  priceCardMissing: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: ClientColors.danger,
    marginTop: 6,
  },
  roundTripRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: ClientColors.border,
    marginTop: 14,
  },
  roundTripRowActive: {
    borderColor: ClientColors.primary,
    backgroundColor: ClientColors.primaryTint,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: ClientColors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  checkboxActive: {
    borderColor: ClientColors.primary,
    backgroundColor: ClientColors.primary,
  },
  roundTripLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600' as const,
    color: ClientColors.dark,
  },
  roundTripBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: ClientColors.primary,
  },
  roundTripBadgeText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: ClientColors.white,
  },
  roundTripHint: {
    fontSize: 12,
    color: ClientColors.primaryDark,
    marginTop: 6,
    paddingHorizontal: 4,
    lineHeight: 16,
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'android' ? 24 : 34,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: ClientColors.border,
    backgroundColor: ClientColors.cardBackground,
  },
  heroButton: {
    backgroundColor: ClientColors.primary,
    borderRadius: 28,
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    shadowColor: ClientColors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  heroButtonDisabled: {
    opacity: 0.5,
  },
  heroButtonText: {
    color: ClientColors.white,
    fontSize: 17,
    fontWeight: '700' as const,
    letterSpacing: 0.2,
  },
});
