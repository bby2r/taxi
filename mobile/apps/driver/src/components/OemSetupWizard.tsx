import React, { useMemo } from 'react';
import {
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Icon } from '@taxi/shared';
import { ActionButton, DriverColors, Typography } from '@taxi/shared';
import {
  openOemPowerSettings,
  requestIgnoreBatteryOptimizations,
} from '../../modules/offer-overlay/src';

interface Step {
  title: string;
  description: string;
  // Which native action to fire when the driver taps "Открыть настройки".
  // 'oem' goes to the vendor-specific autostart/protected-apps screen,
  // 'standard' goes to the OS battery-optimization toggle.
  action: 'oem' | 'standard' | 'manual';
}

// Per-OEM step lists. Order matters — first step is shown first. Each
// description names the actual MIUI/EMUI/etc. label in quotes so the
// driver knows exactly what to look for after we land them on the
// settings screen (deep-links can't pre-select the row, only the page).
//
// Battery optimisation НЕ входит сюда — она проверяется реально через
// PermissionGate (с зелёной галочкой когда выдано). Раньше она была и
// здесь и там — водитель видел двойную модалку, а в визарде кнопка
// «Готово, я всё настроил» НЕ проверяла фактическое состояние и тупо
// закрывала окно. Оставляем здесь только OEM-specific autostart и
// pin-to-recent шаги — то, что программно проверить нельзя.
const OEM_STEPS: Record<string, Step[]> = {
  xiaomi: [
    {
      title: 'Разрешить автозапуск',
      description:
        'Откройте «Автозапуск» и включите переключатель напротив Alif Taxi. Без этого MIUI выгружает приложение через 5 минут.',
      action: 'oem',
    },
    {
      title: 'Закрепить в недавних',
      description:
        'Откройте список недавних приложений (квадратная кнопка снизу), потяните карточку Alif Taxi вниз и нажмите на замок. Это последний рубеж против MIUI.',
      action: 'manual',
    },
  ],
  redmi: [], // filled below
  poco: [],
  huawei: [
    {
      title: 'Защищённые приложения',
      description:
        'Откройте «Запуск приложений» → Alif Taxi → «Управлять вручную» → включите все три переключателя (автозапуск, вторичный запуск, фоновая активность).',
      action: 'oem',
    },
  ],
  honor: [],
  vivo: [
    {
      title: 'Разрешить автозапуск',
      description:
        'Откройте «Управление автозапуском» и включите Alif Taxi. Vivo жёстко режет фон без этого.',
      action: 'oem',
    },
  ],
  iqoo: [],
  oppo: [
    {
      title: 'Стартовый менеджер',
      description:
        'Откройте «Запуск приложений» / «Startup Manager» и включите Alif Taxi. ColorOS блокирует автозапуск по умолчанию.',
      action: 'oem',
    },
  ],
  realme: [],
};

OEM_STEPS.redmi = OEM_STEPS.xiaomi;
OEM_STEPS.poco = OEM_STEPS.xiaomi;
OEM_STEPS.honor = OEM_STEPS.huawei;
OEM_STEPS.iqoo = OEM_STEPS.vivo;
OEM_STEPS.realme = OEM_STEPS.oppo;

// Standard-Android OEMs (Samsung, OnePlus, Pixel, Nothing) — никаких
// OEM-специфичных шагов не нужно, battery optimisation покрывается
// PermissionGate'ом. Пустой массив → визард не открывается вообще
// (`if (!visible || steps.length === 0) return null` ниже).
const GENERIC_STEPS: Step[] = [];

// Manufacturers we know need the OEM-specific autostart dance on top
// of the standard battery toggle. Used by HomeScreen to decide whether
// to show the wizard at first launch.
export const PROBLEMATIC_OEMS = new Set([
  'xiaomi',
  'redmi',
  'poco',
  'huawei',
  'honor',
  'vivo',
  'iqoo',
  'oppo',
  'realme',
]);

interface OemSetupWizardProps {
  visible: boolean;
  manufacturer: string;
  onDone: () => void;
  onSkip: () => void;
}

