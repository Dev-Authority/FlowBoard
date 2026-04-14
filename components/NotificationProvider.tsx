'use client';
import { useEffect } from 'react';
import { registerServiceWorker, requestPermission, startReminderScheduler, checkIdleTasks } from '@/lib/notifications';

export default function NotificationProvider() {
  useEffect(() => {
    async function init() {
      const reg = await registerServiceWorker();
      if (!reg) return;
      const granted = await requestPermission();
      if (!granted) return;
      startReminderScheduler();
      checkIdleTasks();
      // Check idle tasks every 30 minutes
      setInterval(checkIdleTasks, 30 * 60 * 1000);
    }
    init();
  }, []);

  return null;
}
