import notifee, { AndroidImportance, type Notification } from '@notifee/react-native';

export const CHANNEL_ID = 'wird-session';
export const NOTIFICATION_ID = 'wird-active-session';

// Android 14+ foreground service type for microphone (numeric value 128)
const FOREGROUND_SERVICE_TYPE_MICROPHONE = 128;

export async function createSessionChannel(): Promise<void> {
  await notifee.createChannel({
    id: CHANNEL_ID,
    name: 'Wird Session',
    importance: AndroidImportance.DEFAULT,
    vibration: false,
  });
}

export function buildSessionNotification(
  count: number,
  isPaused: boolean,
): Notification {
  const title = isPaused ? 'Wird · Paused' : 'Wird · Listening';
  const body = `${count} dhikr this session`;

  return {
    id: NOTIFICATION_ID,
    title,
    body,
    android: {
      channelId: CHANNEL_ID,
      asForegroundService: true,
      // Required on Android 14+ for mic-using foreground services
      foregroundServiceTypes: [FOREGROUND_SERVICE_TYPE_MICROPHONE],
      ongoing: true,
      pressAction: { id: 'default' },
      color: '#C8A84B',
      actions: [
        {
          title: isPaused ? 'Resume' : 'Pause',
          pressAction: { id: isPaused ? 'resume' : 'pause' },
        },
        {
          title: 'End',
          pressAction: { id: 'end' },
        },
      ],
    },
  };
}
