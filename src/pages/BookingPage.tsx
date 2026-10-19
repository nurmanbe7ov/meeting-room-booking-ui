import { useEffect, useMemo, useRef, useState } from 'react';
import { BookingForm } from '../components/BookingForm';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { DateNavigator } from '../components/DateNavigator';
import { DayTimeline } from '../components/DayTimeline';
import {
  canCreateOn,
  getSlotStarts,
  hasStarted,
  isStartOccupied,
  toDateKey,
  type Booking,
} from '../domain/booking';
import { useBookingForm } from '../hooks/useBookingForm';
import { useBookings } from '../hooks/useBookings';
import { useDeleteBooking } from '../hooks/useDeleteBooking';
import { useNow } from '../hooks/useNow';
import { formatDateLabel } from '../utils/formatDate';

const NOTICE_TIMEOUT_MS = 4000;
const SLOT_STARTS = getSlotStarts();
const NO_BOOKINGS: Booking[] = [];

type Notice = { id: number; message: string };

export const BookingPage = () => {
  const now = useNow();
  const today = toDateKey(now);
  const [date, setDate] = useState(() => toDateKey(new Date()));
  const [notice, setNotice] = useState<Notice | null>(null);
  const noticeIdRef = useRef(0);
  const scheduleHeadingRef = useRef<HTMLHeadingElement>(null);
  const hadOverlayRef = useRef(false);
  const { state, refresh } = useBookings(date);
  const bookings = state.status === 'ready' ? state.bookings : NO_BOOKINGS;

  const showNotice = (message: string) => {
    noticeIdRef.current += 1;
    setNotice({ id: noticeIdRef.current, message });
  };

  const form = useBookingForm({ bookings, refresh, onSaved: showNotice });
  const removal = useDeleteBooking({
    refresh,
    onDeleted: (message, booking) => {
      showNotice(message);
      if (form.draft?.mode === 'edit' && form.draft.booking.id === booking.id) form.close();
    },
  });

  useEffect(() => {
    if (!notice) return;
    const timeoutId = window.setTimeout(() => setNotice(null), NOTICE_TIMEOUT_MS);
    return () => window.clearTimeout(timeoutId);
  }, [notice]);

  const isFormOpen = form.draft !== null;
  const isDialogOpen = removal.target !== null;

  useEffect(() => {
    const hasOverlay = isFormOpen || isDialogOpen;
    if (hadOverlayRef.current && !hasOverlay && document.activeElement === document.body) {
      scheduleHeadingRef.current?.focus();
    }
    hadOverlayRef.current = hasOverlay;
  }, [isFormOpen, isDialogOpen]);

  const canCreate = canCreateOn(date, now);
  const editingBooking = form.draft?.mode === 'edit' ? form.draft.booking : null;
  const isReadOnly = editingBooking !== null && hasStarted(editingBooking, now);
  const isFormVisible = form.draft !== null && (form.draft.mode === 'edit' || canCreate);

  const firstFreeSlot = useMemo(
    () =>
      SLOT_STARTS.find(
        (start) => !hasStarted({ date, start }, now) && !isStartOccupied(date, start, bookings),
      ),
    [bookings, date, now],
  );

  const changeDate = (nextDate: string) => {
    setDate(nextDate);
    form.close();
  };

  const handleSelectSlot = (start: string) => form.selectSlot(date, start);

  const dateLabel = formatDateLabel(date);
  const unavailableReason =
    date < today
      ? 'Дата в прошлом: брони можно только просматривать и удалять.'
      : 'Рабочий день закончился: бронирование на сегодня недоступно.';

  return (
    <main className="page">
      <header className="page__header">
        <h1 className="page__title">Бронирование переговорной</h1>
        <DateNavigator date={date} today={today} onChange={changeDate} />
      </header>

      <div className="page__layout">
        <section
          className="panel"
          aria-labelledby="schedule-title"
          aria-busy={state.status === 'loading' || (state.status === 'ready' && state.isRefreshing)}
        >
          <div className="panel__header">
            <h2 id="schedule-title" className="panel__title" ref={scheduleHeadingRef} tabIndex={-1}>
              {dateLabel}
            </h2>
            {state.status === 'ready' && state.isRefreshing && (
              <span className="panel__hint">Обновляем…</span>
            )}
          </div>

          {state.status === 'loading' && (
            <div className="state" role="status">
              <span className="spinner" aria-hidden="true" />
              Загружаем брони…
            </div>
          )}

          {state.status === 'error' && (
            <div className="state state--error" role="alert">
              <p>{state.message}</p>
              <button type="button" className="button" onClick={() => void refresh()}>
                Повторить
              </button>
            </div>
          )}

          {state.status === 'ready' && (
            <>
              {state.refreshError && (
                <div className="alert alert--warning" role="alert">
                  <p>Не удалось обновить список: данные могут быть устаревшими.</p>
                  <button
                    type="button"
                    className="button"
                    onClick={() => void refresh()}
                    disabled={state.isRefreshing}
                  >
                    Обновить
                  </button>
                </div>
              )}
              {state.bookings.length === 0 && (
                <p className="state state--empty">
                  На этот день броней нет.{canCreate && ' Выберите свободный слот, чтобы забронировать.'}
                </p>
              )}
              <DayTimeline
                date={date}
                bookings={state.bookings}
                now={now}
                selection={isFormVisible && !isReadOnly && form.draft ? form.draft.values : null}
                activeBookingId={editingBooking?.id ?? null}
                onSelectSlot={handleSelectSlot}
                onSelectBooking={form.openEdit}
              />
            </>
          )}
        </section>

        <aside className="panel panel--side" aria-label="Бронирование">
          {isFormVisible && form.draft ? (
            <BookingForm
              mode={form.draft.mode}
              values={form.draft.values}
              errors={form.errors}
              bookings={bookings}
              excludeId={editingBooking?.id}
              now={now}
              isSubmitting={form.isSubmitting}
              isReadOnly={isReadOnly}
              isOrphaned={form.isOrphaned}
              openCount={form.openCount}
              errorFocus={form.errorFocus}
              onFieldChange={form.setField}
              onSubmit={form.handleSubmit}
              onCancel={form.close}
              onDelete={editingBooking && !form.isOrphaned ? () => removal.request(editingBooking) : undefined}
              onConvertToCreate={form.convertToCreate}
            />
          ) : canCreate ? (
            <div className="placeholder">
              <p>Выберите свободный слот на шкале или создайте бронь на ближайшее время.</p>
              <button
                type="button"
                className="button button--primary"
                disabled={!firstFreeSlot || state.status !== 'ready'}
                onClick={() => firstFreeSlot && form.startCreate(date, firstFreeSlot)}
              >
                Новая бронь
              </button>
              {state.status === 'ready' && !firstFreeSlot && (
                <p className="panel__hint">Свободных слотов на этот день не осталось.</p>
              )}
            </div>
          ) : (
            <p className="placeholder">{unavailableReason}</p>
          )}
        </aside>
      </div>

      <div className={`toast${notice ? ' toast--visible' : ''}`} role="status">
        {notice && <span key={notice.id}>{notice.message}</span>}
      </div>

      <ConfirmDialog
        isOpen={removal.target !== null}
        title="Удалить бронь?"
        description={
          removal.target
            ? `${removal.target.title ?? 'Без названия'}, ${removal.target.start}–${removal.target.end}. Действие нельзя отменить.`
            : ''
        }
        confirmLabel="Удалить"
        isPending={removal.isDeleting}
        error={removal.error}
        onConfirm={() => void removal.confirm()}
        onCancel={removal.cancel}
      />
    </main>
  );
};
