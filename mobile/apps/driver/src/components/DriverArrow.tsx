import React from 'react';
import { StyleSheet, View } from 'react-native';
import { DriverColors } from '@taxi/shared';

interface DriverArrowProps {
  // Degrees clockwise from north. Pass null/undefined to render as a
  // bare circle (when heading isn't known yet — fresh GPS fix, indoor).
  heading?: number | null;
  // Online state: green stroke when in shift, gray when out.
  online?: boolean;
}

/**
 * Yandex-style driver puck. White-bordered teardrop arrow on top of a
 * brand-colored circular base, rotated to face the driver's heading
 * (or just a pulsing circle if we don't have heading yet).
 *
 * Wraps the inner shape so the rotation can be applied to one transform
 * without re-laying out the children — the arrow body stays centered
 * over the geo-anchor of the parent PointAnnotation.
 */
function DriverArrowComponent({
  heading,
  online = true,
}: DriverArrowProps): React.ReactElement {
  const hasHeading = typeof heading === 'number' && Number.isFinite(heading) && heading >= 0;
  return (
    <View style={styles.container} pointerEvents="none">
      {/* Soft halo behind the marker — gives the puck visual lift on
          dark navigation tiles and softens the white border edge. */}
      <View style={styles.halo} />
      {hasHeading ? (
        <View
          style={[
            styles.arrowWrap,
            { transform: [{ rotate: `${heading}deg` }] },
          ]}
        >
          <View style={[styles.arrowTriangle, !online && styles.arrowTriangleOffline]} />
        </View>
      ) : null}
      <View style={[styles.circle, online ? styles.circleOnline : styles.circleOffline]} />
    </View>
  );
}

const SIZE = 40;
const CIRCLE = 18;

const styles = StyleSheet.create({
  container: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: 'rgba(251, 191, 36, 0.18)',
  },
  // arrowWrap is what we rotate — the triangle inside is offset upward
  // from the circle's center so the tip points away from the body.
  arrowWrap: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
  },
  // CSS triangle pointing up. With the wrap rotated `heading` degrees,
  // the tip ends up pointing in the bearing direction.
  arrowTriangle: {
    width: 0,
    height: 0,
    borderLeftWidth: 9,
    borderRightWidth: 9,
    borderBottomWidth: 16,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: DriverColors.primary,
    marginTop: 2,
  },
  arrowTriangleOffline: {
    borderBottomColor: '#9CA3AF',
  },
  circle: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    borderWidth: 3,
    borderColor: '#fff',
  },
  circleOnline: {
    backgroundColor: DriverColors.primary,
  },
  circleOffline: {
    backgroundColor: '#9CA3AF',
  },
});

const DriverArrow = React.memo(DriverArrowComponent);
export default DriverArrow;
