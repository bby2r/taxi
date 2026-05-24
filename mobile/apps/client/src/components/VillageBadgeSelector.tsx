import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
} from 'react-native';
import { ClientColors, Region } from '@taxi/shared';
import Icon from './Icon';

interface Props {
  regions: Region[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}

/**
 * Маленький pill сверху главного экрана: «Я в: Кировка ▼». Тап —
 * action sheet с тремя районами. Выбор сразу закрывает. Это даёт
 * one-tap UX на главном (кнопка «Заказ внутри села» знает откуда),
 * но без жёсткой привязки — клиент может за секунду переключить
 * село перед заказом.
 */
export default function VillageBadgeSelector({
  regions,
  selectedId,
  onSelect,
}: Props): React.ReactNode {
  const [open, setOpen] = useState(false);
  const selected = regions.find((r) => r.id === selectedId);

  if (regions.length === 0) {
    return null;
  }

  return (
    <>
      <TouchableOpacity
        style={styles.chip}
        onPress={() => setOpen(true)}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={`Я в ${selected?.name ?? 'не выбрано'}, нажмите чтобы поменять`}
      >
        <Icon name="pin" size={14} color={ClientColors.primaryDark} strokeWidth={2.4} />
        <Text style={styles.chipLabel}>Я в:</Text>
        <Text style={styles.chipValue}>{selected?.name ?? 'выберите'}</Text>
        <Icon name="chevron-down" size={14} color={ClientColors.primaryDark} strokeWidth={2.4} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>Выберите село</Text>
            {regions.map((r) => {
              const active = r.id === selectedId;
              return (
                <TouchableOpacity
                  key={r.id}
                  style={[styles.option, active && styles.optionActive]}
                  onPress={() => {
                    onSelect(r.id);
                    setOpen(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.optionText, active && styles.optionTextActive]}>
                    {r.name}
                  </Text>
                  {active && (
                    <Icon name="check" size={20} color={ClientColors.primary} strokeWidth={2.6} />
                  )}
                </TouchableOpacity>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: ClientColors.primaryTint,
    paddingLeft: 12,
    paddingRight: 10,
    paddingVertical: 8,
    borderRadius: 999,
    marginBottom: 14,
  },
  chipLabel: {
    fontSize: 12,
    color: ClientColors.primaryDark,
    fontWeight: '500' as const,
  },
  chipValue: {
    fontSize: 13,
    color: ClientColors.primaryDark,
    fontWeight: '700' as const,
    marginRight: 2,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(30, 27, 46, 0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: ClientColors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 34,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: ClientColors.dark,
    marginBottom: 12,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 14,
  },
  optionActive: {
    backgroundColor: ClientColors.primaryTint,
  },
  optionText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: ClientColors.dark,
  },
  optionTextActive: {
    color: ClientColors.primaryDark,
  },
});
