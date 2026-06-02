import React, { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { MarkerAnimated, AnimatedRegion } from 'react-native-maps';
import Svg, { Ellipse, Path, Circle } from 'react-native-svg';

interface AnimatedDriverMarkerProps {
  coordinate: { latitude: number; longitude: number };
  title?: string;
}

// Minimum movement (in degrees ≈ 3-4 m at Bishkek's latitude) before we
// recompute heading. Below this the GPS noise dominates and the car
// would spin in place every tick.
const MIN_HEADING_DELTA = 0.00003;

/**
 * Smooth driver-position interpolation à la Yandex / Bolt: marker
 * tweens between coordinates over ~1.2 s instead of jumping, and
 * rotates to face the direction of travel computed from the previous
 * fix. Snapping rotation (no tween) keeps the heading stable while the
 * position glides — same trick Yandex Pro uses.
 */
export default function AnimatedDriverMarker({
  coordinate,
  title,
}: AnimatedDriverMarkerProps): React.ReactElement {
  const animatedCoord = useRef(
    new AnimatedRegion({
      latitude: coordinate.latitude,
      longitude: coordinate.longitude,
      latitudeDelta: 0,
      longitudeDelta: 0,
    }),
  ).current;
  const prevCoord = useRef(coordinate);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    const prev = prevCoord.current;
    const dLat = coordinate.latitude - prev.latitude;
    const dLng = coordinate.longitude - prev.longitude;

    // Only update heading when the driver actually moved — otherwise GPS
    // jitter spins the car icon while parked.
    if (Math.abs(dLat) > MIN_HEADING_DELTA || Math.abs(dLng) > MIN_HEADING_DELTA) {
      const heading = computeBearing(prev, coordinate);
      setRotation(heading);
    }

    // react-native-maps' AnimatedRegion.timing accepts {latitude, longitude,
    // duration} directly at runtime, but its bundled type stub inherits
    // Animated.TimingConfig and demands `toValue`. Cast through the loose
    // shape so we don't have to lie with `as never`.
    (
      animatedCoord.timing as unknown as (
        config: {
          latitude: number;
          longitude: number;
          latitudeDelta?: number;
          longitudeDelta?: number;
          duration: number;
          useNativeDriver: boolean;
        },
      ) => { start: () => void }
    )({
      latitude: coordinate.latitude,
      longitude: coordinate.longitude,
      latitudeDelta: 0,
      longitudeDelta: 0,
      duration: 1200,
      useNativeDriver: false,
    }).start();

    prevCoord.current = coordinate;
  }, [coordinate.latitude, coordinate.longitude, animatedCoord]);

  return (
    <MarkerAnimated
      coordinate={animatedCoord}
      title={title}
      anchor={{ x: 0.5, y: 0.5 }}
      // `flat` keeps the marker pinned to the map surface so rotation
      // looks like the car turning (vs swinging like a sign post on iOS
      // when the camera is tilted).
      flat
      rotation={rotation}
      // Marker view changes are only respected when we explicitly bump a
      // tracksViewChanges flag. We turn it off after the first render so
      // every coordinate tween isn't followed by a full re-snapshot of
      // the marker view (kills the smoothness on Android).
      tracksViewChanges={Platform.OS === 'ios' ? false : false}
    >
      <View style={styles.carShadow}>
        <Svg width={44} height={44} viewBox="0 0 48 48">
          {/* Объёмная синяя стрелка-индикатор как у 2GIS Navigator:
              эллипс-тень снизу + две грани (тёмная справа, светлая
              слева) дают ощущение 3D-пирамиды, белая разделительная
              линия + точка-вершина — стиль навигатора, не машинки. */}
          <Ellipse cx={24} cy={34} rx={16} ry={4} fill="#3B82F6" opacity={0.18} />
          <Path d="M24 6 L36 34 L24 28 Z" fill="#1D4ED8" />
          <Path d="M24 6 L12 34 L24 28 Z" fill="#3B82F6" />
          <Path d="M24 6 L24 28" stroke="#fff" strokeWidth={1.2} opacity={0.85} />
          <Circle cx={24} cy={6} r={2.2} fill="#fff" />
        </Svg>
      </View>
    </MarkerAnimated>
  );
}

function computeBearing(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
): number {
  const toRad = (deg: number): number => (deg * Math.PI) / 180;
  const lat1 = toRad(from.latitude);
  const lat2 = toRad(to.latitude);
  const dLng = toRad(to.longitude - from.longitude);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  const bearing = (Math.atan2(y, x) * 180) / Math.PI;
  return (bearing + 360) % 360;
}

const styles = StyleSheet.create({
  carShadow: {
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 8,
  },
});
