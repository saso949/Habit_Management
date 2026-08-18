/**
 * Sound Service using Web Audio API
 * Synthesizes clear, pleasing and attention-grabbing cognitive cues without external files
 */

import { getSettings } from '../db/db';

export class SoundService {
  private static ctx: AudioContext | null = null;
  private static alarmInterval: number | null = null;

  private static async getAudioContext(): Promise<AudioContext> {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch (e) {
        console.warn('AudioContext resume warning:', e);
      }
    }
    return this.ctx;
  }

  /**
   * Unlock AudioContext on initial touch/click (required by iOS Safari)
   */
  static unlockAudio(): void {
    try {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.ctx = new AudioCtx();
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      gain.gain.value = 0.001;
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(0);
      osc.stop(this.ctx.currentTime + 0.01);
    } catch (e) {
      console.warn('Audio unlock warning:', e);
    }
  }

  /**
   * Play Task Start Chime (uplifting C5-E5-G5 triad)
   */
  static async playStartChime(): Promise<void> {
    const settings = await getSettings();
    if (!settings.sound_enabled) return;

    try {
      const ctx = await this.getAudioContext();
      const now = ctx.currentTime;
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(settings.sound_volume * 0.3, now);
      masterGain.connect(ctx.destination);

      const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const noteGain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.09);

        noteGain.gain.setValueAtTime(0, now + i * 0.09);
        noteGain.gain.linearRampToValueAtTime(0.8, now + i * 0.09 + 0.02);
        noteGain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.09 + 0.4);

        osc.connect(noteGain);
        noteGain.connect(masterGain);

        osc.start(now + i * 0.09);
        osc.stop(now + i * 0.09 + 0.45);
      });
    } catch (err) {
      console.warn('Play start chime failed:', err);
    }
  }

  /**
   * Play Check-in Alarm Pulse (High-attention alternating tone)
   */
  static async playCheckinAlarm(): Promise<void> {
    const settings = await getSettings();
    if (!settings.sound_enabled) return;

    this.stopAlarm();

    const playSinglePulse = async () => {
      try {
        const ctx = await this.getAudioContext();
        const now = ctx.currentTime;
        const masterGain = ctx.createGain();
        masterGain.gain.setValueAtTime(settings.sound_volume * 0.4, now);
        masterGain.connect(ctx.destination);

        // Two rapid high-pitched beeps
        [880, 1046.5].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const noteGain = ctx.createGain();
          osc.type = 'square';
          osc.frequency.setValueAtTime(freq, now + idx * 0.12);

          noteGain.gain.setValueAtTime(0, now + idx * 0.12);
          noteGain.gain.linearRampToValueAtTime(0.5, now + idx * 0.12 + 0.01);
          noteGain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.1);

          osc.connect(noteGain);
          noteGain.connect(masterGain);

          osc.start(now + idx * 0.12);
          osc.stop(now + idx * 0.12 + 0.12);
        });
      } catch (err) {
        console.warn('Play alarm pulse failed:', err);
      }
    };

    await playSinglePulse();
    this.alarmInterval = window.setInterval(playSinglePulse, 2000);
  }

  /**
   * Stop recurring check-in alarm
   */
  static stopAlarm(): void {
    if (this.alarmInterval !== null) {
      clearInterval(this.alarmInterval);
      this.alarmInterval = null;
    }
  }

  /**
   * Play Task Complete Chime (Harmonic victory arpeggio)
   */
  static async playCompleteChime(): Promise<void> {
    const settings = await getSettings();
    if (!settings.sound_enabled) return;

    try {
      const ctx = await this.getAudioContext();
      const now = ctx.currentTime;
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(settings.sound_volume * 0.35, now);
      masterGain.connect(ctx.destination);

      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const noteGain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.1);

        noteGain.gain.setValueAtTime(0, now + i * 0.1);
        noteGain.gain.linearRampToValueAtTime(0.8, now + i * 0.1 + 0.03);
        noteGain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.6);

        osc.connect(noteGain);
        noteGain.connect(masterGain);

        osc.start(now + i * 0.1);
        osc.stop(now + i * 0.1 + 0.65);
      });
    } catch (err) {
      console.warn('Play complete chime failed:', err);
    }
  }
}
