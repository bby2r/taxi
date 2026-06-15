import React, { useState, useRef, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Easing,
} from 'react-native';
import { ClientColors, FadeInView, Haptics, PopInView, Radius, Spacing } from '@taxi/shared';
import Icon from './Icon';
import { rateOrder } from '../api/orders';

interface RatingModalProps {
  visible: boolean;
  orderId: number;
  price: number;
  driverName: string;
  onDismiss: () => void;
}

const POSITIVE_TAGS: { key: string; label: string }[] = [
  { key: 'clean', label: 'Чисто в салоне' },
  { key: 'polite', label: 'Вежливый' },
  { key: 'fast', label: 'Быстро доехал' },
  { key: 'safe', label: 'Аккуратно ехал' },
];

const NEGATIVE_TAGS: { key: string; label: string }[] = [
  { key: 'late', label: 'Опоздал' },
  { key: 'rude', label: 'Грубый' },
  { key: 'dirty', label: 'Грязно' },
  { key: 'smoking', label: 'Курил' },
];

// Звезда с pop-анимацией при тапе. Premium тактильное ощущение — пульс
// каждой при выборе.
function Star({
  filled,
  onPress,
  index,
}: {
  filled: boolean;
  onPress: () => void;
  index: number;
}): React.ReactNode {
  const scale = useRef(new Animated.Value(1)).current;
  const prevFilledRef = useRef(filled);

  useEffect(() => {
    if (filled && !prevFilledRef.current) {
      // pop-in только при ВКЛЮЧЕНИИ — иначе на каждом ререндере дёргается
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.25,
          duration: 110,
          delay: index * 35,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          damping: 10,
          stiffness: 240,
          mass: 0.7,
          useNativeDriver: true,
        }),
      ]).start();
    }
    prevFilledRef.current = filled;
  }, [filled, index, scale]);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
      accessibilityRole="button"
      accessibilityLabel={`${index + 1} ${index === 0 ? 'звезда' : 'звёзд'}`}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <Icon
          name={filled ? 'star-filled' : 'star'}
          size={42}
          color={filled ? '#F5B400' : ClientColors.border}
          strokeWidth={1.8}
        />
      </Animated.View>
    </TouchableOpacity>
  );
}

