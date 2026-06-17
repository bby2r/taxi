import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  Animated,
  NativeSyntheticEvent,
  TextInputKeyPressEventData,
} from 'react-native';
import { ClientColors } from '../theme/colors';

interface OtpInputProps {
  length?: number;
  onComplete: (code: string) => void;
  error?: boolean;
}

export default function OtpInput({
  length = 4,
  onComplete,
  error = false,
}: OtpInputProps): React.ReactNode {
  const [values, setValues] = useState<string[]>(Array(length).fill(''));
  const inputRefs = useRef<(TextInput | null)[]>([]);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (error) {
      setValues(Array(length).fill(''));
      inputRefs.current[0]?.focus();
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
      ]).start();
    }
  }, [error, length, shakeAnim]);

  const handleChange = (text: string, index: number) => {
    const digits = text.replace(/[^0-9]/g, '');

    // iOS Messages auto-fill вставляет весь код в первое поле.
    // Распределяем по всем ячейкам и сразу триггерим onComplete.
    if (digits.length > 1 && index === 0) {
      const filled = digits.slice(0, length).split('');
      const newValues = Array(length)
        .fill('')
        .map((_, i) => filled[i] ?? '');
      setValues(newValues);
      const lastIdx = Math.min(filled.length, length) - 1;
      inputRefs.current[lastIdx]?.focus();
      if (newValues.every((v) => v !== '')) {
        onComplete(newValues.join(''));
      }
      return;
    }

    const digit = digits.slice(-1);
    const newValues = [...values];
    newValues[index] = digit;
    setValues(newValues);

    if (digit && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    if (newValues.every((v) => v !== '') && digit) {
      onComplete(newValues.join(''));
    }
  };

  const handleKeyPress = (
    e: NativeSyntheticEvent<TextInputKeyPressEventData>,
    index: number,
  ) => {
    if (e.nativeEvent.key === 'Backspace' && !values[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  return (
    <Animated.View
      style={[styles.container, { transform: [{ translateX: shakeAnim }] }]}
    >
      {values.map((value, index) => (
        <TextInput
          key={index}
          ref={(ref) => {
            inputRefs.current[index] = ref;
          }}
          style={[
            styles.cell,
            value ? styles.cellFilled : null,
            error ? styles.cellError : null,
          ]}
          value={value}
          onChangeText={(text) => handleChange(text, index)}
          onKeyPress={(e) => handleKeyPress(e, index)}
          keyboardType="number-pad"
          maxLength={index === 0 ? length : 1}
          selectTextOnFocus
          textContentType={index === 0 ? 'oneTimeCode' : 'none'}
          autoComplete={index === 0 ? 'sms-otp' : 'off'}
          importantForAutofill={index === 0 ? 'yes' : 'no'}
          accessibilityLabel={`Цифра ${index + 1} из ${length}`}
        />
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  cell: {
    width: 56,
    height: 64,
    borderWidth: 2,
    borderColor: ClientColors.border,
    borderRadius: 12,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '700',
    color: ClientColors.dark,
    backgroundColor: ClientColors.white,
  },
  cellFilled: {
    borderColor: ClientColors.primary,
  },
  cellError: {
    borderColor: ClientColors.danger,
  },
});
