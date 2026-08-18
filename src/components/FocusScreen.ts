/**
 * Fullscreen Cognitive Focus Screen (Section 3.2 & Section 3.4)
 * Eliminates environmental distractions with Clock Mode, Pure OLED Dark Mode, and Calming Break Mode
 */

import type { Task, FullscreenMode } from '../db/types';
import { FocusTimerService, type FocusTimerState } from '../services/timer';
import { CameraModal } from './CameraModal';
import { CheckinModal } from './CheckinModal';
import { TaskSummaryModal } from './TaskSummaryModal';
import { getSettings, updateSettings } from '../db/db';

export class FocusScreen {
  private static container: HTMLElement | null = null;
  private static currentMode: FullscreenMode = 'clock';
  private static unsubscribeTimer: (() => void) | null = null;
  private static unsubscribeCheckin: (() => void) | null = null;
  private static unsubscribeExpired: (() => void) | null = null;
  private static expiryDialogEl: HTMLElement | null = null;
  private static breakDialogEl: HTMLElement | null = null;

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
              <linearGradient id="breakGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#10b981" />
                <stop offset="50%" stop-color="#06b6d4" />
                <stop offset="100%" stop-color="#3b82f6" />
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
        <!-- Quick Extend & Break Quota Row -->
        <div class="focus-quick-extend-row" id="focus-quick-extend-container">
          <span style="font-size: 0.76rem; color: var(--text-muted); font-weight: 600;">延長:</span>
          <button class="extend-pill-btn" data-extend="15">+15分</button>
          <button class="extend-pill-btn" data-extend="30">+30分</button>
          <button class="extend-pill-btn" data-extend="60">+60分</button>
        </div>

        <!-- Normal Focus Actions Row -->
        <div class="focus-main-actions-row" id="focus-normal-actions">
          <button class="btn btn-secondary btn-sm" id="focus-manual-checkin-btn" style="padding: 10px 12px;">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
              <circle cx="12" cy="13" r="4"></circle>
            </svg>
            <span>進捗撮影</span>
          </button>

          <button class="btn btn-secondary btn-sm break-pill-btn" id="focus-break-btn" style="padding: 10px 12px;">
            <span id="focus-break-btn-text">☕ 休憩 (15分/1h)</span>
          </button>

          <button class="btn btn-primary btn-sm" id="focus-finish-btn" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 10px 14px;">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span>終了する</span>
          </button>
        </div>

