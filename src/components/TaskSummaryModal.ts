/**
 * Task Completion Summary Modal with Celebration Confetti
 */

import confetti from 'canvas-confetti';
import type { Task } from '../db/types';
import { AnalyticsService } from '../services/analytics';
import { formatLocalTime } from '../utils/date';

export class TaskSummaryModal {
  private static modalEl: HTMLElement | null = null;

  static async open(task: Task): Promise<void> {
    this.close();

    // Trigger celebratory confetti
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#6366f1', '#8b5cf6', '#f97316', '#10b981', '#ffffff'],
      });
    } catch (e) {
      console.warn('Confetti error:', e);
    }

    const scheduledMin = AnalyticsService.calculateDurationMinutes(task.scheduled_start_at, task.scheduled_end_at);
    const saboriMin = task.sabori_minutes || 0;
    const actualMin = Math.max(0, scheduledMin - saboriMin);
    const executionRate = scheduledMin > 0 ? Math.round((actualMin / scheduledMin) * 100) : 100;

    const streaks = await AnalyticsService.refreshStreaks();

    const mountPoint = document.getElementById('modal-container');
    if (!mountPoint) return;

    const modal = document.createElement('div');
    modal.className = 'modal-backdrop open';
    modal.id = 'task-summary-modal';

    const renderPhotos = () => {
      if (!task.photos || task.photos.length === 0) return '<p style="font-size: 0.8rem; color: var(--text-dim);">写真記録なし</p>';
      return `
        <div style="display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px;">
          ${task.photos
            .map(
              (p) => `
              <div style="flex-shrink: 0; text-align: center;">
                <img src="${p.data_url}" style="width: 84px; height: 84px; object-fit: cover; border-radius: var(--radius-sm); border: 1px solid var(--border-medium);" alt="セッション写真" />
                <div style="font-size: 0.68rem; color: var(--text-muted); margin-top: 2px;">${p.type === 'start' ? '開始時' : '進捗'} ${formatLocalTime(p.timestamp)}</div>
              </div>
            `
            )
            .join('')}
        </div>
      `;
    };

    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <div>
            <div class="modal-title">🎉 タスク完了！お疲れ様でした</div>
            <div style="font-size: 0.8rem; color: var(--text-secondary);">集中セッションの成果サマリー</div>
          </div>
          <button class="modal-close-btn" id="summary-close-btn" aria-label="閉じる">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div class="modal-body">
          <!-- Task Info Header -->
          <div style="background: var(--bg-secondary); padding: 14px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
              <span class="tag-badge">${task.tag}</span>
              <span class="status-badge completed">完了</span>
            </div>
            <div style="font-size: 1.1rem; font-weight: 700; color: var(--text-primary);">${task.title}</div>
          </div>

          <!-- Stats Grid -->
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;">
            <div style="background: var(--bg-tertiary); padding: 12px; border-radius: var(--radius-md); text-align: center;">
              <div style="font-size: 0.72rem; color: var(--text-muted); font-weight: 600;">予約時間</div>
              <div style="font-family: var(--font-mono); font-size: 1.25rem; font-weight: 800; color: var(--text-primary); margin-top: 2px;">
                ${scheduledMin}<span style="font-size: 0.75rem; font-weight: 600;">分</span>
              </div>
            </div>

            <div style="background: var(--bg-tertiary); padding: 12px; border-radius: var(--radius-md); text-align: center;">
              <div style="font-size: 0.72rem; color: var(--text-muted); font-weight: 600;">サボり時間</div>
              <div style="font-family: var(--font-mono); font-size: 1.25rem; font-weight: 800; color: ${saboriMin > 0 ? 'var(--accent-danger)' : 'var(--text-secondary)'}; margin-top: 2px;">
                ${saboriMin}<span style="font-size: 0.75rem; font-weight: 600;">分</span>
              </div>
            </div>

            <div style="background: var(--bg-tertiary); padding: 12px; border-radius: var(--radius-md); text-align: center;">
              <div style="font-size: 0.72rem; color: var(--text-muted); font-weight: 600;">純集中時間</div>
              <div style="font-family: var(--font-mono); font-size: 1.25rem; font-weight: 800; color: var(--accent-success); margin-top: 2px;">
                ${actualMin}<span style="font-size: 0.75rem; font-weight: 600;">分</span>
              </div>
            </div>
          </div>

          <!-- Execution Rate Banner -->
          <div style="background: linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(139, 92, 246, 0.15) 100%); border: 1px solid rgba(99, 102, 241, 0.3); border-radius: var(--radius-md); padding: 12px 16px; display: flex; align-items: center; justify-content: space-between;">
            <div>
              <div style="font-size: 0.75rem; font-weight: 700; color: #c7d2fe;">タスク実行率</div>
              <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 2px;">(純集中 / 予約)</div>
            </div>
            <div style="font-family: var(--font-mono); font-size: 1.8rem; font-weight: 800; color: #ffffff;">
              ${executionRate}%
            </div>
          </div>

          <!-- Streak Info -->
          <div style="display: flex; align-items: center; gap: 10px; background: rgba(249, 115, 22, 0.1); border: 1px solid rgba(249, 115, 22, 0.25); border-radius: var(--radius-md); padding: 12px 16px;">
            <div style="font-size: 1.8rem;">🔥</div>
            <div>
              <div style="font-size: 0.85rem; font-weight: 700; color: #ffedd5;">現在のストリーク: ${streaks.current_streak}日連続達成！</div>
              <div style="font-size: 0.74rem; color: var(--text-muted);">最高記録: ${streaks.longest_streak}日連続</div>
            </div>
          </div>

          <!-- Photos taken -->
          <div class="form-group">
            <label class="form-label">実体化トリガー & 進捗写真記録</label>
            ${renderPhotos()}
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-primary btn-full" id="summary-done-btn">
            ダッシュボードへ戻る
          </button>
        </div>
      </div>
    `;

    mountPoint.appendChild(modal);
    this.modalEl = modal;

    const closeBtn = modal.querySelector('#summary-close-btn') as HTMLButtonElement;
    const doneBtn = modal.querySelector('#summary-done-btn') as HTMLButtonElement;

    const handleDismiss = () => {
      TaskSummaryModal.close();
      window.dispatchEvent(new CustomEvent('task-state-changed'));
    };

    closeBtn.addEventListener('click', handleDismiss);
    doneBtn.addEventListener('click', handleDismiss);
  }

  static close(): void {
    if (this.modalEl) {
      this.modalEl.remove();
      this.modalEl = null;
    }
  }
}
