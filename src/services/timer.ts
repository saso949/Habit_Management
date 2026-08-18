/**
 * Task Focus Timer and Check-in Lifecycle Service
 * Handles state ticks, check-in detection, break mode (up to 15m/hour quota), sabori tracking, extensions, and session completion
 */

import { saveTask, getActiveRunningTask } from '../db/db';
import type { Task, TaskPhoto } from '../db/types';
import { SoundService } from './sound';
import { HapticService } from './haptic';
import { WakeLockService } from './wakelock';
import { AnalyticsService } from './analytics';
import { NotificationService } from './notification';
import { formatLocalTimeWithSeconds, diffInMinutes } from '../utils/date';

export type TimerTickCallback = (state: FocusTimerState) => void;
export type CheckinAlertCallback = (task: Task, overdueSeconds: number) => void;
export type TaskExpiredCallback = (task: Task) => void;

export interface FocusTimerState {
  task: Task;
  remainingSeconds: number;
  elapsedSeconds: number;
  totalDurationSeconds: number;
  progressPercent: number;
  wallClockString: string;
  isCheckinAlertActive: boolean;
  secondsUntilNextCheckin: number;
  checkinOverdueSeconds: number;
  isSessionExpired: boolean;

  // Break Mode Fields (15m per 1h quota)
  isBreakMode: boolean;
  breakSecondsRemaining: number;
  breakDurationSeconds: number;
  availableBreakSecondsQuota: number;
  totalBreakSecondsUsed: number;
  isBreakFinishedAlerting: boolean;
}

export class FocusTimerService {
  private static activeTask: Task | null = null;
  private static timerInterval: number | null = null;
  private static tickListeners: Set<TimerTickCallback> = new Set();
  private static checkinListeners: Set<CheckinAlertCallback> = new Set();
  private static expiredListeners: Set<TaskExpiredCallback> = new Set();
  private static isAlerting = false;
  private static hasNotifiedExpiry = false;
  private static isCompleting = false;

  // Track base sabori (start delay + completed check-in penalties)
  private static baseSaboriMinutes = 0;
  private static currentAlertOverdueMinutes = 0;

  // Break Mode Management
  private static isBreakMode = false;
  private static breakEndTimestampMs: number | null = null;
  private static breakDurationSeconds = 0;
  private static breakStartTimestampMs = 0;
  private static isBreakFinishedAlerting = false;

  /**
   * Start or resume running a task
   */
  static async startTask(task: Task): Promise<void> {
    this.activeTask = task;
    this.activeTask.status = 'running';
    this.activeTask.break_seconds = this.activeTask.break_seconds || ((this.activeTask.break_minutes || 0) * 60);
    this.hasNotifiedExpiry = false;
    this.isBreakMode = false;
    this.breakEndTimestampMs = null;
    this.isBreakFinishedAlerting = false;
    this.isAlerting = false; // Reset alerting state when a new task starts

    NotificationService.cancelScheduledNotification(this.activeTask.id);

    if (!this.activeTask.actual_start_at) {
      this.activeTask.actual_start_at = new Date().toISOString();
      // Calculate delay if it was a scheduled task (Apply 10-minute grace period)
      if (this.activeTask.type === 'scheduled') {
        const scheduledStartMs = new Date(this.activeTask.scheduled_start_at).getTime();
        const actualStartMs = new Date(this.activeTask.actual_start_at).getTime();
        const delayMs = actualStartMs - scheduledStartMs;
        const gracePeriodMs = 10 * 60 * 1000;
        
        if (delayMs > gracePeriodMs) {
          const delayMin = Math.floor((delayMs - gracePeriodMs) / (60 * 1000));
          this.activeTask.sabori_minutes = (this.activeTask.sabori_minutes || 0) + delayMin;
        }
      }
    }

    this.baseSaboriMinutes = this.activeTask.sabori_minutes || 0;
    this.currentAlertOverdueMinutes = 0;

    if (!this.activeTask.last_checkin_at) {
      this.activeTask.last_checkin_at = this.activeTask.actual_start_at;
    }

    await saveTask(this.activeTask);
    await WakeLockService.requestWakeLock();
    SoundService.stopAlarm();
    await SoundService.playStartChime();
    HapticService.triggerStart();

    this.startLoop();
  }

