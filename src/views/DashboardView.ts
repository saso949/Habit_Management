/**
 * Dashboard View (Main screen for tasks & quick starts)
 */

import { getTasksForDate, getStreaks, deleteTask } from '../db/db';
import type { Task, TaskPhoto } from '../db/types';
import { AnalyticsService } from '../services/analytics';
import { FocusTimerService } from '../services/timer';
import { SoundService } from '../services/sound';
import { TaskFormModal } from '../components/TaskFormModal';
import { FocusScreen } from '../components/FocusScreen';
import { CameraModal } from '../components/CameraModal';
import { formatLocalTime, formatLocalDate, diffInMinutes } from '../utils/date';

export class DashboardView {
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  async render(): Promise<void> {
    const todayStr = formatLocalDate(new Date());
    const [summary, streaks, todayTasks] = await Promise.all([
      AnalyticsService.getDailySummary(todayStr),
      getStreaks(),
      getTasksForDate(todayStr),
    ]);

    const runningTask = FocusTimerService.getActiveTask() || todayTasks.find((t) => t.status === 'running');
    const scheduledTasks = todayTasks.filter((t) => t.status === 'pending');
    const completedTasks = todayTasks.filter((t) => t.status === 'completed');

    this.container.innerHTML = `
      <!-- Hero Top Stats: Streaks & Daily Execution Rate -->
      <div class="hero-stats-grid">
        <!-- Streak Card -->
        <div class="stat-card streak-card">
          <div class="stat-card-header">
            <span class="stat-label">ストリーク</span>
            <span style="font-size: 1.2rem;">🔥</span>
          </div>
          <div class="stat-value-group">
            <span class="stat-value" style="color: var(--accent-streak);">${streaks.current_streak}</span>
            <span class="stat-unit">日連続</span>
          </div>
          <div class="stat-progress-bar">
            <div class="stat-progress-fill streak" style="width: ${Math.min(100, (streaks.current_streak / Math.max(7, streaks.longest_streak || 7)) * 100)}%;"></div>
          </div>
          <div class="stat-subtext">
            ${summary.is_achieved ? '✅ 本日の達成条件クリア' : '最高: ' + streaks.longest_streak + '日連続'}
          </div>
        </div>

        <!-- Daily Execution Rate Card -->
        <div class="stat-card">
          <div class="stat-card-header">
            <span class="stat-label">日次実行率</span>
            <span style="font-size: 0.8rem; font-weight: 700; color: var(--accent-cyan);">${summary.total_actual_minutes}分 集中</span>
          </div>
          <div class="stat-value-group">
            <span class="stat-value" style="color: ${summary.execution_rate_percentage >= 80 ? 'var(--accent-success)' : 'var(--text-primary)'};">${summary.execution_rate_percentage}</span>
            <span class="stat-unit">%</span>
          </div>
          <div class="stat-progress-bar">
            <div class="stat-progress-fill" style="width: ${summary.execution_rate_percentage}%;"></div>
          </div>
          <div class="stat-subtext" style="color: ${summary.total_sabori_minutes > 0 ? 'var(--accent-danger)' : 'var(--text-muted)'};">
            ${summary.total_sabori_minutes > 0 ? 'サボり時間: ' + summary.total_sabori_minutes + '分' : 'サボりなし (順調)'}
          </div>
        </div>
      </div>

      <!-- Active Running Task Banner (if active) -->
      ${
        runningTask
          ? `
        <div class="task-card active-running" style="margin-bottom: 20px;" id="active-task-banner">
          <div class="task-card-header">
            <div class="task-tags-group">
              <span class="tag-badge">${runningTask.tag}</span>
              <span class="status-badge running">実行中</span>
            </div>
            <span style="font-size: 0.8rem; font-family: var(--font-mono); color: var(--accent-success);">集中セッション進行中</span>
          </div>
          <div class="task-title" style="font-size: 1.2rem;">${runningTask.title}</div>
          <button class="btn btn-primary btn-full btn-lg" id="reopen-focus-screen-btn" style="margin-top: 6px;">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            <span>全画面集中モードに戻る</span>
          </button>
        </div>
      `
          : ''
      }

      <!-- Hero Action Card: Quick Start & Schedule -->
      <div class="hero-action-card">
        <div class="hero-action-header">
          <div class="hero-action-title">
            <span>⚡ 集中セッションを開始</span>
          </div>
          <div class="hero-action-desc">
            写真撮影（実体化トリガー）でコミットメントを固定し、集中に入ります
          </div>
        </div>
        <div class="hero-action-buttons">
          <button class="btn btn-primary btn-lg" id="hero-now-start-btn">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
            </svg>
            <span>今すぐ開始</span>
          </button>

          <button class="btn btn-secondary btn-lg" id="hero-schedule-btn">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            <span>事前予約</span>
          </button>
        </div>
      </div>

      <!-- Scheduled Tasks Section -->
      <div class="section-header">
        <div class="section-title">
          <span>📅 本日の事前予約タスク</span>
        </div>
        <span class="section-badge">${scheduledTasks.length}件</span>
      </div>

      <div class="tasks-list" id="scheduled-tasks-list">
        ${
          scheduledTasks.length === 0
            ? `
          <div class="empty-state">
            <div class="empty-state-title">事前予約されたタスクはありません</div>
            <div class="empty-state-desc">「事前予約」から未来の作業時間を確保しましょう</div>
          </div>
        `
            : scheduledTasks
                .map((t) => this.renderScheduledTaskCard(t))
                .join('')
        }
      </div>

      <!-- Today's Completed Tasks Section -->
      <div class="section-header">
        <div class="section-title">
          <span>✅ 本日完了したタスク</span>
        </div>
        <span class="section-badge">${completedTasks.length}件</span>
      </div>

      <div class="tasks-list" id="completed-tasks-list">
        ${
          completedTasks.length === 0
            ? `
          <div class="empty-state">
            <div class="empty-state-title">完了したタスクはまだありません</div>
            <div class="empty-state-desc">タスクを完了して本日のストリークを維持しましょう</div>
          </div>
        `
            : completedTasks
                .map((t) => this.renderCompletedTaskCard(t))
                .join('')
        }
      </div>
    `;

    this.bindEvents(runningTask, scheduledTasks);
  }

