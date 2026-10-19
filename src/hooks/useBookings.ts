import { useCallback, useEffect, useRef, useState } from 'react';
import { getErrorMessage } from '../api/apiError';
import { getBookings } from '../api/bookings';
import type { Booking } from '../domain/booking';

export type BookingsState =
  | { status: 'loading' }
  | {
      status: 'ready';
      date: string;
      bookings: Booking[];
      isRefreshing: boolean;
      refreshError: string | null;
    }
  | { status: 'error'; date: string; message: string };

const LOAD_ERROR_MESSAGE = 'Не удалось загрузить брони';

export const useBookings = (date: string) => {
  const [state, setState] = useState<BookingsState>({ status: 'loading' });
  const requestIdRef = useRef(0);
  const dateRef = useRef(date);

  const refresh = useCallback(async (): Promise<void> => {
    const requestId = ++requestIdRef.current;
    const requestedDate = dateRef.current;

    setState((prev) =>
      prev.status === 'ready' && prev.date === requestedDate
        ? { ...prev, isRefreshing: true }
        : { status: 'loading' },
    );

    try {
      const bookings = await getBookings(requestedDate);
      if (requestId !== requestIdRef.current) return;
      setState({ status: 'ready', date: requestedDate, bookings, isRefreshing: false, refreshError: null });
    } catch (error) {
      if (requestId !== requestIdRef.current) return;
      const message = getErrorMessage(error, LOAD_ERROR_MESSAGE);
      setState((prev) =>
        prev.status === 'ready' && prev.date === requestedDate
          ? { ...prev, isRefreshing: false, refreshError: message }
          : { status: 'error', date: requestedDate, message },
      );
    }
  }, []);

  useEffect(() => {
    dateRef.current = date;
    void refresh();
    return () => {
      requestIdRef.current += 1;
    };
  }, [date, refresh]);

  const current: BookingsState =
    state.status !== 'loading' && state.date !== date ? { status: 'loading' } : state;

  return { state: current, refresh };
};
