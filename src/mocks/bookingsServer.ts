import type { ApiErrorBody } from '../api/apiError';
import {
  isValidDate,
  isValidTime,
  shiftDate,
  toDateKey,
  toMinutes,
  validateBooking,
  type Booking,
  type BookingInput,
  type ValidationResult,
} from '../domain/booking';

export type ServerResponse<T> =
  | { ok: true; status: 200 | 201 | 204; data: T }
  | { ok: false; status: 400 | 404 | 409 | 500; error: ApiErrorBody };

const STORAGE_KEY = 'meeting-room-bookings';
const RESPONSE_DELAY_MS = 300;

const createId = (): string => {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
};

const delay = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, RESPONSE_DELAY_MS));

const success = <T>(status: 200 | 201 | 204, data: T): ServerResponse<T> => ({ ok: true, status, data });

const failure = <T>(status: 400 | 404 | 409 | 500, error: ApiErrorBody): ServerResponse<T> => ({
  ok: false,
  status,
  error,
});

const notFound = <T>(): ServerResponse<T> =>
  failure(404, { code: 'NOT_FOUND', message: 'Бронь не найдена: возможно, её уже удалили' });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isBooking = (value: unknown): value is Booking =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.date === 'string' &&
  isValidDate(value.date) &&
  typeof value.start === 'string' &&
  isValidTime(value.start) &&
  typeof value.end === 'string' &&
  isValidTime(value.end) &&
  (value.title === undefined || typeof value.title === 'string');

const createSeed = (now: Date): Booking[] => {
  const today = toDateKey(now);
  const tomorrow = shiftDate(today, 1);
  return [
    { id: 'seed-1', date: today, start: '11:00', end: '12:00', title: 'Планёрка' },
    { id: 'seed-2', date: today, start: '14:00', end: '15:30', title: 'Созвон с клиентом' },
    { id: 'seed-3', date: tomorrow, start: '10:00', end: '11:00', title: 'Ретро' },
  ];
};

const writeBookings = (bookings: readonly Booking[]): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bookings));
};

const readBookings = (): Booking[] => {
  const raw = localStorage.getItem(STORAGE_KEY);

  if (raw === null) {
    const seed = createSeed(new Date());
    writeBookings(seed);
    return seed;
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isBooking) : [];
  } catch {
    return [];
  }
};

const sortByStart = (bookings: Booking[]): Booking[] =>
  [...bookings].sort(
    (a, b) => toMinutes(a.start) - toMinutes(b.start) || toMinutes(a.end) - toMinutes(b.end),
  );

const normalizeInput = (input: BookingInput): BookingInput => {
  const title = input.title?.trim();
  return { date: input.date, start: input.start, end: input.end, ...(title ? { title } : {}) };
};

const rejectInvalid = <T>(
  validation: Extract<ValidationResult, { ok: false }>,
): ServerResponse<T> =>
  validation.kind === 'conflict'
    ? failure(409, {
        code: 'CONFLICT',
        message: validation.message,
        field: validation.field,
        conflictWith: validation.conflictWith,
      })
    : failure(400, {
        code: 'VALIDATION_ERROR',
        message: validation.message,
        field: validation.field,
      });

const handle = async <T>(operation: () => ServerResponse<T>): Promise<ServerResponse<T>> => {
  await delay();
  try {
    return operation();
  } catch {
    return failure(500, { code: 'SERVER_ERROR', message: 'Сервис временно недоступен' });
  }
};

const list = (date: string): Promise<ServerResponse<Booking[]>> =>
  handle(() => {
    if (!isValidDate(date)) {
      return failure(400, { code: 'VALIDATION_ERROR', message: 'Укажите корректную дату', field: 'date' });
    }
    return success(200, sortByStart(readBookings().filter((booking) => booking.date === date)));
  });

const create = (input: BookingInput): Promise<ServerResponse<Booking>> =>
  handle(() => {
    const bookings = readBookings();
    const candidate = normalizeInput(input);
    const validation = validateBooking(candidate, bookings, new Date());
    if (!validation.ok) return rejectInvalid(validation);

    const created: Booking = { id: createId(), ...candidate };
    writeBookings([...bookings, created]);
    return success(201, created);
  });

const update = (id: string, patch: Partial<BookingInput>): Promise<ServerResponse<Booking>> =>
  handle(() => {
    const bookings = readBookings();
    const current = bookings.find((booking) => booking.id === id);
    if (!current) return notFound();

    const candidate = normalizeInput({
      date: patch.date ?? current.date,
      start: patch.start ?? current.start,
      end: patch.end ?? current.end,
      title: 'title' in patch ? patch.title : current.title,
    });
    const validation = validateBooking(candidate, bookings, new Date(), id);
    if (!validation.ok) return rejectInvalid(validation);

    const updated: Booking = { id, ...candidate };
    writeBookings(bookings.map((booking) => (booking.id === id ? updated : booking)));
    return success(200, updated);
  });

const remove = (id: string): Promise<ServerResponse<void>> =>
  handle(() => {
    const bookings = readBookings();
    if (!bookings.some((booking) => booking.id === id)) return notFound();
    writeBookings(bookings.filter((booking) => booking.id !== id));
    return success(204, undefined);
  });

export const bookingsServer = { list, create, update, remove };
