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
const OEM_STEPS: Record<string, Step[]> = {
  xiaomi: [
    {
      title: 'Разрешить автозапуск',
      description:
        'Откройте «Автозапуск» и включите переключатель напротив AIYL Taxi. Без этого MIUI выгружает приложение через 5 минут.',
      action: 'oem',
    },
    {
      title: 'Отключить экономию батареи',
      description:
        'Откройте «Без ограничений» в разделе расхода батареи. По умолчанию стоит «Экономия батареи» — это убивает приложение в фоне.',
      action: 'standard',
    },
    {
      title: 'Закрепить в недавних',
      description:
        'Откройте список недавних приложений (квадратная кнопка снизу), потяните карточку AIYL Taxi вниз и нажмите на замок. Это последний рубеж против MIUI.',
      action: 'manual',
    },
  ],
  redmi: [], // filled below
  poco: [],
  huawei: [
    {
      title: 'Защищённые приложения',
      description:
        'Откройте «Запуск приложений» → AIYL Taxi → «Управлять вручную» → включите все три переключателя (автозапуск, вторичный запуск, фоновая активность).',
      action: 'oem',
    },
    {
      title: 'Отключить экономию батареи',
      description:
        'Откройте экран батареи и выберите «Без ограничений» для AIYL Taxi.',
      action: 'standard',
    },
  ],
  honor: [],
  vivo: [
    {
      title: 'Разрешить автозапуск',
      description:
        'Откройте «Управление автозапуском» и включите AIYL Taxi. Vivo жёстко режет фон без этого.',
      action: 'oem',
    },
    {
      title: 'Высокое потребление разрешено',
      description:
        'В настройках батареи установите AIYL Taxi → «Не ограничивать в фоне».',
      action: 'standard',
    },
  ],
  iqoo: [],
  oppo: [
    {
      title: 'Стартовый менеджер',
      description:
        'Откройте «Запуск приложений» / «Startup Manager» и включите AIYL Taxi. ColorOS блокирует автозапуск по умолчанию.',
      action: 'oem',
    },
    {
      title: 'Отключить экономию батареи',
      description:
        'В настройках батареи AIYL Taxi установите «Не оптимизировать».',
      action: 'standard',
    },
  ],
  realme: [],
};

OEM_STEPS.redmi = OEM_STEPS.xiaomi;
OEM_STEPS.poco = OEM_STEPS.xiaomi;
OEM_STEPS.honor = OEM_STEPS.huawei;
OEM_STEPS.iqoo = OEM_STEPS.vivo;
OEM_STEPS.realme = OEM_STEPS.oppo;

// Standard-Android OEMs — Samsung, OnePlus, Pixel, Nothing, etc.
const GENERIC_STEPS: Step[] = [
  {
    title: 'Отключить экономию батареи',
    description:
      'Откройте «Батарея» для AIYL Taxi и выберите «Без ограничений». Без этого Android может выгрузить приложение когда экран выключен.',
    action: 'standard',
  },
];

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
      <View style={styles.backdrop}>
        <View style={styles.card}>
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
            <TouchableOpacity onPress={onSkip} style={styles.skipButton}>
              <Text style={[Typography.body, { color: DriverColors.textMuted }]}>
                Не сейчас
              </Text>
            </TouchableOpacity>
            <ActionButton title="Готово, я всё настроил" onPress={onDone} />
          </View>
        </View>
      </View>
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
