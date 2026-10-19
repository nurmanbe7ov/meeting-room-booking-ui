export type Booking = {
  id: string;
  date: string;
  start: string;
  end: string;
  title?: string;
};

export type BookingInput = Omit<Booking, 'id'>;

export type BookingField = 'date' | 'start' | 'end' | 'form';

export type ValidationResult =
  | { ok: true }
  | { ok: false; kind: 'validation'; field: BookingField; message: string }
  | { ok: false; kind: 'conflict'; field: 'form'; message: string; conflictWith: Booking };

type TimeRange = Pick<Booking, 'start' | 'end'>;

export const WORK_DAY_START = '09:00';
export const WORK_DAY_END = '18:00';
export const MIN_DURATION_MINUTES = 30;
export const MAX_DURATION_MINUTES = 120;
export const SLOT_MINUTES = 30;

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const isValidTime = (value: string): boolean => TIME_PATTERN.test(value);

export const isValidDate = (value: string): boolean => {
  if (!DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
};

export const toMinutes = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

export const toTime = (minutes: number): string => {
  const hours = String(Math.floor(minutes / 60)).padStart(2, '0');
  return `${hours}:${String(minutes % 60).padStart(2, '0')}`;
};

export const toDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const shiftDate = (dateKey: string, days: number): string => {
  const [year, month, day] = dateKey.split('-').map(Number);
  return toDateKey(new Date(year, month - 1, day + days));
};

export const getMinutesOfDay = (date: Date): number => date.getHours() * 60 + date.getMinutes();

export const getSlotStarts = (): string[] => {
  const starts: string[] = [];
  const dayEnd = toMinutes(WORK_DAY_END);
  for (let minutes = toMinutes(WORK_DAY_START); minutes + SLOT_MINUTES <= dayEnd; minutes += SLOT_MINUTES) {
    starts.push(toTime(minutes));
  }
  return starts;
};

export const getEndOptions = (start: string): string[] => {
  const startMinutes = toMinutes(start);
  const last = Math.min(startMinutes + MAX_DURATION_MINUTES, toMinutes(WORK_DAY_END));
  const options: string[] = [];
  for (let minutes = startMinutes + MIN_DURATION_MINUTES; minutes <= last; minutes += SLOT_MINUTES) {
    options.push(toTime(minutes));
  }
  return options;
};

const isOtherOnDate = (booking: Booking, date: string, excludeId?: string): boolean =>
  booking.date === date && booking.id !== excludeId;

export const isStartOccupied = (
  date: string,
  start: string,
  bookings: readonly Booking[],
  excludeId?: string,
): boolean => {
  const minutes = toMinutes(start);
  return bookings.some(
    (booking) =>
      isOtherOnDate(booking, date, excludeId) &&
      toMinutes(booking.start) <= minutes &&
      minutes < toMinutes(booking.end),
  );
};

export const getLatestEnd = (
  date: string,
  start: string,
  bookings: readonly Booking[],
  excludeId?: string,
): string => {
  const startMinutes = toMinutes(start);
  const limit = bookings.reduce(
    (latest, booking) =>
      isOtherOnDate(booking, date, excludeId) && toMinutes(booking.start) >= startMinutes
        ? Math.min(latest, toMinutes(booking.start))
        : latest,
    Math.min(startMinutes + MAX_DURATION_MINUTES, toMinutes(WORK_DAY_END)),
  );
  return toTime(limit);
};

export const canCreateOn = (dateKey: string, now: Date): boolean => {
  const today = toDateKey(now);
  if (dateKey !== today) return dateKey > today;
  return getMinutesOfDay(now) <= toMinutes(WORK_DAY_END) - MIN_DURATION_MINUTES;
};

export const isOverlapping = (a: TimeRange, b: TimeRange): boolean =>
  toMinutes(a.start) < toMinutes(b.end) && toMinutes(b.start) < toMinutes(a.end);

export const hasStarted = (booking: Pick<Booking, 'date' | 'start'>, now: Date): boolean => {
  const today = toDateKey(now);
  if (booking.date !== today) return booking.date < today;
  return toMinutes(booking.start) < getMinutesOfDay(now);
};

const invalid = (field: BookingField, message: string): ValidationResult => ({
  ok: false,
  kind: 'validation',
  field,
  message,
});

export const validateBooking = (
  input: BookingInput,
  existing: readonly Booking[],
  now: Date,
  excludeId?: string,
): ValidationResult => {
  if (!isValidDate(input.date)) return invalid('date', 'Укажите корректную дату');
  if (!isValidTime(input.start)) return invalid('start', 'Укажите корректное время начала');
  if (!isValidTime(input.end)) return invalid('end', 'Укажите корректное время окончания');

  if (excludeId !== undefined) {
    const original = existing.find((booking) => booking.id === excludeId);
    if (original && hasStarted(original, now)) {
      return invalid('form', 'Бронь уже началась или прошла, её нельзя изменить');
    }
  }

  const today = toDateKey(now);
  if (input.date < today) return invalid('date', 'Нельзя бронировать на прошедшую дату');

  const start = toMinutes(input.start);
  const end = toMinutes(input.end);
  const dayStart = toMinutes(WORK_DAY_START);
  const dayEnd = toMinutes(WORK_DAY_END);
  const workDayLabel = `${WORK_DAY_START}–${WORK_DAY_END}`;

  if (start < dayStart || start >= dayEnd) {
    return invalid('start', `Начало должно быть в пределах рабочего дня ${workDayLabel}`);
  }
  if (end <= dayStart || end > dayEnd) {
    return invalid('end', `Окончание должно быть в пределах рабочего дня ${workDayLabel}`);
  }
  if (start >= end) return invalid('end', 'Окончание должно быть позже начала');

  const duration = end - start;
  if (duration < MIN_DURATION_MINUTES) {
    return invalid('end', `Минимальная длительность — ${MIN_DURATION_MINUTES} мин`);
  }
  if (duration > MAX_DURATION_MINUTES) {
    return invalid('end', `Максимальная длительность — ${MAX_DURATION_MINUTES / 60} ч`);
  }

  if (input.date === today && start < getMinutesOfDay(now)) {
    return invalid('start', 'Это время уже прошло');
  }

  const conflict = existing.find(
    (booking) =>
      booking.id !== excludeId && booking.date === input.date && isOverlapping(input, booking),
  );
  if (conflict) {
    const title = conflict.title ? ` «${conflict.title}»` : '';
    return {
      ok: false,
      kind: 'conflict',
      field: 'form',
      message: `Время пересекается с бронью ${conflict.start}–${conflict.end}${title}`,
      conflictWith: conflict,
    };
  }

  return { ok: true };
};
