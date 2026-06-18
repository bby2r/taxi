// Дизайн-токены клиентского приложения. Bolt / Yandex Go стиль:
// чистый белый sheet, тонкая обводка, мягкие двух-уровневые тени,
// pill-chips и крупная brand-CTA. ClientColors / Typography / Spacing /
// Radius приходят из @taxi/shared — здесь только тени, кривые анимаций
// и состояние-зависимые миксы (active states, surface elevations).

import { Platform, ViewStyle, Easing } from 'react-native';
import { ClientColors } from '@taxi/shared';

/**
 * Тени двух уровней:
 *   surface — карточки в потоке (tariff card, history item)
 *   floating — sheet, FAB, активные/выбранные состояния
 *
 * На Android shadow* игнорируется — используем elevation. На iOS
 * elevation игнорируется — используем shadow*. Оба ключа держим
 * вместе чтобы стиль был кросс-платформенным без if'ов в render'ах.
 */
export const Shadow = {
  none: {} as ViewStyle,
  surface: Platform.select({
    ios: {
      shadowColor: '#0F2937',
      shadowOpacity: 0.05,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 3 },
    },
    android: { elevation: 2 },
  }) as ViewStyle,
  floating: Platform.select({
    ios: {
      shadowColor: '#0F2937',
      shadowOpacity: 0.09,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 6 },
    },
    android: { elevation: 6 },
  }) as ViewStyle,
  brandGlow: Platform.select({
    ios: {
      shadowColor: ClientColors.primary,
      shadowOpacity: 0.28,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
    },
    android: { elevation: 5 },
  }) as ViewStyle,
} as const;

/**
 * Premium easing — близко к iOS native + Material Standard. Используется
 * для всех маунт-анимаций, transitions, sheet snaps.
 */
export const Curves = {
  premium: Easing.bezier(0.16, 1, 0.3, 1),
  emphasis: Easing.bezier(0.2, 0, 0, 1),
  decel: Easing.out(Easing.cubic),
} as const;

/**
 * Surface-комбинации для частых паттернов. Если карточка одинаково
 * выглядит в 3 местах — пусть будет одно описание в одном месте.
 */
export const Surfaces = {
  card: {
    backgroundColor: ClientColors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: ClientColors.border,
    ...Shadow.surface,
  } as ViewStyle,
  cardActive: {
    backgroundColor: ClientColors.primaryTint,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: ClientColors.primary,
    ...Shadow.brandGlow,
  } as ViewStyle,
  sheet: {
    backgroundColor: ClientColors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    ...Shadow.floating,
  } as ViewStyle,
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: ClientColors.surfaceMuted,
    borderWidth: 1,
    borderColor: ClientColors.border,
  } as ViewStyle,
  chipActive: {
    backgroundColor: ClientColors.primary,
    borderColor: ClientColors.primary,
  } as ViewStyle,
  fab: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: ClientColors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.floating,
  } as ViewStyle,
} as const;

/**
 * Размеры тап-зон. Никогда меньше 44 (Apple HIG). Используется на
 * скрытых-обводкой touchable (например, иконка в тексте).
 */
export const TouchSize = {
  min: 44,
  comfortable: 48,
  primary: 56,
} as const;
