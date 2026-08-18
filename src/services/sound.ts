/**
 * Sound Service using Web Audio API
 * Synthesizes clear, pleasing and attention-grabbing cognitive cues without external files
 */

import { getSettings } from '../db/db';

export class SoundService {
  private static ctx: AudioContext | null = null;
  private static alarmInterval: number | null = null;
  private static alarmActive = false;

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
   * Play Check-in Alarm Pulse (High-intensity emergency siren + rapid alarm bursts)
   */
  static async playCheckinAlarm(): Promise<void> {
    this.alarmActive = true; // Set synchronously before any await
    const settings = await getSettings();
    
    // If stopAlarm was called during await getSettings, abort
    if (!settings.sound_enabled || !this.alarmActive) {
      this.alarmActive = false;
      return;
    }

    // Stop any existing intervals before proceeding
    if (this.alarmInterval !== null) {
      clearInterval(this.alarmInterval);
      this.alarmInterval = null;
    }
    this.alarmActive = true;

    const playSinglePulse = async () => {
      try {
        const ctx = await this.getAudioContext();
        const now = ctx.currentTime;
        const masterGain = ctx.createGain();
        masterGain.gain.setValueAtTime(settings.sound_volume * 0.55, now);
        masterGain.connect(ctx.destination);

        // Pattern: 3 rapid high-pitched piercing bursts followed by an alternating siren sweep
        const burstNotes = [987.77, 1318.51, 987.77, 1318.51];
        burstNotes.forEach((freq, idx) => {
          const osc1 = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          const noteGain = ctx.createGain();

          osc1.type = 'sawtooth';
          osc1.frequency.setValueAtTime(freq, now + idx * 0.12);

          osc2.type = 'square';
          osc2.frequency.setValueAtTime(freq * 1.01, now + idx * 0.12); // subtle detune for dissonance

          noteGain.gain.setValueAtTime(0, now + idx * 0.12);
          noteGain.gain.linearRampToValueAtTime(0.7, now + idx * 0.12 + 0.015);
          noteGain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.1);

          osc1.connect(noteGain);
          osc2.connect(noteGain);
          noteGain.connect(masterGain);

          osc1.start(now + idx * 0.12);
          osc1.stop(now + idx * 0.12 + 0.11);
          osc2.start(now + idx * 0.12);
          osc2.stop(now + idx * 0.12 + 0.11);
        });

        // Sustained siren sweep at end of pulse
        const sweepOsc = ctx.createOscillator();
        const sweepGain = ctx.createGain();
        sweepOsc.type = 'triangle';
        sweepOsc.frequency.setValueAtTime(700, now + 0.5);
        sweepOsc.frequency.exponentialRampToValueAtTime(1400, now + 0.85);

        sweepGain.gain.setValueAtTime(0, now + 0.5);
        sweepGain.gain.linearRampToValueAtTime(0.5, now + 0.52);
        sweepGain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);

        sweepOsc.connect(sweepGain);
        sweepGain.connect(masterGain);

        sweepOsc.start(now + 0.5);
        sweepOsc.stop(now + 0.92);
      } catch (err) {
        console.warn('Play intense alarm pulse failed:', err);
      }
    };

    await playSinglePulse();
    if (this.alarmActive) {
      this.alarmInterval = window.setInterval(playSinglePulse, 1200);
    }
  }

  /**
   * Stop recurring check-in alarm
   */
  static stopAlarm(): void {
    this.alarmActive = false;
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