export default function RatingModal({
  visible,
  orderId,
  price,
  driverName,
  onDismiss,
}: RatingModalProps): React.ReactNode {
  const [rating, setRating] = useState<number>(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (visible) {
      setRating(0);
      setSelectedTags([]);
      setSubmitted(false);
    }
  }, [visible]);

  const tagPool = rating >= 4 ? POSITIVE_TAGS : rating > 0 ? NEGATIVE_TAGS : [];

  const handleStar = (value: number): void => {
    Haptics.light();
    setRating(value);
    // Меняем «полярность» оценки — сбрасываем теги предыдущей категории
    if ((value >= 4) !== (rating >= 4)) {
      setSelectedTags([]);
    }
  };

  const toggleTag = (key: string): void => {
    Haptics.light();
    setSelectedTags((prev) =>
      prev.includes(key) ? prev.filter((t) => t !== key) : [...prev, key],
    );
  };

  const handleSubmit = async (): Promise<void> => {
    if (rating === 0 || submitting) return;
    setSubmitting(true);
    try {
      await rateOrder(orderId, rating, selectedTags);
      Haptics.success();
      setSubmitted(true);
      // Через 1.4 сек закрываем — даём посмотреть благодарность
      setTimeout(onDismiss, 1400);
    } catch {
      Haptics.error();
      setSubmitting(false);
    }
  };

  const handleSkip = (): void => {
    Haptics.light();
    onDismiss();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleSkip}>
      <View style={styles.overlay}>
        <PopInView style={styles.content}>
          {submitted ? (
            <FadeInView style={styles.thanksBlock}>
              <View style={styles.thanksBadge}>
                <Icon name="check" size={36} color={ClientColors.white} strokeWidth={2.5} />
              </View>
              <Text style={styles.thanksTitle}>Спасибо за оценку!</Text>
              <Text style={styles.thanksSubtitle}>
                Ваш отзыв помогает нам делать поездки лучше
              </Text>
            </FadeInView>
          ) : (
            <>
              <View style={styles.priceBlock}>
                <Text style={styles.priceLabel}>К оплате водителю</Text>
                <Text style={styles.priceValue}>
                  {price} <Text style={styles.priceCurrency}>сом</Text>
                </Text>
              </View>

              <View style={styles.divider} />

              <Text style={styles.title}>Оцените поездку</Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                Водитель — {driverName}
              </Text>

              <View style={styles.stars}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star
                    key={n}
                    index={n - 1}
                    filled={n <= rating}
                    onPress={() => handleStar(n)}
                  />
                ))}
              </View>

              {rating > 0 && (
                <FadeInView style={styles.tagsBlock} translateY={8} duration={280}>
                  <Text style={styles.tagsLabel}>
                    {rating >= 4 ? 'Что понравилось?' : 'Что было не так?'}
                  </Text>
                  <View style={styles.tagsGrid}>
                    {tagPool.map((tag) => {
                      const active = selectedTags.includes(tag.key);
                      return (
                        <TouchableOpacity
                          key={tag.key}
                          style={[styles.tag, active && styles.tagActive]}
                          onPress={() => toggleTag(tag.key)}
                          activeOpacity={0.7}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: active }}
                          accessibilityLabel={tag.label}
                        >
                          <Text style={[styles.tagText, active && styles.tagTextActive]}>
                            {tag.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </FadeInView>
              )}

              <TouchableOpacity
                style={[styles.submitButton, (rating === 0 || submitting) && styles.submitDisabled]}
                onPress={handleSubmit}
                disabled={rating === 0 || submitting}
                activeOpacity={0.9}
                accessibilityRole="button"
                accessibilityLabel="Отправить оценку"
                accessibilityState={{ disabled: rating === 0 || submitting, busy: submitting }}
              >
                {submitting ? (
                  <ActivityIndicator color={ClientColors.white} />
                ) : (
                  <Text style={styles.submitText}>Отправить</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.skipButton}
                onPress={handleSkip}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Пропустить оценку"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.skipText}>Пропустить</Text>
              </TouchableOpacity>
            </>
          )}
        </PopInView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(20, 18, 32, 0.62)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  content: {
    backgroundColor: ClientColors.white,
    borderRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 20,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 14,
  },
  priceBlock: {
    alignItems: 'center',
    paddingTop: 4,
    paddingBottom: 18,
  },
  priceLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: ClientColors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  priceValue: {
    fontSize: 42,
    fontWeight: '700' as const,
    color: ClientColors.primaryDark,
    letterSpacing: -0.8,
  },
  priceCurrency: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: ClientColors.textSecondary,
  },
  divider: {
    height: 1,
    width: '100%',
    backgroundColor: ClientColors.border,
    marginBottom: 22,
    opacity: 0.5,
  },
  title: {
    fontSize: 19,
    fontWeight: '700' as const,
    color: ClientColors.dark,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    color: ClientColors.textSecondary,
    marginTop: 4,
    marginBottom: 20,
    maxWidth: '90%',
    textAlign: 'center',
  },
  stars: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  tagsBlock: {
    width: '100%',
    marginTop: 18,
    alignItems: 'center',
  },
  tagsLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: ClientColors.textSecondary,
    marginBottom: 10,
  },
  tagsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  tag: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: Radius.round,
    backgroundColor: ClientColors.background,
    borderWidth: 1,
    borderColor: ClientColors.border,
  },
  tagActive: {
    backgroundColor: ClientColors.primaryTint,
    borderColor: ClientColors.primary,
  },
  tagText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: ClientColors.textSecondary,
  },
  tagTextActive: {
    color: ClientColors.primaryDark,
  },
  submitButton: {
    marginTop: 22,
    backgroundColor: ClientColors.primary,
    borderRadius: 26,
    height: 52,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: ClientColors.primary,
    shadowOpacity: 0.32,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  submitDisabled: {
    opacity: 0.4,
    shadowOpacity: 0,
  },
  submitText: {
    color: ClientColors.white,
    fontSize: 16,
    fontWeight: '700' as const,
    letterSpacing: 0.2,
  },
  skipButton: {
    marginTop: 12,
    paddingVertical: Spacing.sm,
  },
  skipText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: ClientColors.textMuted,
  },
  thanksBlock: {
    alignItems: 'center',
    paddingVertical: 18,
  },
  thanksBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: ClientColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    shadowColor: ClientColors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  thanksTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: ClientColors.dark,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  thanksSubtitle: {
    fontSize: 14,
    color: ClientColors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
    maxWidth: 280,
  },
});
