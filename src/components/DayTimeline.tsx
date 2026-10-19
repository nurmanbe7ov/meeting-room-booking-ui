import { useMemo, type CSSProperties } from 'react';
import {
  getMinutesOfDay,
  getSlotStarts,
  hasStarted,
  isOverlapping,
  SLOT_MINUTES,
  toDateKey,
  toMinutes,
  toTime,
  WORK_DAY_END,
  WORK_DAY_START,
  type Booking,
} from '../domain/booking';

type TimeRange = { start: string; end: string };

type DayTimelineProps = {
  date: string;
  bookings: readonly Booking[];
  now: Date;
  selection: TimeRange | null;
  activeBookingId: string | null;
  onSelectSlot: (start: string) => void;
  onSelectBooking: (booking: Booking) => void;
};

type TimelineItem =
  | { kind: 'slot'; start: string; end: string; isAvailable: boolean }
  | { kind: 'booking'; start: string; end: string; booking: Booking };

type CSSVariables = CSSProperties & Record<`--${string}`, string | number>;

const DAY_START = toMinutes(WORK_DAY_START);
const DAY_LENGTH = toMinutes(WORK_DAY_END) - DAY_START;
const SLOT_STARTS = getSlotStarts();
const HOUR_LABELS = [...SLOT_STARTS, WORK_DAY_END];

const toOffset = (minutes: number): string => `${((minutes - DAY_START) / DAY_LENGTH) * 100}%`;

const toPosition = ({ start, end }: TimeRange): CSSProperties => ({
  top: toOffset(toMinutes(start)),
  height: `${((toMinutes(end) - toMinutes(start)) / DAY_LENGTH) * 100}%`,
});

const buildItems = (date: string, bookings: readonly Booking[], now: Date): TimelineItem[] => {
  const slots: TimelineItem[] = SLOT_STARTS.map((start) => ({
    kind: 'slot' as const,
    start,
    end: toTime(toMinutes(start) + SLOT_MINUTES),
    isAvailable: !hasStarted({ date, start }, now),
  })).filter((slot) => !bookings.some((booking) => isOverlapping(slot, booking)));

  const bookingItems: TimelineItem[] = bookings.map((booking) => ({
    kind: 'booking',
    start: booking.start,
    end: booking.end,
    booking,
  }));

  return [...slots, ...bookingItems].sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
};

export const DayTimeline = ({
  date,
  bookings,
  now,
  selection,
  activeBookingId,
  onSelectSlot,
  onSelectBooking,
}: DayTimelineProps) => {
  const items = useMemo(() => buildItems(date, bookings, now), [date, bookings, now]);

  const nowMinutes = getMinutesOfDay(now);
  const showNowLine =
    date === toDateKey(now) && nowMinutes >= DAY_START && nowMinutes <= DAY_START + DAY_LENGTH;

  return (
    <div className="timeline" style={{ '--slot-count': SLOT_STARTS.length } as CSSVariables}>
      <ol className="timeline__hours" aria-hidden="true">
        {HOUR_LABELS.map((time) => (
          <li key={time} className="timeline__hour" style={{ top: toOffset(toMinutes(time)) }}>
            {time}
          </li>
        ))}
      </ol>

      <div className="timeline__track">
        <ul className="timeline__list" aria-label="Слоты и брони">
          {items.map((item) => (
            <li
              key={item.kind === 'booking' ? item.booking.id : `slot-${item.start}`}
              className="timeline__item"
              style={toPosition(item)}
            >
              {item.kind === 'booking' ? (
                <BookingBlock
                  booking={item.booking}
                  isActive={item.booking.id === activeBookingId}
                  isReadOnly={hasStarted(item.booking, now)}
                  onSelect={onSelectBooking}
                />
              ) : item.isAvailable ? (
                <button
                  type="button"
                  className="timeline__slot"
                  aria-label={`Свободно ${item.start}–${item.end}. Забронировать`}
                  aria-pressed={selection !== null && isOverlapping(item, selection)}
                  onClick={() => onSelectSlot(item.start)}
                >
                  <span aria-hidden="true">Свободно</span>
                </button>
              ) : (
                <div className="timeline__slot timeline__slot--past" aria-hidden="true" />
              )}
            </li>
          ))}
        </ul>

        {selection && (
          <div className="timeline__preview" style={toPosition(selection)} aria-hidden="true">
            {selection.start}–{selection.end}
          </div>
        )}

        {showNowLine && (
          <div className="timeline__now" style={{ top: toOffset(nowMinutes) }} aria-hidden="true" />
        )}
      </div>
    </div>
  );
};

type BookingBlockProps = {
  booking: Booking;
  isActive: boolean;
  isReadOnly: boolean;
  onSelect: (booking: Booking) => void;
};

const BookingBlock = ({ booking, isActive, isReadOnly, onSelect }: BookingBlockProps) => {
  const title = booking.title ?? 'Без названия';
  const action = isReadOnly ? 'Посмотреть' : 'Редактировать';

  return (
    <button
      type="button"
      className={`timeline__booking${isReadOnly ? ' timeline__booking--past' : ''}`}
      aria-label={`${title}, ${booking.start}–${booking.end}. ${action}`}
      aria-pressed={isActive}
      onClick={() => onSelect(booking)}
    >
      <span className="timeline__booking-time">
        {booking.start}–{booking.end}
      </span>
      <span className="timeline__booking-title">{title}</span>
    </button>
  );
};
