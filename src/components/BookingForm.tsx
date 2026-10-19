import { useEffect, useRef, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import {
  getEndOptions,
  getLatestEnd,
  getSlotStarts,
  hasStarted,
  isStartOccupied,
  toMinutes,
  type Booking,
} from '../domain/booking';
import type {
  EditableField,
  FormErrorField,
  FormErrors,
  FormValues,
} from '../hooks/useBookingForm';
import { formatDateLabel } from '../utils/formatDate';

type BookingFormProps = {
  mode: 'create' | 'edit';
  values: FormValues;
  errors: FormErrors;
  bookings: readonly Booking[];
  excludeId?: string;
  now: Date;
  isSubmitting: boolean;
  isReadOnly: boolean;
  isOrphaned: boolean;
  openCount: number;
  errorFocus: { field: FormErrorField } | null;
  onFieldChange: (field: EditableField, value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
  onDelete?: () => void;
  onConvertToCreate: () => void;
};

const TITLE_MAX_LENGTH = 100;
const SLOT_STARTS = getSlotStarts();

const withCurrent = (options: string[], value: string): string[] =>
  options.includes(value) ? options : [...options, value].sort();

const formatDuration = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return [hours > 0 ? `${hours} ч` : '', rest > 0 ? `${rest} мин` : ''].filter(Boolean).join(' ');
};

export const BookingForm = ({
  mode,
  values,
  errors,
  bookings,
  excludeId,
  now,
  isSubmitting,
  isReadOnly,
  isOrphaned,
  openCount,
  errorFocus,
  onFieldChange,
  onSubmit,
  onCancel,
  onDelete,
  onConvertToCreate,
}: BookingFormProps) => {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const startRef = useRef<HTMLSelectElement>(null);
  const endRef = useRef<HTMLSelectElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isReadOnly) headingRef.current?.focus();
    else startRef.current?.focus();
  }, [openCount, isReadOnly]);

  useEffect(() => {
    if (!errorFocus) return;
    const targets = { form: alertRef, start: startRef, end: endRef };
    targets[errorFocus.field].current?.focus();
  }, [errorFocus]);

  const handleChange =
    (field: EditableField) => (event: ChangeEvent<HTMLSelectElement | HTMLInputElement>) =>
      onFieldChange(field, event.target.value);

  const startOptions = withCurrent(SLOT_STARTS, values.start);
  const endOptions = withCurrent(getEndOptions(values.start), values.end);
  const latestEnd = toMinutes(getLatestEnd(values.date, values.start, bookings, excludeId));
  const duration = toMinutes(values.end) - toMinutes(values.start);

  const getStartNote = (start: string): string | null => {
    if (hasStarted({ date: values.date, start }, now)) return 'прошло';
    if (isStartOccupied(values.date, start, bookings, excludeId)) return 'занято';
    return null;
  };
  const heading = isReadOnly ? 'Бронь' : mode === 'edit' ? 'Редактирование брони' : 'Новая бронь';
  const submitLabel = mode === 'edit' ? 'Сохранить' : 'Забронировать';

  return (
    <form className="booking-form" onSubmit={onSubmit} noValidate aria-labelledby="booking-form-title">
      <h2 id="booking-form-title" className="booking-form__title" ref={headingRef} tabIndex={-1}>
        {heading}
      </h2>
      <p className="booking-form__date">{formatDateLabel(values.date)}</p>

      {isReadOnly && (
        <p className="alert alert--info">Бронь уже началась или прошла. Её можно только удалить.</p>
      )}

      {errors.form && (
        <div className="alert alert--error" role="alert" ref={alertRef} tabIndex={-1}>
          <p>{errors.form}</p>
          {isOrphaned && (
            <button type="button" className="button" onClick={onConvertToCreate}>
              Создать как новую
            </button>
          )}
        </div>
      )}

      <fieldset className="booking-form__fields" disabled={isSubmitting || isReadOnly}>
        <legend className="visually-hidden">Время и название</legend>
        <div className="booking-form__row">
          <Field id="booking-start" label="Начало" error={errors.start}>
            <select
              id="booking-start"
              ref={startRef}
              className="input"
              value={values.start}
              onChange={handleChange('start')}
              aria-invalid={errors.start ? true : undefined}
              aria-describedby={errors.start ? 'booking-start-error' : undefined}
            >
              {startOptions.map((start) => {
                const note = getStartNote(start);
                return (
                  <option key={start} value={start} disabled={note !== null}>
                    {note ? `${start} — ${note}` : start}
                  </option>
                );
              })}
            </select>
          </Field>

          <Field id="booking-end" label="Окончание" error={errors.end}>
            <select
              id="booking-end"
              ref={endRef}
              className="input"
              value={values.end}
              onChange={handleChange('end')}
              aria-invalid={errors.end ? true : undefined}
              aria-describedby={errors.end ? 'booking-end-error' : undefined}
            >
              {endOptions.map((end) => {
                const isTaken = toMinutes(end) > latestEnd;
                return (
                  <option key={end} value={end} disabled={isTaken}>
                    {isTaken ? `${end} — занято` : end}
                  </option>
                );
              })}
            </select>
          </Field>
        </div>
        {duration > 0 && (
          <p className="booking-form__hint" aria-live="polite">
            Длительность: {formatDuration(duration)}
          </p>
        )}

        <Field id="booking-title" label="Название (необязательно)">
          <input
            id="booking-title"
            className="input"
            type="text"
            value={values.title}
            maxLength={TITLE_MAX_LENGTH}
            placeholder="Например, планёрка"
            autoComplete="off"
            onChange={handleChange('title')}
          />
        </Field>
      </fieldset>

      <div className="booking-form__actions">
        {!isReadOnly && (
          <button
            type="submit"
            className="button button--primary"
            disabled={isSubmitting}
            aria-busy={isSubmitting}
          >
            {isSubmitting ? 'Сохранение…' : submitLabel}
          </button>
        )}
        <button type="button" className="button" onClick={onCancel} disabled={isSubmitting}>
          {isReadOnly ? 'Закрыть' : 'Отмена'}
        </button>
        {onDelete && (
          <button
            type="button"
            className="button button--danger booking-form__delete"
            onClick={onDelete}
            disabled={isSubmitting}
          >
            Удалить
          </button>
        )}
      </div>
    </form>
  );
};

type FieldProps = {
  id: string;
  label: string;
  error?: string;
  children: ReactNode;
};

const Field = ({ id, label, error, children }: FieldProps) => (
  <div className="field">
    <label className="field__label" htmlFor={id}>
      {label}
    </label>
    {children}
    {error && (
      <p id={`${id}-error`} className="field__error">
        {error}
      </p>
    )}
  </div>
);
