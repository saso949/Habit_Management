/**
 * Settings and Backup Management View
 */

import { getSettings, updateSettings, exportAllDataJson, importDataJson } from '../db/db';
import { SoundService } from '../services/sound';
import { HapticService } from '../services/haptic';
import { NotificationService } from '../services/notification';
import { formatLocalDate } from '../utils/date';

export class SettingsView {
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  async render(): Promise<void> {
    const settings = await getSettings();
    const notificationPermission = NotificationService.getPermission();

    this.container.innerHTML = `
      <div style="margin-bottom: 20px;">
        <h1 style="font-size: 1.35rem; font-weight: 800; color: var(--text-primary);">⚙️ アプリ設定 & データ管理</h1>
        <p style="font-size: 0.82rem; color: var(--text-secondary); margin-top: 2px;">
          認知科学的介入パラメーターとローカルストレージ管理
        </p>
      </div>

      <!-- Sound, Haptics & Notification Card -->
      <div class="stat-card" style="margin-bottom: 16px; padding: 18px;">
        <div class="section-title" style="font-size: 0.95rem; margin-bottom: 14px;">
          <span>🔔 介入サウンド & 通知設定</span>
        </div>

        <div style="display: flex; flex-direction: column; gap: 14px;">
          <!-- System Notifications -->
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <div>
              <div style="font-size: 0.88rem; font-weight: 700; color: var(--text-primary);">システム通知 (開始時刻 & チェックイン)</div>
              <div style="font-size: 0.74rem; color: var(--text-muted);" id="notification-status-sub">
                ステータス: <strong style="color: ${notificationPermission === 'granted' ? 'var(--accent-success)' : notificationPermission === 'denied' ? 'var(--accent-danger)' : 'var(--accent-warning)'};">${notificationPermission === 'granted' ? '✅ 許可済み' : notificationPermission === 'denied' ? '❌ 拒否' : '⚠️ 未設定 (要許可)'}</strong>
              </div>
            </div>
            <button class="btn btn-secondary btn-sm" id="request-notification-btn">
              ${notificationPermission === 'granted' ? '通知テスト' : '通知を許可'}
            </button>
          </div>

          <div style="border-top: 1px solid var(--border-subtle); padding-top: 10px;">
            <label style="display: flex; align-items: center; justify-content: space-between; cursor: pointer;">
              <div>
                <div style="font-size: 0.88rem; font-weight: 700; color: var(--text-primary);">ビープ音・チャイム効果音</div>
                <div style="font-size: 0.74rem; color: var(--text-muted);">開始時・チェックイン介入・完了音</div>
              </div>
              <input type="checkbox" id="setting-sound-toggle" ${settings.sound_enabled ? 'checked' : ''} style="width: 20px; height: 20px; accent-color: var(--accent-primary);" />
            </label>
          </div>

          <div style="display: flex; flex-direction: column; gap: 6px;">
            <div style="display: flex; justify-content: space-between; font-size: 0.82rem; color: var(--text-secondary);">
              <span>音量</span>
              <span id="volume-val-display">${Math.round(settings.sound_volume * 100)}%</span>
            </div>
            <input type="range" id="setting-volume-slider" min="0" max="1" step="0.05" value="${settings.sound_volume}" style="accent-color: var(--accent-primary);" />
          </div>

          <div style="display: flex; gap: 8px;">
            <button class="btn btn-secondary btn-sm" id="test-sound-btn">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
              </svg>
              <span>開始チャイム</span>
            </button>

            <button class="btn btn-secondary btn-sm" id="test-alarm-btn" style="border-color: rgba(239, 68, 68, 0.4); color: var(--accent-danger);">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
              </svg>
              <span>🚨 緊急サイレン音</span>
            </button>
          </div>

          <div style="border-top: 1px solid var(--border-subtle); padding-top: 10px;">
            <label style="display: flex; align-items: center; justify-content: space-between; cursor: pointer;">
              <div>
                <div style="font-size: 0.88rem; font-weight: 700; color: var(--text-primary);">触覚バイブレーション</div>
                <div style="font-size: 0.74rem; color: var(--text-muted);">チェックイン時の警告振動 (iPhone/Android)</div>
              </div>
              <input type="checkbox" id="setting-vibration-toggle" ${settings.vibration_enabled ? 'checked' : ''} style="width: 20px; height: 20px; accent-color: var(--accent-primary);" />
            </label>
          </div>

          <div style="border-top: 1px solid var(--border-subtle); padding-top: 10px;">
            <label style="display: flex; align-items: center; justify-content: space-between; cursor: pointer;">
              <div>
                <div style="font-size: 0.88rem; font-weight: 700; color: var(--text-primary);">画面常時点灯 (Wake Lock)</div>
                <div style="font-size: 0.74rem; color: var(--text-muted);">集中実行中に画面が自動スリープするのを防止</div>
              </div>
              <input type="checkbox" id="setting-wakelock-toggle" ${settings.wakelock_enabled ? 'checked' : ''} style="width: 20px; height: 20px; accent-color: var(--accent-primary);" />
            </label>
          </div>
        </div>
      </div>

      <!-- Backup & Restore Card -->
      <div class="stat-card" style="margin-bottom: 16px; padding: 18px;">
        <div class="section-title" style="font-size: 0.95rem; margin-bottom: 8px;">
          <span>💾 完全ローカルデータ保存 & バックアップ</span>
        </div>
        <p style="font-size: 0.78rem; color: var(--text-secondary); margin-bottom: 14px;">
          本アプリは完全サーバーレスのため、データは端末のIndexedDBにのみ保存されます。機種変更時やデータ保管のためにJSONバックアップをご利用ください。
        </p>

        <div style="display: flex; flex-direction: column; gap: 10px;">
          <button class="btn btn-secondary btn-full" id="export-json-btn">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            <span>JSONデータをエクスポート (保存)</span>
          </button>

          <label class="btn btn-secondary btn-full" style="cursor: pointer;">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            <span>JSONデータから復元 (インポート)</span>
            <input type="file" id="import-json-input" accept=".json,application/json" style="display: none;" />
          </label>
        </div>
      </div>

      <!-- iOS PWA Home Screen Guide -->
      <div class="stat-card" style="padding: 18px; background: linear-gradient(145deg, rgba(20, 25, 40, 0.8) 0%, rgba(14, 18, 28, 0.9) 100%); border-color: rgba(99, 102, 241, 0.25);">
        <div class="section-title" style="font-size: 0.95rem; margin-bottom: 10px; color: var(--accent-primary);">
          <span>📱 iPhone ホーム画面追加ガイド</span>
        </div>
        <div style="font-size: 0.82rem; color: var(--text-secondary); line-height: 1.6;">
          Safariの下部メニューにある <strong>「共有アイコン (四角から矢印)」</strong> をタップし、<strong>「ホーム画面に追加」</strong> を選択すると、アドレスバーの出ない全画面PWAアプリとして動作します。
        </div>
      </div>
    `;

    this.bindEvents();
  }

