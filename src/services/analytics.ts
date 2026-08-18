/**
 * Analytics and Streak Calculation Service
 * Fully implements formulas from Section 3.5 of the PoC specification
 */

import { getAllTasks, getStreaks, updateStreaks, getTasksForDate } from '../db/db';
import type { Streaks, DailySummary } from '../db/types';
import { formatLocalDate, diffInMinutes } from '../utils/date';

export class AnalyticsService {
  /**
   * Format date to YYYY-MM-DD in local time
   */
  static getLocalDateString(date: Date = new Date()): string {
    return formatLocalDate(date);
  }

  /**
   * Calculate duration in minutes between two ISO date strings
   */
  static calculateDurationMinutes(startIso: string, endIso: string): number {
    return diffInMinutes(startIso, endIso);
  }

  /**
   * Calculate summary for a specific date (Defaults to today)
   */
  static async getDailySummary(dateStr: string = this.getLocalDateString()): Promise<DailySummary> {
    const tasks = await getTasksForDate(dateStr);
    
    // Filter out cancelled tasks
    const validTasks = tasks.filter((t) => t.status === 'completed' || t.status === 'running');

    let totalScheduledMinutes = 0;
    let totalSaboriMinutes = 0;
    let photosCount = 0;

    for (const task of validTasks) {
      const taskScheduledMin = this.calculateDurationMinutes(task.scheduled_start_at, task.scheduled_end_at);
      totalScheduledMinutes += taskScheduledMin;
      totalSaboriMinutes += task.sabori_minutes || 0;
      photosCount += (task.photos || []).length;
    }

    // Pure actual focus minutes: sum(scheduled - sabori)
    const totalActualMinutes = Math.max(0, totalScheduledMinutes - totalSaboriMinutes);

    // Execution rate percentage = (actual / scheduled) * 100
    const executionRatePercentage =
      totalScheduledMinutes > 0
        ? Math.min(100, Math.max(0, Math.round((totalActualMinutes / totalScheduledMinutes) * 100)))
        : 0;

    // Has at least 1 minute of valid work with start photo
    const hasValidPhotoTask = validTasks.some(
      (t) => (t.photos || []).some((p) => p.type === 'start') && this.calculateDurationMinutes(t.scheduled_start_at, t.scheduled_end_at) - (t.sabori_minutes || 0) > 0
    );

    return {
      date: dateStr,
      total_scheduled_minutes: totalScheduledMinutes,
      total_actual_minutes: totalActualMinutes,
      total_sabori_minutes: totalSaboriMinutes,
      execution_rate_percentage: executionRatePercentage,
      completed_tasks_count: validTasks.filter((t) => t.status === 'completed').length,
      photos_count: photosCount,
      is_achieved: hasValidPhotoTask,
    };
  }

  /**
   * Update streaks based on historical achieved tasks
   */
  static async refreshStreaks(): Promise<Streaks> {
    const allTasks = await getAllTasks();
    const currentStreaks = await getStreaks();

    // Map tasks by local date to check achievement
    const dateAchievementMap = new Map<string, boolean>();

    for (const task of allTasks) {
      if (task.status === 'completed' || task.status === 'running') {
        const dateKey = formatLocalDate(task.actual_start_at || task.scheduled_start_at);
        const hasStartPhoto = (task.photos || []).some((p) => p.type === 'start');
        const netMinutes = this.calculateDurationMinutes(task.scheduled_start_at, task.scheduled_end_at) - (task.sabori_minutes || 0);

        if (dateKey && hasStartPhoto && netMinutes >= 1) {
          dateAchievementMap.set(dateKey, true);
        }
      }
    }

    const achievedDates = Array.from(dateAchievementMap.keys()).sort();
    const today = this.getLocalDateString();
    const yesterday = this.getLocalDateString(new Date(Date.now() - 86400000));

    // Calculate current streak
    let streakCount = 0;
    let checkDate = new Date();

    // If today is achieved, start counting from today; otherwise start from yesterday
    if (dateAchievementMap.get(today)) {
      checkDate = new Date();
    } else if (dateAchievementMap.get(yesterday)) {
      checkDate = new Date(Date.now() - 86400000);
    } else {
      checkDate = new Date(); // 0 streak
    }

    let checkStr = this.getLocalDateString(checkDate);
    while (dateAchievementMap.get(checkStr)) {
      streakCount++;
      checkDate = new Date(checkDate.getTime() - 86400000);
      checkStr = this.getLocalDateString(checkDate);
    }

    // Calculate longest consecutive streak historically
    let maxHistoricalStreak = 0;
    if (achievedDates.length > 0) {
      let currentRun = 1;
      maxHistoricalStreak = 1;
      for (let i = 1; i < achievedDates.length; i++) {
        const prev = new Date(achievedDates[i - 1]);
        const curr = new Date(achievedDates[i]);
        const diffDays = Math.round((curr.getTime() - prev.getTime()) / 86400000);
        if (diffDays === 1) {
          currentRun++;
          if (currentRun > maxHistoricalStreak) maxHistoricalStreak = currentRun;
        } else {
          currentRun = 1;
        }
      }
    }

    const longestStreak = Math.max(currentStreaks.longest_streak || 0, streakCount, maxHistoricalStreak);
    const lastAchieved = achievedDates.length > 0 ? achievedDates[achievedDates.length - 1] : null;

    const newStreaks: Streaks = {
      current_streak: streakCount,
      longest_streak: longestStreak,
      last_achieved_date: lastAchieved,
      achieved_dates: achievedDates,
    };

    await updateStreaks(newStreaks);
    return newStreaks;
  }

  /**
   * Get weekly activity breakdown (last 7 days)
   */
  static async getWeeklyBreakdown(): Promise<DailySummary[]> {
    const days: DailySummary[] = [];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      const dateStr = this.getLocalDateString(d);
      const summary = await this.getDailySummary(dateStr);
      days.push(summary);
    }

    return days;
  }
}
