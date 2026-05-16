import { Platform } from 'react-native';
import notifee, { EventType } from '@notifee/react-native';
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

// ── Callbacks registered by the session screen ───────────────────────────────
type SessionCallbacks = {
  onPause: () => void;
  onResume: () => void;
  onEnd: () => void;
};
let callbacks: SessionCallbacks | null = null;

export function registerSessionCallbacks(cbs: SessionCallbacks): void {
  callbacks = cbs;
}

export function clearSessionCallbacks(): void {
  callbacks = null;
}

// ── Foreground service handler (must be called once at app startup) ───────────
// Registers the headless task that keeps the Android foreground service alive.
// The returned promise never resolves; the service lives until the notification
// is cancelled.
export function registerForegroundServiceHandler(): void {
  if (Platform.OS !== 'android') return;
  notifee.registerForegroundService(() => new Promise(() => {}));
}

// ── Notifee background event handler ────────────────────────────────────────
// Register this at module level in _layout.tsx via:
//   notifee.onBackgroundEvent(handleBackgroundEvent);
export async function handleBackgroundEvent({
  type,
  detail,
}: {
  type: EventType;
  detail: { pressAction?: { id: string } };
}): Promise<void> {
  if (type !== EventType.ACTION_PRESS) return;
  const actionId = detail.pressAction?.id ?? '';
  handleAction(actionId);
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function startForegroundService(count: number): Promise<void> {
  if (Platform.OS !== 'android') return;
  isRunning = true;
  isPaused = false;
  lastKnownCount = count;
  detectionsSinceLastUpdate = 0;
  lastUpdateTime = Date.now();
  await createSessionChannel();
  await notifee.displayNotification(buildSessionNotification(count, false));
}

export async function stopForegroundService(): Promise<void> {
  if (Platform.OS !== 'android') return;
  isRunning = false;
  isPaused = false;
  clearDebounce();
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

function handleAction(actionId: string): void {
  switch (actionId) {
    case 'pause':
      if (!isRunning || isPaused) return;
      isPaused = true;
      clearDebounce();
      callbacks?.onPause();
      notifee
        .displayNotification(buildSessionNotification(lastKnownCount, true))
        .catch(() => {});
      break;

    case 'resume':
      if (!isRunning || !isPaused) return;
      isPaused = false;
      lastUpdateTime = Date.now();
      callbacks?.onResume();
      notifee
        .displayNotification(buildSessionNotification(lastKnownCount, false))
        .catch(() => {});
      break;

    case 'end':
      if (!isRunning) return;
      callbacks?.onEnd();
      stopForegroundService();
      break;
  }
}
