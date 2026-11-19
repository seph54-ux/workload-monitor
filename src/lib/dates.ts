import { differenceInCalendarDays, format, isValid, parseISO } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

export const MANILA_TZ = 'Asia/Manila';

export type DeadlineStatus = 'done' | 'overdue' | 'due_soon' | 'open' | 'none';

export function getTodayManilaISO(now: Date = new Date()): string {
  const zoned = toZonedTime(now, MANILA_TZ);
  return format(zoned, 'yyyy-MM-dd');
}

export function getCurrentManilaMonthKey(now: Date = new Date()): string {
  const zoned = toZonedTime(now, MANILA_TZ);
  return format(zoned, 'yyyy-MM');
}

export function formatManilaDate(value: string | null | undefined): string {
  if (!value) return '—';
  const parsed = parseISO(value.length === 10 ? `${value}T00:00:00` : value);
  if (!isValid(parsed)) return value;
  return format(parsed, 'MMM dd, yyyy');
}

export function formatManilaDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const parsed = parseISO(value);
  if (!isValid(parsed)) return value;
  const zoned = toZonedTime(parsed, MANILA_TZ);
  return format(zoned, 'MMM dd, yyyy HH:mm');
}

export function formatObTime(value: string | null | undefined): string {
  if (!value) return '—';
  const [hh, mm] = value.split(':');
  if (!hh || !mm) return value;
  const hour = Number(hh);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${mm} ${suffix}`;
}

export function getDeadlineStatus(
  commitmentDate: string | null | undefined,
  finishedDate: string | null | undefined,
  now: Date = new Date()
): DeadlineStatus {
  if (finishedDate) return 'done';
  if (!commitmentDate) return 'none';

  const todayIso = getTodayManilaISO(now);
  const today = parseISO(`${todayIso}T00:00:00`);
  const commitment = parseISO(`${commitmentDate.slice(0, 10)}T00:00:00`);
  if (!isValid(commitment)) return 'none';

  const diffDays = differenceInCalendarDays(commitment, today);
  if (diffDays < 0) return 'overdue';
  if (diffDays <= 2) return 'due_soon';
  return 'open';
}

export function isDueWithinDays(
  commitmentDate: string | null | undefined,
  finishedDate: string | null | undefined,
  days: number = 7,
  now: Date = new Date()
): boolean {
  if (finishedDate || !commitmentDate) return false;
  const todayIso = getTodayManilaISO(now);
  const today = parseISO(`${todayIso}T00:00:00`);
  const commitment = parseISO(`${commitmentDate.slice(0, 10)}T00:00:00`);
  if (!isValid(commitment)) return false;
  const diffDays = differenceInCalendarDays(commitment, today);
  return diffDays >= 0 && diffDays <= days;
}

export function isTrfOverdue(
  dateFiled: string | null | undefined,
  status: string,
  dateCompleted: string | null | undefined,
  slaDays: number = 3,
  now: Date = new Date()
): boolean {
  if (status === 'Completed' || dateCompleted || !dateFiled) return false;
  const todayIso = getTodayManilaISO(now);
  const today = parseISO(`${todayIso}T00:00:00`);
  const filed = parseISO(`${dateFiled.slice(0, 10)}T00:00:00`);
  if (!isValid(filed)) return false;
  return differenceInCalendarDays(today, filed) > slaDays;
}
