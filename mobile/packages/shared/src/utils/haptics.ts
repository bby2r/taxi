import { Platform, Vibration } from 'react-native';

// Очень короткие паттерны вибрации, имитирующие haptic-feedback системы.
// Использован Vibration вместо expo-haptics — нулевой вес на бандл и
// работает на любых сборках. На iOS Vibration ограничен системными
// паттернами, поэтому числовые длительности там игнорируются и срабатывает
// дефолтный «alert» — это ок для тактильного подтверждения.

const ANDROID_LIGHT = 15;
const ANDROID_MEDIUM = 30;
const ANDROID_SUCCESS: number[] = [0, 25, 60, 25];
const ANDROID_WARNING: number[] = [0, 40, 80, 40];
const ANDROID_ERROR: number[] = [0, 60, 70, 60, 70, 60];

export const Haptics = {
  light(): void {
    if (Platform.OS === 'android') {
      Vibration.vibrate(ANDROID_LIGHT);
    } else if (Platform.OS === 'ios') {
      Vibration.vibrate();
    }
  },
  medium(): void {
    if (Platform.OS === 'android') {
      Vibration.vibrate(ANDROID_MEDIUM);
    } else if (Platform.OS === 'ios') {
      Vibration.vibrate();
    }
  },
  success(): void {
    if (Platform.OS === 'android') {
      Vibration.vibrate(ANDROID_SUCCESS);
    } else if (Platform.OS === 'ios') {
      Vibration.vibrate();
    }
  },
  warning(): void {
    if (Platform.OS === 'android') {
      Vibration.vibrate(ANDROID_WARNING);
    } else if (Platform.OS === 'ios') {
      Vibration.vibrate();
    }
  },
  error(): void {
    if (Platform.OS === 'android') {
      Vibration.vibrate(ANDROID_ERROR);
    } else if (Platform.OS === 'ios') {
      Vibration.vibrate();
    }
  },
};
