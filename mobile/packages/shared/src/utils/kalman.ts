/**
 * 2-D constant-velocity Kalman filter for GPS tracks, in a local
 * east/north meter frame anchored at the first fix.
 *
 * Raw phone GPS is noisy (±3-10 m) and only ~1 Hz. Centering a heading-up
 * navigation camera straight on raw fixes makes the world shake: the
 * instantaneous course (point-to-point bearing, route tangent, or the
 * device's reported heading) swings tens of degrees on a single jittery
 * reading, so the map spins around the car. This filter fuses the fixes
 * into a smooth position AND a smooth velocity vector; the camera takes its
 * heading from that velocity (`atan2`), which is stable the way 2GIS /
 * Yandex Navigator are. When the car is nearly stopped the velocity
 * direction is meaningless, so `bearing` returns `null` and the caller holds
 * the last heading instead of letting the map spin at a red light.
 *
 * The model is constant-velocity (state = [east, north, vEast, vNorth]);
 * acceleration is treated as process noise. That is the standard,
 * well-behaved choice for vehicle tracking at this update rate.
 */

type Matrix = number[][];

function multiply(a: Matrix, b: Matrix): Matrix {
  const rows = a.length;
  const cols = b[0].length;
  const inner = b.length;
  const out: Matrix = [];
  for (let i = 0; i < rows; i++) {
    out[i] = [];
    for (let j = 0; j < cols; j++) {
      let sum = 0;
      for (let k = 0; k < inner; k++) {
        sum += a[i][k] * b[k][j];
      }
      out[i][j] = sum;
    }
  }
  return out;
}

function transpose(a: Matrix): Matrix {
  const out: Matrix = [];
  for (let j = 0; j < a[0].length; j++) {
    out[j] = [];
    for (let i = 0; i < a.length; i++) {
      out[j][i] = a[i][j];
    }
  }
  return out;
}

function add(a: Matrix, b: Matrix): Matrix {
  return a.map((row, i) => row.map((value, j) => value + b[i][j]));
}

function subtract(a: Matrix, b: Matrix): Matrix {
  return a.map((row, i) => row.map((value, j) => value - b[i][j]));
}

function identity(n: number): Matrix {
  const out: Matrix = [];
  for (let i = 0; i < n; i++) {
    out[i] = [];
    for (let j = 0; j < n; j++) {
      out[i][j] = i === j ? 1 : 0;
    }
  }
  return out;
}

/** Inverse of a 2×2 matrix (the innovation covariance S). */
function invert2(s: Matrix): Matrix {
  const det = s[0][0] * s[1][1] - s[0][1] * s[1][0];
  const d = det === 0 ? 1e-9 : det;
  return [
    [s[1][1] / d, -s[0][1] / d],
    [-s[1][0] / d, s[0][0] / d],
  ];
}

/** Meters per degree of latitude (mean over the globe; good to ~0.1%). */
const METERS_PER_DEG_LAT = 110540;
/** Meters per degree of longitude at the equator (scaled by cos(lat)). */
const METERS_PER_DEG_LON_EQUATOR = 111320;

export interface GeoFix {
  latitude: number;
  longitude: number;
  /** Epoch milliseconds the fix was taken. */
  timestamp: number;
  /** Horizontal accuracy (1σ) in meters, if the device reports it. */
  accuracy?: number | null;
}

export interface FilteredFix {
  latitude: number;
  longitude: number;
  /** Ground speed in m/s. */
  speed: number;
  /**
   * Course over ground, degrees clockwise from true north [0, 360), derived
   * from the filtered velocity vector. `null` when the car is below
   * `minBearingSpeed` (heading is meaningless when stationary) — the caller
   * should keep the previous heading.
   */
  bearing: number | null;
  /** Filtered velocity as degrees of longitude per millisecond. */
  velLngPerMs: number;
  /** Filtered velocity as degrees of latitude per millisecond. */
  velLatPerMs: number;
}

export interface GeoKalmanOptions {
  /**
   * Acceleration noise std-dev (m/s²) — the model's "how hard can this
   * vehicle change velocity between fixes" knob. Higher = trusts new fixes
   * faster (snappier, less smooth); lower = smoother but laggier on turns.
   */
  accelStdDev?: number;
  /** Fallback measurement accuracy (m) when a fix carries none. */
  defaultAccuracy?: number;
  /** Below this speed (m/s) `bearing` is `null` so the map won't spin. */
  minBearingSpeed?: number;
  /** Gap (ms) after which the track is treated as new (re-seed the filter). */
  resetGapMs?: number;
}

/**
 * Stateful constant-velocity Kalman filter. Feed every raw fix to
 * `update()`; it returns the smoothed position, speed, heading, and a
 * velocity in deg/ms suitable for dead-reckoning the camera between fixes.
 */
export class GeoKalmanFilter {
  private readonly accelVariance: number;
  private readonly defaultAccuracy: number;
  private readonly minBearingSpeed: number;
  private readonly resetGapMs: number;

