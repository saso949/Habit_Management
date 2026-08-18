/**
 * System Notification Service (Best-effort Web Notifications & Service Worker Push)
 * Handles permissions, scheduled task triggers, and high-urgency check-in alerts
 */

import type { Task } from '../db/types';
import { SoundService } from './sound';
import { HapticService } from './haptic';

export class NotificationService {
  private static scheduledTimers: Map<string, number> = new Map();

  /**
   * Check if Notifications are supported in current browser/environment
   */
  static isSupported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
  }

  /**
   * Get current notification permission status
   */
  static getPermission(): NotificationPermission {
    if (!this.isSupported()) return 'denied';
    return Notification.permission;
  }

  /**
   * Request notification permission from user
   */
  static async requestPermission(): Promise<boolean> {
    if (!this.isSupported()) return false;

    if (Notification.permission === 'granted') {
      return true;
    }

    try {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    } catch (err) {
      console.warn('Notification permission request failed:', err);
      return false;
    }
  }

  /**
   * Send a system notification (via ServiceWorkerRegistration if available, fallback to Notification constructor)
   */
  static async sendNotification(title: string, options: NotificationOptions = {}): Promise<void> {
    if (!this.isSupported() || Notification.permission !== 'granted') {
      return;
    }

    const defaultOptions: NotificationOptions = {
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      ...options,
    };

    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        if (registration && 'showNotification' in registration) {
          await registration.showNotification(title, defaultOptions);
          return;
        }
      }
      new Notification(title, defaultOptions);
    } catch (err) {
      console.warn('Send notification error, falling back to Notification constructor:', err);
      try {
        new Notification(title, defaultOptions);
      } catch (e) {
        console.warn('Notification fallback failed:', e);
      }
    }
  }

  /**
   * Best-effort notification scheduler for upcoming scheduled task start
   */
  static scheduleTaskStartNotification(task: Task, onStartDue?: () => void): void {
    if (task.type !== 'scheduled' || task.status !== 'pending') return;

    // Clear existing timer if any
    if (this.scheduledTimers.has(task.id)) {
      clearTimeout(this.scheduledTimers.get(task.id));
      this.scheduledTimers.delete(task.id);
    }

    const startTimeMs = new Date(task.scheduled_start_at).getTime();
    const delayMs = startTimeMs - Date.now();

    if (delayMs <= 0) {
      // Already due or past
      this.triggerTaskStartDueNotification(task);
      if (onStartDue) onStartDue();
      return;
    }

    // Schedule timer (capped to standard 32-bit setTimeout max ~24.8 days)
    if (delayMs < 2147483647) {
      const timerId = window.setTimeout(() => {
        this.triggerTaskStartDueNotification(task);
        if (onStartDue) onStartDue();
        this.scheduledTimers.delete(task.id);
      }, delayMs);
      this.scheduledTimers.set(task.id, timerId);
    }
  }

  /**
   * Cancel scheduled task notification
   */
  static cancelScheduledNotification(taskId: string): void {
    if (this.scheduledTimers.has(taskId)) {
      clearTimeout(this.scheduledTimers.get(taskId));
      this.scheduledTimers.delete(taskId);
    }
  }

  /**
   * Trigger start-time notification when task is due
   */
  static async triggerTaskStartDueNotification(task: Task): Promise<void> {
    SoundService.playCheckinAlarm();
    HapticService.triggerCheckinAlert();

    await this.sendNotification(`⚡【開始時間です】${task.title}`, {
      body: `予約時刻になりました！アプリを開いて「写真撮影（実体化トリガー）」を行って開始してください。遅れるとサボり時間に加算されます。`,
      tag: `task-start-${task.id}`,
      requireInteraction: true,
      data: { taskId: task.id, type: 'task-start' },
    });
  }

  /**
   * Send high-urgency Check-in Alert notification
   */
  static async sendCheckinAlertNotification(task: Task, isOverdue: boolean = false): Promise<void> {
    const title = isOverdue
      ? `🚨【サボり時間加算中！】定期チェックイン未完了`
      : `⚠️【定期チェックイン】作業を継続していますか？`;

    const body = isOverdue
      ? `「${task.title}」の応答が10分を超過したため、サボり時間が加算されています！今すぐアプリで確認してください。`
      : `「${task.title}」の定期確認です。10分以内に応答して集中状態を維持しましょう！`;

    await this.sendNotification(title, {
      body,
      tag: `checkin-alert-${task.id}`,
      requireInteraction: true,
      data: { taskId: task.id, type: 'checkin-alert' },
    });
  }
}
