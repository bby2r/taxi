import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';

interface RatingBadgeProps {
  avg: number | null;
  count: number;
  // Размеры адаптируются под три кейса:
  //   compact — в карточке водителя (рядом с именем), inline-pill
  //   medium  — в профиле водителя, hero-блок
  //   large   — финальный экран оценки
  size?: 'compact' | 'medium' | 'large';
  // Текст «Новый водитель» когда нет оценок. Можно переопределить.
  emptyLabel?: string;
  // Цвет звезды (premium gold по умолчанию).
  starColor?: string;
  // Цвет текста — подстраивается под тему клиента/водителя.
  textColor?: string;
  // Цвет фона пилла. Если undefined — без фона, прозрачный inline.
  pillBackground?: string;
}

const PRESETS = {
  compact: { star: 14, font: 13, gap: 4, padX: 8, padY: 3 },
  medium: { star: 20, font: 18, gap: 6, padX: 12, padY: 6 },
  large: { star: 28, font: 24, gap: 8, padX: 14, padY: 8 },
};

function StarIcon({ size, color }: { size: number; color: string }): React.ReactElement {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M12 3l2.7 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.5 6.5 20.4l1.1-6.3L3 9.7l6.3-.9L12 3z" />
    </Svg>
  );
}

export default function RatingBadge({
  avg,
  count,
  size = 'compact',
  emptyLabel = 'Новый',
  starColor = '#F5B400',
  textColor = '#1E1B2E',
  pillBackground,
}: RatingBadgeProps): React.ReactNode {
  const preset = PRESETS[size];

  const containerStyle = [
    styles.pill,
    {
      gap: preset.gap,
      paddingHorizontal: pillBackground ? preset.padX : 0,
      paddingVertical: pillBackground ? preset.padY : 0,
      backgroundColor: pillBackground ?? 'transparent',
    },
  ];

  if (avg === null || count === 0) {
    return (
      <View style={containerStyle}>
        <StarIcon size={preset.star} color="#D1D5DB" />
        <Text style={[styles.text, { fontSize: preset.font, color: textColor, opacity: 0.7 }]}>
          {emptyLabel}
        </Text>
      </View>
    );
  }

  return (
    <View style={containerStyle}>
      <StarIcon size={preset.star} color={starColor} />
      <Text style={[styles.text, { fontSize: preset.font, color: textColor }]}>
        {avg.toFixed(1)}
      </Text>
      <Text style={[styles.count, { fontSize: Math.max(11, preset.font - 4), color: textColor, opacity: 0.55 }]}>
        ({count})
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  text: {
    fontWeight: '700' as const,
    letterSpacing: -0.2,
  },
  count: {
    fontWeight: '600' as const,
    marginLeft: 1,
  },
});
