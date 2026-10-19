import { describe, expect, it } from 'vitest';
import {
  canCreateOn,
  getEndOptions,
  getLatestEnd,
  getSlotStarts,
  isStartOccupied,
  shiftDate,
  validateBooking,
  type Booking,
  type BookingInput,
} from './booking';

const TODAY = '2026-10-19';
const TOMORROW = '2026-10-20';
const YESTERDAY = '2026-10-18';

const at = (hours: number, minutes: number, seconds = 0): Date =>
  new Date(2026, 9, 19, hours, minutes, seconds);

const NOW = at(10, 7, 30);

const input = (overrides: Partial<BookingInput> = {}): BookingInput => ({
  date: TOMORROW,
  start: '10:00',
  end: '11:00',
  ...overrides,
});

const booking = (overrides: Partial<Booking> = {}): Booking => ({
  id: 'existing',
  date: TOMORROW,
  start: '10:00',
  end: '11:00',
  title: 'Планёрка',
  ...overrides,
});

const validationError = (field: string) => ({ ok: false, kind: 'validation', field });

describe('validateBooking', () => {
  it('принимает корректную бронь', () => {
    expect(validateBooking(input(), [], NOW)).toEqual({ ok: true });
  });

  describe('формат данных', () => {
    it.each(['2026-13-01', '2026-02-31', '19.10.2026', ''])('отклоняет дату %s', (date) => {
      expect(validateBooking(input({ date }), [], NOW)).toMatchObject(validationError('date'));
    });

    it.each(['9:00', '24:00', '10:60', 'abc'])('отклоняет время начала %s', (start) => {
      expect(validateBooking(input({ start }), [], NOW)).toMatchObject(validationError('start'));
    });

    it('отклоняет некорректное время окончания', () => {
      expect(validateBooking(input({ end: '25:00' }), [], NOW)).toMatchObject(
        validationError('end'),
      );
    });
  });

  describe('правило 1: в пределах рабочего дня 09:00–18:00', () => {
    it('отклоняет начало раньше 09:00', () => {
      expect(validateBooking(input({ start: '08:30', end: '09:30' }), [], NOW)).toMatchObject(
        validationError('start'),
      );
    });

    it('отклоняет начало ровно в 18:00', () => {
      expect(validateBooking(input({ start: '18:00', end: '18:30' }), [], NOW)).toMatchObject(
        validationError('start'),
      );
    });

    it('отклоняет окончание позже 18:00', () => {
      expect(validateBooking(input({ start: '17:30', end: '18:30' }), [], NOW)).toMatchObject(
        validationError('end'),
      );
    });

    it('принимает начало ровно в 09:00', () => {
      expect(validateBooking(input({ start: '09:00', end: '09:30' }), [], NOW)).toEqual({
        ok: true,
      });
    });

    it('принимает последний слот 17:30–18:00', () => {
      expect(validateBooking(input({ start: '17:30', end: '18:00' }), [], NOW)).toEqual({
        ok: true,
      });
    });
  });

  describe('правило 2: start < end', () => {
    it('отклоняет одинаковые начало и окончание', () => {
      expect(validateBooking(input({ start: '10:00', end: '10:00' }), [], NOW)).toMatchObject(
        validationError('end'),
      );
    });

    it('отклоняет окончание раньше начала', () => {
      expect(validateBooking(input({ start: '11:00', end: '10:00' }), [], NOW)).toMatchObject(
        validationError('end'),
      );
    });
  });

  describe('правило 3: минимум 30 минут', () => {
    it('отклоняет 29 минут', () => {
      expect(validateBooking(input({ start: '10:00', end: '10:29' }), [], NOW)).toMatchObject(
        validationError('end'),
      );
    });

    it('принимает ровно 30 минут', () => {
      expect(validateBooking(input({ start: '10:00', end: '10:30' }), [], NOW)).toEqual({
        ok: true,
      });
    });
  });

  describe('правило 4: максимум 2 часа', () => {
    it('отклоняет 2 часа 1 минуту', () => {
      expect(validateBooking(input({ start: '10:00', end: '12:01' }), [], NOW)).toMatchObject(
        validationError('end'),
      );
    });

    it('принимает ровно 2 часа', () => {
      expect(validateBooking(input({ start: '10:00', end: '12:00' }), [], NOW)).toEqual({
        ok: true,
      });
    });
  });

  describe('правило 5: брони не пересекаются', () => {
    const existing = [booking({ start: '10:00', end: '11:00' })];

    it.each([
      ['частично в начале', '09:30', '10:30'],
      ['частично в конце', '10:30', '11:30'],
      ['внутри существующей', '10:15', '10:45'],
      ['поверх существующей', '09:30', '11:30'],
      ['совпадает полностью', '10:00', '11:00'],
    ])('возвращает конфликт: %s', (_, start, end) => {
      expect(validateBooking(input({ start, end }), existing, NOW)).toEqual({
        ok: false,
        kind: 'conflict',
        field: 'form',
        message: expect.any(String),
        conflictWith: existing[0],
      });
    });

    it('касание границ 10:00–11:00 и 11:00–12:00 не конфликт', () => {
      expect(validateBooking(input({ start: '11:00', end: '12:00' }), existing, NOW)).toEqual({
        ok: true,
      });
    });

    it('касание границ с другой стороны не конфликт', () => {
      expect(validateBooking(input({ start: '09:00', end: '10:00' }), existing, NOW)).toEqual({
        ok: true,
      });
    });

    it('бронь на другую дату с тем же временем не конфликт', () => {
      const otherDate = [booking({ date: '2026-10-21' })];
      expect(validateBooking(input(), otherDate, NOW)).toEqual({ ok: true });
    });
  });

  describe('правило 6: нельзя бронировать прошедшее время', () => {
    it('отклоняет прошедшую дату', () => {
      expect(validateBooking(input({ date: YESTERDAY }), [], NOW)).toMatchObject(
        validationError('date'),
      );
    });

    it('отклоняет сегодняшний слот, который уже начался', () => {
      expect(
        validateBooking(input({ date: TODAY, start: '10:00', end: '10:30' }), [], NOW),
      ).toMatchObject(validationError('start'));
    });

    it('принимает слот, который начинается ровно сейчас', () => {
      expect(
        validateBooking(input({ date: TODAY, start: '10:00', end: '10:30' }), [], at(10, 0, 30)),
      ).toEqual({ ok: true });
    });

    it('отклоняет слот, начавшийся минуту назад', () => {
      expect(
        validateBooking(input({ date: TODAY, start: '10:00', end: '10:30' }), [], at(10, 1)),
      ).toMatchObject(validationError('start'));
    });

    it('принимает сегодняшний слот в будущем', () => {
      expect(
        validateBooking(input({ date: TODAY, start: '10:30', end: '11:00' }), [], NOW),
      ).toEqual({ ok: true });
    });

    it('отклоняет последний слот, когда рабочий день почти закончился', () => {
      expect(
        validateBooking(input({ date: TODAY, start: '17:30', end: '18:00' }), [], at(17, 45)),
      ).toMatchObject(validationError('start'));
    });
  });

  describe('правило 7: при редактировании бронь не конфликтует сама с собой', () => {
    const current = booking({ id: 'current', start: '10:00', end: '11:00' });

    it('пропускает пересечение с самой собой', () => {
      expect(
        validateBooking(input({ start: '10:30', end: '11:30' }), [current], NOW, 'current'),
      ).toEqual({ ok: true });
    });

    it('сохраняет без изменений', () => {
      expect(validateBooking(input(), [current], NOW, 'current')).toEqual({ ok: true });
    });

    it('всё ещё находит конфликт с другой бронью', () => {
      const other = booking({ id: 'other', start: '11:00', end: '12:00' });
      expect(
        validateBooking(input({ start: '10:30', end: '11:30' }), [current, other], NOW, 'current'),
      ).toMatchObject({ ok: false, kind: 'conflict', conflictWith: other });
    });

    it('без excludeId та же бронь считается конфликтом', () => {
      expect(validateBooking(input(), [current], NOW)).toMatchObject({
        ok: false,
        kind: 'conflict',
      });
    });

    it('запрещает изменять уже начавшуюся бронь', () => {
      const started = booking({ id: 'started', date: TODAY, start: '10:00', end: '11:00' });
      expect(
        validateBooking(input({ date: TODAY, start: '10:30', end: '11:00' }), [started], NOW, 'started'),
      ).toMatchObject(validationError('form'));
    });

    it('запрещает изменять бронь за прошедшую дату', () => {
      const past = booking({ id: 'past', date: YESTERDAY });
      expect(validateBooking(input(), [past], NOW, 'past')).toMatchObject(validationError('form'));
    });
  });
});

