import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

// Curated icon set for the client app. Replaces inline emojis
// (🚕 🌍 🎉 ⚠️ 🚫 etc.) — emojis are platform-rendered, look
// different on every device, fight against the app's typography,
// and read as "casual messaging app". Vector icons read as a real
// product. Single component keeps the surface tiny — add icons by
// name as the app grows.

export type IconName =
  | 'car'           // Hero "Order taxi" button
  | 'globe'         // Region selector chip
  | 'check'         // Completion modal
  | 'alert'         // Error pill
  | 'ban'           // Cancellation toast
  | 'phone'         // Call driver / support
  | 'pin'           // Map pin / location
  | 'user'          // Profile placeholder
  | 'note'          // Comment field
  | 'arrow-right'  // CTA button trailing icon
  | 'logout'
  | 'shield'        // Privacy
  | 'message'       // WhatsApp support
  | 'chevron-right'
  | 'chevron-down'  // Picker collapse/expand
  | 'chevron-up'    // Peek-bar expand hint
  | 'clock'         // History
  | 'route'         // Trip / inter-village
  | 'star'          // Rating outline
  | 'star-filled'   // Rating active
  | 'car-side'      // Driver card illustration
  | 'spark';        // Brand mark

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export default function Icon({
  name,
  size = 24,
  color = 'currentColor',
  strokeWidth = 2,
}: IconProps): React.ReactElement {
  const stroke = color;
  const fill = 'none';
  const props = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill,
    stroke,
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  switch (name) {
    case 'car':
      return (
        <Svg {...props}>
          <Path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11" />
          <Path d="M3 17v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a1 1 0 0 1-1 1h-2" />
          <Path d="M6 18H4a1 1 0 0 1-1-1" />
          <Path d="M3 18v2h3v-2M18 18v2h3v-2" />
          <Circle cx="7" cy="14.5" r="1" fill={stroke} />
          <Circle cx="17" cy="14.5" r="1" fill={stroke} />
        </Svg>
      );
    case 'globe':
      return (
        <Svg {...props}>
          <Circle cx="12" cy="12" r="9" />
          <Path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
        </Svg>
      );
    case 'check':
      return (
        <Svg {...props}>
          <Circle cx="12" cy="12" r="9.5" />
          <Path d="M8 12.5l3 3 5-6" />
        </Svg>
      );
    case 'alert':
      return (
        <Svg {...props}>
          <Path d="M12 3l10 17H2L12 3z" />
          <Path d="M12 10v5" />
          <Circle cx="12" cy="18" r="0.5" fill={stroke} />
        </Svg>
      );
    case 'ban':
      return (
        <Svg {...props}>
          <Circle cx="12" cy="12" r="9.5" />
          <Path d="M5.5 5.5l13 13" />
        </Svg>
      );
    case 'phone':
      return (
        <Svg {...props}>
          <Path d="M5 4h3l2 5-2.5 1.5a11 11 0 0 0 6 6L15 14l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />
        </Svg>
      );
    case 'pin':
      return (
        <Svg {...props}>
          <Path d="M12 22s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12z" />
          <Circle cx="12" cy="10" r="2.5" />
        </Svg>
      );
    case 'user':
      return (
        <Svg {...props}>
          <Circle cx="12" cy="8" r="4" />
          <Path d="M4 21c0-4 3.5-7 8-7s8 3 8 7" />
        </Svg>
      );
    case 'note':
      return (
        <Svg {...props}>
          <Path d="M5 4h11l3 3v13H5z" />
          <Path d="M16 4v3h3M9 12h7M9 16h5" />
        </Svg>
      );
    case 'arrow-right':
      return (
        <Svg {...props}>
          <Path d="M5 12h14M13 6l6 6-6 6" />
        </Svg>
      );
    case 'logout':
      return (
        <Svg {...props}>
          <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <Path d="M16 17l5-5-5-5M21 12H9" />
        </Svg>
      );
    case 'shield':
      return (
        <Svg {...props}>
          <Path d="M12 3l8 3v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-3z" />
        </Svg>
      );
    case 'message':
      return (
        <Svg {...props}>
          <Path d="M21 12a8 8 0 1 1-3.6-6.6L21 4l-1.4 3.6A8 8 0 0 1 21 12z" />
        </Svg>
      );
    case 'chevron-right':
      return (
        <Svg {...props}>
          <Path d="M9 6l6 6-6 6" />
        </Svg>
      );
    case 'chevron-down':
      return (
        <Svg {...props}>
          <Path d="M6 9l6 6 6-6" />
        </Svg>
      );
    case 'chevron-up':
      return (
        <Svg {...props}>
          <Path d="M6 15l6-6 6 6" />
        </Svg>
      );
    case 'clock':
      return (
        <Svg {...props}>
          <Circle cx="12" cy="12" r="9" />
          <Path d="M12 7v5l3.5 2" />
        </Svg>
      );
    case 'route':
      return (
        <Svg {...props}>
          <Circle cx="6" cy="6" r="2.5" />
          <Circle cx="18" cy="18" r="2.5" />
          <Path d="M8.5 6h6a3.5 3.5 0 0 1 0 7H9.5a3.5 3.5 0 0 0 0 7H15.5" />
        </Svg>
      );
    case 'star':
      return (
        <Svg {...props}>
          <Path d="M12 3l2.7 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.5 6.5 20.4l1.1-6.3L3 9.7l6.3-.9L12 3z" />
        </Svg>
      );
    case 'star-filled':
      return (
        <Svg {...props} fill={stroke}>
          <Path d="M12 3l2.7 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.5 6.5 20.4l1.1-6.3L3 9.7l6.3-.9L12 3z" />
        </Svg>
      );
    case 'car-side':
      // Стилизованный седан в профиль: плавный roofline, чёткие колёсные
      // арки, окно с поясной линией. Без лишних деталей — silhouette,
      // которая читается даже на ~40px размере.
      return (
        <Svg {...props} viewBox="0 0 64 32">
          <Path d="M4 22h56v3a1 1 0 0 1-1 1h-3a4 4 0 0 0-8 0H20a4 4 0 0 0-8 0H6a2 2 0 0 1-2-2v-2z" fill={stroke} stroke="none" />
          <Path d="M6 22l3-9a4 4 0 0 1 3.8-2.8h21l11 5.5 9.2 1.5a3 3 0 0 1 2.5 3V22" fill={stroke} stroke="none" />
          <Path d="M14 13l2-3h12l2 3v3H14z" fill="#ffffff" opacity="0.95" stroke="none" />
          <Path d="M33 11l8 4h-8z" fill="#ffffff" opacity="0.95" stroke="none" />
          <Circle cx="16" cy="26" r="4" fill="#1a1a1a" stroke="none" />
          <Circle cx="16" cy="26" r="1.6" fill={stroke} stroke="none" />
          <Circle cx="48" cy="26" r="4" fill="#1a1a1a" stroke="none" />
          <Circle cx="48" cy="26" r="1.6" fill={stroke} stroke="none" />
        </Svg>
      );
    case 'spark':
      return (
        <Svg {...props}>
          <Path d="M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6L12 3z" />
        </Svg>
      );
  }
}
