/**
 * Screen Wake Lock API Service
 * Prevents screen from dimming/sleeping during active focus sessions
 */

import { getSettings } from '../db/db';

export class WakeLockService {
  private static sentinel: WakeLockSentinel | null = null;
  private static isRequested = false;
  private static retryOverlay: HTMLElement | null = null;

  static async requestWakeLock(): Promise<boolean> {
    const settings = await getSettings();
    if (!settings.wakelock_enabled) return false;

    if ('wakeLock' in navigator) {
      try {
        this.isRequested = true;
        this.sentinel = await navigator.wakeLock.request('screen');
        this.sentinel.addEventListener('release', () => {
          this.sentinel = null;
        });

        this.hideRetryPrompt();

        // Re-acquire when visibility changes back to visible
        document.addEventListener('visibilitychange', this.handleVisibilityChange);
        return true;
      } catch (err) {
        console.warn('Wake Lock request failed (likely needs user gesture):', err);
        if (this.isRequested) {
          this.setupInteractionRetry();
          this.showRetryPrompt();
        }
      }
    }
    return false;
  }

  static async releaseWakeLock(): Promise<void> {
    this.isRequested = false;
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    if (this.sentinel) {
      try {
        await this.sentinel.release();
      } catch (e) {
        console.warn('Wake Lock release error:', e);
      }
      this.sentinel = null;
    }
    this.hideRetryPrompt();
    document.removeEventListener('click', this.retryHandler);
    document.removeEventListener('touchstart', this.retryHandler);
  }

  private static handleVisibilityChange = async () => {
    if (this.isRequested && document.visibilityState === 'visible' && !this.sentinel) {
      await this.requestWakeLock();
    }
  };

  private static retryHandler = async () => {
    if (WakeLockService.isRequested && !WakeLockService.sentinel) {
      try {
        WakeLockService.sentinel = await navigator.wakeLock.request('screen');
        WakeLockService.sentinel.addEventListener('release', () => {
          WakeLockService.sentinel = null;
        });
        console.log('Wake Lock acquired via user interaction retry.');
        WakeLockService.hideRetryPrompt();
      } catch (e) {
        console.warn('Wake Lock retry failed:', e);
      }
    }
  };

  private static setupInteractionRetry() {
    document.addEventListener('click', this.retryHandler, { once: true, passive: true });
    document.addEventListener('touchstart', this.retryHandler, { once: true, passive: true });
  }

  private static showRetryPrompt() {
    if (this.retryOverlay) return;
    this.retryOverlay = document.createElement('div');
    this.retryOverlay.style.position = 'fixed';
    this.retryOverlay.style.top = '10px';
    this.retryOverlay.style.left = '50%';
    this.retryOverlay.style.transform = 'translateX(-50%)';
    this.retryOverlay.style.background = 'rgba(239, 68, 68, 0.9)';
    this.retryOverlay.style.color = '#fff';
    this.retryOverlay.style.padding = '8px 16px';
    this.retryOverlay.style.borderRadius = '20px';
    this.retryOverlay.style.fontSize = '0.85rem';
    this.retryOverlay.style.fontWeight = 'bold';
    this.retryOverlay.style.zIndex = '9999';
    this.retryOverlay.style.pointerEvents = 'none';
    this.retryOverlay.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
    this.retryOverlay.innerText = '⚠️ 画面常時オンを有効にするため、画面をタップしてください';
    document.body.appendChild(this.retryOverlay);
  }

  private static hideRetryPrompt() {
    if (this.retryOverlay) {
      this.retryOverlay.remove();
      this.retryOverlay = null;
    }
  }
}