describe('слоты и даты', () => {
  it('getSlotStarts возвращает начала с 09:00 до 17:30 с шагом 30 минут', () => {
    const starts = getSlotStarts();
    expect(starts).toHaveLength(18);
    expect(starts[0]).toBe('09:00');
    expect(starts.at(-1)).toBe('17:30');
  });

  it('getEndOptions ограничивает окончание двумя часами', () => {
    expect(getEndOptions('10:00')).toEqual(['10:30', '11:00', '11:30', '12:00']);
  });

  it('getEndOptions не выходит за конец рабочего дня', () => {
    expect(getEndOptions('17:00')).toEqual(['17:30', '18:00']);
  });

  it('shiftDate переходит через границу месяца и года', () => {
    expect(shiftDate('2026-10-31', 1)).toBe('2026-11-01');
    expect(shiftDate('2027-01-01', -1)).toBe('2026-12-31');
  });

  it('canCreateOn: прошедшая дата — нельзя, будущая — можно', () => {
    expect(canCreateOn(YESTERDAY, NOW)).toBe(false);
    expect(canCreateOn(TOMORROW, NOW)).toBe(true);
  });

  it('canCreateOn: сегодня можно до 17:30 включительно', () => {
    expect(canCreateOn(TODAY, at(17, 30))).toBe(true);
    expect(canCreateOn(TODAY, at(17, 31))).toBe(false);
  });
});