  /**
   * Check if there is an active running task on startup
   */
  static async resumeIfActive(): Promise<Task | null> {
    const running = await getActiveRunningTask();
    if (running) {
      this.activeTask = running;
      this.activeTask.break_seconds = running.break_seconds || ((running.break_minutes || 0) * 60);
      this.baseSaboriMinutes = running.sabori_minutes || 0;
      this.currentAlertOverdueMinutes = 0;
      this.hasNotifiedExpiry = false;
      this.isBreakMode = false;
      this.breakEndTimestampMs = null;
      this.isBreakFinishedAlerting = false;
      this.isAlerting = false;

      await WakeLockService.requestWakeLock();
      this.startLoop();
      return running;
    }
    return null;
  }

  static getActiveTask(): Task | null {
    return this.activeTask;
  }

  /**
   * Calculate maximum allowed break quota (15 min per 60 min scheduled) in seconds
   */
  static calculateMaxBreakSeconds(task: Task): number {
    const totalScheduledMinutes = diffInMinutes(task.scheduled_start_at, task.scheduled_end_at);
    return Math.max(5 * 60, Math.round((totalScheduledMinutes / 60) * 15 * 60));
  }

  /**
   * Get available break seconds remaining for this task
   */
  static getAvailableBreakSeconds(): number {
    if (!this.activeTask) return 0;
    const maxQuota = this.calculateMaxBreakSeconds(this.activeTask);
    const used = this.activeTask.break_seconds || ((this.activeTask.break_minutes || 0) * 60);
    return Math.max(0, maxQuota - used);
  }

  /**
   * Start a valid break session (15m per 1h rule, not counted as sabori)
   */
  static async startBreak(requestedSeconds?: number): Promise<boolean> {
    if (!this.activeTask || this.isBreakMode) return false;

    const availableQuota = this.getAvailableBreakSeconds();
    if (availableQuota <= 0) return false;

    const breakSeconds = Math.min(requestedSeconds || availableQuota, availableQuota);
    if (breakSeconds <= 0) return false;

    this.isBreakMode = true;
    this.breakDurationSeconds = breakSeconds;
    this.breakStartTimestampMs = Date.now();
    this.breakEndTimestampMs = this.breakStartTimestampMs + this.breakDurationSeconds * 1000;

    // Silence any active check-in alert
    if (this.isAlerting) {
      this.isAlerting = false;
      SoundService.stopAlarm();
    }

    await SoundService.playStartChime();
    HapticService.triggerTap();

    await this.tick();
    return true;
  }

  /**
   * Resume focus session from break mode
   */
  static async resumeFromBreak(): Promise<void> {
    if (!this.activeTask || !this.isBreakMode) return;

    this.isBreakFinishedAlerting = false;
    SoundService.stopAlarm();

    const now = Date.now();
    const elapsedSeconds = Math.max(0, Math.round((now - this.breakStartTimestampMs) / 1000));

    // Add used break time to task.break_seconds (part of execution, not sabori)
    this.activeTask.break_seconds = (this.activeTask.break_seconds || ((this.activeTask.break_minutes || 0) * 60)) + elapsedSeconds;
    this.activeTask.break_minutes = Math.round(this.activeTask.break_seconds / 60); // Keep sync for legacy/display
    this.isBreakMode = false;
    this.breakEndTimestampMs = null;
    this.breakDurationSeconds = 0;

    // Reset checkin anchor so user gets a full fresh interval from resumption
    this.activeTask.last_checkin_at = new Date().toISOString();
    this.activeTask.checkin_alert_started_at = null;

    await saveTask(this.activeTask);
    await SoundService.playStartChime();
    HapticService.triggerSuccess();

    await this.tick();
  }

  static addTickListener(cb: TimerTickCallback): () => void {
    this.tickListeners.add(cb);
    return () => this.tickListeners.delete(cb);
  }

  static addCheckinListener(cb: CheckinAlertCallback): () => void {
    this.checkinListeners.add(cb);
    return () => this.checkinListeners.delete(cb);
  }

  static addExpiredListener(cb: TaskExpiredCallback): () => void {
    this.expiredListeners.add(cb);
    return () => this.expiredListeners.delete(cb);
  }

  private static startLoop(): void {
    if (this.timerInterval !== null) {
      clearInterval(this.timerInterval);
    }
    this.tick();
    this.timerInterval = window.setInterval(() => this.tick(), 1000);
  }

  private static stopLoop(): void {
    if (this.timerInterval !== null) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    SoundService.stopAlarm();
    WakeLockService.releaseWakeLock();
  }

