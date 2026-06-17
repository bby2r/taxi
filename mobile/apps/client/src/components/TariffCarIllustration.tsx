import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Path, Ellipse, Circle, G } from 'react-native-svg';
import { ClientColors } from '@taxi/shared';

interface TariffCarIllustrationProps {
  size?: number;
  style?: StyleProp<ViewStyle>;
}

// Sleek executive-sedan в строгом профиле. Минимум линий, длинная
// низкая roofline, компактные колёса (~1/4 высоты кузова) — пресс-фото
// silhouette в духе BMW 5 / Audi A6, а не мультяшная игрушка.
// Один основной градиент кузова, тонкий window-belt, едва заметная
// floor-shadow. Никаких ярких бликов — премиум-сдержанно.

export default function TariffCarIllustration({
  size = 64,
  style,
}: TariffCarIllustrationProps): React.ReactNode {
  const w = size * 2;
  const h = size;

  return (
    <View style={[{ width: w, height: h }, style]}>
      <Svg width={w} height={h} viewBox="0 0 200 100" style={styles.svg}>
        <Defs>
          <LinearGradient id="body" x1="0.5" y1="0" x2="0.5" y2="1">
            <Stop offset="0" stopColor={ClientColors.primary} />
            <Stop offset="0.55" stopColor={ClientColors.primaryDark} />
            <Stop offset="1" stopColor="#0A6B5E" />
          </LinearGradient>
          <LinearGradient id="bodyHi" x1="0.5" y1="0" x2="0.5" y2="1">
            <Stop offset="0" stopColor="#ffffff" stopOpacity="0.35" />
            <Stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </LinearGradient>
          <LinearGradient id="glass" x1="0.5" y1="0" x2="0.5" y2="1">
            <Stop offset="0" stopColor="#0B1220" />
            <Stop offset="1" stopColor="#1A2438" />
          </LinearGradient>
          <LinearGradient id="rim" x1="0.5" y1="0" x2="0.5" y2="1">
            <Stop offset="0" stopColor="#D1D5DB" />
            <Stop offset="0.5" stopColor="#6B7280" />
            <Stop offset="1" stopColor="#374151" />
          </LinearGradient>
        </Defs>

        {/* Floor shadow — узкая тёмная полоса под машиной */}
        <Ellipse cx="100" cy="86" rx="78" ry="3" fill="#0B1220" opacity="0.22" />

        {/* Кузов sedan: длинный, низкий, с обтекаемой крышей.
            Передний свес короче заднего (premium-седан пропорции). */}
        <Path
          d="M14 70
             L14 60
             Q14 52 22 50
             L48 46
             Q56 38 70 36
             L132 32
             Q146 32 154 40
             L182 46
             Q188 48 188 56
             L188 70
             Q188 74 184 74
             L18 74
             Q14 74 14 70 Z"
          fill="url(#body)"
        />

        {/* Roof highlight — тонкое отражение неба */}
        <Path
          d="M58 38 L132 34 Q138 34 142 38 L138 42 L62 46 Z"
          fill="url(#bodyHi)"
        />

        {/* Window-belt — тонкая тёмная линия между стёклами и низом кузова */}
        <Path
          d="M48 47 L154 41 L156 45 L50 51 Z"
          fill="#0A0F1F"
          opacity="0.5"
        />

        {/* Стёкла — единая стеклянная лента, premium-tinted */}
        <Path
          d="M58 46
             Q62 39 72 38
             L130 35
             Q140 35 148 41
             L142 44
             Q138 40 130 40
             L72 43
             Q66 44 62 47 Z"
          fill="url(#glass)"
        />

        {/* Тонкий blacked-out trim под порогом — даёт ощущение «опущенной» подвески */}
        <Path
          d="M22 68 L180 68 L180 72 L22 72 Z"
          fill="#0A0F1F"
          opacity="0.32"
        />

        {/* Door cut-line — одна тонкая вертикальная линия по борту */}
        <Path
          d="M100 50 L100 70"
          stroke="#0A0F1F"
          strokeOpacity="0.18"
          strokeWidth="0.6"
        />

        {/* Door handle — мини-chrome полоска */}
        <Path
          d="M90 56 L114 56"
          stroke="#D1D5DB"
          strokeWidth="1"
          strokeLinecap="round"
          opacity="0.85"
        />

        {/* Передняя фара — узкая LED-щёлка */}
        <Path
          d="M180 56 L188 58 L188 62 L180 62 Z"
          fill="#FEF9C3"
        />

        {/* Задний стоп-сигнал */}
        <Path
          d="M14 58 L20 58 L20 62 L14 62 Z"
          fill="#EF4444"
          opacity="0.85"
        />

        {/* Колёсные арки — тёмные кривые */}
        <Path
          d="M38 72 Q38 60 50 60 Q62 60 62 72"
          fill="#0A0F1F"
          opacity="0.55"
        />
        <Path
          d="M140 72 Q140 60 152 60 Q164 60 164 72"
          fill="#0A0F1F"
          opacity="0.55"
        />

        {/* Колёса: чёрная шина + металлик rim + тонкая центральная гайка.
            Компактные ~12px радиус — premium-пропорции (а не cartoon-крупные). */}
        <G>
          <Circle cx="50" cy="74" r="11" fill="#0F172A" />
          <Circle cx="50" cy="74" r="7" fill="url(#rim)" />
          <Circle cx="50" cy="74" r="2.5" fill="#0F172A" />
          {/* спицы — едва намечены */}
          <Path d="M50 67 L50 81 M43 74 L57 74" stroke="#0F172A" strokeWidth="0.8" opacity="0.7" />
        </G>
        <G>
          <Circle cx="152" cy="74" r="11" fill="#0F172A" />
          <Circle cx="152" cy="74" r="7" fill="url(#rim)" />
          <Circle cx="152" cy="74" r="2.5" fill="#0F172A" />
          <Path d="M152 67 L152 81 M145 74 L159 74" stroke="#0F172A" strokeWidth="0.8" opacity="0.7" />
        </G>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  svg: {
    overflow: 'visible',
  },
});
