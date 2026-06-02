import React, { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { MarkerAnimated, AnimatedRegion } from 'react-native-maps';
import Svg, { Path, Rect } from 'react-native-svg';

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
        <Svg width={40} height={40} viewBox="0 0 32 32">
          {/* Жёлтое такси сверху — корпус, стёкла, фары. Та же иконка
              что водитель видит у себя на карте, чтобы визуально было
              «то же самое такси едет ко мне». */}
          <Path
            d="M9 6 Q9 4 11 4 L21 4 Q23 4 23 6 L23 26 Q23 28 21 28 L11 28 Q9 28 9 26 Z"
            fill="#FBBF24"
            stroke="#1F2937"
            strokeWidth={1.2}
          />
          <Path d="M10 7 L22 7 L20.5 11.5 L11.5 11.5 Z" fill="#1F2937" opacity={0.75} />
          <Path d="M11.5 21 L20.5 21 L22 25 L10 25 Z" fill="#1F2937" opacity={0.55} />
          <Rect x={10} y={3.5} width={2.5} height={1} rx={0.5} fill="#FEF3C7" />
          <Rect x={19.5} y={3.5} width={2.5} height={1} rx={0.5} fill="#FEF3C7" />
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
