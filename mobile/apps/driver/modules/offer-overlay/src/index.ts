import { requireNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

// Loaded lazily — on iOS and on builds made before this local module
// landed, the require throws and the helpers degrade to no-ops.
let NativeModule: {
  hasOverlayPermission: () => boolean;
  openOverlaySettings: () => void;
  isIgnoringBatteryOptimizations: () => boolean;
  requestIgnoreBatteryOptimizations: () => void;
  showOffer: (params: {
    orderId: number;
    address: string;
    price: number;
    durationSeconds: number;
  }) => void;
  hideOffer: () => void;
  dismissOffer: () => void;
} | null = null;

if (Platform.OS === 'android') {
  try {
    NativeModule = requireNativeModule('OfferOverlay');
  } catch {
    NativeModule = null;
  }
}

export function isOfferOverlayAvailable(): boolean {
  return NativeModule !== null;
}

export function hasOverlayPermission(): boolean {
  return NativeModule ? NativeModule.hasOverlayPermission() : false;
}

export function openOverlaySettings(): void {
  NativeModule?.openOverlaySettings();
}

export function isIgnoringBatteryOptimizations(): boolean {
  return NativeModule ? NativeModule.isIgnoringBatteryOptimizations() : true;
}

export function requestIgnoreBatteryOptimizations(): void {
  NativeModule?.requestIgnoreBatteryOptimizations();
}

export function showOfferOverlay(params: {
  orderId: number;
  address: string;
  price: number;
  durationSeconds?: number;
}): void {
  if (!NativeModule) return;
  NativeModule.showOffer({
    orderId: params.orderId,
    address: params.address,
    price: params.price,
    durationSeconds: params.durationSeconds ?? 20,
  });
}

export function hideOfferOverlay(): void {
  NativeModule?.hideOffer();
}

/**
 * Hide the overlay AND cancel the FCM service-posted ringing notification
 * — call from JS the moment the driver accepts / declines / the offer
 * leaves state so the lock-screen notification doesn't linger until its
 * 20-second timeoutAfter expires.
 */
export function dismissOffer(): void {
  NativeModule?.dismissOffer();
}
