// Type definitions strictly matching Section 4 of the PoC requirements specification

export type TaskType = 'now' | 'scheduled' | 'short';
export type FullscreenMode = 'clock' | 'dark';
export type TaskStatus = 'pending' | 'running' | 'completed' | 'cancelled';
export type PhotoType = 'start' | 'checkin' | 'end';

export interface TaskPhoto {
  id?: string;
  type: PhotoType;
  timestamp: string; // ISO 8601 string
  data_url: string;  // Base64 compressed JPEG/WebP
  note?: string;
}

export interface Task {
  id: string;
  type: TaskType;
  tag: string;
  title: string;
  checkin_interval_minutes: number;
  fullscreen_mode: FullscreenMode;
  scheduled_start_at: string; // ISO 8601 string
  scheduled_end_at: string;   // ISO 8601 string
  actual_start_at: string | null;
  ended_at: string | null;
  sabori_minutes: number;
  break_seconds?: number; // Valid rest/break seconds (not counted as sabori, part of execution)
  break_minutes?: number; // Legacy
  status: TaskStatus;
  last_checkin_at?: string | null;
  checkin_alert_started_at?: string | null;
  photos: TaskPhoto[];
  notes?: string;
}

export interface Streaks {
  current_streak: number;
  longest_streak: number;
  last_achieved_date: string | null; // "YYYY-MM-DD"
  achieved_dates?: string[]; // array of "YYYY-MM-DD"
}

export interface AppSettings {
  sound_enabled: boolean;
  sound_volume: number; // 0.0 to 1.0
  vibration_enabled: boolean;
  wakelock_enabled: boolean;
  require_photo_on_checkin: boolean;
  default_checkin_interval: number;
  default_fullscreen_mode: FullscreenMode;
  tags_list: string[];
  last_break_duration_seconds?: number; // Last used break duration preference
}

export interface DailySummary {
  date: string; // "YYYY-MM-DD"
  total_scheduled_minutes: number;
  total_actual_minutes: number;
  total_sabori_minutes: number;
  execution_rate_percentage: number;
  completed_tasks_count: number;
  photos_count: number;
  is_achieved: boolean;
}
