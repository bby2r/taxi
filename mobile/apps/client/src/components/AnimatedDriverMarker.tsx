import React, { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { MarkerAnimated, AnimatedRegion } from 'react-native-maps';
import Svg, { Defs, Ellipse, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

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
        <Svg width={56} height={56} viewBox="0 0 56 56">
          {/* Стильное такси сверху — удлинённый седан с градиентом
              янтарного цвета, тонированные стёкла, чёрный таксишный
              значок-шашечки на крыше, лёгкие колёса по бокам. Стиль
              ближе к Яндекс.Pro чем к мультяшным иконкам. */}
          <Defs>
            <LinearGradient id="bodyG" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#FCD34D" />
              <Stop offset="1" stopColor="#D97706" />
            </LinearGradient>
            <LinearGradient id="glassG" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#1E3A8A" stopOpacity={0.9} />
              <Stop offset="1" stopColor="#1E40AF" stopOpacity={0.55} />
            </LinearGradient>
          </Defs>
          {/* Drop shadow ellipse */}
          <Ellipse cx={28} cy={51} rx={16} ry={2.5} fill="#000" opacity={0.3} />
          {/* Wheels (visible as black bars on sides) */}
          <Rect x={14} y={16} width={3} height={8} rx={1.2} fill="#0F172A" />
          <Rect x={39} y={16} width={3} height={8} rx={1.2} fill="#0F172A" />
          <Rect x={14} y={32} width={3} height={8} rx={1.2} fill="#0F172A" />
          <Rect x={39} y={32} width={3} height={8} rx={1.2} fill="#0F172A" />
          {/* Body */}
          <Path
            d="M18 8 Q18 4 22 4 L34 4 Q38 4 38 8 L38 48 Q38 52 34 52 L22 52 Q18 52 18 48 Z"
            fill="url(#bodyG)"
            stroke="#1F2937"
            strokeWidth={1.2}
          />
          {/* Windshield */}
          <Path d="M20 8 L36 8 L34 17 L22 17 Z" fill="url(#glassG)" />
          {/* Rear window */}
          <Path d="M22 39 L34 39 L36 48 L20 48 Z" fill="url(#glassG)" opacity={0.85} />
          {/* Roof — TAXI badge (checkers) */}
          <Rect x={22} y={26} width={12} height={5} rx={0.8} fill="#1F2937" />
          <Rect x={22} y={26} width={3} height={2.5} fill="#FCD34D" />
          <Rect x={28} y={26} width={3} height={2.5} fill="#FCD34D" />
          <Rect x={25} y={28.5} width={3} height={2.5} fill="#FCD34D" />
          <Rect x={31} y={28.5} width={3} height={2.5} fill="#FCD34D" />
          {/* Headlights */}
          <Rect x={19} y={4.5} width={3.5} height={1.5} rx={0.4} fill="#FEF9C3" />
          <Rect x={33.5} y={4.5} width={3.5} height={1.5} rx={0.4} fill="#FEF9C3" />
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
