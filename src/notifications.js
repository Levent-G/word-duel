import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { dailyTasks, streakStatus } from './store';

const CHANNEL = 'reminders';
const DAYS_AHEAD = 3;
const TASKS_AT = [18, 0];
const STREAK_AT = [20, 30];

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

let channelReady = false;

async function ensureChannel() {
  if (channelReady || Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL, {
    name: 'Hatırlatmalar',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
  channelReady = true;
}

/** Asks once; returns whether reminders may be shown. */
export async function ensureReminderPermission() {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

function at(dayOffset, [h, m]) {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(h, m, 0, 0);
  return d;
}

/** Replaces every scheduled reminder with ones that match the current progress. */
export async function scheduleReminders(state) {
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!state.settings.reminders || !state.profile.name) return;
  if (!(await ensureReminderPermission())) return;
  await ensureChannel();

  const now = Date.now();
  const streak = streakStatus(state.streak);
  const tasksLeft = dailyTasks(state.daily).filter((t) => !t.done).length;
  const jobs = [];

  for (let d = 0; d < DAYS_AHEAD; d++) {
    const tasksTime = at(d, TASKS_AT);
    if (tasksTime.getTime() > now && (d > 0 || tasksLeft > 0)) {
      jobs.push({
        date: tasksTime,
        title: d === 0 ? 'Günlük görevin seni bekliyor' : 'Yeni günlük görevler hazır',
        body: d === 0 ? `${tasksLeft} görev daha tamamla, XP ödülünü kap.` : 'Bugünün görevlerini tamamla, ekstra XP kazan.',
      });
    }

    const streakTime = at(d, STREAK_AT);
    if (streakTime.getTime() > now && !(d === 0 && streak.playedToday)) {
      const alive = streak.count > 0;
      jobs.push({
        date: streakTime,
        title: alive ? 'Serin bozulmak üzere!' : 'Bugün bir düello yapalım mı?',
        body: alive
          ? `${streak.count} günlük serini korumak için bugün bir maç yap.`
          : 'Birkaç dakikalık bir düello ile yeni kelimeler öğren.',
      });
    }
  }

  await Promise.all(
    jobs.map((j) =>
      Notifications.scheduleNotificationAsync({
        content: { title: j.title, body: j.body },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: j.date,
          ...(Platform.OS === 'android' ? { channelId: CHANNEL } : {}),
        },
      }),
    ),
  );
}
