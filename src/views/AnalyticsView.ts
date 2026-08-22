/**
 * Analytics and Cognitive Feedback View (Section 3.5)
 */

import { getAllTasks, getStreaks } from '../db/db';
import { AnalyticsService } from '../services/analytics';
import type { DailySummary } from '../db/types';

export class AnalyticsView {
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  async render(): Promise<void> {
    const [streaks, weeklyDays, allTasks] = await Promise.all([
      getStreaks(),
      AnalyticsService.getWeeklyBreakdown(),
      getAllTasks(),
    ]);

    // Aggregate lifetime / weekly stats
    let totalScheduledLifetime = 0;
    let totalSaboriLifetime = 0;
    let totalActualLifetime = 0;
    const tagMinutesMap: Record<string, number> = {};

    for (const task of allTasks) {
      if (task.status === 'completed') {
        const schedMin = AnalyticsService.calculateDurationMinutes(task.scheduled_start_at, task.scheduled_end_at);
        const saboriMin = task.sabori_minutes || 0;
        const actualMin = AnalyticsService.calculatePureFocusMinutes(task);

        totalScheduledLifetime += schedMin;
        totalSaboriLifetime += saboriMin;
        totalActualLifetime += actualMin;

        tagMinutesMap[task.tag] = (tagMinutesMap[task.tag] || 0) + actualMin;
      }
    }

    const overallRate = totalScheduledLifetime > 0 ? Math.round((totalActualLifetime / totalScheduledLifetime) * 100) : 100;

    // Find max day minutes for 7-day bar chart scaling
    const maxDayMinutes = Math.max(60, ...weeklyDays.map((d) => d.total_scheduled_minutes));

    this.container.innerHTML = `
      <div style="margin-bottom: 20px;">
        <h1 style="font-size: 1.35rem; font-weight: 800; color: var(--text-primary);">📊 分析・認知科学的効果</h1>
        <p style="font-size: 0.82rem; color: var(--text-secondary); margin-top: 2px;">
          集中実績とサボり時間の可視化・フィードバックループ
        </p>
      </div>

      <!-- Streaks Highlights -->
      <div style="background: linear-gradient(135deg, rgba(234, 88, 12, 0.2) 0%, rgba(249, 115, 22, 0.1) 100%); border: 1px solid rgba(249, 115, 22, 0.3); border-radius: var(--radius-lg); padding: 18px; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between;">
        <div>
          <div style="font-size: 0.8rem; font-weight: 700; color: var(--accent-streak); text-transform: uppercase; letter-spacing: 0.05em;">継続ストリーク</div>
          <div style="font-family: var(--font-mono); font-size: 2.2rem; font-weight: 800; color: #ffffff; line-height: 1.1; margin-top: 2px;">
            ${streaks.current_streak} <span style="font-size: 1rem; font-weight: 600; color: #fed7aa;">日連続達成</span>
          </div>
          <div style="font-size: 0.76rem; color: var(--text-muted); margin-top: 4px;">
            最高記録: ${streaks.longest_streak}日連続 / 総達成日数: ${(streaks.achieved_dates || []).length}日
          </div>
        </div>
        <div style="font-size: 3rem; filter: drop-shadow(0 0 16px var(--accent-streak-glow));">🔥</div>
      </div>

      <!-- Lifetime Core Metrics -->
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 24px;">
        <div class="stat-card" style="padding: 12px;">
          <div class="stat-label" style="font-size: 0.72rem;">純集中時間</div>
          <div class="stat-value" style="font-size: 1.4rem; color: var(--accent-success); margin-top: 4px;">
            ${(totalActualLifetime / 60).toFixed(1)}<span style="font-size: 0.75rem;">h</span>
          </div>
        </div>

        <div class="stat-card" style="padding: 12px;">
          <div class="stat-label" style="font-size: 0.72rem;">サボり時間</div>
          <div class="stat-value" style="font-size: 1.4rem; color: ${totalSaboriLifetime > 0 ? 'var(--accent-danger)' : 'var(--text-secondary)'}; margin-top: 4px;">
            ${totalSaboriLifetime}<span style="font-size: 0.75rem;">分</span>
          </div>
        </div>

        <div class="stat-card" style="padding: 12px;">
          <div class="stat-label" style="font-size: 0.72rem;">通算実行率</div>
          <div class="stat-value" style="font-size: 1.4rem; color: var(--accent-primary); margin-top: 4px;">
            ${overallRate}<span style="font-size: 0.75rem;">%</span>
          </div>
        </div>
      </div>

      <!-- 7-Day Performance Chart -->
      <div class="stat-card" style="margin-bottom: 24px; padding: 18px;">
        <div class="section-title" style="font-size: 0.95rem; margin-bottom: 16px;">
          <span>📈 直近7日間の日次実行率</span>
        </div>

        <div style="display: flex; align-items: flex-end; justify-content: space-between; height: 140px; gap: 8px; padding-top: 10px;">
          ${weeklyDays
            .map((day) => this.renderDayBar(day, maxDayMinutes))
            .join('')}
        </div>

        <div style="display: flex; justify-content: center; gap: 16px; margin-top: 16px; font-size: 0.74rem; color: var(--text-muted);">
          <div style="display: flex; align-items: center; gap: 4px;">
            <div style="width: 10px; height: 10px; background: var(--accent-primary); border-radius: 2px;"></div>
            <span>純集中時間</span>
          </div>
          <div style="display: flex; align-items: center; gap: 4px;">
            <div style="width: 10px; height: 10px; background: var(--accent-danger); border-radius: 2px;"></div>
            <span>サボり時間</span>
          </div>
        </div>
      </div>

      <!-- Tag Distribution -->
      <div class="stat-card" style="padding: 18px;">
        <div class="section-title" style="font-size: 0.95rem; margin-bottom: 12px;">
          <span>🏷️ カテゴリ別集中時間</span>
        </div>

        ${
          Object.keys(tagMinutesMap).length === 0
            ? '<p style="font-size: 0.8rem; color: var(--text-muted);">まだ完了したタスクデータがありません</p>'
            : Object.entries(tagMinutesMap)
                .sort((a, b) => b[1] - a[1])
                .map(([tag, mins]) => {
                  const pct = totalActualLifetime > 0 ? Math.round((mins / totalActualLifetime) * 100) : 0;
                  return `
                  <div style="margin-bottom: 12px;">
                    <div style="display: flex; justify-content: space-between; font-size: 0.82rem; margin-bottom: 4px;">
                      <span style="font-weight: 600; color: var(--text-primary);">${tag}</span>
                      <span style="font-family: var(--font-mono); color: var(--text-secondary);">${mins}分 (${pct}%)</span>
                    </div>
                    <div class="stat-progress-bar" style="margin-top: 0; height: 8px;">
                      <div class="stat-progress-fill" style="width: ${pct}%;"></div>
                    </div>
                  </div>
                `;
                })
                .join('')
        }
      </div>
    `;
  }

