/**
 * Haptic feedback service using Vibration API
 */

import { getSettings } from '../db/db';

export class HapticService {
  /**
   * Trigger haptic vibration pattern
   */
  static async vibrate(pattern: number | number[] = 100): Promise<void> {
    const settings = await getSettings();
    if (!settings.vibration_enabled) return;

    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch (e) {
        console.warn('Vibration error:', e);
      }
    }
  }

  static triggerStart(): void {
    this.vibrate([100, 50, 100]);
  }

  static triggerCheckinAlert(): void {
    this.vibrate([300, 80, 300, 80, 500, 100, 500, 100, 800]);
  }

  static triggerSuccess(): void {
    this.vibrate([80, 40, 80, 40, 150]);
  }

  static triggerTap(): void {
    this.vibrate(30);
  }
}
