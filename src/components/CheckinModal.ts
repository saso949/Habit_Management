/**
 * High-Priority Periodic Check-in Intervention Modal (Section 3.3)
 */

import type { Task } from '../db/types';
import { FocusTimerService } from '../services/timer';
import { CameraModal } from './CameraModal';

export class CheckinModal {
  private static modalEl: HTMLElement | null = null;

  static open(task: Task, overdueSeconds: number): void {
    if (this.modalEl) {
      // Update existing penalty display
      this.updatePenaltyDisplay(task, overdueSeconds);
      return;
    }

    const mountPoint = document.getElementById('checkin-container');
    if (!mountPoint) return;

    const overlay = document.createElement('div');
    overlay.className = 'checkin-alert-overlay';
    overlay.id = 'active-checkin-alert-modal';

    overlay.innerHTML = `
      <div style="font-size: 0.8rem; font-weight: 700; color: var(--accent-danger); letter-spacing: 0.1em; text-transform: uppercase;">
        ⚡ 認知科学的定期チェックイン介入
      </div>

      <div class="checkin-alert-center">
        <div class="checkin-alert-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
          </svg>
        </div>

        <div class="checkin-alert-title">作業を継続していますか？</div>
        <div class="checkin-alert-desc">
          「${task.title}」の定期確認です。応答して集中状態を維持しましょう。
        </div>

        <!-- Penalty / On-time Status Box -->
        <div class="checkin-penalty-timer" id="checkin-status-box">
          <div style="font-size: 0.78rem; color: var(--text-secondary);" id="checkin-status-heading">オンタイム受付中 (10分以内)</div>
          <div class="checkin-penalty-val" id="checkin-penalty-number" style="color: var(--accent-success);">オンタイム (サボり0分)</div>
          <div style="font-size: 0.72rem; color: var(--text-muted);" id="checkin-status-sub">10分を超過するとサボり時間に加算されます</div>
        </div>
      </div>

      <div class="checkin-actions-stack">
        <button class="btn btn-primary btn-lg btn-full" id="checkin-ok-btn">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <span>作業継続中 (OK)</span>
        </button>

        <button class="btn btn-secondary btn-full" id="checkin-photo-btn">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
            <circle cx="12" cy="13" r="4"></circle>
          </svg>
          <span>進捗写真を撮影してチェックイン</span>
        </button>
      </div>
    `;

    mountPoint.appendChild(overlay);
    this.modalEl = overlay;

    const okBtn = overlay.querySelector('#checkin-ok-btn') as HTMLButtonElement;
    const photoBtn = overlay.querySelector('#checkin-photo-btn') as HTMLButtonElement;

    okBtn.addEventListener('click', async () => {
      await FocusTimerService.confirmCheckin();
      CheckinModal.close();
    });

    photoBtn.addEventListener('click', () => {
      CameraModal.open({
        title: 'チェックイン写真撮影',
        subtitle: '現在の進捗を写真に収めてコミットします',
        confirmLabel: 'この進捗写真でチェックイン',
        onPhotoConfirmed: async (dataUrl) => {
          await FocusTimerService.confirmCheckin(dataUrl);
          CheckinModal.close();
        },
      });
    });

    this.updatePenaltyDisplay(task, overdueSeconds);
  }

  private static updatePenaltyDisplay(_task: Task, overdueSeconds: number): void {
    if (!this.modalEl) return;

    const heading = this.modalEl.querySelector('#checkin-status-heading') as HTMLElement;
    const val = this.modalEl.querySelector('#checkin-penalty-number') as HTMLElement;
    const sub = this.modalEl.querySelector('#checkin-status-sub') as HTMLElement;

    if (overdueSeconds > 0) {
      const overdueMins = Math.ceil(overdueSeconds / 60);
      heading.textContent = '⚠️ 遅延ペナルティ適用中';
      heading.style.color = 'var(--accent-danger)';
      val.textContent = `サボり時間 +${overdueMins}分`;
      val.style.color = 'var(--accent-danger)';
      sub.textContent = '現在超過した時間がサボり時間として日次集計に反映されています';
    } else {
      heading.textContent = 'オンタイム受付中 (10分以内)';
      heading.style.color = 'var(--text-secondary)';
      val.textContent = 'オンタイム (サボり0分)';
      val.style.color = 'var(--accent-success)';
      sub.textContent = '10分を超過するとサボり時間に加算されます';
    }
  }

  static close(): void {
    if (this.modalEl) {
      this.modalEl.remove();
      this.modalEl = null;
    }
  }
}
