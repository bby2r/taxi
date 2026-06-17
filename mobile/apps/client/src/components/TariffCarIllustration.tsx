import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Path, Ellipse, Circle, Rect } from 'react-native-svg';
import { ClientColors } from '@taxi/shared';

interface TariffCarIllustrationProps {
  size?: number;
  style?: StyleProp<ViewStyle>;
}

// Hatchback в 3/4 ракурсе: не профиль и не top-down — лёгкий перспективный
// угол, как в illustration-стиле iOS. Фирменная teal-pearl краска, тёмные
// тонированные стёкла, тонкая хром-окантовка, мягкая floor-shadow.
// Отрисовывается одним SVG (~1.5KB) — без растровых assets, не зависит
// от DPI, читается даже на 32px.

export default function TariffCarIllustration({
  size = 64,
  style,
}: TariffCarIllustrationProps): React.ReactNode {
  const w = size * 1.4;
  const h = size;

  return (
    <View style={[{ width: w, height: h }, style]}>
      <Svg width={w} height={h} viewBox="0 0 140 100" style={styles.svg}>
        <Defs>
          <LinearGradient id="body" x1="0.2" y1="0" x2="0.8" y2="1">
            <Stop offset="0" stopColor="#5EEAD4" />
            <Stop offset="0.45" stopColor={ClientColors.primary} />
            <Stop offset="1" stopColor={ClientColors.primaryDark} />
          </LinearGradient>
          <LinearGradient id="hoodHighlight" x1="0.5" y1="0" x2="0.5" y2="1">
            <Stop offset="0" stopColor="#ffffff" stopOpacity="0.65" />
            <Stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </LinearGradient>
          <LinearGradient id="glass" x1="0.5" y1="0" x2="0.5" y2="1">
            <Stop offset="0" stopColor="#0F2C4A" />
            <Stop offset="1" stopColor="#1E3A5F" stopOpacity="0.85" />
          </LinearGradient>
          <LinearGradient id="wheelRim" x1="0.5" y1="0" x2="0.5" y2="1">
            <Stop offset="0" stopColor="#94A3B8" />
            <Stop offset="1" stopColor="#475569" />
          </LinearGradient>
        </Defs>

        {/* Floor shadow — soft contact shadow под машиной */}
        <Ellipse cx="70" cy="90" rx="50" ry="5" fill="#0B1220" opacity="0.22" />

        {/* Кузов: чуть приподнятый hatchback-силуэт с плавной C-стойкой */}
        <Path
          d="M18 70
             Q18 52 28 48
             L46 32 Q52 26 62 26
             L96 26 Q108 26 116 36
             L126 50 L126 64
             Q126 72 118 72
             L24 72 Q18 72 18 70 Z"
          fill="url(#body)"
        />

        {/* Hood highlight — отражение неба на капоте */}
        <Path
          d="M48 36 L92 32 L100 38 L52 42 Z"
          fill="url(#hoodHighlight)"
          opacity="0.55"
        />

        {/* Чёрная полоса под окнами (window-belt) — визуально отделяет
            стекло от кузова и даёт «дорогой» вид */}
        <Path
          d="M44 44 L106 38 L114 44 L46 50 Z"
          fill="#0B1220"
          opacity="0.55"
        />

        {/* Лобовое + боковое стёкла объединены одной формой с дугой */}
        <Path
          d="M48 44
             L54 32 Q58 28 64 28
             L96 28 Q102 28 106 34
             L112 44
             L104 46
             Q100 36 92 36
             L62 36 Q56 36 54 44 Z"
          fill="url(#glass)"
        />

        {/* Lens highlight — диагональный блик на лобовом */}
        <Path
          d="M56 36 L70 32 L66 40 L54 42 Z"
          fill="#ffffff"
          opacity="0.18"
        />

        {/* Door handle — тонкая горизонтальная chrome-полоска */}
        <Rect x="74" y="58" width="14" height="2" rx="1" fill="#E2E8F0" opacity="0.75" />

        {/* Передняя фара — каплевидная LED */}
        <Path
          d="M118 56 L126 56 L124 62 L116 60 Z"
          fill="#FEF9C3"
        />
        <Circle cx="121" cy="58" r="1.5" fill="#ffffff" />

        {/* Задняя стоп-сигналь — узкая красная */}
        <Rect x="18" y="56" width="6" height="4" rx="1.5" fill="#EF4444" />

        {/* Колёсные арки — затемнения */}
        <Circle cx="42" cy="72" r="14" fill="#0B1220" opacity="0.4" />
        <Circle cx="106" cy="72" r="14" fill="#0B1220" opacity="0.4" />

        {/* Колёса с металлик-обводкой */}
        <Circle cx="42" cy="74" r="10" fill="#0F172A" stroke="url(#wheelRim)" strokeWidth="1.2" />
        <Circle cx="42" cy="74" r="4" fill="url(#wheelRim)" />
        <Circle cx="42" cy="74" r="1.5" fill="#0F172A" />

        <Circle cx="106" cy="74" r="10" fill="#0F172A" stroke="url(#wheelRim)" strokeWidth="1.2" />
        <Circle cx="106" cy="74" r="4" fill="url(#wheelRim)" />
        <Circle cx="106" cy="74" r="1.5" fill="#0F172A" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  svg: {
    overflow: 'visible',
  },
});