  private renderDayBar(day: DailySummary, maxMinutes: number): string {
    const dayLabel = day.date.substring(8, 10);
    const actualHeight = Math.round((day.total_actual_minutes / maxMinutes) * 100);
    const saboriHeight = Math.round((day.total_sabori_minutes / maxMinutes) * 100);

    return `
      <div style="display: flex; flex-direction: column; align-items: center; flex: 1; height: 100%;">
        <div style="font-size: 0.68rem; font-family: var(--font-mono); color: var(--text-muted); margin-bottom: 4px;">
          ${day.execution_rate_percentage}%
        </div>
        <div style="flex: 1; width: 100%; max-width: 24px; background: var(--bg-tertiary); border-radius: var(--radius-sm); display: flex; flex-direction: column-reverse; overflow: hidden;">
          <div style="height: ${actualHeight}%; width: 100%; background: var(--accent-primary); transition: height 0.5s ease;"></div>
          <div style="height: ${saboriHeight}%; width: 100%; background: var(--accent-danger); transition: height 0.5s ease;"></div>
        </div>
        <div style="font-size: 0.72rem; font-family: var(--font-mono); color: ${day.is_achieved ? 'var(--accent-streak)' : 'var(--text-secondary)'}; font-weight: 700; margin-top: 6px;">
          ${dayLabel}
        </div>
      </div>
    `;
  }
}