  private renderScheduledTaskCard(task: Task): string {
    const startHourMin = formatLocalTime(task.scheduled_start_at);
    const endHourMin = formatLocalTime(task.scheduled_end_at);
    const durationMin = diffInMinutes(task.scheduled_start_at, task.scheduled_end_at);

    return `
      <div class="task-card scheduled-pending" data-task-id="${task.id}">
        <div class="task-card-header">
          <div class="task-tags-group">
            <span class="tag-badge">${task.tag}</span>
            <span class="status-badge scheduled">予約中</span>
          </div>
          <button class="btn-icon-only delete-task-btn" data-id="${task.id}" style="color: var(--text-muted);" aria-label="削除">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>

        <div class="task-title">${task.title}</div>

        <div class="task-meta-row">
          <div class="task-time-info">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            <span>${startHourMin} 〜 ${endHourMin} (${durationMin}分)</span>
          </div>
        </div>

        <button class="btn btn-primary btn-full start-scheduled-task-btn" data-id="${task.id}" style="margin-top: 4px;">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
            <circle cx="12" cy="13" r="4"></circle>
          </svg>
          <span>📸 撮影して今すぐ開始</span>
        </button>
      </div>
    `;
  }

  private renderCompletedTaskCard(task: Task): string {
    const scheduledMin = diffInMinutes(task.scheduled_start_at, task.scheduled_end_at);
    const saboriMin = task.sabori_minutes || 0;
    const actualMin = Math.max(0, scheduledMin - saboriMin);

    const photos = task.photos || [];

    return `
      <div class="task-card" data-task-id="${task.id}">
        <div class="task-card-header">
          <div class="task-tags-group">
            <span class="tag-badge">${task.tag}</span>
            <span class="status-badge completed">完了</span>
            ${task.break_minutes ? `<span class="tag-badge" style="background: rgba(16, 185, 129, 0.15); color: #6ee7b7; border-color: rgba(16, 185, 129, 0.3);">☕ 休憩 ${task.break_minutes}分</span>` : ''}
          </div>
          ${saboriMin > 0 ? `<span class="sabori-badge">サボり ${saboriMin}分</span>` : ''}
        </div>

        <div class="task-title">${task.title}</div>

        <div class="task-meta-row">
          <div class="task-time-info">
            <span>純集中: <strong>${actualMin}分</strong> / 予約 ${scheduledMin}分</span>
          </div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">
            ${task.ended_at ? formatLocalTime(task.ended_at) + ' 終了' : ''}
          </div>
        </div>

        ${
          photos.length > 0
            ? `
          <div class="task-photos-thumb-row">
            ${photos
              .map(
                (p) =>
                  `<img src="${p.data_url}" class="photo-thumb" alt="進捗写真" title="${p.type === 'start' ? '開始時' : 'チェックイン'} ${formatLocalTime(p.timestamp)}" />`
              )
              .join('')}
          </div>
        `
            : ''
        }
      </div>
    `;
  }

  private bindEvents(runningTask: Task | undefined, scheduledTasks: Task[]): void {
    // Re-open active focus screen
    const reopenBtn = this.container.querySelector('#reopen-focus-screen-btn');
    if (reopenBtn && runningTask) {
      reopenBtn.addEventListener('click', () => {
        FocusScreen.mount(runningTask);
      });
    }

    // Now Start Button
    const nowStartBtn = this.container.querySelector('#hero-now-start-btn');
    if (nowStartBtn) {
      nowStartBtn.addEventListener('click', () => {
        TaskFormModal.open({
          initialType: 'now',
          onCreated: (task) => {
            if (task.status === 'running') {
              FocusScreen.mount(task);
            }
            this.render();
          },
        });
      });
    }

    // Schedule Button
    const scheduleBtn = this.container.querySelector('#hero-schedule-btn');
    if (scheduleBtn) {
      scheduleBtn.addEventListener('click', () => {
        TaskFormModal.open({
          initialType: 'scheduled',
          onCreated: () => {
            this.render();
          },
        });
      });
    }

    // Start Scheduled Task via Camera
    this.container.querySelectorAll('.start-scheduled-task-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        SoundService.stopAlarm(); // Stop any due alarm immediately
        const taskId = (e.currentTarget as HTMLElement).dataset.id;
        const task = scheduledTasks.find((t) => t.id === taskId);
        if (!task) return;

        CameraModal.open({
          title: '実体化トリガー: 予約タスク開始',
          subtitle: `「${task.title}」のデスクを撮影して開始判定を行います`,
          confirmLabel: 'この写真でタスクを開始する',
          onPhotoConfirmed: async (dataUrl) => {
            const startPhoto: TaskPhoto = {
              type: 'start',
              timestamp: new Date().toISOString(),
              data_url: dataUrl,
            };
            task.photos = task.photos || [];
            task.photos.push(startPhoto);

            await FocusTimerService.startTask(task);
            FocusScreen.mount(task);
            this.render();
          },
        });
      });
    });

    // Delete Task
    this.container.querySelectorAll('.delete-task-btn').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const taskId = (e.currentTarget as HTMLElement).dataset.id;
        if (taskId && confirm('このタスクを削除しますか？')) {
          await deleteTask(taskId);
          this.render();
        }
      });
    });
  }
}
