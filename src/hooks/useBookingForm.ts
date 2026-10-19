import { useRef, useState, type FormEvent } from 'react';
import { isApiError } from '../api/apiError';
import { createBooking, updateBooking } from '../api/bookings';
import {
  getEndOptions,
  getLatestEnd,
  SLOT_MINUTES,
  toMinutes,
  toTime,
  validateBooking,
  type Booking,
  type BookingField,
} from '../domain/booking';

export type FormValues = { date: string; start: string; end: string; title: string };
export type EditableField = 'start' | 'end' | 'title';
export type FormErrorField = 'start' | 'end' | 'form';
export type FormErrors = Partial<Record<FormErrorField, string>>;

export type Draft =
  | { mode: 'create'; values: FormValues }
  | { mode: 'edit'; booking: Booking; values: FormValues };

type Options = {
  bookings: readonly Booking[];
  refresh: () => Promise<void>;
  onSaved: (message: string) => void;
};

const SAVE_ERROR_MESSAGE = 'Не удалось сохранить бронь. Проверьте соединение и попробуйте ещё раз';
const NOT_FOUND_MESSAGE = 'Эта бронь уже удалена, возможно, в другой вкладке. Можно сохранить её как новую';

const FOCUS_ORDER: readonly FormErrorField[] = ['form', 'start', 'end'];

const toErrorField = (field: BookingField): FormErrorField => (field === 'date' ? 'form' : field);

const toConflictMessage = ({ start, end, title }: Booking): string =>
  `Пока вы заполняли форму, это время заняли: ${start}–${end}${title ? ` «${title}»` : ''}. Выберите другое время`;

const toSubmitErrors = (error: unknown): FormErrors => {
  if (!isApiError(error)) return { form: SAVE_ERROR_MESSAGE };
  if (error.status === 409) {
    return { form: error.conflictWith ? toConflictMessage(error.conflictWith) : error.message };
  }
  if (error.status === 404) return { form: NOT_FOUND_MESSAGE };
  return { [error.field ? toErrorField(error.field) : 'form']: error.message };
};

const slotValues = (date: string, start: string, title: string): FormValues => ({
  date,
  start,
  end: toTime(toMinutes(start) + SLOT_MINUTES),
  title,
});

export const useBookingForm = ({ bookings, refresh, onSaved }: Options) => {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOrphaned, setIsOrphaned] = useState(false);
  const [openCount, setOpenCount] = useState(0);
  const [errorFocus, setErrorFocus] = useState<{ field: FormErrorField } | null>(null);
  const isSubmittingRef = useRef(false);
  const versionRef = useRef(0);

  const replaceDraft = (next: Draft | null) => {
    versionRef.current += 1;
    setDraft(next);
    setErrors({});
    setIsOrphaned(false);
    if (next) setOpenCount((count) => count + 1);
  };

  const fail = (nextErrors: FormErrors) => {
    setErrors(nextErrors);
    const field = FOCUS_ORDER.find((key) => nextErrors[key]) ?? 'form';
    setErrorFocus({ field });
  };

  const startCreate = (date: string, start: string) => {
    replaceDraft({ mode: 'create', values: slotValues(date, start, '') });
  };

  const selectSlot = (date: string, start: string) => {
    if (draft?.mode !== 'create') {
      startCreate(date, start);
      return;
    }
    replaceDraft({ mode: 'create', values: slotValues(date, start, draft.values.title) });
  };

  const openEdit = (booking: Booking) => {
    const { date, start, end, title = '' } = booking;
    replaceDraft({ mode: 'edit', booking, values: { date, start, end, title } });
  };

  const close = () => replaceDraft(null);

  const convertToCreate = () => {
    if (draft) replaceDraft({ mode: 'create', values: draft.values });
  };

  const setField = (field: EditableField, value: string) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const values = { ...prev.values, [field]: value };
      if (field === 'start') {
        const excludeId = prev.mode === 'edit' ? prev.booking.id : undefined;
        const latestEnd = toMinutes(getLatestEnd(values.date, value, bookings, excludeId));
        const endOptions = getEndOptions(value);
        const available = endOptions.filter((end) => toMinutes(end) <= latestEnd);
        if (!available.includes(values.end)) values.end = available[0] ?? endOptions[0] ?? values.end;
      }
      return { ...prev, values };
    });
    setErrors((prev) => {
      const next = { ...prev };
      delete next.form;
      if (field !== 'title') delete next[field];
      return next;
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft || isSubmittingRef.current) return;

    const editingId = draft.mode === 'edit' ? draft.booking.id : undefined;
    const validation = validateBooking(draft.values, bookings, new Date(), editingId);
    if (!validation.ok) {
      fail({ [toErrorField(validation.field)]: validation.message });
      return;
    }

    const version = versionRef.current;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setErrors({});

    try {
      if (editingId) await updateBooking(editingId, draft.values);
      else await createBooking(draft.values);
      void refresh();
      onSaved(editingId ? 'Бронь обновлена' : 'Бронь создана');
      if (version === versionRef.current) replaceDraft(null);
    } catch (error) {
      if (isApiError(error) && (error.status === 409 || error.status === 404)) void refresh();
      if (version !== versionRef.current) return;
      fail(toSubmitErrors(error));
      setIsOrphaned(isApiError(error) && error.status === 404 && editingId !== undefined);
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return {
    draft,
    errors,
    isSubmitting,
    isOrphaned,
    openCount,
    errorFocus,
    startCreate,
    selectSlot,
    openEdit,
    close,
    convertToCreate,
    setField,
    handleSubmit,
  };
};
