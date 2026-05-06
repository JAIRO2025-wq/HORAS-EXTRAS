
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  parse,
  differenceInMinutes,
  addDays,
  set,
  isAfter,
  isBefore,
  max,
  min,
  format,
  isValid,
} from 'date-fns';
import type { OvertimeRecord } from './types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function calculateOvertime(
  date: Date,
  startTime: string,
  endTime: string
) {
  if (!date || !startTime || !endTime) {
    return { totalHours: 0, dayHours: 0, nightHours: 0 };
  }

  // Asegurar que la fecha sea válida
  const baseDate = new Date(date);
  if (!isValid(baseDate)) return { totalHours: 0, dayHours: 0, nightHours: 0 };

  const startDate = parse(startTime, 'hh:mm a', baseDate);
  let endDate = parse(endTime, 'hh:mm a', baseDate);

  if (!isValid(startDate) || !isValid(endDate)) {
    return { totalHours: 0, dayHours: 0, nightHours: 0 };
  }

  if (isAfter(startDate, endDate)) {
    endDate = addDays(endDate, 1);
  }

  const totalMinutes = differenceInMinutes(endDate, startDate);
  if (totalMinutes <= 0 || isNaN(totalMinutes)) {
    return { totalHours: 0, dayHours: 0, nightHours: 0 };
  }

  let dayMinutes = 0;

  const dayStart1 = set(startDate, { hours: 6, minutes: 0, seconds: 0 });
  const dayEnd1 = set(startDate, { hours: 19, minutes: 0, seconds: 0 });
  const dayStart2 = addDays(dayStart1, 1);
  const dayEnd2 = addDays(dayEnd1, 1);

  // Intersección día 1
  const intersectionStart1 = max([startDate, dayStart1]);
  const intersectionEnd1 = min([endDate, dayEnd1]);
  if (isAfter(intersectionEnd1, intersectionStart1)) {
    dayMinutes += differenceInMinutes(intersectionEnd1, intersectionStart1);
  }

  // Intersección día 2 (turnos nocturnos que terminan después de las 6am del día siguiente)
  const intersectionStart2 = max([startDate, dayStart2]);
  const intersectionEnd2 = min([endDate, dayEnd2]);
  if (isAfter(intersectionEnd2, intersectionStart2)) {
    dayMinutes += differenceInMinutes(intersectionEnd2, intersectionStart2);
  }

  const totalHours = totalMinutes / 60;
  const dayHours = dayMinutes / 60;
  const nightHours = Math.max(0, totalHours - dayHours);

  return {
    totalHours: parseFloat(totalHours.toFixed(4)),
    dayHours: parseFloat(dayHours.toFixed(4)),
    nightHours: parseFloat(nightHours.toFixed(4)),
  };
}

export function getOvertimeHoursFromRecord(record: OvertimeRecord) {
  const { date, startTime, endTime, type } = record;

  if (type === 'additional_day') {
    return {
      totalHours: record.totalHours || 0,
      dayHours: 0,
      nightHours: 0,
    };
  }

  return calculateOvertime(new Date(date), startTime, endTime);
}

/**
 * Verifica si dos rangos de tiempo se solapan
 */
export function isTimeOverlapping(
  date1: Date, start1: string, end1: string,
  date2: Date, start2: string, end2: string
): boolean {
  if (format(date1, 'yyyy-MM-dd') !== format(new Date(date2), 'yyyy-MM-dd')) return false;

  const s1 = parse(start1, 'hh:mm a', date1);
  let e1 = parse(end1, 'hh:mm a', date1);
  if (!isValid(s1) || !isValid(e1)) return false;
  if (isAfter(s1, e1)) e1 = addDays(e1, 1);

  const s2 = parse(start2, 'hh:mm a', new Date(date2));
  let e2 = parse(end2, 'hh:mm a', new Date(date2));
  if (!isValid(s2) || !isValid(e2)) return false;
  if (isAfter(s2, e2)) e2 = addDays(e2, 1);

  return s1 < e2 && e1 > s2;
}
