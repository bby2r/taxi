import { Platform } from 'react-native';

// Optional native module — degrades silently to a no-op on builds that
// were made before react-native-volume-manager landed, or on iOS where
// platform restrictions make persistent volume override impossible.
type VolumeManagerModule =
  typeof import('react-native-volume-manager').VolumeManager;

let VolumeManager: VolumeManagerModule | null = null;
try {
  VolumeManager = require('react-native-volume-manager').VolumeManager;
} catch {
  VolumeManager = null;
}

// What we consider "loud enough that a driver in a noisy car will hear
// the offer". 0.95 leaves a bit of headroom so the user can't feel the
// app fighting them at 100%.
const TARGET_VOLUME = 0.95;
// Anything below this and we clamp the user's input back up to TARGET.
// Leaves a small dead-band so the listener doesn't ping-pong on tiny
// rounding differences emitted by the OS.
const CLAMP_FLOOR = 0.85;

interface SavedSnapshot {
  music: number | null;
}

const savedSnapshot: SavedSnapshot = { music: null };
let activeListener: { remove: () => void } | null = null;
let isGuardActive = false;

export function isVolumeGuardAvailable(): boolean {
  return VolumeManager !== null && Platform.OS === 'android';
}

/**
 * Capture current volume and raise it to TARGET_VOLUME. Subscribes to
 * volume-change events; if the driver tries to lower the level while
 * the offer is on screen, the listener clamps it back up. Safe to call
 * multiple times — the saved snapshot only updates on the first call
 * within a guard window.
 */
export async function raiseVolumeForOffer(): Promise<void> {
  if (!VolumeManager || Platform.OS !== 'android') return;
  if (isGuardActive) return;
  isGuardActive = true;

  try {
    const current = await VolumeManager.getVolume();
    // react-native-volume-manager returns the music stream volume as
    // `volume` (0..1). The native side is STREAM_MUSIC by default which
    // is what expo-audio uses for the loop sound; we don't try to touch
    // STREAM_ALARM here because the channel's USAGE_ALARM routes the
    // notifee sound there independently of music volume.
    savedSnapshot.music =
      typeof current === 'object' && current !== null && 'volume' in current
        ? (current as { volume: number }).volume
        : null;

    await VolumeManager.setVolume(TARGET_VOLUME, {
      playSound: false,
      showUI: false,
    });

    activeListener = VolumeManager.addVolumeListener((event) => {
      if (!isGuardActive) return;
      if (event.volume < CLAMP_FLOOR) {
        VolumeManager?.setVolume(TARGET_VOLUME, {
          playSound: false,
          showUI: false,
        }).catch(() => undefined);
      }
    });
  } catch {
    // VolumeManager threw on getVolume / setVolume — likely an OS
    // restriction. Fall through so restore() is still a no-op.
  }
}

/**
 * Restore the volume snapshot captured at raise time and detach the
 * clamping listener. Always pair with `raiseVolumeForOffer` — the
 * effect cleanup in useDriverOrder calls this regardless of why the
 * phase left 'offer'.
 */
export async function restoreVolumeAfterOffer(): Promise<void> {
  if (!VolumeManager || Platform.OS !== 'android') return;
  if (!isGuardActive) return;
  isGuardActive = false;

  if (activeListener) {
    try {
      activeListener.remove();
    } catch {
      // ignore
    }
    activeListener = null;
  }

  if (savedSnapshot.music !== null) {
    try {
      await VolumeManager.setVolume(savedSnapshot.music, {
        playSound: false,
        showUI: false,
      });
    } catch {
      // ignore
    }
    savedSnapshot.music = null;
  }
}
