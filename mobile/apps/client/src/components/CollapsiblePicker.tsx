import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { ClientColors, Region } from '@taxi/shared';
import Icon from './Icon';

// LayoutAnimation для Android требует одноразовой включалки.
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface Props {
  label: string;
  regions: Region[];
  selectedId: number | null;
  expanded: boolean;
  onToggle: () => void;
  onSelect: (id: number) => void;
  /** Скрыть из списка выбора этот id (например, чтобы «Куда» не показывал «Откуда»). */
  excludeId?: number | null;
}

/**
 * Сворачивающийся пикер. Свёрнут — одна строка с лейблом и выбранным
 * значением + шеврон. Раскрыт — список районов под ним; тап на пункт
 * сразу вызывает onSelect и onToggle (родитель сворачивает обратно).
 * Анимация раскрытия через LayoutAnimation — нативно, без RAM-затрат.
 */
export default function CollapsiblePicker({
  label,
  regions,
  selectedId,
  expanded,
  onToggle,
  onSelect,
  excludeId,
}: Props): React.ReactNode {
  const selected = regions.find((r) => r.id === selectedId);
  const visible = regions.filter((r) => r.id !== excludeId);

  const handleToggle = (): void => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    onToggle();
  };

  const handlePick = (id: number): void => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    onSelect(id);
    onToggle();
  };

  return (
    <View style={[styles.wrapper, expanded && styles.wrapperExpanded]}>
      <TouchableOpacity
        style={styles.header}
        onPress={handleToggle}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selected?.name ?? 'не выбрано'}, нажмите чтобы изменить`}
      >
        <Text style={styles.label}>{label}</Text>
        <View style={styles.headerValue}>
          <Text style={styles.value}>{selected?.name ?? '—'}</Text>
          <View style={[styles.chevron, expanded && styles.chevronOpen]}>
            <Icon
              name="chevron-down"
              size={18}
              color={expanded ? ClientColors.primaryDark : ClientColors.textSecondary}
              strokeWidth={2.4}
            />
          </View>
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.list}>
          {visible.map((r) => {
            const active = r.id === selectedId;
            return (
              <TouchableOpacity
                key={r.id}
                style={[styles.option, active && styles.optionActive]}
                onPress={() => handlePick(r.id)}
                activeOpacity={0.7}
              >
                <Text style={[styles.optionText, active && styles.optionTextActive]}>
                  {r.name}
                </Text>
                {active && (
                  <Icon name="check" size={18} color={ClientColors.primary} strokeWidth={2.6} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderWidth: 1.5,
    borderColor: ClientColors.border,
    borderRadius: 16,
    backgroundColor: ClientColors.cardBackground,
    overflow: 'hidden',
  },
  wrapperExpanded: {
    borderColor: ClientColors.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: ClientColors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  headerValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  value: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: ClientColors.dark,
  },
  chevron: {
    transform: [{ rotate: '0deg' }],
  },
  chevronOpen: {
    transform: [{ rotate: '180deg' }],
  },
  list: {
    borderTopWidth: 1,
    borderTopColor: ClientColors.border,
    paddingVertical: 4,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  optionActive: {
    backgroundColor: ClientColors.primaryTint,
  },
  optionText: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: ClientColors.dark,
  },
  optionTextActive: {
    color: ClientColors.primaryDark,
    fontWeight: '700' as const,
  },
});
