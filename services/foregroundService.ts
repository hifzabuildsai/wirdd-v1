import { Platform } from 'react-native';
import notifee from '@notifee/react-native';
import {
  buildSessionNotification,
  createSessionChannel,
  NOTIFICATION_ID,
} from './notification';

// ── Debounce config ──────────────────────────────────────────────────────────
const DEBOUNCE_DETECTIONS = 5;
const DEBOUNCE_MS = 10_000;

// ── Module-level state ───────────────────────────────────────────────────────
let isRunning = false;
let isPaused = false;
let lastKnownCount = 0;
let detectionsSinceLastUpdate = 0;
let lastUpdateTime = 0;
let updateTimer: ReturnType<typeof setTimeout> | null = null;


// ── Foreground service handler (must be called once at app startup) ───────────
// Registers the headless task that keeps the Android foreground service alive.
// The returned promise never resolves; the service lives until the notification
// is cancelled.
export function registerForegroundServiceHandler(): void {
  if (Platform.OS !== 'android') return;
  try {
    notifee.registerForegroundService(() => new Promise(() => {}));
  } catch (e) {
    console.warn('[foregroundService] register failed:', e);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function startForegroundService(count: number): Promise<void> {
  if (Platform.OS !== 'android') return;
  await createSessionChannel();
  await notifee.displayNotification(buildSessionNotification(count, false));
  isRunning = true;
  isPaused = false;
  lastKnownCount = count;
  detectionsSinceLastUpdate = 0;
  lastUpdateTime = Date.now();
}

export async function setNotificationPaused(count: number, paused: boolean): Promise<void> {
  if (!isRunning) return;
  isPaused = paused;
  lastKnownCount = count;
  clearDebounce();
  await notifee.displayNotification(buildSessionNotification(count, paused));
}

export async function stopForegroundService(): Promise<void> {
  if (Platform.OS !== 'android') return;
  isRunning = false;
  isPaused = false;
  clearDebounce();
  await notifee.stopForegroundService();
  await notifee.cancelNotification(NOTIFICATION_ID);
}

// Called on every voice detection from the session screen.
// Debounces notification updates: fires after 5 detections OR 10 seconds.
export function requestNotificationUpdate(count: number): void {
  if (!isRunning || isPaused) return;
  lastKnownCount = count;
  detectionsSinceLastUpdate++;

  const elapsed = Date.now() - lastUpdateTime;

  if (
    detectionsSinceLastUpdate >= DEBOUNCE_DETECTIONS ||
    elapsed >= DEBOUNCE_MS
  ) {
    flushUpdate(count);
    return;
  }

  if (!updateTimer) {
    const remaining = DEBOUNCE_MS - elapsed;
    updateTimer = setTimeout(() => {
      updateTimer = null;
      flushUpdate(lastKnownCount);
    }, remaining);
  }
}

// ── Internal helpers ─────────────────────────────────────────────────────────

function flushUpdate(count: number): void {
  clearDebounce();
  lastUpdateTime = Date.now();
  notifee
    .displayNotification(buildSessionNotification(count, false))
    .catch(() => {});
}

function clearDebounce(): void {
  if (updateTimer) {
    clearTimeout(updateTimer);
    updateTimer = null;
  }
  detectionsSinceLastUpdate = 0;
}
