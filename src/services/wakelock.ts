/**
 * Screen Wake Lock API Service
 * Prevents screen from dimming/sleeping during active focus sessions
 */

import { getSettings } from '../db/db';

export class WakeLockService {
  private static sentinel: WakeLockSentinel | null = null;
  private static isRequested = false;

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

        // Re-acquire when visibility changes back to visible
        document.addEventListener('visibilitychange', this.handleVisibilityChange);
        return true;
      } catch (err) {
        console.warn('Wake Lock request failed:', err);
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
  }

  private static handleVisibilityChange = async () => {
    if (this.isRequested && document.visibilityState === 'visible' && !this.sentinel) {
      await this.requestWakeLock();
    }
  };
}
