import Dexie, { type Table } from 'dexie';
import type { Task, Streaks, AppSettings, TaskPhoto } from './types';
import { formatLocalDate } from '../utils/date';

export const DEFAULT_TAGS = ['プログラミング', '勉強', '執筆', '読書', '筋トレ', 'デザイン', 'その他'];

export const DEFAULT_SETTINGS: AppSettings = {
  sound_enabled: true,
  sound_volume: 0.8,
  vibration_enabled: true,
  wakelock_enabled: true,
  require_photo_on_checkin: false,
  default_checkin_interval: 25,
  default_fullscreen_mode: 'clock',
  tags_list: DEFAULT_TAGS,
  last_break_duration_seconds: 900, // Default to 15 minutes
};

export const INITIAL_STREAKS: Streaks = {
  current_streak: 0,
  longest_streak: 0,
  last_achieved_date: null,
  achieved_dates: [],
};

class HabitDatabase extends Dexie {
  tasks!: Table<Task, string>;
  streaks!: Table<Streaks & { id: string }, string>;
  settings!: Table<AppSettings & { id: string }, string>;

  constructor() {
    super('CommitHabitDB');
    this.version(1).stores({
      tasks: 'id, type, status, tag, scheduled_start_at, actual_start_at, ended_at',
      streaks: 'id',
      settings: 'id',
    });
  }
}

export const db = new HabitDatabase();

// --- DB Service Helper Functions ---

export async function initDb(): Promise<void> {
  // Ensure default streaks exist
  const existingStreaks = await db.streaks.get('main_streaks');
  if (!existingStreaks) {
    await db.streaks.put({ ...INITIAL_STREAKS, id: 'main_streaks' });
  }

  // Ensure default settings exist
  const existingSettings = await db.settings.get('app_settings');
  if (!existingSettings) {
    await db.settings.put({ ...DEFAULT_SETTINGS, id: 'app_settings' });
  }
}

export async function getSettings(): Promise<AppSettings> {
  const s = await db.settings.get('app_settings');
  return s ? { ...DEFAULT_SETTINGS, ...s } : DEFAULT_SETTINGS;
}

export async function updateSettings(partial: Partial<AppSettings>): Promise<void> {
  const current = await getSettings();
  await db.settings.put({ ...current, ...partial, id: 'app_settings' });
}

export async function getStreaks(): Promise<Streaks> {
  const s = await db.streaks.get('main_streaks');
  return s || INITIAL_STREAKS;
}

export async function updateStreaks(streaks: Streaks): Promise<void> {
  await db.streaks.put({ ...streaks, id: 'main_streaks' });
}

export async function getAllTasks(): Promise<Task[]> {
  return await db.tasks.toArray();
}

export async function getTaskById(id: string): Promise<Task | undefined> {
  return await db.tasks.get(id);
}

export async function getActiveRunningTask(): Promise<Task | undefined> {
  return await db.tasks.where('status').equals('running').first();
}

export async function saveTask(task: Task): Promise<void> {
  await db.tasks.put(task);
}

export async function deleteTask(id: string): Promise<void> {
  await db.tasks.delete(id);
}

export async function addPhotoToTask(taskId: string, photo: TaskPhoto): Promise<void> {
  const task = await db.tasks.get(taskId);
  if (task) {
    task.photos.push(photo);
    await db.tasks.put(task);
  }
}

export async function getTasksForDate(dateStr: string): Promise<Task[]> {
  // dateStr format "YYYY-MM-DD" in local timezone
  const all = await db.tasks.toArray();
  return all.filter((t) => {
    const targetDate = formatLocalDate(t.actual_start_at || t.scheduled_start_at);
    return targetDate === dateStr;
  });
}

// Backup / Restore
export async function exportAllDataJson(): Promise<string> {
  const tasks = await db.tasks.toArray();
  const streaks = await getStreaks();
  const settings = await getSettings();

  const exportObj = {
    version: '1.0.0',
    exported_at: new Date().toISOString(),
    tasks,
    streaks,
    settings,
  };

  return JSON.stringify(exportObj, null, 2);
}

export async function importDataJson(jsonString: string): Promise<boolean> {
  try {
    const data = JSON.parse(jsonString);
    if (!data.tasks || !Array.isArray(data.tasks)) {
      throw new Error('Invalid backup format: missing tasks');
    }

    await db.transaction('rw', db.tasks, db.streaks, db.settings, async () => {
      await db.tasks.clear();
      for (const t of data.tasks) {
        await db.tasks.put(t);
      }
      if (data.streaks) {
        await db.streaks.put({ ...data.streaks, id: 'main_streaks' });
      }
      if (data.settings) {
        await db.settings.put({ ...data.settings, id: 'app_settings' });
      }
    });

    return true;
  } catch (err) {
    console.error('Import failed:', err);
    return false;
  }
}
