import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function ensurePermissions() {
  if (Platform.OS === 'web') return false;
  const { status } = await Notifications.getPermissionsAsync();
  let final = status;
  if (status !== 'granted') {
    const req = await Notifications.requestPermissionsAsync();
    final = req.status;
  }
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Reminders',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  return final === 'granted';
}

// Schedule a notification at a specific Date, with optional repeat.
export async function schedule({ title, body, date, repeat = 'none' }) {
  if (Platform.OS === 'web') return null;
  const ok = await ensurePermissions();
  if (!ok) return null;

  const trigger = buildTrigger(date, repeat);
  if (!trigger) return null;

  return Notifications.scheduleNotificationAsync({
    content: { title, body, sound: true },
    trigger,
  });
}

function buildTrigger(date, repeat) {
  const d = new Date(date);
  if (repeat === 'none') {
    if (d.getTime() <= Date.now()) return null; // don't schedule past one-offs
    return d;
  }
  if (repeat === 'daily') {
    return { hour: d.getHours(), minute: d.getMinutes(), repeats: true };
  }
  if (repeat === 'weekly') {
    return {
      weekday: d.getDay() + 1,
      hour: d.getHours(),
      minute: d.getMinutes(),
      repeats: true,
    };
  }
  if (repeat === 'monthly') {
    return {
      day: d.getDate(),
      hour: d.getHours(),
      minute: d.getMinutes(),
      repeats: true,
    };
  }
  return d;
}

export async function cancel(notifId) {
  if (!notifId || Platform.OS === 'web') return;
  try {
    await Notifications.cancelScheduledNotificationAsync(notifId);
  } catch (e) {}
}
