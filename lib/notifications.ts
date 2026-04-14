'use client';

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator) || !('Notification' in window)) return null;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    return reg;
  } catch {
    return null;
  }
}

export async function requestPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

export function sendNotification(title: string, body: string, url = '/') {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'SHOW_NOTIFICATION',
      title,
      body,
      url,
    });
  }
}

// Schedule recurring reminders using localStorage + setInterval checks
export function startReminderScheduler() {
  if (typeof window === 'undefined') return;

  const check = () => {
    if (Notification.permission !== 'granted') return;

    const now = new Date();
    const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const eveningTime = localStorage.getItem('fb_evening_reminder') ?? '21:00';
    const morningTime = localStorage.getItem('fb_morning_reminder') ?? '08:00';
    const lastEvening = localStorage.getItem('fb_last_evening');
    const lastMorning = localStorage.getItem('fb_last_morning');
    const today = new Date().toISOString().slice(0, 10);

    if (hhmm === eveningTime && lastEvening !== today) {
      localStorage.setItem('fb_last_evening', today);
      sendNotification(
        'FlowBoard — Plan Tomorrow',
        'Plan tomorrow — 2 minutes. Your recurring tasks are already loaded.',
        '/plan'
      );
    }

    if (hhmm === morningTime && lastMorning !== today) {
      localStorage.setItem('fb_last_morning', today);
      sendNotification(
        'FlowBoard — Time to work',
        "Your tasks are waiting. Let's go.",
        '/'
      );
    }
  };

  setInterval(check, 60000); // check every minute
  check();
}

// Check for tasks stuck in "doing" for 2+ hours
export async function checkIdleTasks() {
  if (Notification.permission !== 'granted') return;
  const today = new Date().toISOString().slice(0, 10);
  const res = await fetch(`/api/tasks?date=${today}`);
  const tasks = await res.json();
  if (!Array.isArray(tasks)) return;

  const now = Date.now();
  for (const task of tasks) {
    if (task.status === 'doing' && task.startedAt) {
      const elapsed = (now - new Date(task.startedAt).getTime()) / 3600000; // hours
      if (elapsed >= 2) {
        const lastAlerted = localStorage.getItem(`fb_idle_${task._id}`);
        const hourKey = String(Math.floor(elapsed));
        if (lastAlerted !== hourKey) {
          localStorage.setItem(`fb_idle_${task._id}`, hourKey);
          sendNotification(
            'FlowBoard — Still working?',
            `Still working on "${task.text}"? Update your board.`,
            '/'
          );
        }
      }
    }
  }
}