  private bindEvents(): void {
    const soundToggle = this.container.querySelector('#setting-sound-toggle') as HTMLInputElement;
    const volumeSlider = this.container.querySelector('#setting-volume-slider') as HTMLInputElement;
    const volumeDisplay = this.container.querySelector('#volume-val-display') as HTMLElement;
    const testSoundBtn = this.container.querySelector('#test-sound-btn') as HTMLButtonElement;
    const testAlarmBtn = this.container.querySelector('#test-alarm-btn') as HTMLButtonElement;
    const notificationBtn = this.container.querySelector('#request-notification-btn') as HTMLButtonElement;
    const vibrationToggle = this.container.querySelector('#setting-vibration-toggle') as HTMLInputElement;
    const wakelockToggle = this.container.querySelector('#setting-wakelock-toggle') as HTMLInputElement;
    const exportBtn = this.container.querySelector('#export-json-btn') as HTMLButtonElement;
    const importInput = this.container.querySelector('#import-json-input') as HTMLInputElement;

    if (notificationBtn) {
      notificationBtn.addEventListener('click', async () => {
        const granted = await NotificationService.requestPermission();
        if (granted) {
          await NotificationService.sendNotification('🔔 通知テスト成功！', {
            body: 'CommitHabitの開始時刻通知・チェックイン介入通知が有効になりました。',
          });
        }
        this.render();
      });
    }

    if (soundToggle) {
      soundToggle.addEventListener('change', async () => {
        await updateSettings({ sound_enabled: soundToggle.checked });
      });
    }

    if (volumeSlider) {
      volumeSlider.addEventListener('input', async () => {
        const val = Number(volumeSlider.value);
        if (volumeDisplay) volumeDisplay.textContent = `${Math.round(val * 100)}%`;
        await updateSettings({ sound_volume: val });
      });
    }

    if (testSoundBtn) {
      testSoundBtn.addEventListener('click', async () => {
        SoundService.unlockAudio();
        await SoundService.playStartChime();
        HapticService.triggerStart();
      });
    }

    if (testAlarmBtn) {
      let isAlarmPlaying = false;
      testAlarmBtn.addEventListener('click', async () => {
        if (isAlarmPlaying) {
          SoundService.stopAlarm();
          testAlarmBtn.innerHTML = '<span>🚨 緊急サイレン音</span>';
          isAlarmPlaying = false;
        } else {
          SoundService.unlockAudio();
          await SoundService.playCheckinAlarm();
          HapticService.triggerCheckinAlert();
          testAlarmBtn.innerHTML = '<span>⏹️ サイレン停止</span>';
          isAlarmPlaying = true;
        }
      });
    }

    if (vibrationToggle) {
      vibrationToggle.addEventListener('change', async () => {
        await updateSettings({ vibration_enabled: vibrationToggle.checked });
        if (vibrationToggle.checked) {
          HapticService.triggerStart();
        }
      });
    }

    if (wakelockToggle) {
      wakelockToggle.addEventListener('change', async () => {
        await updateSettings({ wakelock_enabled: wakelockToggle.checked });
      });
    }

    if (exportBtn) {
      exportBtn.addEventListener('click', async () => {
        const jsonStr = await exportAllDataJson();
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const nowStr = formatLocalDate();
        a.href = url;
        a.download = `commithabit_backup_${nowStr}.json`;
        a.click();
        URL.revokeObjectURL(url);
      });
    }

    if (importInput) {
      importInput.addEventListener('change', async (e) => {
        const files = (e.target as HTMLInputElement).files;
        if (files && files[0]) {
          const reader = new FileReader();
          reader.onload = async (event) => {
            const content = event.target?.result as string;
            if (content) {
              const success = await importDataJson(content);
              if (success) {
                alert('バックアップデータを正常に復元しました。');
                this.render();
              } else {
                alert('データの復元に失敗しました。JSONフォーマットを確認してください。');
              }
            }
          };
          reader.readAsText(files[0]);
        }
      });
    }
  }
}