  private static async tick(): Promise<void> {
    if (!this.activeTask) return;

    const now = Date.now();
    const startTimeMs = new Date(this.activeTask.actual_start_at || this.activeTask.scheduled_start_at).getTime();
    const endTimeMs = new Date(this.activeTask.scheduled_end_at).getTime();
    const totalDurationSeconds = Math.max(1, Math.round((endTimeMs - startTimeMs) / 1000));

    const elapsedSeconds = Math.max(0, Math.round((now - startTimeMs) / 1000));
    const remainingSeconds = Math.max(0, Math.round((endTimeMs - now) / 1000));
    const progressPercent = Math.min(100, Math.max(0, (elapsedSeconds / totalDurationSeconds) * 100));

    const wallClockString = formatLocalTimeWithSeconds();

    let breakSecondsRemaining = 0;

    // Handle Break Mode
    if (this.isBreakMode && this.breakEndTimestampMs) {
      breakSecondsRemaining = Math.max(0, Math.round((this.breakEndTimestampMs - now) / 1000));

      // Break time finished
      if (breakSecondsRemaining <= 0) {
        if (!this.isBreakFinishedAlerting) {
          this.isBreakFinishedAlerting = true;
          await SoundService.playCheckinAlarm();
          HapticService.triggerCheckinAlert();
          NotificationService.sendNotification('☕【休憩終了】集中を再開しましょう！', {
            body: `「${this.activeTask.title}」の休憩時間が終了しました。今すぐ集中モードを再開してください。`,
            requireInteraction: true,
          });
        }
      }
    }

    // Checkin interval calculation (Paused during break mode)
    const intervalMinutes = this.activeTask.checkin_interval_minutes || 25;
    const intervalMs = intervalMinutes * 60 * 1000;
    const lastCheckinMs = new Date(this.activeTask.last_checkin_at || this.activeTask.actual_start_at || new Date().toISOString()).getTime();
    const msSinceLastCheckin = now - lastCheckinMs;
    const secondsUntilNextCheckin = Math.max(0, Math.round((intervalMs - msSinceLastCheckin) / 1000));

    let checkinOverdueSeconds = 0;

    // Check if check-in trigger condition is met (only when NOT resting)
    if (!this.isBreakMode && msSinceLastCheckin >= intervalMs) {
      if (!this.isAlerting) {
        this.isAlerting = true;
        this.activeTask.checkin_alert_started_at = new Date().toISOString();
        await saveTask(this.activeTask);
        await SoundService.playCheckinAlarm();
        HapticService.triggerCheckinAlert();
        NotificationService.sendCheckinAlertNotification(this.activeTask, false);
      }

      // Check if overdue > 10 minutes (600 seconds)
      const alertStartMs = new Date(this.activeTask.checkin_alert_started_at || new Date().toISOString()).getTime();
      const elapsedSinceAlertMs = now - alertStartMs;
      const gracePeriodMs = 10 * 60 * 1000; // 10 minutes

      if (elapsedSinceAlertMs > gracePeriodMs) {
        const prevOverdueMinutes = this.currentAlertOverdueMinutes;
        checkinOverdueSeconds = Math.round((elapsedSinceAlertMs - gracePeriodMs) / 1000);
        this.currentAlertOverdueMinutes = Math.floor(checkinOverdueSeconds / 60);
        this.activeTask.sabori_minutes = this.baseSaboriMinutes + this.currentAlertOverdueMinutes;

        // When a new minute of delay is incurred, re-trigger alert and notify
        if (this.currentAlertOverdueMinutes > prevOverdueMinutes) {
          NotificationService.sendCheckinAlertNotification(this.activeTask, true);
          HapticService.triggerCheckinAlert();
        }
      }

      this.checkinListeners.forEach((cb) => cb(this.activeTask!, checkinOverdueSeconds));
    }

    const isExpired = remainingSeconds <= 0;
    const availableBreakSeconds = this.getAvailableBreakSeconds();

    const state: FocusTimerState = {
      task: this.activeTask,
      remainingSeconds,
      elapsedSeconds,
      totalDurationSeconds,
      progressPercent,
      wallClockString,
      isCheckinAlertActive: this.isAlerting,
      secondsUntilNextCheckin,
      checkinOverdueSeconds,
      isSessionExpired: isExpired,

      isBreakMode: this.isBreakMode,
      breakSecondsRemaining,
      breakDurationSeconds: this.breakDurationSeconds,
      availableBreakSecondsQuota: availableBreakSeconds,
      totalBreakSecondsUsed: this.activeTask.break_seconds || ((this.activeTask.break_minutes || 0) * 60),
      isBreakFinishedAlerting: this.isBreakFinishedAlerting,
    };

    this.tickListeners.forEach((cb) => cb(state));

    // Check if scheduled end time reached and notify once
    if (isExpired && !this.isAlerting && !this.isBreakMode && !this.hasNotifiedExpiry) {
      this.hasNotifiedExpiry = true;
      SoundService.playCheckinAlarm(); // Play intense alarm to notify session end
      HapticService.triggerCheckinAlert();
      NotificationService.sendNotification('✅【時間終了】セッションの予定時間が終了しました', {
        body: `「${this.activeTask.title}」の予約時間が終了しました。タスクを完了するか、時間を延長してください。`,
        requireInteraction: true,
      });
      this.expiredListeners.forEach((cb) => cb(this.activeTask!));
    }
  }