  private anchorLat = 0;
  private anchorLng = 0;
  private metersPerDegLon = METERS_PER_DEG_LON_EQUATOR;
  private lastTimestamp: number | null = null;
  /** State [east, north, vEast, vNorth] as a 4×1 column vector. */
  private x: Matrix = [[0], [0], [0], [0]];
  /** Estimate covariance, 4×4. */
  private p: Matrix = identity(4);

  public constructor(options: GeoKalmanOptions = {}) {
    const accelStdDev = options.accelStdDev ?? 1.8;
    this.accelVariance = accelStdDev * accelStdDev;
    this.defaultAccuracy = options.defaultAccuracy ?? 12;
    this.minBearingSpeed = options.minBearingSpeed ?? 2.0;
    this.resetGapMs = options.resetGapMs ?? 5000;
  }

  /** Re-seed the filter on the given fix (first fix, or after a long gap). */
  private seed(fix: GeoFix): void {
    this.anchorLat = fix.latitude;
    this.anchorLng = fix.longitude;
    this.metersPerDegLon =
      METERS_PER_DEG_LON_EQUATOR * Math.cos((fix.latitude * Math.PI) / 180);
    this.lastTimestamp = fix.timestamp;
    this.x = [[0], [0], [0], [0]];
    const r = this.measurementVariance(fix);
    // Position known to ~r, velocity unknown (large variance → first moves
    // are trusted heavily until it converges).
    this.p = [
      [r, 0, 0, 0],
      [0, r, 0, 0],
      [0, 0, 100, 0],
      [0, 0, 0, 100],
    ];
  }

  private measurementVariance(fix: GeoFix): number {
    const acc =
      typeof fix.accuracy === 'number' && fix.accuracy > 0
        ? fix.accuracy
        : this.defaultAccuracy;
    return acc * acc;
  }

  /**
   * Ingest a raw GPS fix and return the filtered estimate. Always call this
   * for every fix — dropping fixes degrades the estimate.
   */
  public update(fix: GeoFix): FilteredFix {
    if (
      this.lastTimestamp === null ||
      fix.timestamp - this.lastTimestamp > this.resetGapMs
    ) {
      this.seed(fix);
      return this.project(0);
    }

    let dt = (fix.timestamp - this.lastTimestamp) / 1000;
    if (dt <= 0) {
      dt = 0.001;
    }
    this.lastTimestamp = fix.timestamp;

    // --- Predict ---
    const f: Matrix = [
      [1, 0, dt, 0],
      [0, 1, 0, dt],
      [0, 0, 1, 0],
      [0, 0, 0, 1],
    ];
    const dt2 = dt * dt;
    const dt3 = dt2 * dt;
    const dt4 = dt3 * dt;
    const q = this.accelVariance;
    const qMatrix: Matrix = [
      [(dt4 / 4) * q, 0, (dt3 / 2) * q, 0],
      [0, (dt4 / 4) * q, 0, (dt3 / 2) * q],
      [(dt3 / 2) * q, 0, dt2 * q, 0],
      [0, (dt3 / 2) * q, 0, dt2 * q],
    ];
    this.x = multiply(f, this.x);
    this.p = add(multiply(multiply(f, this.p), transpose(f)), qMatrix);

    // --- Update with measurement z = [east, north] ---
    const east = (fix.longitude - this.anchorLng) * this.metersPerDegLon;
    const north = (fix.latitude - this.anchorLat) * METERS_PER_DEG_LAT;
    const h: Matrix = [
      [1, 0, 0, 0],
      [0, 1, 0, 0],
    ];
    const r = this.measurementVariance(fix);
    const rMatrix: Matrix = [
      [r, 0],
      [0, r],
    ];
    const z: Matrix = [[east], [north]];
    const y = subtract(z, multiply(h, this.x)); // innovation
    const ht = transpose(h);
    const s = add(multiply(multiply(h, this.p), ht), rMatrix);
    const k = multiply(multiply(this.p, ht), invert2(s)); // Kalman gain, 4×2
    this.x = add(this.x, multiply(k, y));
    this.p = multiply(subtract(identity(4), multiply(k, h)), this.p);

    return this.project(this.lastTimestamp);
  }

  /** Convert the current state back to lat/lng + derived speed/bearing. */
  private project(_timestamp: number): FilteredFix {
    const east = this.x[0][0];
    const north = this.x[1][0];
    const vEast = this.x[2][0];
    const vNorth = this.x[3][0];

    const latitude = this.anchorLat + north / METERS_PER_DEG_LAT;
    const longitude = this.anchorLng + east / this.metersPerDegLon;
    const speed = Math.hypot(vEast, vNorth);

    let bearing: number | null = null;
    if (speed >= this.minBearingSpeed) {
      bearing = ((Math.atan2(vEast, vNorth) * 180) / Math.PI + 360) % 360;
    }

    return {
      latitude,
      longitude,
      speed,
      bearing,
      // m/s → deg/ms in each axis, so the camera can dead-reckon
      // `position += vel * elapsedMs` between fixes.
      velLngPerMs: vEast / this.metersPerDegLon / 1000,
      velLatPerMs: vNorth / METERS_PER_DEG_LAT / 1000,
    };
  }
}
