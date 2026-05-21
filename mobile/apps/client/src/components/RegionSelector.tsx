import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { ClientColors, Typography, Region } from '@taxi/shared';
import { getRegions } from '../api/regions';

interface RegionSelectorProps {
  visible: boolean;
  onSelect: (regionId: number) => void;
  onClose: () => void;
}

export default function RegionSelector({
  visible,
  onSelect,
  onClose,
}: RegionSelectorProps): React.ReactNode {
  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setLoading(true);
      setError(null);
      getRegions()
        .then(setRegions)
        .catch(() => setError('Не удалось загрузить направления'))
        .finally(() => setLoading(false));
    }
  }, [visible]);

  const renderItem = ({ item }: { item: Region }) => (
    <TouchableOpacity
      style={styles.regionItem}
      onPress={() => onSelect(item.id)}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${item.price} сом`}
    >
      <Text style={[Typography.bodyBold, { color: ClientColors.dark }]}>
        {item.name}
      </Text>
      <Text style={[Typography.h3, { color: ClientColors.primaryDark }]}>
        {item.price} сом
      </Text>
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} transparent animationType="slide">
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View
          style={styles.sheet}
          onStartShouldSetResponder={() => true}
        >
          <View style={styles.handleBar} />
          <Text
            style={[
              Typography.h2,
              { color: ClientColors.dark, marginBottom: 16 },
            ]}
          >
            Межселами
          </Text>

          {loading && (
            <ActivityIndicator
              color={ClientColors.primary}
              size="large"
              style={{ marginVertical: 32 }}
            />
          )}

          {error && (
            <Text
              style={[
                Typography.body,
                {
                  color: ClientColors.danger,
                  textAlign: 'center',
                  marginVertical: 16,
                },
              ]}
            >
              {error}
            </Text>
          )}

          {!loading && !error && regions.length === 0 && (
            <Text
              style={[
                Typography.body,
                {
                  color: ClientColors.textSecondary,
                  textAlign: 'center',
                  marginVertical: 16,
                },
              ]}
            >
              Нет доступных направлений
            </Text>
          )}

          {!loading && !error && regions.length > 0 && (
            <FlatList
              data={regions}
              keyExtractor={(item) => item.id.toString()}
              renderItem={renderItem}
              ItemSeparatorComponent={() => (
                <View style={styles.separator} />
              )}
              style={{ maxHeight: 400 }}
            />
          )}

          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Text
              style={[
                Typography.button,
                { color: ClientColors.textSecondary },
              ]}
            >
              Закрыть
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
    paddingTop: 12,
    paddingBottom: 34,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: ClientColors.border,
    alignSelf: 'center',
    marginBottom: 16,
  },
  regionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 4,
  },
  separator: {
    height: 1,
    backgroundColor: ClientColors.border,
  },
  closeButton: {
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 8,
  },
});
