/**
 * Fullscreen Cognitive Focus Screen (Section 3.2 & Section 3.4)
 * Eliminates environmental distractions with Clock Mode and Pure OLED Dark Mode
 */

import type { Task, FullscreenMode } from '../db/types';
import { FocusTimerService, type FocusTimerState } from '../services/timer';
import { CameraModal } from './CameraModal';
import { CheckinModal } from './CheckinModal';
import { TaskSummaryModal } from './TaskSummaryModal';

export class FocusScreen {
  private static container: HTMLElement | null = null;
  private static currentMode: FullscreenMode = 'clock';
  private static unsubscribeTimer: (() => void) | null = null;
  private static unsubscribeCheckin: (() => void) | null = null;
  private static unsubscribeExpired: (() => void) | null = null;
  private static expiryDialogEl: HTMLElement | null = null;

  static mount(task: Task): void {
    this.unmount();

    const mountPoint = document.getElementById('focus-container');
    if (!mountPoint) return;

    this.currentMode = task.fullscreen_mode || 'clock';

    const screenEl = document.createElement('div');
    screenEl.className = `focus-screen-overlay mode-${this.currentMode}`;
    screenEl.id = 'active-focus-screen';

    screenEl.innerHTML = `
      <!-- Header -->
      <div class="focus-header">
        <div class="focus-task-info">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span class="tag-badge">${task.tag}</span>
            <span class="status-badge running" id="focus-status-badge">集中中</span>
          </div>
          <div class="focus-task-title">${task.title}</div>
        </div>

        <button class="focus-mode-toggle-btn" id="focus-mode-toggle" aria-label="画面モード切替">
          ${this.currentMode === 'clock' ? '🌙 暗転' : '🕒 時計'}
        </button>
      </div>

      <!-- Center Stage: Giant Clock & Countdown Arc -->
      <div class="focus-center-stage">
        <div class="focus-clock-container">
          <svg class="focus-progress-svg" viewBox="0 0 200 200">
            <defs>
              <linearGradient id="focusGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#6366f1" />
                <stop offset="50%" stop-color="#a855f7" />
                <stop offset="100%" stop-color="#ec4899" />
              </linearGradient>
            </defs>
            <circle class="focus-progress-bg" cx="100" cy="100" r="90" fill="none" stroke-width="8"></circle>
            <circle class="focus-progress-bar" id="focus-svg-bar" cx="100" cy="100" r="90" fill="none" stroke-width="8" stroke-dasharray="565.48" stroke-dashoffset="0" stroke-linecap="round"></circle>
          </svg>

          <div class="focus-clock-inner">
            <div class="current-wall-clock" id="focus-wall-clock">--:--:--</div>
            <div class="focus-timer-main" id="focus-remaining-digits">--:--</div>
            <div class="focus-timer-label" id="focus-timer-label">残り時間</div>
            <div class="focus-checkin-countdown-badge" id="focus-next-checkin-badge">
              <span>🔔 チェックインまで:</span>
              <strong id="focus-next-checkin-val">--:--</strong>
            </div>
          </div>
        </div>
      </div>

      <!-- Bottom Controls -->
      <div class="focus-bottom-controls">
        <!-- Quick Extend Presets -->
        <div class="focus-quick-extend-row">
          <span style="font-size: 0.76rem; color: var(--text-muted); font-weight: 600;">時間延長:</span>
          <button class="extend-pill-btn" data-extend="15">+15分</button>
          <button class="extend-pill-btn" data-extend="30">+30分</button>
          <button class="extend-pill-btn" data-extend="60">+60分</button>
        </div>

        <!-- Main Actions -->
        <div class="focus-main-actions-row">
          <button class="btn btn-secondary" id="focus-manual-checkin-btn">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
              <circle cx="12" cy="13" r="4"></circle>
            </svg>
            <span>進捗撮影</span>
          </button>

          <button class="btn btn-primary" id="focus-finish-btn" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%);">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span>終了する</span>
          </button>
        </div>
      </div>
    `;

    mountPoint.appendChild(screenEl);
    this.container = screenEl;

    // Elements
    const wallClockEl = screenEl.querySelector('#focus-wall-clock') as HTMLElement;
    const remainingDigitsEl = screenEl.querySelector('#focus-remaining-digits') as HTMLElement;
    const timerLabelEl = screenEl.querySelector('#focus-timer-label') as HTMLElement;
    const nextCheckinEl = screenEl.querySelector('#focus-next-checkin-val') as HTMLElement;
    const svgBarEl = screenEl.querySelector('#focus-svg-bar') as SVGCircleElement;
    const modeToggleBtn = screenEl.querySelector('#focus-mode-toggle') as HTMLButtonElement;
    const manualCheckinBtn = screenEl.querySelector('#focus-manual-checkin-btn') as HTMLButtonElement;
    const finishBtn = screenEl.querySelector('#focus-finish-btn') as HTMLButtonElement;

    const circumference = 2 * Math.PI * 90; // ~565.48

    // Mode Toggle Handler
    modeToggleBtn.addEventListener('click', () => {
      this.currentMode = this.currentMode === 'clock' ? 'dark' : 'clock';
      screenEl.className = `focus-screen-overlay mode-${this.currentMode}`;
      modeToggleBtn.innerHTML = this.currentMode === 'clock' ? '🌙 暗転' : '🕒 時計';
    });

    // Quick Duration Extension Handlers
    screenEl.querySelectorAll('.extend-pill-btn').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const mins = Number((e.currentTarget as HTMLElement).dataset.extend);
        if (mins) {
          await FocusTimerService.extendDuration(mins);
          this.closeExpiryDialog();
        }
      });
    });

    // Manual Progress Photo Check-in
    manualCheckinBtn.addEventListener('click', () => {
      CameraModal.open({
        title: '進捗チェックイン撮影',
        subtitle: '現在の作業進捗・デスクの様子を記録します',
        confirmLabel: 'この進捗写真を記録する',
        onPhotoConfirmed: async (dataUrl) => {
          await FocusTimerService.confirmCheckin(dataUrl);
        },
      });
    });

    // Finish Session Handler
    finishBtn.addEventListener('click', async () => {
      const completedTask = await FocusTimerService.completeTask();
      if (completedTask) {
        FocusScreen.unmount();
        TaskSummaryModal.open(completedTask);
      }
    });

    // Subscribe to timer ticks
    this.unsubscribeTimer = FocusTimerService.addTickListener((state: FocusTimerState) => {
      wallClockEl.textContent = state.wallClockString;

      if (state.isSessionExpired) {
        timerLabelEl.textContent = '予定時間到達';
        remainingDigitsEl.textContent = '00:00';
        remainingDigitsEl.style.color = 'var(--accent-warning)';
        svgBarEl.style.strokeDashoffset = '0';
      } else {
        timerLabelEl.textContent = '残り時間';
        remainingDigitsEl.style.color = '#ffffff';

        // Format remaining time
        const remHours = Math.floor(state.remainingSeconds / 3600);
        const remMins = Math.floor((state.remainingSeconds % 3600) / 60);
        const remSecs = state.remainingSeconds % 60;

        if (remHours > 0) {
          remainingDigitsEl.textContent = `${remHours}:${String(remMins).padStart(2, '0')}:${String(remSecs).padStart(2, '0')}`;
        } else {
          remainingDigitsEl.textContent = `${String(remMins).padStart(2, '0')}:${String(remSecs).padStart(2, '0')}`;
        }

        // Update SVG circle offset
        const progressFraction = Math.min(1, Math.max(0, state.elapsedSeconds / state.totalDurationSeconds));
        const offset = circumference * (1 - progressFraction);
        svgBarEl.style.strokeDashoffset = `${offset}`;
      }

      // Format next check-in countdown
      const checkinMins = Math.floor(state.secondsUntilNextCheckin / 60);
      const checkinSecs = state.secondsUntilNextCheckin % 60;
      nextCheckinEl.textContent = `${String(checkinMins).padStart(2, '0')}:${String(checkinSecs).padStart(2, '0')}`;
    });

    // Subscribe to periodic check-in alert triggers
    this.unsubscribeCheckin = FocusTimerService.addCheckinListener((activeTask, overdueSecs) => {
      CheckinModal.open(activeTask, overdueSecs);
    });

    // Subscribe to session expiry prompt (Section 3.4)
    this.unsubscribeExpired = FocusTimerService.addExpiredListener((activeTask) => {
      this.showExpiryPrompt(activeTask);
    });
  }

  /**
   * Section 3.4: Show "終了しますか？延長しますか？" dialog on timer reaching 0
   */
  private static showExpiryPrompt(task: Task): void {
    if (this.expiryDialogEl) return;

    const dialog = document.createElement('div');
    dialog.className = 'modal-backdrop open';
    dialog.id = 'session-expiry-dialog';

    dialog.innerHTML = `
      <div class="modal-content" style="background: rgba(18, 22, 33, 0.96);">
        <div class="modal-header">
          <div class="modal-title">⏰ 予約時間に到達しました</div>
        </div>
        <div class="modal-body" style="text-align: center; gap: 14px;">
          <p style="font-size: 0.95rem; color: var(--text-primary);">
            「<strong>${task.title}</strong>」の予定終了時刻になりました。<br>作業を終了しますか？それとも延長しますか？
          </p>
          <div style="display: flex; justify-content: center; gap: 8px;">
            <button class="extend-pill-btn expiry-extend-btn" data-extend="15" style="padding: 10px 18px; font-size: 0.9rem;">+15分 延長</button>
            <button class="extend-pill-btn expiry-extend-btn" data-extend="30" style="padding: 10px 18px; font-size: 0.9rem;">+30分 延長</button>
            <button class="extend-pill-btn expiry-extend-btn" data-extend="60" style="padding: 10px 18px; font-size: 0.9rem;">+60分 延長</button>
          </div>
        </div>
        <div class="modal-footer" style="flex-direction: column;">
          <button class="btn btn-primary btn-lg btn-full" id="expiry-complete-btn" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%);">
            🎉 このまま完了して記録する
          </button>
        </div>
      </div>
    `;

    document.getElementById('modal-container')?.appendChild(dialog);
    this.expiryDialogEl = dialog;

    dialog.querySelectorAll('.expiry-extend-btn').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const mins = Number((e.currentTarget as HTMLElement).dataset.extend);
        if (mins) {
          await FocusTimerService.extendDuration(mins);
          FocusScreen.closeExpiryDialog();
        }
      });
    });

    dialog.querySelector('#expiry-complete-btn')?.addEventListener('click', async () => {
      FocusScreen.closeExpiryDialog();
      const completed = await FocusTimerService.completeTask();
      if (completed) {
        FocusScreen.unmount();
        TaskSummaryModal.open(completed);
      }
    });
  }

  private static closeExpiryDialog(): void {
    if (this.expiryDialogEl) {
      this.expiryDialogEl.remove();
      this.expiryDialogEl = null;
    }
  }

  static unmount(): void {
    this.closeExpiryDialog();
    if (this.unsubscribeTimer) {
      this.unsubscribeTimer();
      this.unsubscribeTimer = null;
    }
    if (this.unsubscribeCheckin) {
      this.unsubscribeCheckin();
      this.unsubscribeCheckin = null;
    }
    if (this.unsubscribeExpired) {
      this.unsubscribeExpired();
      this.unsubscribeExpired = null;
    }
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
  }
}