  /**
   * Respond to Check-in (OK or with photo)
   */
  static async confirmCheckin(photoDataUrl?: string): Promise<void> {
    if (!this.activeTask) return;

    this.isAlerting = false;
    SoundService.stopAlarm();

    // Bake current alert overdue into base sabori
    this.baseSaboriMinutes += this.currentAlertOverdueMinutes;
    this.activeTask.sabori_minutes = this.baseSaboriMinutes;
    this.currentAlertOverdueMinutes = 0;

    const checkinTimestamp = new Date().toISOString();
    this.activeTask.last_checkin_at = checkinTimestamp;
    this.activeTask.checkin_alert_started_at = null;

    if (photoDataUrl) {
      const photo: TaskPhoto = {
        type: 'checkin',
        timestamp: checkinTimestamp,
        data_url: photoDataUrl,
      };
      this.activeTask.photos = this.activeTask.photos || [];
      this.activeTask.photos.push(photo);
    }

    await saveTask(this.activeTask);
    HapticService.triggerTap();
  }

  /**
   * Extend active task duration by given minutes (+15, +30, +60)
   */
  static async extendDuration(additionalMinutes: number): Promise<void> {
    if (!this.activeTask) return;

    const currentEndMs = new Date(this.activeTask.scheduled_end_at).getTime();
    const newEndMs = Math.max(Date.now(), currentEndMs) + additionalMinutes * 60 * 1000;
    this.activeTask.scheduled_end_at = new Date(newEndMs).toISOString();
    this.hasNotifiedExpiry = false;

    await saveTask(this.activeTask);
    HapticService.triggerTap();
  }

  /**
   * Complete active task
   */
  static async completeTask(photoDataUrl?: string): Promise<Task | null> {
    if (!this.activeTask || this.isCompleting) return null;
    this.isCompleting = true;

    try {
      if (this.isBreakMode) {
      await this.resumeFromBreak();
    }

    // Finalize any active alert overdue
    this.baseSaboriMinutes += this.currentAlertOverdueMinutes;
    this.activeTask.sabori_minutes = this.baseSaboriMinutes;
    this.currentAlertOverdueMinutes = 0;
    this.isAlerting = false;

    NotificationService.cancelScheduledNotification(this.activeTask.id);

    const endedAt = new Date().toISOString();
    const completed: Task = {
      ...this.activeTask,
      status: 'completed',
      ended_at: endedAt,
      break_seconds: this.activeTask.break_seconds || ((this.activeTask.break_minutes || 0) * 60),
      break_minutes: this.activeTask.break_minutes || 0,
      photos: [...(this.activeTask.photos || [])],
    };

    if (photoDataUrl) {
      completed.photos.push({
        type: 'end',
        timestamp: endedAt,
        data_url: photoDataUrl,
      });
    }

    await saveTask(completed);
    this.stopLoop();
    this.activeTask = null;

    await AnalyticsService.refreshStreaks();
    await SoundService.playCompleteChime();
    HapticService.triggerSuccess();

      return completed;
    } finally {
      this.isCompleting = false;
    }
  }

  /**
   * Cancel active task
   */
  static async cancelTask(): Promise<void> {
    if (!this.activeTask) return;
    this.activeTask.status = 'cancelled';
    this.activeTask.ended_at = new Date().toISOString();
    NotificationService.cancelScheduledNotification(this.activeTask.id);
    this.isAlerting = false;
    await saveTask(this.activeTask);
    this.stopLoop();
    this.activeTask = null;
  }
}