describe('занятость для полей формы', () => {
  const existing = [booking({ id: 'a', start: '10:00', end: '11:00' })];

  it('isStartOccupied: начало внутри брони занято, на её окончании — свободно', () => {
    expect(isStartOccupied(TOMORROW, '10:00', existing)).toBe(true);
    expect(isStartOccupied(TOMORROW, '10:30', existing)).toBe(true);
    expect(isStartOccupied(TOMORROW, '11:00', existing)).toBe(false);
    expect(isStartOccupied(TOMORROW, '09:30', existing)).toBe(false);
  });

  it('isStartOccupied: учитывает дату и excludeId', () => {
    expect(isStartOccupied(TODAY, '10:00', existing)).toBe(false);
    expect(isStartOccupied(TOMORROW, '10:00', existing, 'a')).toBe(false);
  });

  it('getLatestEnd: ограничивает окончание началом следующей брони', () => {
    expect(getLatestEnd(TOMORROW, '09:00', existing)).toBe('10:00');
  });

  it('getLatestEnd: без следующей брони — 2 часа или конец дня', () => {
    expect(getLatestEnd(TOMORROW, '11:00', existing)).toBe('13:00');
    expect(getLatestEnd(TOMORROW, '17:00', existing)).toBe('18:00');
  });

  it('getLatestEnd: не ограничивает себя при редактировании', () => {
    expect(getLatestEnd(TOMORROW, '09:30', existing, 'a')).toBe('11:30');
  });
});
