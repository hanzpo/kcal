import { addDays as dfAddDays, differenceInCalendarDays, format, parseISO } from 'date-fns';

/** Local calendar date as YYYY-MM-DD. All diary/weight rows key on this. */
export function toDateStr(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

export function todayStr(): string {
  return toDateStr(new Date());
}

export function addDaysStr(dateStr: string, days: number): string {
  return toDateStr(dfAddDays(parseISO(dateStr), days));
}

export function daysBetween(a: string, b: string): number {
  return differenceInCalendarDays(parseISO(b), parseISO(a));
}

export function formatDayTitle(dateStr: string): string {
  const today = todayStr();
  if (dateStr === today) return 'Today';
  if (dateStr === addDaysStr(today, -1)) return 'Yesterday';
  if (dateStr === addDaysStr(today, 1)) return 'Tomorrow';
  return format(parseISO(dateStr), 'EEE, MMM d');
}

export function formatShortDate(dateStr: string): string {
  return format(parseISO(dateStr), 'MMM d');
}

export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snacks';

export const MEALS: Meal[] = ['breakfast', 'lunch', 'dinner', 'snacks'];

export const MEAL_LABELS: Record<Meal, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snacks: 'Snacks',
};

/** Default meal for the current wall-clock hour. */
export function mealForNow(date = new Date()): Meal {
  const h = date.getHours();
  if (h < 10) return 'breakfast';
  if (h < 14) return 'lunch';
  if (h < 16) return 'snacks';
  if (h < 21) return 'dinner';
  return 'snacks';
}
