/**
 * Timezone-aware date and time formatting utilities
 * Prevents UTC ISO string substring bugs on mobile/desktop browsers
 */

/**
 * Format a Date or ISO string into local "YYYY-MM-DD"
 */
export function formatLocalDate(input: Date | string | null | undefined = new Date()): string {
  if (!input) return '';
  const d = typeof input === 'string' ? new Date(input) : input;
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format a Date or ISO string into local "HH:MM" (24-hour)
 */
export function formatLocalTime(input: Date | string | null | undefined = new Date()): string {
  if (!input) return '--:--';
  const d = typeof input === 'string' ? new Date(input) : input;
  if (isNaN(d.getTime())) return '--:--';
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Format a Date or ISO string into local "HH:MM:SS" (24-hour)
 */
export function formatLocalTimeWithSeconds(input: Date | string | null | undefined = new Date()): string {
  if (!input) return '--:--:--';
  const d = typeof input === 'string' ? new Date(input) : input;
  if (isNaN(d.getTime())) return '--:--:--';
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

/**
 * Format a Date or ISO string into local "YYYY-MM-DD HH:MM"
 */
export function formatLocalDateTime(input: Date | string | null | undefined = new Date()): string {
  if (!input) return '';
  return `${formatLocalDate(input)} ${formatLocalTime(input)}`;
}

/**
 * Calculate difference in whole minutes between two dates/ISO strings
 */
export function diffInMinutes(startInput: Date | string, endInput: Date | string): number {
  const start = typeof startInput === 'string' ? new Date(startInput).getTime() : startInput.getTime();
  const end = typeof endInput === 'string' ? new Date(endInput).getTime() : endInput.getTime();
  if (isNaN(start) || isNaN(end)) return 0;
  return Math.max(0, Math.round((end - start) / (1000 * 60)));
}
