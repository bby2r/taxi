import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

/**
 * Shared SVG icon set for both apps.
 *
 * Why SVG and not `@expo/vector-icons`: on Expo SDK 54 (RN 0.81, new
 * architecture) the vector-icon FONT glyphs render blank in release
 * APKs — runtime Font.loadAsync / loadFont() and build-time font
 * embedding both failed to register the family with Fabric's text
 * layer, so every icon showed as empty space. SVG paths are drawn
 * directly by react-native-svg with no font loading, no isLoaded race
 * and no family-name matching, so they always paint on first render.
 *
 * Glyph names mirror the original Feather / Ionicons names that were in
 * use, so call sites only swap the component (`<Feather>` → `<Icon>`).
 * Paths are the genuine Feather / Ionicons outlines (24×24, stroke).
 */
export type IconName =
  | 'home-outline'
  | 'bus-outline'
  | 'time-outline'
  | 'person-outline'
  | 'crosshair'
  | 'bar-chart-2'
  | 'alert-triangle'
  | 'phone'
  | 'check'
  | 'check-circle'
  | 'navigation'
  | 'truck'
  | 'map-pin'
  | 'x'
  | 'message-circle';

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
  style?: StyleProp<ViewStyle>;
}

function Icon({
  name,
  size = 24,
  color = '#0E1D24',
  strokeWidth = 2,
  style,
}: IconProps): React.ReactElement | null {
  const props = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none' as const,
    stroke: color,
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    style,
  };

  switch (name) {
    case 'home-outline':
      return (
        <Svg {...props}>
          <Path d="M3 9.5L12 3l9 6.5" />
          <Path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9" />
          <Path d="M9.5 20v-6h5v6" />
        </Svg>
      );
    case 'bus-outline':
      return (
        <Svg {...props}>
          <Path d="M6 16V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v10" />
          <Path d="M6 11h12" />
          <Path d="M6 16h12" />
          <Circle cx="9" cy="18.5" r="1.4" fill={color} />
          <Circle cx="15" cy="18.5" r="1.4" fill={color} />
        </Svg>
      );
    case 'time-outline':
      return (
        <Svg {...props}>
          <Circle cx="12" cy="12" r="9" />
          <Path d="M12 7v5l3.5 2" />
        </Svg>
      );
    case 'person-outline':
      return (
        <Svg {...props}>
          <Circle cx="12" cy="8" r="4" />
          <Path d="M4 21c0-4 3.5-7 8-7s8 3 8 7" />
        </Svg>
      );
    case 'crosshair':
      return (
        <Svg {...props}>
          <Circle cx="12" cy="12" r="9" />
          <Path d="M12 2v5M12 17v5M2 12h5M17 12h5" />
        </Svg>
      );
    case 'bar-chart-2':
      return (
        <Svg {...props}>
          <Path d="M18 20V10M12 20V4M6 20v-7" />
        </Svg>
      );
    case 'alert-triangle':
      return (
        <Svg {...props}>
          <Path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
          <Path d="M12 9v4" />
          <Circle cx="12" cy="17" r="0.6" fill={color} stroke="none" />
        </Svg>
      );
    case 'phone':
      return (
        <Svg {...props}>
          <Path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
        </Svg>
      );
    case 'check':
      return (
        <Svg {...props}>
          <Path d="M20 6 9 17l-5-5" />
        </Svg>
      );
    case 'check-circle':
      return (
        <Svg {...props}>
          <Path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <Path d="M22 4 12 14.01l-3-3" />
        </Svg>
      );
    case 'navigation':
      return (
        <Svg {...props}>
          <Path d="M3 11 22 2 13 21 11 13 3 11z" />
        </Svg>
      );
    case 'truck':
      return (
        <Svg {...props}>
          <Path d="M1 3h15v13H1z" />
          <Path d="M16 8h4l3 3v5h-7V8z" />
          <Circle cx="5.5" cy="18.5" r="2.5" />
          <Circle cx="18.5" cy="18.5" r="2.5" />
        </Svg>
      );
    case 'map-pin':
      return (
        <Svg {...props}>
          <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
          <Circle cx="12" cy="10" r="3" />
        </Svg>
      );
    case 'x':
      return (
        <Svg {...props}>
          <Path d="M18 6 6 18M6 6l12 12" />
        </Svg>
      );
    case 'message-circle':
      return (
        <Svg {...props}>
          <Path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </Svg>
      );
  }

  return null;
}

export default React.memo(Icon);
