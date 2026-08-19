/**
 * Task Creation & Reservation Modal (Section 3.1)
 * Automatically requests Notification permission on scheduled reservations
 */

import { getSettings, saveTask } from '../db/db';
import type { Task, TaskType, FullscreenMode, TaskPhoto } from '../db/types';
import { CameraModal } from './CameraModal';
import { FocusTimerService } from '../services/timer';
import { formatLocalDate } from '../utils/date';
import { NotificationService } from '../services/notification';

export interface TaskFormOptions {
  initialType?: TaskType;
  onCreated: (task: Task) => void;
}

export class TaskFormModal {
  private static activeModal: HTMLElement | null = null;

  static async open(options: TaskFormOptions = { onCreated: () => {} }): Promise<void> {
    this.close();

    const settings = await getSettings();
    let currentType: TaskType = options.initialType || 'now';
    let selectedDuration = 25;
    let selectedCheckinInterval = settings.default_checkin_interval || 25;
    let selectedTag = settings.tags_list[0] || 'プログラミング';
    let selectedMode: FullscreenMode = settings.default_fullscreen_mode || 'clock';

    // Calculate default scheduled start time (current time rounded up to next 5 minutes)
    const now = new Date();
    now.setMinutes(Math.ceil(now.getMinutes() / 5) * 5, 0, 0);
    const defaultDateStr = formatLocalDate(now);
    const defaultStartTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const modalEl = document.createElement('div');
    modalEl.className = 'modal-backdrop open';
    modalEl.id = 'task-form-modal';

    const renderTags = () => {
      return settings.tags_list
        .map(
          (t) =>
            `<button type="button" class="tag-pill ${t === selectedTag ? 'active' : ''}" data-tag="${t}">${t}</button>`
        )
        .join('');
    };

    modalEl.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <div class="modal-title" id="form-modal-heading">集中タスクの作成</div>
          <button class="modal-close-btn" id="task-form-close" aria-label="閉じる">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <form id="task-create-form" class="modal-body">
          <!-- Type Switcher -->
          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; background: var(--bg-secondary); padding: 4px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
            <button type="button" class="pill-option ${currentType === 'now' ? 'active' : ''}" id="type-btn-now" style="border: none;">
              ⚡ 今すぐ開始
            </button>
            <button type="button" class="pill-option ${currentType === 'short' ? 'active' : ''}" id="type-btn-short" style="border: none;">
              ⏱️ 短期実行
            </button>
            <button type="button" class="pill-option ${currentType === 'scheduled' ? 'active' : ''}" id="type-btn-scheduled" style="border: none;">
              📅 事前予約
            </button>
          </div>

          <!-- Task Title Input -->
          <div class="form-group">
            <label class="form-label" for="task-title-input">タスク名・作業内容</label>
            <input type="text" id="task-title-input" placeholder="例: PoCアプリ実装, 認知科学の論文読書" required autocomplete="off" />
          </div>

          <!-- Tag Selector -->
          <div class="form-group">
            <label class="form-label">カテゴリ / タグ</label>
            <div class="tag-selector-row" id="tag-selector-container">
              ${renderTags()}
            </div>
          </div>

          <!-- Scheduled Time Pickers (Visible only when scheduled) -->
          <div class="form-group" id="scheduled-time-group" style="display: ${currentType === 'scheduled' ? 'flex' : 'none'}; flex-direction: column; gap: 8px;">
            <label class="form-label">開始予定日時</label>
            <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 8px;">
              <input type="date" id="scheduled-date-input" value="${defaultDateStr}" />
              <input type="time" id="scheduled-start-input" value="${defaultStartTimeStr}" />
            </div>
            <div style="font-size: 0.76rem; color: var(--accent-cyan); display: flex; align-items: flex-start; gap: 6px; margin-top: 2px; line-height: 1.3;">
              <span>🔔</span>
              <span>
                開始時刻にベストエフォートでシステム通知を送信します<br>
                <span style="color: var(--text-muted); font-size: 0.7rem;">(※ iPhone/iOS の場合は「ホーム画面に追加」でのみ通知が機能します)</span>
              </span>
            </div>
          </div>

          <!-- Duration Selector -->
          <div class="form-group">
            <label class="form-label">予約時間 (分数)</label>
            <div class="pill-selector-grid" id="duration-selector-grid">
              <!-- Rendered dynamically -->
            </div>
          </div>

          <!-- Check-in Interval Selector -->
          <div class="form-group">
            <label class="form-label">定期チェックイン間隔</label>
            <div class="pill-selector-grid" id="checkin-selector-grid">
              ${[15, 20, 25, 30, 45]
                .map(
                  (m) =>
                    `<button type="button" class="pill-option ${m === selectedCheckinInterval ? 'active' : ''}" data-checkin="${m}">${m}分毎</button>`
                )
                .join('')}
            </div>
          </div>

          <!-- Fullscreen Mode Preference -->
          <div class="form-group">
            <label class="form-label">実行中画面モード</label>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
              <button type="button" class="pill-option ${selectedMode === 'clock' ? 'active' : ''}" id="mode-btn-clock">
                🕒 時計表示モード
              </button>
              <button type="button" class="pill-option ${selectedMode === 'dark' ? 'active' : ''}" id="mode-btn-dark">
                🌙 完全暗転モード
              </button>
            </div>
          </div>

          <!-- Submit Button -->
          <div style="margin-top: 10px;">
            <button type="submit" class="btn btn-primary btn-lg btn-full" id="task-submit-btn">
              <!-- Rendered dynamically -->
            </button>
          </div>
        </form>
      </div>
    `;

    document.getElementById('modal-container')?.appendChild(modalEl);
    this.activeModal = modalEl;

    // Elements
    const form = modalEl.querySelector('#task-create-form') as HTMLFormElement;
    const titleInput = modalEl.querySelector('#task-title-input') as HTMLInputElement;
    const typeBtnNow = modalEl.querySelector('#type-btn-now') as HTMLButtonElement;
    const typeBtnShort = modalEl.querySelector('#type-btn-short') as HTMLButtonElement;
    const typeBtnScheduled = modalEl.querySelector('#type-btn-scheduled') as HTMLButtonElement;
    const scheduledGroup = modalEl.querySelector('#scheduled-time-group') as HTMLElement;
    const scheduledDateInput = modalEl.querySelector('#scheduled-date-input') as HTMLInputElement;
    const scheduledTimeInput = modalEl.querySelector('#scheduled-start-input') as HTMLInputElement;
    const durationGrid = modalEl.querySelector('#duration-selector-grid') as HTMLElement;
    const submitBtn = modalEl.querySelector('#task-submit-btn') as HTMLButtonElement;
    const closeBtn = modalEl.querySelector('#task-form-close') as HTMLButtonElement;
    const modeBtnClock = modalEl.querySelector('#mode-btn-clock') as HTMLButtonElement;
    const modeBtnDark = modalEl.querySelector('#mode-btn-dark') as HTMLButtonElement;

    // Helper to render durations
    const renderDurations = () => {
      const options = currentType === 'short' ? [5, 10, 15, 20] : [15, 25, 30, 45, 60, 90, 120];
      if (currentType === 'short' && selectedDuration > 20) selectedDuration = 20;
      if (!options.includes(selectedDuration)) selectedDuration = options[0];

      durationGrid.innerHTML = options
        .map(
          (m) =>
            `<button type="button" class="pill-option ${m === selectedDuration ? 'active' : ''}" data-duration="${m}">${m}分</button>`
        )
        .join('');

      // Bind duration events
      durationGrid.querySelectorAll('.pill-option').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const dur = Number((e.currentTarget as HTMLElement).dataset.duration);
          if (dur) {
            selectedDuration = dur;
            durationGrid.querySelectorAll('.pill-option').forEach((el) => el.classList.remove('active'));
            (e.currentTarget as HTMLElement).classList.add('active');
          }
        });
      });
    };

    // Close modal
    closeBtn.addEventListener('click', () => TaskFormModal.close());

    // Switch task type
    const setType = async (type: TaskType) => {
      currentType = type;
      typeBtnNow.classList.toggle('active', type === 'now');
      typeBtnShort.classList.toggle('active', type === 'short');
      typeBtnScheduled.classList.toggle('active', type === 'scheduled');
      scheduledGroup.style.display = type === 'scheduled' ? 'flex' : 'none';
      
      if (type === 'now') {
        submitBtn.innerHTML = '📸 写真を撮影して今すぐ開始';
      } else if (type === 'short') {
        submitBtn.innerHTML = '▶️ 写真なしで今すぐ開始';
      } else {
        submitBtn.innerHTML = '📅 予約を作成する (通知を許可)';
      }

      renderDurations();

      if (type === 'scheduled') {
        // Request notification permission immediately on choosing scheduled reservation
        // Do not await to ensure Safari registers it as part of the direct user click gesture
        NotificationService.requestPermission();
      }
    };

    setType(currentType);

    typeBtnNow.addEventListener('click', () => setType('now'));
    typeBtnShort.addEventListener('click', () => setType('short'));
    typeBtnScheduled.addEventListener('click', () => setType('scheduled'));

    // Tag selector
    modalEl.querySelectorAll('#tag-selector-container .tag-pill').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const tag = (e.currentTarget as HTMLElement).dataset.tag;
        if (tag) {
          selectedTag = tag;
          modalEl.querySelectorAll('#tag-selector-container .tag-pill').forEach((el) => el.classList.remove('active'));
          (e.currentTarget as HTMLElement).classList.add('active');
        }
      });
    });

    // Duration selector logic moved to renderDurations

    // Checkin interval selector
    modalEl.querySelectorAll('#checkin-selector-grid .pill-option').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const c = Number((e.currentTarget as HTMLElement).dataset.checkin);
        if (c) {
          selectedCheckinInterval = c;
          modalEl.querySelectorAll('#checkin-selector-grid .pill-option').forEach((el) => el.classList.remove('active'));
          (e.currentTarget as HTMLElement).classList.add('active');
        }
      });
    });

    // Mode selector
    modeBtnClock.addEventListener('click', () => {
      selectedMode = 'clock';
      modeBtnClock.classList.add('active');
      modeBtnDark.classList.remove('active');
    });

    modeBtnDark.addEventListener('click', () => {
      selectedMode = 'dark';
      modeBtnDark.classList.add('active');
      modeBtnClock.classList.remove('active');
    });

    // Form submission
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = titleInput.value.trim();
      if (!title) return;

      const nowIso = new Date().toISOString();
      const taskId = 'task-' + Date.now();

      let scheduledStartAt = nowIso;
      let scheduledEndAt = new Date(Date.now() + selectedDuration * 60 * 1000).toISOString();

      if (currentType === 'scheduled') {
        // Request notification permission simultaneously
        NotificationService.requestPermission();

        const dateVal = scheduledDateInput.value || defaultDateStr; // "YYYY-MM-DD"
        const timeVal = scheduledTimeInput.value || defaultStartTimeStr; // "HH:MM"
        const [year, month, day] = dateVal.split('-').map(Number);
        const [hours, minutes] = timeVal.split(':').map(Number);

        const schedDate = new Date(year, month - 1, day, hours, minutes, 0, 0);

        scheduledStartAt = schedDate.toISOString();
        scheduledEndAt = new Date(schedDate.getTime() + selectedDuration * 60 * 1000).toISOString();
      }

      if (currentType === 'now') {
        // Immediate start requires taking a start photo first!
        CameraModal.open({
          title: '実体化トリガー: タスク開始',
          subtitle: `「${title}」の作業対象・デスクを撮影して開始判定を行います`,
          confirmLabel: 'この写真でタスクを開始する',
          onPhotoConfirmed: async (dataUrl) => {
            const startPhoto: TaskPhoto = {
              type: 'start',
              timestamp: new Date().toISOString(),
              data_url: dataUrl,
            };

            const newTask: Task = {
              id: taskId,
              type: 'now',
              title,
              tag: selectedTag,
              checkin_interval_minutes: selectedCheckinInterval,
              fullscreen_mode: selectedMode,
              scheduled_start_at: scheduledStartAt,
              scheduled_end_at: scheduledEndAt,
              actual_start_at: new Date().toISOString(),
              ended_at: null,
              sabori_minutes: 0,
              status: 'running',
              last_checkin_at: new Date().toISOString(),
              photos: [startPhoto],
            };

            await FocusTimerService.startTask(newTask);
            TaskFormModal.close();
            options.onCreated(newTask);
          },
        });
      } else if (currentType === 'short') {
        // Short task starts immediately without a photo
        const newTask: Task = {
          id: taskId,
          type: 'short',
          title,
          tag: selectedTag,
          checkin_interval_minutes: selectedCheckinInterval,
          fullscreen_mode: selectedMode,
          scheduled_start_at: scheduledStartAt,
          scheduled_end_at: scheduledEndAt,
          actual_start_at: new Date().toISOString(),
          ended_at: null,
          sabori_minutes: 0,
          status: 'running',
          last_checkin_at: new Date().toISOString(),
          photos: [],
        };

        await FocusTimerService.startTask(newTask);
        TaskFormModal.close();
        options.onCreated(newTask);
      } else {
        // Scheduled task
        const newTask: Task = {
          id: taskId,
          type: 'scheduled',
          title,
          tag: selectedTag,
          checkin_interval_minutes: selectedCheckinInterval,
          fullscreen_mode: selectedMode,
          scheduled_start_at: scheduledStartAt,
          scheduled_end_at: scheduledEndAt,
          actual_start_at: null,
          ended_at: null,
          sabori_minutes: 0,
          status: 'pending',
          photos: [],
        };

        await saveTask(newTask);

        // Schedule best-effort start notification
        NotificationService.scheduleTaskStartNotification(newTask, () => {
          window.dispatchEvent(new CustomEvent('task-state-changed'));
        });

        TaskFormModal.close();
        options.onCreated(newTask);
      }
    });
  }

  static close(): void {
    if (this.activeModal) {
      this.activeModal.remove();
      this.activeModal = null;
    }
  }
}