export default function OemSetupWizard({
  visible,
  manufacturer,
  onDone,
  onSkip,
}: OemSetupWizardProps): React.ReactElement | null {
  const steps = useMemo<Step[]>(() => {
    if (Platform.OS !== 'android') return [];
    return OEM_STEPS[manufacturer.toLowerCase()] ?? GENERIC_STEPS;
  }, [manufacturer]);

  if (!visible || steps.length === 0) return null;

  const oemLabel = manufacturer.charAt(0).toUpperCase() + manufacturer.slice(1).toLowerCase();

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onSkip}>
      {/* Backdrop tap dismisses — otherwise on small screens or render
          glitches the driver could get stuck staring at a grey screen
          with no way out (originally led to the "оффер не открывается"
          bug: an incoming offer card rendered beneath this modal and
          looked like the modal had eaten the whole UI). */}
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onSkip}
      >
        <TouchableOpacity
          style={styles.card}
          activeOpacity={1}
          onPress={() => undefined}
        >
          {/* Close X — explicit escape hatch in addition to the backdrop
              tap and the Android back button (Modal's onRequestClose). */}
          <TouchableOpacity
            onPress={onSkip}
            style={styles.closeBtn}
            hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Закрыть"
          >
            <Icon name="x" size={22} color={DriverColors.textMuted} />
          </TouchableOpacity>
          <Text style={[Typography.h2, styles.title]}>Чтобы не пропускать заказы</Text>
          <Text style={[Typography.body, styles.subtitle]}>
            На устройствах {oemLabel} нужно сделать {steps.length}{' '}
            {steps.length === 1 ? 'шаг' : steps.length < 5 ? 'шага' : 'шагов'}.
            Иначе система выгружает приложение в фоне и заказы не приходят.
          </Text>

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            {steps.map((step, idx) => (
              <View key={idx} style={styles.step}>
                <View style={styles.stepHeader}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>{idx + 1}</Text>
                  </View>
                  <Text style={[Typography.bodyBold, styles.stepTitle]}>
                    {step.title}
                  </Text>
                </View>
                <Text style={[Typography.caption, styles.stepDescription]}>
                  {step.description}
                </Text>
                {step.action !== 'manual' && (
                  <TouchableOpacity
                    style={styles.stepButton}
                    activeOpacity={0.7}
                    onPress={() => {
                      if (step.action === 'oem') {
                        openOemPowerSettings();
                      } else {
                        requestIgnoreBatteryOptimizations();
                      }
                    }}
                  >
                    <Text style={styles.stepButtonText}>Открыть настройки</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity onPress={onSkip} style={styles.skipButton} activeOpacity={0.7} accessibilityRole="button">
              <Text style={[Typography.body, { color: DriverColors.textMuted }]}>
                Не сейчас
              </Text>
            </TouchableOpacity>
            <ActionButton title="Готово, я всё настроил" onPress={onDone} />
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: DriverColors.cardBackground,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 32,
    maxHeight: '85%',
  },
  closeBtn: {
    position: 'absolute',
    top: 10,
    right: 14,
    padding: 4,
    zIndex: 1,
  },
  title: {
    color: DriverColors.textPrimary,
    marginBottom: 6,
  },
  subtitle: {
    color: DriverColors.textMuted,
    marginBottom: 16,
  },
  scroll: {
    flexGrow: 0,
  },
  step: {
    backgroundColor: DriverColors.background,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  stepNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: DriverColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  stepNumberText: {
    color: DriverColors.white,
    fontWeight: '700' as const,
    fontSize: 14,
  },
  stepTitle: {
    color: DriverColors.textPrimary,
    flex: 1,
  },
  stepDescription: {
    color: DriverColors.textMuted,
    marginBottom: 10,
    lineHeight: 18,
  },
  stepButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: DriverColors.primary,
  },
  stepButtonText: {
    color: DriverColors.white,
    fontWeight: '700' as const,
    fontSize: 13,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 12,
  },
  skipButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
});