        <!-- Break Active Controls Row (Shown only when in break mode) -->
        <div id="focus-break-actions" style="display: none; width: 100%;">
          <button class="btn btn-full focus-break-resume-btn" id="focus-resume-from-break-btn">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
            </svg>
            <span>⚡ 集中を再開する (作業に戻る)</span>
          </button>
        </div>
      </div>
    `;

    mountPoint.appendChild(screenEl);
    this.container = screenEl;

    // Elements
    const statusBadgeEl = screenEl.querySelector('#focus-status-badge') as HTMLElement;
    const wallClockEl = screenEl.querySelector('#focus-wall-clock') as HTMLElement;
    const remainingDigitsEl = screenEl.querySelector('#focus-remaining-digits') as HTMLElement;
    const timerLabelEl = screenEl.querySelector('#focus-timer-label') as HTMLElement;
    const nextCheckinBadgeEl = screenEl.querySelector('#focus-next-checkin-badge') as HTMLElement;
    const svgBarEl = screenEl.querySelector('#focus-svg-bar') as SVGCircleElement;
    const modeToggleBtn = screenEl.querySelector('#focus-mode-toggle') as HTMLButtonElement;
    const manualCheckinBtn = screenEl.querySelector('#focus-manual-checkin-btn') as HTMLButtonElement;
    const breakBtn = screenEl.querySelector('#focus-break-btn') as HTMLButtonElement;
    const breakBtnText = screenEl.querySelector('#focus-break-btn-text') as HTMLElement;
    const finishBtn = screenEl.querySelector('#focus-finish-btn') as HTMLButtonElement;
    const normalActionsContainer = screenEl.querySelector('#focus-normal-actions') as HTMLElement;
    const breakActionsContainer = screenEl.querySelector('#focus-break-actions') as HTMLElement;
    const resumeBreakBtn = screenEl.querySelector('#focus-resume-from-break-btn') as HTMLButtonElement;
    const quickExtendRow = screenEl.querySelector('#focus-quick-extend-container') as HTMLElement;

    const circumference = 2 * Math.PI * 90; // ~565.48

    // Mode Toggle Handler
    modeToggleBtn.addEventListener('click', () => {
      this.currentMode = this.currentMode === 'clock' ? 'dark' : 'clock';
      if (!screenEl.classList.contains('mode-break')) {
        screenEl.className = `focus-screen-overlay mode-${this.currentMode}`;
      }
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

    // Break Button Handler (15 min per 1h rule)
    breakBtn.addEventListener('click', async () => {
      const quota = FocusTimerService.getAvailableBreakSeconds();
      if (quota <= 0) {
        alert('このタスクの休憩可能枠（1時間あたり15分まで）を使い切りました。');
        return;
      }
      
      const settings = await getSettings();
      this.showBreakDialog(quota, settings.last_break_duration_seconds || 900);
    });

    // Resume from Break Handler
    resumeBreakBtn.addEventListener('click', async () => {
      await FocusTimerService.resumeFromBreak();
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

      if (state.isBreakMode) {
        // --- Render Break Mode UI ---
        screenEl.className = 'focus-screen-overlay mode-break';
        statusBadgeEl.textContent = '☕ 休憩中';
        statusBadgeEl.className = 'status-badge';
        statusBadgeEl.style.background = 'rgba(16, 185, 129, 0.2)';
        statusBadgeEl.style.color = '#6ee7b7';
        statusBadgeEl.style.borderColor = 'rgba(16, 185, 129, 0.4)';

        timerLabelEl.textContent = '☕ 休憩中 (リフレッシュ)';
        timerLabelEl.style.color = '#6ee7b7';

        const breakMins = Math.floor(state.breakSecondsRemaining / 60);
        const breakSecs = state.breakSecondsRemaining % 60;
        remainingDigitsEl.textContent = `${String(breakMins).padStart(2, '0')}:${String(breakSecs).padStart(2, '0')}`;
        remainingDigitsEl.style.color = '#6ee7b7';

        svgBarEl.style.stroke = 'url(#breakGrad)';
        const breakFraction = state.breakDurationSeconds > 0 ? state.breakSecondsRemaining / state.breakDurationSeconds : 0;
        svgBarEl.style.strokeDashoffset = `${circumference * (1 - breakFraction)}`;

        nextCheckinBadgeEl.innerHTML = `<span>☕ サボり加算なし (タスク時間換算)</span>`;
        nextCheckinBadgeEl.style.borderColor = 'rgba(16, 185, 129, 0.4)';
        nextCheckinBadgeEl.style.color = '#a7f3d0';

        normalActionsContainer.style.display = 'none';
        quickExtendRow.style.display = 'none';
        breakActionsContainer.style.display = 'block';

        // --- Break Finished Alert Overlay ---
        if (state.isBreakFinishedAlerting) {
          if (!document.getElementById('break-finished-overlay')) {
            const overlay = document.createElement('div');
            overlay.className = 'checkin-alert-overlay';
            overlay.id = 'break-finished-overlay';
            overlay.innerHTML = `
              <div class="checkin-urgent-header-badge" style="background: #3b82f6; box-shadow: 0 0 24px rgba(59, 130, 246, 0.9), 0 0 10px #ffffff;">
                ☕ 休憩時間終了
              </div>
              <div class="checkin-alert-center">
                <div class="checkin-alert-icon" style="background: rgba(59, 130, 246, 0.35); box-shadow: 0 0 36px rgba(59, 130, 246, 0.9), inset 0 0 20px rgba(255, 255, 255, 0.6);">
                  <svg xmlns="http://www.w3.org/2000/svg" width="54" height="54" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                  </svg>
                </div>
                <div class="checkin-alert-title" style="text-shadow: 0 0 20px rgba(59, 130, 246, 0.8), 0 2px 4px rgba(0, 0, 0, 0.8);">休憩が終了しました！</div>
                <div class="checkin-alert-desc">
                  「<strong>${state.task.title}</strong>」の休憩時間が終わりました。<br>今すぐ集中モードを再開してください！
                </div>
              </div>
              <div class="checkin-actions-stack">
                <button class="btn btn-primary btn-lg btn-full" id="break-finished-resume-btn" style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); font-size: 1.1rem; box-shadow: 0 0 24px rgba(59, 130, 246, 0.7);">
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right: 8px;">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                  </svg>
                  <span>⚡ 集中を再開する</span>
                </button>
              </div>
            `;
            document.getElementById('focus-container')?.appendChild(overlay);
            overlay.querySelector('#break-finished-resume-btn')?.addEventListener('click', async () => {
              await FocusTimerService.resumeFromBreak();
              overlay.remove();
            });
          }
        } else {
          const overlay = document.getElementById('break-finished-overlay');
          if (overlay) overlay.remove();
        }
      } else {
        // --- Render Normal Focus Mode UI ---
        screenEl.className = `focus-screen-overlay mode-${this.currentMode}`;
        statusBadgeEl.textContent = '集中中';
        statusBadgeEl.className = 'status-badge running';
        statusBadgeEl.style.background = '';
        statusBadgeEl.style.color = '';
        statusBadgeEl.style.borderColor = '';

        normalActionsContainer.style.display = 'grid';
        quickExtendRow.style.display = 'flex';
        breakActionsContainer.style.display = 'none';
        svgBarEl.style.stroke = 'url(#focusGrad)';

        // Update Break button text with quota
        if (state.availableBreakSecondsQuota > 0) {
          const quotaMins = Math.floor(state.availableBreakSecondsQuota / 60);
          const quotaSecs = state.availableBreakSecondsQuota % 60;
          const quotaText = quotaSecs > 0 ? `${quotaMins}分${quotaSecs}秒` : `${quotaMins}分`;
          breakBtnText.textContent = `☕ 休憩 (${quotaText}可)`;
          breakBtn.disabled = false;
        } else {
          breakBtnText.textContent = `☕ 休憩 (残0分)`;
          breakBtn.disabled = true;
        }

        if (state.isSessionExpired) {
          timerLabelEl.textContent = '予定時間到達';
          timerLabelEl.style.color = 'var(--text-muted)';
          remainingDigitsEl.textContent = '00:00';
          remainingDigitsEl.style.color = 'var(--accent-warning)';
          svgBarEl.style.strokeDashoffset = '0';
        } else {
          timerLabelEl.textContent = '残り時間';
          timerLabelEl.style.color = 'var(--text-muted)';
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
        nextCheckinBadgeEl.innerHTML = `<span>🔔 チェックインまで:</span> <strong id="focus-next-checkin-val">${String(checkinMins).padStart(2, '0')}:${String(checkinSecs).padStart(2, '0')}</strong>`;
        nextCheckinBadgeEl.style.borderColor = 'rgba(99, 102, 241, 0.3)';
        nextCheckinBadgeEl.style.color = '#c7d2fe';
      }
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
   * Show Break Selection Dialog (15 min/1h quota)
   */
  private static showBreakDialog(availableQuotaSeconds: number, lastUsedSeconds: number): void {
    if (this.breakDialogEl) return;

    const dialog = document.createElement('div');
    dialog.className = 'modal-backdrop open';
    dialog.id = 'break-selection-dialog';

    // Preset break buttons within quota
    let presets = [5 * 60, 10 * 60, 15 * 60].filter((s) => s <= availableQuotaSeconds);
    if (!presets.includes(availableQuotaSeconds) && availableQuotaSeconds > 0) {
      presets.push(availableQuotaSeconds);
    }
    // Include last used if not in presets and valid
    if (lastUsedSeconds > 0 && lastUsedSeconds <= availableQuotaSeconds && !presets.includes(lastUsedSeconds)) {
      presets.unshift(lastUsedSeconds);
    }
    presets = Array.from(new Set(presets)).sort((a, b) => a - b);

    const formatTimeText = (totalSecs: number) => {
      const m = Math.floor(totalSecs / 60);
      const s = totalSecs % 60;
      return s > 0 ? `${m}分${s}秒` : `${m}分`;
    };

    dialog.innerHTML = `
      <div class="modal-content" style="background: rgba(12, 26, 24, 0.97); border-color: rgba(16, 185, 129, 0.35);">
        <div class="modal-header">
          <div class="modal-title" style="color: #6ee7b7;">☕ 休憩を取る (リフレッシュ)</div>
          <button class="modal-close-btn" id="break-dialog-close" aria-label="閉じる">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="modal-body" style="text-align: center; gap: 14px;">
          <p style="font-size: 0.88rem; color: #a7f3d0; line-height: 1.5;">
            ※ 1時間あたり最大15分までの休憩枠です。<br>
            <strong>サボり時間には加算されず、タスク実行時間の一部として記録されます。</strong>
          </p>
          <div style="font-size: 0.95rem; color: var(--text-secondary);">
            利用可能枠: <strong style="color: #6ee7b7; font-size: 1.2rem;">残り ${formatTimeText(availableQuotaSeconds)}</strong>
          </div>
          
          <div style="margin-top: 12px; background: rgba(16, 185, 129, 0.1); padding: 12px; border-radius: 8px;">
             <label style="color: #6ee7b7; font-size: 0.85rem; font-weight: bold; display: block; margin-bottom: 8px;">カスタム時間を指定</label>
             <div style="display: flex; justify-content: center; gap: 8px; align-items: center;">
               <input type="number" id="break-custom-min" class="form-input" style="width: 70px; text-align: center; font-size: 1.1rem; padding: 6px;" min="0" max="${Math.floor(availableQuotaSeconds / 60)}" value="${Math.floor(lastUsedSeconds / 60)}" />
               <span style="color: #a7f3d0; font-weight: bold;">分</span>
               <input type="number" id="break-custom-sec" class="form-input" style="width: 70px; text-align: center; font-size: 1.1rem; padding: 6px;" min="0" max="59" value="${lastUsedSeconds % 60}" />
               <span style="color: #a7f3d0; font-weight: bold;">秒</span>
               <button class="btn btn-primary btn-sm" id="break-custom-start-btn" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); margin-left: 10px;">開始</button>
             </div>
          </div>

          <div style="display: flex; justify-content: center; gap: 10px; flex-wrap: wrap; margin-top: 14px;">
            ${presets
              .map(
                (s) =>
                  `<button class="btn btn-secondary break-preset-btn" data-seconds="${s}" style="padding: 10px 18px; border-color: rgba(16, 185, 129, 0.4); color: #6ee7b7; font-weight: 700;">☕ ${formatTimeText(s)} 休憩</button>`
              )
              .join('')}
          </div>
        </div>
      </div>
    `;

    document.getElementById('modal-container')?.appendChild(dialog);
    this.breakDialogEl = dialog;

    dialog.querySelector('#break-dialog-close')?.addEventListener('click', () => {
      this.closeBreakDialog();
    });

    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) {
        this.closeBreakDialog();
      }
    });

    dialog.querySelectorAll('.break-preset-btn').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const secs = Number((e.currentTarget as HTMLElement).dataset.seconds);
        if (secs) {
          this.closeBreakDialog();
          await updateSettings({ last_break_duration_seconds: secs });
          await FocusTimerService.startBreak(secs);
        }
      });
    });

    dialog.querySelector('#break-custom-start-btn')?.addEventListener('click', async () => {
      const minInput = dialog.querySelector('#break-custom-min') as HTMLInputElement;
      const secInput = dialog.querySelector('#break-custom-sec') as HTMLInputElement;
      const m = Number(minInput.value) || 0;
      const s = Number(secInput.value) || 0;
      const totalSecs = m * 60 + s;
      
      if (totalSecs > 0 && totalSecs <= availableQuotaSeconds) {
        this.closeBreakDialog();
        await updateSettings({ last_break_duration_seconds: totalSecs });
        await FocusTimerService.startBreak(totalSecs);
      } else if (totalSecs > availableQuotaSeconds) {
        alert('利用可能枠を超えています！');
      } else {
        alert('有効な時間を入力してください。');
      }
    });
  }

  private static closeBreakDialog(): void {
    if (this.breakDialogEl) {
      this.breakDialogEl.remove();
      this.breakDialogEl = null;
    }
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
    const breakOverlay = document.getElementById('break-finished-overlay');
    if (breakOverlay) breakOverlay.remove();
    this.closeExpiryDialog();
    this.closeBreakDialog();
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
